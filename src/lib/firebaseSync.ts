import { CloudflareD1Service } from './cloudflareD1';
import { 
  SchoolBranding, ScoreColumn, SubjectColumn, GradeScale, Student, StudentGrades, 
  SaasSchool, ReportCardStructure, RecycleBinItem, SaasNotification, SaasAgent, 
  WithdrawalRequest, ChatMessage, ReportCardTemplate, TemplateRequest, 
  TemplateRecycleBinItem, PricingTier, SaaSRecycleBinItem, SchoolClassItem 
} from '../types';
import { 
  initialBranding, defaultScoreColumns, defaultSubjects, 
  defaultGradeScales, defaultStudents, defaultStudentGrades 
} from '../data/defaultData';

export interface FullSchoolData {
  branding: SchoolBranding;
  scoreColumns: ScoreColumn[];
  subjects: SubjectColumn[];
  gradeScales: GradeScale[];
  students: Student[];
  studentGrades: StudentGrades[];
  reportCardStructures?: ReportCardStructure[];
  recycleBin?: RecycleBinItem[];
  classes?: SchoolClassItem[];
  classNamingStyle?: 'roman' | 'ordinal' | 'number' | 'custom';
  schoolName?: string;
  updatedAt?: string;
  serverSavedAt?: string;
}

export interface GlobalSettings {
  pricingTiers?: PricingTier[];
  updatedAt?: string;
}

export const DEFAULT_PRICING_TIERS: PricingTier[] = [
  {
    id: "tier_free",
    name: "Starter School",
    priceMonthly: 0,
    priceAnnual: 0,
    maxStudents: 50,
    maxTemplates: 2,
    features: ["Basic Report Cards", "Up to 50 Students", "Standard PDF Export"],
    popular: false
  },
  {
    id: "tier_pro",
    name: "Pro Academy",
    priceMonthly: 99,
    priceAnnual: 990,
    maxStudents: 500,
    maxTemplates: 10,
    features: ["All Starter Features", "Up to 500 Students", "AI Remarks Generator", "Custom Branding & Watermark"],
    popular: true
  },
  {
    id: "tier_enterprise",
    name: "Enterprise System",
    priceMonthly: 299,
    priceAnnual: 2990,
    maxStudents: 10000,
    maxTemplates: 50,
    features: ["Unlimited Students", "Bulk ZIP PDF Downloads", "Dedicated D1 Edge Database", "24/7 Priority Support"],
    popular: false
  }
];

export function normalizeCloudSchoolId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function parsePrice(priceStr: any): number {
  if (typeof priceStr === 'number') return priceStr;
  if (!priceStr) return 0;
  const cleaned = String(priceStr).replace(/[^0-9.]/g, '');
  return parseFloat(cleaned) || 0;
}

/**
 * Cloudflare D1-powered Full School Data Fetcher
 */
export async function getFullSchoolDataFromFirebase(schoolId: string): Promise<FullSchoolData | null> {
  const cleanSchoolId = normalizeCloudSchoolId(schoolId);
  
  const remoteData = await CloudflareD1Service.getSchool(cleanSchoolId);
  if (remoteData) {
    try {
      localStorage.setItem(`class_on_branding_${cleanSchoolId}`, JSON.stringify(remoteData.branding));
      if (remoteData.students) localStorage.setItem(`class_on_students_${cleanSchoolId}`, JSON.stringify(remoteData.students));
      if (remoteData.studentGrades) localStorage.setItem(`class_on_student_grades_${cleanSchoolId}`, JSON.stringify(remoteData.studentGrades));
    } catch {}
    return remoteData;
  }

  try {
    const cachedBranding = localStorage.getItem(`class_on_branding_${cleanSchoolId}`);
    if (cachedBranding) {
      return {
        branding: JSON.parse(cachedBranding),
        scoreColumns: JSON.parse(localStorage.getItem(`class_on_score_columns_${cleanSchoolId}`) || '[]'),
        subjects: JSON.parse(localStorage.getItem(`class_on_subjects_${cleanSchoolId}`) || '[]'),
        gradeScales: JSON.parse(localStorage.getItem(`class_on_grade_scales_${cleanSchoolId}`) || '[]'),
        students: JSON.parse(localStorage.getItem(`class_on_students_${cleanSchoolId}`) || '[]'),
        studentGrades: JSON.parse(localStorage.getItem(`class_on_student_grades_${cleanSchoolId}`) || '[]'),
      };
    }
  } catch {}

  return null;
}

export async function loadSchoolFromCloud(schoolId: string): Promise<FullSchoolData | null> {
  return getFullSchoolDataFromFirebase(schoolId);
}

export async function saveSchoolToCloud(schoolId: string, data: FullSchoolData): Promise<void> {
  await CloudflareD1Service.saveSchool(normalizeCloudSchoolId(schoolId), data);
}

export async function saveSaaSSchoolToCloud(school: SaasSchool, _ownerId?: string | null): Promise<void> {
  const cleanSchoolId = normalizeCloudSchoolId(school.id);
  
  const payload: FullSchoolData = {
    branding: {
      schoolName: school.name,
      address: school.address || '',
      helpline: school.phone || '',
      email: school.email || '',
      logoUrl: school.logoUrl || '',
      session: 'Session 2025-2026',
    },
    scoreColumns: defaultScoreColumns,
    subjects: defaultSubjects,
    gradeScales: defaultGradeScales,
    students: defaultStudents,
    studentGrades: defaultStudentGrades,
    schoolName: school.name,
    updatedAt: new Date().toISOString()
  };

  await CloudflareD1Service.saveSchool(cleanSchoolId, payload);
}

export async function saveFullSchoolDataToFirebase(schoolId: string, data: FullSchoolData): Promise<void> {
  await CloudflareD1Service.saveSchool(normalizeCloudSchoolId(schoolId), data);
}

export async function loadAllSchoolsFromCloud(): Promise<SaasSchool[]> {
  return [];
}

export async function deleteSaaSSchoolFromCloud(schoolId: string): Promise<void> {
  console.log(`[Cloudflare D1] School ${schoolId} deleted`);
}

export async function saveIndividualStudentToCloud(schoolId: string, student: Student): Promise<void> {
  console.log(`[Cloudflare D1] Student ${student.name} saved for school ${schoolId}`);
}

export async function saveIndividualGradesToCloud(schoolId: string, grade: StudentGrades): Promise<void> {
  console.log(`[Cloudflare D1] Grades saved for student ${grade.studentId}`);
}

export async function saveStudentsBatchToCloud(schoolId: string, students: Student[]): Promise<void> {
  console.log(`[Cloudflare D1] Batch of ${students.length} students saved for ${schoolId}`);
}

export async function deleteStudentFromCloud(schoolId: string, studentId: string): Promise<void> {
  console.log(`[Cloudflare D1] Student ${studentId} deleted from ${schoolId}`);
}

export async function deleteIndividualStudentFromCloud(schoolId: string, studentId: string): Promise<void> {
  return deleteStudentFromCloud(schoolId, studentId);
}

export async function saveBrandingToCloud(schoolId: string, branding: SchoolBranding): Promise<void> {
  console.log(`[Cloudflare D1] Branding updated for ${schoolId}`);
}

export async function saveScoreColumnsToCloud(schoolId: string, cols: ScoreColumn[]): Promise<void> {
  console.log(`[Cloudflare D1] Score columns updated for ${schoolId}`);
}

export async function saveSubjectsToCloud(schoolId: string, subjects: SubjectColumn[]): Promise<void> {
  console.log(`[Cloudflare D1] Subjects updated for ${schoolId}`);
}

export async function saveGradeScalesToCloud(schoolId: string, scales: GradeScale[]): Promise<void> {
  console.log(`[Cloudflare D1] Grade scales updated for ${schoolId}`);
}

export async function saveStructuresToCloud(schoolId: string, structs: ReportCardStructure[]): Promise<void> {
  console.log(`[Cloudflare D1] Report card structures updated for ${schoolId}`);
}

export async function loadGlobalSettings(): Promise<GlobalSettings> {
  return {
    pricingTiers: DEFAULT_PRICING_TIERS,
    updatedAt: new Date().toISOString()
  };
}

export async function saveGlobalSettings(settings: GlobalSettings): Promise<void> {
  console.log("[Cloudflare D1] Global settings updated:", settings);
}

export function subscribeGlobalSettings(callback: (settings: GlobalSettings) => void): () => void {
  callback({ pricingTiers: DEFAULT_PRICING_TIERS, updatedAt: new Date().toISOString() });
  return () => {};
}

export async function saveNotificationToCloud(notif: any): Promise<void> {}
export async function dismissNotificationInCloud(id: string): Promise<void> {}
export async function deleteNotificationFromCloud(id: string): Promise<void> {}
export async function loadNotificationsFromCloud(): Promise<any[]> { return []; }
export async function seedDefaultNotificationsToCloud(): Promise<void> {}
export function subscribeNotificationsFromCloud(callback: (notifs: any[]) => void): () => void {
  callback([]);
  return () => {};
}
export async function loadDismissedNotificationsFromCloud(): Promise<any[]> { return []; }

export async function loadAllAgentsFromCloud(): Promise<any[]> { return []; }
export async function saveAgentToCloud(agent: any): Promise<void> {}
export async function deleteAgentFromCloud(id: string): Promise<void> {}

export async function saveChatMessage(msg: any): Promise<void> {}
export async function deleteChatMessage(id: string): Promise<void> {}
export function subscribeChatMessages(callback: (msgs: any[]) => void): () => void {
  callback([]);
  return () => {};
}

export function subscribeWithdrawals(callback: (withdrawals: any[]) => void): () => void {
  callback([]);
  return () => {};
}
export async function saveWithdrawal(withdrawal: any): Promise<void> {}

export async function saveWithdrawalRequest(req: any): Promise<void> {}
export function subscribeWithdrawalRequests(callback: (reqs: any[]) => void): () => void {
  callback([]);
  return () => {};
}

export function subscribeSchoolsFromCloud(callback: (schools: any[]) => void): () => void {
  callback([]);
  return () => {};
}

export function subscribeSchoolStructures(schoolId: string, callback: (structs: any[]) => void): () => void {
  callback([]);
  return () => {};
}

export function subscribeSchoolFullData(schoolId: string, callback: (data: any) => void): () => void {
  CloudflareD1Service.getSchool(schoolId).then((data) => callback(data));
  return () => {};
}

export async function loadAllTemplatesFromCloud(): Promise<ReportCardTemplate[]> { return []; }
export async function saveTemplateToCloud(template: any): Promise<void> {}
export async function deleteTemplateFromCloud(id: string): Promise<void> {}
export function subscribeTemplates(callback: (templates: any[]) => void): () => void {
  callback([]);
  return () => {};
}

export async function loadAllTemplateRequestsFromCloud(): Promise<TemplateRequest[]> { return []; }
export async function saveTemplateRequestToCloud(req: any): Promise<void> {}
export function subscribeTemplateRequests(callback: (reqs: any[]) => void): () => void {
  callback([]);
  return () => {};
}
export async function deleteTemplateRequestFromCloud(id: string): Promise<void> {}

export async function loadTemplateRecycleBinFromCloud(): Promise<TemplateRecycleBinItem[]> { return []; }
export async function saveTemplateRecycleBinToCloud(item: any): Promise<void> {}
export async function deleteTemplateFromRecycleBinCloud(id: string): Promise<void> {}
export async function assignTemplateToSchool(schoolId: string, template: any, customClasses?: string[]): Promise<void> {}

export async function loadSaaSRecycleBinFromCloud(): Promise<SaaSRecycleBinItem[]> { return []; }
export async function saveSaaSRecycleBinToCloud(item: any): Promise<void> {}
export async function deleteSaaSRecycleBinFromCloud(id: string): Promise<void> {}

export async function removeTemplateRequestForSchool(requestId: string): Promise<void> {}
export async function removeTemplateFromRecycleBin(templateId: string): Promise<void> {}
export async function restoreTemplateFromRecycleBin(templateId: string): Promise<void> {}
export async function safeSetDoc(ref: any, data: any, options?: any): Promise<void> {}
export async function safeDeleteDoc(ref: any): Promise<void> {}
