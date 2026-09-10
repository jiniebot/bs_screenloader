import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import config from "../config/index.js";
import User from "../models/User.js";
import Group from "../models/Group.js";
import { authRequired, requireRole } from "../middleware/auth.js";

const router = express.Router();

const COOKIE_NAME = "bs_token";

function issueToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
    },
    config.jwtSecret,
    { expiresIn: config.jwtTtl },
  );
}

function setAuthCookie(req, res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    // Derived from the actual request (respects `trust proxy`) rather than
    // NODE_ENV, so it adapts correctly whether this runs behind a
    // TLS-terminating proxy or plain HTTP — a "production" env var doesn't
    // guarantee HTTPS is actually in front of it, and a Secure cookie set
    // over plain HTTP is silently dropped by the browser, breaking login.
    secure: req.secure,
    sameSite: "strict",
    maxAge: config.jwtTtlMs,
    path: "/",
  });
}

router.post("/auth/bootstrap", async (req, res, next) => {
  try {
    const { email, name, password } = req.body;
    if (!email || !name || !password) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const count = await User.countDocuments();
    if (count > 0) {
      return res.status(403).json({ error: "Bootstrap already completed." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email,
      name,
      role: "admin",
      passwordHash,
    });

    const token = issueToken(user);
    setAuthCookie(req, res, token);
    return res.status(201).json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

router.get("/auth/bootstrap/status", async (req, res, next) => {
  try {
    const count = await User.countDocuments();
    return res.json({ available: count === 0 });
  } catch (err) {
    return next(err);
  }
});

router.post("/auth/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Missing email or password." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const token = issueToken(user);
    setAuthCookie(req, res, token);
    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

router.post("/auth/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  return res.json({ ok: true });
});

router.get("/auth/me", authRequired, async (req, res) => {
  const user = req.user;
  return res.json({
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      groups: user.groups || [],
    },
  });
});

router.post(
  "/admin/users",
  authRequired,
  requireRole("admin"),
  async (req, res, next) => {
    try {
      const { email, name, password, role, groupIds } = req.body;
      if (!email || !name || !password) {
        return res.status(400).json({ error: "Missing required fields." });
      }

      let groups = [];
      if (Array.isArray(groupIds)) {
        groups = groupIds;
      } else if (typeof groupIds === "string" && groupIds.trim()) {
        const raw = groupIds.trim();
        if (raw.startsWith("[") && raw.endsWith("]")) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              groups = parsed;
            }
          } catch {
            groups = raw
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean);
          }
        } else {
          groups = raw
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
        }
      }

      const groupDocs = [];
      for (const entry of groups) {
        if (!entry) continue;
        if (/^[a-f0-9]{24}$/i.test(entry)) {
          const doc = await Group.findById(entry);
          if (doc) groupDocs.push(doc);
        } else {
          const doc = await Group.findOne({ name: entry });
          if (doc) groupDocs.push(doc);
        }
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await User.create({
        email,
        name,
        role: role || "user",
        passwordHash,
        groups: groupDocs.map((doc) => doc._id),
      });

      return res.status(201).json({ id: user._id });
    } catch (err) {
      return next(err);
    }
  },
);

router.get("/admin/users", authRequired, requireRole("admin"), async (req, res, next) => {
  try {
    const users = await User.find().populate("groups").sort({ createdAt: -1 });
    return res.json({
      users: users.map((u) => ({
        id: u._id,
        email: u.email,
        name: u.name,
        role: u.role,
        groups: u.groups || [],
      })),
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
