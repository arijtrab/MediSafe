import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, RegisterData, PatientRecord } from '../types/clinical';
import { USER_PROFILES, DEMO_CREDENTIALS, INITIAL_PATIENTS } from '../data/mockClinicalData';
import { api } from '../services/api';

export const AUTH_SESSION_KEY = 'clinical_calm_auth_session';
export const CUSTOM_USERS_KEY = 'clinical_calm_custom_users';
const PATIENTS_STORAGE_KEY = 'clinical_calm_patients';

export interface StoredUserCredential {
  user: UserProfile;
  password: string;
}

interface AuthContextType {
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string; user?: UserProfile }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface SessionData {
  userId: string;
  loginAt: string;
}

interface AuthProviderProps {
  children: React.ReactNode;
  onAuditLoginSuccess?: (user: UserProfile) => void;
  onAuditLoginFailed?: (attemptedEmail: string) => void;
  onAuditLogout?: (user: UserProfile) => void;
  onAuditRegister?: (user: UserProfile) => void;
}

export const getCustomUsers = (): StoredUserCredential[] => {
  try {
    const raw = localStorage.getItem(CUSTOM_USERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse custom users', e);
  }
  return [];
};

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  onAuditLoginSuccess,
  onAuditLoginFailed,
  onAuditLogout,
  onAuditRegister,
}) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const savedSession = localStorage.getItem(AUTH_SESSION_KEY);
      if (savedSession) {
        const session: SessionData = JSON.parse(savedSession);
        // Look up in default profiles first
        const matched = USER_PROFILES.find((u) => u.id === session.userId);
        if (matched) return matched;
        // Look up in custom users
        const customUsers = getCustomUsers();
        const customMatched = customUsers.find((cu) => cu.user.id === session.userId);
        if (customMatched) return customMatched.user;
      }
    } catch (e) {
      console.error('Failed to parse auth session from localStorage', e);
    }
    return null;
  });

  // Sync session to localStorage on change
  useEffect(() => {
    try {
      if (currentUser) {
        const session: SessionData = {
          userId: currentUser.id,
          loginAt: new Date().toISOString(),
        };
        localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
      } else {
        localStorage.removeItem(AUTH_SESSION_KEY);
      }
    } catch (e) {
      console.error('Failed to sync session to localStorage', e);
    }
  }, [currentUser]);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      return { success: false, error: 'Veuillez saisir votre email et votre mot de passe.' };
    }

    // 1. Try SQLite Database Backend
    try {
      const apiRes = await api.login(trimmedEmail, trimmedPassword);
      if (apiRes.success && apiRes.user) {
        setCurrentUser(apiRes.user);
        onAuditLoginSuccess?.(apiRes.user);
        return { success: true };
      }
    } catch (e) {
      console.warn('SQLite API login attempt failed, checking local fallback...', e);
    }

    // 2. Fallback check custom registered users
    const customUsers = getCustomUsers();
    const customMatch = customUsers.find(
      (c) => c.user.email?.toLowerCase() === trimmedEmail && c.password === trimmedPassword
    );

    if (customMatch) {
      setCurrentUser(customMatch.user);
      onAuditLoginSuccess?.(customMatch.user);
      return { success: true };
    }

    // 3. Match credentials from DEMO_CREDENTIALS
    const entry = Object.values(DEMO_CREDENTIALS).find(
      (c) => c.email.toLowerCase() === trimmedEmail && c.password === trimmedPassword
    );

    if (!entry) {
      onAuditLoginFailed?.(trimmedEmail);
      return { success: false, error: 'Identifiants invalides. Vérifiez votre email et mot de passe.' };
    }

    const matchedUser = USER_PROFILES.find((u) => u.id === entry.userId);
    if (!matchedUser) {
      return { success: false, error: 'Utilisateur introuvable.' };
    }

    setCurrentUser(matchedUser);
    onAuditLoginSuccess?.(matchedUser);
    return { success: true };
  };

  const register = async (data: RegisterData): Promise<{ success: boolean; error?: string; user?: UserProfile }> => {
    const trimmedEmail = data.email.trim().toLowerCase();
    const trimmedPassword = data.password.trim();
    const trimmedName = data.name.trim();

    if (!trimmedName) {
      return { success: false, error: 'Veuillez saisir un nom complet.' };
    }
    if (!trimmedEmail || !trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      return { success: false, error: 'Veuillez saisir une adresse email valide.' };
    }
    if (!trimmedPassword || trimmedPassword.length < 6) {
      return { success: false, error: 'Le mot de passe doit contenir au moins 6 caractères.' };
    }

    // 1. Try SQLite Database Backend
    try {
      const apiRes = await api.register(data);
      if (apiRes.success && apiRes.user) {
        setCurrentUser(apiRes.user);
        onAuditRegister?.(apiRes.user);
        window.dispatchEvent(new CustomEvent('clinical_calm_patients_updated'));
        return { success: true, user: apiRes.user };
      } else if (apiRes.error && apiRes.error.includes('déjà')) {
        return { success: false, error: apiRes.error };
      }
    } catch (e) {
      console.warn('SQLite API register error, proceeding with local persistence...', e);
    }

    // 2. Local persistence fallback
    const isDemoEmail = Object.values(DEMO_CREDENTIALS).some(
      (c) => c.email.toLowerCase() === trimmedEmail
    );
    const customUsers = getCustomUsers();
    const isCustomEmail = customUsers.some(
      (c) => c.user.email?.toLowerCase() === trimmedEmail
    );

    if (isDemoEmail || isCustomEmail) {
      return { success: false, error: 'Cette adresse email est déjà associée à un compte.' };
    }

    const uniqueSuffix = Date.now().toString().slice(-5);
    const newUserId = `user_${data.role.toLowerCase()}_${uniqueSuffix}`;

    let title = data.title || '';
    let department = data.department || '';

    if (data.role === 'PATIENT') {
      title = 'Patient';
      department = 'Espace Patient';
    } else if (data.role === 'DOCTOR') {
      title = title || 'Médecin Praticien';
      department = department || 'Service de Médecine Générale & Consultations';
    } else if (data.role === 'ADMIN') {
      title = title || 'Administrateur Hospitalier';
      department = department || 'Direction des Opérations & Admissions';
    }

    const newUser: UserProfile = {
      id: newUserId,
      name: trimmedName,
      role: data.role,
      title,
      department,
      phone: data.phone?.trim() || '06 00 00 00 00',
      email: trimmedEmail,
    };

    const updatedCustomUsers = [...customUsers, { user: newUser, password: trimmedPassword }];
    try {
      localStorage.setItem(CUSTOM_USERS_KEY, JSON.stringify(updatedCustomUsers));
    } catch (e) {
      console.error('Failed to save user in localStorage', e);
    }

    if (data.role === 'PATIENT') {
      let patients: PatientRecord[] = INITIAL_PATIENTS;
      try {
        const saved = localStorage.getItem(PATIENTS_STORAGE_KEY);
        if (saved) patients = JSON.parse(saved);
      } catch {
        // fallback
      }

      let calculatedAge = 35;
      let formattedBirthDate = data.birthDate || '15/06/1990';
      if (data.birthDate) {
        const parts = data.birthDate.split('-');
        if (parts.length === 3) {
          const birthYear = parseInt(parts[0], 10);
          calculatedAge = new Date().getFullYear() - birthYear;
          formattedBirthDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
      }

      const newPatientRecord: PatientRecord = {
        id: `PAT-2026-${uniqueSuffix}`,
        name: trimmedName,
        birthDate: formattedBirthDate,
        age: calculatedAge > 0 ? calculatedAge : 30,
        gender: data.gender || 'M',
        bloodType: data.bloodType || 'A Rh+ (Positif)',
        socialSecurityNumber: data.socialSecurityNumber || `1 ${uniqueSuffix.slice(0, 2)} 01 75 000 ${uniqueSuffix} 00`,
        weightKg: 70,
        heightCm: 175,
        referringDoctor: 'Dr. Sarah Chen',
        allergies: data.allergies && data.allergies.length > 0 ? data.allergies : ['Aucune allergie connue'],
        medicalHistory: [`Dossier médical patient créé le ${new Date().toLocaleDateString('fr-FR')}`],
        surgicalHistory: ['Aucun antécédent chirurgical majeur signalé'],
        phone: newUser.phone || '06 00 00 00 00',
        email: trimmedEmail,
        prescriptions: [],
        scans: [],
        consultations: [],
      };

      try {
        localStorage.setItem(PATIENTS_STORAGE_KEY, JSON.stringify([newPatientRecord, ...patients]));
        window.dispatchEvent(new CustomEvent('clinical_calm_patients_updated'));
      } catch (e) {
        console.error('Failed to save new patient record', e);
      }
    }

    onAuditRegister?.(newUser);
    setCurrentUser(newUser);

    return { success: true, user: newUser };
  };

  const logout = () => {
    if (currentUser) {
      onAuditLogout?.(currentUser);
    }
    setCurrentUser(null);
  };

  const value: AuthContextType = {
    currentUser,
    isAuthenticated: currentUser !== null,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
