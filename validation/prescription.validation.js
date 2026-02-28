import { z } from "zod";

const medicineSchema = z.object({
  name: z.string().min(1, "Medicine name is required"),
  dosage: z.string().min(1, "Dosage is required"),
  frequency: z.string().min(1, "Frequency is required"),
  duration: z.string().min(1, "Duration is required"),
  instructions: z.string().optional(),
  route: z.string().optional(),
});

export const createPrescriptionSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required"),
  appointmentId: z.string().optional(),
  diagnosis: z.string().min(5, "Diagnosis must be at least 5 characters"),
  icdCode: z.string().optional(),
  medicines: z.array(medicineSchema).min(1, "At least one medicine is required"),
  instructions: z.string().optional(),
  followUpDate: z.string().optional(),
  followUpNotes: z.string().optional(),
  tests: z.array(z.object({ testName: z.string(), urgency: z.enum(["Routine", "Urgent", "Emergency"]).optional(), notes: z.string().optional() })).optional(),
});

export const aiExplanationSchema = z.object({
  prescriptionId: z.string().min(1, "Prescription ID is required"),
  language: z.enum(["english", "urdu"]).optional(),
});