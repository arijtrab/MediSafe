import { describe, it, expect } from 'vitest';
import {
  parseConsultationDate,
  getUpcomingConsultationsAlerts,
  isConsultationWithin48h,
} from '../src/utils/consultationAlert';
import { Consultation } from '../src/types/clinical';

describe('Logique de Notification Visuelle & Badge d’Alerte Consultation (< 48h)', () => {
  const referenceNow = new Date('2026-10-12T10:00:00.000Z');

  describe('1. Analyse déterministe des dates (parseConsultationDate)', () => {
    it('doit correctement analyser le format textuel français standard', () => {
      const parsed = parseConsultationDate('13 Octobre 2026 à 14:30');
      expect(parsed).not.toBeNull();
      expect(parsed?.getFullYear()).toBe(2026);
      expect(parsed?.getMonth()).toBe(9); // Octobre = index 9
      expect(parsed?.getDate()).toBe(13);
      expect(parsed?.getHours()).toBe(14);
      expect(parsed?.getMinutes()).toBe(30);
    });

    it('doit analyser les variantes avec accents et heures en "h"', () => {
      const parsed = parseConsultationDate('14 Février 2026 à 10h15');
      expect(parsed).not.toBeNull();
      expect(parsed?.getMonth()).toBe(1); // Février = 1
      expect(parsed?.getDate()).toBe(14);
      expect(parsed?.getHours()).toBe(10);
      expect(parsed?.getMinutes()).toBe(15);
    });

    it('doit analyser le format avec slash "13/10/2026 14:30"', () => {
      const parsed = parseConsultationDate('13/10/2026 14:30');
      expect(parsed).not.toBeNull();
      expect(parsed?.getDate()).toBe(13);
      expect(parsed?.getMonth()).toBe(9);
    });

    it('doit renvoyer null pour une date invalide ou chaîne vide', () => {
      expect(parseConsultationDate('')).toBeNull();
      expect(parseConsultationDate('date_invalide')).toBeNull();
    });
  });

  describe('2. Détection de proximité (< 48 heures)', () => {
    const consultationDemain: Consultation = {
      id: 'RDV-TEST-01',
      patientId: 'PAT-001',
      patientName: 'Julien Moreau',
      doctorName: 'Dr. Sarah Chen',
      specialty: 'Pneumologie',
      dateTime: '13 Octobre 2026 à 14:30', // ~28.5 heures après referenceNow
      location: 'Salle 204',
      status: 'SCHEDULED',
      reason: 'Contrôle respiratoire',
    };

    const consultationDansCinqJours: Consultation = {
      id: 'RDV-TEST-02',
      patientId: 'PAT-001',
      patientName: 'Julien Moreau',
      doctorName: 'Dr. Philippe Roux',
      specialty: 'Cardiologie',
      dateTime: '17 Octobre 2026 à 10:00', // ~120h après referenceNow
      location: 'Pavillon Cœur',
      status: 'SCHEDULED',
      reason: 'Bilan tensionnel',
    };

    const consultationPassee: Consultation = {
      id: 'RDV-TEST-03',
      patientId: 'PAT-001',
      patientName: 'Julien Moreau',
      doctorName: 'Dr. Sarah Chen',
      specialty: 'Pneumologie',
      dateTime: '10 Octobre 2026 à 11:00', // Dans le passé
      location: 'Salle 204',
      status: 'COMPLETED',
      reason: 'Prescription initiale',
    };

    const consultationAnnulee: Consultation = {
      id: 'RDV-TEST-04',
      patientId: 'PAT-001',
      patientName: 'Julien Moreau',
      doctorName: 'Dr. Sarah Chen',
      specialty: 'Pneumologie',
      dateTime: '13 Octobre 2026 à 16:00',
      location: 'Salle 204',
      status: 'CANCELLED',
      reason: 'Annulation demandée',
    };

    it('isConsultationWithin48h doit renvoyer true pour un RDV prévu dans 28 heures', () => {
      expect(isConsultationWithin48h(consultationDemain, referenceNow)).toBe(true);
    });

    it('isConsultationWithin48h doit renvoyer false pour un RDV dans 5 jours', () => {
      expect(isConsultationWithin48h(consultationDansCinqJours, referenceNow)).toBe(false);
    });

    it('isConsultationWithin48h doit ignorer les RDV passés ou complétés', () => {
      expect(isConsultationWithin48h(consultationPassee, referenceNow)).toBe(false);
    });

    it('isConsultationWithin48h doit ignorer les RDV annulés même si sous 48h', () => {
      expect(isConsultationWithin48h(consultationAnnulee, referenceNow)).toBe(false);
    });

    it('getUpcomingConsultationsAlerts doit extraire l’alerte avec libellé d’urgence et tri chronologique', () => {
      const alerts = getUpcomingConsultationsAlerts(
        [consultationDansCinqJours, consultationDemain, consultationPassee, consultationAnnulee],
        referenceNow
      );

      expect(alerts).toHaveLength(1);
      expect(alerts[0].consultation.id).toBe('RDV-TEST-01');
      expect(alerts[0].isWithin48h).toBe(true);
      expect(alerts[0].urgencyBadge).toContain('Demain');
      expect(alerts[0].hoursRemaining).toBeGreaterThan(20);
      expect(alerts[0].hoursRemaining).toBeLessThan(35);
    });
  });
});
