import express from "express";
import verifyToken from "../middleware/verifyToken.js";
import verifyAdmin from "../middleware/verifyAdmin.js";
import verifyReceptionist from "../middleware/verifyReceptionist.js";
import { validate } from "../middleware/validate.js";
import { registerPatientSchema, updatePatientSchema } from "../validation/user.validation.js";
import { checkPatientLimit } from "../middleware/checkSubscription.js";
import { registerPatientByStaff, getPatientById, updatePatient, getPatientHistory, deletePatient } from "../controllers/patient.controller.js";

const router = express.Router();

router.use(verifyToken);

router.post("/register", verifyReceptionist, checkPatientLimit, validate(registerPatientSchema), registerPatientByStaff);
router.get("/:id", getPatientById);
router.put("/:id", validate(updatePatientSchema), updatePatient);
router.get("/:id/history", getPatientHistory);
router.delete("/:id", verifyAdmin, deletePatient);

export default router;