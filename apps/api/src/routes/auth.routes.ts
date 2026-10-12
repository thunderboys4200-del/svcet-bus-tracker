import { Router, type Request, type Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import User from "../models/User";
import { authenticateToken, type AuthenticatedRequest } from "../middleware/auth";

const router = Router();

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters.");
  }
  return secret;
};

// Dedicated rate limiter for login attempts: max 20 requests per minute per IP
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login attempts. Please wait 60 seconds before trying again.",
  },
});

/**
 * POST /api/auth/login
 * Real authentication endpoint for Students, Drivers, and Administrators.
 * Accepts collegeId, username, or generic identifier.
 */
router.post("/login", loginLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const rawIdentifier =
      typeof req.body?.identifier === "string"
        ? req.body.identifier
        : typeof req.body?.collegeId === "string"
          ? req.body.collegeId
          : typeof req.body?.username === "string"
            ? req.body.username
            : "";

    const identifier = rawIdentifier.trim().toUpperCase();
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!identifier || !password) {
      res.status(400).json({
        success: false,
        message: "College ID or username and password are required.",
      });
      return;
    }

    if (
      identifier.length > 100 ||
      password.length > 72 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid input length.",
      });
      return;
    }

    // Look up by collegeId OR username (both stored normalized in uppercase)
    const user = await User.findOne({
      $or: [{ collegeId: identifier }, { username: identifier }],
    }).select("+passwordHash collegeId username name role active department year phone assignedBusId assignedRouteId");

    if (!user || !user.active) {
      res.status(401).json({
        success: false,
        message: "Invalid credentials or account is inactive.",
      });
      return;
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      res.status(401).json({
        success: false,
        message: "Invalid credentials.",
      });
      return;
    }

    const token = jwt.sign(
      {
        role: user.role,
      },
      getJwtSecret(),
      {
        subject: user._id.toString(),
        algorithm: "HS256",
        expiresIn: "7d",
      },
    );

    res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      expiresIn: 604800,
      user: {
        id: user._id.toString(),
        collegeId: user.collegeId,
        username: user.username || user.collegeId,
        name: user.name,
        role: user.role,
        department: user.department,
        year: user.year,
        phone: user.phone,
        assignedBusId: user.assignedBusId ? user.assignedBusId.toString() : undefined,
        assignedRouteId: user.assignedRouteId ? user.assignedRouteId.toString() : undefined,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to process login due to an internal error.",
    });
  }
});

/**
 * GET /api/auth/me
 * Retrieves the currently authenticated user's profile and verifies active session.
 */
router.get("/me", authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  res.status(200).json({
    success: true,
    user: req.authUser,
  });
});

/**
 * POST /api/auth/register-student
 * Student self-registration only. Drivers and Admins are strictly provisioned.
 */
router.post("/register-student", async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Strict Role Guard: Only students can register through this public endpoint
    if (req.body?.role && req.body.role !== "student") {
      res.status(403).json({
        success: false,
        message: "Self-registration is restricted to students only. Administrative and driver accounts must be provisioned by the college.",
      });
      return;
    }

    const rawCollegeId = typeof req.body?.collegeId === "string" ? req.body.collegeId : "";
    const collegeId = rawCollegeId.trim().toUpperCase();

    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const department = typeof req.body?.department === "string" ? req.body.department.trim() : "General";
    const year = typeof req.body?.year === "string" ? req.body.year.trim() : "1st Year";
    const phone = typeof req.body?.phone === "string" ? req.body.phone.trim().replace(/\s+/g, "") : "";
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const confirmPassword = typeof req.body?.confirmPassword === "string" ? req.body.confirmPassword : "";

    // 2. Validate Required Fields
    if (!collegeId || !name || !password) {
      res.status(400).json({
        success: false,
        message: "College ID, full name, and password are required.",
      });
      return;
    }

    if (collegeId.length < 3 || collegeId.length > 50) {
      res.status(400).json({
        success: false,
        message: "College ID must be between 3 and 50 characters.",
      });
      return;
    }

    if (name.length < 2 || name.length > 100) {
      res.status(400).json({
        success: false,
        message: "Full name must be between 2 and 100 characters.",
      });
      return;
    }

    // 3. Validate Phone Number (if provided)
    if (phone) {
      const phoneRegex = /^(?:\+91)?[6-9]\d{9}$/;
      if (!phoneRegex.test(phone)) {
        res.status(400).json({
          success: false,
          message: "Please enter a valid 10-digit mobile number.",
        });
        return;
      }
    }

    // 4. Validate Password Policy
    if (
      password.length < 8 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters (max 72 bytes).",
      });
      return;
    }

    // Check for matching password confirmation if provided
    if (confirmPassword && confirmPassword !== password) {
      res.status(400).json({
        success: false,
        message: "Passwords do not match.",
      });
      return;
    }

    // 5. Check Duplicate College ID or Phone
    const duplicateQuery: any[] = [{ collegeId }];
    if (phone) {
      duplicateQuery.push({ phone });
    }

    const existing = await User.findOne({ $or: duplicateQuery }).select("collegeId phone");
    if (existing) {
      if (existing.collegeId === collegeId) {
        res.status(409).json({
          success: false,
          message: "An account with this College ID already exists. Please sign in.",
        });
        return;
      }
      if (phone && existing.phone === phone) {
        res.status(409).json({
          success: false,
          message: "An account with this mobile number already exists.",
        });
        return;
      }
    }

    // 6. Secure bcrypt password hashing
    const passwordHash = await bcrypt.hash(password, 12);

    // 7. Create User Record in MongoDB Atlas with role: student
    const user = await User.create({
      collegeId,
      username: collegeId,
      name,
      department,
      year,
      phone: phone || undefined,
      passwordHash,
      role: "student",
      active: true,
    });

    // 8. Sign initial session token
    const token = jwt.sign(
      {
        role: "student",
      },
      getJwtSecret(),
      {
        subject: user._id.toString(),
        algorithm: "HS256",
        expiresIn: "7d",
      },
    );

    res.status(201).json({
      success: true,
      message: "Student account created successfully.",
      token,
      expiresIn: 604800,
      user: {
        id: user._id.toString(),
        collegeId: user.collegeId,
        username: user.username,
        name: user.name,
        role: user.role,
        department: user.department,
        year: user.year,
        phone: user.phone,
      },
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || "field";
      res.status(409).json({
        success: false,
        message: `An account with this ${field === "collegeId" ? "College ID" : field} already exists.`,
      });
      return;
    }

    console.error("Student registration error:", error);
    res.status(500).json({
      success: false,
      message: "Unable to complete registration. Please try again later.",
    });
  }
});

export default router;
