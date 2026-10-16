import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

/**
 * Strips HTML tags to generate a clean plain-text fallback for email clients
 * that do not support or render HTML.
 */
const htmlToPlainText = (html) => {
	if (!html) return "";
	return html
		.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
		.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/p>/gi, "\n\n")
		.replace(/<\/h[1-6]>/gi, "\n\n")
		.replace(/<\/li>/gi, "\n")
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
};

/**
 * Checks if SMTP credentials are configured.
 */
export const isConfigured = () => {
	const user = process.env.SMTP_USER;
	const pass = process.env.SMTP_PASS;
	return Boolean(user && pass && user.trim() !== "" && pass.trim() !== "");
};

// Singleton transporter instance
let cachedTransporter = null;

/**
 * Creates or retrieves the shared Nodemailer transporter instance.
 * Configured specifically for Gmail SMTP.
 */
export const getTransporter = () => {
	if (cachedTransporter) {
		return cachedTransporter;
	}

	const host = process.env.SMTP_HOST || "smtp.gmail.com";
	const port = parseInt(process.env.SMTP_PORT || "465", 10);
	const isSecure = port === 465;
	const user = (process.env.SMTP_USER || "").trim();
	// Google App Passwords often contain spaces (e.g. "abcd efgh ijkl mnop"), strip them safely
	const pass = (process.env.SMTP_PASS || "").replace(/\s+/g, "");

	cachedTransporter = nodemailer.createTransport({
		host,
		port,
		secure: isSecure, // true for 465 (SSL), false for 587 (TLS/STARTTLS)
		...(port === 587 && { requireTLS: true }),
		auth: {
			user,
			pass,
		},
		pool: true, // reuse pooled connections
		maxConnections: 5,
		maxMessages: 100,
		connectionTimeout: 10000, // 10s connection timeout
		greetingTimeout: 10000,
		socketTimeout: 15000,
	});

	return cachedTransporter;
};

/**
 * Optional diagnostic check to verify SMTP connectivity on startup.
 * Non-blocking, fails gracefully without crashing the server.
 */
export const verifyTransporter = async () => {
	try {
		if (!isConfigured()) {
			console.warn("[EMAIL SERVICE] SMTP_USER or SMTP_PASS not set in .env. Running in unconfigured/mock mode.");
			return false;
		}

		const transporter = getTransporter();
		await transporter.verify();
		console.log("[EMAIL SERVICE] Gmail SMTP transporter verified successfully. Ready to send emails.");
		return true;
	} catch (error) {
		// Log sanitized error message without leaking sensitive auth details
		console.warn(`[EMAIL SERVICE] Transporter verification failed: ${error.message || error}`);
		return false;
	}
};

/**
 * Reusable asynchronous email sending function.
 *
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject line
 * @param {string} [options.html] - HTML body
 * @param {string} [options.text] - Plain text body (auto-derived from HTML if omitted)
 * @returns {Promise<Object>} Result with messageId and response
 */
export const sendEmail = async ({ to, subject, html, text }) => {
	// 1. Validate required arguments
	if (!to || typeof to !== "string" || to.trim() === "") {
		throw new Error("Recipient email ('to') is required");
	}

	const trimmedTo = to.trim();

	// Prevent header injection attack (RFC 2822 newline injection)
	if (/[\r\n]/.test(trimmedTo)) {
		throw new Error("Invalid recipient email address: contains prohibited newline characters");
	}

	if (!subject || typeof subject !== "string" || subject.trim() === "") {
		throw new Error("Email 'subject' is required");
	}

	if (!html && !text) {
		throw new Error("Email content ('html' or 'text') is required");
	}

	// 2. Check if SMTP credentials exist
	if (!isConfigured()) {
		if (process.env.NODE_ENV === "development") {
			console.log("\n================ [DEV MOCK EMAIL] ================");
			console.log(`To: ${trimmedTo}`);
			console.log(`Subject: ${subject}`);
			console.log(`Body preview: ${(text || htmlToPlainText(html)).slice(0, 150)}...`);
			console.log("===================================================\n");
			return {
				success: true,
				mock: true,
				messageId: `mock-${Date.now()}`,
				message: "Email logged in dev mock mode (SMTP credentials missing)",
			};
		}
		throw new Error("Email service is unconfigured: SMTP_USER and SMTP_PASS are required");
	}

	// 3. Prepare email payload
	const senderAddress = (process.env.EMAIL_FROM || process.env.SMTP_USER || "").trim();
	const senderName = (process.env.EMAIL_FROM_NAME || "Auth App").trim();
	const fromHeader = `"${senderName}" <${senderAddress}>`;

	const mailOptions = {
		from: fromHeader,
		to: trimmedTo,
		subject: subject.trim(),
		html: html || undefined,
		text: text || htmlToPlainText(html),
	};

	// 4. Send email via Nodemailer Gmail SMTP
	try {
		const transporter = getTransporter();
		const info = await transporter.sendMail(mailOptions);

		// Safe logging - never log passwords, tokens, or private body content
		console.log(`[EMAIL SERVICE] Email sent successfully to ${trimmedTo} (Message ID: ${info.messageId})`);

		return {
			success: true,
			messageId: info.messageId,
			response: info.response,
			accepted: info.accepted,
			rejected: info.rejected,
		};
	} catch (error) {
		// Safe error logging without sensitive exposure
		console.error(`[EMAIL SERVICE] Failed to send email to ${trimmedTo}:`, error.message);
		throw new Error(`Email delivery failed: ${error.message}`);
	}
};

export default sendEmail;
