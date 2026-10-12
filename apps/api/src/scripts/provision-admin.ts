import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import User from "../models/User";

/**
 * Script: provision-admin.ts
 *
 * Securely provisions the requested administrator account:
 * - Username / College ID: GOKUL
 * - Role: admin
 * - Active: true
 *
 * Safety rules:
 * 1. Checks if an account with username or collegeId 'GOKUL' exists.
 * 2. If it already exists with role 'admin':
 *    - Does NOT overwrite password unless --reset-password flag or RESET_ADMIN_PASSWORD=true is set.
 *    - Ensures it is marked active.
 * 3. If an account already exists with a DIFFERENT role (e.g. student):
 *    - Aborts immediately with error to prevent unauthorized privilege escalation.
 * 4. If it does not exist:
 *    - Creates the new administrator record with bcrypt password hashing (12 rounds).
 */
async function provisionAdmin() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is not set in environment.");
  }

  const adminIdentifier = (process.env.ADMIN_IDENTIFIER || "GOKUL").trim().toUpperCase();
  const adminPassword =
    process.env.ADMIN_PASSWORD ||
    process.env.ADMIN_SEED_PASSWORD ||
    "Admin@123456";

  const allowPasswordReset =
    process.argv.includes("--reset-password") ||
    process.env.RESET_ADMIN_PASSWORD === "true";

  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB Atlas.");

  // Check for existing user with identifier GOKUL
  const existingUser = await User.findOne({
    $or: [{ collegeId: adminIdentifier }, { username: adminIdentifier }],
  }).select("+passwordHash");

  if (existingUser) {
    if (existingUser.role !== "admin") {
      console.error(
        `CONFLICT: An account with identifier '${adminIdentifier}' already exists but has role '${existingUser.role}'.`,
      );
      console.error(
        "Refusing to overwrite or silently promote non-admin account to administrator.",
      );
      await mongoose.disconnect();
      process.exit(1);
    }

    // Account exists and is already admin
    if (allowPasswordReset) {
      existingUser.passwordHash = await bcrypt.hash(adminPassword, 12);
      existingUser.active = true;
      existingUser.name = existingUser.name || adminIdentifier;
      existingUser.username = adminIdentifier;
      await existingUser.save();
      console.log(`✓ Admin account '${adminIdentifier}' password successfully reset and activated.`);
    } else {
      existingUser.active = true;
      if (!existingUser.username) {
        existingUser.username = adminIdentifier;
        await existingUser.save();
      }
      console.log(`✓ Admin account '${adminIdentifier}' is already provisioned and active.`);
      console.log("  Existing password preserved (pass --reset-password to explicitly rotate password).");
    }
  } else {
    // Create new administrator account
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const newAdmin = await User.create({
      collegeId: adminIdentifier,
      username: adminIdentifier,
      name: adminIdentifier,
      passwordHash,
      role: "admin",
      active: true,
    });

    console.log(`✓ Admin account successfully created with ID: ${newAdmin._id}`);
    console.log(`  Identifier: ${newAdmin.collegeId}`);
    console.log(`  Role: ${newAdmin.role}`);
    console.log(`  Active: ${newAdmin.active}`);
  }

  // Also ensure ADMIN001 alias is maintained for backwards compatibility with baseline tests
  const legacyAdmin = await User.findOne({ collegeId: "ADMIN001" });
  if (legacyAdmin && !legacyAdmin.username) {
    legacyAdmin.username = "ADMIN001";
    await legacyAdmin.save();
  }

  await mongoose.disconnect();
  console.log("Disconnected from MongoDB.");
}

provisionAdmin().catch((err) => {
  console.error("Failed to provision administrator:", err);
  process.exit(1);
});
