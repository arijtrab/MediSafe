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
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  prescribedBy: string;
  datePrescribed: string;
  refillsRemaining: number;
  status: 'ACTIVE' | 'COMPLETED';
}

export interface Consultation {
  id: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  specialty: string;
  dateTime: string;
  location: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';
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
  category?: 'DOSSIER' | 'ORDONNANCE' | 'IMAGERIE' | 'CONSULTATION' | 'EQUIPEMENT' | 'CONNEXION';
  patientName: string;
  details: string;
}
