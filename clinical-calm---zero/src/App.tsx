import { useState, useCallback, useEffect } from 'react';
import { UserProfile, PatientRecord, HospitalActivityLog, MedicalScan, PrescriptionItem, Consultation } from './types/clinical';
import {
  INITIAL_PATIENTS,
  INITIAL_ACTIVITY_LOGS,
} from './data/mockClinicalData';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './components/auth/LoginPage';
import { TopBar } from './components/TopBar';
import { PatientPortal } from './components/patient/PatientPortal';
import { DoctorWorkstation } from './components/doctor/DoctorWorkstation';
import { AdminConsole } from './components/admin/AdminConsole';
import { DynamicImageLinkModal } from './components/DynamicImageLinkModal';
import { hasRole, canPerformClinicalAction, canManageHospitalOperations } from './utils/authorization';
import { api } from './services/api';
import { CheckCircle2, X, ZoomIn, ZoomOut, RotateCcw, AlertTriangle, Database } from 'lucide-react';

const STORAGE_KEYS = {
  PATIENTS: 'clinical_calm_patients',
  LOGS: 'clinical_calm_logs',
};

function ClinicalCalmApp() {
  const { currentUser, logout } = useAuth();

  // Main State with localStorage initialization
  const [patients, setPatients] = useState<PatientRecord[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PATIENTS);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return INITIAL_PATIENTS;
  });

  const [activityLogs, setActivityLogs] = useState<HospitalActivityLog[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LOGS);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return INITIAL_ACTIVITY_LOGS;
  });

  // Chargement dynamique des données depuis la base SQLite
  useEffect(() => {
    let isMounted = true;
    const loadSqliteData = async () => {
      try {
        const [dbPatients, dbLogs] = await Promise.all([
          api.getPatients(),
          api.getLogs(),
        ]);
        if (!isMounted) return;
        if (dbPatients && dbPatients.length > 0) {
          setPatients(dbPatients);
        }
        if (dbLogs && dbLogs.length > 0) {
          setActivityLogs(dbLogs);
        }
      } catch (e) {
        console.warn('Backend SQLite non joignable, utilisation des données locales', e);
      }
    };
    loadSqliteData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Persist state changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PATIENTS, JSON.stringify(patients));
    } catch (e) {
      console.error('Failed to save patients to localStorage', e);
    }
  }, [patients]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(activityLogs));
    } catch (e) {
      console.error('Failed to save logs to localStorage', e);
    }
  }, [activityLogs]);

  // Synchronisation dynamique si un nouveau patient est inscrit
  useEffect(() => {
    const handlePatientsUpdate = async () => {
      try {
        const dbPatients = await api.getPatients();
        if (dbPatients && dbPatients.length > 0) {
          setPatients(dbPatients);
          return;
        }
        const saved = localStorage.getItem(STORAGE_KEYS.PATIENTS);
        if (saved) {
          setPatients(JSON.parse(saved));
        }
      } catch (e) {
        console.error('Failed to reload patients', e);
      }
    };
    window.addEventListener('clinical_calm_patients_updated', handlePatientsUpdate);
    return () => window.removeEventListener('clinical_calm_patients_updated', handlePatientsUpdate);
  }, []);

  // Dynamic Image Link Modal State & Target Patient
  const [isDynamicLinkModalOpen, setIsDynamicLinkModalOpen] = useState(false);
  const [targetPatientIdForScan, setTargetPatientIdForScan] = useState<string>('PAT-2026-001');

  // Fullscreen Viewer State
  const [fullscreenScan, setFullscreenScan] = useState<MedicalScan | null>(null);
  const [fullscreenZoom, setFullscreenZoom] = useState(1);
  const [fullscreenContrast, setFullscreenContrast] = useState(100);
  const [fullscreenBrightness, setFullscreenBrightness] = useState(100);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // General Activity Logger
  const handleLogActivity = useCallback((
    action: string,
    patientName: string,
    details: string,
    category: 'DOSSIER' | 'ORDONNANCE' | 'IMAGERIE' | 'CONSULTATION' | 'EQUIPEMENT' | 'CONNEXION'
  ) => {
    const actorName = currentUser ? currentUser.name : 'Système';
    const actorRole = currentUser ? currentUser.title : 'Système';
    const newLog: HospitalActivityLog = {
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR').slice(0, 5),
      actorName,
      actorRole,
      action,
      category,
      patientName,
      details,
    };
    setActivityLogs((prev) => [newLog, ...prev]);
    // Persist to SQLite
    api.addLog(newLog).catch((e) => console.warn('SQLite log error:', e));
  }, [currentUser]);

  // RBAC Access Denied Logger helper
  const handleAccessDenied = useCallback((attemptedAction: string, details?: string) => {
    const actorName = currentUser ? currentUser.name : 'Utilisateur non authentifié';
    const actorRole = currentUser ? currentUser.role : 'INCONNU';
    const newLog: HospitalActivityLog = {
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR').slice(0, 5),
      actorName,
      actorRole,
      action: 'ACCESS_DENIED',
      category: 'CONNEXION',
      patientName: 'Système',
      details: details || `Tentative non autorisée d'exécution : "${attemptedAction}" par le rôle ${actorRole}. Action bloquée.`,
    };
    setActivityLogs((prev) => [newLog, ...prev]);
    api.addLog(newLog).catch((e) => console.warn('SQLite log error:', e));
    showToast(`Accès refusé : vous n'avez pas l'autorisation pour l'action "${attemptedAction}".`);
  }, [currentUser]);

  // Add a new prescription to a patient (Doctor only)
  const handleAddPrescription = (patientId: string, prescription: PrescriptionItem) => {
    if (!canPerformClinicalAction(currentUser)) {
      handleAccessDenied('Délivrance d\'ordonnance', `L'utilisateur ${currentUser?.name} (${currentUser?.role}) a tenté de prescrire une ordonnance sans être médecin.`);
      return;
    }

    setPatients((prev) =>
      prev.map((p) =>
        p.id === patientId
          ? {
              ...p,
              prescriptions: [prescription, ...p.prescriptions],
            }
          : p
      )
    );

    // Persist to SQLite
    api.addPrescription(patientId, prescription).catch((e) => console.warn('SQLite prescription error:', e));

    const targetPatient = patients.find((p) => p.id === patientId);
    handleLogActivity(
      'Délivrance d\'ordonnance',
      targetPatient?.name || 'Patient',
      `Prescription de ${prescription.medication} (${prescription.frequency}).`,
      'ORDONNANCE'
    );
    showToast(`Ordonnance délivrée pour ${targetPatient?.name} : ${prescription.medication}`);
  };


  // Add a new consultation (Doctor only)
  const handleAddConsultation = (consultation: Consultation) => {
    if (!canPerformClinicalAction(currentUser)) {
      handleAccessDenied('Planification de consultation', `L'utilisateur ${currentUser?.name} (${currentUser?.role}) a tenté de planifier une consultation médicale sans être médecin.`);
      return;
    }

    setPatients((prev) =>
      prev.map((p) =>
        p.id === consultation.patientId
          ? {
              ...p,
              consultations: [consultation, ...p.consultations],
            }
          : p
      )
    );

    // Persist to SQLite
    api.addConsultation(consultation).catch((e) => console.warn('SQLite consultation error:', e));

    handleLogActivity(
      'Planification de consultation',
      consultation.patientName,
      `Rendez-vous fixé au ${consultation.dateTime} (${consultation.specialty}).`,
      'CONSULTATION'
    );
    showToast(`Rendez-vous programmé le ${consultation.dateTime} avec ${consultation.patientName}`);
  };

  // Add a dynamic scan from HTML (Doctor only)
  const handleAddScan = (scan: MedicalScan) => {
    if (!canPerformClinicalAction(currentUser)) {
      handleAccessDenied('Ajout d\'imagerie médicale', `L'utilisateur ${currentUser?.name} (${currentUser?.role}) a tenté d'ajouter un examen d'imagerie sans être médecin.`);
      return;
    }

    const targetPatient = patients.find((p) => p.id === targetPatientIdForScan) || patients[0];

    setPatients((prev) =>
      prev.map((p) =>
        p.id === targetPatient.id
          ? {
              ...p,
              scans: [scan, ...p.scans],
            }
          : p
      )
    );

    // Persist to SQLite
    api.addScan(targetPatient.id, scan).catch((e) => console.warn('SQLite scan error:', e));

    handleLogActivity(
      'Ajout d\'imagerie médicale',
      targetPatient.name,
      `Ajout du cliché ${scan.title} (${scan.modality}) au dossier médical de ${targetPatient.name}.`,
      'IMAGERIE'
    );
    showToast(`Cliché ajouté avec succès au dossier de ${targetPatient.name} : ${scan.title}`);
  };

  // Update findings (Doctor only)
  const handleUpdateFindings = (scanId: string, findings: string, note: string) => {
    if (!canPerformClinicalAction(currentUser)) {
      handleAccessDenied('Mise à jour de compte-rendu médical', `L'utilisateur ${currentUser?.name} (${currentUser?.role}) a tenté de modifier des conclusions médicales sans être médecin.`);
      return;
    }

    setPatients((prev) =>
      prev.map((p) => ({
        ...p,
        scans: p.scans.map((s) =>
          s.id === scanId ? { ...s, findings, radiologistNote: note } : s
        ),
      }))
    );

    // Persist to SQLite
    api.updateScanFindings(scanId, findings, note).catch((e) => console.warn('SQLite findings error:', e));

    showToast('Compte-rendu médical mis à jour.');
  };

  // Delete/Cancel prescription (Doctor only)
  const handleDeletePrescription = (patientId: string, prescriptionId: string) => {
    if (!canPerformClinicalAction(currentUser)) {
      handleAccessDenied('Suppression d\'ordonnance', `L'utilisateur ${currentUser?.name} (${currentUser?.role}) a tenté de supprimer une ordonnance sans être médecin.`);
      return;
    }

    const targetPatient = patients.find((p) => p.id === patientId);
    const pres = targetPatient?.prescriptions.find((pr) => pr.id === prescriptionId);
    setPatients((prev) =>
      prev.map((p) =>
        p.id === patientId
          ? {
              ...p,
              prescriptions: p.prescriptions.filter((pr) => pr.id !== prescriptionId),
            }
          : p
      )
    );

    // Persist to SQLite
    api.deletePrescription(patientId, prescriptionId).catch((e) => console.warn('SQLite delete presc error:', e));

    handleLogActivity(
      'Suppression d\'ordonnance',
      targetPatient?.name || 'Patient',
      `Suppression de la prescription ${pres?.medication || prescriptionId}.`,
      'ORDONNANCE'
    );
    showToast(`Ordonnance supprimée : ${pres?.medication || prescriptionId}`);
  };

  // Delete scan (Doctor only)
  const handleDeleteScan = (patientId: string, scanId: string) => {
    if (!canPerformClinicalAction(currentUser)) {
      handleAccessDenied('Suppression d\'imagerie médicale', `L'utilisateur ${currentUser?.name} (${currentUser?.role}) a tenté de supprimer un cliché d'imagerie sans être médecin.`);
      return;
    }

    const targetPatient = patients.find((p) => p.id === patientId);
    const scan = targetPatient?.scans.find((s) => s.id === scanId);
    setPatients((prev) =>
      prev.map((p) =>
        p.id === patientId
          ? {
              ...p,
              scans: p.scans.filter((s) => s.id !== scanId),
            }
          : p
      )
    );

    // Persist to SQLite
    api.deleteScan(scanId).catch((e) => console.warn('SQLite delete scan error:', e));

    handleLogActivity(
      'Suppression d\'imagerie médicale',
      targetPatient?.name || 'Patient',
      `Retrait du cliché ${scan?.title || scanId} du dossier.`,
      'IMAGERIE'
    );
    showToast(`Cliché retiré : ${scan?.title || scanId}`);
  };

  // Cancel consultation (Doctor only)
  const handleCancelConsultation = (patientId: string, consultationId: string) => {
    if (!canPerformClinicalAction(currentUser)) {
      handleAccessDenied('Annulation de consultation', `L'utilisateur ${currentUser?.name} (${currentUser?.role}) a tenté d'annuler une consultation sans être médecin.`);
      return;
    }

    const targetPatient = patients.find((p) => p.id === patientId);
    const consult = targetPatient?.consultations.find((c) => c.id === consultationId);
    setPatients((prev) =>
      prev.map((p) =>
        p.id === patientId
          ? {
              ...p,
              consultations: p.consultations.filter((c) => c.id !== consultationId),
            }
          : p
      )
    );

    // Persist to SQLite
    api.cancelConsultation(consultationId).catch((e) => console.warn('SQLite delete consult error:', e));

    handleLogActivity(
      'Annulation de consultation',
      targetPatient?.name || 'Patient',
      `Annulation du rendez-vous du ${consult?.dateTime || consultationId}.`,
      'CONSULTATION'
    );
    showToast('Consultation annulée avec succès.');
  };

  // If unauthenticated: display only LoginPage
  if (!currentUser) {
    return <LoginPage />;
  }

  // Current patient for patient portal (matches by name or email or defaults to first)
  const patientProfile =
    patients.find(
      (p) =>
        p.id === currentUser.id ||
        p.name.toLowerCase() === currentUser.name.toLowerCase() ||
        (p.email && currentUser.email && p.email.toLowerCase() === currentUser.email.toLowerCase())
    ) || patients[0];
  const targetPatientObj = patients.find((p) => p.id === targetPatientIdForScan) || patients[0];

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-[#111827] flex flex-col font-sans">
      {/* Top Bar with user badge and explicit Logout */}
      <TopBar currentUser={currentUser} onLogout={logout} />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in max-w-md">
          <div className="p-4 rounded-xl shadow-lg border border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46] flex items-center gap-3 text-xs font-semibold">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-[#065F46]" />
            <span className="flex-1">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Main Protected Role Content */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 md:px-6 lg:px-8 py-6">
        {/* 1. Interface PATIENT — strictly visible only to PATIENT role */}
        {currentUser.role === 'PATIENT' && (
          <PatientPortal
            patient={patientProfile}
            currentUser={currentUser}
            onOpenScanViewer={(scan) => {
              setFullscreenScan(scan);
              setFullscreenZoom(1);
              setFullscreenContrast(100);
              setFullscreenBrightness(100);
            }}
          />
        )}

        {/* 2. Interface MÉDECIN — strictly visible only to DOCTOR role */}
        {currentUser.role === 'DOCTOR' && (
          <DoctorWorkstation
            patients={patients}
            currentUser={currentUser}
            currentDoctorName={currentUser.name}
            onOpenAddScanModalForPatient={(patientId) => {
              if (!canPerformClinicalAction(currentUser)) {
                handleAccessDenied('Ajout d\'imagerie médicale', 'Action réservée aux médecins.');
                return;
              }
              setTargetPatientIdForScan(patientId);
              setIsDynamicLinkModalOpen(true);
            }}
            onAddPrescription={handleAddPrescription}
            onAddConsultation={handleAddConsultation}
            onUpdateFindings={handleUpdateFindings}
            onLogActivity={handleLogActivity}
            onDeletePrescription={handleDeletePrescription}
            onDeleteScan={handleDeleteScan}
            onCancelConsultation={handleCancelConsultation}
          />
        )}

        {/* 3. Interface ADMINISTRATEUR — strictly visible only to ADMIN role */}
        {currentUser.role === 'ADMIN' && (
          <AdminConsole
            patients={patients}
            activityLogs={activityLogs}
            currentUser={currentUser}
            onResetData={async () => {
              if (!canManageHospitalOperations(currentUser)) {
                handleAccessDenied('Réinitialisation des données', 'Action réservée aux administrateurs.');
                return;
              }
              if (window.confirm('Voulez-vous vraiment réinitialiser toutes les données aux valeurs d\'origine ?')) {
                await api.resetData();
                localStorage.removeItem(STORAGE_KEYS.PATIENTS);
                localStorage.removeItem(STORAGE_KEYS.LOGS);
                localStorage.removeItem('clinical_calm_equipments');
                const [freshPatients, freshLogs] = await Promise.all([api.getPatients(), api.getLogs()]);
                setPatients(freshPatients.length > 0 ? freshPatients : INITIAL_PATIENTS);
                setActivityLogs(freshLogs.length > 0 ? freshLogs : INITIAL_ACTIVITY_LOGS);
                showToast('Base SQLite et données réinitialisées avec succès.');
              }
            }}
            onUnauthorizedAction={(action) => handleAccessDenied(action, `Action "${action}" bloquée par le contrôle RBAC.`)}
          />
        )}
      </main>

      {/* Dynamic Image Link Modal (Adds to target patient's medical record) */}
      <DynamicImageLinkModal
        isOpen={isDynamicLinkModalOpen}
        onClose={() => setIsDynamicLinkModalOpen(false)}
        currentUser={currentUser}
        targetPatientId={targetPatientIdForScan}
        targetPatientName={targetPatientObj?.name || 'Julien Moreau'}
        onAddScan={handleAddScan}
        onUnauthorizedAction={(action) => handleAccessDenied(action, `Action "${action}" bloquée par le contrôle RBAC.`)}
      />

      {/* Fullscreen Scan Viewer Modal (Simple, Clean, Medical) */}
      {fullscreenScan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-fade-in" role="dialog" aria-modal="true" aria-label="Visualisation d'imagerie médicale" onKeyDown={(e) => { if (e.key === 'Escape') setFullscreenScan(null); }}>
          <div className="bg-neutral-900 rounded-2xl border border-white/10 shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col text-white">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">{fullscreenScan.title}</h3>
                <p className="text-xs text-neutral-400">
                  {fullscreenScan.patientName} · {fullscreenScan.modality} · {fullscreenScan.studyDate}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFullscreenScan(null)}
                className="p-1.5 text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative bg-black min-h-[460px] flex items-center justify-center overflow-hidden p-4">
              <div
                className="flex items-center justify-center w-full h-full"
                style={{ transform: `scale(${fullscreenZoom})` }}
              >
                <img
                  src={fullscreenScan.imageUrl}
                  alt={fullscreenScan.title}
                  className="max-h-[440px] max-w-full object-contain pointer-events-none"
                  style={{
                    filter: `contrast(${fullscreenContrast}%) brightness(${fullscreenBrightness}%)`,
                  }}
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            {/* Viewer Controls */}
            <div className="p-3 bg-neutral-950 border-t border-white/10 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFullscreenZoom(Math.max(0.8, fullscreenZoom - 0.2))}
                  className="p-1.5 bg-neutral-800 rounded hover:bg-neutral-700"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="font-mono text-xs w-12 text-center">
                  {Math.round(fullscreenZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setFullscreenZoom(Math.min(2.5, fullscreenZoom + 0.2))}
                  className="p-1.5 bg-neutral-800 rounded hover:bg-neutral-700"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFullscreenZoom(1);
                    setFullscreenContrast(100);
                    setFullscreenBrightness(100);
                  }}
                  className="p-1.5 bg-neutral-800 rounded hover:bg-neutral-700 ml-2"
                  title="Réinitialiser"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-neutral-400">
                {fullscreenScan.findings}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clean Footer */}
      <footer className="border-t border-[#E5E7EB] bg-white py-4 mt-auto">
        <div className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#6B7280]">
          <div>
            Clinical Calm · Système d'Information Hospitalier & Portail Médical
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Authentification Démonstration</span>
            <span>·</span>
            <span>Cloisonnement des Rôles</span>
            <span>·</span>
            <span>Prise en charge Clinique</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  const handleAuditLoginSuccess = (user: UserProfile) => {
    try {
      const savedLogs = localStorage.getItem(STORAGE_KEYS.LOGS);
      const existingLogs: HospitalActivityLog[] = savedLogs ? JSON.parse(savedLogs) : INITIAL_ACTIVITY_LOGS;
      const newLog: HospitalActivityLog = {
        id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR').slice(0, 5),
        actorName: user.name,
        actorRole: user.title,
        action: 'LOGIN_SUCCESS',
        category: 'CONNEXION',
        patientName: user.role === 'PATIENT' ? user.name : 'Système',
        details: `Connexion réussie à l'espace ${user.role} (${user.email}).`,
      };
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify([newLog, ...existingLogs]));
    } catch (e) {
      console.error('Failed to log LOGIN_SUCCESS', e);
    }
  };

  const handleAuditLoginFailed = (attemptedEmail: string) => {
    try {
      const savedLogs = localStorage.getItem(STORAGE_KEYS.LOGS);
      const existingLogs: HospitalActivityLog[] = savedLogs ? JSON.parse(savedLogs) : INITIAL_ACTIVITY_LOGS;
      const newLog: HospitalActivityLog = {
        id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR').slice(0, 5),
        actorName: 'Visiteur Inconnu',
        actorRole: 'Non authentifié',
        action: 'LOGIN_FAILED',
        category: 'CONNEXION',
        patientName: 'Système',
        details: `Échec d'authentification pour l'identifiant "${attemptedEmail}".`,
      };
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify([newLog, ...existingLogs]));
    } catch (e) {
      console.error('Failed to log LOGIN_FAILED', e);
    }
  };

  const handleAuditLogout = (user: UserProfile) => {
    try {
      const savedLogs = localStorage.getItem(STORAGE_KEYS.LOGS);
      const existingLogs: HospitalActivityLog[] = savedLogs ? JSON.parse(savedLogs) : INITIAL_ACTIVITY_LOGS;
      const newLog: HospitalActivityLog = {
        id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR').slice(0, 5),
        actorName: user.name,
        actorRole: user.title,
        action: 'LOGOUT',
        category: 'CONNEXION',
        patientName: user.role === 'PATIENT' ? user.name : 'Système',
        details: `Déconnexion volontaire de l'utilisateur ${user.name} (${user.role}).`,
      };
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify([newLog, ...existingLogs]));
    } catch (e) {
      console.error('Failed to log LOGOUT', e);
    }
  };

  const handleAuditRegister = (user: UserProfile) => {
    try {
      const savedLogs = localStorage.getItem(STORAGE_KEYS.LOGS);
      const existingLogs: HospitalActivityLog[] = savedLogs ? JSON.parse(savedLogs) : INITIAL_ACTIVITY_LOGS;
      const newLog: HospitalActivityLog = {
        id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR').slice(0, 5),
        actorName: user.name,
        actorRole: user.title,
        action: 'INSCRIPTION_NOUVEAU_COMPTE',
        category: 'CONNEXION',
        patientName: user.role === 'PATIENT' ? user.name : 'Système',
        details: `Création réussie du compte ${user.role} pour ${user.name} (${user.email}).`,
      };
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify([newLog, ...existingLogs]));
    } catch (e) {
      console.error('Failed to log INSCRIPTION_NOUVEAU_COMPTE', e);
    }
  };

  return (
    <AuthProvider
      onAuditLoginSuccess={handleAuditLoginSuccess}
      onAuditLoginFailed={handleAuditLoginFailed}
      onAuditLogout={handleAuditLogout}
      onAuditRegister={handleAuditRegister}
    >
      <ClinicalCalmApp />
    </AuthProvider>
  );
}
