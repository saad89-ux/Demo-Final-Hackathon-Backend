import { z } from "zod";

export const symptomCheckerSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required"),
  appointmentId: z.string().optional(),
  symptoms: z.array(z.string()).min(1, "At least one symptom is required"),
  patientAge: z.number().min(0).max(150).optional(),
  patientGender: z.string().optional(),
  medicalHistory: z.string().optional(),
  additionalNotes: z.string().optional(),
});

export const saveDiagnosisSchema = z.object({
  diagnosisLogId: z.string().min(1, "Diagnosis log ID is required"),
  finalDiagnosis: z.string().min(3, "Final diagnosis must be at least 3 characters"),
  doctorNotes: z.string().optional(),
  icdCode: z.string().optional(),
});

export const ratingSchema = z.object({
  appointmentId: z.string().min(1, "Appointment ID is required"),
  doctorId: z.string().min(1, "Doctor ID is required"),
  rating: z.number().min(1).max(5),
  review: z.string().max(500).optional(),
});