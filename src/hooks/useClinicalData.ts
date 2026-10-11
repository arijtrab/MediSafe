import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { PrescriptionItem, MedicalScan, Consultation, HospitalActivityLog, PatientVitals } from '../types/clinical';

export const queryKeys = {
  patients: ['patients'] as const,
  patient: (id: string) => ['patient', id] as const,
  vitals: (id: string) => ['vitals', id] as const,
  doctors: ['doctors'] as const,
  equipments: ['equipments'] as const,
  logs: ['logs'] as const,
};

// -------------------------------------------------------------
// Queries
// -------------------------------------------------------------

export function usePatients(enabled = true) {
  return useQuery({
    queryKey: queryKeys.patients,
    queryFn: () => api.getPatients(),
    enabled,
    staleTime: 1000 * 30, // 30 seconds
  });
}

export function usePatient(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.patient(id),
    queryFn: () => api.getPatient(id),
    enabled: enabled && Boolean(id),
    staleTime: 1000 * 30,
  });
}

export function useEquipments(enabled = true) {
  return useQuery({
    queryKey: queryKeys.equipments,
    queryFn: () => api.getEquipments(),
    enabled,
    staleTime: 1000 * 30,
  });
}

export function useLogs(enabled = true) {
  return useQuery({
    queryKey: queryKeys.logs,
    queryFn: () => api.getLogs(),
    enabled,
    staleTime: 1000 * 15,
  });
}

export function useDoctors(enabled = true) {
  return useQuery({
    queryKey: queryKeys.doctors,
    queryFn: () => api.getDoctors(),
    enabled,
    staleTime: 1000 * 30,
  });
}

export function usePatientVitals(patientId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.vitals(patientId),
    queryFn: () => api.getPatientVitals(patientId),
    enabled: enabled && Boolean(patientId),
    staleTime: 1000 * 30,
  });
}

// -------------------------------------------------------------
// Mutations (with automatic cache invalidation)
// -------------------------------------------------------------

export function useAddPrescriptionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      patientId,
      item,
      patientName,
    }: {
      patientId: string;
      item: Partial<PrescriptionItem> & { override?: boolean; justification?: string };
      patientName?: string;
    }) => api.addPrescription(patientId, item, patientName),
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.patients });
        queryClient.invalidateQueries({ queryKey: queryKeys.logs });
      }
    },
  });
}

export function useDeletePrescriptionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ patientId, prescriptionId }: { patientId: string; prescriptionId: string }) =>
      api.deletePrescription(patientId, prescriptionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.patients });
    },
  });
}

export function useAddScanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ patientId, scan }: { patientId: string; scan: MedicalScan }) =>
      api.addScan(patientId, scan),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.patients });
    },
  });
}

export function useUpdateScanFindingsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      scanId,
      findings,
      radiologistNote,
      patientName,
    }: {
      scanId: string;
      findings: string;
      radiologistNote: string;
      patientName?: string;
    }) => api.updateScanFindings(scanId, findings, radiologistNote, patientName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.patients });
    },
  });
}

export function useDeleteScanMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ scanId }: { scanId: string }) => api.deleteScan(scanId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.patients });
    },
  });
}

export function useAddConsultationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (consultation: Consultation) => api.addConsultation(consultation),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.patients });
      queryClient.invalidateQueries({ queryKey: queryKeys.doctors });
      queryClient.invalidateQueries({ queryKey: queryKeys.logs });
    },
  });
}

export function useCancelConsultationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ consultationId }: { consultationId: string }) =>
      api.cancelConsultation(consultationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.patients });
      queryClient.invalidateQueries({ queryKey: queryKeys.doctors });
      queryClient.invalidateQueries({ queryKey: queryKeys.logs });
    },
  });
}

export function useAddVitalsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ patientId, vitals }: { patientId: string; vitals: Partial<PatientVitals> }) =>
      api.addPatientVitals(patientId, vitals),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.patients });
      queryClient.invalidateQueries({ queryKey: queryKeys.patient(variables.patientId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.vitals(variables.patientId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.logs });
    },
  });
}

export function useUpdateEquipmentStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ equipmentId, status }: { equipmentId: string; status: string }) =>
      api.updateEquipmentStatus(equipmentId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.equipments });
      queryClient.invalidateQueries({ queryKey: queryKeys.logs });
    },
  });
}

export function useAddLogMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (log: HospitalActivityLog) => api.addLog(log),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.logs });
    },
  });
}

export function useResetDataMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.resetData(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.patients });
      queryClient.invalidateQueries({ queryKey: queryKeys.equipments });
      queryClient.invalidateQueries({ queryKey: queryKeys.logs });
    },
  });
}
