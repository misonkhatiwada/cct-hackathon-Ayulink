import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Monitor,
  Columns,
  Sun,
  Moon,
  RotateCcw,
  CheckCircle2,
  FolderGit2,
  X,
} from 'lucide-react';
import { UserRole } from './types/ayulink';
import { DatabaseState, createInitialSeedState } from './types/seedData';
import { ayuApi } from './services/api';
import { PatientMobileApp } from './components/PatientMobileApp';
import { HospitalWebDashboard } from './components/HospitalWebDashboard';
import { showMonorepoModalContent } from './components/MonorepoArchitectureModal';

type ViewMode = 'split_os' | 'web_dashboard' | 'patient_mobile' | 'demo_guide';

export function App() {
  const [state, setState] = useState<DatabaseState>(() => createInitialSeedState());
  const [viewMode, setViewMode] = useState<ViewMode>('split_os');
  const [darkMode, setDarkMode] = useState(false);
  const [activeDashboardRole, setActiveDashboardRole] = useState<UserRole>('hospital_admin');
  const [showArchModal, setShowArchModal] = useState(false);

  // Real-time Socket.IO Toast Banner
  const [toast, setToast] = useState<{ title: string; description: string; badge?: string } | null>(null);

  const triggerToast = (title: string, description: string, badge?: string) => {
    setToast({ title, description, badge });
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    ayuApi
      .getState()
      .then((initial) => setState(initial))
      .catch((err) => console.warn('Initial state fetch fallback:', err));

    const socket = ayuApi.connectSocket({
      onStateSync: (synced) => setState(synced),
      onEventToast: (title, description, badge) => {
        setToast({ title, description, badge });
      },
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleResetDemo = async () => {
    const res = await ayuApi.resetDemo();
    if (res?.state) {
      setState(res.state);
      triggerToast(
        'Demo State Reset to Step 1',
        'Slot 3:30 PM for Dr. Suman Sharma is AVAILABLE. Next booking will generate Token A-24.',
        'READY'
      );
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors ${
        darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      {/* =====================================================================
          STRICT 3-ZONE TOP BAR CONTRACT
          Zone 1: Single text element wordmark
          Zone 2: 4 clean text navigation links
          Zone 3: 2 primary actions (Theme + Reset Demo)
      ===================================================================== */}
      <header
        className={`sticky top-0 z-40 h-14 px-6 border-b flex items-center justify-between transition-colors ${
          darkMode ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'
        }`}
      >
        {/* Zone 1: Single text element Brand Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setViewMode('split_os');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap"
        >
          AYULINK
        </a>

        {/* Zone 2: 4 Clean Text Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <button
            onClick={() => setViewMode('split_os')}
            className={`hover:text-teal-600 transition-colors whitespace-nowrap py-1 border-b-2 ${
              viewMode === 'split_os' ? 'border-teal-600 text-teal-600 font-semibold' : 'border-transparent'
            }`}
          >
            Connected Live OS
          </button>
          <button
            onClick={() => setViewMode('web_dashboard')}
            className={`hover:text-teal-600 transition-colors whitespace-nowrap py-1 border-b-2 ${
              viewMode === 'web_dashboard' ? 'border-teal-600 text-teal-600 font-semibold' : 'border-transparent'
            }`}
          >
            Hospital Web Dashboard
          </button>
          <button
            onClick={() => setViewMode('patient_mobile')}
            className={`hover:text-teal-600 transition-colors whitespace-nowrap py-1 border-b-2 ${
              viewMode === 'patient_mobile' ? 'border-teal-600 text-teal-600 font-semibold' : 'border-transparent'
            }`}
          >
            Patient Flutter App
          </button>
          <button
            onClick={() => setShowArchModal(true)}
            className="hover:text-teal-600 transition-colors whitespace-nowrap py-1 border-b-2 border-transparent"
          >
            Monorepo & Demo Flow
          </button>
        </nav>

        {/* Zone 3: 2 Primary Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`h-9 px-3 rounded-lg border text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              darkMode
                ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {darkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{darkMode ? 'Light' : 'Dark'}</span>
          </button>

          <button
            onClick={handleResetDemo}
            className="h-9 px-3.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo Flow</span>
          </button>
        </div>
      </header>

      {/* REAL-TIME SOCKET.IO TOAST NOTIFICATION */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md rounded-2xl border border-teal-500/40 bg-slate-900 text-white p-4 shadow-xl flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1 flex-1">
            <div className="font-bold flex items-center justify-between gap-2">
              <span>{toast.title}</span>
              {toast.badge && (
                <span className="font-mono text-[10px] text-teal-300">{toast.badge}</span>
              )}
            </div>
            <p className="text-slate-300 leading-relaxed">{toast.description}</p>
          </div>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =====================================================================
          CONTEXTUAL SUB-BAR: TAGLINE & QUICK ROLE / STEP SWITCHERS
      ===================================================================== */}
      <div
        className={`px-6 py-2.5 border-b text-xs flex flex-wrap items-center justify-between gap-3 ${
          darkMode ? 'bg-slate-900/40 border-slate-800/80' : 'bg-slate-100/70 border-slate-200/70'
        }`}
      >
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <span className="font-semibold text-teal-700 dark:text-teal-400">
            One Health ID. Every Care Connected.
          </span>
          <span>·</span>
          <span>Nepal Digital Health Operating System</span>
          <span>·</span>
          <span className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
            ● Socket.IO Connected
          </span>
        </div>

        {/* Quick Role Switcher Pills for Judges */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-500 mr-1">Dashboard Role:</span>
          {(
            [
              { role: 'hospital_admin', label: 'Hospital Admin' },
              { role: 'receptionist', label: 'Receptionist' },
              { role: 'doctor', label: 'Doctor (Dr. Suman)' },
              { role: 'lab_staff', label: 'Lab Staff' },
              { role: 'pharmacist', label: 'Pharmacist' },
              { role: 'super_admin', label: 'Super Admin' },
            ] as const
          ).map((r) => (
            <button
              key={r.role}
              onClick={() => setActiveDashboardRole(r.role)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                activeDashboardRole === r.role
                  ? 'bg-slate-900 dark:bg-teal-600 text-white font-semibold'
                  : darkMode
                  ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'bg-white text-slate-600 hover:bg-slate-200/60 border border-slate-200/80'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* =====================================================================
          MAIN VIEWPORT AREA
      ===================================================================== */}
      <div className="flex-1 px-4 md:px-6 py-5 max-w-[1640px] w-full mx-auto">
        {viewMode === 'split_os' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Left Column: Patient Flutter Mobile Application (4 cols on XL) */}
            <div className="xl:col-span-4 flex flex-col items-center">
              <div className="w-full max-w-[420px] mb-2 flex items-center justify-between text-xs px-1">
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-teal-600" />
                  <span>App 1: Patient Flutter Mobile App</span>
                </span>
                <span className="font-mono text-[11px] text-slate-500">Mison Khatiwada</span>
              </div>
              <PatientMobileApp
                state={state}
                darkMode={darkMode}
                compactFrame={true}
                onActionFeedback={(msg) => triggerToast('Patient App Event', msg, 'SYNCED')}
              />
            </div>

            {/* Right Column: React Hospital / Doctor SaaS Web Dashboard (8 cols on XL) */}
            <div className="xl:col-span-8 w-full">
              <div className="mb-2 flex items-center justify-between text-xs px-1">
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Monitor className="w-4 h-4 text-teal-600" />
                  <span>App 2: Hospital / Doctor React Web Dashboard</span>
                </span>
                <span className="font-mono text-[11px] text-slate-500">
                  Real-Time REST + Socket.IO Backend (App 3)
                </span>
              </div>
              <HospitalWebDashboard
                state={state}
                darkMode={darkMode}
                activeRole={activeDashboardRole}
                onRoleChange={setActiveDashboardRole}
                onActionFeedback={(msg) => triggerToast('Hospital Dashboard Event', msg, 'LIVE')}
              />
            </div>
          </div>
        )}

        {viewMode === 'web_dashboard' && (
          <HospitalWebDashboard
            state={state}
            darkMode={darkMode}
            activeRole={activeDashboardRole}
            onRoleChange={setActiveDashboardRole}
            onActionFeedback={(msg) => triggerToast('Hospital Dashboard Event', msg, 'LIVE')}
          />
        )}

        {viewMode === 'patient_mobile' && (
          <div className="py-2">
            <PatientMobileApp
              state={state}
              darkMode={darkMode}
              compactFrame={true}
              onActionFeedback={(msg) => triggerToast('Patient App Event', msg, 'SYNCED')}
            />
          </div>
        )}
      </div>

      {/* MONOREPO & 18-STEP DEMO FLOW MODAL */}
      {showArchModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className={`w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-2xl border p-6 space-y-5 text-xs ${
              darkMode ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[11px] font-bold text-teal-600 block">
                  AYULINK MONOREPO & 18-STEP HACKATHON GUIDE
                </span>
                <h2 className="text-base font-bold">
                  Connected Healthcare Operating System Architecture
                </h2>
              </div>
              <button
                onClick={() => setShowArchModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {showMonorepoModalContent()}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
