import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, X, AlertCircle } from 'lucide-react';
import { AllergyContraindicationData, DrugInteractionData } from '../../types/clinical';

interface DrugSafetyAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  contraindication?: AllergyContraindicationData;
  interaction?: DrugInteractionData;
  warnings?: Array<any>;
  onConfirmOverride: (justification: string) => void;
  isSubmitting?: boolean;
}

export const DrugSafetyAlertModal: React.FC<DrugSafetyAlertModalProps> = ({
  isOpen,
  onClose,
  contraindication,
  interaction,
  warnings,
  onConfirmOverride,
  isSubmitting = false,
}) => {
  const [justification, setJustification] = useState('');

  if (!isOpen) return null;

  const charCount = justification.trim().length;
  const isJustificationValid = charCount >= 20;

  const handleForcePrescription = () => {
    if (!isJustificationValid) return;
    onConfirmOverride(justification.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full border-2 border-[#DC2626] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Alert */}
        <div className="bg-[#FEF2F2] p-5 border-b border-[#FECACA] flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#DC2626] text-white flex items-center justify-center shrink-0 shadow-md">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider bg-[#DC2626] text-white px-2 py-0.5 rounded-full">
                  Blocage Serveur (HTTP 409)
                </span>
                <span className="text-xs text-[#991B1B] font-semibold">Sécurité Clinique</span>
              </div>
              <h2 className="text-lg font-bold text-[#991B1B] mt-0.5">
                Alerte de Prescription Médicale Bloquante
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#9CA3AF] hover:text-[#111827] rounded-lg hover:bg-white/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Legal / Educational Disclaimer */}
        <div className="bg-[#FFFBEB] px-5 py-2.5 border-b border-[#FDE68A] text-xs text-[#92400E] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-[#D97706]" />
          <span>
            <strong>Avertissement réglementaire :</strong> Outil de démonstration pédagogique — Base pharmacologique non certifiée CE / HAS / Thériaque / RxNorm.
          </span>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-[#374151]">
          {/* Contre-Indication Allergique */}
          {contraindication && (
            <div className="p-4 rounded-xl bg-[#FEF2F2] border border-[#FECACA] space-y-2.5">
              <div className="flex items-center gap-2 text-sm font-bold text-[#991B1B]">
                <AlertTriangle className="w-5 h-5 text-[#DC2626]" />
                Contre-Indication Allergique Majeure Détectée
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-lg bg-white border border-[#FECACA]">
                  <span className="text-[11px] text-[#6B7280] block">Antécédent allergique patient :</span>
                  <span className="font-bold text-[#991B1B]">{contraindication.allergy}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-[#FECACA]">
                  <span className="text-[11px] text-[#6B7280] block">Médicament ciblé :</span>
                  <span className="font-bold text-[#111827]">{contraindication.medication}</span>
                </div>
              </div>

              {contraindication.drugClass && (
                <div className="text-xs">
                  <span className="text-[#6B7280]">Classe thérapeutique / Famille : </span>
                  <strong className="text-[#991B1B]">{contraindication.drugClass}</strong>
                </div>
              )}

              {contraindication.reason && (
                <p className="p-3 rounded-lg bg-white/90 border border-[#FECACA] text-[#991B1B] leading-relaxed">
                  {contraindication.reason}
                </p>
              )}
            </div>
          )}

          {/* Interaction Majeure */}
          {interaction && interaction.details && interaction.details.length > 0 && (
            <div className="p-4 rounded-xl bg-[#FFF1F2] border border-[#FDA4AF] space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-[#BE123C]">
                <AlertTriangle className="w-5 h-5 text-[#E11D48]" />
                Interaction Médicamenteuse Majeure Bloquante
              </div>

              {interaction.details.map((item, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-white border border-[#FECDD3] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#111827]">
                      {item.newMedication} + {item.existingMedication}
                    </span>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-[#FFE4E6] text-[#BE123C] rounded-full">
                      Niveau Majeur
                    </span>
                  </div>
                  <div className="text-[11px] text-[#6B7280]">
                    <strong>Mécanisme :</strong> {item.mechanism}
                  </div>
                  <div className="text-[11px] text-[#BE123C] font-medium">
                    <strong>Impact clinique :</strong> {item.clinicalImpact}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Avertissements Modérés (Non bloquants mais affichés) */}
          {warnings && warnings.length > 0 && (
            <div className="p-4 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] space-y-2">
              <div className="text-xs font-bold text-[#92400E] flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-[#D97706]" />
                Avertissements Cliniques Associés (Niveau Modéré)
              </div>
              {warnings.map((w, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-white border border-[#FDE68A] text-xs space-y-1">
                  <div className="font-semibold text-[#111827]">{w.newMedication} + {w.existingMedication}</div>
                  <div className="text-[11px] text-[#78350F]">{w.clinicalImpact}</div>
                </div>
              ))}
            </div>
          )}

          {/* Section Override / Dérogation Clinique */}
          <div className="p-4 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] space-y-3">
            <div>
              <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
                <span>Dérogation Clinique (Override Médical)</span>
                <span className="text-[10px] bg-[#E0E7FF] text-[#3730A3] font-semibold px-2 py-0.5 rounded-full">
                  Traçabilité WORM requise
                </span>
              </h3>
              <p className="text-[11px] text-[#4B5563] mt-1 leading-relaxed">
                Le praticien engage sa responsabilité médicale en levant cette contre-indication. Le motif sera inscrit de manière inaltérable dans le registre d'audit hospitalier (SHA-256).
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="override-justification" className="block text-xs font-semibold text-[#374151]">
                Justification clinique formelle (obligatoire, min. 20 caractères) :
              </label>
              <textarea
                id="override-justification"
                rows={3}
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Exemple : Patient sous surveillance continue en soins intensifs, alternative thérapeutique indisponible..."
                className="w-full p-3 rounded-lg border border-[#D1D5DB] focus:ring-2 focus:ring-[#DC2626] focus:border-[#DC2626] text-xs resize-none"
              />
              <div className="flex items-center justify-between text-[11px]">
                <span className={charCount >= 20 ? 'text-[#065F46] font-semibold' : 'text-[#DC2626] font-semibold'}>
                  {charCount} / 20 caractères minimum
                </span>
                {!isJustificationValid && (
                  <span className="text-[#9CA3AF]">
                    {20 - charCount} caractère(s) manquant(s) pour débloquer
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-[#F9FAFB] p-4 border-t border-[#E5E7EB] flex flex-col sm:flex-row items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-[#374151] bg-white border border-[#D1D5DB] hover:bg-[#F3F4F6] rounded-lg transition-colors"
          >
            Annuler & Modifier la Prescription
          </button>

          <button
            type="button"
            disabled={!isJustificationValid || isSubmitting}
            onClick={handleForcePrescription}
            className={`w-full sm:w-auto px-5 py-2 text-xs font-semibold text-white rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 ${
              isJustificationValid && !isSubmitting
                ? 'bg-[#DC2626] hover:bg-[#B91C1C] cursor-pointer'
                : 'bg-[#9CA3AF] cursor-not-allowed opacity-60'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            {isSubmitting ? 'Enregistrement de la dérogation...' : 'Forcer la Prescription (Override Clinique)'}
          </button>
        </div>
      </div>
    </div>
  );
};
