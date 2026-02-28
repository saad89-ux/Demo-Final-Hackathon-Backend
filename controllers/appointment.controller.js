import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "../models/User.model.js";
import Patient from "../models/Patient.model.js";
import Appointment from "../models/Appointment.model.js";
import Prescription from "../models/Prescription.model.js";
import DiagnosisLog from "../models/DiagnosisLog.model.js";
import { logAudit } from "../utils/auditLogger.js";

export const registerPatientByStaff = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { name, email, password, phone, gender, dateOfBirth, bloodGroup, address, allergies, chronicConditions, currentMedications, emergencyContact, medicalNotes } = req.body;

    const exists = await User.findOne({ email }).session(session);
    if (exists) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Email already registered" });
    }

    const defaultPassword = password || `Patient@${Date.now().toString().slice(-6)}`;
    const hashed = await bcrypt.hash(defaultPassword, 12);

    const [user] = await User.create([{
      name, email, password: hashed, role: "patient",
      phone, gender, bloodGroup, address,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      allergies: allergies || [], chronicConditions: chronicConditions || [],
      emergencyContact, createdBy: req.user._id,
    }], { session });

    const [patientProfile] = await Patient.create([{
      userId: user._id, registeredBy: req.user._id,
      allergies: allergies || [], chronicConditions: chronicConditions || [],
      currentMedications: currentMedications || [], medicalNotes,
    }], { session });

    await User.findOneAndUpdate({ role: "admin" }, { $inc: { patientCount: 1 } }, { session });
    await logAudit("PATIENT_REGISTERED", req.user._id, { targetUser: user._id, details: { registeredBy: req.user.role } });
    await session.commitTransaction();

    res.status(201).json({
      message: "Patient registered successfully",
      patient: { id: user._id, name: user.name, email: user.email, role: user.role, gender: user.gender, phone: user.phone, patientId: patientProfile.patientId },
      tempPassword: password ? null : defaultPassword,
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

export const getPatientById = async (req, res) => {
  try {
    const { id } = req.params;
    const patient = await User.findOne({ _id: id, role: "patient", isDeleted: false }).select("-password");
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    if (req.user.role === "patient" && req.user._id.toString() !== id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const patientProfile = await Patient.findOne({ userId: id });
    res.json({ patient, patientProfile });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.role === "patient" && req.user._id.toString() !== id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { name, phone, gender, dateOfBirth, bloodGroup, address, allergies, chronicConditions, currentMedications, emergencyContact, medicalNotes } = req.body;

    const user = await User.findOneAndUpdate(
      { _id: id, role: "patient" },
      { $set: { name, phone, gender, bloodGroup, address, dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined, allergies, chronicConditions, emergencyContact } },
      { new: true }
    ).select("-password");

    if (!user) return res.status(404).json({ message: "Patient not found" });

    await Patient.findOneAndUpdate({ userId: id }, { $set: { allergies, chronicConditions, currentMedications, medicalNotes } });
    await logAudit("PATIENT_UPDATED", req.user._id, { targetUser: user._id });
    res.json({ message: "Patient updated successfully", patient: user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getPatientHistory = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.role === "patient" && req.user._id.toString() !== id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const patient = await User.findOne({ _id: id, role: "patient" }).select("-password");
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    const patientProfile = await Patient.findOne({ userId: id });
    const appointments = await Appointment.find({ patientId: id, isDeleted: false }).populate("doctorId", "name specialization").sort({ appointmentDate: -1 });
    const prescriptions = await Prescription.find({ patientId: id, isDeleted: false }).populate("doctorId", "name specialization").sort({ createdAt: -1 });
    const diagnoses = await DiagnosisLog.find({ patientId: id, isDeleted: false }).populate("doctorId", "name specialization").sort({ createdAt: -1 });

    const timeline = [
      ...appointments.map((a) => ({ type: "appointment", date: a.appointmentDate, data: a })),
      ...prescriptions.map((p) => ({ type: "prescription", date: p.createdAt, data: p })),
      ...diagnoses.map((d) => ({ type: "diagnosis", date: d.createdAt, data: d })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({
      patient, patientProfile,
      stats: { totalAppointments: appointments.length, totalPrescriptions: prescriptions.length, totalDiagnoses: diagnoses.length, activeRiskFlags: patientProfile?.riskFlags?.filter((f) => !f.isResolved).length || 0 },
      timeline,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deletePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const patient = await User.findOneAndUpdate({ _id: id, role: "patient" }, { isDeleted: true, isActive: false, deletedAt: new Date() }, { new: true });
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    await Patient.findOneAndUpdate({ userId: id }, { isDeleted: true, deletedAt: new Date() });
    await logAudit("PATIENT_DELETED", req.user._id, { targetUser: patient._id });
    res.json({ message: "Patient deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};