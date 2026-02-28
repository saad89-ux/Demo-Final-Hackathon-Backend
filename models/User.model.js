import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "doctor", "receptionist", "patient"],
      required: true,
    },
    phone: { type: String, trim: true },
    profileImage: { type: String, default: null },

    // Doctor specific
    specialization: {
      type: String,
      required: function () { return this.role === "doctor"; },
    },
    qualification: { type: String },
    experienceYears: { type: Number, default: 0 },
    consultationFee: { type: Number, default: 0 },
    availableSlots: [
      {
        day: {
          type: String,
          enum: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
        },
        startTime: String,
        endTime: String,
      },
    ],
    performanceMetrics: {
      totalAppointments: { type: Number, default: 0 },
      totalPrescriptions: { type: Number, default: 0 },
      totalPatientsSeen: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0, min: 0, max: 5 },
      totalRatings: { type: Number, default: 0 },
      averageResolutionTime: { type: Number, default: 0 },
    },

    // Patient specific
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ["Male", "Female", "Other"] },
    bloodGroup: { type: String, enum: ["A+","A-","B+","B-","AB+","AB-","O+","O-","Unknown"] },
    address: { type: String },
    emergencyContact: {
      name: String,
      phone: String,
      relation: String,
    },
    allergies: [{ type: String }],
    chronicConditions: [{ type: String }],
    currentMedications: [{ type: String }],

    // Receptionist specific
    assignedDoctors: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // SaaS subscription (admin)
    subscriptionPlan: {
      type: String,
      enum: ["free", "pro", "enterprise"],
      default: "free",
    },
    subscriptionExpiry: { type: Date },
    patientCount: { type: Number, default: 0 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
    lastLogin: Date,
  },
  { timestamps: true }
);

userSchema.index({ email: 1 });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ isDeleted: 1 });

export default mongoose.model("User", userSchema);