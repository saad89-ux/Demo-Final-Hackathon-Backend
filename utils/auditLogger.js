import AuditLog from "../models/AuditLog.model.js";

export const logAudit = async (action, performedBy, details = {}) => {
  try {
    await AuditLog.create({ action, performedBy, ...details });
  } catch (error) {
    console.error("⚠️ Audit log error:", error.message);
  }
};