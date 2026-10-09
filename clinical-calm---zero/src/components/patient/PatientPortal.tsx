import React, { useState } from 'react';
import { PatientRecord, MedicalScan, PrescriptionItem, UserProfile } from '../../types/clinical';
import { canAccessPatientRecord } from '../../utils/authorization';
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
} from 'lucide-react';

interface PatientPortalProps {
  patient: PatientRecord;
  currentUser?: UserProfile | null;
  onOpenScanViewer: (scan: MedicalScan) => void;
}

export const PatientPortal: React.FC<PatientPortalProps> = ({
  patient,
  currentUser,
  onOpenScanViewer,
}) => {
  const [activeTab, setActiveTab] = useState<'profil' | 'dossier' | 'ordonnances' | 'consultations'>('profil');
  const [selectedScan, setSelectedScan] = useState<MedicalScan | null>(patient.scans[0] || null);
  const [selectedPrescriptionForPrint, setSelectedPrescriptionForPrint] = useState<PrescriptionItem | null>(null);

  // RBAC Guard: If logged in as PATIENT, must only be able to view their own record
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

  // Calculate BMI (IMC)
  const heightMeters = patient.heightCm / 100;
  const imc = (patient.weightKg / (heightMeters * heightMeters)).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Patient Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#E6F4F3] border-2 border-[#0D5C58] text-[#0D5C58] flex items-center justify-center font-bold text-2xl shrink-0">
              {patient.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-[#0D5C58] bg-[#E6F4F3] px-2.5 py-0.5 rounded-full border border-[#99D3CF]">
                  Espace Patient Personnel
                </span>
                <span className="text-xs text-[#6B7280]">·</span>
                <span className="text-xs text-[#6B7280]">N° Sécurité Sociale : {patient.socialSecurityNumber}</span>
              </div>
              <h1 className="text-2xl font-bold text-[#111827]">{patient.name}</h1>
              <p className="text-xs text-[#4B5563] mt-0.5">
                Né le {patient.birthDate} ({patient.age} ans) · Médecin référent : {patient.referringDoctor}
              </p>
            </div>
          </div>

          {/* Blood Type Highlight Card */}
          <div className="bg-[#FEF2F2] border border-[#FECACA] p-3.5 rounded-xl flex items-center gap-3 shrink-0 shadow-xs">
            <div className="w-10 h-10 rounded-full bg-[#991B1B] text-white flex items-center justify-center font-bold text-sm shrink-0">
              <Heart className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="text-[10px] font-semibold text-[#991B1B] uppercase tracking-wider">
                Groupe Sanguin
              </div>
              <div className="text-lg font-bold text-[#991B1B]">{patient.bloodType}</div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-[#F3F4F6]">
          {[
            { id: 'profil', label: 'Informations & Constantes', icon: User },
            { id: 'dossier', label: `Dossier Médical & Examens (${patient.scans.length})`, icon: FileText },
            { id: 'ordonnances', label: `Ordonnances à Suivre (${patient.prescriptions.filter(p => p.status === 'ACTIVE').length} actives)`, icon: Pill },
            { id: 'consultations', label: `Prochaines Consultations (${patient.consultations.filter(c => c.status === 'SCHEDULED').length})`, icon: Calendar },
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
                    ? 'bg-[#0D5C58] text-white border-[#0D5C58] shadow-xs'
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

      {/* Tab 1: Informations & Constantes */}
      {activeTab === 'profil' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Biometrics Card */}
          <div className="bg-white p-6 rounded-xl border border-[#E5E7EB] space-y-4">
            <h2 className="text-sm font-bold text-[#111827] flex items-center gap-2 border-b border-[#F3F4F6] pb-3">
              <Activity className="w-4 h-4 text-[#0D5C58]" />
              Constantes & Biométrie
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB]">
                <div className="text-[11px] text-[#6B7280]">Groupe Sanguin</div>
                <div className="text-base font-bold text-[#991B1B] mt-0.5">{patient.bloodType}</div>
              </div>

              <div className="p-3 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB]">
                <div className="text-[11px] text-[#6B7280]">Poids Actuel</div>
                <div className="text-base font-bold text-[#111827] mt-0.5">{patient.weightKg} kg</div>
              </div>

              <div className="p-3 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB]">
                <div className="text-[11px] text-[#6B7280]">Taille</div>
                <div className="text-base font-bold text-[#111827] mt-0.5">{patient.heightCm} cm</div>
              </div>

              <div className="p-3 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB]">
                <div className="text-[11px] text-[#6B7280]">Indice IMC</div>
                <div className={`text-base font-bold mt-0.5 ${parseFloat(imc) < 18.5 ? 'text-[#D97706]' : parseFloat(imc) < 25 ? 'text-[#0D5C58]' : parseFloat(imc) < 30 ? 'text-[#D97706]' : 'text-[#991B1B]'}`}>{imc} ({parseFloat(imc) < 18.5 ? 'Insuffisance pondérale' : parseFloat(imc) < 25 ? 'Normal' : parseFloat(imc) < 30 ? 'Surpoids' : 'Obésité'})</div>
              </div>
            </div>

            <div className="pt-2 text-xs text-[#4B5563] space-y-1">
              <div>Téléphone : <strong>{patient.phone}</strong></div>
              <div>Courriel : <strong>{patient.email}</strong></div>
            </div>
          </div>

          {/* Allergies Card (Crucial Medical Safety) */}
          <div className="bg-white p-6 rounded-xl border border-[#E5E7EB] space-y-4">
            <h2 className="text-sm font-bold text-[#991B1B] flex items-center gap-2 border-b border-[#F3F4F6] pb-3">
              <AlertTriangle className="w-4 h-4 text-[#991B1B]" />
              Allergies Médicales Connues
            </h2>

            <div className="space-y-2.5">
              {patient.allergies.map((allergy, index) => (
                <div
                  key={index}
                  className="p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] flex items-start gap-2.5 text-xs text-[#991B1B] font-medium"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#991B1B]" />
                  <span>{allergy}</span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-[#6B7280] leading-relaxed">
              Signalez impérativement ces allergies à tout professionnel de santé lors d'une prescription ou d'une hospitalisation.
            </p>
          </div>

          {/* Medical & Surgical History */}
          <div className="bg-white p-6 rounded-xl border border-[#E5E7EB] space-y-4">
            <h2 className="text-sm font-bold text-[#111827] flex items-center gap-2 border-b border-[#F3F4F6] pb-3">
              <FileText className="w-4 h-4 text-[#0D5C58]" />
              Antécédents Médicaux
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-semibold text-[#111827] block mb-1">Pathologies suivies :</span>
                <ul className="space-y-1 text-[#4B5563] list-disc list-inside">
                  {patient.medicalHistory.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </div>

              <div className="pt-2 border-t border-[#F3F4F6]">
                <span className="font-semibold text-[#111827] block mb-1">Interventions chirurgicales :</span>
                <ul className="space-y-1 text-[#4B5563] list-disc list-inside">
                  {patient.surgicalHistory.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Dossier Médical & Examens d'Imagerie */}
      {activeTab === 'dossier' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Scans List */}
          <div className="lg:col-span-5 space-y-3">
            <h2 className="text-xs font-semibold text-[#374151] uppercase tracking-wider px-1">
              Examens d'imagerie attachés à votre dossier
            </h2>

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
          </div>

          {/* Scan Detail & Radiologist Findings */}
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
                    className="min-h-[40px] px-3.5 py-1.5 text-xs font-medium text-white bg-[#0D5C58] hover:bg-[#0B4E4A] rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-xs"
                  >
                    <Eye className="w-4 h-4" />
                    Visualiser en Plein Écran
                  </button>
                </div>

                {/* Big Image Preview */}
                <div className="w-full h-72 rounded-xl bg-neutral-950 overflow-hidden flex items-center justify-center relative border border-[#E5E7EB]">
                  <img
                    src={selectedScan.imageUrl}
                    alt={selectedScan.title}
                    className="max-h-full max-w-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-xs text-white text-[10px] px-2 py-1 rounded">
                    Organe : {selectedScan.bodyPart}
                  </div>
                </div>

                {/* Report Conclusion */}
                <div className="p-4 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-[#111827]">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-[#0D5C58]" />
                      Conclusion du Médecin Radiologue
                    </span>
                    <span className="text-[10px] text-[#065F46] bg-[#ECFDF5] px-2 py-0.5 rounded-full">
                      Validé par {patient.referringDoctor}
                    </span>
                  </div>
                  <p className="text-xs text-[#374151] leading-relaxed">
                    {selectedScan.findings}
                  </p>
                  <p className="text-[11px] text-[#6B7280] italic pt-1 border-t border-[#E5E7EB]">
                    Recommandation : {selectedScan.radiologistNote}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-white p-8 rounded-xl border border-[#E5E7EB] text-center text-[#6B7280]">
                Sélectionnez un examen pour afficher le compte-rendu médical.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Ordonnances à Suivre */}
      {activeTab === 'ordonnances' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-[#E5E7EB]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F3F4F6] pb-4 mb-4">
              <div>
                <h2 className="text-base font-bold text-[#111827] flex items-center gap-2">
                  <Pill className="w-5 h-5 text-[#0D5C58]" />
                  Vos Ordonnances et Traitements Prescrits
                </h2>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Consultez vos posologies, la durée de votre traitement et téléchargez vos ordonnances pour la pharmacie.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {patient.prescriptions.map((p) => {
                const isActive = p.status === 'ACTIVE';
                return (
                  <div
                    key={p.id}
                    className={`p-5 rounded-xl border transition-all ${
                      isActive ? 'bg-white border-[#E5E7EB] shadow-xs' : 'bg-[#F9FAFB] border-[#E5E7EB] opacity-75'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isActive
                                ? 'bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]'
                                : 'bg-[#F3F4F6] text-[#6B7280]'
                            }`}
                          >
                            {isActive ? 'Traitement en cours' : 'Traitement terminé'}
                          </span>
                          <span className="text-xs text-[#6B7280]">·</span>
                          <span className="text-xs text-[#6B7280]">Prescrit le {p.datePrescribed} par {p.prescribedBy}</span>
                        </div>

                        <h3 className="text-base font-bold text-[#111827]">{p.medication}</h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div className="p-2.5 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB]">
                            <span className="text-[#6B7280] block text-[11px]">Posologie & Fréquence :</span>
                            <span className="font-bold text-[#0D5C58]">{p.frequency}</span>
                          </div>

                          <div className="p-2.5 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB]">
                            <span className="text-[#6B7280] block text-[11px]">Durée du traitement :</span>
                            <span className="font-medium text-[#111827]">{p.duration}</span>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#92400E] flex items-start gap-2">
                          <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#D97706]" />
                          <span><strong>Conseil du médecin :</strong> {p.instructions}</span>
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedPrescriptionForPrint(p)}
                          className="min-h-[40px] px-4 py-2 text-xs font-semibold text-[#0D5C58] bg-[#E6F4F3] hover:bg-[#d4edea] border border-[#99D3CF] rounded-lg transition-colors inline-flex items-center justify-center gap-1.5"
                        >
                          <Printer className="w-4 h-4" />
                          Afficher & Imprimer
                        </button>

                        <div className="text-[11px] text-[#6B7280] text-center">
                          Renouvellements : <strong>{p.refillsRemaining} restant(s)</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Printable Prescription Modal */}
          {selectedPrescriptionForPrint && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 animate-fade-in" role="dialog" aria-modal="true" aria-label="Ordonnance médicale" onKeyDown={(e) => { if (e.key === 'Escape') setSelectedPrescriptionForPrint(null); }}>
              <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xl max-w-lg w-full p-6 space-y-6">
                <div className="flex items-start justify-between border-b border-[#E5E7EB] pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-[#111827]">Ordonnance Médicale</h3>
                    <p className="text-xs text-[#6B7280]">Centre Hospitalier Universitaire</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPrescriptionForPrint(null)}
                    className="text-[#6B7280] hover:text-[#111827] p-1"
                  >
                    ✕
                  </button>
                </div>

                <div className="text-xs text-[#4B5563] space-y-1">
                  <div>Patient : <strong>{patient.name}</strong> ({patient.age} ans)</div>
                  <div>Prescripteur : <strong>{selectedPrescriptionForPrint.prescribedBy}</strong></div>
                  <div>Date : {selectedPrescriptionForPrint.datePrescribed}</div>
                </div>

                <div className="p-4 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] space-y-2">
                  <div className="font-bold text-[#111827] text-sm">{selectedPrescriptionForPrint.medication}</div>
                  <div className="text-xs font-medium text-[#0D5C58]">{selectedPrescriptionForPrint.dosage}</div>
                  <div className="text-xs text-[#374151]">{selectedPrescriptionForPrint.frequency}</div>
                  <div className="text-xs text-[#6B7280]">Durée : {selectedPrescriptionForPrint.duration}</div>
                  <div className="text-xs text-[#4B5563] italic pt-1 border-t border-[#E5E7EB]">
                    Instructions : {selectedPrescriptionForPrint.instructions}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPrescriptionForPrint(null)}
                    className="min-h-[40px] px-4 text-xs font-medium text-[#374151] hover:bg-[#F3F4F6] rounded-lg border border-[#D1D5DB]"
                  >
                    Fermer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      window.print();
                    }}
                    className="min-h-[40px] px-4 text-xs font-bold text-white bg-[#0D5C58] hover:bg-[#0B4E4A] rounded-lg inline-flex items-center gap-1.5"
                  >
                    <Printer className="w-4 h-4" />
                    Imprimer l'Ordonnance
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Prochaines Consultations */}
      {activeTab === 'consultations' && (
        <div className="bg-white p-6 rounded-xl border border-[#E5E7EB] space-y-6">
          <div className="border-b border-[#F3F4F6] pb-4">
            <h2 className="text-base font-bold text-[#111827] flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#0D5C58]" />
              Vos Rendez-Vous et Prochaines Consultations
            </h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Consultez les dates, lieux et instructions préparatoires pour vos rendez-vous médicaux.
            </p>
          </div>

          <div className="space-y-4">
            {patient.consultations.map((c) => {
              const isScheduled = c.status === 'SCHEDULED';
              return (
                <div
                  key={c.id}
                  className={`p-5 rounded-xl border transition-all ${
                    isScheduled
                      ? 'bg-white border-[#0D5C58]/30 shadow-xs ring-1 ring-[#0D5C58]/10'
                      : 'bg-[#F9FAFB] border-[#E5E7EB] opacity-80'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                            isScheduled
                              ? 'bg-[#E6F4F3] text-[#0D5C58] border border-[#99D3CF]'
                              : 'bg-[#F3F4F6] text-[#6B7280]'
                          }`}
                        >
                          {isScheduled ? 'Rendez-vous Confirmé' : 'Consultation Passée'}
                        </span>
                        <span className="text-xs text-[#6B7280]">·</span>
                        <span className="text-xs font-semibold text-[#111827]">{c.specialty}</span>
                      </div>

                      <h3 className="text-base font-bold text-[#111827] flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#0D5C58]" />
                        {c.dateTime}
                      </h3>

                      <div className="text-xs text-[#4B5563]">
                        Médecin : <strong>{c.doctorName}</strong>
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
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
