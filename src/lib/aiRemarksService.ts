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
 * Validates a Gemini API Key via backend validation route with direct fallback
 */
export async function validateGeminiApiKey(key: string): Promise<{ valid: boolean; message: string }> {
  const cleanKey = key ? key.trim() : '';
  if (!cleanKey || cleanKey.length < 10) {
    return { valid: false, message: 'Please enter a valid Gemini API key.' };
  }

  // 1. Try backend API validation route if available
  try {
    const res = await fetch('/api/generate-ai-remarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'validate_key', apiKey: cleanKey })
    });

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        return { valid: true, message: data.message || '✨ Gemini API Key verified! Unlimited generations enabled.' };
      }
      if (data?.error && !data.error.includes('HTTP 404')) {
        return { valid: false, message: data.error };
      }
    }
  } catch (err) {
    console.warn('[validateGeminiApiKey] Backend route check warning:', err);
  }

  // 2. Direct fallback validation against Google Gemini REST API
  try {
    const googleRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });

    if (googleRes.ok) {
      return { valid: true, message: '✨ Gemini API Key verified! Unlimited generations enabled.' };
    }

    const errData = await googleRes.json().catch(() => ({}));
    const errMsg = errData?.error?.message || `API key validation failed (HTTP ${googleRes.status}). Please check your key.`;
    return { valid: false, message: errMsg };
  } catch (directErr: any) {
    return { valid: false, message: directErr?.message || 'Network error while reaching Google AI Studio.' };
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

async function callDirectGeminiApi(apiKey: string, promptText: string): Promise<string> {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 250
        }
      })
    });
    if (!res.ok) return '';
    const data = await res.json().catch(() => ({}));
    return (data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
  } catch {
    return '';
  }
}

function buildClientPrompt(student: any, params: GenerateRemarkParams): string {
  const name = student.name || 'Student';
  const pct = student.percentage ?? 75;
  const grade = student.grade || 'B';
  const tone = params.tone || 'encouraging';
  const focus = params.focusArea || 'all_round';
  const strong = (student.strongSubjects || []).join(', ') || 'General Subjects';
  const weak = (student.weakSubjects || []).join(', ');

  let prompt = `Write a constructive, professional 2-3 sentence report card remark for a student named "${name}".\n`;
  prompt += `Academic Percentage: ${pct}%, Overall Grade: ${grade}.\n`;
  prompt += `Strong Area: ${strong}.\n`;
  if (weak) prompt += `Area needing improvement: ${weak}.\n`;
  prompt += `Tone: ${tone}, Focus Area: ${focus}.\n`;
  if (params.customPrompt) prompt += `Teacher Note: ${params.customPrompt}\n`;
  prompt += `Instructions: Do NOT use negative or demoralizing words. Keep it motivating, realistic, and positive for school report cards. Return ONLY the plain text remark string with no JSON formatting or quotes.`;
  return prompt;
}

/**
 * Call server AI API to generate remarks for a single student with fallback to direct Gemini API.
 */
export async function generateAiRemarkForStudent(params: GenerateRemarkParams): Promise<SingleRemarkResult> {
  const customKey = params.apiKey || getStoredGeminiApiKey();

  // Try backend route first
  try {
    const response = await fetch('/api/generate-ai-remarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        apiKey: customKey || undefined,
        isBulk: false,
      }),
    });

    const contentType = response.headers.get('content-type') || '';
    if (response.ok && contentType.includes('application/json')) {
      const data = await response.json();
      return data;
    }
  } catch (err) {
    console.warn('[generateAiRemarkForStudent] Server route unavailable, trying direct API call:', err);
  }

  // Fallback to direct Gemini API call
  if (customKey) {
    const student = params.student || { name: 'Student' };
    const prompt = buildClientPrompt(student, params);
    const text = await callDirectGeminiApi(customKey, prompt);
    const remark = text || `${student.name || 'The student'} demonstrates a commendable commitment to learning, consistent classroom participation, and steady academic effort.`;
    return {
      success: true,
      isAiPowered: true,
      remarks: remark,
      options: [
        remark,
        `${student.name || 'The student'} exhibits strong academic dedication, maintaining positive discipline and active classroom involvement.`,
        `Shows consistent performance across subject areas with a constructive attitude towards educational progress.`
      ],
      promotionStatus: (student.percentage ?? 75) >= 33 ? 'Promoted to Next Higher Class' : 'Eligible for Re-Assessment'
    };
  }

  throw new Error('AI remark server unavailable. Please connect your Gemini API Key in settings.');
}

/**
 * Call server AI API to generate remarks for a batch / section of students with fallback to direct Gemini API.
 */
export async function generateAiRemarksBatch(params: GenerateRemarkParams): Promise<BulkRemarkResult> {
  const customKey = params.apiKey || getStoredGeminiApiKey();

  // Try backend route first
  try {
    const response = await fetch('/api/generate-ai-remarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...params,
        apiKey: customKey || undefined,
        isBulk: true,
      }),
    });

    const contentType = response.headers.get('content-type') || '';
    if (response.ok && contentType.includes('application/json')) {
      const data = await response.json();
      return data;
    }
  } catch (err) {
    console.warn('[generateAiRemarksBatch] Server route unavailable, trying direct API calls:', err);
  }

  // Fallback to direct Gemini API call
  if (customKey && Array.isArray(params.students)) {
    const results: BulkRemarkResultItem[] = [];
    for (const st of params.students) {
      const prompt = buildClientPrompt(st, params);
      const text = await callDirectGeminiApi(customKey, prompt);
      const remark = text || `${st.name || 'The student'} shows commendable academic effort, active participation, and positive progress.`;
      results.push({
        studentId: st.id || st.studentId || '',
        studentName: st.name || '',
        remarks: remark,
        promotionStatus: (st.percentage ?? 75) >= 33 ? 'Promoted to Next Higher Class' : 'Eligible for Re-Assessment'
      });
    }
    return {
      success: true,
      isAiPowered: true,
      results
    };
  }

  throw new Error('AI remark server unavailable. Please connect your Gemini API Key in settings.');
}
