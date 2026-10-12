
import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";
import bcrypt from "bcrypt";

import Bus from "../models/Bus";
import Stop from "../models/Stop";
import RouteModel from "../models/Route";
import User from "../models/User";
import Trip from "../models/Trip";
import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/auth";

const router = Router();

/**
 * All routes in this router require a valid JWT
 * belonging to an active administrator.
 */
router.use(authenticateToken, authorizeRoles("admin"));

/* -------------------------------------------------------
   SHARED HELPERS
------------------------------------------------------- */

function isValidId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    mongoose.isValidObjectId(value)
  );
}

function getText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function sendServerError(
  res: Response,
  error: unknown,
  message: string,
): void {
  console.error(message, error);
  res.status(500).json({
    success: false,
    message,
  });
}

/* -------------------------------------------------------
   DASHBOARD SUMMARY
   GET /api/admin/dashboard
------------------------------------------------------- */

router.get(
  "/dashboard",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const [
        buses,
        routes,
        stops,
        drivers,
        students,
        activeTrips,
      ] = await Promise.all([
        Bus.countDocuments(),
        RouteModel.countDocuments(),
        Stop.countDocuments(),
        User.countDocuments({ role: "driver" }),
        User.countDocuments({ role: "student" }),
        Trip.countDocuments({ status: "active" }),
      ]);

      res.json({
        success: true,
        data: {
          totalBuses: buses,
          totalRoutes: routes,
          totalStops: stops,
          totalDrivers: drivers,
          totalStudents: students,
          activeTrips,
        },
      });
    } catch (error) {
      sendServerError(res, error, "Unable to load dashboard.");
    }
  },
);

/* -------------------------------------------------------
   BUS MANAGEMENT
------------------------------------------------------- */

// GET /api/admin/buses
router.get(
  "/buses",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const buses = await Bus.find()
        .populate("assignedDriverId", "collegeId name active")
        .populate("assignedRouteId", "name code stops")
        .sort({ createdAt: -1 })
        .lean();

      res.json({
        success: true,
        count: buses.length,
        data: buses,
      });
    } catch (error) {
      sendServerError(res, error, "Unable to fetch buses.");
    }
  },
);

// POST /api/admin/buses
router.post(
  "/buses",
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (
        !req.body ||
        typeof req.body !== "object" ||
        Array.isArray(req.body)
      ) {
        res.status(400).json({
          success: false,
          message: "Provide valid bus details.",
        });
        return;
      }

      const bus = await Bus.create(req.body);

      res.status(201).json({
        success: true,
        message: "Bus created successfully.",
        data: bus,
      });
    } catch (error) {
      if (
        error instanceof mongoose.Error.ValidationError ||
        (error as { code?: number })?.code === 11000
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid or duplicate bus details.",
        });
        return;
      }

      sendServerError(res, error, "Unable to create bus.");
    }
  },
);

// GET /api/admin/buses/:busId
router.get(
  "/buses/:busId",
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!isValidId(req.params.busId)) {
        res.status(400).json({
          success: false,
          message: "Invalid bus ID.",
        });
        return;
      }

      const bus = await Bus.findById(req.params.busId).lean();

      if (!bus) {
        res.status(404).json({
          success: false,
          message: "Bus not found.",
        });
        return;
      }

      res.json({ success: true, data: bus });
    } catch (error) {
      sendServerError(res, error, "Unable to fetch bus.");
    }
  },
);

// PUT /api/admin/buses/:busId
router.put(
  "/buses/:busId",
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!isValidId(req.params.busId)) {
        res.status(400).json({
          success: false,
          message: "Invalid bus ID.",
        });
        return;
      }

      const updates = { ...req.body };

      delete updates._id;
      delete updates.__v;
      delete updates.createdAt;
      delete updates.updatedAt;

      const bus = await Bus.findByIdAndUpdate(
        req.params.busId,
        { $set: updates },
        { new: true, runValidators: true },
      );

      if (!bus) {
        res.status(404).json({
          success: false,
          message: "Bus not found.",
        });
        return;
      }

      res.json({
        success: true,
        message: "Bus updated successfully.",
        data: bus,
      });
    } catch (error) {
      sendServerError(res, error, "Unable to update bus.");
    }
  },
);

// DELETE /api/admin/buses/:busId
router.delete(
  "/buses/:busId",
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!isValidId(req.params.busId)) {
        res.status(400).json({
          success: false,
          message: "Invalid bus ID.",
        });
        return;
      }

      const bus = await Bus.findByIdAndDelete(req.params.busId);

      if (!bus) {
        res.status(404).json({
          success: false,
          message: "Bus not found.",
        });
        return;
      }

      res.json({
        success: true,
        message: "Bus deleted successfully.",
      });
    } catch (error) {
      sendServerError(res, error, "Unable to delete bus.");
    }
  },
);

/* -------------------------------------------------------
   BUS ASSIGNMENT
   POST /api/admin/buses/:busId/assign

   Expected body:
   { "assignedRouteId": "...", "assignedDriverId": "..." }

   These fields must exist in your Bus schema.
------------------------------------------------------- */

router.post(
  "/buses/:busId/assign",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { busId } = req.params;
      const { assignedRouteId, assignedDriverId } = req.body ?? {};

      if (!isValidId(busId)) {
        res.status(400).json({
          success: false,
          message: "Invalid bus ID.",
        });
        return;
      }

      if (
        assignedRouteId !== undefined &&
        assignedRouteId !== null &&
        assignedRouteId !== "" &&
        !isValidId(assignedRouteId)
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid route ID.",
        });
        return;
      }

      if (
        assignedDriverId !== undefined &&
        assignedDriverId !== null &&
        assignedDriverId !== "" &&
        !isValidId(assignedDriverId)
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid driver ID.",
        });
        return;
      }

      const bus = await Bus.findById(busId);

      if (!bus) {
        res.status(404).json({
          success: false,
          message: "Bus not found.",
        });
        return;
      }

      if (assignedRouteId) {
        const route = await RouteModel.findById(assignedRouteId);

        if (!route) {
          res.status(404).json({
            success: false,
            message: "Route not found.",
          });
          return;
        }
      }

      if (assignedDriverId) {
        const driver = await User.findOne({
          _id: assignedDriverId,
          role: "driver",
          active: true,
        });

        if (!driver) {
          res.status(404).json({
            success: false,
            message: "Active driver not found.",
          });
          return;
        }
      }

      // Prevent changing route during active trip
      if (
        assignedRouteId !== undefined &&
        (assignedRouteId || null) !== (bus.assignedRouteId?.toString() || null)
      ) {
        const activeTrip = await Trip.findOne({ busId, status: "active" });
        if (activeTrip) {
          res.status(409).json({
            success: false,
            message: `Cannot change route assignment while Bus ${bus.busNumber} has an active trip in progress. Please end the active trip first.`,
          });
          return;
        }
      }

      const updates: Record<string, unknown> = {};

      if (assignedRouteId !== undefined) {
        updates.assignedRouteId = assignedRouteId || null;
      }

      if (assignedDriverId !== undefined) {
        updates.assignedDriverId = assignedDriverId || null;
      }

      const updatedBus = await Bus.findByIdAndUpdate(
        busId,
        { $set: updates },
        { new: true, runValidators: true },
      );

      // Only update driver's assignedBusId when assignedDriverId was explicitly provided
      if (assignedDriverId !== undefined) {
        // Clear any previous driver assigned to this bus (except the new one)
        await User.updateMany(
          { role: "driver", assignedBusId: busId, _id: { $ne: assignedDriverId || null } },
          { $unset: { assignedBusId: 1 } },
        );

        if (assignedDriverId) {
          await User.findByIdAndUpdate(assignedDriverId, {
            $set: { assignedBusId: busId },
          });
        }
      }

      res.json({
        success: true,
        message: "Bus assignment updated.",
        data: updatedBus,
      });
    } catch (error) {
      sendServerError(res, error, "Unable to assign bus.");
    }
  },
);

/* -------------------------------------------------------
   STOP MANAGEMENT
------------------------------------------------------- */

// GET /api/admin/stops
router.get(
  "/stops",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const stops = await Stop.find().sort({ createdAt: -1 }).lean();

      res.json({
        success: true,
        count: stops.length,
        data: stops,
      });
    } catch (error) {
      sendServerError(res, error, "Unable to fetch stops.");
    }
  },
);

// POST /api/admin/stops
router.post(
  "/stops",
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.body || typeof req.body !== "object") {
        res.status(400).json({
          success: false,
          message: "Provide valid stop details.",
        });
        return;
      }

      const { name, latitude, longitude, code, address, landmark, confirmDuplicate } = req.body;
      const cleanName = getText(name);

      if (!cleanName) {
        res.status(400).json({ success: false, message: "Stop name is required." });
        return;
      }

      const lat = typeof latitude === "number" ? latitude : parseFloat(latitude);
      const lng = typeof longitude === "number" ? longitude : parseFloat(longitude);

      if (Number.isNaN(lat) || lat < -90 || lat > 90 || Number.isNaN(lng) || lng < -180 || lng > 180) {
        res.status(400).json({ success: false, message: "Valid latitude (-90 to 90) and longitude (-180 to 180) are required." });
        return;
      }

      // Proximity check against existing stops
      if (!confirmDuplicate) {
        const existingStops = await Stop.find({ active: true }).lean();
        let closestStop: any = null;
        let minDistance = Infinity;

        for (const st of existingStops) {
          const dist = haversineDistanceMeters(lat, lng, st.latitude, st.longitude);
          const sameName = st.name.toLowerCase() === cleanName.toLowerCase();

          // Threshold: within 50 meters, or within 200 meters with identical name
          if (dist <= 50 || (sameName && dist <= 200)) {
            if (dist < minDistance) {
              minDistance = dist;
              closestStop = st;
            }
          }
        }

        if (closestStop) {
          res.status(409).json({
            success: false,
            duplicateWarning: true,
            message: `A stop nearby ('${closestStop.name}') already exists within ${Math.round(minDistance)} meters. Reuse this stop or confirm creation of a distinct stop.`,
            existingStop: {
              id: closestStop._id.toString(),
              name: closestStop.name,
              latitude: closestStop.latitude,
              longitude: closestStop.longitude,
              code: closestStop.code,
            },
            distanceMeters: Math.round(minDistance),
          });
          return;
        }
      }

      const stop = await Stop.create({
        name: cleanName,
        latitude: lat,
        longitude: lng,
        code: getText(code).toUpperCase() || undefined,
        address: getText(address) || undefined,
        landmark: getText(landmark) || undefined,
      });

      res.status(201).json({
        success: true,
        message: "Stop created successfully.",
        data: stop,
      });
    } catch (error) {
      if (
        error instanceof mongoose.Error.ValidationError ||
        (error as { code?: number })?.code === 11000
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid or duplicate stop details.",
        });
        return;
      }

      sendServerError(res, error, "Unable to create stop.");
    }
  },
);

// PUT /api/admin/stops/:stopId
router.put(
  "/stops/:stopId",
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!isValidId(req.params.stopId)) {
        res.status(400).json({
          success: false,
          message: "Invalid stop ID.",
        });
        return;
      }

      const updates = { ...req.body };

      delete updates._id;
      delete updates.__v;
      delete updates.createdAt;
      delete updates.updatedAt;

      const stop = await Stop.findByIdAndUpdate(
        req.params.stopId,
        { $set: updates },
        { new: true, runValidators: true },
      );

      if (!stop) {
        res.status(404).json({
          success: false,
          message: "Stop not found.",
        });
        return;
      }

      res.json({
        success: true,
        message: "Stop updated successfully.",
        data: stop,
      });
    } catch (error) {
      sendServerError(res, error, "Unable to update stop.");
    }
  },
);

// DELETE /api/admin/stops/:stopId
router.delete(
  "/stops/:stopId",
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!isValidId(req.params.stopId)) {
        res.status(400).json({
          success: false,
          message: "Invalid stop ID.",
        });
        return;
      }

      const stop = await Stop.findById(req.params.stopId);

      if (!stop) {
        res.status(404).json({
          success: false,
          message: "Stop not found.",
        });
        return;
      }

      // Check if stop is used by any routes
      const usingRoutes = await RouteModel.find({ "stops.stopId": stop._id }).select("name code").lean();
      if (usingRoutes.length > 0) {
        res.status(409).json({
          success: false,
          message: `Cannot delete stop '${stop.name}' because it is used by ${usingRoutes.length} route(s): ${usingRoutes.map((r) => r.name).join(", ")}. Remove it from those routes first or deactivate the stop.`,
          usedByRoutes: usingRoutes,
        });
        return;
      }

      await Stop.findByIdAndDelete(req.params.stopId);

      res.json({
        success: true,
        message: "Stop deleted successfully.",
      });
    } catch (error) {
      sendServerError(res, error, "Unable to delete stop.");
    }
  },
);

/* -------------------------------------------------------
   ROUTE MANAGEMENT
------------------------------------------------------- */

// GET /api/admin/routes
router.get(
  "/routes",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const routes = await RouteModel.find()
        .populate("stops.stopId", "name latitude longitude active")
        .sort({ createdAt: -1 })
        .lean();

      res.json({
        success: true,
        count: routes.length,
        data: routes,
      });
    } catch (error) {
      sendServerError(res, error, "Unable to fetch routes.");
    }
  },
);

// POST /api/admin/routes
router.post(
  "/routes",
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.body || typeof req.body !== "object") {
        res.status(400).json({
          success: false,
          message: "Provide valid route details.",
        });
        return;
      }

      const { name, code, description, stops, geometry, confirmIdenticalSequence } = req.body;
      const cleanName = getText(name);
      const cleanCode = getText(code).toUpperCase();

      if (!cleanName || !cleanCode) {
        res.status(400).json({ success: false, message: "Route name and code are required." });
        return;
      }

      // Check unique route code
      const existingByCode = await RouteModel.findOne({ code: cleanCode });
      if (existingByCode) {
        res.status(409).json({
          success: false,
          duplicateCode: true,
          message: `Route code '${cleanCode}' is already in use by route '${existingByCode.name}'. Please choose a different code or edit the existing route.`,
          existingRoute: {
            id: existingByCode._id.toString(),
            name: existingByCode.name,
            code: existingByCode.code,
          },
        });
        return;
      }

      // Validate stops
      if (!Array.isArray(stops) || stops.length === 0) {
        res.status(400).json({ success: false, message: "Route must contain at least one stop." });
        return;
      }

      const formattedStops: Array<{ stopId: mongoose.Types.ObjectId; sequence: number }> = [];
      const stopIdsToVerify: string[] = [];

      for (let i = 0; i < stops.length; i++) {
        const s = stops[i];
        const rawStopId = typeof s.stopId === "string" ? s.stopId : s.stopId?.toString();
        if (!isValidId(rawStopId)) {
          res.status(400).json({ success: false, message: `Invalid stop ID at position ${i + 1}.` });
          return;
        }
        stopIdsToVerify.push(rawStopId);
        formattedStops.push({
          stopId: new mongoose.Types.ObjectId(rawStopId),
          sequence: typeof s.sequence === "number" && s.sequence > 0 ? s.sequence : i + 1,
        });
      }

      // Sort stops by sequence
      formattedStops.sort((a, b) => a.sequence - b.sequence);

      // Verify selected stops exist in DB
      const foundStops = await Stop.find({ _id: { $in: stopIdsToVerify } });
      if (foundStops.length !== new Set(stopIdsToVerify).size) {
        res.status(400).json({ success: false, message: "One or more selected stops do not exist in the database." });
        return;
      }

      const stopMap = new Map<string, any>();
      for (const st of foundStops) {
        stopMap.set(st._id.toString(), st);
      }

      // Check for identical ordered stop sequence
      if (!confirmIdenticalSequence) {
        const existingRoutes = await RouteModel.find({ active: true }).lean();
        const candidateSequence = formattedStops.map((s) => s.stopId.toString());

        for (const r of existingRoutes) {
          if (Array.isArray(r.stops) && r.stops.length === candidateSequence.length) {
            const sortedExisting = [...r.stops]
              .sort((a, b) => a.sequence - b.sequence)
              .map((s) => (s.stopId ? s.stopId.toString() : ""));

            const isIdentical = candidateSequence.every((id, idx) => id === sortedExisting[idx]);
            if (isIdentical) {
              res.status(409).json({
                success: false,
                identicalSequenceWarning: true,
                message: `An existing route '${r.name}' (${r.code}) already has this exact stop sequence. You can assign another bus directly to '${r.name}' or confirm creation of this separate route variation.`,
                existingRoute: {
                  id: r._id.toString(),
                  name: r.name,
                  code: r.code,
                },
              });
              return;
            }
          }
        }
      }

      // Straight-line geometry generation from stops if not provided
      let routeGeometry = Array.isArray(geometry) ? geometry : [];
      if (routeGeometry.length === 0) {
        routeGeometry = formattedStops.map((s) => {
          const st = stopMap.get(s.stopId.toString());
          return [st.latitude, st.longitude];
        });
      }

      const route = await RouteModel.create({
        name: cleanName,
        code: cleanCode,
        description: getText(description) || undefined,
        stops: formattedStops,
        geometry: routeGeometry,
      });

      const populated = await RouteModel.findById(route._id)
        .populate("stops.stopId", "name latitude longitude code address landmark active")
        .lean();

      res.status(201).json({
        success: true,
        message: "Route created successfully.",
        data: populated,
      });
    } catch (error) {
      if (
        error instanceof mongoose.Error.ValidationError ||
        (error as { code?: number })?.code === 11000
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid or duplicate route details.",
        });
        return;
      }

      sendServerError(res, error, "Unable to create route.");
    }
  },
);

// PUT /api/admin/routes/:routeId
router.put(
  "/routes/:routeId",
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!isValidId(req.params.routeId)) {
        res.status(400).json({
          success: false,
          message: "Invalid route ID.",
        });
        return;
      }

      const routeId = req.params.routeId;
      const route = await RouteModel.findById(routeId);

      if (!route) {
        res.status(404).json({
          success: false,
          message: "Route not found.",
        });
        return;
      }

      const updates = { ...req.body };
      delete updates._id;
      delete updates.__v;
      delete updates.createdAt;
      delete updates.updatedAt;

      // If code changed, verify uniqueness
      if (updates.code) {
        updates.code = getText(updates.code).toUpperCase();
        if (updates.code !== route.code) {
          const existing = await RouteModel.findOne({ code: updates.code, _id: { $ne: routeId } });
          if (existing) {
            res.status(409).json({
              success: false,
              message: `Route code '${updates.code}' is already in use by route '${existing.name}'.`,
            });
            return;
          }
        }
      }

      // If stops provided, format and sort them
      if (Array.isArray(updates.stops)) {
        if (updates.stops.length === 0) {
          res.status(400).json({ success: false, message: "Route must have at least one stop." });
          return;
        }

        const formattedStops = updates.stops.map((s: any, idx: number) => ({
          stopId: new mongoose.Types.ObjectId(s.stopId),
          sequence: typeof s.sequence === "number" && s.sequence > 0 ? s.sequence : idx + 1,
        }));
        formattedStops.sort((a: any, b: any) => a.sequence - b.sequence);
        updates.stops = formattedStops;

        // Recompute geometry if geometry not provided
        if (!updates.geometry || updates.geometry.length === 0) {
          const stopIds = formattedStops.map((s: any) => s.stopId);
          const stopDocs = await Stop.find({ _id: { $in: stopIds } }).lean();
          const stopMap = new Map(stopDocs.map((s) => [s._id.toString(), s]));
          updates.geometry = formattedStops.map((s: any) => {
            const st = stopMap.get(s.stopId.toString());
            return st ? [st.latitude, st.longitude] : [13.143, 79.908];
          });
        }
      }

      const updatedRoute = await RouteModel.findByIdAndUpdate(
        routeId,
        { $set: updates },
        { new: true, runValidators: true },
      ).populate("stops.stopId", "name latitude longitude code address landmark active");

      res.json({
        success: true,
        message: "Route updated successfully.",
        data: updatedRoute,
      });
    } catch (error) {
      sendServerError(res, error, "Unable to update route.");
    }
  },
);

// DELETE /api/admin/routes/:routeId
router.delete(
  "/routes/:routeId",
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!isValidId(req.params.routeId)) {
        res.status(400).json({
          success: false,
          message: "Invalid route ID.",
        });
        return;
      }

      const routeId = req.params.routeId;
      const route = await RouteModel.findById(routeId);

      if (!route) {
        res.status(404).json({
          success: false,
          message: "Route not found.",
        });
        return;
      }

      // Check if any active buses are assigned to this route
      const assignedBuses = await Bus.find({ assignedRouteId: routeId, active: true })
        .select("busNumber registrationNumber")
        .lean();

      if (assignedBuses.length > 0) {
        res.status(409).json({
          success: false,
          message: `Cannot delete route because ${assignedBuses.length} bus(es) are currently assigned to it (${assignedBuses.map((b) => b.busNumber).join(", ")}). Reassign the buses first.`,
          assignedBuses,
        });
        return;
      }

      await RouteModel.findByIdAndDelete(routeId);

      res.json({
        success: true,
        message: "Route deleted successfully.",
      });
    } catch (error) {
      sendServerError(res, error, "Unable to delete route.");
    }
  },
);

/* -------------------------------------------------------
   DRIVER MANAGEMENT
------------------------------------------------------- */

// GET /api/admin/drivers
router.get(
  "/drivers",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const drivers = await User.find({ role: "driver" })
        .select("-passwordHash")
        .sort({ createdAt: -1 })
        .lean();

      res.json({
        success: true,
        count: drivers.length,
        data: drivers,
      });
    } catch (error) {
      sendServerError(res, error, "Unable to fetch drivers.");
    }
  },
);

// POST /api/admin/drivers
router.post(
  "/drivers",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const collegeId = getText(req.body?.collegeId).toUpperCase();
      const name = getText(req.body?.name);
      const password =
        typeof req.body?.password === "string"
          ? req.body.password
          : "";

      if (!collegeId || !name || !password) {
        res.status(400).json({
          success: false,
          message: "College ID, name and password are required.",
        });
        return;
      }

      if (collegeId.length > 100 || name.length > 150) {
        res.status(400).json({
          success: false,
          message: "College ID or name is too long.",
        });
        return;
      }

      if (
        password.length < 8 ||
        Buffer.byteLength(password, "utf8") > 72
      ) {
        res.status(400).json({
          success: false,
          message: "Password must be at least 8 characters and no more than 72 UTF-8 bytes.",
        });
        return;
      }

      const existingUser = await User.findOne({ collegeId })
        .select("_id");

      if (existingUser) {
        res.status(409).json({
          success: false,
          message: "This college ID already exists.",
        });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const driver = await User.create({
        collegeId,
        name,
        passwordHash,
        role: "driver",
        active: true,
      });

      res.status(201).json({
        success: true,
        message: "Driver account created successfully.",
        data: {
          id: driver._id,
          collegeId: driver.collegeId,
          name: driver.name,
          role: driver.role,
          active: driver.active,
        },
      });
    } catch (error) {
      if ((error as { code?: number })?.code === 11000) {
        res.status(409).json({
          success: false,
          message: "This college ID already exists.",
        });
        return;
      }

      sendServerError(res, error, "Unable to create driver.");
    }
  },
);

// PUT /api/admin/drivers/:driverId/status
router.put(
  "/drivers/:driverId/status",
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!isValidId(req.params.driverId)) {
        res.status(400).json({
          success: false,
          message: "Invalid driver ID.",
        });
        return;
      }

      if (typeof req.body?.active !== "boolean") {
        res.status(400).json({
          success: false,
          message: "Provide active as true or false.",
        });
        return;
      }

      const driver = await User.findOneAndUpdate(
        {
          _id: req.params.driverId,
          role: "driver",
        },
        { $set: { active: req.body.active } },
        { new: true, runValidators: true },
      ).select("-passwordHash");

      if (!driver) {
        res.status(404).json({
          success: false,
          message: "Driver not found.",
        });
        return;
      }

      res.json({
        success: true,
        message: "Driver status updated.",
        data: driver,
      });
    } catch (error) {
      sendServerError(res, error, "Unable to update driver status.");
    }
  },
);

// DELETE /api/admin/drivers/:driverId
router.delete(
  "/drivers/:driverId",
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!isValidId(req.params.driverId)) {
        res.status(400).json({
          success: false,
          message: "Invalid driver ID.",
        });
        return;
      }

      const driver = await User.findOneAndDelete({
        _id: req.params.driverId,
        role: "driver",
      });

      if (!driver) {
        res.status(404).json({
          success: false,
          message: "Driver not found.",
        });
        return;
      }

      res.json({
        success: true,
        message: "Driver account deleted successfully.",
      });
    } catch (error) {
      sendServerError(res, error, "Unable to delete driver.");
    }
  },
);

/* -------------------------------------------------------
   ACTIVE TRIPS MONITOR
------------------------------------------------------- */

// GET /api/admin/trips/active
router.get(
  "/trips/active",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const activeTrips = await Trip.find({ status: "active" })
        .populate("busId", "busNumber registrationNumber capacity")
        .populate("driverId", "collegeId name")
        .populate({
          path: "routeId",
          select: "name code stops",
          populate: {
            path: "stops.stopId",
            select: "name latitude longitude",
          },
        })
        .sort({ startedAt: -1 })
        .lean();

      res.json({
        success: true,
        count: activeTrips.length,
        data: activeTrips,
      });
    } catch (error) {
      sendServerError(res, error, "Unable to fetch active trips.");
    }
  },
);

export default router;
