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
	const isGmail = host === "smtp.gmail.com" || !process.env.SMTP_HOST;
	const port = parseInt(process.env.SMTP_PORT || "465", 10);
	const isSecure = port === 465;
	const user = (process.env.SMTP_USER || "").trim();
	// Google App Passwords often contain spaces (e.g. "abcd efgh ijkl mnop"), strip them safely
	const pass = (process.env.SMTP_PASS || "").replace(/\s+/g, "");

	const transportConfig = isGmail
		? {
				service: "gmail",
				auth: {
					user,
					pass,
				},
				connectionTimeout: 10000,
				greetingTimeout: 10000,
				socketTimeout: 15000,
		  }
		: {
				host,
				port,
				secure: isSecure,
				...(port === 587 && { requireTLS: true }),
				auth: {
					user,
					pass,
				},
				connectionTimeout: 10000,
				greetingTimeout: 10000,
				socketTimeout: 15000,
		  };

	cachedTransporter = nodemailer.createTransport(transportConfig);
	return cachedTransporter;
};

/**
 * Diagnostic check to verify SMTP connectivity on startup.
 * Non-blocking, logs status safely without leaking passwords.
 */
export const verifyTransporter = async () => {
	try {
		console.log("[EMAIL SERVICE] Configuration diagnostic:", {
			SMTP_USER: process.env.SMTP_USER ? `${process.env.SMTP_USER.slice(0, 3)}***` : "MISSING",
			SMTP_PASS: process.env.SMTP_PASS ? "[SET]" : "MISSING",
			SMTP_HOST: process.env.SMTP_HOST || "smtp.gmail.com (default)",
			SMTP_PORT: process.env.SMTP_PORT || "465 (default)",
		});

		if (!isConfigured()) {
			console.warn("[EMAIL SERVICE] SMTP_USER or SMTP_PASS not set. Emails will not send until credentials are provided in your environment variables.");
			return false;
		}

		const transporter = getTransporter();
		await transporter.verify();
		console.log("[EMAIL SERVICE] Gmail SMTP transporter verified successfully. Ready to send emails.");
		return true;
	} catch (error) {
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
		throw new Error("SMTP credentials are not configured. Please add SMTP_USER and SMTP_PASS (Google App Password) in your Render environment variables.");
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
