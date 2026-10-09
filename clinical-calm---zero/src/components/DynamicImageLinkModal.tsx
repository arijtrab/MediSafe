import React, { useState, useEffect } from 'react';
import { MedicalScan, UserProfile } from '../types/clinical';
import { extractImagesFromHtml } from '../utils/cryptoUtils';
import { SAMPLE_HTML_SNIPPETS } from '../data/mockClinicalData';
import { canPerformClinicalAction } from '../utils/authorization';
import { X, Sparkles, Check, Link2, Code, Eye, Image } from 'lucide-react';

interface DynamicImageLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  targetPatientId?: string;
  targetPatientName?: string;
  onAddScan: (scan: MedicalScan) => void;
  onUnauthorizedAction?: (actionName: string) => void;
}

export const DynamicImageLinkModal: React.FC<DynamicImageLinkModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  targetPatientId = 'PAT-2026-001',
  targetPatientName = 'Julien Moreau',
  onAddScan,
  onUnauthorizedAction,
}) => {
  const [htmlInput, setHtmlInput] = useState('');
  const [detectedUrl, setDetectedUrl] = useState('');
  const [altText, setAltText] = useState('');
  const [title, setTitle] = useState('Nouvelle Coupe Imagerie');
  const [modality, setModality] = useState<'CT' | 'IRM' | 'ÉCHOGRAPHIE' | 'RADIOGRAPHIE'>('CT');
  const [bodyPart, setBodyPart] = useState('Thorax & Poumons');
  const [generatedHtmlCode, setGeneratedHtmlCode] = useState('');
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  // Reset form state when modal opens
  useEffect(() => {
    if (isOpen) {
      setHtmlInput('');
      setDetectedUrl('');
      setAltText('');
      setTitle('Nouvelle Coupe Imagerie');
      setModality('CT');
      setBodyPart('Thorax & Poumons');
      setGeneratedHtmlCode('');
      setCopiedHtml(false);
      setPreviewError(false);
    }
  }, [isOpen]);

  // Parse HTML input
  useEffect(() => {
    if (!htmlInput.trim()) {
      setDetectedUrl('');
      return;
    }

    const extracted = extractImagesFromHtml(htmlInput);
    if (extracted.length > 0) {
      const first = extracted[0];
      setDetectedUrl(first.url);
      setPreviewError(false);
      if (first.altText && first.altText !== 'Image importée depuis HTML') {
        setAltText(first.altText);
        setTitle(first.altText);
      }
    } else {
      setDetectedUrl(htmlInput.trim());
    }
  }, [htmlInput]);

  // Generate dynamic HTML snippet
  useEffect(() => {
    if (!detectedUrl) {
      setGeneratedHtmlCode('');
      return;
    }

    const htmlSnippet = `<figure class="cliche-medical">\n  <img \n    src="${detectedUrl}" \n    alt="${altText || title}" \n    referrerpolicy="no-referrer" \n  />\n  <figcaption>${title} — Service de Radiologie</figcaption>\n</figure>`;
    setGeneratedHtmlCode(htmlSnippet);
  }, [detectedUrl, title, altText]);

  if (!isOpen) return null;

  const handleApplyPreset = (snippet: { label: string; code: string }) => {
    setHtmlInput(snippet.code);
  };

  const handleCopyGeneratedHtml = async () => {
    try {
      await navigator.clipboard.writeText(generatedHtmlCode);
      setCopiedHtml(true);
      setTimeout(() => setCopiedHtml(false), 2000);
    } catch {
      setCopiedHtml(true);
      setTimeout(() => setCopiedHtml(false), 2000);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!detectedUrl) return;

    // RBAC: verify that currentUser is authorized to add a clinical scan
    if (!canPerformClinicalAction(currentUser)) {
      onUnauthorizedAction?.('Ajout d\'imagerie médicale');
      onClose();
      return;
    }

    const newScanId = `SCAN-${Date.now().toString().slice(-4)}`;
    const newScan: MedicalScan = {
      id: newScanId,
      patientId: targetPatientId,
      patientName: targetPatientName,
      title: title || 'Nouvelle Coupe Imagerie',
      modality: modality,
      bodyPart: bodyPart || 'Région Anatomique',
      studyDate: new Date().toLocaleDateString('fr-FR') + ' ' + new Date().toLocaleTimeString('fr-FR').slice(0, 5),
      acquisitionDevice: 'Import Web / Passerelle Imagerie',
      imageUrl: detectedUrl,
      isExternalLink: true,
      findings: 'Cliché médical importé et intégré au dossier patient.',
      radiologistNote: `Intégration validée par ${currentUser.name}.`,
      status: 'VALIDÉ',
    };

    onAddScan(newScan);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 animate-fade-in" role="dialog" aria-modal="true" aria-label="Ajouter une imagerie médicale" onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between bg-[#F9FAFB]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#E6F4F3] border border-[#99D3CF] flex items-center justify-center text-[#0D5C58]">
              <Link2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#111827]">
                Ajouter une Imagerie Médicale au Dossier de {targetPatientName}
              </h2>
              <p className="text-xs text-[#6B7280]">
                Collez du code HTML (&lt;img src="..." /&gt;) ou une URL directe pour intégrer ce cliché
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#6B7280] hover:text-[#111827] rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Presets */}
          <div>
            <label className="text-xs font-semibold text-[#374151] flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-[#0D5C58]" />
              Modèles HTML prêts à l'emploi :
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {SAMPLE_HTML_SNIPPETS.map((snippet, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(snippet)}
                  className="text-left p-2.5 rounded-lg border border-[#E5E7EB] hover:border-[#0D5C58] bg-[#F9FAFB] hover:bg-[#E6F4F3] transition-colors text-xs"
                >
                  <div className="font-semibold text-[#0D5C58] truncate">{snippet.label}</div>
                  <div className="text-[10px] text-[#6B7280] mt-0.5">Charger le code HTML</div>
                </button>
              ))}
            </div>
          </div>

          {/* Input text */}
          <div>
            <label className="block text-xs font-semibold text-[#111827] mb-1">
              Code HTML avec balise &lt;img src="..." /&gt; ou URL directe :
            </label>
            <textarea
              value={htmlInput}
              onChange={(e) => setHtmlInput(e.target.value)}
              placeholder={`Exemple :\n<figure>\n  <img src="https://..." alt="Scanner Thorax" />\n</figure>`}
              rows={3}
              className="w-full font-mono text-xs p-3 rounded-lg border border-[#D1D5DB] focus:outline-none focus:border-[#0D5C58]"
            />
          </div>

          {/* Live Preview */}
          {detectedUrl && (
            <div className="p-4 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] flex items-center gap-4">
              <div className="w-20 h-20 rounded-lg bg-neutral-900 overflow-hidden shrink-0 border border-[#E5E7EB] flex items-center justify-center">
                {!previewError ? (
                  <img
                    src={detectedUrl}
                    alt="Aperçu"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={() => setPreviewError(true)}
                  />
                ) : (
                  <Image className="w-6 h-6 text-neutral-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-[#065F46] flex items-center gap-1 mb-1">
                  <Check className="w-3.5 h-3.5" /> Image reconnue avec succès
                </div>
                <div className="text-xs text-[#6B7280] truncate font-mono bg-white p-1.5 rounded border border-[#E5E7EB]">
                  {detectedUrl}
                </div>
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">Titre de l'examen :</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full h-10 px-3 text-xs rounded-lg border border-[#D1D5DB]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1">Modalité :</label>
              <select
                value={modality}
                onChange={(e) => setModality(e.target.value as 'CT' | 'IRM' | 'ÉCHOGRAPHIE' | 'RADIOGRAPHIE')}
                className="w-full h-10 px-3 text-xs rounded-lg border border-[#D1D5DB] bg-white"
              >
                <option value="CT">Scanner (CT)</option>
                <option value="IRM">IRM</option>
                <option value="ÉCHOGRAPHIE">Échographie</option>
                <option value="RADIOGRAPHIE">Radiographie</option>
              </select>
            </div>
          </div>

          {/* Generated HTML Code */}
          {generatedHtmlCode && (
            <div className="p-3 rounded-lg border border-[#99D3CF] bg-[#E6F4F3]/30 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#0D5C58] flex items-center gap-1">
                  <Code className="w-3.5 h-3.5" />
                  Code HTML généré :
                </span>
                <button
                  type="button"
                  onClick={handleCopyGeneratedHtml}
                  className="px-2.5 py-1 text-xs font-semibold bg-white border border-[#99D3CF] text-[#0D5C58] rounded hover:bg-[#E6F4F3]"
                >
                  {copiedHtml ? 'Copié !' : 'Copier'}
                </button>
              </div>
              <pre className="p-2 bg-white rounded border border-[#E5E7EB] font-mono text-[11px] overflow-x-auto text-[#111827]">
                {generatedHtmlCode}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E5E7EB] bg-[#F9FAFB] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-4 text-xs font-medium text-[#374151] border border-[#D1D5DB] rounded-lg hover:bg-[#F3F4F6]"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!detectedUrl}
            className="min-h-[40px] px-5 text-xs font-bold text-white bg-[#0D5C58] hover:bg-[#0B4E4A] disabled:opacity-40 rounded-lg inline-flex items-center gap-2"
          >
            <Eye className="w-4 h-4" />
            Ajouter au Dossier
          </button>
        </div>
      </div>
    </div>
  );
};
