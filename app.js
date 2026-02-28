import express from "express";
import cors from "cors";
import helmet from "helmet";
import { generalLimiter } from "./config/rateLimiter.js";
import errorHandler from "./middleware/errorHandler.js";

import authRoutes from "./routes/auth.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import patientRoutes from "./routes/patient.routes.js";
import appointmentRoutes from "./routes/appointment.routes.js";
import prescriptionRoutes from "./routes/prescription.routes.js";
import diagnosisRoutes from "./routes/diagnosis.routes.js";
import aiRoutes from "./routes/ai.routes.js";

const app = express();

app.use(helmet());
app.use(generalLimiter);

const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:3001",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/diagnosis", diagnosisRoutes);
app.use("/api/ai", aiRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "🏥 AI Clinic Management SaaS API",
    version: "1.0.0",
    status: "healthy",
    timestamp: new Date().toISOString(),
    aiEndpoints: {
      symptomChecker: "POST /api/ai/symptom-checker",
      prescriptionExplain: "POST /api/ai/prescription-explain",
      riskFlag: "GET /api/ai/risk-flag/:patientId",
      predictiveAnalytics: "GET /api/ai/predictive-analytics",
      aiHistory: "GET /api/ai/history/:patientId",
    },
  });
});

app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found` });
});

app.use(errorHandler);

export default app;