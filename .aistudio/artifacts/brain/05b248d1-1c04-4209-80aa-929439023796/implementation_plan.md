# Diagnostic Système & Plan de Remédiation : Boutons Inactifs, Ergonomie & Sécurité Applicative

Ce document présente l'analyse approfondie du système **Clinical Calm**, le diagnostic précis des éléments et boutons non fonctionnels ou lacunaires, ainsi que le plan d'action immédiat pour corriger les dysfonctionnements prioritaires identifiés dans la **Console Administrateur (Pilotage des Équipements)** et l'**Espace Praticien (Gestion des Ordonnances et Consultations)**.

---

## 1. Synthèse du Diagnostic & Failles Détectées

### A. Console Administrateur & Pilotage des Équipements
1. **Pilotage des équipements biomédicaux incomplet et sans retour d'état (Feedback UX)** :
   - Le bouton de changement de statut d'équipement (`toggleEquipmentStatus`) bascule en boucle entre *Disponible*, *En examen* et *Maintenance* sans aucun indicateur visuel de chargement (`isPending`) ni message toast de confirmation ou d'erreur en cas d'échec de la mutation SQLite.
   - **Absence de filtrage et de recherche** : Contrairement aux consultations et journaux, le parc d'équipements ne dispose d'aucune barre de recherche (par salle, modalité, identifiant) ni de filtres par statut (*Disponible / Maintenance*).
   - **Dates de maintenance figées** : Aucune modale ni bouton ne permet d'enregistrer une opération de révision préventive ou de reprogrammer la date de prochaine maintenance.
2. **Tableau de bord : Cartes de statistiques inertes (Dead Click)** :
   - Les 6 cartes métriques clés en haut du tableau de bord d'administration (*Patients Enregistrés*, *RDV Programmés*, *Parc Biomédical*, *Conformité HDS/RGPD*, *Chiffrement*, *Incidents*) ne sont pas interactives. Cliquer dessus ne redirige pas vers les onglets correspondants (*Équipements*, *Planning*, *Posture*).
3. **Répertoire central des patients statique** :
   - Dans l'onglet *Dossiers Patients*, les lignes du tableau affichent les informations mais ne proposent aucun bouton d'action contextuel (consulter l'historique ou ouvrir les détails administratifs).

---

### B. Espace Praticien & Gestion des Ordonnances / Consultations
1. **Bug critique de détection d'échec de prescription (Faux Positif UX)** :
   - Dans `DoctorWorkstation.tsx` (`handleCreatePrescription`), lorsque le serveur rejette une ordonnance avec une erreur générique (autre qu'un blocage 409 CDSS, par exemple validation échouée ou erreur réseau), le code ne stoppe pas l'exécution. Il logue à tort une activité *« Délivrance d'ordonnance »*, réinitialise le formulaire et ferme la modale, laissant croire au médecin que l'ordonnance a été délivrée alors qu'elle a échoué.
2. **Absence d'état de soumission (Double Clic / Race Condition)** :
   - Le bouton *« Délivrer & Signer l'Ordonnance »* n'a pas d'état `isSubmitting` / `disabled`, permettant des clics multiples et l'envoi de requêtes concurrentes.
3. **Destruction des données lors de l'annulation d'un rendez-vous (Perte d'historique)** :
   - L'annulation d'un rendez-vous exécute un `DELETE` physique en base (`deleteConsultationRecord`). Le rendez-vous disparaît complètement au lieu de passer au statut `CANCELLED`. De ce fait, le compteur d'annulations du planning reste toujours à 0 et l'historique patient est faussé.
4. **Liens de vérification et contraintes d'iframe (PrescriptionSealModal)** :
   - Le lien public vers `/verify/:id` utilise une balise `<a href="...">` qui force un rechargement complet de l'application au lieu d'une transition SPA interne, et le lien *API JSON* avec `target="_blank"` peut être bloqué par les bacs à sable d'iframe.

---

### C. Sécurité Applicative & Résilience
1. **Cohérence des traces d'audit WORM** :
   - Lors de la journalisation de délivrance d'ordonnance, une troncature d'empreinte brute était encore injectée dans les détails textuels.
2. **Protection contre les requêtes concurrentes** :
   - Sécuriser les boutons d'actions cliniques pour éviter les décalages de cache TanStack Query lors des mutations.

---

## 2. Plan d'Action & Remédiations Techniques

### Phase 1 : Remédiation Console Administrateur & Parc Équipements
- **Enrichir la gestion des équipements (`AdminConsole.tsx`)** :
  - Ajouter un retour visuel direct sur le bouton de statut d'équipement (spinner d'attente pendant la mutation, toast de succès ou d'erreur).
  - Intégrer une barre de recherche rapide (par nom d'appareil, modalité, salle/bâtiment) et des filtres par statut (*Tous*, *Disponibles*, *En Examen*, *En Maintenance*).
  - Ajouter un bouton d'action pour planifier/mettre à jour la date de maintenance préventive avec journalisation d'audit WORM.
- **Rendre les cartes de métriques interactives** :
  - Connecter les cartes statistiques du Dashboard pour qu'un clic bascule instantanément vers l'onglet pertinent (*Parc Biomédical* -> onglet `equipements`, *RDV Programmés* -> onglet `planning`, *Conformité* -> onglet `posture`).
- **Ajouter des actions rapides sur le répertoire patients** :
  - Permettre le filtrage instantané ou la consultation contextuelle des détails d'admission d'un patient.

### Phase 2 : Remédiation Espace Praticien & Ordonnances / Rendez-vous
- **Corriger le cycle de vie de création d'ordonnance (`DoctorWorkstation.tsx`)** :
  - Sécuriser `handleCreatePrescription` : vérifier strictement `res.success` avant toute fermeture de modale ou réinitialisation des champs.
  - Afficher un message d'erreur clair si l'opération échoue sans masquer le formulaire.
  - Ajouter l'état de chargement désactivant le bouton lors de la signature numérique pour empêcher les doublons.
- **Corriger la gestion du statut d'annulation des consultations** :
  - Mettre à jour le backend (`server/api.ts` et `server/db.ts`) pour que l'annulation passe le statut à `CANCELLED` (avec motif et horodatage) plutôt que de supprimer brutalement la ligne, permettant au compteur d'annulations et à l'historique du planning de fonctionner fidèlement.
- **Améliorer la modale de scellement et les contrôles du viewer** :
  - Fluidifier la consultation de `/verify/:id` sans rechargement destructif.
  - S'assurer que tous les boutons de réglages radiologiques (zoom, inversion, contraste, luminosité, réinitialisation) répondent de manière instantanée et fluide.

### Phase 3 : Vérification, Compilation & Tests Fonctionnels
- Exécuter la suite complète de compilation TypeScript (`compile_applet`) et de validation syntaxique (`lint_applet`).
- Tester les flux réels :
  - Modification et filtrage des équipements avec compte administrateur.
  - Rédaction d'ordonnance valide et avec dérogation clinique en compte praticien.
  - Annulation d'un rendez-vous et vérification de la conservation du statut `CANCELLED` dans le planning hospitalier.

---

## 3. Critères d'Acceptation
- Aucun bouton inerte ou "dead click" dans les consoles Administrateur et Médecin.
- L'annulation de consultation met à jour le statut en `CANCELLED` avec traçabilité complète.
- La création d'ordonnance gère les erreurs sans faux succès et avec état de chargement.
- La supervision des équipements dispose de filtres, recherche et retour d'état visuel.
- L'application compile avec zéro avertissement ni régression de sécurité.
