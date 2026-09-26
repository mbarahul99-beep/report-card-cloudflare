import { CloudflareD1Service } from './cloudflareD1';
import { 
  SchoolBranding, ScoreColumn, SubjectColumn, GradeScale, Student, StudentGrades, 
  SaasSchool, ReportCardStructure, RecycleBinItem, SaasNotification, SaasAgent, 
  WithdrawalRequest, ChatMessage, ReportCardTemplate, TemplateRequest, 
  TemplateRecycleBinItem, PricingTier, SaaSRecycleBinItem, SchoolClassItem,
  FullSchoolData 
} from '../types';
import { 
  initialBranding, defaultScoreColumns, defaultSubjects, 
  defaultGradeScales, defaultStudents, defaultStudentGrades 
} from '../data/defaultData';

export interface GlobalSettings {
  pricingTiers?: PricingTier[];
  presetPaymentLink?: string;
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
 * Helper to update local storage cache for full school data
 */
export function cacheSchoolDataLocally(schoolId: string, data: FullSchoolData): void {
  const cleanId = normalizeCloudSchoolId(schoolId);
  try {
    if (data.branding) localStorage.setItem(`class_on_branding_${cleanId}`, JSON.stringify(data.branding));
    if (data.scoreColumns) localStorage.setItem(`class_on_score_columns_${cleanId}`, JSON.stringify(data.scoreColumns));
    if (data.subjects) localStorage.setItem(`class_on_subjects_${cleanId}`, JSON.stringify(data.subjects));
    if (data.gradeScales) localStorage.setItem(`class_on_grade_scales_${cleanId}`, JSON.stringify(data.gradeScales));
    if (data.students) localStorage.setItem(`class_on_students_${cleanId}`, JSON.stringify(data.students));
    if (data.studentGrades) localStorage.setItem(`class_on_student_grades_${cleanId}`, JSON.stringify(data.studentGrades));
    if (data.reportCardStructures) localStorage.setItem(`class_on_structures_${cleanId}`, JSON.stringify(data.reportCardStructures));
    if (data.recycleBin) localStorage.setItem(`class_on_recycle_bin_${cleanId}`, JSON.stringify(data.recycleBin));
  } catch (err) {
    console.warn("[LocalStorage Cache Error]:", err);
  }
}

/**
 * Helper to read local storage cache for full school data
 */
export function getLocalSchoolData(schoolId: string): FullSchoolData | null {
  const cleanId = normalizeCloudSchoolId(schoolId);
  try {
    const cachedBranding = localStorage.getItem(`class_on_branding_${cleanId}`);
    if (cachedBranding) {
      return {
        branding: JSON.parse(cachedBranding),
        scoreColumns: JSON.parse(localStorage.getItem(`class_on_score_columns_${cleanId}`) || '[]'),
        subjects: JSON.parse(localStorage.getItem(`class_on_subjects_${cleanId}`) || '[]'),
        gradeScales: JSON.parse(localStorage.getItem(`class_on_grade_scales_${cleanId}`) || '[]'),
        students: JSON.parse(localStorage.getItem(`class_on_students_${cleanId}`) || '[]'),
        studentGrades: JSON.parse(localStorage.getItem(`class_on_student_grades_${cleanId}`) || '[]'),
        reportCardStructures: JSON.parse(localStorage.getItem(`class_on_structures_${cleanId}`) || '[]'),
        recycleBin: JSON.parse(localStorage.getItem(`class_on_recycle_bin_${cleanId}`) || '[]'),
      };
    }
  } catch {}
  return null;
}

/**
 * Cloudflare D1-powered Full School Data Fetcher
 */
export async function getFullSchoolDataFromFirebase(schoolId: string): Promise<FullSchoolData | null> {
  const cleanSchoolId = normalizeCloudSchoolId(schoolId);
  
  const remoteData = await CloudflareD1Service.getSchool(cleanSchoolId);
  if (remoteData) {
    cacheSchoolDataLocally(cleanSchoolId, remoteData);
    return remoteData;
  }

  return getLocalSchoolData(cleanSchoolId);
}

export async function loadSchoolFromCloud(schoolId: string): Promise<FullSchoolData | null> {
  return getFullSchoolDataFromFirebase(schoolId);
}

export async function saveSchoolToCloud(schoolId: string, data: FullSchoolData, schoolName?: string, portalCode?: string): Promise<void> {
  const cleanId = normalizeCloudSchoolId(schoolId);
  const payload: FullSchoolData = {
    ...data,
    schoolName: schoolName || data.schoolName || data.branding?.schoolName,
    portalCode: portalCode || data.portalCode,
    updatedAt: new Date().toISOString()
  };

  // Always update local storage first so offline/refresh access works immediately
  cacheSchoolDataLocally(cleanId, payload);

  // Sync to Cloudflare D1 asynchronously
  try {
    await CloudflareD1Service.saveSchool(cleanId, payload);
  } catch (err: any) {
    console.warn(`[saveSchoolToCloud] D1 sync deferred for ${cleanId}:`, err.message);
  }
}

export async function saveSaaSSchoolToCloud(school: SaasSchool, _ownerId?: string | null): Promise<void> {
  const cleanSchoolId = normalizeCloudSchoolId(school.id);
  
  // 1. Update local storage schools registry array
  try {
    const rawLocal = localStorage.getItem('class_on_saas_schools');
    let localList: SaasSchool[] = rawLocal ? JSON.parse(rawLocal) : [];
    const existingIdx = localList.findIndex(s => s.id === school.id);
    if (existingIdx >= 0) {
      localList[existingIdx] = { ...localList[existingIdx], ...school };
    } else {
      localList.push(school);
    }
    localStorage.setItem('class_on_saas_schools', JSON.stringify(localList));
  } catch (err) {
    console.warn("[saveSaaSSchoolToCloud LocalStorage Error]:", err);
  }

  // 2. Prepare payload
  const existingLocalData = getLocalSchoolData(cleanSchoolId);
  const payload: FullSchoolData & { saasMeta?: SaasSchool } = {
    branding: existingLocalData?.branding || {
      schoolName: school.name,
      address: school.address || '',
      helpline: school.mobile || '',
      email: school.email || '',
      logoUrl: school.logoUrl || '',
      session: 'Session 2025-2026',
    },
    scoreColumns: existingLocalData?.scoreColumns || defaultScoreColumns,
    subjects: existingLocalData?.subjects || defaultSubjects,
    gradeScales: existingLocalData?.gradeScales || defaultGradeScales,
    students: existingLocalData?.students || defaultStudents,
    studentGrades: existingLocalData?.studentGrades || defaultStudentGrades,
    reportCardStructures: existingLocalData?.reportCardStructures || [],
    schoolName: school.name,
    portalCode: school.portalCode,
    saasMeta: school,
    updatedAt: new Date().toISOString()
  };

  cacheSchoolDataLocally(cleanSchoolId, payload);

  // 3. Sync metadata and full data payload to Cloudflare D1
  try {
    await CloudflareD1Service.saveSaaSSchool(school);
    await CloudflareD1Service.saveSchool(cleanSchoolId, payload);
  } catch (err: any) {
    console.warn(`[saveSaaSSchoolToCloud] D1 sync deferred for ${cleanSchoolId}:`, err.message);
  }
}

export async function saveFullSchoolDataToFirebase(schoolId: string, data: FullSchoolData): Promise<void> {
  return saveSchoolToCloud(schoolId, data);
}

export async function loadAllSchoolsFromCloud(): Promise<SaasSchool[]> {
  // Read local schools from localStorage
  let localSchools: SaasSchool[] = [];
  try {
    const rawLocal = localStorage.getItem('class_on_saas_schools');
    if (rawLocal) {
      localSchools = JSON.parse(rawLocal);
    }
  } catch (e) {
    console.warn("[loadAllSchoolsFromCloud] LocalStorage parse error:", e);
  }

  // Fetch remote schools from Cloudflare D1
  try {
    const cloudSchools = await CloudflareD1Service.getAllSchools();
    if (cloudSchools && cloudSchools.length > 0) {
      // Merge cloud and local schools
      const mergedMap = new Map<string, SaasSchool>();
      localSchools.forEach(s => mergedMap.set(s.id, s));
      cloudSchools.forEach(cs => {
        const existing = mergedMap.get(cs.id);
        mergedMap.set(cs.id, { ...existing, ...cs, cloudSynced: true });
      });
      const combined = Array.from(mergedMap.values()).filter(s => s.id !== 'sc_xavier' && s.id !== 'sc_dps');
      
      // Update local storage cache
      try {
        localStorage.setItem('class_on_saas_schools', JSON.stringify(combined));
      } catch {}

      return combined;
    }
  } catch (err: any) {
    console.warn("[loadAllSchoolsFromCloud] D1 fetch failed:", err.message);
  }

  // Fallback to local schools
  return localSchools.filter(s => s.id !== 'sc_xavier' && s.id !== 'sc_dps');
}

export async function deleteSaaSSchoolFromCloud(schoolId: string): Promise<void> {
  const cleanId = normalizeCloudSchoolId(schoolId);

  // Remove from local storage
  try {
    const rawLocal = localStorage.getItem('class_on_saas_schools');
    if (rawLocal) {
      const list: SaasSchool[] = JSON.parse(rawLocal);
      const filtered = list.filter(s => s.id !== schoolId);
      localStorage.setItem('class_on_saas_schools', JSON.stringify(filtered));
    }
    localStorage.removeItem(`class_on_branding_${cleanId}`);
    localStorage.removeItem(`class_on_score_columns_${cleanId}`);
    localStorage.removeItem(`class_on_subjects_${cleanId}`);
    localStorage.removeItem(`class_on_grade_scales_${cleanId}`);
    localStorage.removeItem(`class_on_students_${cleanId}`);
    localStorage.removeItem(`class_on_student_grades_${cleanId}`);
    localStorage.removeItem(`class_on_structures_${cleanId}`);
    localStorage.removeItem(`class_on_recycle_bin_${cleanId}`);
  } catch (err) {
    console.warn("[deleteSaaSSchoolFromCloud LocalStorage Error]:", err);
  }

  // Delete from Cloudflare D1
  try {
    await CloudflareD1Service.deleteSchool(cleanId);
  } catch (err: any) {
    console.warn(`[deleteSaaSSchoolFromCloud] D1 delete failed for ${cleanId}:`, err.message);
  }
}

export async function saveIndividualStudentToCloud(schoolId: string, student: Student): Promise<void> {
  const cleanId = normalizeCloudSchoolId(schoolId);
  const existing = getLocalSchoolData(cleanId);
  if (existing) {
    const currentStudents = existing.students || [];
    const idx = currentStudents.findIndex(s => s.id === student.id);
    if (idx >= 0) currentStudents[idx] = student;
    else currentStudents.push(student);
    existing.students = currentStudents;
    await saveSchoolToCloud(cleanId, existing);
  }
}

export async function saveIndividualGradesToCloud(schoolId: string, grade: StudentGrades): Promise<void> {
  const cleanId = normalizeCloudSchoolId(schoolId);
  const existing = getLocalSchoolData(cleanId);
  if (existing) {
    const currentGrades = existing.studentGrades || [];
    const idx = currentGrades.findIndex(g => g.studentId === grade.studentId && g.termName === grade.termName);
    if (idx >= 0) currentGrades[idx] = grade;
    else currentGrades.push(grade);
    existing.studentGrades = currentGrades;
    await saveSchoolToCloud(cleanId, existing);
  }
}

export async function saveStudentsBatchToCloud(schoolId: string, students: Student[]): Promise<void> {
  const cleanId = normalizeCloudSchoolId(schoolId);
  const existing = getLocalSchoolData(cleanId);
  if (existing) {
    existing.students = students;
    await saveSchoolToCloud(cleanId, existing);
  }
}

export async function deleteStudentFromCloud(schoolId: string, studentId: string): Promise<void> {
  const cleanId = normalizeCloudSchoolId(schoolId);
  const existing = getLocalSchoolData(cleanId);
  if (existing) {
    existing.students = (existing.students || []).filter(s => s.id !== studentId);
    existing.studentGrades = (existing.studentGrades || []).filter(g => g.studentId !== studentId);
    await saveSchoolToCloud(cleanId, existing);
  }
}

export async function deleteIndividualStudentFromCloud(schoolId: string, studentId: string): Promise<void> {
  return deleteStudentFromCloud(schoolId, studentId);
}

export async function saveBrandingToCloud(schoolId: string, branding: SchoolBranding): Promise<void> {
  const cleanId = normalizeCloudSchoolId(schoolId);
  const existing = getLocalSchoolData(cleanId);
  if (existing) {
    existing.branding = branding;
    await saveSchoolToCloud(cleanId, existing);
  }
}

export async function saveScoreColumnsToCloud(schoolId: string, cols: ScoreColumn[]): Promise<void> {
  const cleanId = normalizeCloudSchoolId(schoolId);
  const existing = getLocalSchoolData(cleanId);
  if (existing) {
    existing.scoreColumns = cols;
    await saveSchoolToCloud(cleanId, existing);
  }
}

export async function saveSubjectsToCloud(schoolId: string, subjects: SubjectColumn[]): Promise<void> {
  const cleanId = normalizeCloudSchoolId(schoolId);
  const existing = getLocalSchoolData(cleanId);
  if (existing) {
    existing.subjects = subjects;
    await saveSchoolToCloud(cleanId, existing);
  }
}

export async function saveGradeScalesToCloud(schoolId: string, scales: GradeScale[]): Promise<void> {
  const cleanId = normalizeCloudSchoolId(schoolId);
  const existing = getLocalSchoolData(cleanId);
  if (existing) {
    existing.gradeScales = scales;
    await saveSchoolToCloud(cleanId, existing);
  }
}

export async function saveStructuresToCloud(schoolId: string, structs: ReportCardStructure[]): Promise<void> {
  const cleanId = normalizeCloudSchoolId(schoolId);
  const existing = getLocalSchoolData(cleanId);
  if (existing) {
    existing.reportCardStructures = structs;
    await saveSchoolToCloud(cleanId, existing);
  }
}

export async function loadGlobalSettings(): Promise<GlobalSettings> {
  try {
    const raw = localStorage.getItem('class_on_global_settings');
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    pricingTiers: DEFAULT_PRICING_TIERS,
    updatedAt: new Date().toISOString()
  };
}

export async function saveGlobalSettings(settings: GlobalSettings): Promise<void> {
  try {
    localStorage.setItem('class_on_global_settings', JSON.stringify(settings));
  } catch {}
}

export function subscribeGlobalSettings(callback: (settings: GlobalSettings) => void): () => void {
  loadGlobalSettings().then(callback);
  return () => {};
}

export async function saveNotificationToCloud(notif: any): Promise<void> {
  try {
    const raw = localStorage.getItem('class_on_saas_cloud_notifications_cache');
    const list = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((n: any) => n.id !== notif.id);
    filtered.unshift(notif);
    localStorage.setItem('class_on_saas_cloud_notifications_cache', JSON.stringify(filtered));
  } catch {}
}

export async function dismissNotificationInCloud(id: string): Promise<void> {}
export async function deleteNotificationFromCloud(id: string): Promise<void> {}
export async function loadNotificationsFromCloud(): Promise<any[]> {
  try {
    const raw = localStorage.getItem('class_on_saas_cloud_notifications_cache');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
export async function seedDefaultNotificationsToCloud(): Promise<void> {}
export function subscribeNotificationsFromCloud(callback: (notifs: any[]) => void): () => void {
  loadNotificationsFromCloud().then(callback);
  return () => {};
}
export async function loadDismissedNotificationsFromCloud(_schoolId?: string, _key?: string): Promise<any[]> { return []; }

export async function loadAllAgentsFromCloud(): Promise<any[]> {
  try {
    const raw = localStorage.getItem('class_on_saas_agents_cache');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
export async function saveAgentToCloud(agent: any): Promise<void> {
  try {
    const agents = await loadAllAgentsFromCloud();
    const idx = agents.findIndex((a: any) => a.id === agent.id);
    if (idx >= 0) agents[idx] = agent;
    else agents.push(agent);
    localStorage.setItem('class_on_saas_agents_cache', JSON.stringify(agents));
  } catch {}
}
export async function deleteAgentFromCloud(id: string): Promise<void> {
  try {
    const agents = await loadAllAgentsFromCloud();
    const filtered = agents.filter((a: any) => a.id !== id);
    localStorage.setItem('class_on_saas_agents_cache', JSON.stringify(filtered));
  } catch {}
}

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
  loadAllSchoolsFromCloud().then(callback);
  return () => {};
}

export function subscribeSchoolStructures(schoolId: string, callback: (structs: any[]) => void): () => void {
  getFullSchoolDataFromFirebase(schoolId).then(data => callback(data?.reportCardStructures || []));
  return () => {};
}

export function subscribeSchoolFullData(schoolId: string, callback: (data: any) => void): () => void {
  CloudflareD1Service.getSchool(schoolId).then((data) => {
    if (data) callback(data);
    else callback(getLocalSchoolData(schoolId));
  });
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
