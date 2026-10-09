import {
  UserProfile,
  RegisterData,
  PatientRecord,
  PrescriptionItem,
  MedicalScan,
  Consultation,
  Equipment,
  HospitalActivityLog,
} from '../types/clinical';

const BASE_URL = '/api';

export const api = {
  // Check backend health & SQLite connection
  async checkHealth(): Promise<{ status: string; database: string } | null> {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend not reachable:', e);
    }
    return null;
  },

  // Auth: Login
  async login(email: string, password: string): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Identifiants invalides.' };
      }
      return { success: true, user: data.user };
    } catch (e: any) {
      return { success: false, error: e.message || 'Erreur réseau.' };
    }
  },

  // Auth: Register
  async register(data: RegisterData): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
    try {
      const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      if (!res.ok) {
        return { success: false, error: resData.error || 'Erreur lors de l\'inscription.' };
      }
      return { success: true, user: resData.user };
    } catch (e: any) {
      return { success: false, error: e.message || 'Erreur réseau.' };
    }
  },

  // Patients
  async getPatients(): Promise<PatientRecord[]> {
    try {
      const res = await fetch(`${BASE_URL}/patients`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error('Failed to fetch patients from SQLite:', e);
    }
    return [];
  },

  // Prescriptions
  async addPrescription(patientId: string, item: PrescriptionItem): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/patients/${patientId}/prescriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      return res.ok;
    } catch (e) {
      console.error('Failed to add prescription to SQLite:', e);
      return false;
    }
  },

  async deletePrescription(patientId: string, prescriptionId: string): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/patients/${patientId}/prescriptions/${prescriptionId}`, {
        method: 'DELETE',
      });
      return res.ok;
    } catch (e) {
      console.error('Failed to delete prescription from SQLite:', e);
      return false;
    }
  },

  // Medical Scans
  async addScan(patientId: string, scan: MedicalScan): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/patients/${patientId}/scans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scan),
      });
      return res.ok;
    } catch (e) {
      console.error('Failed to add scan to SQLite:', e);
      return false;
    }
  },

  async updateScanFindings(scanId: string, findings: string, radiologistNote: string): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/patients/any/scans/${scanId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ findings, radiologistNote }),
      });
      return res.ok;
    } catch (e) {
      console.error('Failed to update scan findings in SQLite:', e);
      return false;
    }
  },

  async deleteScan(scanId: string): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/patients/any/scans/${scanId}`, {
        method: 'DELETE',
      });
      return res.ok;
    } catch (e) {
      console.error('Failed to delete scan from SQLite:', e);
      return false;
    }
  },

  // Consultations
  async addConsultation(consultation: Consultation): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/consultations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(consultation),
      });
      return res.ok;
    } catch (e) {
      console.error('Failed to add consultation to SQLite:', e);
      return false;
    }
  },

  async cancelConsultation(consultationId: string): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/consultations/${consultationId}`, {
        method: 'DELETE',
      });
      return res.ok;
    } catch (e) {
      console.error('Failed to delete consultation from SQLite:', e);
      return false;
    }
  },

  // Equipments
  async getEquipments(): Promise<Equipment[]> {
    try {
      const res = await fetch(`${BASE_URL}/equipments`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error('Failed to fetch equipments from SQLite:', e);
    }
    return [];
  },

  // Logs
  async getLogs(): Promise<HospitalActivityLog[]> {
    try {
      const res = await fetch(`${BASE_URL}/logs`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error('Failed to fetch logs from SQLite:', e);
    }
    return [];
  },

  async addLog(log: HospitalActivityLog): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(log),
      });
      return res.ok;
    } catch (e) {
      console.error('Failed to add log to SQLite:', e);
      return false;
    }
  },

  // Reset database
  async resetData(): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/reset`, {
        method: 'POST',
      });
      return res.ok;
    } catch (e) {
      console.error('Failed to reset SQLite data:', e);
      return false;
    }
  },
};
