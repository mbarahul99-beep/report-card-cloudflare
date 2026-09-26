import { Student, StudentGrades, SubjectColumn, ScoreColumn, GradeScale, CoGradeScale } from '../types';

export interface StudentAcademicSummary {
  id?: string;
  name: string;
  className?: string;
  section?: string;
  rollNo?: string;
  admissionNo?: string;
  totalMarks?: number;
  maxMarks?: number;
  percentage?: number;
  grade?: string;
  attendance?: string;
  strongSubjects?: string[];
  weakSubjects?: string[];
  subjectsSummary?: { name: string; marks: number; maxMarks: number; grade?: string }[];
  coScholasticSummary?: { name: string; grade: string }[];
  existingRemarks?: string;
}

export interface GenerateRemarkParams {
  apiKey?: string;
  student?: StudentAcademicSummary;
  students?: StudentAcademicSummary[];
  isBulk?: boolean;
  tone?: 'encouraging' | 'formal' | 'warm' | 'improvement' | 'holistic' | 'concise';
  length?: 'short' | 'medium' | 'detailed';
  focusArea?: 'all_round' | 'academic' | 'effort' | 'behavior_social' | 'strengths_weaknesses';
  customPrompt?: string;
  schoolName?: string;
}

export interface SingleRemarkResult {
  success: boolean;
  isAiPowered?: boolean;
  remarks: string;
  options: string[];
  promotionStatus?: string;
  notice?: string;
  error?: string;
}

export interface BulkRemarkResultItem {
  studentId: string;
  studentName: string;
  remarks: string;
  promotionStatus?: string;
}

export interface BulkRemarkResult {
  success: boolean;
  isAiPowered?: boolean;
  results: BulkRemarkResultItem[];
  notice?: string;
  error?: string;
}

// ----------------------------------------------------
// Section Generation Quota & API Key Management
// ----------------------------------------------------
export const SECTION_MAX_FREE_GENERATIONS = 2;
const CUSTOM_GEMINI_KEY_STORAGE = 'class_on_custom_gemini_api_key';
const SECTION_QUOTA_STORAGE = 'class_on_section_remarks_quota_records';

/**
 * Retrieve user's custom Gemini API key from local persistence
 */
export function getStoredGeminiApiKey(): string {
  try {
    return localStorage.getItem(CUSTOM_GEMINI_KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

/**
 * Save user's custom Gemini API key
 */
export function setStoredGeminiApiKey(key: string): void {
  try {
    if (!key || key.trim() === '') {
      localStorage.removeItem(CUSTOM_GEMINI_KEY_STORAGE);
    } else {
      localStorage.setItem(CUSTOM_GEMINI_KEY_STORAGE, key.trim());
    }
  } catch (e) {
    console.error('Failed to save custom Gemini key:', e);
  }
}

/**
 * Remove user's custom Gemini API key
 */
export function clearStoredGeminiApiKey(): void {
  try {
    localStorage.removeItem(CUSTOM_GEMINI_KEY_STORAGE);
  } catch (e) {
    console.error('Failed to clear custom Gemini key:', e);
  }
}

/**
 * Validates a Gemini API Key via backend validation route
 */
export async function validateGeminiApiKey(key: string): Promise<{ valid: boolean; message: string }> {
  if (!key || key.trim().length < 10) {
    return { valid: false, message: 'Please enter a valid Gemini API key.' };
  }
  try {
    const res = await fetch('/api/generate-ai-remarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'validate_key', apiKey: key.trim() })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return { valid: true, message: data.message || 'Key is valid and active!' };
    } else {
      return { valid: false, message: data.error || 'Failed to validate API key.' };
    }
  } catch (err: any) {
    return { valid: false, message: err?.message || 'Network error during validation.' };
  }
}

function getQuotaStore(): Record<string, number> {
  try {
    const raw = localStorage.getItem(SECTION_QUOTA_STORAGE);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveQuotaStore(store: Record<string, number>): void {
  try {
    localStorage.setItem(SECTION_QUOTA_STORAGE, JSON.stringify(store));
  } catch (e) {
    console.error('Failed to save section quota records:', e);
  }
}

function buildSectionKey(schoolId: string, className: string, section: string, session?: string): string {
  const s = (session || 'current').trim().toLowerCase();
  const c = (className || 'default').trim().toLowerCase().replace(/\s+/g, '_');
  const sec = (section || 'all').trim().toLowerCase();
  const sch = (schoolId || 'main').trim().toLowerCase();
  return `${sch}__${s}__${c}__${sec}`;
}

/**
 * Get how many times remarks have been generated/regenerated for a section
 */
export function getSectionGenerationCount(schoolId: string, className: string, section: string, session?: string): number {
  const store = getQuotaStore();
  const key = buildSectionKey(schoolId, className, section, session);
  return store[key] || 0;
}

/**
 * Increment the section generation counter
 */
export function incrementSectionGenerationCount(schoolId: string, className: string, section: string, session?: string): number {
  const store = getQuotaStore();
  const key = buildSectionKey(schoolId, className, section, session);
  const current = store[key] || 0;
  const updated = current + 1;
  store[key] = updated;
  saveQuotaStore(store);
  return updated;
}

/**
 * Check if the section can generate/regenerate remarks
 */
export function canGenerateForSection(schoolId: string, className: string, section: string, session?: string): {
  allowed: boolean;
  count: number;
  max: number;
  hasCustomKey: boolean;
  remaining: number;
} {
  const customKey = getStoredGeminiApiKey();
  const hasCustomKey = Boolean(customKey && customKey.trim().length > 10);
  const count = getSectionGenerationCount(schoolId, className, section, session);
  
  if (hasCustomKey) {
    return {
      allowed: true,
      count,
      max: Infinity,
      hasCustomKey: true,
      remaining: Infinity
    };
  }

  const remaining = Math.max(0, SECTION_MAX_FREE_GENERATIONS - count);
  const allowed = count < SECTION_MAX_FREE_GENERATIONS;

  return {
    allowed,
    count,
    max: SECTION_MAX_FREE_GENERATIONS,
    hasCustomKey: false,
    remaining
  };
}

/**
 * Reset quota for a specific section (e.g. for testing or admin override)
 */
export function resetSectionGenerationCount(schoolId: string, className: string, section: string, session?: string): void {
  const store = getQuotaStore();
  const key = buildSectionKey(schoolId, className, section, session);
  delete store[key];
  saveQuotaStore(store);
}

// ----------------------------------------------------
// Academic Summary Computation
// ----------------------------------------------------
export function extractStudentAcademicProfile(
  student: Student,
  grades?: StudentGrades,
  subjects: SubjectColumn[] = [],
  scoreColumns: ScoreColumn[] = [],
  gradeScales: GradeScale[] = [],
  term1Active: boolean = true,
  term2Active: boolean = true,
  term3Active: boolean = false
): StudentAcademicSummary {
  let totalObtained = 0;
  let totalMax = 0;
  const subjectsSummary: { name: string; marks: number; maxMarks: number; grade?: string; pct: number }[] = [];

  if (grades && grades.scholastic) {
    subjects.forEach((subj) => {
      const subjectGrades = grades.scholastic[subj.id];
      if (!subjectGrades) return;

      let subjectTotal = 0;
      let subjectMax = 0;

      // Term 1
      if (term1Active && subjectGrades.term1) {
        scoreColumns.forEach((col) => {
          const m = Number(subjectGrades.term1[col.id]) || 0;
          const max = Number(col.maxMarks) || 100;
          subjectTotal += m;
          subjectMax += max;
        });
      }

      // Term 2
      if (term2Active && subjectGrades.term2) {
        scoreColumns.forEach((col) => {
          const m = Number(subjectGrades.term2[col.id]) || 0;
          const max = Number(col.maxMarks) || 100;
          subjectTotal += m;
          subjectMax += max;
        });
      }

      // Term 3
      if (term3Active && subjectGrades.term3) {
        scoreColumns.forEach((col) => {
          const m = Number(subjectGrades.term3?.[col.id]) || 0;
          const max = Number(col.maxMarks) || 100;
          subjectTotal += m;
          subjectMax += max;
        });
      }

      if (subjectMax > 0) {
        const pct = (subjectTotal / subjectMax) * 100;
        totalObtained += subjectTotal;
        totalMax += subjectMax;
        
        // Find letter grade
        let letterGrade = 'B';
        const matched = gradeScales.find(gs => pct >= (gs.minPercent ?? 0) && pct <= (gs.maxPercent ?? 100));
        if (matched) letterGrade = matched.grade;

        subjectsSummary.push({
          name: subj.name,
          marks: Math.round(subjectTotal),
          maxMarks: Math.round(subjectMax),
          grade: letterGrade,
          pct
        });
      }
    });
  }

  // Calculate percentage and overall grade
  const overallPercentage = totalMax > 0 ? parseFloat(((totalObtained / totalMax) * 100).toFixed(1)) : 75;
  let overallGrade = 'B+';
  const matchedGrade = gradeScales.find(gs => overallPercentage >= (gs.minPercent ?? 0) && overallPercentage <= (gs.maxPercent ?? 100));
  if (matchedGrade) {
    overallGrade = matchedGrade.grade;
  } else {
    if (overallPercentage >= 90) overallGrade = 'A+';
    else if (overallPercentage >= 80) overallGrade = 'A';
    else if (overallPercentage >= 70) overallGrade = 'B+';
    else if (overallPercentage >= 60) overallGrade = 'B';
    else if (overallPercentage >= 50) overallGrade = 'C';
    else if (overallPercentage >= 40) overallGrade = 'D';
    else overallGrade = 'E';
  }

  // Identify strong & growth subjects
  const sortedSubjects = [...subjectsSummary].sort((a, b) => b.pct - a.pct);
  const strongSubjects = sortedSubjects.filter(s => s.pct >= 70).map(s => s.name).slice(0, 2);
  const weakSubjects = sortedSubjects.filter(s => s.pct < 60).map(s => s.name).slice(0, 2);

  // Extract attendance string
  let attendanceStr = '';
  if (grades?.attendance) {
    if (typeof grades.attendance.term1 === 'string' && grades.attendance.term1) {
      attendanceStr = grades.attendance.term1;
    } else if (typeof grades.attendance.term2 === 'string' && grades.attendance.term2) {
      attendanceStr = grades.attendance.term2;
    }
  }

  // Extract co-scholastic summary
  const coScholasticSummary: { name: string; grade: string }[] = [];
  if (grades?.co_scholastic) {
    Object.entries(grades.co_scholastic).forEach(([key, val]) => {
      const g = val?.term1 || val?.term2 || 'A';
      if (g) coScholasticSummary.push({ name: key, grade: g });
    });
  }

  return {
    id: student.id,
    name: student.name,
    className: student.className,
    section: student.section,
    rollNo: student.rollNo,
    admissionNo: student.admissionNo,
    totalMarks: Math.round(totalObtained),
    maxMarks: Math.round(totalMax),
    percentage: overallPercentage,
    grade: overallGrade,
    attendance: attendanceStr,
    strongSubjects: strongSubjects.length > 0 ? strongSubjects : ['Core Academics'],
    weakSubjects,
    subjectsSummary: subjectsSummary.map(s => ({ name: s.name, marks: s.marks, maxMarks: s.maxMarks, grade: s.grade })),
    coScholasticSummary,
    existingRemarks: student.remarks
  };
}

/**
 * Call server AI API to generate remarks for a single student.
 */
export async function generateAiRemarkForStudent(params: GenerateRemarkParams): Promise<SingleRemarkResult> {
  try {
    const customKey = params.apiKey || getStoredGeminiApiKey();
    const response = await fetch('/api/generate-ai-remarks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...params,
        apiKey: customKey || undefined,
        isBulk: false,
      }),
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      throw new Error(errorJson.error || `Server responded with status ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (err: any) {
    console.error('Failed to generate AI remark for student:', err);
    throw err;
  }
}

/**
 * Call server AI API to generate remarks for a batch / section of students.
 */
export async function generateAiRemarksBatch(params: GenerateRemarkParams): Promise<BulkRemarkResult> {
  try {
    const customKey = params.apiKey || getStoredGeminiApiKey();
    const response = await fetch('/api/generate-ai-remarks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...params,
        apiKey: customKey || undefined,
        isBulk: true,
      }),
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      throw new Error(errorJson.error || `Server responded with status ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (err: any) {
    console.error('Failed to generate AI remarks batch:', err);
    throw err;
  }
}
