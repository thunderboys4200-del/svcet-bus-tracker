
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import User from "./src/models/User";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

async function main(): Promise<void> {
  const mongoUri =
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    process.env.MONGODB_URL ||
    process.env.MONGO_URL ||
    process.env.DATABASE_URL;

  if (!mongoUri) {
    throw new Error("MongoDB connection variable not found in .env.");
  }

  const rl = createInterface({ input: stdin, output: stdout });

  try {
    const password = await rl.question(
      "Enter a new driver password (12-72 characters): ",
    );

    if (
      password.length < 12 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      throw new Error("Password must be 12-72 UTF-8 bytes.");
    }

    await mongoose.connect(mongoUri);

    const driver = await User.findOne({
      collegeId: "DRIVER001",
      role: "driver",
    });

    if (!driver) {
      throw new Error("DRIVER001 driver account was not found.");
    }

    driver.passwordHash = await bcrypt.hash(password, 12);
    driver.active = true;
    await driver.save();

    console.log("Driver password reset successfully.");
    console.log("College ID: DRIVER001");
    console.log("Account is active.");
    console.log("Existing bus, route and stop records were not changed.");
  } finally {
    rl.close();
    await mongoose.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    "Password reset failed:",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
