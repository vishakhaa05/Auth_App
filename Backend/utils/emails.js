import { sendEmail } from "./sendEmail.js";
import {
	PASSWORD_RESET_REQUEST_TEMPLATE,
	PASSWORD_RESET_SUCCESS_TEMPLATE,
	VERIFICATION_EMAIL_TEMPLATE,
	WELCOME_EMAIL_TEMPLATE,
} from "./emailTemplates.js";

const getClientUrl = () => {
	const raw = process.env.CLIENT_URL || "http://localhost:5173";
	return raw.split(",")[0].trim().replace(/\/+$/, "");
};

/**
 * Sends a 6-digit email verification code and direct activation link to the user.
 *
 * @param {string} email - Recipient email address
 * @param {string} verificationToken - 6-digit OTP verification code
 */
export const sendVerificationEmail = async (email, verificationToken) => {
	const clientUrl = getClientUrl();
	const verificationURL = `${clientUrl}/verify-email?code=${verificationToken}`;

	const html = VERIFICATION_EMAIL_TEMPLATE
		.replace(/{verificationCode}/g, verificationToken)
		.replace(/{verificationURL}/g, verificationURL);

	const text = `Hello,\n\nThank you for signing up!\n\nYour 6-digit verification code is: ${verificationToken}\n\nAlternatively, verify your account directly by clicking this link:\n${verificationURL}\n\nThis verification code and link will expire in 24 hours.\n\nIf you didn't create an account, please ignore this email.\n\nBest regards,\nYour App Team`;

	return await sendEmail({
		to: email,
		subject: "Verify your email",
		html,
		text,
	});
};

/**
 * Sends a welcome email after an account is successfully verified.
 *
 * @param {string} email - Recipient email address
 * @param {string} name - User's full name
 */
export const sendWelcomeEmail = async (email, name) => {
	const displayName = name || "there";
	const html = WELCOME_EMAIL_TEMPLATE.replace(/{name}/g, displayName);
	const text = `Hello ${displayName},\n\nWe're thrilled to welcome you to our platform! Your email has been successfully verified, and your account is now fully active.\n\nBest regards,\nYour App Team`;

	return await sendEmail({
		to: email,
		subject: "Welcome to Our Platform!",
		html,
		text,
	});
};

/**
 * Sends a single-use password reset link with token.
 *
 * @param {string} email - Recipient email address
 * @param {string} resetURL - Secure URL containing the password reset token
 */
export const sendPasswordResetEmail = async (email, resetURL) => {
	const html = PASSWORD_RESET_REQUEST_TEMPLATE.replace(/{resetURL}/g, resetURL);
	const text = `Hello,\n\nWe received a request to reset your password. If you didn't make this request, please ignore this email.\n\nTo reset your password, visit the following link:\n${resetURL}\n\nThis link will expire in 1 hour for security reasons.\n\nBest regards,\nYour App Team`;

	return await sendEmail({
		to: email,
		subject: "Reset your password",
		html,
		text,
	});
};

/**
 * Sends a confirmation email after a password has been successfully reset.
 *
 * @param {string} email - Recipient email address
 */
export const sendResetSuccessEmail = async (email) => {
	const html = PASSWORD_RESET_SUCCESS_TEMPLATE;
	const text = `Hello,\n\nWe're writing to confirm that your password has been successfully reset.\n\nIf you did not initiate this password reset, please contact our support team immediately.\n\nBest regards,\nYour App Team`;

	return await sendEmail({
		to: email,
		subject: "Password Reset Successful",
		html,
		text,
	});
};

export { sendEmail };
