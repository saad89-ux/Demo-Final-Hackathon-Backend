import mongoose from "mongoose";
import { nanoid } from "nanoid";

const medicineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  dosage: { type: String, required: true },
  frequency: { type: String, required: true },
  duration: { type: String, required: true },
  instructions: { type: String },
  route: { type: String, default: "Oral" },
});

const prescriptionSchema = new mongoose.Schema(
  {
    prescriptionNumber: { type: String, unique: true, required: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment" },
    diagnosis: { type: String, required: true },
    icdCode: { type: String },
    medicines: [medicineSchema],
    instructions: { type: String },
    followUpDate: { type: Date },
    followUpNotes: { type: String },
    tests: [
      {
        testName: String,
        urgency: { type: String, enum: ["Routine", "Urgent", "Emergency"], default: "Routine" },
        notes: String,
      },
    ],
    aiExplanation: {
      patientFriendlyExplanation: String,
      lifestyleRecommendations: [String],
      preventiveAdvice: [String],
      urduExplanation: String,
      generatedAt: Date,
      aiUsed: { type: Boolean, default: false },
    },
    pdfUrl: { type: String },
    pdfPublicId: { type: String },
    pdfGeneratedAt: { type: Date },
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true }
);

prescriptionSchema.pre("save", function (next) {
  if (!this.prescriptionNumber) {
    this.prescriptionNumber = `RX-${Date.now()}-${nanoid(6)}`;
  }
  next();
});

prescriptionSchema.index({ patientId: 1, createdAt: -1 });
prescriptionSchema.index({ doctorId: 1, createdAt: -1 });
prescriptionSchema.index({ appointmentId: 1 });

export default mongoose.model("Prescription", prescriptionSchema);