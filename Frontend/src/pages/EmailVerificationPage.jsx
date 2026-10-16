import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuthStore } from "../store/authScore";
import { Loader, RotateCw } from "lucide-react";
import toast from "react-hot-toast";

const EmailVerificationPage = () => {
	const [code, setCode] = useState(["", "", "", "", "", ""]);
	const [cooldown, setCooldown] = useState(0);
	const [isResending, setIsResending] = useState(false);
	const inputRefs = useRef([]);
	const hasAutoSubmitted = useRef(false);

	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const urlCode = searchParams.get("code");

	const { error, isLoading, verifyEmail, resendVerificationEmail, user } = useAuthStore();

	const verifyCode = async (verificationCode) => {
		try {
			await verifyEmail(verificationCode);
			toast.success("Email verified successfully!");
			navigate("/");
		} catch (err) {
			const errMsg = err.response?.data?.message || "Invalid or expired verification code";
			toast.error(errMsg);
		}
	};

	// 1. Read code from URL search param (?code=123456) and auto-verify
	useEffect(() => {
		if (urlCode && urlCode.length === 6 && !hasAutoSubmitted.current) {
			hasAutoSubmitted.current = true;
			const digits = urlCode.slice(0, 6).split("");
			setCode(digits);
			verifyCode(urlCode.slice(0, 6));
		}
	}, [urlCode]);

	// 2. Cooldown timer countdown
	useEffect(() => {
		let timer;
		if (cooldown > 0) {
			timer = setInterval(() => {
				setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
			}, 1000);
		}
		return () => clearInterval(timer);
	}, [cooldown]);

	const handleChange = (index, value) => {
		const newCode = [...code];

		// Handle pasted content
		if (value.length > 1) {
			const pastedCode = value.slice(0, 6).split("");
			for (let i = 0; i < 6; i++) {
				newCode[i] = pastedCode[i] || "";
			}
			setCode(newCode);

			// Focus on the last filled input or next empty one
			const lastFilledIndex = newCode.findLastIndex((digit) => digit !== "");
			const focusIndex = lastFilledIndex < 5 ? lastFilledIndex + 1 : 5;
			if (inputRefs.current[focusIndex]) {
				inputRefs.current[focusIndex].focus();
			}
		} else {
			newCode[index] = value;
			setCode(newCode);

			// Move focus to next input field
			if (value && index < 5 && inputRefs.current[index + 1]) {
				inputRefs.current[index + 1].focus();
			}
		}
	};

	const handleKeyDown = (index, e) => {
		if (e.key === "Backspace" && !code[index] && index > 0 && inputRefs.current[index - 1]) {
			inputRefs.current[index - 1].focus();
		}
	};

	const handleSubmit = async (e) => {
		if (e) e.preventDefault();
		const verificationCode = code.join("");
		if (verificationCode.length === 6) {
			await verifyCode(verificationCode);
		}
	};

	// Auto submit when all 6 fields are filled manually
	useEffect(() => {
		if (code.every((digit) => digit !== "") && !hasAutoSubmitted.current) {
			handleSubmit();
		}
	}, [code]);

	// Handle Resend Code with cooldown
	const handleResendCode = async () => {
		if (cooldown > 0 || isResending || isLoading) return;
		setIsResending(true);
		try {
			const res = await resendVerificationEmail(user?.email);
			toast.success(res?.message || "Verification code resent successfully!");
			setCooldown(60);
		} catch (err) {
			const errMsg = err.response?.data?.message || err.message || "Failed to resend verification code";
			toast.error(errMsg);
			if (err.response?.data?.cooldown) {
				setCooldown(err.response.data.cooldown);
			}
		} finally {
			setIsResending(false);
		}
	};

	return (
		<div className='max-w-md w-full bg-gray-800 bg-opacity-50 backdrop-filter backdrop-blur-xl rounded-2xl shadow-xl overflow-hidden'>
			<motion.div
				initial={{ opacity: 0, y: -50 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5 }}
				className='bg-gray-800 bg-opacity-50 backdrop-filter backdrop-blur-xl rounded-2xl shadow-2xl p-8 w-full max-w-md'
			>
				<h2 className='text-3xl font-bold mb-6 text-center bg-gradient-to-r from-green-400 to-emerald-500 text-transparent bg-clip-text'>
					Verify Your Email
				</h2>
				<p className='text-center text-gray-300 mb-6'>
					Enter the 6-digit code sent to{" "}
					<strong className='text-green-400'>{user?.email || "your email address"}</strong> or click the verification link in your email.
				</p>

				<form onSubmit={handleSubmit} className='space-y-6'>
					<div className='flex justify-between gap-2'>
						{code.map((digit, index) => (
							<input
								key={index}
								ref={(el) => (inputRefs.current[index] = el)}
								type='text'
								maxLength='6'
								value={digit}
								onChange={(e) => handleChange(index, e.target.value)}
								onKeyDown={(e) => handleKeyDown(index, e)}
								className='w-12 h-12 text-center text-2xl font-bold bg-gray-700 text-white border-2 border-gray-600 rounded-lg focus:border-green-500 focus:outline-none transition'
							/>
						))}
					</div>

					{error && <p className='text-red-500 text-sm font-semibold text-center mt-2'>{error}</p>}

					<motion.button
						whileHover={{ scale: 1.02 }}
						whileTap={{ scale: 0.98 }}
						type='submit'
						disabled={isLoading || code.some((digit) => !digit)}
						className='w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:from-green-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 disabled:opacity-50 transition duration-200'
					>
						{isLoading ? <Loader className='w-6 h-6 animate-spin mx-auto' /> : "Verify Email"}
					</motion.button>
				</form>

				{/* Resend Code Section */}
				<div className='mt-6 pt-5 border-t border-gray-700/60 text-center'>
					<p className='text-sm text-gray-400 mb-2'>Didn't receive the email or code expired?</p>
					<button
						type='button'
						onClick={handleResendCode}
						disabled={cooldown > 0 || isResending || isLoading}
						className='inline-flex items-center gap-1.5 text-sm font-semibold text-green-400 hover:text-green-300 disabled:text-gray-500 disabled:cursor-not-allowed transition'
					>
						{isResending ? (
							<>
								<Loader size={16} className='animate-spin' />
								<span>Sending new code...</span>
							</>
						) : (
							<>
								<RotateCw size={15} className={cooldown > 0 ? "text-gray-500" : "text-green-400"} />
								<span>{cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend Code"}</span>
							</>
						)}
					</button>
				</div>

				<div className='mt-4 text-center'>
					<Link to='/login' className='text-xs text-gray-400 hover:text-green-400 hover:underline'>
						Back to Login
					</Link>
				</div>
			</motion.div>
		</div>
	);
};

export default EmailVerificationPage;
