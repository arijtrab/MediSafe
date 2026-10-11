import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { RegisterForm } from './RegisterForm';
import {
  Lock,
  Mail,
  AlertCircle,
  Shield,
  ArrowRight,
  UserPlus,
  LogIn,
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    const result = await login(email, password);
    setIsLoading(false);

    if (!result.success) {
      setErrorMessage(result.error || 'Erreur d\'authentification.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col justify-between font-sans text-[#111827]">
      {/* Top minimal branding */}
      <header className="border-b border-[#E5E7EB] bg-white py-4 px-6 shadow-xs">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0D5C58] flex items-center justify-center text-white font-mono text-sm font-bold tracking-wider">
              CC
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-[#111827]">
                Clinical Calm
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs text-[#6B7280]">
                Portail Hospitalier Médical
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
            <Shield className="w-4 h-4 text-[#0D5C58]" />
            <span className="hidden sm:inline">Espace d'Authentification Clinique</span>
          </div>
        </div>
      </header>

      {/* Main card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className={`w-full ${authMode === 'register' ? 'max-w-xl' : 'max-w-md'} bg-white rounded-2xl border border-[#E5E7EB] shadow-xl p-6 sm:p-8 space-y-6 transition-all duration-200`}>
          {/* Navigation Tabs : Connexion / Inscription */}
          <div className="grid grid-cols-2 p-1 bg-[#F3F4F6] rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setAuthMode('login');
                setErrorMessage(null);
              }}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                authMode === 'login'
                  ? 'bg-white text-[#0D5C58] shadow-xs'
                  : 'text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Connexion</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('register');
                setErrorMessage(null);
              }}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer ${
                authMode === 'register'
                  ? 'bg-white text-[#0D5C58] shadow-xs'
                  : 'text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Inscription</span>
            </button>
          </div>

          {authMode === 'register' ? (
            <RegisterForm onSwitchToLogin={() => setAuthMode('login')} />
          ) : (
            <>
              {/* Header */}
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-xl bg-[#E6F4F3] border border-[#99D3CF] text-[#0D5C58] mx-auto flex items-center justify-center shadow-xs">
                  <Lock className="w-6 h-6" />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-[#111827]">
                  Connexion à votre espace
                </h1>
                <p className="text-xs text-[#6B7280]">
                  Identifiez-vous pour accéder à vos dossiers médicaux sécurisés
                </p>
              </div>

              {/* Error alert */}
              {errorMessage && (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-[#991B1B] text-xs font-medium flex items-start gap-2.5 animate-fade-in"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="flex-1">{errorMessage}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="email-input"
                    className="block text-xs font-semibold text-[#374151] mb-1.5"
                  >
                    Adresse email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="email-input"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="votre.email@hopital.fr"
                      className="w-full h-10 pl-9 pr-3 text-xs rounded-lg border border-[#D1D5DB] focus:outline-none focus:border-[#0D5C58] focus:ring-1 focus:ring-[#0D5C58] transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="password-input"
                    className="block text-xs font-semibold text-[#374151] mb-1.5"
                  >
                    Mot de passe
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="password-input"
                      type="password"
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-10 pl-9 pr-3 text-xs rounded-lg border border-[#D1D5DB] focus:outline-none focus:border-[#0D5C58] focus:ring-1 focus:ring-[#0D5C58] transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full min-h-[42px] px-4 py-2.5 text-xs font-bold text-white bg-[#0D5C58] hover:bg-[#0B4E4A] rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <span>Se connecter</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              {/* Link to Registration */}
              <div className="text-center pt-2">
                <p className="text-xs text-[#6B7280]">
                  Pas encore de compte ?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('register');
                      setErrorMessage(null);
                    }}
                    className="font-bold text-[#0D5C58] hover:underline cursor-pointer"
                  >
                    Créer un compte
                  </button>
                </p>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E5E7EB] bg-white py-4">
        <div className="max-w-[1440px] mx-auto px-4 text-center text-xs text-[#6B7280]">
          Clinical Calm · Système d'Information Hospitalier · Authentification sécurisée
        </div>
      </footer>
    </div>
  );
};
