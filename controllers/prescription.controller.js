import mongoose from "mongoose";
import Prescription from "../models/Prescription.model.js";
import Appointment from "../models/Appointment.model.js";
import User from "../models/User.model.js";
import { logAudit } from "../utils/auditLogger.js";
import { generatePrescriptionExplanation } from "../services/aiService.js";
import { generatePrescriptionPDF } from "../utils/pdfGenerator.js";
import { uploadToCloudinary } from "../utils/cloudinaryUpload.js";

export const createPrescription = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      patientId,
      appointmentId,
      diagnosis,
      icdCode,
      medicines,
      instructions,
      followUpDate,
      followUpNotes,
      tests,
    } = req.body;

    const patient = await User.findOne({ _id: patientId, role: "patient" }).session(session);
    if (!patient) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Patient not found" });
    }

    const [prescription] = await Prescription.create(
      [
        {
          patientId,
          doctorId: req.user._id,
          appointmentId: appointmentId || null,
          diagnosis,
          icdCode,
          medicines,
          instructions,
          followUpDate: followUpDate ? new Date(followUpDate) : undefined,
          followUpNotes,
          tests: tests || [],
        },
      ],
      { session }
    );

    if (appointmentId) {
      await Appointment.findByIdAndUpdate(appointmentId, { prescriptionId: prescription._id }, { session });
    }
    await User.findByIdAndUpdate(
      req.user._id,
      { $inc: { "performanceMetrics.totalPrescriptions": 1 } },
      { session }
    );
    await logAudit("PRESCRIPTION_CREATED", req.user._id, {
      targetPrescription: prescription._id,
      targetUser: patientId,
      details: { diagnosis },
    });
    await session.commitTransaction();

    const populated = await Prescription.findById(prescription._id)
      .populate("patientId", "name email gender dateOfBirth phone")
      .populate("doctorId", "name specialization qualification");

    res.status(201).json({ message: "Prescription created successfully", prescription: populated });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

export const getPrescriptionById = async (req, res) => {
  try {
    const { id } = req.params;
    const prescription = await Prescription.findOne({ _id: id, isDeleted: false })
      .populate("patientId", "name email gender dateOfBirth phone bloodGroup")
      .populate("doctorId", "name specialization qualification consultationFee")
      .populate("appointmentId", "appointmentNumber appointmentDate");

    if (!prescription) return res.status(404).json({ message: "Prescription not found" });

    if (
      req.user.role === "patient" &&
      prescription.patientId._id.toString() !== req.user._id.toString()
    )
      return res.status(403).json({ message: "Access denied" });
    if (
      req.user.role === "doctor" &&
      prescription.doctorId._id.toString() !== req.user._id.toString()
    )
      return res.status(403).json({ message: "Access denied" });

    res.json(prescription);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getPatientPrescriptions = async (req, res) => {
  try {
    const patientId = req.user.role === "patient" ? req.user._id : req.params.patientId;
    const prescriptions = await Prescription.find({ patientId, isDeleted: false })
      .populate("doctorId", "name specialization")
      .sort({ createdAt: -1 });
    res.json({ total: prescriptions.length, prescriptions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getDoctorPrescriptions = async (req, res) => {
  try {
    const prescriptions = await Prescription.find({ doctorId: req.user._id, isDeleted: false })
      .populate("patientId", "name email")
      .sort({ createdAt: -1 });
    res.json({ total: prescriptions.length, prescriptions });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const generatePDF = async (req, res) => {
  try {
    const { id } = req.params;
    const prescription = await Prescription.findOne({ _id: id, isDeleted: false });
    if (!prescription) return res.status(404).json({ message: "Prescription not found" });

    if (
      req.user.role === "patient" &&
      prescription.patientId.toString() !== req.user._id.toString()
    )
      return res.status(403).json({ message: "Access denied" });

    const doctor = await User.findById(prescription.doctorId).select("-password");
    const patient = await User.findById(prescription.patientId).select("-password");
    const pdfBuffer = await generatePrescriptionPDF(prescription, doctor, patient);

    if (req.query.upload === "true") {
      const result = await uploadToCloudinary(pdfBuffer, "clinic-prescriptions");
      await Prescription.findByIdAndUpdate(id, {
        pdfUrl: result.secure_url,
        pdfPublicId: result.public_id,
        pdfGeneratedAt: new Date(),
      });
      await logAudit("PRESCRIPTION_PDF_GENERATED", req.user._id, {
        targetPrescription: prescription._id,
        details: { pdfUrl: result.secure_url },
      });
      return res.json({ message: "PDF generated and uploaded successfully", pdfUrl: result.secure_url });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${prescription.prescriptionNumber}.pdf"`
    );
    res.send(pdfBuffer);

    await logAudit("PRESCRIPTION_PDF_GENERATED", req.user._id, {
      targetPrescription: prescription._id,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const generateAIExplanation = async (req, res) => {
  try {
    const { prescriptionId, language } = req.body;
    const prescription = await Prescription.findOne({ _id: prescriptionId, isDeleted: false });
    if (!prescription) return res.status(404).json({ message: "Prescription not found" });

    const patient = await User.findById(prescription.patientId).select("name gender dateOfBirth");
    const aiResult = await generatePrescriptionExplanation({
      prescription,
      patient,
      language: language || "english",
    });

    await Prescription.findByIdAndUpdate(prescriptionId, {
      "aiExplanation.patientFriendlyExplanation": aiResult.data.patientFriendlyExplanation,
      "aiExplanation.lifestyleRecommendations": aiResult.data.lifestyleRecommendations,
      "aiExplanation.preventiveAdvice": aiResult.data.preventiveAdvice,
      "aiExplanation.urduExplanation":
        language === "urdu" ? aiResult.data.patientFriendlyExplanation : undefined,
      "aiExplanation.generatedAt": new Date(),
      "aiExplanation.aiUsed": true,
    });

    await logAudit("AI_PRESCRIPTION_EXPLANATION", req.user._id, {
      targetPrescription: prescription._id,
      details: { aiSuccess: aiResult.success, language },
    });

    res.json({
      message: aiResult.success ? "AI explanation generated" : "Fallback explanation provided",
      aiSuccess: aiResult.success,
      explanation: aiResult.data,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};