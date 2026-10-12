
import mongoose from "mongoose";

export async function connectDB(maxRetries = 5, delayMs = 2500): Promise<void> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is missing from the API environment");
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 15000,
      });

      console.log("MongoDB connected successfully");
      return;
    } catch (err: any) {
      console.warn(`[DB] Connection attempt ${attempt}/${maxRetries} failed: ${err.message}`);
      if (attempt === maxRetries) {
        throw err;
      }
      console.log(`[DB] Retrying in ${delayMs / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
