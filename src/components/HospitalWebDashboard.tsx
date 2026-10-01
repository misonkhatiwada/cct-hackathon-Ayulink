import React, { useState } from 'react';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Stethoscope,
  Building2,
  ListOrdered,
  FileText,
  FlaskConical,
  Pill,
  CreditCard,
  ShieldCheck,
  BarChart3,
  Bell,
  Settings,
  LogOut,
  Search,
  QrCode,
  CheckCircle2,
  Clock,
  Play,
  Plus,
  Upload,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  FileSpreadsheet,
  UserCheck,
  AlertCircle,
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

type DashboardNavId =
  | 'dashboard'
  | 'appointments'
  | 'patients'
  | 'doctors'
  | 'departments'
  | 'queue'
  | 'prescriptions'
  | 'laboratory'
  | 'pharmacy'
  | 'payments'
  | 'insurance'
  | 'reports'
  | 'analytics'
  | 'audit_logs'
  | 'notifications'
  | 'settings';

const APPOINTMENT_TREND_DATA = [
  { day: 'Mon', appointments: 96, completed: 88 },
  { day: 'Tue', appointments: 118, completed: 110 },
  { day: 'Wed', appointments: 84, completed: 79 },
  { day: 'Thu', appointments: 134, completed: 124 },
  { day: 'Fri', appointments: 112, completed: 103 },
  { day: 'Sat', appointments: 74, completed: 68 },
];

const DEPARTMENT_STATS_DATA = [
  { department: 'Cardiology', patients: 42, revenueNpr: 33600 },
  { department: 'General Medicine', patients: 38, revenueNpr: 24700 },
  { department: 'Pediatrics', patients: 21, revenueNpr: 12600 },
  { department: 'Orthopedics', patients: 16, revenueNpr: 12800 },
  { department: 'Dermatology', patients: 11, revenueNpr: 7700 },
];

export const HospitalWebDashboard: React.FC<HospitalWebDashboardProps> = ({
  state,
  darkMode,
  activeRole,
  onRoleChange,
  onActionFeedback,
}) => {
  const [activeNav, setActiveNav] = useState<DashboardNavId>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Filters for Live Appointments Table (Section 15)
  const [aptSearch, setAptSearch] = useState('');
  const [filterDoctor, setFilterDoctor] = useState('ALL');
  const [filterDept, setFilterDept] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterPayment, setFilterPayment] = useState('ALL');

  // QR Check-In Modal State (Section 12)
  const [showQrScannerModal, setShowQrScannerModal] = useState(false);
  const [qrInputToken, setQrInputToken] = useState('');
  const [qrCheckInResult, setQrCheckInResult] = useState<{
    token: string;
    patientName: string;
    status: string;
  } | null>(null);

  // Clinical Consultation Workspace State (Sections 19, 20, 21)
  const [selectedConsultAptId, setSelectedConsultAptId] = useState<string>('apt-a24');
  const [authorizedPatientData, setAuthorizedPatientData] = useState<any | null>(null);
  const [rbacError, setRbacError] = useState<string | null>(null);

  const [symptoms, setSymptoms] = useState(
    'Intermittent mild chest palpitations, mild occipital headache after long work hours.'
  );
  const [clinicalNotes, setClinicalNotes] = useState(
    'BP: 130/82 mmHg, Pulse: 76 bpm regular. S1 S2 normal, no cardiac murmur. Lungs clear bilaterally.'
  );
  const [diagnosis, setDiagnosis] = useState('Stage 1 Essential Hypertension with Mild Viral Pyrexia');
  const [followUpDate, setFollowUpDate] = useState('October 15');
  const [referralNote, setReferralNote] = useState('None required — continue outpatient cardiology follow-up');
  const [medicines, setMedicines] = useState<MedicineItem[]>([
    {
      name: 'Paracetamol',
      strength: '500mg',
      dosage: '1 tablet',
      frequency: '3 times/day',
      duration: '3 days',
      instructions: 'Take after food.',
    },
  ]);

  const [newMedName, setNewMedName] = useState('');
  const [newMedStrength, setNewMedStrength] = useState('5mg');
  const [newMedDosage, setNewMedDosage] = useState('1 tablet');
  const [newMedFreq, setNewMedFreq] = useState('1 time/day');
  const [newMedDur, setNewMedDur] = useState('15 days');
  const [newMedInst, setNewMedInst] = useState('Take after breakfast.');

  // Role Label Map
  const roleDisplayNames: Record<UserRole, string> = {
    hospital_admin: 'Hospital Admin (City Hospital)',
    receptionist: 'Receptionist (Front Desk)',
    doctor: 'Doctor (Dr. Suman Sharma)',
    nurse: 'Nurse (Triage & Vitals)',
    lab_staff: 'Lab Staff (Pathology)',
    pharmacist: 'Pharmacist (Central Dispensary)',
    insurance_staff: 'Insurance Staff (HIB Desk)',
    super_admin: 'Super Admin (National Governance)',
    patient: 'Patient View',
  };

  // Filtered Appointments
  const filteredAppointments = state.appointments.filter((apt) => {
    // If role is doctor, scope strictly to Dr. Suman Sharma unless viewing full admin table
    if (activeRole === 'doctor' && activeNav === 'dashboard' && apt.doctorId !== 'doc-suman') {
      return false;
    }
    const q = aptSearch.toLowerCase().trim();
    const matchesSearch =
      !q ||
      apt.patientName.toLowerCase().includes(q) ||
      apt.token.toLowerCase().includes(q) ||
      apt.bookingId.toLowerCase().includes(q) ||
      apt.doctorName.toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (filterDoctor !== 'ALL' && apt.doctorId !== filterDoctor) return false;
    if (filterDept !== 'ALL' && apt.departmentName !== filterDept) return false;
    if (filterStatus !== 'ALL' && apt.status !== filterStatus) return false;
    if (filterPayment !== 'ALL' && apt.paymentStatus !== filterPayment) return false;
    return true;
  });

  // Live dynamic KPIs combined with baseline hospital volume (Section 14)
  const extraBookingsCount = Math.max(0, state.appointments.length - 4);
  const totalRevenueNpr =
    84500 +
    state.payments
      .filter((p) => p.status === 'VERIFIED' && !['pay-0021', 'pay-0022', 'pay-0023'].includes(p.id))
      .reduce((acc, p) => acc + p.totalAmount, 0);

  const sumanDoctor = state.doctors.find((d) => d.id === 'doc-suman') || state.doctors[0];
  const sumanSlots = state.slots.filter((s) => s.doctorId === 'doc-suman');

  // Latest Mison appointment (e.g., A-24) or fallback to A-21
  const consultTargetApt: Appointment =
    state.appointments.find((a) => a.id === selectedConsultAptId) ||
    state.appointments.find((a) => a.patientId === 'pat-mison') ||
    state.appointments[1] ||
    state.appointments[0];

  // Handlers
  const handleLoadAuthorizedPatient = async (patientId: string) => {
    setRbacError(null);
    try {
      const data = await ayuApi.getAuthorizedPatientRecord(
        patientId,
        activeRole,
        roleDisplayNames[activeRole]
      );
      setAuthorizedPatientData(data);
      onActionFeedback?.(`Authorized clinical record loaded & audited for ${data.profile.name}`);
    } catch (err: any) {
      setAuthorizedPatientData(null);
      setRbacError(err.message);
      onActionFeedback?.(err.message);
    }
  };

  const handleReceptionistQrScan = async (tokenToScan?: string) => {
    const targetToken =
      tokenToScan ||
      qrInputToken.trim() ||
      state.appointments.find((a) => a.patientId === 'pat-mison')?.qrCheckInToken ||
      'AL-QR-CHK-20261001-A21';

    try {
      const res = await ayuApi.qrCheckIn({ qrToken: targetToken });
      setQrCheckInResult({
        token: res.appointment.token,
        patientName: res.appointment.patientName,
        status: res.appointment.status,
      });
      onActionFeedback?.(`CHECK-IN SUCCESSFUL · Token: ${res.appointment.token} · Status: WAITING`);
    } catch (err: any) {
      onActionFeedback?.(err.message);
    }
  };

  const handleDoctorCallNext = async (targetAptId?: string) => {
    try {
      const res = await ayuApi.callNextPatient('doc-suman', targetAptId);
      setSelectedConsultAptId(res.calledAppointment.id);
      onActionFeedback?.(
        `🔔 Called Token ${res.calledAppointment.token} (${res.calledAppointment.patientName}) to Room 4`
      );
    } catch (err: any) {
      onActionFeedback?.(err.message);
    }
  };

  const handleCreateDigitalPrescription = async () => {
    try {
      const res = await ayuApi.createPrescription({
        appointmentId: consultTargetApt?.id,
        patientId: consultTargetApt?.patientId || 'pat-mison',
        doctorId: 'doc-suman',
        symptoms,
        clinicalNotes,
        diagnosis,
        medicines,
        followUpDate,
        completeConsultation: true,
      });
      onActionFeedback?.(
        `Digital E-Prescription ${res.prescription.rxCode} sent to Patient App & Hospital Pharmacy!`
      );
    } catch (err: any) {
      onActionFeedback?.(err.message);
    }
  };

  const handleDoctorOrderCbcLab = async () => {
    try {
      const order = await ayuApi.orderLabTest({
        patientId: consultTargetApt?.patientId || 'pat-mison',
        testId: 'test-cbc',
        orderedByDoctorId: 'doc-suman',
        appointmentId: consultTargetApt?.id,
        scheduledTime: '4:15 PM',
      });
      onActionFeedback?.(`Ordered CBC Test (${order.orderCode}) → Sent to Pathology Lab & Patient Timeline`);
    } catch (err: any) {
      onActionFeedback?.(err.message);
    }
  };

  const handleLabStatusChange = async (orderId: string, status: LabOrderStatus) => {
    try {
      await ayuApi.updateLabOrderStatus(orderId, { status });
      onActionFeedback?.(`Lab Order updated to "${status}"`);
    } catch (err: any) {
      onActionFeedback?.(err.message);
    }
  };

  const handleAddMedicineRow = () => {
    if (!newMedName.trim()) return;
    setMedicines((prev) => [
      ...prev,
      {
        name: newMedName.trim(),
        strength: newMedStrength,
        dosage: newMedDosage,
        frequency: newMedFreq,
        duration: newMedDur,
        instructions: newMedInst,
      },
    ]);
    setNewMedName('');
  };

  const sidebarItems: Array<{ id: DashboardNavId; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'appointments', label: 'Appointments', icon: Calendar },
    { id: 'patients', label: 'Patients', icon: Users },
    { id: 'doctors', label: 'Doctors', icon: Stethoscope },
    { id: 'departments', label: 'Departments', icon: Building2 },
    { id: 'queue', label: 'Queue', icon: ListOrdered },
    { id: 'prescriptions', label: 'Prescriptions', icon: FileText },
    { id: 'laboratory', label: 'Laboratory', icon: FlaskConical },
    { id: 'pharmacy', label: 'Pharmacy', icon: Pill },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'insurance', label: 'Insurance', icon: ShieldCheck },
    { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'audit_logs', label: 'Audit Logs', icon: Lock },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div
      className={`flex min-h-[820px] w-full rounded-2xl border overflow-hidden transition-colors ${
        darkMode ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
      }`}
    >
      {/* =====================================================================
          COLLAPSIBLE SIDEBAR NAVIGATION (Section 13 & 31)
      ===================================================================== */}
      <aside
        className={`flex flex-col border-r shrink-0 transition-all ${
          sidebarCollapsed ? 'w-16' : 'w-56'
        } ${darkMode ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50/90 border-slate-200'}`}
      >
        <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <AyuLogo size={26} />
            {!sidebarCollapsed && (
              <span className="font-bold text-sm tracking-tight truncate">AYULINK</span>
            )}
          </div>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
            title="Toggle Sidebar"
          >
            {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {sidebarItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                title={item.label}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-teal-600 text-white font-semibold'
                    : darkMode
                    ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                    : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );
          })}
        </div>

        <div className="p-2 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={() => onRoleChange('hospital_admin')}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-500 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Reset Session</span>}
          </button>
        </div>
      </aside>

      {/* =====================================================================
          MAIN DASHBOARD WORKSPACE
      ===================================================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Sticky Top Header with Breadcrumbs, Role Switcher, QR Scanner & Search */}
        <header
          className={`h-14 px-5 border-b flex items-center justify-between gap-4 shrink-0 ${
            darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
          }`}
        >
          {/* Left: Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs min-w-0">
            <span className="text-slate-400 font-medium">City Hospital</span>
            <span className="text-slate-300 dark:text-slate-700">/</span>
            <span className="font-semibold capitalize truncate">
              {activeNav.replace('_', ' ')}
            </span>
          </div>

          {/* Center/Right Controls: Role Switcher + Quick QR Scan + Notifications */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 hidden xl:inline">Active Role:</span>
              <select
                value={activeRole}
                onChange={(e) => {
                  const newRole = e.target.value as UserRole;
                  onRoleChange(newRole);
                  // Auto-route to the most relevant workspace for that role
                  if (newRole === 'lab_staff') setActiveNav('laboratory');
                  else if (newRole === 'pharmacist') setActiveNav('pharmacy');
                  else if (newRole === 'insurance_staff') setActiveNav('insurance');
                  else if (newRole === 'super_admin') setActiveNav('audit_logs');
                  else setActiveNav('dashboard');
                }}
                className={`h-9 px-2.5 rounded-lg border text-xs font-semibold ${
                  darkMode
                    ? 'bg-slate-800 border-slate-700 text-teal-300'
                    : 'bg-teal-50/70 border-teal-200 text-teal-900'
                }`}
              >
                <option value="hospital_admin">Hospital Admin</option>
                <option value="receptionist">Receptionist</option>
                <option value="doctor">Doctor (Dr. Suman Sharma)</option>
                <option value="nurse">Nurse</option>
                <option value="lab_staff">Lab Staff</option>
                <option value="pharmacist">Pharmacist</option>
                <option value="insurance_staff">Insurance Staff</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>

            <button
              onClick={() => setShowQrScannerModal(true)}
              className="h-9 px-3 rounded-lg bg-slate-900 dark:bg-teal-600 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Scan QR Check-In</span>
            </button>

            <button
              onClick={() => setActiveNav('notifications')}
              className={`relative h-9 w-9 rounded-lg border flex items-center justify-center ${
                darkMode ? 'border-slate-800 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-50'
              }`}
              aria-label="Dashboard Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-teal-600" />
            </button>
          </div>
        </header>

        {/* Scrollable Content Viewport */}
        <main className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* =================================================================
              ROLE-SPECIFIC BANNER FOR DOCTOR OR RECEPTIONIST ON "DASHBOARD"
          ================================================================= */}
          {activeNav === 'dashboard' && activeRole === 'doctor' && (
            <div className="space-y-6">
              {/* DOCTOR DASHBOARD HEADER (Section 18) */}
              <div
                className={`p-5 rounded-xl border flex flex-wrap items-center justify-between gap-4 ${
                  darkMode ? 'bg-slate-900 border-slate-800' : 'bg-teal-50/50 border-teal-200'
                }`}
              >
                <div>
                  <div className="text-xs font-bold tracking-wider text-teal-600 dark:text-teal-400">
                    CARDIOLOGY DEPARTMENT · ROOM 4 · CITY HOSPITAL
                  </div>
                  <h1 className="text-xl font-bold tracking-tight mt-0.5">GOOD MORNING, DR. SUMAN</h1>
                  <p className="text-xs text-slate-500">
                    “Aaja ko patient, queue ra history sabai ekai thau ma cha.”
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => handleDoctorCallNext()}
                    className="h-10 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    <span>CALL NEXT PATIENT</span>
                  </button>
                  <button
                    onClick={() => setActiveNav('prescriptions')}
                    className="h-10 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold"
                  >
                    Open Consultation Workspace
                  </button>
                </div>
              </div>

              {/* DOCTOR KPI CARDS (Section 18) */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Today's Appointments", val: 18 + extraBookingsCount },
                  {
                    label: 'Waiting',
                    val: state.appointments.filter(
                      (a) => a.doctorId === 'doc-suman' && (a.status === 'WAITING' || a.status === 'CHECKED_IN')
                    ).length + 4,
                  },
                  {
                    label: 'In Consultation',
                    val: state.appointments.filter(
                      (a) => a.doctorId === 'doc-suman' && a.status === 'IN_CONSULTATION'
                    ).length,
                  },
                  {
                    label: 'Completed',
                    val:
                      9 +
                      state.appointments.filter(
                        (a) => a.doctorId === 'doc-suman' && a.status === 'COMPLETED'
                      ).length,
                  },
                ].map((kpi, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border ${
                      darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                    }`}
                  >
                    <span className="text-xs text-slate-500 block">{kpi.label}</span>
                    <span className="font-mono text-2xl font-bold mt-1 block tabular-nums">{kpi.val}</span>
                  </div>
                ))}
              </div>

              {/* DOCTOR'S ASSIGNED PATIENTS TABLE (Section 18) */}
              <div
                className={`rounded-xl border overflow-hidden ${
                  darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <h2 className="text-sm font-bold">TODAY'S PATIENTS (DR. SUMAN SHARMA — CARDIOLOGY)</h2>
                  <span className="text-xs font-mono text-teal-600">
                    Current Queue Token: {state.queues[0]?.currentToken || 'A-20'}
                  </span>
                </div>
                <table className="w-full text-left text-xs">
                  <thead
                    className={`border-b ${
                      darkMode ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                  >
                    <tr>
                      <th className="py-2.5 px-4">Token</th>
                      <th className="py-2.5 px-4">Patient</th>
                      <th className="py-2.5 px-4">For</th>
                      <th className="py-2.5 px-4">Time</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {state.appointments
                      .filter((a) => a.doctorId === 'doc-suman')
                      .map((apt) => (
                        <tr
                          key={apt.id}
                          className={
                            apt.patientId === 'pat-mison'
                              ? 'bg-teal-50/40 dark:bg-teal-950/20'
                              : ''
                          }
                        >
                          <td className="py-3 px-4 font-mono font-bold text-teal-600">{apt.token}</td>
                          <td className="py-3 px-4 font-semibold">{apt.patientName}</td>
                          <td className="py-3 px-4 text-slate-500">{apt.forRelation}</td>
                          <td className="py-3 px-4 font-mono">{apt.time}</td>
                          <td className="py-3 px-4 font-mono font-semibold">{apt.status}</td>
                          <td className="py-3 px-4 text-right space-x-2">
                            <button
                              onClick={() => {
                                handleDoctorCallNext(apt.id);
                                setSelectedConsultAptId(apt.id);
                                handleLoadAuthorizedPatient(apt.patientId);
                                setActiveNav('prescriptions');
                              }}
                              className="px-3 py-1.5 rounded-lg bg-teal-600 text-white font-semibold"
                            >
                              Start Consultation
                            </button>
                            <button
                              onClick={() => {
                                setSelectedConsultAptId(apt.id);
                                handleLoadAuthorizedPatient(apt.patientId);
                                setActiveNav('prescriptions');
                              }}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-medium"
                            >
                              View Record
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =================================================================
              RECEPTIONIST DASHBOARD (Section 17)
          ================================================================= */}
          {activeNav === 'dashboard' && activeRole === 'receptionist' && (
            <div className="space-y-6">
              <div
                className={`p-5 rounded-xl border flex flex-wrap items-center justify-between gap-4 ${
                  darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div>
                  <span className="text-xs font-bold text-teal-600 block">FRONT DESK & QUEUE OPERATIONS</span>
                  <h1 className="text-lg font-bold">Receptionist Check-In & Token Desk</h1>
                  <p className="text-xs text-slate-500">
                    Scan patient appointment QR codes, manage check-ins, and coordinate outpatient queues.
                    (Medical history access is restricted by RBAC.)
                  </p>
                </div>
                <button
                  onClick={() => setShowQrScannerModal(true)}
                  className="h-10 px-4 rounded-xl bg-teal-600 text-white text-xs font-bold flex items-center gap-2"
                >
                  <QrCode className="w-4 h-4" />
                  <span>Scan Appointment QR</span>
                </button>
              </div>

              {rbacError && (
                <div className="p-4 rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/50 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>{rbacError}</span>
                </div>
              )}

              <div
                className={`rounded-xl border overflow-hidden ${
                  darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <h2 className="text-sm font-bold">Today's Patients</h2>
                  <span className="text-xs text-slate-500">October 1, 2026</span>
                </div>
                <table className="w-full text-left text-xs">
                  <thead
                    className={`border-b ${
                      darkMode ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                  >
                    <tr>
                      <th className="py-2.5 px-4">Token</th>
                      <th className="py-2.5 px-4">Patient</th>
                      <th className="py-2.5 px-4">Doctor & Dept</th>
                      <th className="py-2.5 px-4">Time</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4 text-right">Reception Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {state.appointments.map((apt) => (
                      <tr key={apt.id}>
                        <td className="py-3 px-4 font-mono font-bold text-teal-600">{apt.token}</td>
                        <td className="py-3 px-4 font-semibold">{apt.patientName}</td>
                        <td className="py-3 px-4">
                          {apt.doctorName} · <span className="text-slate-500">{apt.departmentName}</span>
                        </td>
                        <td className="py-3 px-4 font-mono">{apt.time}</td>
                        <td className="py-3 px-4 font-mono font-semibold">{apt.status}</td>
                        <td className="py-3 px-4 text-right space-x-1.5">
                          <button
                            onClick={() => handleReceptionistQrScan(apt.qrCheckInToken)}
                            className="px-2.5 py-1.5 rounded-lg bg-teal-600 text-white font-semibold"
                          >
                            Check In (QR)
                          </button>
                          <button
                            onClick={() => handleDoctorCallNext(apt.id)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-medium"
                          >
                            Call Patient
                          </button>
                          <button
                            onClick={() =>
                              ayuApi.updateAppointmentStatus(apt.id, 'CONFIRMED', '4:30 PM').then(() =>
                                onActionFeedback?.(`Rescheduled ${apt.token} to 4:30 PM`)
                              )
                            }
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-medium"
                          >
                            Reschedule
                          </button>
                          <button
                            onClick={() =>
                              ayuApi.updateAppointmentStatus(apt.id, 'CANCELLED').then(() =>
                                onActionFeedback?.(`Cancelled appointment ${apt.token}`)
                              )
                            }
                            className="px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 font-medium"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleLoadAuthorizedPatient(apt.patientId)}
                            className="px-2 py-1.5 rounded-lg text-slate-400 hover:text-red-600"
                            title="Test RBAC Medical Record Block"
                          >
                            <Lock className="w-3.5 h-3.5 inline" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =================================================================
              HOSPITAL ADMIN ANALYTICS & LIVE OVERVIEW (Sections 14, 15, 16)
          ================================================================= */}
          {activeNav === 'dashboard' && activeRole !== 'doctor' && activeRole !== 'receptionist' && (
            <div className="space-y-6">
              {/* Top 6 KPI Cards (Section 14) */}
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
                {[
                  { label: "Today's Appointments", value: `${128 + extraBookingsCount}` },
                  {
                    label: 'Checked In',
                    value: `${
                      72 +
                      state.appointments.filter(
                        (a) => a.patientId === 'pat-mison' && a.status === 'WAITING'
                      ).length
                    }`,
                  },
                  {
                    label: 'Waiting',
                    value: `${
                      31 +
                      state.appointments.filter(
                        (a) => a.patientId === 'pat-mison' && a.status === 'WAITING'
                      ).length
                    }`,
                  },
                  {
                    label: 'In Consultation',
                    value: `${
                      5 +
                      state.appointments.filter((a) => a.status === 'IN_CONSULTATION').length
                    }`,
                  },
                  {
                    label: 'Completed',
                    value: `${
                      41 +
                      state.appointments.filter((a) => a.status === 'COMPLETED').length
                    }`,
                  },
                  {
                    label: 'Revenue',
                    value: `NPR ${totalRevenueNpr.toLocaleString()}`,
                    accent: true,
                  },
                ].map((kpi, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border ${
                      darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                    }`}
                  >
                    <span className="text-xs text-slate-500 block truncate">{kpi.label}</span>
                    <span
                      className={`font-mono text-xl font-bold mt-1.5 block tabular-nums ${
                        kpi.accent ? 'text-teal-600 dark:text-teal-400' : ''
                      }`}
                    >
                      {kpi.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Charts Row: Appointment Trends + Department Statistics + Doctor Utilization (Section 14) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Chart 1: Appointment Trends */}
                <div
                  className={`p-4 rounded-xl border space-y-3 ${
                    darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold">Appointment Trends (Mon – Sat)</h3>
                    <span className="text-[11px] text-slate-400 font-mono">Weekly Volume</span>
                  </div>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={APPOINTMENT_TREND_DATA}>
                        <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1e293b' : '#f1f5f9'} />
                        <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Bar dataKey="appointments" fill="#0D9488" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 2: Department Statistics */}
                <div
                  className={`p-4 rounded-xl border space-y-3 ${
                    darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold">Department Statistics</h3>
                    <span className="text-[11px] text-slate-400 font-mono">Outpatient Share</span>
                  </div>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={DEPARTMENT_STATS_DATA} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#1e293b' : '#f1f5f9'} />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="department" type="category" width={95} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="patients" fill="#0F766E" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 3: Doctor Utilization */}
                <div
                  className={`p-4 rounded-xl border space-y-3.5 ${
                    darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold">Doctor Utilization</h3>
                    <span className="text-[11px] text-slate-400 font-mono">Live Slot Capacity</span>
                  </div>
                  <div className="space-y-3.5 pt-2">
                    {state.doctors.map((doc) => (
                      <div key={doc.id} className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">
                            {doc.name.split(' ').slice(0, 2).join(' ')}{' '}
                            <span className="text-slate-400 font-normal">({doc.departmentName})</span>
                          </span>
                          <span className="font-mono font-bold text-teal-600">{doc.utilizationRate}%</span>
                        </div>
                        <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-teal-600"
                            style={{ width: `${doc.utilizationRate}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* LIVE APPOINTMENTS TABLE (Section 15) */}
              <div
                className={`rounded-xl border overflow-hidden ${
                  darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold">Live Appointments Roster (Real-Time Socket.IO)</h2>
                    <p className="text-xs text-slate-500">
                      New patient bookings from the Flutter app appear here automatically without refreshing.
                    </p>
                  </div>

                  {/* Search & Filters (Section 15) */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Search token, patient..."
                        value={aptSearch}
                        onChange={(e) => setAptSearch(e.target.value)}
                        className={`h-8 pl-8 pr-3 rounded-lg border ${
                          darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                        }`}
                      />
                    </div>

                    <select
                      value={filterDoctor}
                      onChange={(e) => setFilterDoctor(e.target.value)}
                      className={`h-8 px-2 rounded-lg border ${
                        darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <option value="ALL">All Doctors</option>
                      {state.doctors.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>

                    <select
                      value={filterDept}
                      onChange={(e) => setFilterDept(e.target.value)}
                      className={`h-8 px-2 rounded-lg border ${
                        darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <option value="ALL">All Departments</option>
                      <option value="Cardiology">Cardiology</option>
                      <option value="General Medicine">General Medicine</option>
                      <option value="ENT">ENT</option>
                    </select>

                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className={`h-8 px-2 rounded-lg border ${
                        darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="CONFIRMED">Confirmed</option>
                      <option value="CHECKED_IN">Checked In</option>
                      <option value="WAITING">Waiting</option>
                      <option value="IN_CONSULTATION">In Consultation</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead
                      className={`border-b ${
                        darkMode ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                      }`}
                    >
                      <tr>
                        <th className="py-2.5 px-4">Token</th>
                        <th className="py-2.5 px-4">Patient</th>
                        <th className="py-2.5 px-4">Doctor</th>
                        <th className="py-2.5 px-4">Department</th>
                        <th className="py-2.5 px-4">Time</th>
                        <th className="py-2.5 px-4">Payment</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4 text-right">Quick Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {filteredAppointments.map((apt) => (
                        <tr
                          key={apt.id}
                          className={
                            apt.patientId === 'pat-mison'
                              ? 'bg-teal-50/50 dark:bg-teal-950/30'
                              : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/40'
                          }
                        >
                          <td className="py-3 px-4 font-mono font-bold text-teal-600">{apt.token}</td>
                          <td className="py-3 px-4 font-semibold">
                            {apt.patientName}
                            {apt.patientId === 'pat-mison' && (
                              <span className="ml-1.5 text-[10px] font-mono text-teal-600">· LIVE</span>
                            )}
                          </td>
                          <td className="py-3 px-4">{apt.doctorName}</td>
                          <td className="py-3 px-4 text-slate-500">{apt.departmentName}</td>
                          <td className="py-3 px-4 font-mono">{apt.time}</td>
                          <td className="py-3 px-4 text-emerald-600 font-semibold">
                            ✓ {apt.paymentStatus === 'VERIFIED' ? 'Verified' : apt.paymentStatus}
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold">{apt.status}</td>
                          <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                            {apt.status === 'CONFIRMED' && (
                              <button
                                onClick={() => handleReceptionistQrScan(apt.qrCheckInToken)}
                                className="px-2.5 py-1 rounded-md bg-slate-900 dark:bg-teal-600 text-white font-semibold"
                              >
                                Scan QR Check-In
                              </button>
                            )}
                            <button
                              onClick={() => handleDoctorCallNext(apt.id)}
                              className="px-2.5 py-1 rounded-md bg-teal-600 text-white font-semibold"
                            >
                              Call Patient
                            </button>
                            <button
                              onClick={() => {
                                setSelectedConsultAptId(apt.id);
                                handleLoadAuthorizedPatient(apt.patientId);
                                setActiveNav('prescriptions');
                              }}
                              className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 font-medium"
                            >
                              Consult
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

          {/* =================================================================
              NAV: CLINICAL CONSULTATION WORKSPACE & E-PRESCRIPTION (Sections 19, 20, 21)
          ================================================================= */}
          {(activeNav === 'prescriptions' || activeNav === 'patients') && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold">
                    Clinical Consultation Workspace & Digital E-Prescription
                  </h2>
                  <p className="text-xs text-slate-500">
                    Permission-controlled, hospital-scoped, doctor-scoped clinical workspace with automatic audit logging.
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Active Patient:</span>
                  <select
                    value={consultTargetApt?.id || ''}
                    onChange={(e) => {
                      setSelectedConsultAptId(e.target.value);
                      const found = state.appointments.find((a) => a.id === e.target.value);
                      if (found) handleLoadAuthorizedPatient(found.patientId);
                    }}
                    className={`h-9 px-3 rounded-lg border font-semibold ${
                      darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                    }`}
                  >
                    {state.appointments.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.token} · {a.patientName} ({a.departmentName})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleLoadAuthorizedPatient(consultTargetApt?.patientId || 'pat-mison')}
                    className="h-9 px-3 rounded-lg bg-teal-600 text-white font-semibold"
                  >
                    Load Authorized Medical History
                  </button>
                </div>
              </div>

              {rbacError && (
                <div className="p-4 rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/50 text-xs text-red-700 dark:text-red-300">
                  {rbacError}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* LEFT SIDE: Patient Information, Allergies, Previous Visits, Reports, Timeline (Section 19 & 20) */}
                <div
                  className={`lg:col-span-4 p-4 rounded-xl border space-y-4 text-xs ${
                    darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50/70 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                    <div>
                      <span className="text-[10px] font-bold text-teal-600 block">AUTHORIZED PATIENT RECORD</span>
                      <h3 className="text-sm font-bold">
                        {authorizedPatientData?.profile?.name || consultTargetApt?.patientName || 'Mison Khatiwada'}
                      </h3>
                    </div>
                    <span className="font-mono font-bold text-red-600 text-sm">
                      Blood: {authorizedPatientData?.profile?.bloodGroup || 'O+'}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Age / Gender:</span>
                      <span className="font-semibold">
                        {authorizedPatientData?.profile?.age || 26} yrs ·{' '}
                        {authorizedPatientData?.profile?.gender || 'Male'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Health ID:</span>
                      <span className="font-mono font-semibold">
                        {authorizedPatientData?.profile?.healthIdCode || 'AL-NP-8F29K4'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Known Allergies:</span>
                      <span className="font-semibold text-red-600">
                        {(authorizedPatientData?.profile?.allergies || ['Penicillin', 'Sulfonamides']).join(', ')}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Chronic / Critical Conditions:</span>
                      <span className="font-medium">
                        {(
                          authorizedPatientData?.profile?.criticalConditions || [
                            'Mild Essential Hypertension (Controlled)',
                          ]
                        ).join(', ')}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="font-bold text-slate-500">RECENT LAB REPORTS</div>
                    {state.labOrders
                      .filter((l) => l.patientId === (consultTargetApt?.patientId || 'pat-mison'))
                      .map((l) => (
                        <div
                          key={l.id}
                          className="p-2.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                        >
                          <div className="flex justify-between font-semibold">
                            <span>{l.testName}</span>
                            <span className="text-teal-600">{l.status}</span>
                          </div>
                          <div className="text-[11px] text-slate-500">{l.scheduledDate}</div>
                        </div>
                      ))}
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                    <div className="font-bold text-slate-500">PREVIOUS PRESCRIPTIONS</div>
                    {state.prescriptions
                      .filter((r) => r.patientId === (consultTargetApt?.patientId || 'pat-mison'))
                      .map((r) => (
                        <div
                          key={r.id}
                          className="p-2.5 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                        >
                          <div className="font-mono font-bold text-teal-600">{r.rxCode}</div>
                          <div className="font-medium">{r.diagnosis}</div>
                          <div className="text-[11px] text-slate-500">
                            {r.medicines.map((m) => `${m.name} ${m.strength}`).join(', ')}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* MAIN SECTION: Clinical Notes, Diagnosis, Medicines, Lab Order & Complete (Section 20 & 21) */}
                <div
                  className={`lg:col-span-8 p-5 rounded-xl border space-y-4 text-xs ${
                    darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="font-bold block">Symptoms</label>
                      <textarea
                        rows={2}
                        value={symptoms}
                        onChange={(e) => setSymptoms(e.target.value)}
                        className={`w-full p-2.5 rounded-lg border ${
                          darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                        }`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold block">Clinical Notes (Vitals & Examination)</label>
                      <textarea
                        rows={2}
                        value={clinicalNotes}
                        onChange={(e) => setClinicalNotes(e.target.value)}
                        className={`w-full p-2.5 rounded-lg border ${
                          darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 space-y-1">
                      <label className="font-bold block">Assessment / Diagnosis</label>
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
                      <label className="font-bold block">Follow-up Date</label>
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

                  {/* Digital E-Prescription Medicine Builder (Section 21) */}
                  <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">AYULINK E-PRESCRIPTION MEDICINES</span>
                      <span className="text-[11px] text-slate-500">
                        Synced immediately to Patient App & Hospital Pharmacy
                      </span>
                    </div>

                    <div className="space-y-2">
                      {medicines.map((med, i) => (
                        <div
                          key={i}
                          className={`p-3 rounded-lg border flex items-center justify-between gap-2 ${
                            darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div>
                            <span className="font-bold text-teal-600">
                              {med.name} · {med.strength}
                            </span>{' '}
                            — <span className="font-mono">{med.dosage}</span> ·{' '}
                            <span className="font-mono">{med.frequency}</span> ·{' '}
                            <span className="font-mono">{med.duration}</span>
                            <div className="text-[11px] text-slate-500">Instructions: {med.instructions}</div>
                          </div>
                          <button
                            onClick={() => setMedicines(medicines.filter((_, idx) => idx !== i))}
                            className="text-red-500 text-[11px] font-semibold"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add Medicine Row */}
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Medicine (e.g. Amlodipine)"
                        value={newMedName}
                        onChange={(e) => setNewMedName(e.target.value)}
                        className={`h-8 px-2.5 rounded-lg border ${
                          darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                        }`}
                      />
                      <input
                        type="text"
                        placeholder="Strength"
                        value={newMedStrength}
                        onChange={(e) => setNewMedStrength(e.target.value)}
                        className={`h-8 px-2.5 rounded-lg border ${
                          darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                        }`}
                      />
                      <input
                        type="text"
                        placeholder="Dosage"
                        value={newMedDosage}
                        onChange={(e) => setNewMedDosage(e.target.value)}
                        className={`h-8 px-2.5 rounded-lg border ${
                          darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                        }`}
                      />
                      <input
                        type="text"
                        placeholder="Frequency"
                        value={newMedFreq}
                        onChange={(e) => setNewMedFreq(e.target.value)}
                        className={`h-8 px-2.5 rounded-lg border ${
                          darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                        }`}
                      />
                      <input
                        type="text"
                        placeholder="Duration"
                        value={newMedDur}
                        onChange={(e) => setNewMedDur(e.target.value)}
                        className={`h-8 px-2.5 rounded-lg border ${
                          darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={handleAddMedicineRow}
                        className="h-8 px-3 rounded-lg bg-slate-900 dark:bg-slate-800 text-white font-semibold"
                      >
                        + Add Drug
                      </button>
                    </div>
                  </div>

                  {/* Referral Field */}
                  <div className="space-y-1">
                    <label className="font-bold block">Department Referral / Special Instructions</label>
                    <input
                      type="text"
                      value={referralNote}
                      onChange={(e) => setReferralNote(e.target.value)}
                      className={`w-full h-9 px-3 rounded-lg border ${
                        darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    />
                  </div>

                  {/* 4 Required Consultation Action Buttons (Section 20) */}
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2.5">
                    <button
                      onClick={() => onActionFeedback?.('Clinical consultation draft saved.')}
                      className="h-10 px-4 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold"
                    >
                      Save Draft
                    </button>
                    <button
                      onClick={handleCreateDigitalPrescription}
                      className="h-10 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold flex items-center gap-1.5"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Create Prescription (Send to Patient App)</span>
                    </button>
                    <button
                      onClick={handleDoctorOrderCbcLab}
                      className="h-10 px-4 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-semibold flex items-center gap-1.5"
                    >
                      <FlaskConical className="w-4 h-4 text-teal-400" />
                      <span>Order Lab Test (CBC)</span>
                    </button>
                    <button
                      onClick={handleCreateDigitalPrescription}
                      className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Complete Consultation</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              NAV: DOCTORS & REAL-TIME AVAILABILITY CONFIGURATOR (Section 6)
          ================================================================= */}
          {activeNav === 'doctors' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold">Doctor Schedule & Real-Time Availability Control</h2>
                  <p className="text-xs text-slate-500">
                    Changes made here propagate via Socket.IO directly to the Patient Mobile App.
                  </p>
                </div>
              </div>

              <div
                className={`p-5 rounded-xl border space-y-4 ${
                  darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div>
                    <span className="text-xs font-mono text-teal-600">{sumanDoctor.nmcDemoBadge}</span>
                    <h3 className="text-base font-bold">
                      {sumanDoctor.name} — {sumanDoctor.specialty} ({sumanDoctor.hospitalName})
                    </h3>
                    <p className="text-xs text-slate-500">
                      Monday 10:00 AM – 2:00 PM · Wednesday 4:00 PM – 7:00 PM · Friday 10:00 AM – 1:00 PM
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <button
                      onClick={() =>
                        ayuApi
                          .updateDoctorAvailability(sumanDoctor.id, {
                            availableToday: !sumanDoctor.availableToday,
                            onLeave: false,
                          })
                          .then(() => onActionFeedback?.('Updated Dr. Suman availability status'))
                      }
                      className={`h-9 px-3 rounded-lg font-semibold ${
                        sumanDoctor.availableToday && !sumanDoctor.onLeave
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {sumanDoctor.availableToday && !sumanDoctor.onLeave
                        ? '✓ Marked Available Today'
                        : 'Mark Available Today'}
                    </button>

                    <button
                      onClick={() =>
                        ayuApi
                          .updateDoctorAvailability(sumanDoctor.id, {
                            onLeave: !sumanDoctor.onLeave,
                          })
                          .then(() => onActionFeedback?.('Toggled Doctor Leave Status'))
                      }
                      className={`h-9 px-3 rounded-lg font-semibold border ${
                        sumanDoctor.onLeave
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {sumanDoctor.onLeave ? 'On Leave (Active)' : 'Take Leave'}
                    </button>

                    <button
                      onClick={() =>
                        ayuApi
                          .updateDoctorAvailability(sumanDoctor.id, {
                            emergencyAvailable: !sumanDoctor.emergencyAvailable,
                          })
                          .then(() => onActionFeedback?.('Toggled Emergency On-Call Availability'))
                      }
                      className={`h-9 px-3 rounded-lg font-semibold border ${
                        sumanDoctor.emergencyAvailable
                          ? 'border-teal-600 text-teal-600'
                          : 'border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      Emergency Availability: {sumanDoctor.emergencyAvailable ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>

                {/* Slot Blocking / Unblocking Grid */}
                <div className="space-y-2">
                  <div className="text-xs font-bold">
                    Manage Today's Appointment Slots (Click Available/Blocked to Toggle in Real Time)
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                    {sumanSlots.map((slot) => (
                      <button
                        key={slot.id}
                        disabled={slot.status === 'CONFIRMED' || slot.status === 'HELD'}
                        onClick={() =>
                          ayuApi
                            .updateDoctorAvailability(sumanDoctor.id, { slotIdToToggle: slot.id })
                            .then(() => onActionFeedback?.(`Toggled slot ${slot.time}`))
                        }
                        className={`p-3 rounded-xl border text-left text-xs transition-colors ${
                          slot.status === 'CONFIRMED'
                            ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-300 dark:border-teal-800'
                            : slot.status === 'HELD'
                            ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300'
                            : slot.status === 'BLOCKED'
                            ? 'bg-red-50 dark:bg-red-950/30 border-red-200 text-red-600'
                            : darkMode
                            ? 'bg-slate-950 border-slate-800 hover:border-teal-500'
                            : 'bg-slate-50 border-slate-200 hover:border-teal-600'
                        }`}
                      >
                        <div className="font-mono font-bold">{slot.time}</div>
                        <div className="text-[10px] font-semibold mt-0.5">{slot.status}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
              NAV: LABORATORY DASHBOARD (Section 23)
          ================================================================= */}
          {activeNav === 'laboratory' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold">Pathology & Diagnostic Laboratory Dashboard</h2>
                  <p className="text-xs text-slate-500">
                    Manage sample collection, processing, and upload verified reports directly to the Patient Health Timeline.
                  </p>
                </div>
              </div>

              <div
                className={`rounded-xl border overflow-hidden ${
                  darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="text-sm font-bold">TODAY'S TESTS</h3>
                  <span className="text-xs font-mono text-slate-500">Total Orders: {state.labOrders.length}</span>
                </div>
                <table className="w-full text-left text-xs">
                  <thead
                    className={`border-b ${
                      darkMode ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                  >
                    <tr>
                      <th className="py-2.5 px-4">Order Code</th>
                      <th className="py-2.5 px-4">Patient</th>
                      <th className="py-2.5 px-4">Test</th>
                      <th className="py-2.5 px-4">Scheduled</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4 text-right">Lab Workflow Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {state.labOrders.map((ord) => (
                      <tr key={ord.id}>
                        <td className="py-3 px-4 font-mono font-semibold">{ord.orderCode}</td>
                        <td className="py-3 px-4 font-bold">{ord.patientName}</td>
                        <td className="py-3 px-4 font-semibold text-teal-600">{ord.testName}</td>
                        <td className="py-3 px-4 font-mono">
                          {ord.scheduledDate} · {ord.scheduledTime}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold">{ord.status}</td>
                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                          {(['Booked', 'Sample Collected', 'Processing'] as LabOrderStatus[]).map((st) => (
                            <button
                              key={st}
                              onClick={() => handleLabStatusChange(ord.id, st)}
                              className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium ${
                                ord.status === st
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'border-slate-300 dark:border-slate-700'
                              }`}
                            >
                              {st}
                            </button>
                          ))}
                          <button
                            onClick={() => handleLabStatusChange(ord.id, 'Report Ready')}
                            className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold inline-flex items-center gap-1"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Upload Report (Report Ready)</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =================================================================
              NAV: PHARMACY DASHBOARD (Section 24)
          ================================================================= */}
          {activeNav === 'pharmacy' && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-bold">Hospital Pharmacy Dispensary Queue</h2>
                <p className="text-xs text-slate-500">
                  Receive digital e-prescriptions in real time and update dispensation status.
                </p>
              </div>

              <div className="space-y-3">
                {state.pharmacyOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-4 text-xs ${
                      darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="font-mono font-bold text-sm text-teal-600">
                        Prescription {ord.rxCode} ({ord.orderCode})
                      </div>
                      <div className="font-semibold">
                        Patient: {ord.patientName} · {ord.medicinesCount} Medicines ·{' '}
                        <span className="font-mono">NPR {ord.totalAmount}</span>
                      </div>
                      <div className="text-slate-500">
                        {ord.medicines.map((m) => `${m.name} ${m.strength} (${m.dosage})`).join(' · ')}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {(
                        ['New Prescription', 'Accepted', 'Preparing', 'Ready', 'Delivered', 'Cancelled'] as const
                      ).map((st) => (
                        <button
                          key={st}
                          onClick={() =>
                            ayuApi
                              .updatePharmacyOrderStatus(ord.id, st)
                              .then(() => onActionFeedback?.(`Pharmacy Order ${ord.rxCode} → ${st}`))
                          }
                          className={`px-2.5 py-1.5 rounded-lg font-semibold transition-colors ${
                            ord.status === st
                              ? 'bg-teal-600 text-white'
                              : darkMode
                              ? 'bg-slate-800 text-slate-300'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* =================================================================
              NAV: SUPER ADMIN GOVERNANCE & SECURITY AUDIT LOGS (Sections 31 & 34)
          ================================================================= */}
          {activeNav === 'audit_logs' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold">
                    Super Admin Governance & Immutable Security Audit Logs
                  </h2>
                  <p className="text-xs text-slate-500">
                    Every clinical record view, e-prescription creation, lab upload, QR check-in, and Emergency Health ID scan is audited.
                  </p>
                </div>
              </div>

              {/* Credential Verification Governance (Section 31: Doctors never auto-verified) */}
              <div
                className={`p-4 rounded-xl border space-y-3 ${
                  darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <div className="text-xs font-bold">
                  Platform Credential Approval (Doctors & Hospitals Never Automatically Verified)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {state.doctors.map((doc) => (
                    <div
                      key={doc.id}
                      className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                        darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div>
                        <div className="font-bold">{doc.name}</div>
                        <div className="font-mono text-[10px] text-slate-500">{doc.nmcDemoBadge}</div>
                      </div>
                      <button
                        onClick={() =>
                          ayuApi
                            .toggleEntityVerification('doctor', doc.id, !doc.verified)
                            .then(() => onActionFeedback?.(`Updated verification for ${doc.name}`))
                        }
                        className={`px-2.5 py-1 rounded-lg font-semibold ${
                          doc.verified
                            ? 'bg-emerald-600 text-white'
                            : 'bg-amber-500 text-white'
                        }`}
                      >
                        {doc.verified ? '✓ Verified' : 'Pending Approval'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Security Audit Log Table */}
              <div
                className={`rounded-xl border overflow-hidden ${
                  darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <h3 className="text-sm font-bold">HIPAA / Nepal Digital Health Audit Trail</h3>
                  <span className="font-mono text-xs text-teal-600">{state.auditLogs.length} Events Logged</span>
                </div>
                <table className="w-full text-left text-xs">
                  <thead
                    className={`border-b ${
                      darkMode ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                  >
                    <tr>
                      <th className="py-2.5 px-4">Timestamp</th>
                      <th className="py-2.5 px-4">Actor & Role</th>
                      <th className="py-2.5 px-4">Audited Action</th>
                      <th className="py-2.5 px-4">Target</th>
                      <th className="py-2.5 px-4">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {state.auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="py-2.5 px-4 font-mono text-[11px] whitespace-nowrap">{log.timestamp}</td>
                        <td className="py-2.5 px-4 font-semibold">
                          {log.actorName}{' '}
                          <span className="font-mono text-[10px] text-slate-400">({log.actorRole})</span>
                        </td>
                        <td className="py-2.5 px-4 font-bold text-teal-600">{log.action}</td>
                        <td className="py-2.5 px-4 font-mono text-[11px]">
                          {log.targetType}:{log.targetId}
                        </td>
                        <td className="py-2.5 px-4 text-slate-500">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =================================================================
              ADDITIONAL SIDEBAR VIEWS (Queue, Payments, Insurance, Departments, Notifications, etc.)
          ================================================================= */}
          {(activeNav === 'appointments' || activeNav === 'queue') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold">Live Outpatient Queue & Token Control</h2>
                <button
                  onClick={() => handleDoctorCallNext()}
                  className="h-9 px-4 rounded-xl bg-teal-600 text-white text-xs font-bold"
                >
                  CALL NEXT PATIENT IN QUEUE
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {state.appointments.map((apt) => (
                  <div
                    key={apt.id}
                    className={`p-4 rounded-xl border space-y-2 text-xs ${
                      apt.status === 'IN_CONSULTATION'
                        ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/30'
                        : darkMode
                        ? 'bg-slate-900 border-slate-800'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-base font-bold text-teal-600">{apt.token}</span>
                      <span className="font-mono font-semibold">{apt.status}</span>
                    </div>
                    <div className="font-bold">{apt.patientName}</div>
                    <div className="text-slate-500">
                      {apt.doctorName} · {apt.roomNumber} · {apt.time}
                    </div>
                    <div className="pt-2 flex gap-1.5">
                      <button
                        onClick={() => handleReceptionistQrScan(apt.qrCheckInToken)}
                        className="flex-1 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 text-white font-semibold"
                      >
                        Check In
                      </button>
                      <button
                        onClick={() => handleDoctorCallNext(apt.id)}
                        className="flex-1 py-1.5 rounded-lg bg-teal-600 text-white font-semibold"
                      >
                        Call Room 4
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeNav === 'payments' && (
            <div className="space-y-4">
              <h2 className="text-base font-bold">Verified eSewa UAT Transactions Ledger</h2>
              <div
                className={`rounded-xl border overflow-hidden ${
                  darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-3">Transaction UUID</th>
                      <th className="p-3">Patient</th>
                      <th className="p-3">Product Code</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">eSewa Ref</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
                    {state.payments.map((p) => (
                      <tr key={p.id}>
                        <td className="p-3 font-semibold">{p.transactionUuid}</td>
                        <td className="p-3 font-sans font-semibold">{p.patientName}</td>
                        <td className="p-3">{p.productCode}</td>
                        <td className="p-3 font-bold">NPR {p.totalAmount}</td>
                        <td className="p-3 text-slate-500">{p.esewaRefId || 'Pending'}</td>
                        <td className="p-3 text-emerald-600 font-bold">✓ {p.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeNav === 'insurance' && (
            <div className="space-y-4">
              <h2 className="text-base font-bold">Nepal Health Insurance Board (HIB) Claims Desk</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {state.insuranceClaims.map((clm) => (
                  <div
                    key={clm.id}
                    className={`p-4 rounded-xl border space-y-2 text-xs ${
                      darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex justify-between font-mono font-bold">
                      <span>{clm.claimCode}</span>
                      <span className="text-teal-600">{clm.status}</span>
                    </div>
                    <div className="font-bold">
                      {clm.patientName} · Policy: <span className="font-mono">{clm.policyNumber}</span>
                    </div>
                    <div className="text-slate-500">
                      Diagnosis: {clm.diagnosis} · Claim Amount: <strong className="font-mono">NPR {clm.claimAmount}</strong>
                    </div>
                    <div className="pt-2 flex gap-2">
                      <button
                        onClick={() =>
                          ayuApi
                            .updateInsuranceClaim(clm.id, 'Approved', clm.claimAmount)
                            .then(() => onActionFeedback?.(`Approved HIB Claim ${clm.claimCode}`))
                        }
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold"
                      >
                        Approve HIB Claim
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(activeNav === 'departments' ||
            activeNav === 'reports' ||
            activeNav === 'analytics' ||
            activeNav === 'notifications' ||
            activeNav === 'settings') && (
            <div className="space-y-4">
              <h2 className="text-base font-bold capitalize">{activeNav.replace('_', ' ')} Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
                {state.departments.map((dept) => (
                  <div
                    key={dept.id}
                    className={`p-4 rounded-xl border space-y-1.5 text-xs ${
                      darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="font-mono text-[10px] text-teal-600 font-bold">{dept.code}</div>
                    <div className="font-bold text-sm">{dept.name}</div>
                    <div className="text-slate-500 text-[11px]">{dept.nameNe}</div>
                    <p className="text-slate-500 text-[11px] pt-1">{dept.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* =====================================================================
          MODAL: RECEPTIONIST SECURE QR CHECK-IN SCANNER (Section 12)
      ===================================================================== */}
      {showQrScannerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-md rounded-2xl border p-5 space-y-4 text-xs ${
              darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold text-teal-600 block">RECEPTIONIST QR VERIFICATION</span>
                <h3 className="text-sm font-bold">Scan Patient Appointment QR Pass</h3>
              </div>
              <button
                onClick={() => {
                  setShowQrScannerModal(false);
                  setQrCheckInResult(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <p className="text-slate-500">
              Backend verifies: Booking exists · Correct hospital · Correct patient · Payment verified · Correct date · Booking status.
            </p>

            <div className="space-y-2">
              <label className="font-semibold block">Select or Scan Active Appointment QR Token:</label>
              <div className="space-y-1.5">
                {state.appointments.map((apt) => (
                  <button
                    key={apt.id}
                    onClick={() => handleReceptionistQrScan(apt.qrCheckInToken)}
                    className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between ${
                      darkMode ? 'bg-slate-950 border-slate-800 hover:border-teal-500' : 'bg-slate-50 border-slate-200 hover:border-teal-600'
                    }`}
                  >
                    <div>
                      <span className="font-mono font-bold text-teal-600">{apt.token}</span> ·{' '}
                      <span className="font-semibold">{apt.patientName}</span>
                      <div className="font-mono text-[10px] text-slate-500">{apt.qrCheckInToken}</div>
                    </div>
                    <span className="px-2.5 py-1 rounded-md bg-teal-600 text-white font-semibold">
                      Scan & Verify
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {qrCheckInResult && (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-center space-y-1">
                <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                  CHECK-IN SUCCESSFUL
                </div>
                <div className="font-mono text-base font-bold">Token: {qrCheckInResult.token}</div>
                <div className="font-mono text-xs text-emerald-800 dark:text-emerald-200">
                  Patient: {qrCheckInResult.patientName} · Status: {qrCheckInResult.status}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
