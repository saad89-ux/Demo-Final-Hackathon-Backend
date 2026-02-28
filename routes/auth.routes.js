import express from "express";
import { registerPatient, login, getProfile, changePassword } from "../controllers/auth.controller.js";
import { authLimiter } from "../config/rateLimiter.js";
import { validate } from "../middleware/validate.js";
import { loginSchema, patientRegisterSchema } from "../validation/auth.validation.js";
import verifyToken from "../middleware/verifyToken.js";

const router = express.Router();

router.post("/register", authLimiter, validate(patientRegisterSchema), registerPatient);
router.post("/login", authLimiter, validate(loginSchema), login);
router.get("/profile", verifyToken, getProfile);
router.put("/change-password", verifyToken, changePassword);

export default router;