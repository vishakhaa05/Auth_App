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
 * Checks if any email delivery provider (Resend, Brevo, or SMTP) is configured.
 */
export const isConfigured = () => {
	if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim() !== "") return true;
	if (process.env.BREVO_API_KEY && process.env.BREVO_API_KEY.trim() !== "") return true;
	const user = process.env.SMTP_USER;
	const pass = process.env.SMTP_PASS;
	return Boolean(user && pass && user.trim() !== "" && pass.trim() !== "");
};

/**
 * Sends email via Resend HTTP API (Port 443 - HTTPS).
 * Immune to cloud provider SMTP firewall blocks on Render / AWS / Vercel.
 */
const sendViaResend = async ({ to, subject, html, text }) => {
	const sender = (process.env.EMAIL_FROM || "Auth App <onboarding@resend.dev>").trim();
	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${process.env.RESEND_API_KEY.trim()}`,
		},
		body: JSON.stringify({
			from: sender,
			to: [to],
			subject,
			html: html || undefined,
			text: text || undefined,
		}),
	});

	const data = await response.json();
	if (!response.ok) {
		throw new Error(data.message || `Resend API error: ${JSON.stringify(data)}`);
	}

	console.log(`[EMAIL SERVICE] Email sent via Resend API to ${to} (ID: ${data.id})`);
	return { success: true, messageId: data.id, provider: "resend" };
};

/**
 * Sends email via Brevo HTTP API (Port 443 - HTTPS).
 * 300 free emails/day to any recipient address.
 */
const sendViaBrevo = async ({ to, subject, html, text }) => {
	const senderEmail = (process.env.EMAIL_FROM || process.env.SMTP_USER || "noreply@authapp.com").trim();
	const senderName = (process.env.EMAIL_FROM_NAME || "Auth App").trim();

	const response = await fetch("https://api.brevo.com/v3/smtp/email", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"api-key": process.env.BREVO_API_KEY.trim(),
		},
		body: JSON.stringify({
			sender: { name: senderName, email: senderEmail },
			to: [{ email: to }],
			subject,
			htmlContent: html || undefined,
			textContent: text || undefined,
		}),
	});

	const data = await response.json();
	if (!response.ok) {
		throw new Error(data.message || `Brevo API error: ${JSON.stringify(data)}`);
	}

	console.log(`[EMAIL SERVICE] Email sent via Brevo API to ${to} (ID: ${data.messageId})`);
	return { success: true, messageId: data.messageId, provider: "brevo" };
};

// Singleton transporter instance
let cachedTransporter = null;

/**
 * Creates or retrieves the shared Nodemailer transporter instance.
 */
export const getTransporter = () => {
	if (cachedTransporter) {
		return cachedTransporter;
	}

	const host = process.env.SMTP_HOST || "smtp.gmail.com";
	const port = parseInt(process.env.SMTP_PORT || "465", 10);
	const isGmail = host === "smtp.gmail.com" || !process.env.SMTP_HOST;
	const user = (process.env.SMTP_USER || "").trim();
	const pass = (process.env.SMTP_PASS || "").replace(/\s+/g, "");

	const transportConfig = isGmail
		? {
				service: "gmail",
				auth: {
					user,
					pass,
				},
				connectionTimeout: 5000, // 5s connection timeout for faster error detection
				greetingTimeout: 5000,
				socketTimeout: 10000,
		  }
		: {
				host,
				port,
				secure: port === 465,
				...(port === 587 && { requireTLS: true }),
				auth: {
					user,
					pass,
				},
				connectionTimeout: 5000,
				greetingTimeout: 5000,
				socketTimeout: 10000,
		  };

	cachedTransporter = nodemailer.createTransport(transportConfig);
	return cachedTransporter;
};

/**
 * Diagnostic check to verify email connectivity on startup.
 * Non-blocking, logs status safely.
 */
export const verifyTransporter = async () => {
	try {
		console.log("[EMAIL SERVICE] Configuration diagnostic:", {
			RESEND_API_KEY: process.env.RESEND_API_KEY ? "[CONFIGURED]" : "NOT_SET",
			BREVO_API_KEY: process.env.BREVO_API_KEY ? "[CONFIGURED]" : "NOT_SET",
			SMTP_USER: process.env.SMTP_USER ? `${process.env.SMTP_USER.slice(0, 3)}***` : "NOT_SET",
			SMTP_PASS: process.env.SMTP_PASS ? "[CONFIGURED]" : "NOT_SET",
			SMTP_HOST: process.env.SMTP_HOST || "smtp.gmail.com (default)",
			SMTP_PORT: process.env.SMTP_PORT || "465 (default)",
		});

		if (process.env.RESEND_API_KEY) {
			console.log("[EMAIL SERVICE] Active provider: Resend HTTP API (Port 443 HTTPS - 100% firewall proof on Render)");
			return true;
		}

		if (process.env.BREVO_API_KEY) {
			console.log("[EMAIL SERVICE] Active provider: Brevo HTTP API (Port 443 HTTPS - 100% firewall proof on Render)");
			return true;
		}

		if (!isConfigured()) {
			console.warn("[EMAIL SERVICE] No email credentials set. Emails will not send until RESEND_API_KEY, BREVO_API_KEY, or SMTP credentials are added in Render.");
			return false;
		}

		const transporter = getTransporter();
		await transporter.verify();
		console.log("[EMAIL SERVICE] SMTP transporter verified successfully. Ready to send emails.");
		return true;
	} catch (error) {
		console.warn(`[EMAIL SERVICE] SMTP verification warning (outbound ports might be blocked on Render): ${error.message || error}`);
		return false;
	}
};

/**
 * Reusable asynchronous email sending function.
 * Automatically chooses the best provider:
 * 1. Resend API (HTTPS port 443) if RESEND_API_KEY is present
 * 2. Brevo API (HTTPS port 443) if BREVO_API_KEY is present
 * 3. Nodemailer SMTP (Gmail / Brevo port 2525)
 */
export const sendEmail = async ({ to, subject, html, text }) => {
	// 1. Validate required arguments
	if (!to || typeof to !== "string" || to.trim() === "") {
		throw new Error("Recipient email ('to') is required");
	}

	const trimmedTo = to.trim();

	if (/[\r\n]/.test(trimmedTo)) {
		throw new Error("Invalid recipient email address: contains prohibited newline characters");
	}

	if (!subject || typeof subject !== "string" || subject.trim() === "") {
		throw new Error("Email 'subject' is required");
	}

	if (!html && !text) {
		throw new Error("Email content ('html' or 'text') is required");
	}

	// 2. Dispatch via Resend HTTP API if configured
	if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim() !== "") {
		return await sendViaResend({ to: trimmedTo, subject, html, text });
	}

	// 3. Dispatch via Brevo HTTP API if configured
	if (process.env.BREVO_API_KEY && process.env.BREVO_API_KEY.trim() !== "") {
		return await sendViaBrevo({ to: trimmedTo, subject, html, text });
	}

	// 4. Check if SMTP credentials exist
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
				message: "Email logged in dev mock mode",
			};
		}
		throw new Error("Email service is unconfigured. Please add RESEND_API_KEY, BREVO_API_KEY, or SMTP credentials in your Render environment variables.");
	}

	// 5. Send email via Nodemailer SMTP
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

	try {
		const transporter = getTransporter();
		const info = await transporter.sendMail(mailOptions);
		console.log(`[EMAIL SERVICE] Email sent via SMTP to ${trimmedTo} (Message ID: ${info.messageId})`);

		return {
			success: true,
			messageId: info.messageId,
			response: info.response,
			accepted: info.accepted,
			rejected: info.rejected,
			provider: "smtp",
		};
	} catch (error) {
		console.error(`[EMAIL SERVICE] SMTP send failed to ${trimmedTo}:`, error.message);
		if (error.message && (error.message.includes("timeout") || error.code === "ETIMEDOUT")) {
			throw new Error("Connection timeout: Render blocks outbound ports 465/587 to Gmail. Use Resend (add RESEND_API_KEY) or Brevo (add BREVO_API_KEY) in Render for reliable HTTPS delivery.");
		}
		throw new Error(`Email delivery failed: ${error.message}`);
	}
};

export default sendEmail;
