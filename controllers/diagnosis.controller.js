import mongoose from "mongoose";
import DiagnosisLog from "../models/DiagnosisLog.model.js";
import Patient from "../models/Patient.model.js";
import User from "../models/User.model.js";
import Appointment from "../models/Appointment.model.js";
import Rating from "../models/Rating.model.js";
import { logAudit } from "../utils/auditLogger.js";
import { runSymptomChecker, analyzePatientRisk } from "../services/aiService.js";
import { calculateRunningAverage } from "../utils/calculateAverage.js";

export const runAISymptomCheck = async (req, res) => {
  try {
    const {
      patientId,
      appointmentId,
      symptoms,
      patientAge,
      patientGender,
      medicalHistory,
      additionalNotes,
    } = req.body;

    const patient = await User.findOne({ _id: patientId, role: "patient" });
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    const startTime = Date.now();
    const aiResult = await runSymptomChecker({
      symptoms,
      age:
        patientAge ||
        (patient.dateOfBirth
          ? Math.floor(
              (Date.now() - new Date(patient.dateOfBirth)) / (365.25 * 24 * 3600 * 1000)
            )
          : null),
      gender: patientGender || patient.gender,
      medicalHistory,
      additionalNotes,
    });

    const diagnosisLog = await DiagnosisLog.create({
      patientId,
      doctorId: req.user._id,
      appointmentId: appointmentId || null,
      symptoms,
      patientAge,
      patientGender: patientGender || patient.gender,
      medicalHistory,
      additionalNotes,
      aiResponse: aiResult.data,
      aiUsed: true,
      aiFailed: aiResult.aiFailed || false,
      aiError: aiResult.aiError || null,
      aiModel: "gemini-1.5-flash",
      aiResponseTime: Date.now() - startTime,
    });

    if (appointmentId) {
      await Appointment.findByIdAndUpdate(appointmentId, { diagnosisLogId: diagnosisLog._id });
    }
    await logAudit("AI_SYMPTOM_CHECK", req.user._id, {
      targetUser: patientId,
      details: {
        symptoms,
        aiSuccess: aiResult.success,
        riskLevel: aiResult.data?.riskLevel,
      },
    });

    res.json({
      message: aiResult.success
        ? "AI symptom analysis complete"
        : "AI unavailable - manual assessment required",
      diagnosisLogId: diagnosisLog._id,
      aiSuccess: aiResult.success,
      analysis: aiResult.data,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const saveFinalDiagnosis = async (req, res) => {
  try {
    const { diagnosisLogId, finalDiagnosis, doctorNotes, icdCode } = req.body;
    const diagnosisLog = await DiagnosisLog.findById(diagnosisLogId);
    if (!diagnosisLog) return res.status(404).json({ message: "Diagnosis log not found" });
    if (diagnosisLog.doctorId.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "You can only update your own diagnosis logs" });

    diagnosisLog.finalDiagnosis = finalDiagnosis;
    diagnosisLog.doctorNotes = doctorNotes;
    diagnosisLog.icdCode = icdCode;
    await diagnosisLog.save();

    await logAudit("DIAGNOSIS_LOGGED", req.user._id, {
      targetUser: diagnosisLog.patientId,
      details: { finalDiagnosis, icdCode },
    });
    res.json({ message: "Final diagnosis saved", diagnosisLog });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const runRiskFlagging = async (req, res) => {
  try {
    const { patientId } = req.params;
    const patient = await User.findOne({ _id: patientId, role: "patient" });
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    const patientProfile = await Patient.findOne({ userId: patientId });
    const recentDiagnoses = await DiagnosisLog.find({ patientId, isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(10);

    const diagnosisHistory = recentDiagnoses
      .map((d) => d.finalDiagnosis || d.aiResponse?.possibleConditions?.[0]?.condition)
      .filter(Boolean);
    const recentSymptoms = recentDiagnoses.flatMap((d) => d.symptoms);

    const aiResult = await analyzePatientRisk({
      symptoms: [...new Set(recentSymptoms)],
      conditions: patientProfile?.chronicConditions || [],
      diagnosisHistory,
    });

    if (aiResult.success && aiResult.data?.riskFlags?.length > 0) {
      const newFlags = aiResult.data.riskFlags.map((flag) => ({
        flag: flag.flag,
        severity: flag.severity,
        detectedBy: req.user._id,
      }));
      await Patient.findOneAndUpdate(
        { userId: patientId },
        { $push: { riskFlags: { $each: newFlags } } }
      );
      await logAudit("AI_RISK_FLAG_DETECTED", req.user._id, {
        targetUser: patientId,
        details: { flagCount: newFlags.length, overallRisk: aiResult.data.overallRisk },
      });
    }

    res.json({
      message: aiResult.success
        ? "Risk analysis complete"
        : "AI unavailable - manual review required",
      aiSuccess: aiResult.success,
      riskAnalysis: aiResult.data,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getDiagnosisHistory = async (req, res) => {
  try {
    const { patientId } = req.params;
    if (req.user.role === "patient" && req.user._id.toString() !== patientId)
      return res.status(403).json({ message: "Access denied" });

    const diagnoses = await DiagnosisLog.find({ patientId, isDeleted: false })
      .populate("doctorId", "name specialization")
      .sort({ createdAt: -1 });

    res.json({ total: diagnoses.length, diagnoses });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const rateDoctor = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { appointmentId, doctorId, rating, review } = req.body;

    const appointment = await Appointment.findOne({
      _id: appointmentId,
      patientId: req.user._id,
      status: "Completed",
    }).session(session);
    if (!appointment) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Completed appointment not found" });
    }

    const existingRating = await Rating.findOne({ appointmentId }).session(session);
    if (existingRating) {
      await session.abortTransaction();
      return res.status(400).json({ message: "You have already rated this appointment" });
    }

    const [newRating] = await Rating.create(
      [{ patientId: req.user._id, doctorId, appointmentId, rating, review }],
      { session }
    );

    const doctor = await User.findById(doctorId).session(session);
    const newAvg = calculateRunningAverage(
      doctor.performanceMetrics.averageRating,
      doctor.performanceMetrics.totalRatings,
      rating
    );

    await User.findByIdAndUpdate(
      doctorId,
      {
        $inc: { "performanceMetrics.totalRatings": 1 },
        $set: { "performanceMetrics.averageRating": parseFloat(newAvg.toFixed(2)) },
      },
      { session }
    );
    await session.commitTransaction();

    res.status(201).json({
      message: "Rating submitted successfully",
      rating: newRating,
      doctorNewRating: parseFloat(newAvg.toFixed(2)),
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

export const getDoctorDashboard = async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const todayAppointments = await Appointment.countDocuments({
      doctorId: req.user._id,
      appointmentDate: { $gte: startOfDay },
      isDeleted: false,
    });
    const monthlyAppointments = await Appointment.countDocuments({
      doctorId: req.user._id,
      createdAt: { $gte: startOfMonth },
      isDeleted: false,
    });
    const pendingAppointments = await Appointment.countDocuments({
      doctorId: req.user._id,
      status: "Pending",
      isDeleted: false,
    });
    const totalPrescriptions = await Appointment.countDocuments({
      doctorId: req.user._id,
      isDeleted: false,
    });

    const todaySchedule = await Appointment.find({
      doctorId: req.user._id,
      appointmentDate: { $gte: startOfDay },
      isDeleted: false,
    })
      .populate("patientId", "name email phone gender dateOfBirth")
      .sort({ "timeSlot.startTime": 1 });

    const doctor = await User.findById(req.user._id).select(
      "performanceMetrics specialization name"
    );

    const recentDiagnoses = await DiagnosisLog.find({ doctorId: req.user._id })
      .populate("patientId", "name")
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      myStats: {
        todayAppointments,
        monthlyAppointments,
        pendingAppointments,
        totalPrescriptions,
        performanceMetrics: doctor.performanceMetrics,
      },
      todaySchedule,
      recentDiagnoses,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};