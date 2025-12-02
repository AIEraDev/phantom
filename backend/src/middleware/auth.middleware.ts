import { Request, Response, NextFunction } from "express";
import { verifyToken, JWTPayload } from "../utils/jwt";

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        error: "Authentication required",
        code: "AUTH_REQUIRED",
      });
      return;
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      res.status(401).json({
        error: "Invalid authorization header format",
        code: "INVALID_AUTH_FORMAT",
      });
      return;
    }

    const token = parts[1];

    try {
      const payload = verifyToken(token);
      req.user = payload;
      next();
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "TokenExpiredError") {
          res.status(401).json({
            error: "Token expired",
            code: "TOKEN_EXPIRED",
          });
          return;
        }
        if (error.name === "JsonWebTokenError") {
          res.status(401).json({
            error: "Invalid token",
            code: "INVALID_TOKEN",
          });
          return;
        }
      }
      throw error;
    }
  } catch (error) {
    console.error("Authentication middleware error:", error);
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    });
  }
}
