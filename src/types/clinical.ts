export type UserRole = 'DOCTOR' | 'ADMIN' | 'PATIENT';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  title: string;
  department: string;
  avatarUrl?: string;
  phone?: string;
  email?: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
  birthDate?: string;
  gender?: 'M' | 'F';
  bloodType?: string;
  socialSecurityNumber?: string;
  allergies?: string[];
  title?: string;
  department?: string;
}

export interface PrescriptionItem {
  id: string;
  patientId?: string;
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  prescribedBy: string;
  datePrescribed: string;
  refillsRemaining: number;
  status: 'ACTIVE' | 'COMPLETED';
  integritySeal?: string;
  sealedAt?: string;
}

export interface AllergyContraindicationData {
  type: string;
  severity: string;
  allergy?: string;
  medication?: string;
  matchedMolecule?: string;
  drugClass?: string;
  reason?: string;
  notice?: string;
}

export interface DrugInteractionData {
  type: string;
  severity: string;
  details?: Array<{
    newMedication: string;
    existingMedication: string;
    moleculeA: string;
    moleculeB: string;
    classA: string;
    classB: string;
    severity: string;
    mechanism: string;
    clinicalImpact: string;
  }>;
  notice?: string;
}

export interface PrescriptionResponse {
  success: boolean;
  prescription?: PrescriptionItem;
  error?: string;
  code?: string;
  contraindication?: AllergyContraindicationData;
  interaction?: DrugInteractionData;
  warnings?: Array<any>;
  overridden?: boolean;
}

export interface Consultation {
  id: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  specialty: string;
  dateTime: string;
  location: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  preparationInstructions?: string;
  reason: string;
  notes?: string;
}

export interface MedicalScan {
  id: string;
  patientId: string;
  patientName: string;
  title: string;
  modality: 'CT' | 'IRM' | 'ÉCHOGRAPHIE' | 'RADIOGRAPHIE';
  bodyPart: string;
  studyDate: string;
  acquisitionDevice: string;
  imageUrl: string;
  isExternalLink?: boolean;
  findings: string;
  radiologistNote: string;
  status: 'VALIDÉ' | 'EN_ATTENTE';
}

export interface PatientVitals {
  id: string;
  patientId: string;
  heartRate: number; // bpm
  bloodPressureSys: number; // mmHg
  bloodPressureDia: number; // mmHg
  oxygenSaturation: number; // %
  temperature: number; // °C
  bloodGlucose?: number; // g/L
  respiratoryRate?: number; // cycles/min
  weightKg?: number; // kg
  heightCm?: number; // cm
  painLevel?: number; // 0-10
  measuredAt: string;
  measuredBy?: string;
  notes?: string;
}

export interface DoctorSlot {
  id: string;
  dateTime: string;
  isAvailable: boolean;
}

export interface DoctorProfile {
  id: string;
  name: string;
  title: string;
  specialty: string;
  department: string;
  location: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
  bio?: string;
  slots: DoctorSlot[];
}

export interface PatientRecord {
  id: string;
  name: string;
  birthDate: string;
  age: number;
  gender: 'M' | 'F';
  bloodType: string;
  socialSecurityNumber: string;
  weightKg: number;
  heightCm: number;
  referringDoctor: string;
  allergies: string[];
  medicalHistory: string[];
  surgicalHistory: string[];
  phone: string;
  email: string;
  prescriptions: PrescriptionItem[];
  scans: MedicalScan[];
  consultations: Consultation[];
  vitals?: PatientVitals[];
  latestVitals?: PatientVitals | null;
}

export interface Equipment {
  id: string;
  name: string;
  type: string;
  location: string;
  status: 'DISPONIBLE' | 'EN_COURS' | 'MAINTENANCE';
  lastMaintenance: string;
  nextMaintenance: string;
}

export interface HospitalActivityLog {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: string;
  action: string;
  category?: 'DOSSIER' | 'ORDONNANCE' | 'IMAGERIE' | 'CONSULTATION' | 'EQUIPEMENT' | 'CONNEXION' | 'SECURITE';
  patientName: string;
  details: string;
  previousHash?: string;
  hash?: string;
}

export interface ComplianceControl {
  id: string;
  title: string;
  category: 'INTEGRITE' | 'CRYPTOGRAPHIE' | 'CONTROLE_ACCES' | 'RESILIENCE' | 'RGPD';
  status: 'PASSED' | 'WARNING' | 'FAILED';
  regulatoryRef: string;
  description: string;
  remediationStatus: string;
}

export interface ActiveUserSession {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: UserRole;
  userTitle?: string;
  createdAt: string;
  expiresAt: string;
  ip?: string;
  userAgent?: string;
}

export interface SecurityPostureData {
  overallScore: number;
  rating: 'EXCELLENT' | 'SATISFAISANT' | 'ATTENTION';
  complianceLabel: string;
  integrity: {
    isValid: boolean;
    checkedCount: number;
    brokenIndex?: number;
    genesisHash: string;
    latestHash?: string;
    details?: string;
  };
  activeSessionsCount: number;
  failedLoginSurveillanceCount: number;
  totalAuditLogsCount: number;
  controls: ComplianceControl[];
  securityEvents: Array<{
    id: string;
    timestamp: string;
    actorName: string;
    actorRole: string;
    action: string;
    category?: string;
    patientName: string;
    details: string;
  }>;
  activeSessions: ActiveUserSession[];
  systemHardening: {
    jwtAlgorithm: string;
    sessionDuration: string;
    bruteForcePolicy: string;
    wormStorage: string;
    antiSsrfProtection: string;
    prescriptionSeal: string;
    cdssEngine: string;
  };
  durationMs: number;
  auditedAt: string;
}
