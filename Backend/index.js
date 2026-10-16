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

// Security Headers
app.use(helmet());

// CORS config
const clientOrigin = process.env.CLIENT_URL || "http://localhost:5173";
app.use(cors({ origin: clientOrigin, credentials: true }));

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

// Routes
app.use("/api/auth", authRoutes);

if (process.env.NODE_ENV === "production") {
	app.use(express.static(path.join(__dirname, "/Frontend/dist")));

	app.get("*", (req, res) => {
		res.sendFile(path.resolve(__dirname, "Frontend", "dist", "index.html"));
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
