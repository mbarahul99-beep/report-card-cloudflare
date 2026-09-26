import { Student, SchoolBranding, ParentPortalLoginConfig } from '../types';

export type ParentLoginMethod = 'roll_dob' | 'adm_dob' | 'mob_roll' | 'mob_adm';

export interface ResolvedPortalMethods {
  rollNoDobEnabled: boolean;
  admissionNoDobEnabled: boolean;
  mobileRollNoEnabled: boolean;
  mobileAdmissionNoEnabled: boolean;
  activeCount: number;
  availableMethods: ParentLoginMethod[];
  primaryMethod: ParentLoginMethod;
  defaultLoginMode: ParentLoginMethod;
  admissionFieldEnabled: boolean;
}

/**
 * Resolves active login methods for a school, gracefully respecting
 * both custom admin toggles AND studentFields visibility (e.g. if admissionNo is disabled in report cards).
 */
export function getParentPortalLoginConfig(branding?: SchoolBranding, reportCardStructures?: any[]): ResolvedPortalMethods {
  const cfg = branding?.parentPortalLoginConfig;

  // Check if school has explicitly disabled or deleted admission number on report cards / student registry
  let admissionFieldEnabled = true;
  const structuresWithFields = (reportCardStructures || []).filter(
    (s: any) => s.branding?.studentFields && Array.isArray(s.branding.studentFields) && s.branding.studentFields.length > 0
  );

  if (structuresWithFields.length > 0) {
    admissionFieldEnabled = structuresWithFields.some((s: any) => 
      s.branding.studentFields.some((f: any) => f.id === 'admissionNo' && !f.disabled && !f.disabledAll)
    );
  } else if (branding?.studentFields && Array.isArray(branding.studentFields)) {
    const admField = branding.studentFields.find(f => f.id === 'admissionNo');
    if (!admField || admField.disabled === true || admField.disabledAll === true) {
      admissionFieldEnabled = false;
    }
  }
  const isAdmissionNoDisabled = !admissionFieldEnabled;

  const rollNoDobEnabled = cfg?.rollNoDobEnabled !== undefined ? cfg.rollNoDobEnabled : true;
  
  // If school disabled admission number in studentFields, auto-disable admission-based logins unless explicitly forced
  const admissionNoDobEnabled = cfg?.admissionNoDobEnabled !== undefined
    ? (cfg.admissionNoDobEnabled && !isAdmissionNoDisabled)
    : (!isAdmissionNoDisabled);

  const mobileRollNoEnabled = cfg?.mobileRollNoEnabled === true;
  const mobileAdmissionNoEnabled = cfg?.mobileAdmissionNoEnabled === true && (!isAdmissionNoDisabled);

  // Collect available methods in clean priority order
  const availableMethods: ParentLoginMethod[] = [];
  if (rollNoDobEnabled) availableMethods.push('roll_dob');
  if (admissionNoDobEnabled) availableMethods.push('adm_dob');
  if (mobileRollNoEnabled) availableMethods.push('mob_roll');
  if (mobileAdmissionNoEnabled) availableMethods.push('mob_adm');

  // Fallback: If all options were disabled by mistake, ensure at least roll_dob is enabled
  if (availableMethods.length === 0) {
    availableMethods.push('roll_dob');
  }

  const primaryMethod = cfg?.defaultLoginMode && availableMethods.includes(cfg.defaultLoginMode)
    ? cfg.defaultLoginMode
    : availableMethods[0];

  return {
    rollNoDobEnabled: availableMethods.includes('roll_dob'),
    admissionNoDobEnabled: availableMethods.includes('adm_dob'),
    mobileRollNoEnabled: availableMethods.includes('mob_roll'),
    mobileAdmissionNoEnabled: availableMethods.includes('mob_adm'),
    activeCount: availableMethods.length,
    availableMethods,
    primaryMethod,
    defaultLoginMode: primaryMethod,
    admissionFieldEnabled
  };
}

/**
 * Normalizes phone/mobile numbers by stripping +91, 0 prefix, spaces, dashes.
 * Retains the canonical 10-digit number.
 */
export function normalizeMobileNumber(raw?: string): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length > 10) {
    return digits.slice(-10);
  }
  return digits;
}

/**
 * Compares two mobile numbers for equivalence.
 */
export function mobilesMatch(phoneA?: string, phoneB?: string): boolean {
  const normA = normalizeMobileNumber(phoneA);
  const normB = normalizeMobileNumber(phoneB);
  if (!normA || !normB) return false;
  return normA === normB;
}

/**
 * Compares two date of birth strings across formats:
 * Supports DD-MM-YYYY, YYYY-MM-DD, DD/MM/YYYY, etc.
 */
export function dobsMatch(dobA?: string, dobB?: string): boolean {
  if (!dobA || !dobB) return false;
  const cleanA = dobA.trim().replace(/[-\/]/g, '-');
  const cleanB = dobB.trim().replace(/[-\/]/g, '-');
  if (cleanA.toLowerCase() === cleanB.toLowerCase()) return true;

  const parseParts = (dStr: string) => {
    const parts = dStr.split('-');
    if (parts.length !== 3) return null;
    const num0 = parseInt(parts[0], 10);
    const num1 = parseInt(parts[1], 10);
    const num2 = parseInt(parts[2], 10);
    if (isNaN(num0) || isNaN(num1) || isNaN(num2)) return null;
    
    // Check if YYYY-MM-DD
    if (num0 > 1000) {
      return { y: num0, m: num1, d: num2 };
    }
    // Check if DD-MM-YYYY
    if (num2 > 1000) {
      return { y: num2, m: num1, d: num0 };
    }
    return null;
  };

  const parsedA = parseParts(cleanA);
  const parsedB = parseParts(cleanB);
  if (parsedA && parsedB) {
    return parsedA.y === parsedB.y && parsedA.m === parsedB.m && parsedA.d === parsedB.d;
  }

  return false;
}

/**
 * Normalizes roll number for tolerant numeric & alphanumeric comparison.
 */
export function normalizeRollNo(val?: string): string {
  if (!val) return '';
  const trimmed = val.trim().toLowerCase();
  const parsedNum = parseInt(trimmed, 10);
  if (!isNaN(parsedNum) && parsedNum.toString() === trimmed) {
    return parsedNum.toString();
  }
  return trimmed;
}

/**
 * Normalizes admission number for comparison.
 */
export function normalizeAdmissionNo(val?: string): string {
  if (!val) return '';
  return val.trim().toLowerCase();
}

/**
 * Executes multi-option student matching for Parent Portal logins.
 * Returns all matching students (useful for sibling detection).
 */
export function findMatchingStudents(
  students: Student[],
  mode: ParentLoginMethod,
  inputs: {
    rollNo?: string;
    admissionNo?: string;
    mobile?: string;
    mobileNumber?: string;
    dob?: string;
    className?: string;
  }
): Student[] {
  const { rollNo, admissionNo, dob, className } = inputs;
  const mobile = inputs.mobileNumber || inputs.mobile;

  return students.filter(student => {
    // Optional class filter if provided
    if (className && className !== 'all') {
      if (student.className.toLowerCase().trim() !== className.toLowerCase().trim()) {
        return false;
      }
    }

    switch (mode) {
      case 'roll_dob': {
        const rollMatch = normalizeRollNo(student.rollNo) === normalizeRollNo(rollNo);
        const dobMatch = dobsMatch(student.dob, dob);
        return rollMatch && dobMatch;
      }

      case 'adm_dob': {
        const admMatch = normalizeAdmissionNo(student.admissionNo) === normalizeAdmissionNo(admissionNo);
        const dobMatch = dobsMatch(student.dob, dob);
        return admMatch && dobMatch;
      }

      case 'mob_roll': {
        const mobMatch = mobilesMatch(student.mobileNumber, mobile);
        const rollMatch = normalizeRollNo(student.rollNo) === normalizeRollNo(rollNo);
        return mobMatch && rollMatch;
      }

      case 'mob_adm': {
        const mobMatch = mobilesMatch(student.mobileNumber, mobile);
        const admMatch = normalizeAdmissionNo(student.admissionNo) === normalizeAdmissionNo(admissionNo);
        return mobMatch && admMatch;
      }

      default:
        return false;
    }
  });
}
