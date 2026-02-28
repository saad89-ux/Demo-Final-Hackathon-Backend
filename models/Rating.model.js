import mongoose from "mongoose";

const ratingSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
      unique: true,
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    review: { type: String, maxlength: 500 },
  },
  { timestamps: true }
);

ratingSchema.index({ doctorId: 1 });
ratingSchema.index({ patientId: 1 });

export default mongoose.model("Rating", ratingSchema);