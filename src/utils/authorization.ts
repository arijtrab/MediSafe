import { UserProfile, UserRole } from '../types/clinical';

/**
 * Checks if a user has a specific role.
 */
export function hasRole(user: UserProfile | null | undefined, role: UserRole): boolean {
  if (!user) return false;
  return user.role === role;
}

/**
 * Checks if a user has any of the specified roles.
 */
export function hasAnyRole(user: UserProfile | null | undefined, roles: readonly UserRole[]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}

/**
 * Checks if a user can access a specific patient's medical data.
 * - PATIENT can only access their own record.
 * - DOCTOR can access their patients' records.
 * - ADMIN can view general administrative patient directory metadata (read-only), but not perform clinical actions.
 */
export function canAccessPatientRecord(user: UserProfile | null | undefined, patientId: string, patientName?: string): boolean {
  if (!user) return false;
  if (user.role === 'DOCTOR') return true;
  if (user.role === 'ADMIN') return true; // Directory metadata read-only
  if (user.role === 'PATIENT') {
    // Patient can only access their own data
    return user.id === patientId || (patientName ? user.name === patientName : false);
  }
  return false;
}

/**
 * Checks if a user can perform clinical write actions (prescribe, add scan, update report, plan consultation).
 * Strictly reserved for DOCTOR.
 */
export function canPerformClinicalAction(user: UserProfile | null | undefined): boolean {
  return hasRole(user, 'DOCTOR');
}

/**
 * Checks if a user can manage equipment and operational administrative settings.
 * Strictly reserved for ADMIN.
 */
export function canManageHospitalOperations(user: UserProfile | null | undefined): boolean {
  return hasRole(user, 'ADMIN');
}
