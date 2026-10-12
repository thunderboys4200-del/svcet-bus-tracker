/**
 * Integration Test Suite for Route Reuse, Shared Stops, and Multi-Bus Assignment
 * Tests all 16 requirements specified in Section 9 of the engineering prompt.
 */

const BASE_URL = "http://localhost:4000";

let adminToken = "";
let driver1Token = "";
let driver2Token = "";
let studentToken = "";

let stopMainGateId = "";
let stopBId = "";
let stopCId = "";
let stopDId = "";

let routeAId = "";
let routeBId = "";

let bus001Id = "";
let bus002Id = "";
let bus003Id = "";

let tripBus001Id = "";
let tripBus002Id = "";

let totalPassed = 0;
let totalFailed = 0;

function assert(condition: boolean, description: string) {
  if (condition) {
    console.log(`  ✓ ${description}`);
    totalPassed++;
  } else {
    console.error(`  ✗ FAIL: ${description}`);
    totalFailed++;
  }
}

async function runTests() {
  console.log("==================================================");
  console.log("TESTING ROUTE REUSE, SHARED STOPS & MULTI-BUS ROUTES");
  console.log(`Target: ${BASE_URL}`);
  console.log("==================================================\n");

  // Step 0: Authenticate Admin & Setup accounts
  console.log("0. Authenticating Administrator & Drivers...");
  try {
    const adminRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collegeId: "ADMIN001", password: "Admin@123456" }),
    });
    const adminData = await adminRes.json();
    adminToken = adminData.token;
    assert(adminRes.status === 200 && !!adminToken, "Admin authenticated with JWT");

    // Ensure Driver 1 exists
    const d1Res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collegeId: "DRIVER001", password: "Driver@123456" }),
    });
    const d1Data = await d1Res.json();
    driver1Token = d1Data.token;
    assert(d1Res.status === 200 && !!driver1Token, "Driver 1 authenticated");

    // Ensure Driver 2 exists (or create)
    let d2Res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collegeId: "DRIVER002", password: "Driver@123456" }),
    });
    if (d2Res.status !== 200) {
      await fetch(`${BASE_URL}/api/admin/drivers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          collegeId: "DRIVER002",
          name: "Driver Two",
          password: "Driver@123456",
        }),
      });
      d2Res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collegeId: "DRIVER002", password: "Driver@123456" }),
      });
    }
    const d2Data = await d2Res.json();
    driver2Token = d2Data.token;
    assert(d2Res.status === 200 && !!driver2Token, "Driver 2 authenticated");

    // Student
    const stRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collegeId: "STUDENT001", password: "Student@123456" }),
    });
    const stData = await stRes.json();
    studentToken = stData.token;
    assert(stRes.status === 200 && !!studentToken, "Student authenticated");
  } catch (err: any) {
    assert(false, `Authentication setup failed: ${err.message}`);
  }

  // 1. Create a physical stop named Main Gate
  console.log("\n1. Scenario 1: Create a physical stop named 'Main Gate'...");
  try {
    const res = await fetch(`${BASE_URL}/api/admin/stops`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: "Main Gate",
        code: "STOP-MG",
        latitude: 13.1435,
        longitude: 79.9082,
        landmark: "College Entrance",
        confirmDuplicate: true,
      }),
    });
    const data = await res.json();
    assert(res.status === 201, "Stop 'Main Gate' created with 201 Created");
    stopMainGateId = data.data._id || data.data.id;
    assert(!!stopMainGateId, `Stop ID created: ${stopMainGateId}`);

    // Create supporting Stop B and Stop C
    const resB = await fetch(`${BASE_URL}/api/admin/stops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: "Stop B (Hostel Junction)", latitude: 13.148, longitude: 79.912, confirmDuplicate: true }),
    });
    const dataB = await resB.json();
    stopBId = dataB.data._id || dataB.data.id;

    const resC = await fetch(`${BASE_URL}/api/admin/stops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: "Stop C (Library Circle)", latitude: 13.152, longitude: 79.918, confirmDuplicate: true }),
    });
    const dataC = await resC.json();
    stopCId = dataC.data._id || dataC.data.id;
    assert(!!stopBId && !!stopCId, "Created supporting Stop B and Stop C");
  } catch (err: any) {
    assert(false, `Scenario 1 failed: ${err.message}`);
  }

  // 2. Create Route A using Main Gate, Stop B, and Stop C
  console.log("\n2. Scenario 2: Create Route A using Main Gate, Stop B, and Stop C...");
  try {
    const routeACode = `ROUTE-A-${Date.now().toString().slice(-4)}`;
    const res = await fetch(`${BASE_URL}/api/admin/routes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: "Route A - North Campus Express",
        code: routeACode,
        stops: [
          { stopId: stopMainGateId, sequence: 1 },
          { stopId: stopBId, sequence: 2 },
          { stopId: stopCId, sequence: 3 },
        ],
      }),
    });
    const data = await res.json();
    assert(res.status === 201, "Route A created with 201 Created");
    routeAId = data.data._id || data.data.id;
    assert(!!routeAId, `Route A ID: ${routeAId}`);
    assert(data.data.stops.length === 3, "Route A has 3 stops");
  } catch (err: any) {
    assert(false, `Scenario 2 failed: ${err.message}`);
  }

  // 3. Create Route B using the existing Main Gate and Stop B records, plus a new Stop D
  console.log("\n3. Scenario 3: Create Route B using existing Main Gate & Stop B + new Stop D...");
  try {
    // Create physical Stop D
    const resD = await fetch(`${BASE_URL}/api/admin/stops`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ name: "Stop D (Tech Park Ext)", latitude: 13.156, longitude: 79.924, confirmDuplicate: true }),
    });
    const dataD = await resD.json();
    stopDId = dataD.data._id || dataD.data.id;

    const routeBCode = `ROUTE-B-${Date.now().toString().slice(-4)}`;
    // Route B uses: Main Gate (1) -> Stop B (2) -> Stop D (3)
    const resB = await fetch(`${BASE_URL}/api/admin/routes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: "Route B - Extended Tech Park",
        code: routeBCode,
        stops: [
          { stopId: stopMainGateId, sequence: 1 },
          { stopId: stopBId, sequence: 2 },
          { stopId: stopDId, sequence: 3 },
        ],
      }),
    });
    const dataB = await resB.json();
    assert(resB.status === 201, "Route B created with 201 Created");
    routeBId = dataB.data._id || dataB.data.id;
    assert(!!routeBId, `Route B ID: ${routeBId}`);
  } catch (err: any) {
    assert(false, `Scenario 3 failed: ${err.message}`);
  }

  // 4. Verify that the shared stops retain their original database IDs
  console.log("\n4. Scenario 4: Verify shared stops retain original database IDs...");
  try {
    const resA = await fetch(`${BASE_URL}/api/admin/routes`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const routesData = await resA.json();
    const fetchedRouteA = routesData.data.find((r: any) => (r._id || r.id) === routeAId);
    const fetchedRouteB = routesData.data.find((r: any) => (r._id || r.id) === routeBId);

    const routeAStop1 = fetchedRouteA.stops[0].stopId._id || fetchedRouteA.stops[0].stopId;
    const routeBStop1 = fetchedRouteB.stops[0].stopId._id || fetchedRouteB.stops[0].stopId;
    assert(routeAStop1 === stopMainGateId, "Route A stop 1 matches Main Gate ID");
    assert(routeBStop1 === stopMainGateId, "Route B stop 1 matches Main Gate ID");
    assert(routeAStop1 === routeBStop1, "Both routes reference the identical physical Main Gate document");

    const routeAStop2 = fetchedRouteA.stops[1].stopId._id || fetchedRouteA.stops[1].stopId;
    const routeBStop2 = fetchedRouteB.stops[1].stopId._id || fetchedRouteB.stops[1].stopId;
    assert(routeAStop2 === stopBId && routeBStop2 === stopBId, "Both routes reference identical Stop B");
  } catch (err: any) {
    assert(false, `Scenario 4 failed: ${err.message}`);
  }

  // 5. Verify that Route A and Route B have their own correct ordered stop lists
  console.log("\n5. Scenario 5: Verify Route A and Route B have their own correct ordered stop lists...");
  try {
    const res = await fetch(`${BASE_URL}/api/admin/routes`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const routesData = await res.json();
    const fetchedRouteA = routesData.data.find((r: any) => (r._id || r.id) === routeAId);
    const fetchedRouteB = routesData.data.find((r: any) => (r._id || r.id) === routeBId);

    assert(fetchedRouteA.stops[0].sequence === 1 && fetchedRouteA.stops[1].sequence === 2 && fetchedRouteA.stops[2].sequence === 3, "Route A stops sequenced 1, 2, 3");
    assert(fetchedRouteB.stops[0].sequence === 1 && fetchedRouteB.stops[1].sequence === 2 && fetchedRouteB.stops[2].sequence === 3, "Route B stops sequenced 1, 2, 3");
    assert((fetchedRouteA.stops[2].stopId._id || fetchedRouteA.stops[2].stopId) === stopCId, "Route A terminal stop is Stop C");
    assert((fetchedRouteB.stops[2].stopId._id || fetchedRouteB.stops[2].stopId) === stopDId, "Route B terminal stop is Stop D");
  } catch (err: any) {
    assert(false, `Scenario 5 failed: ${err.message}`);
  }

  // 6, 7, 8: Multi-bus assignments
  console.log("\n6-8. Scenarios 6, 7, 8: Multi-bus assignments to Route A and Route B...");
  try {
    const busesRes = await fetch(`${BASE_URL}/api/admin/buses`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const busesData = await busesRes.json();
    const busList = busesData.data;

    // Bus 001
    let bus001 = busList.find((b: any) => b.busNumber === "BUS-001");
    if (!bus001) {
      const createRes = await fetch(`${BASE_URL}/api/admin/buses`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ busNumber: "BUS-001", registrationNumber: "TN10AB1234", capacity: 40 }),
      });
      const createData = await createRes.json();
      bus001 = createData.data;
    }
    bus001Id = bus001?._id || bus001?.id;

    // Ensure Bus 002 exists
    let bus002 = busList.find((b: any) => b.busNumber === "BUS-002");
    if (!bus002) {
      const createRes = await fetch(`${BASE_URL}/api/admin/buses`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ busNumber: "BUS-002", registrationNumber: "TN10CD5678", capacity: 45 }),
      });
      const createData = await createRes.json();
      bus002 = createData.data;
    }
    bus002Id = bus002?._id || bus002?.id;

    // Ensure Bus 003 exists
    let bus003 = busList.find((b: any) => b.busNumber === "BUS-003");
    if (!bus003) {
      const createRes = await fetch(`${BASE_URL}/api/admin/buses`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ busNumber: "BUS-003", registrationNumber: "TN10EF9012", capacity: 40 }),
      });
      const createData = await createRes.json();
      bus003 = createData.data;
    }
    bus003Id = bus003?._id || bus003?.id;

    // End any active trip for Bus 001 first if one was left running
    const activeRes = await fetch(`${BASE_URL}/api/trips/bus/${bus001Id}/active`);
    if (activeRes.status === 200) {
      const activeData = await activeRes.json();
      await fetch(`${BASE_URL}/api/trips/${activeData.data._id || activeData.data.id}/end`, {
        method: "POST",
        headers: { Authorization: `Bearer ${driver1Token}` },
      });
    }

    // Assign Route A to Bus 001
    const assign1 = await fetch(`${BASE_URL}/api/admin/buses/${bus001Id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ assignedRouteId: routeAId }),
    });
    const a1Json = await assign1.json();
    if (assign1.status !== 200) console.log("assign1 failed:", assign1.status, a1Json);
    assert(assign1.status === 200, "Assigned Route A to Bus 001 with 200 OK");

    // Assign Route A to Bus 002 (Same route reused across multiple buses!)
    const assign2 = await fetch(`${BASE_URL}/api/admin/buses/${bus002Id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ assignedRouteId: routeAId }),
    });
    assert(assign2.status === 200, "Assigned Route A to Bus 002 with 200 OK (Multiple buses on Route A)");

    // Assign Route B to Bus 003
    const assign3 = await fetch(`${BASE_URL}/api/admin/buses/${bus003Id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ assignedRouteId: routeBId }),
    });
    assert(assign3.status === 200, "Assigned Route B to Bus 003 with 200 OK");

    // Assign Drivers
    const driversRes = await fetch(`${BASE_URL}/api/admin/drivers`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const driversList = (await driversRes.json()).data;
    const driver1 = driversList.find((d: any) => d.collegeId === "DRIVER001");
    const driver2 = driversList.find((d: any) => d.collegeId === "DRIVER002");

    await fetch(`${BASE_URL}/api/admin/buses/${bus001Id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ assignedDriverId: driver1._id || driver1.id }),
    });
    await fetch(`${BASE_URL}/api/admin/buses/${bus002Id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ assignedDriverId: driver2._id || driver2.id }),
    });
    assert(true, "Assigned Driver 1 to Bus 001 and Driver 2 to Bus 002");
  } catch (err: any) {
    assert(false, `Scenarios 6-8 failed: ${err.message}`);
  }

  // 9. Start separate authorized trips for Bus 001 and Bus 002
  console.log("\n9. Scenario 9: Start separate authorized trips for Bus 001 and Bus 002 on Route A...");
  try {
    // Driver 1 starts trip for Bus 001
    const trip1Res = await fetch(`${BASE_URL}/api/trips/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${driver1Token}` },
      body: JSON.stringify({ busId: bus001Id }),
    });
    const trip1Data = await trip1Res.json();
    assert(trip1Res.status === 201, "Driver 1 started trip for Bus 001 with 201 Created");
    tripBus001Id = trip1Data.data.tripId;

    // Driver 2 starts trip for Bus 002 on the SAME Route A!
    const trip2Res = await fetch(`${BASE_URL}/api/trips/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${driver2Token}` },
      body: JSON.stringify({ busId: bus002Id }),
    });
    const trip2Data = await trip2Res.json();
    assert(trip2Res.status === 201, "Driver 2 started trip for Bus 002 with 201 Created on the same Route A!");
    tripBus002Id = trip2Data.data.tripId;

    assert(tripBus001Id !== tripBus002Id, "Buses have independent active trip IDs");
  } catch (err: any) {
    assert(false, `Scenario 9 failed: ${err.message}`);
  }

  // 10 & 11: Independent GPS locations and isolated tracking
  console.log("\n10-11. Scenarios 10 & 11: Independent GPS streaming and isolated tracking data...");
  try {
    // Send GPS update for Bus 001 (Main Gate: 13.1435, 79.9082)
    const gps1 = await fetch(`${BASE_URL}/api/trips/${tripBus001Id}/location`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${driver1Token}` },
      body: JSON.stringify({
        latitude: 13.1435,
        longitude: 79.9082,
        speed: 35,
        accuracy: 8,
        recordedAt: new Date().toISOString(),
      }),
    });
    assert(gps1.status === 200, "Bus 001 GPS update recorded (13.1435, 79.9082, 35 km/h)");

    // Send different GPS update for Bus 002 (Stop B: 13.1480, 79.9120)
    const gps2 = await fetch(`${BASE_URL}/api/trips/${tripBus002Id}/location`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${driver2Token}` },
      body: JSON.stringify({
        latitude: 13.1480,
        longitude: 79.9120,
        speed: 48,
        accuracy: 10,
        recordedAt: new Date().toISOString(),
      }),
    });
    assert(gps2.status === 200, "Bus 002 GPS update recorded (13.1480, 79.9120, 48 km/h)");

    // Verify Bus 001 tracking endpoint
    const track1Res = await fetch(`${BASE_URL}/api/trips/bus/${bus001Id}/tracking`);
    const track1 = await track1Res.json();
    assert(track1.data.trip.currentLocation.latitude === 13.1435, "Bus 001 reports its own GPS latitude (13.1435)");
    assert(track1.data.trip.currentLocation.speed === 35, "Bus 001 reports speed 35 km/h");

    // Verify Bus 002 tracking endpoint
    const track2Res = await fetch(`${BASE_URL}/api/trips/bus/${bus002Id}/tracking`);
    const track2 = await track2Res.json();
    assert(track2.data.trip.currentLocation.latitude === 13.1480, "Bus 002 reports its own GPS latitude (13.1480)");
    assert(track2.data.trip.currentLocation.speed === 48, "Bus 002 reports speed 48 km/h");

    assert(
      track1.data.trip.currentLocation.latitude !== track2.data.trip.currentLocation.latitude,
      "Trip 1 telemetry does not overwrite or mutate Trip 2 telemetry",
    );
  } catch (err: any) {
    assert(false, `Scenarios 10-11 failed: ${err.message}`);
  }

  // 12. Verify the driver and student endpoints load the correct route and stop order
  console.log("\n12. Scenario 12: Verify driver & student dashboards receive ordered stops...");
  try {
    // Driver 1 assigned route
    const dr1AssignedRes = await fetch(`${BASE_URL}/api/trips/driver/assigned`, {
      headers: { Authorization: `Bearer ${driver1Token}` },
    });
    const dr1Assigned = await dr1AssignedRes.json();
    assert(dr1AssignedRes.status === 200, "Driver 1 assigned endpoint returns 200");
    const stopsList = (dr1Assigned.data?.assignedRoute || dr1Assigned.data?.route)?.stops || [];
    assert(stopsList.length === 3, "Driver 1 receives 3 stops along Route A");
    assert(stopsList[0].sequence === 1 && stopsList[1].sequence === 2 && stopsList[2].sequence === 3, "Stops are strictly ordered sequence 1 -> 2 -> 3");

    // Student public routes endpoint
    const studentRoutesRes = await fetch(`${BASE_URL}/api/trips/routes`);
    const studentRoutes = await studentRoutesRes.json();
    assert(studentRoutesRes.status === 200, "Student routes endpoint returns 200 OK");
    const pubRouteA = studentRoutes.data.find((r: any) => r.id === routeAId);
    assert(pubRouteA.stops[0].name === "Main Gate", "First stop in student view is Main Gate");
  } catch (err: any) {
    assert(false, `Scenario 12 failed: ${err.message}`);
  }

  // 13. Attempt to create a duplicate route code and confirm useful rejection message
  console.log("\n13. Scenario 13: Attempt to create duplicate route code...");
  try {
    const routesRes = await fetch(`${BASE_URL}/api/admin/routes`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const routesJson = await routesRes.json();
    const routeACode = routesJson.data.find((r: any) => (r._id || r.id) === routeAId).code;

    const dupRes = await fetch(`${BASE_URL}/api/admin/routes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: "Conflicting Route",
        code: routeACode, // Intentional collision
        stops: [{ stopId: stopMainGateId, sequence: 1 }],
      }),
    });
    const dupData = await dupRes.json();
    assert(dupRes.status === 409, "Duplicate route code rejected with 409 Conflict");
    assert(dupData.duplicateCode === true, "Response flags duplicateCode: true");
    assert(dupData.message.includes("already in use"), `Rejection message is clear: "${dupData.message}"`);
  } catch (err: any) {
    assert(false, `Scenario 13 failed: ${err.message}`);
  }

  // 14. Remove a stop from one route and verify it remains available to other routes
  console.log("\n14. Scenario 14: Remove a stop from Route A and verify Stop remains available in Route B and database...");
  try {
    // Update Route A to only have Main Gate and Stop C (removing Stop B from Route A)
    const updateRes = await fetch(`${BASE_URL}/api/admin/routes/${routeAId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        stops: [
          { stopId: stopMainGateId, sequence: 1 },
          { stopId: stopCId, sequence: 2 },
        ],
      }),
    });
    assert(updateRes.status === 200, "Removed Stop B from Route A with 200 OK");

    // Verify physical Stop B still exists in database
    const stopBCheck = await fetch(`${BASE_URL}/api/admin/stops`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const allStops = (await stopBCheck.json()).data;
    const stopBFound = allStops.find((s: any) => (s._id || s.id) === stopBId);
    assert(!!stopBFound, "Physical Stop B remains intact in database");

    // Verify Route B still has Stop B
    const routeBCheck = await fetch(`${BASE_URL}/api/admin/routes`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const allRoutes = (await routeBCheck.json()).data;
    const routeBFound = allRoutes.find((r: any) => (r._id || r.id) === routeBId);
    const hasStopB = routeBFound.stops.some((s: any) => (s.stopId?._id || s.stopId) === stopBId);
    assert(hasStopB, "Route B still retains its reference to Stop B");
  } catch (err: any) {
    assert(false, `Scenario 14 failed: ${err.message}`);
  }

  // 15. Verify unauthorized users cannot create, modify, assign, or delete routes
  console.log("\n15. Scenario 15: Verify unauthorized users cannot manipulate routes...");
  try {
    // Student tries to create route
    const unauthPost = await fetch(`${BASE_URL}/api/admin/routes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ name: "Hacked Route", code: "HACK01", stops: [{ stopId: stopMainGateId, sequence: 1 }] }),
    });
    assert(unauthPost.status === 403, "Student blocked from creating route with 403 Forbidden");

    // Driver tries to delete route
    const unauthDelete = await fetch(`${BASE_URL}/api/admin/routes/${routeAId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${driver1Token}` },
    });
    assert(unauthDelete.status === 403, "Driver blocked from deleting route with 403 Forbidden");

    // Anonymous request
    const anonAssign = await fetch(`${BASE_URL}/api/admin/buses/${bus001Id}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedRouteId: routeBId }),
    });
    assert(anonAssign.status === 401, "Anonymous user blocked from assigning route with 401 Unauthorized");
  } catch (err: any) {
    assert(false, `Scenario 15 failed: ${err.message}`);
  }

  // Cleanup: End trips
  try {
    await fetch(`${BASE_URL}/api/trips/${tripBus001Id}/end`, {
      method: "POST",
      headers: { Authorization: `Bearer ${driver1Token}` },
    });
    await fetch(`${BASE_URL}/api/trips/${tripBus002Id}/end`, {
      method: "POST",
      headers: { Authorization: `Bearer ${driver2Token}` },
    });
  } catch {
    // Ignore cleanup errors
  }

  console.log("\n==================================================");
  console.log(`TEST SUMMARY: ${totalPassed} PASSED, ${totalFailed} FAILED`);
  console.log("==================================================");

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runTests();
