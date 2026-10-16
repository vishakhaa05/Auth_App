import { create } from "zustand";
import axios from "axios";

const formatApiUrl = () => {
	const rawUrl = (import.meta.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
	if (!rawUrl) {
		return import.meta.env.MODE === "production" ? "/api/auth" : "http://localhost:5001/api/auth";
	}
	// Automatically append /api/auth if omitted by user in environment variables
	if (rawUrl.endsWith("/api/auth")) {
		return rawUrl;
	}
	if (rawUrl.endsWith("/api")) {
		return `${rawUrl}/auth`;
	}
	return `${rawUrl}/api/auth`;
};

const API_URL = formatApiUrl();
axios.defaults.withCredentials = true;

export const useAuthStore = create((set) => ({
	user: null,
	isAuthenticated: false,
	error: null,
	isLoading: false,
	isCheckingAuth: true,
	message: null,

	signup: async (email, password, name) => {
		set({ isLoading: true, error: null });
		try {
			const response = await axios.post(`${API_URL}/signup`, { email, password, name });
			if (response.data && response.data.user) {
				set({ user: response.data.user, isAuthenticated: true, isLoading: false });
			} else {
				set({ user: null, isAuthenticated: false, isLoading: false });
			}
		} catch (error) {
			set({ user: null, isAuthenticated: false, error: error.response?.data?.message || "Error signing up", isLoading: false });
			throw error;
		} 
	},
	login: async (email, password) => {
		set({ isLoading: true, error: null });
		try {
			const response = await axios.post(`${API_URL}/login`, { email, password });
			if (response.data && response.data.user) {
				set({
					isAuthenticated: true,
					user: response.data.user,
					error: null,
					isLoading: false,
					message: response.data.message || null,
				});
				return response.data;
			} else {
				set({ user: null, isAuthenticated: false, isLoading: false });
				return response.data;
			}
		} catch (error) {
			set({ user: null, isAuthenticated: false, error: error.response?.data?.message || "Error logging in", isLoading: false });
			throw error;
		}
	},

	logout: async () => {
		set({ isLoading: true, error: null });
		try {
			await axios.post(`${API_URL}/logout`);
			set({ user: null, isAuthenticated: false, error: null, isLoading: false });
		} catch (error) {
			set({ user: null, isAuthenticated: false, error: "Error logging out", isLoading: false });
			throw error;
		}
	},
	verifyEmail: async (code) => {
		set({ isLoading: true, error: null });
		try {
			const response = await axios.post(`${API_URL}/verify-email`, { code });
			if (response.data && response.data.user) {
				set({ user: response.data.user, isAuthenticated: true, isLoading: false });
			}
			return response.data;
		} catch (error) {
			set({ error: error.response?.data?.message || "Error verifying email", isLoading: false });
			throw error;
		}
	},
	resendVerificationEmail: async (email) => {
		set({ isLoading: true, error: null });
		try {
			const response = await axios.post(`${API_URL}/resend-verification`, { email });
			set({ isLoading: false, message: response.data.message });
			return response.data;
		} catch (error) {
			const errMsg = error.response?.data?.message || "Error resending verification code";
			set({ error: errMsg, isLoading: false });
			throw error;
		}
	},
	checkAuth: async () => {
		set({ isCheckingAuth: true, error: null });
		try {
			const response = await axios.get(`${API_URL}/check-auth`);
			// Verify response contains a valid user object (guards against HTML from SPA fallback)
			if (response.data && response.data.user && typeof response.data.user === "object") {
				set({ user: response.data.user, isAuthenticated: true, isCheckingAuth: false });
			} else {
				set({ user: null, isAuthenticated: false, isCheckingAuth: false });
			}
		} catch (error) {
			set({ user: null, error: null, isCheckingAuth: false, isAuthenticated: false });
		}
	},
	forgotPassword: async (email) => {
		set({ isLoading: true, error: null });
		try {
			const response = await axios.post(`${API_URL}/forgot-password`, { email });
			set({ message: response.data.message, isLoading: false });
			return response.data;
		} catch (error) {
			set({
				isLoading: false,
				error: error.response?.data?.message || "Error sending reset password email",
			});
			throw error;
		}
	},
	resetPassword: async (token, password) => {
		set({ isLoading: true, error: null });
		try {
			const response = await axios.post(`${API_URL}/reset-password/${token}`, { password });
			set({ message: response.data.message, isLoading: false });
		} catch (error) {
			set({
				isLoading: false,
				error: error.response?.data?.message || "Error resetting password",
			});
			throw error;
		}
	},
	changePassword: async (currentPassword, newPassword) => {
		set({ isLoading: true, error: null });
		try {
			const response = await axios.post(`${API_URL}/change-password`, { currentPassword, newPassword });
			set({ isLoading: false, message: response.data.message });
			return response.data;
		} catch (error) {
			const errMsg = error.response?.data?.message || "Error changing password";
			set({ error: errMsg, isLoading: false });
			throw error;
		}
	},
	updateProfile: async (name, role) => {
		set({ isLoading: true, error: null });
		try {
			const response = await axios.put(`${API_URL}/profile`, { name, role });
			set({ user: response.data.user, isLoading: false, message: response.data.message });
			return response.data;
		} catch (error) {
			const errMsg = error.response?.data?.message || "Error updating profile";
			set({ error: errMsg, isLoading: false });
			throw error;
		}
	},
	clearErrors: () => set({ error: null, message: null }),
}));

// Configure Axios Interceptor for token refresh flow (transparent 401 handling)
axios.interceptors.response.use(
	(response) => response,
	async (error) => {
		const originalRequest = error.config;
		if (
			error.response?.status === 401 && 
			!originalRequest._retry && 
			originalRequest.url && 
			!originalRequest.url.includes("/refresh-token") &&
			!originalRequest.url.includes("/check-auth") &&
			!originalRequest.url.includes("/login") &&
			!originalRequest.url.includes("/signup")
		) {
			originalRequest._retry = true;
			try {
				await axios.post(`${API_URL}/refresh-token`);
				return axios(originalRequest);
			} catch (refreshError) {
				// Refresh token expired, reset store auth state
				useAuthStore.setState({ user: null, isAuthenticated: false, isCheckingAuth: false });
				return Promise.reject(refreshError);
			}
		}
		return Promise.reject(error);
	}
);
