import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import crypto from 'crypto';
import { Server as SocketIOServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { dbStore } from './server/db/store';
import { createEsewaSignedRequest, verifyEsewaTransactionPayload } from './server/services/esewaService';
import { generateAyuAssistantReply } from './server/services/aiAssistant';
import {
  UserRole,
  Appointment,
  Prescription,
  LabOrder,
  PharmacyOrder,
  FamilyMember,
  SupportedLocale,
} from './src/types/ayulink';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'ayulink_jwt_secret_key_nepal_2026';

// Lightweight HMAC JWT helper (zero external native binary dependency issues)
function signJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(
    JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 })
  ).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

function verifyJwt(token?: string): { userId: string; role: UserRole; hospitalId?: string; doctorId?: string } | null {
  if (!token) return null;
  try {
    const parts = token.replace(/^Bearer\s+/i, '').split('.');
    if (parts.length !== 3) return null;
    const [header, body, sig] = parts;
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (sig !== expected) return null;
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
  } catch {
    return null;
  }
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    },
  });

  app.use(express.json({ limit: '2mb' }));

  // Full CORS + Security headers so Flutter Android/iOS/Web and React Dashboard connect seamlessly
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-actor-role, x-actor-name');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // Periodic background check for expired 5-minute slot holds
  setInterval(() => {
    const expired = dbStore.expireStaleHolds();
    if (expired) {
      io.emit('slot:updated', { slots: dbStore.getState().slots });
    }
  }, 5000);

  io.on('connection', (socket) => {
    socket.emit('state:sync', dbStore.getState());
    socket.on('request:sync', () => {
      socket.emit('state:sync', dbStore.getState());
    });
  });

  function broadcastStateUpdate(eventName: string, payload: unknown) {
    io.emit(eventName, payload);
    io.emit('state:sync', dbStore.getState());
  }

  // ============================================================================
  // 1. STATE & DEMO RESET API
  // ============================================================================
  app.get('/api/state', (_req: Request, res: Response) => {
    res.json(dbStore.getState());
  });

  app.post('/api/demo/reset', (_req: Request, res: Response) => {
    const fresh = dbStore.resetToDemoSeed();
    broadcastStateUpdate('demo:reset', fresh);
    res.json({ success: true, state: fresh });
  });

  // ============================================================================
  // 2. AUTH & RBAC API (/api/auth)
  // ============================================================================
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { role, userId } = req.body as { role?: UserRole; userId?: string };
    const state = dbStore.getState();
    const user =
      state.users.find((u) => (userId ? u.id === userId : u.role === (role || 'hospital_admin'))) || state.users[0];

    const accessToken = signJwt({
      userId: user.id,
      role: user.role,
      hospitalId: user.hospitalId,
      doctorId: user.doctorId,
    });

    res.json({
      user,
      accessToken,
      refreshToken: signJwt({ userId: user.id, type: 'refresh' }),
    });
  });

  // ============================================================================
  // 3. HOSPITALS, DEPARTMENTS & DOCTORS API
  // ============================================================================
  app.get('/api/hospitals', (_req: Request, res: Response) => {
    res.json(dbStore.getState().hospitals);
  });

  app.get('/api/departments', (_req: Request, res: Response) => {
    res.json(dbStore.getState().departments);
  });

  app.get('/api/doctors', (_req: Request, res: Response) => {
    res.json(dbStore.getState().doctors);
  });

  // Doctor Availability Update (/api/availability)
  app.patch('/api/availability/:doctorId', (req: Request, res: Response) => {
    const { doctorId } = req.params;
    const { availableToday, onLeave, emergencyAvailable, schedule, slotIdToToggle } = req.body;
    const state = dbStore.getState();
    const doc = state.doctors.find((d) => d.id === doctorId);
    if (!doc) {
      res.status(404).json({ error: 'Doctor not found' });
      return;
    }

    if (typeof availableToday === 'boolean') doc.availableToday = availableToday;
    if (typeof onLeave === 'boolean') {
      doc.onLeave = onLeave;
      if (onLeave) doc.availableToday = false;
    }
    if (typeof emergencyAvailable === 'boolean') doc.emergencyAvailable = emergencyAvailable;
    if (Array.isArray(schedule)) doc.schedule = schedule;

    if (slotIdToToggle) {
      const slot = state.slots.find((s) => s.id === slotIdToToggle && s.doctorId === doctorId);
      if (slot && (slot.status === 'AVAILABLE' || slot.status === 'BLOCKED')) {
        slot.status = slot.status === 'AVAILABLE' ? 'BLOCKED' : 'AVAILABLE';
      }
    }

    dbStore.saveToDisk();
    broadcastStateUpdate('doctor:availability-updated', {
      doctor: doc,
      slots: state.slots.filter((s) => s.doctorId === doctorId),
    });

    res.json({ doctor: doc, slots: state.slots.filter((s) => s.doctorId === doctorId) });
  });

  // ============================================================================
  // 4. PATIENTS & FAMILY MEMBERS API (/api/patients)
  // ============================================================================
  app.get('/api/patients/:patientId', (req: Request, res: Response) => {
    const { patientId } = req.params;
    const actorRole = (req.headers['x-actor-role'] as UserRole) || 'doctor';
    const actorName = (req.headers['x-actor-name'] as string) || 'Dr. Suman Sharma';

    // RBAC enforcement: Receptionist cannot access detailed clinical records
    if (actorRole === 'receptionist') {
      res.status(403).json({
        error: 'RBAC Violation: Receptionist role is not authorized to view clinical history or medical records.',
      });
      return;
    }

    const state = dbStore.getState();
    const profile = state.patientProfiles.find((p) => p.id === patientId);
    if (!profile) {
      res.status(404).json({ error: 'Patient profile not found' });
      return;
    }

    // Record Audit Log when doctor/clinical staff views patient record
    if (actorRole === 'doctor' || actorRole === 'nurse') {
      dbStore.addAuditLog({
        actorId: `usr-${actorRole}`,
        actorName,
        actorRole,
        action: 'Doctor viewed patient record',
        targetType: 'PatientRecord',
        targetId: patientId,
        hospitalId: 'hosp-city',
        ipAddress: req.ip || '202.45.144.22',
        details: `${actorName} accessed clinical history, allergies, and lab reports of ${profile.name}.`,
      });
    }

    res.json({
      profile,
      familyMembers: state.familyMembers.filter((f) => f.patientId === patientId),
      prescriptions: state.prescriptions.filter((rx) => rx.patientId === patientId),
      labOrders: state.labOrders.filter((l) => l.patientId === patientId),
      timeline: state.timeline.filter((t) => t.patientId === patientId).sort((a, b) => b.timestamp - a.timestamp),
    });
  });

  app.post('/api/patients/:patientId/family', (req: Request, res: Response) => {
    const { patientId } = req.params;
    const { name, relation, age, gender, bloodGroup } = req.body;
    const state = dbStore.getState();

    const newMember: FamilyMember = {
      id: `fam-${crypto.randomBytes(3).toString('hex')}`,
      patientId,
      name: name || 'Family Member',
      relation: relation || 'Other',
      age: Number(age) || 30,
      gender: gender || 'Female',
      bloodGroup: bloodGroup || 'O+',
      allergies: [],
      criticalConditions: [],
      healthIdCode: `AL-NP-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    };

    state.familyMembers.push(newMember);
    dbStore.saveToDisk();
    broadcastStateUpdate('family:updated', state.familyMembers);
    res.json(newMember);
  });

  // ============================================================================
  // 5. ATOMIC SLOT HOLD & APPOINTMENTS API (/api/appointments)
  // ============================================================================
  app.post('/api/appointments/hold-slot', (req: Request, res: Response) => {
    const { slotId, patientId = 'pat-mison' } = req.body;
    const state = dbStore.getState();

    const slot = state.slots.find((s) => s.id === slotId);
    if (!slot) {
      res.status(404).json({ error: 'Appointment slot not found' });
      return;
    }

    // Atomic check: prevent double booking if held by someone else or confirmed
    if (slot.status === 'CONFIRMED' || slot.status === 'BLOCKED') {
      res.status(409).json({ error: 'This slot is already confirmed or blocked.' });
      return;
    }
    if (
      slot.status === 'HELD' &&
      slot.heldByPatientId !== patientId &&
      slot.heldUntil &&
      slot.heldUntil > Date.now()
    ) {
      res.status(409).json({ error: 'This slot is temporarily held by another patient.' });
      return;
    }

    // Release any other slot currently held by this patient
    for (const s of state.slots) {
      if (s.status === 'HELD' && s.heldByPatientId === patientId && s.id !== slotId) {
        s.status = 'AVAILABLE';
        s.heldByPatientId = undefined;
        s.heldUntil = undefined;
      }
    }

    const holdDurationMs = 5 * 60 * 1000; // 5 minutes (04:59 countdown)
    slot.status = 'HELD';
    slot.heldByPatientId = patientId;
    slot.heldUntil = Date.now() + holdDurationMs;

    dbStore.saveToDisk();
    broadcastStateUpdate('slot:updated', { slot, slots: state.slots });

    res.json({
      slot,
      expiresAt: slot.heldUntil,
      durationSeconds: 300,
    });
  });

  app.post('/api/appointments/release-slot', (req: Request, res: Response) => {
    const { slotId } = req.body;
    const state = dbStore.getState();
    const slot = state.slots.find((s) => s.id === slotId);
    if (slot && slot.status === 'HELD') {
      slot.status = 'AVAILABLE';
      slot.heldByPatientId = undefined;
      slot.heldUntil = undefined;
      dbStore.saveToDisk();
      broadcastStateUpdate('slot:updated', { slot, slots: state.slots });
    }
    res.json({ success: true });
  });

  // ============================================================================
  // 6. ESEWA UAT PAYMENT INITIATION & CRYPTOGRAPHIC VERIFICATION (/api/payments)
  // ============================================================================
  app.post('/api/payments/esewa/initiate', (req: Request, res: Response) => {
    const { slotId, doctorId, patientId = 'pat-mison', forFamilyMemberId = 'fam-myself', type = 'IN_PERSON' } = req.body;
    const state = dbStore.getState();

    const doctor = state.doctors.find((d) => d.id === doctorId);
    const slot = state.slots.find((s) => s.id === slotId);
    const patient = state.patientProfiles.find((p) => p.id === patientId);

    if (!doctor || !slot || !patient) {
      res.status(400).json({ error: 'Invalid doctor, slot, or patient for payment initiation.' });
      return;
    }

    if (slot.status === 'CONFIRMED') {
      res.status(409).json({ error: 'Slot already booked.' });
      return;
    }

    // Ensure slot is held for this payment window
    slot.status = 'HELD';
    slot.heldByPatientId = patientId;
    slot.heldUntil = Date.now() + 5 * 60 * 1000;

    const transactionUuid = `AL-TXN-20261001-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const esewaPayload = createEsewaSignedRequest(doctor.consultationFee, transactionUuid);

    const paymentRecord = {
      id: `pay-${crypto.randomBytes(4).toString('hex')}`,
      transactionUuid,
      patientId,
      patientName: patient.name,
      hospitalId: doctor.hospitalId,
      amount: esewaPayload.amount,
      taxAmount: esewaPayload.taxAmount,
      totalAmount: esewaPayload.totalAmount,
      productCode: esewaPayload.productCode,
      gateway: 'ESEWA_UAT' as const,
      signature: esewaPayload.signature,
      status: 'INITIATED' as const,
      createdAt: new Date().toISOString(),
    };

    state.payments.unshift(paymentRecord);
    dbStore.saveToDisk();

    res.json({
      paymentId: paymentRecord.id,
      esewaPayload,
      bookingDraft: {
        slotId,
        doctorId,
        patientId,
        forFamilyMemberId,
        type,
      },
    });
  });

  app.post('/api/payments/esewa/verify', (req: Request, res: Response) => {
    const {
      paymentId,
      transactionUuid,
      totalAmount,
      productCode,
      signature,
      esewaStatus = 'COMPLETE',
      slotId,
      doctorId,
      patientId = 'pat-mison',
      forFamilyMemberId = 'fam-myself',
      type = 'IN_PERSON',
    } = req.body;

    const state = dbStore.getState();
    const payment = state.payments.find((p) => p.id === paymentId || p.transactionUuid === transactionUuid);

    if (!payment) {
      res.status(404).json({ error: 'Payment transaction record not found on server.' });
      return;
    }

    // Verify cryptographic signature and transaction attributes on backend
    const verification = verifyEsewaTransactionPayload({
      transactionUuid: payment.transactionUuid,
      totalAmount: Number(totalAmount),
      productCode: String(productCode),
      clientSignature: String(signature),
      status: String(esewaStatus),
    });

    const slot = state.slots.find((s) => s.id === slotId);

    if (!verification.verified) {
      payment.status = 'FAILED';
      if (slot && slot.status === 'HELD') {
        slot.status = 'AVAILABLE';
        slot.heldByPatientId = undefined;
        slot.heldUntil = undefined;
      }
      dbStore.saveToDisk();
      broadcastStateUpdate('slot:updated', { slots: state.slots });
      res.status(400).json({
        verified: false,
        error: verification.reason || 'eSewa UAT verification failed',
      });
      return;
    }

    const doctor = state.doctors.find((d) => d.id === doctorId) || state.doctors[0];
    const hospital = state.hospitals.find((h) => h.id === doctor.hospitalId) || state.hospitals[0];
    const patient = state.patientProfiles.find((p) => p.id === patientId) || state.patientProfiles[0];
    const fam = state.familyMembers.find((f) => f.id === forFamilyMemberId) || state.familyMembers[0];

    // Increment token counter so first booking after seed gets A-24!
    state.tokenCounter += 1;
    const tokenNum = state.tokenCounter;
    const tokenCode = `A-${tokenNum}`;
    const bookingId = `AL-BK-20261001-${String(tokenNum).padStart(4, '0')}`;
    const appointmentId = `apt-a${tokenNum}`;

    // Calculate arriveBy (15 mins prior)
    const timeStr = slot ? slot.time : '3:30 PM';
    const arriveByStr = timeStr === '3:30 PM' ? '3:15 PM' : '15 mins prior';

    const newAppointment: Appointment = {
      id: appointmentId,
      bookingId,
      patientId: patient.id,
      patientName: fam.relation === 'Myself' ? patient.name : `${fam.name} (${fam.relation})`,
      forFamilyMemberId: fam.id,
      forRelation: fam.relation,
      hospitalId: hospital.id,
      hospitalName: hospital.name,
      hospitalAddress: `${hospital.city}, ${hospital.district}`,
      hospitalContact: hospital.contact,
      departmentId: doctor.departmentId,
      departmentName: doctor.departmentName,
      doctorId: doctor.id,
      doctorName: doctor.name,
      roomNumber: doctor.roomNumber,
      slotId: slot ? slot.id : 'slot-suman-330',
      date: '2026-10-01',
      displayDate: 'October 1, 2026',
      time: timeStr,
      arriveBy: arriveByStr,
      token: tokenCode,
      tokenNumber: tokenNum,
      consultationFee: doctor.consultationFee,
      type: type === 'TELEMEDICINE' ? 'TELEMEDICINE' : 'IN_PERSON',
      paymentStatus: 'VERIFIED',
      paymentId: payment.id,
      status: 'CONFIRMED',
      qrCheckInToken: `AL-QR-CHK-20261001-${tokenCode.replace('-', '')}`,
      instructions: 'Please present your secure AyuLink QR at the Reception Desk by 3:15 PM.',
      createdAt: new Date().toISOString(),
    };

    if (slot) {
      slot.status = 'CONFIRMED';
      slot.appointmentId = newAppointment.id;
      slot.heldUntil = undefined;
    }

    payment.status = 'VERIFIED';
    payment.appointmentId = newAppointment.id;
    payment.esewaRefId = verification.esewaRefId;
    payment.verifiedAt = new Date().toISOString();

    state.appointments.push(newAppointment);

    // Add to Patient Health Timeline
    state.timeline.unshift({
      id: `tl-apt-${tokenNum}`,
      patientId: patient.id,
      dateGroup: 'OCT 1, 2026',
      time: timeStr,
      title: `${doctor.departmentName} Appointment`,
      subtitle: `${doctor.name} · ${hospital.name} · Token ${tokenCode}`,
      category: 'APPOINTMENT',
      completed: true,
      referenceId: newAppointment.id,
      timestamp: Date.now(),
    });

    // Create Notifications for Patient & Hospital Dashboard
    const patientNotif = dbStore.addNotification({
      recipientRole: 'patient',
      recipientUserId: 'usr-patient-mison',
      type: 'Booking Confirmed',
      title: 'Payment Verified & Booking Confirmed',
      message: `${doctor.name} (${doctor.departmentName}) on October 1 at ${timeStr}. Token: ${tokenCode}.`,
      referenceId: newAppointment.id,
    });

    const hospNotif = dbStore.addNotification({
      recipientRole: 'hospital_admin',
      type: 'New Appointment',
      title: `NEW APPOINTMENT · Token ${tokenCode}`,
      message: `${newAppointment.patientName} booked ${doctor.name} (${doctor.departmentName}) for ${timeStr}. Payment ✓ VERIFIED.`,
      referenceId: newAppointment.id,
    });

    dbStore.saveToDisk();

    // Emit Real-Time Socket.IO Events to React Dashboard and Flutter App
    broadcastStateUpdate('appointment:created', {
      appointment: newAppointment,
      payment,
      notification: hospNotif,
    });
    io.emit('notification:new', patientNotif);

    res.json({
      verified: true,
      payment,
      appointment: newAppointment,
    });
  });

  // ============================================================================
  // 7. QR CHECK-IN & LIVE QUEUE API (/api/queue)
  // ============================================================================
  app.post('/api/queue/qr-checkin', (req: Request, res: Response) => {
    const { qrToken, appointmentId } = req.body;
    const state = dbStore.getState();

    const apt = state.appointments.find(
      (a) => (qrToken && a.qrCheckInToken === qrToken) || (appointmentId && a.id === appointmentId)
    );

    if (!apt) {
      res.status(404).json({ error: 'Invalid QR Check-In Token: Booking does not exist.' });
      return;
    }

    if (apt.paymentStatus !== 'VERIFIED') {
      res.status(400).json({ error: 'Check-In Denied: Appointment payment is not verified.' });
      return;
    }

    if (apt.date !== '2026-10-01') {
      res.status(400).json({ error: 'Check-In Denied: Appointment date does not match today.' });
      return;
    }

    apt.status = 'WAITING';
    apt.checkedInAt = new Date().toISOString();

    const notif = dbStore.addNotification({
      recipientRole: 'patient',
      recipientUserId: 'usr-patient-mison',
      type: 'Queue Updated',
      title: `CHECK-IN SUCCESSFUL · Token ${apt.token}`,
      message: `You are now checked in at ${apt.hospitalName}. Status: WAITING for ${apt.doctorName} (${apt.roomNumber}).`,
      referenceId: apt.id,
    });

    dbStore.addAuditLog({
      actorId: 'usr-receptionist',
      actorName: 'Binita Gurung (Receptionist)',
      actorRole: 'receptionist',
      action: 'Hospital verified QR check-in',
      targetType: 'Appointment',
      targetId: apt.id,
      hospitalId: apt.hospitalId,
      ipAddress: req.ip || '202.45.144.19',
      details: `Scanned secure QR token ${apt.qrCheckInToken} for ${apt.patientName} (Token ${apt.token}).`,
    });

    dbStore.saveToDisk();

    broadcastStateUpdate('patient:checked-in', {
      appointment: apt,
      queue: state.queues[0],
    });
    io.emit('queue:updated', {
      queue: state.queues[0],
      appointments: state.appointments,
    });
    io.emit('notification:new', notif);

    res.json({
      success: true,
      message: 'CHECK-IN SUCCESSFUL',
      appointment: apt,
      queue: state.queues[0],
    });
  });

  app.post('/api/queue/call-next', (req: Request, res: Response) => {
    const { doctorId = 'doc-suman', targetAppointmentId } = req.body;
    const state = dbStore.getState();

    // Complete any currently IN_CONSULTATION appointment for this doctor
    for (const a of state.appointments) {
      if (a.doctorId === doctorId && (a.status === 'IN_CONSULTATION' || a.status === 'CALLED')) {
        a.status = 'COMPLETED';
        a.completedAt = new Date().toISOString();
      }
    }

    // Find target appointment or prioritize Mison's A-24 if waiting/checked-in/confirmed, else next token
    let nextApt: Appointment | undefined;
    if (targetAppointmentId) {
      nextApt = state.appointments.find((a) => a.id === targetAppointmentId);
    } else {
      // If Mison's booking (e.g. A-24) is WAITING or CHECKED_IN, call it so the demo flow works in 1 click, or call next waiting
      const misonWaiting = state.appointments.find(
        (a) => a.doctorId === doctorId && a.patientId === 'pat-mison' && (a.status === 'WAITING' || a.status === 'CHECKED_IN' || a.status === 'CONFIRMED')
      );
      if (misonWaiting) {
        nextApt = misonWaiting;
      } else {
        nextApt = state.appointments
          .filter((a) => a.doctorId === doctorId && (a.status === 'WAITING' || a.status === 'CHECKED_IN'))
          .sort((a, b) => a.tokenNumber - b.tokenNumber)[0];
      }
    }

    if (!nextApt) {
      res.status(404).json({ error: 'No waiting patients in queue for this doctor.' });
      return;
    }

    nextApt.status = 'IN_CONSULTATION';
    nextApt.calledAt = new Date().toISOString();

    const queue = state.queues.find((q) => q.doctorId === doctorId) || state.queues[0];
    if (queue) {
      queue.currentToken = nextApt.token;
      queue.currentTokenNumber = nextApt.tokenNumber;
      queue.updatedAt = new Date().toISOString();
    }

    const notif = dbStore.addNotification({
      recipientRole: 'patient',
      recipientUserId: 'usr-patient-mison',
      type: 'Your Turn',
      title: `🔔 YOUR TURN · Token ${nextApt.token}`,
      message: `Please proceed now to ${nextApt.roomNumber} (${nextApt.doctorName}).`,
      referenceId: nextApt.id,
    });

    dbStore.saveToDisk();

    broadcastStateUpdate('queue:called', {
      appointment: nextApt,
      queue,
    });
    io.emit('queue:updated', {
      queue,
      appointments: state.appointments,
    });
    io.emit('notification:new', notif);

    res.json({
      success: true,
      calledAppointment: nextApt,
      queue,
    });
  });

  app.patch('/api/appointments/:id/status', (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, time } = req.body;
    const state = dbStore.getState();
    const apt = state.appointments.find((a) => a.id === id);
    if (!apt) {
      res.status(404).json({ error: 'Appointment not found' });
      return;
    }
    if (status) apt.status = status;
    if (time) apt.time = time;

    dbStore.saveToDisk();
    broadcastStateUpdate('appointment:updated', apt);
    res.json(apt);
  });

  // ============================================================================
  // 8. CONSULTATION & DIGITAL PRESCRIPTION API (/api/prescriptions)
  // ============================================================================
  app.post('/api/prescriptions', (req: Request, res: Response) => {
    const {
      appointmentId,
      patientId = 'pat-mison',
      doctorId = 'doc-suman',
      symptoms,
      clinicalNotes,
      diagnosis,
      medicines,
      followUpDate = 'October 15, 2026',
      completeConsultation = true,
    } = req.body;

    const state = dbStore.getState();
    const apt = state.appointments.find((a) => a.id === appointmentId);
    const doctor = state.doctors.find((d) => d.id === doctorId) || state.doctors[0];
    const patient = state.patientProfiles.find((p) => p.id === patientId) || state.patientProfiles[0];

    const rxCode = state.prescriptions.some((r) => r.rxCode === 'RX-28491')
      ? `RX-${Math.floor(28492 + Math.random() * 900)}`
      : 'RX-28491';

    const newRx: Prescription = {
      id: `rx-${crypto.randomBytes(4).toString('hex')}`,
      rxCode,
      appointmentId: apt ? apt.id : 'apt-a24',
      patientId: patient.id,
      patientName: apt ? apt.patientName : patient.name,
      forRelation: apt ? apt.forRelation : 'Myself',
      doctorId: doctor.id,
      doctorName: doctor.name,
      hospitalId: doctor.hospitalId,
      hospitalName: doctor.hospitalName,
      departmentName: doctor.departmentName,
      diagnosis: diagnosis || 'Essential Hypertension & Mild Viral Pyrexia',
      symptoms: symptoms || 'Mild headache, intermittent palpitations, fatigue',
      clinicalNotes: clinicalNotes || 'BP 130/82 mmHg, pulse 76 bpm regular. Chest clear bilaterally.',
      medicines:
        Array.isArray(medicines) && medicines.length > 0
          ? medicines
          : [
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
                frequency: '1 time/day',
                duration: '15 days',
                instructions: 'Take every morning after breakfast.',
              },
              {
                name: 'Pantoprazole',
                strength: '40mg',
                dosage: '1 tablet',
                frequency: '1 time/day',
                duration: '5 days',
                instructions: 'Take 30 minutes before breakfast.',
              },
            ],
      followUpDate,
      createdAt: new Date().toISOString(),
      displayDate: 'OCT 1, 2026',
      displayTime: '4:10 PM',
    };

    state.prescriptions.unshift(newRx);

    if (apt) {
      apt.symptomsNote = newRx.symptoms;
      apt.clinicalNotes = newRx.clinicalNotes;
      apt.diagnosis = newRx.diagnosis;
      apt.followUpDate = newRx.followUpDate;
      if (completeConsultation) {
        apt.status = 'COMPLETED';
        apt.completedAt = new Date().toISOString();
      }
    }

    // Add Consultation & Prescription to Patient Health Timeline (matching Step 15 of Demo Flow)
    if (!state.timeline.some((t) => t.category === 'CONSULTATION' && t.dateGroup === 'OCT 1, 2026')) {
      state.timeline.unshift({
        id: `tl-cons-${Date.now()}`,
        patientId: patient.id,
        dateGroup: 'OCT 1, 2026',
        time: '3:55 PM',
        title: 'Consultation',
        subtitle: `${doctor.name} · ${doctor.departmentName} · Clinical evaluation completed`,
        category: 'CONSULTATION',
        completed: true,
        referenceId: apt?.id,
        timestamp: Date.now() + 1,
      });
    }

    state.timeline.unshift({
      id: `tl-rx-${Date.now()}`,
      patientId: patient.id,
      dateGroup: 'OCT 1, 2026',
      time: '4:10 PM',
      title: 'Prescription',
      subtitle: `${newRx.rxCode} · ${newRx.medicines.map((m) => `${m.name} ${m.strength}`).join(', ')}`,
      category: 'PRESCRIPTION',
      completed: true,
      referenceId: newRx.id,
      timestamp: Date.now() + 2,
    });

    // Automatically create Pharmacy Order for hospital dispensary
    const newPharmOrder: PharmacyOrder = {
      id: `pho-${crypto.randomBytes(3).toString('hex')}`,
      orderCode: `PH-${Math.floor(1000 + Math.random() * 9000)}`,
      prescriptionId: newRx.id,
      rxCode: newRx.rxCode,
      patientId: patient.id,
      patientName: newRx.patientName,
      hospitalId: doctor.hospitalId,
      pharmacyName: 'City Hospital Central Dispensary',
      medicinesCount: newRx.medicines.length,
      medicines: newRx.medicines,
      totalAmount: newRx.medicines.length * 140,
      status: 'New Prescription',
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    state.pharmacyOrders.unshift(newPharmOrder);

    const notif = dbStore.addNotification({
      recipientRole: 'patient',
      recipientUserId: 'usr-patient-mison',
      type: 'Prescription Available',
      title: `New E-Prescription (${newRx.rxCode})`,
      message: `${doctor.name} issued your digital prescription (${newRx.medicines.length} medicines). Follow-up: ${followUpDate}.`,
      referenceId: newRx.id,
    });

    dbStore.addAuditLog({
      actorId: doctor.userId,
      actorName: doctor.name,
      actorRole: 'doctor',
      action: 'Doctor created prescription',
      targetType: 'Prescription',
      targetId: newRx.id,
      hospitalId: doctor.hospitalId,
      ipAddress: req.ip || '202.45.144.22',
      details: `Created e-Prescription ${newRx.rxCode} for ${newRx.patientName} with ${newRx.medicines.length} medications.`,
    });

    dbStore.saveToDisk();

    broadcastStateUpdate('prescription:created', {
      prescription: newRx,
      pharmacyOrder: newPharmOrder,
      appointment: apt,
    });
    io.emit('notification:new', notif);

    res.json({
      prescription: newRx,
      pharmacyOrder: newPharmOrder,
    });
  });

  // ============================================================================
  // 9. LABORATORY ORDERS & REPORT UPLOAD API (/api/labs)
  // ============================================================================
  app.post('/api/labs/orders', (req: Request, res: Response) => {
    const {
      patientId = 'pat-mison',
      testId = 'test-cbc',
      orderedByDoctorId = 'doc-suman',
      appointmentId,
      scheduledTime = '4:15 PM',
    } = req.body;

    const state = dbStore.getState();
    const patient = state.patientProfiles.find((p) => p.id === patientId) || state.patientProfiles[0];
    const test = state.labCatalog.find((t) => t.id === testId) || state.labCatalog[0];
    const doctor = state.doctors.find((d) => d.id === orderedByDoctorId);

    const newOrder: LabOrder = {
      id: `lab-${crypto.randomBytes(4).toString('hex')}`,
      orderCode: `LAB-20261001-${String(state.labOrders.length + 1).padStart(2, '0')}`,
      patientId: patient.id,
      patientName: patient.name,
      forRelation: 'Myself',
      hospitalId: 'hosp-city',
      hospitalName: 'City Hospital',
      orderedByDoctorId: doctor?.id,
      orderedByDoctorName: doctor?.name,
      appointmentId,
      testId: test.id,
      testName: test.id === 'test-cbc' ? 'CBC' : test.name,
      price: test.price,
      scheduledDate: 'OCT 1, 2026',
      scheduledTime,
      status: 'Booked',
      paymentStatus: 'VERIFIED',
      createdAt: new Date().toISOString(),
    };

    state.labOrders.unshift(newOrder);

    state.timeline.unshift({
      id: `tl-lab-ord-${Date.now()}`,
      patientId: patient.id,
      dateGroup: 'OCT 1, 2026',
      time: '4:15 PM',
      title: `${newOrder.testName} Test Ordered`,
      subtitle: `Ordered at City Hospital Pathology · Status: Booked`,
      category: 'LAB_ORDERED',
      completed: true,
      referenceId: newOrder.id,
      timestamp: Date.now() + 3,
    });

    dbStore.saveToDisk();

    broadcastStateUpdate('lab:order-created', newOrder);

    res.json(newOrder);
  });

  app.patch('/api/labs/orders/:id/status', (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, reportSummary, reportParameters } = req.body;
    const state = dbStore.getState();
    const order = state.labOrders.find((o) => o.id === id);

    if (!order) {
      res.status(404).json({ error: 'Lab order not found' });
      return;
    }

    order.status = status;

    if (status === 'Report Ready' || status === 'Delivered') {
      order.reportUploadedAt = new Date().toISOString();
      order.reportUploadedBy = 'Dipेश Shrestha (Pathology Lab)';
      order.reportSummary =
        reportSummary ||
        'Complete Blood Count (CBC) parameters analyzed on automated 5-part hematology analyzer. All indices within normal physiological range.';
      order.reportParameters =
        Array.isArray(reportParameters) && reportParameters.length > 0
          ? reportParameters
          : [
              { parameter: 'Hemoglobin (Hb)', value: '15.1', unit: 'g/dL', referenceRange: '13.5 – 17.5', flag: 'Normal' },
              { parameter: 'Total Leukocyte Count (WBC)', value: '7,200', unit: '/cumm', referenceRange: '4,000 – 11,000', flag: 'Normal' },
              { parameter: 'Platelet Count', value: '260,000', unit: '/cumm', referenceRange: '150,000 – 450,000', flag: 'Normal' },
              { parameter: 'RBC Count', value: '5.12', unit: 'million/cumm', referenceRange: '4.5 – 5.9', flag: 'Normal' },
            ];

      // Add Report Ready to Patient Health Timeline
      state.timeline.unshift({
        id: `tl-lab-rep-${Date.now()}`,
        patientId: order.patientId,
        dateGroup: 'OCT 1, 2026',
        time: '4:45 PM',
        title: `${order.testName} Report Ready`,
        subtitle: `City Hospital Pathology · Verified by Dipेश Shrestha`,
        category: 'LAB_REPORT',
        completed: true,
        referenceId: order.id,
        timestamp: Date.now() + 4,
      });

      const notif = dbStore.addNotification({
        recipientRole: 'patient',
        recipientUserId: 'usr-patient-mison',
        type: 'Lab Report Ready',
        title: `Your ${order.testName} report is ready.`,
        message: `City Hospital Pathology has uploaded your verified ${order.testName} report to your Health Timeline.`,
        referenceId: order.id,
      });

      dbStore.addAuditLog({
        actorId: 'usr-lab',
        actorName: 'Dipेश Shrestha',
        actorRole: 'lab_staff',
        action: 'Lab uploaded report',
        targetType: 'LabReport',
        targetId: order.id,
        hospitalId: order.hospitalId,
        ipAddress: req.ip || '202.45.144.25',
        details: `Uploaded verified diagnostic report for ${order.patientName} (${order.testName}, ${order.orderCode}).`,
      });

      io.emit('notification:new', notif);
      broadcastStateUpdate('lab:report-ready', order);
    } else {
      broadcastStateUpdate('lab:order-updated', order);
    }

    dbStore.saveToDisk();
    res.json(order);
  });

  // ============================================================================
  // 10. PHARMACY API (/api/pharmacy)
  // ============================================================================
  app.patch('/api/pharmacy/orders/:id/status', (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;
    const state = dbStore.getState();
    const order = state.pharmacyOrders.find((o) => o.id === id);
    if (!order) {
      res.status(404).json({ error: 'Pharmacy order not found' });
      return;
    }

    order.status = status;
    order.updatedAt = new Date().toISOString();

    dbStore.addAuditLog({
      actorId: 'usr-pharmacy',
      actorName: 'Kabita Poudel',
      actorRole: 'pharmacist',
      action: 'Pharmacist viewed prescription & updated status',
      targetType: 'Prescription',
      targetId: order.prescriptionId,
      hospitalId: order.hospitalId,
      ipAddress: req.ip || '202.45.144.28',
      details: `Updated prescription ${order.rxCode} dispensation state to "${status}".`,
    });

    dbStore.saveToDisk();
    broadcastStateUpdate('pharmacy:updated', order);
    res.json(order);
  });

  // ============================================================================
  // 11. EMERGENCY HEALTH ID SECURE RESOLVER (/api/health-id)
  // ============================================================================
  app.get('/api/health-id/:codeOrToken/emergency', (req: Request, res: Response) => {
    const { codeOrToken } = req.params;
    const state = dbStore.getState();
    const profile = state.patientProfiles.find(
      (p) => p.healthIdCode === codeOrToken || p.qrSecurityToken === codeOrToken
    );

    if (!profile) {
      res.status(404).json({ error: 'Health ID not found' });
      return;
    }

    // Log every access to Emergency QR as mandated by Section 27 & 34
    const audit = dbStore.addAuditLog({
      actorId: 'emergency-responder',
      actorName: 'Emergency Responder / Triage Scanner',
      actorRole: 'nurse',
      action: 'Emergency QR accessed',
      targetType: 'EmergencyQR',
      targetId: profile.healthIdCode,
      hospitalId: 'hosp-city',
      ipAddress: req.ip || '202.45.144.99',
      details: `Emergency Health ID (${profile.healthIdCode}) scanned for ${profile.name}. Exposed strictly permitted emergency fields.`,
    });

    broadcastStateUpdate('audit:created', audit);

    // Return ONLY permitted emergency information (Never full medical history)
    res.json({
      healthIdCode: profile.healthIdCode,
      name: profile.name,
      bloodGroup: profile.bloodGroup,
      knownAllergies: profile.allergies,
      criticalConditions: profile.criticalConditions,
      emergencyContact: profile.emergencyContact,
      importantMedicines: profile.importantMedicines,
      auditReference: audit.id,
      accessedAt: audit.timestamp,
    });
  });

  // ============================================================================
  // 12. INSURANCE & TELEMEDICINE & ADMIN API
  // ============================================================================
  app.patch('/api/insurance/claims/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, approvedAmount } = req.body;
    const state = dbStore.getState();
    const claim = state.insuranceClaims.find((c) => c.id === id);
    if (!claim) {
      res.status(404).json({ error: 'Insurance claim not found' });
      return;
    }
    claim.status = status;
    if (approvedAmount !== undefined) claim.approvedAmount = Number(approvedAmount);
    dbStore.saveToDisk();
    broadcastStateUpdate('insurance:updated', claim);
    res.json(claim);
  });

  app.post('/api/admin/verify-entity', (req: Request, res: Response) => {
    const { entityType, entityId, verified } = req.body;
    const state = dbStore.getState();

    if (entityType === 'doctor') {
      const doc = state.doctors.find((d) => d.id === entityId);
      if (doc) {
        doc.verified = Boolean(verified);
        dbStore.addAuditLog({
          actorId: 'usr-super-admin',
          actorName: 'AyuLink National Governance',
          actorRole: 'super_admin',
          action: 'Admin changed doctor verification',
          targetType: 'DoctorVerification',
          targetId: doc.id,
          hospitalId: doc.hospitalId,
          ipAddress: req.ip || '110.44.120.9',
          details: `Super Admin set credential verification for ${doc.name} (${doc.nmcDemoBadge}) to ${doc.verified ? 'VERIFIED' : 'UNVERIFIED'}.`,
        });
      }
    } else if (entityType === 'hospital') {
      const hosp = state.hospitals.find((h) => h.id === entityId);
      if (hosp) {
        hosp.verified = Boolean(verified);
      }
    }

    dbStore.saveToDisk();
    broadcastStateUpdate('admin:updated', state);
    res.json({ success: true });
  });

  app.post('/api/notifications/mark-read', (_req: Request, res: Response) => {
    const state = dbStore.getState();
    for (const n of state.notifications) {
      n.read = true;
    }
    dbStore.saveToDisk();
    broadcastStateUpdate('notifications:read', state.notifications);
    res.json({ success: true });
  });

  // ============================================================================
  // 13. AI — AYU ASSISTANT API (/api/ai/assistant)
  // ============================================================================
  app.post('/api/ai/assistant', async (req: Request, res: Response) => {
    try {
      const { message, locale = 'en', patientName = 'Mison Khatiwada' } = req.body as {
        message: string;
        locale?: SupportedLocale;
        patientName?: string;
      };

      if (!message || !message.trim()) {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      const result = await generateAyuAssistantReply({
        message,
        locale,
        patientName,
      });

      res.json(result);
    } catch (error) {
      console.error('Ayu Assistant error:', error);
      res.status(500).json({ error: 'Failed to process Ayu Assistant query' });
    }
  });

  // ============================================================================
  // VITE DEV MIDDLEWARE / STATIC PRODUCTION SERVING
  // ============================================================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`\n================================================================`);
    console.log(`🚀 AYULINK HEALTHCARE OS BACKEND + DASHBOARD RUNNING!`);
    console.log(`👉 Open in Browser:       http://localhost:${PORT}`);
    console.log(`👉 Full Web Dashboard:    http://localhost:${PORT}/dashboard`);
    console.log(`👉 REST + Socket.IO API:  http://localhost:${PORT}/api/state`);
    console.log(`   (Note: Do NOT open 0.0.0.0 in browser — use localhost:${PORT})`);
    console.log(`================================================================\n`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start AyuLink server:', err);
});
