
import mongoose from "mongoose";

export interface MongoUriInfo {
  uri: string;
  sourceKey: "MONGODB_URI" | "MONGO_URI" | "DATABASE_URL";
  scheme: "mongodb+srv://" | "mongodb://" | "INVALID";
  length: number;
}

/**
 * Extract, sanitize, and validate the MongoDB connection URI from environment.
 * Handles common cloud configuration pitfalls:
 * - Surrounding quotes ("..." or '...' or `...`)
 * - Accidental variable prefix (e.g. MONGODB_URI=mongodb+srv://...)
 * - Leading / trailing whitespace and newlines
 * - Alternative keys (MONGODB_URI, MONGO_URI, DATABASE_URL)
 */
export function getValidatedMongoUri(): MongoUriInfo {
  // Check variables in priority order
  const candidates: Array<{ key: "MONGODB_URI" | "MONGO_URI" | "DATABASE_URL"; raw?: string }> = [
    { key: "MONGODB_URI", raw: process.env.MONGODB_URI },
    { key: "MONGO_URI", raw: process.env.MONGO_URI },
    { key: "DATABASE_URL", raw: process.env.DATABASE_URL },
  ];

  const matched = candidates.find((c) => c.raw && c.raw.trim().length > 0);

  if (!matched || !matched.raw) {
    throw new Error(
      "MongoDB connection URI is missing from the environment. Ensure MONGODB_URI is defined in your environment variables.",
    );
  }

  let sanitized = matched.raw.trim();

  // 1. Strip accidental variable name prefix if pasted (e.g. MONGODB_URI=mongodb+srv://...)
  sanitized = sanitized.replace(/^(MONGODB_URI|MONGO_URI|DATABASE_URL)\s*=\s*/i, "").trim();

  // 2. Strip surrounding quotes (double, single, backticks, or escaped quotes)
  sanitized = sanitized
    .replace(/^["'`\\]+|["'`\\]+$/g, "")
    .replace(/^"+|"+$/g, "")
    .replace(/^'+|'+$/g, "")
    .trim();

  // 3. Determine scheme strictly
  let scheme: MongoUriInfo["scheme"] = "INVALID";
  if (sanitized.startsWith("mongodb+srv://")) {
    scheme = "mongodb+srv://";
  } else if (sanitized.startsWith("mongodb://")) {
    scheme = "mongodb://";
  }

  return {
    uri: sanitized,
    sourceKey: matched.key,
    scheme,
    length: sanitized.length,
  };
}

export async function connectDB(maxRetries = 5, delayMs = 2500): Promise<void> {
  const info = getValidatedMongoUri();

  // Safe startup diagnostics — NEVER logs credentials, hosts, or full URI
  console.log(
    `[DB] Configuration check: source=${info.sourceKey}, length=${info.length} chars, scheme=${info.scheme}`,
  );

  // Validate scheme before attempting connection
  if (info.scheme === "INVALID") {
    const prefixSnippet = info.uri.slice(0, 8).replace(/[^a-zA-Z0-9+:/._-]/g, "?");
    throw new Error(
      `Invalid MongoDB URI scheme. Connection string must start with "mongodb://" or "mongodb+srv://". (Detected prefix: "${prefixSnippet}..."). Please verify your ${info.sourceKey} in Render environment settings.`,
    );
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await mongoose.connect(info.uri, {
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 15000,
      });

      console.log(`[DB] Connected successfully to MongoDB Atlas via ${info.scheme}`);
      return;
    } catch (err: any) {
      console.warn(`[DB] Connection attempt ${attempt}/${maxRetries} failed: ${err.message}`);

      // Fail fast on authentication failures
      if (
        err.name === "MongoServerError" &&
        (err.code === 18 || err.codeName === "AuthenticationFailed")
      ) {
        throw new Error(
          `MongoDB Atlas authentication failed. Please check the database username and password in your ${info.sourceKey} environment variable.`,
        );
      }

      if (attempt === maxRetries) {
        throw err;
      }

      console.log(`[DB] Retrying in ${delayMs / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
