import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "../models/User.model.js";
import Patient from "../models/Patient.model.js";
import Appointment from "../models/Appointment.model.js";
import Prescription from "../models/Prescription.model.js";
import DiagnosisLog from "../models/DiagnosisLog.model.js";
import AuditLog from "../models/AuditLog.model.js";
import { logAudit } from "../utils/auditLogger.js";

export const createDoctor = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { name, email, password, phone, specialization, qualification, experienceYears, consultationFee } = req.body;

    const exists = await User.findOne({ email }).session(session);
    if (exists) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashed = await bcrypt.hash(password, 12);
    const [doctor] = await User.create([{
      name, email, password: hashed, role: "doctor",
      phone, specialization, qualification,
      experienceYears: experienceYears || 0,
      consultationFee: consultationFee || 0,
      createdBy: req.user._id,
    }], { session });

    await logAudit("DOCTOR_CREATED", req.user._id, { targetUser: doctor._id, details: { specialization } });
    await session.commitTransaction();

    res.status(201).json({
      message: "Doctor created successfully",
      doctor: { id: doctor._id, name: doctor.name, email: doctor.email, role: doctor.role, specialization: doctor.specialization },
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

export const createReceptionist = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { name, email, password, phone } = req.body;

    const exists = await User.findOne({ email }).session(session);
    if (exists) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashed = await bcrypt.hash(password, 12);
    const [receptionist] = await User.create([{
      name, email, password: hashed, role: "receptionist", phone, createdBy: req.user._id,
    }], { session });

    await logAudit("RECEPTIONIST_CREATED", req.user._id, { targetUser: receptionist._id });
    await session.commitTransaction();

    res.status(201).json({
      message: "Receptionist created successfully",
      receptionist: { id: receptionist._id, name: receptionist.name, email: receptionist.email, role: receptionist.role },
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

export const getAllDoctors = async (req, res) => {
  try {
    const { isActive, specialization } = req.query;
    let query = { role: "doctor", isDeleted: false };
    if (isActive !== undefined) query.isActive = isActive === "true";
    if (specialization) query.specialization = { $regex: specialization, $options: "i" };
    const doctors = await User.find(query).select("-password").sort({ createdAt: -1 });
    res.json({ total: doctors.length, doctors });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllReceptionists = async (req, res) => {
  try {
    const receptionists = await User.find({ role: "receptionist", isDeleted: false }).select("-password").sort({ createdAt: -1 });
    res.json({ total: receptionists.length, receptionists });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllPatients = async (req, res) => {
  try {
    const { search } = req.query;
    let query = { role: "patient", isDeleted: false };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    const patients = await User.find(query).select("-password").sort({ createdAt: -1 });
    res.json({ total: patients.length, patients });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deactivateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findOne({ _id: id, role: { $ne: "admin" } });
    if (!user) return res.status(404).json({ message: "User not found" });

    user.isActive = false;
    user.isDeleted = true;
    user.deletedAt = new Date();
    await user.save();

    await logAudit(user.role === "doctor" ? "DOCTOR_DEACTIVATED" : "RECEPTIONIST_DEACTIVATED", req.user._id, { targetUser: user._id });
    res.json({ message: `${user.role} deactivated successfully` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const reactivateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndUpdate(id, { isActive: true, isDeleted: false, deletedAt: null }, { new: true }).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User reactivated successfully", user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateSubscription = async (req, res) => {
  try {
    const { plan } = req.body;
    const admin = await User.findByIdAndUpdate(
      req.user._id,
      {
        subscriptionPlan: plan,
        subscriptionExpiry: plan !== "free" ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
      },
      { new: true }
    ).select("-password");

    await logAudit("SUBSCRIPTION_UPDATED", req.user._id, { details: { newPlan: plan } });
    res.json({ message: `Subscription updated to ${plan}`, subscriptionPlan: admin.subscriptionPlan, subscriptionExpiry: admin.subscriptionExpiry });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAdminDashboard = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const totalDoctors = await User.countDocuments({ role: "doctor", isDeleted: false });
    const activeDoctors = await User.countDocuments({ role: "doctor", isActive: true, isDeleted: false });
    const totalReceptionists = await User.countDocuments({ role: "receptionist", isDeleted: false });
    const totalPatients = await User.countDocuments({ role: "patient", isDeleted: false });
    const totalAppointments = await Appointment.countDocuments({ isDeleted: false });
    const monthlyAppointments = await Appointment.countDocuments({ createdAt: { $gte: startOfMonth }, isDeleted: false });
    const pendingAppointments = await Appointment.countDocuments({ status: "Pending", isDeleted: false });
    const completedAppointments = await Appointment.countDocuments({ status: "Completed", isDeleted: false });
    const cancelledAppointments = await Appointment.countDocuments({ status: "Cancelled", isDeleted: false });
    const totalPrescriptions = await Prescription.countDocuments({ isDeleted: false });
    const monthlyPrescriptions = await Prescription.countDocuments({ createdAt: { $gte: startOfMonth }, isDeleted: false });

    const diagnosisTrends = await DiagnosisLog.aggregate([
      { $match: { createdAt: { $gte: startOfMonth }, isDeleted: false } },
      { $group: { _id: "$finalDiagnosis", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    const appointmentsByStatus = await Appointment.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const monthlyTrend = await Appointment.aggregate([
      { $match: { createdAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) }, isDeleted: false } },
      { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const topDoctors = await User.find({ role: "doctor", isDeleted: false })
      .select("name specialization performanceMetrics")
      .sort({ "performanceMetrics.totalAppointments": -1 })
      .limit(5);

    const recentAppointments = await Appointment.find({ isDeleted: false })
      .populate("patientId", "name email")
      .populate("doctorId", "name specialization")
      .sort({ createdAt: -1 })
      .limit(10);

    const revenueData = await Appointment.aggregate([
      { $match: { status: "Completed", isDeleted: false } },
      { $lookup: { from: "users", localField: "doctorId", foreignField: "_id", as: "doctor" } },
      { $unwind: "$doctor" },
      { $group: { _id: null, totalRevenue: { $sum: "$doctor.consultationFee" }, monthlyRevenue: { $sum: { $cond: [{ $gte: ["$createdAt", startOfMonth] }, "$doctor.consultationFee", 0] } } } },
    ]);

    const admin = await User.findById(req.user._id).select("subscriptionPlan subscriptionExpiry patientCount");

    res.json({
      overview: { totalDoctors, activeDoctors, totalReceptionists, totalPatients, totalAppointments, monthlyAppointments, pendingAppointments, completedAppointments, cancelledAppointments, totalPrescriptions, monthlyPrescriptions },
      revenue: { total: revenueData[0]?.totalRevenue || 0, monthly: revenueData[0]?.monthlyRevenue || 0, currency: "PKR", note: "Simulated based on consultation fees" },
      subscription: { plan: admin.subscriptionPlan, expiry: admin.subscriptionExpiry, patientCount: admin.patientCount, patientLimit: admin.subscriptionPlan === "free" ? 20 : "Unlimited" },
      diagnosisTrends, appointmentsByStatus, monthlyTrend, topDoctors, recentAppointments,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAuditLogs = async (req, res) => {
  try {
    const { action, userId, limit = 50, page = 1 } = req.query;
    let query = {};
    if (action) query.action = action;
    if (userId) query.performedBy = userId;

    const logs = await AuditLog.find(query)
      .populate("performedBy", "name email role")
      .populate("targetUser", "name email role")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await AuditLog.countDocuments(query);
    res.json({ total, page: parseInt(page), logs });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};