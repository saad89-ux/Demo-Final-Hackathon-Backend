import mongoose from "mongoose";

const diagnosisLogSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment" },
    symptoms: [{ type: String, required: true }],
    patientAge: { type: Number },
    patientGender: { type: String },
    medicalHistory: { type: String },
    additionalNotes: { type: String },
    aiResponse: {
      possibleConditions: [
        {
          condition: String,
          probability: String,
          description: String,
        },
      ],
      riskLevel: { type: String, enum: ["Low", "Medium", "High", "Critical"] },
      suggestedTests: [String],
      urgencyAdvice: String,
      disclaimer: String,
    },
    finalDiagnosis: { type: String },
    doctorNotes: { type: String },
    icdCode: { type: String },
    aiUsed: { type: Boolean, default: true },
    aiFailed: { type: Boolean, default: false },
    aiError: { type: String },
    aiModel: { type: String, default: "gemini-1.5-flash" },
    aiResponseTime: { type: Number },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

diagnosisLogSchema.index({ patientId: 1, createdAt: -1 });
diagnosisLogSchema.index({ doctorId: 1, createdAt: -1 });
diagnosisLogSchema.index({ "aiResponse.riskLevel": 1 });

export default mongoose.model("DiagnosisLog", diagnosisLogSchema);