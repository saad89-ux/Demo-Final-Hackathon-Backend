import { z } from "zod";

export const symptomCheckerSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required"),
  appointmentId: z.string().optional(),
  symptoms: z.union([
    z.array(z.string().min(1)).min(1, "At least one symptom required"),
    z.string().min(1, "Symptoms are required"),
  ]).transform((val) => (typeof val === "string" ? [val] : val)),
  patientAge: z.number().positive().max(150).optional(),
  patientGender: z.enum(["Male", "Female", "Other"]).optional(),
  medicalHistory: z.string().max(1000).optional(),
  additionalNotes: z.string().max(1000).optional(),
});

export const prescriptionExplainSchema = z.object({
  prescriptionId: z.string().min(1, "Prescription ID is required"),
  language: z.enum(["english", "urdu"]).optional().default("english"),
});