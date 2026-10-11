import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import {
  db,
  getUserByEmail,
  getUserById,
  verifyUserPassword,
  createUser,
  getAllPatientsWithDetails,
  getPatientById,
  getPrescriptionsByPatientId,
  getScansByPatientId,
  createPatientRecord,
  addPrescriptionRecord,
  deletePrescriptionRecord,
  getPrescriptionById,
  computePrescriptionSeal,
  addMedicalScanRecord,
  updateScanFindingsRecord,
  deleteMedicalScanRecord,
  addConsultationRecord,
  deleteConsultationRecord,
  getPatientVitals,
  addPatientVitalsRecord,
  getDoctorsWithDynamicSlots,
  getAllEquipmentsList,
  updateEquipmentStatus,
  getAllLogsList,
  addActivityLogRecord,
  verifyAuditTrailIntegrity,
  resetAllDataToDefault,
} from './db';
import { drugSafetyEngine } from './clinical/drugSafety';

// Requirement 1: Mandatory process.env.JWT_SECRET (no default fallback; abort startup if missing)
const rawSecret = process.env.JWT_SECRET;
if (!rawSecret || rawSecret.trim() === '') {
  throw new Error('FATAL: Variable process.env.JWT_SECRET manquante. Le serveur refuse de démarrer.');
}
export const JWT_SECRET: string = rawSecret;

const JWT_EXPIRES_IN = '8h';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    name: string;
    title: string;
  };
}

export const apiRouter = express.Router();
apiRouter.use(express.json());

// Requirement 4: Rate limit on authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 500 : 20, // generous in test mode, strictly limited in production
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Trop de tentatives d’authentification. Veuillez réessayer ultérieurement.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

// Suivi en mémoire des échecs consécutifs d'authentification (protection brute-force ciblée)
interface LoginAttemptRecord {
  failures: number;
  lockedUntil: number;
}
export const failedLoginAttempts = new Map<string, LoginAttemptRecord>();

export function checkLoginLockout(key: string): { isLocked: boolean; remainingSeconds: number } {
  const normKey = key.toLowerCase();
  const record = failedLoginAttempts.get(normKey);
  if (!record) return { isLocked: false, remainingSeconds: 0 };
  const now = Date.now();
  if (record.lockedUntil > now) {
    return { isLocked: true, remainingSeconds: Math.ceil((record.lockedUntil - now) / 1000) };
  }
  if (record.lockedUntil > 0 && record.lockedUntil <= now) {
    failedLoginAttempts.delete(normKey);
  }
  return { isLocked: false, remainingSeconds: 0 };
}

export function recordFailedLogin(key: string): number {
  const normKey = key.toLowerCase();
  const now = Date.now();
  const current = failedLoginAttempts.get(normKey) || { failures: 0, lockedUntil: 0 };
  current.failures += 1;
  if (current.failures >= 5) {
    current.lockedUntil = now + 15 * 60 * 1000;
  }
  failedLoginAttempts.set(normKey, current);
  return current.failures;
}

export function resetFailedLogin(key: string) {
  failedLoginAttempts.delete(key.toLowerCase());
}

// Helper: Sanitize user object (Requirement 6: Never expose password or password hash)
export function sanitizeUser(user: any) {
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
}

// -------------------------------------------------------------
// Middlewares: Authentication & RBAC Authorization
// -------------------------------------------------------------

// Requirement 2: Enforce algorithms: ['HS256'] in jwt.verify
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      error: 'Accès non authentifié. Jeton de sécurité requis (Bearer token).',
      code: 'UNAUTHENTICATED',
    });
  }

  jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }, (err: any, decoded: any) => {
    if (err) {
      return res.status(401).json({
        error: 'Jeton de session expiré ou invalide.',
        code: 'TOKEN_INVALID',
      });
    }

    // Active session verification in database (Zero-Trust Active State)
    const activeUser = getUserById(decoded.id);
    if (!activeUser) {
      return res.status(401).json({
        error: 'Compte utilisateur révoqué ou introuvable.',
        code: 'ACCOUNT_REVOKED',
      });
    }

    if (activeUser.status === 'INACTIVE' || activeUser.status === 'SUSPENDED') {
      return res.status(403).json({
        error: 'Ce compte utilisateur a été désactivé par l’administration.',
        code: 'ACCOUNT_DISABLED',
      });
    }

    req.user = decoded;
    next();
  });
}

export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié.', code: 'UNAUTHENTICATED' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      addActivityLogRecord({
        id: `LOG-ALERT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR').slice(0, 5),
        actorName: req.user.name,
        actorRole: req.user.role,
        action: 'ACCESS_DENIED_API',
        category: 'CONNEXION',
        patientName: 'Système',
        details: `Tentative d'accès non autorisé à ${req.method} ${req.originalUrl}. Rôle requis: [${allowedRoles.join(', ')}], rôle actuel: [${req.user.role}].`,
      });

      return res.status(403).json({
        error: `Accès interdit : cette opération requiert l'un des rôles suivants : [${allowedRoles.join(', ')}]. Votre rôle actuel est "${req.user.role}".`,
        code: 'ACCESS_DENIED',
      });
    }

    next();
  };
}

// Requirement 8: Helper to prevent IDOR on patient endpoints
export function canUserAccessPatient(user: any, patientId: string): boolean {
  if (!user) return false;
  if (user.role === 'DOCTOR' || user.role === 'ADMIN') return true;

  if (user.role === 'PATIENT') {
    const patient = getPatientById(patientId);
    if (!patient) return false;

    // Check direct ID match, email match, or name match
    return (
      patient.id === user.id ||
      patient.email.toLowerCase() === user.email.toLowerCase() ||
      patient.name.toLowerCase() === user.name.toLowerCase()
    );
  }

  return false;
}

// -------------------------------------------------------------
// 1. Health Endpoint
// -------------------------------------------------------------

apiRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    security: 'zero-trust-jwt-hs256',
    database: 'sqlite-hardened',
    timestamp: new Date().toISOString(),
  });
});

// -------------------------------------------------------------
// 2. Auth Endpoints: Login, Register, Me
// -------------------------------------------------------------

apiRouter.post('/auth/login', authLimiter, (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis.' });
    }

    // Protection anti force-brute ciblée : verrouillage après 5 tentatives consécutives
    const clientKey = `${req.ip || 'ip'}_${email.trim().toLowerCase()}`;
    const lockout = checkLoginLockout(clientKey);
    if (lockout.isLocked) {
      return res.status(429).json({
        error: `Compte temporairement verrouillé suite à 5 tentatives infructueuses consécutives. Veuillez patienter ${lockout.remainingSeconds}s.`,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: lockout.remainingSeconds,
      });
    }

    const user = getUserByEmail(email);

    // Requirement 5: Return identical error message for unknown user and bad password
    if (!user || !verifyUserPassword(user, password)) {
      const failures = recordFailedLogin(clientKey);

      addActivityLogRecord({
        id: `LOG-AUTH-FAIL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR').slice(0, 5),
        actorName: email,
        actorRole: 'INCONNU',
        action: 'CONNEXION_ÉCHOUÉE',
        category: 'CONNEXION',
        patientName: 'Système',
        details: `Échec de connexion pour ${email} (identifiants invalides). Tentative consécutive ${failures}/5.`,
      });

      if (failures >= 5) {
        return res.status(429).json({
          error: 'Compte temporairement verrouillé suite à 5 tentatives infructueuses consécutives. Accès suspendu pour 15 minutes.',
          code: 'RATE_LIMIT_EXCEEDED',
        });
      }

      return res.status(401).json({
        error: 'Identifiants invalides.',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Vérification du statut actif du compte utilisateur
    if (user.status === 'INACTIVE' || user.status === 'SUSPENDED') {
      return res.status(403).json({
        error: 'Ce compte utilisateur a été désactivé par l’administration hospitalière.',
        code: 'ACCOUNT_DISABLED',
      });
    }

    // Réinitialisation du compteur d'échecs après connexion réussie
    resetFailedLogin(clientKey);

    const safeUser = sanitizeUser(user);

    // Requirement 2: Sign with HS256 algorithm
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        title: user.title,
      },
      JWT_SECRET,
      { algorithm: 'HS256', expiresIn: JWT_EXPIRES_IN }
    );

    addActivityLogRecord({
      id: `LOG-AUTH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR').slice(0, 5),
      actorName: user.name,
      actorRole: user.title || user.role,
      action: 'CONNEXION_RÉUSSIE',
      category: 'CONNEXION',
      patientName: 'Système',
      details: `Authentification réussie pour ${user.name} (${user.role}). Jeton JWT HS256 émis.`,
    });

    res.json({ success: true, user: safeUser, token });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/auth/register', authLimiter, (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      birthDate,
      gender,
      bloodType,
      socialSecurityNumber,
      allergies,
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Champs obligatoires manquants.' });
    }

    const existing = getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Cette adresse email est déjà utilisée.' });
    }

    // Requirement 3: Force role to PATIENT on the server side
    const role = 'PATIENT';
    const resolvedTitle = 'Patient';
    const resolvedDept = 'Espace Patient';

    const uniqueSuffix = Date.now().toString().slice(-5);
    const userId = `user_patient_${uniqueSuffix}`;

    const createdUser = createUser({
      id: userId,
      name,
      email,
      password,
      role,
      title: resolvedTitle,
      department: resolvedDept,
      phone,
    });

    // Create corresponding Patient record
    let calculatedAge = 35;
    let formattedBirthDate = birthDate || '15/06/1990';
    if (birthDate) {
      const parts = birthDate.split('-');
      if (parts.length === 3) {
        calculatedAge = new Date().getFullYear() - parseInt(parts[0], 10);
        formattedBirthDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }

    const newPatient = {
      id: `PAT-2026-${uniqueSuffix}`,
      name,
      birthDate: formattedBirthDate,
      age: calculatedAge > 0 ? calculatedAge : 30,
      gender: gender || 'M',
      bloodType: bloodType || 'A Rh+ (Positif)',
      socialSecurityNumber: socialSecurityNumber || `1 ${uniqueSuffix.slice(0, 2)} 01 75 000 ${uniqueSuffix} 00`,
      weightKg: req.body.weightKg || req.body.weight || 65,
      heightCm: req.body.heightCm || req.body.height || 170,
      referringDoctor: 'Dr. Sarah Chen',
      allergies: allergies || ['Aucune allergie connue'],
      medicalHistory: [`Dossier médical patient créé le ${new Date().toLocaleDateString('fr-FR')}`],
      surgicalHistory: ['Aucun antécédent chirurgical majeur signalé'],
      phone: phone || '',
      email,
    };

    createPatientRecord(newPatient);

    const token = jwt.sign(
      {
        id: createdUser!.id,
        email: createdUser!.email,
        role: createdUser!.role,
        name: createdUser!.name,
        title: createdUser!.title,
      },
      JWT_SECRET,
      { algorithm: 'HS256', expiresIn: JWT_EXPIRES_IN }
    );

    addActivityLogRecord({
      id: `LOG-REG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR').slice(0, 5),
      actorName: name,
      actorRole: resolvedTitle,
      action: 'INSCRIPTION_NOUVEAU_COMPTE',
      category: 'CONNEXION',
      patientName: name,
      details: `Création du compte sécurisé [PATIENT] pour ${name} (${email}). Rôle forcé à PATIENT côté serveur.`,
    });

    // Requirement 6: Sanitize returned user
    res.json({ success: true, user: sanitizeUser(createdUser), token });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/auth/me', authenticateToken, (req: AuthenticatedRequest, res) => {
  const user = getUserById(req.user!.id);
  if (!user) {
    return res.status(404).json({ error: 'Utilisateur introuvable.' });
  }
  res.json({ success: true, user: sanitizeUser(user) });
});

// -------------------------------------------------------------
// 3. Patients (Zero-Trust & IDOR Prevention)
// -------------------------------------------------------------

apiRouter.get('/patients', authenticateToken, (req: AuthenticatedRequest, res) => {
  try {
    const patients = getAllPatientsWithDetails(req.user!.id, req.user!.role);
    res.json(patients);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Requirement 8: Individual patient access with IDOR check
apiRouter.get('/patients/:id', authenticateToken, (req: AuthenticatedRequest, res) => {
  try {
    const patientId = req.params.id;
    const patient = getPatientById(patientId);

    if (!patient) {
      return res.status(404).json({ error: 'Patient introuvable.', code: 'NOT_FOUND' });
    }

    if (!canUserAccessPatient(req.user, patientId)) {
      addActivityLogRecord({
        id: `LOG-IDOR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR').slice(0, 5),
        actorName: req.user!.name,
        actorRole: req.user!.role,
        action: 'ACCESS_DENIED_IDOR',
        category: 'DOSSIER',
        patientName: patient.name,
        details: `Tentative IDOR : le patient ${req.user!.name} (${req.user!.id}) a tenté d'accéder au dossier de ${patient.name} (${patientId}).`,
      });

      return res.status(403).json({
        error: "Accès refusé : vous n'êtes pas autorisé à consulter les données d'un autre patient.",
        code: 'ACCESS_DENIED',
      });
    }

    res.json(patient);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Requirement 8: Patient prescriptions with IDOR check
apiRouter.get('/patients/:id/prescriptions', authenticateToken, (req: AuthenticatedRequest, res) => {
  try {
    const patientId = req.params.id;
    if (!canUserAccessPatient(req.user, patientId)) {
      return res.status(403).json({
        error: "Accès refusé : vous n'êtes pas autorisé à consulter les prescriptions d'un autre patient.",
        code: 'ACCESS_DENIED',
      });
    }
    const prescriptions = getPrescriptionsByPatientId(patientId);
    res.json(prescriptions);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Requirement 8: Patient scans with IDOR check
apiRouter.get('/patients/:id/scans', authenticateToken, (req: AuthenticatedRequest, res) => {
  try {
    const patientId = req.params.id;
    if (!canUserAccessPatient(req.user, patientId)) {
      return res.status(403).json({
        error: "Accès refusé : vous n'êtes pas autorisé à consulter les clichés d'un autre patient.",
        code: 'ACCESS_DENIED',
      });
    }
    const scans = getScansByPatientId(patientId);
    res.json(scans);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Patient vitals with IDOR check
apiRouter.get('/patients/:id/vitals', authenticateToken, (req: AuthenticatedRequest, res) => {
  try {
    const patientId = req.params.id;
    if (!canUserAccessPatient(req.user, patientId)) {
      return res.status(403).json({
        error: "Accès refusé : vous n'êtes pas autorisé à consulter les constantes biométriques d'un autre patient.",
        code: 'ACCESS_DENIED',
      });
    }
    const vitals = getPatientVitals(patientId);
    res.json(vitals);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Patient vitals record submission (by patient themselves or authorized clinician)
apiRouter.post('/patients/:id/vitals', authenticateToken, (req: AuthenticatedRequest, res) => {
  try {
    const patientId = req.params.id;
    if (!canUserAccessPatient(req.user, patientId)) {
      return res.status(403).json({
        error: "Accès refusé : vous n'êtes pas autorisé à enregistrer des constantes pour un autre patient.",
        code: 'ACCESS_DENIED',
      });
    }

    const patient = getPatientById(patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient introuvable.', code: 'NOT_FOUND' });
    }

    const recorded = addPatientVitalsRecord({
      patientId,
      ...req.body,
      measuredBy: req.body.measuredBy || (req.user!.role === 'PATIENT' ? `${req.user!.name} (Automesure)` : `${req.user!.name} (${req.user!.title || req.user!.role})`),
    });

    addActivityLogRecord({
      id: `LOG-VIT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR').slice(0, 5),
      actorName: req.user!.name,
      actorRole: req.user!.title || req.user!.role,
      action: 'Enregistrement Constantes Biométriques',
      category: 'DOSSIER',
      patientName: patient.name,
      details: `Nouvelle mesure biométrique enregistrée pour ${patient.name} (FC: ${recorded.heartRate || '-'} bpm, TA: ${recorded.bloodPressureSys || '-'}/${recorded.bloodPressureDia || '-'} mmHg, SpO2: ${recorded.oxygenSaturation || '-'}%).`,
    });

    res.json({ success: true, vitals: recorded });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Doctor Directory & Live Availabilities
apiRouter.get('/doctors', authenticateToken, (_req: AuthenticatedRequest, res) => {
  try {
    const doctors = getDoctorsWithDynamicSlots();
    res.json(doctors);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 4. Prescriptions & Scellement d'Intégrité (Strict Doctor Only)
// -------------------------------------------------------------

apiRouter.post('/patients/:id/prescriptions', authenticateToken, requireRole('DOCTOR'), (req: AuthenticatedRequest, res) => {
  try {
    const patientId = req.params.id;
    const patient = getPatientById(patientId);

    if (!patient) {
      return res.status(404).json({ error: 'Patient introuvable.', code: 'NOT_FOUND' });
    }

    const { medication, dosage, frequency, duration, instructions, override, justification } = req.body;

    if (!medication || typeof medication !== 'string' || !medication.trim()) {
      return res.status(400).json({ error: 'Le nom du médicament est obligatoire.', code: 'INVALID_MEDICATION' });
    }

    // 1. Analyse allergologique & allergies croisées
    const allergyCheck = drugSafetyEngine.checkAllergyContraindication(medication, patient.allergies || []);

    // 2. Analyse des interactions avec les traitements actifs
    const activePrescriptions = (patient.prescriptions || [])
      .filter((p: any) => p.status === 'ACTIVE')
      .map((p: any) => p.medication);
    const interactionCheck = drugSafetyEngine.checkInteractions(medication, activePrescriptions);

    const hasBlockingConflict = allergyCheck.hasContraindication || interactionCheck.hasMajorInteraction;

    // 3. Gestion de l'override clinique (dérogation justifiée)
    if (hasBlockingConflict) {
      if (override === true) {
        if (!justification || typeof justification !== 'string' || justification.trim().length < 20) {
          return res.status(400).json({
            error: 'La justification clinique de levée de blocage (override) est obligatoire et doit comporter au moins 20 caractères.',
            code: 'INVALID_JUSTIFICATION',
          });
        }

        // Journalisation obligatoire de l'override clinique dans la chaîne d'audit immuable
        const moleculeCible = allergyCheck.matchedMolecule ||
          interactionCheck.majorInteractions[0]?.moleculeA ||
          medication;

        const motifType = allergyCheck.hasContraindication ? 'Allergie / Contre-indication' : 'Interaction majeure';

        addActivityLogRecord({
          id: `LOG-OVERRIDE-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          timestamp: new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR').slice(0, 5),
          actorName: req.user!.name,
          actorRole: req.user!.title || req.user!.role,
          action: 'Levée de contre-indication (Override Clinique)',
          category: 'ORDONNANCE',
          patientName: patient.name,
          details: `Dérogation clinique accordée par le praticien pour "${medication}" (${motifType}). Molécule: ${moleculeCible}. Motif clinique: "${justification.trim()}".`,
        });
      } else {
        // Blocage 409
        if (allergyCheck.hasContraindication) {
          return res.status(409).json({
            error: 'Contre-indication allergique détectée pour le patient.',
            code: 'ALLERGY_CONTRAINDICATION',
            contraindication: {
              type: 'ALLERGY',
              severity: 'CRITICAL',
              allergy: allergyCheck.matchedAllergy,
              medication,
              matchedMolecule: allergyCheck.matchedMolecule,
              drugClass: allergyCheck.drugClass,
              reason: allergyCheck.reason,
              notice: drugSafetyEngine.legalNotice,
            },
            warnings: interactionCheck.moderateInteractions,
          });
        }

        if (interactionCheck.hasMajorInteraction) {
          return res.status(409).json({
            error: 'Interaction médicamenteuse majeure bloquante détectée avec un traitement actif.',
            code: 'MAJOR_DRUG_INTERACTION',
            interaction: {
              type: 'MAJOR_INTERACTION',
              severity: 'MAJOR',
              details: interactionCheck.majorInteractions,
              notice: drugSafetyEngine.legalNotice,
            },
            warnings: interactionCheck.moderateInteractions,
          });
        }
      }
    }

    // 4. Enregistrement de l'ordonnance et scellement d'intégrité SHA-256
    const prescriptionData = {
      ...req.body,
      patientId,
      medication: medication.trim(),
      dosage: dosage?.trim() || 'Standard',
      frequency: frequency?.trim() || '1x/jour',
      duration: duration?.trim() || '1 mois',
      instructions: instructions?.trim() || null,
      prescribedBy: req.user!.name,
    };

    const savedPrescription = addPrescriptionRecord(prescriptionData);

    // Journalisation standard de délivrance d'ordonnance
    addActivityLogRecord({
      id: `LOG-ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR').slice(0, 5),
      actorName: req.user!.name,
      actorRole: req.user!.title,
      action: "Délivrance d'ordonnance",
      category: 'ORDONNANCE',
      patientName: patient.name,
      details: `Prescription scellée pour ${prescriptionData.medication} (${prescriptionData.dosage}). Empreinte SHA-256: ${savedPrescription.integritySeal?.slice(0, 16)}...`,
    });

    res.json({
      success: true,
      prescription: savedPrescription,
      warnings: interactionCheck.moderateInteractions,
      overridden: Boolean(hasBlockingConflict && override),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Vérification publique d'un Scellement d'Intégrité d'ordonnance (QR Code)
// Libellé strictement conforme : "Scellement d'intégrité" (pas "signature qualifiée")
apiRouter.get('/prescriptions/:id/verify', (req, res) => {
  try {
    const presc = getPrescriptionById(req.params.id);
    if (!presc) {
      return res.status(404).json({
        isValid: false,
        error: 'Ordonnance introuvable dans le registre hospitalier.',
        code: 'NOT_FOUND',
      });
    }

    const computed = computePrescriptionSeal({
      patientId: presc.patientId,
      datePrescribed: presc.datePrescribed,
      medication: presc.medication,
      dosage: presc.dosage,
      prescribedBy: presc.prescribedBy,
    });

    const isMatch = Boolean(presc.integritySeal && presc.integritySeal === computed);

    res.json({
      isValid: isMatch,
      label: "Scellement d'intégrité",
      prescriptionId: presc.id,
      patientId: presc.patientId,
      medication: presc.medication,
      dosage: presc.dosage,
      datePrescribed: presc.datePrescribed,
      prescribedBy: presc.prescribedBy,
      storedSeal: presc.integritySeal,
      computedSeal: computed,
      sealedAt: presc.sealedAt,
      verificationStatus: isMatch ? 'CONFORME_NON_ALTERE' : 'ALTERATION_DETECTEE',
      message: isMatch
        ? "Scellement d'intégrité SHA-256 valide. Le document n'a subi aucune falsification."
        : "Alerte de sécurité : l'empreinte calculée ne correspond pas au scellement d'origine. Document altéré.",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/patients/:id/prescriptions/:prescId', authenticateToken, requireRole('DOCTOR'), (req, res) => {
  try {
    deletePrescriptionRecord(req.params.prescId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 5. Medical Scans (Doctor Only)
// -------------------------------------------------------------

apiRouter.post('/patients/:id/scans', authenticateToken, requireRole('DOCTOR'), (req: AuthenticatedRequest, res) => {
  try {
    const patientId = req.params.id;
    const scan = { ...req.body, patientId };
    addMedicalScanRecord(scan);

    addActivityLogRecord({
      id: `LOG-SCAN-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR').slice(0, 5),
      actorName: req.user!.name,
      actorRole: req.user!.title,
      action: "Ajout d'examen d'imagerie",
      category: 'IMAGERIE',
      patientName: scan.patientName || patientId,
      details: `Ajout de l'examen ${scan.title} (${scan.modality}).`,
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/patients/:id/scans/:scanId', authenticateToken, requireRole('DOCTOR'), (req: AuthenticatedRequest, res) => {
  try {
    const { findings, radiologistNote } = req.body;
    updateScanFindingsRecord(req.params.scanId, findings, radiologistNote);

    addActivityLogRecord({
      id: `LOG-REP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR').slice(0, 5),
      actorName: req.user!.name,
      actorRole: req.user!.title,
      action: 'Validation Compte-Rendu Imagerie',
      category: 'IMAGERIE',
      patientName: req.body.patientName || 'Patient',
      details: `Mise à jour et validation des conclusions radiologiques pour l'examen #${req.params.scanId}.`,
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/patients/:id/scans/:scanId', authenticateToken, requireRole('DOCTOR'), (req, res) => {
  try {
    deleteMedicalScanRecord(req.params.scanId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 6. Consultations (Doctor or Patient)
// -------------------------------------------------------------

apiRouter.post('/consultations', authenticateToken, (req: AuthenticatedRequest, res) => {
  try {
    const { doctorName, dateTime, reason } = req.body;
    let patientId = req.body.patientId;
    let patientName = req.body.patientName;

    if (!doctorName || !dateTime) {
      return res.status(400).json({ error: 'Médecin et date/heure de consultation requis.', code: 'MISSING_FIELDS' });
    }

    if (req.user!.role === 'PATIENT') {
      patientName = req.user!.name;
      // Resolve patient id
      if (!patientId) {
        const found = db.prepare("SELECT id FROM patients WHERE id = ? OR LOWER(email) = LOWER(?) OR LOWER(name) = LOWER(?)").get(req.user!.id, req.user!.email, req.user!.name) as any;
        patientId = found ? found.id : req.user!.id;
      }
    }

    // Check for slot conflict with same doctor and dateTime
    const existingConflict = db.prepare(
      "SELECT id FROM consultations WHERE doctor_name = ? AND date_time = ? AND status != 'CANCELLED'"
    ).get(doctorName, dateTime) as any;

    if (existingConflict) {
      return res.status(409).json({
        error: `Ce créneau (${dateTime}) est déjà réservé pour le ${doctorName}. Veuillez sélectionner un autre horaire.`,
        code: 'SLOT_UNAVAILABLE',
      });
    }

    addConsultationRecord({
      ...req.body,
      patientId,
      patientName,
      status: 'SCHEDULED',
    });

    addActivityLogRecord({
      id: `LOG-RDV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR').slice(0, 5),
      actorName: req.user!.name,
      actorRole: req.user!.title || req.user!.role,
      action: 'Réservation Consultation',
      category: 'CONSULTATION',
      patientName: patientName || 'Patient',
      details: `Rendez-vous programmé avec ${doctorName} le ${dateTime} (${reason || 'Consultation'}). Réservé par ${req.user!.name}.`,
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/consultations/:id', authenticateToken, (req: AuthenticatedRequest, res) => {
  try {
    const consultationId = req.params.id;
    const existing = db.prepare('SELECT * FROM consultations WHERE id = ?').get(consultationId) as any;

    if (!existing) {
      return res.status(404).json({ error: 'Consultation introuvable.', code: 'NOT_FOUND' });
    }

    // If PATIENT, check that the consultation belongs to them
    if (req.user!.role === 'PATIENT') {
      const isOwner =
        existing.patient_id === req.user!.id ||
        existing.patient_name.toLowerCase() === req.user!.name.toLowerCase() ||
        canUserAccessPatient(req.user, existing.patient_id);

      if (!isOwner) {
        return res.status(403).json({
          error: "Accès refusé : vous ne pouvez pas annuler la consultation d'un autre patient.",
          code: 'ACCESS_DENIED',
        });
      }
    }

    deleteConsultationRecord(consultationId);

    addActivityLogRecord({
      id: `LOG-RDV-CANCEL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR').slice(0, 5),
      actorName: req.user!.name,
      actorRole: req.user!.title || req.user!.role,
      action: 'Annulation Consultation',
      category: 'CONSULTATION',
      patientName: existing.patient_name,
      details: `Annulation du rendez-vous du ${existing.date_time} avec ${existing.doctor_name} pour ${existing.patient_name}.`,
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 7. Equipments (Read: Authenticated / Write: Admin Only)
// -------------------------------------------------------------

apiRouter.get('/equipments', authenticateToken, (_req, res) => {
  try {
    const list = getAllEquipmentsList();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/equipments/:id/status', authenticateToken, requireRole('ADMIN'), (req: AuthenticatedRequest, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['DISPONIBLE', 'EN_COURS', 'MAINTENANCE'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Statut invalide. Valeurs autorisées: [${validStatuses.join(', ')}].`,
        code: 'INVALID_STATUS',
      });
    }
    const updated = updateEquipmentStatus(req.params.id, status);
    if (!updated) {
      return res.status(404).json({ error: 'Équipement non trouvé.', code: 'NOT_FOUND' });
    }

    addActivityLogRecord({
      id: `LOG-EQ-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR').slice(0, 5),
      actorName: req.user!.name,
      actorRole: req.user!.title || req.user!.role,
      action: 'Modification Statut Équipement',
      category: 'EQUIPEMENT',
      patientName: 'Système',
      details: `Changement du statut de l'équipement [${updated.name}] vers "${status}".`,
    });

    res.json({ success: true, equipment: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// 8. Activity Logs & Cryptographic Audit Trail (Admin Only)
// -------------------------------------------------------------

apiRouter.get('/logs', authenticateToken, requireRole('ADMIN'), (_req, res) => {
  try {
    const logs = getAllLogsList();
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/logs', authenticateToken, (req: AuthenticatedRequest, res) => {
  try {
    addActivityLogRecord({
      ...req.body,
      actorName: req.user!.name,
      actorRole: req.user!.title || req.user!.role,
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/logs/verify', authenticateToken, requireRole('ADMIN'), (_req, res) => {
  try {
    const result = verifyAuditTrailIntegrity();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// WORM Compliance: Logs deletion forbidden (HTTP 405 Method Not Allowed)
apiRouter.delete('/logs', authenticateToken, requireRole('ADMIN'), (_req, res) => {
  res.status(405).json({
    error: 'Opération interdite : le journal d’audit est immuable (conformité WORM / Zero-Trust). La suppression des traces est formellement bloquée.',
    code: 'IMMUTABLE_LOGS_VIOLATION',
  });
});

// -------------------------------------------------------------
// 9. Reset Demo Database (Admin Only, Preserves Activity Logs)
// -------------------------------------------------------------

apiRouter.post('/reset', authenticateToken, requireRole('ADMIN'), (req: AuthenticatedRequest, res) => {
  try {
    // Requirement 7: Activity logs are never purged on reset
    resetAllDataToDefault();

    addActivityLogRecord({
      id: `LOG-RESET-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR').slice(0, 5),
      actorName: req.user!.name,
      actorRole: req.user!.title,
      action: 'Réinitialisation Base Démonstration',
      category: 'EQUIPEMENT',
      patientName: 'Système',
      details: 'Réinitialisation des dossiers cliniques (registre d’audit cryptographique WORM conservé et scellé).',
    });

    res.json({
      success: true,
      message: 'Données cliniques réinitialisées. Le registre d’audit reste conservé et intact.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
