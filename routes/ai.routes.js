import express from "express";
import verifyToken from "../middleware/verifyToken.js";
import verifyDoctor from "../middleware/verifyDoctor.js";
import verifyAdmin from "../middleware/verifyAdmin.js";
import { requireProPlan } from "../middleware/checkSubscription.js";
import { aiLimiter } from "../config/rateLimiter.js";
import { validate } from "../middleware/validate.js";
import {
  symptomCheckerSchema,
  prescriptionExplainSchema,
} from "../validation/ai.validation.js";
import {
  symptomChecker,
  prescriptionExplain,
  riskFlag,
  predictiveAnalytics,
  getAIHistory,
} from "../controllers/ai.controller.js";

const router = express.Router();

router.use(verifyToken);

router.post(
  "/symptom-checker",
  verifyDoctor,
  requireProPlan,
  aiLimiter,
  validate(symptomCheckerSchema),
  symptomChecker
);
router.post(
  "/prescription-explain",
  requireProPlan,
  aiLimiter,
  validate(prescriptionExplainSchema),
  prescriptionExplain
);
router.get("/risk-flag/:patientId", verifyDoctor, requireProPlan, aiLimiter, riskFlag);
router.get("/predictive-analytics", verifyAdmin, requireProPlan, predictiveAnalytics);
router.get("/history/:patientId", requireProPlan, getAIHistory);

export default router;