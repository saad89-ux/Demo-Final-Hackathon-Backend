const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

const callGemini = async (prompt, timeoutMs = 15000) => {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "your_gemini_api_key_here") {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Gemini API error ${response.status}: ${errorData?.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Empty response from Gemini API");

    const cleanText = text.replace(/```json\n?|```\n?/g, "").trim();
    return JSON.parse(cleanText);
  } finally {
    clearTimeout(timeout);
  }
};

// Feature 1: Smart Symptom Checker
export const runSymptomChecker = async ({ symptoms, age, gender, medicalHistory, additionalNotes }) => {
  const prompt = `
You are a clinical decision support AI. Analyze patient details and return ONLY valid JSON.

Patient:
- Age: ${age || "Not specified"}
- Gender: ${gender || "Not specified"}
- Symptoms: ${Array.isArray(symptoms) ? symptoms.join(", ") : symptoms}
- Medical History: ${medicalHistory || "None"}
- Notes: ${additionalNotes || "None"}

Return this exact JSON:
{
  "possibleConditions": [{"condition": "Name", "probability": "High|Medium|Low", "description": "Brief description"}],
  "riskLevel": "Low|Medium|High|Critical",
  "suggestedTests": ["Test 1", "Test 2"],
  "urgencyAdvice": "How urgently this should be addressed",
  "disclaimer": "This is AI assistance only. Final diagnosis must be made by a licensed physician."
}`.trim();

  try {
    const startTime = Date.now();
    const parsed = await callGemini(prompt);
    return { success: true, data: parsed, responseTime: Date.now() - startTime, aiUsed: true, aiFailed: false };
  } catch (error) {
    console.error("⚠️ AI Symptom Checker failed:", error.message);
    return {
      success: false, aiUsed: true, aiFailed: true, aiError: error.message,
      data: {
        possibleConditions: [],
        riskLevel: "Unknown",
        suggestedTests: [],
        urgencyAdvice: "AI unavailable. Please consult doctor for proper evaluation.",
        disclaimer: "AI service temporarily unavailable. Manual assessment required.",
      },
    };
  }
};

// Feature 2: Prescription Explanation
export const generatePrescriptionExplanation = async ({ prescription, patient, language = "english" }) => {
  const medicinesList = prescription.medicines
    .map((m) => `${m.name} ${m.dosage} - ${m.frequency} for ${m.duration}`)
    .join("; ");

  const langInstruction = language === "urdu"
    ? "Respond in simple Urdu (Roman Urdu is fine) that a Pakistani patient can understand."
    : "Respond in simple English. Avoid medical jargon.";

  const prompt = `
You are a medical communication AI. Explain this prescription simply.
${langInstruction}

Diagnosis: ${prescription.diagnosis}
Medicines: ${medicinesList}
Instructions: ${prescription.instructions || "None"}
Follow-up: ${prescription.followUpDate ? new Date(prescription.followUpDate).toDateString() : "As needed"}

Return ONLY this valid JSON:
{
  "patientFriendlyExplanation": "Simple 2-3 sentence explanation",
  "medicineGuide": [{"name": "Medicine", "purpose": "What it does", "howToTake": "When and how"}],
  "lifestyleRecommendations": ["Tip 1", "Tip 2", "Tip 3"],
  "preventiveAdvice": ["Advice 1", "Advice 2"],
  "importantWarnings": ["Warning if any"]
}`.trim();

  try {
    const parsed = await callGemini(prompt);
    return { success: true, data: parsed, aiUsed: true, aiFailed: false };
  } catch (error) {
    console.error("⚠️ AI Prescription Explanation failed:", error.message);
    return {
      success: false, aiUsed: true, aiFailed: true, aiError: error.message,
      data: {
        patientFriendlyExplanation: "Please ask your doctor to explain your prescription.",
        medicineGuide: [],
        lifestyleRecommendations: ["Follow doctor's instructions", "Take medicines as prescribed", "Drink plenty of water"],
        preventiveAdvice: ["Consult doctor if symptoms worsen", "Attend follow-up appointments"],
        importantWarnings: ["AI explanation unavailable. Follow doctor's verbal instructions."],
      },
    };
  }
};

// Feature 3: Risk Flagging
export const analyzePatientRisk = async ({ diagnosisHistory, symptoms, conditions, visitCount, recentDays }) => {
  const logicFlags = [];

  if (visitCount && recentDays && visitCount >= 5 && recentDays <= 30) {
    logicFlags.push({
      flag: `High visit frequency: ${visitCount} visits in ${recentDays} days`,
      severity: "High",
      recommendation: "Review for chronic condition or treatment resistance",
    });
  }

  const diabetesWithInfection =
    conditions.some((c) => c.toLowerCase().includes("diabet")) &&
    symptoms.some((s) => s.toLowerCase().includes("fever") || s.toLowerCase().includes("infection"));

  if (diabetesWithInfection) {
    logicFlags.push({
      flag: "Diabetes combined with frequent infections",
      severity: "High",
      recommendation: "Monitor blood sugar levels and consider specialist referral",
    });
  }

  const prompt = `
You are a clinical risk assessment AI. Analyze patient history for risk patterns.

Symptoms: ${symptoms.join(", ") || "None"}
Chronic conditions: ${conditions.join(", ") || "None"}
Recent diagnoses: ${diagnosisHistory.join(", ") || "None"}
Visit frequency: ${visitCount || 0} visits

Return ONLY this valid JSON:
{
  "riskFlags": [{"flag": "Pattern description", "severity": "Low|Medium|High|Critical", "recommendation": "Clinical recommendation"}],
  "overallRisk": "Low|Medium|High|Critical",
  "immediateAction": "What doctor should do now",
  "monitoringAdvice": "What to monitor going forward"
}`.trim();

  try {
    const parsed = await callGemini(prompt);
    const allFlags = [...logicFlags, ...(parsed.riskFlags || [])];
    return {
      success: true,
      data: { ...parsed, riskFlags: allFlags, logicBasedFlags: logicFlags, aiBasedFlags: parsed.riskFlags || [] },
      aiUsed: true, aiFailed: false,
    };
  } catch (error) {
    console.error("⚠️ AI Risk Analysis failed:", error.message);
    const overallRisk = logicFlags.some((f) => f.severity === "High" || f.severity === "Critical") ? "High"
      : logicFlags.length > 0 ? "Medium" : "Unknown";
    return {
      success: false, aiUsed: true, aiFailed: true, aiError: error.message,
      data: {
        riskFlags: logicFlags, logicBasedFlags: logicFlags, aiBasedFlags: [],
        overallRisk,
        immediateAction: logicFlags.length > 0 ? "Review flagged patterns manually" : "Manual assessment required",
        monitoringAdvice: "AI risk analysis unavailable. Use clinical judgment.",
      },
    };
  }
};

// Feature 4: Predictive Analytics
export const generatePredictiveAnalytics = async ({ diagnosisTrends, appointmentData, month, totalPatients, commonSymptoms }) => {
  const prompt = `
You are a healthcare analytics AI.

Month: ${month}
Top diagnoses: ${diagnosisTrends.map((d) => `${d._id} (${d.count})`).join(", ") || "No data"}
Appointment data: ${JSON.stringify(appointmentData)}
Total patients: ${totalPatients || 0}
Common symptoms: ${commonSymptoms?.join(", ") || "Not tracked"}

Return ONLY this valid JSON:
{
  "mostCommonDiseases": [{"disease": "Name", "count": 0, "trend": "increasing|stable|decreasing", "recommendation": "Recommendation"}],
  "patientLoadForecast": {"nextWeek": "80-100 patients", "peakDays": ["Monday", "Wednesday"], "recommendation": "Staffing tip"},
  "seasonalInsights": "Brief seasonal health insight",
  "preventionOpportunities": ["Opportunity 1"],
  "doctorPerformanceInsights": "Workload distribution insight"
}`.trim();

  try {
    const parsed = await callGemini(prompt);
    return { success: true, data: parsed, aiUsed: true, aiFailed: false };
  } catch (error) {
    console.error("⚠️ AI Predictive Analytics failed:", error.message);
    return { success: false, aiUsed: true, aiFailed: true, aiError: error.message, data: null };
  }
};
