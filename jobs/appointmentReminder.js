import cron from "node-cron";
import Appointment from "../models/Appointment.model.js";

export const startAppointmentJobs = () => {
  // Auto mark no-shows every 30 minutes
  cron.schedule("*/30 * * * *", async () => {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const result = await Appointment.updateMany(
        { status: "Confirmed", appointmentDate: { $lt: oneHourAgo }, isDeleted: false },
        { $set: { status: "No-Show" }, $push: { statusHistory: { status: "No-Show", changedAt: new Date(), reason: "Auto-marked: appointment time passed" } } }
      );
      if (result.modifiedCount > 0) console.log(`⚠️ Auto-marked ${result.modifiedCount} appointments as No-Show`);
    } catch (error) {
      console.error("❌ Appointment Job Error:", error.message);
    }
  });

  // Daily summary at midnight
  cron.schedule("0 0 * * *", async () => {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const stats = await Appointment.aggregate([
        { $match: { appointmentDate: { $gte: yesterday, $lt: todayStart }, isDeleted: false } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]);
      console.log("📊 Daily Appointment Summary:", stats);
    } catch (error) {
      console.error("❌ Daily Summary Error:", error.message);
    }
  });

  console.log("✅ Appointment Jobs started");
};