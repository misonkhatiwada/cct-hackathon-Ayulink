import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Stethoscope,
  FlaskConical,
  Pill,
  BarChart3,
  QrCode,
  CheckCircle2,
  Play,
  Upload,
  ArrowRight,
  Lock,
  UserCheck,
  Clock,
  FileText,
  Sparkles,
  Bell,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  UserRole,
  Appointment,
  MedicineItem,
  LabOrderStatus,
} from '../types/ayulink';
import type { DatabaseState } from '../types/seedData';
import { AyuLogo } from './AyuLogo';
import { ayuApi } from '../services/api';

interface HospitalWebDashboardProps {
  state: DatabaseState;
  darkMode: boolean;
  activeRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onActionFeedback?: (msg: string) => void;
}

/**
 * Simplified 5-Step Hospital Operating System Navigation
 * 1. reception_queue      -> Booking, QR Check-In & Live Queue
 * 2. doctor_consultation  -> Doctor Exam -> (Either Request Lab Check OR Complete & Send to Pharmacy)
 * 3. lab_check            -> Pathology Lab Check & Report Upload
 * 4. pharmacy             -> Medicine Dispensing after Consultation
 * 5. admin_analytics      -> KPIs, Charts, Doctor Schedule & Audit Logs
 */
type SimpleStepId =
  | 'reception_queue'
  | 'doctor_consultation'
  | 'lab_check'
  | 'pharmacy'
  | 'admin_analytics';

const APPOINTMENT_TREND_DATA = [
  { day: 'Mon', appointments: 96 },
  { day: 'Tue', appointments: 118 },
  { day: 'Wed', appointments: 84 },
  { day: 'Thu', appointments: 134 },
  { day: 'Fri', appointments: 112 },
  { day: 'Sat', appointments: 74 },
];

export const HospitalWebDashboard: React.FC<HospitalWebDashboardProps> = ({
  state,
  darkMode,
  activeRole,
  onRoleChange,
  onActionFeedback,
}) => {
  const [activeStep, setActiveStep] = useState<SimpleStepId>('reception_queue');
  const [flowBanner, setFlowBanner] = useState<string | null>(null);

  useEffect(() => {
    if (activeRole === 'receptionist') setActiveStep('reception_queue');
    else if (activeRole === 'doctor') setActiveStep('doctor_consultation');
    else if (activeRole === 'lab_staff') setActiveStep('lab_check');
    else if (activeRole === 'pharmacist') setActiveStep('pharmacy');
    else if (activeRole === 'hospital_admin' || activeRole === 'super_admin') {
      setActiveStep((prev) => (prev === 'reception_queue' ? 'reception_queue' : 'admin_analytics'));
    }
  }, [activeRole]);

  // Selected Patient Appointment for Consultation / Lab / Pharmacy
  const [selectedAptId, setSelectedAptId] = useState<string>('apt-a24');

  // Simple Doctor Consultation Form State
  const [symptoms, setSymptoms] = useState('Mild chest palpitations and headache');
  const [diagnosis, setDiagnosis] = useState('Stage 1 Essential Hypertension & Viral Fever');
  const [clinicalNotes, setClinicalNotes] = useState('BP: 130/82 mmHg, Pulse: 76 bpm. Heart sounds normal.');
  const [followUpDate, setFollowUpDate] = useState('October 15, 2026');
  const [selectedLabTestId, setSelectedLabTestId] = useState('test-cbc');
  const [medicines, setMedicines] = useState<MedicineItem[]>([
    {
      name: 'Paracetamol',
      strength: '500mg',
      dosage: '1 tablet',
      frequency: '3 times/day',
      duration: '3 days',
      instructions: 'Take after food.',
    },
    {
      name: 'Amlodipine',
      strength: '5mg',
      dosage: '1 tablet',
      frequency: '1 time/day (Morning)',
      duration: '15 days',
      instructions: 'Take after breakfast.',
    },
  ]);
  const [newMedName, setNewMedName] = useState('');
  const [newMedDose, setNewMedDose] = useState('500mg · 1 tab · 2x/day');

  // Resolve active patient appointment (prioritize Mison's A-24 if booked, otherwise A-21)
  const misonApt = state.appointments.find((a) => a.patientId === 'pat-mison');
  const currentApt: Appointment =
    state.appointments.find((a) => a.id === selectedAptId) ||
    misonApt ||
    state.appointments[1] ||
    state.appointments[0];

  const currentPatientProfile =
    state.patientProfiles.find((p) => p.id === currentApt?.patientId) || state.patientProfiles[0];

  const patientLabOrders = state.labOrders.filter(
    (l) => l.patientId === (currentApt?.patientId || 'pat-mison')
  );

  const sumanDoctor = state.doctors.find((d) => d.id === 'doc-suman') || state.doctors[0];

  // ===========================================================================
  // STEP 1 HANDLERS: RECEPTION QR CHECK-IN & CALL PATIENT TO DOCTOR
  // ===========================================================================
  const handleCheckInPatient = async (apt: Appointment) => {
    try {
      await ayuApi.qrCheckIn({ qrToken: apt.qrCheckInToken });
      setSelectedAptId(apt.id);
      setFlowBanner(`✓ Checked in ${apt.patientName} (Token ${apt.token}). Ready for Doctor Consultation!`);
      onActionFeedback?.(`Checked in Token ${apt.token} (${apt.patientName})`);
    } catch (err: any) {
      onActionFeedback?.(err.message);
    }
  };

  const handleCallPatientToDoctor = async (apt: Appointment) => {
    try {
      await ayuApi.callNextPatient(apt.doctorId || 'doc-suman', apt.id);
      setSelectedAptId(apt.id);
      onRoleChange('doctor');
      setActiveStep('doctor_consultation');
      setFlowBanner(
        `🔔 Called Token ${apt.token} (${apt.patientName}) to ${apt.roomNumber} (${apt.doctorName}). Notification sent to Mobile App!`
      );
      onActionFeedback?.(`🔔 Notification sent to ${apt.patientName} (Token ${apt.token} -> ${apt.roomNumber})`);
    } catch (err: any) {
      onActionFeedback?.(err.message);
    }
  };

  const handleRingPatient = async (departmentLabel: string, customTitle?: string, customMessage?: string) => {
    try {
      const token = currentApt?.token || 'A-24';
      const patName = currentApt?.patientName || 'Mison Khatiwada';
      await ayuApi.notifyPatient({
        patientName: patName,
        token,
        department: departmentLabel,
        title: customTitle || `🔔 YOUR TURN · Token ${token}`,
        message:
          customMessage ||
          `${patName} (Token ${token}), please proceed to ${departmentLabel} now.`,
        referenceId: currentApt?.id || 'apt-a24',
      });
      setFlowBanner(
        `🔔 Live Call Notification sent to ${patName}'s Mobile App: "Proceed to ${departmentLabel}"!`
      );
      onActionFeedback?.(`🔔 Notification sent to ${patName} (${departmentLabel})`);
    } catch (err: any) {
      onActionFeedback?.(err.message);
    }
  };

  // ===========================================================================
  // STEP 2A HANDLER: DOCTOR REQUESTS LAB REPORT -> AUTO-ROUTES TO LAB CHECK
  // ===========================================================================
  const handleDoctorRequestLabCheck = async () => {
    try {
      const order = await ayuApi.orderLabTest({
        patientId: currentApt?.patientId || 'pat-mison',
        testId: selectedLabTestId,
        orderedByDoctorId: 'doc-suman',
        appointmentId: currentApt?.id,
        scheduledTime: 'Just now',
      });
      onRoleChange('lab_staff');
      setActiveStep('lab_check');
      setFlowBanner(
        `🔬 Doctor requested ${order.testName} (${order.orderCode}) for ${order.patientName} → Automatically routed to Lab Check!`
      );
      onActionFeedback?.(`Sent ${order.patientName} to Lab Check for ${order.testName}`);
    } catch (err: any) {
      onActionFeedback?.(err.message);
    }
  };

  // ===========================================================================
  // STEP 2B HANDLER: CONSULTATION COMPLETE -> AUTO-ROUTES TO PHARMACY
  // ===========================================================================
  const handleCompleteConsultationToPharmacy = async () => {
    try {
      const res = await ayuApi.createPrescription({
        appointmentId: currentApt?.id,
        patientId: currentApt?.patientId || 'pat-mison',
        doctorId: 'doc-suman',
        symptoms,
        clinicalNotes,
        diagnosis,
        medicines,
        followUpDate,
        completeConsultation: true,
      });
      onRoleChange('pharmacist');
      setActiveStep('pharmacy');
      setFlowBanner(
        `💊 Consultation Completed! E-Prescription ${res.prescription.rxCode} for ${res.prescription.patientName} automatically sent to Pharmacy!`
      );
      onActionFeedback?.(
        `Consultation Complete → Sent Prescription ${res.prescription.rxCode} to Pharmacy`
      );
    } catch (err: any) {
      onActionFeedback?.(err.message);
    }
  };

  // ===========================================================================
  // STEP 3 HANDLER: LAB UPLOADS REPORT -> CAN RETURN TO DOCTOR OR GO TO PHARMACY
  // ===========================================================================
  const handleLabUpdateStatus = async (orderId: string, status: LabOrderStatus, returnToDoctor = false) => {
    try {
      await ayuApi.updateLabOrderStatus(orderId, { status });
      if (returnToDoctor) {
        onRoleChange('doctor');
        setActiveStep('doctor_consultation');
        setFlowBanner(
          `✓ Lab Report Uploaded! Returned to Doctor Consultation to review report & send prescription to Pharmacy.`
        );
      } else {
        setFlowBanner(`✓ Lab status updated to "${status}". Report synced to Patient App & Doctor!`);
      }
      onActionFeedback?.(`Lab Order updated to ${status}`);
    } catch (err: any) {
      onActionFeedback?.(err.message);
    }
  };

  // ===========================================================================
  // STEP 4 HANDLER: PHARMACY DISPENSES MEDICINE
  // ===========================================================================
  const handlePharmacyStatus = async (orderId: string, status: string) => {
    try {
      await ayuApi.updatePharmacyOrderStatus(orderId, status);
      setFlowBanner(`✓ Pharmacy updated prescription status to "${status}"!`);
      onActionFeedback?.(`Pharmacy order updated to ${status}`);
    } catch (err: any) {
      onActionFeedback?.(err.message);
    }
  };

  const handleAddQuickMedicine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedName.trim()) return;
    setMedicines((prev) => [
      ...prev,
      {
        name: newMedName.trim(),
        strength: '500mg',
        dosage: '1 tablet',
        frequency: newMedDose,
        duration: '5 days',
        instructions: 'Take after food.',
      },
    ]);
    setNewMedName('');
  };

  const navSteps: Array<{
    id: SimpleStepId;
    stepNum: string;
    label: string;
    sub: string;
    icon: React.FC<{ className?: string }>;
    role: UserRole;
  }> = [
    {
      id: 'reception_queue',
      stepNum: '1',
      label: 'Reception & Queue',
      sub: 'QR Check-In & Call Patient',
      icon: Calendar,
      role: 'receptionist',
    },
    {
      id: 'doctor_consultation',
      stepNum: '2',
      label: 'Doctor Consultation',
      sub: 'Exam → Lab OR Pharmacy',
      icon: Stethoscope,
      role: 'doctor',
    },
    {
      id: 'lab_check',
      stepNum: '3',
      label: 'Lab Check',
      sub: 'If Doctor Requests Report',
      icon: FlaskConical,
      role: 'lab_staff',
    },
    {
      id: 'pharmacy',
      stepNum: '4',
      label: 'Pharmacy',
      sub: 'Dispense After Consultation',
      icon: Pill,
      role: 'pharmacist',
    },
    {
      id: 'admin_analytics',
      stepNum: '5',
      label: 'Hospital Overview',
      sub: 'KPIs, Schedule & Audit',
      icon: BarChart3,
      role: 'hospital_admin',
    },
  ];

  return (
    <div
      className={`flex flex-col min-h-[820px] w-full rounded-2xl border overflow-hidden transition-colors ${
        darkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
      }`}
    >
      {/* =====================================================================
          TOP CONNECTED WORKFLOW BAR (5 SIMPLE STEPS — NO CLUTTER!)
      ===================================================================== */}
      <div
        className={`p-4 border-b ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <AyuLogo size={26} />
            <div>
              <h1 className="text-sm font-bold tracking-tight">
                CITY HOSPITAL — CONNECTED CARE FLOW
              </h1>
              <p className="text-[11px] text-slate-500">
                Reception Check-In ➔ Doctor Consultation ➔ (Lab Check if requested) ➔ Pharmacy Dispensing
              </p>
            </div>
          </div>

          {/* Active Patient Selector & Instant Call Button */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">Active Patient:</span>
            <select
              value={currentApt?.id || ''}
              onChange={(e) => setSelectedAptId(e.target.value)}
              className={`h-9 px-3 rounded-xl border font-bold ${
                darkMode
                  ? 'bg-slate-950 border-slate-700 text-teal-400'
                  : 'bg-white border-slate-300 text-teal-800'
              }`}
            >
              {state.appointments.map((a) => (
                <option key={a.id} value={a.id}>
                  Token {a.token} · {a.patientName} ({a.status})
                </option>
              ))}
            </select>
            <button
              onClick={() =>
                handleRingPatient(
                  `${currentApt?.roomNumber || 'Room 4'} (${currentApt?.doctorName || 'Dr. Suman Sharma'})`
                )
              }
              className="h-9 px-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>🔔 Call / Notify Patient</span>
            </button>
          </div>
        </div>

        {/* 5-Step Connected Pipeline Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {navSteps.map((step) => {
            const Icon = step.icon;
            const isActive = activeStep === step.id;
            return (
              <button
                key={step.id}
                onClick={() => {
                  setActiveStep(step.id);
                  onRoleChange(step.role);
                }}
                className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                  isActive
                    ? 'bg-teal-600 border-teal-600 text-white shadow-xs'
                    : darkMode
                    ? 'bg-slate-950 border-slate-800 hover:border-teal-500 text-slate-200'
                    : 'bg-white border-slate-200 hover:border-teal-600 text-slate-800'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono text-xs font-bold shrink-0 ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-teal-50 dark:bg-slate-800 text-teal-600 dark:text-teal-400'
                  }`}
                >
                  {step.stepNum}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate flex items-center gap-1">
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{step.label}</span>
                  </div>
                  <div
                    className={`text-[10px] truncate mt-0.5 ${
                      isActive ? 'text-teal-100' : 'text-slate-500'
                    }`}
                  >
                    {step.sub}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* LIVE WORKFLOW TRANSITION BANNER */}
      {flowBanner && (
        <div className="bg-teal-600 text-white px-5 py-2.5 text-xs font-semibold flex items-center justify-between gap-3">
          <span>{flowBanner}</span>
          <button
            onClick={() => setFlowBanner(null)}
            className="text-teal-100 hover:text-white text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* =====================================================================
          MAIN CONTENT AREA FOR THE SELECTED STEP
      ===================================================================== */}
      <div className="flex-1 p-5 overflow-y-auto space-y-6">
        {/* ===================================================================
            STEP 1: RECEPTION & LIVE QUEUE
        =================================================================== */}
        {activeStep === 'reception_queue' && (
          <div className="space-y-5">
            {/* Simple 4 KPI Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              <div
                className={`p-4 rounded-xl border ${
                  darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50/70 border-slate-200'
                }`}
              >
                <span className="text-xs text-slate-500 block">Today's Patients</span>
                <span className="font-mono text-2xl font-bold mt-1 block">
                  {state.appointments.length}
                </span>
              </div>
              <div
                className={`p-4 rounded-xl border ${
                  darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50/70 border-slate-200'
                }`}
              >
                <span className="text-xs text-slate-500 block">Current Room 4 Token</span>
                <span className="font-mono text-2xl font-bold text-teal-600 mt-1 block">
                  {state.queues[0]?.currentToken || 'A-20'}
                </span>
              </div>
              <div
                className={`p-4 rounded-xl border ${
                  darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50/70 border-slate-200'
                }`}
              >
                <span className="text-xs text-slate-500 block">Pending Lab Checks</span>
                <span className="font-mono text-2xl font-bold mt-1 block">
                  {state.labOrders.filter((l) => l.status !== 'Report Ready').length}
                </span>
              </div>
              <div
                className={`p-4 rounded-xl border ${
                  darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50/70 border-slate-200'
                }`}
              >
                <span className="text-xs text-slate-500 block">Pharmacy Queue</span>
                <span className="font-mono text-2xl font-bold mt-1 block">
                  {state.pharmacyOrders.length}
                </span>
              </div>
            </div>

            {/* Patient Queue Table with 2 Simple Buttons: [1. QR Check-In] -> [2. Start Doctor Consultation] */}
            <div
              className={`rounded-2xl border overflow-hidden ${
                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold">
                    Step 1: Patient Bookings & Reception Queue
                  </h2>
                  <p className="text-xs text-slate-500">
                    When a patient books from the Flutter mobile app, they appear here immediately. Click "Start Consultation" to open Doctor view.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead
                    className={`border-b ${
                      darkMode
                        ? 'bg-slate-950 border-slate-800 text-slate-400'
                        : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                  >
                    <tr>
                      <th className="py-3 px-4">Token</th>
                      <th className="py-3 px-4">Patient Name</th>
                      <th className="py-3 px-4">Doctor & Dept</th>
                      <th className="py-3 px-4">Time</th>
                      <th className="py-3 px-4">eSewa Payment</th>
                      <th className="py-3 px-4">Current Status</th>
                      <th className="py-3 px-4 text-right">Next Step Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {state.appointments.map((apt) => (
                      <tr
                        key={apt.id}
                        className={
                          apt.patientId === 'pat-mison'
                            ? 'bg-teal-50/60 dark:bg-teal-950/30'
                            : ''
                        }
                      >
                        <td className="py-3.5 px-4 font-mono text-sm font-bold text-teal-600">
                          {apt.token}
                        </td>
                        <td className="py-3.5 px-4 font-bold">
                          {apt.patientName}
                          {apt.patientId === 'pat-mison' && (
                            <span className="ml-2 text-[10px] font-mono text-teal-600">
                              (MOBILE APP PATIENT)
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {apt.doctorName} · <span className="text-slate-500">{apt.departmentName}</span>
                        </td>
                        <td className="py-3.5 px-4 font-mono">{apt.time}</td>
                        <td className="py-3.5 px-4 text-emerald-600 font-bold">
                          ✓ {apt.paymentStatus}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold">{apt.status}</td>
                        <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                          {apt.status === 'CONFIRMED' && (
                            <button
                              onClick={() => handleCheckInPatient(apt)}
                              className="px-3 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-semibold inline-flex items-center gap-1.5"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              <span>1. Scan QR Check-In</span>
                            </button>
                          )}
                          <button
                            onClick={() => handleCallPatientToDoctor(apt)}
                            className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold inline-flex items-center gap-1.5"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>2. Call & Start Consultation →</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            STEP 2: DOCTOR CONSULTATION
            -> Decision A: Request Lab Report (Auto-goes to Step 3: Lab Check)
            -> Decision B: Complete Consultation (Auto-goes to Step 4: Pharmacy)
        =================================================================== */}
        {activeStep === 'doctor_consultation' && (
          <div className="space-y-5">
            {/* Patient Header Banner */}
            <div
              className={`p-5 rounded-2xl border flex flex-wrap items-center justify-between gap-4 ${
                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-teal-50/50 border-teal-200'
              }`}
            >
              <div className="space-y-1">
                <div className="text-xs font-bold text-teal-600">
                  STEP 2: DOCTOR CONSULTATION · DR. SUMAN SHARMA (CARDIOLOGY · ROOM 4)
                </div>
                <h2 className="text-lg font-bold">
                  Patient: {currentApt?.patientName} · Token{' '}
                  <span className="font-mono text-teal-600">{currentApt?.token}</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Age: {currentPatientProfile.age} yrs · Blood Group:{' '}
                  <strong className="text-red-600 font-mono">{currentPatientProfile.bloodGroup}</strong> ·
                  Known Allergies:{' '}
                  <strong className="text-red-600">{currentPatientProfile.allergies.join(', ')}</strong>
                </p>
              </div>

              {/* Latest Lab Report Status Pill & Ring Patient Button inside Doctor View */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() =>
                    handleRingPatient(
                      `${currentApt?.roomNumber || 'Room 4'} (${currentApt?.doctorName || 'Dr. Suman Sharma'})`
                    )
                  }
                  className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>🔔 Ring Patient to Room</span>
                </button>
                {patientLabOrders.length > 0 && (
                  <div
                    className={`px-3.5 py-2 rounded-xl border text-xs ${
                      patientLabOrders[0].status === 'Report Ready'
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 text-emerald-800 dark:text-emerald-300'
                        : 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    <div className="font-bold">
                      Latest Lab: {patientLabOrders[0].testName} — {patientLabOrders[0].status}
                    </div>
                    {patientLabOrders[0].status === 'Report Ready' && (
                      <div className="text-[11px]">
                        Hb: 15.1 g/dL · WBC: 7,200 · Platelets: 260,000 (Normal ✓)
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column: Clinical Findings & Prescription Form (7 cols) */}
              <div
                className={`lg:col-span-7 p-5 rounded-2xl border space-y-4 text-xs ${
                  darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <h3 className="text-sm font-bold border-b border-slate-200 dark:border-slate-800 pb-2">
                  1. Clinical Notes & E-Prescription Builder
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold block">Patient Symptoms</label>
                    <input
                      type="text"
                      value={symptoms}
                      onChange={(e) => setSymptoms(e.target.value)}
                      className={`w-full h-9 px-3 rounded-lg border ${
                        darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold block">Vitals & Examination</label>
                    <input
                      type="text"
                      value={clinicalNotes}
                      onChange={(e) => setClinicalNotes(e.target.value)}
                      className={`w-full h-9 px-3 rounded-lg border ${
                        darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2 space-y-1">
                    <label className="font-bold block">Diagnosis / Assessment</label>
                    <input
                      type="text"
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      className={`w-full h-9 px-3 rounded-lg border ${
                        darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold block">Follow-Up Date</label>
                    <input
                      type="text"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className={`w-full h-9 px-3 rounded-lg border ${
                        darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    />
                  </div>
                </div>

                {/* Medicines List */}
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="font-bold">Medicines for Pharmacy Dispensing:</div>
                  {medicines.map((m, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-xl border flex items-center justify-between ${
                        darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div>
                        <span className="font-bold text-teal-600">
                          {m.name} {m.strength}
                        </span>{' '}
                        · <span className="font-mono">{m.dosage}</span> ·{' '}
                        <span className="font-mono">{m.frequency}</span> ({m.duration}) —{' '}
                        <span className="text-slate-500">{m.instructions}</span>
                      </div>
                      <button
                        onClick={() => setMedicines(medicines.filter((_, i) => i !== idx))}
                        className="text-red-500 font-semibold"
                      >
                        Remove
                      </button>
                    </div>
                  ))}

                  <form onSubmit={handleAddQuickMedicine} className="flex gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Add medicine name (e.g. Pantoprazole)"
                      value={newMedName}
                      onChange={(e) => setNewMedName(e.target.value)}
                      className={`flex-1 h-9 px-3 rounded-lg border ${
                        darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    />
                    <button
                      type="submit"
                      className="px-3.5 h-9 rounded-lg bg-slate-900 dark:bg-slate-800 text-white font-semibold"
                    >
                      + Add Medicine
                    </button>
                  </form>
                </div>
              </div>

              {/* Right Column: THE TWO CLEAR NEXT-STEP DECISIONS (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                {/* OPTION A: NEED LAB REPORT FIRST -> GO TO LAB CHECK */}
                <div
                  className={`p-5 rounded-2xl border-2 border-amber-500/70 space-y-3 ${
                    darkMode ? 'bg-amber-950/20' : 'bg-amber-50/60'
                  }`}
                >
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-bold text-xs">
                    <FlaskConical className="w-4 h-4" />
                    <span>OPTION A: LAB REPORT NEEDED?</span>
                  </div>
                  <h3 className="text-sm font-bold">
                    Request Lab Check Before Finalizing
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Need a blood test or diagnostic report? Select the test below — clicking this button sends the patient directly to the <strong>Lab Check</strong> dashboard.
                  </p>

                  <select
                    value={selectedLabTestId}
                    onChange={(e) => setSelectedLabTestId(e.target.value)}
                    className={`w-full h-9 px-3 rounded-xl border text-xs font-semibold ${
                      darkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'
                    }`}
                  >
                    {state.labCatalog.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} — NPR {t.price}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={handleDoctorRequestLabCheck}
                    className="w-full min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
                  >
                    <FlaskConical className="w-4 h-4" />
                    <span>Request Lab Report & Go to Lab Check →</span>
                  </button>
                </div>

                {/* OPTION B: CONSULTATION COMPLETE -> GO TO PHARMACY */}
                <div
                  className={`p-5 rounded-2xl border-2 border-emerald-500/80 space-y-3 ${
                    darkMode ? 'bg-emerald-950/20' : 'bg-emerald-50/60'
                  }`}
                >
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                    <Pill className="w-4 h-4" />
                    <span>OPTION B: CONSULTATION COMPLETE!</span>
                  </div>
                  <h3 className="text-sm font-bold">
                    Complete Consultation & Send to Pharmacy
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Generates Digital E-Prescription ({medicines.length} medicines), updates the Patient Mobile App Timeline, and <strong>automatically opens the Pharmacy Dashboard</strong> to dispense medicine.
                  </p>

                  <button
                    onClick={handleCompleteConsultationToPharmacy}
                    className="w-full min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Complete Consultation & Go to Pharmacy →</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            STEP 3: LAB CHECK (PATHOLOGY)
            -> Collect Sample -> Upload Report -> Return to Doctor Consultation!
        =================================================================== */}
        {activeStep === 'lab_check' && (
          <div className="space-y-5">
            <div
              className={`p-5 rounded-2xl border flex flex-wrap items-center justify-between gap-4 ${
                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-amber-50/60 border-amber-200'
              }`}
            >
              <div>
                <span className="text-xs font-bold text-amber-700 dark:text-amber-300 block">
                  STEP 3: PATHOLOGY LAB CHECK WORKSPACE
                </span>
                <h2 className="text-lg font-bold">
                  Lab Tests Requested by Doctor
                </h2>
                <p className="text-xs text-slate-500">
                  Collect sample and upload the verified lab report. Once uploaded, return to Doctor Consultation to complete the prescription!
                </p>
              </div>
              <button
                onClick={() => {
                  onRoleChange('doctor');
                  setActiveStep('doctor_consultation');
                }}
                className="h-10 px-4 rounded-xl bg-teal-600 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <span>Back to Doctor Consultation →</span>
              </button>
            </div>

            <div className="space-y-3">
              {state.labOrders.map((ord) => (
                <div
                  key={ord.id}
                  className={`p-5 rounded-2xl border flex flex-wrap items-center justify-between gap-4 text-xs ${
                    darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-teal-600">
                        {ord.testName} ({ord.orderCode})
                      </span>
                      <span className="font-mono font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">
                        Status: {ord.status}
                      </span>
                    </div>
                    <div className="font-bold text-sm">Patient: {ord.patientName}</div>
                    <div className="text-slate-500">
                      Requested by: {ord.orderedByDoctorName || 'Dr. Suman Sharma'} · {ord.scheduledDate}
                    </div>
                    {ord.status === 'Report Ready' && (
                      <div className="text-emerald-600 font-semibold pt-1">
                        ✓ Report Uploaded: Hemoglobin 15.1 g/dL, WBC 7,200 /cumm, Platelets 260,000 (Normal)
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() =>
                        handleRingPatient(
                          'Pathology Lab Room 1 (Sample Collection)',
                          `🔬 LAB CALL · ${ord.testName}`,
                          `${ord.patientName}, please come to Pathology Lab Room 1 for your ${ord.testName} sample collection.`
                        )
                      }
                      className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold inline-flex items-center gap-1.5"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>🔔 Call to Lab</span>
                    </button>

                    <button
                      onClick={() => handleLabUpdateStatus(ord.id, 'Sample Collected', false)}
                      className={`px-3 py-2 rounded-xl border font-semibold ${
                        ord.status === 'Sample Collected'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      1. Sample Collected
                    </button>

                    <button
                      onClick={() => handleLabUpdateStatus(ord.id, 'Report Ready', false)}
                      className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold inline-flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>2. Upload Report (Send to Mobile App)</span>
                    </button>

                    <button
                      onClick={() => handleLabUpdateStatus(ord.id, 'Report Ready', true)}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-1.5"
                    >
                      <span>3. Upload & Return to Doctor →</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===================================================================
            STEP 4: PHARMACY (DISPENSARY)
            -> Automatically receives E-Prescription after Doctor completes consultation!
        =================================================================== */}
        {activeStep === 'pharmacy' && (
          <div className="space-y-5">
            <div
              className={`p-5 rounded-2xl border flex flex-wrap items-center justify-between gap-4 ${
                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-emerald-50/60 border-emerald-200'
              }`}
            >
              <div>
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 block">
                  STEP 4: HOSPITAL PHARMACY DISPENSARY
                </span>
                <h2 className="text-lg font-bold">
                  E-Prescriptions Sent from Doctor Consultation
                </h2>
                <p className="text-xs text-slate-500">
                  Verify the doctor's digital prescription and dispense medicines to the patient.
                </p>
              </div>
            </div>

            <div className="space-y-3.5">
              {state.pharmacyOrders.map((ord) => (
                <div
                  key={ord.id}
                  className={`p-5 rounded-2xl border space-y-3 text-xs ${
                    darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <span className="font-mono font-bold text-sm text-teal-600">
                        E-Prescription {ord.rxCode} · Order {ord.orderCode}
                      </span>
                      <div className="font-bold text-sm mt-0.5">
                        Patient: {ord.patientName} · Total Bill:{' '}
                        <span className="font-mono text-teal-600">NPR {ord.totalAmount}</span>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-lg bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-bold">
                      Status: {ord.status}
                    </span>
                  </div>

                  {/* Prescribed Medicines Breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {ord.medicines.map((m, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-xl border ${
                          darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="font-bold text-teal-600">
                          {m.name} {m.strength}
                        </div>
                        <div className="font-mono text-[11px]">
                          {m.dosage} · {m.frequency} · {m.duration}
                        </div>
                        <div className="text-slate-500 text-[11px]">{m.instructions}</div>
                      </div>
                    ))}
                  </div>

                  {/* Simple Pharmacy Workflow + Call Button */}
                  <div className="pt-2 flex flex-wrap items-center justify-end gap-2">
                    <button
                      onClick={() =>
                        handleRingPatient(
                          'City Hospital Pharmacy Counter 2',
                          `💊 PHARMACY CALL · ${ord.rxCode}`,
                          `${ord.patientName}, please come to City Hospital Pharmacy Counter 2 to collect your medicines (${ord.rxCode}).`
                        )
                      }
                      className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold inline-flex items-center gap-1.5"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>🔔 Call Patient to Counter</span>
                    </button>
                    <button
                      onClick={() => handlePharmacyStatus(ord.id, 'Preparing')}
                      className={`px-3.5 py-2 rounded-xl border font-semibold ${
                        ord.status === 'Preparing'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      1. Accept & Prepare
                    </button>
                    <button
                      onClick={() => handlePharmacyStatus(ord.id, 'Ready')}
                      className={`px-3.5 py-2 rounded-xl border font-semibold ${
                        ord.status === 'Ready'
                          ? 'bg-teal-600 text-white border-teal-600'
                          : 'border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      2. Mark Ready for Pickup
                    </button>
                    <button
                      onClick={() => handlePharmacyStatus(ord.id, 'Delivered')}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold inline-flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>3. Dispense & Complete (Delivered ✓)</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===================================================================
            STEP 5: HOSPITAL OVERVIEW, DOCTOR AVAILABILITY & AUDIT LOGS
        =================================================================== */}
        {activeStep === 'admin_analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Weekly Appointments Chart */}
              <div
                className={`p-4 rounded-2xl border space-y-3 ${
                  darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <h3 className="text-sm font-bold">Weekly Outpatient Volume (City Hospital)</h3>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={APPOINTMENT_TREND_DATA}>
                      <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1e293b' : '#f1f5f9'} />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="appointments" fill="#0D9488" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Doctor Real-Time Availability Control */}
              <div
                className={`p-4 rounded-2xl border space-y-3 text-xs ${
                  darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <h3 className="text-sm font-bold">Doctor Availability & Slot Control</h3>
                <p className="text-slate-500">
                  Toggle Dr. Suman Sharma's slots in real time (synced with Flutter Mobile App):
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {state.slots
                    .filter((s) => s.doctorId === 'doc-suman')
                    .map((slot) => (
                      <button
                        key={slot.id}
                        disabled={slot.status === 'CONFIRMED'}
                        onClick={() =>
                          ayuApi
                            .updateDoctorAvailability(sumanDoctor.id, { slotIdToToggle: slot.id })
                            .then(() => onActionFeedback?.(`Toggled slot ${slot.time}`))
                        }
                        className={`p-2.5 rounded-xl border text-left ${
                          slot.status === 'CONFIRMED'
                            ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-300'
                            : slot.status === 'BLOCKED'
                            ? 'bg-red-50 dark:bg-red-950/30 border-red-200 text-red-600'
                            : darkMode
                            ? 'bg-slate-950 border-slate-800'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="font-mono font-bold">{slot.time}</div>
                        <div className="text-[10px]">{slot.status}</div>
                      </button>
                    ))}
                </div>
              </div>
            </div>

            {/* Security Audit Logs */}
            <div
              className={`rounded-2xl border overflow-hidden ${
                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-teal-600" />
                  <span>Security & Clinical Audit Trail</span>
                </h3>
                <span className="font-mono text-xs text-teal-600">{state.auditLogs.length} Logged Actions</span>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3">Time</th>
                    <th className="p-3">Actor</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {state.auditLogs.slice(0, 8).map((log) => (
                    <tr key={log.id}>
                      <td className="p-3 font-mono text-[11px]">{log.timestamp}</td>
                      <td className="p-3 font-semibold">{log.actorName}</td>
                      <td className="p-3 font-bold text-teal-600">{log.action}</td>
                      <td className="p-3 text-slate-500">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
