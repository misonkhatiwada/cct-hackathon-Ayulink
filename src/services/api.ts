import { io, Socket } from 'socket.io-client';
import {
  UserRole,
  SupportedLocale,
  ScheduleBlock,
  MedicineItem,
  LabOrderStatus,
  LabParameterResult,
} from '../types/ayulink';
import type { DatabaseState } from '../types/seedData';

class AyuClientApiService {
  private socket: Socket | null = null;

  public connectSocket(handlers: {
    onStateSync: (state: DatabaseState) => void;
    onEventToast?: (title: string, description: string, badge?: string) => void;
  }): Socket {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
    });

    this.socket.on('state:sync', (state: DatabaseState) => {
      handlers.onStateSync(state);
    });

    this.socket.on('appointment:created', (data: { appointment: { patientName: string; doctorName: string; departmentName: string; time: string; token: string } }) => {
      if (handlers.onEventToast && data?.appointment) {
        handlers.onEventToast(
          `NEW APPOINTMENT · Token ${data.appointment.token}`,
          `${data.appointment.patientName} → ${data.appointment.doctorName} (${data.appointment.departmentName}) · ${data.appointment.time} · Payment ✓ VERIFIED`,
          'VERIFIED'
        );
      }
    });

    this.socket.on('patient:checked-in', (data: { appointment: { token: string; patientName: string } }) => {
      if (handlers.onEventToast && data?.appointment) {
        handlers.onEventToast(
          `CHECK-IN SUCCESSFUL · ${data.appointment.token}`,
          `${data.appointment.patientName} scanned QR at Reception Desk. Status: WAITING.`,
          'WAITING'
        );
      }
    });

    this.socket.on('queue:called', (data: { appointment: { token: string; roomNumber: string; patientName: string } }) => {
      if (handlers.onEventToast && data?.appointment) {
        handlers.onEventToast(
          `🔔 YOUR TURN · Token ${data.appointment.token}`,
          `${data.appointment.patientName}, please proceed to ${data.appointment.roomNumber} now.`,
          'CALLED'
        );
      }
    });

    this.socket.on('prescription:created', (data: { prescription: { rxCode: string; patientName: string } }) => {
      if (handlers.onEventToast && data?.prescription) {
        handlers.onEventToast(
          `E-PRESCRIPTION CREATED · ${data.prescription.rxCode}`,
          `Delivered to ${data.prescription.patientName}'s Health Timeline & Hospital Pharmacy.`,
          'RX READY'
        );
      }
    });

    this.socket.on('lab:order-created', (data: { testName: string; patientName: string }) => {
      if (handlers.onEventToast && data) {
        handlers.onEventToast(
          `NEW LAB ORDER · ${data.testName}`,
          `${data.patientName} · Status: Booked in Pathology Lab Queue.`,
          'LAB BOOKED'
        );
      }
    });

    this.socket.on('lab:report-ready', (data: { testName: string; patientName: string }) => {
      if (handlers.onEventToast && data) {
        handlers.onEventToast(
          `LAB REPORT READY · ${data.testName}`,
          `Verified ${data.testName} report uploaded to ${data.patientName}'s Health Timeline.`,
          'REPORT READY'
        );
      }
    });

    this.socket.on('patient:called-notification', (data: { title: string; message: string }) => {
      if (handlers.onEventToast && data) {
        handlers.onEventToast(data.title, data.message, 'CALLED');
      }
    });

    this.socket.on('pharmacy:updated', (data: { rxCode: string; patientName: string; status: string }) => {
      if (handlers.onEventToast && data) {
        handlers.onEventToast(
          `💊 PHARMACY · ${data.rxCode} (${data.status})`,
          `${data.patientName} — Prescription ${data.rxCode} is now ${data.status}.`,
          data.status.toUpperCase()
        );
      }
    });

    return this.socket;
  }

  public async getState(): Promise<DatabaseState> {
    const res = await fetch('/api/state');
    if (!res.ok) throw new Error('Failed to fetch platform state');
    return res.json();
  }

  public async resetDemo(): Promise<{ success: boolean; state: DatabaseState }> {
    const res = await fetch('/api/demo/reset', { method: 'POST' });
    return res.json();
  }

  public async holdSlot(slotId: string, patientId = 'pat-mison') {
    const res = await fetch('/api/appointments/hold-slot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId, patientId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to hold slot');
    return data;
  }

  public async releaseSlot(slotId: string) {
    const res = await fetch('/api/appointments/release-slot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId }),
    });
    return res.json();
  }

  public async initiateEsewaPayment(params: {
    slotId: string;
    doctorId: string;
    patientId?: string;
    forFamilyMemberId?: string;
    type?: 'IN_PERSON' | 'TELEMEDICINE';
  }) {
    const res = await fetch('/api/payments/esewa/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to initiate eSewa payment');
    return data;
  }

  public async verifyEsewaPayment(params: {
    paymentId: string;
    transactionUuid: string;
    totalAmount: number;
    productCode: string;
    signature: string;
    esewaStatus?: 'COMPLETE' | 'FAILED';
    slotId: string;
    doctorId: string;
    patientId?: string;
    forFamilyMemberId?: string;
    type?: 'IN_PERSON' | 'TELEMEDICINE';
  }) {
    const res = await fetch('/api/payments/esewa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Payment verification failed');
    return data;
  }

  public async qrCheckIn(params: { qrToken?: string; appointmentId?: string }) {
    const res = await fetch('/api/queue/qr-checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'QR Check-in failed');
    return data;
  }

  public async callNextPatient(doctorId = 'doc-suman', targetAppointmentId?: string) {
    const res = await fetch('/api/queue/call-next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doctorId, targetAppointmentId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'No waiting patient to call');
    return data;
  }

  public async notifyPatient(params: {
    patientName?: string;
    token?: string;
    department?: string;
    title?: string;
    message?: string;
    referenceId?: string;
  }) {
    const res = await fetch('/api/queue/notify-patient', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.json();
  }

  public async updateAppointmentStatus(id: string, status: string, time?: string) {
    const res = await fetch(`/api/appointments/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, time }),
    });
    return res.json();
  }

  public async updateDoctorAvailability(
    doctorId: string,
    payload: {
      availableToday?: boolean;
      onLeave?: boolean;
      emergencyAvailable?: boolean;
      schedule?: ScheduleBlock[];
      slotIdToToggle?: string;
    }
  ) {
    const res = await fetch(`/api/availability/${doctorId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  public async getAuthorizedPatientRecord(patientId: string, actorRole: UserRole, actorName: string) {
    const res = await fetch(`/api/patients/${patientId}`, {
      headers: {
        'x-actor-role': actorRole,
        'x-actor-name': actorName,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Unauthorized access');
    return data;
  }

  public async addFamilyMember(
    patientId: string,
    payload: { name: string; relation: string; age: number; gender: string; bloodGroup: string }
  ) {
    const res = await fetch(`/api/patients/${patientId}/family`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  public async createPrescription(payload: {
    appointmentId?: string;
    patientId?: string;
    doctorId?: string;
    symptoms: string;
    clinicalNotes: string;
    diagnosis: string;
    medicines: MedicineItem[];
    followUpDate: string;
    completeConsultation?: boolean;
  }) {
    const res = await fetch('/api/prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  public async orderLabTest(payload: {
    patientId?: string;
    testId: string;
    orderedByDoctorId?: string;
    appointmentId?: string;
    scheduledTime?: string;
  }) {
    const res = await fetch('/api/labs/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  public async updateLabOrderStatus(
    id: string,
    payload: {
      status: LabOrderStatus;
      reportSummary?: string;
      reportParameters?: LabParameterResult[];
    }
  ) {
    const res = await fetch(`/api/labs/orders/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  public async updatePharmacyOrderStatus(id: string, status: string) {
    const res = await fetch(`/api/pharmacy/orders/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    return res.json();
  }

  public async scanEmergencyHealthId(codeOrToken: string) {
    const res = await fetch(`/api/health-id/${codeOrToken}/emergency`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to resolve Health ID');
    return data;
  }

  public async updateInsuranceClaim(id: string, status: string, approvedAmount?: number) {
    const res = await fetch(`/api/insurance/claims/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, approvedAmount }),
    });
    return res.json();
  }

  public async toggleEntityVerification(entityType: 'doctor' | 'hospital', entityId: string, verified: boolean) {
    const res = await fetch('/api/admin/verify-entity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType, entityId, verified }),
    });
    return res.json();
  }

  public async markNotificationsRead() {
    await fetch('/api/notifications/mark-read', { method: 'POST' });
  }

  public async askAyuAssistant(message: string, locale: SupportedLocale, patientName?: string) {
    const res = await fetch('/api/ai/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, locale, patientName }),
    });
    return res.json();
  }
}

export const ayuApi = new AyuClientApiService();
