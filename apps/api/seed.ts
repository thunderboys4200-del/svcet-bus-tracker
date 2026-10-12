import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import User from "./src/models/User";
import Bus from "./src/models/Bus";
import RouteModel from "./src/models/Route";
import Stop from "./src/models/Stop";

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not configured in .env");
  }

  await mongoose.connect(uri);
  console.log("Connected to MongoDB Atlas for seeding.");

  const adminPassword = process.env.ADMIN_SEED_PASSWORD || "Admin@123456";
  const driverPassword = process.env.DRIVER_SEED_PASSWORD || "Driver@123456";
  const studentPassword = process.env.STUDENT_SEED_PASSWORD || "Student@123456";

  const adminHash = await bcrypt.hash(adminPassword, 12);
  const driverHash = await bcrypt.hash(driverPassword, 12);
  const studentHash = await bcrypt.hash(studentPassword, 12);

  // 1. Seed or update Admin (GOKUL and ADMIN001)
  let adminGokul = await User.findOne({
    $or: [{ collegeId: "GOKUL" }, { username: "GOKUL" }],
  });
  if (!adminGokul) {
    adminGokul = await User.create({
      collegeId: "GOKUL",
      username: "GOKUL",
      name: "GOKUL",
      passwordHash: adminHash,
      role: "admin",
      active: true,
    });
    console.log("Created Admin account GOKUL");
  } else {
    adminGokul.active = true;
    adminGokul.role = "admin";
    adminGokul.username = "GOKUL";
    await adminGokul.save();
    console.log("Verified Admin account GOKUL");
  }

  let admin = await User.findOne({ collegeId: "ADMIN001" });
  if (!admin) {
    admin = await User.create({
      collegeId: "ADMIN001",
      username: "ADMIN001",
      name: "Administrator",
      passwordHash: adminHash,
      role: "admin",
      active: true,
    });
    console.log("Created Admin account ADMIN001");
  } else {
    admin.passwordHash = adminHash;
    admin.active = true;
    admin.role = "admin";
    await admin.save();
    console.log("Updated Admin account ADMIN001 password");
  }

  // 2. Seed or update Driver
  let driver = await User.findOne({ collegeId: "DRIVER001" });
  if (!driver) {
    driver = await User.create({
      collegeId: "DRIVER001",
      name: "Test Driver",
      passwordHash: driverHash,
      role: "driver",
      active: true,
    });
    console.log("Created Driver account DRIVER001");
  } else {
    driver.passwordHash = driverHash;
    driver.active = true;
    await driver.save();
    console.log("Updated Driver account DRIVER001 password");
  }

  // 3. Seed or update Student
  let student = await User.findOne({ collegeId: "STUDENT001" });
  if (!student) {
    student = await User.create({
      collegeId: "STUDENT001",
      name: "Gokul Student",
      passwordHash: studentHash,
      role: "student",
      active: true,
    });
    console.log("Created Student account STUDENT001");
  } else {
    student.passwordHash = studentHash;
    student.active = true;
    await student.save();
    console.log("Updated Student account STUDENT001 password");
  }

  // 4. Seed Stops
  const stopsData = [
    { name: "SVCET Main Gate", latitude: 13.143, longitude: 79.908 },
    { name: "Library & Admin Block", latitude: 13.1455, longitude: 79.9105 },
    { name: "Hostel Junction", latitude: 13.148, longitude: 79.913 },
    { name: "Mechanical & Civil Block", latitude: 13.1505, longitude: 79.9155 },
  ];

  const stopDocs = [];
  for (const s of stopsData) {
    let stop = await Stop.findOne({ name: s.name });
    if (!stop) {
      stop = await Stop.create({ ...s, active: true });
      console.log(`Created stop: ${s.name}`);
    } else {
      stop.latitude = s.latitude;
      stop.longitude = s.longitude;
      stop.active = true;
      await stop.save();
    }
    stopDocs.push(stop);
  }

  // 5. Seed Route
  let route = await RouteModel.findOne({ code: "ROUTE-001" });
  const stopsSequence = stopDocs.map((st, idx) => ({
    stopId: st._id,
    sequence: idx + 1,
  }));
  const geometryCoordinates = stopDocs.map((st) => [st.latitude, st.longitude]);

  if (!route) {
    route = await RouteModel.create({
      name: "SVCET Main Gate Route",
      code: "ROUTE-001",
      stops: stopsSequence,
      geometry: geometryCoordinates,
      active: true,
    });
    console.log("Created route ROUTE-001");
  } else {
    route.stops = stopsSequence as any;
    route.geometry = geometryCoordinates;
    route.active = true;
    await route.save();
    console.log("Updated route ROUTE-001");
  }

  // 6. Seed Bus
  let bus = await Bus.findOne({ busNumber: "BUS-001" });
  if (!bus) {
    bus = await Bus.create({
      busNumber: "BUS-001",
      registrationNumber: "TN10AB1234",
      capacity: 40,
      assignedDriverId: driver._id,
      assignedRouteId: route._id,
      active: true,
    });
    console.log("Created bus BUS-001");
  } else {
    bus.registrationNumber = "TN10AB1234";
    bus.assignedDriverId = driver._id;
    bus.assignedRouteId = route._id;
    bus.active = true;
    await bus.save();
    console.log("Updated bus BUS-001 with assigned driver and route");
  }

  // Update Driver assigned bus
  driver.assignedBusId = bus._id as any;
  driver.assignedRouteId = route._id as any;
  await driver.save();

  // Update Student assigned route
  student.assignedRouteId = route._id as any;
  await student.save();

  console.log("--- SEEDING COMPLETED SUCCESSFULLY ---");
  console.log("Admin credentials: ADMIN001 /", adminPassword);
  console.log("Driver credentials: DRIVER001 /", driverPassword);
  console.log("Student credentials: STUDENT001 /", studentPassword);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
