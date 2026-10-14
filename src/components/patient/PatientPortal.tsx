import React, { useState, useMemo } from 'react';
import {
  PatientRecord,
  MedicalScan,
  PrescriptionItem,
  UserProfile,
  Consultation,
  PatientVitals,
  DoctorProfile,
  DoctorSlot,
} from '../../types/clinical';
import { canAccessPatientRecord } from '../../utils/authorization';
import { PrescriptionSealModal } from '../clinical/PrescriptionSealModal';
import { PrescriptionPrintModal } from '../clinical/PrescriptionPrintModal';
import { BiometricCharts } from '../clinical/BiometricCharts';
import { useDoctors } from '../../hooks/useClinicalData';
import { getUpcomingConsultationsAlerts, UpcomingConsultationAlert } from '../../utils/consultationAlert';
import {
  Heart,
  User,
  Calendar,
  FileText,
  Pill,
  Activity,
  AlertTriangle,
  Clock,
  Printer,
  Eye,
  MapPin,
  Info,
  ShieldAlert,
  ShieldCheck,
  Stethoscope,
  Plus,
  Thermometer,
  Gauge,
  Droplets,
  Wind,
  Smile,
  CheckCircle2,
  Search,
  Filter,
  Phone,
  Mail,
  ChevronRight,
  Trash2,
  CalendarCheck,
  History,
  CalendarClock,
  Bell,
} from 'lucide-react';

interface PatientPortalProps {
  patient: PatientRecord;
  currentUser?: UserProfile | null;
  onOpenScanViewer: (scan: MedicalScan) => void;
  onAddConsultation?: (consultation: Consultation) => Promise<{ success: boolean; error?: string }>;
  onCancelConsultation?: (consultationId: string) => Promise<void>;
  onAddVitals?: (patientId: string, vitals: Partial<PatientVitals>) => Promise<{ success: boolean; error?: string }>;
  requestedTab?: 'constantes' | 'medecins' | 'consultations' | 'dossier' | 'ordonnances' | null;
  onTabChange?: (tab: 'constantes' | 'medecins' | 'consultations' | 'dossier' | 'ordonnances') => void;
}

export const PatientPortal: React.FC<PatientPortalProps> = ({
  patient,
  currentUser,
  onOpenScanViewer,
  onAddConsultation,
  onCancelConsultation,
  onAddVitals,
  requestedTab,
  onTabChange,
}) => {
  const [activeTab, setActiveTab] = useState<'constantes' | 'medecins' | 'consultations' | 'dossier' | 'ordonnances'>('constantes');

  const handleSelectTab = (tab: 'constantes' | 'medecins' | 'consultations' | 'dossier' | 'ordonnances') => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  // Synchronize when parent explicitly requests a specific tab (e.g. from TopBar alert badge click)
  React.useEffect(() => {
    if (requestedTab) {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);

  // Compute upcoming consultation alerts (< 48h)
  const upcomingAlerts = useMemo(() => {
    return getUpcomingConsultationsAlerts(patient.consultations || []);
  }, [patient.consultations]);

  const nearestAlert = upcomingAlerts[0] || null;

  const [selectedScan, setSelectedScan] = useState<MedicalScan | null>(patient.scans[0] || null);
  const [selectedPrescriptionForPrint, setSelectedPrescriptionForPrint] = useState<PrescriptionItem | null>(null);
  const [selectedPrescriptionForSeal, setSelectedPrescriptionForSeal] = useState<PrescriptionItem | null>(null);

  // Doctors & Booking State
  const { data: doctors = [], isLoading: isLoadingDoctors } = useDoctors(Boolean(currentUser));
  const [selectedSpecialtyFilter, setSelectedSpecialtyFilter] = useState<string>('TOUS');
  const [doctorSearchQuery, setDoctorSearchQuery] = useState<string>('');
  const [bookingDoctor, setBookingDoctor] = useState<DoctorProfile | null>(null);
  const [bookingSlot, setBookingSlot] = useState<DoctorSlot | null>(null);
  const [bookingReason, setBookingReason] = useState<string>('Consultation de contrôle & bilan général');
  const [bookingNotes, setBookingNotes] = useState<string>('');
  const [isBookingSubmitting, setIsBookingSubmitting] = useState<boolean>(false);
  const [bookingSuccessModal, setBookingSuccessModal] = useState<boolean>(false);

  // Vitals Entry Modal State
  const [isVitalsModalOpen, setIsVitalsModalOpen] = useState<boolean>(false);
  const [isSubmittingVitals, setIsSubmittingVitals] = useState<boolean>(false);
  const [formHeartRate, setFormHeartRate] = useState<string>('72');
  const [formBpSys, setFormBpSys] = useState<string>('120');
  const [formBpDia, setFormBpDia] = useState<string>('80');
  const [formSpo2, setFormSpo2] = useState<string>('98.5');
  const [formTemperature, setFormTemperature] = useState<string>('36.8');
  const [formGlucose, setFormGlucose] = useState<string>('0.95');
  const [formRespRate, setFormRespRate] = useState<string>('16');
  const [formWeight, setFormWeight] = useState<string>(String(patient.weightKg || 65));
  const [formHeight, setFormHeight] = useState<string>(String(patient.heightCm || 170));
  const [formPainLevel, setFormPainLevel] = useState<string>('0');
  const [formNotes, setFormNotes] = useState<string>('Prise au repos le matin');
  const [formVitalsError, setFormVitalsError] = useState<string | null>(null);

  // Consultation cancellation confirm modal
  const [cancelingConsultationId, setCancelingConsultationId] = useState<string | null>(null);

  // Filtered doctors list
  const filteredDoctors = useMemo(() => {
    return doctors.filter((doc) => {
      const matchesSpecialty =
        selectedSpecialtyFilter === 'TOUS' ||
        doc.specialty.toLowerCase().includes(selectedSpecialtyFilter.toLowerCase());
      const matchesQuery =
        !doctorSearchQuery.trim() ||
        doc.name.toLowerCase().includes(doctorSearchQuery.toLowerCase()) ||
        doc.specialty.toLowerCase().includes(doctorSearchQuery.toLowerCase()) ||
        doc.department.toLowerCase().includes(doctorSearchQuery.toLowerCase());
      return matchesSpecialty && matchesQuery;
    });
  }, [doctors, selectedSpecialtyFilter, doctorSearchQuery]);

  // Unique specialties for filter pills
  const availableSpecialties = useMemo(() => {
    const set = new Set<string>();
    doctors.forEach((d) => {
      if (d.specialty) set.add(d.specialty.split('&')[0].trim());
    });
    return Array.from(set);
  }, [doctors]);

  // RBAC Guard
  const isAuthorized = !currentUser || canAccessPatientRecord(currentUser, patient.id, patient.name);

  if (!isAuthorized) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-[#FECACA] shadow-xs text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] mx-auto flex items-center justify-center">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#991B1B]">Accès Non Autorisé (ACCESS_DENIED)</h2>
          <p className="text-xs text-[#6B7280] mt-1 max-w-md mx-auto">
            Votre compte patient ({currentUser?.name}) n'est pas autorisé à consulter le dossier médical d'un autre patient ({patient.name}).
          </p>
        </div>
      </div>
    );
  }

  // Active or latest vitals for current patient
  const vitalsList: PatientVitals[] = patient.vitals || [];
  const latestVitals: PatientVitals | null =
    patient.latestVitals || (vitalsList.length > 0 ? vitalsList[0] : null);

  // Current weight and height (from latest vitals or patient profile)
  const currentWeight = latestVitals?.weightKg || patient.weightKg || 65;
  const currentHeight = latestVitals?.heightCm || patient.heightCm || 170;
  const heightMeters = currentHeight / 100;
  const imc = (currentWeight / (heightMeters * heightMeters)).toFixed(1);

  // Form IMC calculation preview
  const formHeightMeters = parseFloat(formHeight) > 0 ? parseFloat(formHeight) / 100 : 1.7;
  const formComputedImc =
    parseFloat(formWeight) > 0 && formHeightMeters > 0
      ? (parseFloat(formWeight) / (formHeightMeters * formHeightMeters)).toFixed(1)
      : '22.0';

  // Handle vitals form submission
  const handleSaveVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormVitalsError(null);

    const hr = parseInt(formHeartRate, 10);
    const bpS = parseInt(formBpSys, 10);
    const bpD = parseInt(formBpDia, 10);
    const spo2 = parseFloat(formSpo2);
    const temp = parseFloat(formTemperature);
    const glu = parseFloat(formGlucose);
    const rr = parseInt(formRespRate, 10);
    const w = parseFloat(formWeight);
    const h = parseFloat(formHeight);
    const pain = parseInt(formPainLevel, 10);

    if (isNaN(hr) || hr < 30 || hr > 240) {
      setFormVitalsError('Fréquence cardiaque invalide (valeur attendue entre 30 et 240 bpm).');
      return;
    }
    if (isNaN(bpS) || isNaN(bpD) || bpS < 60 || bpS > 260 || bpD < 40 || bpD > 160) {
      setFormVitalsError('Pression artérielle invalide (valeurs attendues : systole 60-260, diastole 40-160 mmHg).');
      return;
    }
    if (isNaN(spo2) || spo2 < 50 || spo2 > 100) {
      setFormVitalsError('Saturation SpO2 invalide (valeur attendue entre 50% et 100%).');
      return;
    }
    if (isNaN(temp) || temp < 30 || temp > 45) {
      setFormVitalsError('Température corporelle invalide (valeur attendue entre 30°C et 45°C).');
      return;
    }

    setIsSubmittingVitals(true);
    try {
      const now = new Date();
      const dateFormatted =
        now.toLocaleDateString('fr-FR') + ' à ' + now.toLocaleTimeString('fr-FR').slice(0, 5);

      if (onAddVitals) {
        await onAddVitals(patient.id, {
          heartRate: hr,
          bloodPressureSys: bpS,
          bloodPressureDia: bpD,
          oxygenSaturation: spo2,
          temperature: temp,
          bloodGlucose: isNaN(glu) ? undefined : glu,
          respiratoryRate: isNaN(rr) ? undefined : rr,
          weightKg: isNaN(w) ? undefined : w,
          heightCm: isNaN(h) ? undefined : h,
          painLevel: isNaN(pain) ? 0 : pain,
          measuredAt: dateFormatted,
          measuredBy: `${patient.name} (Automesure connectée)`,
          notes: formNotes.trim() || undefined,
        });
      }
      setIsVitalsModalOpen(false);
    } catch (err: any) {
      setFormVitalsError(err.message || "Erreur lors de l'enregistrement des constantes.");
    } finally {
      setIsSubmittingVitals(false);
    }
  };

  // Handle appointment booking submission
  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingDoctor || !bookingSlot) return;

    setIsBookingSubmitting(true);
    try {
      const newConsultation: Consultation = {
        id: `RDV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        patientId: patient.id,
        patientName: patient.name,
        doctorName: bookingDoctor.name,
        specialty: bookingDoctor.specialty,
        dateTime: bookingSlot.dateTime,
        location: bookingDoctor.location,
        status: 'SCHEDULED',
        reason: bookingReason.trim() || 'Consultation médicale',
        preparationInstructions: 'Se présenter 15 minutes avant l’horaire fixé avec votre carte vitale et vos ordonnances.',
        notes: bookingNotes.trim() || undefined,
      };

      if (onAddConsultation) {
        await onAddConsultation(newConsultation);
      }
      setBookingDoctor(null);
      setBookingSlot(null);
      setBookingNotes('');
      setBookingSuccessModal(true);
      setActiveTab('consultations');
    } catch (err: any) {
      alert(`Erreur de réservation : ${err.message}`);
    } finally {
      setIsBookingSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ⚠️ Visual Notification Alert Banner for Upcoming Consultations (< 48h) */}
      {upcomingAlerts.length > 0 && nearestAlert && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-2 border-amber-400 bg-white rounded-2xl p-4 sm:p-5 shadow-xs relative overflow-hidden animate-fade-in">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs animate-pulse">
                <CalendarClock className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 text-[11px] font-extrabold bg-amber-500 text-white rounded-full uppercase tracking-wider inline-flex items-center gap-1.5 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                    Alerte : Consultation dans moins de 48h
                  </span>
                  <span className="text-xs font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md">
                    {nearestAlert.formattedTimeLeft}
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Rendez-vous médical avec {nearestAlert.consultation.doctorName} ({nearestAlert.consultation.specialty})
                </h3>
                <div className="text-xs text-slate-700 flex items-center gap-3 flex-wrap">
                  <span className="font-semibold flex items-center gap-1 text-slate-900">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    {nearestAlert.consultation.dateTime}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span className="flex items-center gap-1 text-slate-600">
                    <MapPin className="w-3.5 h-3.5 text-amber-600" />
                    {nearestAlert.consultation.location}
                  </span>
                </div>
                {nearestAlert.consultation.preparationInstructions && (
                  <p className="text-[11px] text-amber-900 bg-amber-50/80 p-2 rounded-lg border border-amber-200 mt-1 max-w-2xl">
                    <strong className="text-amber-950">Consignes de préparation : </strong>
                    {nearestAlert.consultation.preparationInstructions}
                  </p>
                )}
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('consultations')}
                className="w-full sm:w-auto px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow-xs transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Voir les détails du RDV</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patient Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#E6F4F3] border-2 border-[#0D5C58] text-[#0D5C58] flex items-center justify-center font-bold text-2xl shrink-0 uppercase">
              {patient.name.split(' ').map((n) => n[0]).join('')}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-semibold text-[#0D5C58] bg-[#E6F4F3] px-2.5 py-0.5 rounded-full border border-[#99D3CF]">
                  Espace Patient Personnel
                </span>
                {upcomingAlerts.length > 0 && nearestAlert && (
                  <button
                    type="button"
                    onClick={() => handleSelectTab('consultations')}
                    className="text-xs font-bold text-amber-950 bg-amber-400 hover:bg-amber-300 px-3 py-0.5 rounded-full border border-amber-500 inline-flex items-center gap-1.5 shadow-xs animate-pulse cursor-pointer transition-all"
                    title={`Rendez-vous médical prévu sous 48h (${nearestAlert.formattedTimeLeft}). Cliquez pour afficher.`}
                  >
                    <Bell className="w-3.5 h-3.5 fill-current text-amber-900" />
                    <span>RDV &lt; 48h : {nearestAlert.urgencyBadge}</span>
                  </button>
                )}
                <span className="text-xs text-[#6B7280]">·</span>
                <span className="text-xs text-[#6B7280]">Identifiant : {patient.id}</span>
                <span className="text-xs text-[#6B7280]">·</span>
                <span className="text-xs text-[#6B7280]">N° Sécurité Sociale : {patient.socialSecurityNumber}</span>
              </div>
              <h1 className="text-2xl font-bold text-[#111827] capitalize">{patient.name}</h1>
              <p className="text-xs text-[#4B5563] mt-0.5">
                Né(e) le {patient.birthDate} ({patient.age} ans) · Médecin référent : {patient.referringDoctor}
              </p>
            </div>
          </div>

          {/* Blood Type & Quick Booking Action */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => handleSelectTab('medecins')}
              className="min-h-[44px] px-4 py-2 bg-[#0D5C58] text-white hover:bg-[#0B4E4A] font-semibold text-xs rounded-xl shadow-xs transition-all inline-flex items-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              Prendre Rendez-Vous
            </button>

            <div className="bg-[#FEF2F2] border border-[#FECACA] p-3 rounded-xl flex items-center gap-2.5 shadow-xs">
              <div className="w-9 h-9 rounded-full bg-[#991B1B] text-white flex items-center justify-center font-bold text-xs shrink-0">
                <Heart className="w-4 h-4 fill-current" />
              </div>
              <div>
                <div className="text-[10px] font-semibold text-[#991B1B] uppercase tracking-wider">
                  Groupe Sanguin
                </div>
                <div className="text-sm font-bold text-[#991B1B]">{patient.bloodType}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-[#F3F4F6]">
          {[
            { id: 'constantes', label: 'Constantes & Biométrie', icon: Activity },
            { id: 'medecins', label: `Annuaire Médecins & Prise de RDV (${doctors.length})`, icon: Stethoscope },
            {
              id: 'consultations',
              label: `Mes Rendez-Vous (${patient.consultations.filter((c) => c.status === 'SCHEDULED').length})`,
              icon: Calendar,
              hasAlert: upcomingAlerts.length > 0,
              alertCount: upcomingAlerts.length,
            },
            { id: 'dossier', label: `Dossier Médical & Examens (${patient.scans.length})`, icon: FileText },
            { id: 'ordonnances', label: `Ordonnances (${patient.prescriptions.filter((p) => p.status === 'ACTIVE').length} actives)`, icon: Pill },
          ].map((tab: any) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelectTab(tab.id)}
                className={`min-h-[42px] px-4 py-2 text-xs font-semibold rounded-lg border transition-all inline-flex items-center gap-2 ${
                  isActive
                    ? 'bg-[#0D5C58] text-white border-[#0D5C58] shadow-xs'
                    : 'bg-white text-[#374151] border-[#E5E7EB] hover:bg-[#F9FAFB] hover:border-[#D1D5DB]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.hasAlert && (
                  <span className="px-2 py-0.5 text-[10px] font-extrabold bg-amber-500 text-white rounded-full animate-pulse shadow-2xs">
                    RDV &lt; 48h
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CONSTANTES & BIOMÉTRIE DYNAMIQUES */}
      {/* ========================================================================= */}
      {activeTab === 'constantes' && (
        <div className="space-y-6">
          {/* Top Banner with Actions */}
          <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-pulse"></span>
                <h2 className="text-base font-bold text-[#111827]">
                  Constantes Biométriques Personnalisées de {patient.name}
                </h2>
              </div>
              <p className="text-xs text-[#6B7280] mt-1">
                {latestVitals
                  ? `Dernière prise de mesures le ${latestVitals.measuredAt} par ${latestVitals.measuredBy || 'Patient'}`
                  : 'Aucune mesure biométrique enregistrée pour le moment.'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                if (latestVitals) {
                  setFormHeartRate(String(latestVitals.heartRate || 72));
                  setFormBpSys(String(latestVitals.bloodPressureSys || 120));
                  setFormBpDia(String(latestVitals.bloodPressureDia || 80));
                  setFormSpo2(String(latestVitals.oxygenSaturation || 98.5));
                  setFormTemperature(String(latestVitals.temperature || 36.8));
                  setFormGlucose(String(latestVitals.bloodGlucose || 0.95));
                  setFormRespRate(String(latestVitals.respiratoryRate || 16));
                  setFormWeight(String(latestVitals.weightKg || patient.weightKg || 65));
                  setFormHeight(String(latestVitals.heightCm || patient.heightCm || 170));
                  setFormPainLevel(String(latestVitals.painLevel || 0));
                }
                setFormVitalsError(null);
                setIsVitalsModalOpen(true);
              }}
              className="min-h-[42px] px-4 py-2 bg-[#0D5C58] hover:bg-[#0B4E4A] text-white text-xs font-bold rounded-xl shadow-xs transition-colors inline-flex items-center justify-center gap-2 shrink-0"
            >
              <Plus className="w-4 h-4" />
              Nouvelle Saisie des Constantes
            </button>
          </div>

          {/* 🔔 Home Page Consultation Alert Widget (< 48h) */}
          {upcomingAlerts.length > 0 && nearestAlert && (
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-50 to-white border-2 border-amber-400/80 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs animate-bounce">
                  <CalendarClock className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 text-[11px] font-extrabold bg-amber-600 text-white rounded-full uppercase tracking-wider inline-flex items-center gap-1.5 shadow-2xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                      Alerte : Consultation dans moins de 48h
                    </span>
                    <span className="text-xs font-bold text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md">
                      {nearestAlert.formattedTimeLeft}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Rappel : Consultation avec {nearestAlert.consultation.doctorName} ({nearestAlert.consultation.specialty})
                  </h4>
                  <p className="text-xs text-slate-600 flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1 font-semibold text-slate-900">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      {nearestAlert.consultation.dateTime}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-amber-600" />
                      {nearestAlert.consultation.location}
                    </span>
                  </p>
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectTab('consultations')}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs transition-colors inline-flex items-center gap-2 cursor-pointer"
                >
                  <span>Gérer mon rendez-vous</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Vitals Grid Gauges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Fréquence Cardiaque */}
            <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs relative overflow-hidden space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                  Rythme Cardiaque
                </span>
                <div className="w-8 h-8 rounded-lg bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center">
                  <Heart className="w-4 h-4 fill-current animate-pulse" />
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold text-[#111827]">
                    {latestVitals?.heartRate ?? 72}
                  </span>
                  <span className="text-xs font-semibold text-[#6B7280]">bpm</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-[#065F46] bg-[#ECFDF5] px-2 py-0.5 rounded-full border border-[#A7F3D0]">
                    60 - 100 bpm (Normal)
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-[#6B7280] pt-1 border-t border-[#F3F4F6]">
                Rythme sinusal régulier mesuré au repos.
              </p>
            </div>

            {/* 2. Pression Artérielle */}
            <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs relative overflow-hidden space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                  Tension Artérielle
                </span>
                <div className="w-8 h-8 rounded-lg bg-[#E0E7FF] text-[#4F46E5] flex items-center justify-center">
                  <Gauge className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold text-[#111827]">
                    {latestVitals?.bloodPressureSys ?? 118}/{latestVitals?.bloodPressureDia ?? 76}
                  </span>
                  <span className="text-xs font-semibold text-[#6B7280]">mmHg</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-[#065F46] bg-[#ECFDF5] px-2 py-0.5 rounded-full border border-[#A7F3D0]">
                    Pression Optimale (&lt; 120/80)
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-[#6B7280] pt-1 border-t border-[#F3F4F6]">
                Systolique : {latestVitals?.bloodPressureSys ?? 118} · Diastolique : {latestVitals?.bloodPressureDia ?? 76}
              </p>
            </div>

            {/* 3. Saturation en Oxygène (SpO2) */}
            <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs relative overflow-hidden space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                  Saturation O₂ (SpO2)
                </span>
                <div className="w-8 h-8 rounded-lg bg-[#E6F4F3] text-[#0D5C58] flex items-center justify-center">
                  <Wind className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold text-[#0D5C58]">
                    {latestVitals?.oxygenSaturation ?? 99}%
                  </span>
                  <span className="text-xs font-semibold text-[#6B7280]">SpO₂</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-[#065F46] bg-[#ECFDF5] px-2 py-0.5 rounded-full border border-[#A7F3D0]">
                    ≥ 95% (Excellente oxygénation)
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-[#6B7280] pt-1 border-t border-[#F3F4F6]">
                Oxymétrie pulsée transcutanée.
              </p>
            </div>

            {/* 4. Température Corporelle */}
            <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs relative overflow-hidden space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                  Température
                </span>
                <div className="w-8 h-8 rounded-lg bg-[#FEF3C7] text-[#D97706] flex items-center justify-center">
                  <Thermometer className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold text-[#111827]">
                    {latestVitals?.temperature ?? 36.7}
                  </span>
                  <span className="text-xs font-semibold text-[#6B7280]">°C</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-[#065F46] bg-[#ECFDF5] px-2 py-0.5 rounded-full border border-[#A7F3D0]">
                    Apyrétique (36.5 - 37.5 °C)
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-[#6B7280] pt-1 border-t border-[#F3F4F6]">
                Absence de foyer fébrile.
              </p>
            </div>

            {/* 5. Glycémie à Jeun */}
            <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs relative overflow-hidden space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                  Glycémie à Jeun
                </span>
                <div className="w-8 h-8 rounded-lg bg-[#FCE7F3] text-[#BE185D] flex items-center justify-center">
                  <Droplets className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold text-[#111827]">
                    {latestVitals?.bloodGlucose ?? 0.92}
                  </span>
                  <span className="text-xs font-semibold text-[#6B7280]">g/L</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-[#065F46] bg-[#ECFDF5] px-2 py-0.5 rounded-full border border-[#A7F3D0]">
                    Normoglycémie (0.70 - 1.10)
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-[#6B7280] pt-1 border-t border-[#F3F4F6]">
                Contrôle métabolique glucidique stable.
              </p>
            </div>

            {/* 6. Fréquence Respiratoire */}
            <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs relative overflow-hidden space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                  Fréquence Respiratoire
                </span>
                <div className="w-8 h-8 rounded-lg bg-[#E0F2FE] text-[#0369A1] flex items-center justify-center">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold text-[#111827]">
                    {latestVitals?.respiratoryRate ?? 15}
                  </span>
                  <span className="text-xs font-semibold text-[#6B7280]">cpm</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-[#065F46] bg-[#ECFDF5] px-2 py-0.5 rounded-full border border-[#A7F3D0]">
                    Normopnée (12 - 20 cpm)
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-[#6B7280] pt-1 border-t border-[#F3F4F6]">
                Cycles respiratoires par minute au repos.
              </p>
            </div>

            {/* 7. Poids & Indice IMC */}
            <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs relative overflow-hidden space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                  Poids & Indice IMC
                </span>
                <div className="w-8 h-8 rounded-lg bg-[#F3E8FF] text-[#7E22CE] flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold text-[#111827]">{currentWeight}</span>
                  <span className="text-xs font-semibold text-[#6B7280]">kg</span>
                  <span className="text-xs text-[#6B7280] ml-1">({currentHeight} cm)</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-[#065F46] bg-[#ECFDF5] px-2 py-0.5 rounded-full border border-[#A7F3D0]">
                    IMC {imc} (Corpulence Normale)
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-[#6B7280] pt-1 border-t border-[#F3F4F6]">
                Indice de masse corporelle sain (18.5 - 24.9).
              </p>
            </div>

            {/* 8. Échelle de Douleur EVA */}
            <div className="bg-white p-5 rounded-2xl border border-[#E5E7EB] shadow-xs relative overflow-hidden space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                  Niveau de Douleur (EVA)
                </span>
                <div className="w-8 h-8 rounded-lg bg-[#DCFCE7] text-[#15803D] flex items-center justify-center">
                  <Smile className="w-4 h-4" />
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold text-[#15803D]">
                    {latestVitals?.painLevel ?? 0}
                  </span>
                  <span className="text-xs font-semibold text-[#6B7280]">/ 10</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-[#065F46] bg-[#ECFDF5] px-2 py-0.5 rounded-full border border-[#A7F3D0]">
                    Absence de douleur
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-[#6B7280] pt-1 border-t border-[#F3F4F6]">
                Échelle Visuelle Analogique de 0 à 10.
              </p>
            </div>
          </div>

          {/* Interactive Biometric Evolution Charts */}
          <BiometricCharts vitals={vitalsList} patientName={patient.name} />

          {/* Historical Readings Table */}
          <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-3">
              <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
                <History className="w-4 h-4 text-[#0D5C58]" />
                Historique des Relevés Biométriques de {patient.name}
              </h3>
              <span className="text-xs text-[#6B7280]">
                {vitalsList.length} mesure(s) enregistrée(s)
              </span>
            </div>

            {vitalsList.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#6B7280] space-y-2">
                <Activity className="w-8 h-8 text-[#9CA3AF] mx-auto opacity-50" />
                <p>Aucun historique disponible pour le moment.</p>
                <p>Cliquez sur "Nouvelle Saisie des Constantes" pour enregistrer votre premier relevé.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] bg-[#F9FAFB] text-[#4B5563]">
                      <th className="py-2.5 px-3 font-semibold">Date & Heure</th>
                      <th className="py-2.5 px-3 font-semibold">Fréquence Cardiaque</th>
                      <th className="py-2.5 px-3 font-semibold">Tension Artérielle</th>
                      <th className="py-2.5 px-3 font-semibold">SpO₂</th>
                      <th className="py-2.5 px-3 font-semibold">Température</th>
                      <th className="py-2.5 px-3 font-semibold">Glycémie</th>
                      <th className="py-2.5 px-3 font-semibold">Poids & IMC</th>
                      <th className="py-2.5 px-3 font-semibold">Auteur / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {vitalsList.map((v) => {
                      const vWeight = v.weightKg || currentWeight;
                      const vHeight = v.heightCm || currentHeight;
                      const vImc = (vWeight / ((vHeight / 100) * (vHeight / 100))).toFixed(1);
                      return (
                        <tr key={v.id} className="hover:bg-[#F9FAFB] transition-colors">
                          <td className="py-3 px-3 font-medium text-[#111827] whitespace-nowrap">
                            {v.measuredAt}
                          </td>
                          <td className="py-3 px-3 font-bold text-[#DC2626]">
                            {v.heartRate} bpm
                          </td>
                          <td className="py-3 px-3 font-bold text-[#4F46E5]">
                            {v.bloodPressureSys}/{v.bloodPressureDia} mmHg
                          </td>
                          <td className="py-3 px-3 font-bold text-[#0D5C58]">
                            {v.oxygenSaturation}%
                          </td>
                          <td className="py-3 px-3 text-[#111827]">
                            {v.temperature} °C
                          </td>
                          <td className="py-3 px-3 text-[#111827]">
                            {v.bloodGlucose ? `${v.bloodGlucose} g/L` : '-'}
                          </td>
                          <td className="py-3 px-3 text-[#111827]">
                            {vWeight} kg <span className="text-[#6B7280]">(IMC {vImc})</span>
                          </td>
                          <td className="py-3 px-3 text-[#4B5563]">
                            <div className="font-medium text-[#111827]">{v.measuredBy || 'Patient'}</div>
                            {v.notes && <div className="text-[11px] text-[#6B7280] italic">{v.notes}</div>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Patient Profile & Safety Medical Record Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Allergies Card */}
            <div className="bg-white p-6 rounded-xl border border-[#E5E7EB] shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-[#991B1B] flex items-center gap-2 border-b border-[#F3F4F6] pb-3">
                <AlertTriangle className="w-4 h-4 text-[#991B1B]" />
                Allergies Médicales Déclarées
              </h3>
              {patient.allergies.length === 0 || patient.allergies[0] === 'Aucune allergie connue' ? (
                <div className="p-3 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] text-xs text-[#166534] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-[#166534]" />
                  <span>Aucune allergie connue signalée dans le dossier.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {patient.allergies.map((allergy, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] flex items-center gap-2 text-xs text-[#991B1B] font-semibold"
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{allergy}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Antécédents Médicaux */}
            <div className="bg-white p-6 rounded-xl border border-[#E5E7EB] shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2 border-b border-[#F3F4F6] pb-3">
                <FileText className="w-4 h-4 text-[#0D5C58]" />
                Antécédents & Historique Clinique
              </h3>
              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-semibold text-[#111827] block mb-1">Suivi médical :</span>
                  <ul className="space-y-1 text-[#4B5563] list-disc list-inside">
                    {patient.medicalHistory.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </div>
                <div className="pt-2 border-t border-[#F3F4F6]">
                  <span className="font-semibold text-[#111827] block mb-1">Antécédents chirurgicaux :</span>
                  <ul className="space-y-1 text-[#4B5563] list-disc list-inside">
                    {patient.surgicalHistory.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: ANNUAIRE DES MÉDECINS & PRISE DE RENDEZ-VOUS */}
      {/* ========================================================================= */}
      {activeTab === 'medecins' && (
        <div className="space-y-6">
          {/* Header & Filter Controls */}
          <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-[#111827] flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-[#0D5C58]" />
                  Annuaire des Médecins & Disponibilités Hospitalières
                </h2>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Consultez les praticiens hospitaliers et réservez directement un rendez-vous selon leurs créneaux disponibles.
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={doctorSearchQuery}
                  onChange={(e) => setDoctorSearchQuery(e.target.value)}
                  placeholder="Rechercher médecin, spécialité..."
                  className="w-full h-10 pl-9 pr-3 text-xs rounded-xl border border-[#D1D5DB] focus:outline-none focus:ring-2 focus:ring-[#0D5C58]/20 focus:border-[#0D5C58]"
                />
              </div>
            </div>

            {/* Specialty Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#F3F4F6]">
              <span className="text-[11px] font-semibold text-[#6B7280] mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" />
                Spécialités :
              </span>
              <button
                type="button"
                onClick={() => setSelectedSpecialtyFilter('TOUS')}
                className={`px-3 py-1 text-xs rounded-full font-semibold transition-all ${
                  selectedSpecialtyFilter === 'TOUS'
                    ? 'bg-[#0D5C58] text-white shadow-xs'
                    : 'bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]'
                }`}
              >
                Toutes ({doctors.length})
              </button>
              {availableSpecialties.map((spec) => (
                <button
                  key={spec}
                  type="button"
                  onClick={() => setSelectedSpecialtyFilter(spec)}
                  className={`px-3 py-1 text-xs rounded-full font-semibold transition-all ${
                    selectedSpecialtyFilter === spec
                      ? 'bg-[#0D5C58] text-white shadow-xs'
                      : 'bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]'
                  }`}
                >
                  {spec}
                </button>
              ))}
            </div>
          </div>

          {/* Doctors Grid */}
          {isLoadingDoctors ? (
            <div className="p-12 text-center text-xs text-[#6B7280]">
              Chargement des praticiens et des créneaux en temps réel...
            </div>
          ) : filteredDoctors.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-[#E5E7EB] text-xs text-[#6B7280] space-y-2">
              <Stethoscope className="w-8 h-8 text-[#9CA3AF] mx-auto opacity-50" />
              <p>Aucun praticien ne correspond à votre recherche.</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedSpecialtyFilter('TOUS');
                  setDoctorSearchQuery('');
                }}
                className="text-xs text-[#0D5C58] font-bold hover:underline"
              >
                Réinitialiser les filtres
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredDoctors.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-xs hover:border-[#0D5C58]/40 transition-all space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-[#E6F4F3] border border-[#99D3CF] text-[#0D5C58] flex items-center justify-center font-bold text-lg shrink-0">
                          {doc.name.split(' ').map((n) => n[0]).join('')}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-[#0D5C58] bg-[#E6F4F3] px-2 py-0.5 rounded-full border border-[#99D3CF]">
                              {doc.specialty}
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-[#111827] mt-0.5">{doc.name}</h3>
                          <p className="text-xs text-[#6B7280]">{doc.title}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-[#4B5563] pt-1 border-t border-[#F3F4F6]">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-[#0D5C58] shrink-0" />
                        <span>{doc.location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />
                        <span>{doc.phone || '01 42 16 00 00'}</span>
                        <span className="text-[#D1D5DB]">·</span>
                        <Mail className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />
                        <span className="truncate">{doc.email}</span>
                      </div>
                    </div>

                    {doc.bio && (
                      <p className="text-[11px] text-[#6B7280] leading-relaxed bg-[#F9FAFB] p-2.5 rounded-lg border border-[#F3F4F6]">
                        {doc.bio}
                      </p>
                    )}
                  </div>

                  {/* Available Slots Preview */}
                  <div className="pt-3 border-t border-[#F3F4F6] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#111827] flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#0D5C58]" />
                        Créneaux disponibles :
                      </span>
                      <span className="text-[11px] text-[#059669] font-medium">
                        {doc.slots.filter((s) => s.isAvailable).length} disponible(s)
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {doc.slots.map((slot) => {
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            disabled={!slot.isAvailable}
                            onClick={() => {
                              if (slot.isAvailable) {
                                setBookingDoctor(doc);
                                setBookingSlot(slot);
                              }
                            }}
                            className={`px-2.5 py-1.5 text-[11px] rounded-lg font-medium border transition-all ${
                              slot.isAvailable
                                ? 'bg-white hover:bg-[#E6F4F3] border-[#D1D5DB] hover:border-[#0D5C58] text-[#111827] hover:text-[#0D5C58] cursor-pointer shadow-2xs'
                                : 'bg-[#F3F4F6] border-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed line-through'
                            }`}
                            title={slot.isAvailable ? 'Cliquer pour réserver ce créneau' : 'Créneau déjà réservé'}
                          >
                            {slot.dateTime}
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          const firstAvailable = doc.slots.find((s) => s.isAvailable) || doc.slots[0];
                          setBookingDoctor(doc);
                          setBookingSlot(firstAvailable);
                        }}
                        className="w-full min-h-[38px] py-2 bg-[#E6F4F3] hover:bg-[#0D5C58] text-[#0D5C58] hover:text-white border border-[#99D3CF] font-bold text-xs rounded-xl transition-all inline-flex items-center justify-center gap-2"
                      >
                        <Calendar className="w-4 h-4" />
                        Choisir un rendez-vous avec {doc.name.split(' ')[0]} {doc.name.split(' ')[1] || ''}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MES RENDEZ-VOUS */}
      {/* ========================================================================= */}
      {activeTab === 'consultations' && (
        <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F3F4F6] pb-4">
            <div>
              <h2 className="text-base font-bold text-[#111827] flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#0D5C58]" />
                Vos Rendez-Vous et Prochaines Consultations
              </h2>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Consultez vos rendez-vous confirmés, leurs lieux et les consignes de préparation.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('medecins')}
              className="min-h-[40px] px-4 py-2 bg-[#0D5C58] hover:bg-[#0B4E4A] text-white text-xs font-bold rounded-xl shadow-xs transition-colors inline-flex items-center gap-2 shrink-0"
            >
              <Plus className="w-4 h-4" />
              Réserver une nouvelle consultation
            </button>
          </div>

          {patient.consultations.length === 0 ? (
            <div className="text-center py-12 text-xs text-[#6B7280] space-y-3">
              <CalendarCheck className="w-10 h-10 text-[#9CA3AF] mx-auto opacity-50" />
              <p className="font-semibold text-sm text-[#111827]">Vous n'avez aucun rendez-vous programmé.</p>
              <p className="max-w-md mx-auto">
                Consultez la liste des médecins spécialistes de l'hôpital et réservez en quelques clics selon leurs disponibilités.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('medecins')}
                className="mt-2 px-4 py-2 bg-[#0D5C58] text-white font-bold text-xs rounded-xl"
              >
                Consulter les médecins disponibles
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {patient.consultations.map((c) => {
                const isScheduled = c.status === 'SCHEDULED';
                const matchedAlert = upcomingAlerts.find((a) => a.consultation.id === c.id);
                const isWithin48h = Boolean(matchedAlert);
                return (
                  <div
                    key={c.id}
                    className={`p-5 rounded-xl border transition-all ${
                      isWithin48h
                        ? 'bg-amber-50/40 border-amber-400 shadow-sm ring-2 ring-amber-300'
                        : isScheduled
                        ? 'bg-white border-[#0D5C58]/30 shadow-xs ring-1 ring-[#0D5C58]/10'
                        : 'bg-[#F9FAFB] border-[#E5E7EB] opacity-80'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                              isScheduled
                                ? 'bg-[#E6F4F3] text-[#0D5C58] border border-[#99D3CF]'
                                : 'bg-[#F3F4F6] text-[#6B7280]'
                            }`}
                          >
                            {isScheduled ? 'Rendez-vous Confirmé' : 'Consultation Passée'}
                          </span>
                          {isWithin48h && (
                            <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500 text-white shadow-2xs animate-pulse inline-flex items-center gap-1">
                              <CalendarClock className="w-3 h-3" />
                              Rendez-vous dans moins de 48h ({matchedAlert?.urgencyBadge})
                            </span>
                          )}
                          <span className="text-xs text-[#6B7280]">·</span>
                          <span className="text-xs font-semibold text-[#111827]">{c.specialty}</span>
                        </div>

                        <h3 className="text-base font-bold text-[#111827] flex items-center gap-2">
                          <Clock className={`w-4 h-4 ${isWithin48h ? 'text-amber-600' : 'text-[#0D5C58]'}`} />
                          {c.dateTime}
                        </h3>

                        <div className="text-xs text-[#4B5563]">
                          Praticien : <strong>{c.doctorName}</strong>
                        </div>

                        <div className="text-xs text-[#4B5563] flex items-center gap-1.5">
                          <MapPin className="w-4 h-4 text-[#6B7280]" />
                          <span>Lieu : {c.location}</span>
                        </div>

                        <div className="text-xs text-[#374151]">
                          <strong>Motif :</strong> {c.reason}
                        </div>

                        {c.preparationInstructions && (
                          <div className="p-3 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] text-xs text-[#1E40AF]">
                            <strong>Consignes de préparation :</strong> {c.preparationInstructions}
                          </div>
                        )}
                      </div>

                      {/* Action buttons (Annulation) */}
                      {isScheduled && onCancelConsultation && (
                        <div className="shrink-0 flex items-center">
                          <button
                            type="button"
                            onClick={() => setCancelingConsultationId(c.id)}
                            className="min-h-[36px] px-3 py-1.5 text-xs font-semibold text-[#991B1B] bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FECACA] rounded-lg transition-colors inline-flex items-center gap-1.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Annuler ce RDV
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: DOSSIER MÉDICAL & EXAMENS D'IMAGERIE */}
      {/* ========================================================================= */}
      {activeTab === 'dossier' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-3">
            <h2 className="text-xs font-semibold text-[#374151] uppercase tracking-wider px-1">
              Examens d'imagerie attachés à votre dossier
            </h2>

            {patient.scans.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-[#E5E7EB] text-center text-xs text-[#6B7280]">
                Aucun cliché d'imagerie médicale dans ce dossier.
              </div>
            ) : (
              <div className="space-y-3">
                {patient.scans.map((scan) => {
                  const isSelected = selectedScan?.id === scan.id;
                  return (
                    <div
                      key={scan.id}
                      onClick={() => setSelectedScan(scan)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer bg-white ${
                        isSelected
                          ? 'border-[#0D5C58] ring-1 ring-[#0D5C58] shadow-xs'
                          : 'border-[#E5E7EB] hover:border-[#D1D5DB] hover:bg-[#F9FAFB]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-20 h-20 rounded-lg bg-neutral-900 overflow-hidden shrink-0 border border-[#E5E7EB] relative">
                          <img
                            src={scan.imageUrl}
                            alt={scan.title}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <span className="absolute bottom-1 right-1 bg-black/70 text-white font-mono text-[9px] px-1 rounded">
                            {scan.modality}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between text-[11px] text-[#6B7280] mb-0.5">
                            <span className="font-semibold text-[#0D5C58]">{scan.modality}</span>
                            <span>{scan.studyDate}</span>
                          </div>
                          <h3 className="text-xs font-bold text-[#111827] line-clamp-1">{scan.title}</h3>
                          <p className="text-[11px] text-[#4B5563] mt-0.5 line-clamp-1">
                            Organe : {scan.bodyPart}
                          </p>

                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-[10px] font-semibold text-[#065F46] bg-[#ECFDF5] px-2 py-0.5 rounded-full">
                              Examen Validé
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenScanViewer(scan);
                              }}
                              className="text-xs font-medium text-[#0D5C58] hover:underline inline-flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Examiner
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="lg:col-span-7">
            {selectedScan ? (
              <div className="bg-white p-6 rounded-xl border border-[#E5E7EB] space-y-5">
                <div className="flex items-start justify-between border-b border-[#F3F4F6] pb-4">
                  <div>
                    <span className="text-xs font-bold text-[#0D5C58] uppercase">
                      {selectedScan.modality} · {selectedScan.bodyPart}
                    </span>
                    <h2 className="text-lg font-bold text-[#111827] mt-0.5">{selectedScan.title}</h2>
                    <p className="text-xs text-[#6B7280]">
                      Réalisé le {selectedScan.studyDate} sur {selectedScan.acquisitionDevice}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenScanViewer(selectedScan)}
                    className="min-h-[38px] px-3.5 py-1.5 bg-[#0D5C58] text-white text-xs font-semibold rounded-lg hover:bg-[#0B4E4A] transition-colors inline-flex items-center gap-1.5"
                  >
                    <Eye className="w-4 h-4" />
                    Ouvrir Visionneuse HD
                  </button>
                </div>

                <div className="w-full h-80 rounded-xl bg-neutral-900 overflow-hidden relative border border-[#E5E7EB]">
                  <img
                    src={selectedScan.imageUrl}
                    alt={selectedScan.title}
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-[#111827] uppercase tracking-wider mb-1">
                      Constatations Radiologiques
                    </h4>
                    <p className="text-xs text-[#374151] leading-relaxed bg-[#F9FAFB] p-3.5 rounded-lg border border-[#E5E7EB]">
                      {selectedScan.findings}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-[#111827] uppercase tracking-wider mb-1">
                      Conclusion & Remarques du Radiologue
                    </h4>
                    <p className="text-xs text-[#374151] leading-relaxed bg-[#ECFDF5] p-3.5 rounded-lg border border-[#A7F3D0] text-[#065F46] font-medium">
                      {selectedScan.radiologistNote}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white p-12 rounded-xl border border-[#E5E7EB] text-center text-xs text-[#6B7280]">
                Sélectionnez un examen pour afficher les constatations.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: ORDONNANCES À SUIVRE */}
      {/* ========================================================================= */}
      {activeTab === 'ordonnances' && (
        <div className="space-y-4">
          <div className="bg-white p-6 rounded-xl border border-[#E5E7EB] space-y-4">
            <h2 className="text-base font-bold text-[#111827] flex items-center gap-2 border-b border-[#F3F4F6] pb-3">
              <Pill className="w-5 h-5 text-[#0D5C58]" />
              Traitements et Ordonnances Médicales
            </h2>

            {patient.prescriptions.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#6B7280]">
                Aucune prescription active pour ce patient.
              </div>
            ) : (
              <div className="space-y-4">
                {patient.prescriptions.map((p) => {
                  const isActive = p.status === 'ACTIVE';
                  return (
                    <div
                      key={p.id}
                      className={`p-5 rounded-xl border transition-all ${
                        isActive
                          ? 'bg-white border-[#0D5C58]/30 shadow-xs ring-1 ring-[#0D5C58]/10'
                          : 'bg-[#F9FAFB] border-[#E5E7EB] opacity-75'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                isActive
                                  ? 'bg-[#E6F4F3] text-[#0D5C58] border border-[#99D3CF]'
                                  : 'bg-[#F3F4F6] text-[#6B7280]'
                              }`}
                            >
                              {isActive ? 'Traitement Actif' : 'Prescription Terminée'}
                            </span>
                            <span className="text-xs text-[#6B7280]">·</span>
                            <span className="text-xs text-[#6B7280]">Prescrit le {p.datePrescribed} par {p.prescribedBy}</span>
                          </div>

                          <h3 className="text-base font-bold text-[#111827]">{p.medication}</h3>
                          <div className="text-xs font-semibold text-[#0D5C58]">{p.dosage}</div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                            <div className="p-2.5 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB]">
                              <span className="text-[#6B7280] block text-[11px]">Posologie & Fréquence :</span>
                              <span className="font-bold text-[#0D5C58]">{p.frequency}</span>
                            </div>
                            <div className="p-2.5 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB]">
                              <span className="text-[#6B7280] block text-[11px]">Durée du traitement :</span>
                              <span className="font-medium text-[#111827]">{p.duration}</span>
                            </div>
                          </div>

                          {p.instructions && (
                            <div className="p-2.5 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#92400E] flex items-start gap-2">
                              <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#D97706]" />
                              <span><strong>Conseil du médecin :</strong> {p.instructions}</span>
                            </div>
                          )}
                        </div>

                        <div className="shrink-0 flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedPrescriptionForSeal(p)}
                            className="min-h-[36px] px-3 py-1.5 text-xs font-semibold text-[#0D5C58] bg-[#E6F4F3] hover:bg-[#d4edea] border border-[#99D3CF] rounded-lg transition-colors inline-flex items-center justify-center gap-1.5"
                          >
                            <ShieldCheck className="w-4 h-4 text-[#065F46]" />
                            Scellement d'intégrité (QR)
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedPrescriptionForPrint(p)}
                            className="min-h-[36px] px-3 py-1.5 text-xs font-semibold text-[#374151] bg-[#F9FAFB] hover:bg-[#F3F4F6] border border-[#D1D5DB] rounded-lg transition-colors inline-flex items-center justify-center gap-1.5"
                          >
                            <Printer className="w-4 h-4" />
                            Afficher & Imprimer
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL : SAISIE DE NOUVELLES CONSTANTES BIOMÉTRIQUES */}
      {/* ========================================================================= */}
      {isVitalsModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xl max-w-xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-[#E5E7EB] pb-3">
              <div>
                <h3 className="text-lg font-bold text-[#111827] flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[#0D5C58]" />
                  Nouvelle Saisie des Constantes Biométriques
                </h3>
                <p className="text-xs text-[#6B7280]">
                  Patient : <strong>{patient.name}</strong> · Enregistrement dynamique horodaté
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsVitalsModalOpen(false)}
                className="text-[#6B7280] hover:text-[#111827] p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {formVitalsError && (
              <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-xl text-xs text-[#991B1B] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formVitalsError}</span>
              </div>
            )}

            <form onSubmit={handleSaveVitals} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Fréquence Cardiaque */}
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Fréquence Cardiaque (bpm) *
                  </label>
                  <input
                    type="number"
                    value={formHeartRate}
                    onChange={(e) => setFormHeartRate(e.target.value)}
                    required
                    min={30}
                    max={240}
                    className="w-full h-10 px-3 text-xs rounded-xl border border-[#D1D5DB] focus:ring-2 focus:ring-[#0D5C58]/20 focus:border-[#0D5C58]"
                  />
                  <span className="text-[10px] text-[#6B7280]">Normal : 60 à 100 bpm</span>
                </div>

                {/* SpO2 */}
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Saturation SpO₂ (%) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formSpo2}
                    onChange={(e) => setFormSpo2(e.target.value)}
                    required
                    min={50}
                    max={100}
                    className="w-full h-10 px-3 text-xs rounded-xl border border-[#D1D5DB] focus:ring-2 focus:ring-[#0D5C58]/20 focus:border-[#0D5C58]"
                  />
                  <span className="text-[10px] text-[#6B7280]">Normal : ≥ 95%</span>
                </div>

                {/* Pression Artérielle Systolique */}
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Tension Systolique (mmHg) *
                  </label>
                  <input
                    type="number"
                    value={formBpSys}
                    onChange={(e) => setFormBpSys(e.target.value)}
                    required
                    min={60}
                    max={260}
                    className="w-full h-10 px-3 text-xs rounded-xl border border-[#D1D5DB] focus:ring-2 focus:ring-[#0D5C58]/20 focus:border-[#0D5C58]"
                  />
                  <span className="text-[10px] text-[#6B7280]">Normal : 110 à 130 mmHg</span>
                </div>

                {/* Pression Artérielle Diastolique */}
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Tension Diastolique (mmHg) *
                  </label>
                  <input
                    type="number"
                    value={formBpDia}
                    onChange={(e) => setFormBpDia(e.target.value)}
                    required
                    min={40}
                    max={160}
                    className="w-full h-10 px-3 text-xs rounded-xl border border-[#D1D5DB] focus:ring-2 focus:ring-[#0D5C58]/20 focus:border-[#0D5C58]"
                  />
                  <span className="text-[10px] text-[#6B7280]">Normal : 70 à 85 mmHg</span>
                </div>

                {/* Température */}
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Température (°C) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formTemperature}
                    onChange={(e) => setFormTemperature(e.target.value)}
                    required
                    min={30}
                    max={45}
                    className="w-full h-10 px-3 text-xs rounded-xl border border-[#D1D5DB] focus:ring-2 focus:ring-[#0D5C58]/20 focus:border-[#0D5C58]"
                  />
                  <span className="text-[10px] text-[#6B7280]">Normal : 36.5 à 37.5 °C</span>
                </div>

                {/* Glycémie */}
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Glycémie à jeun (g/L)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formGlucose}
                    onChange={(e) => setFormGlucose(e.target.value)}
                    className="w-full h-10 px-3 text-xs rounded-xl border border-[#D1D5DB] focus:ring-2 focus:ring-[#0D5C58]/20 focus:border-[#0D5C58]"
                  />
                  <span className="text-[10px] text-[#6B7280]">Normal : 0.70 à 1.10 g/L</span>
                </div>

                {/* Fréquence Respiratoire */}
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Fréquence Respiratoire (cpm)
                  </label>
                  <input
                    type="number"
                    value={formRespRate}
                    onChange={(e) => setFormRespRate(e.target.value)}
                    min={8}
                    max={60}
                    className="w-full h-10 px-3 text-xs rounded-xl border border-[#D1D5DB] focus:ring-2 focus:ring-[#0D5C58]/20 focus:border-[#0D5C58]"
                  />
                  <span className="text-[10px] text-[#6B7280]">Normal : 12 à 20 cycles/min</span>
                </div>

                {/* Niveau de Douleur EVA */}
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Échelle de Douleur (0 à 10)
                  </label>
                  <input
                    type="number"
                    value={formPainLevel}
                    onChange={(e) => setFormPainLevel(e.target.value)}
                    min={0}
                    max={10}
                    className="w-full h-10 px-3 text-xs rounded-xl border border-[#D1D5DB] focus:ring-2 focus:ring-[#0D5C58]/20 focus:border-[#0D5C58]"
                  />
                  <span className="text-[10px] text-[#6B7280]">0 = aucune douleur, 10 = intolérable</span>
                </div>

                {/* Poids */}
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Poids (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formWeight}
                    onChange={(e) => setFormWeight(e.target.value)}
                    className="w-full h-10 px-3 text-xs rounded-xl border border-[#D1D5DB] focus:ring-2 focus:ring-[#0D5C58]/20 focus:border-[#0D5C58]"
                  />
                </div>

                {/* Taille */}
                <div>
                  <label className="block text-xs font-semibold text-[#374151] mb-1">
                    Taille (cm)
                  </label>
                  <input
                    type="number"
                    value={formHeight}
                    onChange={(e) => setFormHeight(e.target.value)}
                    className="w-full h-10 px-3 text-xs rounded-xl border border-[#D1D5DB] focus:ring-2 focus:ring-[#0D5C58]/20 focus:border-[#0D5C58]"
                  />
                </div>
              </div>

              {/* Live IMC Preview Banner */}
              <div className="p-3 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] flex items-center justify-between text-xs">
                <span className="text-[#4B5563]">IMC calculé automatiquement :</span>
                <span className="font-bold text-[#0D5C58] bg-[#E6F4F3] px-2.5 py-0.5 rounded-full border border-[#99D3CF]">
                  {formComputedImc} kg/m²
                </span>
              </div>

              {/* Contexte / Notes */}
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">
                  Remarques ou Contexte de Mesure
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Ex : Prise le matin à jeun au repos"
                  className="w-full h-10 px-3 text-xs rounded-xl border border-[#D1D5DB] focus:ring-2 focus:ring-[#0D5C58]/20 focus:border-[#0D5C58]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F3F4F6]">
                <button
                  type="button"
                  onClick={() => setIsVitalsModalOpen(false)}
                  className="min-h-[40px] px-4 text-xs font-semibold text-[#374151] hover:bg-[#F3F4F6] rounded-xl border border-[#D1D5DB]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingVitals}
                  className="min-h-[40px] px-5 text-xs font-bold text-white bg-[#0D5C58] hover:bg-[#0B4E4A] rounded-xl shadow-xs transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmittingVitals ? 'Enregistrement...' : 'Enregistrer les Constantes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL : RÉSERVATION DE RENDEZ-VOUS */}
      {/* ========================================================================= */}
      {bookingDoctor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-start justify-between border-b border-[#E5E7EB] pb-3">
              <div>
                <h3 className="text-lg font-bold text-[#111827] flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#0D5C58]" />
                  Réserver un Rendez-Vous Médical
                </h3>
                <p className="text-xs text-[#6B7280]">
                  Avec <strong>{bookingDoctor.name}</strong> ({bookingDoctor.specialty})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBookingDoctor(null)}
                className="text-[#6B7280] hover:text-[#111827] p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmBooking} className="space-y-4">
              {/* Doctor Details Summary */}
              <div className="p-3.5 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#111827]">{bookingDoctor.name}</span>
                  <span className="text-[#0D5C58] font-bold">{bookingDoctor.specialty}</span>
                </div>
                <div className="text-[#6B7280] flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#6B7280]" />
                  <span>{bookingDoctor.location}</span>
                </div>
              </div>

              {/* Slot Selection */}
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                  Créneau Horaire Souhaité *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {bookingDoctor.slots.map((s) => {
                    const isSelected = bookingSlot?.id === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={!s.isAvailable}
                        onClick={() => setBookingSlot(s)}
                        className={`p-2.5 rounded-xl text-xs font-medium text-left border transition-all ${
                          isSelected
                            ? 'bg-[#0D5C58] text-white border-[#0D5C58] shadow-xs'
                            : s.isAvailable
                            ? 'bg-white hover:bg-[#F9FAFB] border-[#D1D5DB] text-[#111827]'
                            : 'bg-[#F3F4F6] border-[#E5E7EB] text-[#9CA3AF] line-through cursor-not-allowed'
                        }`}
                      >
                        <div className="font-semibold">{s.dateTime}</div>
                        <div className="text-[10px] mt-0.5 opacity-80">
                          {s.isAvailable ? 'Disponible' : 'Indisponible'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reason Selector */}
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1.5">
                  Motif de Consultation *
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    'Consultation de contrôle',
                    'Bilan tensionnel & biométrique',
                    'Suivi de traitement',
                    'Lecture d’examens ou scanner',
                    'Renouvellement d’ordonnance',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setBookingReason(preset)}
                      className={`px-2.5 py-1 text-[11px] rounded-lg border transition-colors ${
                        bookingReason === preset
                          ? 'bg-[#E6F4F3] text-[#0D5C58] border-[#99D3CF] font-bold'
                          : 'bg-white text-[#4B5563] border-[#E5E7EB] hover:bg-[#F9FAFB]'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={bookingReason}
                  onChange={(e) => setBookingReason(e.target.value)}
                  required
                  placeholder="Précisez le motif..."
                  className="w-full h-10 px-3 text-xs rounded-xl border border-[#D1D5DB] focus:ring-2 focus:ring-[#0D5C58]/20 focus:border-[#0D5C58]"
                />
              </div>

              {/* Optional Notes */}
              <div>
                <label className="block text-xs font-semibold text-[#374151] mb-1">
                  Remarques ou symptômes récents (optionnel)
                </label>
                <textarea
                  value={bookingNotes}
                  onChange={(e) => setBookingNotes(e.target.value)}
                  rows={2}
                  placeholder="Précisez d'éventuels symptômes récents pour le praticien..."
                  className="w-full p-2.5 text-xs rounded-xl border border-[#D1D5DB] focus:ring-2 focus:ring-[#0D5C58]/20 focus:border-[#0D5C58]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#F3F4F6]">
                <button
                  type="button"
                  onClick={() => setBookingDoctor(null)}
                  className="min-h-[40px] px-4 text-xs font-semibold text-[#374151] hover:bg-[#F3F4F6] rounded-xl border border-[#D1D5DB]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isBookingSubmitting || !bookingSlot || !bookingSlot.isAvailable}
                  className="min-h-[40px] px-5 text-xs font-bold text-white bg-[#0D5C58] hover:bg-[#0B4E4A] rounded-xl shadow-xs transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isBookingSubmitting ? 'Validation...' : 'Confirmer la Réservation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL : CONFIRMATION D'ANNULATION DE RDV */}
      {/* ========================================================================= */}
      {cancelingConsultationId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xl max-w-sm w-full p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] mx-auto flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#111827]">Annuler ce rendez-vous ?</h3>
              <p className="text-xs text-[#6B7280] mt-1">
                Le créneau sera libéré et le praticien sera notifié de l'annulation.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCancelingConsultationId(null)}
                className="min-h-[38px] px-4 text-xs font-semibold text-[#374151] hover:bg-[#F3F4F6] rounded-xl border border-[#D1D5DB]"
              >
                Garder le RDV
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (onCancelConsultation && cancelingConsultationId) {
                    await onCancelConsultation(cancelingConsultationId);
                    setCancelingConsultationId(null);
                  }
                }}
                className="min-h-[38px] px-4 text-xs font-bold text-white bg-[#991B1B] hover:bg-[#7F1D1D] rounded-xl shadow-xs"
              >
                Confirmer l'annulation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL : SUCCÈS RÉSERVATION */}
      {/* ========================================================================= */}
      {bookingSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl border border-[#A7F3D0] shadow-2xl max-w-sm w-full p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-[#059669] mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#111827]">Rendez-Vous Confirmé !</h3>
              <p className="text-xs text-[#6B7280] mt-1">
                Votre consultation a bien été enregistrée dans votre planning hospitalier.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBookingSuccessModal(false)}
              className="w-full min-h-[38px] px-4 text-xs font-bold text-white bg-[#0D5C58] hover:bg-[#0B4E4A] rounded-xl"
            >
              Voir mes consultations
            </button>
          </div>
        </div>
      )}

      {/* Official Certified Printable & Downloadable PDF Prescription Modal */}
      <PrescriptionPrintModal
        isOpen={Boolean(selectedPrescriptionForPrint)}
        onClose={() => setSelectedPrescriptionForPrint(null)}
        prescription={selectedPrescriptionForPrint}
        patient={patient}
      />

      {/* Modal de Scellement d'Intégrité SHA-256 */}
      <PrescriptionSealModal
        isOpen={Boolean(selectedPrescriptionForSeal)}
        onClose={() => setSelectedPrescriptionForSeal(null)}
        prescription={selectedPrescriptionForSeal}
        patientName={patient.name}
      />
    </div>
  );
};
