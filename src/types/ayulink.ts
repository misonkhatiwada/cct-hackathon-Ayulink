export type UserRole =
  | 'patient'
  | 'doctor'
  | 'hospital_admin'
  | 'receptionist'
  | 'nurse'
  | 'lab_staff'
  | 'pharmacist'
  | 'insurance_staff'
  | 'super_admin';

export type SupportedLocale = 'en' | 'ne' | 'roman_ne';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  hospitalId?: string;
  doctorId?: string;
  patientId?: string;
  avatar?: string;
  verified: boolean;
  suspended?: boolean;
  createdAt: string;
}

export interface FamilyMember {
  id: string;
  patientId: string;
  name: string;
  relation: 'Myself' | 'Father' | 'Mother' | 'Brother' | 'Child' | 'Other';
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  bloodGroup: string;
  allergies: string[];
  criticalConditions: string[];
  healthIdCode: string;
}

export interface PatientProfile {
  id: string;
  userId: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  bloodGroup: string;
  phone: string;
  email: string;
  address: string;
  allergies: string[];
  criticalConditions: string[];
  emergencyContact: {
    name: string;
    relation: string;
    phone: string;
  };
  importantMedicines: string[];
  healthIdCode: string;
  qrSecurityToken: string;
  insurancePolicyNumber?: string;
}

export interface Hospital {
  id: string;
  name: string;
  nameNe: string;
  city: string;
  district: string;
  address: string;
  contact: string;
  emergencyPhone: string;
  distanceKm: number;
  rating: number;
  reviewsCount: number;
  hasEmergency: boolean;
  hasLab: boolean;
  hasPharmacy: boolean;
  hasInsurance: boolean;
  hasTelemedicine: boolean;
  openToday: boolean;
  verified: boolean;
  departments: string[];
  coordinates: { lat: number; lng: number };
}

export interface Department {
  id: string;
  name: string;
  nameNe: string;
  code: string;
  description: string;
  hospitalIds: string[];
  iconName: string;
}

export interface ScheduleBlock {
  day: 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

export interface Doctor {
  id: string;
  userId: string;
  name: string;
  nameNe: string;
  qualifications: string;
  specialty: string;
  specialtyNe: string;
  departmentId: string;
  departmentName: string;
  hospitalId: string;
  hospitalName: string;
  experienceYears: number;
  rating: number;
  reviewsCount: number;
  consultationFee: number;
  roomNumber: string;
  availableToday: boolean;
  availableTomorrow: boolean;
  telemedicineAvailable: boolean;
  emergencyAvailable: boolean;
  onLeave: boolean;
  verified: boolean;
  nmcDemoBadge: string; // Fictional demo ID
  nextAvailableText: string;
  utilizationRate: number;
  schedule: ScheduleBlock[];
}

export interface AppointmentSlot {
  id: string;
  doctorId: string;
  hospitalId: string;
  date: string; // YYYY-MM-DD
  time: string; // e.g., "3:30 PM"
  status: 'AVAILABLE' | 'HELD' | 'CONFIRMED' | 'BLOCKED' | 'EXPIRED';
  heldByPatientId?: string;
  heldUntil?: number; // timestamp ms
  appointmentId?: string;
}

export type AppointmentStatus =
  | 'HELD'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'WAITING'
  | 'CALLED'
  | 'IN_CONSULTATION'
  | 'COMPLETED'
  | 'CANCELLED';

export type PaymentStatus = 'PENDING' | 'INITIATED' | 'VERIFIED' | 'FAILED' | 'REFUNDED';

export interface Appointment {
  id: string;
  bookingId: string; // e.g., AL-BK-20261001-0024
  patientId: string;
  patientName: string;
  forFamilyMemberId: string;
  forRelation: 'Myself' | 'Father' | 'Mother' | 'Brother' | 'Child' | 'Other';
  hospitalId: string;
  hospitalName: string;
  hospitalAddress: string;
  hospitalContact: string;
  departmentId: string;
  departmentName: string;
  doctorId: string;
  doctorName: string;
  roomNumber: string;
  slotId: string;
  date: string; // e.g., "2026-10-01"
  displayDate: string; // e.g., "October 1, 2026"
  time: string; // e.g., "3:30 PM"
  arriveBy: string; // e.g., "3:15 PM"
  token: string; // e.g., "A-24"
  tokenNumber: number; // e.g., 24
  consultationFee: number;
  type: 'IN_PERSON' | 'TELEMEDICINE';
  paymentStatus: PaymentStatus;
  paymentId?: string;
  status: AppointmentStatus;
  qrCheckInToken: string;
  checkedInAt?: string;
  calledAt?: string;
  completedAt?: string;
  instructions: string;
  symptomsNote?: string;
  clinicalNotes?: string;
  diagnosis?: string;
  followUpDate?: string;
  referralNote?: string;
  createdAt: string;
}

export interface QueueState {
  hospitalId: string;
  departmentId: string;
  doctorId: string;
  doctorName: string;
  roomNumber: string;
  currentToken: string;
  currentTokenNumber: number;
  avgMinutesPerPatient: number;
  updatedAt: string;
}

export interface PaymentRecord {
  id: string;
  transactionUuid: string;
  appointmentId?: string;
  labOrderId?: string;
  patientId: string;
  patientName: string;
  hospitalId: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  productCode: string; // EPAYTEST
  gateway: 'ESEWA_UAT';
  signature: string;
  status: PaymentStatus;
  esewaRefId?: string;
  verifiedAt?: string;
  createdAt: string;
}

export interface MedicineItem {
  name: string;
  strength: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface Prescription {
  id: string;
  rxCode: string; // e.g., RX-28491
  appointmentId: string;
  patientId: string;
  patientName: string;
  forRelation: string;
  doctorId: string;
  doctorName: string;
  hospitalId: string;
  hospitalName: string;
  departmentName: string;
  diagnosis: string;
  symptoms: string;
  clinicalNotes: string;
  medicines: MedicineItem[];
  followUpDate: string;
  createdAt: string;
  displayDate: string;
  displayTime: string;
}

export interface PharmacyOrder {
  id: string;
  orderCode: string;
  prescriptionId: string;
  rxCode: string;
  patientId: string;
  patientName: string;
  hospitalId: string;
  pharmacyName: string;
  medicinesCount: number;
  medicines: MedicineItem[];
  totalAmount: number;
  status: 'New Prescription' | 'Accepted' | 'Preparing' | 'Ready' | 'Delivered' | 'Cancelled';
  updatedAt: string;
  createdAt: string;
}

export interface LabTestCatalog {
  id: string;
  code: string;
  name: string;
  category: string;
  price: number;
  turnaroundHours: number;
  availableToday: boolean;
  preparation: string;
}

export type LabOrderStatus =
  | 'Booked'
  | 'Sample Collected'
  | 'Processing'
  | 'Report Ready'
  | 'Delivered';

export interface LabParameterResult {
  parameter: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag: 'Normal' | 'High' | 'Low';
}

export interface LabOrder {
  id: string;
  orderCode: string;
  patientId: string;
  patientName: string;
  forRelation: string;
  hospitalId: string;
  hospitalName: string;
  orderedByDoctorId?: string;
  orderedByDoctorName?: string;
  appointmentId?: string;
  testId: string;
  testName: string;
  price: number;
  scheduledDate: string;
  scheduledTime: string;
  status: LabOrderStatus;
  paymentStatus: PaymentStatus;
  reportSummary?: string;
  reportParameters?: LabParameterResult[];
  reportUploadedAt?: string;
  reportUploadedBy?: string;
  createdAt: string;
}

export interface TimelineEvent {
  id: string;
  patientId: string;
  dateGroup: string; // e.g., "OCT 1, 2026"
  time: string; // e.g., "3:30 PM"
  title: string;
  subtitle: string;
  category: 'APPOINTMENT' | 'CONSULTATION' | 'PRESCRIPTION' | 'LAB_ORDERED' | 'LAB_REPORT';
  completed: boolean;
  referenceId?: string;
  timestamp: number;
}

export interface InsuranceClaim {
  id: string;
  claimCode: string;
  patientId: string;
  patientName: string;
  policyNumber: string;
  providerName: string;
  hospitalId: string;
  hospitalName: string;
  appointmentId?: string;
  diagnosis: string;
  claimAmount: number;
  approvedAmount?: number;
  status: 'Submitted' | 'Under Review' | 'Approved' | 'Rejected';
  submittedAt: string;
}

export interface TelemedicineSession {
  id: string;
  appointmentId: string;
  roomCode: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  status: 'Scheduled' | 'Waiting Room' | 'Live' | 'Ended';
  startedAt?: string;
}

export interface AppNotification {
  id: string;
  recipientRole: UserRole | 'ALL';
  recipientUserId?: string;
  type:
    | 'Payment Verified'
    | 'Booking Confirmed'
    | 'Appointment Reminder'
    | 'Doctor Running Late'
    | 'Queue Updated'
    | 'Your Turn'
    | 'Prescription Available'
    | 'Lab Report Ready'
    | 'Appointment Cancelled'
    | 'Refund Update'
    | 'New Appointment';
  title: string;
  message: string;
  read: boolean;
  referenceId?: string;
  createdAt: string;
  displayTime: string;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  targetType: 'PatientRecord' | 'Prescription' | 'LabReport' | 'Appointment' | 'EmergencyQR' | 'DoctorVerification' | 'SlotHold';
  targetId: string;
  hospitalId?: string;
  ipAddress: string;
  details: string;
  timestamp: string;
}
