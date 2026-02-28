import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        "USER_LOGIN", "USER_LOGOUT", "USER_REGISTERED",
        "DOCTOR_CREATED", "DOCTOR_UPDATED", "DOCTOR_DEACTIVATED",
        "RECEPTIONIST_CREATED", "RECEPTIONIST_DEACTIVATED",
        "PATIENT_REGISTERED", "PATIENT_UPDATED", "PATIENT_DELETED",
        "APPOINTMENT_BOOKED", "APPOINTMENT_CONFIRMED",
        "APPOINTMENT_CANCELLED", "APPOINTMENT_COMPLETED",
        "PRESCRIPTION_CREATED", "PRESCRIPTION_PDF_GENERATED",
        "DIAGNOSIS_LOGGED",
        "AI_SYMPTOM_CHECK", "AI_PRESCRIPTION_EXPLANATION", "AI_RISK_FLAG_DETECTED",
        "SUBSCRIPTION_UPDATED", "SYSTEM_ACTION",
      ],
    },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    targetAppointment: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment" },
    targetPrescription: { type: mongoose.Schema.Types.ObjectId, ref: "Prescription" },
    details: { type: mongoose.Schema.Types.Mixed },
    ipAddress: String,
    userAgent: String,
  },
  { timestamps: true }
);

auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ performedBy: 1, createdAt: -1 });
auditLogSchema.index({ targetUser: 1 });

export default mongoose.model("AuditLog", auditLogSchema);