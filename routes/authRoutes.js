// routes/authRoutes.js
import { Router } from "express";
import { login, signup, getUser } from "../controllers/authController.js";
import { authenticate } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/signup", signup);
router.post("/login", login);
router.get("/user", authenticate, getUser);

export default router;
