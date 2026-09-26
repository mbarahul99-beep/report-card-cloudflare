/**
 * Centralized student data formatters to ensure consistent presentation across:
 * - Report Cards (HTML & PDF)
 * - Student Manager & Fast List Entry Grid
 * - Student Profile Cards & Modals
 * - Classwise Master Reports & Analytics
 */

/**
 * Ensures Father Name is always prefixed with "Mr. " automatically
 * unless a standard title (Mr, Shri, Late, Dr, Prof) already exists.
 */
export function formatFatherName(name?: string | null): string {
  if (!name || !name.trim()) return '';
  const trimmed = name.trim();
  
  // If already prefixed with any recognized title
  if (/^(mr\.?|shri|late|dr\.?|prof\.?)\s+/i.test(trimmed)) {
    // Normalize "mr" or "mr." to standard "Mr. "
    if (/^mr\.?\s+/i.test(trimmed)) {
      const rest = trimmed.replace(/^mr\.?\s+/i, '').trim();
      return rest ? `Mr. ${rest}` : 'Mr.';
    }
    return trimmed;
  }
  
  return `Mr. ${trimmed}`;
}

/**
 * Ensures Mother Name is always prefixed with "Mrs. " automatically
 * unless a standard title (Mrs, Smt, Ms, Late, Dr, Prof) already exists.
 */
export function formatMotherName(name?: string | null): string {
  if (!name || !name.trim()) return '';
  const trimmed = name.trim();
  
  // If already prefixed with any recognized title
  if (/^(mrs\.?|smt\.?|ms\.?|late|dr\.?|prof\.?)\s+/i.test(trimmed)) {
    // Normalize "mrs" or "mrs." to standard "Mrs. "
    if (/^mrs\.?\s+/i.test(trimmed)) {
      const rest = trimmed.replace(/^mrs\.?\s+/i, '').trim();
      return rest ? `Mrs. ${rest}` : 'Mrs.';
    }
    return trimmed;
  }
  
  return `Mrs. ${trimmed}`;
}

/**
 * Ensures Height is always displayed with the unit "CM" (centimeter) by default.
 * Handles inputs like "120", "120 cm", "120cm", "120 CM", "120 C.M." -> "120 CM"
 */
export function formatHeight(val?: string | number | null): string {
  if (val === undefined || val === null) return '';
  const str = String(val).trim();
  if (!str) return '';
  
  // Strip existing cm/CM variations
  const numericPart = str.replace(/\s*(cm|c\.m\.|centimeter|centimeters)\s*$/i, '').trim();
  return numericPart ? `${numericPart} CM` : str;
}

/**
 * Ensures Weight is always displayed with the unit "KG" by default.
 * Handles inputs like "40", "40 kg", "40kg", "40 KG", "40 K.G." -> "40 KG"
 */
export function formatWeight(val?: string | number | null): string {
  if (val === undefined || val === null) return '';
  const str = String(val).trim();
  if (!str) return '';
  
  // Strip existing kg/KG variations
  const numericPart = str.replace(/\s*(kg|k\.g\.|kilogram|kilograms)\s*$/i, '').trim();
  return numericPart ? `${numericPart} KG` : str;
}

/**
 * Ensures Class Name is displayed cleanly without redundant "Class" or "Grade" prefixes,
 * since the report card / UI field label is already "Class".
 * Handles:
 * - "Class III" -> "III"
 * - "CLASS III" -> "III"
 * - "Class: III" -> "III"
 * - "Class-III" -> "III"
 * - "Grade 3" -> "3"
 * - "Std. 10" -> "10"
 * - "Class 3rd" -> "3rd"
 * - "III" -> "III"
 */
export function formatClassName(val?: string | null): string {
  if (!val || !val.trim()) return '';
  let trimmed = val.trim();
  // Strip repeated prefixes e.g. "Class Class III" or "Class : III"
  while (/^(class|grade|std\.?|standard)\s*[:\-]?\s*/i.test(trimmed)) {
    const next = trimmed.replace(/^(class|grade|std\.?|standard)\s*[:\-]?\s*/i, '').trim();
    if (!next || next.toLowerCase() === trimmed.toLowerCase()) break;
    trimmed = next;
  }
  return trimmed || val.trim();
}

/**
 * Automatically formats a student profile field for display or export
 */
export function formatStudentFieldValue(fieldId: string, val: any): string {
  if (val === undefined || val === null) return '';
  const str = String(val);
  
  switch (fieldId) {
    case 'fatherName':
      return formatFatherName(str);
    case 'motherName':
      return formatMotherName(str);
    case 'height':
      return formatHeight(str);
    case 'weight':
      return formatWeight(str);
    case 'className':
    case 'class':
      return formatClassName(str);
    default:
      return str;
  }
}

/**
 * Returns a student object clone where fatherName, motherName, height, weight, and className
 * are properly formatted according to school standards.
 */
export function formatStudentForDisplay<T extends Record<string, any>>(student: T): T {
  if (!student) return student;
  return {
    ...student,
    fatherName: student.fatherName ? formatFatherName(student.fatherName) : student.fatherName,
    motherName: student.motherName ? formatMotherName(student.motherName) : student.motherName,
    className: student.className ? formatClassName(student.className) : student.className,
    height: student.height ? formatHeight(student.height) : (student.height === '' ? '' : formatHeight(student.height || '120 CM')),
    weight: student.weight ? formatWeight(student.weight) : (student.weight === '' ? '' : formatWeight(student.weight || '40 KG')),
  };
}
