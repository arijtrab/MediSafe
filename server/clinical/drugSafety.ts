/**
 * Clinical Calm - Module de Sécurité Clinique & Aide à la Prescription Médicale
 *
 * AVERTISSEMENT RÉGLEMENTAIRE / NOTICE LÉGALE :
 * Cet algorithme et sa base de données constituent un OUTIL DE DÉMONSTRATION PÉDAGOGIQUE.
 * Il ne s'agit PAS d'une base de données médicale certifiée CE Dispositif Médical,
 * ni certifiée par la HAS (Haute Autorité de Santé), la FDA ou un éditeur agréé
 * (ex: Thériaque, VIDAL, Claude Bernard, RxNorm).
 * Il ne doit en aucun cas se substituer au jugement clinique et à la responsabilité
 * pleine et entière du praticien prescripteur.
 */

// ============================================================================
// 1. Interfaces & Types pour l'extensibilité (Thériaque, RxNorm, Vidal, etc.)
// ============================================================================

export type SeverityLevel = 'CRITICAL' | 'MAJOR' | 'MODERATE' | 'INFO';

export interface AllergyContraindicationResult {
  hasContraindication: boolean;
  severity?: 'CRITICAL';
  matchedAllergy?: string;
  matchedMedication?: string;
  matchedMolecule?: string;
  drugClass?: string;
  reason?: string;
}

export interface DrugInteractionResult {
  hasMajorInteraction: boolean;
  hasModerateInteraction: boolean;
  majorInteractions: DetectedInteraction[];
  moderateInteractions: DetectedInteraction[];
}

export interface DetectedInteraction {
  newMedication: string;
  existingMedication: string;
  moleculeA: string;
  moleculeB: string;
  classA: string;
  classB: string;
  severity: 'MAJOR' | 'MODERATE';
  mechanism: string;
  clinicalImpact: string;
}

export interface DrugKnowledgeProvider {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly isCertified: boolean;
  readonly legalNotice: string;
  normalize(input: string): string;
  resolveMolecule(input: string): { molecule: string; therapeuticClass: string } | null;
  checkAllergyContraindication(medicationName: string, patientAllergies: string[]): AllergyContraindicationResult;
  checkInteractions(newMedicationName: string, activeMedications: string[]): DrugInteractionResult;
}

// ============================================================================
// 2. Normalisation de saisie (minuscules, sans accents, nettoyage dosages)
// ============================================================================

export function normalizeDrugName(input: string): string {
  if (!input) return '';
  return input
    .toLowerCase()
    .normalize('NFKD') // Normalisation de compatibilité Unicode (décomposition exhaustive des glyphes)
    .replace(/\p{Diacritic}/gu, '') // Suppression intégrale de tous les diacritiques
    .replace(/[\u0300-\u036f]/g, '') // Filet de sécurité diacritiques combinatoires
    .replace(/[\(\)\[\],;\.\/\+\-_*#]/g, ' ') // suppression des ponctuations et séparateurs
    .replace(/\b\d+(\.\d+)?\s*(mg|g|mcg|µg|ml|ui|iu|%)\b/gi, '') // suppression des dosages
    .replace(/\b(comprime|comprimes|gelule|gelules|sirop|inhalation|injectable|turbuhaler|flacon|sachet|gouttes|aerosol|pommade)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================================
// 3. Dictionnaire DCI, Noms Commerciaux & Classes Thérapeutiques
// ============================================================================

export interface MoleculeDefinition {
  dci: string;
  therapeuticClass: string;
  family: string;
  brandNames: string[];
}

export const MOLECULE_DICTIONARY: Record<string, MoleculeDefinition> = {
  // Pénicillines / Bêta-lactamines
  amoxicilline: {
    dci: 'amoxicilline',
    therapeuticClass: 'BETA_LACTAMINES',
    family: 'PENICILLINES',
    brandNames: ['clamoxyl', 'augmentin', 'amoxil', 'amoxi'],
  },
  ampicilline: {
    dci: 'ampicilline',
    therapeuticClass: 'BETA_LACTAMINES',
    family: 'PENICILLINES',
    brandNames: ['totapen', 'unacim'],
  },
  oxacilline: {
    dci: 'oxacilline',
    therapeuticClass: 'BETA_LACTAMINES',
    family: 'PENICILLINES',
    brandNames: ['bristopen'],
  },
  ceftriaxone: {
    dci: 'ceftriaxone',
    therapeuticClass: 'BETA_LACTAMINES',
    family: 'CEPHALOSPORINES',
    brandNames: ['rocephine'],
  },
  cefixime: {
    dci: 'cefixime',
    therapeuticClass: 'BETA_LACTAMINES',
    family: 'CEPHALOSPORINES',
    brandNames: ['oroken'],
  },

  // Anti-inflammatoires non stéroïdiens (AINS) & Salicylés
  acide_acetylsalicylique: {
    dci: 'acide acetylsalicylique',
    therapeuticClass: 'AINS_SALICYLES',
    family: 'AINS',
    brandNames: ['aspirine', 'kardegic', 'aspegic', 'catalgine'],
  },
  ibuprofene: {
    dci: 'ibuprofene',
    therapeuticClass: 'AINS',
    family: 'AINS',
    brandNames: ['advil', 'nurofen', 'antarene', 'spidifen', 'intralgis'],
  },
  ketoprofene: {
    dci: 'ketoprofene',
    therapeuticClass: 'AINS',
    family: 'AINS',
    brandNames: ['profenid', 'bi-profenid', 'ketum', 'toprec'],
  },
  diclofenac: {
    dci: 'diclofenac',
    therapeuticClass: 'AINS',
    family: 'AINS',
    brandNames: ['voltarene', 'flector', 'diclo'],
  },

  // Anticoagulants
  warfarine: {
    dci: 'warfarine',
    therapeuticClass: 'ANTIVITAMINES_K',
    family: 'ANTICOAGULANTS',
    brandNames: ['coumadine', 'marevan'],
  },
  fluindione: {
    dci: 'fluindione',
    therapeuticClass: 'ANTIVITAMINES_K',
    family: 'ANTICOAGULANTS',
    brandNames: ['previscan'],
  },
  acenocoumarol: {
    dci: 'acenocoumarol',
    therapeuticClass: 'ANTIVITAMINES_K',
    family: 'ANTICOAGULANTS',
    brandNames: ['sintrom', 'mini-sintrom'],
  },
  rivaroxaban: {
    dci: 'rivaroxaban',
    therapeuticClass: 'AOD',
    family: 'ANTICOAGULANTS',
    brandNames: ['xarelto'],
  },
  apixaban: {
    dci: 'apixaban',
    therapeuticClass: 'AOD',
    family: 'ANTICOAGULANTS',
    brandNames: ['eliquis'],
  },
  clopidogrel: {
    dci: 'clopidogrel',
    therapeuticClass: 'ANTIAGREGANTS_PLAQUETTAIRES',
    family: 'ANTITHROMBOTIQUES',
    brandNames: ['plavix', 'duoplavin'],
  },

  // Bêta-bloquants
  propranolol: {
    dci: 'propranolol',
    therapeuticClass: 'BETA_BLOQUANTS',
    family: 'BETA_BLOQUANTS_NON_SELECTIFS',
    brandNames: ['avlocardyl', 'hemangeol'],
  },
  bisoprolol: {
    dci: 'bisoprolol',
    therapeuticClass: 'BETA_BLOQUANTS',
    family: 'BETA_BLOQUANTS_CARDIOSELECTIFS',
    brandNames: ['cardensiel', 'detensiel', 'lodoz'],
  },
  atenolol: {
    dci: 'atenolol',
    therapeuticClass: 'BETA_BLOQUANTS',
    family: 'BETA_BLOQUANTS_CARDIOSELECTIFS',
    brandNames: ['tenormine', 'betatop'],
  },

  // Bronchodilatateurs & Traitements respiratoires
  salbutamol: {
    dci: 'salbutamol',
    therapeuticClass: 'BETA2_AGONISTES',
    family: 'BRONCHODILATATEURS',
    brandNames: ['ventoline', 'airomir', 'salbumol'],
  },
  formoterol: {
    dci: 'formoterol',
    therapeuticClass: 'BETA2_AGONISTES',
    family: 'BRONCHODILATATEURS',
    brandNames: ['symbicort', 'foradil', 'flutiform'],
  },
  budesonide: {
    dci: 'budesonide',
    therapeuticClass: 'CORTICOIDES_INHALES',
    family: 'CORTICOIDES',
    brandNames: ['symbicort', 'pulmicort', 'miflonil'],
  },

  // Immunosuppresseurs
  methotrexate: {
    dci: 'methotrexate',
    therapeuticClass: 'IMMUNOSUPPRESSEURS_ANTIMETABOLITES',
    family: 'IMMUNOSUPPRESSEURS',
    brandNames: ['novatrex', 'metoject', 'nordimet', 'imeth'],
  },

  // Macrolides
  clarithromycine: {
    dci: 'clarithromycine',
    therapeuticClass: 'MACROLIDES',
    family: 'ANTIBIOTIQUES_MACROLIDES',
    brandNames: ['zeclar', 'naxy'],
  },
  azithromycine: {
    dci: 'azithromycine',
    therapeuticClass: 'MACROLIDES',
    family: 'ANTIBIOTIQUES_MACROLIDES',
    brandNames: ['zithromax', 'ordipha'],
  },

  // Statines
  simvastatine: {
    dci: 'simvastatine',
    therapeuticClass: 'STATINES',
    family: 'HYPOLIPIDEMIANTS',
    brandNames: ['zocor', 'inegy'],
  },
  atorvastatine: {
    dci: 'atorvastatine',
    therapeuticClass: 'STATINES',
    family: 'HYPOLIPIDEMIANTS',
    brandNames: ['tahor'],
  },

  // Antalgiques simples
  paracetamol: {
    dci: 'paracetamol',
    therapeuticClass: 'ANTALGIQUES_NON_OPIOIDES',
    family: 'ANTALGIQUES',
    brandNames: ['doliprane', 'dafalgan', 'efferalgan', 'perfalgan'],
  },

  // Iode et produits de contraste
  iode_contraste: {
    dci: 'produit de contraste iode',
    therapeuticClass: 'PRODUITS_CONTRASTE_IODES',
    family: 'PRODUITS_DE_CONTRASTE',
    brandNames: ['iode', 'omnipaque', 'iomeron', 'xenetix', 'telebrix', 'optiray'],
  },

  // Sulfamides
  sulfamethoxazole: {
    dci: 'sulfamethoxazole',
    therapeuticClass: 'SULFAMIDES_ANTIBACTERIENS',
    family: 'SULFAMIDES',
    brandNames: ['bactrim'],
  },
};

// ============================================================================
// 4. Moteur de Détection Clinique Démo
// ============================================================================

export class DemoClinicalDrugSafetyProvider implements DrugKnowledgeProvider {
  readonly id = 'demo-clinical-safety-v1';
  readonly name = 'Moteur Clinique Démo (Clinical Calm Drug Safety Engine)';
  readonly version = '1.2.0-edu';
  readonly isCertified = false;
  readonly legalNotice =
    'OUTIL DE DÉMONSTRATION PÉDAGOGIQUE — NON CERTIFIÉ CE / HAS / THÉRIAQUE / RXNORM. Ne pas utiliser pour une prise de décision clinique réelle sans validation humaine médicale.';

  normalize(input: string): string {
    return normalizeDrugName(input);
  }

  resolveMolecule(input: string): { molecule: string; therapeuticClass: string; family: string } | null {
    const clean = this.normalize(input);
    if (!clean) return null;

    // 1. Recherche par DCI exacte ou partielle
    for (const [key, def] of Object.entries(MOLECULE_DICTIONARY)) {
      const cleanDci = this.normalize(def.dci);
      if (clean.includes(cleanDci) || cleanDci.includes(clean) || clean.includes(key)) {
        return { molecule: def.dci, therapeuticClass: def.therapeuticClass, family: def.family };
      }
    }

    // 2. Recherche par nom commercial
    for (const def of Object.values(MOLECULE_DICTIONARY)) {
      for (const brand of def.brandNames) {
        const cleanBrand = this.normalize(brand);
        if (clean.includes(cleanBrand)) {
          return { molecule: def.dci, therapeuticClass: def.therapeuticClass, family: def.family };
        }
      }
    }

    return null;
  }

  // --------------------------------------------------------------------------
  // Détection des Allergies et Allergies Croisées
  // --------------------------------------------------------------------------
  checkAllergyContraindication(medicationName: string, patientAllergies: string[]): AllergyContraindicationResult {
    if (!medicationName || !patientAllergies || patientAllergies.length === 0) {
      return { hasContraindication: false };
    }

    const resolved = this.resolveMolecule(medicationName);
    const cleanMedName = this.normalize(medicationName);

    for (const rawAllergy of patientAllergies) {
      const cleanAllergy = this.normalize(rawAllergy);
      if (!cleanAllergy || cleanAllergy === 'aucune allergie connue') continue;

      // 1. Allergie aux Pénicillines / Bêta-lactamines
      const isPenicillinAllergy =
        cleanAllergy.includes('penicilline') ||
        cleanAllergy.includes('amoxicilline') ||
        cleanAllergy.includes('beta lactamine');

      if (isPenicillinAllergy) {
        if (
          cleanMedName.includes('amoxicilline') ||
          cleanMedName.includes('augmentin') ||
          cleanMedName.includes('clamoxyl') ||
          cleanMedName.includes('penicilline') ||
          cleanMedName.includes('ampicilline') ||
          (resolved && (resolved.family === 'PENICILLINES' || resolved.therapeuticClass === 'BETA_LACTAMINES'))
        ) {
          return {
            hasContraindication: true,
            severity: 'CRITICAL',
            matchedAllergy: rawAllergy,
            matchedMedication: medicationName,
            matchedMolecule: resolved?.molecule || 'amoxicilline',
            drugClass: 'Pénicillines / Bêta-lactamines',
            reason: `Le patient présente un antécédent répertorié d'hypersensibilité : "${rawAllergy}". La prescription de "${medicationName}" expose à un risque critique de choc anaphylactique ou de toxidermie sévère.`,
          };
        }
      }

      // 2. Allergie à l'Aspirine ou aux AINS
      const isAinsAllergy =
        cleanAllergy.includes('aspirine') ||
        cleanAllergy.includes('ains') ||
        cleanAllergy.includes('ibuprofene') ||
        cleanAllergy.includes('salicyle');

      if (isAinsAllergy) {
        if (
          cleanMedName.includes('aspirine') ||
          cleanMedName.includes('kardegic') ||
          cleanMedName.includes('aspegic') ||
          cleanMedName.includes('ibuprofene') ||
          cleanMedName.includes('advil') ||
          cleanMedName.includes('nurofen') ||
          cleanMedName.includes('ketoprofene') ||
          cleanMedName.includes('profenid') ||
          cleanMedName.includes('voltarene') ||
          cleanMedName.includes('diclofenac') ||
          (resolved && resolved.family === 'AINS')
        ) {
          return {
            hasContraindication: true,
            severity: 'CRITICAL',
            matchedAllergy: rawAllergy,
            matchedMedication: medicationName,
            matchedMolecule: resolved?.molecule || 'AINS / Acide acétylsalicylique',
            drugClass: 'Anti-Inflammatoires Non Stéroïdiens (AINS) / Salicylés',
            reason: `Le patient présente une contre-indication absolue documentée : "${rawAllergy}". L'administration de "${medicationName}" expose à un syndrome de Widal ou un bronchospasme aigu.`,
          };
        }
      }

      // 3. Allergie à l'Iode / Produits de contraste
      const isIodineAllergy = cleanAllergy.includes('iode') || cleanAllergy.includes('contraste');
      if (isIodineAllergy) {
        if (
          cleanMedName.includes('iode') ||
          cleanMedName.includes('omnipaque') ||
          cleanMedName.includes('xenetix') ||
          cleanMedName.includes('iomeron') ||
          (resolved && resolved.therapeuticClass === 'PRODUITS_CONTRASTE_IODES')
        ) {
          return {
            hasContraindication: true,
            severity: 'CRITICAL',
            matchedAllergy: rawAllergy,
            matchedMedication: medicationName,
            matchedMolecule: resolved?.molecule || 'Produit de contraste iodé',
            drugClass: 'Produits de contraste iodés',
            reason: `Le patient présente une intolérance connue : "${rawAllergy}". Contre-indication formelle avec "${medicationName}".`,
          };
        }
      }

      // 4. Allergie aux Sulfamides
      const isSulfamideAllergy = cleanAllergy.includes('sulfamide') || cleanAllergy.includes('bactrim');
      if (isSulfamideAllergy) {
        if (
          cleanMedName.includes('sulfamethoxazole') ||
          cleanMedName.includes('bactrim') ||
          (resolved && resolved.family === 'SULFAMIDES')
        ) {
          return {
            hasContraindication: true,
            severity: 'CRITICAL',
            matchedAllergy: rawAllergy,
            matchedMedication: medicationName,
            matchedMolecule: resolved?.molecule || 'sulfaméthoxazole',
            drugClass: 'Sulfamides antibactériens',
            reason: `Intolérance documentée aux sulfamides : "${rawAllergy}". Prescription de "${medicationName}" contre-indiquée.`,
          };
        }
      }

      // 5. Allergie directe mot à mot
      if (resolved && cleanAllergy.includes(this.normalize(resolved.molecule))) {
        return {
          hasContraindication: true,
          severity: 'CRITICAL',
          matchedAllergy: rawAllergy,
          matchedMedication: medicationName,
          matchedMolecule: resolved.molecule,
          drugClass: resolved.therapeuticClass,
          reason: `Antécédent allergique direct correspondant à la molécule active : "${rawAllergy}".`,
        };
      }
    }

    return { hasContraindication: false };
  }

  // --------------------------------------------------------------------------
  // Détection des Interactions Médicamenteuses (Majeures et Modérées)
  // --------------------------------------------------------------------------
  checkInteractions(newMedicationName: string, activeMedications: string[]): DrugInteractionResult {
    const majorInteractions: DetectedInteraction[] = [];
    const moderateInteractions: DetectedInteraction[] = [];

    if (!newMedicationName || !activeMedications || activeMedications.length === 0) {
      return {
        hasMajorInteraction: false,
        hasModerateInteraction: false,
        majorInteractions,
        moderateInteractions,
      };
    }

    const resolvedNew = this.resolveMolecule(newMedicationName);
    const cleanNew = this.normalize(newMedicationName);

    for (const existingMed of activeMedications) {
      const resolvedExisting = this.resolveMolecule(existingMed);
      const cleanExisting = this.normalize(existingMed);

      // --- RÈGLE MAJEURE 1 : Anticoagulants (AVK / AOD) + AINS / Aspirine ---
      const isAnticoagulantNew =
        resolvedNew?.therapeuticClass === 'ANTIVITAMINES_K' ||
        resolvedNew?.therapeuticClass === 'AOD' ||
        cleanNew.includes('coumadine') ||
        cleanNew.includes('previscan') ||
        cleanNew.includes('xarelto') ||
        cleanNew.includes('eliquis') ||
        cleanNew.includes('warfarine');

      const isAinsExisting =
        resolvedExisting?.family === 'AINS' ||
        resolvedExisting?.therapeuticClass === 'AINS' ||
        cleanExisting.includes('aspirine') ||
        cleanExisting.includes('ibuprofene') ||
        cleanExisting.includes('advil') ||
        cleanExisting.includes('profenid') ||
        cleanExisting.includes('voltarene');

      const isAinsNew =
        resolvedNew?.family === 'AINS' ||
        resolvedNew?.therapeuticClass === 'AINS' ||
        cleanNew.includes('aspirine') ||
        cleanNew.includes('ibuprofene') ||
        cleanNew.includes('advil') ||
        cleanNew.includes('profenid') ||
        cleanNew.includes('voltarene') ||
        cleanNew.includes('kardegic');

      const isAnticoagulantExisting =
        resolvedExisting?.therapeuticClass === 'ANTIVITAMINES_K' ||
        resolvedExisting?.therapeuticClass === 'AOD' ||
        cleanExisting.includes('coumadine') ||
        cleanExisting.includes('previscan') ||
        cleanExisting.includes('xarelto') ||
        cleanExisting.includes('eliquis') ||
        cleanExisting.includes('warfarine');

      if ((isAnticoagulantNew && isAinsExisting) || (isAinsNew && isAnticoagulantExisting)) {
        majorInteractions.push({
          newMedication: newMedicationName,
          existingMedication: existingMed,
          moleculeA: resolvedNew?.molecule || newMedicationName,
          moleculeB: resolvedExisting?.molecule || existingMed,
          classA: resolvedNew?.therapeuticClass || 'Médicament prescrit',
          classB: resolvedExisting?.therapeuticClass || 'Traitement actif',
          severity: 'MAJOR',
          mechanism: "Synergie anti-hémostatique et agression de la muqueuse gastrique par inhibition des prostaglandines et de la cascade de coagulation.",
          clinicalImpact: "Association formellement déconseillée : risque hémorragique gastro-intestinal et systémique majeur potentiellement fatal.",
        });
      }

      // --- RÈGLE MAJEURE 2 : Bêta-bloquant + Bêta-2 agoniste / Asthme ---
      const isBetaBlockerNew =
        resolvedNew?.therapeuticClass === 'BETA_BLOQUANTS' ||
        cleanNew.includes('propranolol') ||
        cleanNew.includes('avlocardyl') ||
        cleanNew.includes('bisoprolol');

      const isBetaBlockerExisting =
        resolvedExisting?.therapeuticClass === 'BETA_BLOQUANTS' ||
        cleanExisting.includes('propranolol') ||
        cleanExisting.includes('avlocardyl') ||
        cleanExisting.includes('bisoprolol');

      const isBeta2AgonistNew =
        resolvedNew?.therapeuticClass === 'BETA2_AGONISTES' ||
        cleanNew.includes('symbicort') ||
        cleanNew.includes('ventoline') ||
        cleanNew.includes('salbutamol') ||
        cleanNew.includes('formoterol');

      const isBeta2AgonistExisting =
        resolvedExisting?.therapeuticClass === 'BETA2_AGONISTES' ||
        cleanExisting.includes('symbicort') ||
        cleanExisting.includes('ventoline') ||
        cleanExisting.includes('salbutamol') ||
        cleanExisting.includes('formoterol');

      if ((isBetaBlockerNew && isBeta2AgonistExisting) || (isBeta2AgonistNew && isBetaBlockerExisting)) {
        majorInteractions.push({
          newMedication: newMedicationName,
          existingMedication: existingMed,
          moleculeA: resolvedNew?.molecule || newMedicationName,
          moleculeB: resolvedExisting?.molecule || existingMed,
          classA: 'Bêta-bloquant',
          classB: 'Bronchodilatateur Bêta-2 agoniste',
          severity: 'MAJOR',
          mechanism: "Antagonisme pharmacologique direct sur les récepteurs bronchiques bêta-2 adrénergiques.",
          clinicalImpact: "Risque aigu de bronchospasme sévère et blocage complet de l'action de secours du bronchodilatateur chez le patient asthmatique.",
        });
      }

      // --- RÈGLE MAJEURE 3 : Macrolides (Clarithromycine) + Statines (Simvastatine/Atorvastatine) ---
      const isMacrolideNew =
        resolvedNew?.therapeuticClass === 'MACROLIDES' ||
        cleanNew.includes('clarithromycine') ||
        cleanNew.includes('zeclar');

      const isMacrolideExisting =
        resolvedExisting?.therapeuticClass === 'MACROLIDES' ||
        cleanExisting.includes('clarithromycine') ||
        cleanExisting.includes('zeclar');

      const isStatineNew =
        resolvedNew?.therapeuticClass === 'STATINES' ||
        cleanNew.includes('simvastatine') ||
        cleanNew.includes('zocor') ||
        cleanNew.includes('atorvastatine') ||
        cleanNew.includes('tahor');

      const isStatineExisting =
        resolvedExisting?.therapeuticClass === 'STATINES' ||
        cleanExisting.includes('simvastatine') ||
        cleanExisting.includes('zocor') ||
        cleanExisting.includes('atorvastatine') ||
        cleanExisting.includes('tahor');

      if ((isMacrolideNew && isStatineExisting) || (isStatineNew && isMacrolideExisting)) {
        majorInteractions.push({
          newMedication: newMedicationName,
          existingMedication: existingMed,
          moleculeA: resolvedNew?.molecule || newMedicationName,
          moleculeB: resolvedExisting?.molecule || existingMed,
          classA: 'Antibiotique Macrolide (Inhibiteur CYP3A4)',
          classB: 'Statine (Substrat CYP3A4)',
          severity: 'MAJOR',
          mechanism: "Inhibition puissante du cytochrome P450 CYP3A4 augmentant drastiquement les concentrations plasmatiques de la statine.",
          clinicalImpact: "Risque élevé de rhabdomyolyse aiguë avec myolyse sévère et insuffisance rénale aiguë.",
        });
      }

      // --- RÈGLE MAJEURE 4 : Méthotrexate + AINS ---
      const isMethotrexateNew = resolvedNew?.therapeuticClass?.includes('IMMUNOSUPPRESSEURS') || cleanNew.includes('methotrexate');
      const isMethotrexateExisting = resolvedExisting?.therapeuticClass?.includes('IMMUNOSUPPRESSEURS') || cleanExisting.includes('methotrexate');

      if ((isMethotrexateNew && isAinsExisting) || (isAinsNew && isMethotrexateExisting)) {
        majorInteractions.push({
          newMedication: newMedicationName,
          existingMedication: existingMed,
          moleculeA: resolvedNew?.molecule || newMedicationName,
          moleculeB: resolvedExisting?.molecule || existingMed,
          classA: 'Méthotrexate / AINS',
          classB: 'AINS / Méthotrexate',
          severity: 'MAJOR',
          mechanism: "Diminution de la clairance rénale du méthotrexate par inhibition de la sécrétion tubulaire rénale par les AINS.",
          clinicalImpact: "Majoration de la toxicité hématologique (aplasie médullaire) et digestive du méthotrexate.",
        });
      }

      // --- RÈGLE MODÉRÉE 1 : AINS + Corticoïdes inhalés ou oraux ---
      const isCorticoidNew =
        resolvedNew?.therapeuticClass === 'CORTICOIDES_INHALES' ||
        cleanNew.includes('symbicort') ||
        cleanNew.includes('budesonide') ||
        cleanNew.includes('pulmicort') ||
        cleanNew.includes('prednisone');

      const isCorticoidExisting =
        resolvedExisting?.therapeuticClass === 'CORTICOIDES_INHALES' ||
        cleanExisting.includes('symbicort') ||
        cleanExisting.includes('budesonide') ||
        cleanExisting.includes('pulmicort') ||
        cleanExisting.includes('prednisone');

      if (((isAinsNew && isCorticoidExisting) || (isCorticoidNew && isAinsExisting)) && !isAnticoagulantExisting && !isAnticoagulantNew) {
        moderateInteractions.push({
          newMedication: newMedicationName,
          existingMedication: existingMed,
          moleculeA: resolvedNew?.molecule || newMedicationName,
          moleculeB: resolvedExisting?.molecule || existingMed,
          classA: 'AINS',
          classB: 'Corticoïde',
          severity: 'MODERATE',
          mechanism: "Effet cumulatif sur la perméabilité et la trophicité de la muqueuse gastro-intestinale.",
          clinicalImpact: "Majoration du risque d'ulcération digestive ou de dyspepsie. Surveillance clinique recommandée.",
        });
      }
    }

    return {
      hasMajorInteraction: majorInteractions.length > 0,
      hasModerateInteraction: moderateInteractions.length > 0,
      majorInteractions,
      moderateInteractions,
    };
  }
}

// Instance singleton par défaut pour le serveur
export const drugSafetyEngine: DrugKnowledgeProvider = new DemoClinicalDrugSafetyProvider();
