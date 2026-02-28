import express from "express";
import verifyToken from "../middleware/verifyToken.js";
import verifyDoctor from "../middleware/verifyDoctor.js";
import verifyPatient from "../middleware/verifyPatient.js";
import { aiLimiter } from "../config/rateLimiter.js";
import { requireProPlan } from "../middleware/checkSubscription.js";
import { validate } from "../middleware/validate.js";
import {
  symptomCheckerSchema,
  saveDiagnosisSchema,
  ratingSchema,
} from "../validation/diagnosis.validation.js";
import {
  runAISymptomCheck,
  saveFinalDiagnosis,
  runRiskFlagging,
  getDiagnosisHistory,
  rateDoctor,
  getDoctorDashboard,
} from "../controllers/diagnosis.controller.js";

const router = express.Router();

router.use(verifyToken);

router.post(
  "/ai/symptom-check",
  verifyDoctor,
  requireProPlan,
  aiLimiter,
  validate(symptomCheckerSchema),
  runAISymptomCheck
);
router.put("/save-diagnosis", verifyDoctor, validate(saveDiagnosisSchema), saveFinalDiagnosis);
router.post("/ai/risk-flag/:patientId", verifyDoctor, requireProPlan, aiLimiter, runRiskFlagging);
router.get("/patient/:patientId/history", getDiagnosisHistory);
router.get("/doctor/dashboard", verifyDoctor, getDoctorDashboard);
router.post("/rate-doctor", verifyPatient, validate(ratingSchema), rateDoctor);

export default router;