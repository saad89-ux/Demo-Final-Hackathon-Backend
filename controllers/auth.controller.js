import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.model.js";
import Patient from "../models/Patient.model.js";
import { logAudit } from "../utils/auditLogger.js";

export const registerPatient = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { name, email, password, phone, gender, dateOfBirth, bloodGroup, address, allergies, chronicConditions, emergencyContact } = req.body;

    const exists = await User.findOne({ email }).session(session);
    if (exists) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashed = await bcrypt.hash(password, 12);

    const [user] = await User.create([{
      name, email, password: hashed, role: "patient",
      phone, gender, bloodGroup, address,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      allergies: allergies || [],
      chronicConditions: chronicConditions || [],
      emergencyContact,
    }], { session });

    await Patient.create([{ userId: user._id, allergies: allergies || [], chronicConditions: chronicConditions || [] }], { session });

    await User.findOneAndUpdate({ role: "admin" }, { $inc: { patientCount: 1 } }, { session });

    await logAudit("PATIENT_REGISTERED", user._id, { targetUser: user._id });

    await session.commitTransaction();

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "24h" });

    res.status(201).json({
      message: "Patient registered successfully",
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email, isDeleted: false });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });
    if (!user.isActive) return res.status(403).json({ message: "Account deactivated. Contact admin." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "24h" });

    await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });
    await logAudit("USER_LOGIN", user._id, { details: { role: user.role } });

    res.json({
      message: "Login successful",
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, specialization: user.specialization, subscriptionPlan: user.subscriptionPlan },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (user.role === "patient") {
      const patientProfile = await Patient.findOne({ userId: user._id });
      return res.json({ user, patientProfile });
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(401).json({ message: "Current password is incorrect" });

    const hashed = await bcrypt.hash(newPassword, 12);
    await User.findByIdAndUpdate(req.user._id, { password: hashed });
    res.json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};