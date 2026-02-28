import mongoose from "mongoose";
import { nanoid } from "nanoid";

const appointmentSchema = new mongoose.Schema(
  {
    appointmentNumber: { type: String, unique: true, required: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    appointmentDate: { type: Date, required: true },
    timeSlot: {
      startTime: { type: String, required: true },
      endTime: { type: String },
    },
    type: {
      type: String,
      enum: ["In-Person", "Online", "Follow-Up", "Emergency"],
      default: "In-Person",
    },
    status: {
      type: String,
      enum: ["Pending", "Confirmed", "Completed", "Cancelled", "No-Show"],
      default: "Pending",
    },
    reason: { type: String, required: true },
    symptoms: [{ type: String }],
    doctorNotes: { type: String },
    vitalSigns: {
      bloodPressure: String,
      heartRate: String,
      temperature: String,
      weight: String,
      height: String,
      oxygenSaturation: String,
    },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    cancellationReason: { type: String },
    cancelledAt: Date,
    statusHistory: [
      {
        status: String,
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        changedAt: { type: Date, default: Date.now },
        reason: String,
      },
    ],
    prescriptionId: { type: mongoose.Schema.Types.ObjectId, ref: "Prescription" },
    diagnosisLogId: { type: mongoose.Schema.Types.ObjectId, ref: "DiagnosisLog" },
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true }
);

appointmentSchema.pre("save", function (next) {
  if (!this.appointmentNumber) {
    this.appointmentNumber = `APT-${Date.now()}-${nanoid(6)}`;
  }
  next();
});

appointmentSchema.index({ patientId: 1, appointmentDate: -1 });
appointmentSchema.index({ doctorId: 1, appointmentDate: -1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ isDeleted: 1 });

export default mongoose.model("Appointment", appointmentSchema);