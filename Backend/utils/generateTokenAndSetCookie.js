import jwt from "jsonwebtoken";

export const generateTokensAndSetCookies = (res, userId) => {
	const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, {
		expiresIn: "15m",
	});

	const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
		expiresIn: "7d",
	});

	// Set access token cookie (named 'token' for backward compatibility)
	res.cookie("token", accessToken, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "strict",
		maxAge: 15 * 60 * 1000, // 15 minutes
	});

	// Set refresh token cookie
	res.cookie("refreshToken", refreshToken, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "strict",
		maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
	});

	return { accessToken, refreshToken };
};

// Alias for compatibility
export const generateTokenAndSetCookie = (res, userId) => {
	const { accessToken } = generateTokensAndSetCookies(res, userId);
	return accessToken;
};
