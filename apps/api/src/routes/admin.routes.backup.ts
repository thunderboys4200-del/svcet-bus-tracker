
import { Router, Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import bcrypt from "bcrypt";

import Bus from "../models/Bus";
import Stop from "../models/Stop";
import RouteModel from "../models/Route";
import User from "../models/User";

const router = Router();

/**
 * TEMPORARY DEVELOPMENT AUTHORIZATION
 *
 * This header is not secure authentication.
 * Production requests are blocked until real JWT authorization
 * middleware is implemented.
 */
function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (process.env.NODE_ENV === "production") {
    res.status(501).json({
      success: false,
      message: "JWT-based admin authentication is not implemented yet."
    });
    return;
  }

  if (req.header("x-dev-role") !== "admin") {
    res.status(403).json({
      success: false,
      message: "Development admin role required."
    });
    return;
  }

  next();
}

/** Validate MongoDB ObjectIds. */
function isValidId(value: unknown): value is string {
  return typeof value === "string" && mongoose.isValidObjectId(value);
}

/** Validate latitude and longitude. */
function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/** Standard MongoDB duplicate-key error check. */
function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

/** Standard Mongoose validation error check. */
function isValidationError(error: unknown): boolean {
  return error instanceof mongoose.Error.ValidationError;
}

/* =========================================================
   BUS MANAGEMENT
   ========================================================= */

/**
 * POST /api/admin/buses
 * Create a bus.
 */
router.post(
  "/buses",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { busNumber, registrationNumber, capacity } = req.body;

      if (
        typeof busNumber !== "string" ||
        !busNumber.trim() ||
        typeof registrationNumber !== "string" ||
        !registrationNumber.trim()
      ) {
        res.status(400).json({
          success: false,
          message: "Bus number and registration number are required."
        });
        return;
      }

      if (
        capacity !== undefined &&
        (!Number.isInteger(capacity) || capacity < 1)
      ) {
        res.status(400).json({
          success: false,
          message: "Capacity must be a positive integer."
        });
        return;
      }

      const bus = await Bus.create({
        busNumber: busNumber.trim().toUpperCase(),
        registrationNumber: registrationNumber.trim().toUpperCase(),
        ...(capacity !== undefined ? { capacity } : {})
      });

      res.status(201).json({
        success: true,
        message: "Bus created successfully.",
        data: bus
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        res.status(409).json({
          success: false,
          message: "Bus number or registration number already exists."
        });
        return;
      }

      if (isValidationError(error)) {
        res.status(400).json({
          success: false,
          message: "Invalid bus data."
        });
        return;
      }

      console.error("Create bus failed:", error);
      res.status(500).json({
        success: false,
        message: "Unable to create bus."
      });
    }
  }
);

/**
 * GET /api/admin/buses
 * List buses.
 */
router.get(
  "/buses",
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const buses = await Bus.find()
        .sort({ busNumber: 1 })
        .lean();

      res.status(200).json({
        success: true,
        data: buses
      });
    } catch (error) {
      console.error("List buses failed:", error);
      res.status(500).json({
        success: false,
        message: "Unable to fetch buses."
      });
    }
  }
);

/**
 * PATCH /api/admin/buses/:busId/assign
 * Assign an existing driver and route to a bus.
 *
 * Body:
 * {
 *   "driverId": "...",
 *   "routeId": "..."
 * }
 */
router.patch(
  "/buses/:busId/assign",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { busId } = req.params;
      const { driverId, routeId } = req.body;

      if (!isValidId(busId) || !isValidId(driverId) || !isValidId(routeId)) {
        res.status(400).json({
          success: false,
          message: "Valid busId, driverId and routeId are required."
        });
        return;
      }

      const [bus, driver, route] = await Promise.all([
        Bus.findById(busId),
        User.findById(driverId).select("collegeId name role active"),
        RouteModel.findById(routeId)
      ]);

      if (!bus || !bus.active) {
        res.status(404).json({
          success: false,
          message: "Bus not found or inactive."
        });
        return;
      }

      if (!driver || driver.role !== "driver" || !driver.active) {
        res.status(400).json({
          success: false,
          message: "Driver not found, inactive, or not a driver account."
        });
        return;
      }

      if (!route || !route.active) {
        res.status(400).json({
          success: false,
          message: "Route not found or inactive."
        });
        return;
      }

      bus.assignedDriverId = driver._id;
      bus.assignedRouteId = route._id;

      await bus.save();

      res.status(200).json({
        success: true,
        message: "Bus assigned to driver and route successfully.",
        data: {
          bus,
          driver: {
            id: driver._id,
            collegeId: driver.collegeId,
            name: driver.name,
            role: driver.role
          },
          route: {
            id: route._id,
            name: route.name,
            code: route.code
          }
        }
      });
    } catch (error) {
      if (isValidationError(error)) {
        res.status(400).json({
          success: false,
          message: "Invalid bus assignment."
        });
        return;
      }

      console.error("Assign bus failed:", error);
      res.status(500).json({
        success: false,
        message: "Unable to assign bus."
      });
    }
  }
);

/* =========================================================
   STOP MANAGEMENT
   ========================================================= */

/**
 * POST /api/admin/stops
 * Create a stop.
 */
router.post(
  "/stops",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, latitude, longitude } = req.body;

      if (
        typeof name !== "string" ||
        !name.trim() ||
        !isValidCoordinate(latitude, longitude)
      ) {
        res.status(400).json({
          success: false,
          message:
            "A stop name and valid numeric latitude/longitude are required."
        });
        return;
      }

      const stop = await Stop.create({
        name: name.trim(),
        latitude,
        longitude
      });

      res.status(201).json({
        success: true,
        message: "Stop created successfully.",
        data: stop
      });
    } catch (error) {
      if (isValidationError(error)) {
        res.status(400).json({
          success: false,
          message: "Invalid stop data."
        });
        return;
      }

      console.error("Create stop failed:", error);
      res.status(500).json({
        success: false,
        message: "Unable to create stop."
      });
    }
  }
);

/**
 * GET /api/admin/stops
 * List stops.
 */
router.get(
  "/stops",
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const stops = await Stop.find()
        .sort({ name: 1 })
        .lean();

      res.status(200).json({
        success: true,
        data: stops
      });
    } catch (error) {
      console.error("List stops failed:", error);
      res.status(500).json({
        success: false,
        message: "Unable to fetch stops."
      });
    }
  }
);

/* =========================================================
   ROUTE MANAGEMENT
   ========================================================= */

/**
 * POST /api/admin/routes
 * Create a route with ordered stop references.
 *
 * Geometry format: [[longitude, latitude], ...]
 */
router.post(
  "/routes",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, code, stops, geometry } = req.body;

      if (
        typeof name !== "string" ||
        !name.trim() ||
        typeof code !== "string" ||
        !code.trim() ||
        !Array.isArray(stops) ||
        stops.length === 0
      ) {
        res.status(400).json({
          success: false,
          message: "Route name, code and at least one stop are required."
        });
        return;
      }

      const normalizedStops: Array<{
        stopId: string;
        sequence: number;
      }> = [];

      for (const item of stops) {
        if (
          !item ||
          !isValidId(item.stopId) ||
          !Number.isInteger(item.sequence) ||
          item.sequence < 1
        ) {
          res.status(400).json({
            success: false,
            message: "Every stop needs a valid stopId and positive sequence."
          });
          return;
        }

        normalizedStops.push({
          stopId: item.stopId,
          sequence: item.sequence
        });
      }

      const sequences = normalizedStops.map((stop) => stop.sequence);
      const stopIds = normalizedStops.map((stop) => stop.stopId);

      if (
        new Set(sequences).size !== sequences.length ||
        new Set(stopIds).size !== stopIds.length
      ) {
        res.status(400).json({
          success: false,
          message: "Stop IDs and sequence numbers must be unique."
        });
        return;
      }

      // Validate optional route geometry.
      let normalizedGeometry: number[][] = [];

      if (geometry !== undefined) {
        if (
          !Array.isArray(geometry) ||
          !geometry.every(
            (point: unknown) =>
              Array.isArray(point) &&
              point.length === 2 &&
              isValidCoordinate(point[1], point[0])
          )
        ) {
          res.status(400).json({
            success: false,
            message:
              "Geometry must contain [longitude, latitude] coordinate pairs."
          });
          return;
        }

        normalizedGeometry = geometry as number[][];
      }

      const existingStopCount = await Stop.countDocuments({
        _id: { $in: stopIds },
        active: true
      });

      if (existingStopCount !== stopIds.length) {
        res.status(400).json({
          success: false,
          message: "One or more stops do not exist or are inactive."
        });
        return;
      }

      normalizedStops.sort((a, b) => a.sequence - b.sequence);

      const route = await RouteModel.create({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        stops: normalizedStops,
        geometry: normalizedGeometry
      });

      res.status(201).json({
        success: true,
        message: "Route created successfully.",
        data: route
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        res.status(409).json({
          success: false,
          message: "Route code already exists."
        });
        return;
      }

      if (isValidationError(error)) {
        res.status(400).json({
          success: false,
          message: "Invalid route data."
        });
        return;
      }

      console.error("Create route failed:", error);
      res.status(500).json({
        success: false,
        message: "Unable to create route."
      });
    }
  }
);

/**
 * GET /api/admin/routes
 * List routes with populated stop details.
 */
router.get(
  "/routes",
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const routes = await RouteModel.find()
        .populate("stops.stopId", "name latitude longitude active")
        .sort({ name: 1 })
        .lean();

      res.status(200).json({
        success: true,
        data: routes
      });
    } catch (error) {
      console.error("List routes failed:", error);
      res.status(500).json({
        success: false,
        message: "Unable to fetch routes."
      });
    }
  }
);

/* =========================================================
   DRIVER MANAGEMENT
   ========================================================= */

/**
 * POST /api/admin/drivers
 * Create a driver account.
 *
 * Body:
 * {
 *   "collegeId": "DRIVER001",
 *   "name": "Test Driver",
 *   "password": "Use-A-Unique-Password"
 * }
 */
router.post(
  "/drivers",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { collegeId, name, password } = req.body;

      if (
        typeof collegeId !== "string" ||
        !collegeId.trim() ||
        typeof name !== "string" ||
        !name.trim() ||
        typeof password !== "string"
      ) {
        res.status(400).json({
          success: false,
          message: "College ID, name and password are required."
        });
        return;
      }

      if (
        password.length < 8 ||
        Buffer.byteLength(password, "utf8") > 72
      ) {
        res.status(400).json({
          success: false,
          message:
            "Password must be at least 8 characters and no more than 72 UTF-8 bytes."
        });
        return;
      }

      const normalizedCollegeId = collegeId.trim().toUpperCase();

      const existingUser = await User.findOne({
        collegeId: normalizedCollegeId
      }).select("_id");

      if (existingUser) {
        res.status(409).json({
          success: false,
          message: "This college ID is already registered."
        });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const driver = await User.create({
        collegeId: normalizedCollegeId,
        name: name.trim(),
        passwordHash,
        role: "driver",
        active: true
      });

      res.status(201).json({
        success: true,
        message: "Driver account created successfully.",
        data: {
          id: driver._id,
          collegeId: driver.collegeId,
          name: driver.name,
          role: driver.role,
          active: driver.active
        }
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        res.status(409).json({
          success: false,
          message: "This college ID is already registered."
        });
        return;
      }

      if (isValidationError(error)) {
        res.status(400).json({
          success: false,
          message: "Invalid driver account data."
        });
        return;
      }

      console.error("Create driver failed:", error);
      res.status(500).json({
        success: false,
        message: "Unable to create driver account."
      });
    }
  }
);

/**
 * GET /api/admin/drivers
 * List driver accounts without password hashes.
 */
router.get(
  "/drivers",
  requireAdmin,
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const drivers = await User.find({ role: "driver" })
        .select("-passwordHash")
        .sort({ name: 1 })
        .lean();

      res.status(200).json({
        success: true,
        data: drivers
      });
    } catch (error) {
      console.error("List drivers failed:", error);
      res.status(500).json({
        success: false,
        message: "Unable to fetch drivers."
      });
    }
  }
);

export default router;
