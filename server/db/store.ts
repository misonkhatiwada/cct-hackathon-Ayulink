import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  AppNotification,
  AuditLogEntry,
} from '../../src/types/ayulink';
import {
  DatabaseState,
  createInitialSeedState,
} from '../../src/types/seedData';

export type { DatabaseState };
export { createInitialSeedState };

const DATA_FILE = path.resolve(process.cwd(), 'server/db/ayulink_runtime_db.json');

class AyuLinkStore {
  private state: DatabaseState;

  constructor() {
    this.state = this.loadFromDisk();
  }

  private loadFromDisk(): DatabaseState {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as DatabaseState;
        if (parsed && Array.isArray(parsed.hospitals) && Array.isArray(parsed.doctors)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Initializing fresh AyuLink database state:', e);
    }
    const fresh = createInitialSeedState();
    this.saveToDisk(fresh);
    return fresh;
  }

  public saveToDisk(stateToSave: DatabaseState = this.state) {
    try {
      const dir = path.dirname(DATA_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(stateToSave, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to persist state:', e);
    }
  }

  public getState(): DatabaseState {
    this.expireStaleHolds();
    return this.state;
  }

  public resetToDemoSeed(): DatabaseState {
    this.state = createInitialSeedState();
    this.saveToDisk();
    return this.state;
  }

  public expireStaleHolds(): boolean {
    const now = Date.now();
    let changed = false;
    for (const slot of this.state.slots) {
      if (slot.status === 'HELD' && slot.heldUntil && slot.heldUntil <= now) {
        slot.status = 'AVAILABLE';
        slot.heldByPatientId = undefined;
        slot.heldUntil = undefined;
        slot.appointmentId = undefined;
        changed = true;
      }
    }
    if (changed) {
      this.saveToDisk();
    }
    return changed;
  }

  public addAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): AuditLogEntry {
    const now = new Date();
    const formatted = `${now.toISOString().slice(0, 10)} ${now.toTimeString().slice(0, 8)} NPT`;
    const record: AuditLogEntry = {
      ...entry,
      id: `aud-${crypto.randomBytes(4).toString('hex')}`,
      timestamp: formatted,
    };
    this.state.auditLogs.unshift(record);
    this.saveToDisk();
    return record;
  }

  public addNotification(notif: Omit<AppNotification, 'id' | 'createdAt' | 'displayTime' | 'read'>): AppNotification {
    const now = new Date();
    const record: AppNotification = {
      ...notif,
      id: `notif-${crypto.randomBytes(4).toString('hex')}`,
      read: false,
      createdAt: now.toISOString(),
      displayTime: 'Just now',
    };
    this.state.notifications.unshift(record);
    this.saveToDisk();
    return record;
  }
}

export const dbStore = new AyuLinkStore();
