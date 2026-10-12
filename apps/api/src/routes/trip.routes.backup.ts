
import { Router, Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { Server as SocketServer } from "socket.io";

import Trip from "../models/Trip";
import Bus from "../models/Bus";
import User from "../models/User";
import RouteModel from "../models/Route";

const router = Router();

/**
 * DEVELOPMENT ONLY
 * Replace this with JWT authentication before production.
 */
function requireDevelopmentDriver(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (process.env.NODE_ENV === "production") {
    res.status(501).json({
      success: false,
      message: "JWT driver authentication must be implemented first."
    });
    return;
  }

  if (req.header("x-dev-role") !== "driver") {
    res.status(403).json({
      success: false,
      message: "Development driver role required."
    });
    return;
  }

  next();
}

function validId(value: unknown): value is string {
  return typeof value === "string" && mongoose.isValidObjectId(value);
}

function isValidCoordinate(
  latitude: unknown,
  longitude: unknown
): boolean {
  return (
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    typeof longitude === "number" &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function isValidOptionalNumber(
  value: unknown,
  minimum: number,
  maximum?: number
): boolean {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return false;
  }

  return value >= minimum && (maximum === undefined || value <= maximum);
}

/* =========================================================
   START TRIP
   POST /api/trips/start
   Body: { "driverId": "...", "busId": "..." }
   ========================================================= */

router.post(
  "/start",
  requireDevelopmentDriver,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { driverId, busId } = req.body;

      if (!validId(driverId) || !validId(busId)) {
        res.status(400).json({
          success: false,
          message: "Valid driverId and busId are required."
        });
        return;
      }

      const [driver, bus] = await Promise.all([
        User.findById(driverId).select("collegeId name role active"),
        Bus.findById(busId)
      ]);

      if (!driver || driver.role !== "driver" || !driver.active) {
        res.status(403).json({
          success: false,
          message: "Driver account is invalid or inactive."
        });
        return;
      }

      if (!bus || !bus.active) {
        res.status(404).json({
          success: false,
          message: "Bus not found or inactive."
        });
        return;
      }

      if (
        !bus.assignedDriverId ||
        bus.assignedDriverId.toString() !== driver._id.toString()
      ) {
        res.status(403).json({
          success: false,
          message: "This driver is not assigned to the selected bus."
        });
        return;
      }

      if (!bus.assignedRouteId) {
        res.status(400).json({
          success: false,
          message: "Assign a route to the bus before starting a trip."
        });
        return;
      }

      const route = await RouteModel.findById(bus.assignedRouteId);

      if (!route || !route.active || route.stops.length === 0) {
        res.status(400).json({
          success: false,
          message: "The assigned route is invalid or has no stops."
        });
        return;
      }

      const existingTrip = await Trip.findOne({
        busId: bus._id,
        status: "active"
      });

      if (existingTrip) {
        res.status(409).json({
          success: false,
          message: "This bus already has an active trip."
        });
        return;
      }

      const trip = await Trip.create({
        busId: bus._id,
        driverId: driver._id,
        routeId: route._id,
        status: "active",
        startedAt: new Date(),
        lastSequence: 0
      });

      res.status(201).json({
        success: true,
        message: "Trip started successfully.",
        data: {
          tripId: trip._id,
          busId: trip.busId,
          driverId: trip.driverId,
          routeId: trip.routeId,
          status: trip.status,
          startedAt: trip.startedAt
        }
      });
    } catch (error) {
      console.error("Start trip failed:", error);

      res.status(500).json({
        success: false,
        message: "Unable to start trip."
      });
    }
  }
);

/* =========================================================
   UPDATE GPS LOCATION
   POST /api/trips/:tripId/location

   Body:
   {
     "driverId": "...",
     "latitude": 13.143,
     "longitude": 79.908,
     "accuracy": 10,
     "heading": 90,
     "speed": 8,
     "recordedAt": "2026-10-11T10:20:00.000Z"
   }
   ========================================================= */

router.post(
  "/:tripId/location",
  requireDevelopmentDriver,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tripId } = req.params;
      const {
        driverId,
        latitude,
        longitude,
        accuracy,
        heading,
        speed,
        recordedAt
      } = req.body;

      if (!validId(tripId) || !validId(driverId)) {
        res.status(400).json({
          success: false,
          message: "Valid tripId and driverId are required."
        });
        return;
      }

      if (!isValidCoordinate(latitude, longitude)) {
        res.status(400).json({
          success: false,
          message: "Valid numeric latitude and longitude are required."
        });
        return;
      }

      if (
        (accuracy !== undefined &&
          !isValidOptionalNumber(accuracy, 0)) ||
        (heading !== undefined &&
          !isValidOptionalNumber(heading, 0, 360)) ||
        (speed !== undefined &&
          !isValidOptionalNumber(speed, 0))
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid GPS accuracy, heading or speed."
        });
        return;
      }

      let timestamp = new Date();

      if (recordedAt !== undefined) {
        if (typeof recordedAt !== "string") {
          res.status(400).json({
            success: false,
            message: "recordedAt must be an ISO date string."
          });
          return;
        }

        timestamp = new Date(recordedAt);
      }

      const now = Date.now();

      if (
        !Number.isFinite(timestamp.getTime()) ||
        timestamp.getTime() > now + 60_000 ||
        timestamp.getTime() < now - 5 * 60_000
      ) {
        res.status(400).json({
          success: false,
          message: "GPS timestamp must be valid and recent."
        });
        return;
      }

      const trip = await Trip.findById(tripId);

      if (!trip || trip.status !== "active") {
        res.status(404).json({
          success: false,
          message: "Active trip not found."
        });
        return;
      }

      if (trip.driverId.toString() !== driverId) {
        res.status(403).json({
          success: false,
          message: "This trip belongs to another driver."
        });
        return;
      }

      const driver = await User.findById(driverId).select(
        "role active"
      );

      if (!driver || driver.role !== "driver" || !driver.active) {
        res.status(403).json({
          success: false,
          message: "Driver account is invalid or inactive."
        });
        return;
      }

      if (
        trip.lastLocationAt &&
        timestamp.getTime() < trip.lastLocationAt.getTime()
      ) {
        res.status(409).json({
          success: false,
          message: "An older GPS location cannot replace a newer location."
        });
        return;
      }

      const bus = await Bus.findById(trip.busId).select(
        "assignedDriverId active"
      );

      if (
        !bus ||
        !bus.active ||
        !bus.assignedDriverId ||
        bus.assignedDriverId.toString() !== driverId
      ) {
        res.status(403).json({
          success: false,
          message: "Driver is no longer assigned to this active bus."
        });
        return;
      }

      trip.currentLocation = {
        latitude,
        longitude,
        ...(accuracy !== undefined ? { accuracy } : {}),
        ...(heading !== undefined ? { heading } : {}),
        ...(speed !== undefined ? { speed } : {}),
        recordedAt: timestamp
      };

      trip.lastLocationAt = timestamp;

      await trip.save();

      const io = req.app.get("io") as SocketServer | undefined;

      const locationUpdate = {
        tripId: trip._id.toString(),
        busId: trip.busId.toString(),
        routeId: trip.routeId.toString(),
        latitude,
        longitude,
        ...(accuracy !== undefined ? { accuracy } : {}),
        ...(heading !== undefined ? { heading } : {}),
        ...(speed !== undefined ? { speed } : {}),
        recordedAt: timestamp.toISOString()
      };

      io?.to(`trip:${trip._id.toString()}`).emit(
        "bus:location",
        locationUpdate
      );

      io?.to(`bus:${trip.busId.toString()}`).emit(
        "bus:location",
        locationUpdate
      );

      res.status(200).json({
        success: true,
        message: "GPS location updated successfully.",
        data: locationUpdate
      });
    } catch (error) {
      console.error("GPS update failed:", error);

      res.status(500).json({
        success: false,
        message: "Unable to update GPS location."
      });
    }
  }
);

/* =========================================================
   GET ACTIVE TRIP FOR A BUS
   GET /api/trips/bus/:busId/active
   ========================================================= */

router.get(
  "/bus/:busId/active",
  requireDevelopmentDriver,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { busId } = req.params;

      if (!validId(busId)) {
        res.status(400).json({
          success: false,
          message: "A valid busId is required."
        });
        return;
      }

      const trip = await Trip.findOne({
        busId,
        status: "active"
      })
        .populate("busId", "busNumber registrationNumber")
        .populate("driverId", "collegeId name")
        .populate("routeId", "name code stops");

      if (!trip) {
        res.status(404).json({
          success: false,
          message: "No active trip exists for this bus."
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: trip
      });
    } catch (error) {
      console.error("Fetch active trip failed:", error);

      res.status(500).json({
        success: false,
        message: "Unable to fetch active trip."
      });
    }
  }
);

/* =========================================================
   END TRIP
   POST /api/trips/:tripId/end
   Body: { "driverId": "..." }
   ========================================================= */

router.post(
  "/:tripId/end",
  requireDevelopmentDriver,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { tripId } = req.params;
      const { driverId } = req.body;

      if (!validId(tripId) || !validId(driverId)) {
        res.status(400).json({
          success: false,
          message: "Valid tripId and driverId are required."
        });
        return;
      }

      const trip = await Trip.findById(tripId);

      if (!trip) {
        res.status(404).json({
          success: false,
          message: "Trip not found."
        });
        return;
      }

      if (trip.driverId.toString() !== driverId) {
        res.status(403).json({
          success: false,
          message: "This trip belongs to another driver."
        });
        return;
      }

      if (trip.status !== "active") {
        res.status(409).json({
          success: false,
          message: "Trip is not active."
        });
        return;
      }

      trip.status = "completed";
      trip.endedAt = new Date();

      await trip.save();

      const io = req.app.get("io") as SocketServer | undefined;

      const endedEvent = {
        tripId: trip._id.toString(),
        busId: trip.busId.toString(),
        status: trip.status,
        endedAt: trip.endedAt.toISOString()
      };

      io?.to(`trip:${trip._id.toString()}`).emit(
        "trip:ended",
        endedEvent
      );

      io?.to(`bus:${trip.busId.toString()}`).emit(
        "trip:ended",
        endedEvent
      );

      res.status(200).json({
        success: true,
        message: "Trip ended successfully.",
        data: trip
      });
    } catch (error) {
      console.error("End trip failed:", error);

      res.status(500).json({
        success: false,
        message: "Unable to end trip."
      });
    }
  }
);

export default router;
