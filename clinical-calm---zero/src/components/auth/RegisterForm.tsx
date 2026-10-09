import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole, RegisterData } from '../../types/clinical';
import {
  User,
  Stethoscope,
  Building,
  Mail,
  Lock,
  Phone,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
  Activity,
  Heart,
} from 'lucide-react';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSwitchToLogin }) => {
  const { register } = useAuth();

  const [role, setRole] = useState<UserRole>('PATIENT');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Patient-specific fields
  const [birthDate, setBirthDate] = useState('1992-05-18');
  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [bloodType, setBloodType] = useState('A Rh+ (Positif)');
  const [socialSecurityNumber, setSocialSecurityNumber] = useState('');
  const [allergiesText, setAllergiesText] = useState('');

  // Doctor-specific fields
  const [specialty, setSpecialty] = useState('Médecine Générale');
  const [doctorDepartment, setDoctorDepartment] = useState('Service des Consultations Externes');

  // Admin-specific fields
  const [adminTitle, setAdminTitle] = useState('Coordinateur Administratif');
  const [adminDepartment, setAdminDepartment] = useState('Direction des Admissions & Flux');

  const [consentHds, setConsentHds] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!name.trim()) {
      setErrorMessage('Veuillez renseigner votre nom complet.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Veuillez fournir une adresse email valide.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Les deux mots de passe ne correspondent pas.');
      return;
    }
    if (!consentHds) {
      setErrorMessage('Veuillez accepter les conditions de confidentialité des données de santé.');
      return;
    }

    setIsLoading(true);

    const registerPayload: RegisterData = {
      name: name.trim(),
      email: email.trim(),
      password,
      role,
      phone: phone.trim() || undefined,
    };

    if (role === 'PATIENT') {
      registerPayload.birthDate = birthDate;
      registerPayload.gender = gender;
      registerPayload.bloodType = bloodType;
      registerPayload.socialSecurityNumber = socialSecurityNumber.trim() || undefined;
      registerPayload.allergies = allergiesText
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean);
    } else if (role === 'DOCTOR') {
      registerPayload.title = `Dr. ${name.replace(/^dr\.?\s*/i, '')} - ${specialty}`;
      registerPayload.department = doctorDepartment;
    } else if (role === 'ADMIN') {
      registerPayload.title = adminTitle;
      registerPayload.department = adminDepartment;
    }

    const result = await register(registerPayload);
    setIsLoading(false);

    if (result.success) {
      setSuccessMessage('Compte créé avec succès ! Redirection en cours...');
    } else {
      setErrorMessage(result.error || 'Erreur lors de la création du compte.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-1.5">
        <div className="w-12 h-12 rounded-xl bg-[#E6F4F3] border border-[#99D3CF] text-[#0D5C58] mx-auto flex items-center justify-center shadow-xs">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-[#111827]">
          Créer un compte
        </h1>
        <p className="text-xs text-[#6B7280]">
          Rejoignez le portail hospitalier Clinical Calm selon votre profil
        </p>
      </div>

      {/* Role selector */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-[#374151]">
          Sélectionnez votre type de profil :
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setRole('PATIENT')}
            className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
              role === 'PATIENT'
                ? 'bg-[#E6F4F3] border-[#0D5C58] text-[#0D5C58] ring-2 ring-[#0D5C58]/20 shadow-xs'
                : 'bg-white border-[#E5E7EB] text-[#4B5563] hover:bg-[#F9FAFB]'
            }`}
          >
            <User className="w-4 h-4" />
            <span className="text-xs font-bold">Patient</span>
          </button>

          <button
            type="button"
            onClick={() => setRole('DOCTOR')}
            className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
              role === 'DOCTOR'
                ? 'bg-[#EFF6FF] border-[#1E40AF] text-[#1E40AF] ring-2 ring-[#1E40AF]/20 shadow-xs'
                : 'bg-white border-[#E5E7EB] text-[#4B5563] hover:bg-[#F9FAFB]'
            }`}
          >
            <Stethoscope className="w-4 h-4" />
            <span className="text-xs font-bold">Médecin</span>
          </button>

          <button
            type="button"
            onClick={() => setRole('ADMIN')}
            className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
              role === 'ADMIN'
                ? 'bg-[#FAF5FF] border-[#6B21A8] text-[#6B21A8] ring-2 ring-[#6B21A8]/20 shadow-xs'
                : 'bg-white border-[#E5E7EB] text-[#4B5563] hover:bg-[#F9FAFB]'
            }`}
          >
            <Building className="w-4 h-4" />
            <span className="text-xs font-bold">Admin</span>
          </button>
        </div>
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

      {/* Success alert */}
      {successMessage && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-xs font-medium flex items-start gap-2.5 animate-fade-in"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="flex-1">{successMessage}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-xs font-semibold text-[#374151] mb-1">
            {role === 'DOCTOR' ? 'Nom et Prénom du praticien' : 'Nom complet (Prénom et Nom)'}
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                role === 'DOCTOR'
                  ? 'Dr. David Bernard'
                  : role === 'ADMIN'
                  ? 'Claire Vasseur'
                  : 'Émilie Martin'
              }
              className="w-full h-10 pl-9 pr-3 text-xs rounded-lg border border-[#D1D5DB] focus:outline-none focus:border-[#0D5C58] focus:ring-1 focus:ring-[#0D5C58] transition-colors"
            />
          </div>
        </div>

        {/* Email & Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1">
              Adresse email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@exemple.fr"
                className="w-full h-10 pl-9 pr-3 text-xs rounded-lg border border-[#D1D5DB] focus:outline-none focus:border-[#0D5C58] focus:ring-1 focus:ring-[#0D5C58] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1">
              Téléphone
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="06 12 34 56 78"
                className="w-full h-10 pl-9 pr-3 text-xs rounded-lg border border-[#D1D5DB] focus:outline-none focus:border-[#0D5C58] focus:ring-1 focus:ring-[#0D5C58] transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Role-specific fields */}
        {role === 'PATIENT' && (
          <div className="p-3.5 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#0D5C58]">
              <Heart className="w-3.5 h-3.5" />
              <span>Informations médicales initiales du patient</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#4B5563] mb-1">
                  Date de naissance
                </label>
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    required
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full h-9 pl-8 pr-2 text-xs rounded-md border border-[#D1D5DB] bg-white focus:outline-none focus:border-[#0D5C58]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#4B5563] mb-1">
                  Sexe
                </label>
                <div className="grid grid-cols-2 gap-2 h-9">
                  <button
                    type="button"
                    onClick={() => setGender('F')}
                    className={`text-xs rounded-md border font-semibold transition-colors cursor-pointer ${
                      gender === 'F'
                        ? 'bg-[#E6F4F3] border-[#0D5C58] text-[#0D5C58]'
                        : 'bg-white border-[#D1D5DB] text-[#4B5563]'
                    }`}
                  >
                    Femme (F)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender('M')}
                    className={`text-xs rounded-md border font-semibold transition-colors cursor-pointer ${
                      gender === 'M'
                        ? 'bg-[#E6F4F3] border-[#0D5C58] text-[#0D5C58]'
                        : 'bg-white border-[#D1D5DB] text-[#4B5563]'
                    }`}
                  >
                    Homme (M)
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#4B5563] mb-1">
                  Groupe sanguin
                </label>
                <select
                  value={bloodType}
                  onChange={(e) => setBloodType(e.target.value)}
                  className="w-full h-9 px-2 text-xs rounded-md border border-[#D1D5DB] bg-white focus:outline-none focus:border-[#0D5C58]"
                >
                  <option value="A Rh+ (Positif)">A Rh+ (Positif)</option>
                  <option value="A Rh- (Négatif)">A Rh- (Négatif)</option>
                  <option value="B Rh+ (Positif)">B Rh+ (Positif)</option>
                  <option value="B Rh- (Négatif)">B Rh- (Négatif)</option>
                  <option value="AB Rh+ (Positif)">AB Rh+ (Positif)</option>
                  <option value="AB Rh- (Négatif)">AB Rh- (Négatif)</option>
                  <option value="O Rh+ (Positif)">O Rh+ (Positif)</option>
                  <option value="O Rh- (Négatif)">O Rh- (Négatif)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#4B5563] mb-1">
                  N° Sécurité Sociale (optionnel)
                </label>
                <input
                  type="text"
                  value={socialSecurityNumber}
                  onChange={(e) => setSocialSecurityNumber(e.target.value)}
                  placeholder="2 92 05 75 123 456 78"
                  className="w-full h-9 px-2.5 text-xs rounded-md border border-[#D1D5DB] bg-white focus:outline-none focus:border-[#0D5C58]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#4B5563] mb-1">
                Allergies connues (séparer par des virgules)
              </label>
              <input
                type="text"
                value={allergiesText}
                onChange={(e) => setAllergiesText(e.target.value)}
                placeholder="Ex : Pénicilline, Arachides (laisser vide si aucune)"
                className="w-full h-9 px-2.5 text-xs rounded-md border border-[#D1D5DB] bg-white focus:outline-none focus:border-[#0D5C58]"
              />
            </div>
          </div>
        )}

        {role === 'DOCTOR' && (
          <div className="p-3.5 bg-[#EFF6FF]/40 rounded-xl border border-[#BFDBFE] space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#1E40AF]">
              <Activity className="w-3.5 h-3.5" />
              <span>Attribution clinique du praticien</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#4B5563] mb-1">
                Spécialité médicale
              </label>
              <select
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                className="w-full h-9 px-2 text-xs rounded-md border border-[#D1D5DB] bg-white focus:outline-none focus:border-[#1E40AF]"
              >
                <option value="Médecine Générale">Médecine Générale</option>
                <option value="Pneumologie & Bilan Thoracique">Pneumologie & Bilan Thoracique</option>
                <option value="Cardiologie & Hypertension">Cardiologie & Hypertension</option>
                <option value="Imagerie Diagnostique & Radiologie">Imagerie Diagnostique & Radiologie</option>
                <option value="Neurologie">Neurologie</option>
                <option value="Chirurgie Ambulatoire">Chirurgie Ambulatoire</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#4B5563] mb-1">
                Service hospitalier de rattachement
              </label>
              <input
                type="text"
                value={doctorDepartment}
                onChange={(e) => setDoctorDepartment(e.target.value)}
                placeholder="Ex : Service de Pneumologie - Bâtiment B"
                className="w-full h-9 px-2.5 text-xs rounded-md border border-[#D1D5DB] bg-white focus:outline-none focus:border-[#1E40AF]"
              />
            </div>
          </div>
        )}

        {role === 'ADMIN' && (
          <div className="p-3.5 bg-[#FAF5FF]/40 rounded-xl border border-[#E9D5FF] space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#6B21A8]">
              <Building className="w-3.5 h-3.5" />
              <span>Attribution administrative</span>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#4B5563] mb-1">
                Intitulé de poste
              </label>
              <input
                type="text"
                value={adminTitle}
                onChange={(e) => setAdminTitle(e.target.value)}
                placeholder="Ex : Responsable des Admissions & Opérations"
                className="w-full h-9 px-2.5 text-xs rounded-md border border-[#D1D5DB] bg-white focus:outline-none focus:border-[#6B21A8]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#4B5563] mb-1">
                Direction / Pôle
              </label>
              <input
                type="text"
                value={adminDepartment}
                onChange={(e) => setAdminDepartment(e.target.value)}
                placeholder="Ex : Direction Générale & Logistique Médicale"
                className="w-full h-9 px-2.5 text-xs rounded-md border border-[#D1D5DB] bg-white focus:outline-none focus:border-[#6B21A8]"
              />
            </div>
          </div>
        )}

        {/* Passwords */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1">
              Mot de passe (min. 6 car.)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-10 pl-9 pr-9 text-xs rounded-lg border border-[#D1D5DB] focus:outline-none focus:border-[#0D5C58] focus:ring-1 focus:ring-[#0D5C58] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#4B5563]"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#374151] mb-1">
              Confirmer le mot de passe
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-10 pl-9 pr-3 text-xs rounded-lg border border-[#D1D5DB] focus:outline-none focus:border-[#0D5C58] focus:ring-1 focus:ring-[#0D5C58] transition-colors"
              />
            </div>
          </div>
        </div>

        {/* HDS Consent */}
        <div className="flex items-start gap-2 pt-1">
          <input
            id="consent-hds"
            type="checkbox"
            checked={consentHds}
            onChange={(e) => setConsentHds(e.target.checked)}
            className="mt-0.5 rounded border-[#D1D5DB] text-[#0D5C58] focus:ring-[#0D5C58]"
          />
          <label htmlFor="consent-hds" className="text-[11px] text-[#6B7280] leading-tight">
            J'accepte le stockage sécurisé de mes données médicales conformément aux normes d'Hébergement de Données de Santé (HDS) et RGPD.
          </label>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full min-h-[42px] px-4 py-2.5 text-xs font-bold text-white bg-[#0D5C58] hover:bg-[#0B4E4A] rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
        >
          <span>Créer mon compte et accéder</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      {/* Switch to login */}
      <div className="pt-3 border-t border-[#F3F4F6] text-center">
        <p className="text-xs text-[#6B7280]">
          Vous possédez déjà un compte ?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="font-bold text-[#0D5C58] hover:underline cursor-pointer ml-1"
          >
            Se connecter
          </button>
        </p>
      </div>
    </div>
  );
};
