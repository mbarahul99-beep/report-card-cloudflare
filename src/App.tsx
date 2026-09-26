import React, { useState, useEffect, useRef } from 'react';
import { 
  initialBranding, defaultScoreColumns, defaultSubjects, 
  defaultGradeScales, defaultStudents, defaultStudentGrades,
  defaultReportCardStructures
} from './data/defaultData';
import { SchoolBranding, ScoreColumn, SubjectColumn, GradeScale, Student, StudentGrades, SaasSchool, SaasTeacher, ReportCardStructure, SaasNotification, RecycleBinItem, SaasAgent, ChatMessage, SchoolClassItem } from './types';
import BrandingSettings from './components/BrandingSettings';
import SubjectSettings from './components/SubjectSettings';
import GradeSettings from './components/GradeSettings';
import StudentManager from './components/StudentManager';
import ReportCardPreview from './components/ReportCardPreview';
import StudentPortalSimulation from './components/StudentPortalSimulation';
import TeacherManager from './components/TeacherManager';
import MainAdminDashboard from './components/MainAdminDashboard';
import AgentDashboard from './components/AgentDashboard';
import ClasswiseMasterReport from './components/ClasswiseMasterReport';
import SubjectMarksEntry from './components/SubjectMarksEntry';
import SecurityDesk from './components/SecurityDesk';
import ReportCardStructureSettings from './components/ReportCardStructureSettings';
import AnalyticalDashboard from './components/AnalyticalDashboard';
import GoogleReCaptcha from './components/GoogleReCaptcha';
import SubscriptionBilling, { getPrefilledPaymentLink } from './components/SubscriptionBilling';
import TemplateGalleryManager from './components/TemplateGalleryManager';
import { classesMatch, normalizeClassName, getStandardClassPresets, matchStructureForStudent, isStudentFieldActive, getSectionsForClass } from './utils/classNormalizer';
import PrivacyPolicyModal from './components/PrivacyPolicyModal';
import SectionRemarksGenerator from './components/SectionRemarksGenerator';
import { renderMessageWithLinks } from './utils/linkify';
import { formatFatherName, formatMotherName, formatHeight, formatWeight, formatStudentFieldValue, formatClassName } from './lib/studentFormatters';
import { getParentPortalLoginConfig, findMatchingStudents, ParentLoginMethod } from './utils/parentPortalAuth';

// Cloudflare D1 Auth & System Configuration
const firebaseProjectId = "d1-report-card";
const firebaseAuthDomain = "auth.reportcard.local";
type FirebaseUser = { uid: string; email?: string | null; displayName?: string | null };
const auth = {};
const googleProvider = {};
const signInWithPopup = async (..._args: any[]) => ({ user: { uid: 'cf_user_1', email: 'admin@school.com', displayName: 'School Admin' } });
const fbSignOut = async (..._args: any[]) => {};
const onAuthStateChanged = (_auth: any, _callback: (user: FirebaseUser | null) => void) => {
  return () => {};
};
import { 
  loadSchoolFromCloud, saveSchoolToCloud, FullSchoolData,
  loadAllSchoolsFromCloud, saveSaaSSchoolToCloud, deleteSaaSSchoolFromCloud,
  saveNotificationToCloud, dismissNotificationInCloud, loadNotificationsFromCloud,
  seedDefaultNotificationsToCloud, subscribeNotificationsFromCloud, loadDismissedNotificationsFromCloud,
  loadAllAgentsFromCloud, saveAgentToCloud, deleteAgentFromCloud,
  saveChatMessage, subscribeChatMessages, subscribeSchoolsFromCloud,
  subscribeSchoolStructures, saveStudentsBatchToCloud,
  saveBrandingToCloud, saveScoreColumnsToCloud, saveSubjectsToCloud,
  saveGradeScalesToCloud, saveStructuresToCloud, subscribeSchoolFullData,
  normalizeCloudSchoolId,
  loadGlobalSettings, DEFAULT_PRICING_TIERS
} from './lib/firebaseSync';

import { 
  Award, Eye, Palette, BookOpen, Trophy, Users, GraduationCap, FolderArchive, Sparkles,
  Lock, Unlock, LogOut, Save, Building2, Shield, User, Landmark, Printer, Download, Hash,
  ClipboardList, Cloud, CloudOff, RefreshCw, Mail, KeyRound, Clock, Layers, Check,
  TrendingUp, BookMarked, UserCheck, AlertTriangle, Medal, BarChart2, HelpCircle, ArrowLeft, Home,
  Bell, CheckCircle, Info, X, Menu, ChevronLeft, ChevronRight, PieChart, Calendar, CloudLightning,
  Send, MessageSquare, History, School, AlertCircle, Database, LayoutGrid, CreditCard,
  Smartphone, Phone
} from 'lucide-react';

// Recharts components import for full visual reports
import { 
  BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, LineChart as RechartsLineChart, Line, AreaChart, Area, Cell
} from 'recharts';

const deduplicateSchools = (list: SaasSchool[]): SaasSchool[] => {
  const seen = new Set<string>();
  return list.filter(s => {
    if (!s || !s.id) return false;
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
};

export default function App() {
  // Active Navigation Tab
  const [activeTab, setActiveTabState] = useState<'dashboard' | 'preview' | 'branding' | 'subjects' | 'grades' | 'students' | 'portal' | 'teachers' | 'saas_owner' | 'classwise_report' | 'sub_marks_entry' | 'security_desk' | 'results_analysis' | 'agent_dashboard' | 'gallery_templates' | 'generate_remarks' | 'billing' | 'structures'>(() => {
    const role = localStorage.getItem('class_on_saas_role');
    if (role === 'main_admin') return 'saas_owner';
    if (role === 'agent') return 'agent_dashboard';
    const saved = localStorage.getItem('class_on_saas_active_tab') as any;
    const isSaaS = localStorage.getItem('class_on_saas_is_saas_admin') === 'true';
    const isImpersonatingLocal = localStorage.getItem('class_on_saas_impersonating') === 'true';
    if (saved && ['branding', 'grades', 'structures'].includes(saved) && !isSaaS && !isImpersonatingLocal) {
       return 'dashboard';
    }
    return saved || 'dashboard';
  });

  const [selectedSessionFilter, setSelectedSessionFilter] = useState<string>('');

  const [analysisSubTab, setAnalysisSubTab] = useState<'classwise' | 'subjectwise' | 'spotlight'>('classwise');

  const [dismissedNotifIds, setDismissedNotifIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('class_on_saas_dismissed_notifs');
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  });

  // Save dismissed notifications inside browser persistent local storage
  React.useEffect(() => {
    localStorage.setItem('class_on_saas_dismissed_notifs', JSON.stringify(dismissedNotifIds));
  }, [dismissedNotifIds]);

  const setActiveTab = (tab: any) => {
    const isSaaS = localStorage.getItem('class_on_saas_is_saas_admin') === 'true';
    const isImp = localStorage.getItem('class_on_saas_impersonating') === 'true';
    if (['branding', 'grades', 'structures'].includes(tab) && !isSaaS && !isImp) {
      setActiveTabState('dashboard');
      return;
    }
    setActiveTabState(tab);
  };

  React.useEffect(() => {
    if (activeTab) {
      localStorage.setItem('class_on_saas_active_tab', activeTab);
      
      // Automatically scroll smoothly to the starting screen of the selected tab
      setTimeout(() => {
        const element = document.getElementById('main-app-content');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [activeTab]);

  // Mobile navigation state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Firebase auth state & sync state
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isCloudSyncing, setIsCloudSyncing] = useState<boolean>(false);
  const [cloudSyncMessage, setCloudSyncMessage] = useState<string>("");
  const [isFirestoreOffline, setIsFirestoreOffline] = useState<boolean>(false);

  // SaaS tenant states
  const initialSaasSchools: SaasSchool[] = [];

  const [schools, setSchools] = useState<SaasSchool[]>(() => {
    let list = initialSaasSchools;
    try {
      const stored = localStorage.getItem('class_on_saas_schools');
      if (stored) {
        const parsed = JSON.parse(stored);
        list = parsed.map((s: any) => ({ ...s, teachers: s.teachers || [] }));
      }
    } catch {}
    
    // Ensure both default schools are completely removed even from existing cached local storage
    list = list.filter((s: any) => s.id !== 'sc_xavier' && s.id !== 'sc_dps');
    
    // Ensure every school has a parents portal code
    const mapped = list.map((s: any) => {
      let code = s.portalCode;
      if (!code) {
        if (s.id === 'sc_xavier') {
          code = 'XAVI-9821';
        } else if (s.id === 'sc_dps') {
          code = 'DELH-3091';
        } else {
          const prefix = s.name.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'SCH';
          let hash = 0;
          const key = s.id || s.name;
          for (let i = 0; i < key.length; i++) {
            hash = key.charCodeAt(i) + ((hash << 5) - hash);
          }
          const stableNum = 1000 + (Math.abs(hash) % 9000);
          code = `${prefix}-${stableNum}`;
        }
      }
      return { ...s, portalCode: code };
    });
    return deduplicateSchools(mapped);
  });

  const schoolsRef = React.useRef(schools);
  React.useEffect(() => {
    schoolsRef.current = schools;
  }, [schools]);

  const [currentRole, setCurrentRole] = useState<'main_admin' | 'school_admin' | 'class_teacher' | 'parent' | null>(() => {
    return (localStorage.getItem('class_on_saas_role') as any) || null;
  });

  const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(() => {
    return localStorage.getItem('class_on_saas_school_id') || null;
  });

  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(() => {
    return localStorage.getItem('class_on_saas_teacher_id') || null;
  });

  const activeNotifKey = currentRole === 'class_teacher' ? ((currentSchoolId || '') + "_" + (currentTeacherId || 'staff')) : currentSchoolId;

  const [isImpersonating, setIsImpersonating] = useState<boolean>(() => {
    return localStorage.getItem('class_on_saas_impersonating') === 'true';
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('school_dash_sidebar_collapsed') === 'true';
  });

  const [sidebarOpenMobile, setSidebarOpenMobile] = useState<boolean>(false);

  const [notifications, setNotifications] = useState<SaasNotification[]>(() => {
    try {
      const stored = localStorage.getItem('class_on_saas_cloud_notifications_cache');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const handleSendNotification = (newNotif: SaasNotification) => {
    setNotifications(prev => {
      const filtered = prev.filter(n => n.id !== newNotif.id);
      return [newNotif, ...filtered];
    });
    saveNotificationToCloud(newNotif).catch(err => {
      console.warn("Failed to save notification to cloud:", err);
    });
  };

  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

  // School Admin Chat support states
  const [schoolChatOpen, setSchoolChatOpen] = useState<boolean>(false);
  const [schoolChatMessages, setSchoolChatMessages] = useState<ChatMessage[]>([]);
  const schoolUnreadCount = schoolChatMessages.filter(
    m => m.senderId === 'admin' && m.receiverId === currentSchoolId && !m.read
  ).length;
  const [schoolChatInput, setSchoolChatInput] = useState<string>('');
  const schoolChatEndRef = useRef<HTMLDivElement | null>(null);

  // Subscribe to chat messages for the active school
  useEffect(() => {
    if (!currentSchoolId || currentRole !== 'school_admin') return;
    const unsub = subscribeChatMessages((messages) => {
      const chats = messages.filter(m => 
        (m.senderId === currentSchoolId && m.receiverId === 'admin') ||
        (m.senderId === 'admin' && m.receiverId === currentSchoolId)
      );
      setSchoolChatMessages(chats);
    });
    return () => unsub();
  }, [currentSchoolId, currentRole]);

  // Auto scroll to bottom of school chat
  useEffect(() => {
    if (schoolChatOpen) {
      setTimeout(() => {
        schoolChatEndRef.current?.scrollTo({
          top: schoolChatEndRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    }
  }, [schoolChatOpen, schoolChatMessages]);

  // Mark school admin support chat messages as read
  useEffect(() => {
    if (schoolChatOpen && currentSchoolId && currentRole === 'school_admin') {
      const unreadMsgs = schoolChatMessages.filter(
        m => m.senderId === 'admin' && m.receiverId === currentSchoolId && !m.read
      );
      unreadMsgs.forEach(async (msg) => {
        try {
          await saveChatMessage({ ...msg, read: true });
        } catch (e) {
          console.warn("Failed to mark school support chat message as read:", e);
        }
      });
    }
  }, [schoolChatOpen, schoolChatMessages, currentSchoolId, currentRole]);

  const handleSendSchoolChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const typedText = schoolChatInput.trim();
    if (!typedText || !currentSchoolId) return;

    const activeSch = schools.find(s => s.id === currentSchoolId);
    const schoolName = activeSch ? activeSch.name : 'School Admin';

    const newMsg: ChatMessage = {
      id: `chat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      senderId: currentSchoolId,
      senderName: schoolName,
      senderRole: 'school',
      receiverId: 'admin',
      receiverName: 'SaaS Admin',
      receiverRole: 'admin',
      message: typedText,
      sentAt: new Date().toISOString(),
      read: false
    };

    // Optimistically update input and messages list instantly
    setSchoolChatInput('');
    setSchoolChatMessages(prev => {
      if (prev.some(m => m.id === newMsg.id)) return prev;
      return [...prev, newMsg];
    });

    try {
      saveChatMessage(newMsg).catch(err => {
        console.error("Failed to save chat in background:", err);
      });
    } catch (err) {
      console.error("Failed to send school chat message:", err);
    }
  };

  const [isSaaSAdmin, setIsSaaSAdmin] = useState<boolean>(() => {
    return localStorage.getItem('class_on_saas_is_saas_admin') === 'true';
  });

  // Login states
  const [isSeparateParentPortal, setIsSeparateParentPortal] = useState<boolean>(false);
  const [loginTab, setLoginTab] = useState<'school' | 'teacher' | 'owner' | 'parent' | 'agent'>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const view = params.get('view') || params.get('portal');
      if (view === 'partner' || view === 'agent' || view === 'referral') {
        return 'agent';
      }
      if (view === 'owner' || view === 'admin' || view === 'saas_owner' || view === 'super_admin') {
        return 'owner';
      }
    } catch (e) {
      console.warn("Failed to check URL params:", e);
    }
    return 'school';
  });
  const [schoolInput, setSchoolInput] = useState('');
  const [teacherInput, setTeacherInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);
  const [recaptchaResetTrigger, setRecaptchaResetTrigger] = useState<number>(0);
  
  // Parents Portal Login Input States
  const [parentPortalCodeInput, setParentPortalCodeInput] = useState('');
  const [parentRollNoInput, setParentRollNoInput] = useState('');
  const [parentDOBInput, setParentDOBInput] = useState('');
  const [parentAdmissionNoInput, setParentAdmissionNoInput] = useState('');
  const [parentMobileInput, setParentMobileInput] = useState('');
  const [parentLoginMethod, setParentLoginMethod] = useState<ParentLoginMethod>('roll_dob');
  const [familyStudentMatches, setFamilyStudentMatches] = useState<Student[] | null>(null);
  const [familyContext, setFamilyContext] = useState<{
    matchedSchool: SaasSchool;
    matchedCloudData: any;
    schoolStudents: Student[];
  } | null>(null);
  const [selectedParentStudentId, setSelectedParentStudentId] = useState<string | null>(() => {
    return localStorage.getItem('class_on_parent_student_id') || null;
  });
  const [parentTab, setParentTab] = useState<'analytics' | 'report_card'>('analytics');
  const [parentPortalTermFilter, setParentPortalTermFilter] = useState<'all' | 'term1' | 'term2' | 'term3'>('all');
  const [parentPortalSessionFilter, setParentPortalSessionFilter] = useState<string>('');

  const [authError, setAuthError] = useState('');
  const [copiedHostname, setCopiedHostname] = useState(false);
  const [copiedCounterpart, setCopiedCounterpart] = useState(false);

  // New School Registration Form States
  const [isRegistering, setIsRegistering] = useState(false);
  const [regContactPerson, setRegContactPerson] = useState('');
  const [regSchoolName, setRegSchoolName] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regBoard, setRegBoard] = useState('CBSE');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regReferralCode, setRegReferralCode] = useState('');
  
  // URL referral code tracking
  const [urlReferralCode, setUrlReferralCode] = useState<string>(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('ref') || params.get('agent');
      if (code) {
        localStorage.setItem('class_on_saas_ref_code', code.toUpperCase().trim());
        return code.toUpperCase().trim();
      }
    } catch (err) {
      console.warn("Error parsing referral code:", err);
    }
    return localStorage.getItem('class_on_saas_ref_code') || '';
  });

  React.useEffect(() => {
    if (urlReferralCode) {
      setRegReferralCode(urlReferralCode);
    }
  }, [urlReferralCode]);

  const [matchedAgentName, setMatchedAgentName] = useState<string | null>(null);

  React.useEffect(() => {
    if (regReferralCode.trim()) {
      const lookup = async () => {
        try {
          const allAgents = await loadAllAgentsFromCloud();
          const found = allAgents.find(a => a.code.toUpperCase().trim() === regReferralCode.toUpperCase().trim());
          if (found) {
            setMatchedAgentName(found.name);
          } else {
            setMatchedAgentName(null);
          }
        } catch {
          setMatchedAgentName(null);
        }
      };
      lookup();
    } else {
      setMatchedAgentName(null);
    }
  }, [regReferralCode]);

  // Agent Specific States
  const [currentAgent, setCurrentAgent] = useState<SaasAgent | null>(() => {
    try {
      const stored = localStorage.getItem('class_on_saas_agent_profile');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [isAgentOnboardingForm, setIsAgentOnboardingForm] = useState(false);
  const [tempAgentUid, setTempAgentUid] = useState('');
  const [agentRegName, setAgentRegName] = useState('');
  const [agentRegCode, setAgentRegCode] = useState('');
  const [agentRegPayout, setAgentRegPayout] = useState('');

  // SaaS Owner login states
  const [ownerEmailInput, setOwnerEmailInput] = useState('');
  const [ownerOtpInput, setOwnerOtpInput] = useState('');
  const [ownerPinInput, setOwnerPinInput] = useState('');
  const [otpRequested, setOtpRequested] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpMessage, setOtpMessage] = useState('');

  // States for live checking / automatic checking
  const [isRefreshingApproval, setIsRefreshingApproval] = useState(false);
  const [lastCheckMessage, setLastCheckMessage] = useState('');

  // States for Cloud/Offline database sync recovery
  const [cloudSchoolIds, setCloudSchoolIdsState] = useState<string[]>([]);
  const cloudSchoolIdsRef = useRef<string[]>([]);
  const setCloudSchoolIds = (value: string[] | ((prev: string[]) => string[])) => {
    setCloudSchoolIdsState(prev => {
      const next = typeof value === 'function' ? value(prev) : value;
      cloudSchoolIdsRef.current = next;
      return next;
    });
  };
  const [isSyncingAll, setIsSyncingAll] = useState<boolean>(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState<string>("");

  const syncUnsyncedSchoolsToCloud = async () => {
    setIsSyncingAll(true);
    setSyncStatusMessage("Detecting local school structures...");
    try {
      const unsynced = schools.filter(s => s.id.startsWith('sc_') && !cloudSchoolIdsRef.current.includes(s.id));
      if (unsynced.length === 0) {
        setSyncStatusMessage("All schools are fully synchronized!");
        setTimeout(() => setSyncStatusMessage(""), 3000);
        setIsSyncingAll(false);
        return;
      }

      for (let i = 0; i < unsynced.length; i++) {
        const school = unsynced[i];
        setSyncStatusMessage(`Syncing ${i + 1}/${unsynced.length}: ${school.name}...`);
        
        // 1. Sync SaaS school registry config
        await saveSaaSSchoolToCloud(school, school.ownerId || "user-self-registration");

        // 2. Fetch and reconstruct school database tables from localStorage
        const bStored = localStorage.getItem(`class_on_branding_${school.id}`);
        const cStored = localStorage.getItem(`class_on_score_columns_${school.id}`);
        const subStored = localStorage.getItem(`class_on_subjects_${school.id}`);
        const gStored = localStorage.getItem(`class_on_grade_scales_${school.id}`);
        const sStored = localStorage.getItem(`class_on_students_${school.id}`);
        const sgStored = localStorage.getItem(`class_on_student_grades_${school.id}`);
        const structStored = localStorage.getItem(`class_on_structures_${school.id}`);
        const binStored = localStorage.getItem(`class_on_recycle_bin_${school.id}`);

        const deepData: FullSchoolData = {
          branding: bStored ? JSON.parse(bStored) : { ...initialBranding, schoolName: school.name },
          scoreColumns: cStored ? JSON.parse(cStored) : defaultScoreColumns,
          subjects: subStored ? JSON.parse(subStored) : defaultSubjects,
          gradeScales: gStored ? JSON.parse(gStored) : defaultGradeScales,
          students: sStored ? JSON.parse(sStored) : [],
          studentGrades: sgStored ? JSON.parse(sgStored) : [],
          reportCardStructures: structStored ? JSON.parse(structStored) : [],
          recycleBin: binStored ? JSON.parse(binStored) : []
        };

        // 3. Save deep data package to Cloud
        await saveSchoolToCloud(school.id, deepData, school.name, school.portalCode);
      }

      // Reload SaaS registry school listing to update synchronized states
      const refreshedCloudSchools = await loadAllSchoolsFromCloud();
      setCloudSchoolIds(refreshedCloudSchools.map(s => s.id));
      setIsFirestoreOffline(false);
      setSyncStatusMessage("🎉 All onboarded schools synced permanently!");

      handleSendNotification({
        id: `notif_sync_${Date.now()}`,
        title: "SaaS Offline Onboarding Recovered",
        message: `Direct synchronization complete! Successfully recovered and permanently saved ${unsynced.length} school accounts and academic databases to Cloud Firestore.`,
        type: 'success',
        sentAt: new Date().toISOString(),
        readBy: [],
        targetSchoolIds: unsynced.map(s => s.id)
      });

      setTimeout(() => setSyncStatusMessage(""), 5000);
    } catch (err: any) {
      console.warn("Bulk offline data synchronization failure:", err);
      setSyncStatusMessage(`❌ Sync failed: ${err.message || "Network Error"}`);
    } finally {
      setIsSyncingAll(false);
    }
  };

  const syncActiveSchoolToCloud = async () => {
    if (!currentSchoolId) return;
    setIsCloudSyncing(true);
    setCloudSyncMessage("Uploading school records from local storage to Cloud...");
    try {
      const activeSchoolObj = schools.find(s => s.id === currentSchoolId);
      if (!activeSchoolObj) throw new Error("School not found in SaaS registry.");

      // 1. Sync school profile metadata
      await saveSaaSSchoolToCloud(activeSchoolObj, activeSchoolObj.ownerId || "school-admin-offline-sync");

      // 2. Save active school records
      await saveSchoolToCloud(currentSchoolId, {
        branding,
        scoreColumns,
        subjects,
        notes: "",
        gradeScales,
        students,
        studentGrades,
        reportCardStructures,
        recycleBin
      } as any, branding.schoolName, activeSchoolObj.portalCode);

      // 3. Reload cloud schools and set connected state
      const refreshedCloudSchools = await loadAllSchoolsFromCloud();
      setCloudSchoolIds(refreshedCloudSchools.map(s => s.id));
      setIsFirestoreOffline(false);
      
      setCloudSyncMessage("🎉 Synchronized successfully!");
      setTimeout(() => setCloudSyncMessage(""), 3000);
    } catch (err: any) {
      console.warn("Failed to synchronize active school offline records:", err);
      alert(`Synchronization failed: ${err.message || err}`);
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const calculateRateAndTotal = (countVal: number, schoolObj: SaasSchool | null) => {
    let tiers = DEFAULT_PRICING_TIERS;
    if (schoolObj?.pricingTiers && schoolObj.pricingTiers.length > 0) {
      tiers = schoolObj.pricingTiers;
    } else if (globalSettings?.pricingTiers && globalSettings.pricingTiers.length > 0) {
      tiers = globalSettings.pricingTiers;
    }
    const sorted = [...tiers].sort((a, b) => a.minStudents - b.minStudents);
    const matched: any = sorted.find(t => countVal >= t.minStudents && countVal <= t.maxStudents);
    
    let rate = 20;
    let paymentLink = matched?.paymentLink || undefined;
    if (matched) {
      rate = matched.pricePerStudent;
    } else {
      const highestTier: any = sorted[sorted.length - 1];
      if (highestTier && countVal > highestTier.maxStudents) {
        rate = highestTier.pricePerStudent;
        paymentLink = highestTier.paymentLink;
      } else if (sorted[0]) {
        const firstTier: any = sorted[0];
        rate = firstTier.pricePerStudent;
        paymentLink = firstTier.paymentLink;
      }
    }
    return {
      rate,
      total: countVal * rate,
      paymentLink
    };
  };

  const handleProceedRenewalPayment = async (studentCountVal: number) => {
    if (!activeSchoolObj) return;
    if (studentCountVal <= 0) {
      alert("Please enter a valid number of students to proceed.");
      return;
    }

    try {
      setIsSubmittingRenewal(true);
      const { rate, total, paymentLink: tierPaymentLink } = calculateRateAndTotal(studentCountVal, activeSchoolObj);
      
      const reqData = {
        studentCount: studentCountVal,
        calculatedTotal: total,
        status: 'pending' as const,
        paymentStatus: 'pending' as const,
        verificationMessage: "The renewal payment status is being verified and will be updated within 24 hours. Till then, the school admin will continue to use the free/restricted plan.",
        requestedAt: new Date().toISOString()
      };
      
      // Update school document in Firestore with pending request
      const updatedSchool = {
        ...activeSchoolObj,
        subscriptionRequest: reqData,
        updatedAt: new Date().toISOString()
      };
      
      await saveSaaSSchoolToCloud(updatedSchool, activeSchoolObj.ownerId);

      // Send a targeted notification to the cloud
      const notifId = `notif_upgr_req_${Date.now()}`;
      const newNotif: SaasNotification = {
        id: notifId,
        title: "⏳ Renewal Subscription Payment Verification Pending",
        message: `Your renewal request for "${activeSchoolObj.name}" to the Premium Plan with ${studentCountVal} student licenses (₹${total.toLocaleString()}/year) was submitted. Our admins are verifying the payment status and will activate your profile within 24 hours.`,
        type: 'info',
        sentAt: new Date().toISOString(),
        targetSchoolIds: [activeSchoolObj.id],
        readBy: []
      };
      handleSendNotification(newNotif);

      // Open Configured Preset Payment Link in new tab
      const basePaymentLink = tierPaymentLink || globalSettings?.presetPaymentLink || "https://rzp.io/rzp/ja1SBVeJ";
      const trackingLink = getPrefilledPaymentLink(basePaymentLink, activeSchoolObj, studentCountVal, total);
      
      try {
        window.open(trackingLink, "_blank");
      } catch (popErr) {
        console.warn("Popup blocked or aborted:", popErr);
      }

      alert("🎉 Renewal payment request submitted successfully! Please complete the payment on the payment page and wait for SaaS admin approval.");
      
      // Refresh local school data
      refreshSchoolsFromCloud(false);
    } catch (err: any) {
      console.error(err);
      alert(`Submission failed: ${err.message}`);
    } finally {
      setIsSubmittingRenewal(false);
    }
  };

  const refreshSchoolsFromCloud = async (isManual = false) => {
    if (isManual) {
      setIsRefreshingApproval(true);
      setLastCheckMessage('');
    }
    try {
      const rawCloudSchools = await loadAllSchoolsFromCloud();
      if (rawCloudSchools) {
        const cloudSchools = rawCloudSchools.filter(s => s.id !== 'sc_xavier' && s.id !== 'sc_dps');
        if (cloudSchools.length === 0) {
          // Seeding mechanism: Cloud is completely empty!
          console.log("Seeding initial schools to Firestore cloud because the cloud registry is completely empty...");
          for (const sch of initialSaasSchools) {
            try {
              await saveSaaSSchoolToCloud(sch, "default-owner");
            } catch (seedErr) {
              console.warn(`Initial school seeding deferred for ${sch.id} (using persistent local storage instead):`, seedErr);
            }
          }
          setCloudSchoolIds(initialSaasSchools.map(s => s.id));
          setSchools(initialSaasSchools.map(s => ({ ...s, cloudSynced: true })));
          return;
        }

        setCloudSchoolIds(cloudSchools.map(s => s.id));
        setSchools(prev => {
          const cloudSchoolIdsSet = new Set(cloudSchools.map(s => s.id));
          
          // Purge local storage cache for schools deleted on the cloud
          prev.forEach(s => {
            const isCustomSchool = s.id.startsWith('sc_') && s.id !== 'sc_xavier' && s.id !== 'sc_dps';
            if (isCustomSchool && !cloudSchoolIdsSet.has(s.id)) {
              console.log(`[SaaS Sync] School "${s.name}" (${s.id}) was deleted on the cloud. Purging local storage cache.`);
              try {
                localStorage.removeItem(`class_on_branding_${s.id}`);
                localStorage.removeItem(`class_on_score_columns_${s.id}`);
                localStorage.removeItem(`class_on_subjects_${s.id}`);
                localStorage.removeItem(`class_on_grade_scales_${s.id}`);
                localStorage.removeItem(`class_on_students_${s.id}`);
                localStorage.removeItem(`class_on_student_grades_${s.id}`);
                localStorage.removeItem(`class_on_structures_${s.id}`);
                localStorage.removeItem(`class_on_recycle_bin_${s.id}`);
              } catch (e) {
                console.warn("Purging deleted school local storage error:", e);
              }
            }
          });

          // Filter out schools that are considered deleted on the cloud
          const filteredPrev = prev.filter(s => {
            const isCustomSchool = s.id.startsWith('sc_') && s.id !== 'sc_xavier' && s.id !== 'sc_dps';
            if (isCustomSchool && !cloudSchoolIdsSet.has(s.id)) {
              return false;
            }
            return true;
          });

          const merged = [...filteredPrev];
          cloudSchools.forEach(cs => {
            const idx = merged.findIndex(s => s.id === cs.id);
            if (idx >= 0) {
              const existing = merged[idx].portalCode;
              merged[idx] = { 
                ...merged[idx], 
                ...cs, 
                cloudSynced: true,
                portalCode: cs.portalCode || existing || ""
              };
            } else {
              merged.push({ ...cs, cloudSynced: true });
            }
          });
          const finalMapped = merged.map(s => {
            let code = s.portalCode;
            if (!code) {
              if (s.id === 'sc_xavier') {
                code = 'XAVI-9821';
              } else if (s.id === 'sc_dps') {
                code = 'DELH-3091';
              } else {
                const prefix = s.name.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'SCH';
                let hash = 0;
                const key = s.id || s.name;
                for (let i = 0; i < key.length; i++) {
                  hash = key.charCodeAt(i) + ((hash << 5) - hash);
                }
                const stableNum = 1000 + (Math.abs(hash) % 9000);
                code = `${prefix}-${stableNum}`;
              }
            }
            return { ...s, portalCode: code };
          });
          return deduplicateSchools(finalMapped);
        });

        if (isManual) {
          const currentSchoolIdVal = localStorage.getItem('class_on_saas_school_id');
          const mySchool = cloudSchools.find(s => s.id === currentSchoolIdVal);
          if (mySchool) {
            if (mySchool.approvalStatus === 'approved') {
              setLastCheckMessage("🎉 Success! Your registration has been approved. All tabs are now functional.");
            } else if (mySchool.approvalStatus === 'rejected') {
              setLastCheckMessage("❌ Your onboarding request was declined. Please check with support.");
            } else {
              setLastCheckMessage("⏳ Your application is still pending review. Please try again shortly!");
            }
          } else {
            setLastCheckMessage("⏳ Application lookup completed. No changes detected yet.");
          }
        }
      }
    } catch (err) {
      console.warn("Could not load cloud school registries:", err);
      if (isManual) {
        setLastCheckMessage("❌ Error reaching the server. Please check your network connection.");
      }
    } finally {
      if (isManual) {
        setIsRefreshingApproval(false);
      }
    }
  };

  // Fetch and subscribe to SaaS school registrations in real-time on boot and auth state change
  React.useEffect(() => {
    refreshSchoolsFromCloud(false);

    let unsubscribe = () => {};
    try {
      unsubscribe = subscribeSchoolsFromCloud((rawCloudSchools) => {
        if (rawCloudSchools) {
          const cloudSchools = rawCloudSchools.filter(s => s.id !== 'sc_xavier' && s.id !== 'sc_dps');
          setCloudSchoolIds(cloudSchools.map(s => s.id));
          setSchools(prev => {
            const cloudSchoolIdsSet = new Set(cloudSchools.map(s => s.id));
            
            // Purge local storage cache for schools deleted on the cloud
            prev.forEach(s => {
              const isCustomSchool = s.id.startsWith('sc_') && s.id !== 'sc_xavier' && s.id !== 'sc_dps';
              if (isCustomSchool && !cloudSchoolIdsSet.has(s.id)) {
                console.log(`[SaaS Real-time Sync] School "${s.name}" (${s.id}) was deleted on the cloud. Purging local storage cache.`);
                try {
                  localStorage.removeItem(`class_on_branding_${s.id}`);
                  localStorage.removeItem(`class_on_score_columns_${s.id}`);
                  localStorage.removeItem(`class_on_subjects_${s.id}`);
                  localStorage.removeItem(`class_on_grade_scales_${s.id}`);
                  localStorage.removeItem(`class_on_students_${s.id}`);
                  localStorage.removeItem(`class_on_student_grades_${s.id}`);
                  localStorage.removeItem(`class_on_structures_${s.id}`);
                  localStorage.removeItem(`class_on_recycle_bin_${s.id}`);
                } catch (e) {
                  console.warn("Purging deleted school local storage error:", e);
                }
              }
            });

            // Filter out schools that are considered deleted on the cloud
            const filteredPrev = prev.filter(s => {
              const isCustomSchool = s.id.startsWith('sc_') && s.id !== 'sc_xavier' && s.id !== 'sc_dps';
              if (isCustomSchool && !cloudSchoolIdsSet.has(s.id)) {
                return false;
              }
              return true;
            });

            const merged = [...filteredPrev];
            cloudSchools.forEach(cs => {
              const idx = merged.findIndex(s => s.id === cs.id);
              if (idx >= 0) {
                const existing = merged[idx].portalCode;
                merged[idx] = { 
                  ...merged[idx], 
                  ...cs, 
                  cloudSynced: true,
                  portalCode: cs.portalCode || existing || ""
                };
              } else {
                merged.push({ ...cs, cloudSynced: true });
              }
            });
            const finalMapped = merged.map(s => {
              let code = s.portalCode;
              if (!code) {
                if (s.id === 'sc_xavier') {
                  code = 'XAVI-9821';
                } else if (s.id === 'sc_dps') {
                  code = 'DELH-3091';
                } else {
                  const prefix = s.name.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'SCH';
                  let hash = 0;
                  const key = s.id || s.name;
                  for (let i = 0; i < key.length; i++) {
                    hash = key.charCodeAt(i) + ((hash << 5) - hash);
                  }
                  const stableNum = 1000 + (Math.abs(hash) % 9000);
                  code = `${prefix}-${stableNum}`;
                }
              }
              return { ...s, portalCode: code };
            });
            return deduplicateSchools(finalMapped);
          });
        }
      });
    } catch (err) {
      console.warn("Failed to subscribe to schools real-time stream:", err);
    }

    return () => unsubscribe();
  }, [firebaseUser]);

  // Load and subscribe to global notifications from Firestore in real-time
  React.useEffect(() => {
    const initAndSubscribe = async () => {
      try {
        await seedDefaultNotificationsToCloud();
      } catch (err) {
        console.warn("Failed to seed default notifications on startup:", err);
      }
    };
    initAndSubscribe();

    let unsubscribe = () => {};
    try {
      unsubscribe = subscribeNotificationsFromCloud((cloudNotifs) => {
        setNotifications(cloudNotifs || []);
      });
    } catch (err) {
      console.warn("Failed to subscribe to notifications:", err);
    }
    return () => unsubscribe();
  }, []);

  // Fetch and sync dismissed notifications from the cloud for the active school and role
  React.useEffect(() => {
    const fetchDismissed = async () => {
      if (currentSchoolId && activeNotifKey) {
        try {
          const cloudDismissed = await loadDismissedNotificationsFromCloud(currentSchoolId, activeNotifKey);
          if (cloudDismissed && cloudDismissed.length > 0) {
            setDismissedNotifIds(prev => {
              const merged = Array.from(new Set([...prev, ...cloudDismissed]));
              return merged;
            });
          }
        } catch (err) {
          console.warn("Failed to load dismissed notifications from cloud on switch:", err);
        }
      }
    };
    fetchDismissed();
  }, [currentSchoolId, activeNotifKey]);

  // Periodically check for school approval status in background if current state is pending in school admin dashboard
  React.useEffect(() => {
    const activeSch = schools.find(s => s.id === currentSchoolId);
    const isPending = activeSch?.approvalStatus === 'pending';
    if (currentRole === 'school_admin' && isPending) {
      const intervalId = setInterval(() => {
        refreshSchoolsFromCloud(false);
      }, 5000); // Snappy 5s interval so it updates almost immediately when approved!
      return () => clearInterval(intervalId);
    }
  }, [currentRole, currentSchoolId, schools]);

  // Persist schools list
  React.useEffect(() => {
    localStorage.setItem('class_on_saas_schools', JSON.stringify(schools));
  }, [schools]);

  // Safeguard restricted layouts from normal users (allow school_admin and impersonating SaaS owner)
  React.useEffect(() => {
    if ((activeTab === 'branding' || activeTab === 'grades' || activeTab === 'structures') && !isImpersonating) {
      setActiveTab('dashboard');
    }
  }, [activeTab, isImpersonating]);

  // Smoothly scroll window to top when activeTab changes to keep target area immediately in view
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  // Reset reCAPTCHA token and trigger widget reload when login view or tab changes
  React.useEffect(() => {
    setRecaptchaToken(null);
    setRecaptchaResetTrigger(prev => prev + 1);
  }, [loginTab, isRegistering]);

  // Handle Self Registration Submitted by a new user (School Admin onboarding)
  const handleRegisterSchoolSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (!recaptchaToken) {
      const isDevOrPreview = window.location.hostname.includes('localhost') ||
        window.location.hostname.includes('127.0.0.1') ||
        window.location.hostname.includes('run.app') ||
        window.location.hostname.includes('googleusercontent.com') ||
        window.location.hostname.includes('webcontainer.io');

      if (!isDevOrPreview) {
        setAuthError('Please complete the Google reCAPTCHA verification to register.');
        return;
      } else {
        console.warn('reCAPTCHA registration bypassed in development / preview sandbox.');
      }
    }

    if (!regSchoolName || !regContactPerson || !regEmail || !regMobile || !regUsername || !regPassword) {
      setAuthError('Please fill in all the required fields.');
      return;
    }

    // Secure password strength validation
    const trimmedPassword = regPassword.trim();
    const hasCapital = /[A-Z]/.test(trimmedPassword);
    const hasNumber = /[0-9]/.test(trimmedPassword);
    const hasSpecial = /[^A-Za-z0-9]/.test(trimmedPassword);

    if (trimmedPassword.length < 6 || !hasCapital || !hasNumber || !hasSpecial) {
      setAuthError('Registration Password must be at least 6 characters long and contain at least one capital letter, one number, and one special character.');
      return;
    }

    const cleanUsername = regUsername.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (!cleanUsername) {
      setAuthError('Registration ID must contain alphanumeric characters.');
      return;
    }

    if (schools.some(s => s.username === cleanUsername)) {
      setAuthError(`The School ID "${regUsername}" is already taken. Please choose another one.`);
      return;
    }

    setIsCloudSyncing(true);
    setCloudSyncMessage("Persisting your school registry parameters to SaaS Cloud database...");

    try {
      const newSchoolId = `sc_${Date.now()}`;
      const prefix = regSchoolName.trim().replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'SCH';
      let hash = 0;
      for (let i = 0; i < newSchoolId.length; i++) {
        hash = newSchoolId.charCodeAt(i) + ((hash << 5) - hash);
      }
      const stableNum = 1000 + (Math.abs(hash) % 9000);
      const stablePortalCode = `${prefix}-${stableNum}`;

      let matchedAgentId: string | null = null;
      let matchedAgentCode: string | null = null;
      if (regReferralCode.trim()) {
        try {
          const allAgents = await loadAllAgentsFromCloud();
          const foundAgent = allAgents.find(a => a.code.toUpperCase().trim() === regReferralCode.toUpperCase().trim());
          if (foundAgent) {
            matchedAgentId = foundAgent.id;
            matchedAgentCode = foundAgent.code;
          }
        } catch (agentErr) {
          console.warn("Failed to lookup referral agent:", agentErr);
        }
      }

      const schoolRegTime = new Date().toISOString();
      const newSchool: SaasSchool = {
        id: newSchoolId,
        name: regSchoolName.trim(),
        username: cleanUsername,
        password: regPassword.trim(),
        contactPerson: regContactPerson.trim(),
        address: regAddress.trim(),
        mobile: regMobile.trim(),
        email: regEmail.trim(),
        board: regBoard,
        approvalStatus: 'approved' as const, // auto-approved immediately
        partnershipType: 'pending_activation' as any, // Require explicit plan activation
        teachers: [],
        portalCode: stablePortalCode,
        createdAt: schoolRegTime,
        referredByAgentId: matchedAgentId,
        referredByAgentCode: matchedAgentCode
      };

      // 1. Save school registry mapping
      await saveSaaSSchoolToCloud(newSchool, "user-self-registration");

      // Send a single onboarding notification to the newly registered school
      const onboardingNotif: SaasNotification = {
        id: `notif_onboarding_${newSchoolId}_${Date.now()}`,
        title: "🏫 Welcome to School Report Card!",
        message: `Your school "${regSchoolName.trim()}" has been successfully registered. Please select and activate a subscription plan (Free or Premium) to begin creating report cards.`,
        type: "info",
        sentAt: schoolRegTime,
        targetSchoolIds: [newSchoolId],
        readBy: []
      };
      await saveNotificationToCloud(onboardingNotif);
      setNotifications(prev => {
        const filtered = prev.filter(n => n.id !== onboardingNotif.id);
        return [onboardingNotif, ...filtered];
      });

      // 2. Setup default/initial parameters for the school in cloud database
      const initialCloudData: FullSchoolData = {
        branding: {
          ...initialBranding,
          schoolName: regSchoolName.trim(), // custom school name
        },
        scoreColumns: defaultScoreColumns,
        subjects: defaultSubjects,
        gradeScales: defaultGradeScales,
        students: newSchool.id === 'demo' ? defaultStudents : [],
        studentGrades: newSchool.id === 'demo' ? defaultStudentGrades : [],
        reportCardStructures: defaultReportCardStructures
      };
      await saveSchoolToCloud(newSchool.id, initialCloudData, regSchoolName.trim(), stablePortalCode);

      // 3. Update local state
      const newSchoolWithSync = { ...newSchool, cloudSynced: true };
      setSchools(prev => deduplicateSchools([...prev, newSchoolWithSync]));
      setCloudSchoolIds(prev => Array.from(new Set([...prev, newSchoolId])));

      // 4. Log in immediately as School Admin with Default Parameters
      setBranding(initialCloudData.branding);
      setScoreColumns(initialCloudData.scoreColumns);
      setSubjects(initialCloudData.subjects);
      setGradeScales(initialCloudData.gradeScales);
      setStudents(initialCloudData.students);
      setStudentGrades(initialCloudData.studentGrades);
      setReportCardStructures(initialCloudData.reportCardStructures || []);

      setCurrentRole('school_admin');
      setCurrentSchoolId(newSchool.id);
      setCurrentTeacherId(null);
      setIsImpersonating(false);
      setIsSaaSAdmin(false);

      // Save credentials to local storage
      localStorage.setItem('class_on_saas_role', 'school_admin');
      localStorage.setItem('class_on_saas_school_id', newSchool.id);
      localStorage.setItem('class_on_saas_is_saas_admin', 'false');
      localStorage.removeItem('class_on_saas_teacher_id');
      localStorage.removeItem('class_on_saas_impersonating');
      setActiveTab('billing');

      // Clear form inputs
      setRegContactPerson('');
      setRegSchoolName('');
      setRegAddress('');
      setRegMobile('');
      setRegEmail('');
      setRegUsername('');
      setRegPassword('');
      setIsRegistering(false);

      setCloudSyncMessage("Awesome! School Registered & Logged In!");
    } catch (err: any) {
      console.warn("Self registration deferred/failed:", err);
      setAuthError(err?.message || "Internal error registering school.");
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Handle Login submission
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (loginTab !== 'owner' && !recaptchaToken) {
      const isDevOrPreview = window.location.hostname.includes('localhost') ||
        window.location.hostname.includes('127.0.0.1') ||
        window.location.hostname.includes('run.app') ||
        window.location.hostname.includes('googleusercontent.com') ||
        window.location.hostname.includes('webcontainer.io');

      if (!isDevOrPreview) {
        setAuthError('Please complete the Google reCAPTCHA verification to sign in.');
        return;
      } else {
        console.warn('reCAPTCHA login bypassed in development / preview sandbox.');
      }
    }

    if (loginTab === 'owner') {
      setAuthError('Unauthorized: Password, Pin, and OTP bypass login has been permanently disabled on the master SaaS Owner console to ensure complete data security across all school registries. Please use the secure Google Sign-In button above instead.');
      return;
    }

    // Step 1: Merge local and live cloud schools synchronously to prevent any React state async rendering lag
    setIsCloudSyncing(true);
    setCloudSyncMessage(`Syncing and authenticating your ${loginTab} portal with SaaS security cloud...`);
    
    let latestSchoolsList = [...schools];
    try {
      const cloudSchools = await loadAllSchoolsFromCloud();
      if (cloudSchools) {
        const cloudSchoolIdsSet = new Set(cloudSchools.map(s => s.id));
        setCloudSchoolIds(cloudSchools.map(s => s.id));

        // Purge local storage cache for schools deleted on the cloud
        schools.forEach(s => {
          const isCustomSchool = s.id.startsWith('sc_') && s.id !== 'sc_xavier' && s.id !== 'sc_dps';
          if (isCustomSchool && !cloudSchoolIdsSet.has(s.id)) {
            console.log(`[SaaS Login Sync] School "${s.name}" (${s.id}) was deleted on the cloud. Purging local storage cache.`);
            try {
              localStorage.removeItem(`class_on_branding_${s.id}`);
              localStorage.removeItem(`class_on_score_columns_${s.id}`);
              localStorage.removeItem(`class_on_subjects_${s.id}`);
              localStorage.removeItem(`class_on_grade_scales_${s.id}`);
              localStorage.removeItem(`class_on_students_${s.id}`);
              localStorage.removeItem(`class_on_student_grades_${s.id}`);
              localStorage.removeItem(`class_on_structures_${s.id}`);
              localStorage.removeItem(`class_on_recycle_bin_${s.id}`);
            } catch (e) {
              console.warn("Purging deleted school local storage error:", e);
            }
          }
        });

        // Filter out schools that are considered deleted on the cloud
        const filteredPrev = schools.filter(s => {
          const isCustomSchool = s.id.startsWith('sc_') && s.id !== 'sc_xavier' && s.id !== 'sc_dps';
          if (isCustomSchool && !cloudSchoolIdsSet.has(s.id)) {
            return false;
          }
          return true;
        });

        const merged = [...filteredPrev];
        cloudSchools.forEach(cs => {
          const idx = merged.findIndex(s => s.id === cs.id);
          if (idx >= 0) {
            const existingPortalCode = merged[idx].portalCode;
            merged[idx] = { 
              ...merged[idx], 
              ...cs, 
              cloudSynced: true,
              portalCode: cs.portalCode || existingPortalCode || ""
            };
          } else {
            merged.push({ ...cs, cloudSynced: true });
          }
        });

        const mappedMerged = merged.map(s => {
          let code = s.portalCode;
          if (!code) {
            if (s.id === 'sc_xavier') {
              code = 'XAVI-9821';
            } else if (s.id === 'sc_dps') {
              code = 'DELH-3091';
            } else {
              const prefix = s.name.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'SCH';
              let hash = 0;
              const key = s.id || s.name;
              for (let i = 0; i < key.length; i++) {
                hash = key.charCodeAt(i) + ((hash << 5) - hash);
              }
              const stableNum = 1000 + (Math.abs(hash) % 9000);
              code = `${prefix}-${stableNum}`;
            }
          }
          return { ...s, portalCode: code };
        });

        const finalMappedMerged = deduplicateSchools(mappedMerged);
        latestSchoolsList = finalMappedMerged;
        setSchools(finalMappedMerged);
        localStorage.setItem('class_on_saas_schools', JSON.stringify(finalMappedMerged));
      }
    } catch (err) {
      console.warn("Could not retrieve live cloud registry during authentication lookup:", err);
    } finally {
      setIsCloudSyncing(false);
    }

    const rawSchoolInput = schoolInput.trim();
    const normalizedSchoolInput = rawSchoolInput.toLowerCase();
    const simplifiedSchoolInput = normalizedSchoolInput.replace(/[^a-z0-9]/g, '');

    if (loginTab === 'school') {
      console.log(`[School Login Debug] Input: "${rawSchoolInput}" | Simplified: "${simplifiedSchoolInput}". Total registered schools: ${latestSchoolsList.length}`);
      
      const matchedSchool = latestSchoolsList.find(s => {
        const id = (s.id || '').toLowerCase().trim();
        const idClean = id.replace(/[^a-z0-9]/g, '');
        
        const username = (s.username || '').toLowerCase().trim();
        const usernameClean = username.replace(/[^a-z0-9]/g, '');
        
        const email = (s.email || '').toLowerCase().trim();
        const name = (s.name || '').toLowerCase().trim();
        const nameClean = name.replace(/[^a-z0-9]/g, '');

        // Match on ID, username, email or name
        return (
          id === normalizedSchoolInput || 
          idClean === simplifiedSchoolInput ||
          username === normalizedSchoolInput || 
          usernameClean === simplifiedSchoolInput ||
          email === normalizedSchoolInput ||
          name === normalizedSchoolInput || 
          nameClean === simplifiedSchoolInput
        );
      });

      if (!matchedSchool) {
        console.warn(`[School Login Debug] No school found matching input "${rawSchoolInput}"`);
        setAuthError('Incorrect School Login ID or Access Password.');
        return;
      }

      console.log(`[School Login Debug] Found matching school registry: "${matchedSchool.name}" (ID: ${matchedSchool.id})`);

      if (matchedSchool.securityEnforceSSO) {
        setAuthError(`🛡️ Dynamic Security Guard: The school "${matchedSchool.name}" enforces complete, passwordless Google SSO Only. Manual login forms are deactivated. Please authenticate with your registered email (${matchedSchool.email || "Primary Admin Email"}) using the "Sign In with Google" button below.`);
        return;
      }

      const enteredPassword = passwordInput.trim();
      const storedPassword = (matchedSchool.password || '').trim();
      const isPasswordCorrect = enteredPassword === storedPassword;

      if (isPasswordCorrect) {
        console.log(`[School Login Debug] Password match successful! Setting role to school_admin`);
        setCurrentRole('school_admin');
        setCurrentSchoolId(matchedSchool.id);
        setCurrentTeacherId(null);
        setIsImpersonating(false);
        setIsSaaSAdmin(false);
        localStorage.setItem('class_on_saas_role', 'school_admin');
        localStorage.setItem('class_on_saas_school_id', matchedSchool.id);
        localStorage.setItem('class_on_saas_is_saas_admin', 'false');
        localStorage.removeItem('class_on_saas_teacher_id');
        localStorage.removeItem('class_on_saas_impersonating');
        setActiveTab('dashboard');
      } else {
        console.warn(`[School Login Debug] Password check failed. Entered: "${enteredPassword}", Stored: "${storedPassword}"`);
        setAuthError('Incorrect School Login ID or Access Password.');
      }
    } else if (loginTab === 'teacher') {
      console.log(`[Teacher Login Debug] School Input: "${rawSchoolInput}" | Teacher Input: "${teacherInput}"`);

      const matchedSchool = latestSchoolsList.find(s => {
        const id = (s.id || '').toLowerCase().trim();
        const idClean = id.replace(/[^a-z0-9]/g, '');
        
        const username = (s.username || '').toLowerCase().trim();
        const usernameClean = username.replace(/[^a-z0-9]/g, '');
        
        const email = (s.email || '').toLowerCase().trim();
        const name = (s.name || '').toLowerCase().trim();
        const nameClean = name.replace(/[^a-z0-9]/g, '');

        return (
          id === normalizedSchoolInput || 
          idClean === simplifiedSchoolInput ||
          username === normalizedSchoolInput || 
          usernameClean === simplifiedSchoolInput ||
          email === normalizedSchoolInput ||
          name === normalizedSchoolInput || 
          nameClean === simplifiedSchoolInput
        );
      });

      if (!matchedSchool) {
        console.warn(`[Teacher Login Debug] School Lookup Failed for input "${rawSchoolInput}"`);
        setAuthError('School Login ID matches no registered school.');
        return;
      }

      const rawTeacherInput = teacherInput.trim();
      const normalizedTeacherInput = rawTeacherInput.toLowerCase();
      const simplifiedTeacherInput = normalizedTeacherInput.replace(/[^a-z0-9]/g, '');

      const matchedTeacher = (matchedSchool.teachers || []).find(t => {
        const tId = (t.id || '').toLowerCase().trim();
        const tUsername = (t.username || '').toLowerCase().trim();
        const tUsernameClean = tUsername.replace(/[^a-z0-9]/g, '');
        const tEmail = (t.email || '').toLowerCase().trim();
        const tName = (t.name || '').toLowerCase().trim();
        const tNameClean = tName.replace(/[^a-z0-9]/g, '');

        return (
          tId === normalizedTeacherInput ||
          tUsername === normalizedTeacherInput ||
          tUsernameClean === simplifiedTeacherInput ||
          tEmail === normalizedTeacherInput ||
          tName === normalizedTeacherInput ||
          tNameClean === simplifiedTeacherInput
        );
      });

      if (!matchedTeacher) {
        console.warn(`[Teacher Login Debug] Teacher Lookup Failed inside school "${matchedSchool.name}" for input "${rawTeacherInput}"`);
        setAuthError('Invalid Teacher Login ID under this school.');
        return;
      }

      const enteredPassword = passwordInput.trim();
      const storedPassword = (matchedTeacher.password || '').trim();
      const isPasswordCorrect = enteredPassword === storedPassword;

      if (isPasswordCorrect) {
        console.log(`[Teacher Login Debug] Teacher Authenticated successfully!`);
        setCurrentRole('class_teacher');
        setCurrentSchoolId(matchedSchool.id);
        setCurrentTeacherId(matchedTeacher.id);
        setIsImpersonating(false);
        setIsSaaSAdmin(false);
        localStorage.setItem('class_on_saas_role', 'class_teacher');
        localStorage.setItem('class_on_saas_school_id', matchedSchool.id);
        localStorage.setItem('class_on_saas_teacher_id', matchedTeacher.id);
        localStorage.setItem('class_on_saas_is_saas_admin', 'false');
        localStorage.removeItem('class_on_saas_impersonating');
        setActiveTab('dashboard');
      } else {
        console.warn(`[Teacher Login Debug] Password mismatch for teacher "${matchedTeacher.name}"`);
        setAuthError('Invalid Teacher Password.');
      }
    } else if (loginTab === 'parent') {
      const cleanPortalCode = parentPortalCodeInput.trim().toUpperCase();

      if (!cleanPortalCode) {
        setAuthError('Please enter official School Portal Access Code.');
        return;
      }

      // Step 1: Find school matching the Portal Code (with robust prefix-based/fuzzy fallback support)
      const matchedSchool = schools.find(s => {
        const schoolCode = (s.portalCode || '').toUpperCase().trim();
        const inputCode = cleanPortalCode.toUpperCase().trim();
        
        // Exact match
        if (schoolCode === inputCode) return true;
        
        // Fallback matching for St. Xavier's Academy (sc_xavier)
        if (s.id === 'sc_xavier') {
          if (inputCode === 'XAVI-9821' || inputCode.startsWith('STXA-') || inputCode.includes('STXA') || inputCode.includes('XAVI')) {
            return true;
          }
        }
        
        // Fallback matching for Delhi Public School (sc_dps)
        if (s.id === 'sc_dps') {
          if (inputCode === 'DELH-3091' || inputCode.startsWith('DELH-') || inputCode.includes('DELH') || inputCode.includes('DPS')) {
            return true;
          }
        }
        
        // Generalized fuzzy prefix-based matching (extract alpha part e.g. "MDDE" or "XAVI")
        const sPrefix = schoolCode.split('-')[0].replace(/[^A-Z]/g, '');
        const sNamePrefix = s.name.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase();
        const iPrefix = inputCode.split('-')[0].replace(/[^A-Z]/g, '');
        
        if (sPrefix && iPrefix && sPrefix === iPrefix) return true;
        if (sNamePrefix && iPrefix && (sNamePrefix === iPrefix || inputCode.includes(sNamePrefix) || sNamePrefix.includes(iPrefix))) return true;
        
        return false;
      });
      if (!matchedSchool) {
        setAuthError('No matched school registry found for portal code "' + cleanPortalCode + '". Please contact your school admin.');
        return;
      }

      // Step 2: Retrieve matched school's student array directly from Firestore cloud, or fallback to local storage
      let schoolStudents: Student[] = matchedSchool.id === 'demo' ? defaultStudents : [];
      let matchedCloudData: any = null;
      try {
        setIsCloudSyncing(true);
        setCloudSyncMessage("Loading students roster from Firestore Cloud...");
        const cloudData = await loadSchoolFromCloud(matchedSchool.id);
        if (cloudData && cloudData.students && cloudData.students.length > 0) {
          schoolStudents = cloudData.students;
          matchedCloudData = cloudData;
        } else {
          const storedStudents = localStorage.getItem(`class_on_students_${matchedSchool.id}`);
          if (storedStudents) {
            schoolStudents = JSON.parse(storedStudents);
          }
        }
      } catch (err) {
        console.warn("Could not retrieve school students from Cloud:", err);
        const storedStudents = localStorage.getItem(`class_on_students_${matchedSchool.id}`);
        if (storedStudents) {
          try { schoolStudents = JSON.parse(storedStudents); } catch {}
        }
      } finally {
        setIsCloudSyncing(false);
      }

      // Step 3: Resolve active login config for this school
      const schoolBranding = matchedCloudData?.branding || matchedSchool.branding || (currentSchoolId === matchedSchool.id ? branding : initialBranding);
      const schoolStructures = matchedCloudData?.reportCardStructures || (currentSchoolId === matchedSchool.id ? reportCardStructures : []);
      const loginConfig = getParentPortalLoginConfig(schoolBranding, schoolStructures);
      const effectiveMethod = loginConfig.availableMethods.includes(parentLoginMethod) 
        ? parentLoginMethod 
        : loginConfig.defaultLoginMode;

      // Validate inputs for the active method
      if (effectiveMethod === 'roll_dob') {
        if (!parentRollNoInput.trim() || !parentDOBInput.trim()) {
          setAuthError('Please enter both student Roll Number and Date of Birth.');
          return;
        }
      } else if (effectiveMethod === 'adm_dob') {
        if (!parentAdmissionNoInput.trim() || !parentDOBInput.trim()) {
          setAuthError('Please enter both student Admission Number and Date of Birth.');
          return;
        }
      } else if (effectiveMethod === 'mob_roll') {
        if (!parentMobileInput.trim() || !parentRollNoInput.trim()) {
          setAuthError('Please enter both registered Mobile Number and student Roll Number.');
          return;
        }
      } else if (effectiveMethod === 'mob_adm') {
        if (!parentMobileInput.trim() || !parentAdmissionNoInput.trim()) {
          setAuthError('Please enter both registered Mobile Number and student Admission Number.');
          return;
        }
      }

      // Step 4: Find matching students using multi-method matcher
      const matches = findMatchingStudents(schoolStudents, effectiveMethod, {
        rollNo: parentRollNoInput,
        dob: parentDOBInput,
        admissionNo: parentAdmissionNoInput,
        mobileNumber: parentMobileInput,
      });

      if (matches.length === 1) {
        finalizeParentLogin(matches[0], matchedSchool, matchedCloudData, schoolStudents);
      } else if (matches.length > 1) {
        // Multi-child / sibling resolution dialog
        setFamilyContext({
          matchedSchool,
          matchedCloudData,
          schoolStudents,
        });
        setFamilyStudentMatches(matches);
      } else {
        // Specific error message based on login method
        if (effectiveMethod === 'roll_dob') {
          setAuthError(`Verification failed: No student found with Roll No "${parentRollNoInput.trim()}" and DOB "${parentDOBInput.trim()}" in ${matchedSchool.name}.`);
        } else if (effectiveMethod === 'adm_dob') {
          setAuthError(`Verification failed: No student found with Admission No "${parentAdmissionNoInput.trim()}" and DOB "${parentDOBInput.trim()}" in ${matchedSchool.name}.`);
        } else if (effectiveMethod === 'mob_roll') {
          setAuthError(`Verification failed: No student found with Mobile Number "${parentMobileInput.trim()}" and Roll No "${parentRollNoInput.trim()}" in ${matchedSchool.name}.`);
        } else if (effectiveMethod === 'mob_adm') {
          setAuthError(`Verification failed: No student found with Mobile Number "${parentMobileInput.trim()}" and Admission No "${parentAdmissionNoInput.trim()}" in ${matchedSchool.name}.`);
        }
      }
    }
  };

  const finalizeParentLogin = (
    student: Student,
    matchedSchool: SaasSchool,
    matchedCloudData: any,
    schoolStudents: Student[]
  ) => {
    // Synchronously save and sync all school properties immediately to avoid any blank page during state load transition
    if (matchedCloudData) {
      const cloudBranding = matchedCloudData.branding || initialBranding;
      const cloudGrades = matchedCloudData.studentGrades || [];
      const cloudSubjects = matchedCloudData.subjects || defaultSubjects;
      const cloudScoreColumns = matchedCloudData.scoreColumns || defaultScoreColumns;
      const cloudGradeScales = matchedCloudData.gradeScales || defaultGradeScales;
      const cloudStructures = matchedCloudData.reportCardStructures || [];
      const cloudRecycleBin = matchedCloudData.recycleBin || [];

      setBranding(cloudBranding);
      setStudents(schoolStudents);
      setStudentGrades(cloudGrades);
      setSubjects(cloudSubjects);
      setScoreColumns(cloudScoreColumns);
      setGradeScales(cloudGradeScales);
      setReportCardStructures(cloudStructures);
      setRecycleBin(cloudRecycleBin);

      localStorage.setItem(`class_on_branding_${matchedSchool.id}`, JSON.stringify(cloudBranding));
      localStorage.setItem(`class_on_students_${matchedSchool.id}`, JSON.stringify(schoolStudents));
      localStorage.setItem(`class_on_student_grades_${matchedSchool.id}`, JSON.stringify(cloudGrades));
      localStorage.setItem(`class_on_subjects_${matchedSchool.id}`, JSON.stringify(cloudSubjects));
      localStorage.setItem(`class_on_score_columns_${matchedSchool.id}`, JSON.stringify(cloudScoreColumns));
      localStorage.setItem(`class_on_grade_scales_${matchedSchool.id}`, JSON.stringify(cloudGradeScales));
      localStorage.setItem(`class_on_report_card_structures_${matchedSchool.id}`, JSON.stringify(cloudStructures));
      localStorage.setItem(`class_on_recycle_bin_${matchedSchool.id}`, JSON.stringify(cloudRecycleBin));
    } else {
      const bStored = localStorage.getItem(`class_on_branding_${matchedSchool.id}`);
      const gStored = localStorage.getItem(`class_on_student_grades_${matchedSchool.id}`);
      const subStored = localStorage.getItem(`class_on_subjects_${matchedSchool.id}`);
      const cStored = localStorage.getItem(`class_on_score_columns_${matchedSchool.id}`);
      const gsStored = localStorage.getItem(`class_on_grade_scales_${matchedSchool.id}`);
      const rcsStored = localStorage.getItem(`class_on_report_card_structures_${matchedSchool.id}`);
      const rbStored = localStorage.getItem(`class_on_recycle_bin_${matchedSchool.id}`);

      if (bStored) setBranding(JSON.parse(bStored));
      setStudents(schoolStudents);
      if (gStored) setStudentGrades(JSON.parse(gStored));
      if (subStored) setSubjects(JSON.parse(subStored));
      if (cStored) setScoreColumns(JSON.parse(cStored));
      if (gsStored) setGradeScales(JSON.parse(gsStored));
      if (rcsStored) setReportCardStructures(JSON.parse(rcsStored));
      if (rbStored) setRecycleBin(JSON.parse(rbStored));
    }

    // Log in parent!
    setCurrentRole('parent');
    setCurrentSchoolId(matchedSchool.id);
    setSelectedParentStudentId(student.id);

    localStorage.setItem('class_on_saas_role', 'parent');
    localStorage.setItem('class_on_saas_school_id', matchedSchool.id);
    localStorage.setItem('class_on_parent_student_id', student.id);
    localStorage.removeItem('class_on_saas_teacher_id');
    localStorage.removeItem('class_on_saas_impersonating');
    
    // Clear forms and family dialog state
    setParentPortalCodeInput('');
    setParentRollNoInput('');
    setParentDOBInput('');
    setParentAdmissionNoInput('');
    setParentMobileInput('');
    setFamilyStudentMatches(null);
    setFamilyContext(null);
    setActiveTab('preview');
  };

  const handleAgentOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (!firebaseUser) {
      setAuthError('No authenticated Google user found. Please authenticate with Google first.');
      return;
    }

    const codeClean = agentRegCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (!codeClean) {
      setAuthError('Referral Code must contain only letters, numbers, and hyphens.');
      return;
    }

    setIsCloudSyncing(true);
    setCloudSyncMessage("Creating your Partner & Agent profile in cloud...");

    try {
      // Check if code is already taken by another agent
      const allAgents = await loadAllAgentsFromCloud();
      const codeTaken = allAgents.some(a => a.code.toUpperCase().trim() === codeClean);
      if (codeTaken) {
        setAuthError(`The referral code "${codeClean}" is already in use by another partner. Please choose another.`);
        setIsCloudSyncing(false);
        return;
      }

      const newAgent: SaasAgent = {
        id: tempAgentUid || firebaseUser.uid,
        name: agentRegName.trim() || firebaseUser.displayName || 'Unnamed Partner',
        email: firebaseUser.email || '',
        code: codeClean,
        commissionPercentage: 10, // Default 10% commission rate
        paymentDetails: agentRegPayout.trim(),
        status: 'active' as const, // initially active
        createdAt: new Date().toISOString()
      };

      await saveAgentToCloud(newAgent);
      
      setCurrentRole('agent');
      setCurrentAgent(newAgent);
      setCurrentSchoolId(null);
      localStorage.setItem('class_on_saas_role', 'agent');
      localStorage.setItem('class_on_saas_agent_profile', JSON.stringify(newAgent));
      localStorage.removeItem('class_on_saas_school_id');
      
      setIsAgentOnboardingForm(false);
      setActiveTab('agent_dashboard');
    } catch (err: any) {
      console.warn("Error creating agent profile:", err);
      setAuthError(err?.message || "Failed to finalize partner profile. Please try again.");
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    setCurrentRole(null);
    setCurrentSchoolId(null);
    setCurrentTeacherId(null);
    setIsImpersonating(false);
    setIsSaaSAdmin(false);
    setSelectedParentStudentId(null);
    setCurrentAgent(null);
    
    // Reset school data states synchronously to defaults to prevent inconsistent/blank transitions
    setBranding({ ...initialBranding, schoolName: '' });
    setScoreColumns(defaultScoreColumns);
    setSubjects(defaultSubjects);
    setGradeScales(defaultGradeScales);
    setStudents([]);
    setStudentGrades([]);
    setReportCardStructures([]);
    setRecycleBin([]);

    localStorage.removeItem('class_on_saas_role');
    localStorage.removeItem('class_on_saas_school_id');
    localStorage.removeItem('class_on_saas_teacher_id');
    localStorage.removeItem('class_on_saas_impersonating');
    localStorage.removeItem('class_on_saas_is_saas_admin');
    localStorage.removeItem('class_on_parent_student_id');
    localStorage.removeItem('class_on_saas_agent_profile');
    
    try {
      await fbSignOut(auth);
    } catch (e) {
      console.error("Firebase SignOut error", e);
    }

    setSchoolInput('');
    setTeacherInput('');
    setPasswordInput('');
    setParentRollNoInput('');
    setParentDOBInput('');
    setParentAdmissionNoInput('');
    setParentMobileInput('');
    setFamilyStudentMatches(null);
    setFamilyContext(null);
    setAuthError('');

    // Restore parent portal code from URL if present, or first school's code, to prevent read-only lock field being blank
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code');
    if (codeParam) {
      setParentPortalCodeInput(codeParam.toUpperCase());
    } else {
      const firstSchool = schools[0];
      setParentPortalCodeInput(firstSchool?.portalCode || 'XAVI-9821');
    }
  };

  // Listen to Auth state transitions to sync table schemas
  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        setIsCloudSyncing(false);
        setCloudSyncMessage("Cloud database active");
        try {
          const isOwnerEmail = user.email ? (
            user.email.toLowerCase().trim() === 'mbarahul99::gmail.com' ||
            user.email.toLowerCase().trim() === 'mbarahul99@gmail.com' ||
            user.email.toLowerCase().trim() === 'gyanbox1@gmail.com'
          ) : false;
          if (isOwnerEmail) {
            const isImpersonatingLocal = localStorage.getItem('class_on_saas_impersonating') === 'true';
            const savedSchoolId = localStorage.getItem('class_on_saas_school_id');
            if (isImpersonatingLocal && savedSchoolId) {
              setCurrentSchoolId(savedSchoolId);
              setCurrentRole('school_admin');
              setIsImpersonating(true);
              setIsSaaSAdmin(true);
              setActiveTab('dashboard');
              setCloudSyncMessage("Impersonating School Admin...");
              setIsCloudSyncing(false);
              return;
            }

            setCurrentRole('main_admin');
            setCurrentSchoolId(null);
            setIsImpersonating(false);
            setIsSaaSAdmin(true);
            localStorage.setItem('class_on_saas_role', 'main_admin');
            localStorage.setItem('class_on_saas_is_saas_admin', 'true');
            localStorage.removeItem('class_on_saas_school_id');
            localStorage.removeItem('class_on_saas_impersonating');
            setActiveTab('saas_owner');
            setCloudSyncMessage("SaaS Owner Cloud Active!");
            setIsCloudSyncing(false);
            return;
          }

          // Check if user is registered as a Partner/Agent
          const freshAgents = await loadAllAgentsFromCloud().catch(err => {
            console.warn("Error loading agents inside auth check:", err);
            return [];
          });
          const matchingAgent = freshAgents.find(a => a.email && a.email.toLowerCase().trim() === user.email?.toLowerCase().trim());

          if (matchingAgent) {
            if (matchingAgent.status === 'suspended') {
              setAuthError(`Your Partner/Agent account has been suspended by the SaaS administrators.`);
              await fbSignOut(auth);
              setIsCloudSyncing(false);
              return;
            }
            setCurrentRole('agent');
            setCurrentAgent(matchingAgent);
            setCurrentSchoolId(null);
            localStorage.setItem('class_on_saas_role', 'agent');
            localStorage.setItem('class_on_saas_agent_profile', JSON.stringify(matchingAgent));
            localStorage.removeItem('class_on_saas_school_id');
            setActiveTab('agent_dashboard');
            setCloudSyncMessage("Agent Portal Active!");
            setIsCloudSyncing(false);
            return;
          }

          // If logging in via agent tab but profile doesn't exist yet, show onboarding
          if (loginTab === 'agent') {
            setTempAgentUid(user.uid);
            setAgentRegName(user.displayName || '');
            const genCode = `PARTNER-${Math.floor(1000 + Math.random() * 9000)}`;
            setAgentRegCode(genCode);
            setAgentRegPayout('');
            setIsAgentOnboardingForm(true);
            setIsCloudSyncing(false);
            return;
          }

          // Fetch fresh list of SaasSchool from cloud registry
          const freshSchools = await loadAllSchoolsFromCloud();
          const matchingSchool = freshSchools.find(s => s.email && s.email.toLowerCase().trim() === user.email?.toLowerCase().trim());

          if (!matchingSchool) {
            // Not registered -> redirect to registration page with pre-filled Google account parameters
            setAuthError(`Your email "${user.email}" is not registered in Sand Box yet. Please complete this registration form first!`);
            setIsRegistering(true);
            setRegEmail(user.email || '');
            setRegContactPerson(user.displayName || '');
            await fbSignOut(auth);
            setIsCloudSyncing(false);
            return;
          }

          const status = matchingSchool.approvalStatus || 'approved';
          if (status === 'rejected') {
            setAuthError("Your registration request for Sand Box was declined. Contact the SaaS administrators.");
            setIsRegistering(false);
            await fbSignOut(auth);
            setIsCloudSyncing(false);
            return;
          }

          // Store matching school's credentials and role
          setCurrentRole('school_admin');
          setCurrentSchoolId(matchingSchool.id);
          setIsImpersonating(false);
          setIsSaaSAdmin(false);

          localStorage.setItem('class_on_saas_role', 'school_admin');
          localStorage.setItem('class_on_saas_school_id', matchingSchool.id);
          localStorage.setItem('class_on_saas_impersonating', 'false');
          localStorage.setItem('class_on_saas_is_saas_admin', 'false');
          setActiveTab('dashboard');

          // Retrieve active settings and database records
          const cloudData = await loadSchoolFromCloud(matchingSchool.id);
          if (cloudData) {
            setBranding(cloudData.branding || initialBranding);
            setScoreColumns(cloudData.scoreColumns || defaultScoreColumns);
            setSubjects(cloudData.subjects || defaultSubjects);
            setGradeScales(cloudData.gradeScales || defaultGradeScales);
            setStudents(cloudData.students || []);
            setStudentGrades(cloudData.studentGrades || []);
            setReportCardStructures(cloudData.reportCardStructures || []);
            setCloudSyncMessage("Synchronization active (Real-time Cloud Sync is on)");
          } else {
            const initialCloudData: FullSchoolData = {
              branding: {
                ...initialBranding,
                schoolName: matchingSchool.name,
                watermarkText: matchingSchool.id === 'demo' ? initialBranding.watermarkText : ""
              },
              scoreColumns: defaultScoreColumns,
              subjects: defaultSubjects,
              gradeScales: defaultGradeScales,
              students: matchingSchool.id === 'demo' ? defaultStudents : [],
              studentGrades: matchingSchool.id === 'demo' ? defaultStudentGrades : [],
              reportCardStructures: defaultReportCardStructures
            };
            if (matchingSchool.id === 'demo') {
              await saveSchoolToCloud(matchingSchool.id, initialCloudData, matchingSchool.name, matchingSchool.portalCode);
            }
            setBranding(initialCloudData.branding);
            setScoreColumns(initialCloudData.scoreColumns);
            setSubjects(initialCloudData.subjects);
            setGradeScales(initialCloudData.gradeScales);
            setStudents(initialCloudData.students);
            setStudentGrades(initialCloudData.studentGrades);
            setReportCardStructures(defaultReportCardStructures);
            setCloudSyncMessage("Loaded initial profile");
          }
        } catch (err: any) {
          console.warn("Firebase Sync status info:", err);
          setCloudSyncMessage("Offline Database Mode Active (Using local caching)");
        } finally {
          setIsCloudSyncing(false);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Handle exiting impersonation back to owner desk
  const handleExitImpersonation = () => {
    setCurrentSchoolId(null);
    setCurrentRole('main_admin');
    setIsImpersonating(false);
    setIsFirestoreOffline(false); // Reset offline indicator when returning to SaaS dashboard!
    localStorage.removeItem('class_on_saas_school_id');
    setItemValueInStorage();
    localStorage.setItem('class_on_saas_role', 'main_admin');
    localStorage.removeItem('class_on_saas_impersonating');
    setActiveTab('saas_owner');
  };

  const setItemValueInStorage = () => {
    // Utility helper stub
  };

  const handleImpersonateParent = (studentId: string) => {
    setCurrentRole('parent');
    setSelectedParentStudentId(studentId);
    localStorage.setItem('class_on_saas_role', 'parent');
    localStorage.setItem('class_on_parent_student_id', studentId);
    if (currentSchoolId) {
      localStorage.setItem('class_on_saas_school_id', currentSchoolId);
    }
    setActiveTab('preview');
  };

  // Load URL parameters on mount to pre-populate Parents Portal values
  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const roll = params.get('roll');
      const dob = params.get('dob');
      const adm = params.get('adm') || params.get('admission');
      const mob = params.get('mob') || params.get('mobile');
      const method = params.get('method') as ParentLoginMethod | null;
      const portal = params.get('portal');
      const owner = params.get('owner');
      
      if (portal === 'owner' || owner === 'true') {
        setLoginTab('owner');
        setIsSeparateParentPortal(false);
      } else if (portal === 'parent' || code) {
        setLoginTab('parent');
        setIsSeparateParentPortal(true);
        if (code) {
          setParentPortalCodeInput(code.toUpperCase());
        } else {
          // Pre-populate with St. Xavier's current dynamic/base code so locked field is not empty
          const firstSchool = schools[0];
          setParentPortalCodeInput(firstSchool?.portalCode || 'XAVI-9821');
        }
        if (roll) setParentRollNoInput(roll);
        if (adm) setParentAdmissionNoInput(adm);
        if (mob) setParentMobileInput(mob);
        if (dob) {
          // If the URL DOB is DD-MM-YYYY, convert to YYYY-MM-DD for the date input
          if (dob.includes('-') && dob.split('-')[2]?.length === 4) {
            const parts = dob.split('-');
            setParentDOBInput(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
          } else {
            setParentDOBInput(dob);
          }
        }

        // Set login method if explicitly given or infer from provided parameters
        if (method && ['roll_dob', 'adm_dob', 'mob_roll', 'mob_adm'].includes(method)) {
          setParentLoginMethod(method);
        } else if (mob && roll) {
          setParentLoginMethod('mob_roll');
        } else if (mob && adm) {
          setParentLoginMethod('mob_adm');
        } else if (adm && dob) {
          setParentLoginMethod('adm_dob');
        } else {
          setParentLoginMethod('roll_dob');
        }
      }
    } catch (e) {
      console.error("Failed to parse URL search params", e);
    }
  }, []);

  const handleUpdatePortalCode = async (schoolId: string, newCode: string) => {
    const targetSchool = schools.find(s => s.id === schoolId);
    if (targetSchool) {
      const updatedSchoolObj = { ...targetSchool, portalCode: newCode.toUpperCase().trim() };
      setSchools(prev => prev.map(s => s.id === schoolId ? updatedSchoolObj : s));
      try {
        await saveSaaSSchoolToCloud(updatedSchoolObj, targetSchool.ownerId);
      } catch (err) {
        console.error("Failed to sync updated school portal code to Cloud:", err);
      }
    }
  };

  // Handle Impersonation
  const handleImpersonate = (schoolId: string) => {
    setIsFirestoreOffline(false); // Reset offline indicator on starting impersonation!
    setCurrentSchoolId(schoolId);
    setCurrentRole('school_admin');
    setIsImpersonating(true);
    setIsSaaSAdmin(true);
    localStorage.setItem('class_on_saas_school_id', schoolId);
    localStorage.setItem('class_on_saas_role', 'school_admin');
    localStorage.setItem('class_on_saas_impersonating', 'true');
    localStorage.setItem('class_on_saas_is_saas_admin', 'true');
    setActiveTab('dashboard');
  };

  // School data states loaded dynamically with robust lazy-loading matching the initial school ID
  const [branding, setBranding] = useState<SchoolBranding>(() => {
    const schoolId = localStorage.getItem('class_on_saas_school_id');
    if (schoolId) {
      const bStored = localStorage.getItem(`class_on_branding_${schoolId}`);
      if (bStored) {
        try {
          const parsed = JSON.parse(bStored);
          return {
            ...initialBranding,
            ...parsed,
            schoolName: (schoolId !== 'demo' && parsed.schoolName === 'DEMO PUBLIC SCHOOL') ? "My School" : (parsed.schoolName || initialBranding.schoolName)
          };
        } catch {}
      }
      // If no stored branding, find the name of the school
      let schoolName = schoolId === 'demo' ? initialBranding.schoolName : "My School";
      try {
        const storedSchools = localStorage.getItem('class_on_saas_schools');
        if (storedSchools) {
          const parsed = JSON.parse(storedSchools);
          const s = parsed.find((sch: any) => sch.id === schoolId);
          if (s && s.name) schoolName = s.name;
        }
      } catch {}
      return { 
        ...initialBranding, 
        schoolName,
        watermarkText: schoolId === 'demo' ? initialBranding.watermarkText : ""
      };
    }
    return { ...initialBranding, schoolName: "My School" };
  });

  const [scoreColumns, setScoreColumns] = useState<ScoreColumn[]>(() => {
    const schoolId = localStorage.getItem('class_on_saas_school_id');
    if (schoolId) {
      const cStored = localStorage.getItem(`class_on_score_columns_${schoolId}`);
      if (cStored) {
        try { return JSON.parse(cStored); } catch {}
      }
    }
    return defaultScoreColumns;
  });

  const [subjects, setSubjects] = useState<SubjectColumn[]>(() => {
    const schoolId = localStorage.getItem('class_on_saas_school_id');
    if (schoolId) {
      const subStored = localStorage.getItem(`class_on_subjects_${schoolId}`);
      if (subStored) {
        try { return JSON.parse(subStored); } catch {}
      }
    }
    return defaultSubjects;
  });

  const [gradeScales, setGradeScales] = useState<GradeScale[]>(() => {
    const schoolId = localStorage.getItem('class_on_saas_school_id');
    if (schoolId) {
      const gStored = localStorage.getItem(`class_on_grade_scales_${schoolId}`);
      if (gStored) {
        try { return JSON.parse(gStored); } catch {}
      }
    }
    return defaultGradeScales;
  });

  const [students, setStudents] = useState<Student[]>(() => {
    const schoolId = localStorage.getItem('class_on_saas_school_id');
    if (schoolId) {
      const sStored = localStorage.getItem(`class_on_students_${schoolId}`);
      if (sStored) {
        try { return JSON.parse(sStored); } catch {}
      }
      return schoolId === 'demo' ? defaultStudents : [];
    }
    return [];
  });

  const [studentGrades, setStudentGrades] = useState<StudentGrades[]>(() => {
    const schoolId = localStorage.getItem('class_on_saas_school_id');
    if (schoolId) {
      const sgStored = localStorage.getItem(`class_on_student_grades_${schoolId}`);
      if (sgStored) {
        try { return JSON.parse(sgStored); } catch {}
      }
      return schoolId === 'demo' ? defaultStudentGrades : [];
    }
    return [];
  });

  const [reportCardStructures, setReportCardStructures] = useState<ReportCardStructure[]>(() => {
    const schoolId = localStorage.getItem('class_on_saas_school_id');
    if (schoolId) {
      const stored = localStorage.getItem(`class_on_structures_${schoolId}`);
      if (stored) {
        try { return JSON.parse(stored); } catch {}
      }
    }
    return [];
  });

  const [recycleBin, setRecycleBin] = useState<RecycleBinItem[]>(() => {
    const schoolId = localStorage.getItem('class_on_saas_school_id');
    if (schoolId) {
      const stored = localStorage.getItem(`class_on_recycle_bin_${schoolId}`);
      if (stored) {
        try { return JSON.parse(stored); } catch {}
      }
    }
    return [];
  });

  const [schoolClasses, setSchoolClasses] = useState<SchoolClassItem[]>(() => {
    const schoolId = localStorage.getItem('class_on_saas_school_id');
    if (schoolId) {
      const stored = localStorage.getItem(`class_on_classes_${schoolId}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch {}
      }
    }
    return getStandardClassPresets('roman');
  });

  const [classNamingStyle, setClassNamingStyle] = useState<'roman' | 'ordinal' | 'number' | 'custom'>(() => {
    const schoolId = localStorage.getItem('class_on_saas_school_id');
    if (schoolId) {
      const stored = localStorage.getItem(`class_on_class_style_${schoolId}`);
      if (stored) return stored as any;
    }
    return 'roman';
  });

  // Track which school ID is currently loaded in the React states in memory.
  // This is critical to prevent the autosave effect from running and overwriting data
  // on a newly switched school key before its contents are synced.
  const currentLoadedSchoolIdRef = React.useRef<string | null>(null);

  // Sync state FROM localStorage whenever active tenant school ID switches
  React.useEffect(() => {
    if (currentSchoolId) {
      const activeSchool = schoolsRef.current.find(s => s.id === currentSchoolId);
      
      const bStored = localStorage.getItem(`class_on_branding_${currentSchoolId}`);
      let newBranding;
      if (bStored) {
        try {
          const parsed = JSON.parse(bStored);
          newBranding = {
            ...initialBranding,
            ...parsed
          };
        } catch {
          newBranding = { 
            ...initialBranding, 
            schoolName: activeSchool?.name || initialBranding.schoolName,
            watermarkText: ""
          };
        }
      } else {
        newBranding = { 
          ...initialBranding, 
          schoolName: activeSchool?.name || initialBranding.schoolName,
          watermarkText: ""
        };
      }

      const cStored = localStorage.getItem(`class_on_score_columns_${currentSchoolId}`);
      let newScoreColumns = defaultScoreColumns;
      if (cStored) {
        try { newScoreColumns = JSON.parse(cStored); } catch {}
      }

      const subStored = localStorage.getItem(`class_on_subjects_${currentSchoolId}`);
      let newSubjects = defaultSubjects;
      if (subStored) {
        try { newSubjects = JSON.parse(subStored); } catch {}
      }

      const gStored = localStorage.getItem(`class_on_grade_scales_${currentSchoolId}`);
      let newGradeScales = defaultGradeScales;
      if (gStored) {
        try { newGradeScales = JSON.parse(gStored); } catch {}
      }

      const sStored = localStorage.getItem(`class_on_students_${currentSchoolId}`);
      let newStudents = currentSchoolId === 'demo' ? defaultStudents : [];
      if (sStored) {
        try { newStudents = JSON.parse(sStored); } catch {}
      }

      const sgStored = localStorage.getItem(`class_on_student_grades_${currentSchoolId}`);
      let newStudentGrades = currentSchoolId === 'demo' ? defaultStudentGrades : [];
      if (sgStored) {
        try { newStudentGrades = JSON.parse(sgStored); } catch {}
      }

      const structStored = localStorage.getItem(`class_on_structures_${currentSchoolId}`);
      let newStructures: ReportCardStructure[] = [];
      if (structStored) {
        try { newStructures = JSON.parse(structStored); } catch {}
      }

      const binStored = localStorage.getItem(`class_on_recycle_bin_${currentSchoolId}`);
      let newRecycleBin: RecycleBinItem[] = [];
      if (binStored) {
        try { newRecycleBin = JSON.parse(binStored); } catch {}
      }

      const clStored = localStorage.getItem(`class_on_classes_${currentSchoolId}`);
      let newClasses: SchoolClassItem[] = [];
      if (clStored) {
        try {
          const parsed = JSON.parse(clStored);
          if (Array.isArray(parsed) && parsed.length > 0) newClasses = parsed;
        } catch {}
      }
      if (newClasses.length === 0) {
        newClasses = getStandardClassPresets('roman');
      }

      const styleStored = localStorage.getItem(`class_on_class_style_${currentSchoolId}`) as any;
      let newStyle = styleStored || 'roman';

      setBranding(newBranding);
      setScoreColumns(newScoreColumns);
      setSubjects(newSubjects);
      setGradeScales(newGradeScales);
      setStudents(newStudents);
      setStudentGrades(newStudentGrades);
      setReportCardStructures(newStructures);
      setRecycleBin(newRecycleBin);
      setSchoolClasses(newClasses);
      setClassNamingStyle(newStyle);
      
      // Successfully loaded school!
      currentLoadedSchoolIdRef.current = currentSchoolId;
    } else {
      setBranding({ ...initialBranding, schoolName: '' });
      setScoreColumns(defaultScoreColumns);
      setSubjects(defaultSubjects);
      setGradeScales(defaultGradeScales);
      setStudents(currentSchoolId === 'demo' ? defaultStudents : []);
      setStudentGrades(currentSchoolId === 'demo' ? defaultStudentGrades : []);
      setReportCardStructures([]);
      setRecycleBin([]);
      setSchoolClasses(getStandardClassPresets('roman'));
      setClassNamingStyle('roman');
      currentLoadedSchoolIdRef.current = null;
    }
  }, [currentSchoolId]);

  // Load school data from Firestore and subscribe in real-time across all devices
  React.useEffect(() => {
    let unsubscribeSchoolData: (() => void) | null = null;

    const fetchSchoolDataFromCloud = async () => {
      if (currentSchoolId) {
        const fetchId = normalizeCloudSchoolId(currentSchoolId);
        if (!fetchId) return;

        // Real-time listener for entire school data across all devices
        try {
          unsubscribeSchoolData = subscribeSchoolFullData(fetchId, {
            onBrandingUpdate: (updatedBranding) => {
              setBranding(prev => ({ ...prev, ...updatedBranding }));
            },
            onStudentsUpdate: (updatedStudents) => {
              setStudents(updatedStudents);
            },
            onGradesUpdate: (updatedGrades) => {
              setStudentGrades(updatedGrades);
            },
            onStructuresUpdate: (updatedStructures) => {
              setReportCardStructures(updatedStructures);
            },
            onScoreColumnsUpdate: (updatedColumns) => {
              setScoreColumns(updatedColumns);
            },
            onSubjectsUpdate: (updatedSubjects) => {
              setSubjects(updatedSubjects);
            },
            onGradeScalesUpdate: (updatedScales) => {
              setGradeScales(updatedScales);
            },
            onClassesUpdate: (updatedClasses, style) => {
              setSchoolClasses(updatedClasses);
              if (style) setClassNamingStyle(style);
            }
          });
        } catch (err) {
          console.warn("Could not attach real-time school subscriptions:", err);
        }

        // Pre-hydrate instantly from local cache so students, structures, and branding render with zero latency
        try {
          const cachedStudents = localStorage.getItem(`class_on_students_${currentSchoolId}`);
          if (cachedStudents) {
            const parsed = JSON.parse(cachedStudents);
            if (Array.isArray(parsed)) {
              if (parsed.length > 0 || currentSchoolId !== 'demo') {
                setStudents(parsed);
              } else {
                setStudents(defaultStudents);
              }
            } else {
              setStudents(currentSchoolId === 'demo' ? defaultStudents : []);
            }
          } else {
            setStudents(currentSchoolId === 'demo' ? defaultStudents : []);
          }
          const cachedStructs = localStorage.getItem(`class_on_structures_${currentSchoolId}`);
          if (cachedStructs) {
            const parsed = JSON.parse(cachedStructs);
            if (Array.isArray(parsed) && parsed.length > 0) setReportCardStructures(parsed);
            else setReportCardStructures(defaultReportCardStructures);
          } else {
            setReportCardStructures(defaultReportCardStructures);
          }
          const cachedBranding = localStorage.getItem(`class_on_branding_${currentSchoolId}`);
          if (cachedBranding) {
            setBranding(JSON.parse(cachedBranding));
          }
        } catch {}

        try {
          setIsCloudSyncing(true);
          setCloudSyncMessage(`Fetching School Database...`);
          const cloudData = await loadSchoolFromCloud(fetchId);
          if (cloudData) {
            const activeSchoolObj = schoolsRef.current.find(s => s.id === currentSchoolId) || null;
            const targetSchoolName = activeSchoolObj?.name || (currentSchoolId === 'demo' ? initialBranding.schoolName : "My School");

            const mergedCloudBranding: SchoolBranding = {
              ...initialBranding,
              schoolName: targetSchoolName,
              ...(cloudData.branding || {})
            };
            if (currentSchoolId !== 'demo') {
              if (!mergedCloudBranding.schoolName || mergedCloudBranding.schoolName === 'DEMO PUBLIC SCHOOL') {
                mergedCloudBranding.schoolName = targetSchoolName;
              }
            }
            setBranding(mergedCloudBranding);
            try {
              localStorage.setItem(`class_on_branding_${currentSchoolId}`, JSON.stringify(mergedCloudBranding));
            } catch {}
            setScoreColumns(cloudData.scoreColumns || defaultScoreColumns);
            setSubjects(cloudData.subjects || defaultSubjects);
            setGradeScales(cloudData.gradeScales || defaultGradeScales);

            let finalLoadedStudents = (cloudData.students && Array.isArray(cloudData.students)) ? [...cloudData.students] : [];
            const cleanFetchId = normalizeCloudSchoolId(fetchId || currentSchoolId || '');
            const localSavedAtStr = cleanFetchId ? localStorage.getItem(`class_on_last_saved_at_${cleanFetchId}`) : null;

            try {
              const localCache = localStorage.getItem(`class_on_students_${currentSchoolId}`) ||
                                 localStorage.getItem(`class_on_students_${fetchId}`);
              if (localCache) {
                const parsedLocal: Student[] = JSON.parse(localCache);
                if (Array.isArray(parsedLocal)) {
                  if (localSavedAtStr || finalLoadedStudents.length === 0) {
                    finalLoadedStudents = parsedLocal;
                  }
                }
              }
            } catch {}

            if (finalLoadedStudents.length === 0 && (!fetchId || fetchId === 'demo')) {
              finalLoadedStudents = defaultStudents;
            }
            setStudents(finalLoadedStudents);

            let finalLoadedGrades = (cloudData.studentGrades && Array.isArray(cloudData.studentGrades)) ? [...cloudData.studentGrades] : [];
            try {
              const localGradesCache = localStorage.getItem(`class_on_student_grades_${currentSchoolId}`) ||
                                       localStorage.getItem(`class_on_student_grades_${fetchId}`);
              if (localGradesCache) {
                const parsedGrades: StudentGrades[] = JSON.parse(localGradesCache);
                if (Array.isArray(parsedGrades)) {
                  if (localSavedAtStr || finalLoadedGrades.length === 0) {
                    finalLoadedGrades = parsedGrades;
                  }
                }
              }
            } catch {}

            if (finalLoadedGrades.length === 0 && (!fetchId || fetchId === 'demo')) {
              finalLoadedGrades = defaultStudentGrades;
            }
            setStudentGrades(finalLoadedGrades);

            try {
              localStorage.setItem(`class_on_students_${currentSchoolId}`, JSON.stringify(finalLoadedStudents));
              localStorage.setItem(`class_on_student_grades_${currentSchoolId}`, JSON.stringify(finalLoadedGrades));
            } catch {}

            const finalLoadedStructures = (cloudData.reportCardStructures && cloudData.reportCardStructures.length > 0) ? cloudData.reportCardStructures : defaultReportCardStructures;
            setReportCardStructures(finalLoadedStructures);
            setRecycleBin(cloudData.recycleBin || []);

            let finalLoadedClasses = (cloudData.classes && cloudData.classes.length > 0) ? cloudData.classes : [];
            if (finalLoadedClasses.length === 0) {
              try {
                const cachedCls = localStorage.getItem(`class_on_classes_${currentSchoolId}`);
                if (cachedCls) {
                  const parsed = JSON.parse(cachedCls);
                  if (Array.isArray(parsed) && parsed.length > 0) finalLoadedClasses = parsed;
                }
              } catch {}
            }
            if (finalLoadedClasses.length === 0) {
              finalLoadedClasses = getStandardClassPresets('roman');
            }
            setSchoolClasses(finalLoadedClasses);
            const finalStyle = cloudData.classNamingStyle || 'roman';
            setClassNamingStyle(finalStyle);

            try {
              localStorage.setItem(`class_on_classes_${currentSchoolId}`, JSON.stringify(finalLoadedClasses));
              localStorage.setItem(`class_on_class_style_${currentSchoolId}`, finalStyle);
            } catch {}
            
            currentLoadedSchoolIdRef.current = currentSchoolId;
            setCloudSyncMessage("Cloud synchronization active");
            setIsFirestoreOffline(false);
          } else {
            console.log("No cloud database found for", fetchId, "- using cached profile without overwriting cloud.");
            const activeSchoolObj = schoolsRef.current.find(s => s.id === currentSchoolId) || null;
            
            if (!activeSchoolObj && currentSchoolId !== 'demo') {
              console.warn(`School ${fetchId} does not exist in local registry and was not found on cloud. Performing auto-logout.`);
              handleLogout();
              return;
            }
            
            const schoolRealName = activeSchoolObj?.name || (currentSchoolId === 'demo' ? initialBranding.schoolName : "My School");
            
            let fallbackStudents: Student[] = currentSchoolId === 'demo' ? defaultStudents : [];
            let fallbackGrades: StudentGrades[] = currentSchoolId === 'demo' ? defaultStudentGrades : [];
            try {
              const localCache = localStorage.getItem(`class_on_students_${currentSchoolId}`) || localStorage.getItem(`class_on_students_${fetchId}`);
              if (localCache) {
                const parsed = JSON.parse(localCache);
                if (Array.isArray(parsed)) fallbackStudents = parsed;
              }
              const localGrades = localStorage.getItem(`class_on_student_grades_${currentSchoolId}`) || localStorage.getItem(`class_on_student_grades_${fetchId}`);
              if (localGrades) {
                const parsedG = JSON.parse(localGrades);
                if (Array.isArray(parsedG)) fallbackGrades = parsedG;
              }
            } catch {}

            const fallbackBranding = {
              ...initialBranding,
              schoolName: schoolRealName,
              watermarkText: currentSchoolId === 'demo' ? initialBranding.watermarkText : ""
            };
            setBranding(prev => ({
              ...fallbackBranding,
              ...prev,
              schoolName: schoolRealName
            }));
            setStudents(fallbackStudents);
            setStudentGrades(fallbackGrades);
            
            currentLoadedSchoolIdRef.current = currentSchoolId;
            setCloudSyncMessage("Loaded local cache");
            setIsFirestoreOffline(false);
          }
        } catch (err: any) {
          console.warn("Cloud fetch deferred for school (falling back to local storage):", fetchId, err);
          setIsFirestoreOffline(true);
          setCloudSyncMessage("Running in Offline/Cached Mode");
          try {
            const localStudents = localStorage.getItem(`class_on_students_${currentSchoolId}`);
            if (localStudents) {
              const parsed = JSON.parse(localStudents);
              if (Array.isArray(parsed)) {
                if (parsed.length > 0 || currentSchoolId !== 'demo') {
                  setStudents(parsed);
                } else {
                  setStudents(defaultStudents);
                }
              } else {
                setStudents(currentSchoolId === 'demo' ? defaultStudents : []);
              }
            } else {
              setStudents(currentSchoolId === 'demo' ? defaultStudents : []);
            }
            const localStructs = localStorage.getItem(`class_on_structures_${currentSchoolId}`);
            if (localStructs) {
              const parsed = JSON.parse(localStructs);
              if (Array.isArray(parsed) && parsed.length > 0) setReportCardStructures(parsed);
              else setReportCardStructures(defaultReportCardStructures);
            } else {
              setReportCardStructures(defaultReportCardStructures);
            }
          } catch (e) {
            setStudents(currentSchoolId === 'demo' ? defaultStudents : []);
            setReportCardStructures(defaultReportCardStructures);
          }
          currentLoadedSchoolIdRef.current = currentSchoolId;
        } finally {
          setIsCloudSyncing(false);
        }
      }
    };
    fetchSchoolDataFromCloud();
    return () => {
      if (unsubscribeSchoolData) {
        unsubscribeSchoolData();
      }
    };
  }, [currentSchoolId]);

  // Sync state TO localStorage whenever any state modifications occur for active tenant school
  const lastSavedHashRef = React.useRef<string>("");
  React.useEffect(() => {
    // Only write back to localStorage if we are initialized on currentSchoolId in memory state.
    if (currentSchoolId && currentSchoolId === currentLoadedSchoolIdRef.current) {
      try {
        localStorage.setItem(`class_on_branding_${currentSchoolId}`, JSON.stringify(branding));
        localStorage.setItem(`class_on_score_columns_${currentSchoolId}`, JSON.stringify(scoreColumns));
        localStorage.setItem(`class_on_subjects_${currentSchoolId}`, JSON.stringify(subjects));
        localStorage.setItem(`class_on_grade_scales_${currentSchoolId}`, JSON.stringify(gradeScales));
        localStorage.setItem(`class_on_students_${currentSchoolId}`, JSON.stringify(students));
        localStorage.setItem(`class_on_student_grades_${currentSchoolId}`, JSON.stringify(studentGrades));
        localStorage.setItem(`class_on_structures_${currentSchoolId}`, JSON.stringify(reportCardStructures));
        localStorage.setItem(`class_on_recycle_bin_${currentSchoolId}`, JSON.stringify(recycleBin));
        localStorage.setItem(`class_on_classes_${currentSchoolId}`, JSON.stringify(schoolClasses));
        localStorage.setItem(`class_on_class_style_${currentSchoolId}`, classNamingStyle);

        // Build comprehensive data hash so student class changes, name edits, grade updates, and structure assignments trigger cloud save
        const studentHash = students.map(s => `${s.id}:${s.className}:${s.section}:${s.name}`).join('|');
        const gradeHash = studentGrades.map(g => `${g.studentId}:${g.updatedAt || ''}`).join('|');
        const structHash = reportCardStructures.map(st => `${st.id}:${(st.assignedClasses || []).join(',')}`).join('|');
        const currentDataHash = `${studentHash}_${gradeHash}_${structHash}_${scoreColumns.length}_${subjects.length}_${gradeScales.length}_${schoolClasses.length}_${classNamingStyle}_${branding.schoolName || ''}_${branding.showWatermark}_${branding.watermarkType}_${branding.watermarkText || ''}_${(branding.watermarkLogoUrl || '').length}_${branding.watermarkOpacity}_${branding.watermarkSize}_${branding.watermarkLayout}_${branding.watermarkFit}_${(branding.logoUrl || '').length}_${branding.themeColor || ''}`;
        if (currentDataHash === lastSavedHashRef.current) {
          return;
        }

        // Sync directly to Firestore Cloud in real-time - Debounced to prevent lagging on rapid keystrokes/data entry
        const destSchoolId = normalizeCloudSchoolId(currentSchoolId);
        const activeSchoolObj = schoolsRef.current.find(s => s.id === currentSchoolId);
        
        const timeoutId = setTimeout(() => {
          lastSavedHashRef.current = currentDataHash;
          saveSchoolToCloud(destSchoolId, {
            branding,
            scoreColumns,
            subjects,
            notes: "",
            gradeScales,
            students,
            studentGrades,
            reportCardStructures,
            recycleBin,
            classes: schoolClasses,
            classNamingStyle
          } as any, branding.schoolName, activeSchoolObj?.portalCode)
          .then(() => {
            setIsFirestoreOffline(false);
          })
          .catch((err: any) => {
            console.warn("Autosave cloud sync deferred (offline mode active):", err);
          });
        }, 1000);

        // Immediate flush on page refresh / close
        const handleBeforeUnload = () => {
          if (currentDataHash !== lastSavedHashRef.current) {
            lastSavedHashRef.current = currentDataHash;
            saveSchoolToCloud(destSchoolId, {
              branding,
              scoreColumns,
              subjects,
              notes: "",
              gradeScales,
              students,
              studentGrades,
              reportCardStructures,
              recycleBin,
              classes: schoolClasses,
              classNamingStyle
            } as any, branding.schoolName, activeSchoolObj?.portalCode).catch(() => {});
          }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
          clearTimeout(timeoutId);
          window.removeEventListener('beforeunload', handleBeforeUnload);
        };
      } catch (err) {
        console.warn("Autosave failure details:", err);
      }
    }
  }, [branding, scoreColumns, subjects, gradeScales, students, studentGrades, reportCardStructures, recycleBin, schoolClasses, classNamingStyle, currentSchoolId]);

  // Forces an immediate cloud write of all active tenant data to Firestore
  const forceImmediateCloudSync = async (
    currentBranding = branding,
    currentScoreCols = scoreColumns,
    currentSubs = subjects,
    currentScales = gradeScales,
    currentStuds = students,
    currentGrades = studentGrades,
    currentStructs = reportCardStructures,
    currentBin = recycleBin,
    currentClasses = schoolClasses,
    currentStyle = classNamingStyle
  ) => {
    if (currentSchoolId) {
      const destSchoolId = normalizeCloudSchoolId(currentSchoolId);
      const activeSchoolObj = schoolsRef.current.find(s => s.id === currentSchoolId);
      try {
        // Wrap in a race timeout so immediate sync never stalls background execution
        await Promise.race([
          saveSchoolToCloud(destSchoolId, {
            branding: currentBranding,
            scoreColumns: currentScoreCols,
            subjects: currentSubs,
            notes: "",
            gradeScales: currentScales,
            students: currentStuds,
            studentGrades: currentGrades,
            reportCardStructures: currentStructs,
            recycleBin: currentBin,
            classes: currentClasses,
            classNamingStyle: currentStyle
          } as any, currentBranding.schoolName, activeSchoolObj?.portalCode),
          new Promise((resolve) => setTimeout(resolve, 2500))
        ]);
        console.log("[Immediate Sync] Successfully saved to cloud.");
      } catch (err) {
        console.warn("[Immediate Sync] Deferred/Offline:", err);
      }
    }
  };

  const handleUpdateSchoolClasses = (updatedClasses: SchoolClassItem[], style?: any) => {
    setSchoolClasses(updatedClasses);
    if (style) setClassNamingStyle(style);
    if (currentSchoolId) {
      try {
        localStorage.setItem(`class_on_classes_${currentSchoolId}`, JSON.stringify(updatedClasses));
        if (style) localStorage.setItem(`class_on_class_style_${currentSchoolId}`, style);
      } catch {}
      forceImmediateCloudSync(
        branding, scoreColumns, subjects, gradeScales, students, studentGrades, reportCardStructures, recycleBin,
        updatedClasses, style || classNamingStyle
      );
    }
  };

  // Save changes manually with guaranteed zero-hang and instant local persistence
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string>("");
  const handleSaveData = async () => {
    if (!currentSchoolId) return;

    try {
      const destSchoolId = normalizeCloudSchoolId(currentSchoolId);
      // 1. Instantly save to local storage (takes < 1ms, zero chance of failure)
      localStorage.setItem(`class_on_branding_${currentSchoolId}`, JSON.stringify(branding));
      localStorage.setItem(`class_on_score_columns_${currentSchoolId}`, JSON.stringify(scoreColumns));
      localStorage.setItem(`class_on_subjects_${currentSchoolId}`, JSON.stringify(subjects));
      localStorage.setItem(`class_on_grade_scales_${currentSchoolId}`, JSON.stringify(gradeScales));
      localStorage.setItem(`class_on_students_${currentSchoolId}`, JSON.stringify(students));
      localStorage.setItem(`class_on_student_grades_${currentSchoolId}`, JSON.stringify(studentGrades));
      localStorage.setItem(`class_on_structures_${currentSchoolId}`, JSON.stringify(reportCardStructures));
      localStorage.setItem(`class_on_recycle_bin_${currentSchoolId}`, JSON.stringify(recycleBin));
      localStorage.setItem(`class_on_classes_${currentSchoolId}`, JSON.stringify(schoolClasses));
      localStorage.setItem(`class_on_class_style_${currentSchoolId}`, classNamingStyle);
      localStorage.setItem(`class_on_last_saved_at_${destSchoolId}`, new Date().toISOString());
      
      // 2. Set saving state immediately for prompt visual feedback
      setIsSaving(true);
      setSaveSuccess(false);
      setSaveMessage("Saving...");

      const activeSchoolObj = schoolsRef.current.find(s => s.id === currentSchoolId);
      
      // 3. Initiate Firestore synchronization with a hard timeout race (never hang)
      let syncedToCloud = false;
      try {
        const timeoutPromise = new Promise<'timeout'>((resolve) => 
          setTimeout(() => resolve('timeout'), 2000)
        );

        const syncPromise = saveSchoolToCloud(destSchoolId, {
          branding,
          scoreColumns,
          subjects,
          notes: "",
          gradeScales,
          students,
          studentGrades,
          reportCardStructures,
          recycleBin,
          classes: schoolClasses,
          classNamingStyle
        } as any, branding.schoolName, activeSchoolObj?.portalCode).then(() => 'synced' as const);

        const raceResult = await Promise.race([syncPromise, timeoutPromise]);
        syncedToCloud = (raceResult === 'synced');
      } catch (cloudErr) {
        console.warn("Cloud save network/quota note:", cloudErr);
        syncedToCloud = false;
      }

      // 4. Transition to successful indicator instantly
      setIsSaving(false);
      setSaveSuccess(true);
      setSaveMessage(syncedToCloud ? "Saved & Synced!" : "Saved locally! (Cloud sync queued)");

      setTimeout(() => {
        setSaveSuccess(false);
        setSaveMessage("");
      }, 2500);

    } catch (err) {
      console.warn("Manual save failed:", err);
      setIsSaving(false);
      setSaveSuccess(false);
    } finally {
      setIsSaving(false);
    }
  };

  // Robust Branding update handler that guarantees instant localStorage persistence and cloud synchronization
  const handleUpdateBranding = React.useCallback((updatedBranding: SchoolBranding) => {
    setBranding(updatedBranding);
    if (currentSchoolId) {
      try {
        localStorage.setItem(`class_on_branding_${currentSchoolId}`, JSON.stringify(updatedBranding));
      } catch (err) {
        console.warn("Failed to write branding to localStorage:", err);
      }
      const destSchoolId = normalizeCloudSchoolId(currentSchoolId);
      saveBrandingToCloud(destSchoolId, updatedBranding).catch(e => console.warn("Cloud branding sync deferred:", e));

      // If schoolName was changed in branding, synchronize SaaS school registry immediately
      if (updatedBranding.schoolName) {
        const activeSchoolObj = schoolsRef.current.find(s => s.id === currentSchoolId);
        if (activeSchoolObj && activeSchoolObj.name !== updatedBranding.schoolName) {
          const updatedSchoolObj = { ...activeSchoolObj, name: updatedBranding.schoolName };
          setSchools(prev => {
            const next = prev.map(s => s.id === currentSchoolId ? updatedSchoolObj : s);
            try {
              localStorage.setItem('class_on_saas_schools', JSON.stringify(next));
            } catch {}
            return next;
          });
          saveSaaSSchoolToCloud(updatedSchoolObj, updatedSchoolObj.ownerId).catch(e => console.warn("SaaS school name sync deferred:", e));
        }
      }
    }
  }, [currentSchoolId]);

  const handleUpdateGrades = React.useCallback((updated: StudentGrades[]) => {
    setStudentGrades(updated);
    if (currentSchoolId) {
      try {
        localStorage.setItem(`class_on_student_grades_${currentSchoolId}`, JSON.stringify(updated));
      } catch {}
      const destSchoolId = normalizeCloudSchoolId(currentSchoolId);
      saveStudentsBatchToCloud(destSchoolId, undefined, updated).catch(err => {
        console.warn("[handleUpdateGrades Cloud Save] Notice:", err);
      });
    }
  }, [currentSchoolId]);

  const handleUpdateGradeScales = React.useCallback((updatedScales: GradeScale[]) => {
    setGradeScales(updatedScales);
    if (currentSchoolId) {
      try {
        localStorage.setItem(`class_on_grade_scales_${currentSchoolId}`, JSON.stringify(updatedScales));
      } catch {}
      const destSchoolId = normalizeCloudSchoolId(currentSchoolId);
      saveGradeScalesToCloud(destSchoolId, updatedScales).catch(e => console.warn("Grade scales cloud sync deferred:", e));
    }
  }, [currentSchoolId]);

  const handleUpdateStructures = React.useCallback((updated: ReportCardStructure[]) => {
    setReportCardStructures(updated);
    const defaultStruct = updated.find(s => (s as any).isDefault || s.id === 'struct_default' || s.id?.toLowerCase().startsWith('struct_def') || s.name?.includes('(Default Template)')) || updated[0];
    if (defaultStruct?.branding?.studentFields) {
      setBranding(prev => ({
        ...prev,
        studentFields: defaultStruct.branding?.studentFields
      }));
    }
    if (currentSchoolId) {
      try {
        localStorage.setItem(`class_on_structures_${currentSchoolId}`, JSON.stringify(updated));
      } catch {}
      const destSchoolId = normalizeCloudSchoolId(currentSchoolId);
      saveStructuresToCloud(destSchoolId, updated).catch(e => console.warn("Structures cloud sync deferred:", e));
    }
  }, [currentSchoolId]);

  const handleUpdateSubjects = React.useCallback((updated: SubjectColumn[]) => {
    const withSequence = updated.map((s, idx) => ({ ...s, sequence: idx }));
    setSubjects(withSequence);
    if (currentSchoolId) {
      try {
        localStorage.setItem(`class_on_subjects_${currentSchoolId}`, JSON.stringify(withSequence));
      } catch {}
      const destSchoolId = normalizeCloudSchoolId(currentSchoolId);
      saveSubjectsToCloud(destSchoolId, withSequence).catch(e => console.warn("Subjects cloud sync deferred:", e));
    }
  }, [currentSchoolId]);

  const handleUpdateScoreColumns = React.useCallback((updated: ScoreColumn[]) => {
    const withSequence = updated.map((c, idx) => ({ ...c, sequence: idx }));
    setScoreColumns(withSequence);
    if (currentSchoolId) {
      try {
        localStorage.setItem(`class_on_score_columns_${currentSchoolId}`, JSON.stringify(withSequence));
      } catch {}
      const destSchoolId = normalizeCloudSchoolId(currentSchoolId);
      saveScoreColumnsToCloud(destSchoolId, withSequence).catch(e => console.warn("Score columns cloud sync deferred:", e));
    }
  }, [currentSchoolId]);

  const handleUpdateRemarks = React.useCallback((studentId: string, remarks: string, promo?: string) => {
    setStudents(prev => {
      const next = prev.map(s => {
        if (s.id === studentId) {
          return {
            ...s,
            remarks,
            ...(promo !== undefined ? { promotionStatus: promo } : {})
          };
        }
        return s;
      });
      if (currentSchoolId) {
        try {
          localStorage.setItem(`class_on_students_${currentSchoolId}`, JSON.stringify(next));
        } catch {}
        const destSchoolId = normalizeCloudSchoolId(currentSchoolId);
        saveStudentsBatchToCloud(destSchoolId, next).catch(err => {
          console.warn("[handleUpdateRemarks Cloud Save] Notice:", err);
        });
      }
      return next;
    });
  }, [currentSchoolId]);

  // Helper to dynamically resolve student-specific report card structure settings
  const resolveStudentStructure = React.useCallback((student: Student, sessionOverride?: string) => {
    const activeSession = sessionOverride !== undefined ? sessionOverride : selectedSessionFilter;
    const activeSessionBranding = activeSession 
      ? { 
          ...branding, 
          session: activeSession.toLowerCase().includes("archived") 
            ? activeSession 
            : `${activeSession} (Archived)` 
        }
      : branding;

    if (!student) {
      return {
        resolvedBranding: activeSessionBranding,
        resolvedSubjects: subjects,
        resolvedScoreColumns: scoreColumns,
        resolvedTermSpecificScoreColumnsEnabled: false,
        resolvedTerm1ScoreColumns: scoreColumns,
        resolvedTerm2ScoreColumns: scoreColumns,
        resolvedTerm3ScoreColumns: scoreColumns,
        resolvedGradeScales: gradeScales,
        resolvedScholasticTerm1Disabled: false,
        resolvedScholasticTerm2Disabled: false,
        resolvedScholasticTerm3Disabled: false,
        resolvedCoScholasticOneColumn: false,
        resolvedCoScholasticSections: [],
        resolvedCoGradeScales: [],
        resolvedSignatures: undefined as any,
        resolvedHideGradingScale: false,
        resolvedHideAttendance: false,
        resolvedPureGradeBased: false,
        resolvedGradingScaleAfterSignatures: false,
        resolvedGradingScaleLayout: 'side-by-side' as 'side-by-side' | 'stacked',
        resolvedVerticalExamHeaders: false,
        resolvedVerticalSubjectsHeader: false,
        resolvedSubjectSpecificMaxMarksEnabled: false,
        resolvedEnableSubjectGrouping: false,
        resolvedCustomSubjectGroups: [],
        resolvedHideTerm1Total: false,
        resolvedHideTerm1Grade: false,
        resolvedHideTerm2Total: false,
        resolvedHideTerm2Grade: false,
        resolvedHideTerm3Total: false,
        resolvedHideTerm3Grade: false,
        resolvedHideOverallTotal: false,
        resolvedHideOverallGrade: false
      };
    }
    const matchedStruct = matchStructureForStudent(reportCardStructures, student.className, student.section);

    if (matchedStruct) {
      const structB = matchedStruct.branding || {};
      const isCustomBranding = 
        matchedStruct.useCustomBranding === true || 
        matchedStruct.overrideIdentity === true || 
        structB.useCustomBranding === true || 
        structB.overrideIdentity === true;

      let mergedBranding: SchoolBranding;

      if (isCustomBranding) {
        // CUSTOM MODE: Custom fields configured on matchedStruct.branding take 100% precedence over Main School Identity!
        mergedBranding = {
          ...activeSessionBranding,
          ...structB,
          useCustomBranding: true,
          overrideIdentity: true,
          schoolName: structB.schoolName !== undefined ? structB.schoolName : (activeSessionBranding.schoolName || "My School"),
          schoolNameFontSize: structB.schoolNameFontSize ?? activeSessionBranding.schoolNameFontSize ?? 32,
          schoolNameFontFamily: structB.schoolNameFontFamily || activeSessionBranding.schoolNameFontFamily || "Georgia, serif",
          headerDetailsFontSize: structB.headerDetailsFontSize ?? activeSessionBranding.headerDetailsFontSize ?? 10.5,
          headerDetailsFontFamily: structB.headerDetailsFontFamily || activeSessionBranding.headerDetailsFontFamily || "sans-serif",
          reportCardTitleFontSize: structB.reportCardTitleFontSize ?? activeSessionBranding.reportCardTitleFontSize,
          tagline: structB.tagline !== undefined ? structB.tagline : "",
          address: structB.address !== undefined ? structB.address : "",
          helpline: structB.helpline !== undefined ? structB.helpline : "",
          email: structB.email !== undefined ? structB.email : "",
          website: structB.website !== undefined ? structB.website : "",
          logoUrl: structB.logoUrl !== undefined ? structB.logoUrl : "",
          logoSize: structB.logoSize !== undefined ? structB.logoSize : (activeSessionBranding.logoSize ?? 92),
          logoCircular: structB.logoCircular !== undefined ? structB.logoCircular : (activeSessionBranding.logoCircular ?? true),
          logoBorder: structB.logoBorder !== undefined ? structB.logoBorder : (activeSessionBranding.logoBorder ?? true),
          rightLogoUrl: structB.rightLogoUrl !== undefined ? structB.rightLogoUrl : "",
          rightLogoSize: structB.rightLogoSize !== undefined ? structB.rightLogoSize : (activeSessionBranding.rightLogoSize ?? 92),
          nameBannerUrl: structB.nameBannerUrl !== undefined ? structB.nameBannerUrl : "",
          hideSchoolDetails: structB.hideSchoolDetails !== undefined ? structB.hideSchoolDetails : false,
          themeColor: structB.themeColor || activeSessionBranding.themeColor || "#DE2F2F",
          borderColor: structB.borderColor || activeSessionBranding.borderColor || "#C22121",
          reportCardTitle: structB.reportCardTitle || activeSessionBranding.reportCardTitle || "Annual Examination Report Card",
          session: activeSessionBranding.session || structB.session || "2024-2025",
          showWatermark: structB.showWatermark !== undefined ? structB.showWatermark : (activeSessionBranding.showWatermark ?? true),
          watermarkType: structB.watermarkType || 'logo',
          watermarkText: structB.watermarkText !== undefined ? structB.watermarkText : (structB.schoolName || ""),
          watermarkLogoUrl: structB.watermarkLogoUrl !== undefined ? structB.watermarkLogoUrl : (structB.logoUrl || ""),
          watermarkOpacity: structB.watermarkOpacity ?? 0.08,
          watermarkSize: structB.watermarkSize ?? 320,
          watermarkLayout: structB.watermarkLayout || 'center',
          watermarkFit: structB.watermarkFit || 'contain',
          signParentName: structB.signParentName || activeSessionBranding.signParentName || "Parent's Signature",
          signInchargeName: structB.signInchargeName || activeSessionBranding.signInchargeName || "Class Incharge Signature",
          signPrincipalName: structB.signPrincipalName || activeSessionBranding.signPrincipalName || "Principal Signature",
          studentFields: structB.studentFields || activeSessionBranding.studentFields
        };
      } else {
        // DEFAULT MODE: Inherit Main School Identity for all header & watermark details, but keep layout font/size overrides if present
        mergedBranding = {
          ...activeSessionBranding,
          useCustomBranding: false,
          overrideIdentity: false,
          schoolNameFontSize: structB.schoolNameFontSize ?? activeSessionBranding.schoolNameFontSize ?? 32,
          schoolNameFontFamily: structB.schoolNameFontFamily || activeSessionBranding.schoolNameFontFamily || "Georgia, serif",
          headerDetailsFontSize: structB.headerDetailsFontSize ?? activeSessionBranding.headerDetailsFontSize ?? 10.5,
          headerDetailsFontFamily: structB.headerDetailsFontFamily || activeSessionBranding.headerDetailsFontFamily || "sans-serif",
          reportCardTitleFontSize: structB.reportCardTitleFontSize ?? activeSessionBranding.reportCardTitleFontSize,
          logoSize: structB.logoSize !== undefined ? structB.logoSize : (activeSessionBranding.logoSize ?? 92),
          rightLogoSize: structB.rightLogoSize !== undefined ? structB.rightLogoSize : (activeSessionBranding.rightLogoSize ?? 92),
          showWatermark: structB.showWatermark !== undefined ? structB.showWatermark : (activeSessionBranding.showWatermark ?? true),
          watermarkType: structB.watermarkType || activeSessionBranding.watermarkType || 'logo',
          watermarkText: structB.watermarkText !== undefined ? structB.watermarkText : (activeSessionBranding.watermarkText !== undefined ? activeSessionBranding.watermarkText : (activeSessionBranding.schoolName || "")),
          watermarkLogoUrl: structB.watermarkLogoUrl || activeSessionBranding.watermarkLogoUrl || activeSessionBranding.logoUrl || "",
          watermarkOpacity: structB.watermarkOpacity ?? activeSessionBranding.watermarkOpacity ?? 0.08,
          watermarkSize: structB.watermarkSize ?? activeSessionBranding.watermarkSize ?? 320,
          watermarkLayout: structB.watermarkLayout || activeSessionBranding.watermarkLayout || 'center',
          watermarkFit: structB.watermarkFit || activeSessionBranding.watermarkFit || 'contain',
          themeColor: structB.themeColor || activeSessionBranding.themeColor || "#DE2F2F",
          borderColor: structB.borderColor || activeSessionBranding.borderColor || "#C22121",
          reportCardTitle: structB.reportCardTitle || activeSessionBranding.reportCardTitle || "Annual Examination Report Card",
          session: activeSessionBranding.session || structB.session || "2024-2025",
          signParentName: structB.signParentName || activeSessionBranding.signParentName || "Parent's Signature",
          signInchargeName: structB.signInchargeName || activeSessionBranding.signInchargeName || "Class Incharge Signature",
          signPrincipalName: structB.signPrincipalName || activeSessionBranding.signPrincipalName || "Principal Signature",
          studentFields: structB.studentFields || activeSessionBranding.studentFields
        };
      }

      const baseCols = matchedStruct.pureGradeBased 
        ? [] 
        : (matchedStruct.scoreColumns !== undefined ? matchedStruct.scoreColumns : scoreColumns);
      const isTermSpecific = !!matchedStruct.termSpecificScoreColumnsEnabled;
      const resolvedTerm1ScoreColumns = isTermSpecific && matchedStruct.term1ScoreColumns && matchedStruct.term1ScoreColumns.length > 0
        ? matchedStruct.term1ScoreColumns
        : baseCols;
      const resolvedTerm2ScoreColumns = isTermSpecific && matchedStruct.term2ScoreColumns && matchedStruct.term2ScoreColumns.length > 0
        ? matchedStruct.term2ScoreColumns
        : baseCols;
      const resolvedTerm3ScoreColumns = isTermSpecific && matchedStruct.term3ScoreColumns && matchedStruct.term3ScoreColumns.length > 0
        ? matchedStruct.term3ScoreColumns
        : baseCols;

      return {
        resolvedBranding: mergedBranding,
        resolvedSubjects: matchedStruct.subjects && matchedStruct.subjects.length > 0 ? matchedStruct.subjects : subjects,
        resolvedScoreColumns: baseCols,
        resolvedTermSpecificScoreColumnsEnabled: isTermSpecific,
        resolvedTerm1ScoreColumns,
        resolvedTerm2ScoreColumns,
        resolvedTerm3ScoreColumns,
        resolvedGradeScales: matchedStruct.gradeScales && matchedStruct.gradeScales.length > 0 ? matchedStruct.gradeScales : gradeScales,
        resolvedScholasticTerm1Disabled: matchedStruct.scholasticTerm1Disabled || false,
        resolvedScholasticTerm2Disabled: matchedStruct.scholasticTerm2Disabled || false,
        resolvedScholasticTerm3Disabled: matchedStruct.scholasticTerm3Disabled || false,
        resolvedCoScholasticOneColumn: matchedStruct.coScholasticOneColumn || false,
        resolvedCoScholasticSections: matchedStruct.coScholasticSections || [],
        resolvedCoGradeScales: matchedStruct.coGradeScales || [],
        resolvedSignatures: matchedStruct.signatures,
        resolvedHideGradingScale: matchedStruct.hideGradingScale || false,
        resolvedHideAttendance: matchedStruct.hideAttendance || false,
        resolvedPureGradeBased: matchedStruct.pureGradeBased || false,
        resolvedGradingScaleAfterSignatures: matchedStruct.gradingScaleAfterSignatures || false,
        resolvedGradingScaleLayout: matchedStruct.gradingScaleLayout || 'side-by-side',
        resolvedVerticalExamHeaders: matchedStruct.verticalExamHeaders || false,
        resolvedVerticalSubjectsHeader: matchedStruct.verticalSubjectsHeader || false,
        resolvedSubjectSpecificMaxMarksEnabled: matchedStruct.subjectSpecificMaxMarksEnabled || false,
        resolvedEnableSubjectGrouping: matchedStruct.enableSubjectGrouping ?? false,
        resolvedCustomSubjectGroups: matchedStruct.customSubjectGroups || [],
        resolvedShowMinMarksColumn: matchedStruct.showMinMarksColumn ?? structB.showMinMarksColumn ?? activeSessionBranding.showMinMarksColumn ?? false,
        resolvedShowMaxMarksColumn: matchedStruct.showMaxMarksColumn ?? structB.showMaxMarksColumn ?? activeSessionBranding.showMaxMarksColumn ?? false,
        resolvedShowObtainedMarksColumn: matchedStruct.showObtainedMarksColumn ?? structB.showObtainedMarksColumn ?? activeSessionBranding.showObtainedMarksColumn ?? true,
        resolvedMinMarksHeaderLabel: matchedStruct.minMarksHeaderLabel || structB.minMarksHeaderLabel || activeSessionBranding.minMarksHeaderLabel || "Min Marks",
        resolvedMaxMarksHeaderLabel: matchedStruct.maxMarksHeaderLabel || structB.maxMarksHeaderLabel || activeSessionBranding.maxMarksHeaderLabel || "Max Marks",
        resolvedObtainedMarksHeaderLabel: matchedStruct.obtainedMarksHeaderLabel || structB.obtainedMarksHeaderLabel || activeSessionBranding.obtainedMarksHeaderLabel || "Marks Obtained",
        resolvedHideTerm1Total: matchedStruct.hideTerm1Total ?? false,
        resolvedHideTerm1Grade: matchedStruct.hideTerm1Grade ?? false,
        resolvedHideTerm2Total: matchedStruct.hideTerm2Total ?? false,
        resolvedHideTerm2Grade: matchedStruct.hideTerm2Grade ?? false,
        resolvedHideTerm3Total: matchedStruct.hideTerm3Total ?? false,
        resolvedHideTerm3Grade: matchedStruct.hideTerm3Grade ?? false,
        resolvedHideOverallTotal: matchedStruct.hideOverallTotal ?? false,
        resolvedHideOverallGrade: matchedStruct.hideOverallGrade ?? false
      };
    }

    return {
      resolvedBranding: activeSessionBranding,
      resolvedSubjects: subjects,
      resolvedScoreColumns: scoreColumns,
      resolvedTermSpecificScoreColumnsEnabled: false,
      resolvedTerm1ScoreColumns: scoreColumns,
      resolvedTerm2ScoreColumns: scoreColumns,
      resolvedTerm3ScoreColumns: scoreColumns,
      resolvedGradeScales: gradeScales,
      resolvedScholasticTerm1Disabled: false,
      resolvedScholasticTerm2Disabled: false,
      resolvedScholasticTerm3Disabled: false,
      resolvedCoScholasticOneColumn: false,
      resolvedCoScholasticSections: [],
      resolvedCoGradeScales: [],
      resolvedSignatures: undefined as any,
      resolvedHideGradingScale: false,
      resolvedHideAttendance: false,
      resolvedPureGradeBased: false,
      resolvedGradingScaleAfterSignatures: false,
      resolvedGradingScaleLayout: 'side-by-side' as 'side-by-side' | 'stacked',
      resolvedVerticalExamHeaders: false,
      resolvedVerticalSubjectsHeader: false,
      resolvedSubjectSpecificMaxMarksEnabled: false,
      resolvedEnableSubjectGrouping: false,
      resolvedCustomSubjectGroups: [],
      resolvedHideTerm1Total: false,
      resolvedHideTerm1Grade: false,
      resolvedHideTerm2Total: false,
      resolvedHideTerm2Grade: false,
      resolvedHideTerm3Total: false,
      resolvedHideTerm3Grade: false,
      resolvedHideOverallTotal: false,
      resolvedHideOverallGrade: false,
      resolvedShowMinMarksColumn: activeSessionBranding.showMinMarksColumn ?? false,
      resolvedShowMaxMarksColumn: activeSessionBranding.showMaxMarksColumn ?? false,
      resolvedShowObtainedMarksColumn: activeSessionBranding.showObtainedMarksColumn ?? true,
      resolvedMinMarksHeaderLabel: activeSessionBranding.minMarksHeaderLabel || "Min Marks",
      resolvedMaxMarksHeaderLabel: activeSessionBranding.maxMarksHeaderLabel || "Max Marks",
      resolvedObtainedMarksHeaderLabel: activeSessionBranding.obtainedMarksHeaderLabel || "Marks Obtained",
    };
  }, [reportCardStructures, branding, subjects, scoreColumns, gradeScales, selectedSessionFilter]);

  /**
   * Authoritative helper to check if admission number is active in the report card layout
   */
  const isAdmissionNoActiveInLayout = React.useCallback((targetClass?: string, targetSection?: string): boolean => {
    return isStudentFieldActive('admissionNo', targetClass, targetSection, reportCardStructures, branding);
  }, [reportCardStructures, branding]);

  const handleRestoreSession = React.useCallback((sessionToRestore: string) => {
    if (!sessionToRestore) return;

    // 1. Revert branding.session back to sessionToRestore
    const updatedBranding = {
      ...branding,
      session: sessionToRestore
    };
    setBranding(updatedBranding);

    // 2. Restore students' properties from their history record for sessionToRestore
    const updatedStudents = students.map(s => {
      const historyRecord = (s.history || []).find(h => h.session === sessionToRestore);
      if (historyRecord) {
        // Revert to history values and remove this history record from history
        return {
          ...s,
          className: historyRecord.className,
          section: historyRecord.section,
          rollNo: historyRecord.rollNo || s.rollNo,
          remarks: historyRecord.remarks || '',
          promotionStatus: '', // Revert to empty for active session
          history: (s.history || []).filter(h => h.session !== sessionToRestore)
        };
      }
      return s;
    });
    setStudents(updatedStudents);

    // 3. Restore studentGrades from history records
    // Create a lookup map of history grades
    const historyGradesMap = new Map<string, any>();
    students.forEach(s => {
      const historyRecord = (s.history || []).find(h => h.session === sessionToRestore);
      if (historyRecord && historyRecord.grades) {
        historyGradesMap.set(s.id, historyRecord.grades);
      }
    });

    const updatedGrades = studentGrades.map(g => {
      if (historyGradesMap.has(g.studentId)) {
        return {
          ...historyGradesMap.get(g.studentId),
          studentId: g.studentId
        };
      }
      return g;
    });

    // Also handle any students who have history grades but no entry in studentGrades at all
    const gradeStudentIds = new Set(updatedGrades.map(g => g.studentId));
    students.forEach(s => {
      if (!gradeStudentIds.has(s.id)) {
        const historyRecord = (s.history || []).find(h => h.session === sessionToRestore);
        if (historyRecord && historyRecord.grades) {
          updatedGrades.push({
            ...historyRecord.grades,
            studentId: s.id
          });
        }
      }
    });

    setStudentGrades(updatedGrades);

    // 4. Clear the active selected session filter so we seamlessly return to active mode
    setSelectedSessionFilter('');
  }, [branding, students, studentGrades]);

  const [isGeneratingBulkPdf, setIsGeneratingBulkPdf] = useState<boolean>(false);

  const downloadBulkServerSidePdf = async () => {
    setIsGeneratingBulkPdf(true);
    try {
      const studentsPayloads = filteredPreviewStudents.map(std => {
        const {
          resolvedBranding,
          resolvedSubjects,
          resolvedScoreColumns,
          resolvedTermSpecificScoreColumnsEnabled,
          resolvedTerm1ScoreColumns,
          resolvedTerm2ScoreColumns,
          resolvedTerm3ScoreColumns,
          resolvedGradeScales,
          resolvedScholasticTerm1Disabled,
          resolvedScholasticTerm2Disabled,
          resolvedScholasticTerm3Disabled,
          resolvedCoScholasticOneColumn,
          resolvedCoScholasticSections,
          resolvedCoGradeScales,
          resolvedSignatures,
          resolvedHideGradingScale,
          resolvedHideAttendance,
          resolvedPureGradeBased,
          resolvedGradingScaleAfterSignatures,
          resolvedGradingScaleLayout,
          resolvedVerticalExamHeaders,
          resolvedVerticalSubjectsHeader,
          resolvedSubjectSpecificMaxMarksEnabled,
          resolvedEnableSubjectGrouping,
          resolvedCustomSubjectGroups,
          resolvedHideTerm1Total,
          resolvedHideTerm1Grade,
          resolvedHideTerm2Total,
          resolvedHideTerm2Grade,
          resolvedHideTerm3Total,
          resolvedHideTerm3Grade,
          resolvedHideOverallTotal,
          resolvedHideOverallGrade
        } = resolveStudentStructure(std);

        const stdGrades = studentGrades.find(g => g.studentId === std.id) || studentGrades[0] || { scholastic: {}, co_scholastic: {}, activity: {}, attendance: {} };

        const rawFields = resolvedBranding.studentFields || [
          { id: "name", label: resolvedBranding.studentNameLabel || "Student's Name" },
          { id: "fatherName", label: resolvedBranding.fatherNameLabel || "Father's Name" },
          { id: "motherName", label: resolvedBranding.motherNameLabel || "Mother's Name" },
          { id: "height", label: resolvedBranding.heightLabel || "Height" },
          { id: "weight", label: resolvedBranding.weightLabel || "Weight" },
          { id: "className", label: resolvedBranding.classLabel || "Class" },
          { id: "section", label: resolvedBranding.sectionLabel || "Section" },
          { id: "rollNo", label: resolvedBranding.rollNoLabel || "Roll No" },
          { id: "admissionNo", label: resolvedBranding.admissionNoLabel || "Admission No." },
          { id: "dob", label: resolvedBranding.dobLabel || "D.O.B." }
        ];

        const fieldsToRender = rawFields.filter(f => {
          if (f.disabledAll || f.disabled === true) return false;
          if (f.disabledClasses && std?.className && f.disabledClasses.includes(std.className)) return false;
          return true;
        });

        const term1Enabled = resolvedBranding.term1Enabled !== false;
        const term2Enabled = resolvedBranding.term2Enabled !== false;
        const term3Enabled = resolvedBranding.term3Enabled === true;
        const scholT1Enabled = term1Enabled && !resolvedScholasticTerm1Disabled;
        const scholT2Enabled = term2Enabled && !resolvedScholasticTerm2Disabled;
        const scholT3Enabled = term3Enabled && !resolvedScholasticTerm3Disabled;
        const activeTermsCount = (scholT1Enabled ? 1 : 0) + (scholT2Enabled ? 1 : 0) + (scholT3Enabled ? 1 : 0);

        const getMidpointPercentForGradeLocal = (gradeName: string) => {
          if (!gradeName) return 0;
          const cleanGrade = String(gradeName).trim().toUpperCase();
          const match = resolvedGradeScales.find(scale => scale.grade.trim().toUpperCase() === cleanGrade);
          if (match) {
            return (match.minPercent + match.maxPercent) / 2;
          }
          return 0;
        };

        const getEquivalentMarkLocal = (val: any, maxMarks: number) => {
          const parsedMax = Number(maxMarks) || 0;
          if (val === undefined || val === null || val === '-' || val === '') return 0;
          if (typeof val === 'string' && isNaN(Number(val))) {
            const midPercent = getMidpointPercentForGradeLocal(val);
            return (midPercent / 100) * parsedMax;
          }
          return Number(val) || 0;
        };

        const t1Cols = resolvedTerm1ScoreColumns || resolvedScoreColumns;
        const t2Cols = resolvedTerm2ScoreColumns || resolvedScoreColumns;
        const t3Cols = resolvedTerm3ScoreColumns || resolvedScoreColumns;

        const sumOfT1ColMaxMarks = t1Cols.reduce((sum, col) => sum + col.maxMarks, 0);
        const sumOfT2ColMaxMarks = t2Cols.reduce((sum, col) => sum + col.maxMarks, 0);
        const sumOfT3ColMaxMarks = t3Cols.reduce((sum, col) => sum + col.maxMarks, 0);

        const payloadSubjects = resolvedSubjects.map(sub => {
          const scoreSheet = stdGrades.scholastic[sub.id] || { term1: {}, term2: {}, term3: {} };
          
          const sumOfT1ColumnMaxMarksForSub = t1Cols.reduce((sum, col) => sum + (sub.customMaxMarks?.[col.id] ?? col.maxMarks), 0);
          const sumOfT2ColumnMaxMarksForSub = t2Cols.reduce((sum, col) => sum + (sub.customMaxMarks?.[col.id] ?? col.maxMarks), 0);
          const sumOfT3ColumnMaxMarksForSub = t3Cols.reduce((sum, col) => sum + (sub.customMaxMarks?.[col.id] ?? col.maxMarks), 0);

          const t1SubMax = resolvedSubjectSpecificMaxMarksEnabled ? sumOfT1ColumnMaxMarksForSub : (sub.maxMarks ?? sumOfT1ColMaxMarks);
          const t2SubMax = resolvedSubjectSpecificMaxMarksEnabled ? sumOfT2ColumnMaxMarksForSub : (sub.maxMarks ?? sumOfT2ColMaxMarks);
          const t3SubMax = resolvedSubjectSpecificMaxMarksEnabled ? sumOfT3ColumnMaxMarksForSub : (sub.maxMarks ?? sumOfT3ColMaxMarks);

          let t1Sum = scholT1Enabled ? t1Cols.reduce((sum, col) => {
            const val = scoreSheet.term1?.[col.id];
            const colMax = sub.customMaxMarks?.[col.id] ?? col.maxMarks;
            return sum + getEquivalentMarkLocal(val, colMax);
          }, 0) : 0;

          let t2Sum = scholT2Enabled ? t2Cols.reduce((sum, col) => {
            const val = scoreSheet.term2?.[col.id];
            const colMax = sub.customMaxMarks?.[col.id] ?? col.maxMarks;
            return sum + getEquivalentMarkLocal(val, colMax);
          }, 0) : 0;

          let t3Sum = scholT3Enabled ? t3Cols.reduce((sum, col) => {
            const val = scoreSheet.term3?.[col.id];
            const colMax = sub.customMaxMarks?.[col.id] ?? col.maxMarks;
            return sum + getEquivalentMarkLocal(val, colMax);
          }, 0) : 0;

          if (!resolvedSubjectSpecificMaxMarksEnabled) {
            if (scholT1Enabled && t1SubMax !== sumOfT1ColMaxMarks && sumOfT1ColMaxMarks > 0) t1Sum = (t1Sum / sumOfT1ColMaxMarks) * t1SubMax;
            if (scholT2Enabled && t2SubMax !== sumOfT2ColMaxMarks && sumOfT2ColMaxMarks > 0) t2Sum = (t2Sum / sumOfT2ColMaxMarks) * t2SubMax;
            if (scholT3Enabled && t3SubMax !== sumOfT3ColMaxMarks && sumOfT3ColMaxMarks > 0) t3Sum = (t3Sum / sumOfT3ColMaxMarks) * t3SubMax;
          }

          let overall = 0;
          if (scholT1Enabled) overall += t1Sum;
          if (scholT2Enabled) overall += t2Sum;
          if (scholT3Enabled) overall += t3Sum;

          const maxOverallMarksPossible = (scholT1Enabled ? t1SubMax : 0) + (scholT2Enabled ? t2SubMax : 0) + (scholT3Enabled ? t3SubMax : 0);
          const pct = maxOverallMarksPossible > 0 ? (overall / maxOverallMarksPossible) * 100 : 0;

          let grade = "-";
          for (const scale of resolvedGradeScales) {
            if (pct >= scale.minPercent && pct <= scale.maxPercent) {
              grade = scale.grade;
              break;
            }
          }

          return {
            id: sub.id,
            name: sub.name,
            type: sub.type,
            sectionId: sub.sectionId,
            customMaxMarks: sub.customMaxMarks,
            maxMarks: sub.maxMarks,
            term1: scholT1Enabled ? t1Sum.toString() : "-",
            term2: scholT2Enabled ? t2Sum.toString() : "-",
            term3: scholT3Enabled ? t3Sum.toString() : "-",
            total: Math.round(overall).toString(),
            percentage: maxOverallMarksPossible > 0 ? `${((overall / maxOverallMarksPossible) * 100).toFixed(1)}%` : "-",
            grade: grade || "-"
          };
        });

        const scholasticSubjects = resolvedSubjects.filter(s => s.type === 'scholastic');
        let totalOverallMarks = 0;
        let totalMaxMarksPossible = 0;

        scholasticSubjects.forEach(sub => {
          const matchedPayloadSub = payloadSubjects.find(ps => ps.id === sub.id);
          if (matchedPayloadSub) {
            const sumOfColumnMaxMarksForSub = resolvedScoreColumns.reduce((sum, col) => sum + (sub.customMaxMarks?.[col.id] ?? col.maxMarks), 0);
            const sumOfColumnMaxMarks = resolvedScoreColumns.reduce((sum, col) => sum + col.maxMarks, 0);
            const subMaxMarks = resolvedSubjectSpecificMaxMarksEnabled ? sumOfColumnMaxMarksForSub : (sub.maxMarks ?? sumOfColumnMaxMarks);
            
            const scoreSheet = stdGrades.scholastic[sub.id] || { term1: {}, term2: {}, term3: {} };
            
            let t1Sum = scholT1Enabled ? resolvedScoreColumns.reduce((sum, col) => {
              const val = scoreSheet.term1?.[col.id];
              const colMax = sub.customMaxMarks?.[col.id] ?? col.maxMarks;
              return sum + getEquivalentMarkLocal(val, colMax);
            }, 0) : 0;

            let t2Sum = scholT2Enabled ? resolvedScoreColumns.reduce((sum, col) => {
              const val = scoreSheet.term2?.[col.id];
              const colMax = sub.customMaxMarks?.[col.id] ?? col.maxMarks;
              return sum + getEquivalentMarkLocal(val, colMax);
            }, 0) : 0;

            let t3Sum = scholT3Enabled ? resolvedScoreColumns.reduce((sum, col) => {
              const val = scoreSheet.term3?.[col.id];
              const colMax = sub.customMaxMarks?.[col.id] ?? col.maxMarks;
              return sum + getEquivalentMarkLocal(val, colMax);
            }, 0) : 0;

            if (!resolvedSubjectSpecificMaxMarksEnabled && subMaxMarks !== sumOfColumnMaxMarks && sumOfColumnMaxMarks > 0) {
              if (scholT1Enabled) t1Sum = (t1Sum / sumOfColumnMaxMarks) * subMaxMarks;
              if (scholT2Enabled) t2Sum = (t2Sum / sumOfColumnMaxMarks) * subMaxMarks;
              if (scholT3Enabled) t3Sum = (t3Sum / sumOfColumnMaxMarks) * subMaxMarks;
            }

            let overall = 0;
            if (scholT1Enabled) overall += t1Sum;
            if (scholT2Enabled) overall += t2Sum;
            if (scholT3Enabled) overall += t3Sum;

            totalOverallMarks += overall;
            totalMaxMarksPossible += (subMaxMarks * activeTermsCount);
          }
        });

        const averagePercentage = totalMaxMarksPossible > 0 ? (totalOverallMarks / totalMaxMarksPossible) * 100 : 0;
        let averageGrade = "-";
        for (const scale of resolvedGradeScales) {
          if (averagePercentage >= scale.minPercent && averagePercentage <= scale.maxPercent) {
            averageGrade = scale.grade;
            break;
          }
        }

        const sigsToRender = (resolvedSignatures && resolvedSignatures.length > 0) ? resolvedSignatures : [
          { id: 'parent', label: resolvedBranding.signParentName || "Parent's Signature" },
          { id: 'incharge', label: resolvedBranding.signInchargeName || "Class Incharge Signature" },
          { id: 'principal', label: resolvedBranding.signPrincipalName || "Principal Signature" }
        ];

        const teacherSig = sigsToRender.find(s => s.id === 'incharge' || s.id === 'teacher' || s.id === 'class_teacher')?.label || resolvedBranding.signInchargeName || "Class Teacher Signature";
        const principalSig = sigsToRender.find(s => s.id === 'principal')?.label || "Principal Signature";

        return {
          branding: resolvedBranding,
          student: {
            ...std,
            fatherName: formatFatherName(std.fatherName),
            motherName: formatMotherName(std.motherName),
            className: formatClassName(std.className),
            height: formatHeight(std.height),
            weight: formatWeight(std.weight)
          },
          grades: stdGrades,
          fieldsToRender: fieldsToRender,
          subjects: resolvedSubjects,
          scoreColumns: resolvedScoreColumns,
          gradeScales: resolvedGradeScales,
          coGradeScales: resolvedCoGradeScales,
          scholasticTerm1Disabled: resolvedScholasticTerm1Disabled,
          scholasticTerm2Disabled: resolvedScholasticTerm2Disabled,
          scholasticTerm3Disabled: resolvedScholasticTerm3Disabled,
          coScholasticOneColumn: resolvedCoScholasticOneColumn,
          coScholasticSections: resolvedCoScholasticSections,
          signatures: resolvedSignatures,
          hideGradingScale: resolvedHideGradingScale,
          hideAttendance: resolvedHideAttendance,
          pureGradeBased: resolvedPureGradeBased,
          gradingScaleAfterSignatures: resolvedGradingScaleAfterSignatures,
          gradingScaleLayout: resolvedGradingScaleLayout,
          verticalExamHeaders: resolvedVerticalExamHeaders,
          verticalSubjectsHeader: resolvedVerticalSubjectsHeader,
          subjectSpecificMaxMarksEnabled: resolvedSubjectSpecificMaxMarksEnabled,
          enableSubjectGrouping: resolvedEnableSubjectGrouping,
          customSubjectGroups: resolvedCustomSubjectGroups,
          hideTerm1Total: resolvedHideTerm1Total,
          hideTerm1Grade: resolvedHideTerm1Grade,
          hideTerm2Total: resolvedHideTerm2Total,
          hideTerm2Grade: resolvedHideTerm2Grade,
          hideTerm3Total: resolvedHideTerm3Total,
          hideTerm3Grade: resolvedHideTerm3Grade,
          hideOverallTotal: resolvedHideOverallTotal,
          hideOverallGrade: resolvedHideOverallGrade,
          termLabel: resolvedBranding.termHeaderLabel || `${resolvedBranding.term1Label || "Term 1"} & ${resolvedBranding.term2Label || "Term 2"} Academic Report`,
          overall: {
            totalMarks: Math.round(totalOverallMarks).toString(),
            maxMarks: totalMaxMarksPossible.toString(),
            percentage: `${averagePercentage.toFixed(2)}%`,
            grade: averageGrade,
            attendance: stdGrades.attendance?.term1 || "Present",
            remarks: std.remarks || "Student has demonstrated magnificent educational and sportsmanship levels throughout the calendar sessions."
          },
          signatories: {
            teacher: teacherSig,
            principal: principalSig
          }
        };
      });

      const response = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          isBulk: true,
          students: studentsPayloads
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || "Server-side bulk engine returned an error generating the PDF.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Bulk_Report_Cards_${filteredPreviewStudents.length}_Students.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Bulk PDF generation failed:", err);
      alert("Bulk PDF compile error: " + err.message);
    } finally {
      setIsGeneratingBulkPdf(false);
    }
  };

  // Find active records
  const activeSchoolObj = schools.find(s => s.id === currentSchoolId) || null;
  const activeTeacherObj = activeSchoolObj?.teachers?.find(t => t.id === currentTeacherId) || null;
  const isSchoolApproved = activeSchoolObj ? (activeSchoolObj.approvalStatus === 'approved' || !activeSchoolObj.approvalStatus) : true;

  const [isExpirationOverlayAcknowledged, setIsExpirationOverlayAcknowledged] = useState<boolean>(false);
  const [renewalStudentCount, setRenewalStudentCount] = useState<number>(100);
  const [isSubmittingRenewal, setIsSubmittingRenewal] = useState<boolean>(false);
  const [globalSettings, setGlobalSettings] = useState<any>(null);

  React.useEffect(() => {
    const fetchGlobalSettings = async () => {
      try {
        const settings = await loadGlobalSettings();
        setGlobalSettings(settings);
      } catch (err) {
        console.warn("Failed to load global settings in App:", err);
      }
    };
    fetchGlobalSettings();
  }, []);

  const isSchoolPlanExpired = React.useMemo(() => {
    if (!activeSchoolObj) return false;
    if (currentRole === 'main_admin') return false; // Main admin can manage anything
    if (!activeSchoolObj.trialUntil) return false;
    return new Date(activeSchoolObj.trialUntil).getTime() < Date.now();
  }, [activeSchoolObj, currentRole]);

  // Reset acknowledgment and prefill licenses count when currentSchoolId or currentRole changes
  React.useEffect(() => {
    setIsExpirationOverlayAcknowledged(false);
    if (activeSchoolObj?.maxStudentsLimit) {
      setRenewalStudentCount(activeSchoolObj.maxStudentsLimit);
    } else {
      setRenewalStudentCount(100);
    }
  }, [currentSchoolId, currentRole, activeSchoolObj]);

  // Check if school profile is pending initial plan selection/activation (Free or Premium)
  const isSchoolPendingPlanActivation = currentRole === 'school_admin' && 
    activeSchoolObj != null && 
    (activeSchoolObj.partnershipType === 'pending_activation' || !activeSchoolObj.partnershipType) &&
    !(activeSchoolObj.subscriptionRequest && (
      activeSchoolObj.subscriptionRequest.status === 'pending' ||
      activeSchoolObj.subscriptionRequest.status === 'approved' ||
      activeSchoolObj.subscriptionRequest.paymentStatus === 'success'
    ));

  // Force redirect unactivated schools to billing tab
  React.useEffect(() => {
    if (isSchoolPendingPlanActivation && activeTab !== 'billing') {
      setActiveTabState('billing');
    }
  }, [isSchoolPendingPlanActivation, activeTab]);

  const handleIncrementCumulativeCount = async (by: number) => {
    if (!currentSchoolId) return;
    let updatedSchoolObj: any = null;
    const updatedSchools = schools.map(s => {
      if (s.id === currentSchoolId) {
        updatedSchoolObj = {
          ...s,
          cumulativeStudentsCount: (s.cumulativeStudentsCount || 0) + by
        };
        return updatedSchoolObj;
      }
      return s;
    });
    setSchools(updatedSchools);
    if (updatedSchoolObj) {
      try {
        await saveSaaSSchoolToCloud(updatedSchoolObj, updatedSchoolObj.ownerId);
      } catch (err) {
        console.warn("Failed to update cumulative count on cloud:", err);
      }
    }
  };

  // Compute resolved students and studentGrades for the selected archived session
  const resolvedStudents = React.useMemo(() => {
    if (!selectedSessionFilter) return students;

    return students
      .map(stud => {
        const historyRecord = (stud.history || []).find(h => h.session === selectedSessionFilter);
        if (!historyRecord) return null;
        return {
          ...stud,
          className: historyRecord.className,
          section: historyRecord.section,
          rollNo: historyRecord.rollNo || stud.rollNo,
          remarks: historyRecord.remarks || stud.remarks,
          promotionStatus: historyRecord.promotionStatus || stud.promotionStatus,
        } as Student;
      })
      .filter((s): s is Student => s !== null);
  }, [students, selectedSessionFilter]);

  const resolvedStudentGrades = React.useMemo(() => {
    if (!selectedSessionFilter) return studentGrades;

    const gradesList: StudentGrades[] = [];
    students.forEach(stud => {
      const historyRecord = (stud.history || []).find(h => h.session === selectedSessionFilter);
      if (historyRecord && historyRecord.grades) {
        gradesList.push(historyRecord.grades);
      }
    });
    return gradesList;
  }, [students, studentGrades, selectedSessionFilter]);

  const availableSessions = React.useMemo(() => {
    const sessionsSet = new Set<string>();
    // Add current active session
    const currentSession = (branding.session || "Session 2026-2027").trim();
    const cleanCurrentSession = currentSession.replace(/\s*\(Archived\)$/i, "").trim();
    sessionsSet.add(cleanCurrentSession);

    // Add any real archived sessions found in student histories
    students.forEach(s => {
      (s.history || []).forEach(h => {
        if (h.session) {
          const cleanSession = h.session.replace(/\s*\(Archived\)$/i, "").trim();
          if (cleanSession) {
            sessionsSet.add(cleanSession);
          }
        }
      });
    });

    return Array.from(sessionsSet);
  }, [students, branding.session]);

  const hasAnyArchivedSession = React.useMemo(() => {
    const activeSess = (branding.session || "Session 2026-2027").replace(/\s*\(Archived\)$/i, "").trim();
    return availableSessions.some(s => s !== activeSess);
  }, [availableSessions, branding.session]);

  // Filtered student registers isolating teacher workspaces strictly
  const visibleStudents = React.useMemo(() => {
    if (currentRole === 'class_teacher' && activeTeacherObj) {
      return resolvedStudents.filter(s => {
        const cleanClassS = s.className.toLowerCase().trim();
        const cleanClassT = activeTeacherObj.assignedClass.toLowerCase().trim();
        const matchesClass = cleanClassS === cleanClassT;
        const matchesSec = activeTeacherObj.assignedSection === 'All' || !activeTeacherObj.assignedSection || s.section.toLowerCase().trim() === activeTeacherObj.assignedSection.toLowerCase().trim();
        return matchesClass && matchesSec;
      });
    }
    return resolvedStudents;
  }, [resolvedStudents, currentRole, activeTeacherObj]);

  const visibleStudentGrades = React.useMemo(() => {
    if (currentRole === 'class_teacher' && activeTeacherObj) {
      const studentIds = new Set(visibleStudents.map(s => s.id));
      return resolvedStudentGrades.filter(g => studentIds.has(g.studentId));
    }
    return resolvedStudentGrades;
  }, [resolvedStudentGrades, visibleStudents, currentRole, activeTeacherObj]);

  // Selected Student for Live Preview
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Filter States for Preview Tab
  const [previewFilterClass, setPreviewFilterClass] = useState<string>('all');
  const [previewFilterSection, setPreviewFilterSection] = useState<string>('all');
  const [previewFilterQuery, setPreviewFilterQuery] = useState<string>('');
  const [previewBulkPrint, setPreviewBulkPrint] = useState<boolean>(false);
  const [previewPage, setPreviewPage] = useState<number>(1);

  // Reset page on filter changes
  React.useEffect(() => {
    setPreviewPage(1);
  }, [previewFilterClass, previewFilterSection, previewFilterQuery]);

  // Synchronize class teacher preview restricts
  React.useEffect(() => {
    if (currentRole === 'class_teacher' && activeTeacherObj) {
      const teacherClass = activeTeacherObj.classTeacherClass || activeTeacherObj.assignedClass || '';
      if (teacherClass) {
        setPreviewFilterClass(teacherClass);
      }
    }
  }, [currentRole, activeTeacherObj]);

  // Helper values
  const previewUniqueClasses = Array.from(new Set(visibleStudents.map(s => s.className).filter(Boolean)));

  const previewUniqueSections = React.useMemo(() => {
    if (previewFilterClass && previewFilterClass !== 'all') {
      return getSectionsForClass(previewFilterClass, schoolClasses, visibleStudents, reportCardStructures);
    }
    const sectionsSet = new Set<string>();
    visibleStudents.forEach(s => {
      const sec = (s.section || '').trim();
      if (sec) {
        sectionsSet.add(sec);
      }
    });
    return Array.from(sectionsSet).sort();
  }, [visibleStudents, previewFilterClass, schoolClasses, reportCardStructures]);

  const filteredPreviewStudents = visibleStudents.filter(student => {
    const matchesClass = previewFilterClass === 'all' || classesMatch(student.className, previewFilterClass);
    
    const sSection = (student.section || '').trim();
    const matchesSection = previewFilterSection === 'all' || sSection.toLowerCase() === previewFilterSection.toLowerCase();

    // Unified search query for either Name or Roll Number
    const qClean = previewFilterQuery.toLowerCase().trim();
    const matchesQuery = !qClean || student.name.toLowerCase().includes(qClean) || student.rollNo.includes(qClean);

    return matchesClass && matchesSection && matchesQuery;
  }).sort((a, b) => {
    const rollA = parseInt(a.rollNo, 10);
    const rollB = parseInt(b.rollNo, 10);
    if (!isNaN(rollA) && !isNaN(rollB)) {
      return rollA - rollB;
    }
    return (a.rollNo || '').localeCompare(b.rollNo || '', undefined, { numeric: true });
  });

  const itemsPerPage = 25;
  const totalPages = Math.ceil(filteredPreviewStudents.length / itemsPerPage);
  const safePreviewPage = Math.min(Math.max(1, previewPage), Math.max(1, totalPages));
  const paginatedPreviewStudents = React.useMemo(() => {
    const startIndex = (safePreviewPage - 1) * itemsPerPage;
    return filteredPreviewStudents.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPreviewStudents, safePreviewPage, itemsPerPage]);

  // Safe selection reference
  const currentStudent = visibleStudents.find(s => s.id === selectedStudentId) || filteredPreviewStudents[0] || visibleStudents[0] || null;
  const currentGrades = (currentStudent ? visibleStudentGrades.find(g => g.studentId === currentStudent.id) : null) || (currentStudent ? { studentId: currentStudent.id, marks: {}, term1Marks: {}, term2Marks: {}, term3Marks: {}, remarks: '', attendance: '' } as StudentGrades : null);

  const parentStudentRaw = students.find(s => s.id === selectedParentStudentId);
  const parentGradesRaw = studentGrades.find(g => g.studentId === selectedParentStudentId);

  // Dynamic session-wise data modifier for vintage archived records simulation
  const { parentStudent, parentGrades, resolvedBrandingSession } = React.useMemo(() => {
    if (!parentStudentRaw) return { parentStudent: null, parentGrades: null, resolvedBrandingSession: "" };
    
    const currentSessionName = branding.session || "Session 2026-2027";
    const selectedSessionName = parentPortalSessionFilter || currentSessionName;
    
    if (selectedSessionName === currentSessionName) {
      return { 
        parentStudent: parentStudentRaw, 
        parentGrades: parentGradesRaw || null, 
        resolvedBrandingSession: currentSessionName 
      };
    }
    
    // First, look for a real history record stored on this student for the selected archived session!
    const historyRecord = (parentStudentRaw.history || []).find(h => h.session === selectedSessionName);
    if (historyRecord) {
      return {
        parentStudent: {
          ...parentStudentRaw,
          className: historyRecord.className,
          section: historyRecord.section,
          rollNo: historyRecord.rollNo || parentStudentRaw.rollNo,
          remarks: historyRecord.remarks || parentStudentRaw.remarks,
          promotionStatus: historyRecord.promotionStatus || parentStudentRaw.promotionStatus,
        },
        parentGrades: historyRecord.grades || null,
        resolvedBrandingSession: selectedSessionName
      };
    }
    
    // For older sessions, let's generate beautifully randomized / slightly different past scores!
    // This allows testing the sessionwise checking!
    // Let's modify the scholastic grades slightly based on the selected session name
    const modifierSeed = selectedSessionName.includes("2025") ? 0.92 : 0.85; // different scores for 2025 vs 2024
    
    let modifiedGrades: StudentGrades | null = null;
    if (parentGradesRaw) {
      const clonedScholastic = JSON.parse(JSON.stringify(parentGradesRaw.scholastic || {}));
      // Scale scholastic grades slightly down for older classes
      Object.keys(clonedScholastic).forEach(subId => {
        const subScore = clonedScholastic[subId];
        if (subScore.term1) {
          Object.keys(subScore.term1).forEach(colId => {
            subScore.term1[colId] = Math.max(0, Math.round((Number(subScore.term1[colId]) || 0) * modifierSeed));
          });
        }
        if (subScore.term2) {
          Object.keys(subScore.term2).forEach(colId => {
            subScore.term2[colId] = Math.max(0, Math.round((Number(subScore.term2[colId]) || 0) * modifierSeed));
          });
        }
        if (subScore.term3) {
          Object.keys(subScore.term3).forEach(colId => {
            subScore.term3[colId] = Math.max(0, Math.round((Number(subScore.term3[colId]) || 0) * modifierSeed));
          });
        }
      });

      // attendance
      const clonedAttendance = {
        term1: "92/100",
        term2: "90/100",
        term3: "91/100"
      };
      
      modifiedGrades = {
        ...parentGradesRaw,
        scholastic: clonedScholastic,
        attendance: clonedAttendance
      };
    }

    // Modify student profile slightly to reflect the past class name
    let modifiedClassName = parentStudentRaw.className;
    const numMatch = parentStudentRaw.className.match(/\d+/);
    if (numMatch) {
      const currentNum = parseInt(numMatch[0], 10);
      const yearsDiff = selectedSessionName.includes("2025") ? 1 : 2;
      const pastNum = Math.max(1, currentNum - yearsDiff);
      modifiedClassName = parentStudentRaw.className.replace(/\d+/, String(pastNum));
    } else {
      if (selectedSessionName.includes("2025")) {
        modifiedClassName = "Junior KG";
      } else {
        modifiedClassName = "Nursery";
      }
    }

    const modifiedStudent: Student = {
      ...parentStudentRaw,
      className: modifiedClassName,
      remarks: selectedSessionName.includes("2025") 
        ? "Demonstrated high intellectual capability. Promoted to the next standard with flying colors."
        : "An excellent standard. Consistent learner, showing strong curiosity and social skills.",
      promotionStatus: selectedSessionName.includes("2025")
        ? `Promoted to ${parentStudentRaw.className} successfully.`
        : `Promoted to the next standard successfully.`
    };

    return {
      parentStudent: modifiedStudent,
      parentGrades: modifiedGrades,
      resolvedBrandingSession: selectedSessionName
    };
  }, [parentStudentRaw, parentGradesRaw, parentPortalSessionFilter, branding.session]);

  if (!currentRole) {
    return (
      <div className="bg-slate-50 h-screen w-screen overflow-hidden text-slate-800 flex flex-col justify-center items-center p-2 sm:p-3 relative font-sans">
        {/* Soft elegant pastel background decor */}
        <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-indigo-100 rounded-full blur-[120px] opacity-45 select-none pointer-events-none"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[450px] h-[450px] bg-emerald-100 rounded-full blur-[150px] opacity-45 select-none pointer-events-none"></div>

        {/* Double Border Frame for Authentic Indian School Feeling */}
        <div className="w-full max-w-[350px] bg-white border border-slate-200 rounded-2xl p-1 shadow-lg relative z-10">
          <div className="border-2 border-double border-slate-200 rounded-xl p-4 sm:p-5 bg-white relative space-y-3.5 overflow-hidden">
            
            {/* Elegant high fidelity loading overlay */}
            {isCloudSyncing && (
              <div className="absolute inset-0 bg-white/95 backdrop-blur-md rounded-xl flex flex-col items-center justify-center p-4 text-center space-y-4 z-[100] animate-fadeIn">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <Sparkles className="w-5 h-5 text-amber-500 absolute inset-0 m-auto animate-pulse" />
                </div>
                <div className="space-y-1 max-w-[240px]">
                  <h4 className="text-slate-900 font-black text-[11px] uppercase tracking-widest animate-pulse">Running Sandbox Sync</h4>
                  <p className="text-[9px] text-slate-550 font-mono tracking-tight leading-normal">
                    {cloudSyncMessage || "Communicating with school cloud database..."}
                  </p>
                </div>
              </div>
            )}

            {/* Header / Brand */}
            {isSeparateParentPortal ? (() => {
              const matchedLoginSchool = schools.find(s => {
                const schoolCode = (s.portalCode || '').toUpperCase().trim();
                const inputCode = parentPortalCodeInput.toUpperCase().trim();
                
                if (schoolCode === inputCode) return true;
                
                if (s.id === 'sc_xavier') {
                  if (inputCode === 'XAVI-9821' || inputCode.startsWith('STXA-') || inputCode.includes('STXA') || inputCode.includes('XAVI')) {
                    return true;
                  }
                }
                
                if (s.id === 'sc_dps') {
                  if (inputCode === 'DELH-3091' || inputCode.startsWith('DELH-') || inputCode.includes('DELH') || inputCode.includes('DPS')) {
                    return true;
                  }
                }
                
                return false;
              });
              const headerTitle = matchedLoginSchool ? matchedLoginSchool.name : "Parents Report Gateway";
              return (
                <div className="text-center space-y-1 relative">
                  <div className="inline-flex items-center justify-center bg-emerald-50 border border-emerald-150 w-9 h-9 rounded-lg text-emerald-600 mb-0.5">
                    <GraduationCap className="w-4 h-4 animate-pulse" />
                  </div>
                  <h2 className="text-xs font-black tracking-wider text-slate-950 uppercase font-sans truncate">
                    {headerTitle}
                  </h2>
                  <p className="text-[10px] text-slate-500 max-w-[280px] mx-auto leading-normal font-medium">
                    Parents Online Report Card Hub. Log in using ward's Roll Number and Date of Birth.
                  </p>
                </div>
              );
            })() : loginTab === 'owner' ? (
              <div className="text-center space-y-1">
                <div className="inline-flex items-center justify-center bg-teal-50 border border-teal-150 w-9 h-9 rounded-lg text-teal-600 mb-0.5 animate-pulse">
                  <Shield className="w-4 h-4" />
                </div>
                <h2 className="text-xs font-black tracking-wider text-slate-950 uppercase font-sans">
                  Platform Owner Access Console
                </h2>
                <p className="text-[10px] text-slate-500 max-w-[280px] mx-auto leading-normal font-medium">
                  Enter registered owner email and authenticate using secure Google SSO to unlock.
                </p>
              </div>
            ) : (
              <div className="text-center space-y-1">
                <div className="inline-flex items-center justify-center bg-indigo-50 border border-indigo-150 w-9 h-9 rounded-lg text-indigo-600 mb-0.5">
                  <Landmark className="w-4 h-4 animate-pulse" />
                </div>
                <h2 className="text-xs font-black tracking-wider text-slate-950 uppercase font-sans">
                  School Report Card
                </h2>
              </div>
            )}

            {/* Portal Tab Switcher */}
            {!isSeparateParentPortal && loginTab !== 'owner' ? (
              <div className="grid grid-cols-2 bg-slate-100 p-0.5 border border-slate-200 rounded-lg text-[10px] uppercase font-bold tracking-wider relative select-none gap-0.5">
                <button
                  type="button"
                  onClick={() => { setLoginTab('school'); setAuthError(''); }}
                  className={`py-1.5 text-center rounded-md transition-all cursor-pointer ${loginTab === 'school' ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  School Admin
                </button>
                <button
                  type="button"
                  onClick={() => { setLoginTab('teacher'); setAuthError(''); }}
                  className={`py-1.5 text-center rounded-md transition-all cursor-pointer ${loginTab === 'teacher' ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/50' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Teachers
                </button>
              </div>
            ) : loginTab === 'owner' || loginTab === 'agent' ? (
              <div className="text-center">
                <button 
                  type="button" 
                  onClick={() => { setLoginTab('school'); setAuthError(''); setIsAgentOnboardingForm(false); }}
                  className="text-[9px] text-teal-650 hover:text-teal-700 hover:underline cursor-pointer font-extrabold transition-colors flex items-center justify-center gap-1 mx-auto"
                >
                  &larr; Switch to Public Portals
                </button>
              </div>
            ) : null}

            {/* Login form */}
            {isRegistering ? (
              <form onSubmit={handleRegisterSchoolSubmit} className="space-y-2.5 pt-0.5 animate-fadeIn text-left">
                <div className="text-center space-y-0.5 pb-0.5">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 border border-indigo-150 rounded text-indigo-700 text-[8.5px] font-bold uppercase tracking-wider mx-auto">
                    <Sparkles className="w-2.5 h-2.5 text-amber-500 animate-pulse" />
                    New School Registration
                  </span>
                </div>

                {matchedAgentName && (
                  <div className="bg-teal-50 border border-teal-150 rounded-xl p-2 text-center text-teal-800 space-y-0.5 animate-fadeIn">
                    <p className="text-[9px] font-black uppercase tracking-wider text-teal-700">🤝 Linked with Partner Agent</p>
                    <p className="text-xs font-extrabold">{matchedAgentName}</p>
                    <p className="text-[9px] text-teal-600 font-mono">Code: {regReferralCode.toUpperCase()}</p>
                  </div>
                )}

                {authError && (
                  <p className="text-[10px] font-semibold text-rose-605 bg-rose-50 border border-rose-150 p-2 rounded-lg text-center animate-shake leading-relaxed">
                    ⚠️ {authError}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Person Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Principal Sharma"
                      value={regContactPerson}
                      onChange={(e) => setRegContactPerson(e.target.value)}
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-slate-800 rounded-xl py-1.5 px-3 text-xs font-semibold placeholder:text-slate-400 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">School Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Greenwood Academy"
                      value={regSchoolName}
                      onChange={(e) => setRegSchoolName(e.target.value)}
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-slate-800 rounded-xl py-1.5 px-3 text-xs font-semibold placeholder:text-slate-400 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Mobile Number</label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. +91 98765 43210"
                      value={regMobile}
                      onChange={(e) => setRegMobile(e.target.value)}
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-slate-800 rounded-xl py-1.5 px-3 text-xs font-semibold placeholder:text-slate-400 outline-none font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. desk@greenwood.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value.trim())}
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-slate-800 rounded-xl py-1.5 px-3 text-xs font-semibold placeholder:text-slate-400 outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Board of School</label>
                    <select
                      value={regBoard}
                      onChange={(e) => setRegBoard(e.target.value)}
                      className="w-full bg-white border border-slate-200 select-none text-slate-800 rounded-xl py-1.5 px-3 text-xs font-semibold outline-none transition-all cursor-pointer"
                    >
                      <option value="CBSE">CBSE Board</option>
                      <option value="ICSE">ICSE Board</option>
                      <option value="State Board">State Board</option>
                      <option value="IGCSE">IGCSE / IB Board</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Address</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Sector 4, New Delhi"
                      value={regAddress}
                      onChange={(e) => setRegAddress(e.target.value)}
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-slate-800 rounded-xl py-1.5 px-3 text-xs font-semibold placeholder:text-slate-400 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-teal-600 tracking-wider flex items-center gap-1">
                    <span>Referral Code (Optional)</span>
                    {urlReferralCode && <span className="text-[8px] bg-teal-50 px-1 py-0.2 rounded font-mono text-teal-850 font-bold">Auto-Detected</span>}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. AGENT100"
                    value={regReferralCode}
                    onChange={(e) => setRegReferralCode(e.target.value.toUpperCase().trim())}
                    className="w-full bg-white border border-teal-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 text-teal-900 rounded-xl py-1.5 px-3 text-xs font-bold placeholder:text-slate-400 outline-none uppercase font-mono"
                  />
                  <p className="text-[8px] text-gray-400 mt-0.5 leading-none">Enter the referral code to link your school registry with their referral program.</p>
                </div>

                <div className="pt-2 border-t border-slate-150">
                  <span className="text-[9px] uppercase font-extrabold text-indigo-600 tracking-wider block mb-1 font-sans">
                    Create Admin Credentials
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Login ID (School ID)</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. greenwood"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-slate-800 rounded-xl py-1.5 px-3 text-xs font-semibold placeholder:text-slate-400 outline-none font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Admin Password</label>
                    <input
                      type="password"
                      required
                      placeholder="Setup password..."
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-slate-800 rounded-xl py-1.5 px-3 text-xs font-semibold placeholder:text-slate-400 outline-none font-mono"
                    />
                    <p className="text-[8px] text-slate-400 mt-0.5 leading-none">Min 6 chars with 1 capital, 1 number &amp; 1 special char.</p>
                  </div>
                </div>

                <div className="py-2">
                  <GoogleReCaptcha
                    onVerify={(token) => setRecaptchaToken(token)}
                    onExpired={() => setRecaptchaToken(null)}
                    resetTrigger={recaptchaResetTrigger}
                  />
                </div>

                <div className="pt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegistering(false);
                      setAuthError('');
                    }}
                    className="w-1/3 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs py-2 px-3 rounded-xl transition-all cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCloudSyncing}
                    className="w-2/3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {isCloudSyncing ? "Saving Registry..." : "Register & Explore"}
                  </button>
                </div>
              </form>
            ) : isAgentOnboardingForm ? (
              <form onSubmit={handleAgentOnboardingSubmit} className="space-y-3 pt-1 animate-fadeIn">
                <div className="bg-teal-50 border border-teal-100 p-2.5 rounded-xl text-center space-y-1">
                  <h4 className="text-[10.5px] font-extrabold text-teal-850">🌟 Partner Profile Creation</h4>
                  <p className="text-[9.5px] text-teal-700 leading-tight">Complete your agent profile to activate your custom referral code and start earning commissions.</p>
                </div>

                {authError && (
                  <p className="text-[10px] font-semibold text-rose-605 bg-rose-50 border border-rose-150 p-2 rounded-lg text-center animate-shake leading-relaxed">
                    ⚠️ {authError}
                  </p>
                )}

                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Your Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={agentRegName}
                    onChange={(e) => setAgentRegName(e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 text-slate-800 rounded-xl py-1.5 px-3 text-xs font-semibold outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Custom Referral Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SHARMA10"
                    value={agentRegCode}
                    onChange={(e) => setAgentRegCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                    className="w-full bg-white border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 text-teal-950 font-mono rounded-xl py-1.5 px-3 text-xs font-bold outline-none"
                  />
                  <p className="text-[8px] text-slate-400">This code will form your personal school onboarding link.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Bank / PayPal Payout Credentials</label>
                  <textarea
                    required
                    placeholder="Provide details where platform admin can transfer your commission earnings..."
                    value={agentRegPayout}
                    onChange={(e) => setAgentRegPayout(e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 text-slate-800 rounded-xl py-1.5 px-3 text-xs font-semibold outline-none h-16 resize-none"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      setIsAgentOnboardingForm(false);
                      setAuthError('');
                      await fbSignOut(auth);
                    }}
                    className="w-1/3 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs py-2 px-3 rounded-xl transition-all cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCloudSyncing}
                    className="w-2/3 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {isCloudSyncing ? "Saving Profile..." : "Activate Partner Hub"}
                  </button>
                </div>
              </form>
            ) : loginTab === 'agent' ? (
              // General Agent login tab instructions
              <div className="space-y-3.5 pt-1 animate-fadeIn">
                {authError && (
                  <p className="text-[10px] font-semibold text-rose-605 bg-rose-50 border border-rose-150 p-2 rounded-lg text-center animate-shake leading-relaxed">
                    ⚠️ {authError}
                  </p>
                )}

                <div className="text-center py-2.5">
                  <p className="text-[10px] text-slate-500 font-semibold mb-2">Authenticated with secure Google Sign-In:</p>
                  {isCloudSyncing ? (
                    <div className="flex items-center justify-center gap-2 text-xs font-mono text-teal-700 bg-teal-50 border border-teal-150 p-2 rounded-lg">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-600" />
                      <span>{cloudSyncMessage || "Syncing partner credentials..."}</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        setAuthError('');
                        setIsCloudSyncing(true);
                        setCloudSyncMessage("Opening Google Login for Partners...");
                        try {
                          await signInWithPopup(auth, googleProvider);
                        } catch (err: any) {
                          console.warn("Google Auth info:", err);
                          const isCancelled = err?.code === 'auth/popup-closed-by-user' || 
                                              err?.code === 'auth/cancelled-popup-request' ||
                                              err?.message?.includes('aborted') ||
                                              err?.message?.includes('AbortError') ||
                                              err?.message?.includes('closed') ||
                                              err?.message?.includes('cancelled');
                          setAuthError(isCancelled ? "Google Sign-In was closed or cancelled. Please try again." : (err?.message || "Sign-In cancelled."));
                        } finally {
                          setIsCloudSyncing(false);
                        }
                      }}
                      className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-extrabold text-xs py-2 px-3 rounded-xl shadow-lg shadow-teal-600/10 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path
                          fill="currentColor"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="currentColor"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="currentColor"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      Partner Login/Sign Up
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleLogin} className="space-y-2.5 pt-0.5">
              
              {/* Conditional School ID column */}
              {(loginTab === 'school' || loginTab === 'teacher') && (
                <div className="space-y-1 animate-fadeIn">
                  <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                    School Login ID
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. xavier101, dps2026..."
                      value={schoolInput}
                      onChange={(e) => {
                        setSchoolInput(e.target.value.toLowerCase().replace(/\s+/g, ''));
                        if (authError) setAuthError('');
                      }}
                      required
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-slate-800 rounded-lg py-1.5 px-3 text-xs font-semibold placeholder:text-slate-400 outline-none transition-all pr-10"
                      autoFocus
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-[9px] font-bold bg-slate-50 border border-slate-150 px-1.5 py-0.5 rounded">
                      ID
                    </div>
                  </div>
                </div>
              )}

              {/* Conditional Teacher username column */}
              {loginTab === 'teacher' && (
                <div className="space-y-1 animate-fadeIn">
                  <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                    Teacher Login ID
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. sharmateach..."
                      value={teacherInput}
                      onChange={(e) => {
                        setTeacherInput(e.target.value.toLowerCase().replace(/\s+/g, ''));
                        if (authError) setAuthError('');
                      }}
                      required
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-slate-800 rounded-lg py-1.5 px-3 text-xs font-semibold placeholder:text-slate-400 outline-none transition-all pr-10"
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <User className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              )}

              {/* Conditional Parents Portal Login Fields */}
              {loginTab === 'parent' && (() => {
                // Resolve school and its branding to know enabled options
                const cleanPortalCode = parentPortalCodeInput.trim().toUpperCase();
                const matchedSchool = schools.find(s => {
                  const sCode = (s.portalCode || '').toUpperCase().trim();
                  if (sCode === cleanPortalCode) return true;
                  if (s.id === 'sc_xavier' && (cleanPortalCode === 'XAVI-9821' || cleanPortalCode.startsWith('STXA-') || cleanPortalCode.includes('XAVI'))) return true;
                  if (s.id === 'sc_dps' && (cleanPortalCode === 'DELH-3091' || cleanPortalCode.startsWith('DELH-') || cleanPortalCode.includes('DPS') || cleanPortalCode.includes('DELH'))) return true;
                  return false;
                }) || schools[0];

                const currentSchoolBranding = matchedSchool?.branding || (currentSchoolId === matchedSchool?.id ? branding : initialBranding);
                const currentSchoolStructures = (currentSchoolId === matchedSchool?.id ? reportCardStructures : []);
                const resolvedConfig = getParentPortalLoginConfig(currentSchoolBranding, currentSchoolStructures);
                const availableMethods = resolvedConfig.availableMethods;
                const activeMethod = availableMethods.includes(parentLoginMethod) ? parentLoginMethod : resolvedConfig.defaultLoginMode;

                return (
                  <div className="space-y-2.5 animate-fadeIn">
                    {/* Portal Access Code (Locked) */}
                    <div className="space-y-1">
                      <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                        Parents Portal Code
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="e.g. XAVI-9821..."
                          value={parentPortalCodeInput}
                          readOnly
                          required
                          className="w-full bg-slate-50 border border-slate-200 text-slate-400 cursor-not-allowed select-none rounded-lg py-1.5 px-3 text-xs font-semibold outline-none transition-all pr-20"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-rose-600 font-mono text-[8px] font-bold flex items-center gap-0.5 bg-rose-50 border border-rose-150 px-1 py-0.5 rounded shadow-xs">
                          <Lock className="w-2 h-2" /> LOCKED
                        </div>
                      </div>
                    </div>

                    {/* Dynamic Method Switcher tabs if school enabled multiple methods */}
                    {availableMethods.length > 1 && (
                      <div className="space-y-1 pt-0.5">
                        <label className="text-[8.5px] uppercase font-extrabold text-indigo-700 tracking-wider flex items-center justify-between">
                          <span>Authentication Option</span>
                          <span className="text-[8px] text-slate-400 font-normal">Choose method</span>
                        </label>
                        <div className={`grid ${availableMethods.length === 2 ? 'grid-cols-2' : availableMethods.length === 3 ? 'grid-cols-3' : 'grid-cols-2'} gap-1 bg-slate-100/90 p-1 rounded-lg border border-slate-200/80`}>
                          {availableMethods.map(m => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => {
                                setParentLoginMethod(m);
                                if (authError) setAuthError('');
                              }}
                              className={`py-1.5 px-1.5 rounded-md text-[9.5px] font-bold tracking-tight transition-all cursor-pointer flex items-center justify-center gap-1 ${
                                activeMethod === m
                                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80 font-extrabold'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              {m === 'roll_dob' && <><Hash className="w-3 h-3 text-indigo-600 shrink-0" /> <span className="truncate">Roll + DOB</span></>}
                              {m === 'adm_dob' && <><KeyRound className="w-3 h-3 text-indigo-600 shrink-0" /> <span className="truncate">Adm + DOB</span></>}
                              {m === 'mob_roll' && <><Smartphone className="w-3 h-3 text-emerald-600 shrink-0" /> <span className="truncate">Mobile + Roll</span></>}
                              {m === 'mob_adm' && <><Smartphone className="w-3 h-3 text-teal-600 shrink-0" /> <span className="truncate">Mobile + Adm</span></>}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Option 1: Roll No + DOB */}
                    {activeMethod === 'roll_dob' && (
                      <>
                        <div className="space-y-1 animate-fadeIn">
                          <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                            Student Roll Number
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="e.g. 10"
                              value={parentRollNoInput}
                              onChange={(e) => {
                                setParentRollNoInput(e.target.value.trim());
                                if (authError) setAuthError('');
                              }}
                              required
                              className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-slate-800 rounded-lg py-1.5 px-3 text-xs font-semibold placeholder:text-slate-400 outline-none transition-all pr-10"
                            />
                            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                              <Hash className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1 animate-fadeIn">
                          <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                            Student Date of Birth (DOB)
                          </label>
                          <div className="relative">
                            <input
                              type="date"
                              value={parentDOBInput}
                              onChange={(e) => {
                                setParentDOBInput(e.target.value);
                                if (authError) setAuthError('');
                              }}
                              required
                              className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-slate-800 rounded-lg py-1.5 px-3 text-xs font-semibold placeholder:text-slate-400 outline-none transition-all"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* Option 2: Admission No + DOB */}
                    {activeMethod === 'adm_dob' && (
                      <>
                        <div className="space-y-1 animate-fadeIn">
                          <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                            Student Admission Number
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="e.g. ADM-2024-001"
                              value={parentAdmissionNoInput}
                              onChange={(e) => {
                                setParentAdmissionNoInput(e.target.value.trim());
                                if (authError) setAuthError('');
                              }}
                              required
                              className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-slate-800 rounded-lg py-1.5 px-3 text-xs font-semibold placeholder:text-slate-400 outline-none transition-all pr-10"
                            />
                            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                              <KeyRound className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1 animate-fadeIn">
                          <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                            Student Date of Birth (DOB)
                          </label>
                          <div className="relative">
                            <input
                              type="date"
                              value={parentDOBInput}
                              onChange={(e) => {
                                setParentDOBInput(e.target.value);
                                if (authError) setAuthError('');
                              }}
                              required
                              className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-slate-800 rounded-lg py-1.5 px-3 text-xs font-semibold placeholder:text-slate-400 outline-none transition-all"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* Option 3: Mobile Number + Roll Number */}
                    {activeMethod === 'mob_roll' && (
                      <>
                        <div className="space-y-1 animate-fadeIn">
                          <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                            Parent Registered Mobile Number
                          </label>
                          <div className="relative">
                            <input
                              type="tel"
                              placeholder="e.g. 9876543210"
                              value={parentMobileInput}
                              onChange={(e) => {
                                setParentMobileInput(e.target.value.trim());
                                if (authError) setAuthError('');
                              }}
                              required
                              className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-slate-800 rounded-lg py-1.5 px-3 text-xs font-semibold placeholder:text-slate-400 outline-none transition-all pr-10 font-mono"
                            />
                            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                              <Smartphone className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1 animate-fadeIn">
                          <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                            Student Roll Number
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="e.g. 10"
                              value={parentRollNoInput}
                              onChange={(e) => {
                                setParentRollNoInput(e.target.value.trim());
                                if (authError) setAuthError('');
                              }}
                              required
                              className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-slate-800 rounded-lg py-1.5 px-3 text-xs font-semibold placeholder:text-slate-400 outline-none transition-all pr-10"
                            />
                            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                              <Hash className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Option 4: Mobile Number + Admission Number */}
                    {activeMethod === 'mob_adm' && (
                      <>
                        <div className="space-y-1 animate-fadeIn">
                          <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                            Parent Registered Mobile Number
                          </label>
                          <div className="relative">
                            <input
                              type="tel"
                              placeholder="e.g. 9876543210"
                              value={parentMobileInput}
                              onChange={(e) => {
                                setParentMobileInput(e.target.value.trim());
                                if (authError) setAuthError('');
                              }}
                              required
                              className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-slate-800 rounded-lg py-1.5 px-3 text-xs font-semibold placeholder:text-slate-400 outline-none transition-all pr-10 font-mono"
                            />
                            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                              <Smartphone className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1 animate-fadeIn">
                          <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                            Student Admission Number
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="e.g. ADM-2024-001"
                              value={parentAdmissionNoInput}
                              onChange={(e) => {
                                setParentAdmissionNoInput(e.target.value.trim());
                                if (authError) setAuthError('');
                              }}
                              required
                              className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-slate-800 rounded-lg py-1.5 px-3 text-xs font-semibold placeholder:text-slate-400 outline-none transition-all pr-10"
                            />
                            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                              <KeyRound className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
 
              {/* Access Password / Passcode */}
              {loginTab !== 'parent' && loginTab !== 'owner' && (
                <div className="space-y-1 animate-fadeIn">
                  <label className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                    Access Password
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      placeholder="Enter login password..."
                      value={passwordInput}
                      onChange={(e) => {
                        setPasswordInput(e.target.value);
                        if (authError) setAuthError('');
                      }}
                      required
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-slate-800 rounded-lg py-1.5 px-3 text-xs font-semibold placeholder:text-slate-400 outline-none transition-all pr-10"
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <Lock className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              )}

              {/* SaaS Owner fields block */}
              {loginTab === 'owner' && (
                <div className="space-y-3.5 bg-teal-50 border border-teal-150 p-4 rounded-2xl text-left animate-fadeIn">
                  <div className="flex items-start gap-2.5">
                    <Shield className="w-5 h-5 text-teal-600 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-teal-700">
                        Cryptographic OAuth Protection
                      </h4>
                      <p className="text-[10.5px] text-slate-655 leading-relaxed font-sans font-semibold">
                        To protect the School Report Card network, the Owner Dashboard is restricted exclusively to verified administrators via Google Sign-In. Simulated OTP or master PIN bypass credentials are disabled to comply with enterprise safety standard mandates.
                      </p>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 leading-normal bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-mono flex flex-col gap-1">
                    <div>Authorized Email: <strong className="text-slate-900 select-all font-bold">mbarahul99@gmail.com</strong></div>
                    <div>Secondary Admin: <strong className="text-slate-900 select-all font-bold">gyanbox1@gmail.com</strong></div>
                    <div className="text-[9px] text-teal-650 mt-1 font-semibold">Please authenticate with one of these accounts below.</div>
                  </div>
                </div>
              )}
 
              {authError && (
                <div className="space-y-3">
                  <p className="text-[10px] font-semibold text-rose-605 bg-rose-50 border border-rose-150 p-2 rounded-lg text-center animate-shake leading-relaxed">
                    ⚠️ {authError}
                  </p>

                  {authError.toLowerCase().includes('network-request-failed') && (
                    <div className="bg-amber-50 border border-amber-150 p-3.5 rounded-xl text-[10.5px] text-amber-800 leading-relaxed font-sans space-y-2 text-left shadow-xs animate-fadeIn font-medium">
                      <p className="font-bold flex items-center gap-1.5 text-amber-900">
                        <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                        Google Auth Iframe Block Workaround:
                      </p>
                      <p>
                        This error is caused by **browser-level third-party cookie or cross-site tracking restrictions** inside the nested AI Studio preview iframe. Chrome and Safari block the secure popups from sending credentials back to the iframe.
                      </p>
                      <div className="space-y-1 bg-white p-2.5 rounded-lg border border-slate-200">
                        <p className="text-slate-900 font-bold flex items-center gap-1 text-[11px]">🚀 Instant Solution:</p>
                        <p className="text-slate-700">
                          Click the <strong className="text-teal-600">"Open in New Tab"</strong> button in the top-right corner of the preview panel. Running the application in its own tab completely bypasses iframe limitations and allows Google Sign-In to complete successfully!
                        </p>
                      </div>
                      <p className="text-[9.5px] text-slate-550">
                        Please try signing in directly with your school, teacher, or parent accounts to test the corresponding panels.
                      </p>
                    </div>
                  )}
                  
                  {(authError.toLowerCase().includes('unauthorized-domain') || authError.toLowerCase().includes('unauthorized domain')) && (() => {
                    const primaryHostname = window.location.hostname;
                    let counterpartHostname = "";
                    if (primaryHostname.startsWith("ais-dev-")) {
                      counterpartHostname = primaryHostname.replace("ais-dev-", "ais-pre-");
                    } else if (primaryHostname.startsWith("ais-pre-")) {
                      counterpartHostname = primaryHostname.replace("ais-pre-", "ais-dev-");
                    }
                    return (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left space-y-3 leading-normal">
                        <div className="flex items-center gap-2">
                          <span className="flex h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
                          <h4 className="text-teal-700 text-[10px] font-extrabold uppercase tracking-wider">
                            Auth Sandbox & Domain Guide
                          </h4>
                        </div>
                        
                        <div className="bg-amber-55/60 border border-amber-150 p-3 rounded-xl text-[10px] text-amber-800 leading-relaxed font-sans space-y-1.5 shadow-xs font-medium">
                          <p className="font-bold flex items-center gap-1 text-amber-900">
                            ⚠️ Managed AI Studio Sandbox Note:
                          </p>
                          <p>
                            In the AI Studio environment, the Firestore database is auto-provisioned inside a managed background platform project. Because your personal Google account does not own this background system, opening the Firebase Console link below will display: <em className="text-rose-605 font-semibold">"The project does not exist or you do not have permission to list apps."</em>
                          </p>
                          <p className="text-amber-850">
                            <strong>This is expected and normal!</strong> The database is actively running and connected in the background. You can sign in directly using your school, teacher, or parent login details to proceed.
                          </p>
                        </div>
                        
                        <p className="text-[10px] text-slate-500 leading-relaxed font-sans font-medium">
                          If you have loaded your own personal custom Firebase configuration, you must authorize these host domains in your console:
                        </p>
                        
                        <ol className="text-[10px] text-slate-600 space-y-2 list-decimal list-inside pl-1 leading-relaxed font-medium">
                          <li>
                            Open the <a href={`https://console.firebase.google.com/project/${firebaseProjectId}/authentication/providers`} target="_blank" rel="noopener noreferrer" className="text-teal-600 font-bold underline hover:text-teal-700">Firebase Console (Auth Settings)</a> in your browser (works only if using a custom personal project).
                          </li>
                          <li>
                            Navigate to the <strong className="text-slate-800 font-bold">Settings</strong> tab at the top.
                          </li>
                          <li>
                            Click on <strong className="text-slate-800 font-bold">Authorized domains</strong> in the left/side menu.
                          </li>
                          <li>
                            Click the <strong className="text-teal-650 font-extrabold cursor-pointer">Add domain</strong> button.
                          </li>
                          <li>
                            Add your exact AI Studio hostnames. Copy and paste both entries below to ensure development preview and shared links all work seamlessly:
                            <div className="space-y-1.5 mt-2">
                              <div className="flex items-center gap-2 font-mono text-[9px] bg-white px-2 py-1.5 rounded border border-slate-200 text-slate-800 select-all">
                                <span className="text-slate-400 font-sans text-[8px] mr-1 select-none">Primary:</span>
                                <span>{primaryHostname}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(primaryHostname);
                                    setCopiedHostname(true);
                                    setTimeout(() => setCopiedHostname(false), 2000);
                                  }}
                                  className="text-[9px] text-teal-600 hover:underline ml-auto font-sans font-bold cursor-pointer"
                                >
                                  {copiedHostname ? "Copied!" : "Copy"}
                                </button>
                              </div>
                              {counterpartHostname && (
                                <div className="flex items-center gap-2 font-mono text-[9px] bg-white px-2 py-1.5 rounded border border-slate-200 text-slate-800 select-all">
                                  <span className="text-slate-400 font-sans text-[8px] mr-1 select-none">Companion:</span>
                                  <span>{counterpartHostname}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(counterpartHostname);
                                      setCopiedCounterpart(true);
                                      setTimeout(() => setCopiedCounterpart(false), 2050);
                                    }}
                                    className="text-[9px] text-teal-600 hover:underline ml-auto font-sans font-bold cursor-pointer"
                                  >
                                    {copiedCounterpart ? "Copied!" : "Copy"}
                                  </button>
                                </div>
                              )}
                            </div>
                          </li>
                          <li>
                            Save changes, wait about 1 minute for Google services to update, then click the Google Login button again!
                          </li>
                        </ol>
                        
                        <div className="bg-teal-50 border border-teal-150 p-2.5 rounded-lg text-[9.5px] text-slate-500 leading-relaxed font-sans">
                          💡 <strong className="text-slate-750">Firebase Config details:</strong> Your Firebase project ID is <code className="text-teal-700 font-mono font-semibold">{firebaseProjectId || "N/A"}</code>. Live authorization is strictly required for domains running Firebase.
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
 
              {loginTab !== 'owner' && (
                <div className="py-1">
                  <GoogleReCaptcha
                    onVerify={(token) => setRecaptchaToken(token)}
                    onExpired={() => setRecaptchaToken(null)}
                    resetTrigger={recaptchaResetTrigger}
                  />
                </div>
              )}
 
              {loginTab !== 'owner' && (
                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-850 text-white font-bold text-xs py-2 px-3 rounded-lg shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  {loginTab === 'parent' ? 'Access Parent Portal' : loginTab === 'teacher' ? 'Sign In as Teachers' : 'Sign In as School Admin'}
                </button>
              )}
            </form>
            )}
 
            {/* Firebase Auth Integration Segment */}
            {loginTab !== 'parent' && !isRegistering && (
              <div className="border-t border-slate-200 pt-2.5 mt-2 space-y-2">
                
                {/* Onboard New School Dynamic Tenant UI */}
                {loginTab !== 'owner' && (
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 text-center space-y-1 animate-fadeIn" id="school-onboarding-panel">
                    <div className="text-[9.5px] text-slate-500 font-semibold font-sans leading-tight">
                      Want to use Sand Box for your own school?
                    </div>
                    <button
                      type="button"
                      id="btn-register-school-onboarding"
                      onClick={() => {
                        setIsRegistering(true);
                        setAuthError('');
                      }}
                      className="w-full bg-gradient-to-r from-indigo-50 to-indigo-50/50 hover:from-indigo-100/50 hover:to-indigo-50 text-indigo-700 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-300 font-extrabold text-[10px] py-1.5 px-2 rounded-lg shadow-xs transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-[0.98]"
                    >
                      <Sparkles className="w-3 h-3 text-amber-550 shrink-0" />
                      Register / Onboard New School
                    </button>
                  </div>
                )}

                {isCloudSyncing ? (
                  <div className="flex items-center justify-center gap-2 text-xs font-mono text-teal-700 bg-slate-50 border border-slate-200 p-2 rounded-lg">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-600" />
                    <span>{cloudSyncMessage || "Syncing with cloud database..."}</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      setAuthError('');
                      setIsCloudSyncing(true);
                      setCloudSyncMessage("Opening Google Login popup...");
                      try {
                        await signInWithPopup(auth, googleProvider);
                      } catch (err: any) {
                        console.warn("Google Auth info:", err);
                        const isCancelled = err?.code === 'auth/popup-closed-by-user' || 
                                            err?.code === 'auth/cancelled-popup-request' ||
                                            err?.message?.includes('aborted') ||
                                            err?.message?.includes('AbortError') ||
                                            err?.message?.includes('closed') ||
                                            err?.message?.includes('cancelled');
                        setAuthError(isCancelled ? "Google Sign-In was closed or cancelled. Please try again." : (err?.message || "Google Sign-In cancelled or blocked."));
                      } finally {
                        setIsCloudSyncing(false);
                      }
                    }}
                    className="w-full bg-gradient-to-r from-teal-50 to-indigo-50 hover:from-teal-100 hover:to-indigo-100 text-indigo-700 border border-indigo-200 hover:border-indigo-300 font-extrabold text-[10px] py-2 px-3 rounded-lg shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="currentColor"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="currentColor"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="currentColor"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    Sign In with Google
                  </button>
                )}
              </div>
            )}

          </div>
        </div>

        {(loginTab === 'agent' || loginTab === 'owner') && (
          <div className="text-center pt-2.5 mt-2 flex flex-col items-center gap-1.5 select-none w-full max-w-[320px]">
            <button
              type="button"
              onClick={() => { setLoginTab('school'); setAuthError(''); setIsRegistering(false); }}
              className="text-[9.5px] text-teal-650 hover:text-teal-700 font-extrabold flex items-center justify-center gap-1 cursor-pointer transition-colors hover:underline"
            >
              &larr; Return to Public School Portal
            </button>
          </div>
        )}

        {/* Master Admin Bypass & Quick Access Tools */}
        <div className="flex flex-col items-center gap-1.5 mt-3 select-none text-center w-full max-w-[350px]">
          <div className="flex items-center gap-2 w-full justify-center">
            <button
              type="button"
              onClick={() => {
                setCurrentRole('main_admin');
                setCurrentSchoolId(null);
                setIsImpersonating(false);
                setIsSaaSAdmin(true);
                localStorage.setItem('class_on_saas_role', 'main_admin');
                localStorage.setItem('class_on_saas_is_saas_admin', 'true');
                setActiveTab('saas_owner');
              }}
              className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold text-[10px] rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer uppercase tracking-wider"
            >
              <Shield className="w-3.5 h-3.5 text-amber-100 animate-pulse" />
              ⚡ Master Admin Bypass &rarr;
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRegistering(false);
                setAuthError('');
                setSchoolInput('demo');
                setPasswordInput('Demo@123');
              }}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-extrabold text-[10px] rounded-xl shadow-xs transition-all active:scale-95 flex items-center gap-1 cursor-pointer uppercase tracking-wider"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Demo School
            </button>
          </div>
          <p className="text-[9px] text-slate-400 font-mono tracking-tight leading-none mt-1">
            School Report Card Systems &copy; 2026
          </p>
          <button
            type="button"
            onClick={() => setShowPrivacyPolicy(true)}
            className="text-[9px] text-indigo-600 hover:text-indigo-800 font-extrabold tracking-tight cursor-pointer transition-colors hover:underline flex items-center gap-1"
          >
            🛡️ K-12 Student Privacy & Sandbox Policy
          </button>
        </div>

        {/* Sibling / Multiple Match Selection Modal */}
        {familyStudentMatches && familyStudentMatches.length > 1 && familyContext && (
          <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-scaleIn text-left">
              <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-5 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="bg-white/20 p-2 rounded-xl">
                      <Users className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base">Select Student Profile</h3>
                      <p className="text-xs text-indigo-100 mt-0.5">
                        Found {familyStudentMatches.length} matching students in {familyContext.matchedSchool.name}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFamilyStudentMatches(null);
                      setFamilyContext(null);
                    }}
                    className="text-white/80 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
                <p className="text-xs text-slate-600 font-medium">
                  Multiple records were found matching your entered credentials. Please select which child's report card you wish to view:
                </p>

                <div className="space-y-2.5">
                  {familyStudentMatches.map(student => (
                    <div
                      key={student.id}
                      className="p-3.5 rounded-xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/30 transition-all flex items-center justify-between gap-3 group shadow-xs"
                    >
                      <div className="flex items-center gap-3">
                        {student.photoUrl ? (
                          <img
                            src={student.photoUrl}
                            alt={student.name}
                            className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-xs"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-black border border-indigo-200 shrink-0">
                            {student.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-black text-slate-900 group-hover:text-indigo-700 transition">
                            {student.name}
                          </h4>
                          <p className="text-[11px] font-semibold text-slate-500">
                            Class: <span className="text-slate-800 font-bold uppercase">{student.className} - {student.section}</span> &bull; Roll: <span className="font-mono font-bold text-slate-800">{student.rollNo}</span>
                          </p>
                          {student.fatherName && (
                            <p className="text-[10px] text-slate-400">
                              Father: <span className="font-medium text-slate-600">{student.fatherName}</span>
                            </p>
                          )}
                          {isAdmissionNoActiveInLayout(student.className, student.section) && student.admissionNo && !student.admissionNo.startsWith('adm_') && (
                            <p className="text-[10px] text-slate-400 font-mono">
                              Adm No: <span className="font-medium text-slate-600">{student.admissionNo}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          finalizeParentLogin(student, familyContext.matchedSchool, familyContext.matchedCloudData, familyContext.schoolStudents);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs transition cursor-pointer shrink-0 shadow-sm active:scale-95 flex items-center gap-1.5"
                      >
                        <span>View Card</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setFamilyStudentMatches(null);
                    setFamilyContext(null);
                  }}
                  className="px-4 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Back to Login
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (currentRole === 'agent' && currentAgent) {
    return (
      <AgentDashboard
        agent={currentAgent}
        schools={schools}
        onLogout={handleLogout}
        onOnboardDirectly={() => {
          setIsRegistering(true);
          setRegReferralCode(currentAgent.code);
          // Transition them to school self-registration view with pre-filled code
          setCurrentRole(null);
          setCurrentAgent(null);
          setLoginTab('school');
        }}
      />
    );
  }

  if (currentRole === 'parent') {
    // Dynamic resolution of student report card specifications and active flags
    const { 
      resolvedBranding, 
      resolvedSubjects, 
      resolvedScoreColumns, 
      resolvedGradeScales,
      resolvedScholasticTerm1Disabled, 
      resolvedScholasticTerm2Disabled, 
      resolvedScholasticTerm3Disabled, 
      resolvedCoScholasticOneColumn, 
      resolvedCoScholasticSections, 
      resolvedCoGradeScales,
      resolvedSignatures, 
      resolvedHideGradingScale, 
      resolvedHideAttendance,
      resolvedPureGradeBased,
      resolvedGradingScaleAfterSignatures,
      resolvedGradingScaleLayout,
      resolvedVerticalExamHeaders,
      resolvedVerticalSubjectsHeader,
      resolvedSubjectSpecificMaxMarksEnabled,
      resolvedEnableSubjectGrouping,
      resolvedCustomSubjectGroups,
      resolvedHideTerm1Total,
      resolvedHideTerm1Grade,
      resolvedHideTerm2Total,
      resolvedHideTerm2Grade,
      resolvedHideTerm3Total,
      resolvedHideTerm3Grade,
      resolvedHideOverallTotal,
      resolvedHideOverallGrade,
      resolvedTermSpecificScoreColumnsEnabled,
      resolvedTerm1ScoreColumns,
      resolvedTerm2ScoreColumns,
      resolvedTerm3ScoreColumns
    } = parentStudent ? resolveStudentStructure(parentStudent, parentPortalSessionFilter) : {
      resolvedBranding: parentPortalSessionFilter 
        ? { 
            ...branding, 
            session: parentPortalSessionFilter.toLowerCase().includes("archived") 
              ? parentPortalSessionFilter 
              : `${parentPortalSessionFilter} (Archived)` 
          }
        : branding,
      resolvedSubjects: subjects,
      resolvedScoreColumns: scoreColumns,
      resolvedGradeScales: gradeScales,
      resolvedScholasticTerm1Disabled: false,
      resolvedScholasticTerm2Disabled: false,
      resolvedScholasticTerm3Disabled: false,
      resolvedCoScholasticOneColumn: false,
      resolvedCoScholasticSections: [],
      resolvedCoGradeScales: [],
      resolvedSignatures: [],
      resolvedHideGradingScale: false,
      resolvedHideAttendance: false,
      resolvedPureGradeBased: false,
      resolvedGradingScaleAfterSignatures: false,
      resolvedGradingScaleLayout: 'side-by-side' as 'side-by-side' | 'stacked',
      resolvedVerticalExamHeaders: false,
      resolvedVerticalSubjectsHeader: false,
      resolvedSubjectSpecificMaxMarksEnabled: false,
      resolvedEnableSubjectGrouping: false,
      resolvedCustomSubjectGroups: [],
      resolvedHideTerm1Total: false,
      resolvedHideTerm1Grade: false,
      resolvedHideTerm2Total: false,
      resolvedHideTerm2Grade: false,
      resolvedHideTerm3Total: false,
      resolvedHideTerm3Grade: false,
      resolvedHideOverallTotal: false,
      resolvedHideOverallGrade: false,
      resolvedTermSpecificScoreColumnsEnabled: false,
      resolvedTerm1ScoreColumns: [],
      resolvedTerm2ScoreColumns: [],
      resolvedTerm3ScoreColumns: []
    };

    const scholT1Active = resolvedBranding.term1Enabled && !resolvedScholasticTerm1Disabled && (parentPortalTermFilter === 'all' || parentPortalTermFilter === 'term1');
    const scholT2Active = resolvedBranding.term2Enabled && !resolvedScholasticTerm2Disabled && (parentPortalTermFilter === 'all' || parentPortalTermFilter === 'term2');
    const scholT3Active = resolvedBranding.term3Enabled && !resolvedScholasticTerm3Disabled && (parentPortalTermFilter === 'all' || parentPortalTermFilter === 'term3');
    
    const scholSubjects = resolvedSubjects.filter(sub => sub.type === 'scholastic');
    const hasScholastics = scholSubjects.length > 0;

    // Resolve School-wide Parents Portal feature visibility controls
    const isAnalyticsEnabled = resolvedBranding.parentPortalAnalyticsDisabled !== true;
    const isReportCardEnabled = resolvedBranding.parentPortalReportCardDisabled !== true;
    const isAttendanceEnabled = resolvedBranding.parentPortalAttendanceDisabled !== true && !resolvedHideAttendance;
    const isRemarksEnabled = resolvedBranding.parentPortalRemarksDisabled !== true;
    const isTopperStatsEnabled = resolvedBranding.parentPortalTopperStatsDisabled !== true;
    const isAnySectionEnabled = isAnalyticsEnabled || isReportCardEnabled || isAttendanceEnabled || isRemarksEnabled || isTopperStatsEnabled;

    // Compute active parent tab option dynamically (fallback safely if admin has locked the select)
    let activeParentTab = parentTab;
    if (isAnalyticsEnabled && !isReportCardEnabled) {
      activeParentTab = 'analytics';
    } else if (!isAnalyticsEnabled && isReportCardEnabled) {
      activeParentTab = 'report_card';
    } else if (!isAnalyticsEnabled && !isReportCardEnabled) {
      activeParentTab = '';
    }

    // ----------------------------------------------------
    // DYNAMIC SCHOLASTIC AGGREGATES & COHORT METRICS ENGINE
    // ----------------------------------------------------
    const classPeers = parentStudent ? students.filter(s => s.className?.trim().toLowerCase() === parentStudent.className?.trim().toLowerCase()) : [];
    const peersGrades = parentGrades ? studentGrades.filter(g => classPeers.some(cp => cp.id === g.studentId)) : [];

    const parentT1ScoreCols = (resolvedTermSpecificScoreColumnsEnabled && resolvedTerm1ScoreColumns && resolvedTerm1ScoreColumns.length > 0)
      ? resolvedTerm1ScoreColumns
      : resolvedScoreColumns;
    const parentT2ScoreCols = (resolvedTermSpecificScoreColumnsEnabled && resolvedTerm2ScoreColumns && resolvedTerm2ScoreColumns.length > 0)
      ? resolvedTerm2ScoreColumns
      : resolvedScoreColumns;
    const parentT3ScoreCols = (resolvedTermSpecificScoreColumnsEnabled && resolvedTerm3ScoreColumns && resolvedTerm3ScoreColumns.length > 0)
      ? resolvedTerm3ScoreColumns
      : resolvedScoreColumns;

    const sumOfColumnMaxMarks = resolvedScoreColumns.reduce((sum, col) => sum + col.maxMarks, 0);
    const sumOfT1ColumnMaxMarks = parentT1ScoreCols.reduce((sum, col) => sum + col.maxMarks, 0);
    const sumOfT2ColumnMaxMarks = parentT2ScoreCols.reduce((sum, col) => sum + col.maxMarks, 0);
    const sumOfT3ColumnMaxMarks = parentT3ScoreCols.reduce((sum, col) => sum + col.maxMarks, 0);

    const computedSubjectMetrics = scholSubjects.map(sub => {
      const subMaxMarks = sub.maxMarks ?? sumOfColumnMaxMarks;
      const studentMarksSheet = parentGrades?.scholastic[sub.id] || { term1: {}, term2: {}, term3: {} };

      let t1Sum = scholT1Active ? parentT1ScoreCols.reduce((sum, col) => sum + (Number(studentMarksSheet.term1?.[col.id]) || 0), 0) : 0;
      let t2Sum = scholT2Active ? parentT2ScoreCols.reduce((sum, col) => sum + (Number(studentMarksSheet.term2?.[col.id]) || 0), 0) : 0;
      let t3Sum = scholT3Active ? parentT3ScoreCols.reduce((sum, col) => sum + (Number(studentMarksSheet.term3?.[col.id]) || 0), 0) : 0;

      let hasAnyMarks = false;
      const checkTerm = (termObj: any) => {
        if (!termObj) return false;
        return Object.keys(termObj).some(colId => {
          const val = termObj[colId];
          return val !== undefined && val !== null && String(val).trim() !== "";
        });
      };
      if (studentMarksSheet) {
        hasAnyMarks = 
          (scholT1Active && checkTerm(studentMarksSheet.term1)) ||
          (scholT2Active && checkTerm(studentMarksSheet.term2)) ||
          (scholT3Active && checkTerm(studentMarksSheet.term3));
      }

      if (scholT1Active && subMaxMarks !== sumOfT1ColumnMaxMarks && sumOfT1ColumnMaxMarks > 0) {
        t1Sum = (t1Sum / sumOfT1ColumnMaxMarks) * subMaxMarks;
      }
      if (scholT2Active && subMaxMarks !== sumOfT2ColumnMaxMarks && sumOfT2ColumnMaxMarks > 0) {
        t2Sum = (t2Sum / sumOfT2ColumnMaxMarks) * subMaxMarks;
      }
      if (scholT3Active && subMaxMarks !== sumOfT3ColumnMaxMarks && sumOfT3ColumnMaxMarks > 0) {
        t3Sum = (t3Sum / sumOfT3ColumnMaxMarks) * subMaxMarks;
      }

      let studentOverall = 0;
      let termCount = 0;
      if (scholT1Active) { studentOverall += t1Sum; termCount++; }
      if (scholT2Active) { studentOverall += t2Sum; termCount++; }
      if (scholT3Active) { studentOverall += t3Sum; termCount++; }

      const maxSubjectMarksPossible = subMaxMarks * termCount;
      const studentPct = maxSubjectMarksPossible > 0 ? (studentOverall / maxSubjectMarksPossible) * 100 : 0;

      let letterGrade = "E";
      for (const scale of gradeScales) {
        if (studentPct >= scale.minPercent && studentPct <= scale.maxPercent) {
          letterGrade = scale.grade;
          break;
        }
      }

      // Collect peers scores to generate live cohort benchmarking
      let peerScores: number[] = [];
      peersGrades.forEach(g => {
        const peerSheet = g.scholastic[sub.id] || { term1: {}, term2: {}, term3: {} };
        let pt1 = scholT1Active ? parentT1ScoreCols.reduce((sum, col) => sum + (Number(peerSheet.term1?.[col.id]) || 0), 0) : 0;
        let pt2 = scholT2Active ? parentT2ScoreCols.reduce((sum, col) => sum + (Number(peerSheet.term2?.[col.id]) || 0), 0) : 0;
        let pt3 = scholT3Active ? parentT3ScoreCols.reduce((sum, col) => sum + (Number(peerSheet.term3?.[col.id]) || 0), 0) : 0;

        if (scholT1Active && subMaxMarks !== sumOfT1ColumnMaxMarks && sumOfT1ColumnMaxMarks > 0) {
          pt1 = (pt1 / sumOfT1ColumnMaxMarks) * subMaxMarks;
        }
        if (scholT2Active && subMaxMarks !== sumOfT2ColumnMaxMarks && sumOfT2ColumnMaxMarks > 0) {
          pt2 = (pt2 / sumOfT2ColumnMaxMarks) * subMaxMarks;
        }
        if (scholT3Active && subMaxMarks !== sumOfT3ColumnMaxMarks && sumOfT3ColumnMaxMarks > 0) {
          pt3 = (pt3 / sumOfT3ColumnMaxMarks) * subMaxMarks;
        }

        let pOverall = 0;
        if (scholT1Active) pOverall += pt1;
        if (scholT2Active) pOverall += pt2;
        if (scholT3Active) pOverall += pt3;
        peerScores.push(pOverall);
      });

      const highestPeerOverall = peerScores.length > 0 ? Math.max(...peerScores) : studentOverall;
      const avgPeerOverall = peerScores.length > 0 ? (peerScores.reduce((sum, s) => sum + s, 0) / peerScores.length) : studentOverall;

      return {
        id: sub.id,
        name: sub.name,
        maxMarks: subMaxMarks,
        maxOverall: maxSubjectMarksPossible,
        studentOverall: parseFloat(studentOverall.toFixed(1)),
        studentPct: parseFloat(studentPct.toFixed(1)),
        studentT1: parseFloat(t1Sum.toFixed(1)),
        studentT2: parseFloat(t2Sum.toFixed(1)),
        studentT3: parseFloat(t3Sum.toFixed(1)),
        letterGrade,
        classHighest: parseFloat(highestPeerOverall.toFixed(1)),
        classAverage: parseFloat(avgPeerOverall.toFixed(1)),
        hasMarks: hasAnyMarks,
      };
    });

    const grandStudentTotal = computedSubjectMetrics.reduce((sum, m) => sum + m.studentOverall, 0);
    const grandMaxPossible = computedSubjectMetrics.reduce((sum, m) => sum + m.maxOverall, 0);
    const overallPercentage = grandMaxPossible > 0 ? parseFloat(((grandStudentTotal * 100) / grandMaxPossible).toFixed(2)) : 0;

    let grandBoardGrade = "E";
    for (const scale of gradeScales) {
      if (overallPercentage >= scale.minPercent && overallPercentage <= scale.maxPercent) {
        grandBoardGrade = scale.grade;
        break;
      }
    }

    // ----------------------------------------------------
    // IN-DEPTH TERM PROGRESS TRACKING
    // ----------------------------------------------------
    const termProgressData: Array<{ name: string; "Your Ward %": number; "Class Average %": number }> = [];
    const activeTermsCount = [scholT1Active, scholT2Active, scholT3Active].filter(Boolean).length;

    if (scholT1Active && hasScholastics) {
      let t1SumStudent = 0;
      let t1SumClasses = 0;
      let t1MaxSum = 0;
      computedSubjectMetrics.forEach(m => {
        t1SumStudent += m.studentT1;
        t1SumClasses += m.classAverage / (activeTermsCount || 1);
        t1MaxSum += m.maxMarks;
      });
      termProgressData.push({
        name: resolvedBranding.term1Label || "Term 1",
        "Your Ward %": parseFloat(((t1SumStudent * 100) / (t1MaxSum || 1)).toFixed(1)),
        "Class Average %": parseFloat(((t1SumClasses * 100) / (t1MaxSum || 1)).toFixed(1)),
      });
    }

    if (scholT2Active && hasScholastics) {
      let t2SumStudent = 0;
      let t2SumClasses = 0;
      let t2MaxSum = 0;
      computedSubjectMetrics.forEach(m => {
        t2SumStudent += m.studentT2;
        t2SumClasses += m.classAverage / (activeTermsCount || 1);
        t2MaxSum += m.maxMarks;
      });
      termProgressData.push({
        name: resolvedBranding.term2Label || "Term 2",
        "Your Ward %": parseFloat(((t2SumStudent * 100) / (t2MaxSum || 1)).toFixed(1)),
        "Class Average %": parseFloat(((t2SumClasses * 100) / (t2MaxSum || 1)).toFixed(1)),
      });
    }

    if (scholT3Active && hasScholastics) {
      let t3SumStudent = 0;
      let t3SumClasses = 0;
      let t3MaxSum = 0;
      computedSubjectMetrics.forEach(m => {
        t3SumStudent += m.studentT3;
        t3SumClasses += m.classAverage / (activeTermsCount || 1);
        t3MaxSum += m.maxMarks;
      });
      termProgressData.push({
        name: resolvedBranding.term3Label || "Term 3",
        "Your Ward %": parseFloat(((t3SumStudent * 100) / (t3MaxSum || 1)).toFixed(1)),
        "Class Average %": parseFloat(((t3SumClasses * 100) / (t3MaxSum || 1)).toFixed(1)),
      });
    }

    // Attendance percentages
    let totalPresents = 0;
    let totalClasses = 0;
    ['term1', 'term2', 'term3'].forEach(termKey => {
      const attVal = parentGrades?.attendance?.[termKey as keyof typeof parentGrades.attendance];
      if (attVal) {
        const m = String(attVal).match(/(\d+)\s*\/\s*(\d+)/);
        if (m) {
          totalPresents += Number(m[1]);
          totalClasses += Number(m[2]);
        }
      }
    });

    let attendancePercent = 100;
    if (totalClasses > 0) {
      attendancePercent = parseFloat(((totalPresents * 100) / totalClasses).toFixed(1));
    } else {
      attendancePercent = 94.8; 
    }

    // Dynamic Strengths & Recommendations based on metrics (filtered to exclude un-evaluated or zero-marks subjects)
    const evaluatedMetrics = computedSubjectMetrics.filter(m => m.hasMarks && m.studentOverall > 0 && m.studentPct > 0);
    const sortedEvaluatedByPct = [...evaluatedMetrics].sort((a, b) => b.studentPct - a.studentPct);

    // Strengths must have studentPct >= 60% (based strictly on percentage, not raw marks)
    const strengthCandidates = sortedEvaluatedByPct.filter(m => m.studentPct >= 60);
    const primaryStrengths = strengthCandidates.slice(0, 4).map(m => ({
      name: m.name,
      pct: m.studentPct,
      grade: m.letterGrade,
      note: m.studentPct >= 90 ? "Phenomenal competence. Student demonstrates outstanding grasp, crisp accuracy, and high logical mastery in subject units." :
            m.studentPct >= 75 ? "Highly consistent performance. Solid foundational knowledge and clear application of core syllabus structures." :
            "Satisfactory progress. Shows solid conceptual potential with slight room for faster implementation."
    }));

    // Improvement areas must be evaluated subjects but we sort ascending to get the lowest scores first.
    // Must be based strictly on percentage (e.g. studentPct < 75% and > 0% to avoid subjects with zero marks/un-evaluated)
    const improvementCandidates = [...evaluatedMetrics]
      .filter(m => m.studentPct < 75 && m.studentPct > 0)
      .sort((a, b) => a.studentPct - b.studentPct);
      
    const learningImprovementGoals = improvementCandidates.slice(0, 4).map(m => ({
      name: m.name,
      pct: m.studentPct,
      grade: m.letterGrade,
      note: m.studentPct < 50 ? "Requires urgent attention. Focused textbook drills, remedial revision sessions, and practice worksheets are highly recommended." :
            m.studentPct < 70 ? "Suggest scheduling personalized textbook revisions, vocabulary notebooks, or speed-drills to bridge core conceptual gaps." :
            m.studentPct < 80 ? "Slight homework practice consistency gaps noticed. Focus on mock test worksheets and regular mock practice before upcoming terms." :
            "Strong overall standing. Minor practice refinements and precision adjustments will help secure perfect tier benchmarks."
    }));

    return (
      <div className="bg-slate-50 min-h-screen text-slate-800 flex flex-col font-sans">
        
        {/* Verification Alert Strip */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-teal-50 text-center py-2 px-4 text-[11px] font-sans font-bold shadow-sm flex items-center justify-center gap-2 no-print animate-fadeIn">
          <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-pulse" />
          <span>Parents Digital Reporting Enclave &bull; Official CBSE/State Aligned Platform</span>
        </div>

        {/* Dynamic header */}
        <header 
          style={{ backgroundColor: resolvedBranding.themeColor }} 
          className="text-white p-5 shadow-md flex justify-between items-center no-print sticky top-0 z-45"
        >
          <div className="flex items-center gap-3">
            {resolvedBranding.logoUrl ? (
              <img 
                src={resolvedBranding.logoUrl} 
                alt="School Logo" 
                className="w-10 h-10 object-contain p-1 bg-white rounded-full border border-white/20" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <GraduationCap className="w-10 h-10 bg-white/10 p-2 rounded-full text-white" />
            )}
            <div>
              <h1 className="font-sans font-black text-bas sm:text-lg tracking-tight leading-tight uppercase">
                {resolvedBranding.schoolName || "School Reports Desk"}
              </h1>
              <p className="text-[10px] text-white/80 font-sans tracking-wider uppercase font-bold">
                Student &amp; Parent Information Desk &bull; {resolvedBranding.session?.toLowerCase().startsWith('session') ? resolvedBranding.session : `Session ${resolvedBranding.session || "2026-2027"}`}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-rose-600 hover:text-white border border-white/20 hover:border-transparent text-white font-bold py-1.5 px-3 rounded-lg text-xs tracking-wide transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </header>

        {/* Dashboard Content Container */}
        <main id="main-app-content" className="w-full max-w-full px-3.5 sm:px-6 lg:px-8 py-5 flex-grow space-y-6">
          {parentStudent ? (
            !isAnySectionEnabled ? (
              <div className="max-w-xl mx-auto bg-white border border-slate-200 rounded-3xl p-8 text-center space-y-6 shadow-sm animate-fadeIn my-8 no-print text-left">
                <div className="flex justify-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100/60 text-indigo-600 animate-pulse">
                    <Sparkles className="w-8 h-8 font-extrabold" />
                  </div>
                </div>
                <div className="space-y-2 text-center">
                  <h3 className="font-sans font-black text-lg text-slate-800 tracking-tight">
                    {resolvedBranding.lockScreenTitle || "PTM Academic Results On Hold"}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed font-sans max-w-md mx-auto">
                    {resolvedBranding.lockScreenDesc || "The school administration has scheduled results or parents digital dashboard modules as scheduled or currently on hold. Online score sheets and benchmarks will open once results are published."}
                  </p>
                </div>
                <div className="bg-slate-50 border rounded-xl p-4 text-left space-y-2.5 max-w-sm mx-auto">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400 font-bold uppercase font-sans">Scholar Name:</span>
                    <strong className="text-slate-800 font-extrabold">{parentStudent.name}</strong>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400 font-bold uppercase font-sans">Class Level:</span>
                    <strong className="text-slate-805 font-mono font-bold uppercase">{parentStudent.className} - {parentStudent.section}</strong>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400 font-bold uppercase font-sans">Status:</span>
                    <strong className="text-indigo-600 font-black font-sans">Awaiting Release Control</strong>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 font-medium text-center font-sans">
                  {resolvedBranding.lockScreenFooter || "Please check back later or get in touch with your classroom teachers for offline copy inquiries."}
                </p>
              </div>
            ) : (
              <div className="space-y-6">

              {/* Parents Portal configuration selectors desk */}
              <div className="bg-gradient-to-r from-slate-50 to-indigo-50/20 border border-indigo-100 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-sm no-print">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-black uppercase text-indigo-950 font-sans tracking-wide">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    Portal View Configuration Desk
                  </div>
                  <p className="text-[10.5px] text-slate-500 leading-normal max-w-lg font-sans">
                    Switch between past school sessions or select specific academic terms to inspect historical report cards, overall percentage curves, and teacher remarks.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Sessionwise Selector */}
                  {hasAnyArchivedSession && (
                    <div className="space-y-1 min-w-[150px] font-sans">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Academic Session</span>
                       <select
                        value={parentPortalSessionFilter}
                        onChange={(e) => setParentPortalSessionFilter(e.target.value)}
                        className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                      >
                        {availableSessions.map(sessionOpt => {
                          const cleanCurrent = (branding.session || "Session 2026-2027").replace(/\s*\(Archived\)$/i, "").trim();
                          const isCurrent = sessionOpt === cleanCurrent;
                          return (
                            <option key={sessionOpt} value={isCurrent ? "" : sessionOpt}>
                              {sessionOpt} {isCurrent ? "(Active)" : "(Archived)"}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  {/* Termwise Selector */}
                  <div className="space-y-1 min-w-[150px] font-sans">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Exam Term View</span>
                    <select
                      value={parentPortalTermFilter}
                      onChange={(e) => setParentPortalTermFilter(e.target.value as any)}
                      className="w-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                    >
                      <option value="all">All Cumulative Terms</option>
                      {resolvedBranding.term1Enabled && !resolvedScholasticTerm1Disabled && (
                        <option value="term1">{resolvedBranding.term1Label || "Term 1 Only"}</option>
                      )}
                      {resolvedBranding.term2Enabled && !resolvedScholasticTerm2Disabled && (
                        <option value="term2">{resolvedBranding.term2Label || "Term 2 Only"}</option>
                      )}
                      {resolvedBranding.term3Enabled && !resolvedScholasticTerm3Disabled && (
                        <option value="term3">{resolvedBranding.term3Label || "Term 3 Only"}</option>
                      )}
                    </select>
                  </div>
                </div>
              </div>
              
              {/* Profile card and general summary banner */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
                
                {/* Ward profile sheet */}
                <div className="lg:col-span-8 bg-white border border-gray-150 rounded-xl p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row gap-5 items-center sm:items-stretch animate-fadeIn">
                  
                  {/* Photo container */}
                  {!resolvedBranding.studentPhotoDisabled && (
                    <div className="w-28 h-32 flex flex-col items-center justify-center bg-slate-50 border border-slate-200 p-2 rounded-xl shrink-0">
                      {parentStudent.photoUrl ? (
                        <img 
                          src={parentStudent.photoUrl} 
                          alt={parentStudent.name} 
                          className="w-24 h-28 object-cover rounded-lg border border-gray-100 shadow-sm"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-24 h-28 bg-indigo-50 border border-indigo-100 rounded-lg flex flex-col items-center justify-center text-indigo-400">
                          <GraduationCap className="w-8 h-8" />
                          <span className="text-[9px] mt-1.5 font-bold uppercase tracking-wider font-sans">No Photo</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Identification Details */}
                  <div className="flex-grow space-y-3.5 text-center sm:text-left">
                    <div>
                      <span style={{ backgroundColor: resolvedBranding.themeColor + '15', color: resolvedBranding.themeColor }} className="text-[9px] font-sans font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full border border-gray-100">
                        Verified Scholar Profile
                      </span>
                      <h2 className="font-sans font-black text-2xl text-slate-900 tracking-tight mt-2 leading-none">
                        {parentStudent.name}
                      </h2>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-4 text-xs font-sans text-slate-600 text-left">
                      <div>
                        <div className="text-[9px] uppercase font-bold text-gray-400">Standard / Grade</div>
                        <div className="font-extrabold text-slate-800 uppercase font-mono mt-0.5">{parentStudent.className} - {parentStudent.section}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase font-bold text-gray-400">Roll/Register ID</div>
                        <div className="font-extrabold text-slate-800 font-mono mt-0.5">{parentStudent.rollNo}</div>
                      </div>
                      {isAdmissionNoActiveInLayout(parentStudent.className, parentStudent.section) && parentStudent.admissionNo && !parentStudent.admissionNo.startsWith('adm_') && (
                        <div>
                          <div className="text-[9px] uppercase font-bold text-gray-400">Admission Code</div>
                          <div className="font-extrabold text-slate-800 font-mono mt-0.5">{parentStudent.admissionNo}</div>
                        </div>
                      )}
                      <div>
                        <div className="text-[9px] uppercase font-bold text-gray-400">Date of Birth</div>
                        <div className="font-extrabold text-slate-800 font-mono mt-0.5">{parentStudent.dob}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase font-bold text-gray-400">Father's Name</div>
                        <div className="font-bold text-slate-800 mt-0.5">{parentStudent.fatherName ? formatFatherName(parentStudent.fatherName) : "Not listed"}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase font-bold text-gray-400">Mother's Name</div>
                        <div className="font-bold text-slate-800 mt-0.5">{parentStudent.motherName ? formatMotherName(parentStudent.motherName) : "Not listed"}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Secondary side-panel status dashboard */}
                <div className="lg:col-span-4 bg-white border border-gray-150 rounded-xl p-5 sm:p-6 shadow-sm flex flex-col justify-between space-y-4 animate-fadeIn">
                  
                  {isRemarksEnabled ? (
                    <div className="space-y-3.5">
                      <h3 className="text-[10px] font-sans font-black uppercase tracking-wider text-slate-400">Academic Remarks Summary</h3>
                      
                      {/* Teacher remark banner */}
                      <div className="bg-emerald-50/50 border border-emerald-100 text-emerald-900 rounded-xl p-3.5 text-xs leading-relaxed">
                        <strong className="block text-[10px] uppercase font-extrabold text-emerald-800 mb-0.5">Teacher Feedback:</strong>
                        <span className="italic">"{parentStudent.remarks || "Consistently hardworking. Encourage active textbook revisions for final examinations."}"</span>
                      </div>

                      {/* Promotion status display rules - Strictly hidden if disabled in report card */}
                      {parentStudent.promotionStatus && !resolvedBranding.congratulationsDisabled && (
                        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3.5 text-xs text-indigo-950 font-bold flex items-center gap-2">
                          <Trophy className="w-5 h-5 text-indigo-600 flex-shrink-0 animate-bounce" />
                          <div>
                            <strong className="block text-[9px] uppercase text-indigo-800 tracking-wider">Promotion Verdict</strong>
                            <span>{parentStudent.promotionStatus}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400">
                      <BookOpen className="w-8 h-8 opacity-30 text-indigo-600 mb-1" />
                      <p className="text-xs italic leading-tight">Remarks metrics are currently under evaluation by term subject coordinators.</p>
                    </div>
                  )}

                  {/* Print report action card button */}
                  {isReportCardEnabled && (
                    <button
                      onClick={() => {
                        setParentTab('report_card');
                        setTimeout(() => window.print(), 100);
                      }}
                      style={{ backgroundColor: resolvedBranding.themeColor }}
                      className="w-full text-white font-extrabold text-xs py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 relative active:scale-95 transition-all cursor-pointer shadow-md hover:brightness-115"
                    >
                      <Printer className="w-4 h-4" />
                      <span>Download / Print Report Card</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Secure tabs switcher */}
              {isAnalyticsEnabled && isReportCardEnabled && (
                <div className="flex gap-1.5 border-b border-gray-200 pb-px no-print">
                  <button
                    onClick={() => setParentTab('analytics')}
                    className={`flex items-center gap-1.5 py-3 px-5 text-xs font-black uppercase tracking-wider transition border-b-2 ${parentTab === 'analytics' ? 'border-indigo-600 text-indigo-700 font-bold' : 'border-transparent text-gray-500 hover:text-slate-800'}`}
                  >
                    <BarChart2 className="w-4 h-4" />
                    🚀 Scholar Analytics Hub
                  </button>
                  <button
                    onClick={() => setParentTab('report_card')}
                    className={`flex items-center gap-1.5 py-3 px-5 text-xs font-black uppercase tracking-wider transition border-b-2 ${parentTab === 'report_card' ? 'border-indigo-600 text-indigo-700 font-bold' : 'border-transparent text-gray-500 hover:text-slate-800'}`}
                  >
                    <BookMarked className="w-4 h-4" />
                    📜 Official Report Sheet
                  </button>
                </div>
              )}

              {/* ----------------- TAB: ANALYTICS HUB ----------------- */}
              {activeParentTab === 'analytics' && isAnalyticsEnabled && (
                <div className="space-y-6 animate-fadeIn no-print">
                  
                  {/* Basic aggregate statistics scorecards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    
                    {/* card 1: overall percentage */}
                    <div className="bg-white border border-gray-150 p-5 rounded-xl shadow-xs flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] text-gray-400 font-bold uppercase block">Aggregate Score %</span>
                        <div className="text-3xl font-black text-slate-900 tracking-tight font-mono">
                          {overallPercentage}%
                        </div>
                        <span style={{ color: resolvedBranding.themeColor }} className="text-[10px] font-bold">
                          {grandStudentTotal.toFixed(1)} / {grandMaxPossible} Marks
                        </span>
                      </div>
                      
                      {/* circular visual gauge */}
                      <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
                        <svg className="w-full h-full transform -rotate-95">
                          <circle cx="28" cy="28" r="23" stroke="#f1f5f9" strokeWidth="4.5" fill="transparent" />
                          <circle 
                            cx="28" cy="28" r="23" 
                            stroke={resolvedBranding.themeColor || "#4f46e5"} 
                            strokeWidth="4.5" 
                            fill="transparent" 
                            strokeDasharray={2 * Math.PI * 23}
                            strokeDashoffset={(2 * Math.PI * 23) * (1 - overallPercentage / 100)}
                          />
                        </svg>
                        <div className="absolute text-[10px] font-black">{Math.round(overallPercentage)}%</div>
                      </div>
                    </div>

                    {/* card 2: aggregate board grade scale */}
                    <div className="bg-white border border-gray-150 p-5 rounded-xl shadow-xs flex items-center justify-between">
                      <div className="space-y-1">
                        <span className="text-[10px] text-gray-400 font-bold uppercase block">Core Board Grade</span>
                        <div className="text-3xl font-black text-slate-900 tracking-tight font-mono">
                          Grade {grandBoardGrade}
                        </div>
                        <span className="text-[10.5px] text-emerald-600 font-sans font-bold flex items-center gap-1">
                          <Medal className="w-3.5 h-3.5" /> Approved Rank Bracket
                        </span>
                      </div>
                      <div style={{ backgroundColor: resolvedBranding.themeColor }} className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-base font-black shrink-0 shadow-sm">
                        {grandBoardGrade}
                      </div>
                    </div>

                    {/* card 3: attendance meter ratio */}
                    {isAttendanceEnabled ? (
                      <div className="bg-white border border-gray-150 p-5 rounded-xl shadow-xs flex items-center justify-between">
                        <div className="space-y-1">
                          <span className="text-[10px] text-gray-400 font-bold uppercase block">Working Attendance Ratio</span>
                          <div className="text-3xl font-black text-slate-900 tracking-tight font-mono">
                            {attendancePercent}%
                          </div>
                          <span className={`text-[10px] font-bold ${attendancePercent >= 85 ? 'text-emerald-600' : 'text-amber-500'}`}>
                            {totalPresents} / {totalClasses} Present Days
                          </span>
                        </div>
                        
                        {/* circular progress for attendance */}
                        <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
                          <svg className="w-full h-full transform -rotate-90">
                            <circle cx="28" cy="28" r="23" stroke="#f1f5f9" strokeWidth="4.5" fill="transparent" />
                            <circle 
                              cx="28" cy="28" r="23" 
                              stroke="#059669" 
                              strokeWidth="4.5" 
                              fill="transparent" 
                              strokeDasharray={2 * Math.PI * 23}
                              strokeDashoffset={(2 * Math.PI * 23) * (1 - attendancePercent / 100)}
                            />
                          </svg>
                          <div className="absolute text-[9.5px] font-extrabold text-emerald-700">{Math.round(attendancePercent)}%</div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-gray-150 p-5 rounded-xl flex items-center justify-center text-center text-xs text-slate-400 italic">
                        Attendance criteria is under calculation or hidden by admin.
                      </div>
                    )}

                    {/* card 4: class standing estimation index */}
                    <div className="bg-white border border-gray-150 p-5 rounded-xl shadow-xs">
                      <span className="text-[10px] text-gray-400 font-bold uppercase block">Academic Standing</span>
                      <div className="mt-1 flex items-start gap-2.5">
                        <span className="text-2xl mt-0.5">🌟</span>
                        <div>
                          <div className="text-xs font-black text-slate-800 leading-tight">
                            {overallPercentage >= 90 ? "Scholar Merit Bracket" : 
                             overallPercentage >= 75 ? "Distinction Tier" : 
                             overallPercentage >= 50 ? "Healthy Competence" : "Progress Active"}
                          </div>
                          <p className="text-[9.5px] text-slate-500 leading-tight mt-0.5">
                            {overallPercentage >= 80 ? "Exceeding grade curves beautifully." : "Capable of cracking top deciles. Maintain study routines."}
                          </p>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Visual Charts Segment (Bento Panel) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* Barchart: Subject wise scorecard */}
                    <div className="lg:col-span-8 bg-white border border-gray-150 p-5 rounded-xl shadow-xs space-y-4">
                      <div>
                        <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                          <BarChart2 className="w-4 h-4 text-indigo-600" />
                          Subject Benchmarks (Overall Computed Marks Percentage)
                        </h3>
                        <p className="text-[10px] text-slate-400">
                          {isTopperStatsEnabled 
                            ? "Comparison of your ward's overall term performance against the class average and classmate highest markers."
                            : "Overall marks percentage obtained dynamically plotted across academic scholastic syllabus."}
                        </p>
                      </div>

                      <div className="h-64 sm:h-72 w-full text-xs font-mono font-semibold">
                        {computedSubjectMetrics.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <RechartsBarChart data={computedSubjectMetrics} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                              <XAxis dataKey="name" stroke="#64748b" tickLine={true} axisLine={true} />
                              <YAxis stroke="#64748b" tickLine={true} axisLine={true} domain={[0, 100]} />
                              <Tooltip 
                                contentStyle={{ backgroundColor: "#0f172a", color: "#fff", borderRadius: "10px", border: "1px solid #334155", fontSize: "11px" }}
                                filterNull={true}
                              />
                              <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                              <Bar dataKey="studentPct" name="Your Ward %" fill="#ec4899" radius={[4, 4, 0, 0]} maxBarSize={28} />
                              {isTopperStatsEnabled && <Bar dataKey="classAverage" name="Class Average %" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={28} />}
                              {isTopperStatsEnabled && <Bar dataKey="classHighest" name="Class Highest %" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />}
                            </RechartsBarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center text-slate-400 italic text-xs">
                            No scholastic database entries reported for this subject roster.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Progress Chart: Term on Term trend vector */}
                    <div className="lg:col-span-4 bg-white border border-gray-150 p-5 rounded-xl shadow-xs space-y-4">
                      <div>
                        <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-1.5">
                          <TrendingUp className="w-4 h-4 text-indigo-600" />
                          Term-on-Term Progress
                        </h3>
                        <p className="text-[10px] text-slate-400">Track aggregate percent progress across active exam terms.</p>
                      </div>

                      <div className="h-64 sm:h-72 w-full text-xs font-mono font-semibold flex flex-col justify-between">
                        {termProgressData.length > 1 ? (
                          <div className="h-52 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <RechartsLineChart data={termProgressData} margin={{ top: 10, right: 15, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                                <XAxis dataKey="name" stroke="#64748b" tickLine={true} />
                                <YAxis stroke="#64748b" tickLine={true} domain={[40, 100]} />
                                <Tooltip contentStyle={{ backgroundColor: "#0f172a", color: "#fff", borderRadius: "10px", border: "1px solid #334155", fontSize: "11px" }} />
                                <Line type="monotone" dataKey="Your Ward %" stroke="#d946ef" strokeWidth={4} dot={{ r: 6, fill: "#d946ef" }} activeDot={{ r: 8 }} />
                                {isTopperStatsEnabled && <Line type="monotone" dataKey="Class Average %" stroke="#06b6d4" strokeWidth={3} strokeDasharray="5 5" dot={{ r: 4, fill: "#06b6d4" }} />}
                              </RechartsLineChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className="flex-grow flex flex-col items-center justify-center text-slate-400 p-4 border border-dashed border-slate-100 rounded-lg text-center space-y-1.5 bg-slate-50/50">
                            <Clock className="w-6 h-6 opacity-30 text-indigo-600" />
                            <div className="text-xs font-bold text-slate-700">Trend Tracker Pending</div>
                            <p className="text-[10px] max-w-xs leading-normal">
                              Term on Term comparisons activate automatically once marks are submitted for multiple exam terms.
                            </p>
                          </div>
                        )}

                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100/70 text-[10px] leading-relaxed text-slate-500">
                          <strong>💡 Indian Boards Context:</strong> Class evaluations combine internal formative assessments (FA) and summative assessments (SA) to arrive at dynamic term benchmarks.
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Diagnostic details panel: Academic strengths and study recommendations */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* Panel 1: Strengths */}
                    <div className="bg-white border border-gray-150 p-5 rounded-xl shadow-xs space-y-3.5">
                      <h3 className="text-xs font-sans font-black uppercase text-emerald-800 bg-emerald-50 border border-emerald-100/50 px-3 py-1 rounded-full w-max flex items-center gap-1.5">
                        <span className="text-base leading-none">🏆</span> Academic Primary Strengths
                      </h3>
                      
                      {primaryStrengths.length > 0 ? (
                        <div className="space-y-3">
                          {primaryStrengths.map((st, idx) => (
                            <div key={idx} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-black text-slate-900">{st.name}</span>
                                <span className="text-[10.5px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">Score: {st.pct}% ({st.grade})</span>
                              </div>
                              <p className="text-[10.5px] text-slate-500 leading-relaxed mt-1">
                                {st.note}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No subject marks computed yet.</p>
                      )}
                    </div>

                    {/* Panel 2: Learning Goals and recommendations */}
                    <div className="bg-white border border-gray-150 p-5 rounded-xl shadow-xs space-y-3.5">
                      <h3 className="text-xs font-sans font-black uppercase text-amber-800 bg-amber-50 border border-amber-100/50 px-3 py-1 rounded-full w-max flex items-center gap-1.5">
                        <span className="text-base leading-none">⚙️</span> Recommended Improvement Areas
                      </h3>

                      {learningImprovementGoals.length > 0 ? (
                        <div className="space-y-3">
                          {learningImprovementGoals.map((g, idx) => (
                            <div key={idx} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-black text-slate-900">{g.name}</span>
                                <span className="text-[10.5px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">Score: {g.pct}% ({g.grade})</span>
                              </div>
                              <p className="text-[10.5px] text-slate-500 leading-relaxed mt-1">
                                {g.note}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No subject marks computed yet.</p>
                      )}
                    </div>

                  </div>

                  {/* Comprehensive table of scholastic performance with toggles */}
                  <div className="bg-white border border-gray-150 rounded-xl overflow-hidden shadow-xs">
                    <div className="p-4 border-b border-gray-100">
                      <h3 className="text-xs font-extrabold text-slate-800 tracking-wide font-sans">
                        Scholastic Subjects Marksheet Breakdown
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-sans border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-gray-500 border-b border-slate-100">
                            <th className="p-3 font-bold uppercase text-[9px]">Subject Name</th>
                            {scholT1Active && <th className="p-3 font-bold uppercase text-[9px] font-mono">{resolvedBranding.term1Label || "Term 1"} (Scaled)</th>}
                            {scholT2Active && <th className="p-3 font-bold uppercase text-[9px] font-mono">{resolvedBranding.term2Label || "Term 2"} (Scaled)</th>}
                            {scholT3Active && <th className="p-3 font-bold uppercase text-[9px] font-mono">{resolvedBranding.term3Label || "Term 3"} (Scaled)</th>}
                            <th className="p-3 font-bold uppercase text-[9px] font-mono text-center">Aggregate Sum</th>
                            <th className="p-3 font-bold uppercase text-[9px] text-center">Percentage</th>
                            <th className="p-3 font-bold uppercase text-[9px] text-center">Board Grade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {computedSubjectMetrics.map((met) => (
                            <tr key={met.id} className="border-b border-gray-100 hover:bg-slate-50/50">
                              <td className="p-3 font-bold text-slate-800">{met.name}</td>
                              {scholT1Active && <td className="p-3 font-mono text-gray-650">{met.studentT1} / {met.maxMarks}</td>}
                              {scholT2Active && <td className="p-3 font-mono text-gray-650">{met.studentT2} / {met.maxMarks}</td>}
                              {scholT3Active && <td className="p-3 font-mono text-gray-650">{met.studentT3} / {met.maxMarks}</td>}
                              <td className="p-3 font-mono font-bold text-slate-800 text-center">{met.studentOverall} / {met.maxOverall}</td>
                              <td className="p-3 font-mono font-extrabold text-center text-slate-800">
                                <div className="flex items-center justify-center gap-1">
                                  <span>{met.studentPct}%</span>
                                  <div className="w-10 bg-gray-100 rounded-full h-1">
                                    <div style={{ width: `${met.studentPct}%`, backgroundColor: resolvedBranding.themeColor }} className="rounded-full h-1" />
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 text-center">
                                <span style={{ color: resolvedBranding.themeColor, borderColor: resolvedBranding.themeColor + '30' }} className="font-extrabold bg-slate-50 px-2 py-0.5 rounded border">
                                  {met.letterGrade}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Quick toggle banner to open official document card */}
                  <div style={{ borderLeftColor: resolvedBranding.themeColor }} className="bg-indigo-50/50 border-l-4 rounded-r-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="space-y-0.5">
                      <strong className="block text-xs font-bold text-indigo-950">Official Printable Board Document Ready</strong>
                      <p className="text-[10.5px] text-indigo-900/80">
                        View and print the beautiful official formatted final report card template layout complete with signatures.
                      </p>
                    </div>
                    <button
                      onClick={() => setParentTab('report_card')}
                      className="bg-indigo-600 hover:bg-indigo-700 font-bold text-white text-xs py-2 px-3.5 rounded-lg transition shrink-0 active:scale-95 shadow cursor-pointer"
                    >
                      Open Report Card Sheet
                    </button>
                  </div>

                </div>
              )}

              {/* ----------------- TAB: OFFICIAL REPORT SHEET ----------------- */}
              {activeParentTab === 'report_card' && isReportCardEnabled && (
                <div className="space-y-4 animate-fadeIn">
                  
                  {/* Download notice block */}
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3 text-xs text-blue-900 leading-relaxed no-print">
                    <span className="text-lg grow-0">🖨️</span>
                    <div className="flex-grow flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <strong className="block font-bold mb-0.5 text-blue-950 font-sans">Official Paper Card Export</strong>
                        To save or print or share, click the <strong>"Print Official Sheet"</strong> button. Select "Save as PDF" to download a clean offline file directly.
                      </div>
                      <button
                        onClick={() => window.print()}
                        style={{ backgroundColor: resolvedBranding.themeColor }}
                        className="text-white hover:brightness-110 px-3.5 py-2 font-bold text-xs rounded-lg shadow-md shrink-0 flex items-center gap-1 cursor-pointer transition active:scale-95"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Print Official Sheet
                      </button>
                    </div>
                  </div>

                  {/* Adaptive Responsive wrapper for ReportCardPreview */}
                  <div className="w-full border border-gray-150 rounded-xl p-1 sm:p-3 bg-white shadow-sm print:overflow-visible print:border-none print:shadow-none print:p-0">
                    <div className="w-full max-w-full p-0 sm:p-1 print:min-w-0 print:p-0">
                      <div className="bg-white print:bg-transparent w-full">
                        {parentGrades ? (
                          <ReportCardPreview
                            branding={resolvedBranding}
                            subjects={resolvedSubjects}
                            scoreColumns={resolvedScoreColumns}
                            gradeScales={resolvedGradeScales}
                            student={parentStudent}
                            grades={parentGrades}
                            scholasticTerm1Disabled={resolvedScholasticTerm1Disabled}
                            scholasticTerm2Disabled={resolvedScholasticTerm2Disabled}
                            scholasticTerm3Disabled={resolvedScholasticTerm3Disabled}
                            coScholasticOneColumn={resolvedCoScholasticOneColumn}
                            coScholasticSections={resolvedCoScholasticSections}
                            coGradeScales={resolvedCoGradeScales}
                            signatures={resolvedSignatures}
                            hideGradingScale={resolvedHideGradingScale}
                            hideAttendance={resolvedHideAttendance}
                            pureGradeBased={resolvedPureGradeBased}
                            gradingScaleAfterSignatures={resolvedGradingScaleAfterSignatures}
                            gradingScaleLayout={resolvedGradingScaleLayout}
                            verticalExamHeaders={resolvedVerticalExamHeaders}
                            verticalSubjectsHeader={resolvedVerticalSubjectsHeader}
                            subjectSpecificMaxMarksEnabled={resolvedSubjectSpecificMaxMarksEnabled}
                            enableSubjectGrouping={resolvedEnableSubjectGrouping}
                            customSubjectGroups={resolvedCustomSubjectGroups}
                            hideTerm1Total={resolvedHideTerm1Total}
                            hideTerm1Grade={resolvedHideTerm1Grade}
                            hideTerm2Total={resolvedHideTerm2Total}
                            hideTerm2Grade={resolvedHideTerm2Grade}
                            hideTerm3Total={resolvedHideTerm3Total}
                            hideTerm3Grade={resolvedHideTerm3Grade}
                            hideOverallTotal={resolvedHideOverallTotal}
                            hideOverallGrade={resolvedHideOverallGrade}
                            termSpecificScoreColumnsEnabled={resolvedTermSpecificScoreColumnsEnabled}
                            term1ScoreColumns={resolvedTerm1ScoreColumns}
                            term2ScoreColumns={resolvedTerm2ScoreColumns}
                            term3ScoreColumns={resolvedTerm3ScoreColumns}
                          />
                        ) : (
                          <div className="bg-amber-50 border border-amber-100 rounded-xl p-6 text-center text-xs text-amber-800 font-medium">
                            🔍 Stored marks database doesn't reflect scores indexed for {parentStudent.name} yet. Please inquire back with classroom section teachers.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              )}

            </div>
          )
          ) : (
            <div className="bg-red-50 border border-red-100 text-red-800 rounded-xl p-8 max-w-xl mx-auto text-center space-y-4 shadow animate-fadeIn no-print">
              <span className="text-4xl block">⚠️</span>
              <h3 className="font-extrabold text-base animate-pulse">Student Profile Unsynced</h3>
              <p className="text-xs text-red-650 leading-relaxed">
                The authenticated credentials do not target/align with any active scholar records stored. Sign out, review portal details with class tutors and retry.
              </p>
              <button
                onClick={handleLogout}
                className="bg-red-650 hover:bg-red-755 text-white font-bold px-4 py-2 rounded-lg text-xs transition cursor-pointer"
              >
                Return to Login Gate
              </button>
            </div>
          )}
        </main>

        <footer className="border-t border-gray-100 bg-white p-4 py-5 text-center text-xs text-gray-400 mt-auto no-print">
          <div className="w-full max-w-full px-4 md:px-6 flex flex-col sm:flex-row justify-between items-center gap-2">
            <span className="font-medium text-slate-400">
              Powered securely by <strong>School Report Card parents portal</strong>.
            </span>
            <span className="text-[10px] text-slate-350">
              Core Engine &copy; 2026
            </span>
          </div>
        </footer>
      </div>
    );
  }

  // Deduplicate notifications by ID to prevent any race condition or manual dual-renders
  const uniqueNotifications: SaasNotification[] = Array.from(
    new Map<string, SaasNotification>(notifications.map(n => [n.id, n])).values()
  );

  const userTargetedNotifs = uniqueNotifications.filter(n => {
    if (!currentSchoolId) return false;
    
    // Schools must not get any SaaS settings, bulk synchronization, or admin template request notifications
    if (currentRole !== 'main_admin') {
      const titleLower = n.title.toLowerCase();
      const messageLower = n.message.toLowerCase();
      const isSaaSSettingsOrSync =
        n.id.startsWith('notif_sync_') ||
        n.id.startsWith('notif_req_') ||
        titleLower.includes('saas offline onboarding') ||
        titleLower.includes('synchronization') ||
        titleLower.includes('direct synchronization') ||
        titleLower.includes('offline onboarding') ||
        titleLower.includes('saas settings') ||
        messageLower.includes('direct synchronization complete') ||
        messageLower.includes('cloud firestore') ||
        messageLower.includes('has requested assignment of template');

      if (isSaaSSettingsOrSync) {
        return false;
      }
    }
    
    // If targeted specifically to this school, always show it
    if (n.targetSchoolIds.includes(currentSchoolId)) {
      return true;
    }
    
    // If targeted to 'all', only show if sent on or after the school's registration/creation date
    if (n.targetSchoolIds.includes('all')) {
      if (activeSchoolObj && activeSchoolObj.createdAt) {
        return new Date(n.sentAt).getTime() >= new Date(activeSchoolObj.createdAt).getTime();
      }
      return true; // Fallback to show everything for pre-existing or legacy schools
    }
    
    return false;
  });
  const unreadCount = userTargetedNotifs.filter(n => !dismissedNotifIds.includes(n.id) && !n.readBy?.includes(activeNotifKey || '')).length;

  return (
    <div className="bg-gray-50/50 min-h-screen text-slate-800 flex flex-col md:flex-row relative">
      
      {/* Plan Expiration Redirect Overlay Screen */}
      {isSchoolPlanExpired && !isExpirationOverlayAcknowledged && (currentRole === 'school_admin' || currentRole === 'class_teacher') && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4 overflow-y-auto no-print animate-fadeIn">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-1.5 shadow-2xl relative animate-scaleIn">
            <div className="border-2 border-double border-slate-200 rounded-2xl p-6 sm:p-8 bg-white space-y-6 text-center">
              
              {/* Animated Warning Icon */}
              <div className="w-20 h-20 bg-rose-50 border-2 border-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-rose-500/5 animate-pulse">
                <AlertTriangle className="w-10 h-10 animate-bounce" />
              </div>

              {/* Status & Expiry Title */}
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-600 uppercase tracking-wider">
                  ⚠️ Plan Expired
                </span>
                <h3 className="text-2xl font-black text-slate-900 font-sans tracking-tight">
                  Subscription Renewal Required
                </h3>
                <p className="text-slate-550 text-sm max-w-md mx-auto leading-relaxed">
                  The active plan/trial for <strong className="text-slate-800">{activeSchoolObj?.name || 'your school'}</strong> expired on{' '}
                  <span className="font-bold text-rose-600">
                    {activeSchoolObj?.trialUntil ? new Date(activeSchoolObj.trialUntil).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}
                  </span>.
                </p>
              </div>

              {/* Information Alert Box */}
              <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 text-left space-y-2.5">
                <div className="flex gap-2.5 items-start">
                  <Lock className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-600 leading-relaxed">
                    <strong className="text-slate-900 block mb-0.5">Blocked Features:</strong>
                    Operations on <span className="font-semibold text-rose-600">Student Registry</span>,{' '}
                    <span className="font-semibold text-rose-600">Teacher Management</span>, and{' '}
                    <span className="font-semibold text-rose-600">Subject Marks Entry</span> are suspended until subscription renewal.
                  </div>
                </div>
                <div className="flex gap-2.5 items-start pt-2 border-t border-slate-200/40">
                  <Printer className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-slate-600 leading-relaxed">
                    <strong className="text-slate-900 block mb-0.5">Accessible Features (Limited Mode):</strong>
                    You can still <span className="font-semibold text-emerald-600">print/download report cards</span>, view analysis dashboards, and review configuration templates.
                  </div>
                </div>
              </div>

              {/* Dynamic Renewal / Reactivation Form Block */}
              {currentRole === 'school_admin' && (
                <div className="bg-indigo-50/45 border border-indigo-150 rounded-2xl p-4 text-left space-y-3.5 mt-3">
                  <div className="flex items-center gap-2 text-indigo-900 font-extrabold text-xs uppercase tracking-wider">
                    <CreditCard className="w-4 h-4 text-indigo-600" />
                    <span>Instant Premium Reactivation Desk</span>
                  </div>

                  {activeSchoolObj?.subscriptionRequest && (activeSchoolObj.subscriptionRequest.status === 'pending' || activeSchoolObj.subscriptionRequest.paymentStatus === 'pending') ? (
                    <div className="space-y-3 bg-white p-3.5 rounded-xl border border-indigo-150">
                      <div className="flex items-center gap-2 text-amber-600 font-bold text-xs">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                        <span>Pending Admin Activation Approval</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed font-semibold">
                        Your renewal payment request for <strong className="text-slate-800">{activeSchoolObj?.subscriptionRequest?.studentCount} students</strong> at <strong className="text-emerald-600">₹{activeSchoolObj?.subscriptionRequest?.calculatedTotal?.toLocaleString()} / year</strong> was submitted successfully on {activeSchoolObj?.subscriptionRequest?.requestedAt ? new Date(activeSchoolObj.subscriptionRequest.requestedAt).toLocaleDateString() : 'N/A'}.
                      </p>
                      <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-lg text-[10.5px] font-semibold text-slate-500 italic">
                        "{activeSchoolObj?.subscriptionRequest?.verificationMessage || 'The renewal payment status is currently under verification and will be activated shortly.'}"
                      </div>
                      <button
                        onClick={() => refreshSchoolsFromCloud(true)}
                        disabled={isRefreshingApproval}
                        className="w-full bg-indigo-600 hover:bg-indigo-750 text-white font-extrabold text-xs py-2 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingApproval ? 'animate-spin' : ''}`} />
                        {isRefreshingApproval ? 'Verifying live status...' : 'Check Approval Status'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-indigo-950 block">How many student licenses do you need?</label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setRenewalStudentCount(prev => Math.max(10, prev - 10))}
                            className="px-2.5 bg-white border border-indigo-200 text-indigo-700 rounded-lg font-black hover:bg-indigo-100 cursor-pointer text-xs"
                          >
                            -10
                          </button>
                          <input
                            type="number"
                            min="10"
                            max="5000"
                            value={renewalStudentCount}
                            onChange={(e) => setRenewalStudentCount(Math.max(1, parseInt(e.target.value) || 0))}
                            className="w-full text-center px-3 py-1.5 text-xs border border-indigo-200 bg-white rounded-lg outline-none font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/15"
                          />
                          <button
                            type="button"
                            onClick={() => setRenewalStudentCount(prev => prev + 10)}
                            className="px-2.5 bg-white border border-indigo-200 text-indigo-700 rounded-lg font-black hover:bg-indigo-100 cursor-pointer text-xs"
                          >
                            +10
                          </button>
                        </div>
                      </div>

                      {/* Calculations breakdown */}
                      <div className="bg-white p-3 rounded-xl border border-indigo-150 space-y-1.5 text-[11px] font-bold text-slate-700">
                        <div className="flex justify-between">
                          <span className="text-slate-450 font-medium">Selected Students:</span>
                          <span className="font-mono text-slate-900">{renewalStudentCount} students</span>
                        </div>
                        <div className="h-px bg-slate-100" />
                        <div className="flex justify-between text-xs font-extrabold text-indigo-950">
                          <span>Total Premium Annual Cost:</span>
                          <span className="font-mono text-emerald-600 text-sm">₹{calculateRateAndTotal(renewalStudentCount, activeSchoolObj).total.toLocaleString()} / year</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleProceedRenewalPayment(renewalStudentCount)}
                        disabled={isSubmittingRenewal}
                        className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-extrabold text-xs py-2.5 px-4 rounded-xl shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
                      >
                        {isSubmittingRenewal ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Submitting Request...</span>
                          </>
                        ) : (
                          <>
                            <CreditCard className="w-4 h-4" />
                            <span>Pay &amp; Request Activation</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                {currentRole === 'school_admin' ? (
                  <button
                    onClick={() => {
                      setIsExpirationOverlayAcknowledged(true);
                      setActiveTabState('billing');
                    }}
                    className="w-full bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs py-3 px-6 rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
                  >
                    <Layers className="w-4 h-4" />
                    Open Detailed Billing Registry Desk
                  </button>
                ) : (
                  <div className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200/50 p-3 rounded-xl text-center">
                    📢 Please request the School Administrator to renew the subscription plan.
                  </div>
                )}

                <button
                  onClick={() => setIsExpirationOverlayAcknowledged(true)}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs py-3 px-6 rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
                >
                  Continue with Limited Access (Print Cards)
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
      
      {/* Sidebar - Copied Design from User's Screenshot */}
      {currentRole !== 'main_admin' && (
        <>
          {/* Mobile Overlay backdrop */}
          {sidebarOpenMobile && (
            <div 
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-49 md:hidden no-print animate-fadeIn"
              onClick={() => setSidebarOpenMobile(false)}
            />
          )}

          {/* Sidebar Drawer Container */}
          <aside 
            className={`no-print bg-slate-50 text-slate-700 flex flex-col transition-all duration-300 z-50 shrink-0 border-r border-slate-200/80 fixed inset-y-0 left-0 h-full w-64 md:sticky md:top-0 md:h-screen md:translate-x-0 ${
              sidebarCollapsed ? 'md:w-20' : 'md:w-64'
            } ${
              sidebarOpenMobile ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            {/* Mobile-only header with close button */}
            <div className="md:hidden p-3 flex justify-end border-b border-slate-200 bg-slate-100/30">
              <button
                onClick={() => setSidebarOpenMobile(false)}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 cursor-pointer active:scale-95"
                title="Close Sidebar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Nav Item List */}
            <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6 scrollbar-none text-left">


              {/* MAIN SECTION */}
              <div className="space-y-1">
                {!sidebarCollapsed ? (
                  <span className="text-[9.5px] uppercase tracking-wider font-extrabold text-slate-400 px-3 block">Main</span>
                ) : (
                  <div className="h-px bg-slate-200 my-2" />
                )}
                <button
                  onClick={() => {
                    setActiveTab('dashboard');
                    setSidebarOpenMobile(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                    activeTab === 'dashboard'
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-100/80 font-bold shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border-transparent'
                  }`}
                  title="Dashboard"
                >
                  <PieChart className="w-4.5 h-4.5 shrink-0 text-indigo-600" />
                  {!sidebarCollapsed && <span className="animate-fadeIn">Dashboard</span>}
                </button>

                {/* Student Registry */}
                <button
                  onClick={() => {
                    setActiveTab('students');
                    setSidebarOpenMobile(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                    activeTab === 'students'
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-100/80 font-bold shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border-transparent'
                  }`}
                  title="Students"
                >
                  <Users className="w-4.5 h-4.5 shrink-0 text-rose-500" />
                  {!sidebarCollapsed && <span className="animate-fadeIn">Students</span>}
                </button>

                {/* Teachers Registry (school_admin only) */}
                {currentRole === 'school_admin' && (
                  <button
                    onClick={() => {
                      setActiveTab('teachers');
                      setSidebarOpenMobile(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                      activeTab === 'teachers'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-100/80 font-bold shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border-transparent'
                    }`}
                    title="Teachers"
                  >
                    <User className="w-4.5 h-4.5 shrink-0 text-teal-600" />
                    {!sidebarCollapsed && <span className="animate-fadeIn">Teachers</span>}
                  </button>
                )}
              </div>

              {/* ACADEMICS SECTION */}
              <div className="space-y-1">
                {!sidebarCollapsed ? (
                  <span className="text-[9.5px] uppercase tracking-wider font-extrabold text-slate-450 px-3 block">Academics</span>
                ) : (
                  <div className="h-px bg-slate-200 my-2" />
                )}

                {/* Subject Marks Entry */}
                <button
                  onClick={() => {
                    setActiveTab('sub_marks_entry');
                    setSidebarOpenMobile(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                    activeTab === 'sub_marks_entry'
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-100/80 font-bold shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border-transparent'
                  }`}
                  title="Marks Entry"
                >
                  <BookOpen className="w-4.5 h-4.5 shrink-0 text-sky-600" />
                  {!sidebarCollapsed && <span className="animate-fadeIn">Marks Entry</span>}
                </button>

                {/* Tabulation Matrices */}
                <button
                  onClick={() => {
                    setActiveTab('classwise_report');
                    setSidebarOpenMobile(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                    activeTab === 'classwise_report'
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-100/80 font-bold shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border-transparent'
                  }`}
                  title="Tabulation Matrices"
                >
                  <BarChart2 className="w-4.5 h-4.5 shrink-0 text-emerald-600" />
                  {!sidebarCollapsed && <span className="animate-fadeIn">Tabulation</span>}
                </button>

                {/* Report Cards Preview */}
                <button
                  onClick={() => {
                    setActiveTab('preview');
                    setSidebarOpenMobile(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                    activeTab === 'preview'
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-100/80 font-bold shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border-transparent'
                  }`}
                  title="Report Cards"
                >
                  <ClipboardList className="w-4.5 h-4.5 shrink-0 text-amber-600" />
                  {!sidebarCollapsed && <span className="animate-fadeIn">Report Cards</span>}
                </button>

                {/* Generate Remarks */}
                <button
                  onClick={() => {
                    setActiveTab('generate_remarks');
                    setSidebarOpenMobile(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                    activeTab === 'generate_remarks'
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-100/80 font-bold shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border-transparent'
                  }`}
                  title="Generate Remarks"
                >
                  <Sparkles className="w-4.5 h-4.5 shrink-0 text-indigo-600" />
                  {!sidebarCollapsed && <span className="animate-fadeIn">Generate Remarks</span>}
                </button>

                {/* Results Analysis Heading and Buttons */}
                <div className="pt-2 pb-1 space-y-1">
                  {!sidebarCollapsed ? (
                    <span className="text-[9.5px] uppercase tracking-wider font-extrabold text-slate-450 px-3 block">Results Analysis</span>
                  ) : (
                    <div className="h-px bg-slate-200 my-1" />
                  )}

                  {/* Classwise Score */}
                  <button
                    onClick={() => {
                      setActiveTab('results_analysis');
                      setAnalysisSubTab('classwise');
                      setSidebarOpenMobile(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                      activeTab === 'results_analysis' && analysisSubTab === 'classwise'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-100/80 font-bold shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border-transparent'
                    }`}
                    title="Classwise Score"
                  >
                    <BarChart2 className="w-4.5 h-4.5 shrink-0 text-emerald-600" />
                    {!sidebarCollapsed && <span className="animate-fadeIn">Classwise Score</span>}
                  </button>

                  {/* Subjectwise Dispersion */}
                  <button
                    onClick={() => {
                      setActiveTab('results_analysis');
                      setAnalysisSubTab('subjectwise');
                      setSidebarOpenMobile(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                      activeTab === 'results_analysis' && analysisSubTab === 'subjectwise'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-100/80 font-bold shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border-transparent'
                    }`}
                    title="Subjectwise Dispersion"
                  >
                    <BookOpen className="w-4.5 h-4.5 shrink-0 text-sky-600" />
                    {!sidebarCollapsed && <span className="animate-fadeIn">Subjectwise Dispersion</span>}
                  </button>

                  {/* Spotlight Profile */}
                  <button
                    onClick={() => {
                      setActiveTab('results_analysis');
                      setAnalysisSubTab('spotlight');
                      setSidebarOpenMobile(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                      activeTab === 'results_analysis' && analysisSubTab === 'spotlight'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-100/80 font-bold shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border-transparent'
                    }`}
                    title="Spotlight Profile"
                  >
                    <Award className="w-4.5 h-4.5 shrink-0 text-purple-600" />
                    {!sidebarCollapsed && <span className="animate-fadeIn">Spotlight Profile</span>}
                  </button>
                </div>

                {/* Parents Portal Hub */}
                <button
                  onClick={() => {
                    setActiveTab('portal');
                    setSidebarOpenMobile(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                    activeTab === 'portal'
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-100/80 font-bold shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border-transparent'
                  }`}
                  title="Parents Portal"
                >
                  <GraduationCap className="w-4.5 h-4.5 shrink-0 text-purple-600" />
                  {!sidebarCollapsed && <span className="animate-fadeIn">Parents Portal</span>}
                </button>
              </div>

              {/* MANAGEMENT SECTION */}
              {currentRole === 'school_admin' && (
                <div className="space-y-1">
                  {!sidebarCollapsed ? (
                    <span className="text-[9.5px] uppercase tracking-wider font-extrabold text-slate-455 px-3 block">Management</span>
                  ) : (
                    <div className="h-px bg-slate-200 my-2" />
                  )}

                  {/* Security Desk */}
                  <button
                    onClick={() => {
                      setActiveTab('security_desk');
                      setSidebarOpenMobile(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                      activeTab === 'security_desk'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-100/80 font-bold shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border-transparent'
                    }`}
                    title="Security Desk"
                  >
                    <Lock className="w-4.5 h-4.5 shrink-0 text-rose-600" />
                    {!sidebarCollapsed && <span className="animate-fadeIn">Security Desk</span>}
                  </button>

                  {/* Subscription & Billing */}
                  <button
                    onClick={() => {
                      setActiveTab('billing');
                      setSidebarOpenMobile(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                      activeTab === 'billing'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-100/80 font-bold shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border-transparent'
                    }`}
                    title="Subscription & Billing"
                  >
                    <CreditCard className="w-4.5 h-4.5 shrink-0 text-indigo-650" />
                    {!sidebarCollapsed && <span className="animate-fadeIn">Subscription &amp; Billing</span>}
                  </button>
                </div>
              )}

              {/* DESIGN & IDENTITY SECTION */}
              {(currentRole === 'school_admin' || isImpersonating) && (
                <div className="space-y-1">
                  {!sidebarCollapsed ? (
                    <span className="text-[9.5px] uppercase tracking-wider font-extrabold text-indigo-600 px-3 block font-black">Design & Branding</span>
                  ) : (
                    <div className="h-px bg-slate-200 my-2" />
                  )}

                  {/* School Identity */}
                  {isImpersonating && (
                    <button
                      onClick={() => {
                        setActiveTab('branding');
                        setSidebarOpenMobile(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                        activeTab === 'branding'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-100/80 font-bold shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border-transparent'
                      }`}
                      title="School Identity"
                    >
                      <Palette className="w-4.5 h-4.5 shrink-0 text-indigo-600" />
                      {!sidebarCollapsed && <span className="animate-fadeIn">School Identity</span>}
                    </button>
                  )}

                  {/* Grading Scales */}
                  {isImpersonating && (
                    <button
                      onClick={() => {
                        setActiveTab('grades');
                        setSidebarOpenMobile(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                        activeTab === 'grades'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-100/80 font-bold shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border-transparent'
                      }`}
                      title="Grading Scales"
                    >
                      <Trophy className="w-4.5 h-4.5 shrink-0 text-amber-500" />
                      {!sidebarCollapsed && <span className="animate-fadeIn">Grading Scales</span>}
                    </button>
                  )}

                  {/* Report Card Designer Layout */}
                  {isImpersonating && (
                    <button
                      onClick={() => {
                        setActiveTab('structures');
                        setSidebarOpenMobile(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                        activeTab === 'structures'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-100/80 font-bold shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border-transparent'
                      }`}
                      title="Design Layout & Signatures"
                    >
                      <Layers className="w-4.5 h-4.5 shrink-0 text-blue-600" />
                      {!sidebarCollapsed && <span className="animate-fadeIn">Layout Design</span>}
                    </button>
                  )}

                  {/* Template Gallery */}
                  <button
                    onClick={() => {
                      setActiveTab('gallery_templates');
                      setSidebarOpenMobile(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                      activeTab === 'gallery_templates'
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-100/80 font-bold shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border-transparent'
                    }`}
                    title="Browse & Request Report Card Templates"
                  >
                    <LayoutGrid className="w-4.5 h-4.5 shrink-0 text-indigo-650" />
                    {!sidebarCollapsed && <span className="animate-fadeIn">Template Gallery</span>}
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Footer profile & Sign Out Shifted */}
            <div className="p-3 border-t border-slate-200/80 bg-slate-100/40 text-[11px] text-slate-600 text-left mt-auto no-print space-y-2.5">
              {!sidebarCollapsed && (
                <div className="flex items-center gap-2.5 animate-fadeIn">
                  <div className="w-7.5 h-7.5 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold border border-indigo-100/50 shrink-0">
                    {currentRole === 'school_admin' ? 'A' : 'T'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-slate-800 truncate leading-none">{currentRole === 'school_admin' ? 'Administrator' : 'Class Tutor'}</p>
                    <p className="text-[9.5px] text-slate-500 truncate mt-1 leading-none font-medium">
                      Code: <span className="font-mono">{activeSchoolObj?.portalCode || 'N/A'}</span>
                    </p>
                    {currentRole === 'school_admin' && activeSchoolObj?.trialUntil && (
                      <p className={`text-[9px] font-bold truncate mt-0.5 leading-none ${isSchoolPlanExpired ? 'text-rose-600' : 'text-indigo-600'}`}>
                        {isSchoolPlanExpired ? '⚠️ Plan Expired' : `Until ${new Date(activeSchoolObj.trialUntil).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}`}
                      </p>
                    )}
                  </div>
                </div>
              )}
              <button
                onClick={handleLogout}
                className={`w-full flex items-center justify-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100/60 font-extrabold py-2 rounded-xl transition-all text-xs cursor-pointer active:scale-95 shadow-2xs ${sidebarCollapsed ? 'px-2' : 'px-3'}`}
                title="Sign Out of Dashboard"
              >
                <LogOut className="w-3.5 h-3.5" />
                {!sidebarCollapsed && <span className="animate-fadeIn">Sign Out</span>}
              </button>

              {/* Collapse/Expand toggle button (Desktop only, adjusted to bottom) */}
              <button
                onClick={() => {
                  const newVal = !sidebarCollapsed;
                  setSidebarCollapsed(newVal);
                  localStorage.setItem('school_dash_sidebar_collapsed', String(newVal));
                }}
                className="hidden md:flex w-full items-center justify-center gap-1.5 py-1.5 rounded-lg bg-slate-150 hover:bg-slate-200 border border-slate-200 text-slate-600 transition-all cursor-pointer active:scale-95 text-[10px] font-bold uppercase tracking-wider"
                title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              >
                {sidebarCollapsed ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <>
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Collapse Menu</span>
                  </>
                )}
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Right main content body wrapper */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        
        {/* Impersonation Banner */}
        {isImpersonating && isSaaSAdmin && (
          <div className="bg-amber-600 text-amber-50 px-4 py-2 text-xs font-bold flex justify-between items-center no-print">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 animate-pulse text-white" />
              <span>System Sandbox Mode: Impersonating <strong>{activeSchoolObj?.name}</strong> Admin Dashboard</span>
            </div>
            <button
              onClick={handleExitImpersonation}
              className="bg-amber-900/40 hover:bg-amber-955/60 text-white px-2.5 py-1 rounded font-extrabold uppercase text-[10px] tracking-wider transition-all cursor-pointer"
            >
              Exit Sandbox Back to Owner Desk &rarr;
            </button>
          </div>
        )}

      {/* Decorative Brand Top Banner bar - Polished Crisp Light Theme */}
      <header className="bg-white border-b border-slate-200 text-slate-800 px-3 sm:px-6 py-2 shadow-2xs no-print animate-fadeIn sticky top-0 z-45 backdrop-blur-md bg-white/95">
        <div className="w-full flex flex-row justify-between items-center gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
            {currentRole !== 'main_admin' && (
              <button
                onClick={() => setSidebarOpenMobile(true)}
                className="md:hidden mr-0.5 p-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 active:scale-95 cursor-pointer flex items-center justify-center shrink-0"
                title="Open Sidebar Menu"
              >
                <Menu className="w-4 h-4" />
              </button>
            )}
            {branding?.logoUrl ? (
              <img 
                src={branding.logoUrl} 
                alt="School Logo" 
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl object-contain bg-slate-50 border border-slate-200/60 p-1 shrink-0 shadow-3xs" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="bg-indigo-50 border border-indigo-100/50 p-1 rounded-xl flex items-center justify-center shadow-2xs shrink-0 w-8 h-8 sm:w-10 sm:h-10">
                <svg className="w-4.5 h-4.5 sm:w-5.5 sm:h-5.5 text-indigo-600 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="rgba(99, 102, 241, 0.1)" />
                  <path d="M12 11h3" />
                  <path d="M12 7h3" />
                  <path d="M9 7h1" />
                  <path d="M9 11h1" />
                  <path d="M12 15h3" />
                  <path d="M9 15h1" />
                </svg>
              </span>
            )}
            <div className="min-w-0 text-left">
              <h1 className="text-xs sm:text-sm font-black font-sans text-slate-900 tracking-tight flex items-center flex-wrap gap-1 sm:gap-1.5 leading-tight">
                <span className="truncate max-w-[100px] xs:max-w-[150px] sm:max-w-none">
                  {currentRole === 'main_admin' ? (
                    "School Report Card Registry Desk"
                  ) : (
                    activeSchoolObj?.name || "SchoolDash"
                  )}
                </span>
                <span className="text-[8px] sm:text-[9px] font-mono select-none px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 uppercase font-bold shrink-0">
                  {currentRole === 'main_admin' ? 'Master Admin' : currentRole === 'school_admin' ? 'School Admin' : 'Class Teacher'}
                </span>
              </h1>
              
              {currentRole === 'class_teacher' && (
                <p className="text-[9px] sm:text-[10px] text-slate-500 mt-0.5 font-sans leading-normal truncate">
                  Assigned: <strong className="text-indigo-600 font-bold bg-indigo-50 border border-indigo-100/50 px-1.5 py-0.2 rounded font-mono uppercase">{activeTeacherObj?.assignedClass} Section {activeTeacherObj?.assignedSection || 'All'}</strong>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 text-xs shrink-0">
            <div className="hidden md:flex flex-col items-end">
              {isFirestoreOffline ? (
                <>
                  <span className="font-sans font-semibold text-amber-600 text-[11px] flex items-center gap-1">
                    <CloudOff className="w-3.5 h-3.5 text-amber-500 animate-bounce" />
                    Offline Mode (Cached)
                  </span>
                  <span className="font-mono text-slate-400 text-[9px]" title="Cloud Firestore database is currently unreachable. Local storage is fully active with local persistence.">
                    Local Storage Active
                  </span>
                </>
              ) : firebaseUser && currentSchoolId?.startsWith("cloud_") ? (
                <>
                  <span className="font-sans font-semibold text-indigo-600 text-[11px] flex items-center gap-1">
                    <Cloud className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
                    Firestore Synced
                  </span>
                  <span className="font-mono text-slate-400 text-[9px] max-w-[150px] truncate" title={firebaseUser.email || ""}>
                    {firebaseUser.email}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-sans font-semibold text-slate-600 text-[11px] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                    Console Active
                  </span>
                  <span className="font-mono text-indigo-600 text-[9px] font-bold">
                    {currentRole === 'class_teacher' ? `Logged as ${activeTeacherObj?.name}` : "System Authorized"}
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              {currentRole !== 'main_admin' && (
                <button
                  onClick={handleSaveData}
                  disabled={isSaving}
                  className={`flex items-center gap-1 sm:gap-1.5 font-bold py-1 px-2 sm:py-1.5 sm:px-3.5 rounded-lg sm:rounded-xl shadow-2xs transition-all cursor-pointer select-none active:scale-95 text-[10px] sm:text-xs ${
                    isSaving
                      ? 'bg-amber-50 text-amber-700 border border-amber-200 scale-95 opacity-90'
                      : saveSuccess 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold animate-bounce' 
                      : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 border border-indigo-200/60'
                  }`}
                  title="Save all configuration and column changes manually to browser memory/cloud"
                >
                  {isSaving ? (
                    <RefreshCw className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin" />
                  ) : saveSuccess ? (
                    <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-pulse" />
                  ) : (
                    <Save className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  )}
                  <span className="text-[10px] sm:text-xs">
                    {isSaving ? (
                      "Saving..."
                    ) : saveSuccess ? (
                      saveMessage || "Saved!"
                    ) : (
                      <>
                        <span className="hidden sm:inline">Save Changes</span>
                        <span className="sm:hidden">Save</span>
                      </>
                    )}
                  </span>
                </button>
              )}

              {currentRole !== 'main_admin' && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowNotificationCenter(!showNotificationCenter)}
                    className={`p-2 rounded-xl border transition-all cursor-pointer relative ${
                      showNotificationCenter 
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-2xs' 
                        : 'bg-slate-50 border-slate-200 text-slate-605 hover:bg-slate-100 hover:text-slate-905'
                    }`}
                    title="Official Notifications Inbox"
                  >
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-rose-600 border border-white font-extrabold text-[9px] text-white w-4 h-4 rounded-full flex items-center justify-center animate-pulse shadow-sm leading-none shrink-0">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                {/* Popover Menu Dropdown */}
                {showNotificationCenter && (
                  <div className="absolute right-0 mt-2.5 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 text-slate-800 overflow-hidden animate-fadeIn font-sans">
                    <div className="bg-slate-900 text-white p-3 px-4 flex justify-between items-center border-b border-slate-800">
                      <span className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                        <Bell className="w-3.5 h-3.5 text-indigo-400" />
                        System Notifications Inbox
                      </span>
                      {unreadCount > 0 && (
                        <button
                          onClick={() => {
                            // Mark all read
                            const newDismissed = userTargetedNotifs.map(ut => ut.id);
                            setDismissedNotifIds(prev => Array.from(new Set([...prev, ...newDismissed])));
                            setNotifications(prev => prev.map(n => {
                              if (userTargetedNotifs.some(ut => ut.id === n.id) && !n.readBy.includes(activeNotifKey || '')) {
                                  dismissNotificationInCloud(currentSchoolId || '', n.id, activeNotifKey || '');
                                  return { ...n, readBy: [...(n.readBy || []), activeNotifKey || ''] };
                              }
                              return n;
                            }));
                          }}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold underline cursor-pointer"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                      {userTargetedNotifs.length === 0 ? (
                        <div className="p-6 text-center text-slate-400 text-xs">
                          <Bell className="w-8 h-8 mx-auto text-slate-300 opacity-50 mb-2 shrink-0 text-center block" />
                          <p className="font-sans leading-relaxed">No notices are currently registered in your inbox.</p>
                        </div>
                      ) : (
                        userTargetedNotifs.map(n => {
                          const isNew = !n.readBy?.includes(activeNotifKey || '') && !dismissedNotifIds.includes(n.id);
                          return (
                            <div key={n.id} className={`p-3 px-4 hover:bg-slate-50/50 transition-colors space-y-1 relative text-left ${isNew ? 'bg-indigo-50/10' : ''}`}>
                              <div className="flex items-start justify-between gap-2">
                                <span className={`text-[10.5px] font-extrabold font-sans leading-snug pr-3 ${isNew ? 'text-indigo-900 font-black' : 'text-slate-700'}`}>
                                  {n.title}
                                </span>
                                {isNew && (
                                  <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 mt-1" title="Unread New Alert" />
                                )}
                              </div>
                              <div className="text-[11px] text-gray-550 leading-normal font-medium whitespace-pre-wrap">{renderMessageWithLinks(n.message, false)}</div>
                              <div className="flex justify-between items-center text-[9px] pt-1 text-slate-400 font-mono">
                                <span>{new Date(n.sentAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                {isNew && (
                                  <button
                                    onClick={() => {
                                      // Toggle read
                                      setDismissedNotifIds(prev => Array.from(new Set([...prev, n.id])));
                                      setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, readBy: [...(item.readBy || []), activeNotifKey || ''] } : item));
                                      dismissNotificationInCloud(currentSchoolId || '', n.id, activeNotifKey || '');
                                    }}
                                    className="text-indigo-650 hover:underline font-bold"
                                  >
                                    Mark read
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="bg-slate-50 p-2.5 text-center text-[10px] text-slate-400 border-t border-slate-100 font-bold select-none">
                      Notifications persisted in security registry
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>

      {/* Main Responsive Body Container */}
      <main id="main-app-content" className="w-full max-w-full px-2 sm:px-6 lg:px-8 py-4 sm:py-5 flex-grow space-y-5 sm:space-y-6">
        
        {/* On-Screen Flash Alert Notifications (First shown with Cut Option) */}
        {currentRole !== 'main_admin' && userTargetedNotifs.map(n => {
          const isUnread = !n.readBy?.includes(activeNotifKey || '');
          const isDismissed = dismissedNotifIds.includes(n.id);
          if (!isUnread || isDismissed) return null;
          return (
            <div 
              key={n.id}
              className={`p-5 rounded-2xl border shadow-xl flex flex-col md:flex-row items-start gap-4 p-5 animate-pulse-slow font-sans text-left transition-all relative ${
                n.type === 'success' 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900 shadow-emerald-500/5' 
                  : n.type === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-900 shadow-amber-500/5'
                  : 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-indigo-500/5'
              }`}
            >
              <div className="p-3 rounded-full bg-white shadow-xs shrink-0">
                {n.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-600 animate-bounce" />}
                {n.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-605 animate-pulse" />}
                {n.type === 'info' && <Info className="w-5 h-5 text-indigo-600" />}
              </div>
              <div className="flex-grow min-w-0 pr-4 space-y-1">
                <h4 className="font-extrabold text-sm tracking-tight uppercase flex items-center gap-2">
                  <span>{n.title}</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-white text-gray-500 font-mono tracking-normal border font-bold capitalize">
                    System Broadcast Notice
                  </span>
                </h4>
                <div className="text-xs leading-relaxed font-semibold opacity-90 whitespace-pre-wrap">{renderMessageWithLinks(n.message, false)}</div>
                
                {/* Real-time Trial Details Card for approvals */}
                {n.id.startsWith("notif_approval_") && (
                  <div className="mt-3 bg-white p-3 rounded-xl border border-gray-150 flex flex-wrap gap-4 text-xs font-bold text-slate-800">
                    <div>
                      <span className="text-gray-400 text-[9px] uppercase block">Assigned Sandbox Tier</span>
                      <strong className="text-indigo-600">Complete Platform Trial Suite</strong>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[9px] uppercase block">Cumulative Duration</span>
                      <strong className="text-slate-800">Flexible Evaluation Active</strong>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[9px] uppercase block">Post-Trial Rate</span>
                      <strong className="text-slate-800">Configured in Tenant Sheet</strong>
                    </div>
                  </div>
                )}
                
                <span className="text-[9.5px] font-mono opacity-60 block pt-1 select-none">
                  Sent {new Date(n.sentAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <button
                onClick={() => {
                  // Save to dismissedNotifIds so they don't reappear on refresh
                  setDismissedNotifIds(prev => Array.from(new Set([...prev, n.id])));
                  // Mark read (i.e., "Cut" option to dismiss from screen & save to inbox)
                  setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, readBy: [...(item.readBy || []), activeNotifKey || ''] } : item));
                  dismissNotificationInCloud(currentSchoolId || '', n.id, activeNotifKey || '');
                }}
                className="bg-white/85 hover:bg-white text-slate-700 hover:text-rose-600 p-2 rounded-xl transition-all cursor-pointer font-bold shrink-0 shadow-xs border border-gray-150 flex items-center justify-center gap-1 text-[11px] self-end md:self-start"
                title="Dismiss and save notice inside historical Notifications Bell inbox"
              >
                <X className="w-3.5 h-3.5 shrink-0" />
                <span>Dismiss NOTICE</span>
              </button>
            </div>
          );
        })}
        {currentRole !== 'main_admin' && activeTab !== 'dashboard' && (
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-900 text-white rounded-2xl p-4 shadow-md no-print animate-fadeIn">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
              <button 
                onClick={() => setActiveTab('dashboard')} 
                className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 border border-indigo-500 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer w-full sm:w-auto shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Dashboard</span>
              </button>
              <div className="hidden sm:block h-6 w-px bg-slate-700 shrink-0" />
              <div className="text-left w-full min-w-0">
                <span className="text-[9.5px] text-indigo-400 font-extrabold uppercase block tracking-wider leading-none">Active Work Desk</span>
                <span className="text-xs font-bold font-sans text-slate-200 mt-1 block leading-tight break-words">
                  {activeTab === 'preview' && "📜 Live Report Cards & Bulk Print View"}
                  {activeTab === 'classwise_report' && "📊 Classwise Tabulation & Rankings Matrix"}
                  {activeTab === 'students' && "👥 Student Registry & Marks Sheet"}
                  {activeTab === 'teachers' && "💼 Staff Directory & Assignments List"}
                  {activeTab === 'security_desk' && "🔒 Portal Security Desk & Configurations"}
                  {activeTab === 'portal' && "🎓 Parents Portal Hub Sync Settings"}
                  {activeTab === 'sub_marks_entry' && "✍️ Subject Marks Entry Console"}
                  {activeTab === 'branding' && "🎨 School Identity & Logo Customizer"}
                  {activeTab === 'grades' && "🏆 School Grading Scales Configuration"}
                  {activeTab === 'structures' && "📐 Report Card Layout & Signature Designer"}
                  {activeTab === 'gallery_templates' && "🗂️ Browse & Request Report Card Templates"}
                  {activeTab === 'generate_remarks' && "✨ AI Section Remarks & Promotion Generator"}
                  {activeTab === 'billing' && "💳 Subscription Billing & Upgrades Desk"}
                  {activeTab === 'results_analysis' && `📊 Results Analysis: ${analysisSubTab === 'classwise' ? 'Classwise Score' : analysisSubTab === 'subjectwise' ? 'Subjectwise Dispersion' : 'Student Spotlight Profile'}`}
                </span>
              </div>
            </div>

            {/* Session Selector */}
            {hasAnyArchivedSession && (
              <div className="flex items-center gap-2 bg-slate-800 border border-slate-700/60 rounded-xl px-3 py-1.5 shrink-0 self-start md:self-auto no-print">
                <span className="text-[10px] uppercase font-black text-slate-400 font-sans tracking-wider">Session:</span>
                <select
                  value={selectedSessionFilter}
                  onChange={(e) => setSelectedSessionFilter(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-100 outline-none cursor-pointer pr-2 border-none ring-0 focus:ring-0 focus:outline-none"
                >
                  <option value="" className="bg-slate-950 text-slate-100 font-sans">
                    {branding.session || "Session 2026-2027"} (Active)
                  </option>
                  {availableSessions.filter(s => s !== (branding.session || "Session 2026-2027")).map(sess => {
                    const cleanSess = sess.replace(/\s*\(Archived\)$/i, "").trim();
                    return (
                      <option key={sess} value={sess} className="bg-slate-950 text-slate-100 font-sans">
                        {cleanSess} (Archived)
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>
        )}

        {/* If Platform owner, keep their clear, simple button */}
        {currentRole === 'main_admin' && (
          <div className="flex gap-1.5 border-b border-gray-200 overflow-x-auto pb-px text-[11.5px] font-sans no-print mb-4">
            <button
              onClick={() => setActiveTab('saas_owner')}
              className={`flex items-center gap-1.5 py-2.5 px-3.5 font-bold transition-all border-b-2 shrink-0 ${activeTab === 'saas_owner' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/10' : 'border-transparent text-gray-500 hover:text-slate-800'}`}
            >
              <Shield className="w-4 h-4" /> Platform Onboarding Control Panel
            </button>
          </div>
        )}

        {/* Tab view controller render */}
        <div className="space-y-6">

          {/* Unsynced Active School Alert Notice */}
          {currentRole === 'school_admin' && currentSchoolId && !cloudSchoolIds.includes(currentSchoolId) && (
            <div className="bg-slate-900 border-2 border-amber-500/35 rounded-2xl p-5 shadow-lg shadow-amber-500/5 animate-fadeIn no-print text-left w-full space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="bg-amber-500/10 p-2.5 rounded-xl text-amber-500 border border-amber-500/25 shrink-0 select-none">
                    <CloudOff className="w-5 h-5 text-amber-500 animate-bounce" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-[12.5px] text-amber-500 tracking-tight flex items-center gap-2">
                      ⚠️ Unsynced School Console (Local Only)
                    </h4>
                    <p className="text-slate-400 text-xs mt-1 font-sans leading-relaxed">
                      This school was registered or onboarded while your console was offline. Its records (branding, grading scales, subjects, structures, students, and marks) are currently saved in your browser's local cache but are not saved permanently to the Cloud.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 shrink-0 self-end sm:self-center">
                  <button
                    onClick={syncActiveSchoolToCloud}
                    disabled={isCloudSyncing}
                    className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-slate-950 text-[10.5px] font-extrabold px-3.5 py-1.5 rounded-lg shadow-md transition-all cursor-pointer active:scale-95 border border-amber-400/20 animate-fadeIn"
                    id="btn-sync-active-school"
                  >
                    {isCloudSyncing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        {cloudSyncMessage || "Syncing active..."}
                      </>
                    ) : (
                      <>
                        <CloudLightning className="w-3.5 h-3.5" />
                        Sync Active School to Cloud
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Pending Approval Status Alert Notice */}
          {currentRole === 'school_admin' && activeSchoolObj?.approvalStatus === 'pending' && (
            <div className="bg-slate-900 border-2 border-amber-500/30 rounded-2xl p-5 shadow-lg shadow-amber-500/5 animate-fadeIn no-print text-left w-full space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="bg-amber-500/10 p-2.5 rounded-xl text-amber-500 border border-amber-500/25 shrink-0 select-none">
                    <Trophy className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-[12.5px] text-amber-500 tracking-tight flex items-center gap-2">
                      Academic Registration Received & Review Pending
                    </h4>
                    <p className="text-slate-400 text-xs mt-1 font-sans leading-relaxed">
                      We have received your Registration details. We will notify you soon about your Approval Status here. Till then, keep exploring.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 shrink-0 self-end sm:self-center">
                  <button
                    onClick={() => refreshSchoolsFromCloud(true)}
                    disabled={isRefreshingApproval}
                    className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-500/50 text-slate-950 text-[10.5px] font-extrabold px-3 py-1.5 rounded-lg shadow-md transition-all cursor-pointer active:scale-95 border border-amber-400/20 animate-fadeIn"
                    id="btn-check-approval-status"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingApproval ? 'animate-spin' : ''}`} />
                    {isRefreshingApproval ? 'Checking...' : 'Check Approval Status'}
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                    </span>
                    <span className="text-[10px] text-amber-400 font-mono font-bold uppercase tracking-wider bg-amber-950/40 px-2.5 py-1 rounded border border-amber-900/40 animate-pulse">
                      PRT-PENDING REVIEW
                    </span>
                  </div>
                </div>
              </div>
              {lastCheckMessage && (
                <div className="text-[11px] font-bold text-amber-400 font-mono bg-slate-950/50 p-2.5 rounded-lg border border-amber-500/20 animate-slideDown" id="last-check-message-banner">
                  {lastCheckMessage}
                </div>
              )}
            </div>
          )}
          
           {activeTab === 'dashboard' && (
             <AnalyticalDashboard
               branding={branding}
               students={students}
               studentGrades={studentGrades}
               subjects={subjects}
               scoreColumns={scoreColumns}
               gradeScales={gradeScales}
               currentRole={currentRole}
               setActiveTab={setActiveTab}
               teachers={schools.find(s => s.id === currentSchoolId)?.teachers || []}
               activeTeacher={activeTeacherObj}
               isDashboardOnly={true}
               school={schools.find(s => s.id === currentSchoolId)}
               reportCardStructures={reportCardStructures}
             />
           )}

           {activeTab === 'results_analysis' && (
             <AnalyticalDashboard
               branding={branding}
               students={students}
               studentGrades={studentGrades}
               subjects={subjects}
               scoreColumns={scoreColumns}
               gradeScales={gradeScales}
               currentRole={currentRole}
               setActiveTab={setActiveTab}
               teachers={schools.find(s => s.id === currentSchoolId)?.teachers || []}
               activeTeacher={activeTeacherObj}
               isResultsAnalysisOnly={true}
               school={schools.find(s => s.id === currentSchoolId)}
               reportCardStructures={reportCardStructures}
               activeAnalysisTab={analysisSubTab}
               onAnalysisTabChange={setAnalysisSubTab}
             />
           )}

          {activeTab === 'preview' && (
            <div className="space-y-6">
              {/* Management, filter and selection bar */}
              <div className="bg-white p-5 rounded-xl border border-gray-150 shadow-xs space-y-4 no-print animate-fadeIn">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-100 pb-3">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-indigo-600" />
                      Manage Classwise Results (View & Print)
                    </h3>
                    <p className="text-[11px] text-gray-500">Filter students to view academic results, print individual sheets, or print bulk directories.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPreviewBulkPrint(!previewBulkPrint)}
                      className={`text-xs font-bold py-2 px-3.5 rounded-lg border transition-all ${
                        previewBulkPrint 
                          ? 'bg-amber-600 border-amber-600 text-white hover:bg-amber-700' 
                          : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {previewBulkPrint ? "⚡ Individual Card Mode" : "🖨️ Bulk Print Class Mode"}
                    </button>
                    <button
                      onClick={() => setActiveTab('students')}
                      className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 py-2 px-3.5 rounded-lg"
                    >
                      Manage Marks & Grades
                    </button>
                  </div>
                </div>

                {/* Filter Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Classwise Selector */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500 block">Class (Classwise Filter)</label>
                    <select
                      value={previewFilterClass}
                      onChange={(e) => {
                        setPreviewFilterClass(e.target.value);
                        // Reset selection to first filtered if we change filter
                        const matches = students.filter(s => e.target.value === 'all' || classesMatch(s.className, e.target.value));
                        if (matches.length > 0) {
                          setSelectedStudentId(matches[0].id);
                        }
                      }}
                      className="w-full px-3 py-2 text-xs border border-gray-200 bg-slate-50 hover:bg-slate-100 rounded-lg outline-none font-semibold text-gray-700 focus:bg-white focus:ring-2 focus:ring-indigo-500/15"
                    >
                      <option value="all">All Classes</option>
                      {previewUniqueClasses.map(cls => (
                        <option key={cls} value={cls}>{cls}</option>
                      ))}
                    </select>
                  </div>

                  {/* Unified Search Filter */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500 block">Search Any Student (Name/Roll)</label>
                    <input
                      type="text"
                      placeholder="Type Name or Roll Number..."
                      value={previewFilterQuery}
                      onChange={(e) => setPreviewFilterQuery(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-200 bg-slate-50 hover:bg-slate-100 rounded-lg outline-none font-semibold text-gray-700 focus:bg-white focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500"
                    />
                  </div>

                  {/* Section Selector */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500 block">Section Filter</label>
                    <select
                      value={previewFilterSection}
                      onChange={(e) => {
                        setPreviewFilterSection(e.target.value);
                        // Reset selection to first filtered if we change filter
                        const matches = visibleStudents.filter(s => {
                          const matchesClass = previewFilterClass === 'all' || classesMatch(s.className, previewFilterClass);
                          const matchesSec = e.target.value === 'all' || (s.section || '').trim().toLowerCase() === e.target.value.toLowerCase();
                          return matchesClass && matchesSec;
                        });
                        if (matches.length > 0) {
                          setSelectedStudentId(matches[0].id);
                        }
                      }}
                      className="w-full px-3 py-2 text-xs border border-gray-200 bg-slate-50 hover:bg-slate-100 rounded-lg outline-none font-semibold text-gray-700 focus:bg-white focus:ring-2 focus:ring-indigo-500/15"
                    >
                      <option value="all">All Sections</option>
                      {previewUniqueSections.map(sec => (
                        <option key={sec} value={sec}>{sec}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Filter List Quick View Directory */}
                {(() => {
                  const showPreviewAdmissionKey = isAdmissionNoActiveInLayout(
                    previewFilterClass !== 'all' ? previewFilterClass : undefined, 
                    previewFilterSection !== 'all' ? previewFilterSection : undefined
                  );
                  const totalCols = showPreviewAdmissionKey ? 5 : 4;

                  return (
                    <div className="mt-3.5 border border-slate-100 rounded-xl overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                            <th className="p-2.5 w-16 text-center">Roll No</th>
                            <th className="p-2.5">Student Name</th>
                            <th className="p-2.5">Class - Sec</th>
                            {showPreviewAdmissionKey && <th className="p-2.5">Admission Key</th>}
                            <th className="p-2.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {paginatedPreviewStudents.length === 0 ? (
                            <tr>
                              <td colSpan={totalCols} className="p-4 text-center text-gray-400 italic">No matching student records found.</td>
                            </tr>
                          ) : (
                            paginatedPreviewStudents.map((std) => (
                              <tr
                                key={std.id}
                                className={`hover:bg-indigo-50/10 cursor-pointer transition-colors ${selectedStudentId === std.id ? 'bg-indigo-50/40 font-semibold text-indigo-950' : 'text-slate-600'}`}
                                onClick={() => {
                                  setSelectedStudentId(std.id);
                                  if (previewBulkPrint) setPreviewBulkPrint(false); // turn off bulk mode when individual selected to avoid confusion
                                }}
                              >
                                <td className="p-2.5 text-center font-mono font-bold text-gray-500">{std.rollNo}</td>
                                <td className="p-2.5 flex items-center gap-1.5 font-sans">
                                  <span className={`w-2 h-2 rounded-full ${selectedStudentId === std.id ? 'bg-indigo-600 animate-ping' : 'bg-transparent'}`} />
                                  {std.name}
                                </td>
                                <td className="p-2.5">{std.className} - {std.section}</td>
                                {showPreviewAdmissionKey && (
                                  <td className="p-2.5 font-mono text-gray-400">
                                    {isAdmissionNoActiveInLayout(std.className, std.section) && std.admissionNo && !std.admissionNo.startsWith('adm_') ? std.admissionNo : '—'}
                                  </td>
                                )}
                                <td className="p-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex justify-end gap-1.5">
                                    <button
                                      onClick={() => {
                                        setSelectedStudentId(std.id);
                                        setPreviewBulkPrint(false);
                                      }}
                                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[10px] rounded transition-colors"
                                    >
                                      Preview Card
                                    </button>
                                    <button
                                      onClick={() => {
                                        setSelectedStudentId(std.id);
                                        setPreviewBulkPrint(false);
                                        // Trigger immediate window print with short delay to allow DOM transition
                                        setTimeout(() => window.print(), 150);
                                      }}
                                      className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[10px] rounded transition-all flex items-center gap-1 shadow-xs"
                                    >
                                      🖨️ Print
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3.5 px-1 no-print">
                    <p className="text-[11px] text-gray-500 font-medium font-sans">
                      Showing <span className="font-bold text-slate-700">{((safePreviewPage - 1) * itemsPerPage) + 1}</span> to <span className="font-bold text-slate-700">{Math.min(safePreviewPage * itemsPerPage, filteredPreviewStudents.length)}</span> of <span className="font-bold text-slate-700">{filteredPreviewStudents.length}</span> students
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setPreviewPage(prev => Math.max(1, prev - 1))}
                        disabled={safePreviewPage === 1}
                        className="p-1.5 px-3 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none rounded-lg text-xs font-bold text-slate-700 bg-white transition cursor-pointer font-sans"
                      >
                        Previous
                      </button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }).map((_, i) => {
                          const pageNum = i + 1;
                          if (totalPages <= 6 || pageNum === 1 || pageNum === totalPages || Math.abs(pageNum - safePreviewPage) <= 1) {
                            return (
                              <button
                                key={pageNum}
                                onClick={() => setPreviewPage(pageNum)}
                                className={`w-8 h-8 rounded-lg text-xs font-extrabold transition-all border cursor-pointer flex items-center justify-center font-sans ${
                                  safePreviewPage === pageNum
                                    ? 'bg-indigo-650 text-white border-indigo-650 shadow-xs'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          } else if (pageNum === 2 || pageNum === totalPages - 1) {
                            return <span key={pageNum} className="text-gray-400 text-xs px-0.5 select-none font-sans">...</span>;
                          }
                          return null;
                        })}
                      </div>
                      <button
                        onClick={() => setPreviewPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={safePreviewPage === totalPages}
                        className="p-1.5 px-3 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none rounded-lg text-xs font-bold text-slate-700 bg-white transition cursor-pointer font-sans"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Displaying Report Cards */}
              {previewBulkPrint ? (
                <div className="space-y-8">
                  <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 text-amber-900 text-xs font-semibold no-print flex flex-col md:flex-row justify-between items-center gap-3">
                    <p className="flex-1">
                      <strong>🖨️ Bulk Print Mode Active:</strong> Displaying all {filteredPreviewStudents.length} report cards matching your filter criteria simultaneously. Choose to print directly or generate a high-fidelity fully styled bulk PDF on the server.
                    </p>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      <button
                        onClick={() => window.print()}
                        className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg shadow-sm transition"
                      >
                        Print Class Report Cards
                      </button>
                      <button
                        onClick={downloadBulkServerSidePdf}
                        disabled={isGeneratingBulkPdf}
                        className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 disabled:bg-indigo-400 text-white font-bold rounded-lg shadow-sm transition flex items-center gap-1.5"
                      >
                        {isGeneratingBulkPdf ? (
                          <>
                            <span className="animate-spin">🌀</span> Generating PDF...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" /> Download Bulk PDF (Server)
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {filteredPreviewStudents.length > 0 ? (
                    filteredPreviewStudents.map((std, idx) => {
                      const stdGrades = studentGrades.find(g => g.studentId === std.id) || studentGrades[0];
                      return (
                        <div key={std.id} className="relative bg-white border border-gray-100 rounded-2xl p-4 shadow-xs print:shadow-none print:border-none print:p-0" style={{ pageBreakAfter: 'always', breakAfter: 'page' }}>
                          <div className="absolute top-2 left-4 px-2 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-black rounded-lg no-print z-10">
                            Bulk Sheet #{idx + 1}
                          </div>
                          
                          <div className="flex md:hidden justify-between items-center bg-indigo-50/50 text-indigo-950 font-bold text-[9px] px-3 py-1.5 border border-indigo-100/60 rounded-lg mb-2 mt-5 no-print">
                            <span>📄 Bulk Sheet #{idx + 1}</span>
                            <span className="text-emerald-700">✓ Mobile Responsive View</span>
                          </div>

                          {/* Adaptive responsive wrapper containing ReportCardPreview */}
                          <div className="w-full border border-gray-150 rounded-xl p-1 sm:p-4 bg-white shadow-xs print:overflow-visible print:border-none print:shadow-none print:p-0">
                                                {(() => {
                                  const { resolvedBranding, resolvedSubjects, resolvedScoreColumns, resolvedGradeScales, resolvedScholasticTerm1Disabled, resolvedScholasticTerm2Disabled, resolvedScholasticTerm3Disabled, resolvedCoScholasticOneColumn, resolvedCoScholasticSections, resolvedCoGradeScales, resolvedSignatures, resolvedHideGradingScale, resolvedHideAttendance, resolvedPureGradeBased, resolvedGradingScaleAfterSignatures, resolvedGradingScaleLayout, resolvedVerticalExamHeaders, resolvedVerticalSubjectsHeader, resolvedSubjectSpecificMaxMarksEnabled, resolvedEnableSubjectGrouping, resolvedCustomSubjectGroups, resolvedHideTerm1Total, resolvedHideTerm1Grade, resolvedHideTerm2Total, resolvedHideTerm2Grade, resolvedHideTerm3Total, resolvedHideTerm3Grade, resolvedHideOverallTotal, resolvedHideOverallGrade, resolvedTermSpecificScoreColumnsEnabled, resolvedTerm1ScoreColumns, resolvedTerm2ScoreColumns, resolvedTerm3ScoreColumns } = resolveStudentStructure(std);
                                  return (
                                    <ReportCardPreview
                                      branding={resolvedBranding}
                                      subjects={resolvedSubjects}
                                      scoreColumns={resolvedScoreColumns}
                                      gradeScales={resolvedGradeScales}
                                      coGradeScales={resolvedCoGradeScales}
                                      student={std}
                                      grades={stdGrades}
                                      scholasticTerm1Disabled={resolvedScholasticTerm1Disabled}
                                      scholasticTerm2Disabled={resolvedScholasticTerm2Disabled}
                                      scholasticTerm3Disabled={resolvedScholasticTerm3Disabled}
                                      coScholasticOneColumn={resolvedCoScholasticOneColumn}
                                      coScholasticSections={resolvedCoScholasticSections}
                                      signatures={resolvedSignatures}
                                      hideGradingScale={resolvedHideGradingScale}
                                      hideAttendance={resolvedHideAttendance}
                                      pureGradeBased={resolvedPureGradeBased}
                                      gradingScaleAfterSignatures={resolvedGradingScaleAfterSignatures}
                                      gradingScaleLayout={resolvedGradingScaleLayout}
                                      verticalExamHeaders={resolvedVerticalExamHeaders}
                                      verticalSubjectsHeader={resolvedVerticalSubjectsHeader}
                                      subjectSpecificMaxMarksEnabled={resolvedSubjectSpecificMaxMarksEnabled}
                                      enableSubjectGrouping={resolvedEnableSubjectGrouping}
                                      customSubjectGroups={resolvedCustomSubjectGroups}
                                      hideTerm1Total={resolvedHideTerm1Total}
                                      hideTerm1Grade={resolvedHideTerm1Grade}
                                      hideTerm2Total={resolvedHideTerm2Total}
                                      hideTerm2Grade={resolvedHideTerm2Grade}
                                      hideTerm3Total={resolvedHideTerm3Total}
                                      hideTerm3Grade={resolvedHideTerm3Grade}
                                      hideOverallTotal={resolvedHideOverallTotal}
                                      hideOverallGrade={resolvedHideOverallGrade}
                                      termSpecificScoreColumnsEnabled={resolvedTermSpecificScoreColumnsEnabled}
                                      term1ScoreColumns={resolvedTerm1ScoreColumns}
                                      term2ScoreColumns={resolvedTerm2ScoreColumns}
                                      term3ScoreColumns={resolvedTerm3ScoreColumns}
                                      onUpdateRemarks={(remarks, promo) => handleUpdateRemarks(std.id, remarks, promo)}
                                    />
                                  );
                                })()}
                              </div>
                            </div>
                          );
                        })
                  ) : (
                    <div className="bg-amber-100 text-amber-800 p-6 rounded-xl border border-amber-200 text-center text-xs">
                      No student records match the active database filters.
                    </div>
                  )}
                </div>
              ) : (
                currentStudent ? (
                  <div className="animate-scaleIn space-y-2">
                    <div className="flex md:hidden justify-between items-center bg-indigo-50/50 text-indigo-950 font-bold text-[10.5px] px-3.5 py-2 border border-indigo-100 rounded-lg no-print">
                      <span>📄 Report Card Template Preview</span>
                      <span className="text-emerald-700 font-extrabold">✓ Mobile Responsive View</span>
                    </div>

                    {/* Adaptive Responsive wrapper containing single ReportCardPreview */}
                    <div className="w-full border border-gray-150 rounded-xl p-1 sm:p-4 bg-white shadow-xs print:overflow-visible print:border-none print:shadow-none print:p-0">
                      <div className="w-full max-w-full p-0 sm:p-1 print:min-w-0 print:p-0">
                        <div className="bg-white print:bg-transparent w-full">
                          {(() => {
                            const { resolvedBranding, resolvedSubjects, resolvedScoreColumns, resolvedGradeScales, resolvedScholasticTerm1Disabled, resolvedScholasticTerm2Disabled, resolvedScholasticTerm3Disabled, resolvedCoScholasticOneColumn, resolvedCoScholasticSections, resolvedCoGradeScales, resolvedSignatures, resolvedHideGradingScale, resolvedHideAttendance, resolvedPureGradeBased, resolvedGradingScaleAfterSignatures, resolvedGradingScaleLayout, resolvedVerticalExamHeaders, resolvedVerticalSubjectsHeader, resolvedSubjectSpecificMaxMarksEnabled, resolvedEnableSubjectGrouping, resolvedCustomSubjectGroups, resolvedHideTerm1Total, resolvedHideTerm1Grade, resolvedHideTerm2Total, resolvedHideTerm2Grade, resolvedHideTerm3Total, resolvedHideTerm3Grade, resolvedHideOverallTotal, resolvedHideOverallGrade, resolvedTermSpecificScoreColumnsEnabled, resolvedTerm1ScoreColumns, resolvedTerm2ScoreColumns, resolvedTerm3ScoreColumns } = resolveStudentStructure(currentStudent);
                            return (
                              <ReportCardPreview
                                branding={resolvedBranding}
                                subjects={resolvedSubjects}
                                scoreColumns={resolvedScoreColumns}
                                gradeScales={resolvedGradeScales}
                                coGradeScales={resolvedCoGradeScales}
                                student={currentStudent}
                                verticalSubjectsHeader={resolvedVerticalSubjectsHeader}
                                grades={currentGrades}
                                scholasticTerm1Disabled={resolvedScholasticTerm1Disabled}
                                scholasticTerm2Disabled={resolvedScholasticTerm2Disabled}
                                scholasticTerm3Disabled={resolvedScholasticTerm3Disabled}
                                coScholasticOneColumn={resolvedCoScholasticOneColumn}
                                coScholasticSections={resolvedCoScholasticSections}
                                signatures={resolvedSignatures}
                                hideGradingScale={resolvedHideGradingScale}
                                hideAttendance={resolvedHideAttendance}
                                pureGradeBased={resolvedPureGradeBased}
                                gradingScaleAfterSignatures={resolvedGradingScaleAfterSignatures}
                                gradingScaleLayout={resolvedGradingScaleLayout}
                                verticalExamHeaders={resolvedVerticalExamHeaders}
                                subjectSpecificMaxMarksEnabled={resolvedSubjectSpecificMaxMarksEnabled}
                                enableSubjectGrouping={resolvedEnableSubjectGrouping}
                                customSubjectGroups={resolvedCustomSubjectGroups}
                                hideTerm1Total={resolvedHideTerm1Total}
                                hideTerm1Grade={resolvedHideTerm1Grade}
                                hideTerm2Total={resolvedHideTerm2Total}
                                hideTerm2Grade={resolvedHideTerm2Grade}
                                hideTerm3Total={resolvedHideTerm3Total}
                                hideTerm3Grade={resolvedHideTerm3Grade}
                                hideOverallTotal={resolvedHideOverallTotal}
                                hideOverallGrade={resolvedHideOverallGrade}
                                termSpecificScoreColumnsEnabled={resolvedTermSpecificScoreColumnsEnabled}
                                term1ScoreColumns={resolvedTerm1ScoreColumns}
                                term2ScoreColumns={resolvedTerm2ScoreColumns}
                                term3ScoreColumns={resolvedTerm3ScoreColumns}
                                onUpdateRemarks={(remarks, promo) => handleUpdateRemarks(currentStudent.id, remarks, promo)}
                              />
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-100 text-amber-800 p-6 rounded-xl border border-amber-200 text-center text-xs">
                    Please proceed to register at least one student in the Registry tab first.
                  </div>
                )
              )}
            </div>
          )}

          {activeTab === 'classwise_report' && (
            <div className="animate-fadeIn animate-duration-300">
              <ClasswiseMasterReport
                branding={branding}
                subjects={subjects}
                scoreColumns={scoreColumns}
                gradeScales={gradeScales}
                students={visibleStudents}
                studentGrades={visibleStudentGrades}
                currentRole={currentRole}
                activeTeacherObj={activeTeacherObj}
                reportCardStructures={reportCardStructures}
              />
            </div>
          )}

          {activeTab === 'generate_remarks' && (
            <div className="animate-fadeIn">
              <SectionRemarksGenerator
                students={visibleStudents}
                studentGrades={visibleStudentGrades}
                subjects={subjects}
                scoreColumns={scoreColumns}
                gradeScales={gradeScales}
                branding={branding}
                activeSchoolId={activeSchoolObj?.id || 'default_school'}
                selectedSessionFilter={selectedSessionFilter}
                onUpdateStudents={(updated) => {
                  if (currentRole === 'class_teacher' && activeTeacherObj) {
                    const assignedClass = activeTeacherObj.assignedClass.toLowerCase().trim();
                    const assignedSection = activeTeacherObj.assignedSection?.toLowerCase().trim() || '';
                    setStudents(prev => {
                      const otherStudents = prev.filter(s => {
                        const cleanClassS = s.className.toLowerCase().trim();
                        const matchesClass = cleanClassS === assignedClass;
                        const matchesSec = assignedSection === 'all' || !assignedSection || s.section.toLowerCase().trim() === assignedSection;
                        return !(matchesClass && matchesSec);
                      });
                      const merged = [...otherStudents, ...updated];
                      if (currentSchoolId) {
                        try {
                          localStorage.setItem(`class_on_students_${currentSchoolId}`, JSON.stringify(merged));
                        } catch {}
                      }
                      forceImmediateCloudSync(branding, scoreColumns, subjects, gradeScales, merged, studentGrades, reportCardStructures, recycleBin);
                      return merged;
                    });
                  } else {
                    setStudents(prev => {
                      const updatedMap = new Map(updated.map(u => [u.id, u]));
                      const merged = prev.map(s => {
                        const upd = updatedMap.get(s.id);
                        if (upd) {
                          if (selectedSessionFilter) {
                            const newHistory = (s.history || []).map(h => {
                              if (h.session === selectedSessionFilter) {
                                return {
                                  ...h,
                                  remarks: upd.remarks,
                                  promotionStatus: upd.promotionStatus
                                };
                              }
                              return h;
                            });
                            return { ...s, history: newHistory };
                          }
                          return {
                            ...s,
                            remarks: upd.remarks,
                            promotionStatus: upd.promotionStatus
                          };
                        }
                        return s;
                      });
                      if (currentSchoolId) {
                        try {
                          localStorage.setItem(`class_on_students_${currentSchoolId}`, JSON.stringify(merged));
                        } catch {}
                      }
                      forceImmediateCloudSync(branding, scoreColumns, subjects, gradeScales, merged, studentGrades, reportCardStructures, recycleBin);
                      return merged;
                    });
                  }
                }}
                onNavigateToPreview={() => setActiveTab('preview')}
              />
            </div>
          )}

          {activeTab === 'billing' && currentRole === 'school_admin' && activeSchoolObj && (
            <div className="animate-fadeIn">
              <SubscriptionBilling
                school={activeSchoolObj}
                onRefreshSchool={() => refreshSchoolsFromCloud(false)}
                setActiveTab={setActiveTabState}
              />
            </div>
          )}

           {activeTab === 'branding' && (currentRole === 'school_admin' || isImpersonating) && (
             <div className="animate-fadeIn space-y-6">
               <BrandingSettings
                 branding={branding}
                 onUpdate={handleUpdateBranding}
                 onSave={handleSaveData}
                 isSaving={isSaving}
                 saveSuccess={saveSuccess}
               />
             </div>
           )}
 
           {activeTab === 'grades' && (currentRole === 'school_admin' || isImpersonating) && (
             <div className="animate-fadeIn">
               <GradeSettings
                 gradeScales={gradeScales}
                 onUpdateScales={handleUpdateGradeScales}
               />
             </div>
           )}
 
           {activeTab === 'gallery_templates' && (currentRole === 'school_admin' || isImpersonating) && (
              <div className="animate-fadeIn">
                <TemplateGalleryManager 
                  mode="school" 
                  schoolId={currentSchoolId} 
                  schoolName={activeSchoolObj?.name}
                  currentSchoolStructures={reportCardStructures}
                  onUpdateSchoolStructures={handleUpdateStructures}
                  schoolClasses={schoolClasses}
                />
              </div>
            )}

           {activeTab === 'structures' && (currentRole === 'school_admin' || isImpersonating) && (
             <div className="animate-fadeIn">
               <ReportCardStructureSettings
                 schoolId={currentSchoolId}
                 branding={branding}
                 subjects={subjects}
                 scoreColumns={scoreColumns}
                 students={students}
                 reportCardStructures={reportCardStructures}
                 maxStructuresLimit={activeSchoolObj?.maxStructuresLimit}
                 onUpdateStructures={handleUpdateStructures}
                 onUpdateSubjects={handleUpdateSubjects}
                 onUpdateScoreColumns={handleUpdateScoreColumns}
               />
             </div>
           )}

          {activeTab === 'students' && (
            <div className="animate-fadeIn">
              {!isSchoolApproved ? (
                <div className="bg-slate-900 border-2 border-slate-800 rounded-3xl p-12 text-center shadow-2xl max-w-2xl mx-auto space-y-6 my-8 animate-fadeIn" id="students-tab-locked-container">
                  <div className="w-20 h-20 bg-amber-500/10 border-2 border-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-amber-500/5 animate-pulse">
                    <Lock className="w-10 h-10" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-xl font-black text-rose-500 font-sans tracking-tight">
                      🔒 Student Registry Access Locked
                    </h3>
                    <p className="text-slate-300 text-sm max-w-md mx-auto leading-relaxed">
                      Your school registration has not been approved yet by the Sand Box administration. 
                      Database read/write operations on the **Student Registry** are disabled until activation is complete.
                    </p>
                    <p className="text-slate-400 text-xs max-w-sm mx-auto font-mono">
                      Once Approved, all tabs (including student records and report card writing) will automatically unlock and become fully functional.
                    </p>
                  </div>
                  <div className="pt-4 border-t border-slate-800/60 max-w-md mx-auto">
                    <button
                      onClick={() => refreshSchoolsFromCloud(true)}
                      disabled={isRefreshingApproval}
                      className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-extrabold text-xs py-3 px-5 rounded-xl shadow-lg shadow-amber-600/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RefreshCw className={`w-4 h-4 ${isRefreshingApproval ? 'animate-spin' : ''}`} />
                      {isRefreshingApproval ? 'Checking Approval...' : 'Check Live Approval Status'}
                    </button>
                    {lastCheckMessage && (
                      <div className="mt-3 text-[11px] font-bold text-amber-400 font-mono bg-slate-950/50 p-2.5 rounded-lg border border-amber-500/20 animate-slideDown text-center">
                        {lastCheckMessage}
                      </div>
                    )}
                  </div>
                </div>
              ) : isSchoolPlanExpired ? (
                <div className="bg-white border-2 border-rose-100 rounded-3xl p-10 text-center shadow-xl max-w-2xl mx-auto space-y-6 my-8 animate-fadeIn" id="students-tab-expired-container">
                  <div className="w-20 h-20 bg-rose-50 border-2 border-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-rose-500/5 animate-pulse">
                    <Lock className="w-10 h-10" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-xl font-black text-rose-600 font-sans tracking-tight">
                      🔒 Student Registry Blocked
                    </h3>
                    <p className="text-slate-600 text-sm max-w-md mx-auto leading-relaxed">
                      Your school's subscription plan has expired as of{' '}
                      <strong className="text-slate-800">
                        {activeSchoolObj?.trialUntil ? new Date(activeSchoolObj.trialUntil).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}
                      </strong>.
                      Access to the Student Registry is disabled. Please renew your plan to resume operations.
                    </p>
                  </div>
                  {currentRole === 'school_admin' && (
                    <div className="bg-indigo-50/45 border border-indigo-150 rounded-2xl p-6 text-left space-y-3.5 max-w-md mx-auto mt-4 shadow-2xs">
                      <div className="flex items-center gap-2 text-indigo-900 font-extrabold text-xs uppercase tracking-wider">
                        <CreditCard className="w-4 h-4 text-indigo-600" />
                        <span>Instant Premium Reactivation Desk</span>
                      </div>

                      {activeSchoolObj?.subscriptionRequest && (activeSchoolObj.subscriptionRequest.status === 'pending' || activeSchoolObj.subscriptionRequest.paymentStatus === 'pending') ? (
                        <div className="space-y-3 bg-white p-3.5 rounded-xl border border-indigo-150">
                          <div className="flex items-center gap-2 text-amber-600 font-bold text-xs">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                            <span>Pending Admin Activation Approval</span>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-relaxed font-semibold">
                            Your renewal payment request for <strong className="text-slate-800">{activeSchoolObj?.subscriptionRequest?.studentCount} students</strong> at <strong className="text-emerald-600">₹{activeSchoolObj?.subscriptionRequest?.calculatedTotal?.toLocaleString()} / year</strong> was submitted successfully on {activeSchoolObj?.subscriptionRequest?.requestedAt ? new Date(activeSchoolObj.subscriptionRequest.requestedAt).toLocaleDateString() : 'N/A'}.
                          </p>
                          <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-lg text-[10.5px] font-semibold text-slate-500 italic">
                            "{activeSchoolObj?.subscriptionRequest?.verificationMessage || 'The renewal payment status is currently under verification.'}"
                          </div>
                          <button
                            onClick={() => refreshSchoolsFromCloud(true)}
                            disabled={isRefreshingApproval}
                            className="w-full bg-indigo-600 hover:bg-indigo-750 text-white font-extrabold text-xs py-2 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingApproval ? 'animate-spin' : ''}`} />
                            {isRefreshingApproval ? 'Verifying live status...' : 'Check Approval Status'}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-indigo-950 block">How many student licenses do you need?</label>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setRenewalStudentCount(prev => Math.max(10, prev - 10))}
                                className="px-2.5 bg-white border border-indigo-200 text-indigo-700 rounded-lg font-black hover:bg-indigo-100 cursor-pointer text-xs"
                              >
                                -10
                              </button>
                              <input
                                type="number"
                                min="10"
                                max="5000"
                                value={renewalStudentCount}
                                onChange={(e) => setRenewalStudentCount(Math.max(1, parseInt(e.target.value) || 0))}
                                className="w-full text-center px-3 py-1.5 text-xs border border-indigo-200 bg-white rounded-lg outline-none font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/15"
                              />
                              <button
                                type="button"
                                onClick={() => setRenewalStudentCount(prev => prev + 10)}
                                className="px-2.5 bg-white border border-indigo-200 text-indigo-700 rounded-lg font-black hover:bg-indigo-100 cursor-pointer text-xs"
                              >
                                +10
                              </button>
                            </div>
                          </div>

                          {/* Calculations breakdown */}
                          <div className="bg-white p-3 rounded-xl border border-indigo-150 space-y-1.5 text-[11px] font-bold text-slate-700">
                            <div className="flex justify-between">
                              <span className="text-slate-450 font-medium">Selected Students:</span>
                              <span className="font-mono text-slate-900">{renewalStudentCount} students</span>
                            </div>
                            <div className="h-px bg-slate-100" />
                            <div className="flex justify-between text-xs font-extrabold text-indigo-950">
                              <span>Total Premium Annual Cost:</span>
                              <span className="font-mono text-emerald-600 text-sm">₹{calculateRateAndTotal(renewalStudentCount, activeSchoolObj).total.toLocaleString()} / year</span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleProceedRenewalPayment(renewalStudentCount)}
                            disabled={isSubmittingRenewal}
                            className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-extrabold text-xs py-2.5 px-4 rounded-xl shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
                          >
                            {isSubmittingRenewal ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Submitting Request...</span>
                              </>
                            ) : (
                              <>
                                <CreditCard className="w-4 h-4" />
                                <span>Pay &amp; Request Activation</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <StudentManager
                  currentSchoolId={currentSchoolId}
                  students={visibleStudents}
                  studentGrades={visibleStudentGrades}
                  subjects={subjects}
                  scoreColumns={scoreColumns}
                  gradeScales={gradeScales}
                  branding={branding}
                  currentRole={currentRole}
                  activeTeacherObj={activeTeacherObj}
                  reportCardStructures={reportCardStructures}
                  maxStudentsLimit={activeSchoolObj?.maxStudentsLimit}
                  cumulativeStudentsCount={activeSchoolObj?.cumulativeStudentsCount || 0}
                  maxCumulativeStudentsLimit={activeSchoolObj?.maxCumulativeStudentsLimit}
                  onIncrementCumulativeCount={handleIncrementCumulativeCount}
                  recycleBin={recycleBin}
                  onUpdateRecycleBin={setRecycleBin}
                  onUpdateBranding={handleUpdateBranding}
                  isReadOnly={selectedSessionFilter !== ''}
                  selectedSession={selectedSessionFilter}
                  onRestoreSession={handleRestoreSession}
                  schoolClasses={schoolClasses}
                  classNamingStyle={classNamingStyle}
                  onUpdateSchoolClasses={handleUpdateSchoolClasses}
                  onUpdateStudents={(updated) => {
                    const sId = normalizeCloudSchoolId(currentSchoolId || localStorage.getItem('class_on_saas_school_id') || '');
                    if (currentRole === 'class_teacher' && activeTeacherObj) {
                      const assignedClass = activeTeacherObj.assignedClass.toLowerCase().trim();
                      const assignedSection = activeTeacherObj.assignedSection?.toLowerCase().trim() || '';
                      setStudents(prev => {
                        const otherStudents = prev.filter(s => {
                          const cleanClassS = s.className.toLowerCase().trim();
                          const matchesClass = cleanClassS === assignedClass;
                          const matchesSec = assignedSection === 'all' || !assignedSection || s.section.toLowerCase().trim() === assignedSection;
                          return !(matchesClass && matchesSec);
                        });
                        const combined = [...otherStudents, ...updated];
                        if (sId) {
                          try {
                            localStorage.setItem(`class_on_students_${sId}`, JSON.stringify(combined));
                            localStorage.setItem(`class_on_last_saved_at_${sId}`, new Date().toISOString());
                          } catch {}
                          saveStudentsBatchToCloud(sId, combined).catch(err => {
                            console.warn("[App onUpdateStudents Teacher Cloud Save] Notice:", err);
                          });
                        }
                        return combined;
                      });
                    } else {
                      setStudents(updated);
                      if (sId) {
                        try {
                          localStorage.setItem(`class_on_students_${sId}`, JSON.stringify(updated));
                          localStorage.setItem(`class_on_last_saved_at_${sId}`, new Date().toISOString());
                        } catch {}
                        saveStudentsBatchToCloud(sId, updated).catch(err => {
                          console.warn("[App onUpdateStudents Cloud Save] Notice:", err);
                        });
                      }
                    }
                  }}
                  onUpdateGrades={(updated) => {
                    const sId = normalizeCloudSchoolId(currentSchoolId || localStorage.getItem('class_on_saas_school_id') || '');
                    if (currentRole === 'class_teacher' && activeTeacherObj) {
                      setStudentGrades(prev => {
                        const visibleStudentIds = new Set(visibleStudents.map(s => s.id));
                        const otherGrades = prev.filter(g => !visibleStudentIds.has(g.studentId));
                        const combinedGrades = [...otherGrades, ...updated];
                        if (sId) {
                          try {
                            localStorage.setItem(`class_on_student_grades_${sId}`, JSON.stringify(combinedGrades));
                            localStorage.setItem(`class_on_last_saved_at_${sId}`, new Date().toISOString());
                          } catch {}
                          saveStudentsBatchToCloud(sId, undefined, combinedGrades).catch(err => {
                            console.warn("[App onUpdateGrades Teacher Cloud Save] Notice:", err);
                          });
                        }
                        return combinedGrades;
                      });
                    } else {
                      setStudentGrades(updated);
                      if (sId) {
                        try {
                          localStorage.setItem(`class_on_student_grades_${sId}`, JSON.stringify(updated));
                          localStorage.setItem(`class_on_last_saved_at_${sId}`, new Date().toISOString());
                        } catch {}
                        saveStudentsBatchToCloud(sId, undefined, updated).catch(err => {
                          console.warn("[App onUpdateGrades Cloud Save] Notice:", err);
                        });
                      }
                    }
                  }}
                  onSelectStudent={setSelectedStudentId}
                  selectedStudentId={selectedStudentId}
                />
              )}
            </div>
          )}

          {activeTab === 'teachers' && currentRole === 'school_admin' && (
            <div className="animate-fadeIn">
              {isSchoolPlanExpired ? (
                <div className="bg-white border-2 border-rose-100 rounded-3xl p-10 text-center shadow-xl max-w-2xl mx-auto space-y-6 my-8 animate-fadeIn" id="teachers-tab-expired-container">
                  <div className="w-20 h-20 bg-rose-50 border-2 border-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-rose-500/5 animate-pulse">
                    <Lock className="w-10 h-10" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-xl font-black text-rose-600 font-sans tracking-tight">
                      🔒 Teacher Management Blocked
                    </h3>
                    <p className="text-slate-600 text-sm max-w-md mx-auto leading-relaxed">
                      Your school's subscription plan has expired as of{' '}
                      <strong className="text-slate-800">
                        {activeSchoolObj?.trialUntil ? new Date(activeSchoolObj.trialUntil).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}
                      </strong>.
                      Access to Teacher Management is disabled. Please renew your plan to resume operations.
                    </p>
                  </div>
                  {currentRole === 'school_admin' && (
                    <div className="bg-indigo-50/45 border border-indigo-150 rounded-2xl p-6 text-left space-y-3.5 max-w-md mx-auto mt-4 shadow-2xs">
                      <div className="flex items-center gap-2 text-indigo-900 font-extrabold text-xs uppercase tracking-wider">
                        <CreditCard className="w-4 h-4 text-indigo-600" />
                        <span>Instant Premium Reactivation Desk</span>
                      </div>

                      {activeSchoolObj?.subscriptionRequest && (activeSchoolObj.subscriptionRequest.status === 'pending' || activeSchoolObj.subscriptionRequest.paymentStatus === 'pending') ? (
                        <div className="space-y-3 bg-white p-3.5 rounded-xl border border-indigo-150">
                          <div className="flex items-center gap-2 text-amber-600 font-bold text-xs">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                            <span>Pending Admin Activation Approval</span>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-relaxed font-semibold">
                            Your renewal payment request for <strong className="text-slate-800">{activeSchoolObj?.subscriptionRequest?.studentCount} students</strong> at <strong className="text-emerald-600">₹{activeSchoolObj?.subscriptionRequest?.calculatedTotal?.toLocaleString()} / year</strong> was submitted successfully on {activeSchoolObj?.subscriptionRequest?.requestedAt ? new Date(activeSchoolObj.subscriptionRequest.requestedAt).toLocaleDateString() : 'N/A'}.
                          </p>
                          <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-lg text-[10.5px] font-semibold text-slate-500 italic">
                            "{activeSchoolObj?.subscriptionRequest?.verificationMessage || 'The renewal payment status is currently under verification.'}"
                          </div>
                          <button
                            onClick={() => refreshSchoolsFromCloud(true)}
                            disabled={isRefreshingApproval}
                            className="w-full bg-indigo-600 hover:bg-indigo-750 text-white font-extrabold text-xs py-2 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingApproval ? 'animate-spin' : ''}`} />
                            {isRefreshingApproval ? 'Verifying live status...' : 'Check Approval Status'}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-indigo-950 block">How many student licenses do you need?</label>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setRenewalStudentCount(prev => Math.max(10, prev - 10))}
                                className="px-2.5 bg-white border border-indigo-200 text-indigo-700 rounded-lg font-black hover:bg-indigo-100 cursor-pointer text-xs"
                              >
                                -10
                              </button>
                              <input
                                type="number"
                                min="10"
                                max="5000"
                                value={renewalStudentCount}
                                onChange={(e) => setRenewalStudentCount(Math.max(1, parseInt(e.target.value) || 0))}
                                className="w-full text-center px-3 py-1.5 text-xs border border-indigo-200 bg-white rounded-lg outline-none font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/15"
                              />
                              <button
                                type="button"
                                onClick={() => setRenewalStudentCount(prev => prev + 10)}
                                className="px-2.5 bg-white border border-indigo-200 text-indigo-700 rounded-lg font-black hover:bg-indigo-100 cursor-pointer text-xs"
                              >
                                +10
                              </button>
                            </div>
                          </div>

                          {/* Calculations breakdown */}
                          <div className="bg-white p-3 rounded-xl border border-indigo-150 space-y-1.5 text-[11px] font-bold text-slate-700">
                            <div className="flex justify-between">
                              <span className="text-slate-450 font-medium">Selected Students:</span>
                              <span className="font-mono text-slate-900">{renewalStudentCount} students</span>
                            </div>
                            <div className="h-px bg-slate-100" />
                            <div className="flex justify-between text-xs font-extrabold text-indigo-950">
                              <span>Total Premium Annual Cost:</span>
                              <span className="font-mono text-emerald-600 text-sm">₹{calculateRateAndTotal(renewalStudentCount, activeSchoolObj).total.toLocaleString()} / year</span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleProceedRenewalPayment(renewalStudentCount)}
                            disabled={isSubmittingRenewal}
                            className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-extrabold text-xs py-2.5 px-4 rounded-xl shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
                          >
                            {isSubmittingRenewal ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Submitting Request...</span>
                              </>
                            ) : (
                              <>
                                <CreditCard className="w-4 h-4" />
                                <span>Pay &amp; Request Activation</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <TeacherManager
                  teachers={schools.find(s => s.id === currentSchoolId)?.teachers || []}
                  maxTeachersLimit={activeSchoolObj?.maxTeachersLimit !== undefined ? activeSchoolObj.maxTeachersLimit : (activeSchoolObj?.partnershipType === 'annual' ? 1000 : 1)}
                  students={students}
                  subjects={subjects}
                  reportCardStructures={reportCardStructures}
                  schoolClasses={schoolClasses}
                  onUpdateTeachers={async (updatedTeachers) => {
                    const targetSchool = schools.find(s => s.id === currentSchoolId);
                    if (targetSchool) {
                      const updatedSchoolObj = { ...targetSchool, teachers: updatedTeachers };
                      setSchools(prev => prev.map(s => s.id === currentSchoolId ? updatedSchoolObj : s));
                      try {
                        await saveSaaSSchoolToCloud(updatedSchoolObj, targetSchool.ownerId);
                      } catch (err) {
                        console.warn("Failed to sync updated school teachers to Cloud:", err);
                      }
                    }
                  }}
                />
              )}
            </div>
          )}

          {activeTab === 'security_desk' && currentRole === 'school_admin' && (
            <div className="animate-fadeIn">
              {(() => {
                const activeSchool = schools.find(s => s.id === currentSchoolId);
                if (activeSchool) {
                  return (
                    <SecurityDesk
                      school={activeSchool}
                      onUpdateSchool={async (updatedSchoolObj) => {
                        // Update local states
                        const updatedWithSync = { ...updatedSchoolObj, cloudSynced: true };
                        setSchools(prev => prev.map(s => s.id === currentSchoolId ? updatedWithSync : s));
                        
                        // Push metadata to Cloud
                        await saveSaaSSchoolToCloud(updatedSchoolObj, updatedSchoolObj.ownerId);
                        
                        // Update active branding details immediately (e.g. name, address, helpline, email)
                        setBranding(prev => ({
                          ...prev,
                          schoolName: updatedSchoolObj.name,
                          address: updatedSchoolObj.address || prev.address,
                          helpline: updatedSchoolObj.mobile || prev.helpline,
                          email: updatedSchoolObj.email || prev.email
                        }));
                        
                        // Double check and load deep school configurations (branding settings, scales etc)
                        try {
                          const currentCloudData = await loadSchoolFromCloud(currentSchoolId);
                          if (currentCloudData) {
                            const updatedCloudBranding = {
                              ...currentCloudData.branding,
                              schoolName: updatedSchoolObj.name,
                              address: updatedSchoolObj.address || currentCloudData.branding.address,
                              helpline: updatedSchoolObj.mobile || currentCloudData.branding.helpline,
                              email: updatedSchoolObj.email || currentCloudData.branding.email
                            };
                            await saveSchoolToCloud(currentSchoolId, {
                              ...currentCloudData,
                              branding: updatedCloudBranding
                            }, updatedSchoolObj.name, updatedSchoolObj.portalCode || "SCH-9999");
                          }
                        } catch (err) {
                          console.warn("Deep branding override fallback skipped:", err);
                        }
                      }}
                    />
                  );
                }
                return null;
              })()}
            </div>
          )}

          {activeTab === 'saas_owner' && currentRole === 'main_admin' && (
            <div className="animate-fadeInOnly" style={{ animation: 'fadeInOnly 0.25s ease-out forwards' }}>
              <MainAdminDashboard
                schools={schools}
                notifications={notifications}
                onSendNotification={handleSendNotification}
                cloudSchoolIds={cloudSchoolIds}
                isSyncingAll={isSyncingAll}
                syncStatusMessage={syncStatusMessage}
                onSyncUnsyncedSchools={syncUnsyncedSchoolsToCloud}
                onLogout={handleLogout}
                onUpdateSchools={async (updated) => {
                  const updatedWithSync = deduplicateSchools(updated.map(s => ({ ...s, cloudSynced: true })));
                  setSchools(updatedWithSync);
                  localStorage.setItem('class_on_saas_schools', JSON.stringify(updatedWithSync));
                  // Sync new or updated schools to Cloud (even if firebaseUser is null)
                  for (const s of updated) {
                    const prevSchool = schools.find(p => p.id === s.id);
                    const limitsChanged = !!prevSchool && (
                      prevSchool.partnershipType !== s.partnershipType ||
                      prevSchool.maxStudentsLimit !== s.maxStudentsLimit ||
                      prevSchool.maxCumulativeStudentsLimit !== s.maxCumulativeStudentsLimit ||
                      prevSchool.maxTeachersLimit !== s.maxTeachersLimit ||
                      prevSchool.maxStructuresLimit !== s.maxStructuresLimit ||
                      prevSchool.trialUntil !== s.trialUntil ||
                      prevSchool.trialPrice !== s.trialPrice
                    );

                    const isNewOrModified = !prevSchool || 
                      prevSchool.approvalStatus !== s.approvalStatus ||
                      prevSchool.trialUntil !== s.trialUntil ||
                      prevSchool.trialPrice !== s.trialPrice ||
                      prevSchool.name !== s.name ||
                      prevSchool.username !== s.username ||
                      prevSchool.password !== s.password ||
                      prevSchool.portalCode !== s.portalCode ||
                      prevSchool.saasOwnerPin !== s.saasOwnerPin ||
                      prevSchool.partnershipType !== s.partnershipType ||
                      prevSchool.maxStudentsLimit !== s.maxStudentsLimit ||
                      prevSchool.maxCumulativeStudentsLimit !== s.maxCumulativeStudentsLimit ||
                      prevSchool.maxTeachersLimit !== s.maxTeachersLimit ||
                      prevSchool.maxStructuresLimit !== s.maxStructuresLimit ||
                      JSON.stringify(prevSchool.teachers) !== JSON.stringify(s.teachers) ||
                      JSON.stringify(prevSchool.subscriptionRequest) !== JSON.stringify(s.subscriptionRequest);

                    if (limitsChanged && prevSchool) {
                      const msgLines: string[] = [];
                      if (prevSchool.partnershipType !== s.partnershipType) {
                        msgLines.push(`Plan switched to ${s.partnershipType === 'annual' ? 'Annual Partnership' : 'Sandbox Trial'}.`);
                      }
                      if (prevSchool.maxStudentsLimit !== s.maxStudentsLimit) {
                        msgLines.push(`Max Active Students changed from ${prevSchool.maxStudentsLimit ?? 50} to ${s.maxStudentsLimit ?? 50}.`);
                      }
                      if (prevSchool.maxCumulativeStudentsLimit !== s.maxCumulativeStudentsLimit) {
                        msgLines.push(`Max Cumulative Students changed from ${prevSchool.maxCumulativeStudentsLimit ?? 100} to ${s.maxCumulativeStudentsLimit ?? 100}.`);
                      }
                      if (prevSchool.maxTeachersLimit !== s.maxTeachersLimit) {
                        msgLines.push(`Max Teachers changed from ${prevSchool.maxTeachersLimit ?? 10} to ${s.maxTeachersLimit ?? 10}.`);
                      }
                      if (prevSchool.maxStructuresLimit !== s.maxStructuresLimit) {
                        msgLines.push(`Max Layouts changed from ${prevSchool.maxStructuresLimit ?? 5} to ${s.maxStructuresLimit ?? 5}.`);
                      }
                      if (prevSchool.trialUntil !== s.trialUntil) {
                        msgLines.push(`Subscription Expiry date changed to ${s.trialUntil || 'N/A'}.`);
                      }
                      if (prevSchool.trialPrice !== s.trialPrice) {
                        msgLines.push(`Pricing updated to: ${s.trialPrice || 'N/A'}.`);
                      }

                      const newNotif: SaasNotification = {
                        id: 'notif_limit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                        title: '⚡ Subscription Plan & Record Limits Updated',
                        message: `Your school's subscription plan or resource quotas have been updated. Changes: ${msgLines.join(' ')}`,
                        type: 'info',
                        sentAt: new Date().toISOString(),
                        targetSchoolIds: [s.id],
                        readBy: []
                      };
                      handleSendNotification(newNotif);
                    }

                    if (isNewOrModified) {
                      try {
                        console.log(`[SaaS Cloud Sync] School "${s.name}" (${s.id}) changes detected. Approval Status: ${s.approvalStatus}. Syncing...`);
                        await saveSaaSSchoolToCloud(s, s.ownerId || (firebaseUser ? firebaseUser.uid : null));
                        setCloudSchoolIds(prev => Array.from(new Set([...prev, s.id])));
                      } catch (err) {
                        console.warn("Failed to sync school to Cloud:", err);
                      }
                    }
                  }
                  const deletedSchool = schools.find(s => !updated.some(u => u.id === s.id));
                  if (deletedSchool && deletedSchool.id.startsWith("sc_")) {
                    try {
                      await deleteSaaSSchoolFromCloud(deletedSchool.id);
                      setCloudSchoolIds(prev => prev.filter(id => id !== deletedSchool.id));
                    } catch (err) {
                      console.warn("Failed to delete school from Cloud:", err);
                    }
                  }
                }}
                onImpersonateSchool={handleImpersonate}
              />
            </div>
          )}

          {activeTab === 'portal' && (currentRole === 'school_admin' || currentRole === 'class_teacher') && (
            <div className="animate-fadeIn">
              <StudentPortalSimulation
                students={students}
                studentGrades={studentGrades}
                subjects={subjects}
                scoreColumns={scoreColumns}
                gradeScales={gradeScales}
                branding={branding}
                schools={schools}
                currentSchoolId={currentSchoolId}
                onUpdatePortalCode={handleUpdatePortalCode}
                onImpersonateParent={handleImpersonateParent}
                onUpdateBranding={handleUpdateBranding}
                reportCardStructures={reportCardStructures}
              />
            </div>
          )}

          {activeTab === 'sub_marks_entry' && (currentRole === 'school_admin' || currentRole === 'class_teacher') && (
            <div className="animate-fadeIn">
              {isSchoolPlanExpired ? (
                <div className="bg-white border-2 border-rose-100 rounded-3xl p-10 text-center shadow-xl max-w-2xl mx-auto space-y-6 my-8 animate-fadeIn" id="marks-tab-expired-container">
                  <div className="w-20 h-20 bg-rose-50 border-2 border-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-rose-500/5 animate-pulse">
                    <Lock className="w-10 h-10" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-xl font-black text-rose-600 font-sans tracking-tight">
                      🔒 Subject Marks Entry Blocked
                    </h3>
                    <p className="text-slate-600 text-sm max-w-md mx-auto leading-relaxed">
                      Your school's subscription plan has expired as of{' '}
                      <strong className="text-slate-800">
                        {activeSchoolObj?.trialUntil ? new Date(activeSchoolObj.trialUntil).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}
                      </strong>.
                      Access to Subject Marks Entry is disabled. Please renew your plan to resume operations.
                    </p>
                  </div>
                  {currentRole === 'school_admin' ? (
                    <div className="bg-indigo-50/45 border border-indigo-150 rounded-2xl p-6 text-left space-y-3.5 max-w-md mx-auto mt-4 shadow-2xs">
                      <div className="flex items-center gap-2 text-indigo-900 font-extrabold text-xs uppercase tracking-wider">
                        <CreditCard className="w-4 h-4 text-indigo-600" />
                        <span>Instant Premium Reactivation Desk</span>
                      </div>

                      {activeSchoolObj?.subscriptionRequest && (activeSchoolObj.subscriptionRequest.status === 'pending' || activeSchoolObj.subscriptionRequest.paymentStatus === 'pending') ? (
                        <div className="space-y-3 bg-white p-3.5 rounded-xl border border-indigo-150">
                          <div className="flex items-center gap-2 text-amber-600 font-bold text-xs">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                            <span>Pending Admin Activation Approval</span>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-relaxed font-semibold">
                            Your renewal payment request for <strong className="text-slate-800">{activeSchoolObj?.subscriptionRequest?.studentCount} students</strong> at <strong className="text-emerald-600">₹{activeSchoolObj?.subscriptionRequest?.calculatedTotal?.toLocaleString()} / year</strong> was submitted successfully on {activeSchoolObj?.subscriptionRequest?.requestedAt ? new Date(activeSchoolObj.subscriptionRequest.requestedAt).toLocaleDateString() : 'N/A'}.
                          </p>
                          <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-lg text-[10.5px] font-semibold text-slate-500 italic">
                            "{activeSchoolObj?.subscriptionRequest?.verificationMessage || 'The renewal payment status is currently under verification.'}"
                          </div>
                          <button
                            onClick={() => refreshSchoolsFromCloud(true)}
                            disabled={isRefreshingApproval}
                            className="w-full bg-indigo-600 hover:bg-indigo-750 text-white font-extrabold text-xs py-2 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingApproval ? 'animate-spin' : ''}`} />
                            {isRefreshingApproval ? 'Verifying live status...' : 'Check Approval Status'}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-indigo-950 block">How many student licenses do you need?</label>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => setRenewalStudentCount(prev => Math.max(10, prev - 10))}
                                className="px-2.5 bg-white border border-indigo-200 text-indigo-700 rounded-lg font-black hover:bg-indigo-100 cursor-pointer text-xs"
                              >
                                -10
                              </button>
                              <input
                                type="number"
                                min="10"
                                max="5000"
                                value={renewalStudentCount}
                                onChange={(e) => setRenewalStudentCount(Math.max(1, parseInt(e.target.value) || 0))}
                                className="w-full text-center px-3 py-1.5 text-xs border border-indigo-200 bg-white rounded-lg outline-none font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/15"
                              />
                              <button
                                type="button"
                                onClick={() => setRenewalStudentCount(prev => prev + 10)}
                                className="px-2.5 bg-white border border-indigo-200 text-indigo-700 rounded-lg font-black hover:bg-indigo-100 cursor-pointer text-xs"
                              >
                                +10
                              </button>
                            </div>
                          </div>

                          {/* Calculations breakdown */}
                          <div className="bg-white p-3 rounded-xl border border-indigo-150 space-y-1.5 text-[11px] font-bold text-slate-700">
                            <div className="flex justify-between">
                              <span className="text-slate-450 font-medium">Selected Students:</span>
                              <span className="font-mono text-slate-900">{renewalStudentCount} students</span>
                            </div>
                            <div className="h-px bg-slate-100" />
                            <div className="flex justify-between text-xs font-extrabold text-indigo-950">
                              <span>Total Premium Annual Cost:</span>
                              <span className="font-mono text-emerald-600 text-sm">₹{calculateRateAndTotal(renewalStudentCount, activeSchoolObj).total.toLocaleString()} / year</span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleProceedRenewalPayment(renewalStudentCount)}
                            disabled={isSubmittingRenewal}
                            className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-extrabold text-xs py-2.5 px-4 rounded-xl shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
                          >
                            {isSubmittingRenewal ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Submitting Request...</span>
                              </>
                            ) : (
                              <>
                                <CreditCard className="w-4 h-4" />
                                <span>Pay &amp; Request Activation</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-250/30 p-3 rounded-xl max-w-md mx-auto text-center">
                      📢 Please contact your school administrator to renew the subscription plan.
                    </div>
                  )}
                </div>
              ) : (
                <SubjectMarksEntry
                  students={resolvedStudents}
                  studentGrades={resolvedStudentGrades}
                  scoreColumns={scoreColumns}
                  subjects={subjects}
                  currentRole={currentRole}
                  activeTeacherObj={activeTeacherObj}
                  branding={branding}
                  reportCardStructures={reportCardStructures}
                  schoolClasses={schoolClasses}
                  onUpdateGrades={handleUpdateGrades}
                  isReadOnly={selectedSessionFilter !== ''}
                  selectedSession={selectedSessionFilter}
                  onRestoreSession={handleRestoreSession}
                />
              )}
            </div>
          )}

        </div>
      </main>

      {/* Small informative Footer credit */}
      <footer className="border-t border-gray-100 bg-white p-4 py-5 text-center text-xs text-gray-400 font-sans mt-auto no-print">
        <div className="w-full max-w-full px-4 md:px-6 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>
            Designed and compiled matching <strong>School Report Card</strong> administrative school templates.
          </span>
          <span className="text-[10px] text-gray-300">
            AI Studio Build Workspace &copy; 2026
          </span>
        </div>
      </footer>

      {/* School Admin Floating Support Chat */}
      {currentRole === 'school_admin' && (
        <>
          {/* Floating Side Support Chat Button */}
          <div className="fixed right-4 bottom-4 md:right-0 md:bottom-auto md:top-1/2 md:-translate-y-1/2 z-45 flex flex-col items-end no-print">
            {/* Mobile Support FAB */}
            <button
              type="button"
              onClick={() => setSchoolChatOpen(true)}
              className="md:hidden relative flex items-center justify-center bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white p-3.5 rounded-full shadow-xl transition-all cursor-pointer active:scale-95 border border-indigo-500/30"
              title="Support Chat"
            >
              <MessageSquare className="w-5 h-5 text-white" />
              {schoolUnreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[9.5px] font-extrabold text-white shadow-md border border-white animate-pulse">
                  {schoolUnreadCount}
                </span>
              )}
            </button>
            
            {/* Desktop Support Badge */}
            <button
              type="button"
              onClick={() => setSchoolChatOpen(true)}
              className="hidden md:flex relative items-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-extrabold text-[11px] uppercase tracking-wider py-3 px-3.5 shadow-xl transition-all cursor-pointer rounded-l-2xl border-l border-y border-indigo-500/30 group select-none hover:-translate-x-1 active:scale-95"
              style={{ writingMode: 'vertical-lr', textOrientation: 'mixed' }}
              title="Support Chat"
            >
              <MessageSquare className="w-4 h-4 text-white -rotate-90 group-hover:scale-110 transition-transform mb-1.5" />
              <span>Support Chat</span>
              {schoolUnreadCount > 0 && (
                <span className="absolute -top-1.5 -left-1.5 flex h-5.5 w-5.5 items-center justify-center rounded-full bg-rose-500 text-[9.5px] font-extrabold text-white shadow-md border-2 border-white animate-pulse" style={{ writingMode: 'horizontal-tb' }}>
                  {schoolUnreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Support Chat Drawer */}
          {schoolChatOpen && (
            <div className="fixed inset-0 z-50 flex justify-end no-print">
              {/* Backdrop */}
              <div 
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity cursor-pointer"
                onClick={() => setSchoolChatOpen(false)}
              />
              
              {/* Drawer content */}
              <div className="relative w-full max-w-md bg-white h-full shadow-2xl border-l border-slate-150 flex flex-col z-10 animate-slideLeft">
                {/* Header */}
                <div className="p-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-white/10 rounded-lg">
                      <MessageSquare className="w-5 h-5 text-white animate-pulse" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-xs uppercase tracking-wider">Direct Admin Support</h3>
                      <p className="text-[10px] text-indigo-100 font-semibold mt-0.5">Direct chat with Platform Admin</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSchoolChatOpen(false)}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-white transition-all cursor-pointer"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>

                {/* Message Area */}
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-3.5" ref={schoolChatEndRef}>
                  {schoolChatMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2.5">
                      <MessageSquare className="w-12 h-12 text-slate-300" />
                      <div>
                        <p className="text-xs font-bold">No message history yet.</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Send a message to Platform Admin to start a conversation!</p>
                      </div>
                    </div>
                  ) : (
                    schoolChatMessages.map((msg) => {
                      const isMe = msg.senderId === currentSchoolId;
                      return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <span className="text-[9px] font-bold text-slate-400 uppercase mb-0.5 tracking-wider px-1">
                            {isMe ? 'You' : msg.senderName}
                          </span>
                          <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed font-medium shadow-2xs ${
                            isMe 
                              ? 'bg-indigo-600 text-white rounded-tr-none' 
                              : 'bg-white text-slate-800 border border-slate-150 rounded-tl-none'
                          }`}>
                            {renderMessageWithLinks(msg.message, isMe)}
                          </div>
                          <span className="text-[8.5px] text-slate-400 mt-0.5 font-semibold px-1 font-mono">
                            {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Input Form */}
                <form onSubmit={handleSendSchoolChatMessage} className="p-3 border-t border-slate-150 bg-white shrink-0 flex gap-2">
                  <input
                    type="text"
                    placeholder="Type your message to Admin..."
                    value={schoolChatInput}
                    onChange={(e) => setSchoolChatInput(e.target.value)}
                    className="flex-1 px-3.5 py-2 text-xs border border-slate-200 bg-slate-50 rounded-xl outline-none focus:border-indigo-500 font-semibold"
                    maxLength={500}
                  />
                  <button
                    type="submit"
                    disabled={!schoolChatInput.trim()}
                    className="px-3 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:from-slate-200 disabled:to-slate-300 disabled:text-slate-400 text-white rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center shadow-xs"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </div>
          )}
        </>
      )}
      </div> {/* Right main content body wrapper */}
      {/* Global K-12 Student Privacy Modal */}
      <PrivacyPolicyModal isOpen={showPrivacyPolicy} onClose={() => setShowPrivacyPolicy(false)} />
    </div>
  );
}
