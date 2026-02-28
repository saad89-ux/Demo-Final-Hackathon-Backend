import express from "express";
import verifyToken from "../middleware/verifyToken.js";
import verifyAdmin from "../middleware/verifyAdmin.js";
import { validate } from "../middleware/validate.js";
import { createDoctorSchema, createReceptionistSchema, updateSubscriptionSchema } from "../validation/user.validation.js";
import { createDoctor, createReceptionist, getAllDoctors, getAllReceptionists, getAllPatients, deactivateUser, reactivateUser, updateSubscription, getAdminDashboard, getAuditLogs } from "../controllers/admin.controller.js";

const router = express.Router();

router.use(verifyToken, verifyAdmin);

router.post("/doctors", validate(createDoctorSchema), createDoctor);
router.get("/doctors", getAllDoctors);
router.post("/receptionists", validate(createReceptionistSchema), createReceptionist);
router.get("/receptionists", getAllReceptionists);
router.get("/patients", getAllPatients);
router.put("/users/:id/deactivate", deactivateUser);
router.put("/users/:id/reactivate", reactivateUser);
router.put("/subscription", validate(updateSubscriptionSchema), updateSubscription);
router.get("/dashboard", getAdminDashboard);
router.get("/audit-logs", getAuditLogs);

export default router;