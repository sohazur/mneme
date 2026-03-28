import type { Request, Response, NextFunction } from "express";
import { auth } from "../firebase.js";

declare global {
    namespace Express {
        interface Request {
            uid?: string;
        }
    }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        res.status(401).json({ error: "Missing or invalid Authorization header" });
        return;
    }

    const idToken = header.split("Bearer ")[1];
    try {
        const decoded = await auth.verifyIdToken(idToken);
        req.uid = decoded.uid;
        next();
    } catch {
        res.status(401).json({ error: "Invalid or expired token" });
    }
}
