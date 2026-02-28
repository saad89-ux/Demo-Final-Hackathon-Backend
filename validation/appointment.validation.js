import { z } from "zod";

export const bookAppointmentSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required"),
  doctorId: z.string().min(1, "Doctor ID is required"),
  appointmentDate: z.string().min(1, "Appointment date is required"),
  timeSlot: z.object({ startTime: z.string().min(1, "Start time is required"), endTime: z.string().optional() }),
  type: z.enum(["In-Person", "Online", "Follow-Up", "Emergency"]).optional(),
  reason: z.string().min(3, "Reason must be at least 3 characters"),
  symptoms: z.array(z.string()).optional(),
});

export const updateAppointmentStatusSchema = z.object({
  status: z.enum(["Pending", "Confirmed", "Completed", "Cancelled", "No-Show"]),
  reason: z.string().optional(),
});

export const addDoctorNotesSchema = z.object({
  doctorNotes: z.string().min(1, "Notes cannot be empty"),
  vitalSigns: z.object({
    bloodPressure: z.string().optional(),
    heartRate: z.string().optional(),
    temperature: z.string().optional(),
    weight: z.string().optional(),
    height: z.string().optional(),
    oxygenSaturation: z.string().optional(),
  }).optional(),
});