import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

import { connectDB } from "./db/connectDB.js";
import authRoutes from "./routes/auth.route.js";
import { xssSanitize } from "./middleware/xssSanitize.js";
import { mongoSanitize } from "./middleware/mongoSanitize.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { verifyTransporter } from "./utils/sendEmail.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const __dirname = path.resolve();

// Trust reverse proxy (Render, Heroku, AWS ELB) for rate limiting & secure cookies
app.set("trust proxy", 1);

// Security Headers
app.use(
	helmet({
		crossOriginResourcePolicy: { policy: "cross-origin" },
	})
);

// CORS config supporting local dev, comma-separated CLIENT_URL, and Vercel domains
const parseOrigins = () => {
	const defaultOrigins = ["http://localhost:5173", "http://localhost:5001", "http://localhost:3000"];
	if (!process.env.CLIENT_URL) return defaultOrigins;
	const customOrigins = process.env.CLIENT_URL.split(",")
		.map((url) => url.trim().replace(/\/+$/, ""))
		.filter(Boolean);
	return [...new Set([...defaultOrigins, ...customOrigins])];
};

const allowedOrigins = parseOrigins();

app.use(
	cors({
		origin: (origin, callback) => {
			if (!origin) return callback(null, true);
			const normalized = origin.replace(/\/+$/, "");
			if (
				allowedOrigins.includes(normalized) ||
				process.env.NODE_ENV !== "production" ||
				normalized.endsWith(".vercel.app")
			) {
				return callback(null, true);
			}
			return callback(null, true);
		},
		credentials: true,
	})
);

// Body parsers & cookies
app.use(express.json({ limit: "10kb" })); // limit body size to prevent DOS
app.use(cookieParser());

// Data sanitization against NoSQL query injection
app.use(mongoSanitize);

// Data sanitization against XSS
app.use(xssSanitize);

// Rate limiting
const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 mins
	limit: 100,
	standardHeaders: "draft-7",
	legacyHeaders: false,
	message: { success: false, message: "Too many requests from this IP, please try again after 15 minutes" },
});

const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 15,
	standardHeaders: "draft-7",
	legacyHeaders: false,
	message: { success: false, message: "Too many login/auth requests, please try again after 15 minutes" },
});

// Apply rate limiters
app.use("/api", apiLimiter);
app.use("/api/auth/signup", authLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/api/auth/resend-verification", authLimiter);

// Health check endpoint (for Render / uptime monitoring)
app.get("/api/health", (req, res) => {
	res.status(200).json({ status: "healthy", uptime: process.uptime() });
});

// Routes
app.use("/api/auth", authRoutes);

const frontendDist = path.join(__dirname, "Frontend", "dist");

if (process.env.NODE_ENV === "production") {
	app.use(express.static(frontendDist));

	// Catch-all route for SPA client routing in Express 5
	app.get("{*splat}", (req, res, next) => {
		if (req.path.startsWith("/api")) return next();
		res.sendFile(path.resolve(frontendDist, "index.html"), (err) => {
			if (err) {
				// Standalone API deployment fallback
				res.status(200).json({
					success: true,
					message: "Auth API is running smoothly",
				});
			}
		});
	});
} else {
	app.get("/", (req, res) => {
		res.status(200).json({
			success: true,
			message: "Auth API dev server is running",
		});
	});
}

// Error handling middleware
app.use(errorHandler);

app.listen(PORT, async () => {
	await connectDB();
	console.log("Server is running on port: ", PORT);
	// Diagnostic check for SMTP connection (non-blocking)
	verifyTransporter().catch((err) => {
		console.warn("[EMAIL SERVICE] Startup transporter check warning:", err.message);
	});
});
