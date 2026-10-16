import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    lastLogin: {
        type: Date,
        default: Date.now,
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    verificationToken: String,
    verificationTokenExpires: Date,
    lastVerificationSent: Date,
    refreshToken: String,
    role: {
        type: String,
        default: "user",
    },
}, { timestamps: true });

export const User = mongoose.model("User", userSchema);

// createdAt and updatedAt fields are automatically added to the document.


