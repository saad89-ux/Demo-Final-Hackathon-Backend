import PDFDocument from "pdfkit";

export const generatePrescriptionPDF = (prescription, doctor, patient) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const chunks = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // Header
      doc.rect(0, 0, doc.page.width, 100).fill("#1a73e8");
      doc.fillColor("white").fontSize(22).font("Helvetica-Bold").text("AI Clinic Management", 50, 25);
      doc.fontSize(11).font("Helvetica").text("Smart Healthcare System", 50, 55).text("support@clinic.com", 50, 72);
      doc.fillColor("#333");

      // Prescription number
      doc.moveDown(3);
      doc.rect(40, 115, doc.page.width - 80, 2).fill("#1a73e8");
      doc.fillColor("#1a73e8").fontSize(14).font("Helvetica-Bold").text("PRESCRIPTION", 50, 130, { align: "center" });
      doc.fillColor("#666").fontSize(10).font("Helvetica").text(`${prescription.prescriptionNumber}`, 50, 148, { align: "center" });

      // Doctor & Patient info
      const y = 175;
      doc.rect(40, y, 240, 90).stroke("#ddd");
      doc.fillColor("#1a73e8").fontSize(9).font("Helvetica-Bold").text("DOCTOR INFORMATION", 50, y + 8);
      doc.fillColor("#333").fontSize(10).font("Helvetica-Bold").text(`Dr. ${doctor.name}`, 50, y + 22);
      doc.fontSize(9).font("Helvetica").fillColor("#555").text(`${doctor.specialization || "General Medicine"}`, 50, y + 36).text(`${doctor.qualification || "MBBS"}`, 50, y + 50).text(`${doctor.email}`, 50, y + 64);

      doc.rect(305, y, 250, 90).stroke("#ddd");
      doc.fillColor("#1a73e8").fontSize(9).font("Helvetica-Bold").text("PATIENT INFORMATION", 315, y + 8);
      doc.fillColor("#333").fontSize(10).font("Helvetica-Bold").text(patient.name, 315, y + 22);
      doc.fontSize(9).font("Helvetica").fillColor("#555").text(`Gender: ${patient.gender || "N/A"}`, 315, y + 36).text(`DOB: ${patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString() : "N/A"}`, 315, y + 50).text(`Phone: ${patient.phone || "N/A"}`, 315, y + 64);
      doc.fillColor("#333").fontSize(9).font("Helvetica").text(`Date: ${new Date(prescription.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, 315, y + 78);

      // Diagnosis
      doc.moveDown(5.5);
      doc.rect(40, doc.y, doc.page.width - 80, 35).fill("#f0f7ff").stroke("#d0e4ff");
      const diagY = doc.y + 8;
      doc.fillColor("#1a73e8").fontSize(10).font("Helvetica-Bold").text("Diagnosis:", 55, diagY);
      doc.fillColor("#333").fontSize(10).font("Helvetica").text(prescription.diagnosis, 130, diagY);

      // Medicines
      doc.moveDown(2);
      doc.fillColor("#1a73e8").fontSize(12).font("Helvetica-Bold").text("℞  Medicines");
      doc.moveDown(0.3);
      doc.rect(40, doc.y, doc.page.width - 80, 1).fill("#1a73e8");
      doc.moveDown(0.5);

      prescription.medicines.forEach((med) => {
        const medY = doc.y;
        doc.circle(50, medY + 5, 4).fill("#1a73e8");
        doc.fillColor("#333").fontSize(11).font("Helvetica-Bold").text(`${med.name} ${med.dosage}`, 60, medY);
        doc.fillColor("#555").fontSize(9).font("Helvetica").text(`${med.frequency}  |  Duration: ${med.duration}  |  Route: ${med.route || "Oral"}`, 60, medY + 15);
        if (med.instructions) doc.fillColor("#777").fontSize(9).text(`★ ${med.instructions}`, 60, medY + 27);
        doc.moveDown(med.instructions ? 2.5 : 2);
      });

      if (prescription.tests?.length > 0) {
        doc.moveDown(0.5);
        doc.fillColor("#1a73e8").fontSize(11).font("Helvetica-Bold").text("Recommended Tests");
        doc.moveDown(0.3);
        prescription.tests.forEach((test) => {
          doc.fillColor("#333").fontSize(9).font("Helvetica").text(`• ${test.testName}  [${test.urgency || "Routine"}]`, 55);
        });
      }

      if (prescription.instructions) {
        doc.moveDown(1);
        doc.fillColor("#1a73e8").fontSize(11).font("Helvetica-Bold").text("Special Instructions");
        doc.fillColor("#333").fontSize(9).font("Helvetica").moveDown(0.3).text(prescription.instructions, { indent: 15 });
      }

      if (prescription.followUpDate) {
        doc.moveDown(1);
        doc.rect(40, doc.y, doc.page.width - 80, 30).fill("#fff8e1").stroke("#ffd600");
        const fuY = doc.y + 8;
        doc.fillColor("#f57f17").fontSize(10).font("Helvetica-Bold").text(`Follow-up: ${new Date(prescription.followUpDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, 55, fuY);
      }

      if (prescription.aiExplanation?.patientFriendlyExplanation) {
        doc.moveDown(2);
        doc.fillColor("#2e7d32").fontSize(11).font("Helvetica-Bold").text("🤖 AI Patient Guide");
        doc.fillColor("#333").fontSize(9).font("Helvetica").moveDown(0.3).text(prescription.aiExplanation.patientFriendlyExplanation, { indent: 10 });
      }

      // Signature
      const sigY = doc.page.height - 120;
      doc.rect(350, sigY, 200, 1).stroke("#333");
      doc.fillColor("#333").fontSize(10).font("Helvetica-Bold").text(`Dr. ${doctor.name}`, 350, sigY + 5, { width: 200, align: "center" });
      doc.fillColor("#666").fontSize(9).font("Helvetica").text(doctor.specialization || "General Medicine", 350, sigY + 18, { width: 200, align: "center" });

      // Footer
      doc.rect(0, doc.page.height - 50, doc.page.width, 50).fill("#1a73e8");
      doc.fillColor("white").fontSize(8).text("Generated by AI Clinic Management System", 50, doc.page.height - 38, { align: "center" }).text("This document is confidential and intended for the named patient only.", 50, doc.page.height - 25, { align: "center" });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};