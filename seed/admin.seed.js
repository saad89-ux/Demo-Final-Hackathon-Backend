import dotenv from "dotenv";
dotenv.config();

import connectDB from "../config/db.js";
import User from "../models/User.model.js";
import bcrypt from "bcryptjs";

const seedAdmin = async () => {
  try {
    await connectDB();

    const existingAdmin = await User.findOne({ role: "admin" });
    if (existingAdmin) {
      console.log("✅ Admin already exists:", existingAdmin.email);
      console.log("   Plan:", existingAdmin.subscriptionPlan);
      process.exit(0);
    }

    const adminEmail = process.env.ADMIN_EMAIL || "admin@clinic.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123456";
    const adminName = process.env.ADMIN_NAME || "Super Admin";

    const hashed = await bcrypt.hash(adminPassword, 12);

    await User.create({
      name: adminName,
      email: adminEmail,
      password: hashed,
      role: "admin",
      subscriptionPlan: "pro",
      subscriptionExpiry: new Date(Date.now() + 365 * 24 * 3600 * 1000),
      isActive: true,
    });

    console.log("\n╔══════════════════════════════════════════════╗");
    console.log("║     ✅ Admin Seeded Successfully              ║");
    console.log("╠══════════════════════════════════════════════╣");
    console.log(`║  Email:    ${adminEmail.padEnd(34)}║`);
    console.log(`║  Password: ${adminPassword.padEnd(34)}║`);
    console.log(`║  Plan:     Pro (AI features enabled)         ║`);
    console.log("╚══════════════════════════════════════════════╝\n");

    process.exit(0);
  } catch (err) {
    console.error("❌ Seeding failed:", err.message);
    process.exit(1);
  }
};

seedAdmin();