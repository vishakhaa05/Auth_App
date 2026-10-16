import { useState } from "react";
import { motion } from "framer-motion";
import { useAuthStore } from "../store/authScore";
import { formatDate } from "../utils/date";
import Input from "../components/Input";
import { User as UserIcon, Shield, Lock, Loader, Edit, Check, X, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

const DashboardPage = () => {
	const { user, logout, updateProfile, changePassword, isLoading } = useAuthStore();

	// Profile edit state
	const [isEditingProfile, setIsEditingProfile] = useState(false);
	const [editName, setEditName] = useState(user?.name || "");
	const [editRole, setEditRole] = useState(user?.role || "user");

	// Change password state
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [showPasswordForm, setShowPasswordForm] = useState(false);

	const handleLogout = () => {
		logout();
		toast.success("Logged out successfully");
	};

	const handleUpdateProfile = async (e) => {
		e.preventDefault();
		if (!editName.trim()) {
			toast.error("Name cannot be empty");
			return;
		}
		try {
			await updateProfile(editName, editRole);
			setIsEditingProfile(false);
			toast.success("Profile updated successfully");
		} catch (err) {
			toast.error(err.response?.data?.message || "Failed to update profile");
		}
	};

	const handleChangePassword = async (e) => {
		e.preventDefault();
		if (!currentPassword || !newPassword || !confirmPassword) {
			toast.error("All password fields are required");
			return;
		}
		if (newPassword.length < 6) {
			toast.error("New password must be at least 6 characters");
			return;
		}
		if (newPassword !== confirmPassword) {
			toast.error("New passwords do not match");
			return;
		}

		try {
			await changePassword(currentPassword, newPassword);
			setCurrentPassword("");
			setNewPassword("");
			setConfirmPassword("");
			setShowPasswordForm(false);
			toast.success("Password updated successfully");
		} catch (err) {
			toast.error(err.response?.data?.message || "Failed to change password");
		}
	};

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.95 }}
			animate={{ opacity: 1, scale: 1 }}
			exit={{ opacity: 0, scale: 0.95 }}
			transition={{ duration: 0.5 }}
			className='max-w-xl w-full mx-auto my-10 p-8 bg-gray-900 bg-opacity-80 backdrop-filter backdrop-blur-lg rounded-2xl shadow-2xl border border-gray-800 space-y-6'
		>
			<h2 className='text-3xl font-bold text-center bg-gradient-to-r from-green-400 to-emerald-600 text-transparent bg-clip-text'>
				User Dashboard
			</h2>

			{/* Profile Info & Edit Panel */}
			<motion.div
				className='p-6 bg-gray-800 bg-opacity-50 rounded-xl border border-gray-700 relative overflow-hidden'
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.1 }}
			>
				<div className='flex justify-between items-center mb-4'>
					<h3 className='text-xl font-semibold text-green-400'>Profile Settings</h3>
					{!isEditingProfile ? (
						<button
							onClick={() => setIsEditingProfile(true)}
							className='flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-sm font-medium rounded-lg text-white transition'
						>
							<Edit size={15} /> Edit Profile
						</button>
					) : (
						<div className='flex gap-2'>
							<button
								onClick={handleUpdateProfile}
								disabled={isLoading}
								className='flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-sm font-medium rounded-lg text-white transition'
							>
								{isLoading ? <Loader size={14} className='animate-spin' /> : <Check size={15} />} Save
							</button>
							<button
								onClick={() => {
									setIsEditingProfile(false);
									setEditName(user?.name || "");
									setEditRole(user?.role || "user");
								}}
								className='flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-sm font-medium rounded-lg text-white transition'
							>
								<X size={15} /> Cancel
							</button>
						</div>
					)}
				</div>

				{!isEditingProfile ? (
					<div className='space-y-3 text-gray-300'>
						<div className='flex items-center gap-3'>
							<UserIcon className='text-green-500' size={20} />
							<span><strong className='text-gray-400'>Name:</strong> {user?.name}</span>
						</div>
						<div className='flex items-center gap-3'>
							<Shield className='text-green-500' size={20} />
							<span><strong className='text-gray-400'>Role:</strong> <span className='capitalize px-2 py-0.5 bg-green-500/10 text-green-400 rounded text-sm'>{user?.role}</span></span>
						</div>
						<div className='pt-2 border-t border-gray-700/50 text-sm text-gray-400'>
							<p>Email: {user?.email}</p>
							<p className='text-xs mt-1 text-gray-500'>Verified: {user?.isVerified ? "Yes" : "No"}</p>
						</div>
					</div>
				) : (
					<form onSubmit={handleUpdateProfile} className='space-y-4'>
						<div>
							<label className='block text-xs font-semibold text-gray-400 mb-1.5'>Full Name</label>
							<Input
								icon={UserIcon}
								type='text'
								value={editName}
								onChange={(e) => setEditName(e.target.value)}
								placeholder='Enter name'
								required
							/>
						</div>
						<div>
							<label className='block text-xs font-semibold text-gray-400 mb-1.5'>Role Selection</label>
							<div className='relative mb-2'>
								<div className='absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none'>
									<Shield className='size-5 text-green-500' />
								</div>
								<select
									value={editRole}
									onChange={(e) => setEditRole(e.target.value)}
									className='w-full pl-10 pr-3 py-2 bg-gray-800 bg-opacity-50 rounded-lg border border-gray-700 focus:border-green-500 focus:ring-2 focus:ring-green-500 text-white placeholder-gray-400 transition duration-200 appearance-none'
								>
									<option value='user' className='bg-gray-900'>User</option>
									<option value='admin' className='bg-gray-900'>Admin</option>
								</select>
							</div>
						</div>
					</form>
				)}
			</motion.div>

			{/* Account Activity Card */}
			<motion.div
				className='p-6 bg-gray-800 bg-opacity-50 rounded-xl border border-gray-700'
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.2 }}
			>
				<h3 className='text-xl font-semibold text-green-400 mb-4'>Account Activity</h3>
				<div className='space-y-2 text-gray-300 text-sm'>
					<p><strong className='text-gray-400'>Member Since:</strong> {new Date(user?.createdAt).toLocaleDateString("en-US", {
						year: "numeric",
						month: "long",
						day: "numeric",
					})}</p>
					<p><strong className='text-gray-400'>Last Session:</strong> {formatDate(user?.lastLogin)}</p>
				</div>
			</motion.div>

			{/* Change Password Card */}
			<motion.div
				className='p-6 bg-gray-800 bg-opacity-50 rounded-xl border border-gray-700'
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.3 }}
			>
				<div className='flex justify-between items-center mb-4'>
					<h3 className='text-xl font-semibold text-green-400'>Security</h3>
					<button
						onClick={() => setShowPasswordForm(!showPasswordForm)}
						className='text-sm text-green-400 hover:text-green-300 font-medium underline flex items-center gap-1.5'
					>
						{showPasswordForm ? "Hide Change Password" : "Change Password"}
					</button>
				</div>

				{showPasswordForm && (
					<form onSubmit={handleChangePassword} className='space-y-4 mt-4'>
						<Input
							icon={Lock}
							type='password'
							placeholder='Current Password'
							value={currentPassword}
							onChange={(e) => setCurrentPassword(e.target.value)}
							required
						/>
						<Input
							icon={Lock}
							type='password'
							placeholder='New Password'
							value={newPassword}
							onChange={(e) => setNewPassword(e.target.value)}
							required
						/>
						<Input
							icon={Lock}
							type='password'
							placeholder='Confirm New Password'
							value={confirmPassword}
							onChange={(e) => setConfirmPassword(e.target.value)}
							required
						/>

						<motion.button
							whileHover={{ scale: 1.02 }}
							whileTap={{ scale: 0.98 }}
							type='submit'
							disabled={isLoading}
							className='w-full py-2.5 px-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-green-500 transition disabled:opacity-50 flex justify-center items-center gap-2'
						>
							{isLoading ? <Loader size={18} className='animate-spin' /> : <RefreshCw size={16} />}
							Update Password
						</motion.button>
					</form>
				)}
			</motion.div>

			{/* Logout Action */}
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ delay: 0.4 }}
				className='pt-2'
			>
				<motion.button
					whileHover={{ scale: 1.02 }}
					whileTap={{ scale: 0.95 }}
					onClick={handleLogout}
					className='w-full py-3 px-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-lg shadow-lg hover:from-green-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500'
				>
					Logout
				</motion.button>
			</motion.div>
		</motion.div>
	);
};

export default DashboardPage;
