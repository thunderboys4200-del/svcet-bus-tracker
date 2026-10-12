
import "dotenv/config";

import express, {
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import path from "node:path";
import fs from "node:fs";
import { createServer } from "node:http";
import { Server as SocketServer } from "socket.io";

import { connectDB } from "./config/db";
import adminRoutes from "./routes/admin.routes";
import tripRoutes from "./routes/trip.routes";
import authRoutes from "./routes/auth.routes";

const app = express();
const httpServer = createServer(app);

const PORT = Number(process.env.PORT) || 4000;

const allowedOrigins = (
  process.env.CORS_ORIGINS || "http://localhost:5173"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export function isOriginAllowed(origin?: string): boolean {
  if (!origin) return true;
  // Always permit in development or local full-stack execution
  if (process.env.NODE_ENV !== "production") return true;
  if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) return true;
  // Allow all localhost and 127.0.0.1 ports
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  // Allow private LAN IPv4 ranges (10.x.x.x, 192.168.x.x, 172.16-31.x.x)
  if (/^https?:\/\/(10|192\.168|172\.(1[6-9]|2[0-9]|3[0-1]))\.\d+\.\d+(:\d+)?$/.test(origin)) return true;
  // Allow Capacitor, Ionic and mobile app schemes
  if (/^(capacitor|ionic|https):\/\/localhost(:\d+)?$/.test(origin)) return true;
  // Allow cloud deployments (Render, Vercel, Netlify)
  if (/^https:\/\/([a-z0-9-]+)\.(onrender\.com|vercel\.app|netlify\.app)$/i.test(origin)) return true;
  return false;
}

/* =========================================================
   SECURITY AND MIDDLEWARE
   ========================================================= */

app.disable("x-powered-by");

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(
  cors({
    origin(origin, callback) {
      if (isOriginAllowed(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));

app.use(
  "/api",
  rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      success: false,
      message: "Too many requests. Please try again later.",
    },
  }),
);

/* =========================================================
   SOCKET.IO
   ========================================================= */

const io = new SocketServer(httpServer, {
  cors: {
    origin(origin, callback) {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Origin not allowed by CORS"));
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log(`Socket.IO client connected: ${socket.id}`);

  socket.on("join:bus", (busId: unknown) => {
    if (typeof busId === "string" && busId.trim()) {
      socket.join(`bus:${busId.trim()}`);
    }
  });

  socket.on("leave:bus", (busId: unknown) => {
    if (typeof busId === "string" && busId.trim()) {
      socket.leave(`bus:${busId.trim()}`);
    }
  });

  socket.on("join:trip", (tripId: unknown) => {
    if (typeof tripId === "string" && tripId.trim()) {
      socket.join(`trip:${tripId.trim()}`);
    }
  });

  socket.on("leave:trip", (tripId: unknown) => {
    if (typeof tripId === "string" && tripId.trim()) {
      socket.leave(`trip:${tripId.trim()}`);
    }
  });

  socket.on("disconnect", (reason) => {
    console.log(
      `Socket.IO client disconnected: ${socket.id} (${reason})`,
    );
  });
});

/* =========================================================
   BASIC AND HEALTH ENDPOINTS
   ========================================================= */

app.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    service: "SVCET Smart Bus Tracker API",
    message:
      "Welcome to the SVCET Smart College Bus Tracking System",
  });
});

app.get("/api/health", (_req: Request, res: Response) => {
  const databaseConnected = mongoose.connection.readyState === 1;

  res.status(databaseConnected ? 200 : 503).json({
    success: databaseConnected,
    service: "SVCET Smart Bus Tracker API",
    status: databaseConnected ? "running" : "database unavailable",
    database: databaseConnected ? "connected" : "disconnected",
    socketIO: "initialized",
    timestamp: new Date().toISOString(),
  });
});

/* =========================================================
   API ROUTES
   ========================================================= */

// Public login endpoint. Route-level authentication is added
// separately to admin and trip endpoints.
app.use("/api/auth", authRoutes);

// Existing application routes.
app.use("/api/admin", adminRoutes);
app.use("/api/trips", tripRoutes);

// Public APK download endpoint
app.get(["/download-apk", "/api/download-apk"], (_req: Request, res: Response) => {
  const possiblePaths = [
    path.resolve(process.cwd(), "svcet-bus-tracker-debug.apk"),
    path.resolve(process.cwd(), "../../svcet-bus-tracker-debug.apk"),
    path.resolve(__dirname, "../../../svcet-bus-tracker-debug.apk"),
    path.resolve(__dirname, "../../../apps/web/android/app/build/outputs/apk/debug/app-debug.apk"),
  ];
  const apkPath = possiblePaths.find((p) => fs.existsSync(p));
  if (apkPath) {
    res.setHeader("Content-Disposition", 'attachment; filename="svcet-bus-tracker.apk"');
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.sendFile(apkPath);
  } else {
    res.status(404).json({ success: false, message: "APK file not found on server." });
  }
});

/* =========================================================
   404 HANDLER
   ========================================================= */

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found",
    path: req.originalUrl,
  });
});

/* =========================================================
   CENTRAL ERROR HANDLER
   ========================================================= */

app.use(
  (
    error: Error,
    _req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    console.error("API error:", error.message);

    if (error.message === "Origin not allowed by CORS") {
      res.status(403).json({
        success: false,
        message: "Request origin is not allowed.",
      });
      return;
    }

    if (res.headersSent) {
      return;
    }

    res.status(500).json({
      success: false,
      message: "An unexpected server error occurred.",
    });
  },
);

/* =========================================================
   SERVER STARTUP
   ========================================================= */

async function startServer(): Promise<void> {
  try {
    await connectDB();

    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => {
        reject(error);
      };

      httpServer.once("error", onError);

      httpServer.listen(PORT, "0.0.0.0", () => {
        httpServer.removeListener("error", onError);
        resolve();
      });
    });

    console.log("========================================");
    console.log("SVCET SMART BUS TRACKER API");
    console.log("========================================");
    console.log(`API: http://localhost:${PORT}`);
    console.log(`Health: http://localhost:${PORT}/api/health`);
    console.log("MongoDB: connected");
    console.log("Socket.IO: initialized");
    console.log("Authentication routes: registered");
    console.log("Admin routes: registered");
    console.log("Trip routes: registered");
    console.log("========================================");
  } catch (error) {
    console.error("Server startup failed.");

    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(error);
    }

    process.exit(1);
  }
}

/* =========================================================
   GRACEFUL SHUTDOWN
   ========================================================= */

let isShuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`${signal} received. Shutting down server...`);

  const forceExit = setTimeout(() => {
    console.error("Graceful shutdown timed out.");
    process.exit(1);
  }, 10000);

  forceExit.unref();

  try {
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });

    io.close();

    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }

    clearTimeout(forceExit);
    console.log("Server shutdown complete.");
    process.exit(0);
  } catch (error) {
    clearTimeout(forceExit);
    console.error("Shutdown error:", error);
    process.exit(1);
  }
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

void startServer();

export { app, httpServer, io, startServer };
