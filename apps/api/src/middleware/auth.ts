
import type { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User";

export type UserRole = "student" | "driver" | "admin";

export interface AuthenticatedRequest extends Request {
  authUser?: {
    id: string;
    collegeId: string;
    name: string;
    role: UserRole;
    assignedBusId?: string;
    assignedRouteId?: string;
  };
}

interface TokenPayload extends JwtPayload {
  sub: string;
  role: UserRole;
}

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters.");
  }

  return secret;
};

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      res.status(401).json({ message: "Authentication token required." });
      return;
    }

    const token = authorization.slice("Bearer ".length).trim();

    if (!token) {
      res.status(401).json({ message: "Authentication token required." });
      return;
    }

    let decoded: string | JwtPayload;

    try {
      decoded = jwt.verify(token, getJwtSecret(), {
        algorithms: ["HS256"],
      });
    } catch {
      res.status(401).json({ message: "Invalid or expired token." });
      return;
    }

    if (
      typeof decoded === "string" ||
      typeof decoded.sub !== "string" ||
      !mongoose.isValidObjectId(decoded.sub) ||
      !["student", "driver", "admin"].includes(String(decoded.role))
    ) {
      res.status(401).json({ message: "Invalid authentication token." });
      return;
    }

    const user = await User.findById(decoded.sub)
      .select("collegeId name role active assignedBusId assignedRouteId")
      .lean();

    if (!user || !user.active) {
      res.status(401).json({ message: "Account is inactive or unavailable." });
      return;
    }

    // Use the current database role rather than trusting a role in an old token.
    req.authUser = {
      id: user._id.toString(),
      collegeId: user.collegeId,
      name: user.name,
      role: user.role as UserRole,
      assignedBusId: user.assignedBusId ? user.assignedBusId.toString() : undefined,
      assignedRouteId: user.assignedRouteId ? user.assignedRouteId.toString() : undefined,
    };

    next();
  } catch (error) {
    console.error("Authentication middleware error:", error);
    res.status(500).json({ message: "Authentication service error." });
  }
};

export const authorizeRoles = (...roles: UserRole[]) => {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): void => {
    if (!req.authUser) {
      res.status(401).json({ message: "Authentication required." });
      return;
    }

    if (!roles.includes(req.authUser.role)) {
      res.status(403).json({ message: "You do not have permission." });
      return;
    }

    next();
  };
};
