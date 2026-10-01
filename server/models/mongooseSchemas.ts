/**
 * AyuLink MongoDB / Mongoose Schema Definitions
 * Covers all 23 domain entities for the Connected Healthcare Operating System.
 */

export const MONGOOSE_SCHEMA_DEFINITIONS = {
  User: {
    collection: 'users',
    fields: ['name', 'email', 'passwordHash', 'phone', 'role', 'hospitalId', 'doctorId', 'patientId', 'verified', 'suspended'],
  },
  PatientProfile: {
    collection: 'patient_profiles',
    fields: ['userId', 'name', 'age', 'gender', 'bloodGroup', 'phone', 'email', 'address', 'allergies', 'criticalConditions', 'emergencyContact', 'importantMedicines', 'healthIdCode', 'qrSecurityToken'],
  },
  FamilyMember: {
    collection: 'family_members',
    fields: ['patientId', 'name', 'relation', 'age', 'gender', 'bloodGroup', 'allergies', 'criticalConditions', 'healthIdCode'],
  },
  Doctor: {
    collection: 'doctors',
    fields: ['userId', 'name', 'qualifications', 'specialty', 'departmentId', 'hospitalId', 'experienceYears', 'rating', 'consultationFee', 'roomNumber', 'availableToday', 'telemedicineAvailable', 'verified', 'schedule'],
  },
  Hospital: {
    collection: 'hospitals',
    fields: ['name', 'city', 'district', 'address', 'contact', 'emergencyPhone', 'distanceKm', 'rating', 'hasEmergency', 'hasLab', 'hasPharmacy', 'hasInsurance', 'hasTelemedicine', 'openToday', 'verified'],
  },
  Department: {
    collection: 'departments',
    fields: ['name', 'code', 'description', 'hospitalIds'],
  },
  DoctorAvailability: {
    collection: 'doctor_availabilities',
    fields: ['doctorId', 'dayOfWeek', 'startTime', 'endTime', 'isAvailable', 'onLeave', 'emergencyAvailable'],
  },
  Appointment: {
    collection: 'appointments',
    fields: ['bookingId', 'patientId', 'forFamilyMemberId', 'forRelation', 'hospitalId', 'departmentId', 'doctorId', 'slotId', 'date', 'time', 'arriveBy', 'token', 'tokenNumber', 'consultationFee', 'paymentStatus', 'status', 'qrCheckInToken'],
  },
  AppointmentSlot: {
    collection: 'appointment_slots',
    fields: ['doctorId', 'hospitalId', 'date', 'time', 'status', 'heldByPatientId', 'heldUntil', 'appointmentId'],
    indexes: [{ doctorId: 1, date: 1, time: 1, unique: true }],
  },
  QueueToken: {
    collection: 'queue_tokens',
    fields: ['hospitalId', 'departmentId', 'doctorId', 'roomNumber', 'currentToken', 'currentTokenNumber', 'avgMinutesPerPatient'],
  },
  Payment: {
    collection: 'payments',
    fields: ['transactionUuid', 'appointmentId', 'labOrderId', 'patientId', 'hospitalId', 'amount', 'totalAmount', 'productCode', 'signature', 'status', 'esewaRefId', 'verifiedAt'],
  },
  Prescription: {
    collection: 'prescriptions',
    fields: ['rxCode', 'appointmentId', 'patientId', 'doctorId', 'hospitalId', 'diagnosis', 'symptoms', 'clinicalNotes', 'medicines', 'followUpDate'],
  },
  Medicine: {
    collection: 'medicines',
    fields: ['name', 'genericName', 'strength', 'form', 'manufacturer', 'unitPrice', 'inStock'],
  },
  Pharmacy: {
    collection: 'pharmacies',
    fields: ['name', 'hospitalId', 'licenseNumber', 'address', 'contact', 'isOpen24Hours'],
  },
  PharmacyOrder: {
    collection: 'pharmacy_orders',
    fields: ['orderCode', 'prescriptionId', 'rxCode', 'patientId', 'hospitalId', 'medicines', 'totalAmount', 'status'],
  },
  Laboratory: {
    collection: 'laboratories',
    fields: ['name', 'hospitalId', 'accreditationNumber', 'contact', 'availableTests'],
  },
  LabTest: {
    collection: 'lab_tests',
    fields: ['code', 'name', 'category', 'price', 'turnaroundHours', 'availableToday', 'preparation'],
  },
  LabOrder: {
    collection: 'lab_orders',
    fields: ['orderCode', 'patientId', 'hospitalId', 'orderedByDoctorId', 'appointmentId', 'testId', 'testName', 'price', 'status', 'paymentStatus'],
  },
  LabReport: {
    collection: 'lab_reports',
    fields: ['labOrderId', 'patientId', 'hospitalId', 'summary', 'parameters', 'uploadedBy', 'uploadedAt'],
  },
  HealthRecord: {
    collection: 'health_records',
    fields: ['patientId', 'dateGroup', 'time', 'title', 'subtitle', 'category', 'completed', 'referenceId'],
  },
  InsuranceProvider: {
    collection: 'insurance_providers',
    fields: ['name', 'code', 'maxCoverageNpr', 'supportedHospitals'],
  },
  InsurancePolicy: {
    collection: 'insurance_policies',
    fields: ['policyNumber', 'patientId', 'providerId', 'coverageLimitNpr', 'usedAmountNpr', 'validUntil', 'status'],
  },
  InsuranceClaim: {
    collection: 'insurance_claims',
    fields: ['claimCode', 'patientId', 'policyNumber', 'hospitalId', 'appointmentId', 'diagnosis', 'claimAmount', 'approvedAmount', 'status'],
  },
  TelemedicineSession: {
    collection: 'telemedicine_sessions',
    fields: ['appointmentId', 'roomCode', 'patientId', 'doctorId', 'status', 'startedAt'],
  },
  HealthID: {
    collection: 'health_ids',
    fields: ['healthIdCode', 'patientId', 'qrSecurityToken', 'issuedAt', 'active'],
  },
  Notification: {
    collection: 'notifications',
    fields: ['recipientRole', 'recipientUserId', 'type', 'title', 'message', 'read', 'referenceId', 'createdAt'],
  },
  Rating: {
    collection: 'ratings',
    fields: ['patientId', 'doctorId', 'hospitalId', 'appointmentId', 'stars', 'comment', 'createdAt'],
  },
  AuditLog: {
    collection: 'audit_logs',
    fields: ['actorId', 'actorName', 'actorRole', 'action', 'targetType', 'targetId', 'hospitalId', 'ipAddress', 'details', 'timestamp'],
  },
};
