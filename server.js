import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import connectDB from "./config/db.js";
import { startAppointmentJobs } from "./jobs/appointmentReminder.js";

const PORT = process.env.PORT || 5000;

connectDB();
startAppointmentJobs();

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║   🏥  AI Clinic Management SaaS API v1.0                 ║
║   Server:  http://localhost:${PORT}                          ║
║   Roles:   Admin | Doctor | Receptionist | Patient       ║
║   AI:      Gemini 1.5 Flash                              ║
╚══════════════════════════════════════════════════════════╝
  `);
});