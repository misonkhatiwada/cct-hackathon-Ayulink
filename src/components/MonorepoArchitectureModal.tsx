import React from 'react';

export function showMonorepoModalContent() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
          <div className="font-mono font-bold text-teal-600">apps/patient_mobile/</div>
          <div className="font-bold text-sm">Flutter Patient Mobile App</div>
          <p className="text-slate-500">
            Material 3 · English / नेपाली / Roman Nepali · Atomic 04:59 Slot Hold · eSewa UAT Payment · Live Socket.IO Queue · Health Timeline · Ayu AI Assistant · Emergency Health ID QR.
          </p>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
          <div className="font-mono font-bold text-teal-600">apps/web_dashboard/ & src/</div>
          <div className="font-bold text-sm">React Hospital / Doctor SaaS</div>
          <p className="text-slate-500">
            8 RBAC Roles (Hospital Admin, Receptionist, Doctor, Nurse, Lab Staff, Pharmacist, Insurance Staff, Super Admin) · Recharts Analytics · QR Check-In · Clinical Consultation Workspace · Audit Logs.
          </p>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5">
          <div className="font-mono font-bold text-teal-600">server/ & server.ts</div>
          <div className="font-bold text-sm">Node.js + Express + Socket.IO</div>
          <p className="text-slate-500">
            23 Healthcare Domain Entities · HMAC-SHA256 eSewa UAT Verification · Atomic Slot Locking · Server-Side Gemini 3.8 Flash Ayu Assistant · RBAC & Audit Trail.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-bold text-sm">18-Step Live Hackathon Demo Walkthrough</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
          {[
            '01. Open Patient App → Switch language to नेपाली (or EN/Roman).',
            '02. Tap Doctors tab → Search "Heart doctor".',
            '03. Open Dr. Suman Sharma (Cardiologist · 12 yrs · NPR 800 · 4.8★).',
            '04. Select 3:30 PM slot → Observe 04:59 temporary atomic slot hold.',
            '05. Review Appointment Summary (shows selected family member).',
            '06. Click Pay with eSewa UAT (EPAYTEST HMAC-SHA256 signed request).',
            '07. Authorize payment → Backend verifies signature → ✓ Payment Verified & Confirmed.',
            '08. Watch Hospital Dashboard immediately receive NEW APPOINTMENT · Token A-24.',
            '09. Switch Dashboard Role to Doctor (Dr. Suman) → See A-24 Mison Khatiwada in Today’s Patients.',
            '10. View Patient Appointment Details (Arrive by 3:15 PM, Token A-24, Current A-20, 3 Ahead, 18 min wait).',
            '11. Receptionist scans Appointment QR → Status becomes WAITING / CHECKED IN.',
            '12. Doctor Dashboard updates A-24 Mison Khatiwada to WAITING.',
            '13. Doctor clicks CALL NEXT PATIENT → Patient App receives 🔔 YOUR TURN · Token A-24 · Room 4.',
            '14. Doctor opens Consultation Workspace → Creates Digital E-Prescription (Paracetamol 500mg).',
            '15. Patient Health Timeline updates with Appointment ✓, Consultation ✓, Prescription ✓.',
            '16. Doctor clicks Order Lab Test (CBC) → Lab Dashboard receives NEW LAB ORDER (Booked).',
            '17. Lab Staff clicks Upload Report (Report Ready) → Patient receives CBC report in Timeline.',
            '18. Open AYULINK HEALTH ID (AL-NP-8F29K4) → Simulate Paramedic QR Scan → Verify Audit Log.',
          ].map((step, idx) => (
            <div
              key={idx}
              className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-medium"
            >
              {step}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
