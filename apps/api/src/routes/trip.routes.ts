import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";
import { Server as SocketServer } from "socket.io";

import Trip from "../models/Trip";
import Bus from "../models/Bus";
import User from "../models/User";
import RouteModel from "../models/Route";

import {
  authenticateToken,
  authorizeRoles,
  type AuthenticatedRequest,
} from "../middleware/auth";

const router = Router();

function validId(value: unknown): value is string {
  return typeof value === "string" && mongoose.isValidObjectId(value);
}

function isValidCoordinate(
  latitude: unknown,
  longitude: unknown,
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
  maximum?: number,
): boolean {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return false;
  }

  return (
    value >= minimum &&
    (maximum === undefined || value <= maximum)
  );
}

function getDriverId(req: AuthenticatedRequest): string | null {
  const id = req.authUser?.id;
  return id && mongoose.isValidObjectId(id) ? id : null;
}

function serverError(
  res: Response,
  message: string,
  error: unknown,
): void {
  console.error(message, error);
  res.status(500).json({
    success: false,
    message,
  });
}

/* =========================================================
   PUBLIC / STUDENT READ-ONLY TRACKING ENDPOINTS
   ========================================================= */

/**
 * GET /api/trips/buses
 * Read-only list of active buses with route and trip status.
 * Exposes only public safe info (no private driver or student info).
 */
router.get("/buses", async (_req: Request, res: Response): Promise<void> => {
  try {
    const buses = await Bus.find({ active: true })
      .populate("assignedDriverId", "name")
      .populate("assignedRouteId", "name code stops")
      .sort({ busNumber: 1 })
      .lean();

    const busIds = buses.map((b) => b._id);
    const activeTrips = await Trip.find({
      busId: { $in: busIds },
      status: "active",
    }).lean();

    const activeTripByBus = new Map<string, any>();
    for (const trip of activeTrips) {
      activeTripByBus.set(trip.busId.toString(), trip);
    }

    const data = buses.map((bus) => {
      const activeTrip = activeTripByBus.get(bus._id.toString());
      const driver = bus.assignedDriverId as any;
      const route = bus.assignedRouteId as any;

      return {
        id: bus._id.toString(),
        busNumber: bus.busNumber,
        registrationNumber: bus.registrationNumber,
        capacity: bus.capacity,
        assignedDriverName: driver?.name ?? "Unassigned",
        assignedRoute: route
          ? {
              id: route._id.toString(),
              name: route.name,
              code: route.code,
              stopCount: Array.isArray(route.stops) ? route.stops.length : 0,
            }
          : null,
        activeTrip: activeTrip
          ? {
              id: activeTrip._id.toString(),
              status: activeTrip.status,
              startedAt: activeTrip.startedAt,
              currentLocation: activeTrip.currentLocation,
              lastLocationAt: activeTrip.lastLocationAt,
            }
          : null,
      };
    });

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    serverError(res, "Unable to fetch buses.", error);
  }
});

/**
 * GET /api/trips/active
 * Read-only list of all currently active trips across the fleet.
 */
router.get("/active", async (_req: Request, res: Response): Promise<void> => {
  try {
    const activeTrips = await Trip.find({ status: "active" })
      .populate("busId", "busNumber registrationNumber capacity")
      .populate("driverId", "name")
      .populate({
        path: "routeId",
        select: "name code stops geometry",
        populate: {
          path: "stops.stopId",
          select: "name latitude longitude",
        },
      })
      .sort({ startedAt: -1 })
      .lean();

    const data = activeTrips.map((t) => {
      const bus = t.busId as any;
      const driver = t.driverId as any;
      const route = t.routeId as any;

      return {
        id: t._id.toString(),
        status: t.status,
        startedAt: t.startedAt,
        lastLocationAt: t.lastLocationAt,
        currentLocation: t.currentLocation,
        bus: bus
          ? {
              id: bus._id.toString(),
              busNumber: bus.busNumber,
              registrationNumber: bus.registrationNumber,
              capacity: bus.capacity,
            }
          : null,
        driverName: driver?.name ?? "Assigned Driver",
        route: route
          ? {
              id: route._id.toString(),
              name: route.name,
              code: route.code,
              stops: Array.isArray(route.stops)
                ? route.stops.map((s: any) => ({
                    sequence: s.sequence,
                    name: s.stopId?.name ?? "Stop",
                    latitude: s.stopId?.latitude,
                    longitude: s.stopId?.longitude,
                  }))
                : [],
              geometry: route.geometry ?? [],
            }
          : null,
      };
    });

    res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    serverError(res, "Unable to fetch active trips.", error);
  }
});

/**
 * GET /api/trips/routes
 * Read-only list of all active routes with stops for student exploration.
 */
router.get("/routes", async (_req: Request, res: Response): Promise<void> => {
  try {
    const routes = await RouteModel.find({ active: true })
      .populate("stops.stopId", "name latitude longitude active")
      .sort({ name: 1 })
      .lean();

    const data = routes.map((r) => ({
      id: r._id.toString(),
      name: r.name,
      code: r.code,
      stops: Array.isArray(r.stops)
        ? r.stops.map((s: any) => ({
            sequence: s.sequence,
            id: s.stopId?._id?.toString(),
            name: s.stopId?.name ?? "Stop",
            latitude: s.stopId?.latitude,
            longitude: s.stopId?.longitude,
          }))
        : [],
      geometry: r.geometry ?? [],
    }));

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    serverError(res, "Unable to fetch routes.", error);
  }
});

/**
 * GET /api/trips/bus/:busId/tracking
 * Read-only tracking information for a specific bus.
 * Exposes only public safe info (bus details, route, active trip GPS, public driver name).
 */
router.get("/bus/:busId/tracking", async (req: Request, res: Response): Promise<void> => {
  try {
    const { busId } = req.params;

    if (!validId(busId)) {
      res.status(400).json({
        success: false,
        message: "A valid busId is required.",
      });
      return;
    }

    const bus = await Bus.findById(busId)
      .populate("assignedDriverId", "name")
      .populate({
        path: "assignedRouteId",
        populate: {
          path: "stops.stopId",
          select: "name latitude longitude",
        },
      })
      .lean();

    if (!bus || !bus.active) {
      res.status(404).json({
        success: false,
        message: "Bus not found or inactive.",
      });
      return;
    }

    // Check for an active trip
    let trip = await Trip.findOne({
      busId: bus._id,
      status: "active",
    }).lean();

    // If no active trip, check for last completed trip for fallback coordinate
    let lastCompletedTrip = null;
    if (!trip) {
      lastCompletedTrip = await Trip.findOne({
        busId: bus._id,
        status: "completed",
      })
        .sort({ endedAt: -1 })
        .lean();
    }

    const driver = bus.assignedDriverId as any;
    const route = bus.assignedRouteId as any;

    const formattedStops = route && Array.isArray(route.stops)
      ? route.stops
          .filter((s: any) => s.stopId)
          .sort((a: any, b: any) => (a.sequence || 0) - (b.sequence || 0))
          .map((s: any) => ({
            id: s.stopId._id?.toString(),
            name: s.stopId.name,
            latitude: s.stopId.latitude,
            longitude: s.stopId.longitude,
            sequence: s.sequence,
          }))
      : [];

    const currentLocation = trip?.currentLocation ?? lastCompletedTrip?.currentLocation ?? null;
    const lastLocationAt = trip?.lastLocationAt ?? lastCompletedTrip?.lastLocationAt ?? null;

    let isLive = false;
    let locationAgeMs: number | null = null;
    if (trip && currentLocation?.recordedAt) {
      const recTime = new Date(currentLocation.recordedAt).getTime();
      if (!Number.isNaN(recTime)) {
        locationAgeMs = Math.max(0, Date.now() - recTime);
        isLive = locationAgeMs <= 180_000; // 3 minutes fresh threshold
      }
    }

    res.status(200).json({
      success: true,
      data: {
        bus: {
          id: bus._id.toString(),
          busNumber: bus.busNumber,
          registrationNumber: bus.registrationNumber,
          capacity: bus.capacity,
          active: bus.active,
        },
        driverName: driver?.name ?? "Assigned Driver",
        route: route
          ? {
              id: route._id.toString(),
              name: route.name,
              code: route.code,
              stops: formattedStops,
              geometry: route.geometry ?? [],
            }
          : null,
        trip: trip
          ? {
              id: trip._id.toString(),
              status: trip.status,
              startedAt: trip.startedAt,
              currentLocation,
              lastLocationAt,
            }
          : null,
        isLive,
        locationAgeMs,
      },
    });
  } catch (error) {
    serverError(res, "Unable to fetch tracking data.", error);
  }
});

/**
 * Backward compatibility: GET /api/trips/bus/:busId/active
 * If driver token is provided and driver is assigned, returns full active trip.
 * Also supports students/public by returning safe tracking trip data.
 */
router.get("/bus/:busId/active", async (req: Request, res: Response): Promise<void> => {
  try {
    const { busId } = req.params;

    if (!validId(busId)) {
      res.status(400).json({
        success: false,
        message: "A valid busId is required.",
      });
      return;
    }

    const trip = await Trip.findOne({
      busId,
      status: "active",
    })
      .populate("busId", "busNumber registrationNumber capacity")
      .populate("driverId", "name collegeId")
      .populate({
        path: "routeId",
        select: "name code stops geometry",
        populate: {
          path: "stops.stopId",
          select: "name latitude longitude",
        },
      })
      .lean();

    if (!trip) {
      res.status(404).json({
        success: false,
        message: "No active trip exists for this bus.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: trip,
    });
  } catch (error) {
    serverError(res, "Unable to fetch active trip.", error);
  }
});

/* =========================================================
   DRIVER AUTHENTICATED ENDPOINTS
   ========================================================= */

/**
 * GET /api/trips/driver/assigned
 * Returns the logged-in driver's assigned bus and route.
 */
router.get(
  "/driver/assigned",
  authenticateToken,
  authorizeRoles("driver"),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const driverId = getDriverId(req);
      if (!driverId) {
        res.status(401).json({ success: false, message: "Driver authentication required." });
        return;
      }

      const bus = await Bus.findOne({ assignedDriverId: driverId, active: true })
        .populate({
          path: "assignedRouteId",
          populate: {
            path: "stops.stopId",
            select: "name latitude longitude",
          },
        })
        .lean();

      if (!bus) {
        res.status(200).json({
          success: true,
          data: null,
          message: "No bus currently assigned to this driver.",
        });
        return;
      }

      const route = bus.assignedRouteId as any;
      const formattedStops = route && Array.isArray(route.stops)
        ? route.stops
            .filter((s: any) => s.stopId)
            .sort((a: any, b: any) => (a.sequence || 0) - (b.sequence || 0))
            .map((s: any) => ({
              id: s.stopId._id?.toString(),
              name: s.stopId.name,
              latitude: s.stopId.latitude,
              longitude: s.stopId.longitude,
              sequence: s.sequence,
            }))
        : [];

      res.status(200).json({
        success: true,
        data: {
          bus: {
            id: bus._id.toString(),
            busNumber: bus.busNumber,
            registrationNumber: bus.registrationNumber,
            capacity: bus.capacity,
          },
          route: route
            ? {
                id: route._id.toString(),
                name: route.name,
                code: route.code,
                stops: formattedStops,
                geometry: route.geometry ?? [],
              }
            : null,
          assignedRoute: route
            ? {
                id: route._id.toString(),
                name: route.name,
                code: route.code,
                stops: formattedStops,
                geometry: route.geometry ?? [],
              }
            : null,
        },
      });
    } catch (error) {
      serverError(res, "Unable to fetch assigned bus.", error);
    }
  },
);

/**
 * GET /api/trips/driver/active
 * Returns the currently active trip for the logged-in driver.
 */
router.get(
  "/driver/active",
  authenticateToken,
  authorizeRoles("driver"),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const driverId = getDriverId(req);
      if (!driverId) {
        res.status(401).json({ success: false, message: "Driver authentication required." });
        return;
      }

      const trip = await Trip.findOne({
        driverId,
        status: "active",
      })
        .populate("busId", "busNumber registrationNumber capacity")
        .populate({
          path: "routeId",
          populate: {
            path: "stops.stopId",
            select: "name latitude longitude",
          },
        })
        .lean();

      if (trip && trip.routeId && Array.isArray((trip.routeId as any).stops)) {
        (trip.routeId as any).stops.sort((a: any, b: any) => (a.sequence || 0) - (b.sequence || 0));
      }

      res.status(200).json({
        success: true,
        data: trip,
      });
    } catch (error) {
      serverError(res, "Unable to fetch driver active trip.", error);
    }
  },
);

/* =========================================================
   START TRIP
   POST /api/trips/start
   ========================================================= */

router.post(
  "/start",
  authenticateToken,
  authorizeRoles("driver"),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const driverId = getDriverId(req);
      const { busId } = req.body ?? {};

      if (!driverId) {
        res.status(401).json({
          success: false,
          message: "Driver authentication required.",
        });
        return;
      }

      if (!validId(busId)) {
        res.status(400).json({
          success: false,
          message: "A valid busId is required.",
        });
        return;
      }

      const [driver, bus] = await Promise.all([
        User.findById(driverId).select("collegeId name role active"),
        Bus.findById(busId),
      ]);

      if (!driver || driver.role !== "driver" || !driver.active) {
        res.status(403).json({
          success: false,
          message: "Driver account is invalid or inactive.",
        });
        return;
      }

      if (!bus || !bus.active) {
        res.status(404).json({
          success: false,
          message: "Bus not found or inactive.",
        });
        return;
      }

      if (
        !bus.assignedDriverId ||
        bus.assignedDriverId.toString() !== driverId
      ) {
        res.status(403).json({
          success: false,
          message: "You are not assigned to this bus.",
        });
        return;
      }

      if (!bus.assignedRouteId) {
        res.status(400).json({
          success: false,
          message: "Assign a route to the bus before starting a trip.",
        });
        return;
      }

      const route = await RouteModel.findById(bus.assignedRouteId);

      if (
        !route ||
        !route.active ||
        !route.stops ||
        route.stops.length === 0
      ) {
        res.status(400).json({
          success: false,
          message: "The assigned route is invalid or has no stops.",
        });
        return;
      }

      // Check if this bus already has an active trip
      const existingBusTrip = await Trip.findOne({
        busId: bus._id,
        status: "active",
      });

      if (existingBusTrip) {
        res.status(409).json({
          success: false,
          message: "This bus already has an active trip.",
        });
        return;
      }

      // Check if this driver already has another active trip
      const existingDriverTrip = await Trip.findOne({
        driverId: driver._id,
        status: "active",
      });

      if (existingDriverTrip) {
        res.status(409).json({
          success: false,
          message: "You already have an active trip in progress.",
        });
        return;
      }

      const trip = await Trip.create({
        busId: bus._id,
        driverId: driver._id,
        routeId: route._id,
        status: "active",
        startedAt: new Date(),
        lastSequence: 0,
      });

      const io = req.app.get("io") as SocketServer | undefined;
      const startedEvent = {
        tripId: trip._id.toString(),
        busId: trip.busId.toString(),
        busNumber: bus.busNumber,
        driverId: trip.driverId.toString(),
        driverName: driver.name,
        routeId: trip.routeId.toString(),
        routeName: route.name,
        routeCode: route.code,
        status: trip.status,
        startedAt: (trip.startedAt || new Date()).toISOString(),
      };

      io?.to(`bus:${trip.busId.toString()}`).emit("trip:started", startedEvent);
      io?.emit("trip:started", startedEvent);

      res.status(201).json({
        success: true,
        message: "Trip started successfully.",
        data: startedEvent,
      });
    } catch (error) {
      if ((error as { code?: number })?.code === 11000) {
        res.status(409).json({
          success: false,
          message: "An active trip is already recorded for this bus or driver.",
        });
        return;
      }
      serverError(res, "Unable to start trip.", error);
    }
  },
);

/* =========================================================
   UPDATE GPS LOCATION
   POST /api/trips/:tripId/location
   ========================================================= */

router.post(
  "/:tripId/location",
  authenticateToken,
  authorizeRoles("driver"),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const driverId = getDriverId(req);
      const { tripId } = req.params;

      const {
        latitude,
        longitude,
        accuracy,
        heading,
        speed,
        recordedAt,
      } = req.body ?? {};

      if (!driverId) {
        res.status(401).json({
          success: false,
          message: "Driver authentication required.",
        });
        return;
      }

      if (!validId(tripId)) {
        res.status(400).json({
          success: false,
          message: "A valid tripId is required.",
        });
        return;
      }

      if (!isValidCoordinate(latitude, longitude)) {
        res.status(400).json({
          success: false,
          message: "Valid numeric latitude and longitude are required.",
        });
        return;
      }

      if (
        (accuracy !== undefined && !isValidOptionalNumber(accuracy, 0)) ||
        (heading !== undefined && !isValidOptionalNumber(heading, 0, 360)) ||
        (speed !== undefined && !isValidOptionalNumber(speed, 0))
      ) {
        res.status(400).json({
          success: false,
          message: "Invalid GPS accuracy, heading or speed.",
        });
        return;
      }

      let timestamp = new Date();

      if (recordedAt !== undefined) {
        if (typeof recordedAt !== "string") {
          res.status(400).json({
            success: false,
            message: "recordedAt must be an ISO date string.",
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
          message: "GPS timestamp must be valid and recent (within last 5 minutes).",
        });
        return;
      }

      const trip = await Trip.findById(tripId);

      if (!trip || trip.status !== "active") {
        res.status(404).json({
          success: false,
          message: "Active trip not found.",
        });
        return;
      }

      if (trip.driverId.toString() !== driverId) {
        res.status(403).json({
          success: false,
          message: "This trip belongs to another driver.",
        });
        return;
      }

      const driver = await User.findById(driverId).select("role active");

      if (!driver || driver.role !== "driver" || !driver.active) {
        res.status(403).json({
          success: false,
          message: "Driver account is invalid or inactive.",
        });
        return;
      }

      if (
        trip.lastLocationAt &&
        timestamp.getTime() < trip.lastLocationAt.getTime()
      ) {
        res.status(409).json({
          success: false,
          message: "An older GPS location cannot replace a newer location.",
        });
        return;
      }

      const bus = await Bus.findById(trip.busId).select(
        "assignedDriverId active busNumber",
      );

      if (
        !bus ||
        !bus.active ||
        !bus.assignedDriverId ||
        bus.assignedDriverId.toString() !== driverId
      ) {
        res.status(403).json({
          success: false,
          message: "Driver is no longer assigned to this active bus.",
        });
        return;
      }

      trip.currentLocation = {
        latitude,
        longitude,
        ...(accuracy !== undefined ? { accuracy } : {}),
        ...(heading !== undefined ? { heading } : {}),
        ...(speed !== undefined ? { speed } : {}),
        recordedAt: timestamp,
      };

      trip.lastLocationAt = timestamp;
      await trip.save();

      const io = req.app.get("io") as SocketServer | undefined;

      const locationUpdate = {
        tripId: trip._id.toString(),
        busId: trip.busId.toString(),
        busNumber: bus.busNumber,
        routeId: trip.routeId.toString(),
        latitude,
        longitude,
        ...(accuracy !== undefined ? { accuracy } : {}),
        ...(heading !== undefined ? { heading } : {}),
        ...(speed !== undefined ? { speed } : {}),
        recordedAt: timestamp.toISOString(),
      };

      // Emit to trip room, bus room, and broadcast to all connected clients
      io?.to(`trip:${trip._id.toString()}`).emit("bus:location", locationUpdate);
      io?.to(`bus:${trip.busId.toString()}`).emit("bus:location", locationUpdate);
      io?.emit("bus:location", locationUpdate);

      res.status(200).json({
        success: true,
        message: "GPS location updated successfully.",
        data: locationUpdate,
      });
    } catch (error) {
      serverError(res, "Unable to update GPS location.", error);
    }
  },
);

/* =========================================================
   END TRIP
   POST /api/trips/:tripId/end
   ========================================================= */

router.post(
  "/:tripId/end",
  authenticateToken,
  authorizeRoles("driver"),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const driverId = getDriverId(req);
      const { tripId } = req.params;

      if (!driverId) {
        res.status(401).json({
          success: false,
          message: "Driver authentication required.",
        });
        return;
      }

      if (!validId(tripId)) {
        res.status(400).json({
          success: false,
          message: "A valid tripId is required.",
        });
        return;
      }

      const trip = await Trip.findById(tripId);

      if (!trip) {
        res.status(404).json({
          success: false,
          message: "Trip not found.",
        });
        return;
      }

      if (trip.driverId.toString() !== driverId) {
        res.status(403).json({
          success: false,
          message: "This trip belongs to another driver.",
        });
        return;
      }

      if (trip.status !== "active") {
        res.status(409).json({
          success: false,
          message: "Trip is not active.",
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
        endedAt: (trip.endedAt || new Date()).toISOString(),
      };

      io?.to(`trip:${trip._id.toString()}`).emit("trip:ended", endedEvent);
      io?.to(`bus:${trip.busId.toString()}`).emit("trip:ended", endedEvent);
      io?.emit("trip:ended", endedEvent);

      res.status(200).json({
        success: true,
        message: "Trip ended successfully.",
        data: trip,
      });
    } catch (error) {
      serverError(res, "Unable to end trip.", error);
    }
  },
);

/* =========================================================
   TRIP HISTORY (Driver / Admin)
   GET /api/trips/history
   ========================================================= */

router.get(
  "/history",
  authenticateToken,
  authorizeRoles("driver", "admin"),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
      const skip = (page - 1) * limit;

      const filter: Record<string, any> = {};

      // If driver, only show their own trips
      if (req.authUser?.role === "driver") {
        filter.driverId = req.authUser.id;
      } else if (req.query.busId && validId(req.query.busId)) {
        filter.busId = req.query.busId;
      }

      const [trips, total] = await Promise.all([
        Trip.find(filter)
          .populate("busId", "busNumber registrationNumber")
          .populate("driverId", "name collegeId")
          .populate("routeId", "name code")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Trip.countDocuments(filter),
      ]);

      res.status(200).json({
        success: true,
        data: trips,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      serverError(res, "Unable to fetch trip history.", error);
    }
  },
);

export default router;
