import React from 'react';
import { UserProfile, UserRole } from '../types/clinical';
import { LogOut, User, Stethoscope, Building } from 'lucide-react';

interface TopBarProps {
  currentUser: UserProfile;
  onLogout: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentUser,
  onLogout,
}) => {
  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'DOCTOR':
        return <Stethoscope className="w-4 h-4 text-[#1E40AF]" />;
      case 'ADMIN':
        return <Building className="w-4 h-4 text-[#6B21A8]" />;
      case 'PATIENT':
        return <User className="w-4 h-4 text-[#0D5C58]" />;
    }
  };

  const getRoleBadgeStyle = (role: UserRole) => {
    switch (role) {
      case 'DOCTOR':
        return 'bg-[#EFF6FF] text-[#1E40AF] border-[#BFDBFE]';
      case 'ADMIN':
        return 'bg-[#FAF5FF] text-[#6B21A8] border-[#E9D5FF]';
      case 'PATIENT':
        return 'bg-[#E6F4F3] text-[#0D5C58] border-[#99D3CF]';
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'DOCTOR':
        return 'Médecin';
      case 'ADMIN':
        return 'Administrateur';
      case 'PATIENT':
        return 'Patient';
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-[#FFFFFF] border-b border-[#E5E7EB] shadow-xs">
      <div className="max-w-[1440px] mx-auto px-4 md:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand wordmark */}
        <div className="flex items-center gap-2.5 shrink-0">
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

        {/* Current user & Logout button */}
        <div className="flex items-center gap-3">
          {/* SQLite Database status indicator */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] text-[10px] font-semibold text-[#065F46]" title="Base de données SQLite locale active et synchronisée">
            <span className="w-1.5 h-1.5 rounded-full bg-[#059669] animate-pulse"></span>
            <span>SQLite Connecté</span>
          </div>

          {/* User information badge */}
          <div className="flex items-center gap-2.5 p-1.5 pl-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB]">
            <div className="text-left hidden sm:block">
              <div className="text-xs font-bold text-[#111827] leading-tight">
                {currentUser.name}
              </div>
              <div className="text-[10px] text-[#6B7280]">
                {currentUser.title}
              </div>
            </div>
            <span
              className={`px-2 py-0.5 text-[10px] font-bold rounded-full border inline-flex items-center gap-1 ${getRoleBadgeStyle(
                currentUser.role
              )}`}
            >
              {getRoleIcon(currentUser.role)}
              {getRoleLabel(currentUser.role)}
            </span>
          </div>

          {/* Dedicated Logout button */}
          <button
            type="button"
            onClick={onLogout}
            title="Se déconnecter de la session"
            className="min-h-[38px] px-3.5 py-1.5 text-xs font-semibold text-[#DC2626] bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FECACA] rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-[#DC2626]" />
            <span className="hidden sm:inline">Déconnexion</span>
          </button>
        </div>
      </div>
    </header>
  );
};
