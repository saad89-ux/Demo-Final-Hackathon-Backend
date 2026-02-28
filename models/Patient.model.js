import mongoose from "mongoose";
import { nanoid } from "nanoid";

const patientSchema = new mongoose.Schema(
  {
    patientId: { type: String, unique: true, required: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    allergies: [{ type: String }],
    chronicConditions: [{ type: String }],
    currentMedications: [{ type: String }],
    medicalNotes: { type: String },
    riskFlags: [
      {
        flag: String,
        severity: { type: String, enum: ["Low", "Medium", "High", "Critical"] },
        detectedAt: { type: Date, default: Date.now },
        resolvedAt: Date,
        isResolved: { type: Boolean, default: false },
        detectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      },
    ],
    insurance: {
      provider: String,
      policyNumber: String,
      expiryDate: Date,
    },
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true }
);

patientSchema.pre("save", function (next) {
  if (!this.patientId) {
    this.patientId = `PAT-${Date.now()}-${nanoid(6)}`;
  }
  next();
});

patientSchema.index({ userId: 1 });
patientSchema.index({ patientId: 1 });

export default mongoose.model("Patient", patientSchema);