import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, RegisterData } from '../types/clinical';
import { api } from '../services/api';

interface AuthContextType {
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string; user?: UserProfile }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
  onAuditLoginSuccess?: (user: UserProfile) => void;
  onAuditLoginFailed?: (attemptedEmail: string) => void;
  onAuditLogout?: (user: UserProfile) => void;
  onAuditRegister?: (user: UserProfile) => void;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  onAuditLoginSuccess,
  onAuditLoginFailed,
  onAuditLogout,
  onAuditRegister,
}) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  // Validate active session on initial load via API
  useEffect(() => {
    const checkActiveSession = async () => {
      const token = api.getToken();
      if (token) {
        try {
          const res = await api.getMe();
          if (res.success && res.user) {
            setCurrentUser(res.user);
          } else {
            api.logout();
            setCurrentUser(null);
          }
        } catch {
          api.logout();
          setCurrentUser(null);
        }
      }
    };
    checkActiveSession();
  }, []);

  // Requirement 4: Global 401 interceptor listener: disconnect and redirect to login
  useEffect(() => {
    const handleUnauthorized = () => {
      api.logout();
      setCurrentUser(null);
    };
    window.addEventListener('clinical_calm_unauthorized', handleUnauthorized);
    return () => window.removeEventListener('clinical_calm_unauthorized', handleUnauthorized);
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      return { success: false, error: 'Veuillez saisir votre email et votre mot de passe.' };
    }

    // Direct API call — API is the single source of truth
    const apiRes = await api.login(trimmedEmail, trimmedPassword);
    if (apiRes.success && apiRes.user) {
      setCurrentUser(apiRes.user);
      onAuditLoginSuccess?.(apiRes.user);
      return { success: true };
    }

    onAuditLoginFailed?.(trimmedEmail);
    return { success: false, error: apiRes.error || 'Identifiants invalides.' };
  };

  const register = async (data: RegisterData): Promise<{ success: boolean; error?: string; user?: UserProfile }> => {
    const trimmedEmail = data.email.trim();
    const trimmedPassword = data.password.trim();
    const trimmedName = data.name.trim();

    if (!trimmedName) {
      return { success: false, error: 'Veuillez saisir un nom complet.' };
    }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      return { success: false, error: 'Veuillez saisir une adresse email valide.' };
    }
    if (!trimmedPassword || trimmedPassword.length < 6) {
      return { success: false, error: 'Le mot de passe doit contenir au moins 6 caractères.' };
    }

    // Direct API call — API forces PATIENT role and persists to SQLite database
    const apiRes = await api.register(data);
    if (apiRes.success && apiRes.user) {
      setCurrentUser(apiRes.user);
      onAuditRegister?.(apiRes.user);
      return { success: true, user: apiRes.user };
    }

    return { success: false, error: apiRes.error || "Erreur lors de l'inscription." };
  };

  const logout = () => {
    if (currentUser) {
      onAuditLogout?.(currentUser);
    }
    api.logout();
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
