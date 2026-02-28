import DiagnosisLog from "../models/DiagnosisLog.model.js";
import Prescription from "../models/Prescription.model.js";
import Patient from "../models/Patient.model.js";
import User from "../models/User.model.js";
import Appointment from "../models/Appointment.model.js";
import { logAudit } from "../utils/auditLogger.js";
import {
  runSymptomChecker,
  generatePrescriptionExplanation,
  analyzePatientRisk,
  generatePredictiveAnalytics,
} from "../services/aiService.js";

export const symptomChecker = async (req, res) => {
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

    const patient = await User.findOne({ _id: patientId, role: "patient", isDeleted: false });
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    const age =
      patientAge ||
      (patient.dateOfBirth
        ? Math.floor(
            (Date.now() - new Date(patient.dateOfBirth)) / (365.25 * 24 * 3600 * 1000)
          )
        : null);
    const startTime = Date.now();

    const aiResult = await runSymptomChecker({
      symptoms: Array.isArray(symptoms) ? symptoms : [symptoms],
      age,
      gender: patientGender || patient.gender,
      medicalHistory,
      additionalNotes,
    });

    const diagnosisLog = await DiagnosisLog.create({
      patientId,
      doctorId: req.user._id,
      appointmentId: appointmentId || null,
      symptoms: Array.isArray(symptoms) ? symptoms : [symptoms],
      patientAge: age,
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
        diagnosisLogId: diagnosisLog._id,
      },
    });

    res.status(200).json({
      message: aiResult.success
        ? "AI symptom analysis completed successfully"
        : "AI unavailable — manual assessment required (log saved)",
      diagnosisLogId: diagnosisLog._id,
      aiSuccess: aiResult.success,
      aiFailed: aiResult.aiFailed || false,
      analysis: aiResult.data,
      responseTime: aiResult.responseTime,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const prescriptionExplain = async (req, res) => {
  try {
    const { prescriptionId, language } = req.body;
    const lang = language || req.query.lang || "english";

    const prescription = await Prescription.findOne({ _id: prescriptionId, isDeleted: false });
    if (!prescription) return res.status(404).json({ message: "Prescription not found" });

    if (
      req.user.role === "patient" &&
      prescription.patientId.toString() !== req.user._id.toString()
    )
      return res.status(403).json({ message: "Access denied" });

    const patient = await User.findById(prescription.patientId).select(
      "name gender dateOfBirth"
    );
    const aiResult = await generatePrescriptionExplanation({
      prescription,
      patient,
      language: lang,
    });

    await Prescription.findByIdAndUpdate(prescriptionId, {
      "aiExplanation.patientFriendlyExplanation": aiResult.data.patientFriendlyExplanation,
      "aiExplanation.lifestyleRecommendations": aiResult.data.lifestyleRecommendations,
      "aiExplanation.preventiveAdvice": aiResult.data.preventiveAdvice,
      "aiExplanation.urduExplanation":
        lang === "urdu" ? aiResult.data.patientFriendlyExplanation : undefined,
      "aiExplanation.generatedAt": new Date(),
      "aiExplanation.aiUsed": true,
    });

    await logAudit("AI_PRESCRIPTION_EXPLANATION", req.user._id, {
      targetPrescription: prescriptionId,
      details: { aiSuccess: aiResult.success, language: lang },
    });

    res.status(200).json({
      message: aiResult.success
        ? "AI explanation generated successfully"
        : "AI unavailable — fallback explanation provided",
      aiSuccess: aiResult.success,
      aiFailed: aiResult.aiFailed || false,
      language: lang,
      explanation: aiResult.data,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const riskFlag = async (req, res) => {
  try {
    const { patientId } = req.params;
    const patient = await User.findOne({ _id: patientId, role: "patient", isDeleted: false });
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    const patientProfile = await Patient.findOne({ userId: patientId });
    const recentDiagnoses = await DiagnosisLog.find({ patientId, isDeleted: false })
      .sort({ createdAt: -1 })
      .limit(10);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const recentVisitCount = await Appointment.countDocuments({
      patientId,
      appointmentDate: { $gte: thirtyDaysAgo },
      isDeleted: false,
    });

    const diagnosisHistory = recentDiagnoses
      .map(
        (d) =>
          d.finalDiagnosis ||
          d.aiResponse?.possibleConditions?.[0]?.condition ||
          null
      )
      .filter(Boolean);
    const recentSymptoms = [...new Set(recentDiagnoses.flatMap((d) => d.symptoms))];

    const aiResult = await analyzePatientRisk({
      symptoms: recentSymptoms,
      conditions: patientProfile?.chronicConditions || patient.chronicConditions || [],
      diagnosisHistory,
      visitCount: recentVisitCount,
      recentDays: 30,
    });

    if (aiResult.data?.riskFlags?.length > 0) {
      const newFlags = aiResult.data.riskFlags.map((flag) => ({
        flag: flag.flag,
        severity: flag.severity,
        detectedBy: req.user._id,
        detectedAt: new Date(),
        isResolved: false,
      }));
      await Patient.findOneAndUpdate(
        { userId: patientId },
        { $push: { riskFlags: { $each: newFlags } } },
        { upsert: true }
      );
      await logAudit("AI_RISK_FLAG_DETECTED", req.user._id, {
        targetUser: patientId,
        details: { flagCount: newFlags.length, overallRisk: aiResult.data.overallRisk },
      });
    }

    res.status(200).json({
      message: aiResult.success
        ? "Risk analysis completed"
        : "AI unavailable — logic-based risk assessment provided",
      patientId,
      aiSuccess: aiResult.success,
      aiFailed: aiResult.aiFailed || false,
      riskAnalysis: aiResult.data,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const predictiveAnalytics = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthName = now.toLocaleString("default", { month: "long", year: "numeric" });

    const diagnosisTrends = await DiagnosisLog.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfMonth },
          isDeleted: false,
          finalDiagnosis: { $exists: true, $ne: null },
        },
      },
      { $group: { _id: "$finalDiagnosis", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    const appointmentByStatus = await Appointment.aggregate([
      { $match: { createdAt: { $gte: startOfMonth }, isDeleted: false } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const appointmentByDay = await Appointment.aggregate([
      {
        $match: {
          appointmentDate: { $gte: startOfMonth },
          isDeleted: false,
          status: { $ne: "Cancelled" },
        },
      },
      { $group: { _id: { $dayOfWeek: "$appointmentDate" }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const topDoctors = await User.find({ role: "doctor", isDeleted: false })
      .select("name specialization performanceMetrics")
      .sort({ "performanceMetrics.totalAppointments": -1 })
      .limit(5);

    const totalPatients = await User.countDocuments({ role: "patient", isDeleted: false });
    const monthlyAppointments = await Appointment.countDocuments({
      createdAt: { $gte: startOfMonth },
      isDeleted: false,
    });

    const days = ["", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const appointmentData = {
      total: monthlyAppointments,
      byStatus: appointmentByStatus.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      byDayPattern: appointmentByDay
        .slice(0, 3)
        .map((d) => ({ day: days[d._id], count: d.count })),
    };

    const aiResult = await generatePredictiveAnalytics({
      diagnosisTrends,
      appointmentData,
      month: monthName,
      totalPatients,
      commonSymptoms: [],
    });

    res.status(200).json({
      message: aiResult.success
        ? "Predictive analytics generated"
        : "Analytics data returned (AI insights unavailable)",
      month: monthName,
      aiSuccess: aiResult.success,
      aiFailed: aiResult.aiFailed || false,
      rawData: {
        diagnosisTrends,
        appointmentByStatus,
        monthlyAppointments,
        totalPatients,
        topDoctors,
        mostCommonDiagnosis: diagnosisTrends[0]?._id || "Insufficient data",
        topDoctor: topDoctors[0]
          ? `${topDoctors[0].name} (${topDoctors[0].performanceMetrics.totalAppointments} appointments)`
          : "No data",
      },
      aiInsights: aiResult.data,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAIHistory = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { limit = 20, page = 1 } = req.query;

    if (req.user.role === "patient" && req.user._id.toString() !== patientId)
      return res.status(403).json({ message: "Access denied" });

    const patient = await User.findOne({
      _id: patientId,
      role: "patient",
      isDeleted: false,
    }).select("name gender dateOfBirth");
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    const total = await DiagnosisLog.countDocuments({ patientId, isDeleted: false });
    const diagnosisLogs = await DiagnosisLog.find({ patientId, isDeleted: false })
      .populate("doctorId", "name specialization")
      .populate("appointmentId", "appointmentNumber appointmentDate")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const prescriptions = await Prescription.find({
      patientId,
      "aiExplanation.aiUsed": true,
      isDeleted: false,
    })
      .select("prescriptionNumber diagnosis aiExplanation createdAt doctorId")
      .populate("doctorId", "name specialization")
      .sort({ createdAt: -1 })
      .limit(10);

    const patientProfile = await Patient.findOne({ userId: patientId });
    const riskFlags = patientProfile?.riskFlags || [];

    res.status(200).json({
      message: "AI history retrieved successfully",
      patient: { id: patient._id, name: patient.name, gender: patient.gender },
      stats: {
        totalDiagnosisLogs: total,
        totalAIExplanations: prescriptions.length,
        activeRiskFlags: riskFlags.filter((f) => !f.isResolved).length,
        resolvedRiskFlags: riskFlags.filter((f) => f.isResolved).length,
      },
      diagnosisHistory: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        logs: diagnosisLogs,
      },
      prescriptionExplanations: prescriptions,
      riskFlags,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};