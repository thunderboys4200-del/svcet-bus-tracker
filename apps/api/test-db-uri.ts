import { getValidatedMongoUri } from "./src/config/db";

// Test 1: Double Quotes
process.env.MONGODB_URI = '"mongodb+srv://user:pass@cluster.mongodb.net"';
let res = getValidatedMongoUri();
console.log("Test 1 (Double Quotes):", res.scheme, "Length:", res.length);
if (res.scheme !== "mongodb+srv://") throw new Error("Test 1 failed");

// Test 2: Single Quotes + prefix
process.env.MONGODB_URI = "MONGODB_URI = 'mongodb+srv://user:pass@cluster.mongodb.net'";
res = getValidatedMongoUri();
console.log("Test 2 (Prefix + Single Quotes):", res.scheme, "Length:", res.length);
if (res.scheme !== "mongodb+srv://") throw new Error("Test 2 failed");

// Test 3: Whitespace
process.env.MONGODB_URI = "   mongodb://localhost:27017/test   ";
res = getValidatedMongoUri();
console.log("Test 3 (Whitespace):", res.scheme, "Length:", res.length);
if (res.scheme !== "mongodb://") throw new Error("Test 3 failed");

// Test 4: MONGO_URI fallback
delete process.env.MONGODB_URI;
process.env.MONGO_URI = "mongodb+srv://fallback@cluster.mongodb.net";
res = getValidatedMongoUri();
console.log("Test 4 (MONGO_URI fallback):", res.sourceKey, res.scheme);
if (res.sourceKey !== "MONGO_URI") throw new Error("Test 4 failed");

// Test 5: Invalid scheme detection
process.env.MONGODB_URI = "postgres://user:pass@localhost:5432/db";
res = getValidatedMongoUri();
console.log("Test 5 (Invalid scheme detection):", res.scheme);
if (res.scheme !== "INVALID") throw new Error("Test 5 failed");

console.log("\n>>> ALL 5 URI SANITIZATION & VALIDATION TESTS PASSED! <<<");
