import express from "express";
import {
	login,
	logout,
	signup,
	verifyEmail,
	resendVerificationEmail,
	forgotPassword,
	resetPassword,
	checkAuth,
	refreshToken,
	changePassword,
	updateUserProfile
} from "../controllers/auth.controller.js";
import { verifyToken } from "../middleware/verifyToken.js";

const router = express.Router();

router.get("/check-auth", verifyToken, checkAuth);

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);

router.post("/verify-email", verifyEmail);
router.post("/resend-verification", resendVerificationEmail);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

// New Routes
router.post("/refresh-token", refreshToken);
router.post("/change-password", verifyToken, changePassword);
router.put("/profile", verifyToken, updateUserProfile);

export default router;
