import jwt from "jsonwebtoken";
import config from "../config/index.js";
import User from "../models/User.js";

export async function authRequired(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const bearerToken = header.startsWith("Bearer ") ? header.slice(7) : null;
    const token = req.cookies?.bs_token || bearerToken;
    if (!token) {
      return res.status(401).json({ error: "Missing auth token." });
    }

    const payload = jwt.verify(token, config.jwtSecret);
    const user = await User.findById(payload.sub).populate("groups");
    if (!user) {
      return res.status(401).json({ error: "Invalid auth token." });
    }

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid auth token." });
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: "Forbidden." });
    }
    return next();
  };
}
