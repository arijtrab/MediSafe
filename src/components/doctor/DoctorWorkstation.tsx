import React, { useState } from 'react';
import { PatientRecord, MedicalScan, Consultation, PrescriptionItem, PrescriptionResponse, UserProfile } from '../../types/clinical';
import { hasRole } from '../../utils/authorization';
import { DrugSafetyAlertModal } from '../clinical/DrugSafetyAlertModal';
import { PrescriptionSealModal } from '../clinical/PrescriptionSealModal';
import {
  Calendar,
  Users,
  User,
  Eye,
  Plus,
  Pill,
  FileText,
  Search,
  Activity,
  Heart,
  Clock,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  MapPin,
  Image as ImageIcon,
  Trash2,
  XCircle,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

interface DoctorWorkstationProps {
  patients: PatientRecord[];
  currentUser?: UserProfile | null;
  onOpenAddScanModalForPatient: (patientId: string) => void;
  onAddPrescription: (
    patientId: string,
    prescription: Partial<PrescriptionItem> & { override?: boolean; justification?: string }
  ) => Promise<PrescriptionResponse | any> | any;
  onAddConsultation: (consultation: Consultation) => void;
  onUpdateFindings: (scanId: string, findings: string, note: string) => void;
  onLogActivity: (action: string, patientName: string, details: string, category: 'DOSSIER' | 'ORDONNANCE' | 'IMAGERIE' | 'CONSULTATION' | 'EQUIPEMENT' | 'CONNEXION') => void;
  currentDoctorName: string;
  onDeletePrescription?: (patientId: string, prescriptionId: string) => void;
  onDeleteScan?: (patientId: string, scanId: string) => void;
  onCancelConsultation?: (patientId: string, consultationId: string) => void;
}

export const DoctorWorkstation: React.FC<DoctorWorkstationProps> = ({
  patients,
  currentUser,
  onOpenAddScanModalForPatient,
  onAddPrescription,
  onAddConsultation,
  onUpdateFindings,
  onLogActivity,
  currentDoctorName,
  onDeletePrescription,
  onDeleteScan,
  onCancelConsultation,
}) => {
  // RBAC Guard: Only DOCTOR can access DoctorWorkstation
  const isDoctor = !currentUser || hasRole(currentUser, 'DOCTOR');

  if (!isDoctor) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-[#FECACA] shadow-xs text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] mx-auto flex items-center justify-center">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#991B1B]">Accès Non Autorisé (ACCESS_DENIED)</h2>
          <p className="text-xs text-[#6B7280] mt-1 max-w-md mx-auto">
            L'espace Station Médicale est strictement réservé au personnel médical habilité (Rôle : DOCTOR).
          </p>
        </div>
      </div>
    );
  }
  // Only 2 main tabs as requested: Consultations & Dossiers
  const [activeTab, setActiveTab] = useState<'consultations' | 'dossiers'>('consultations');
  const [selectedPatientId, setSelectedPatientId] = useState<string>(patients[0]?.id || '');
  const [searchPatient, setSearchPatient] = useState('');

  // Selected patient object
  const currentPatient = patients.find((p) => p.id === selectedPatientId) || patients[0];

  // Active scan selected inside current patient's dossier for consultation
  const [selectedDossierScan, setSelectedDossierScan] = useState<MedicalScan | null>(
    currentPatient?.scans[0] || null
  );

  // Keep selected scan in sync when changing patient
  React.useEffect(() => {
    setSelectedDossierScan(currentPatient?.scans[0] || null);
  }, [selectedPatientId, currentPatient?.scans]);

  // Integrated Viewer Controls in Dossier
  const [scanZoom, setScanZoom] = useState(1);
  const [scanContrast, setScanContrast] = useState(100);
  const [scanBrightness, setScanBrightness] = useState(100);
  const [scanInvert, setScanInvert] = useState(false);
  const [isEditingScanFindings, setIsEditingScanFindings] = useState(false);
  const [editedFindings, setEditedFindings] = useState('');
  const [editedNote, setEditedNote] = useState('');

  // New Prescription Form State
  const [showAddPrescription, setShowAddPrescription] = useState(false);
  const [newMedication, setNewMedication] = useState('');
  const [newDosage, setNewDosage] = useState('');
  const [newFrequency, setNewFrequency] = useState('');
  const [newDuration, setNewDuration] = useState('');
  const [newInstructions, setNewInstructions] = useState('');

  // Drug Safety & Clinical Contraindication Modal State
  const [safetyAlertModalOpen, setSafetyAlertModalOpen] = useState(false);
  const [pendingPrescriptionData, setPendingPrescriptionData] = useState<any>(null);
  const [safetyConflictData, setSafetyConflictData] = useState<{
    contraindication?: any;
    interaction?: any;
    warnings?: any;
  }>({});
  const [isSubmittingOverride, setIsSubmittingOverride] = useState(false);

  // Prescription Sealing Verification Modal State
  const [selectedPrescriptionForSeal, setSelectedPrescriptionForSeal] = useState<PrescriptionItem | null>(null);
  const [sealModalOpen, setSealModalOpen] = useState(false);

  // New Consultation Form State
  const [showAddConsultation, setShowAddConsultation] = useState(false);
  const [newConsultDateTime, setNewConsultDateTime] = useState('18 Octobre 2026 à 15:00');
  const [newConsultReason, setNewConsultReason] = useState('Contrôle clinique de routine');
  const [newConsultLocation, setNewConsultLocation] = useState('Bâtiment B - Salle 204');

  // All upcoming consultations sorted
  const allConsultations: Consultation[] = patients.flatMap((p) => p.consultations);

  const filteredPatients = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(searchPatient.toLowerCase()) ||
      p.id.toLowerCase().includes(searchPatient.toLowerCase()) ||
      p.bloodType.toLowerCase().includes(searchPatient.toLowerCase())
  );

  const handleCreatePrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMedication.trim() || !currentPatient) return;

    const prescription: Partial<PrescriptionItem> = {
      id: `ORD-${Date.now().toString().slice(-4)}`,
      medication: newMedication.trim(),
      dosage: newDosage || 'Posologie standard',
      frequency: newFrequency || '1 fois par jour',
      duration: newDuration || '1 mois',
      instructions: newInstructions || 'Respecter les heures de prise.',
      prescribedBy: currentDoctorName,
      datePrescribed: new Date().toLocaleDateString('fr-FR'),
      refillsRemaining: 2,
      status: 'ACTIVE',
    };

    const res = await onAddPrescription(currentPatient.id, prescription);

    // Si une contre-indication ou interaction majeure est détectée côté serveur (409)
    if (res && (!res.success || res.code === 'ALLERGY_CONTRAINDICATION' || res.code === 'MAJOR_DRUG_INTERACTION')) {
      if (res.code === 'ALLERGY_CONTRAINDICATION' || res.code === 'MAJOR_DRUG_INTERACTION') {
        setPendingPrescriptionData(prescription);
        setSafetyConflictData({
          contraindication: res.contraindication,
          interaction: res.interaction,
          warnings: res.warnings,
        });
        setSafetyAlertModalOpen(true);
        return;
      }
    }

    onLogActivity(
      'Délivrance d\'ordonnance',
      currentPatient.name,
      `Prescription de ${newMedication} (${newFrequency}) pour ${currentPatient.name}.`,
      'ORDONNANCE'
    );
    setNewMedication('');
    setNewDosage('');
    setNewFrequency('');
    setNewDuration('');
    setNewInstructions('');
    setShowAddPrescription(false);
  };

  const handleConfirmOverride = async (justification: string) => {
    if (!currentPatient || !pendingPrescriptionData) return;
    setIsSubmittingOverride(true);
    try {
      const res = await onAddPrescription(currentPatient.id, {
        ...pendingPrescriptionData,
        override: true,
        justification,
      });

      if (res && res.success) {
        setSafetyAlertModalOpen(false);
        setPendingPrescriptionData(null);
        setNewMedication('');
        setNewDosage('');
        setNewFrequency('');
        setNewDuration('');
        setNewInstructions('');
        setShowAddPrescription(false);
      }
    } finally {
      setIsSubmittingOverride(false);
    }
  };

  const handleCreateConsultation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPatient) return;

    const consultation: Consultation = {
      id: `RDV-${Date.now().toString().slice(-4)}`,
      patientId: currentPatient.id,
      patientName: currentPatient.name,
      doctorName: currentDoctorName,
      specialty: 'Pneumologie & Suivi Clinique',
      dateTime: newConsultDateTime,
      location: newConsultLocation,
      status: 'SCHEDULED',
      reason: newConsultReason,
      preparationInstructions: 'Apporter vos ordonnances en cours et derniers examens.',
    };

    onAddConsultation(consultation);
    onLogActivity(
      'Planification de consultation',
      currentPatient.name,
      `Rendez-vous fixé au ${newConsultDateTime} pour ${currentPatient.name}.`,
      'CONSULTATION'
    );
    setShowAddConsultation(false);
  };

  const handleSaveScanFindings = () => {
    if (!selectedDossierScan) return;
    onUpdateFindings(selectedDossierScan.id, editedFindings, editedNote);
    setSelectedDossierScan({
      ...selectedDossierScan,
      findings: editedFindings,
      radiologistNote: editedNote,
    });
    setIsEditingScanFindings(false);
    onLogActivity(
      'Mise à jour de compte-rendu radiologique',
      currentPatient.name,
      `Validation des observations de l'examen ${selectedDossierScan.title}.`,
      'IMAGERIE'
    );
  };

  return (
    <div className="space-y-6">
      {/* Doctor Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#EFF6FF] border-2 border-[#1E40AF] text-[#1E40AF] flex items-center justify-center font-bold text-2xl shrink-0">
              SC
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-[#1E40AF] bg-[#EFF6FF] px-2.5 py-0.5 rounded-full border border-[#BFDBFE]">
                  Espace Médecin & Consultation
                </span>
                <span className="text-xs text-[#6B7280]">·</span>
                <span className="text-xs text-[#6B7280]">Dr. Sarah Chen (RPPS-10084920491)</span>
              </div>
              <h1 className="text-2xl font-bold text-[#111827]">Station Médicale & Suivi des Patients</h1>
              <p className="text-xs text-[#4B5563] mt-0.5">
                Service de Pneumologie & Radiologie Diagnostique · Hôpital Universitaire
              </p>
            </div>
          </div>
        </div>

        {/* Doctor Tabs (2 Clear Tabs: Consultations and Dossiers) */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-[#F3F4F6]">
          {[
            { id: 'consultations', label: `Liste des Prochaines Consultations (${allConsultations.filter(c => c.status === 'SCHEDULED').length})`, icon: Calendar },
            { id: 'dossiers', label: `Dossiers des Patients (${patients.length} dossiers)`, icon: Users },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`min-h-[42px] px-4 py-2 text-xs font-semibold rounded-lg border transition-all inline-flex items-center gap-2 ${
                  isActive
                    ? 'bg-[#1E40AF] text-white border-[#1E40AF] shadow-xs'
                    : 'bg-white text-[#374151] border-[#E5E7EB] hover:bg-[#F9FAFB] hover:border-[#D1D5DB]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab 1: Liste des Prochaines Consultations */}
      {activeTab === 'consultations' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-[#E5E7EB] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F3F4F6] pb-4">
              <div>
                <h2 className="text-base font-bold text-[#111827] flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#1E40AF]" />
                  Planning des Prochaines Consultations
                </h2>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Consultez la liste des patients programmés et ouvrez directement leurs dossiers médicaux.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddConsultation(true)}
                className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-[#1E40AF] hover:bg-[#1D4ED8] rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                Planifier un Nouveau Rendez-Vous
              </button>
            </div>

            {/* List of Consultations */}
            <div className="space-y-3">
              {allConsultations.map((c) => {
                const isScheduled = c.status === 'SCHEDULED';
                const patientObj = patients.find((p) => p.id === c.patientId);

                return (
                  <div
                    key={c.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isScheduled ? 'bg-white border-[#E5E7EB] hover:border-[#1E40AF]' : 'bg-[#F9FAFB] border-[#E5E7EB] opacity-75'
                    }`}
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isScheduled
                              ? 'bg-[#EFF6FF] text-[#1E40AF] border border-[#BFDBFE]'
                              : 'bg-[#F3F4F6] text-[#6B7280]'
                          }`}
                        >
                          {isScheduled ? 'Programmée' : 'Terminée'}
                        </span>
                        <span className="text-xs text-[#6B7280]">·</span>
                        <span className="text-xs font-semibold text-[#111827]">{c.specialty}</span>
                        {patientObj && (
                          <span className="text-[11px] font-bold text-[#991B1B] bg-[#FEF2F2] px-2 py-0.5 rounded border border-[#FECACA]">
                            {patientObj.bloodType}
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-bold text-[#111827] flex items-center gap-2">
                        <User className="w-4 h-4 text-[#1E40AF]" />
                        {c.patientName}
                      </div>

                      <div className="text-xs text-[#4B5563] flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-[#0D5C58]" />
                        <strong>{c.dateTime}</strong>
                        <span>·</span>
                        <MapPin className="w-3.5 h-3.5 text-[#6B7280]" />
                        <span>{c.location}</span>
                      </div>

                      <div className="text-xs text-[#374151]">
                        <strong>Motif :</strong> {c.reason}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPatientId(c.patientId);
                          setActiveTab('dossiers');
                        }}
                        className="min-h-[40px] px-4 py-2 text-xs font-semibold text-[#1E40AF] bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#BFDBFE] rounded-lg transition-colors inline-flex items-center gap-1.5"
                      >
                        <FileText className="w-4 h-4" />
                        Ouvrir le Dossier Patient
                      </button>
                      {onCancelConsultation && isScheduled && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Annuler le rendez-vous de ${c.patientName} (${c.dateTime}) ?`)) {
                              onCancelConsultation(c.patientId, c.id);
                            }
                          }}
                          title="Annuler ce rendez-vous"
                          className="min-h-[40px] px-3 py-2 text-xs font-semibold text-[#DC2626] bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FECACA] rounded-lg transition-colors inline-flex items-center gap-1"
                        >
                          <XCircle className="w-4 h-4" />
                          Annuler
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* New Consultation Modal */}
          {showAddConsultation && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 animate-fade-in">
              <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xl max-w-md w-full p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
                  <h3 className="text-base font-bold text-[#111827]">Planifier une Consultation</h3>
                  <button type="button" onClick={() => setShowAddConsultation(false)} className="text-[#6B7280]">✕</button>
                </div>

                <form onSubmit={handleCreateConsultation} className="space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-[#111827] mb-1">Patient concerné :</label>
                    <select
                      value={selectedPatientId}
                      onChange={(e) => setSelectedPatientId(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] bg-white text-[#111827]"
                    >
                      {patients.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.bloodType} - {p.age} ans)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#111827] mb-1">Date et heure du rendez-vous :</label>
                    <input
                      type="text"
                      value={newConsultDateTime}
                      onChange={(e) => setNewConsultDateTime(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#111827] mb-1">Motif de consultation :</label>
                    <input
                      type="text"
                      value={newConsultReason}
                      onChange={(e) => setNewConsultReason(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#111827] mb-1">Lieu / Salle :</label>
                    <input
                      type="text"
                      value={newConsultLocation}
                      onChange={(e) => setNewConsultLocation(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
                    <button
                      type="button"
                      onClick={() => setShowAddConsultation(false)}
                      className="px-4 py-2 rounded-lg border border-[#D1D5DB] text-[#374151]"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 font-bold text-white bg-[#1E40AF] hover:bg-[#1D4ED8] rounded-lg"
                    >
                      Enregistrer le Rendez-Vous
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Dossiers des Patients avec Imagerie Médicale Intégrée */}
      {activeTab === 'dossiers' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Patients List Sidebar */}
          <div className="lg:col-span-4 space-y-3">
            <div className="bg-white p-4 rounded-xl border border-[#E5E7EB] space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchPatient}
                  onChange={(e) => setSearchPatient(e.target.value)}
                  placeholder="Rechercher par nom, groupe sanguin..."
                  className="w-full h-10 pl-9 pr-3 text-xs rounded-lg border border-[#D1D5DB] focus:outline-none focus:border-[#1E40AF]"
                />
              </div>

              <div className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider px-1">
                Patients Répertoriés ({filteredPatients.length})
              </div>

              <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
                {filteredPatients.map((p) => {
                  const isSelected = p.id === currentPatient.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPatientId(p.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all text-xs ${
                        isSelected
                          ? 'bg-[#EFF6FF] border-[#1E40AF] shadow-xs ring-1 ring-[#1E40AF]'
                          : 'bg-white border-[#E5E7EB] hover:bg-[#F9FAFB]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-[#111827]">{p.name}</span>
                        <span className="font-bold text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] px-1.5 py-0.2 rounded text-[10px]">
                          {p.bloodType}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#6B7280]">
                        {p.age} ans · {p.scans.length} cliché(s) · {p.prescriptions.filter(x => x.status === 'ACTIVE').length} ordonnance(s)
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Detailed Patient Medical Record */}
          <div className="lg:col-span-8 space-y-5">
            {currentPatient && (
              <div className="bg-white p-6 rounded-xl border border-[#E5E7EB] space-y-6">
                {/* Patient Top Header with Blood Group Badge */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F3F4F6] pb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-[#0D5C58] font-bold">{currentPatient.id}</span>
                      <span className="text-xs text-[#6B7280]">·</span>
                      <span className="text-xs text-[#6B7280]">Né le {currentPatient.birthDate} ({currentPatient.age} ans)</span>
                    </div>
                    <h2 className="text-xl font-bold text-[#111827]">{currentPatient.name}</h2>
                    <p className="text-xs text-[#4B5563] mt-0.5">
                      Poids : {currentPatient.weightKg} kg · Taille : {currentPatient.heightCm} cm · Tél : {currentPatient.phone}
                    </p>
                  </div>

                  {/* Prominent Blood Group */}
                  <div className="bg-[#FEF2F2] border border-[#FECACA] p-3 rounded-xl flex items-center gap-3 shrink-0">
                    <Heart className="w-6 h-6 text-[#991B1B] fill-current" />
                    <div>
                      <div className="text-[10px] font-bold text-[#991B1B] uppercase tracking-wider">
                        Groupe Sanguin
                      </div>
                      <div className="text-base font-bold text-[#991B1B]">{currentPatient.bloodType}</div>
                    </div>
                  </div>
                </div>

                {/* Dynamic Biometrics Bar for Doctor */}
                {currentPatient.latestVitals && (
                  <div className="p-3.5 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#111827] flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-[#0D5C58]" />
                        Constantes Biométriques Récentes ({currentPatient.latestVitals.measuredAt})
                      </span>
                      <span className="text-[11px] text-[#6B7280]">
                        Prises par : {currentPatient.latestVitals.measuredBy || 'Patient'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
                      <div className="p-2 bg-white rounded-lg border border-[#E5E7EB]">
                        <span className="text-[10px] text-[#6B7280] block">FC (Pouls)</span>
                        <span className="font-bold text-[#DC2626]">{currentPatient.latestVitals.heartRate} bpm</span>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-[#E5E7EB]">
                        <span className="text-[10px] text-[#6B7280] block">Tension</span>
                        <span className="font-bold text-[#4F46E5]">{currentPatient.latestVitals.bloodPressureSys}/{currentPatient.latestVitals.bloodPressureDia} mmHg</span>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-[#E5E7EB]">
                        <span className="text-[10px] text-[#6B7280] block">SpO₂</span>
                        <span className="font-bold text-[#0D5C58]">{currentPatient.latestVitals.oxygenSaturation}%</span>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-[#E5E7EB]">
                        <span className="text-[10px] text-[#6B7280] block">Température</span>
                        <span className="font-bold text-[#111827]">{currentPatient.latestVitals.temperature}°C</span>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-[#E5E7EB]">
                        <span className="text-[10px] text-[#6B7280] block">Glycémie</span>
                        <span className="font-bold text-[#111827]">{currentPatient.latestVitals.bloodGlucose ? `${currentPatient.latestVitals.bloodGlucose} g/L` : '-'}</span>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-[#E5E7EB]">
                        <span className="text-[10px] text-[#6B7280] block">Poids</span>
                        <span className="font-bold text-[#111827]">{currentPatient.latestVitals.weightKg || currentPatient.weightKg} kg</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Allergies & Medical History */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Allergies */}
                  <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FECACA] space-y-2">
                    <div className="text-xs font-bold text-[#991B1B] flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-[#991B1B]" />
                      Allergies Médicales Identifiées
                    </div>
                    <ul className="space-y-1 text-xs text-[#991B1B] list-disc list-inside">
                      {currentPatient.allergies.map((a, i) => (
                        <li key={i}><strong>{a}</strong></li>
                      ))}
                    </ul>
                  </div>

                  {/* Medical History */}
                  <div className="p-4 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] space-y-2">
                    <div className="text-xs font-bold text-[#111827] flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-[#0D5C58]" />
                      Antécédents Majeurs
                    </div>
                    <ul className="space-y-1 text-xs text-[#4B5563] list-disc list-inside">
                      {currentPatient.medicalHistory.map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* SECTION 1: IMAGERIE MÉDICALE DU PATIENT (Consultation & Ajout dans le dossier) */}
                <div className="space-y-4 pt-4 border-t border-[#F3F4F6]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-[#111827] flex items-center gap-2">
                        <ImageIcon className="w-5 h-5 text-[#0D5C58]" />
                        Imagerie Médicale du Patient ({currentPatient.scans.length} cliché(s))
                      </h3>
                      <p className="text-xs text-[#6B7280]">
                        Consultez les clichés du patient et ajoutez de nouvelles images à partir de code HTML ou d'URL.
                      </p>
                    </div>

                    {/* Button to Add Medical Imaging directly to THIS patient's dossier */}
                    <button
                      type="button"
                      onClick={() => onOpenAddScanModalForPatient(currentPatient.id)}
                      className="px-4 py-2 text-xs font-bold text-white bg-[#0D5C58] hover:bg-[#0B4E4A] rounded-lg inline-flex items-center gap-2 shadow-xs shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      Ajouter une Imagerie Médicale
                    </button>
                  </div>

                  {/* Scans Thumbnails Selector */}
                  {currentPatient.scans.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {currentPatient.scans.map((scan) => {
                        const isSelected = selectedDossierScan?.id === scan.id;
                        return (
                          <div
                            key={scan.id}
                            onClick={() => {
                              setSelectedDossierScan(scan);
                              setScanZoom(1);
                              setScanContrast(100);
                              setScanBrightness(100);
                              setScanInvert(false);
                            }}
                            className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                              isSelected
                                ? 'bg-[#E6F4F3]/60 border-[#0D5C58] ring-1 ring-[#0D5C58] shadow-xs'
                                : 'bg-white border-[#E5E7EB] hover:bg-[#F9FAFB]'
                            }`}
                          >
                            <div className="w-14 h-14 rounded-lg bg-neutral-900 overflow-hidden shrink-0 border border-[#E5E7EB]">
                              <img
                                src={scan.imageUrl}
                                alt={scan.title}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-[10px] font-bold text-[#0D5C58] uppercase">
                                {scan.modality}
                              </span>
                              <h4 className="text-xs font-bold text-[#111827] truncate mt-0.5">{scan.title}</h4>
                              <p className="text-[11px] text-[#6B7280]">{scan.studyDate.split(' ')[0]}</p>
                            </div>
                            {onDeleteScan && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm(`Supprimer le cliché ${scan.title} du dossier ?`)) {
                                    onDeleteScan(currentPatient.id, scan.id);
                                  }
                                }}
                                title="Supprimer ce cliché"
                                className="p-1.5 text-[#9CA3AF] hover:text-[#DC2626] rounded-md hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-6 rounded-xl border border-dashed border-[#D1D5DB] text-center text-xs text-[#6B7280] bg-[#F9FAFB]">
                      Aucun cliché radiologique n'est actuellement rattaché à ce dossier.
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => onOpenAddScanModalForPatient(currentPatient.id)}
                          className="font-bold text-[#0D5C58] hover:underline"
                        >
                          Cliquez ici pour ajouter une imagerie médicale
                        </button>
                      </div>
                    </div>
                  )}

                  {/* INTEGRATED MEDICAL VIEWER INSIDE THE DOSSIER */}
                  {selectedDossierScan && (
                    <div className="p-4 rounded-xl border border-[#99D3CF] bg-[#F9FAFB] space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E5E7EB] pb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#0D5C58] bg-[#E6F4F3] px-2 py-0.5 rounded">
                              {selectedDossierScan.modality}
                            </span>
                            <span className="text-xs font-bold text-[#111827]">{selectedDossierScan.title}</span>
                          </div>
                          <p className="text-[11px] text-[#6B7280] mt-0.5">
                            Région : {selectedDossierScan.bodyPart} · Date : {selectedDossierScan.studyDate} · Appareil : {selectedDossierScan.acquisitionDevice}
                          </p>
                        </div>

                        {/* Viewer Adjustment Affordances */}
                        <div className="flex items-center gap-1.5 text-xs">
                          <button
                            type="button"
                            onClick={() => setScanZoom(Math.max(0.8, scanZoom - 0.2))}
                            className="p-1.5 rounded bg-white border border-[#D1D5DB] hover:bg-[#F3F4F6]"
                            title="Zoom Arrière"
                          >
                            <ZoomOut className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[11px] font-mono w-10 text-center">
                            {Math.round(scanZoom * 100)}%
                          </span>
                          <button
                            type="button"
                            onClick={() => setScanZoom(Math.min(2.5, scanZoom + 0.2))}
                            className="p-1.5 rounded bg-white border border-[#D1D5DB] hover:bg-[#F3F4F6]"
                            title="Zoom Avant"
                          >
                            <ZoomIn className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setScanInvert(!scanInvert)}
                            className={`px-2 py-1 text-[11px] font-semibold rounded border ${
                              scanInvert ? 'bg-[#0D5C58] text-white border-[#0D5C58]' : 'bg-white border-[#D1D5DB]'
                            }`}
                          >
                            Inverser N&B
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setScanZoom(1);
                              setScanContrast(100);
                              setScanBrightness(100);
                              setScanInvert(false);
                            }}
                            className="p-1.5 rounded bg-white border border-[#D1D5DB] hover:bg-[#F3F4F6]"
                            title="Réinitialiser"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Display Viewport */}
                      <div className="relative bg-black w-full min-h-[360px] rounded-lg overflow-hidden flex items-center justify-center p-2">
                        <div
                          className="flex items-center justify-center w-full h-full transition-transform duration-100"
                          style={{ transform: `scale(${scanZoom})` }}
                        >
                          <img
                            src={selectedDossierScan.imageUrl}
                            alt={selectedDossierScan.title}
                            className="max-h-[340px] max-w-full object-contain pointer-events-none"
                            style={{
                              filter: `contrast(${scanContrast}%) brightness(${scanBrightness}%) ${scanInvert ? 'invert(1)' : ''}`,
                            }}
                            referrerPolicy="no-referrer"
                          />
                        </div>

                        <div className="absolute top-2 left-2 bg-black/70 text-white text-[10px] px-2 py-1 rounded">
                          {selectedDossierScan.bodyPart} · {currentPatient.name}
                        </div>
                      </div>

                      {/* Slider controls */}
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-[#6B7280] text-[11px] w-16">Contraste :</span>
                          <input
                            type="range"
                            min="50"
                            max="200"
                            value={scanContrast}
                            onChange={(e) => setScanContrast(Number(e.target.value))}
                            className="w-full accent-[#0D5C58]"
                          />
                          <span className="font-mono text-[11px] w-8 text-right">{scanContrast}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[#6B7280] text-[11px] w-16">Luminosité :</span>
                          <input
                            type="range"
                            min="50"
                            max="200"
                            value={scanBrightness}
                            onChange={(e) => setScanBrightness(Number(e.target.value))}
                            className="w-full accent-[#0D5C58]"
                          />
                          <span className="font-mono text-[11px] w-8 text-right">{scanBrightness}%</span>
                        </div>
                      </div>

                      {/* Medical Findings Card & Note update */}
                      <div className="p-3.5 rounded-lg bg-white border border-[#E5E7EB] space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#111827]">Conclusions Médicales :</span>
                          {!isEditingScanFindings ? (
                            <button
                              type="button"
                              onClick={() => {
                                setEditedFindings(selectedDossierScan.findings);
                                setEditedNote(selectedDossierScan.radiologistNote);
                                setIsEditingScanFindings(true);
                              }}
                              className="text-[#1E40AF] hover:underline font-semibold text-[11px]"
                            >
                              Modifier les conclusions
                            </button>
                          ) : null}
                        </div>

                        {!isEditingScanFindings ? (
                          <>
                            <p className="text-[#374151] leading-relaxed">{selectedDossierScan.findings}</p>
                            <p className="text-[11px] text-[#6B7280] italic">
                              Recommandation : {selectedDossierScan.radiologistNote}
                            </p>
                          </>
                        ) : (
                          <div className="space-y-2 pt-1">
                            <textarea
                              value={editedFindings}
                              onChange={(e) => setEditedFindings(e.target.value)}
                              rows={3}
                              className="w-full p-2 text-xs rounded border border-[#D1D5DB]"
                              placeholder="Conclusions..."
                            />
                            <input
                              type="text"
                              value={editedNote}
                              onChange={(e) => setEditedNote(e.target.value)}
                              className="w-full h-9 px-2 text-xs rounded border border-[#D1D5DB]"
                              placeholder="Recommandation / conduite à tenir..."
                            />
                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setIsEditingScanFindings(false)}
                                className="px-3 py-1 text-xs border rounded"
                              >
                                Annuler
                              </button>
                              <button
                                type="button"
                                onClick={handleSaveScanFindings}
                                className="px-3 py-1 text-xs font-bold text-white bg-[#0D5C58] rounded"
                              >
                                Enregistrer
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* SECTION 2: ORDONNANCES DU PATIENT */}
                <div className="space-y-3 pt-4 border-t border-[#F3F4F6]">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-[#111827] flex items-center gap-2">
                      <Pill className="w-5 h-5 text-[#0D5C58]" />
                      Ordonnances Actives du Patient ({currentPatient.prescriptions.filter(p => p.status === 'ACTIVE').length})
                    </h3>

                    <button
                      type="button"
                      onClick={() => setShowAddPrescription(true)}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-[#0D5C58] hover:bg-[#0B4E4A] rounded-lg inline-flex items-center gap-1 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Rédiger une Nouvelle Ordonnance
                    </button>
                  </div>

                  <div className="space-y-2">
                    {currentPatient.prescriptions.map((p) => (
                      <div
                        key={p.id}
                        className="p-3.5 rounded-lg border border-[#E5E7EB] bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                      >
                        <div>
                          <div className="font-bold text-[#111827]">{p.medication}</div>
                          <div className="text-[#0D5C58] font-medium">{p.frequency} · {p.duration}</div>
                          <div className="text-[11px] text-[#6B7280]">Conseils : {p.instructions}</div>
                        </div>

                        <div className="shrink-0 flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPrescriptionForSeal(p);
                              setSealModalOpen(true);
                            }}
                            title="Consulter le scellement d'intégrité SHA-256"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-[#0D5C58] bg-[#E6F4F3] hover:bg-[#D1ECE9] rounded-lg border border-[#B2E2DF] transition-colors"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-[#065F46]" />
                            Scellement
                          </button>

                          <div className="text-right">
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                p.status === 'ACTIVE' ? 'bg-[#ECFDF5] text-[#065F46]' : 'bg-[#F3F4F6] text-[#6B7280]'
                              }`}
                            >
                              {p.status === 'ACTIVE' ? 'En cours' : 'Terminé'}
                            </span>
                            <div className="text-[10px] text-[#6B7280] mt-1">{p.datePrescribed}</div>
                          </div>
                          {onDeletePrescription && (
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Supprimer la prescription de ${p.medication} ?`)) {
                                  onDeletePrescription(currentPatient.id, p.id);
                                }
                              }}
                              title="Supprimer cette ordonnance"
                              className="p-1.5 text-[#9CA3AF] hover:text-[#DC2626] rounded-md hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* New Prescription Form Modal */}
          {showAddPrescription && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 animate-fade-in">
              <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xl max-w-lg w-full p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
                  <h3 className="text-base font-bold text-[#111827]">
                    Rédiger une Nouvelle Ordonnance pour {currentPatient.name}
                  </h3>
                  <button type="button" onClick={() => setShowAddPrescription(false)} className="text-[#6B7280]">✕</button>
                </div>

                <form onSubmit={handleCreatePrescription} className="space-y-3 text-xs">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-semibold text-[#111827]">Médicament (DCI ou Nom commercial) :</label>
                      <span className="text-[10px] text-[#6B7280]">Aide à la prescription</span>
                    </div>
                    <input
                      type="text"
                      required
                      value={newMedication}
                      onChange={(e) => setNewMedication(e.target.value)}
                      placeholder="Ex: Amoxicilline 1g, Clamoxyl, Ventoline 100µg..."
                      className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB] focus:ring-2 focus:ring-[#0D5C58] focus:border-transparent"
                    />

                    {/* Suggestions rapides */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="text-[10px] text-[#6B7280] self-center mr-1">Suggestions :</span>
                      {['Paracétamol 1g', 'Amoxicilline 1g', 'Ventoline 100µg', 'Augmentin 1g', 'Symbicort 200/6µg', 'Propranolol 40mg'].map((sug) => (
                        <button
                          key={sug}
                          type="button"
                          onClick={() => setNewMedication(sug)}
                          className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>

                    {/* Alerte prédictive en direct si allergie connue */}
                    {newMedication.trim().length >= 3 && currentPatient.allergies?.some((a) => {
                      const cleanMed = newMedication.toLowerCase();
                      const cleanAllergy = a.toLowerCase();
                      if (cleanAllergy.includes('penicilline') && (cleanMed.includes('amox') || cleanMed.includes('clamoxyl') || cleanMed.includes('augmentin') || cleanMed.includes('penicilline'))) return true;
                      if (cleanAllergy.includes('aspirine') && (cleanMed.includes('aspirin') || cleanMed.includes('kardegic') || cleanMed.includes('ibuprofen') || cleanMed.includes('advil'))) return true;
                      return false;
                    }) && (
                      <div className="mt-2 p-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[11px] flex items-center gap-1.5">
                        <span className="font-bold">⚠️ Alerte allergie en direct :</span>
                        <span>Correspondance avec les allergies du patient. Un motif clinique (override) sera requis.</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-[#111827] mb-1">Dosage :</label>
                      <input
                        type="text"
                        value={newDosage}
                        onChange={(e) => setNewDosage(e.target.value)}
                        placeholder="Ex: 500 mg, 1 gélule..."
                        className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB]"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-[#111827] mb-1">Fréquence / Prise :</label>
                      <input
                        type="text"
                        value={newFrequency}
                        onChange={(e) => setNewFrequency(e.target.value)}
                        placeholder="Ex: 1 matin et soir au repas..."
                        className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#111827] mb-1">Durée du traitement :</label>
                    <input
                      type="text"
                      value={newDuration}
                      onChange={(e) => setNewDuration(e.target.value)}
                      placeholder="Ex: 7 jours, 3 mois renouvelables..."
                      className="w-full h-10 px-3 rounded-lg border border-[#D1D5DB]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#111827] mb-1">Consignes médicales spécifiques :</label>
                    <textarea
                      value={newInstructions}
                      onChange={(e) => setNewInstructions(e.target.value)}
                      rows={2}
                      placeholder="Ex: Ne pas interrompre sans avis médical, prise à distance des repas..."
                      className="w-full p-2.5 rounded-lg border border-[#D1D5DB]"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E5E7EB]">
                    <button
                      type="button"
                      onClick={() => setShowAddPrescription(false)}
                      className="px-4 py-2 rounded-lg border border-[#D1D5DB] text-[#374151]"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 font-bold text-white bg-[#0D5C58] hover:bg-[#0B4E4A] rounded-lg"
                    >
                      Délivrer & Signer l'Ordonnance
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal d'Alerte Sécurité Clinique & Contre-Indication Bloquante */}
      <DrugSafetyAlertModal
        isOpen={safetyAlertModalOpen}
        onClose={() => setSafetyAlertModalOpen(false)}
        contraindication={safetyConflictData.contraindication}
        interaction={safetyConflictData.interaction}
        warnings={safetyConflictData.warnings}
        onConfirmOverride={handleConfirmOverride}
        isSubmitting={isSubmittingOverride}
      />

      {/* Modal de Scellement d'Intégrité SHA-256 (QR Code & Vérification) */}
      <PrescriptionSealModal
        isOpen={sealModalOpen}
        onClose={() => setSealModalOpen(false)}
        prescription={selectedPrescriptionForSeal}
        patientName={currentPatient?.name}
      />
    </div>
  );
};
