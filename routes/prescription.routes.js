import express from "express";
import verifyToken from "../middleware/verifyToken.js";
import verifyDoctor from "../middleware/verifyDoctor.js";
import { validate } from "../middleware/validate.js";
import { requireProPlan } from "../middleware/checkSubscription.js";
import {
  createPrescriptionSchema,
  aiExplanationSchema,
} from "../validation/prescription.validation.js";
import {
  createPrescription,
  getPrescriptionById,
  getPatientPrescriptions,
  getDoctorPrescriptions,
  generatePDF,
  generateAIExplanation,
} from "../controllers/prescription.controller.js";

const router = express.Router();

router.use(verifyToken);

router.post("/", verifyDoctor, validate(createPrescriptionSchema), createPrescription);
router.get("/my-prescriptions", verifyDoctor, getDoctorPrescriptions);
router.get("/patient/my", getPatientPrescriptions);
router.get("/patient/:patientId", verifyDoctor, getPatientPrescriptions);
router.get("/:id", getPrescriptionById);
router.get("/:id/pdf", generatePDF);
router.post(
  "/ai/explain",
  requireProPlan,
  validate(aiExplanationSchema),
  generateAIExplanation
);

export default router;