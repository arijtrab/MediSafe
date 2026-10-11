# Plan Correctif & de Conformité — Clinical Calm

> Plan d'action exhaustif axé sur la couverture fonctionnelle complète, le durcissement technique et réglementaire, l'intégrité cryptographique des ordonnances et la robustesse clinique.

---

### Synthèse & Décisions Confirmées

> [!IMPORTANT]
> **Arbitrages validés lors du cadrage interactif :**
> - **Axe prioritaire** : Couverture fonctionnelle complète (sécurité, audit, clinique, UI praticien).
> - **Niveau de granularité** : Fiches techniques détaillées comprenant spécifications, impacts de code et stratégie de tests Vitest.
> - **Périmètre d'action** : Focalisation stricte sur les correctifs, la fiabilité opérationnelle et la conformité réglementaire (sans dispersion sur des services tiers non homologués).

---

## 1. Vue d'Ensemble & Objectifs

### Problématique & Finalité
Le système **Clinical Calm** dispose d'un socle solide (36 tests Vitest au vert, RBAC strict, scellement SHA-256). L'analyse approfondie a toutefois révélé plusieurs points d'amélioration critiques pour atteindre un niveau de conformité hospitalière / HDS irréprochable :
1. **Déterminisme du scellement d'intégrité** : Nécessité d'une sérialisation canonique RFC 8785 (JCS) pour éliminer les faux positifs d'invalidation liés au formatage JSON.
2. **Résilience de l'authentification** : Révocation immédiate des sessions si un compte est désactivé, limitation du débit (Rate Limiting) sur les endpoints sensibles.
3. **Couverture du dictionnaire clinique** : Normalisation Unicode (NFKD) et gestion des alias princeps/génériques pour interdire les contournements typographiques.
4. **Ergonomie du poste prescripteur** : Feedback interactif en temps réel sur les interactions avant validation finale et page de contrôle public du scellement.

---

## 2. Expérience Utilisateur & Ergonomie Clinique

### Parcours Prescripteur Amélioré
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. Saisie Médicament                                                        │
│    └─► Autocomplétion DCI & Princeps avec disclaimer d'aide à la décision  │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. Analyse Prédictive Instantanée                                           │
│    ├─► Avertissement Modéré (Jaune ambré) : Alerte informative interactive │
│    └─► Contre-indication / Interaction Majeure (Rouge carmin) : Blocage     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. Gestion de l'Override Clinique                                           │
│    └─► Déblocage conditionné à une justification explicite (>= 20 car.)     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. Scellement & Délivrance                                                  │
│    └─► Calcul SHA-256 canonique + QR code de vérification publique          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Ambiance Visuelle & Composants
- **Palette Clinique Calme** : Arrière-plans slate doux (`bg-slate-50`), bordures nettes `border-slate-200`, accents cliniques émeraude (`#059669`) pour les statuts intègres et rouge carmin (`#dc2626`) pour les contre-indications.
- **Micro-interactions** : Indicateur de comptage en direct pour le seuil des 20 caractères de justification ; badge de scellement interactif avec infobulle pédagogique sur la non-assimilation à une signature électronique qualifiée eIDAS.

---

## 3. Architecture Technique & Flux de Données

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                               FRONTEND (REACT)                             │
│  ┌───────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐  │
│  │ PrescriptionModal.tsx │  │ IntegrityBadge.tsx   │  │ VerifyView.tsx   │  │
│  └───────────┬───────────┘  └──────────┬───────────┘  └─────────┬────────┘  │
└──────────────┼─────────────────────────┼────────────────────────┼───────────┘
               │ HTTP POST / GET         │ JWT Bearer             │ Public GET
┌──────────────▼─────────────────────────▼────────────────────────▼───────────┐
│                               BACKEND (EXPRESS)                             │
│  ┌───────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐  │
│  │ rateLimiterMiddleware │  │ authMiddleware       │  │ auditMiddleware  │  │
│  └───────────┬───────────┘  └──────────┬───────────┘  └─────────┬────────┘  │
│              ▼                         ▼                        ▼           │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ drugSafety.ts : Normalisation Unicode, DCI, Interactions croisées     │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
│                                      ▼                                      │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ cryptoUtils.ts : Sérialisation Canonique & Hachage SHA-256            │  │
│  └───────────────────────────────────┬───────────────────────────────────┘  │
└──────────────────────────────────────┼──────────────────────────────────────┘
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BASE DE DONNÉES (SQLITE)                          │
│     users (actifs)  │  prescriptions  │  audit_logs (inaltérables)          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Fiches Techniques des Actions Correctives

### Fiche 1 — Sérialisation Canonique du Scellement d'Intégrité (Crypto)
- **Constat** : Le calcul du hash SHA-256 dans `POST /api/patients/:id/prescriptions` dépendait de l'ordre d'insertion des clés dans l'objet JSON sérialisé. Une réorganisation bénigne pouvait déclencher une alerte d'altération.
- **Spécification Corrective** :
  - Implémenter un générateur canonique `canonicalJsonStringify(obj)` qui trie récursivement les clés d'objets et formate les tableaux de façon déterministe.
  - Normaliser le payload : `patient_id`, `doctor_id`, `issued_at`, liste triée des médicaments normalisés.
- **Tests Vitest associés** :
  - Test de vérification avec clés interverties : intégrité validée.
  - Test d'altération d'une posologie ou d'une date : altération détectée (statut `TAMPERED`).

### Fiche 2 — Normalisation Avancée & Prévention de Contournement (Clinique)
- **Constat** : Les variations de casse, accents combinés ou synonymes usuels (ex. « Doliprane » vs « Paracétamol », « Clamoxyl » vs « Amoxicilline ») doivent être résolues sans faille.
- **Spécification Corrective** :
  - Déployer `normalizeDrugName(input)` avec décomposition Unicode `normalize('NFKD')`, suppression des diacritiques, épuration des caractères non alphanumériques.
  - Enrichir la table d'alias princeps -> DCI dans `DrugSafetyEngine`.
  - Maintenir le bandeau légal d'avertissement : *"Outil de démonstration pédagogique — Ne remplace pas un logiciel d'aide à la prescription certifié HAS"*.
- **Tests Vitest associés** :
  - Rejet d'allergie sur saisie « CLAMÔXYL » pour un patient allergique à la pénicilline.
  - Détection d'interaction majeure entre « Antivitamine K » et « Aspirine » sous différentes formes de saisie.

### Fiche 3 — Sécurisation des Accès & Révocation Active (Sécurité & Auth)
- **Constat** : Le middleware JWT validait la signature du token sans interroger l'état d'activation du compte en base sur les requêtes à fort privilège.
- **Spécification Corrective** :
  - Dans `authMiddleware`, adjoindre une vérification rapide en base sur le statut actif de l'utilisateur.
  - Implémenter un rate-limiter strict en mémoire sur `/api/auth/login` (blocage temporaire après 5 tentatives infructueuses consécutives).
- **Tests Vitest associés** :
  - Rejet 401/403 pour un token valide appartenant à un utilisateur dont le statut est devenu inactif.
  - Blocage 429 après dépassement du seuil de tentatives de connexion.

### Fiche 4 — Interface de Contrôle Public du Scellement (Front & Patient)
- **Constat** : L'endpoint de vérification `/api/prescriptions/:id/verify` est fonctionnel, mais le patient ou le pharmacien qui scanne le QR code doit pouvoir consulter une interface claire et rassurante.
- **Spécification Corrective** :
  - Créer la vue publique `/verify/:id` accessible sans authentification requise.
  - Afficher le statut cryptographique : Empreinte concordante (Vert), Date de scellement, Praticien prescripteur, et liste certifiée des molécules prescrites.
  - Affichage d'un avertissement rouge explicite si l'empreinte calculée ne correspond plus à l'enregistrement d'origine.

---

## 5. Stratégie de Validation & Plan de Recette

| Domaine | Critère d'Acceptation | Méthode de Validation |
| :--- | :--- | :--- |
| **Sécurité Clinique** | 100% des allergies croisées bloquées sans override | Test unitaire automatisé Vitest |
| **Audit Log** | Tout override valide (>= 20 car.) génère une entrée d'audit inaltérable | Test d'intégration d'API |
| **Scellement Crypto** | L'empreinte SHA-256 résiste aux réordonnancements JSON | Test de sérialisation canonique |
| **Conformité eIDAS** | La mention « Scellement d'intégrité » est visible sans ambiguïté | Revue de code & inspection UI |
| **Régression** | Les 36 tests existants restent 100% verts | Exécution complète de `vitest run` |
