# AYULINK — FULL-STACK HEALTHCARE OPERATING SYSTEM

**One Health ID. Every Care Connected.**

AyuLink is a connected digital healthcare operating system designed for Nepal, uniting patients, doctors, hospitals, receptionists, pathology laboratories, pharmacies, insurance officers, and national administrators through a single real-time backend.

---

## 1. Monorepo Architecture

```text
ayulink/
│
├── apps/
│   ├── patient_mobile/        # Flutter & Dart Material 3 Patient Mobile App
│   └── web_dashboard/         # React + TypeScript Hospital / Doctor Web SaaS
│
├── server/                    # Node.js + Express + Socket.IO + Mongoose Schemas
│   ├── db/store.ts            # Persistent Store & Nepal Demo Seed Data
│   ├── models/                # 23 Healthcare Domain Entity Schemas
│   └── services/              # eSewa UAT HMAC-SHA256 & Gemini AI Ayu Assistant
│
├── src/                       # Unified Interactive Live OS Workbench (Port 3000)
├── docs/                      # Architecture & Security Documentation
├── .env.example               # Environment Variables Template
└── README.md
```

---

## 2. Demo Credentials & Role-Based Access Control (RBAC)

Use the top-bar **Dashboard Role Switcher** or `/api/auth/login` to test all 9 roles:

| Role | Demo User | Email | Scope & Permissions |
| :--- | :--- | :--- | :--- |
| **Patient** | Mison Khatiwada | `mison@ayulink.np` | Health ID `AL-NP-8F29K4`, Family profiles, Slot booking, eSewa UAT, Live Queue, Timeline, Ayu AI |
| **Doctor** | Dr. Suman Sharma | `suman.sharma@cityhospital.np` | Cardiology (Room 4), Assigned patients only, Call Next Patient, Clinical Consultation, e-Prescription, Order Lab Test, Real-time Availability |
| **Hospital Admin** | Prakash Adhikari | `admin@cityhospital.np` | City Hospital KPIs, Recharts Analytics, Department Stats, Doctor Utilization, Live Roster |
| **Receptionist** | Binita Gurung | `frontdesk@cityhospital.np` | QR Check-In Verification, Queue Management, Reschedule/Cancel (Blocked from clinical records via RBAC) |
| **Lab Staff** | Dipesh Shrestha | `pathology@cityhospital.np` | Pathology queue (`Booked` → `Sample Collected` → `Processing` → `Report Ready`), CBC Report Upload |
| **Pharmacist** | Kabita Poudel | `dispensary@cityhospital.np` | E-Prescription fulfillment (`New Prescription` → `Accepted` → `Preparing` → `Ready` → `Delivered`) |
| **Insurance Staff** | Nabin Subedi | `claims@cityhospital.np` | Nepal Health Insurance Board (HIB) policy & claim adjudication |
| **Super Admin** | National Governance | `governance@ayulink.gov.np` | Doctor & Hospital credential verification, Account suspension, Immutable Security Audit Logs |

---

## 3. Setup & Running Instructions

1. Copy `.env.example` to `.env` and configure optional keys (`GEMINI_API_KEY`, `MONGODB_URI`, `ESEWA_SECRET_KEY`).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the full-stack Express + Socket.IO + Vite server on port 3000:
   ```bash
   npm run dev
   ```
4. For the standalone Flutter mobile client in `apps/patient_mobile/`:
   ```bash
   cd apps/patient_mobile
   flutter pub get
   flutter run
   ```
