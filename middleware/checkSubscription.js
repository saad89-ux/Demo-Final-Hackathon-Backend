import User from "../models/User.model.js";

const getClinicAdmin = async () => {
  return await User.findOne({ role: "admin", isDeleted: false }).sort({ createdAt: 1 });
};

export const requireProPlan = async (req, res, next) => {
  try {
    const admin = await getClinicAdmin();
    if (!admin) return res.status(403).json({ message: "Clinic not configured.", code: "CLINIC_NOT_FOUND" });

    if (admin.subscriptionPlan !== "free" && admin.subscriptionExpiry) {
      if (new Date() > new Date(admin.subscriptionExpiry)) {
        return res.status(403).json({ message: "Your Pro plan has expired. Please renew.", currentPlan: admin.subscriptionPlan, expiredAt: admin.subscriptionExpiry, code: "SUBSCRIPTION_EXPIRED" });
      }
    }

    if (admin.subscriptionPlan === "free") {
      return res.status(403).json({ message: "AI features require Pro or Enterprise plan. Upgrade to access this feature.", currentPlan: "free", requiredPlan: "pro", upgradeEndpoint: "PUT /api/admin/subscription", code: "UPGRADE_REQUIRED" });
    }

    req.clinicPlan = admin.subscriptionPlan;
    req.clinicAdmin = admin._id;
    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const checkPatientLimit = async (req, res, next) => {
  try {
    const admin = await getClinicAdmin();
    if (!admin) return next();

    if (admin.subscriptionPlan === "free") {
      const FREE_LIMIT = parseInt(process.env.FREE_PLAN_PATIENT_LIMIT) || 20;
      const currentCount = admin.patientCount || 0;
      if (currentCount >= FREE_LIMIT) {
        return res.status(403).json({ message: `Free plan allows maximum ${FREE_LIMIT} patients. Upgrade to Pro for unlimited patients.`, currentCount, limit: FREE_LIMIT, currentPlan: "free", upgradeEndpoint: "PUT /api/admin/subscription", code: "PATIENT_LIMIT_REACHED" });
      }
    }
    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};