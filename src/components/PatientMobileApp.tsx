import React, { useState, useEffect } from 'react';
import {
  Home,
  Stethoscope,
  Calendar,
  Activity,
  User as UserIcon,
  Search,
  Building2,
  FlaskConical,
  Pill,
  Video,
  AlertTriangle,
  Star,
  CheckCircle2,
  Clock,
  QrCode,
  Bell,
  Sparkles,
  Phone,
  Navigation,
  ShieldCheck,
  ChevronLeft,
  Send,
  Plus,
  Users,
  FileText,
  WifiOff,
  X,
} from 'lucide-react';
import {
  SupportedLocale,
  Doctor,
  Hospital,
  Appointment,
  LabOrder,
  Prescription,
} from '../types/ayulink';
import type { DatabaseState } from '../types/seedData';
import { tr } from '../i18n/translations';
import { AyuLogo, SecureQrCode } from './AyuLogo';
import { ayuApi } from '../services/api';

interface PatientMobileAppProps {
  state: DatabaseState;
  darkMode: boolean;
  compactFrame?: boolean;
  onActionFeedback?: (msg: string) => void;
}

type MobileTab = 'home' | 'doctors' | 'appointments' | 'health' | 'profile';
type SubScreen =
  | null
  | 'doctor_detail'
  | 'hospital_detail'
  | 'booking_flow'
  | 'appointment_detail'
  | 'lab_booking'
  | 'pharmacy_view'
  | 'telemedicine_room'
  | 'emergency_screen'
  | 'ayu_assistant'
  | 'health_id_card'
  | 'notifications_list';

export const PatientMobileApp: React.FC<PatientMobileAppProps> = ({
  state,
  darkMode,
  compactFrame = true,
  onActionFeedback,
}) => {
  const [locale, setLocale] = useState<SupportedLocale>('en');
  const [activeTab, setActiveTab] = useState<MobileTab>('home');
  const [subScreen, setSubScreen] = useState<SubScreen>(null);

  // Discovery & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [discoveryMode, setDiscoveryMode] = useState<'doctors' | 'hospitals'>('doctors');
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'available_today' | 'emergency' | 'telemedicine' | 'lab' | 'insurance'
  >('all');

  // Selected Entities
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor>(
    state.doctors.find((d) => d.id === 'doc-suman') || state.doctors[0]
  );
  const [selectedHospital, setSelectedHospital] = useState<Hospital>(state.hospitals[0]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  const [selectedLabReport, setSelectedLabReport] = useState<LabOrder | null>(null);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);

  // Booking Flow States
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>('fam-myself');
  const [selectedConsultationType, setSelectedConsultationType] = useState<'IN_PERSON' | 'TELEMEDICINE'>('IN_PERSON');
  const [selectedSlotId, setSelectedSlotId] = useState<string>('slot-suman-330');
  const [heldExpiresAt, setHeldExpiresAt] = useState<number | null>(null);
  const [holdRemainingSec, setHoldRemainingSec] = useState<number>(299);
  const [bookingStep, setBookingStep] = useState<'select' | 'summary' | 'esewa_gateway' | 'confirmed'>('select');
  const [esewaDraft, setEsewaDraft] = useState<{
    paymentId: string;
    esewaPayload: {
      amount: number;
      totalAmount: number;
      transactionUuid: string;
      productCode: string;
      signature: string;
      gatewayUrl: string;
    };
  } | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // AI Assistant States
  const [aiMessages, setAiMessages] = useState<
    Array<{ role: 'user' | 'assistant'; text: string; disclaimer?: string; department?: string }>
  >([
    {
      role: 'assistant',
      text: 'Namaste Mison! I am Ayu Assistant. I can explain your CBC lab report, help you find a Heart Doctor (Cardiology), explain prescription instructions, or prepare questions for Dr. Suman Sharma.',
      disclaimer:
        'Ayu Assistant provides health education and navigation only. It is not a doctor, does not diagnose, and never prescribes medicine.',
    },
  ]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Emergency Health ID Scan Preview
  const [emergencyScanResult, setEmergencyScanResult] = useState<{
    healthIdCode: string;
    name: string;
    bloodGroup: string;
    knownAllergies: string[];
    criticalConditions: string[];
    emergencyContact: { name: string; relation: string; phone: string };
    importantMedicines: string[];
    accessedAt: string;
  } | null>(null);

  // Add Family Member Modal
  const [newFamName, setNewFamName] = useState('');
  const [newFamRelation, setNewFamRelation] = useState<'Father' | 'Mother' | 'Brother' | 'Child' | 'Other'>('Mother');
  const [newFamAge, setNewFamAge] = useState('52');
  const [showAddFamilyForm, setShowAddFamilyForm] = useState(false);

  // Offline Cache Drawer
  const [showOfflineCache, setShowOfflineCache] = useState(false);

  // Keep selected doctor synced with latest server state
  const currentDoctor = state.doctors.find((d) => d.id === selectedDoctor.id) || state.doctors[0];
  const misonProfile = state.patientProfiles.find((p) => p.id === 'pat-mison') || state.patientProfiles[0];
  const misonAppointments = state.appointments
    .filter((a) => a.patientId === 'pat-mison')
    .sort((a, b) => b.tokenNumber - a.tokenNumber);

  const activeAppointment: Appointment | undefined =
    state.appointments.find((a) => a.id === selectedAppointmentId) || misonAppointments[0];

  const queueState = state.queues.find((q) => q.doctorId === (activeAppointment?.doctorId || 'doc-suman')) || state.queues[0];

  // Countdown timer for 5-minute temporary slot hold (04:59)
  useEffect(() => {
    if (!heldExpiresAt) return;
    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((heldExpiresAt - Date.now()) / 1000));
      setHoldRemainingSec(diff);
      if (diff === 0) {
        setHeldExpiresAt(null);
        setBookingError('Temporary slot hold expired (00:00). Slot returned to AVAILABLE.');
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [heldExpiresAt]);

  const formatTimer = (sec: number) => {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  // Filtered Doctors & Hospitals (supports "Heart doctor" -> Cardiology)
  const filteredDoctors = state.doctors.filter((doc) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesHeart =
      (q.includes('heart') || q.includes('मुटु') || q.includes('mutu') || q.includes('cardio')) &&
      doc.departmentName.toLowerCase().includes('cardio');

    const matchesQuery =
      !q ||
      matchesHeart ||
      doc.name.toLowerCase().includes(q) ||
      doc.specialty.toLowerCase().includes(q) ||
      doc.departmentName.toLowerCase().includes(q) ||
      doc.hospitalName.toLowerCase().includes(q);

    if (!matchesQuery) return false;
    if (activeFilter === 'available_today' && (!doc.availableToday || doc.onLeave)) return false;
    if (activeFilter === 'emergency' && !doc.emergencyAvailable) return false;
    if (activeFilter === 'telemedicine' && !doc.telemedicineAvailable) return false;
    return true;
  });

  const filteredHospitals = state.hospitals.filter((hosp) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      hosp.name.toLowerCase().includes(q) ||
      hosp.city.toLowerCase().includes(q) ||
      hosp.district.toLowerCase().includes(q);
    if (!matchesQuery) return false;
    if (activeFilter === 'emergency' && !hosp.hasEmergency) return false;
    if (activeFilter === 'telemedicine' && !hosp.hasTelemedicine) return false;
    if (activeFilter === 'lab' && !hosp.hasLab) return false;
    if (activeFilter === 'insurance' && !hosp.hasInsurance) return false;
    return true;
  });

  const doctorSlots = state.slots.filter((s) => s.doctorId === currentDoctor.id);
  const selectedFamilyMember =
    state.familyMembers.find((f) => f.id === selectedFamilyId) || state.familyMembers[0];

  useEffect(() => {
    const validForDoc = doctorSlots.find((s) => s.id === selectedSlotId && s.status !== 'CONFIRMED');
    if (!validForDoc) {
      const firstAvail = doctorSlots.find((s) => s.status === 'AVAILABLE' || s.status === 'HELD');
      if (firstAvail) {
        setSelectedSlotId(firstAvail.id);
      }
    }
  }, [currentDoctor.id, state.slots]);

  // Handlers
  const handleSelectSlotAndHold = async (slotId: string) => {
    setBookingError(null);
    setSelectedSlotId(slotId);
    try {
      const res = await ayuApi.holdSlot(slotId, 'pat-mison');
      setHeldExpiresAt(res.expiresAt);
      setHoldRemainingSec(299);
      onActionFeedback?.(`Slot temporarily held (04:59 atomic lock)`);
    } catch (err: any) {
      setBookingError(err.message || 'Could not hold slot');
    }
  };

  const handleProceedToEsewa = async () => {
    setBookingError(null);
    setIsProcessingPayment(true);
    try {
      const data = await ayuApi.initiateEsewaPayment({
        slotId: selectedSlotId,
        doctorId: currentDoctor.id,
        patientId: 'pat-mison',
        forFamilyMemberId: selectedFamilyId,
        type: selectedConsultationType,
      });
      setEsewaDraft(data);
      setBookingStep('esewa_gateway');
    } catch (err: any) {
      setBookingError(err.message || 'Could not initiate payment');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleCompleteEsewaPayment = async (simulateFailure = false) => {
    if (!esewaDraft) return;
    setIsProcessingPayment(true);
    setBookingError(null);
    try {
      const result = await ayuApi.verifyEsewaPayment({
        paymentId: esewaDraft.paymentId,
        transactionUuid: esewaDraft.esewaPayload.transactionUuid,
        totalAmount: esewaDraft.esewaPayload.totalAmount,
        productCode: esewaDraft.esewaPayload.productCode,
        signature: simulateFailure ? 'INVALID_SIGNATURE_TEST' : esewaDraft.esewaPayload.signature,
        esewaStatus: simulateFailure ? 'FAILED' : 'COMPLETE',
        slotId: selectedSlotId,
        doctorId: currentDoctor.id,
        patientId: 'pat-mison',
        forFamilyMemberId: selectedFamilyId,
        type: selectedConsultationType,
      });

      setHeldExpiresAt(null);
      setSelectedAppointmentId(result.appointment.id);
      setBookingStep('confirmed');
      onActionFeedback?.(`eSewa UAT Verified! Booking ${result.appointment.bookingId} (${result.appointment.token}) confirmed.`);
    } catch (err: any) {
      setHeldExpiresAt(null);
      setBookingStep('select');
      setBookingError(err.message || 'Payment failed — held slot released back to AVAILABLE.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleBookLabTest = async (testId: string) => {
    try {
      const order = await ayuApi.orderLabTest({
        patientId: 'pat-mison',
        testId,
        orderedByDoctorId: 'doc-suman',
      });
      onActionFeedback?.(`Lab test ${order.testName} booked (${order.orderCode})`);
      setSubScreen(null);
      setActiveTab('health');
    } catch (err: any) {
      onActionFeedback?.(err.message);
    }
  };

  const handleSendAiQuestion = async (promptText?: string) => {
    const q = (promptText ?? aiInput).trim();
    if (!q || aiLoading) return;
    setAiInput('');
    setAiMessages((prev) => [...prev, { role: 'user', text: q }]);
    setAiLoading(true);
    try {
      const res = await ayuApi.askAyuAssistant(q, locale, misonProfile.name);
      setAiMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: res.reply,
          disclaimer: res.safetyDisclaimer,
          department: res.suggestedDepartment,
        },
      ]);
    } catch {
      setAiMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Unable to reach Ayu Assistant right now. Please try again.',
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleScanEmergencyQr = async () => {
    try {
      const data = await ayuApi.scanEmergencyHealthId(misonProfile.healthIdCode);
      setEmergencyScanResult(data);
      onActionFeedback?.(`Emergency Health ID scanned & logged in Audit Logs`);
    } catch (err: any) {
      onActionFeedback?.(err.message);
    }
  };

  const handleCreateFamilyMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFamName.trim()) return;
    await ayuApi.addFamilyMember('pat-mison', {
      name: newFamName.trim(),
      relation: newFamRelation,
      age: Number(newFamAge) || 45,
      gender: newFamRelation === 'Mother' ? 'Female' : 'Male',
      bloodGroup: 'O+',
    });
    setNewFamName('');
    setShowAddFamilyForm(false);
    onActionFeedback?.(`Added ${newFamRelation} (${newFamName}) to Family Profiles`);
  };

  const unreadPatientNotifs = state.notifications.filter(
    (n) => (n.recipientRole === 'patient' || n.recipientRole === 'ALL') && !n.read
  );

  // Check if Mison's token is currently called by Doctor
  const calledMisonApt = misonAppointments.find(
    (a) => a.status === 'IN_CONSULTATION' || a.status === 'CALLED'
  );

  const readyLabOrder = state.labOrders.find(
    (l) => l.patientId === 'pat-mison' && l.status === 'Report Ready'
  );

  return (
    <div
      className={`flex flex-col overflow-hidden transition-colors ${
        compactFrame
          ? 'w-full max-w-[420px] h-[820px] rounded-[36px] border-[6px] border-slate-800 dark:border-slate-700 shadow-2xl mx-auto'
          : 'w-full max-w-[460px] min-h-[780px] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg mx-auto'
      } ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}`}
    >
      {/* Mobile Top App Bar (Strict compact height <= 52px) */}
      <header
        className={`sticky top-0 z-30 flex items-center justify-between px-4 h-13 border-b shrink-0 ${
          darkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-100'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {subScreen ? (
            <button
              onClick={() => {
                setSubScreen(null);
                setBookingStep('select');
              }}
              className="min-h-[40px] min-w-[40px] -ml-2 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Back"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          ) : (
            <AyuLogo size={24} />
          )}
          <span className="font-bold text-sm tracking-tight truncate">
            {subScreen === 'doctor_detail'
              ? currentDoctor.name
              : subScreen === 'booking_flow'
              ? tr(locale, 'bookAppointment')
              : subScreen === 'appointment_detail'
              ? 'Appointment Details'
              : subScreen === 'ayu_assistant'
              ? tr(locale, 'ayuAssistant')
              : subScreen === 'emergency_screen'
              ? tr(locale, 'emergency')
              : subScreen === 'health_id_card'
              ? tr(locale, 'emergencyHealthId')
              : 'AYULINK'}
          </span>
        </div>

        {/* Language Segmented Selector + Notification Bell */}
        <div className="flex items-center gap-1.5">
          <div
            className={`flex items-center p-0.5 rounded-lg text-[11px] font-medium border ${
              darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200/70'
            }`}
          >
            {(
              [
                { code: 'en', label: 'EN' },
                { code: 'ne', label: 'नेपाली' },
                { code: 'roman_ne', label: 'Roman' },
              ] as const
            ).map((lang) => (
              <button
                key={lang.code}
                onClick={() => setLocale(lang.code)}
                className={`px-2 py-1 rounded-md transition-colors whitespace-nowrap ${
                  locale === lang.code
                    ? 'bg-teal-600 text-white font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setSubScreen(subScreen === 'notifications_list' ? null : 'notifications_list')}
            className="relative min-h-[38px] min-w-[38px] flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadPatientNotifs.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-teal-600" />
            )}
          </button>
        </div>
      </header>

      {/* REAL-TIME SOCKET.IO "YOUR TURN" BANNER (Step 13 of Demo Flow) */}
      {calledMisonApt && (
        <div className="bg-emerald-600 text-white px-4 py-2.5 flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <div className="text-xs font-bold tracking-wide">
              {tr(locale, 'yourTurnTitle')} · Token: {calledMisonApt.token}
            </div>
            <div className="text-[11px] text-emerald-50 truncate">
              {calledMisonApt.roomNumber} · {calledMisonApt.doctorName} · {tr(locale, 'pleaseProceedNow')}
            </div>
          </div>
          <button
            onClick={() => {
              setSelectedAppointmentId(calledMisonApt.id);
              setSubScreen('appointment_detail');
            }}
            className="px-2.5 py-1 bg-white text-emerald-900 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0"
          >
            Open Queue
          </button>
        </div>
      )}

      {/* MAIN SCROLLABLE MOBILE VIEWPORT */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* ===================================================================
            SUB-SCREEN: NOTIFICATIONS LIST
        =================================================================== */}
        {subScreen === 'notifications_list' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">Real-Time Notifications</h2>
              <button
                onClick={() => ayuApi.markNotificationsRead()}
                className="text-xs text-teal-600 font-semibold"
              >
                Mark all read
              </button>
            </div>
            {state.notifications
              .filter((n) => n.recipientRole === 'patient' || n.recipientRole === 'ALL')
              .map((n) => (
                <div
                  key={n.id}
                  className={`p-3 rounded-xl border text-xs space-y-1 ${
                    darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200/80'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span>{n.title}</span>
                    <span className="text-[11px] text-slate-400 font-mono">{n.displayTime}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{n.message}</p>
                </div>
              ))}
          </div>
        )}

        {/* ===================================================================
            SUB-SCREEN: DOCTOR PROFILE (Section 5)
        =================================================================== */}
        {subScreen === 'doctor_detail' && (
          <div className="space-y-4">
            <div
              className={`p-4 rounded-2xl border space-y-3 ${
                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50/70 border-slate-200/80'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold text-lg shrink-0">
                  {currentDoctor.name
                    .split(' ')
                    .slice(1, 3)
                    .map((n) => n[0])
                    .join('')}
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="text-[11px] text-teal-600 dark:text-teal-400 font-medium">
                    {currentDoctor.nmcDemoBadge}
                  </div>
                  <h2 className="text-lg font-bold tracking-tight">
                    {locale === 'ne' ? currentDoctor.nameNe : currentDoctor.name}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {currentDoctor.qualifications} · {locale === 'ne' ? currentDoctor.specialtyNe : currentDoctor.specialty}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 pt-0.5">
                    ★★★★★ <span className="font-mono font-semibold">{currentDoctor.rating}</span> ·{' '}
                    <span className="font-mono">{currentDoctor.experienceYears}</span> Years Experience ·{' '}
                    {currentDoctor.hospitalName}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 block">{tr(locale, 'consultationFee')}</span>
                  <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                    NPR {currentDoctor.consultationFee}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">{tr(locale, 'nextAvailable')}</span>
                  <span className="text-sm font-semibold text-teal-600 dark:text-teal-400">
                    {currentDoctor.onLeave ? 'On Leave' : currentDoctor.nextAvailableText}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
                <span>{currentDoctor.departmentName}</span>
                <span>·</span>
                <span>{currentDoctor.roomNumber}</span>
                {currentDoctor.telemedicineAvailable && (
                  <>
                    <span>·</span>
                    <span className="text-teal-600 dark:text-teal-400 font-medium">
                      Telemedicine Available ✓
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Real-Time Weekly Schedule Configured by Doctor */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-500">
                Real-Time Weekly Availability (Synced from Doctor Dashboard)
              </h3>
              <div
                className={`rounded-xl border divide-y text-xs ${
                  darkMode
                    ? 'bg-slate-900 border-slate-800 divide-slate-800'
                    : 'bg-white border-slate-200 divide-slate-100'
                }`}
              >
                {currentDoctor.schedule.map((blk, i) => (
                  <div key={i} className="px-3.5 py-2.5 flex items-center justify-between">
                    <span className="font-medium">{blk.day}</span>
                    <span className="font-mono text-slate-600 dark:text-slate-300">
                      {blk.isAvailable ? `${blk.startTime} – ${blk.endTime}` : 'Unavailable'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                disabled={currentDoctor.onLeave}
                onClick={() => {
                  setSelectedConsultationType('IN_PERSON');
                  setBookingStep('select');
                  setSubScreen('booking_flow');
                }}
                className="w-full min-h-[48px] rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <Calendar className="w-4 h-4" />
                <span>{tr(locale, 'bookAppointment')} · NPR {currentDoctor.consultationFee}</span>
              </button>

              {currentDoctor.telemedicineAvailable && (
                <button
                  onClick={() => {
                    setSelectedConsultationType('TELEMEDICINE');
                    setBookingStep('select');
                    setSubScreen('booking_flow');
                  }}
                  className={`w-full min-h-[44px] rounded-xl border font-semibold text-xs flex items-center justify-center gap-2 transition-colors ${
                    darkMode
                      ? 'border-slate-700 hover:bg-slate-900 text-slate-200'
                      : 'border-slate-300 hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <Video className="w-4 h-4 text-teal-600" />
                  <span>Video Consultation · NPR {currentDoctor.consultationFee} [Pay & Book]</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ===================================================================
            SUB-SCREEN: HOSPITAL DETAIL (Section 4)
        =================================================================== */}
        {subScreen === 'hospital_detail' && (
          <div className="space-y-4">
            <div
              className={`p-4 rounded-2xl border space-y-2 ${
                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200/80'
              }`}
            >
              <h2 className="text-lg font-bold">{selectedHospital.name}</h2>
              <p className="text-xs text-slate-500">
                ★★★★★ <span className="font-mono font-semibold">{selectedHospital.rating}</span> ·{' '}
                {selectedHospital.address} · <span className="font-mono">{selectedHospital.distanceKm} km</span>
              </p>
              <p className="text-xs text-teal-600 dark:text-teal-400 font-medium">
                {selectedHospital.hasEmergency ? 'Emergency ✓ · ' : ''}
                {selectedHospital.hasLab ? 'Lab ✓ · ' : ''}
                {selectedHospital.hasPharmacy ? 'Pharmacy ✓ · ' : ''}
                {selectedHospital.hasInsurance ? 'Insurance ✓ · ' : ''}
                {selectedHospital.hasTelemedicine ? 'Telemedicine ✓' : ''}
              </p>
            </div>

            <h3 className="text-xs font-semibold text-slate-500">Specialist Doctors at {selectedHospital.name}</h3>
            <div className="space-y-2.5">
              {state.doctors
                .filter((d) => d.hospitalId === selectedHospital.id)
                .map((doc) => (
                  <div
                    key={doc.id}
                    className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                      darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-sm">{doc.name}</div>
                      <div className="text-xs text-slate-500">
                        {doc.specialty} · {doc.departmentName} · <span className="font-mono">NPR {doc.consultationFee}</span>
                      </div>
                      <div className="text-[11px] text-teal-600 dark:text-teal-400 mt-0.5">
                        Next: {doc.nextAvailableText}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedDoctor(doc);
                        setSubScreen('doctor_detail');
                      }}
                      className="px-3 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold whitespace-nowrap shrink-0"
                    >
                      Select
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ===================================================================
            SUB-SCREEN: BOOKING FLOW + ATOMIC SLOT HOLD + ESEWA UAT (Sections 7, 8, 9)
        =================================================================== */}
        {subScreen === 'booking_flow' && (
          <div className="space-y-4">
            {/* Persistent Selected Patient Banner (Section 7 & 29) */}
            <div
              className={`px-3.5 py-2.5 rounded-xl border flex items-center justify-between text-xs ${
                darkMode ? 'bg-teal-950/40 border-teal-800/60' : 'bg-teal-50/80 border-teal-200'
              }`}
            >
              <div>
                <span className="text-slate-500 dark:text-slate-400">{tr(locale, 'appointmentFor')}: </span>
                <span className="font-bold text-teal-800 dark:text-teal-300">
                  {selectedFamilyMember.relation} ({selectedFamilyMember.name})
                </span>
              </div>
              <span className="font-mono text-[11px] text-teal-700 dark:text-teal-400">
                {selectedFamilyMember.healthIdCode}
              </span>
            </div>

            {bookingError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
                {bookingError}
              </div>
            )}

            {bookingStep === 'select' && (
              <div className="space-y-4">
                {/* Step A: Family Member Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold block">{tr(locale, 'whoIsThisFor')}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {state.familyMembers.map((fam) => (
                      <button
                        key={fam.id}
                        onClick={() => setSelectedFamilyId(fam.id)}
                        className={`p-2.5 rounded-xl border text-left transition-colors ${
                          selectedFamilyId === fam.id
                            ? 'border-teal-600 bg-teal-600/10 text-teal-700 dark:text-teal-300 font-semibold'
                            : darkMode
                            ? 'border-slate-800 bg-slate-900 text-slate-300'
                            : 'border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        <div className="text-xs font-semibold truncate">{fam.relation}</div>
                        <div className="text-[10px] text-slate-500 truncate">{fam.name.split(' ')[0]}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step B: Date & Real-Time Slot Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">Date: October 1, 2026 (Today)</span>
                    <span className="text-slate-500">{currentDoctor.hospitalName}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {doctorSlots.map((slot) => {
                      const isSelected = selectedSlotId === slot.id;
                      const isUnavailable = slot.status === 'CONFIRMED' || slot.status === 'BLOCKED';
                      return (
                        <button
                          key={slot.id}
                          disabled={isUnavailable}
                          onClick={() => handleSelectSlotAndHold(slot.id)}
                          className={`min-h-[48px] px-3 py-2 rounded-xl border text-left transition-all flex items-center justify-between ${
                            isUnavailable
                              ? 'opacity-45 cursor-not-allowed bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                              : isSelected
                              ? 'border-teal-600 bg-teal-600 text-white shadow-xs'
                              : darkMode
                              ? 'border-slate-800 bg-slate-900 hover:border-teal-500'
                              : 'border-slate-200 bg-white hover:border-teal-600'
                          }`}
                        >
                          <span className="font-mono text-xs font-bold">{slot.time}</span>
                          <span className="text-[10px] font-medium">
                            {slot.status === 'CONFIRMED'
                              ? 'Booked'
                              : slot.status === 'BLOCKED'
                              ? 'Blocked'
                              : slot.status === 'HELD'
                              ? 'Held'
                              : 'Available'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Temporary Slot Hold Countdown Box (Section 8) */}
                {heldExpiresAt && (
                  <div className="p-3.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/90 dark:bg-amber-950/40 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{tr(locale, 'slotHeld')}</span>
                      </div>
                      <div className="text-[11px] text-amber-800 dark:text-amber-400">
                        Atomic lock active — prevents double booking
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-amber-700 dark:text-amber-400">{tr(locale, 'expiresIn')}:</div>
                      <div className="font-mono text-base font-bold text-amber-900 dark:text-amber-200 tabular-nums">
                        {formatTimer(holdRemainingSec)}
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    if (!heldExpiresAt) {
                      handleSelectSlotAndHold(selectedSlotId);
                    }
                    setBookingStep('summary');
                  }}
                  className="w-full min-h-[48px] rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm transition-colors"
                >
                  Continue to Appointment Summary
                </button>
              </div>
            )}

            {/* Step C: Appointment Summary before Payment */}
            {bookingStep === 'summary' && (
              <div className="space-y-4">
                {heldExpiresAt && (
                  <div className="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-between text-xs">
                    <span className="font-semibold text-amber-800 dark:text-amber-300">SLOT HELD</span>
                    <span className="font-mono font-bold text-amber-900 dark:text-amber-200">
                      Expires in: {formatTimer(holdRemainingSec)}
                    </span>
                  </div>
                )}

                <div
                  className={`p-4 rounded-2xl border space-y-2.5 text-xs ${
                    darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="text-sm font-bold pb-1 border-b border-slate-200 dark:border-slate-800">
                    {tr(locale, 'appointmentSummary')}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Hospital</span>
                    <span className="font-semibold">{currentDoctor.hospitalName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Department</span>
                    <span className="font-semibold">{currentDoctor.departmentName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Doctor</span>
                    <span className="font-semibold">{currentDoctor.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Date & Time</span>
                    <span className="font-mono font-semibold">
                      Oct 1, 2026 · {doctorSlots.find((s) => s.id === selectedSlotId)?.time || '3:30 PM'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Appointment For</span>
                    <span className="font-semibold">
                      {selectedFamilyMember.relation} ({selectedFamilyMember.name})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Consultation Mode</span>
                    <span className="font-semibold">{selectedConsultationType}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between text-sm font-bold">
                    <span>Total Consultation Fee</span>
                    <span className="font-mono text-teal-600">NPR {currentDoctor.consultationFee}</span>
                  </div>
                </div>

                <button
                  disabled={isProcessingPayment}
                  onClick={handleProceedToEsewa}
                  className="w-full min-h-[48px] rounded-xl bg-[#60BB46] hover:bg-[#52a33b] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xs transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    {isProcessingPayment
                      ? 'Initiating eSewa UAT Request...'
                      : `${tr(locale, 'payWithEsewa')} · NPR ${currentDoctor.consultationFee}`}
                  </span>
                </button>
              </div>
            )}

            {/* Step D: eSewa UAT Cryptographic Verification Gateway (Section 9) */}
            {bookingStep === 'esewa_gateway' && esewaDraft && (
              <div className="p-4 rounded-2xl border-2 border-[#60BB46] bg-white dark:bg-slate-900 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <span className="text-xs font-bold text-[#60BB46] block">eSewa EPAYTEST (UAT Environment)</span>
                    <h3 className="text-sm font-bold">Merchant: AyuLink Healthcare OS Nepal</h3>
                  </div>
                  <span className="font-mono text-sm font-bold">NPR {esewaDraft.esewaPayload.totalAmount}</span>
                </div>

                <div className="space-y-1.5 text-[11px] font-mono bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="flex justify-between">
                    <span className="text-slate-500">product_code:</span>
                    <span className="font-semibold">{esewaDraft.esewaPayload.productCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">transaction_uuid:</span>
                    <span className="font-semibold">{esewaDraft.esewaPayload.transactionUuid}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">total_amount:</span>
                    <span className="font-semibold">NPR {esewaDraft.esewaPayload.totalAmount}</span>
                  </div>
                  <div className="pt-1 border-t border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 block">Backend HMAC-SHA256 Signature:</span>
                    <span className="text-[10px] break-all text-teal-700 dark:text-teal-400">
                      {esewaDraft.esewaPayload.signature}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    disabled={isProcessingPayment}
                    onClick={() => handleCompleteEsewaPayment(false)}
                    className="w-full min-h-[46px] rounded-xl bg-[#60BB46] hover:bg-[#52a33b] text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isProcessingPayment
                        ? 'Backend Verifying Transaction & Signature...'
                        : 'Authorize eSewa UAT Payment & Verify on Backend'}
                    </span>
                  </button>

                  <button
                    disabled={isProcessingPayment}
                    onClick={() => handleCompleteEsewaPayment(true)}
                    className="w-full min-h-[40px] rounded-xl border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs font-medium"
                  >
                    Simulate Payment Failure (HELD → EXPIRED → AVAILABLE)
                  </button>
                </div>
              </div>
            )}

            {/* Step E: Verified Confirmation Screen (Step 7 of Hackathon Demo Flow) */}
            {bookingStep === 'confirmed' && activeAppointment && (
              <div className="p-5 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-600 text-white flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                    {tr(locale, 'paymentVerified')}
                  </div>
                  <div className="text-base font-bold text-slate-900 dark:text-white">
                    {tr(locale, 'appointmentConfirmed')}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs space-y-1 text-left">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Booking ID:</span>
                    <span className="font-mono font-bold">{activeAppointment.bookingId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Assigned Token:</span>
                    <span className="font-mono font-bold text-teal-600 text-sm">{activeAppointment.token}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Doctor:</span>
                    <span className="font-semibold">{activeAppointment.doctorName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Arrive By:</span>
                    <span className="font-mono font-semibold">{activeAppointment.arriveBy}</span>
                  </div>
                </div>

                <button
                  onClick={() => setSubScreen('appointment_detail')}
                  className="w-full min-h-[46px] rounded-xl bg-teal-600 text-white font-semibold text-xs"
                >
                  Open Full Appointment Details & Live Queue
                </button>
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            SUB-SCREEN: DETAILED APPOINTMENT + LIVE QUEUE + QR CHECK-IN (Sections 10, 11, 12)
        =================================================================== */}
        {subScreen === 'appointment_detail' && activeAppointment && (
          <div className="space-y-4">
            {/* LIVE QUEUE CARD (Section 11) */}
            <div
              className={`p-4 rounded-2xl border space-y-3 ${
                activeAppointment.status === 'IN_CONSULTATION' || activeAppointment.status === 'CALLED'
                  ? 'border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/40'
                  : darkMode
                  ? 'bg-slate-900 border-slate-800'
                  : 'bg-teal-50/60 border-teal-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold tracking-wide text-teal-800 dark:text-teal-300">
                  {tr(locale, 'yourQueue')} · LIVE SOCKET.IO
                </span>
                <span className="text-xs font-mono font-semibold text-teal-700 dark:text-teal-400">
                  {activeAppointment.roomNumber}
                </span>
              </div>

              {activeAppointment.status === 'IN_CONSULTATION' || activeAppointment.status === 'CALLED' ? (
                <div className="p-3 rounded-xl bg-emerald-600 text-white space-y-1">
                  <div className="text-sm font-bold">{tr(locale, 'yourTurnTitle')}</div>
                  <div className="text-xs font-mono">
                    Token: {activeAppointment.token} · {activeAppointment.roomNumber}
                  </div>
                  <div className="text-xs">{tr(locale, 'pleaseProceedNow')}</div>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800">
                    <span className="text-[10px] text-slate-500 block">{tr(locale, 'yourToken')}</span>
                    <span className="font-mono text-sm font-bold text-teal-600">{activeAppointment.token}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800">
                    <span className="text-[10px] text-slate-500 block">{tr(locale, 'currently')}</span>
                    <span className="font-mono text-sm font-bold">{queueState?.currentToken || 'A-20'}</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800">
                    <span className="text-[10px] text-slate-500 block">{tr(locale, 'peopleAhead')}</span>
                    <span className="font-mono text-sm font-bold">
                      {Math.max(0, activeAppointment.tokenNumber - (queueState?.currentTokenNumber || 20) - 1)}
                    </span>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800">
                    <span className="text-[10px] text-slate-500 block">{tr(locale, 'estimatedWait')}</span>
                    <span className="font-mono text-sm font-bold">
                      {Math.max(0, activeAppointment.tokenNumber - (queueState?.currentTokenNumber || 20) - 1) * 6} min
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* SECURE QR CHECK-IN PASS (Section 12) */}
            <div
              className={`p-4 rounded-2xl border text-center space-y-2.5 ${
                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="text-xs font-bold">Appointment Check-In QR Pass</div>
              <SecureQrCode value={activeAppointment.qrCheckInToken} size={132} />
              <div className="font-mono text-[11px] text-slate-500">{activeAppointment.qrCheckInToken}</div>
              <p className="text-[11px] text-slate-500">
                Contains only a secure cryptographic booking identifier — never raw medical records.
              </p>
              {activeAppointment.status === 'CONFIRMED' && (
                <button
                  onClick={async () => {
                    await ayuApi.qrCheckIn({ qrToken: activeAppointment.qrCheckInToken });
                    onActionFeedback?.(`Receptionist verified QR Check-In for ${activeAppointment.token}`);
                  }}
                  className="w-full min-h-[40px] rounded-xl bg-slate-900 dark:bg-teal-600 text-white text-xs font-semibold"
                >
                  Simulate Receptionist QR Scan → Check In Now
                </button>
              )}
            </div>

            {/* APPOINTMENT DETAILS SHEET (Section 10) */}
            <div
              className={`p-4 rounded-2xl border space-y-2 text-xs ${
                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50/70 border-slate-200'
              }`}
            >
              <div className="font-bold text-sm pb-1 border-b border-slate-200 dark:border-slate-800">
                APPOINTMENT DETAILS
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Booking ID:</span>
                <span className="font-mono font-semibold">{activeAppointment.bookingId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Patient:</span>
                <span className="font-semibold">{activeAppointment.patientName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Appointment For:</span>
                <span className="font-semibold">{activeAppointment.forRelation}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Hospital:</span>
                <span className="font-semibold">{activeAppointment.hospitalName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Address & Contact:</span>
                <span className="font-medium text-right">
                  {activeAppointment.hospitalAddress} · {activeAppointment.hospitalContact}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Department & Room:</span>
                <span className="font-semibold">
                  {activeAppointment.departmentName} · {activeAppointment.roomNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Doctor:</span>
                <span className="font-semibold">{activeAppointment.doctorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date & Time:</span>
                <span className="font-mono font-semibold">
                  {activeAppointment.displayDate} · {activeAppointment.time}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Arrive By:</span>
                <span className="font-mono font-semibold text-teal-600">{activeAppointment.arriveBy}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Token:</span>
                <span className="font-mono font-bold">{activeAppointment.token}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Consultation:</span>
                <span className="font-mono font-semibold">NPR {activeAppointment.consultationFee}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment:</span>
                <span className="font-semibold text-emerald-600">✓ Verified</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="font-mono font-bold text-teal-600">{activeAppointment.status}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
                <strong className="text-slate-700 dark:text-slate-300">Instructions:</strong>{' '}
                {activeAppointment.instructions}
              </div>
            </div>

            {/* Telemedicine Join Button (Section 25) */}
            <button
              onClick={() => setSubScreen('telemedicine_room')}
              className="w-full min-h-[44px] rounded-xl border border-teal-600 text-teal-600 dark:text-teal-400 font-semibold text-xs flex items-center justify-center gap-2"
            >
              <Video className="w-4 h-4" />
              <span>Join Telemedicine Video Consultation Room</span>
            </button>
          </div>
        )}

        {/* ===================================================================
            SUB-SCREEN: TELEMEDICINE CONSULTATION ROOM (Section 25)
        =================================================================== */}
        {subScreen === 'telemedicine_room' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-900 text-white p-5 space-y-4 border border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-teal-400">ROOM: AYU-TELE-CARDIO-404</span>
                <span className="text-emerald-400 font-medium">● Encrypted WebRTC Channel</span>
              </div>
              <div className="h-44 rounded-xl bg-slate-800 flex flex-col items-center justify-center gap-2 border border-slate-700">
                <div className="w-14 h-14 rounded-full bg-teal-600 flex items-center justify-center font-bold text-lg">
                  SS
                </div>
                <div className="text-sm font-bold">{currentDoctor.name}</div>
                <div className="text-xs text-slate-400">
                  {currentDoctor.specialty} · {currentDoctor.hospitalName}
                </div>
              </div>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setSubScreen('appointment_detail')}
                  className="px-4 py-2.5 rounded-xl bg-red-600 text-white text-xs font-semibold"
                >
                  Leave Video Room
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            SUB-SCREEN: LAB TEST BOOKING (Section 23)
        =================================================================== */}
        {subScreen === 'lab_booking' && (
          <div className="space-y-3">
            <h2 className="text-base font-bold">Book Diagnostic Lab Test</h2>
            <p className="text-xs text-slate-500">
              City Hospital Accredited Pathology Laboratory · Instant Timeline Sync
            </p>
            {state.labCatalog.map((test) => (
              <div
                key={test.id}
                className={`p-3.5 rounded-2xl border space-y-2 ${
                  darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-sm">{test.name}</div>
                    <div className="text-xs text-slate-500">
                      {test.category} · Available Today · Report in {test.turnaroundHours}h
                    </div>
                  </div>
                  <span className="font-mono font-bold text-sm text-teal-600 shrink-0">NPR {test.price}</span>
                </div>
                <p className="text-[11px] text-slate-500">{test.preparation}</p>
                <button
                  onClick={() => handleBookLabTest(test.id)}
                  className="w-full min-h-[42px] rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold"
                >
                  Book Test · NPR {test.price}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ===================================================================
            SUB-SCREEN: PHARMACY VIEW (Section 24)
        =================================================================== */}
        {subScreen === 'pharmacy_view' && (
          <div className="space-y-3">
            <h2 className="text-base font-bold">Connected Hospital Pharmacy</h2>
            {state.pharmacyOrders.map((ord) => (
              <div
                key={ord.id}
                className={`p-4 rounded-2xl border space-y-2.5 text-xs ${
                  darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-sm">Prescription {ord.rxCode}</span>
                  <span className="font-semibold text-teal-600">{ord.status}</span>
                </div>
                <div className="text-slate-500">
                  {ord.pharmacyName} · {ord.medicinesCount} Medicines ·{' '}
                  <span className="font-mono">NPR {ord.totalAmount}</span>
                </div>
                <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                  {ord.medicines.map((m, idx) => (
                    <div key={idx} className="flex justify-between text-[11px]">
                      <span className="font-medium">
                        {m.name} {m.strength}
                      </span>
                      <span className="text-slate-500">
                        {m.dosage} · {m.frequency} ({m.duration})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ===================================================================
            SUB-SCREEN: AI — AYU ASSISTANT (Section 26)
        =================================================================== */}
        {subScreen === 'ayu_assistant' && (
          <div className="flex flex-col h-[640px]">
            <div className="p-3 rounded-xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-[11px] text-teal-900 dark:text-teal-200 mb-3">
              <strong>Ayu Assistant Safety Guardrail:</strong> Provides medical terminology & report literacy only.
              Never diagnoses or prescribes medicine.
            </div>

            {/* Quick Prompt Starters */}
            <div className="flex gap-1.5 overflow-x-auto pb-2 shrink-0">
              {[
                'Explain my CBC report',
                'Heart doctor in Bharatpur',
                'Explain Paracetamol 500mg instructions',
                'Questions for Dr. Suman',
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => handleSendAiQuestion(q)}
                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium whitespace-nowrap shrink-0 ${
                    darkMode
                      ? 'bg-slate-900 border-slate-800 text-slate-300'
                      : 'bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 py-2">
              {aiMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-2xl text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-teal-600 text-white ml-8'
                      : darkMode
                      ? 'bg-slate-900 border border-slate-800 mr-4'
                      : 'bg-slate-100 border border-slate-200/70 mr-4'
                  }`}
                >
                  <div className="whitespace-pre-line">{msg.text}</div>
                  {msg.department && (
                    <button
                      onClick={() => {
                        setSearchQuery(msg.department || 'Cardiology');
                        setSubScreen(null);
                        setActiveTab('doctors');
                      }}
                      className="mt-2 px-2.5 py-1 rounded-md bg-teal-600 text-white text-[11px] font-semibold"
                    >
                      Browse {msg.department} Doctors →
                    </button>
                  )}
                </div>
              ))}
              {aiLoading && (
                <div className="text-xs text-slate-400 italic px-2">Ayu Assistant is analyzing...</div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendAiQuestion();
              }}
              className="pt-2 flex items-center gap-2 border-t border-slate-200 dark:border-slate-800"
            >
              <input
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Ask in English, नेपाली, or Roman Nepali..."
                className={`flex-1 h-10 px-3 rounded-xl border text-xs ${
                  darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'
                }`}
              />
              <button
                type="submit"
                className="h-10 w-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* ===================================================================
            SUB-SCREEN: EMERGENCY SCREEN & HEALTH ID (Sections 27 & 28)
        =================================================================== */}
        {(subScreen === 'emergency_screen' || subScreen === 'health_id_card') && (
          <div className="space-y-4">
            {/* Emergency Health ID Card (Section 27) */}
            <div className="p-4 rounded-2xl border-2 border-red-500/80 bg-red-50/40 dark:bg-red-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold tracking-wider text-red-600 dark:text-red-400 block">
                    AYULINK HEALTH ID
                  </span>
                  <h2 className="font-mono text-base font-bold">{misonProfile.healthIdCode}</h2>
                </div>
                <span className="font-mono text-sm font-bold text-red-600">Blood: {misonProfile.bloodGroup}</span>
              </div>

              <div className="flex items-center gap-4">
                <SecureQrCode value={misonProfile.qrSecurityToken} size={108} />
                <div className="text-xs space-y-1 flex-1">
                  <div className="font-bold">{misonProfile.name}</div>
                  <div className="text-slate-600 dark:text-slate-300">
                    <strong>Allergies:</strong> {misonProfile.allergies.join(', ')}
                  </div>
                  <div className="text-slate-600 dark:text-slate-300">
                    <strong>Conditions:</strong> {misonProfile.criticalConditions[0]}
                  </div>
                  <div className="text-slate-600 dark:text-slate-300">
                    <strong>Emergency Contact:</strong> {misonProfile.emergencyContact.name} (
                    {misonProfile.emergencyContact.phone})
                  </div>
                </div>
              </div>

              <button
                onClick={handleScanEmergencyQr}
                className="w-full min-h-[40px] rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
              >
                Simulate Paramedic Emergency QR Scan (Audited Access)
              </button>

              {emergencyScanResult && (
                <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 text-[11px] space-y-1">
                  <div className="font-bold text-emerald-600">
                    ✓ Responder View Resolved (Audit Logged at {emergencyScanResult.accessedAt})
                  </div>
                  <div>
                    <strong>Permitted Fields Only:</strong> {emergencyScanResult.name} · Blood{' '}
                    {emergencyScanResult.bloodGroup} · Allergies: {emergencyScanResult.knownAllergies.join(', ')} ·
                    Medicines: {emergencyScanResult.importantMedicines.join(', ')}
                  </div>
                </div>
              )}
            </div>

            {/* Nearest Emergency Hospitals (Section 28) */}
            <div className="space-y-2.5">
              <h3 className="text-sm font-bold">{tr(locale, 'nearestEmergency')}</h3>
              {state.hospitals
                .filter((h) => h.hasEmergency)
                .map((hosp) => (
                  <div
                    key={hosp.id}
                    className={`p-3.5 rounded-2xl border space-y-2.5 ${
                      darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-sm">{hosp.name}</div>
                        <div className="text-xs text-slate-500">
                          <span className="font-mono font-semibold text-red-600">{hosp.distanceKm} km</span> · 24/7
                          Emergency · {hosp.address}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => onActionFeedback?.(`Dialing ${hosp.name} Emergency: ${hosp.emergencyPhone}`)}
                        className="min-h-[38px] rounded-lg bg-red-600 text-white text-xs font-semibold flex items-center justify-center gap-1"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Call</span>
                      </button>
                      <button
                        onClick={() =>
                          onActionFeedback?.(`Opening GPS Directions to ${hosp.name} (${hosp.distanceKm} km)`)
                        }
                        className="min-h-[38px] rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold flex items-center justify-center gap-1"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Directions</span>
                      </button>
                      <button
                        onClick={handleScanEmergencyQr}
                        className="min-h-[38px] rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold flex items-center justify-center gap-1"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Emergency ID</span>
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ===================================================================
            MAIN TAB 1: HOME (Section 3)
        =================================================================== */}
        {!subScreen && activeTab === 'home' && (
          <div className="space-y-4">
            {/* Greeting & Health ID Bar */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold tracking-tight">{tr(locale, 'greeting')}</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">{tr(locale, 'howCanWeHelp')}</p>
              </div>
              <button
                onClick={() => setSubScreen('health_id_card')}
                className={`px-2.5 py-1.5 rounded-xl border text-right transition-colors ${
                  darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <span className="text-[9px] text-slate-400 block">HEALTH ID</span>
                <span className="font-mono text-xs font-bold text-teal-600">{misonProfile.healthIdCode}</span>
              </button>
            </div>

            {/* 6 Core Services Grid (Section 3) */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                {
                  label: tr(locale, 'findDoctor'),
                  icon: Stethoscope,
                  onClick: () => {
                    setDiscoveryMode('doctors');
                    setActiveTab('doctors');
                  },
                },
                {
                  label: tr(locale, 'findHospital'),
                  icon: Building2,
                  onClick: () => {
                    setDiscoveryMode('hospitals');
                    setActiveTab('doctors');
                  },
                },
                {
                  label: tr(locale, 'bookLabTest'),
                  icon: FlaskConical,
                  onClick: () => setSubScreen('lab_booking'),
                },
                {
                  label: tr(locale, 'pharmacy'),
                  icon: Pill,
                  onClick: () => setSubScreen('pharmacy_view'),
                },
                {
                  label: tr(locale, 'telemedicine'),
                  icon: Video,
                  onClick: () => {
                    setActiveFilter('telemedicine');
                    setActiveTab('doctors');
                  },
                },
                {
                  label: tr(locale, 'emergency'),
                  icon: AlertTriangle,
                  isEmergency: true,
                  onClick: () => setSubScreen('emergency_screen'),
                },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <button
                    key={i}
                    onClick={item.onClick}
                    className={`min-h-[76px] p-2.5 rounded-2xl border flex flex-col items-center justify-center gap-1.5 text-center transition-colors ${
                      item.isEmergency
                        ? 'border-red-200 dark:border-red-900/70 bg-red-50/60 dark:bg-red-950/30 text-red-700 dark:text-red-300'
                        : darkMode
                        ? 'border-slate-800 bg-slate-900 hover:border-teal-600'
                        : 'border-slate-200/90 bg-slate-50/70 hover:bg-white hover:border-teal-600'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${item.isEmergency ? 'text-red-600' : 'text-teal-600'}`} />
                    <span className="text-[11px] font-semibold leading-tight">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* UPCOMING APPOINTMENT CARD (Section 3) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold tracking-wide text-slate-500">
                  {tr(locale, 'upcomingAppointment')}
                </h2>
                {misonAppointments.length > 0 && (
                  <span className="text-[11px] font-mono text-teal-600 font-semibold">
                    Status: {misonAppointments[0].status}
                  </span>
                )}
              </div>

              {misonAppointments.length > 0 ? (
                <div
                  className={`p-4 rounded-2xl border space-y-3 ${
                    darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-teal-600 dark:text-teal-400">
                      TODAY · {misonAppointments[0].time}
                    </span>
                    <span className="font-mono font-bold text-sm px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300">
                      Token: {misonAppointments[0].token}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-bold">{misonAppointments[0].doctorName}</div>
                    <div className="text-xs text-slate-500">
                      {misonAppointments[0].departmentName} · {misonAppointments[0].hospitalName} ·{' '}
                      {misonAppointments[0].roomNumber}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedAppointmentId(misonAppointments[0].id);
                      setSubScreen('appointment_detail');
                    }}
                    className="w-full min-h-[42px] rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors"
                  >
                    {tr(locale, 'viewAppointment')}
                  </button>
                </div>
              ) : (
                <div
                  className={`p-4 rounded-2xl border space-y-3 ${
                    darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50/80 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-semibold text-teal-600">RECOMMENDED · TODAY · 3:30 PM</span>
                    <span className="font-mono text-xs text-slate-500">Next Token: A-24</span>
                  </div>
                  <div>
                    <div className="text-sm font-bold">Dr. Suman Sharma</div>
                    <div className="text-xs text-slate-500">
                      Cardiology · City Hospital · NPR 800 · ★★★★★ 4.8
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const suman = state.doctors.find((d) => d.id === 'doc-suman') || state.doctors[0];
                      setSelectedDoctor(suman);
                      setSubScreen('doctor_detail');
                    }}
                    className="w-full min-h-[42px] rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors"
                  >
                    {tr(locale, 'bookAppointment')} (Demo Step 3 →)
                  </button>
                </div>
              )}
            </div>

            {/* Lab Report Ready Notification Card (Step 17 of Demo Flow) */}
            {readyLabOrder && (
              <div
                className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                  darkMode ? 'bg-slate-900 border-slate-800' : 'bg-emerald-50/60 border-emerald-200'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    Your {readyLabOrder.testName} report is ready.
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {readyLabOrder.hospitalName} · {readyLabOrder.scheduledDate}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLabReport(readyLabOrder)}
                  className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold whitespace-nowrap shrink-0"
                >
                  View Report
                </button>
              </div>
            )}

            {/* AI Ayu Assistant Banner + Offline Mode Indicator */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => setSubScreen('ayu_assistant')}
                className={`p-3 rounded-2xl border text-left space-y-1 transition-colors ${
                  darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 hover:border-teal-600'
                }`}
              >
                <div className="flex items-center gap-1.5 text-teal-600 font-bold text-xs">
                  <Sparkles className="w-4 h-4" />
                  <span>{tr(locale, 'ayuAssistant')}</span>
                </div>
                <p className="text-[11px] text-slate-500">Explain lab reports & symptoms in EN / नेपाली</p>
              </button>

              <button
                onClick={() => setShowOfflineCache(!showOfflineCache)}
                className={`p-3 rounded-2xl border text-left space-y-1 transition-colors ${
                  darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 hover:border-teal-600'
                }`}
              >
                <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-bold text-xs">
                  <WifiOff className="w-4 h-4 text-teal-600" />
                  <span>Offline Pass</span>
                </div>
                <p className="text-[11px] text-slate-500">Cached QR, Booking ID & Emergency Card</p>
              </button>
            </div>

            {showOfflineCache && (
              <div
                className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
                  darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'
                }`}
              >
                <div className="font-bold">Offline-Safe Cached Packet (Low-Connectivity Mode)</div>
                <div className="font-mono text-[11px]">
                  Health ID: {misonProfile.healthIdCode} · Blood: {misonProfile.bloodGroup}
                </div>
                <div className="font-mono text-[11px]">
                  Latest Booking: {misonAppointments[0]?.bookingId || 'AL-BK-20261001-0024'} · City Hospital (+977-056-524100)
                </div>
                <div className="text-[10px] text-slate-500">
                  Full clinical records remain encrypted on server and are never cached offline.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            MAIN TAB 2: DOCTORS & HOSPITALS DISCOVERY (Section 4)
        =================================================================== */}
        {!subScreen && activeTab === 'doctors' && (
          <div className="space-y-3.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tr(locale, 'searchPlaceholder')}
                className={`w-full h-10 pl-9 pr-8 rounded-xl border text-xs ${
                  darkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'
                }`}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Quick Search Shortcut for Demo Step 2 ("Heart doctor") */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                onClick={() => {
                  setDiscoveryMode('doctors');
                  setSearchQuery('Heart doctor');
                }}
                className="px-2.5 py-1 rounded-lg bg-teal-600/10 text-teal-700 dark:text-teal-300 border border-teal-500/30 text-[11px] font-semibold whitespace-nowrap"
              >
                Search: "Heart doctor"
              </button>
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'available_today', label: 'Available Today' },
                  { id: 'emergency', label: '24/7 Emergency' },
                  { id: 'telemedicine', label: 'Telemedicine' },
                  { id: 'insurance', label: 'Insurance' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
                    activeFilter === f.id
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : darkMode
                      ? 'bg-slate-900 text-slate-400 border border-slate-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Toggle Doctors vs Hospitals */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900">
              <button
                onClick={() => setDiscoveryMode('doctors')}
                className={`py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  discoveryMode === 'doctors'
                    ? 'bg-white dark:bg-slate-800 shadow-2xs text-slate-900 dark:text-white'
                    : 'text-slate-500'
                }`}
              >
                Doctors ({filteredDoctors.length})
              </button>
              <button
                onClick={() => setDiscoveryMode('hospitals')}
                className={`py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  discoveryMode === 'hospitals'
                    ? 'bg-white dark:bg-slate-800 shadow-2xs text-slate-900 dark:text-white'
                    : 'text-slate-500'
                }`}
              >
                Hospitals ({filteredHospitals.length})
              </button>
            </div>

            {/* Doctors List */}
            {discoveryMode === 'doctors' ? (
              <div className="space-y-2.5">
                {filteredDoctors.map((doc) => (
                  <div
                    key={doc.id}
                    className={`p-3.5 rounded-2xl border space-y-2.5 ${
                      darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-sm">
                          {locale === 'ne' ? doc.nameNe : doc.name}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {doc.qualifications} · {doc.specialty} · {doc.experienceYears} yrs exp
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                          ★★★★★ <span className="font-mono font-semibold">{doc.rating}</span> · {doc.hospitalName}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-sm text-teal-600 block">
                          NPR {doc.consultationFee}
                        </span>
                        <span className="text-[10px] text-emerald-600 font-medium">
                          {doc.onLeave ? 'On Leave' : 'Available Today'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-[11px] text-slate-500">
                        Next: <strong className="text-slate-700 dark:text-slate-200">{doc.nextAvailableText}</strong>
                      </span>
                      <button
                        onClick={() => {
                          setSelectedDoctor(doc);
                          setSubScreen('doctor_detail');
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold"
                      >
                        View Profile
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Hospitals List (Section 4) */
              <div className="space-y-3">
                {filteredHospitals.map((hosp) => (
                  <div
                    key={hosp.id}
                    className={`p-4 rounded-2xl border space-y-2.5 ${
                      darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-sm">{hosp.name}</h3>
                        <p className="text-xs text-slate-500">
                          ★★★★★ <span className="font-mono font-semibold">{hosp.rating}</span> · {hosp.city},{' '}
                          {hosp.district} · <span className="font-mono">{hosp.distanceKm} km</span>
                        </p>
                      </div>
                      <span className="text-[11px] font-semibold text-emerald-600">Open Today</span>
                    </div>

                    <div className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                      {hosp.hasEmergency && 'Emergency ✓  '}
                      {hosp.hasLab && 'Lab ✓  '}
                      {hosp.hasPharmacy && 'Pharmacy ✓  '}
                      {hosp.hasInsurance && 'Insurance ✓  '}
                      {hosp.hasTelemedicine && 'Telemedicine ✓'}
                    </div>

                    <button
                      onClick={() => {
                        setSelectedHospital(hosp);
                        setSubScreen('hospital_detail');
                      }}
                      className="w-full min-h-[40px] rounded-xl bg-slate-900 dark:bg-teal-600 text-white text-xs font-semibold"
                    >
                      View Hospital
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            MAIN TAB 3: APPOINTMENTS & QUEUE (Sections 10 & 11)
        =================================================================== */}
        {!subScreen && activeTab === 'appointments' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">My Appointments</h2>
              <button
                onClick={() => {
                  setSelectedDoctor(state.doctors[0]);
                  setSubScreen('doctor_detail');
                }}
                className="text-xs font-semibold text-teal-600 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Book New</span>
              </button>
            </div>

            {misonAppointments.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-2">
                <p className="text-xs text-slate-500">No appointments booked yet for Mison Khatiwada.</p>
                <button
                  onClick={() => {
                    setSelectedDoctor(state.doctors[0]);
                    setSubScreen('doctor_detail');
                  }}
                  className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-semibold"
                >
                  Book Dr. Suman Sharma (3:30 PM)
                </button>
              </div>
            ) : (
              misonAppointments.map((apt) => (
                <div
                  key={apt.id}
                  className={`p-4 rounded-2xl border space-y-2.5 ${
                    darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-teal-600">
                      {apt.displayDate} · {apt.time}
                    </span>
                    <span className="font-mono font-bold">Token: {apt.token}</span>
                  </div>
                  <div>
                    <div className="text-sm font-bold">{apt.doctorName}</div>
                    <div className="text-xs text-slate-500">
                      {apt.departmentName} · {apt.hospitalName} · {apt.roomNumber}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Appointment For: <strong className="text-slate-700 dark:text-slate-200">{apt.forRelation}</strong>{' '}
                      · Payment: <span className="text-emerald-600 font-semibold">✓ {apt.paymentStatus}</span> · Status:{' '}
                      <span className="font-mono font-semibold">{apt.status}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedAppointmentId(apt.id);
                      setSubScreen('appointment_detail');
                    }}
                    className="w-full min-h-[40px] rounded-xl bg-teal-600 text-white text-xs font-semibold"
                  >
                    View Live Queue & QR Pass
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* ===================================================================
            MAIN TAB 4: PATIENT HEALTH TIMELINE (Sections 21, 22, 23)
        =================================================================== */}
        {!subScreen && activeTab === 'health' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">{tr(locale, 'healthTimeline')}</h2>
                <p className="text-xs text-slate-500">One Health ID: {misonProfile.healthIdCode}</p>
              </div>
              <button
                onClick={() => setSubScreen('lab_booking')}
                className="px-3 py-1.5 rounded-xl bg-teal-600 text-white text-xs font-semibold"
              >
                + Book Lab Test
              </button>
            </div>

            {/* Digital E-Prescriptions Card (Section 21) */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-500">DIGITAL E-PRESCRIPTIONS</h3>
              {state.prescriptions
                .filter((rx) => rx.patientId === 'pat-mison')
                .map((rx) => (
                  <div
                    key={rx.id}
                    className={`p-3.5 rounded-2xl border space-y-2 text-xs ${
                      darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-teal-600">
                        AYULINK E-PRESCRIPTION · {rx.rxCode}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">{rx.displayDate}</span>
                    </div>
                    <div className="font-semibold">
                      {rx.doctorName} ({rx.departmentName} · {rx.hospitalName})
                    </div>
                    <div className="text-slate-500">
                      {rx.medicines.length} Medicines · Follow-up: <strong>{rx.followUpDate}</strong>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => setSelectedPrescription(rx)}
                        className="flex-1 min-h-[38px] rounded-xl bg-slate-900 dark:bg-teal-600 text-white font-semibold text-xs"
                      >
                        View E-Prescription
                      </button>
                      <button
                        onClick={() => setSubScreen('pharmacy_view')}
                        className="px-3 min-h-[38px] rounded-xl border border-slate-300 dark:border-slate-700 font-semibold text-xs"
                      >
                        Find Pharmacy
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            {/* Chronological Health Timeline (Section 22) */}
            <div className="space-y-3">
              {['OCT 1, 2026', 'SEP 18, 2026'].map((dateGroup) => {
                const items = state.timeline
                  .filter((t) => t.patientId === 'pat-mison' && t.dateGroup === dateGroup)
                  .sort((a, b) => a.timestamp - b.timestamp);
                if (items.length === 0) return null;
                return (
                  <div key={dateGroup} className="space-y-2">
                    <div className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400 pt-1">
                      {dateGroup}
                    </div>
                    <div className="border-l-2 border-teal-500/40 ml-2 pl-3.5 space-y-3">
                      {items.map((ev) => (
                        <div
                          key={ev.id}
                          className={`p-3 rounded-xl border text-xs space-y-1 ${
                            darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50/80 border-slate-200/80'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[11px] text-slate-500">{ev.time}</span>
                            <span className="text-emerald-600 font-bold">✓</span>
                          </div>
                          <div className="font-bold text-sm">{ev.title}</div>
                          <div className="text-slate-500 text-[11px]">{ev.subtitle}</div>
                          {ev.category === 'LAB_REPORT' && (
                            <button
                              onClick={() => {
                                const rep =
                                  state.labOrders.find((l) => l.id === ev.referenceId) || state.labOrders[0];
                                setSelectedLabReport(rep);
                              }}
                              className="mt-1 text-teal-600 font-semibold text-[11px] underline"
                            >
                              View Verified Lab Report →
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===================================================================
            MAIN TAB 5: PROFILE, FAMILY MEMBERS & HEALTH ID (Sections 27 & 29)
        =================================================================== */}
        {!subScreen && activeTab === 'profile' && (
          <div className="space-y-4">
            <div
              className={`p-4 rounded-2xl border space-y-2 ${
                darkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold">{misonProfile.name}</h2>
                  <p className="text-xs text-slate-500">
                    {misonProfile.age} yrs · {misonProfile.gender} · Blood Group{' '}
                    <strong className="font-mono text-red-600">{misonProfile.bloodGroup}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setSubScreen('health_id_card')}
                  className="px-3 py-1.5 rounded-xl bg-teal-600 text-white text-xs font-semibold flex items-center gap-1"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Health ID</span>
                </button>
              </div>
              <div className="text-xs text-slate-500 font-mono">
                Health ID: {misonProfile.healthIdCode} · HIB Policy: {misonProfile.insurancePolicyNumber}
              </div>
            </div>

            {/* Family Members Section (Section 29) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-teal-600" />
                  <span>FAMILY MEMBERS ({state.familyMembers.length})</span>
                </h3>
                <button
                  onClick={() => setShowAddFamilyForm(!showAddFamilyForm)}
                  className="text-xs font-semibold text-teal-600"
                >
                  + Add Member
                </button>
              </div>

              {showAddFamilyForm && (
                <form
                  onSubmit={handleCreateFamilyMember}
                  className={`p-3.5 rounded-xl border space-y-2.5 text-xs ${
                    darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="font-semibold">Add Family Member to One Health ID</div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={newFamName}
                      onChange={(e) => setNewFamName(e.target.value)}
                      className="h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                      required
                    />
                    <select
                      value={newFamRelation}
                      onChange={(e) => setNewFamRelation(e.target.value as any)}
                      className="h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-transparent"
                    >
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Brother">Brother</option>
                      <option value="Child">Child</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="w-full h-9 rounded-lg bg-teal-600 text-white font-semibold"
                  >
                    Save Family Member
                  </button>
                </form>
              )}

              <div className="space-y-2">
                {state.familyMembers.map((fam) => (
                  <div
                    key={fam.id}
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                      darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                    }`}
                  >
                    <div>
                      <span className="font-bold">{fam.relation}</span> · <span>{fam.name}</span>
                      <div className="text-[11px] text-slate-500">
                        {fam.age} yrs · Blood {fam.bloodGroup} · <span className="font-mono">{fam.healthIdCode}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedFamilyId(fam.id);
                        setSelectedDoctor(state.doctors[0]);
                        setSubScreen('booking_flow');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold"
                    >
                      Book For {fam.relation}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: DIGITAL E-PRESCRIPTION VIEWER (Section 21) */}
      {selectedPrescription && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-sm rounded-2xl border p-5 space-y-3 text-xs ${
              darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <div>
                <span className="text-[10px] font-bold text-teal-600 block">AYULINK E-PRESCRIPTION</span>
                <span className="font-mono font-bold text-sm">{selectedPrescription.rxCode}</span>
              </div>
              <button onClick={() => setSelectedPrescription(null)} className="p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1">
              <div>
                <span className="text-slate-500">Patient:</span> <strong>{selectedPrescription.patientName}</strong>
              </div>
              <div>
                <span className="text-slate-500">Doctor:</span> <strong>{selectedPrescription.doctorName}</strong> (
                {selectedPrescription.departmentName})
              </div>
              <div>
                <span className="text-slate-500">Diagnosis:</span> <strong>{selectedPrescription.diagnosis}</strong>
              </div>
            </div>
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="font-bold">Prescribed Medicines:</div>
              {selectedPrescription.medicines.map((m, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 space-y-0.5"
                >
                  <div className="font-bold text-teal-700 dark:text-teal-400">
                    {m.name} · {m.strength}
                  </div>
                  <div className="font-mono text-[11px]">
                    {m.dosage} · {m.frequency} · {m.duration}
                  </div>
                  <div className="text-slate-500 text-[11px]">Instructions: {m.instructions}</div>
                </div>
              ))}
            </div>
            <div className="pt-1 flex justify-between items-center font-semibold">
              <span>Follow-up:</span>
              <span className="text-teal-600">{selectedPrescription.followUpDate}</span>
            </div>
            <button
              onClick={() => setSelectedPrescription(null)}
              className="w-full h-10 rounded-xl bg-teal-600 text-white font-semibold"
            >
              Close E-Prescription
            </button>
          </div>
        </div>
      )}

      {/* MODAL: VERIFIED LAB REPORT VIEWER (Section 23) */}
      {selectedLabReport && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-sm rounded-2xl border p-5 space-y-3 text-xs ${
              darkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <div>
                <span className="text-[10px] font-bold text-teal-600 block">AYULINK PATHOLOGY REPORT</span>
                <span className="font-bold text-sm">
                  {selectedLabReport.testName} ({selectedLabReport.orderCode})
                </span>
              </div>
              <button onClick={() => setSelectedLabReport(null)} className="p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-slate-500">
              Patient: <strong className="text-slate-800 dark:text-white">{selectedLabReport.patientName}</strong> ·{' '}
              {selectedLabReport.hospitalName}
            </div>
            {selectedLabReport.reportParameters && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100 dark:bg-slate-800">
                    <tr>
                      <th className="p-2">Parameter</th>
                      <th className="p-2">Value</th>
                      <th className="p-2">Ref. Range</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
                    {selectedLabReport.reportParameters.map((p, i) => (
                      <tr key={i}>
                        <td className="p-2 font-sans font-medium">{p.parameter}</td>
                        <td className="p-2 font-bold text-teal-600">
                          {p.value} {p.unit}
                        </td>
                        <td className="p-2 text-slate-500">{p.referenceRange}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-[11px] text-slate-500">{selectedLabReport.reportSummary}</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSelectedLabReport(null);
                  setSubScreen('ayu_assistant');
                  handleSendAiQuestion('Explain my CBC report');
                }}
                className="flex-1 h-10 rounded-xl bg-teal-600 text-white font-semibold"
              >
                Explain with Ayu AI
              </button>
              <button
                onClick={() => setSelectedLabReport(null)}
                className="px-4 h-10 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FIXED BOTTOM NAVIGATION BAR (5 Destinations: Home, Doctors, Appointments, Health, Profile) */}
      <nav
        className={`h-15 border-t grid grid-cols-5 items-center shrink-0 ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        {(
          [
            { id: 'home', label: tr(locale, 'navHome'), icon: Home },
            { id: 'doctors', label: tr(locale, 'navDoctors'), icon: Stethoscope },
            { id: 'appointments', label: tr(locale, 'navAppointments'), icon: Calendar },
            { id: 'health', label: tr(locale, 'navHealth'), icon: Activity },
            { id: 'profile', label: tr(locale, 'navProfile'), icon: UserIcon },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = !subScreen && activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setSubScreen(null);
                setActiveTab(tab.id);
              }}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                isActive ? 'text-teal-600 dark:text-teal-400 font-bold' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px] tracking-tight truncate max-w-[64px]">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
