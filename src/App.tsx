import { useState, useCallback, useEffect, useMemo } from 'react';
import { MedicalScan, PrescriptionItem, PrescriptionResponse, Consultation } from './types/clinical';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './components/auth/LoginPage';
import { TopBar } from './components/TopBar';
import { PatientPortal } from './components/patient/PatientPortal';
import { DoctorWorkstation } from './components/doctor/DoctorWorkstation';
import { AdminConsole } from './components/admin/AdminConsole';
import { DynamicImageLinkModal } from './components/DynamicImageLinkModal';
import { VerifyView } from './components/clinical/VerifyView';
import { canPerformClinicalAction, canManageHospitalOperations } from './utils/authorization';
import { getUpcomingConsultationsAlerts } from './utils/consultationAlert';
import {
  usePatients,
  useLogs,
  useAddPrescriptionMutation,
  useDeletePrescriptionMutation,
  useAddScanMutation,
  useUpdateScanFindingsMutation,
  useDeleteScanMutation,
  useAddConsultationMutation,
  useCancelConsultationMutation,
  useAddVitalsMutation,
  useAddLogMutation,
  useResetDataMutation,
} from './hooks/useClinicalData';
import { CheckCircle2, X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

const getVerificationIdFromUrl = (): string | null => {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname;
  if (path.startsWith('/verify/')) {
    const id = path.slice('/verify/'.length).trim();
    if (id) return decodeURIComponent(id);
  }
  const searchParam = new URLSearchParams(window.location.search).get('verify');
  if (searchParam) return searchParam.trim();
  const hash = window.location.hash;
  if (hash.startsWith('#verify/')) {
    const id = hash.slice('#verify/'.length).trim();
    if (id) return decodeURIComponent(id);
  }
  return null;
};

function ClinicalCalmApp() {
  const { currentUser, logout } = useAuth();
  const [verifyId, setVerifyId] = useState<string | null>(getVerificationIdFromUrl());

  useEffect(() => {
    const handleLocationChange = () => {
      setVerifyId(getVerificationIdFromUrl());
    };
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  // Requirement 1 & 3: TanStack Query is the single source of truth (no localStorage)
  const { data: patients = [], isLoading: isLoadingPatients } = usePatients(Boolean(currentUser));
  const { data: activityLogs = [] } = useLogs(Boolean(currentUser && currentUser.role === 'ADMIN'));

  // Mutations with automatic cache invalidation
  const addPrescriptionMutation = useAddPrescriptionMutation();
  const deletePrescriptionMutation = useDeletePrescriptionMutation();
  const addScanMutation = useAddScanMutation();
  const updateScanFindingsMutation = useUpdateScanFindingsMutation();
  const deleteScanMutation = useDeleteScanMutation();
  const addConsultationMutation = useAddConsultationMutation();
  const cancelConsultationMutation = useCancelConsultationMutation();
  const addVitalsMutation = useAddVitalsMutation();
  const addLogMutation = useAddLogMutation();
  const resetDataMutation = useResetDataMutation();

  // Dynamic Image Link Modal State & Target Patient
  const [isDynamicLinkModalOpen, setIsDynamicLinkModalOpen] = useState(false);
  const [targetPatientIdForScan, setTargetPatientIdForScan] = useState<string>('PAT-2026-001');
  const [requestedPatientTab, setRequestedPatientTab] = useState<
    'constantes' | 'medecins' | 'consultations' | 'dossier' | 'ordonnances' | null
  >(null);

  // Fullscreen Viewer State
  const [fullscreenScan, setFullscreenScan] = useState<MedicalScan | null>(null);
  const [fullscreenZoom, setFullscreenZoom] = useState(1);
  const [fullscreenContrast, setFullscreenContrast] = useState(100);
  const [fullscreenBrightness, setFullscreenBrightness] = useState(100);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Current patient for patient portal (matches by name or email or defaults to first)
  const patientProfile = useMemo(() => {
    return (
      patients.find(
        (p) =>
          p.id === currentUser?.id ||
          p.name.toLowerCase() === currentUser?.name?.toLowerCase() ||
          (p.email && currentUser?.email && p.email.toLowerCase() === currentUser.email.toLowerCase())
      ) || patients[0]
    );
  }, [patients, currentUser]);

  const targetPatientObj = useMemo(() => {
    return patients.find((p) => p.id === targetPatientIdForScan) || patients[0];
  }, [patients, targetPatientIdForScan]);

  // Active upcoming consultation alerts (< 48h) for PATIENT role
  const patientUpcomingAlerts = useMemo(() => {
    if (!currentUser || currentUser.role !== 'PATIENT' || !patientProfile) return [];
    return getUpcomingConsultationsAlerts(patientProfile.consultations || []);
  }, [currentUser, patientProfile]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  // General Activity Logger via API
  const handleLogActivity = useCallback((
    action: string,
    patientName: string,
    details: string,
    category: 'DOSSIER' | 'ORDONNANCE' | 'IMAGERIE' | 'CONSULTATION' | 'EQUIPEMENT' | 'CONNEXION'
  ) => {
    const actorName = currentUser ? currentUser.name : 'Système';
    const actorRole = currentUser ? currentUser.title : 'Système';
    addLogMutation.mutate({
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR').slice(0, 5),
      actorName,
      actorRole,
      action,
      category,
      patientName,
      details,
    });
  }, [currentUser, addLogMutation]);

  // RBAC Access Denied Logger helper
  const handleAccessDenied = useCallback((attemptedAction: string, details?: string) => {
    const actorName = currentUser ? currentUser.name : 'Utilisateur non authentifié';
    const actorRole = currentUser ? currentUser.role : 'INCONNU';
    addLogMutation.mutate({
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR').slice(0, 5),
      actorName,
      actorRole,
      action: 'ACCESS_DENIED',
      category: 'CONNEXION',
      patientName: 'Système',
      details: details || `Tentative non autorisée d'exécution : "${attemptedAction}" par le rôle ${actorRole}. Action bloquée.`,
    });
    showToast(`Accès refusé : vous n'avez pas l'autorisation pour l'action "${attemptedAction}".`);
  }, [currentUser, addLogMutation]);

  // Add a new prescription to a patient (Doctor only)
  const handleAddPrescription = async (
    patientId: string,
    prescription: Partial<PrescriptionItem> & { override?: boolean; justification?: string }
  ): Promise<PrescriptionResponse> => {
    if (!canPerformClinicalAction(currentUser)) {
      handleAccessDenied('Délivrance d\'ordonnance', `L'utilisateur ${currentUser?.name} (${currentUser?.role}) a tenté de prescrire une ordonnance sans être médecin.`);
      return { success: false, error: 'Non autorisé' };
    }

    const targetPatient = patients.find((p) => p.id === patientId);
    try {
      const res = await addPrescriptionMutation.mutateAsync({
        patientId,
        item: prescription,
        patientName: targetPatient?.name,
      });

      if (res.success) {
        showToast(
          res.overridden
            ? `Ordonnance délivrée avec dérogation clinique pour ${targetPatient?.name || 'le patient'} : ${prescription.medication}`
            : `Ordonnance scellée pour ${targetPatient?.name || 'le patient'} : ${prescription.medication}`
        );
      }
      return res;
    } catch (e: any) {
      showToast(`Erreur serveur : ${e.message}`);
      return { success: false, error: e.message };
    }
  };

  // Add a new consultation (Doctor only)
  const handleAddConsultation = async (consultation: Consultation) => {
    if (!canPerformClinicalAction(currentUser)) {
      handleAccessDenied('Planification de consultation', `L'utilisateur ${currentUser?.name} (${currentUser?.role}) a tenté de planifier une consultation médicale sans être médecin.`);
      return;
    }

    try {
      const res = await addConsultationMutation.mutateAsync(consultation);
      if (res.success) {
        showToast(`Rendez-vous programmé le ${consultation.dateTime} avec ${consultation.patientName}`);
      } else {
        showToast(`Erreur : ${res.error || 'Impossible de planifier le rendez-vous'}`);
      }
    } catch (e: any) {
      showToast(`Erreur serveur : ${e.message}`);
    }
  };

  // Add a dynamic scan from HTML (Doctor only)
  const handleAddScan = async (scan: MedicalScan) => {
    if (!canPerformClinicalAction(currentUser)) {
      handleAccessDenied('Ajout d\'imagerie médicale', `L'utilisateur ${currentUser?.name} (${currentUser?.role}) a tenté d'ajouter un examen d'imagerie sans être médecin.`);
      return;
    }

    const targetPatient = patients.find((p) => p.id === targetPatientIdForScan) || patients[0];
    try {
      const res = await addScanMutation.mutateAsync({
        patientId: targetPatient.id,
        scan: { ...scan, patientId: targetPatient.id, patientName: targetPatient.name },
      });

      if (res.success) {
        showToast(`Cliché ajouté avec succès au dossier de ${targetPatient.name} : ${scan.title}`);
      } else {
        showToast(`Erreur : ${res.error || 'Impossible d\'ajouter le cliché'}`);
      }
    } catch (e: any) {
      showToast(`Erreur serveur : ${e.message}`);
    }
  };

  // Update findings (Doctor only)
  const handleUpdateFindings = async (scanId: string, findings: string, note: string) => {
    if (!canPerformClinicalAction(currentUser)) {
      handleAccessDenied('Mise à jour de compte-rendu médical', `L'utilisateur ${currentUser?.name} (${currentUser?.role}) a tenté de modifier des conclusions médicales sans être médecin.`);
      return;
    }

    try {
      await updateScanFindingsMutation.mutateAsync({
        scanId,
        findings,
        radiologistNote: note,
      });
      showToast('Compte-rendu médical mis à jour et validé.');
    } catch (e: any) {
      showToast(`Erreur : ${e.message}`);
    }
  };

  // Delete/Cancel prescription (Doctor only)
  const handleDeletePrescription = async (patientId: string, prescriptionId: string) => {
    if (!canPerformClinicalAction(currentUser)) {
      handleAccessDenied('Suppression d\'ordonnance', `L'utilisateur ${currentUser?.name} (${currentUser?.role}) a tenté de supprimer une ordonnance sans être médecin.`);
      return;
    }

    try {
      await deletePrescriptionMutation.mutateAsync({ patientId, prescriptionId });
      showToast('Ordonnance supprimée.');
    } catch (e: any) {
      showToast(`Erreur : ${e.message}`);
    }
  };

  // Delete scan (Doctor only)
  const handleDeleteScan = async (patientId: string, scanId: string) => {
    if (!canPerformClinicalAction(currentUser)) {
      handleAccessDenied('Suppression d\'imagerie médicale', `L'utilisateur ${currentUser?.name} (${currentUser?.role}) a tenté de supprimer un cliché d'imagerie sans être médecin.`);
      return;
    }

    try {
      await deleteScanMutation.mutateAsync({ scanId });
      showToast('Cliché retiré du dossier.');
    } catch (e: any) {
      showToast(`Erreur : ${e.message}`);
    }
  };

  // Cancel consultation (Doctor only)
  const handleCancelConsultation = async (_patientId: string, consultationId: string) => {
    if (!canPerformClinicalAction(currentUser)) {
      handleAccessDenied('Annulation de consultation', `L'utilisateur ${currentUser?.name} (${currentUser?.role}) a tenté d'annuler une consultation sans être médecin.`);
      return;
    }

    try {
      await cancelConsultationMutation.mutateAsync({ consultationId });
      showToast('Consultation annulée avec succès.');
    } catch (e: any) {
      showToast(`Erreur : ${e.message}`);
    }
  };

  // Public Prescription Verification View (accessible without authentication)
  if (verifyId) {
    return (
      <VerifyView
        prescriptionId={verifyId}
        onBackToApp={() => {
          window.history.pushState({}, '', '/');
          setVerifyId(null);
        }}
      />
    );
  }

  // If unauthenticated: display only LoginPage
  if (!currentUser) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-[#111827] flex flex-col font-sans">
      {/* Top Bar with user badge, upcoming consultation alert badge (< 48h), and explicit Logout */}
      <TopBar
        currentUser={currentUser}
        onLogout={logout}
        upcomingConsultationsCount={patientUpcomingAlerts.length}
        upcomingUrgencyLabel={patientUpcomingAlerts[0]?.urgencyBadge}
        onOpenConsultationsTab={() => setRequestedPatientTab('consultations')}
      />

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
        {isLoadingPatients && (
          <div className="p-4 text-center text-xs text-[#6B7280]">
            Chargement sécurisé des dossiers médicaux...
          </div>
        )}

        {/* 1. Interface PATIENT — strictly visible only to PATIENT role */}
        {currentUser.role === 'PATIENT' && patientProfile && (
          <PatientPortal
            patient={patientProfile}
            currentUser={currentUser}
            requestedTab={requestedPatientTab}
            onTabChange={(tab) => setRequestedPatientTab(tab)}
            onOpenScanViewer={(scan) => {
              setFullscreenScan(scan);
              setFullscreenZoom(1);
              setFullscreenContrast(100);
              setFullscreenBrightness(100);
            }}
            onAddConsultation={async (consultation) => {
              try {
                await addConsultationMutation.mutateAsync(consultation);
                showToast('Votre rendez-vous a été confirmé avec succès !');
                return { success: true };
              } catch (err: any) {
                showToast(`Erreur : ${err.message}`);
                return { success: false, error: err.message };
              }
            }}
            onCancelConsultation={async (consultationId) => {
              try {
                await cancelConsultationMutation.mutateAsync({ consultationId });
                showToast('Rendez-vous annulé.');
              } catch (err: any) {
                showToast(`Erreur : ${err.message}`);
              }
            }}
            onAddVitals={async (patientId, vitals) => {
              try {
                await addVitalsMutation.mutateAsync({ patientId, vitals });
                showToast('Nouvelles constantes biométriques enregistrées.');
                return { success: true };
              } catch (err: any) {
                showToast(`Erreur : ${err.message}`);
                return { success: false, error: err.message };
              }
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
              if (window.confirm('Voulez-vous réinitialiser les dossiers cliniques de démonstration ? Le registre d’audit cryptographique reste strictement préservé (WORM).')) {
                await resetDataMutation.mutateAsync();
                showToast('Dossiers cliniques réinitialisés. Registre d’audit cryptographique préservé.');
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
                  {fullscreenScan.modality} · {fullscreenScan.bodyPart} · {fullscreenScan.studyDate} · Appareil : {fullscreenScan.acquisitionDevice}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFullscreenScan(null)}
                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
                title="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative flex-1 bg-black min-h-[480px] flex items-center justify-center overflow-hidden select-none">
              <img
                src={fullscreenScan.imageUrl}
                alt={fullscreenScan.title}
                className="max-h-[70vh] w-auto object-contain transition-transform duration-150"
                style={{
                  transform: `scale(${fullscreenZoom})`,
                  filter: `contrast(${fullscreenContrast}%) brightness(${fullscreenBrightness}%)`,
                }}
              />
            </div>

            <div className="p-3 bg-neutral-950 border-t border-white/10 flex items-center justify-between text-xs text-neutral-300">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFullscreenZoom((z) => Math.max(0.5, z - 0.25))}
                  className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-white flex items-center gap-1"
                >
                  <ZoomOut className="w-3.5 h-3.5" /> -
                </button>
                <span className="font-mono text-[11px] w-12 text-center">{Math.round(fullscreenZoom * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setFullscreenZoom((z) => Math.min(3, z + 0.25))}
                  className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-white flex items-center gap-1"
                >
                  <ZoomIn className="w-3.5 h-3.5" /> +
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFullscreenZoom(1);
                    setFullscreenContrast(100);
                    setFullscreenBrightness(100);
                  }}
                  className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-white flex items-center gap-1 ml-2"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Réinit
                </button>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1 text-[11px]">
                  Contraste :
                  <input
                    type="range"
                    min="50"
                    max="200"
                    value={fullscreenContrast}
                    onChange={(e) => setFullscreenContrast(Number(e.target.value))}
                    className="w-20 accent-[#0D5C58]"
                  />
                </label>
                <label className="flex items-center gap-1 text-[11px]">
                  Luminosité :
                  <input
                    type="range"
                    min="50"
                    max="200"
                    value={fullscreenBrightness}
                    onChange={(e) => setFullscreenBrightness(Number(e.target.value))}
                    className="w-20 accent-[#0D5C58]"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ClinicalCalmApp />
    </AuthProvider>
  );
}
