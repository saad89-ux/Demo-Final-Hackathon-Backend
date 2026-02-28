import mongoose from "mongoose";
import Appointment from "../models/Appointment.model.js";
import User from "../models/User.model.js";
import { logAudit } from "../utils/auditLogger.js";

export const bookAppointment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { patientId, doctorId, appointmentDate, timeSlot, type, reason, symptoms } = req.body;

    const doctor = await User.findOne({ _id: doctorId, role: "doctor", isActive: true }).session(session);
    if (!doctor) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Doctor not found or inactive" });
    }

    const patient = await User.findOne({ _id: patientId, role: "patient", isDeleted: false }).session(session);
    if (!patient) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Patient not found" });
    }

    if (req.user.role === "patient" && req.user._id.toString() !== patientId) {
      await session.abortTransaction();
      return res.status(403).json({ message: "You can only book appointments for yourself" });
    }

    const conflict = await Appointment.findOne({
      doctorId,
      appointmentDate: new Date(appointmentDate),
      "timeSlot.startTime": timeSlot.startTime,
      status: { $nin: ["Cancelled", "No-Show"] },
      isDeleted: false,
    }).session(session);

    if (conflict) {
      await session.abortTransaction();
      return res.status(409).json({ message: "This time slot is already booked. Please choose another slot." });
    }

    const [appointment] = await Appointment.create(
      [
        {
          patientId,
          doctorId,
          bookedBy: req.user._id,
          appointmentDate: new Date(appointmentDate),
          timeSlot,
          type: type || "In-Person",
          reason,
          symptoms: symptoms || [],
          status: "Pending",
          statusHistory: [{ status: "Pending", changedBy: req.user._id, reason: "Appointment booked" }],
        },
      ],
      { session }
    );

    await User.findByIdAndUpdate(doctorId, { $inc: { "performanceMetrics.totalAppointments": 1 } }, { session });
    await logAudit("APPOINTMENT_BOOKED", req.user._id, {
      targetAppointment: appointment._id,
      targetUser: patientId,
      details: { doctorId, appointmentDate, type },
    });
    await session.commitTransaction();

    const populated = await Appointment.findById(appointment._id)
      .populate("patientId", "name email phone")
      .populate("doctorId", "name specialization consultationFee")
      .populate("bookedBy", "name role");

    res.status(201).json({ message: "Appointment booked successfully", appointment: populated });
  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
};

export const updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    const appointment = await Appointment.findOne({ _id: id, isDeleted: false });
    if (!appointment) return res.status(404).json({ message: "Appointment not found" });

    if (req.user.role === "patient") {
      if (appointment.patientId.toString() !== req.user._id.toString())
        return res.status(403).json({ message: "Access denied" });
      if (status !== "Cancelled")
        return res.status(403).json({ message: "Patients can only cancel appointments" });
    }

    if (req.user.role === "doctor") {
      if (appointment.doctorId.toString() !== req.user._id.toString())
        return res.status(403).json({ message: "You can only manage your own appointments" });
      if (!["Confirmed", "Completed", "Cancelled", "No-Show"].includes(status))
        return res.status(400).json({ message: "Invalid status" });
    }

    const previousStatus = appointment.status;
    appointment.status = status;

    if (status === "Cancelled") {
      appointment.cancelledBy = req.user._id;
      appointment.cancellationReason = reason || "No reason provided";
      appointment.cancelledAt = new Date();
    }

    appointment.statusHistory.push({
      status,
      changedBy: req.user._id,
      changedAt: new Date(),
      reason: reason || `Status changed to ${status}`,
    });
    await appointment.save();

    const actionMap = {
      Confirmed: "APPOINTMENT_CONFIRMED",
      Completed: "APPOINTMENT_COMPLETED",
      Cancelled: "APPOINTMENT_CANCELLED",
    };
    if (actionMap[status]) {
      await logAudit(actionMap[status], req.user._id, {
        targetAppointment: appointment._id,
        details: { previousStatus, newStatus: status },
      });
    }

    if (status === "Completed") {
      await User.findByIdAndUpdate(appointment.doctorId, {
        $inc: { "performanceMetrics.totalPatientsSeen": 1 },
      });
    }

    const populated = await Appointment.findById(id)
      .populate("patientId", "name email phone")
      .populate("doctorId", "name specialization");

    res.json({ message: `Appointment ${status.toLowerCase()} successfully`, appointment: populated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const addDoctorNotes = async (req, res) => {
  try {
    const { id } = req.params;
    const { doctorNotes, vitalSigns } = req.body;

    const appointment = await Appointment.findOne({ _id: id, isDeleted: false });
    if (!appointment) return res.status(404).json({ message: "Appointment not found" });

    if (appointment.doctorId.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Only the assigned doctor can add notes" });

    appointment.doctorNotes = doctorNotes;
    if (vitalSigns) appointment.vitalSigns = vitalSigns;
    await appointment.save();

    res.json({ message: "Doctor notes added successfully", appointment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getDoctorAppointments = async (req, res) => {
  try {
    const { status, date, startDate, endDate } = req.query;
    const doctorId = req.user.role === "admin" ? req.params.doctorId : req.user._id;
    let query = { doctorId, isDeleted: false };

    if (status) query.status = status;
    if (date) {
      const d = new Date(date);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      query.appointmentDate = { $gte: d, $lt: nextDay };
    } else if (startDate && endDate) {
      query.appointmentDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const appointments = await Appointment.find(query)
      .populate("patientId", "name email phone gender dateOfBirth")
      .populate("bookedBy", "name role")
      .sort({ appointmentDate: 1, "timeSlot.startTime": 1 });

    res.json({ total: appointments.length, appointments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getPatientAppointments = async (req, res) => {
  try {
    const patientId = req.user.role === "patient" ? req.user._id : req.params.patientId;
    const { status } = req.query;
    let query = { patientId, isDeleted: false };
    if (status) query.status = status;

    const appointments = await Appointment.find(query)
      .populate("doctorId", "name specialization consultationFee profileImage")
      .sort({ appointmentDate: -1 });

    res.json({ total: appointments.length, appointments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const appointment = await Appointment.findOne({ _id: id, isDeleted: false })
      .populate("patientId", "name email phone gender dateOfBirth bloodGroup allergies chronicConditions")
      .populate("doctorId", "name specialization qualification consultationFee")
      .populate("bookedBy", "name role")
      .populate("prescriptionId")
      .populate("diagnosisLogId");

    if (!appointment) return res.status(404).json({ message: "Appointment not found" });

    if (req.user.role === "patient" && appointment.patientId._id.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Access denied" });
    if (req.user.role === "doctor" && appointment.doctorId._id.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Access denied" });

    res.json(appointment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllAppointments = async (req, res) => {
  try {
    const { status, doctorId, patientId, date, page = 1, limit = 20 } = req.query;
    let query = { isDeleted: false };

    if (status) query.status = status;
    if (doctorId) query.doctorId = doctorId;
    if (patientId) query.patientId = patientId;
    if (date) {
      const d = new Date(date);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      query.appointmentDate = { $gte: d, $lt: nextDay };
    }

    const appointments = await Appointment.find(query)
      .populate("patientId", "name email")
      .populate("doctorId", "name specialization")
      .sort({ appointmentDate: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Appointment.countDocuments(query);
    res.json({ total, page: parseInt(page), appointments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getAvailableDoctors = async (req, res) => {
  try {
    const { specialization } = req.query;
    let query = { role: "doctor", isActive: true, isDeleted: false };
    if (specialization) query.specialization = { $regex: specialization, $options: "i" };

    const doctors = await User.find(query)
      .select("name specialization qualification experienceYears consultationFee availableSlots performanceMetrics profileImage")
      .sort({ "performanceMetrics.averageRating": -1 });

    res.json({ total: doctors.length, doctors });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};