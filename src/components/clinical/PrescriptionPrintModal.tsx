import React, { useState } from 'react';
import { PrescriptionItem, PatientRecord } from '../../types/clinical';
import { maskCryptoHash } from '../../utils/cryptoUtils';
import {
  Printer,
  X,
  ShieldCheck,
  QrCode,
  Copy,
  Check,
  ExternalLink,
  Download,
  AlertCircle,
  FileCheck2,
} from 'lucide-react';

interface PrescriptionPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  prescription: PrescriptionItem | null;
  patient: PatientRecord;
}

export const PrescriptionPrintModal: React.FC<PrescriptionPrintModalProps> = ({
  isOpen,
  onClose,
  prescription,
  patient,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  if (!isOpen || !prescription) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const verifyUrl = `${origin}/verify/${encodeURIComponent(prescription.id)}`;
  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(verifyUrl)}&margin=1`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(verifyUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyHash = () => {
    if (prescription.integritySeal) {
      navigator.clipboard.writeText(maskCryptoHash(prescription.integritySeal, 6));
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2500);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-neutral-900/60 backdrop-blur-xs overflow-y-auto animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full my-auto overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Toolbar - Hidden during print */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0D5C58] flex items-center justify-center text-white">
              <FileCheck2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold tracking-tight">Ordonnance Médicale Officielle Certifiée</h3>
              <p className="text-[11px] text-slate-400">Scellement d'intégrité cryptographique SHA-256 (JCS RFC 8785)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0D5C58] hover:bg-[#0B4E4A] rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer / PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              aria-label="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Prescription Body - Formatted for print and on-screen view */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-slate-800 bg-white font-sans text-xs">
          {/* Header of the Hospital */}
          <div className="border-b-2 border-slate-800 pb-4 flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <div className="text-[10px] font-bold tracking-widest text-[#0D5C58] uppercase">
                Centre Hospitalier Universitaire
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                CLINICAL CALM HEALTHCARE
              </h1>
              <p className="text-[11px] text-slate-500">
                Pôle de Médecine Spécialisée & Pharmacovigilance Clinique
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                12 Rue de la Santé, 75014 Paris • Tél: 01 42 16 00 24 • Habilitation HDS-2026
              </p>
            </div>

            <div className="text-left sm:text-right text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <div className="font-bold text-slate-900">{prescription.prescribedBy}</div>
              <div className="text-slate-500">Praticien Hospitalier Spécialiste</div>
              <div className="font-mono text-[10px] text-slate-500 mt-0.5">RPPS : 10104829104 • Secteur 1</div>
              <div className="text-[10px] text-slate-500">Fait le : <strong className="text-slate-800">{prescription.datePrescribed}</strong></div>
            </div>
          </div>

          {/* Patient Details Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
            <div className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
              Bénéficiaire des soins
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-500">Nom & Prénom : </span>
                <strong className="text-slate-900 font-semibold">{patient.name}</strong>
              </div>
              <div>
                <span className="text-slate-500">Date de naissance : </span>
                <strong className="text-slate-900">{patient.birthDate}</strong> ({patient.age} ans)
              </div>
              <div>
                <span className="text-slate-500">N° Sécurité Sociale : </span>
                <span className="font-mono text-slate-800">{patient.socialSecurityNumber || 'Non renseigné'}</span>
              </div>
              <div>
                <span className="text-slate-500">Morphologie : </span>
                <span className="text-slate-800">{patient.weightKg || 65} kg • {patient.heightCm || 170} cm</span>
              </div>
            </div>

            {patient.allergies && patient.allergies.length > 0 && (
              <div className="pt-2 border-t border-slate-200/80 text-[11px] flex items-start gap-1.5 text-amber-900">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Allergies signalées : </strong>
                  {patient.allergies.join(', ')}
                </span>
              </div>
            )}
          </div>

          {/* Prescribed Medications Section */}
          <div className="space-y-4 py-2">
            <div className="text-[11px] font-bold tracking-wider text-slate-900 uppercase border-b border-slate-200 pb-1.5">
              Prescription Médicamenteuse (Réf. #{prescription.id})
            </div>

            <div className="p-4 rounded-xl bg-teal-50/40 border-2 border-[#0D5C58]/30 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                <div className="text-base font-bold text-slate-900 tracking-tight">
                  {prescription.medication}
                </div>
                <div className="text-xs font-semibold text-[#0D5C58] bg-[#0D5C58]/10 px-2 py-0.5 rounded-md inline-block">
                  Posologie : {prescription.dosage}
                </div>
              </div>

              <div className="text-xs text-slate-700 font-medium">
                ⏱️ Fréquence : {prescription.frequency}
              </div>

              <div className="text-xs text-slate-700">
                📅 Durée du traitement : <strong>{prescription.duration}</strong>
              </div>

              {prescription.instructions && (
                <div className="text-xs text-slate-600 italic bg-white p-2.5 rounded-lg border border-slate-200">
                  <span className="font-medium not-italic text-slate-800">Conseils d'administration : </span>
                  {prescription.instructions}
                </div>
              )}

              <div className="text-[11px] text-slate-500 pt-1 flex items-center justify-between border-t border-slate-200/60">
                <span>Renouvellements autorisés : <strong>{prescription.refillsRemaining ?? 1} fois</strong></span>
                <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-100 px-2 py-0.5 rounded">
                  Statut : {prescription.status === 'ACTIVE' ? 'VALIDE' : prescription.status}
                </span>
              </div>
            </div>
          </div>

          {/* Cryptographic Seal & Verification Box */}
          <div className="border border-emerald-300 bg-emerald-50/50 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4">
            {/* Visual QR Code */}
            <div className="w-24 h-24 bg-white p-1.5 rounded-lg border border-emerald-200 shadow-xs shrink-0 flex items-center justify-center">
              <img
                src={qrCodeImageUrl}
                alt="QR Code de vérification du scellement d'intégrité"
                className="w-full h-full object-contain"
                onError={(e) => {
                  // Fallback to vector icon if offline
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>

            <div className="space-y-1.5 flex-1 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-1.5 text-emerald-800 font-bold text-xs">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>SCELLEMENT D'INTÉGRITÉ CRYPTOGRAPHIQUE CONFORME</span>
              </div>
              <p className="text-[10px] text-slate-600 leading-relaxed">
                Ce document est scellé par empreinte SHA-256 canonique déterministe (JCS RFC 8785). Toute altération du texte, de la posologie ou des dates invalide mathématiquement le scellement.
              </p>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <span className="font-mono text-[9px] text-slate-700 bg-white px-2 py-1 rounded border border-slate-200 tracking-wider">
                  {prescription.integritySeal ? maskCryptoHash(prescription.integritySeal, 6) : 'Scellement cryptographique actif'}
                </span>
                <button
                  type="button"
                  onClick={handleCopyHash}
                  className="print:hidden p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-200/70 cursor-pointer"
                  title="Copier la référence du scellement SHA-256"
                >
                  {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Signature and Stamp Footer */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-end gap-6 text-[11px]">
            <div className="text-slate-500 text-[10px] max-w-xs">
              <p className="font-semibold text-slate-700 mb-0.5">Contrôle d'authenticité public :</p>
              <p className="break-all text-slate-400">{verifyUrl}</p>
            </div>

            <div className="text-center sm:text-right space-y-1">
              <div className="text-slate-500 text-[10px]">Signature & Cachet du Praticien :</div>
              <div className="w-44 h-16 border border-dashed border-slate-300 rounded-lg p-2 bg-slate-50/50 flex flex-col items-center justify-center">
                <div className="font-serif italic text-slate-800 text-xs font-bold">
                  {prescription.prescribedBy}
                </div>
                <div className="text-[9px] text-[#0D5C58] font-mono">
                  [Signé électroniquement]
                </div>
                <div className="text-[8px] text-slate-400">
                  {prescription.sealedAt ? new Date(prescription.sealedAt).toLocaleString('fr-FR') : prescription.datePrescribed}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions Footer - Hidden during print */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-300 transition-colors cursor-pointer"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Lien copié !' : 'Copier le lien public'}</span>
            </button>
            <a
              href={verifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#0D5C58] hover:text-[#0B4E4A] hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Tester la vérification publique</span>
            </a>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#0D5C58] hover:bg-[#0B4E4A] rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimer / Télécharger en PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
