import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import User from "./src/models/User";

const BASE_URL = `http://localhost:${process.env.PORT || 4000}`;

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedCount++;
  }
}

async function runTests() {
  console.log("==================================================");
  console.log("TESTING REAL AUTHENTICATION & STUDENT REGISTRATION");
  console.log(`Target: ${BASE_URL}`);
  console.log("==================================================\n");

  const adminPassword = process.env.ADMIN_PASSWORD || process.env.ADMIN_SEED_PASSWORD || "Admin@123456";
  let adminToken = "";
  let studentToken = "";

  const uniqueSuffix = Date.now().toString().slice(-4);
  const testStudentId = `SVCET${uniqueSuffix}`;
  const testStudentPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
  const testStudentPassword = "StudentPass@2026";

  // 1. Successful Administrator Login (GOKUL)
  console.log("1. Scenario 1: Successful administrator login (GOKUL)...");
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "GOKUL", password: adminPassword }),
    });
    const data = await res.json();
    assert(res.status === 200, "Admin login succeeds with 200 OK");
    assert(!!data.token, "Admin login returns signed JWT token");
    assert(data.user?.role === "admin", "Admin role confirmed on user object");
    assert(data.user?.collegeId === "GOKUL", "College ID confirmed as GOKUL");
    adminToken = data.token;
  } catch (err: any) {
    assert(false, `Scenario 1 failed: ${err.message}`);
  }

  // 2. Case Normalization (gokul vs GOKUL)
  console.log("\n2. Scenario 2: Administrator username case normalization (lowercase 'gokul')...");
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "gokul", password: adminPassword }),
    });
    const data = await res.json();
    assert(res.status === 200, "Lowercase 'gokul' login succeeds with 200 OK");
    assert(data.user?.role === "admin", "Resolved to administrator role");
  } catch (err: any) {
    assert(false, `Scenario 2 failed: ${err.message}`);
  }

  // 3. Invalid Administrator Password
  console.log("\n3. Scenario 3: Invalid administrator password rejection...");
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "GOKUL", password: "WrongAdminPassword!" }),
    });
    const data = await res.json();
    assert(res.status === 401, "Invalid password returns 401 Unauthorized");
    assert(data.message.toLowerCase().includes("invalid"), "Helpful generic invalid credentials message");
  } catch (err: any) {
    assert(false, `Scenario 3 failed: ${err.message}`);
  }

  // 4. Successful Student Self-Registration
  console.log("\n4. Scenario 4: Successful student self-registration...");
  try {
    const res = await fetch(`${BASE_URL}/api/auth/register-student`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Kavitha Narayanan",
        collegeId: testStudentId,
        department: "Computer Science & Engineering (CSE)",
        year: "2nd Year (Semester 3 & 4)",
        phone: testStudentPhone,
        password: testStudentPassword,
        confirmPassword: testStudentPassword,
      }),
    });
    const data = await res.json();
    assert(res.status === 201, "Student registration succeeds with 201 Created");
    assert(data.user?.role === "student", "Role is strictly set to 'student'");
    assert(data.user?.collegeId === testStudentId, "Registered student collegeId matches");
    assert(data.user?.department === "Computer Science & Engineering (CSE)", "Department stored");
    assert(data.user?.phone === testStudentPhone, "Mobile number stored");
    assert(!!data.token, "Initial JWT token issued upon registration");
    studentToken = data.token;
  } catch (err: any) {
    assert(false, `Scenario 4 failed: ${err.message}`);
  }

  // 5. Duplicate Student Registration Rejection (College ID)
  console.log("\n5. Scenario 5: Duplicate student registration rejection (same College ID)...");
  try {
    const res = await fetch(`${BASE_URL}/api/auth/register-student`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Another Student",
        collegeId: testStudentId, // Duplicate
        department: "Mechanical Engineering (MECH)",
        password: testStudentPassword,
      }),
    });
    const data = await res.json();
    assert(res.status === 409, "Duplicate collegeId rejected with 409 Conflict");
    assert(data.message.toLowerCase().includes("college id already exists"), "Clear collision message returned");
  } catch (err: any) {
    assert(false, `Scenario 5 failed: ${err.message}`);
  }

  // 6. Duplicate Student Mobile Number Rejection
  console.log("\n6. Scenario 6: Duplicate student mobile number rejection...");
  try {
    const res = await fetch(`${BASE_URL}/api/auth/register-student`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Different Name",
        collegeId: `DIFF${uniqueSuffix}`,
        phone: testStudentPhone, // Duplicate phone
        password: testStudentPassword,
      }),
    });
    const data = await res.json();
    assert(res.status === 409, "Duplicate phone rejected with 409 Conflict");
    assert(data.message.toLowerCase().includes("mobile number already exists"), "Clear phone collision message returned");
  } catch (err: any) {
    assert(false, `Scenario 6 failed: ${err.message}`);
  }

  // 7. Student Password Hashing Verification
  console.log("\n7. Scenario 7: Student password hashing in MongoDB Atlas...");
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    const dbUser = await User.findOne({ collegeId: testStudentId }).select("+passwordHash");
    assert(!!dbUser, "Student record exists in MongoDB Atlas");
    assert(dbUser!.passwordHash !== testStudentPassword, "Password is NOT stored in plaintext");
    assert(dbUser!.passwordHash.startsWith("$2"), "Password is encrypted with bcrypt hash");
    const matches = await bcrypt.compare(testStudentPassword, dbUser!.passwordHash);
    assert(matches, "Bcrypt hash validates correctly against raw password");
    await mongoose.disconnect();
  } catch (err: any) {
    assert(false, `Scenario 7 failed: ${err.message}`);
  }

  // 8. Student Login After Registration
  console.log("\n8. Scenario 8: Student login after registration...");
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: testStudentId, password: testStudentPassword }),
    });
    const data = await res.json();
    assert(res.status === 200, "Registered student logs in with 200 OK");
    assert(data.user?.role === "student", "Role is student");
    assert(!!data.token, "Student JWT token issued");
    studentToken = data.token;
  } catch (err: any) {
    assert(false, `Scenario 8 failed: ${err.message}`);
  }

  // 9. Rejection of Registration Attempts Requesting Admin or Driver Role
  console.log("\n9. Scenario 9: Rejection of registration attempts requesting admin role...");
  try {
    const res = await fetch(`${BASE_URL}/api/auth/register-student`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Malicious User",
        collegeId: `HACKER${uniqueSuffix}`,
        password: "HackerPassword@123",
        role: "admin", // Unauthorized role injection
      }),
    });
    assert(res.status === 403, "Attempt to self-register as admin blocked with 403 Forbidden");
  } catch (err: any) {
    assert(false, `Scenario 9 failed: ${err.message}`);
  }

  // 10. Rejection of Unauthenticated Access to Protected APIs
  console.log("\n10. Scenario 10: Rejection of unauthenticated access to protected APIs...");
  try {
    const res = await fetch(`${BASE_URL}/api/admin/dashboard`);
    assert(res.status === 401, "Anonymous request to /api/admin/dashboard blocked with 401 Unauthorized");

    const driverRes = await fetch(`${BASE_URL}/api/trips/driver/assigned`);
    assert(driverRes.status === 401, "Anonymous request to /api/trips/driver/assigned blocked with 401 Unauthorized");
  } catch (err: any) {
    assert(false, `Scenario 10 failed: ${err.message}`);
  }

  // 11. Rejection of Student Access to Administrator APIs
  console.log("\n11. Scenario 11: Rejection of student access to administrator APIs...");
  try {
    const res = await fetch(`${BASE_URL}/api/admin/dashboard`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(res.status === 403, "Student token blocked from /api/admin/dashboard with 403 Forbidden");

    const stopsRes = await fetch(`${BASE_URL}/api/admin/stops`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(stopsRes.status === 403, "Student token blocked from /api/admin/stops with 403 Forbidden");
  } catch (err: any) {
    assert(false, `Scenario 11 failed: ${err.message}`);
  }

  // 12. Rejection of Unauthorized Driver Actions
  console.log("\n12. Scenario 12: Rejection of unauthorized driver actions...");
  try {
    const tripRes = await fetch(`${BASE_URL}/api/trips/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ busId: "6accb0eceff63adeb67e9899" }),
    });
    assert(tripRes.status === 403, "Student blocked from starting trips with 403 Forbidden");
  } catch (err: any) {
    assert(false, `Scenario 12 failed: ${err.message}`);
  }

  // 13. Correct Logout & Token Invalidation Behavior
  console.log("\n13. Scenario 13: Correct logout & session verification...");
  try {
    // Valid /me request
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(meRes.status === 200, "Valid session successfully returns user profile from /api/auth/me");

    // Client logout simulates discarding token; subsequent request without token fails:
    const logoutRes = await fetch(`${BASE_URL}/api/auth/me`);
    assert(logoutRes.status === 401, "Request without token returns 401 Unauthorized after logout");
  } catch (err: any) {
    assert(false, `Scenario 13 failed: ${err.message}`);
  }

  // 14. Expired or Invalid Session Handling
  console.log("\n14. Scenario 14: Expired or forged session handling...");
  try {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: "Bearer forged.invalid.token.12345" },
    });
    assert(res.status === 401, "Forged token rejected with 401 Unauthorized");
  } catch (err: any) {
    assert(false, `Scenario 14 failed: ${err.message}`);
  }

  // 15. Validation of Required Fields & Edge Cases
  console.log("\n15. Scenario 15: Registration input validation & passwords mismatch...");
  try {
    const mismatchRes = await fetch(`${BASE_URL}/api/auth/register-student`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Student",
        collegeId: `MM${uniqueSuffix}`,
        password: "Password1234!",
        confirmPassword: "DifferentPassword1234!",
      }),
    });
    assert(mismatchRes.status === 400, "Mismatched passwords rejected with 400 Bad Request");

    const shortPwdRes = await fetch(`${BASE_URL}/api/auth/register-student`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Student",
        collegeId: `SHORT${uniqueSuffix}`,
        password: "short",
      }),
    });
    assert(shortPwdRes.status === 400, "Short password (<8 chars) rejected with 400 Bad Request");
  } catch (err: any) {
    assert(false, `Scenario 15 failed: ${err.message}`);
  }

  console.log("\n==================================================");
  console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("==================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests();
