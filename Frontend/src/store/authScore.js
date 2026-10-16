import { create } from "zustand";
import axios from "axios";

const rawApiUrl = import.meta.env.VITE_API_URL;
const API_URL = rawApiUrl
	? rawApiUrl.replace(/\/+$/, "")
	: (import.meta.env.MODE === "production" ? "/api/auth" : "http://localhost:5001/api/auth");
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
			set({ user: response.data.user, isAuthenticated: true, isLoading: false });
		} catch (error) {
			set({ error: error.response?.data?.message || "Error signing up", isLoading: false });
			throw error;
		} 
	},
	login: async (email, password) => {
		set({ isLoading: true, error: null });
		try {
			const response = await axios.post(`${API_URL}/login`, { email, password });
			set({
				isAuthenticated: true,
				user: response.data.user,
				error: null,
				isLoading: false,
			});
		} catch (error) {
			set({ error: error.response?.data?.message || "Error logging in", isLoading: false });
			throw error;
		}
	},

	logout: async () => {
		set({ isLoading: true, error: null });
		try {
			await axios.post(`${API_URL}/logout`);
			set({ user: null, isAuthenticated: false, error: null, isLoading: false });
		} catch (error) {
			set({ error: "Error logging out", isLoading: false });
			throw error;
		}
	},
	verifyEmail: async (code) => {
		set({ isLoading: true, error: null });
		try {
			const response = await axios.post(`${API_URL}/verify-email`, { code });
			set({ user: response.data.user, isAuthenticated: true, isLoading: false });
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
			set({ user: response.data.user, isAuthenticated: true, isCheckingAuth: false });
		} catch (error) {
			set({ error: null, isCheckingAuth: false, isAuthenticated: false });
		}
	},
	forgotPassword: async (email) => {
		set({ isLoading: true, error: null });
		try {
			const response = await axios.post(`${API_URL}/forgot-password`, { email });
			set({ message: response.data.message, isLoading: false });
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
			!originalRequest.url.includes("/refresh-token")
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
