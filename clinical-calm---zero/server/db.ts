import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file path in root of clinical-calm---zero
const DB_PATH = path.resolve(__dirname, '..', 'clinical_calm.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL,
      title TEXT,
      department TEXT,
      phone TEXT,
      avatar_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      birth_date TEXT,
      age INTEGER,
      gender TEXT,
      blood_type TEXT,
      social_security_number TEXT,
      weight_kg REAL,
      height_cm REAL,
      referring_doctor TEXT,
      allergies TEXT, -- JSON array
      medical_history TEXT, -- JSON array
      surgical_history TEXT, -- JSON array
      phone TEXT,
      email TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS prescriptions (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      medication TEXT NOT NULL,
      dosage TEXT,
      frequency TEXT,
      duration TEXT,
      instructions TEXT,
      prescribed_by TEXT,
      date_prescribed TEXT,
      refills_remaining INTEGER DEFAULT 0,
      status TEXT DEFAULT 'ACTIVE',
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS medical_scans (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      patient_name TEXT NOT NULL,
      title TEXT NOT NULL,
      modality TEXT NOT NULL,
      body_part TEXT,
      study_date TEXT,
      acquisition_device TEXT,
      image_url TEXT,
      is_external_link INTEGER DEFAULT 0,
      findings TEXT,
      radiologist_note TEXT,
      status TEXT DEFAULT 'VALIDÉ',
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS consultations (
      id TEXT PRIMARY KEY,
      patient_id TEXT NOT NULL,
      patient_name TEXT NOT NULL,
      doctor_name TEXT NOT NULL,
      specialty TEXT,
      date_time TEXT,
      location TEXT,
      status TEXT DEFAULT 'SCHEDULED',
      reason TEXT,
      notes TEXT,
      preparation_instructions TEXT,
      FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS equipments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      location TEXT,
      status TEXT,
      last_maintenance TEXT,
      next_maintenance TEXT
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      category TEXT,
      patient_name TEXT,
      details TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default demo data if empty
  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  if (userCount === 0) {
    seedDatabase();
  }
}

export function seedDatabase() {
  const seedUsers = db.transaction(() => {
    // 1. Seed demo users
    const insertUser = db.prepare(`
      INSERT OR REPLACE INTO users (id, name, email, password, role, title, department, phone, avatar_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertUser.run(
      'user_patient_julien',
      'Julien Moreau',
      'julien.moreau@clinical-calm.demo',
      'julien123',
      'PATIENT',
      'Patient',
      'Espace Patient',
      '06 12 34 56 78',
      null
    );

    insertUser.run(
      'user_dr_chen',
      'Dr. Sarah Chen',
      'sarah.chen@clinical-calm.demo',
      'sarah2026',
      'DOCTOR',
      'Chef de Clinique - Pneumologie & Radiologie',
      'Service d\'Imagerie Diagnostique & Pneumologie',
      '01 42 16 00 24',
      null
    );

    insertUser.run(
      'user_admin_marc',
      'Marc Lefèvre',
      'marc.lefevre@clinical-calm.demo',
      'admin2026',
      'ADMIN',
      'Directeur des Opérations & Admissions',
      'Direction des Services de Santé',
      '01 42 16 00 10',
      null
    );

    // 2. Seed initial patients
    const insertPatient = db.prepare(`
      INSERT OR REPLACE INTO patients (
        id, name, birth_date, age, gender, blood_type, social_security_number,
        weight_kg, height_cm, referring_doctor, allergies, medical_history,
        surgical_history, phone, email
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertPatient.run(
      'PAT-2026-001',
      'Julien Moreau',
      '14/08/1984',
      42,
      'M',
      'O Rh+ (Positif)',
      '1 84 08 75 112 048 22',
      74,
      178,
      'Dr. Sarah Chen',
      JSON.stringify(['Pénicilline (réaction cutanée sévère)', 'Pollen de graminées']),
      JSON.stringify([
        'Asthme modéré de l\'adulte (suivi pneumologique régulier depuis 2018)',
        'Hypertension artérielle légère équilibrée sous traitement',
        'Rhinite allergique saisonnière'
      ]),
      JSON.stringify([
        'Appendicectomie sous coelioscopie (Clinique des Lilas, 2012)',
        'Suture du ligament collatéral genou droit (2017)'
      ]),
      '06 12 34 56 78',
      'julien.moreau@email.fr'
    );

    insertPatient.run(
      'PAT-2026-002',
      'Sophie Bernard',
      '22/11/1991',
      35,
      'F',
      'A Rh+ (Positif)',
      '2 91 11 75 224 819 14',
      58,
      165,
      'Dr. Sarah Chen',
      JSON.stringify(['Aucune allergie connue']),
      JSON.stringify(['Migraines ophtalmiques avec aura', 'Hypothyroïdie fruste traitée']),
      JSON.stringify(['Amygdalectomie dans l\'enfance']),
      '06 98 76 54 32',
      'sophie.bernard@email.fr'
    );

    insertPatient.run(
      'PAT-2026-003',
      'Michel Dumont',
      '05/03/1958',
      68,
      'M',
      'B Rh+ (Positif)',
      '1 58 03 69 415 829 33',
      82,
      172,
      'Dr. Philippe Roux',
      JSON.stringify(['Iode (produits de contraste)', 'Aspirine']),
      JSON.stringify([
        'Diabète de type 2 sous antidiabétiques oraux',
        'Arthrose de hanche gauche opérée'
      ]),
      JSON.stringify(['Prothèse totale de hanche gauche (2021)']),
      '06 55 44 33 22',
      'michel.dumont@email.fr'
    );

    // 3. Seed Prescriptions
    const insertPresc = db.prepare(`
      INSERT OR REPLACE INTO prescriptions (
        id, patient_id, medication, dosage, frequency, duration, instructions,
        prescribed_by, date_prescribed, refills_remaining, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertPresc.run(
      'ORD-2026-891',
      'PAT-2026-001',
      'Symbicort Turbuhaler (Budésonide / Formotérol 200/6 µg)',
      '200/6 µg par inhalation',
      '2 inhalations matin et soir',
      'Traitement de fond continu (6 mois)',
      'Se rincer la bouche après chaque inhalation pour éviter mycose buccale.',
      'Dr. Sarah Chen (Pneumologie)',
      '02/10/2026',
      3,
      'ACTIVE'
    );

    insertPresc.run(
      'ORD-2026-892',
      'PAT-2026-001',
      'Ventoline 100 µg (Salbutamol aérosol-doseur)',
      '100 µg par bouffée',
      '1 à 2 bouffées en cas de crise d\'essoufflement ou d\'effort',
      'Traitement de secours ponctuel',
      'À avoir constamment à portée de main lors des activités physiques.',
      'Dr. Sarah Chen (Pneumologie)',
      '02/10/2026',
      2,
      'ACTIVE'
    );

    insertPresc.run(
      'ORD-2026-880',
      'PAT-2026-002',
      'Lévothyrox 50 µg',
      '50 µg comprimé sécable',
      '1 comprimé par jour',
      '6 mois',
      'À jeun le matin 30 minutes avant le petit-déjeuner.',
      'Dr. Sarah Chen',
      '20/09/2026',
      4,
      'ACTIVE'
    );

    // 4. Seed Medical Scans
    const insertScan = db.prepare(`
      INSERT OR REPLACE INTO medical_scans (
        id, patient_id, patient_name, title, modality, body_part, study_date,
        acquisition_device, image_url, is_external_link, findings, radiologist_note, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertScan.run(
      'SCAN-2026-CT-0482',
      'PAT-2026-001',
      'Julien Moreau',
      'Scanner Thoracique Haute Résolution (HRCT)',
      'CT',
      'Parenchyme Pulmonaire & Médiastin',
      '06/10/2026 09:42',
      'Scanner GE Revolution CT 256',
      'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1200&q=80',
      0,
      'Parenchyme pulmonaire bilatéralement aéré. Micronodule sous-pleural de 3.2 mm lobaire supérieur droit d\'allure bénigne et stable à 6 mois. Absence de foyer de condensation ou d\'épanchement pleural.',
      'Examen rassurant. Contrôle de routine préconisé dans 1 an.',
      'VALIDÉ'
    );

    insertScan.run(
      'SCAN-2026-MRI-201',
      'PAT-2026-002',
      'Sophie Bernard',
      'IRM Cérébrale Séquences 3D T1 & T2-FLAIR',
      'IRM',
      'Encéphale',
      '25/09/2026 15:30',
      'IRM Siemens Magnetom Vida 3T',
      'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=1200&q=80',
      0,
      'Examen cérébral dans les limites de la normale. Pas d\'anomalie de signal parenchymateuse. Absence de lésion démyélinisante.',
      'Bilan morphologique normal.',
      'VALIDÉ'
    );

    // 5. Seed Consultations
    const insertConsult = db.prepare(`
      INSERT OR REPLACE INTO consultations (
        id, patient_id, patient_name, doctor_name, specialty, date_time,
        location, status, reason, notes, preparation_instructions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertConsult.run(
      'RDV-2026-101',
      'PAT-2026-001',
      'Julien Moreau',
      'Dr. Sarah Chen',
      'Pneumologie & Bilan Thoracique',
      '14 Octobre 2026 à 10:30',
      'Bâtiment B - Service de Pneumologie, Salle 204',
      'SCHEDULED',
      'Consultation de suivi semestriel et lecture du scanner thoracique',
      null,
      'Apporter votre carnet de mesures de débit expiratoire de pointe (Peak Flow).'
    );

    insertConsult.run(
      'RDV-2026-103',
      'PAT-2026-002',
      'Sophie Bernard',
      'Dr. Sarah Chen',
      'Neurologie & Céphalées',
      '18 Octobre 2026 à 09:15',
      'Bâtiment B - Salle 204',
      'SCHEDULED',
      'Suivi de traitement prophylactique et bilan des migraines',
      null,
      'Tenir un agenda des crises sur les 15 derniers jours.'
    );

    // 6. Seed Equipments
    const insertEquip = db.prepare(`
      INSERT OR REPLACE INTO equipments (id, name, type, location, status, last_maintenance, next_maintenance)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertEquip.run('EQ-CT-01', 'Scanner Tomodensitométrique GE Revolution CT 256', 'Scanner Imagerie Haute Résolution', 'Imagerie Médicale - Salle de Scanner 3 (RDC)', 'DISPONIBLE', '15/09/2026', '15/12/2026');
    insertEquip.run('EQ-MRI-01', 'IRM Siemens Magnetom Vida 3 Tesla', 'Imagerie par Résonance Magnétique 3T', 'Centre de Neuro-Imagerie - Pavillon B', 'DISPONIBLE', '28/08/2026', '28/11/2026');
    insertEquip.run('EQ-ECHO-02', 'Échographe Doppler Philips Epiq CVx', 'Échographie Cardiovasculaire Avancée', 'Unité de Soins Intensifs Cardiologiques (Étage 2)', 'DISPONIBLE', '02/10/2026', '02/01/2027');
    insertEquip.run('EQ-RAD-03', 'Table de Radiographie Numérique Agfa DR 600', 'Radiologie Osseuse et Pulmonaire', 'Imagerie des Urgences - Salle 1', 'MAINTENANCE', '05/10/2026', '08/10/2026');

    // 7. Seed Activity Logs
    const insertLog = db.prepare(`
      INSERT OR REPLACE INTO activity_logs (id, timestamp, actor_name, actor_role, action, category, patient_name, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertLog.run('LOG-01', '07/10/2026 à 14:38', 'Dr. Sarah Chen', 'Médecin', 'Consultation d\'Imagerie Médicale', 'IMAGERIE', 'Julien Moreau', 'Relecture et analyse du Scanner Thoracique HRCT.');
    insertLog.run('LOG-02', '07/10/2026 à 13:10', 'Dr. Sarah Chen', 'Médecin', 'Délivrance d\'ordonnance', 'ORDONNANCE', 'Sophie Bernard', 'Prescription de Zomig Orodispersible 2.5mg.');
    insertLog.run('LOG-03', '07/10/2026 à 09:00', 'Marc Lefèvre', 'Administrateur', 'Initialisation Système', 'EQUIPEMENT', 'Système', 'Vérification de la conformité du parc d\'équipements.');
  });

  seedUsers();
}

// Queries & operations helper functions
export function getAllUsers() {
  return db.prepare('SELECT id, name, email, role, title, department, phone, avatar_url as avatarUrl FROM users').all();
}

export function getUserByEmail(email: string) {
  return db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email) as any;
}

export function getUserById(id: string) {
  return db.prepare('SELECT id, name, email, role, title, department, phone, avatar_url as avatarUrl FROM users WHERE id = ?').get(id) as any;
}

export function createUser(user: {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
  title: string;
  department: string;
  phone?: string;
}) {
  const stmt = db.prepare(`
    INSERT INTO users (id, name, email, password, role, title, department, phone)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(user.id, user.name, user.email, user.password, user.role, user.title, user.department, user.phone || null);
  return getUserById(user.id);
}

export function getAllPatientsWithDetails() {
  const patientsRows = db.prepare('SELECT * FROM patients ORDER BY name ASC').all() as any[];

  return patientsRows.map((p) => {
    const prescriptions = db.prepare(`
      SELECT id, medication, dosage, frequency, duration, instructions,
             prescribed_by as prescribedBy, date_prescribed as datePrescribed,
             refills_remaining as refillsRemaining, status
      FROM prescriptions WHERE patient_id = ? ORDER BY rowid DESC
    `).all(p.id) as any[];

    const scans = db.prepare(`
      SELECT id, patient_id as patientId, patient_name as patientName,
             title, modality, body_part as bodyPart, study_date as studyDate,
             acquisition_device as acquisitionDevice, image_url as imageUrl,
             is_external_link as isExternalLink, findings,
             radiologist_note as radiologistNote, status
      FROM medical_scans WHERE patient_id = ? ORDER BY rowid DESC
    `).all(p.id) as any[];

    const consultations = db.prepare(`
      SELECT id, patient_id as patientId, patient_name as patientName,
             doctor_name as doctorName, specialty, date_time as dateTime,
             location, status, reason, notes,
             preparation_instructions as preparationInstructions
      FROM consultations WHERE patient_id = ? ORDER BY rowid DESC
    `).all(p.id) as any[];

    return {
      id: p.id,
      name: p.name,
      birthDate: p.birth_date,
      age: p.age,
      gender: p.gender,
      bloodType: p.blood_type,
      socialSecurityNumber: p.social_security_number,
      weightKg: p.weight_kg,
      heightCm: p.height_cm,
      referringDoctor: p.referring_doctor,
      allergies: p.allergies ? JSON.parse(p.allergies) : [],
      medicalHistory: p.medical_history ? JSON.parse(p.medical_history) : [],
      surgicalHistory: p.surgical_history ? JSON.parse(p.surgical_history) : [],
      phone: p.phone,
      email: p.email,
      prescriptions,
      scans,
      consultations,
    };
  });
}

export function createPatientRecord(p: any) {
  const stmt = db.prepare(`
    INSERT INTO patients (
      id, name, birth_date, age, gender, blood_type, social_security_number,
      weight_kg, height_cm, referring_doctor, allergies, medical_history,
      surgical_history, phone, email
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    p.id,
    p.name,
    p.birthDate,
    p.age,
    p.gender,
    p.bloodType,
    p.socialSecurityNumber,
    p.weightKg || 70,
    p.heightCm || 175,
    p.referringDoctor || 'Dr. Sarah Chen',
    JSON.stringify(p.allergies || []),
    JSON.stringify(p.medicalHistory || []),
    JSON.stringify(p.surgicalHistory || []),
    p.phone || '',
    p.email || ''
  );
}

export function addPrescriptionRecord(item: any) {
  const stmt = db.prepare(`
    INSERT INTO prescriptions (
      id, patient_id, medication, dosage, frequency, duration, instructions,
      prescribed_by, date_prescribed, refills_remaining, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    item.id,
    item.patientId,
    item.medication,
    item.dosage,
    item.frequency,
    item.duration,
    item.instructions,
    item.prescribedBy,
    item.datePrescribed,
    item.refillsRemaining ?? 1,
    item.status || 'ACTIVE'
  );
}

export function deletePrescriptionRecord(id: string) {
  db.prepare('DELETE FROM prescriptions WHERE id = ?').run(id);
}

export function addMedicalScanRecord(scan: any) {
  const stmt = db.prepare(`
    INSERT INTO medical_scans (
      id, patient_id, patient_name, title, modality, body_part, study_date,
      acquisition_device, image_url, is_external_link, findings, radiologist_note, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    scan.id,
    scan.patientId,
    scan.patientName,
    scan.title,
    scan.modality,
    scan.bodyPart,
    scan.studyDate,
    scan.acquisitionDevice,
    scan.imageUrl,
    scan.isExternalLink ? 1 : 0,
    scan.findings,
    scan.radiologistNote,
    scan.status || 'VALIDÉ'
  );
}

export function updateScanFindingsRecord(id: string, findings: string, radiologistNote: string) {
  db.prepare(`
    UPDATE medical_scans
    SET findings = ?, radiologist_note = ?
    WHERE id = ?
  `).run(findings, radiologistNote, id);
}

export function deleteMedicalScanRecord(id: string) {
  db.prepare('DELETE FROM medical_scans WHERE id = ?').run(id);
}

export function addConsultationRecord(c: any) {
  const stmt = db.prepare(`
    INSERT INTO consultations (
      id, patient_id, patient_name, doctor_name, specialty, date_time,
      location, status, reason, notes, preparation_instructions
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    c.id,
    c.patientId,
    c.patientName,
    c.doctorName,
    c.specialty,
    c.dateTime,
    c.location,
    c.status || 'SCHEDULED',
    c.reason,
    c.notes || null,
    c.preparationInstructions || null
  );
}

export function deleteConsultationRecord(id: string) {
  db.prepare('DELETE FROM consultations WHERE id = ?').run(id);
}

export function getAllEquipmentsList() {
  return db.prepare('SELECT id, name, type, location, status, last_maintenance as lastMaintenance, next_maintenance as nextMaintenance FROM equipments').all();
}

export function getAllLogsList() {
  return db.prepare(`
    SELECT id, timestamp, actor_name as actorName, actor_role as actorRole,
           action, category, patient_name as patientName, details
    FROM activity_logs
    ORDER BY rowid DESC
  `).all();
}

export function addActivityLogRecord(log: any) {
  const stmt = db.prepare(`
    INSERT INTO activity_logs (id, timestamp, actor_name, actor_role, action, category, patient_name, details)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    log.id,
    log.timestamp,
    log.actorName,
    log.actorRole,
    log.action,
    log.category || 'CONNEXION',
    log.patientName || 'Système',
    log.details
  );
}

export function resetAllDataToDefault() {
  db.exec(`
    DELETE FROM activity_logs;
    DELETE FROM consultations;
    DELETE FROM medical_scans;
    DELETE FROM prescriptions;
    DELETE FROM patients;
    DELETE FROM equipments;
    DELETE FROM users;
  `);
  seedDatabase();
}

// Auto initialize tables on module load
initDatabase();
