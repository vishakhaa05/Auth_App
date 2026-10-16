import mongoose from "mongoose";

export const connectDB = async () => {
	try {
		const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.MONGO_URL;

		if (!uri) {
			console.error("\n❌ FATAL: MONGO_URI is missing in environment variables!");
			console.error("👉 Fix: Go to your Render Dashboard > Environment, add a variable named 'MONGO_URI', and paste your MongoDB connection string.\n");
			throw new Error("The 'MONGO_URI' environment variable is undefined. Please add it to your Render dashboard.");
		}

		const safeUri = uri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:****@");
		console.log("Connecting to MongoDB:", safeUri);

		const conn = await mongoose.connect(uri);
		console.log(`✅ MongoDB Connected successfully: ${conn.connection.host}`);
	} catch (error) {
		console.error("Error connecting to MongoDB:", error.message);
		process.exit(1); // 1 is failure, 0 status code is success
	}
};
