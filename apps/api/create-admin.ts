
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import User from "./src/models/User";

async function main(): Promise<void> {
  const mongoUri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    process.env.MONGODB_URL ||
    process.env.MONGO_URL ||
    process.env.DATABASE_URL;

  if (!mongoUri) {
    throw new Error(
      "MongoDB URI not found. Check the variable name in your existing .env file.",
    );
  }

  const collegeId = (process.env.ADMIN_COLLEGE_ID || "")
    .trim()
    .toUpperCase();

  const password = process.env.ADMIN_PASSWORD || "";
  const name = (process.env.ADMIN_NAME || "").trim();

  if (!collegeId || !password || !name) {
    throw new Error(
      "Set ADMIN_COLLEGE_ID, ADMIN_PASSWORD, and ADMIN_NAME before running this script.",
    );
  }

  if (password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
    throw new Error(
      "Use an admin password of at least 12 characters and at most 72 UTF-8 bytes.",
    );
  }

  await mongoose.connect(mongoUri);
  console.log("Connected to the configured MongoDB database.");

  try {
    const existing = await User.findOne({ collegeId }).select("_id role");

    if (existing) {
      throw new Error(
        `College ID ${collegeId} already exists with role "${existing.role}". No account was changed.`,
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const admin = await User.create({
      collegeId,
      name,
      passwordHash,
      role: "admin",
      active: true,
    });

    console.log("Admin account created successfully.");
    console.log(`College ID: ${admin.collegeId}`);
    console.log(`Name: ${admin.name}`);
    console.log(`Role: ${admin.role}`);
    console.log("Password: stored as a bcrypt hash.");
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    "Admin setup failed:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
