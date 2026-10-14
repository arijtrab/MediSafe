import { Consultation } from '../types/clinical';

const MONTH_MAP: Record<string, number> = {
  janvier: 0,
  fevrier: 1,
  février: 1,
  mars: 2,
  avril: 3,
  mai: 4,
  juin: 5,
  juillet: 6,
  aout: 7,
  août: 7,
  septembre: 8,
  octobre: 9,
  novembre: 10,
  decembre: 11,
  décembre: 11,
};

/**
 * Analyse déterministe des dates de consultations (formats français textuels, slash ou ISO).
 * Ex: "14 Octobre 2026 à 10:30", "14/10/2026 10:30", "2026-10-14T10:30:00"
 */
export function parseConsultationDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const trimmed = dateStr.trim();

  // Format ISO
  const isoTry = new Date(trimmed);
  if (!isNaN(isoTry.getTime()) && trimmed.includes('-')) {
    return isoTry;
  }

  // Format texte français: "14 Octobre 2026 à 10:30" ou "14 octobre 2026 10h30"
  const frenchMatch = trimmed.match(
    /(\d{1,2})\s+([a-zA-Z\u00C0-\u017F]+)\s+(\d{4})(?:\s+(?:à|a)\s+(\d{1,2})[h:](\d{2}))?/i
  );
  if (frenchMatch) {
    const day = parseInt(frenchMatch[1], 10);
    const rawMonth = frenchMatch[2].toLowerCase();
    const normalizedMonth = rawMonth.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const month = MONTH_MAP[normalizedMonth] ?? MONTH_MAP[rawMonth];
    const year = parseInt(frenchMatch[3], 10);
    const hours = frenchMatch[4] ? parseInt(frenchMatch[4], 10) : 9;
    const minutes = frenchMatch[5] ? parseInt(frenchMatch[5], 10) : 0;

    if (month !== undefined && !isNaN(day) && !isNaN(year)) {
      return new Date(year, month, day, hours, minutes);
    }
  }

  // Format date slash: "14/10/2026 à 10:30" ou "14/10/2026 10:30"
  const slashMatch = trimmed.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s*(?:à|a)?\s*(\d{1,2})[h:](\d{2}))?/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10) - 1;
    const year = parseInt(slashMatch[3], 10);
    const hours = slashMatch[4] ? parseInt(slashMatch[4], 10) : 9;
    const minutes = slashMatch[5] ? parseInt(slashMatch[5], 10) : 0;
    return new Date(year, month, day, hours, minutes);
  }

  return isNaN(isoTry.getTime()) ? null : isoTry;
}

export interface UpcomingConsultationAlert {
  consultation: Consultation;
  targetDate: Date;
  hoursRemaining: number;
  isWithin48h: boolean;
  urgencyBadge: string;
  formattedTimeLeft: string;
}

/**
 * Détermine si une consultation est prévue dans les 48 prochaines heures (ou en cours).
 */
export function isConsultationWithin48h(
  consultation: Consultation,
  now: Date = new Date(),
  maxHours = 48
): boolean {
  if (!consultation || consultation.status !== 'SCHEDULED') return false;
  const parsed = parseConsultationDate(consultation.dateTime);
  if (!parsed) return false;
  const diffMs = parsed.getTime() - now.getTime();
  const hours = diffMs / (1000 * 60 * 60);
  return hours >= -0.5 && hours <= maxHours;
}

/**
 * Filtre et extrait les consultations prévues dans moins de 48 heures.
 */
export function getUpcomingConsultationsAlerts(
  consultations: Consultation[],
  now: Date = new Date(),
  maxHours = 48
): UpcomingConsultationAlert[] {
  if (!consultations || !Array.isArray(consultations)) return [];

  const alerts: UpcomingConsultationAlert[] = [];

  for (const c of consultations) {
    if (c.status !== 'SCHEDULED') continue;

    const parsed = parseConsultationDate(c.dateTime);
    if (!parsed) continue;

    const diffMs = parsed.getTime() - now.getTime();
    const hours = diffMs / (1000 * 60 * 60);

    // Détection dans la fenêtre des 48 heures (ou consultation en cours / imminente)
    if (hours >= -0.5 && hours <= maxHours) {
      const isToday =
        parsed.getDate() === now.getDate() &&
        parsed.getMonth() === now.getMonth() &&
        parsed.getFullYear() === now.getFullYear();

      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      const isTomorrow =
        parsed.getDate() === tomorrow.getDate() &&
        parsed.getMonth() === tomorrow.getMonth() &&
        parsed.getFullYear() === tomorrow.getFullYear();

      const timeString = `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
      let urgencyBadge = `Dans ${Math.max(1, Math.round(hours))}h`;
      let formattedTimeLeft = `Dans environ ${Math.max(1, Math.round(hours))} heures`;

      if (hours < 0) {
        urgencyBadge = 'En cours';
        formattedTimeLeft = 'Rendez-vous en cours actuellement';
      } else if (hours < 1) {
        urgencyBadge = 'Imminent (< 1h)';
        formattedTimeLeft = `Rendez-vous imminent à ${timeString} (dans moins d'une heure)`;
      } else if (isToday) {
        urgencyBadge = `Aujourd'hui (${Math.max(1, Math.round(hours))}h)`;
        formattedTimeLeft = `Aujourd'hui à ${timeString} (dans ${Math.max(1, Math.round(hours))}h)`;
      } else if (isTomorrow) {
        urgencyBadge = `Demain (${Math.max(1, Math.round(hours))}h)`;
        formattedTimeLeft = `Demain à ${timeString} (dans ${Math.max(1, Math.round(hours))}h)`;
      } else {
        urgencyBadge = `Sous 48h (${Math.max(1, Math.round(hours))}h)`;
        formattedTimeLeft = `Prévu dans ${Math.max(1, Math.round(hours))}h (sous 48 heures)`;
      }

      alerts.push({
        consultation: c,
        targetDate: parsed,
        hoursRemaining: Math.round(hours * 10) / 10,
        isWithin48h: true,
        urgencyBadge,
        formattedTimeLeft,
      });
    }
  }

  // Tri par proximité temporelle (le plus proche en premier)
  return alerts.sort((a, b) => a.targetDate.getTime() - b.targetDate.getTime());
}
