import "dotenv/config";

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
  console.log("RUNNING SVCET BUS TRACKER API INTEGRATION TESTS");
  console.log(`Target: ${BASE_URL}`);
  console.log("==================================================\n");

  // 1. Health check
  console.log("1. Testing Health Endpoint...");
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    const data = await res.json();
    assert(res.status === 200, "Health check status is 200");
    assert(data.success === true, "Health check returns success: true");
    assert(data.database === "connected", "Database is connected");
    assert(data.socketIO === "initialized", "Socket.IO is initialized");
  } catch (err: any) {
    assert(false, `Health check request failed: ${err.message}`);
  }

  // 2. Authentication
  console.log("\n2. Testing Authentication & Authorization...");
  let adminToken = "";
  let driverToken = "";
  let studentToken = "";

  // Admin login
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collegeId: "ADMIN001", password: "Admin@123456" }),
    });
    const data = await res.json();
    assert(res.status === 200, "Admin login succeeds with 200");
    assert(!!data.token, "Admin login returns JWT token");
    assert(data.user?.role === "admin", "Admin role confirmed");
    adminToken = data.token;
  } catch (err: any) {
    assert(false, `Admin login failed: ${err.message}`);
  }

  // Driver login
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collegeId: "DRIVER001", password: "Driver@123456" }),
    });
    const data = await res.json();
    assert(res.status === 200, "Driver login succeeds with 200");
    assert(!!data.token, "Driver login returns JWT token");
    assert(data.user?.role === "driver", "Driver role confirmed");
    driverToken = data.token;
  } catch (err: any) {
    assert(false, `Driver login failed: ${err.message}`);
  }

  // Student login
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collegeId: "STUDENT001", password: "Student@123456" }),
    });
    const data = await res.json();
    assert(res.status === 200, "Student login succeeds with 200");
    assert(!!data.token, "Student login returns JWT token");
    assert(data.user?.role === "student", "Student role confirmed");
    studentToken = data.token;
  } catch (err: any) {
    assert(false, `Student login failed: ${err.message}`);
  }

  // Invalid password rejection
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collegeId: "STUDENT001", password: "WrongPassword" }),
    });
    assert(res.status === 401, "Invalid password returns 401 Unauthorized");
  } catch (err: any) {
    assert(false, `Invalid password test error: ${err.message}`);
  }

  // Verify /me endpoint
  try {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const data = await res.json();
    assert(res.status === 200, "GET /api/auth/me returns 200 with valid JWT");
    assert(data.user?.collegeId === "STUDENT001", "/me returns correct user details");
  } catch (err: any) {
    assert(false, `/me endpoint test failed: ${err.message}`);
  }

  // 3. Public / Student Read-Only Tracking Endpoints
  console.log("\n3. Testing Public / Student Tracking Endpoints...");
  let testBusId = "";
  try {
    const res = await fetch(`${BASE_URL}/api/trips/buses`);
    const data = await res.json();
    assert(res.status === 200, "GET /api/trips/buses returns 200 without auth header");
    assert(Array.isArray(data.data), "Returns bus list");
    assert(data.data.length > 0, "At least one active bus found");
    const bus001 = data.data.find((b: any) => b.busNumber === "BUS-001") || data.data[0];
    testBusId = bus001?.id;
    assert(!!testBusId, `Found bus ID: ${testBusId}`);

    // Verify no sensitive fields are leaked
    assert(!bus001.passwordHash, "No password hash leaked in bus list");
    assert(!bus001.assignedDriverId?.passwordHash, "No driver password hash leaked");
  } catch (err: any) {
    assert(false, `GET /buses error: ${err.message}`);
  }

  try {
    const res = await fetch(`${BASE_URL}/api/trips/routes`);
    const data = await res.json();
    assert(res.status === 200, "GET /api/trips/routes returns 200");
    assert(Array.isArray(data.data), "Returns route list");
    assert(data.data[0]?.stops?.length > 0, "Route contains stops");
  } catch (err: any) {
    assert(false, `GET /routes error: ${err.message}`);
  }

  try {
    const res = await fetch(`${BASE_URL}/api/trips/bus/${testBusId}/tracking`);
    const data = await res.json();
    assert(res.status === 200, "GET /api/trips/bus/:busId/tracking returns 200");
    assert(data.data?.bus?.busNumber === "BUS-001", "Returns BUS-001 details");
    assert(Array.isArray(data.data?.route?.stops), "Returns route stops");
  } catch (err: any) {
    assert(false, `GET /tracking error: ${err.message}`);
  }

  // 4. Driver Trip Lifecycle
  console.log("\n4. Testing Driver Trip Lifecycle...");
  let activeTripId = "";

  // Check assigned bus
  try {
    const res = await fetch(`${BASE_URL}/api/trips/driver/assigned`, {
      headers: { Authorization: `Bearer ${driverToken}` },
    });
    const data = await res.json();
    assert(res.status === 200, "Driver GET /driver/assigned returns 200");
    assert(data.data?.bus?.busNumber === "BUS-001", "Driver assigned to BUS-001");
  } catch (err: any) {
    assert(false, `Driver assigned test failed: ${err.message}`);
  }

  // Driver starts trip
  try {
    const res = await fetch(`${BASE_URL}/api/trips/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify({ busId: testBusId }),
    });
    const data = await res.json();
    assert(res.status === 201, "Driver starts trip with 201 Created");
    activeTripId = data.data?.tripId;
    assert(!!activeTripId, `Active trip started: ${activeTripId}`);
  } catch (err: any) {
    assert(false, `Driver start trip failed: ${err.message}`);
  }

  // Prevent duplicate trip start
  try {
    const res = await fetch(`${BASE_URL}/api/trips/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify({ busId: testBusId }),
    });
    assert(res.status === 409, "Duplicate trip start correctly rejected with 409 Conflict");
  } catch (err: any) {
    assert(false, `Duplicate start trip test failed: ${err.message}`);
  }

  // Driver sends valid GPS location update
  try {
    const res = await fetch(`${BASE_URL}/api/trips/${activeTripId}/location`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify({
        latitude: 13.1445,
        longitude: 79.9095,
        accuracy: 8,
        heading: 85,
        speed: 25,
        recordedAt: new Date().toISOString(),
      }),
    });
    const data = await res.json();
    assert(res.status === 200, "Valid GPS update accepted with 200 OK");
    assert(data.data?.latitude === 13.1445, "Recorded latitude matches");
    assert(data.data?.longitude === 79.9095, "Recorded longitude matches");
  } catch (err: any) {
    assert(false, `Driver GPS update failed: ${err.message}`);
  }

  // Reject invalid GPS coordinates (-150 latitude)
  try {
    const res = await fetch(`${BASE_URL}/api/trips/${activeTripId}/location`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify({
        latitude: 150.0, // Invalid: exceeds 90
        longitude: 79.9095,
      }),
    });
    assert(res.status === 400, "Invalid latitude (>90) rejected with 400 Bad Request");
  } catch (err: any) {
    assert(false, `Invalid GPS test failed: ${err.message}`);
  }

  // Reject stale GPS timestamp (10 minutes ago)
  try {
    const staleTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const res = await fetch(`${BASE_URL}/api/trips/${activeTripId}/location`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${driverToken}`,
      },
      body: JSON.stringify({
        latitude: 13.145,
        longitude: 79.91,
        recordedAt: staleTime,
      }),
    });
    assert(res.status === 400, "Stale GPS timestamp (>5 mins ago) rejected with 400 Bad Request");
  } catch (err: any) {
    assert(false, `Stale GPS test failed: ${err.message}`);
  }

  // Verify public tracking endpoint sees the active trip and live location
  try {
    const res = await fetch(`${BASE_URL}/api/trips/bus/${testBusId}/tracking`);
    const data = await res.json();
    assert(data.data?.trip?.status === "active", "Public endpoint reflects active trip");
    assert(data.data?.isLive === true, "Trip is flagged as live");
    assert(data.data?.trip?.currentLocation?.latitude === 13.1445, "Live coordinates match latest GPS");
  } catch (err: any) {
    assert(false, `Public tracking active trip check failed: ${err.message}`);
  }

  // Driver ends trip
  try {
    const res = await fetch(`${BASE_URL}/api/trips/${activeTripId}/end`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${driverToken}`,
      },
    });
    const data = await res.json();
    assert(res.status === 200, "Driver ends trip with 200 OK");
    assert(data.data?.status === "completed", "Trip marked as completed");
    assert(!!data.data?.endedAt, "Trip record has endedAt timestamp");
  } catch (err: any) {
    assert(false, `Driver end trip failed: ${err.message}`);
  }

  // 5. Admin Protected Endpoints
  console.log("\n5. Testing Admin Protected Endpoints...");

  // Student trying to access admin endpoint should get 403 Forbidden
  try {
    const res = await fetch(`${BASE_URL}/api/admin/dashboard`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(res.status === 403, "Student blocked from admin dashboard with 403 Forbidden");
  } catch (err: any) {
    assert(false, `RBAC test failed: ${err.message}`);
  }

  // Admin access to dashboard
  try {
    const res = await fetch(`${BASE_URL}/api/admin/dashboard`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    assert(res.status === 200, "Admin can access GET /api/admin/dashboard");
    assert(data.data?.totalBuses >= 1, "Dashboard reports fleet total buses");
    assert(data.data?.totalDrivers >= 1, "Dashboard reports fleet total drivers");
  } catch (err: any) {
    assert(false, `Admin dashboard test failed: ${err.message}`);
  }

  // Admin list buses
  try {
    const res = await fetch(`${BASE_URL}/api/admin/buses`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    assert(res.status === 200, "Admin can access GET /api/admin/buses");
    const bus001Admin = data.data.find((b: any) => b.busNumber === "BUS-001") || data.data[0];
    assert(!!bus001Admin?.assignedDriverId?.name, "Driver is populated in bus list");
  } catch (err: any) {
    assert(false, `Admin buses test failed: ${err.message}`);
  }

  // Admin list stops
  try {
    const res = await fetch(`${BASE_URL}/api/admin/stops`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    assert(res.status === 200, "Admin can access GET /api/admin/stops");
    assert(data.data?.length >= 4, "Stops list returned");
  } catch (err: any) {
    assert(false, `Admin stops test failed: ${err.message}`);
  }

  // Admin list drivers
  try {
    const res = await fetch(`${BASE_URL}/api/admin/drivers`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    assert(res.status === 200, "Admin can access GET /api/admin/drivers");
    assert(data.data?.some((d: any) => d.collegeId === "DRIVER001"), "DRIVER001 listed in drivers");
  } catch (err: any) {
    assert(false, `Admin drivers test failed: ${err.message}`);
  }

  console.log("\n==================================================");
  console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("==================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner encountered fatal error:", err);
  process.exit(1);
});
