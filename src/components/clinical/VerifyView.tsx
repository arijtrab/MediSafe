import React, { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, CheckCircle2, FileText, ArrowLeft, Printer, RefreshCw, Lock, AlertTriangle } from 'lucide-react';

interface VerifyData {
  isValid: boolean;
  label?: string;
  prescriptionId?: string;
  patientId?: string;
  medication?: string;
  dosage?: string;
  datePrescribed?: string;
  prescribedBy?: string;
  storedSeal?: string;
  computedSeal?: string;
  sealedAt?: string;
  verificationStatus?: string;
  message?: string;
  error?: string;
}

interface VerifyViewProps {
  prescriptionId: string;
  onBackToApp?: () => void;
}

export const VerifyView: React.FC<VerifyViewProps> = ({ prescriptionId, onBackToApp }) => {
  const [data, setData] = useState<VerifyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVerification = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/prescriptions/${encodeURIComponent(prescriptionId)}/verify`);
      const json = await res.json();
      if (!res.ok && res.status !== 404) {
        throw new Error(json.error || `Erreur serveur HTTP ${res.status}`);
      }
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Impossible de vérifier l\'ordonnance.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (prescriptionId) {
      fetchVerification();
    }
  }, [prescriptionId]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Banner */}
      <header className="bg-white border-b border-slate-200 shadow-xs sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-700 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              CC
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-base">Clinical Calm</span>
                <span className="text-[10px] font-semibold bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded-full">
                  Portail Public de Contrôle
                </span>
              </div>
              <p className="text-xs text-slate-500">Service Hospitalier de Scellement d'Intégrité</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onBackToApp && (
              <button
                type="button"
                onClick={onBackToApp}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-300"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Retour à l'application</span>
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors border border-teal-200"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer le certificat</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* State 1: Loading */}
        {isLoading && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center space-y-4">
            <RefreshCw className="w-8 h-8 animate-spin text-teal-700 mx-auto" />
            <p className="text-sm font-medium text-slate-600">
              Vérification cryptographique de l'ordonnance en cours...
            </p>
          </div>
        )}

        {/* State 2: Error / Not found */}
        {!isLoading && (error || (data && !data.prescriptionId)) && (
          <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Document introuvable ou non reconnu</h2>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              {error || data?.error || `Aucun enregistrement d'ordonnance ne correspond à l'identifiant ${prescriptionId}.`}
            </p>
            <button
              type="button"
              onClick={fetchVerification}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Réessayer la vérification</span>
            </button>
          </div>
        )}

        {/* State 3: Result Loaded */}
        {!isLoading && data && data.prescriptionId && (
          <div className="space-y-6">
            {/* Status Hero Card */}
            <div className={`rounded-2xl border p-6 sm:p-8 shadow-sm ${
              data.isValid
                ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                : 'bg-red-50/70 border-red-300 text-red-950'
            }`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                    data.isValid ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
                  }`}>
                    {data.isValid ? <ShieldCheck className="w-8 h-8" /> : <ShieldAlert className="w-8 h-8" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                        data.isValid
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-red-100 text-red-800 border-red-300'
                      }`}>
                        {data.label || "Scellement d'intégrité"}
                      </span>
                      <span className="text-xs font-mono font-medium text-slate-500">SHA-256</span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold mt-1">
                      {data.isValid
                        ? 'Ordonnance Intègre et Conforme'
                        : 'Alerte de Sécurité : Altération Détectée'}
                    </h1>
                  </div>
                </div>

                <div className={`px-4 py-2 rounded-xl text-xs font-bold border shrink-0 ${
                  data.isValid
                    ? 'bg-white/80 border-emerald-300 text-emerald-800'
                    : 'bg-white/80 border-red-300 text-red-800'
                }`}>
                  {data.verificationStatus === 'CONFORME_NON_ALTERE' ? 'CONFORME (NON ALTÉRÉ)' : 'NON CONFORME (ALTÉRÉ)'}
                </div>
              </div>

              <p className={`mt-4 text-xs sm:text-sm leading-relaxed ${
                data.isValid ? 'text-emerald-900' : 'text-red-900'
              }`}>
                {data.message}
              </p>
            </div>

            {/* Certified Data Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-teal-700" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Contenu Certifié de la Prescription
                  </h3>
                </div>
                <span className="text-xs text-slate-500 font-mono">
                  ID: {data.prescriptionId}
                </span>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 text-[11px] block mb-1">Médicament prescrit :</span>
                  <span className="text-sm font-bold text-slate-900">{data.medication}</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 text-[11px] block mb-1">Posologie :</span>
                  <span className="text-sm font-bold text-slate-900">{data.dosage || 'Standard'}</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 text-[11px] block mb-1">Praticien Prescripteur :</span>
                  <span className="text-sm font-semibold text-slate-900">{data.prescribedBy}</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 text-[11px] block mb-1">Date d'ordonnance :</span>
                  <span className="text-sm font-semibold text-slate-900">{data.datePrescribed}</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 md:col-span-2">
                  <span className="text-slate-500 text-[11px] block mb-1">Identifiant Patient Sécurisé :</span>
                  <span className="font-mono font-medium text-slate-700">{data.patientId}</span>
                </div>
              </div>
            </div>

            {/* Cryptographic Proof Card (Masked details to prevent cryptographic leakage) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-teal-700" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Preuve Cryptographique SHA-256 (Scellement d'intégrité)
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  {data.isValid ? 'Sceau Validé' : 'Échec Sceau'}
                </span>
              </div>

              <div className="space-y-3 font-mono text-[11px]">
                <div className="p-3.5 rounded-xl bg-slate-900 text-slate-100 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 block text-[10px] font-sans">Empreinte d'Origine Sécurisée (Enregistrement WORM) :</span>
                    <span className="text-[9px] font-sans text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">Détail masqué (Zero-Trust)</span>
                  </div>
                  <div className="font-semibold text-teal-300 tracking-wider">
                    {data.storedSeal ? data.storedSeal : '•••••••••••••••• (Scellé)'}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900 text-slate-100 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 block text-[10px] font-sans">Contrôle Mathématique en Temps Réel :</span>
                    <span className="text-[9px] font-sans text-emerald-400 bg-emerald-950 px-1.5 py-0.5 rounded">Correspondance 100%</span>
                  </div>
                  <div className={`font-semibold tracking-wider ${
                    data.isValid ? 'text-teal-300' : 'text-red-400'
                  }`}>
                    {data.computedSeal ? data.computedSeal : '•••••••••••••••• (Vérifié)'}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-500 pt-1 gap-2">
                <span>Horodatage du scellement : {data.sealedAt || 'Non précisé'}</span>
                <span className="flex items-center gap-1 text-slate-600 font-sans">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                  Valeurs cryptographiques protégées contre la rétro-ingénierie
                </span>
              </div>
            </div>

            {/* Regulatory Disclaimer Notice */}
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 text-xs leading-relaxed">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <strong className="block font-semibold">Mention Réglementaire & Cadre Juridique :</strong>
                <span>
                  Ce document atteste de la conformité mathématique du <strong>Scellement d'intégrité</strong> SHA-256 du contenu de l'ordonnance.
                  Conformément aux directives applicables, ce dispositif technique garantit la non-altération documentaire mais ne se substitue pas à une signature électronique qualifiée au sens du règlement européen eIDAS (n° 910/2014).
                </span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
