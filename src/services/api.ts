import {
  UserProfile,
  RegisterData,
  PatientRecord,
  PrescriptionItem,
  PrescriptionResponse,
  MedicalScan,
  Consultation,
  Equipment,
  HospitalActivityLog,
  PatientVitals,
  DoctorProfile,
} from '../types/clinical';

const BASE_URL = '/api';
const TOKEN_KEY = 'clinical_calm_jwt_token';

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch (e) {
    console.error('Failed to set token in storage', e);
  }
}

// Requirement 4: Global 401 interceptor: disconnect & trigger redirect to login
export function handleUnauthorizedResponse() {
  setToken(null);
  window.dispatchEvent(new CustomEvent('clinical_calm_unauthorized'));
}

async function request<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    // Requirement 4: On 401, trigger global unauthorized handler (except login endpoint)
    if (res.status === 401 && !endpoint.includes('/auth/login')) {
      handleUnauthorizedResponse();
    }

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: data?.error || `Erreur serveur (${res.status})`,
        data,
      };
    }

    return { ok: true, status: res.status, data };
  } catch (e: any) {
    return { ok: false, status: 0, error: e.message || 'Erreur de connexion au serveur.' };
  }
}

export const api = {
  getToken,
  setToken,

  async checkHealth(): Promise<{ status: string; security?: string; database?: string } | null> {
    const res = await request<{ status: string; security?: string; database?: string }>('/health');
    return res.ok && res.data ? res.data : null;
  },

  async login(email: string, password: string): Promise<{ success: boolean; user?: UserProfile; token?: string; error?: string }> {
    const res = await request<{ success: boolean; user: UserProfile; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (res.ok && res.data) {
      if (res.data.token) {
        setToken(res.data.token);
      }
      return { success: true, user: res.data.user, token: res.data.token };
    }
    return { success: false, error: res.error || 'Identifiants invalides.' };
  },

  async register(data: RegisterData): Promise<{ success: boolean; user?: UserProfile; token?: string; error?: string }> {
    const res = await request<{ success: boolean; user: UserProfile; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (res.ok && res.data) {
      if (res.data.token) {
        setToken(res.data.token);
      }
      return { success: true, user: res.data.user, token: res.data.token };
    }
    return { success: false, error: res.error || "Erreur lors de l'inscription." };
  },

  async getMe(): Promise<{ success: boolean; user?: UserProfile }> {
    const res = await request<{ success: boolean; user: UserProfile }>('/auth/me');
    if (res.ok && res.data) {
      return { success: true, user: res.data.user };
    }
    return { success: false };
  },

  logout() {
    setToken(null);
  },

  // Patients
  async getPatients(): Promise<PatientRecord[]> {
    const res = await request<PatientRecord[]>('/patients');
    return res.ok && res.data ? res.data : [];
  },

  async getPatient(id: string): Promise<PatientRecord | null> {
    const res = await request<PatientRecord>(`/patients/${id}`);
    return res.ok && res.data ? res.data : null;
  },

  // Prescriptions
  async addPrescription(
    patientId: string,
    item: Partial<PrescriptionItem> & { override?: boolean; justification?: string },
    patientName?: string
  ): Promise<PrescriptionResponse> {
    const res = await request<PrescriptionResponse>('/patients/' + patientId + '/prescriptions', {
      method: 'POST',
      body: JSON.stringify({ ...item, patientName }),
    });
    if (res.ok && res.data) {
      return { ...res.data, success: true };
    }
    return {
      success: false,
      error: res.error,
      code: res.data?.code,
      contraindication: res.data?.contraindication,
      interaction: res.data?.interaction,
      warnings: res.data?.warnings,
    };
  },

  async verifyPrescription(prescriptionId: string): Promise<{
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
  }> {
    const res = await request('/prescriptions/' + prescriptionId + '/verify');
    if (res.data) {
      return res.data;
    }
    return { isValid: false, error: res.error || 'Impossible de vérifier le scellement.' };
  },

  async deletePrescription(patientId: string, prescriptionId: string): Promise<boolean> {
    const res = await request('/patients/' + patientId + '/prescriptions/' + prescriptionId, {
      method: 'DELETE',
    });
    return res.ok;
  },

  // Medical Scans
  async addScan(patientId: string, scan: MedicalScan): Promise<{ success: boolean; error?: string }> {
    const res = await request('/patients/' + patientId + '/scans', {
      method: 'POST',
      body: JSON.stringify(scan),
    });
    return { success: res.ok, error: res.error };
  },

  async updateScanFindings(scanId: string, findings: string, radiologistNote: string, patientName?: string): Promise<boolean> {
    const res = await request('/patients/any/scans/' + scanId, {
      method: 'PUT',
      body: JSON.stringify({ findings, radiologistNote, patientName }),
    });
    return res.ok;
  },

  async deleteScan(scanId: string): Promise<boolean> {
    const res = await request('/patients/any/scans/' + scanId, {
      method: 'DELETE',
    });
    return res.ok;
  },

  // Consultations
  async addConsultation(consultation: Consultation): Promise<{ success: boolean; error?: string }> {
    const res = await request('/consultations', {
      method: 'POST',
      body: JSON.stringify(consultation),
    });
    return { success: res.ok, error: res.error };
  },

  async cancelConsultation(consultationId: string): Promise<boolean> {
    const res = await request('/consultations/' + consultationId, {
      method: 'DELETE',
    });
    return res.ok;
  },

  // Doctors Directory & Availabilities
  async getDoctors(): Promise<DoctorProfile[]> {
    const res = await request<DoctorProfile[]>('/doctors');
    return res.ok && res.data ? res.data : [];
  },

  // Patient Vitals / Constantes biométriques
  async getPatientVitals(patientId: string): Promise<PatientVitals[]> {
    const res = await request<PatientVitals[]>('/patients/' + patientId + '/vitals');
    return res.ok && res.data ? res.data : [];
  },

  async addPatientVitals(
    patientId: string,
    vitals: Partial<PatientVitals>
  ): Promise<{ success: boolean; vitals?: PatientVitals; error?: string }> {
    const res = await request<{ success: boolean; vitals: PatientVitals }>('/patients/' + patientId + '/vitals', {
      method: 'POST',
      body: JSON.stringify(vitals),
    });
    if (res.ok && res.data) {
      return { success: true, vitals: res.data.vitals };
    }
    return { success: false, error: res.error || "Impossible d'enregistrer les constantes biométriques." };
  },

  // Equipments
  async getEquipments(): Promise<Equipment[]> {
    const res = await request<Equipment[]>('/equipments');
    return res.ok && res.data ? res.data : [];
  },

  async updateEquipmentStatus(equipmentId: string, status: string): Promise<{ success: boolean; equipment?: Equipment; error?: string }> {
    const res = await request<{ success: boolean; equipment: Equipment }>('/equipments/' + equipmentId + '/status', {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    if (res.ok && res.data) {
      return { success: true, equipment: res.data.equipment };
    }
    return { success: false, error: res.error };
  },

  // Logs & Audit
  async getLogs(): Promise<HospitalActivityLog[]> {
    const res = await request<HospitalActivityLog[]>('/logs');
    return res.ok && res.data ? res.data : [];
  },

  async addLog(log: HospitalActivityLog): Promise<boolean> {
    const res = await request('/logs', {
      method: 'POST',
      body: JSON.stringify(log),
    });
    return res.ok;
  },

  async verifyAuditTrail(): Promise<{
    isValid: boolean;
    checkedCount: number;
    brokenIndex?: number;
    genesisHash: string;
    latestHash?: string;
    details?: string;
  } | null> {
    const res = await request('/logs/verify');
    return res.ok && res.data ? res.data : null;
  },

  async resetData(): Promise<boolean> {
    const res = await request('/reset', {
      method: 'POST',
    });
    return res.ok;
  },
};
