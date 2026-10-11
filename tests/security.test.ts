import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { apiApp } from '../server/index';
import { db, canonicalJsonStringify, computeCanonicalJsonHash, setUserStatus } from '../server/db';
import { failedLoginAttempts } from '../server/api';
import { drugSafetyEngine } from '../server/clinical/drugSafety';

describe('Suite de Tests de Sécurité & Conformité Zero-Trust (Clinical Calm)', () => {
  let patientToken: string;
  let doctorToken: string;
  let adminToken: string;

  beforeAll(async () => {
    // 1. Authentification Patient Julien Moreau
    const patRes = await request(apiApp)
      .post('/api/auth/login')
      .send({ email: 'julien.moreau@clinical-calm.demo', password: 'julien123' });
    expect(patRes.status).toBe(200);
    patientToken = patRes.body.token;

    // 2. Authentification Dr. Sarah Chen
    const docRes = await request(apiApp)
      .post('/api/auth/login')
      .send({ email: 'sarah.chen@clinical-calm.demo', password: 'sarah2026' });
    expect(docRes.status).toBe(200);
    doctorToken = docRes.body.token;

    // 3. Authentification Administrateur Marc Lefèvre
    const adminRes = await request(apiApp)
      .post('/api/auth/login')
      .send({ email: 'marc.lefevre@clinical-calm.demo', password: 'admin2026' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.token;
  });

  // =========================================================================
  // 1. Accès Anonyme (401 UNAUTHENTICATED)
  // =========================================================================
  describe('1. Protection des accès anonymes (401)', () => {
    it('doit bloquer GET /api/patients sans jeton d’authentification', async () => {
      const res = await request(apiApp).get('/api/patients');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
    });

    it('doit bloquer GET /api/logs sans jeton', async () => {
      const res = await request(apiApp).get('/api/logs');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
    });

    it('doit bloquer POST /api/patients/PAT-2026-001/prescriptions sans jeton', async () => {
      const res = await request(apiApp)
        .post('/api/patients/PAT-2026-001/prescriptions')
        .send({ medication: 'Amoxicilline', dosage: '1g' });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
    });

    it('doit rejeter un faux jeton invalide ou corrompu (401)', async () => {
      const res = await request(apiApp)
        .get('/api/patients')
        .set('Authorization', 'Bearer token_invalide_falsifie_123');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('TOKEN_INVALID');
    });
  });

  // =========================================================================
  // 2. Durcissement Auth & Anti-Énumération
  // =========================================================================
  describe('2. Durcissement de l’authentification et anti-énumération', () => {
    it('doit renvoyer le même message d’erreur pour mauvais mot de passe et email inconnu', async () => {
      const resBadPass = await request(apiApp)
        .post('/api/auth/login')
        .send({ email: 'julien.moreau@clinical-calm.demo', password: 'mauvais_mdp_errone' });
      expect(resBadPass.status).toBe(401);
      expect(resBadPass.body.error).toBe('Identifiants invalides.');

      const resUnknownUser = await request(apiApp)
        .post('/api/auth/login')
        .send({ email: 'utilisateur_inexistant_999@hopital.fr', password: 'nimporte_quel_mdp' });
      expect(resUnknownUser.status).toBe(401);
      expect(resUnknownUser.body.error).toBe('Identifiants invalides.');
    });

    it('ne doit JAMAIS renvoyer le hash du mot de passe dans les réponses', async () => {
      const res = await request(apiApp)
        .post('/api/auth/login')
        .send({ email: 'julien.moreau@clinical-calm.demo', password: 'julien123' });
      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.password).toBeUndefined();
      expect(res.body.user.hash).toBeUndefined();
    });

    it('doit FORCER le rôle à PATIENT côté serveur lors de l’inscription, même si l’attaquant tente de s’inscrire en ADMIN', async () => {
      const maliciousRegister = {
        name: 'Tentative Attaque Privilège',
        email: `hacker_${Date.now()}@pirate.org`,
        password: 'passwordUltraSecure2026',
        role: 'ADMIN', // Tentative d'élévation de privilèges
      };

      const res = await request(apiApp)
        .post('/api/auth/register')
        .send(maliciousRegister);

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('PATIENT');
      expect(res.body.user.title).toBe('Patient');
      expect(res.body.user.password).toBeUndefined();
    });
  });

  // =========================================================================
  // 3. Matrice Rôles / Routes (PATIENT, DOCTOR, ADMIN)
  // =========================================================================
  describe('3. Matrice d’habilitation RBAC stricte', () => {
    it('PATIENT ne doit PAS pouvoir prescrire d’ordonnance (403)', async () => {
      const res = await request(apiApp)
        .post('/api/patients/PAT-2026-001/prescriptions')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ medication: 'Doliprane', dosage: '1000mg' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCESS_DENIED');
    });

    it('PATIENT ne doit PAS pouvoir ajouter d’imagerie médicale (403)', async () => {
      const res = await request(apiApp)
        .post('/api/patients/PAT-2026-001/scans')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ title: 'Scanner Non Autorisé', modality: 'CT' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCESS_DENIED');
    });

    it('PATIENT ne doit PAS pouvoir accéder au journal d’audit hospitalier (403)', async () => {
      const res = await request(apiApp)
        .get('/api/logs')
        .set('Authorization', `Bearer ${patientToken}`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCESS_DENIED');
    });

    it('DOCTOR doit pouvoir prescrire une ordonnance clinique (200)', async () => {
      const res = await request(apiApp)
        .post('/api/patients/PAT-2026-001/prescriptions')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          id: `ORD-TEST-${Date.now()}`,
          medication: 'Paracétamol 1g',
          dosage: '1 sachet toutes les 6 heures',
          frequency: '3 fois par jour',
          duration: '5 jours',
          instructions: 'En cas de fièvre ou de douleur',
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('DOCTOR ne doit PAS pouvoir accéder aux logs d’audit réservés à l’ADMIN (403)', async () => {
      const res = await request(apiApp)
        .get('/api/logs')
        .set('Authorization', `Bearer ${doctorToken}`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCESS_DENIED');
    });

    it('ADMIN doit pouvoir consulter le journal d’audit complet (200)', async () => {
      const res = await request(apiApp)
        .get('/api/logs')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('ADMIN ne doit PAS pouvoir prescrire d’ordonnance médicale clinique (403)', async () => {
      const res = await request(apiApp)
        .post('/api/patients/PAT-2026-001/prescriptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ medication: 'Morphine', dosage: '10mg' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCESS_DENIED');
    });
  });

  // =========================================================================
  // 4. Isolation Patient & Prévention IDOR
  // =========================================================================
  describe('4. Isolation des données patient (Prévention IDOR)', () => {
    it('PATIENT A (Julien Moreau) ne doit PAS pouvoir lire le dossier de PATIENT B (Sophie Bernard) (403)', async () => {
      const res = await request(apiApp)
        .get('/api/patients/PAT-2026-002')
        .set('Authorization', `Bearer ${patientToken}`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCESS_DENIED');
    });

    it('PATIENT A ne doit PAS pouvoir lire les prescriptions de PATIENT B (403)', async () => {
      const res = await request(apiApp)
        .get('/api/patients/PAT-2026-002/prescriptions')
        .set('Authorization', `Bearer ${patientToken}`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCESS_DENIED');
    });

    it('PATIENT A ne doit PAS pouvoir lire les clichés d’imagerie de PATIENT B (403)', async () => {
      const res = await request(apiApp)
        .get('/api/patients/PAT-2026-002/scans')
        .set('Authorization', `Bearer ${patientToken}`);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCESS_DENIED');
    });

    it('PATIENT A doit pouvoir lire son propre dossier médical personnel (200)', async () => {
      const res = await request(apiApp)
        .get('/api/patients/PAT-2026-001')
        .set('Authorization', `Bearer ${patientToken}`);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Julien Moreau');
      expect(res.body.bloodType).toBe('O Rh+ (Positif)');
    });

    it('GET /api/patients appelé par PATIENT A doit renvoyer UNIQUEMENT son propre dossier (Zero-Trust Isolation)', async () => {
      const res = await request(apiApp)
        .get('/api/patients')
        .set('Authorization', `Bearer ${patientToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].name).toBe('Julien Moreau');
    });
  });

  // =========================================================================
  // 5. Immuabilité WORM et Vérification Cryptographique du Journal
  // =========================================================================
  describe('5. Traçabilité WORM & Preuve Cryptographique d’Intégrité', () => {
    it('doit formellement interdire DELETE /api/logs avec le code HTTP 405 (WORM Violation)', async () => {
      const res = await request(apiApp)
        .delete('/api/logs')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(405);
      expect(res.body.code).toBe('IMMUTABLE_LOGS_VIOLATION');
    });

    it('doit valider mathématiquement la chaîne cryptographique SHA-256 via /api/logs/verify', async () => {
      const res = await request(apiApp)
        .get('/api/logs/verify')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.isValid).toBe(true);
      expect(res.body.checkedCount).toBeGreaterThan(0);
      expect(res.body.genesisHash).toBe('0'.repeat(64));
      expect(res.body.latestHash).toBeDefined();
    });

    it('le trigger SQLite natif doit bloquer physiquement toute tentative directe de DELETE sur activity_logs', () => {
      expect(() => {
        db.prepare('DELETE FROM activity_logs WHERE id = ?').run('LOG-01');
      }).toThrow(/IMMUTABLE_LOGS_VIOLATION/);
    });

    it('le trigger SQLite natif doit bloquer physiquement toute tentative directe de UPDATE sur activity_logs', () => {
      expect(() => {
        db.prepare('UPDATE activity_logs SET details = ? WHERE id = ?').run('Falsification', 'LOG-01');
      }).toThrow(/IMMUTABLE_LOGS_VIOLATION/);
    });
  });

  // =========================================================================
  // 6. Gestion du cycle de vie des équipements (PUT /api/equipments/:id/status)
  // =========================================================================
  describe('6. Gestion du cycle de vie des équipements médicaux (ADMIN)', () => {
    it('doit refuser la modification de statut sans authentification (401)', async () => {
      const res = await request(apiApp)
        .put('/api/equipments/EQ-MRI-01/status')
        .send({ status: 'MAINTENANCE' });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
    });

    it('doit interdire la modification de statut par un PATIENT (403)', async () => {
      const res = await request(apiApp)
        .put('/api/equipments/EQ-MRI-01/status')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ status: 'MAINTENANCE' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCESS_DENIED');
    });

    it('doit interdire la modification de statut par un DOCTOR (403)', async () => {
      const res = await request(apiApp)
        .put('/api/equipments/EQ-MRI-01/status')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ status: 'MAINTENANCE' });
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCESS_DENIED');
    });

    it('doit rejeter une valeur de statut invalide (400)', async () => {
      const res = await request(apiApp)
        .put('/api/equipments/EQ-MRI-01/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'HORS_SERVICE_INCONNU' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_STATUS');
    });

    it('doit renvoyer 404 si l\'équipement n\'existe pas', async () => {
      const res = await request(apiApp)
        .put('/api/equipments/EQ-INEXISTANT-999/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'MAINTENANCE' });
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('doit permettre à un ADMIN de changer le statut, persister en base et journaliser dans l\'audit', async () => {
      const res = await request(apiApp)
        .put('/api/equipments/EQ-MRI-01/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'MAINTENANCE' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.equipment.status).toBe('MAINTENANCE');

      // Vérification persistance directe dans la base SQLite
      const row = db.prepare('SELECT status FROM equipments WHERE id = ?').get('EQ-MRI-01') as { status: string };
      expect(row).toBeDefined();
      expect(row.status).toBe('MAINTENANCE');

      // Vérification journalisation dans les logs d'audit
      const lastLog = db.prepare('SELECT * FROM activity_logs ORDER BY rowid DESC LIMIT 1').get() as any;
      expect(lastLog).toBeDefined();
      expect(lastLog.category).toBe('EQUIPEMENT');
      expect(lastLog.details).toContain('MAINTENANCE');
    });
  });

  // =========================================================================
  // 7. Sécurité clinique des prescriptions & Scellement d'intégrité SHA-256
  // =========================================================================
  describe('7. Sécurité clinique des prescriptions & Scellement d’intégrité SHA-256', () => {
    it('doit bloquer une prescription en cas d’allergie directe ou croisée (409 ALLERGY_CONTRAINDICATION)', async () => {
      // Julien Moreau (PAT-2026-001) est allergique à la Pénicilline
      // On tente de lui prescrire de l'Amoxicilline
      const res = await request(apiApp)
        .post('/api/patients/PAT-2026-001/prescriptions')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          medication: 'Amoxicilline 1g',
          dosage: '1g matin et soir',
          frequency: '2x/jour',
          duration: '6 jours',
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('ALLERGY_CONTRAINDICATION');
      expect(res.body.contraindication).toBeDefined();
      expect(res.body.contraindication.severity).toBe('CRITICAL');
      expect(res.body.contraindication.matchedMolecule).toBe('amoxicilline');
      expect(res.body.contraindication.drugClass).toContain('Pénicillines');
      expect(res.body.contraindication.notice).toContain('DÉMONSTRATION PÉDAGOGIQUE');
    });

    it('doit refuser un override sans justification ou avec une justification trop courte (< 20 car.) (400)', async () => {
      const res = await request(apiApp)
        .post('/api/patients/PAT-2026-001/prescriptions')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          medication: 'Clamoxyl 500mg', // nom commercial de l'amoxicilline
          dosage: '500 mg',
          override: true,
          justification: 'Court', // < 20 caractères
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_JUSTIFICATION');
      expect(res.body.error).toContain('au moins 20 caractères');
    });

    it('doit autoriser l’override avec justification >= 20 car., enregistrer l’ordonnance et inscrire un log d’audit', async () => {
      const testJustif = 'Patient en détresse vitale sous surveillance réanimatoire stricte sans alternative';
      expect(testJustif.length).toBeGreaterThanOrEqual(20);

      const res = await request(apiApp)
        .post('/api/patients/PAT-2026-001/prescriptions')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          medication: 'Augmentin 1g',
          dosage: '1g matin et soir',
          frequency: '2x/jour',
          duration: '7 jours',
          override: true,
          justification: testJustif,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.overridden).toBe(true);
      expect(res.body.prescription).toBeDefined();
      expect(res.body.prescription.integritySeal).toBeDefined();

      // Vérification présence de l'audit trail d'override dans la table activity_logs
      const overrideLog = db.prepare(`
        SELECT * FROM activity_logs
        WHERE action = 'Levée de contre-indication (Override Clinique)'
        ORDER BY rowid DESC LIMIT 1
      `).get() as any;

      expect(overrideLog).toBeDefined();
      expect(overrideLog.actor_name).toBe('Dr. Sarah Chen');
      expect(overrideLog.patient_name).toBe('Julien Moreau');
      expect(overrideLog.details).toContain('amoxicilline');
      expect(overrideLog.details).toContain(testJustif);
    });

    it('doit bloquer une interaction médicamenteuse majeure avec un traitement actif (409 MAJOR_DRUG_INTERACTION)', async () => {
      // Julien Moreau a un traitement actif de fond par Symbicort / Ventoline (bêta-2 agoniste)
      // Tenter de lui prescrire du Propranolol (bêta-bloquant) provoque un bronchospasme majeur
      const res = await request(apiApp)
        .post('/api/patients/PAT-2026-001/prescriptions')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          medication: 'Propranolol 40mg',
          dosage: '40 mg par jour',
          frequency: '1x/jour',
          duration: '1 mois',
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('MAJOR_DRUG_INTERACTION');
      expect(res.body.interaction).toBeDefined();
      expect(res.body.interaction.severity).toBe('MAJOR');
      expect(res.body.interaction.details[0].clinicalImpact).toContain('bronchospasme');
    });

    it('doit valider le scellement d’intégrité SHA-256 via GET /api/prescriptions/:id/verify', async () => {
      const res = await request(apiApp).get('/api/prescriptions/ORD-2026-891/verify');
      expect(res.status).toBe(200);
      expect(res.body.isValid).toBe(true);
      expect(res.body.label).toBe("Scellement d'intégrité");
      expect(res.body.verificationStatus).toBe('CONFORME_NON_ALTERE');
      expect(res.body.storedSeal).toBeDefined();
      expect(res.body.computedSeal).toBe(res.body.storedSeal);
    });

    it('doit détecter une falsification et rejeter l’intégrité si une ordonnance est altérée directement en base', async () => {
      // 1. Créer une nouvelle ordonnance valide
      const createRes = await request(apiApp)
        .post('/api/patients/PAT-2026-002/prescriptions')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          medication: 'Paracétamol Biogaran 1g',
          dosage: '1g si douleur',
          frequency: '3x/jour',
          duration: '5 jours',
        });

      expect(createRes.status).toBe(200);
      const prescId = createRes.body.prescription.id;

      // Vérifier que le scellement initial est valide
      const initialVerify = await request(apiApp).get(`/api/prescriptions/${prescId}/verify`);
      expect(initialVerify.body.isValid).toBe(true);

      // 2. Altération frauduleuse directe dans SQLite (par exemple, changement du médicament en stupéfiant)
      db.prepare('UPDATE prescriptions SET medication = ? WHERE id = ?')
        .run('Morphine Sulfate 100mg Injectable (Falsifié)', prescId);

      // 3. Vérification immédiate du scellement d'intégrité
      const tamperedVerify = await request(apiApp).get(`/api/prescriptions/${prescId}/verify`);
      expect(tamperedVerify.status).toBe(200);
      expect(tamperedVerify.body.isValid).toBe(false);
      expect(tamperedVerify.body.verificationStatus).toBe('ALTERATION_DETECTEE');
      expect(tamperedVerify.body.message).toContain('altéré');
      expect(tamperedVerify.body.computedSeal).not.toBe(tamperedVerify.body.storedSeal);
    });

    it('PATIENT et ADMIN ne peuvent formellement pas prescrire d’ordonnance (403 ACCESS_DENIED)', async () => {
      const patientAttempt = await request(apiApp)
        .post('/api/patients/PAT-2026-001/prescriptions')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ medication: 'Doliprane 1000' });
      expect(patientAttempt.status).toBe(403);
      expect(patientAttempt.body.code).toBe('ACCESS_DENIED');

      const adminAttempt = await request(apiApp)
        .post('/api/patients/PAT-2026-001/prescriptions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ medication: 'Doliprane 1000' });
      expect(adminAttempt.status).toBe(403);
      expect(adminAttempt.body.code).toBe('ACCESS_DENIED');
    });
  });

  // =========================================================================
  // 8. Fiche 1 — Sérialisation Canonique RFC 8785 & Déterminisme du Scellement
  // =========================================================================
  describe('8. Sérialisation Canonique RFC 8785 & Déterminisme Cryptographique', () => {
    it('canonicalJsonStringify doit produire une chaîne strictement identique quel que soit l’ordre des clés', () => {
      const payloadA = { patientId: 'PAT-001', medication: 'Amoxicilline', dosage: '1g', date: '2026-10-10' };
      const payloadB = { date: '2026-10-10', dosage: '1g', medication: 'Amoxicilline', patientId: 'PAT-001' };

      const jsonA = canonicalJsonStringify(payloadA);
      const jsonB = canonicalJsonStringify(payloadB);

      expect(jsonA).toBe(jsonB);
      expect(computeCanonicalJsonHash(payloadA)).toBe(computeCanonicalJsonHash(payloadB));
    });

    it('canonicalJsonStringify doit trier récursivement les objets imbriqués', () => {
      const complexA = { z: 1, nested: { b: 2, a: 1 }, arr: [1, 2] };
      const complexB = { arr: [1, 2], nested: { a: 1, b: 2 }, z: 1 };

      expect(canonicalJsonStringify(complexA)).toBe(canonicalJsonStringify(complexB));
    });

    it('toute altération de la posologie en base doit immédiatement invalider le scellement', async () => {
      // 1. Créer une ordonnance test
      const createRes = await request(apiApp)
        .post('/api/patients/PAT-2026-002/prescriptions')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          medication: 'Paracétamol 500mg',
          dosage: '500mg',
          frequency: '3x/jour',
          duration: '3 jours',
        });
      expect(createRes.status).toBe(200);
      const prescId = createRes.body.prescription.id;

      // 2. Altérer la posologie en base
      db.prepare('UPDATE prescriptions SET dosage = ? WHERE id = ?').run('10000mg SURDOSAGE', prescId);

      // 3. Vérifier que l'altération est détectée
      const verifyRes = await request(apiApp).get(`/api/prescriptions/${prescId}/verify`);
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.isValid).toBe(false);
      expect(verifyRes.body.verificationStatus).toBe('ALTERATION_DETECTEE');
    });
  });

  // =========================================================================
  // 9. Fiche 2 — Normalisation Unicode NFKD & Détection Clinique Anti-Contournement
  // =========================================================================
  describe('9. Normalisation Avancée Unicode NFKD & Anti-Contournement Clinique', () => {
    it('doit détecter la contre-indication allergique pour une saisie avec accents complexes et majuscules ("CLAMÔXYL 500mg")', async () => {
      // Julien Moreau est allergique aux pénicillines
      const res = await request(apiApp)
        .post('/api/patients/PAT-2026-001/prescriptions')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({
          medication: 'CLAMÔXYL 500mg Gélule',
          dosage: '500mg',
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('ALLERGY_CONTRAINDICATION');
      expect(res.body.contraindication.severity).toBe('CRITICAL');
      expect(res.body.contraindication.drugClass).toContain('Pénicillines');
    });

    it('le moteur clinique doit normaliser sans faille les caractères Unicode décomposés (NFKD)', () => {
      const normalized = drugSafetyEngine.normalize('Ámòxïcîllïnè  500 mg (comprimé)');
      expect(normalized).toBe('amoxicilline');
    });

    it('doit bloquer les interactions majeures de façon bidirectionnelle', () => {
      // Prescrire un bêta-bloquant (Propranolol) quand un bêta-2 agoniste (Salbutamol) est actif
      const checkA = drugSafetyEngine.checkInteractions('Propranolol 40mg', ['Ventoline 100 µg']);
      expect(checkA.hasMajorInteraction).toBe(true);
      expect(checkA.majorInteractions[0].severity).toBe('MAJOR');

      // Prescrire un bêta-2 agoniste (Salbutamol) quand un bêta-bloquant (Propranolol) est actif
      const checkB = drugSafetyEngine.checkInteractions('Ventoline 100 µg', ['Propranolol 40mg']);
      expect(checkB.hasMajorInteraction).toBe(true);
      expect(checkB.majorInteractions[0].severity).toBe('MAJOR');
    });
  });

  // =========================================================================
  // 10. Fiche 3 — Révocation Active des Sessions & Contrôle du Statut des Comptes
  // =========================================================================
  describe('10. Révocation Active des Sessions (Zero-Trust Active State)', () => {
    it('doit immédiatement rejeter les requêtes (403) si le compte de l’utilisateur est désactivé en base', async () => {
      // 1. Créer un compte patient temporaire
      const tempEmail = `patient_temp_${Date.now()}@test.org`;
      const regRes = await request(apiApp)
        .post('/api/auth/register')
        .send({
          name: 'Patient Temporaire',
          email: tempEmail,
          password: 'Password123!',
        });
      expect(regRes.status).toBe(200);
      const tempToken = regRes.body.token;
      const tempUserId = regRes.body.user.id;

      // 2. Vérifier que la requête fonctionne avant désactivation
      const beforeRes = await request(apiApp)
        .get('/api/patients')
        .set('Authorization', `Bearer ${tempToken}`);
      expect(beforeRes.status).toBe(200);

      // 3. Désactiver le compte en base (ADMIN ou suspension de sécurité)
      setUserStatus(tempUserId, 'INACTIVE');

      // 4. Tenter une requête avec le même jeton JWT (pourtant cryptographiquement valide)
      const afterRes = await request(apiApp)
        .get('/api/patients')
        .set('Authorization', `Bearer ${tempToken}`);

      expect(afterRes.status).toBe(403);
      expect(afterRes.body.code).toBe('ACCOUNT_DISABLED');
      expect(afterRes.body.error).toContain('désactivé');

      // 5. Tenter de se reconnecter avec les identifiants
      const loginRes = await request(apiApp)
        .post('/api/auth/login')
        .send({ email: tempEmail, password: 'Password123!' });

      expect(loginRes.status).toBe(403);
      expect(loginRes.body.code).toBe('ACCOUNT_DISABLED');

      // Réactivation
      setUserStatus(tempUserId, 'ACTIVE');
      const reactivatedRes = await request(apiApp)
        .get('/api/patients')
        .set('Authorization', `Bearer ${tempToken}`);
      expect(reactivatedRes.status).toBe(200);
    });
  });

  // =========================================================================
  // 11. Fiche 3 — Protection Anti Force-Brute (Verrouillage après 5 échecs)
  // =========================================================================
  describe('11. Protection Anti Force-Brute & Limitation de Débit Ciblée', () => {
    it('doit verrouiller temporairement l’accès (429) après 5 tentatives infructueuses consécutives', async () => {
      const bruteEmail = `brute_target_${Date.now()}@hopital.fr`;
      failedLoginAttempts.clear();

      // Effectuer 4 tentatives infructueuses (401)
      for (let i = 0; i < 4; i++) {
        const res = await request(apiApp)
          .post('/api/auth/login')
          .send({ email: bruteEmail, password: 'wrong_password' });
        expect(res.status).toBe(401);
      }

      // La 5ème tentative dépasse le seuil et renvoie 429
      const fifthRes = await request(apiApp)
        .post('/api/auth/login')
        .send({ email: bruteEmail, password: 'wrong_password' });

      expect(fifthRes.status).toBe(429);
      expect(fifthRes.body.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(fifthRes.body.error).toContain('verrouillé');

      // La 6ème tentative reste bloquée à 429
      const sixthRes = await request(apiApp)
        .post('/api/auth/login')
        .send({ email: bruteEmail, password: 'wrong_password' });

      expect(sixthRes.status).toBe(429);
      expect(sixthRes.body.code).toBe('RATE_LIMIT_EXCEEDED');

      // Nettoyage pour les tests suivants
      failedLoginAttempts.clear();
    });
  });

  // =========================================================================
  // 12. Fiche 4 — Contrôle Public du Scellement d'Intégrité
  // =========================================================================
  describe('12. Endpoint de Contrôle Public du Scellement d’Intégrité', () => {
    it('doit être accessible sans aucun en-tête d’authentification (200)', async () => {
      const res = await request(apiApp).get('/api/prescriptions/ORD-2026-891/verify');
      expect(res.status).toBe(200);
      expect(res.body.isValid).toBe(true);
      expect(res.body.label).toBe("Scellement d'intégrité");
      expect(res.body.verificationStatus).toBe('CONFORME_NON_ALTERE');
      expect(res.body.storedSeal).toBeDefined();
      expect(res.body.computedSeal).toBe(res.body.storedSeal);
    });

    it('doit renvoyer 404 avec statut clair pour un identifiant d’ordonnance inexistant', async () => {
      const res = await request(apiApp).get('/api/prescriptions/ORD-INEXISTANT-000/verify');
      expect(res.status).toBe(404);
      expect(res.body.isValid).toBe(false);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });

  // =========================================================================
  // 13. Constantes Biométriques Dynamiques & Annuaire Médecins / Réservations
  // =========================================================================
  describe('13. Constantes Biométriques Dynamiques & Annuaire des Médecins', () => {
    it('doit renvoyer la liste des médecins avec leurs créneaux disponibles via GET /api/doctors (200)', async () => {
      const res = await request(apiApp)
        .get('/api/doctors')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(3);

      const drChen = res.body.find((d: any) => d.name === 'Dr. Sarah Chen');
      expect(drChen).toBeDefined();
      expect(drChen.specialty).toContain('Pneumologie');
      expect(Array.isArray(drChen.slots)).toBe(true);
      expect(drChen.slots.length).toBeGreaterThan(0);
      expect(drChen.slots[0]).toHaveProperty('isAvailable');
    });

    it('PATIENT A doit pouvoir lire ses propres constantes biométriques via GET /api/patients/PAT-2026-001/vitals (200)', async () => {
      const res = await request(apiApp)
        .get('/api/patients/PAT-2026-001/vitals')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('heartRate');
      expect(res.body[0]).toHaveProperty('bloodPressureSys');
      expect(res.body[0]).toHaveProperty('oxygenSaturation');
      expect(res.body[0]).toHaveProperty('temperature');
    });

    it('PATIENT A ne doit PAS pouvoir accéder aux constantes biométriques de PATIENT B (403 ACCESS_DENIED)', async () => {
      const res = await request(apiApp)
        .get('/api/patients/PAT-2026-002/vitals')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCESS_DENIED');
    });

    it('PATIENT A doit pouvoir enregistrer une nouvelle mesure dynamique de constantes biométriques (200)', async () => {
      const newVitals = {
        heartRate: 75,
        bloodPressureSys: 121,
        bloodPressureDia: 79,
        oxygenSaturation: 98.8,
        temperature: 36.9,
        bloodGlucose: 0.94,
        respiratoryRate: 15,
        weightKg: 74.5,
        heightCm: 178,
        painLevel: 0,
        notes: 'Mesure de test dynamique',
      };

      const res = await request(apiApp)
        .post('/api/patients/PAT-2026-001/vitals')
        .set('Authorization', `Bearer ${patientToken}`)
        .send(newVitals);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.vitals.heartRate).toBe(75);
      expect(res.body.vitals.bloodPressureSys).toBe(121);
    });

    it('PATIENT A doit pouvoir réserver un rendez-vous selon les disponibilités d’un médecin (200)', async () => {
      const consultPayload = {
        doctorName: 'Dr. Sarah Chen',
        dateTime: '25 Octobre 2026 à 14:00',
        reason: 'Consultation de contrôle semestriel',
        location: 'Bâtiment B - Salle 204',
      };

      const res = await request(apiApp)
        .post('/api/consultations')
        .set('Authorization', `Bearer ${patientToken}`)
        .send(consultPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Re-tentative sur le même créneau doit échouer avec 409 SLOT_UNAVAILABLE
      const dupRes = await request(apiApp)
        .post('/api/consultations')
        .set('Authorization', `Bearer ${patientToken}`)
        .send(consultPayload);

      expect(dupRes.status).toBe(409);
      expect(dupRes.body.code).toBe('SLOT_UNAVAILABLE');
    });
  });
});


