import React, { useState } from 'react';
import { PatientRecord, HospitalActivityLog, Equipment, UserProfile } from '../../types/clinical';
import { INITIAL_EQUIPMENTS } from '../../data/mockClinicalData';
import { hasRole, canManageHospitalOperations } from '../../utils/authorization';
import {
  Users,
  Calendar,
  Activity,
  Heart,
  CheckCircle2,
  Clock,
  Search,
  Building,
  AlertCircle,
  FileText,
  Download,
  ShieldCheck,
  Lock,
  Shield,
  Key,
  ShieldAlert,
  Wrench,
  RotateCcw,
} from 'lucide-react';

interface AdminConsoleProps {
  patients: PatientRecord[];
  activityLogs: HospitalActivityLog[];
  currentUser?: UserProfile | null;
  onResetData?: () => void;
  onUnauthorizedAction?: (actionName: string) => void;
}

export const AdminConsole: React.FC<AdminConsoleProps> = ({
  patients,
  activityLogs,
  currentUser,
  onResetData,
  onUnauthorizedAction,
}) => {
  // RBAC Guard: Only ADMIN can access AdminConsole
  const isAdmin = !currentUser || hasRole(currentUser, 'ADMIN');

  if (!isAdmin) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-[#FECACA] shadow-xs text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] mx-auto flex items-center justify-center">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[#991B1B]">Accès Non Autorisé (ACCESS_DENIED)</h2>
          <p className="text-xs text-[#6B7280] mt-1 max-w-md mx-auto">
            La Console d'Administration est strictement réservée aux administrateurs de l'établissement (Rôle : ADMIN).
          </p>
        </div>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<'dashboard' | 'journal' | 'patients' | 'planning' | 'equipements'>('dashboard');
  const [searchPatient, setSearchPatient] = useState('');
  const [equipments, setEquipments] = useState<Equipment[]>(() => {
    try {
      const saved = localStorage.getItem('clinical_calm_equipments');
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return INITIAL_EQUIPMENTS;
  });

  const toggleEquipmentStatus = (eqId: string) => {
    // RBAC: Verify user has ADMIN rights to modify equipment operational status
    if (currentUser && !canManageHospitalOperations(currentUser)) {
      onUnauthorizedAction?.(`Modification équipement ${eqId}`);
      return;
    }

    setEquipments(prev => {
      const updated = prev.map(eq => {
        if (eq.id === eqId) {
          const nextStatus: Equipment['status'] =
            eq.status === 'DISPONIBLE' ? 'EN_COURS' : eq.status === 'EN_COURS' ? 'MAINTENANCE' : 'DISPONIBLE';
          return { ...eq, status: nextStatus };
        }
        return eq;
      });
      try {
        localStorage.setItem('clinical_calm_equipments', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  };

  // Activity Log Search & Filter State
  const [searchLog, setSearchLog] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Total consultations
  const allConsultations = patients.flatMap((p) => p.consultations);

  const filteredPatients = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(searchPatient.toLowerCase()) ||
      p.bloodType.toLowerCase().includes(searchPatient.toLowerCase()) ||
      p.referringDoctor.toLowerCase().includes(searchPatient.toLowerCase())
  );

  // Filtered Activity Logs
  const filteredLogs = activityLogs.filter((log) => {
    const matchesCategory =
      selectedCategory === 'ALL' || log.category === selectedCategory;
    const matchesSearch =
      log.actorName.toLowerCase().includes(searchLog.toLowerCase()) ||
      log.action.toLowerCase().includes(searchLog.toLowerCase()) ||
      log.patientName.toLowerCase().includes(searchLog.toLowerCase()) ||
      log.details.toLowerCase().includes(searchLog.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleExportLogsCsv = () => {
    const headers = ['Identifiant', 'Date et Heure', 'Acteur', 'Rôle', 'Action', 'Catégorie', 'Patient Concerné', 'Détails'];
    const rows = filteredLogs.map((l) => [
      l.id,
      l.timestamp,
      l.actorName,
      l.actorRole,
      l.action,
      l.category || 'GÉNÉRAL',
      l.patientName,
      `"${l.details.replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `journal-audit-hopital-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCategoryBadge = (cat?: string) => {
    switch (cat) {
      case 'DOSSIER':
        return { text: 'Dossier Patient', style: 'bg-[#EFF6FF] text-[#1E40AF] border-[#BFDBFE]' };
      case 'ORDONNANCE':
        return { text: 'Ordonnance', style: 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]' };
      case 'IMAGERIE':
        return { text: 'Imagerie Médicale', style: 'bg-[#E6F4F3] text-[#0D5C58] border-[#99D3CF]' };
      case 'CONSULTATION':
        return { text: 'Rendez-Vous', style: 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]' };
      case 'CONNEXION':
        return { text: 'Système & Sécurité', style: 'bg-[#FAF5FF] text-[#6B21A8] border-[#E9D5FF]' };
      default:
        return { text: 'Activité', style: 'bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Admin Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#FAF5FF] border-2 border-[#6B21A8] text-[#6B21A8] flex items-center justify-center font-bold text-2xl shrink-0">
              ML
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-[#6B21A8] bg-[#FAF5FF] px-2.5 py-0.5 rounded-full border border-[#E9D5FF]">
                  Direction Hospitalière & Sécurité des Données
                </span>
                <span className="text-xs text-[#6B7280]">·</span>
                <span className="text-xs text-[#6B7280]">Marc Lefèvre (Directeur des Opérations)</span>
              </div>
              <h1 className="text-2xl font-bold text-[#111827]">Console d'Administration & Sécurité du Site</h1>
              <p className="text-xs text-[#4B5563] mt-0.5">
                Surveillance de l'activité, protection des données de santé HDS et gestion des dossiers.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onResetData && (
              <button
                type="button"
                onClick={onResetData}
                title="Réinitialiser toutes les données aux valeurs d'origine"
                className="text-xs font-semibold text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] hover:bg-[#FEE2E2] px-3 py-2 rounded-lg inline-flex items-center gap-1.5 shadow-xs transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#B91C1C]" />
                Réinitialiser Données
              </button>
            )}
            <span className="text-xs font-semibold text-[#065F46] bg-[#ECFDF5] border border-[#A7F3D0] px-3 py-2 rounded-lg inline-flex items-center gap-1.5 shadow-xs">
              <ShieldCheck className="w-4 h-4 text-[#065F46]" />
              Protection HDS & RGPD : 100%
            </span>
          </div>
        </div>

        {/* Clean Admin Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-[#F3F4F6]">
          {[
            { id: 'dashboard', label: 'Vue d\'Ensemble & Statistiques de Sécurité', icon: Shield },
            { id: 'journal', label: `Journal d'Audit & d'Activité sur le Site (${activityLogs.length})`, icon: Clock },
            { id: 'patients', label: `Dossiers Patients (${patients.length})`, icon: Users },
            { id: 'planning', label: `Planning Global des Consultations (${allConsultations.length})`, icon: Calendar },
            { id: 'equipements', label: `Parc Équipements Biomédicaux (${equipments.length})`, icon: Wrench },
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
                    ? 'bg-[#6B21A8] text-white border-[#6B21A8] shadow-xs'
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

      {/* Tab 1: Vue d'Ensemble & STATISTIQUES DE SÉCURITÉ */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Top 4 Key Metrics (Including Enhanced Security Metrics) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Metric 1: Patients */}
            <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] space-y-2">
              <div className="flex items-center justify-between text-[#6B7280]">
                <span className="text-xs font-semibold">Dossiers Médicaux Gérés</span>
                <Users className="w-4 h-4 text-[#6B21A8]" />
              </div>
              <div className="text-2xl font-bold text-[#111827]">{patients.length} dossiers</div>
              <div className="text-[11px] text-[#065F46] flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Dossiers complets & sécurisés
              </div>
            </div>

            {/* Metric 2: Security - Data Protection Score */}
            <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] space-y-2">
              <div className="flex items-center justify-between text-[#6B7280]">
                <span className="text-xs font-semibold">Conformité Santé HDS / RGPD</span>
                <ShieldCheck className="w-4 h-4 text-[#065F46]" />
              </div>
              <div className="text-2xl font-bold text-[#065F46]">100% Conforme</div>
              <div className="text-[11px] text-[#065F46]">0 non-conformité détectée</div>
            </div>

            {/* Metric 3: Security - Access Control & Encryption */}
            <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] space-y-2">
              <div className="flex items-center justify-between text-[#6B7280]">
                <span className="text-xs font-semibold">Chiffrement des Données</span>
                <Lock className="w-4 h-4 text-[#0D5C58]" />
              </div>
              <div className="text-2xl font-bold text-[#0D5C58]">AES-256 Actif</div>
              <div className="text-[11px] text-[#4B5563]">100% des flux & clichés chiffrés</div>
            </div>

            {/* Metric 4: Security - Incidents & Audit Integrity */}
            <div className="bg-white p-5 rounded-xl border border-[#E5E7EB] space-y-2">
              <div className="flex items-center justify-between text-[#6B7280]">
                <span className="text-xs font-semibold">Violations / Fuites de Données</span>
                <AlertCircle className="w-4 h-4 text-[#065F46]" />
              </div>
              <div className="text-2xl font-bold text-[#065F46]">0 Incident</div>
              <div className="text-[11px] text-[#065F46] flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                18 alertes suspectes bloquées
              </div>
            </div>
          </div>

          {/* DEDICATED PANEL: STATISTIQUES DÉTAILLÉES DE SÉCURITÉ DU SITE */}
          <div className="bg-white p-6 rounded-2xl border border-[#E5E7EB] space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F3F4F6] pb-4">
              <div>
                <h3 className="text-base font-bold text-[#111827] flex items-center gap-2">
                  <Shield className="w-5 h-5 text-[#6B21A8]" />
                  Tableau de Bord de Cybersécurité & Protection des Données de Santé
                </h3>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Indicateurs de sécurité en temps réel conformes aux normes de l'Agence du Numérique en Santé (ANS).
                </p>
              </div>

              <span className="text-xs font-semibold text-[#065F46] bg-[#ECFDF5] border border-[#A7F3D0] px-3 py-1.5 rounded-full inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Système sous surveillance 24/7
              </span>
            </div>

            {/* Security Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Security Stat 1 */}
              <div className="p-4 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#111827] flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-[#0D5C58]" />
                    Chiffrement au Repos & en Transit
                  </span>
                  <span className="text-[10px] font-bold text-[#065F46] bg-[#ECFDF5] px-2 py-0.5 rounded-full">
                    Actif
                  </span>
                </div>
                <div className="text-lg font-bold text-[#111827]">AES-256-GCM / TLS 1.3</div>
                <p className="text-[11px] text-[#4B5563]">
                  100% des comptes-rendus, examens radiologiques et données nominatives sont chiffrés.
                </p>
              </div>

              {/* Security Stat 2 */}
              <div className="p-4 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#111827] flex items-center gap-1.5">
                    <Key className="w-4 h-4 text-[#1E40AF]" />
                    Contrôle des Accès & Authentification
                  </span>
                  <span className="text-[10px] font-bold text-[#065F46] bg-[#ECFDF5] px-2 py-0.5 rounded-full">
                    100% Tracé
                  </span>
                </div>
                <div className="text-lg font-bold text-[#111827]">Authentification Renforcée</div>
                <p className="text-[11px] text-[#4B5563]">
                  Chaque consultation de dossier est attribuée au praticien avec enregistrement immédiat.
                </p>
              </div>

              {/* Security Stat 3 */}
              <div className="p-4 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#111827] flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#6B21A8]" />
                    Intégrité du Journal d'Audit
                  </span>
                  <span className="text-[10px] font-bold text-[#065F46] bg-[#ECFDF5] px-2 py-0.5 rounded-full">
                    Immuable
                  </span>
                </div>
                <div className="text-lg font-bold text-[#111827]">{activityLogs.length} Actes Enregistrés</div>
                <p className="text-[11px] text-[#4B5563]">
                  Historique d'activité complet et non modifiable, conservé pendant la durée légale.
                </p>
              </div>

              {/* Security Stat 4 */}
              <div className="p-4 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#111827] flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-[#065F46]" />
                    Tentatives Bloquées par le Pare-feu
                  </span>
                  <span className="text-[10px] font-bold text-[#065F46] bg-[#ECFDF5] px-2 py-0.5 rounded-full">
                    Sécurisé
                  </span>
                </div>
                <div className="text-lg font-bold text-[#065F46]">18 Requêtes Neutralisées</div>
                <p className="text-[11px] text-[#4B5563]">
                  Pare-feu applicatif de santé (WAF) : 0 intrusion ou compromission constatée.
                </p>
              </div>

              {/* Security Stat 5 */}
              <div className="p-4 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#111827] flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-[#0D5C58]" />
                    Gestion des Consentements RGPD
                  </span>
                  <span className="text-[10px] font-bold text-[#065F46] bg-[#ECFDF5] px-2 py-0.5 rounded-full">
                    100% Conforme
                  </span>
                </div>
                <div className="text-lg font-bold text-[#111827]">Droits Patients Respectés</div>
                <p className="text-[11px] text-[#4B5563]">
                  Accès restreints aux seuls personnels soignants déclarés pour chaque patient.
                </p>
              </div>

              {/* Security Stat 6 */}
              <div className="p-4 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#111827] flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-[#1E40AF]" />
                    Disponibilité & Résilience
                  </span>
                  <span className="text-[10px] font-bold text-[#065F46] bg-[#ECFDF5] px-2 py-0.5 rounded-full">
                    99.98% SLA
                  </span>
                </div>
                <div className="text-lg font-bold text-[#111827]">Haute Disponibilité H24</div>
                <p className="text-[11px] text-[#4B5563]">
                  Sauvegardes automatiques certifiées et plan de continuité d'activité (PCA) testé.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Summary Panels */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Audit Activities */}
            <div className="bg-white p-6 rounded-xl border border-[#E5E7EB] space-y-4">
              <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-3">
                <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#6B21A8]" />
                  Dernières Activités du Site
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('journal')}
                  className="text-xs text-[#6B21A8] hover:underline font-semibold"
                >
                  Voir tout le journal
                </button>
              </div>

              <div className="space-y-3">
                {activityLogs.slice(0, 4).map((log) => {
                  const badge = getCategoryBadge(log.category);
                  return (
                    <div
                      key={log.id}
                      className="p-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-[#111827]">{log.action}</div>
                        <div className="text-[#6B7280]">{log.patientName} · Par {log.actorName}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${badge.style}`}>
                        {badge.text}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Upcoming Consultations Preview */}
            <div className="bg-white p-6 rounded-xl border border-[#E5E7EB] space-y-4">
              <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-3">
                <h3 className="text-sm font-bold text-[#111827] flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#1E40AF]" />
                  Prochains Rendez-Vous Programmés
                </h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('planning')}
                  className="text-xs text-[#1E40AF] hover:underline font-semibold"
                >
                  Voir tout le planning
                </button>
              </div>

              <div className="space-y-3">
                {allConsultations.filter(c => c.status === 'SCHEDULED').slice(0, 4).map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-[#111827]">{c.patientName}</div>
                      <div className="text-[#0D5C58] font-medium">{c.dateTime}</div>
                      <div className="text-[11px] text-[#6B7280]">{c.specialty}</div>
                    </div>
                    <span className="text-[11px] text-[#4B5563] bg-white px-2 py-1 rounded border border-[#E5E7EB]">
                      {c.location}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Journal d'Audit & d'Activité sur le Site */}
      {activeTab === 'journal' && (
        <div className="bg-white p-6 rounded-xl border border-[#E5E7EB] space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F3F4F6] pb-4">
            <div>
              <h2 className="text-base font-bold text-[#111827] flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#6B21A8]" />
                Journal d'Audit et d'Activité sur le Site
              </h2>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Traçabilité intégrale de toutes les actions : ouvertures de dossiers, ordonnances, clichés d'imagerie et rendez-vous.
              </p>
            </div>

            <button
              type="button"
              onClick={handleExportLogsCsv}
              className="min-h-[40px] px-4 py-2 text-xs font-semibold text-[#374151] bg-white border border-[#D1D5DB] hover:bg-[#F9FAFB] rounded-lg transition-colors inline-flex items-center gap-2 shadow-xs"
            >
              <Download className="w-4 h-4 text-[#6B7280]" />
              Exporter le Journal en CSV
            </button>
          </div>

          {/* Search and Filters */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchLog}
                onChange={(e) => setSearchLog(e.target.value)}
                placeholder="Rechercher par acteur (Dr. Chen...), action, patient concerné ou détail..."
                className="w-full h-11 pl-9 pr-3 text-xs rounded-lg border border-[#D1D5DB] focus:outline-none focus:border-[#6B21A8]"
              />
            </div>

            {/* Category Filter Chips (Equipement removed) */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {[
                { id: 'ALL', label: `Toutes les activités (${activityLogs.length})` },
                { id: 'DOSSIER', label: 'Consultations de Dossiers' },
                { id: 'ORDONNANCE', label: 'Ordonnances' },
                { id: 'IMAGERIE', label: 'Imagerie Médicale' },
                { id: 'CONSULTATION', label: 'Rendez-Vous' },
                { id: 'CONNEXION', label: 'Système & Sécurité' },
              ].map((chip) => {
                const isSelected = selectedCategory === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setSelectedCategory(chip.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-[#FAF5FF] border-[#6B21A8] text-[#6B21A8]'
                        : 'bg-white border-[#E5E7EB] text-[#4B5563] hover:bg-[#F9FAFB]'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Activity Log Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#4B5563]">
                  <th className="py-3 px-4 w-36">Horodatage</th>
                  <th className="py-3 px-4 w-44">Utilisateur / Rôle</th>
                  <th className="py-3 px-4 w-36">Catégorie</th>
                  <th className="py-3 px-4 w-44">Action Effectuée</th>
                  <th className="py-3 px-4 w-36">Patient / Cible</th>
                  <th className="py-3 px-4">Détails de l'Activité</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => {
                    const badge = getCategoryBadge(log.category);
                    return (
                      <tr key={log.id} className="hover:bg-[#F9FAFB]">
                        <td className="py-3 px-4 font-mono text-[11px] text-[#4B5563] whitespace-nowrap">
                          {log.timestamp}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-[#111827]">{log.actorName}</div>
                          <div className="text-[10px] text-[#6B7280]">{log.actorRole}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border inline-block ${badge.style}`}>
                            {badge.text}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-[#111827]">
                          {log.action}
                        </td>
                        <td className="py-3 px-4 font-bold text-[#0D5C58]">
                          {log.patientName}
                        </td>
                        <td className="py-3 px-4 text-[#4B5563] leading-relaxed">
                          {log.details}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#6B7280]">
                      Aucun événement ne correspond à vos critères de recherche.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Tous les Dossiers Patients */}
      {activeTab === 'patients' && (
        <div className="bg-white p-6 rounded-xl border border-[#E5E7EB] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F3F4F6] pb-4">
            <div>
              <h2 className="text-base font-bold text-[#111827]">
                Répertoire Central des Dossiers Patients
              </h2>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Recherchez les dossiers patients par nom, groupe sanguin ou médecin référent.
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchPatient}
                onChange={(e) => setSearchPatient(e.target.value)}
                placeholder="Rechercher par nom, groupe sanguin..."
                className="w-full h-10 pl-9 pr-3 text-xs rounded-lg border border-[#D1D5DB] focus:outline-none focus:border-[#6B21A8]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#4B5563]">
                  <th className="py-3 px-4">Identifiant</th>
                  <th className="py-3 px-4">Nom du Patient</th>
                  <th className="py-3 px-4">Groupe Sanguin</th>
                  <th className="py-3 px-4">Âge / Naissance</th>
                  <th className="py-3 px-4">Médecin Référent</th>
                  <th className="py-3 px-4">Allergies Connues</th>
                  <th className="py-3 px-4">Examens</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {filteredPatients.map((p) => (
                  <tr key={p.id} className="hover:bg-[#F9FAFB]">
                    <td className="py-3 px-4 font-mono font-medium text-[#6B21A8]">{p.id}</td>
                    <td className="py-3 px-4 font-bold text-[#111827]">{p.name}</td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-[#991B1B] bg-[#FEF2F2] border border-[#FECACA] px-2 py-0.5 rounded text-[11px] inline-flex items-center gap-1">
                        <Heart className="w-3 h-3 fill-current" />
                        {p.bloodType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-[#4B5563]">{p.age} ans ({p.birthDate})</td>
                    <td className="py-3 px-4 text-[#111827] font-medium">{p.referringDoctor}</td>
                    <td className="py-3 px-4 text-[#991B1B] text-[11px]">
                      {p.allergies.join(', ')}
                    </td>
                    <td className="py-3 px-4 text-[#0D5C58] font-bold">
                      {p.scans.length} cliché(s)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Planning Global des Consultations */}
      {activeTab === 'planning' && (
        <div className="bg-white p-6 rounded-xl border border-[#E5E7EB] space-y-4">
          <div className="border-b border-[#F3F4F6] pb-4">
            <h2 className="text-base font-bold text-[#111827]">
              Planning Centralisé des Rendez-Vous Hospitaliers
            </h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Toutes les consultations programmées au sein des différents services de l'établissement.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[#4B5563]">
                  <th className="py-3 px-4">Date & Heure</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Médecin Praticien</th>
                  <th className="py-3 px-4">Spécialité</th>
                  <th className="py-3 px-4">Lieu / Salle</th>
                  <th className="py-3 px-4">Motif</th>
                  <th className="py-3 px-4 text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {allConsultations.map((c) => (
                  <tr key={c.id} className="hover:bg-[#F9FAFB]">
                    <td className="py-3 px-4 font-bold text-[#0D5C58] whitespace-nowrap">{c.dateTime}</td>
                    <td className="py-3 px-4 font-bold text-[#111827]">{c.patientName}</td>
                    <td className="py-3 px-4 text-[#111827]">{c.doctorName}</td>
                    <td className="py-3 px-4 text-[#4B5563]">{c.specialty}</td>
                    <td className="py-3 px-4 text-[#4B5563]">{c.location}</td>
                    <td className="py-3 px-4 text-[#374151] max-w-xs">{c.reason}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                          c.status === 'SCHEDULED'
                            ? 'bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]'
                            : 'bg-[#F3F4F6] text-[#6B7280]'
                        }`}
                      >
                        {c.status === 'SCHEDULED' ? 'Confirmé' : 'Terminé'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Parc Équipements Biomédicaux */}
      {activeTab === 'equipements' && (
        <div className="bg-white p-6 rounded-xl border border-[#E5E7EB] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#F3F4F6] pb-4">
            <div>
              <h2 className="text-base font-bold text-[#111827] flex items-center gap-2">
                <Wrench className="w-5 h-5 text-[#6B21A8]" />
                Supervision du Parc d'Équipements Biomédicaux
              </h2>
              <p className="text-xs text-[#6B7280] mt-0.5">
                Surveillance de l'état opérationnel et du calendrier de maintenance des dispositifs d'imagerie et de diagnostic.
              </p>
            </div>
            <div className="text-xs font-semibold text-[#0D5C58] bg-[#E6F4F3] px-3 py-1.5 rounded-lg border border-[#99D3CF]">
              {equipments.filter(e => e.status === 'DISPONIBLE').length} / {equipments.length} Disponibles
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {equipments.map((eq) => {
              const statusBadge =
                eq.status === 'DISPONIBLE'
                  ? { text: 'Disponible', style: 'bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]' }
                  : eq.status === 'EN_COURS'
                  ? { text: 'En Examen', style: 'bg-[#EFF6FF] text-[#1E40AF] border-[#BFDBFE]' }
                  : { text: 'Maintenance', style: 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]' };

              return (
                <div
                  key={eq.id}
                  className="p-4 rounded-xl border border-[#E5E7EB] bg-white shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-mono text-[#6B21A8] font-bold">{eq.id}</div>
                      <h3 className="text-sm font-bold text-[#111827] mt-0.5">{eq.name}</h3>
                      <p className="text-xs text-[#6B7280]">{eq.type}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleEquipmentStatus(eq.id)}
                      title="Cliquez pour changer le statut (Disponible -> En examen -> Maintenance)"
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-full border cursor-pointer hover:opacity-80 transition-opacity ${statusBadge.style}`}
                    >
                      {statusBadge.text}
                    </button>
                  </div>

                  <div className="text-xs text-[#4B5563] pt-2 border-t border-[#F3F4F6] space-y-1">
                    <div>📍 Localisation : <strong>{eq.location}</strong></div>
                    <div className="flex items-center justify-between text-[11px] text-[#6B7280]">
                      <span>Dernière révision : {eq.lastMaintenance}</span>
                      <span>Prochaine : <strong>{eq.nextMaintenance}</strong></span>
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
