import { getTransporter, isConfigured, sendEmail, verifyTransporter } from "./sendEmail.js";
import dotenv from "dotenv";

dotenv.config();

export const transporter = getTransporter();

export const sender = {
	email: process.env.EMAIL_FROM || process.env.SMTP_USER || "your-gmail@gmail.com",
	name: process.env.EMAIL_FROM_NAME || "Auth App",
};

export const isMockMode = () => !isConfigured();

export { sendEmail, verifyTransporter };
