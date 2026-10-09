import express from 'express';
import {
  getUserByEmail,
  getUserById,
  createUser,
  getAllPatientsWithDetails,
  createPatientRecord,
  addPrescriptionRecord,
  deletePrescriptionRecord,
  addMedicalScanRecord,
  updateScanFindingsRecord,
  deleteMedicalScanRecord,
  addConsultationRecord,
  deleteConsultationRecord,
  getAllEquipmentsList,
  getAllLogsList,
  addActivityLogRecord,
  resetAllDataToDefault,
} from './db';

export const apiRouter = express.Router();
apiRouter.use(express.json());

// 1. Health check
apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', database: 'sqlite', timestamp: new Date().toISOString() });
});

// 2. Auth: Login
apiRouter.post('/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis.' });
    }

    const user = getUserByEmail(email);
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Identifiants invalides.' });
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      title: user.title,
      department: user.department,
      phone: user.phone,
      avatarUrl: user.avatar_url,
    };

    res.json({ success: true, user: safeUser });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Auth: Register
apiRouter.post('/auth/register', (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      phone,
      birthDate,
      gender,
      bloodType,
      socialSecurityNumber,
      allergies,
      title,
      department,
    } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Champs obligatoires manquants.' });
    }

    const existing = getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Cette adresse email est déjà utilisée.' });
    }

    const uniqueSuffix = Date.now().toString().slice(-5);
    const userId = `user_${role.toLowerCase()}_${uniqueSuffix}`;

    let resolvedTitle = title || '';
    let resolvedDept = department || '';
    if (role === 'PATIENT') {
      resolvedTitle = 'Patient';
      resolvedDept = 'Espace Patient';
    } else if (role === 'DOCTOR') {
      resolvedTitle = resolvedTitle || 'Médecin Praticien';
      resolvedDept = resolvedDept || 'Service de Médecine Générale';
    } else if (role === 'ADMIN') {
      resolvedTitle = resolvedTitle || 'Administrateur Hospitalier';
      resolvedDept = resolvedDept || 'Direction des Admissions';
    }

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

    // If PATIENT, create PatientRecord
    if (role === 'PATIENT') {
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
        weightKg: 70,
        heightCm: 175,
        referringDoctor: 'Dr. Sarah Chen',
        allergies: allergies || ['Aucune allergie connue'],
        medicalHistory: [`Dossier médical patient créé le ${new Date().toLocaleDateString('fr-FR')}`],
        surgicalHistory: ['Aucun antécédent chirurgical majeur signalé'],
        phone: phone || '',
        email,
      };

      createPatientRecord(newPatient);
    }

    // Log registration
    addActivityLogRecord({
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR').slice(0, 5),
      actorName: name,
      actorRole: resolvedTitle,
      action: 'INSCRIPTION_NOUVEAU_COMPTE',
      category: 'CONNEXION',
      patientName: role === 'PATIENT' ? name : 'Système',
      details: `Création du compte ${role} pour ${name} (${email}) dans la base SQLite.`,
    });

    res.json({ success: true, user: createdUser });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Patients
apiRouter.get('/patients', (req, res) => {
  try {
    const patients = getAllPatientsWithDetails();
    res.json(patients);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Prescriptions
apiRouter.post('/patients/:id/prescriptions', (req, res) => {
  try {
    const patientId = req.params.id;
    const prescription = { ...req.body, patientId };
    addPrescriptionRecord(prescription);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/patients/:id/prescriptions/:prescId', (req, res) => {
  try {
    deletePrescriptionRecord(req.params.prescId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Medical Scans
apiRouter.post('/patients/:id/scans', (req, res) => {
  try {
    const patientId = req.params.id;
    const scan = { ...req.body, patientId };
    addMedicalScanRecord(scan);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/patients/:id/scans/:scanId', (req, res) => {
  try {
    const { findings, radiologistNote } = req.body;
    updateScanFindingsRecord(req.params.scanId, findings, radiologistNote);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/patients/:id/scans/:scanId', (req, res) => {
  try {
    deleteMedicalScanRecord(req.params.scanId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Consultations
apiRouter.post('/consultations', (req, res) => {
  try {
    addConsultationRecord(req.body);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/consultations/:id', (req, res) => {
  try {
    deleteConsultationRecord(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Equipments
apiRouter.get('/equipments', (req, res) => {
  try {
    const list = getAllEquipmentsList();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Activity Logs
apiRouter.get('/logs', (req, res) => {
  try {
    const logs = getAllLogsList();
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/logs', (req, res) => {
  try {
    addActivityLogRecord(req.body);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Reset Database
apiRouter.post('/reset', (req, res) => {
  try {
    resetAllDataToDefault();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
