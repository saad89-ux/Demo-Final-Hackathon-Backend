import express from "express";
import verifyToken from "../middleware/verifyToken.js";
import verifyAdmin from "../middleware/verifyAdmin.js";
import verifyDoctor from "../middleware/verifyDoctor.js";
import verifyReceptionist from "../middleware/verifyReceptionist.js";
import { validate } from "../middleware/validate.js";
import { appointmentLimiter } from "../config/rateLimiter.js";
import {
  bookAppointmentSchema,
  updateAppointmentStatusSchema,
  addDoctorNotesSchema,
} from "../validation/appointment.validation.js";
import {
  bookAppointment,
  updateAppointmentStatus,
  addDoctorNotes,
  getDoctorAppointments,
  getPatientAppointments,
  getAppointmentById,
  getAllAppointments,
  getAvailableDoctors,
} from "../controllers/appointment.controller.js";

const router = express.Router();

router.use(verifyToken);

router.get("/doctors/available", getAvailableDoctors);
router.post("/book", appointmentLimiter, validate(bookAppointmentSchema), bookAppointment);
router.get("/my-appointments", getPatientAppointments);
router.get("/doctor/schedule", verifyDoctor, getDoctorAppointments);
router.get("/doctor/:doctorId/schedule", verifyAdmin, getDoctorAppointments);
router.get("/patient/:patientId", verifyReceptionist, getPatientAppointments);
router.get("/all", verifyAdmin, getAllAppointments);
router.get("/:id", getAppointmentById);
router.put("/:id/status", validate(updateAppointmentStatusSchema), updateAppointmentStatus);
router.put("/:id/notes", verifyDoctor, validate(addDoctorNotesSchema), addDoctorNotes);

export default router;