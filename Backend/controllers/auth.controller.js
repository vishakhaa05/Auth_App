import { User } from "../models/user.model.js";
import bcryptjs from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";

import { generateTokensAndSetCookies, getCookieOptions } from "../utils/generateTokenAndSetCookie.js";
import { sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail, sendResetSuccessEmail } from "../utils/emails.js";

export const signup = async (req, res) => {
	const { email, password, name } = req.body || {};

	try {
		if (!email || !password || !name) {
			return res.status(400).json({ success: false, message: "All fields are required" });
		}

		const normalizedEmail = email.toLowerCase().trim();
		const userAlreadyExists = await User.findOne({ email: normalizedEmail });
		if (userAlreadyExists) {
			if (!userAlreadyExists.isVerified) {
				// User previously started signup but never completed verification; refresh credentials & token
				const verificationToken = crypto.randomInt(100000, 1000000).toString();
				userAlreadyExists.password = await bcryptjs.hash(password, 10);
				userAlreadyExists.name = name.trim();
				userAlreadyExists.verificationToken = verificationToken;
				userAlreadyExists.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000;
				userAlreadyExists.lastVerificationSent = new Date();
				const { refreshToken } = generateTokensAndSetCookies(res, userAlreadyExists._id);
				userAlreadyExists.refreshToken = refreshToken;
				await userAlreadyExists.save();

				let emailSent = true;
				try {
					await sendVerificationEmail(userAlreadyExists.email, verificationToken);
				} catch (mailErr) {
					emailSent = false;
					console.warn("[EMAIL SERVICE] Could not send verification email on existing unverified signup:", mailErr.message);
				}

				return res.status(200).json({
					success: true,
					message: emailSent
						? "Account already registered but unverified. A new verification code has been sent."
						: "Account updated. Note: Email service could not deliver OTP. Check SMTP settings in Render.",
					user: {
						id: userAlreadyExists._id,
						email: userAlreadyExists.email,
						name: userAlreadyExists.name,
						isVerified: userAlreadyExists.isVerified,
						role: userAlreadyExists.role,
						createdAt: userAlreadyExists.createdAt,
						updatedAt: userAlreadyExists.updatedAt,
					},
				});
			}
			return res.status(400).json({ success: false, message: "User already exists" });
		}

		const hashedPassword = await bcryptjs.hash(password, 10);
		// Cryptographically secure 6-digit verification code
		const verificationToken = crypto.randomInt(100000, 1000000).toString();

		const user = new User({
			email: normalizedEmail,
			password: hashedPassword,
			name: name.trim(),
			verificationToken,
			verificationTokenExpires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
			lastVerificationSent: new Date(),
		});

		const { refreshToken } = generateTokensAndSetCookies(res, user._id);
		user.refreshToken = refreshToken;
		await user.save();

		let emailSent = true;
		try {
			await sendVerificationEmail(user.email, verificationToken);
		} catch (mailErr) {
			emailSent = false;
			console.warn("[EMAIL SERVICE] Failed to send verification email on new signup:", mailErr.message);
		}

		res.status(201).json({
			success: true,
			message: emailSent
				? "User created successfully. Please verify your email."
				: "Account created! Note: Email delivery failed. Please verify SMTP credentials in Render.",
			user: {
				id: user._id,
				email: user.email,
				name: user.name,
				isVerified: user.isVerified,
				role: user.role,
				createdAt: user.createdAt,
				updatedAt: user.updatedAt,
			},
		});
	} catch (error) {
		res.status(400).json({ success: false, message: error.message });
	}
};

export const verifyEmail = async (req, res) => {
	const { code } = req.body;
	try {
		if (!code) {
			return res.status(400).json({ success: false, message: "Verification code is required" });
		}

		const user = await User.findOne({
			verificationToken: String(code).trim(),
			verificationTokenExpires: { $gt: Date.now() },
		});

		if (!user) {
			return res.status(400).json({ success: false, message: "Invalid or expired verification code" });
		}

		user.isVerified = true;
		user.verificationToken = undefined;
		user.verificationTokenExpires = undefined;

		const { refreshToken } = generateTokensAndSetCookies(res, user._id);
		user.refreshToken = refreshToken;
		await user.save();

		// Send welcome email after account is marked verified
		try {
			await sendWelcomeEmail(user.email, user.name);
		} catch (mailError) {
			console.warn("[EMAIL SERVICE] Welcome email failed to send:", mailError.message);
		}

		res.status(200).json({
			success: true,
			message: "Email verified successfully",
			user: {
				id: user._id,
				email: user.email,
				name: user.name,
				isVerified: user.isVerified,
				role: user.role,
				createdAt: user.createdAt,
				updatedAt: user.updatedAt,
			},
		});
	} catch (error) {
		console.error("Error in verifyEmail ", error);
		res.status(500).json({ success: false, message: "Server error during email verification" });
	}
};

export const login = async (req, res) => {
	const { email, password } = req.body;
	try {
		if (!email || !password) {
			return res.status(400).json({ success: false, message: "Email and password are required" });
		}

		const normalizedEmail = email.toLowerCase().trim();
		const user = await User.findOne({ email: normalizedEmail });
		if (!user) {
			return res.status(400).json({ success: false, message: "Invalid credentials" });
		}

		const isPasswordValid = await bcryptjs.compare(password, user.password);
		if (!isPasswordValid) {
			return res.status(400).json({ success: false, message: "Invalid credentials" });
		}

		// Login with verified email check
		if (!user.isVerified) {
			const verificationToken = crypto.randomInt(100000, 1000000).toString();
			user.verificationToken = verificationToken;
			user.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000;
			user.lastVerificationSent = new Date();
			await user.save();

			try {
				await sendVerificationEmail(user.email, verificationToken);
			} catch (mailErr) {
				console.warn("[EMAIL SERVICE] Failed to send verification email on unverified login:", mailErr.message);
			}

			return res.status(400).json({
				success: false,
				isNotVerified: true,
				message: "Email not verified. Please check your inbox or request a new code.",
			});
		}

		const { refreshToken } = generateTokensAndSetCookies(res, user._id);
		user.refreshToken = refreshToken;
		user.lastLogin = new Date();
		await user.save();

		res.status(200).json({
			success: true,
			message: "Logged in successfully",
			user: {
				id: user._id,
				email: user.email,
				name: user.name,
				isVerified: user.isVerified,
				role: user.role,
				createdAt: user.createdAt,
				updatedAt: user.updatedAt,
			},
		});
	} catch (error) {
		console.error("Error in login ", error);
		res.status(400).json({ success: false, message: error.message });
	}
};

export const logout = async (req, res) => {
	try {
		// Invalidate token in DB if user cookie is present
		const token = req.cookies?.token;
		if (token) {
			try {
				const decoded = jwt.verify(token, process.env.JWT_SECRET);
				if (decoded?.userId) {
					await User.findByIdAndUpdate(decoded.userId, { refreshToken: null });
				}
			} catch (err) {
				// Access token might be expired, check refresh token cookie
				const refreshTok = req.cookies?.refreshToken;
				if (refreshTok) {
					try {
						const decodedRefresh = jwt.verify(refreshTok, process.env.JWT_REFRESH_SECRET);
						if (decodedRefresh?.userId) {
							await User.findByIdAndUpdate(decodedRefresh.userId, { refreshToken: null });
						}
					} catch (_) {}
				}
			}
		}

		const cookieOptions = getCookieOptions();
		res.clearCookie("token", cookieOptions);
		res.clearCookie("refreshToken", cookieOptions);
		res.status(200).json({ success: true, message: "Logged out successfully" });
	} catch (error) {
		res.status(500).json({ success: false, message: error.message });
	}
};

export const forgotPassword = async (req, res) => {
	const { email } = req.body;
	try {
		if (!email) {
			return res.status(400).json({ success: false, message: "Email is required" });
		}

		const normalizedEmail = email.toLowerCase().trim();
		const user = await User.findOne({ email: normalizedEmail });

		// Always return generic response to avoid exposing whether an account exists
		if (!user) {
			return res.status(200).json({
				success: true,
				message: "If an account exists with that email, a password reset link has been sent.",
			});
		}

		// Generate cryptographically secure single-use reset token
		const resetToken = crypto.randomBytes(20).toString("hex");
		const resetTokenExpires = Date.now() + 1 * 60 * 60 * 1000; // 1 hour

		user.resetPasswordToken = resetToken;
		user.resetPasswordExpires = resetTokenExpires;
		await user.save();

		// Send reset link using configured CLIENT_URL
		const clientUrl = (process.env.CLIENT_URL || "http://localhost:5173").split(",")[0].trim().replace(/\/+$/, "");
		try {
			await sendPasswordResetEmail(user.email, `${clientUrl}/reset-password/${resetToken}`);
		} catch (mailErr) {
			console.error("[EMAIL SERVICE] Failed to deliver password reset email:", mailErr.message);
			return res.status(500).json({
				success: false,
				message: `Email delivery failed: ${mailErr.message}`,
			});
		}

		res.status(200).json({
			success: true,
			message: "If an account exists with that email, a password reset link has been sent.",
		});
	} catch (error) {
		console.error("Error in forgotPassword ", error);
		res.status(500).json({ success: false, message: "Error processing password reset request" });
	}
};

export const resetPassword = async (req, res) => {
	try {
		const { token } = req.params;
		const { password } = req.body;

		if (!password) {
			return res.status(400).json({ success: false, message: "New password is required" });
		}

		if (password.length < 6) {
			return res.status(400).json({ success: false, message: "Password must be at least 6 characters long" });
		}

		const user = await User.findOne({
			resetPasswordToken: token,
			resetPasswordExpires: { $gt: Date.now() },
		});

		if (!user) {
			return res.status(400).json({ success: false, message: "Invalid or expired reset token" });
		}

		// Update password and invalidate single-use token
		const hashedPassword = await bcryptjs.hash(password, 10);
		user.password = hashedPassword;
		user.resetPasswordToken = undefined;
		user.resetPasswordExpires = undefined;
		await user.save();

		// Send confirmation email
		try {
			await sendResetSuccessEmail(user.email);
		} catch (mailError) {
			console.warn("[EMAIL SERVICE] Password reset success confirmation email failed:", mailError.message);
		}

		res.status(200).json({ success: true, message: "Password reset successful" });
	} catch (error) {
		console.error("Error in resetPassword ", error);
		res.status(500).json({ success: false, message: "Error resetting password" });
	}
};

export const checkAuth = async (req, res) => {
	try {
		const user = await User.findById(req.userId).select("-password -refreshToken -verificationToken -resetPasswordToken");
		if (!user) {
			return res.status(400).json({ success: false, message: "User not found" });
		}

		res.status(200).json({ success: true, user });
	} catch (error) {
		console.error("Error in checkAuth ", error);
		res.status(400).json({ success: false, message: error.message });
	}
};

export const refreshToken = async (req, res) => {
	const refToken = req.cookies?.refreshToken;
	if (!refToken) {
		return res.status(401).json({ success: false, message: "Access Denied. No refresh token provided." });
	}

	try {
		const decoded = jwt.verify(refToken, process.env.JWT_REFRESH_SECRET);
		const user = await User.findById(decoded.userId);

		if (!user || user.refreshToken !== refToken) {
			return res.status(401).json({ success: false, message: "Invalid or expired refresh token" });
		}

		// Refresh Token Rotation: issue new access token & new refresh token
		const { refreshToken: newRefreshToken } = generateTokensAndSetCookies(res, user._id);
		user.refreshToken = newRefreshToken;
		await user.save();

		res.status(200).json({ success: true, message: "Token refreshed successfully" });
	} catch (error) {
		console.error("Error in refreshToken ", error);
		res.status(401).json({ success: false, message: "Invalid or expired refresh token" });
	}
};

export const changePassword = async (req, res) => {
	const { currentPassword, newPassword } = req.body;
	try {
		if (!currentPassword || !newPassword) {
			return res.status(400).json({ success: false, message: "Both current and new passwords are required" });
		}

		const user = await User.findById(req.userId);
		if (!user) {
			return res.status(400).json({ success: false, message: "User not found" });
		}

		const isPasswordValid = await bcryptjs.compare(currentPassword, user.password);
		if (!isPasswordValid) {
			return res.status(400).json({ success: false, message: "Incorrect current password" });
		}

		const hashedPassword = await bcryptjs.hash(newPassword, 10);
		user.password = hashedPassword;
		await user.save();

		res.status(200).json({ success: true, message: "Password updated successfully" });
	} catch (error) {
		console.error("Error in changePassword ", error);
		res.status(400).json({ success: false, message: error.message });
	}
};

export const getUserProfile = async (req, res) => {
	try {
		const user = await User.findById(req.userId).select("-password -refreshToken");
		if (!user) {
			return res.status(404).json({ success: false, message: "Profile not found" });
		}
		res.status(200).json({ success: true, user });
	} catch (error) {
		res.status(500).json({ success: false, message: error.message });
	}
};

export const updateUserProfile = async (req, res) => {
	const { name, role } = req.body;
	try {
		const user = await User.findById(req.userId);
		if (!user) {
			return res.status(404).json({ success: false, message: "User not found" });
		}

		if (name) user.name = name;
		if (role) user.role = role;

		await user.save();

		res.status(200).json({
			success: true,
			message: "Profile updated successfully",
			user: {
				id: user._id,
				email: user.email,
				name: user.name,
				isVerified: user.isVerified,
				role: user.role,
				createdAt: user.createdAt,
				updatedAt: user.updatedAt,
			},
		});
	} catch (error) {
		res.status(400).json({ success: false, message: error.message });
	}
};

export const resendVerificationEmail = async (req, res) => {
	try {
		let user;

		// 1. Check if user is authenticated via cookie or authorization header
		const token = req.cookies?.token || (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.split(" ")[1] : null);
		if (token) {
			try {
				const decoded = jwt.verify(token, process.env.JWT_SECRET);
				if (decoded?.userId) {
					user = await User.findById(decoded.userId);
				}
			} catch (_) {
				// Access token might be expired; check refreshToken cookie
				const refreshTok = req.cookies?.refreshToken;
				if (refreshTok) {
					try {
						const decodedRefresh = jwt.verify(refreshTok, process.env.JWT_REFRESH_SECRET);
						if (decodedRefresh?.userId) {
							user = await User.findById(decodedRefresh.userId);
						}
					} catch (_) {}
				}
			}
		}

		// 2. Fallback: Identify pending user by email provided in request body
		if (!user && req.body?.email) {
			user = await User.findOne({ email: req.body.email.toLowerCase().trim() });
		}

		if (!user) {
			return res.status(400).json({
				success: false,
				message: "User not found. Please provide a valid registered email address.",
			});
		}

		if (user.isVerified) {
			return res.status(400).json({
				success: false,
				message: "This account is already verified. You can log in directly.",
			});
		}

		// 3. Cooldown check: enforce 60 seconds cooldown between resend requests
		const COOLDOWN_SECONDS = 60;
		if (user.lastVerificationSent) {
			const secondsSinceLast = Math.floor((Date.now() - new Date(user.lastVerificationSent).getTime()) / 1000);
			if (secondsSinceLast < COOLDOWN_SECONDS) {
				const remainingTime = COOLDOWN_SECONDS - secondsSinceLast;
				return res.status(429).json({
					success: false,
					message: `Please wait ${remainingTime} second${remainingTime === 1 ? "" : "s"} before requesting another code.`,
					cooldown: remainingTime,
				});
			}
		}

		// 4. Generate new 6-digit code and update expiry (24 hours)
		const verificationToken = crypto.randomInt(100000, 1000000).toString();
		user.verificationToken = verificationToken;
		user.verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000;
		user.lastVerificationSent = new Date();
		await user.save();

		// 5. Send verification email with code and direct link
		await sendVerificationEmail(user.email, verificationToken);

		res.status(200).json({
			success: true,
			message: "Verification code and link resent successfully to your email.",
		});
	} catch (error) {
		console.error("Error in resendVerificationEmail ", error);
		res.status(500).json({ success: false, message: error.message || "Server error" });
	}
};

