import React, { useState } from 'react';
import JSZip from 'jszip';
import { SaasSchool, SaasNotification, SaasAgent, WithdrawalRequest, ChatMessage, SaaSRecycleBinItem } from '../types';
import { 
  Building2, PlusCircle, Key, Trash2, KeyRound, ArrowUpRight, Pencil, 
  Settings, Sparkles, Database, CheckSquare, Search, Copy, Check, School, ShieldAlert,
  Download, Upload, RefreshCw, Bell, Send, Info, X, CheckCircle, AlertCircle, Calendar,
  DollarSign, AlertTriangle, CloudLightning, CloudOff, LogOut, ArrowLeft, Users, Percent, Gift, PiggyBank, Eye, ChevronRight,
  Landmark, MessageSquare, LayoutGrid, CreditCard
} from 'lucide-react';
import { 
  loadSchoolFromCloud, saveSchoolToCloud, saveSaaSSchoolToCloud, deleteSaaSSchoolFromCloud,
  loadAllAgentsFromCloud, saveAgentToCloud, deleteAgentFromCloud,
  subscribeWithdrawals, saveWithdrawal, subscribeChatMessages, saveChatMessage,
  parsePrice, GlobalSettings, saveGlobalSettings, subscribeGlobalSettings,
  loadAllTemplatesFromCloud, saveTemplateToCloud, deleteTemplateFromCloud, subscribeTemplates,
  deleteNotificationFromCloud, deleteChatMessage, saveNotificationToCloud,
  loadSaaSRecycleBinFromCloud, saveSaaSRecycleBinToCloud, deleteSaaSRecycleBinFromCloud
} from '../lib/firebaseSync';
import TemplateGalleryManager from './TemplateGalleryManager';
import ReportCardStructureSettings from './ReportCardStructureSettings';
import { initialBranding, defaultSubjects, defaultScoreColumns, defaultStudents, defaultGradeScales } from '../data/defaultData';
import { ReportCardStructure } from '../types';
import { renderMessageWithLinks } from '../utils/linkify';
import LinkButtonCreator from './LinkButtonCreator';

interface MainAdminDashboardProps {
  schools: SaasSchool[];
  onUpdateSchools: (updated: SaasSchool[]) => void;
  onImpersonateSchool: (schoolId: string) => void;
  notifications?: SaasNotification[];
  onSendNotification?: (notif: SaasNotification) => void;
  cloudSchoolIds?: string[];
  isSyncingAll?: boolean;
  syncStatusMessage?: string;
  onSyncUnsyncedSchools?: () => Promise<void>;
  onLogout?: () => void;
}

export default function MainAdminDashboard({
  schools = [],
  onUpdateSchools,
  onImpersonateSchool,
  notifications = [],
  onSendNotification,
  cloudSchoolIds = [],
  isSyncingAll = false,
  syncStatusMessage = "",
  onSyncUnsyncedSchools,
  onLogout
}: MainAdminDashboardProps) {
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newSchoolUsername, setNewSchoolUsername] = useState('');
  const [newSchoolPassword, setNewSchoolPassword] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMenuTab, setActiveMenuTab] = useState<'overview' | 'tenants' | 'onboard' | 'partners' | 'broadcast' | 'backups' | 'templates'>('tenants');
  
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedPartnerLink, setCopiedPartnerLink] = useState(false);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);
  const [backupMessage, setBackupMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const [deletingSchool, setDeletingSchool] = useState<{ id: string; name: string } | null>(null);
  const [deleteInputText, setDeleteInputText] = useState('');

  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState('');

  // Details Modal and Broadcast state
  const [viewingSchool, setViewingSchool] = useState<SaasSchool | null>(null);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifType, setNotifType] = useState<'info' | 'success' | 'warning'>('info');
  const [notifRecipientType, setNotifRecipientType] = useState<'all' | 'custom'>('all');
  const [notifSelectedSchools, setNotifSelectedSchools] = useState<string[]>([]);
  const [notifSuccessMsg, setNotifSuccessMsg] = useState<string | null>(null);

  // Directory filter & modal states
  const [activeDirectoryTab, setActiveDirectoryTab] = useState<'approved' | 'pending' | 'rejected' | 'agents' | 'withdrawals' | 'upgrades' | 'recycle_bin'>('approved');
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [selectedChatPartnerId, setSelectedChatPartnerId] = useState<string | null>(null);
  const [adminChatInput, setAdminChatInput] = useState<string>('');
  const [showAdminChatSidebar, setShowAdminChatSidebar] = useState<boolean>(false);
  const adminChatEndRef = React.useRef<HTMLDivElement | null>(null);
  const stickyChatEndRef = React.useRef<HTMLDivElement | null>(null);

  // Search & Edit states for Notifications & Chat
  const [schoolSearchQuery, setSchoolSearchQuery] = useState('');
  const [editingNotification, setEditingNotification] = useState<SaasNotification | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editingMsgText, setEditingMsgText] = useState('');
  const [newChatSearch, setNewChatSearch] = useState('');
  const [showNewChatDropdown, setShowNewChatDropdown] = useState(false);

  // SaaS Templates states & effects
  const [templates, setTemplates] = useState<ReportCardStructure[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  React.useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    if (activeMenuTab === 'templates') {
      setIsLoadingTemplates(true);
      try {
        unsubscribe = subscribeTemplates((cloudTemplates) => {
          if (cloudTemplates && cloudTemplates.length > 0) {
            setTemplates(cloudTemplates as any[]);
          }
          setIsLoadingTemplates(false);
        });
      } catch (err) {
        console.error("Failed to subscribe SaaS templates:", err);
        loadAllTemplatesFromCloud().then(cloudTemplates => {
          if (cloudTemplates && cloudTemplates.length > 0) {
            setTemplates(cloudTemplates as any[]);
          }
          setIsLoadingTemplates(false);
        });
      }
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [activeMenuTab]);

  const handleUpdateTemplates = async (updated: ReportCardStructure[]) => {
    // 1. Identify deleted templates and delete them from Firestore
    const deleted = templates.filter(t => !updated.some(u => u.id === t.id));
    for (const d of deleted) {
      try {
        await deleteTemplateFromCloud(d.id);
      } catch (err) {
        console.error("Failed to delete template from cloud:", err);
      }
    }

    // 2. Save/Update current templates
    for (const u of updated) {
      try {
        await saveTemplateToCloud({
          ...u,
          createdAt: (u as any).createdAt || new Date().toISOString()
        } as any);
      } catch (err) {
        console.error("Failed to save template to cloud:", err);
      }
    }

    setTemplates(updated);
  };

  // Subscribe to withdrawals
  React.useEffect(() => {
    const unsub = subscribeWithdrawals((data) => {
      setWithdrawals([...data].sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()));
    });
    return () => unsub();
  }, []);

  // Subscribe to all chat messages
  React.useEffect(() => {
    const unsub = subscribeChatMessages((data) => {
      setChatMessages([...data].sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()));
    });
    return () => unsub();
  }, []);

  // Mark messages as read for selected partner when admin views them
  React.useEffect(() => {
    if (showAdminChatSidebar && selectedChatPartnerId) {
      const unreadMsgs = chatMessages.filter(
        m => m.senderId === selectedChatPartnerId && m.receiverId === 'admin' && !m.read
      );
      unreadMsgs.forEach(async (msg) => {
        try {
          await saveChatMessage({ ...msg, read: true });
        } catch (err) {
          console.error("Failed to mark message as read:", err);
        }
      });
    }
  }, [showAdminChatSidebar, selectedChatPartnerId, chatMessages]);

  const adminUnreadCount = chatMessages.filter(m => m.receiverId === 'admin' && !m.read).length;

  // Auto scroll admin chat
  React.useEffect(() => {
    if (showAdminChatSidebar && selectedChatPartnerId) {
      setTimeout(() => {
        adminChatEndRef.current?.scrollTo({
          top: adminChatEndRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    }
  }, [showAdminChatSidebar, selectedChatPartnerId, chatMessages]);

  // Auto scroll sticky sidebar chat
  React.useEffect(() => {
    if (selectedChatPartnerId) {
      setTimeout(() => {
        stickyChatEndRef.current?.scrollTo({
          top: stickyChatEndRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }, 100);
    }
  }, [selectedChatPartnerId, chatMessages]);

  const [agents, setAgents] = useState<SaasAgent[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [saasRecycleBin, setSaasRecycleBin] = useState<SaaSRecycleBinItem[]>([]);
  const [isLoadingSaasRecycleBin, setIsLoadingSaasRecycleBin] = useState(false);
  const [selectedAgentForSchools, setSelectedAgentForSchools] = useState<SaasAgent | null>(null);
  const [agentSearchTerm, setAgentSearchTerm] = useState('');

  // Global Settings for universal commission
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({ universalCommissionPercentage: 10 });
  const [isUpdatingGlobalSettings, setIsUpdatingGlobalSettings] = useState(false);

  React.useEffect(() => {
    const unsub = subscribeGlobalSettings((settings) => {
      setGlobalSettings(settings);
    });
    return () => unsub();
  }, []);

  const handleSaveUniversalCommission = async (val: number) => {
    try {
      setIsUpdatingGlobalSettings(true);
      await saveGlobalSettings({ universalCommissionPercentage: val });
      setSuccessInfo(`Universal commission percentage updated to ${val}% successfully!`);
      setTimeout(() => setSuccessInfo(null), 4000);
    } catch (err) {
      console.error("Failed to save universal commission percentage:", err);
      setErrorInfo("Failed to save universal commission percentage.");
      setTimeout(() => setErrorInfo(null), 4000);
    } finally {
      setIsUpdatingGlobalSettings(false);
    }
  };
  const [approvingSchoolId, setApprovingSchoolId] = useState<string | null>(null);
  const [partnershipTypeInput, setPartnershipTypeInput] = useState<'trial' | 'annual'>('trial');
  const [maxStudentsLimitInput, setMaxStudentsLimitInput] = useState<number>(50);
  const [maxCumulativeStudentsLimitInput, setMaxCumulativeStudentsLimitInput] = useState<number>(100);
  const [maxTeachersLimitInput, setMaxTeachersLimitInput] = useState<number>(10);
  const [maxStructuresLimitInput, setMaxStructuresLimitInput] = useState<number>(5);
  const [cumulativeStudentsCountInput, setCumulativeStudentsCountInput] = useState<number>(0);

  // States to allow editing school registration details during approval
  const [schoolNameInput, setSchoolNameInput] = useState('');
  const [schoolBoardInput, setSchoolBoardInput] = useState('CBSE');
  const [schoolContactPersonInput, setSchoolContactPersonInput] = useState('');
  const [schoolEmailInput, setSchoolEmailInput] = useState('');
  const [schoolMobileInput, setSchoolMobileInput] = useState('');
  const [schoolAddressInput, setSchoolAddressInput] = useState('');

  // States for the new Onboard School Tenant form (aligning with self-registration and config)
  const [newSchoolBoard, setNewSchoolBoard] = useState('CBSE');
  const [newSchoolContactPerson, setNewSchoolContactPerson] = useState('');
  const [newSchoolEmail, setNewSchoolEmail] = useState('');
  const [newSchoolMobile, setNewSchoolMobile] = useState('');
  const [newSchoolAddress, setNewSchoolAddress] = useState('');
  const [newSchoolApprovalStatus, setNewSchoolApprovalStatus] = useState<'pending' | 'approved'>('approved');
  
  const [newSchoolPartnershipType, setNewSchoolPartnershipType] = useState<'trial' | 'annual'>('trial');
  const [newSchoolMaxStudents, setNewSchoolMaxStudents] = useState<number>(50);
  const [newSchoolMaxCumulativeStudents, setNewSchoolMaxCumulativeStudents] = useState<number>(100);
  const [newSchoolMaxTeachers, setNewSchoolMaxTeachers] = useState<number>(10);
  const [newSchoolMaxStructures, setNewSchoolMaxStructures] = useState<number>(5);
  const [newSchoolCumulativeStudentsCount, setNewSchoolCumulativeStudentsCount] = useState<number>(0);
  const [newSchoolTrialUntil, setNewSchoolTrialUntil] = useState(() => {
    const future = new Date();
    future.setDate(future.getDate() + 14);
    return future.toISOString().split('T')[0];
  });
  const [newSchoolTrialPrice, setNewSchoolTrialPrice] = useState('₹4,999/month (Sandbox Trial)');

  const handleNewSchoolPartnershipTypeChange = (type: 'trial' | 'annual') => {
    setNewSchoolPartnershipType(type);
    if (type === 'annual') {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 1);
      setNewSchoolTrialUntil(future.toISOString().split('T')[0]);
      setNewSchoolTrialPrice('₹49,999/year (Annual Partnership)');
      setNewSchoolMaxStudents(500);
      setNewSchoolMaxCumulativeStudents(1200);
      setNewSchoolMaxTeachers(50);
      setNewSchoolMaxStructures(15);
    } else {
      const future = new Date();
      future.setDate(future.getDate() + 14);
      setNewSchoolTrialUntil(future.toISOString().split('T')[0]);
      setNewSchoolTrialPrice('₹4,999/month (Sandbox Trial)');
      setNewSchoolMaxStudents(50);
      setNewSchoolMaxCumulativeStudents(100);
      setNewSchoolMaxTeachers(10);
      setNewSchoolMaxStructures(5);
    }
  };

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const handlePartnershipTypeChange = (type: 'trial' | 'annual') => {
    setPartnershipTypeInput(type);
    if (type === 'annual') {
      const future = new Date();
      future.setFullYear(future.getFullYear() + 1);
      setTrialUntilInput(future.toISOString().split('T')[0]);
      setTrialPriceInput('₹49,999/year (Annual Partnership)');
      setMaxStudentsLimitInput(500);
      setMaxCumulativeStudentsLimitInput(1200);
      setMaxTeachersLimitInput(50);
      setMaxStructuresLimitInput(15);
    } else {
      const future = new Date();
      future.setDate(future.getDate() + 14);
      setTrialUntilInput(future.toISOString().split('T')[0]);
      setTrialPriceInput('₹4,999/month (Sandbox Trial)');
      setMaxStudentsLimitInput(50);
      setMaxCumulativeStudentsLimitInput(100);
      setMaxTeachersLimitInput(10);
      setMaxStructuresLimitInput(5);
    }
  };

  const [trialUntilInput, setTrialUntilInput] = useState(() => {
    const future = new Date();
    future.setDate(future.getDate() + 14); // 14 Days default trial duration
    return future.toISOString().split('T')[0];
  });
  const [trialPriceInput, setTrialPriceInput] = useState('₹4,999/month');

  const [isBackingUpSingle, setIsBackingUpSingle] = useState(false);
  const [isRestoringSingle, setIsRestoringSingle] = useState(false);
  const [singleBackupError, setSingleBackupError] = useState<string | null>(null);
  const [singleBackupSuccess, setSingleBackupSuccess] = useState<string | null>(null);

  const handleBackupSingleSchool = async (school: SaasSchool) => {
    setIsBackingUpSingle(true);
    setSingleBackupError(null);
    setSingleBackupSuccess(null);
    try {
      const data = await loadSchoolFromCloud(school.id);
      if (!data) {
        throw new Error("Could not find deep academic records on the cloud for this school.");
      }

      const backupObj = {
        backupType: "single_school_deep_backup",
        version: "1.5",
        timestamp: new Date().toISOString(),
        school: school,
        schoolDatabase: data
      };

      const zip = new JSZip();
      zip.file("school_backup.json", JSON.stringify(backupObj, null, 2));
      const content = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 9 } });

      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = URL.createObjectURL(content);
      downloadAnchor.download = `${school.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}_backup_${Date.now()}.zip`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      setSingleBackupSuccess(`Success! Highly-compressed ZIP backup generated for ${school.name}.`);
    } catch (err: any) {
      console.error(err);
      setSingleBackupError(`Failed to generate single school backup: ${err?.message || err}`);
    } finally {
      setIsBackingUpSingle(false);
    }
  };

  const handleRestoreSingleSchool = async (e: React.ChangeEvent<HTMLInputElement>, school: SaasSchool) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    setIsRestoringSingle(true);
    setSingleBackupError(null);
    setSingleBackupSuccess(null);

    try {
      let jsonText = "";

      if (file.name.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(file);
        const jsonFile = Object.keys(zip.files).find(name => name.endsWith('.json'));
        if (!jsonFile) {
          throw new Error("Invalid ZIP backup: No JSON file found inside the archive.");
        }
        jsonText = await zip.files[jsonFile].async("string");
      } else if (file.name.endsWith('.json')) {
        jsonText = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.onerror = () => reject(new Error("Failed to read JSON backup."));
          reader.readAsText(file);
        });
      } else {
        throw new Error("Unsupported format. Please select a .zip or .json file.");
      }

      const parsed = JSON.parse(jsonText);
      if (!parsed) {
        throw new Error("Failed to parse backup content. JSON structure is corrupt.");
      }

      let deepData: any = null;
      let schoolMeta: any = null;

      if (parsed.backupType === "single_school_deep_backup") {
        if (parsed.schoolDatabase) {
          deepData = parsed.schoolDatabase;
          schoolMeta = parsed.school;
        } else {
          throw new Error("Invalid single school backup: No academic record database found.");
        }
      } else if (parsed.backupType === "full_enterprise_deep_backup") {
        if (parsed.schoolDatabases && parsed.schoolDatabases[school.id]) {
          deepData = parsed.schoolDatabases[school.id];
          schoolMeta = parsed.schools?.find((s: any) => s.id === school.id);
        } else {
          throw new Error(`This backup file does not contain a database for this specific school ID (${school.id}).`);
        }
      } else {
        throw new Error("Unrecognized backup format. Please upload a valid system-generated backup.");
      }

      // Restore the deep collection
      await saveSchoolToCloud(school.id, deepData, school.name, deepData.branding?.portalCode);

      if (schoolMeta) {
        const mergedMeta = { ...school, ...schoolMeta };
        await saveSaaSSchoolToCloud(mergedMeta, mergedMeta.ownerId);
        const updatedSchools = schools.map(s => s.id === school.id ? mergedMeta : s);
        onUpdateSchools(updatedSchools);
        setViewingSchool(mergedMeta);
      }

      setSingleBackupSuccess(`Success! Highly-compressed academic database restored for "${school.name}" successfully.`);
    } catch (err: any) {
      console.error(err);
      setSingleBackupError(`Restore failed: ${err?.message || err}`);
    } finally {
      setIsRestoringSingle(false);
      e.target.value = "";
    }
  };

  const handleRestoreData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    setIsRestoring(true);
    setRestoreProgress('Reading backup file contents...');
    setBackupMessage({ text: "Reading file...", type: 'success' });
    
    try {
      let jsonText = "";

      if (file.name.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(file);
        const jsonFile = Object.keys(zip.files).find(name => name.endsWith('.json'));
        if (!jsonFile) {
          throw new Error("Invalid ZIP backup: No JSON file found inside the archive.");
        }
        jsonText = await zip.files[jsonFile].async("string");
      } else if (file.name.endsWith('.json')) {
        jsonText = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.onerror = () => reject(new Error("Failed to read JSON backup file."));
          reader.readAsText(file);
        });
      } else {
        throw new Error("Unsupported format. Please select a .zip or .json file.");
      }

      const parsed = JSON.parse(jsonText);
      if (!parsed || !Array.isArray(parsed.schools)) {
        setBackupMessage({ text: "Invalid formatting: JSON does not contain the schools list.", type: 'error' });
        setIsRestoring(false);
        return;
      }

      const validSchools = parsed.schools.filter((s: any) => s && s.id && s.name && s.username && s.password);
      if (validSchools.length === 0) {
        setBackupMessage({ text: "Invalid backup file: No valid school entries found.", type: 'error' });
        setIsRestoring(false);
        return;
      }

      // 1. Restore SaaS school directory documents
      setRestoreProgress("Synchronizing school registry credentials with cloud...");
      for (const s of validSchools) {
        try {
          await saveSaaSSchoolToCloud(s, s.ownerId);
        } catch (err) {
          console.warn(`Failed to restore credentials for school ${s.id}:`, err);
        }
      }

      // 2. Restore deep collections if available
      let deepRestoredCount = 0;
      if (parsed.backupType === "full_enterprise_deep_backup" && parsed.schoolDatabases) {
        const dbKeys = Object.keys(parsed.schoolDatabases);
        for (let i = 0; i < dbKeys.length; i++) {
          const schoolId = dbKeys[i];
          const schoolName = validSchools.find(s => s.id === schoolId)?.name || schoolId;
          setRestoreProgress(`Restoring database elements for "${schoolName}" (${i + 1} of ${dbKeys.length})...`);
          
          try {
            const deepData = parsed.schoolDatabases[schoolId];
            await saveSchoolToCloud(schoolId, deepData, schoolName, deepData.branding?.portalCode);
            deepRestoredCount++;
          } catch (err) {
            console.warn(`Failed to write deep subcollections for school ${schoolId}:`, err);
          }
        }
      }

      // Merge state in client
      const mergedSchools = [...schools];
      validSchools.forEach((newS: SaasSchool) => {
        const index = mergedSchools.findIndex(m => m.id === newS.id || m.username === newS.username);
        if (index > -1) {
          mergedSchools[index] = { ...mergedSchools[index], ...newS };
        } else {
          mergedSchools.push(newS);
        }
      });

      onUpdateSchools(mergedSchools);
      
      let confirmText = `Fully restored ${validSchools.length} school login credentials!`;
      if (deepRestoredCount > 0) {
        confirmText += ` Rebuilt ${deepRestoredCount} complete student & grade databases in Firestore!`;
      } else {
        confirmText += ` (Note: File was credential-only; did not contain deep student/score records)`;
      }
      
      setBackupMessage({ text: confirmText, type: 'success' });
      setRestoreProgress('');
    } catch (err: any) {
      setBackupMessage({ text: `Restore failed: ${err?.message || err}`, type: 'error' });
      setRestoreProgress('');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleGenerateCredentials = () => {
    if (!newSchoolName) return;
    
    // Auto-generate a clean username and randomized clean password
    const slug = newSchoolName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 10);
    
    const randomNum = Math.floor(100 + Math.random() * 900);
    const generatedUser = `${slug}${randomNum}`;
    
    const chars = 'abcdefhkmnpxyz23456789';
    let generatedPass = '';
    for (let i = 0; i < 8; i++) {
      generatedPass += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    setNewSchoolUsername(generatedUser);
    setNewSchoolPassword(generatedPass);
  };

  const handleCreateSchool = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchoolName || !newSchoolUsername || !newSchoolPassword) {
      setErrorInfo('Please fill in some school name and generate its credentials.');
      return;
    }

    // Check for username conflicts
    const conflict = schools.some(s => s.username === newSchoolUsername.toLowerCase().trim());
    if (conflict) {
      setErrorInfo(`Username "${newSchoolUsername}" is already utilized by another school.`);
      return;
    }

    const newSchool: SaasSchool = {
      id: `sc_${Date.now()}`,
      name: newSchoolName.trim(),
      username: newSchoolUsername.toLowerCase().trim(),
      password: newSchoolPassword.trim(),
      board: newSchoolBoard,
      contactPerson: newSchoolContactPerson.trim(),
      email: newSchoolEmail.trim(),
      mobile: newSchoolMobile.trim(),
      address: newSchoolAddress.trim(),
      approvalStatus: 'approved' as const,
      partnershipType: 'pending_activation' as any,
      maxStudentsLimit: 50,
      maxCumulativeStudentsLimit: 100,
      maxTeachersLimit: 1,
      maxStructuresLimit: 5,
      cumulativeStudentsCount: newSchoolCumulativeStudentsCount,
      teachers: []
    };

    onUpdateSchools([...schools, newSchool]);
    
    // Save to Cloud Firestore
    saveSaaSSchoolToCloud(newSchool, "default-owner").catch(err => {
      console.error("Failed to automatically synchronize new onboarded school to cloud Firestore:", err);
    });

    // Reset states
    setNewSchoolName('');
    setNewSchoolUsername('');
    setNewSchoolPassword('');
    setNewSchoolContactPerson('');
    setNewSchoolEmail('');
    setNewSchoolMobile('');
    setNewSchoolAddress('');
    setNewSchoolCumulativeStudentsCount(0);
    setErrorInfo(null);
    setSuccessInfo(`School "${newSchool.name}" successfully active and onboarded!`);
    setTimeout(() => setSuccessInfo(null), 4000);
  };

  const handleDeleteSchool = (id: string, name: string) => {
    setDeletingSchool({ id, name });
    setDeleteInputText('');
  };

  const confirmDeleteSchool = async () => {
    if (!deletingSchool) return;
    if (deleteInputText.trim().toUpperCase() !== 'DELETE' && deleteInputText.trim().toUpperCase() !== 'CONFIRM') {
      return;
    }
    const { id, name } = deletingSchool;
    const matchedSchool = schools.find(s => s.id === id);
    
    // 1. Immediately update local state & localStorage so the UI is snappy and responsive
    const updated = schools.filter(s => s.id !== id);
    onUpdateSchools(updated);

    try {
      localStorage.removeItem(`class_on_branding_${id}`);
      localStorage.removeItem(`class_on_score_columns_${id}`);
      localStorage.removeItem(`class_on_subjects_${id}`);
      localStorage.removeItem(`class_on_grade_scales_${id}`);
      localStorage.removeItem(`class_on_students_${id}`);
      localStorage.removeItem(`class_on_student_grades_${id}`);
      localStorage.removeItem(`class_on_structures_${id}`);
      localStorage.removeItem(`class_on_recycle_bin_${id}`);
    } catch (err) {
      console.warn('Local history cleanup failure:', err);
    }
    
    // Instantly close the popup modal and show a success message on the screen
    setDeletingSchool(null);
    setDeleteInputText('');
    setSuccessInfo(`School "${name}" moved to SaaS Recycle Bin successfully.`);
    setTimeout(() => setSuccessInfo(null), 3500);

    // 2. Perform background cloud sync safely and asynchronously
    try {
      if (matchedSchool) {
        // Move to SaaS recycle bin
        const binItem: SaaSRecycleBinItem = {
          id: `saas_bin_${id}_${Date.now()}`,
          type: 'school',
          deletedAt: new Date().toISOString(),
          description: `School: ${name} (${matchedSchool.email || 'No email'})`,
          payload: matchedSchool
        };
        await saveSaaSRecycleBinToCloud(binItem).catch(err => {
          console.warn("Background cloud write to SaaS Recycle Bin failed (safely deferred):", err);
          throw err;
        });
      }
      
      // Delete school from active Firestore schools collection
      await deleteSaaSSchoolFromCloud(id).catch(err => {
        console.warn("Background cloud delete school failed (safely deferred):", err);
        throw err;
      });
    } catch (err: any) {
      console.error("Failed to sync delete school to cloud:", err);
      setErrorInfo(`Cloud sync failed: ${err?.message || "Permission Denied. Please ensure you are logged in as an authorized SaaS Super Admin."}`);
      setTimeout(() => setErrorInfo(null), 6000);
    }
  };

  const handleCopyCredentials = (school: SaasSchool) => {
    const credText = `School Title: ${school.name}\nSchool ID (Login ID): ${school.username}\nAdmin Password: ${school.password}\nDashboard URL: ${window.location.origin}`;
    navigator.clipboard.writeText(credText);
    setCopiedId(school.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifMessage.trim()) return;

    const targets = notifRecipientType === 'all' 
      ? ['all'] 
      : notifSelectedSchools;

    if (targets.length === 0) {
      alert("Please select at least one school as the recipient.");
      return;
    }

    const newNotif: SaasNotification = {
      id: `notif_${Date.now()}`,
      title: notifTitle.trim(),
      message: notifMessage.trim(),
      type: notifType,
      sentAt: new Date().toISOString(),
      targetSchoolIds: targets,
      readBy: []
    };

    if (onSendNotification) {
      onSendNotification(newNotif);
    }

    // Reset Form
    setNotifTitle('');
    setNotifMessage('');
    setNotifSuccessMsg(`Successfully sent notification to ${notifRecipientType === 'all' ? 'All Schools' : `${targets.length} Selected Schools`}!`);
    setTimeout(() => setNotifSuccessMsg(null), 4500);
  };

  const handleDeleteNotification = async (notifId: string) => {
    if (!confirm("Are you sure you want to delete this notification?")) return;
    try {
      await deleteNotificationFromCloud(notifId);
    } catch (err) {
      console.error("Failed to delete notification from cloud:", err);
    }
  };

  const handleEditNotificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNotification) return;

    const trimmedTitle = editingNotification.title.trim();
    const trimmedMessage = editingNotification.message.trim();

    if (!trimmedTitle || !trimmedMessage) {
      alert("Please fill in all required fields.");
      return;
    }

    const targets = editingNotification.targetSchoolIds;
    if (targets.length === 0) {
      alert("Please select at least one school as the recipient.");
      return;
    }

    const updatedNotif: SaasNotification = {
      ...editingNotification,
      title: trimmedTitle,
      message: trimmedMessage
    };

    try {
      await saveNotificationToCloud(updatedNotif);
      setEditingNotification(null);
      setNotifSuccessMsg("Notification updated successfully!");
      setTimeout(() => setNotifSuccessMsg(null), 4500);
    } catch (err) {
      console.error("Failed to edit notification:", err);
      alert("Failed to update notification.");
    }
  };

  const handleSaveEditChatMessage = async (msgId: string) => {
    if (!editingMsgText.trim()) return;
    const msgToEdit = chatMessages.find(m => m.id === msgId);
    if (!msgToEdit) return;

    const updatedMsg: ChatMessage = {
      ...msgToEdit,
      message: editingMsgText.trim()
    };

    // Update local state optimistically
    setChatMessages(prev => prev.map(m => m.id === msgId ? updatedMsg : m));
    setEditingMsgId(null);
    setEditingMsgText('');

    try {
      await saveChatMessage(updatedMsg);
    } catch (err) {
      console.error("Failed to save edited chat message:", err);
    }
  };

  const handleDeleteChatMessage = async (msgId: string) => {
    if (!confirm("Are you sure you want to delete this chat message?")) return;

    // Update local state optimistically
    setChatMessages(prev => prev.filter(m => m.id !== msgId));
    
    // Clear editing state if deleting the active one
    if (editingMsgId === msgId) {
      setEditingMsgId(null);
      setEditingMsgText('');
    }

    try {
      await deleteChatMessage(msgId);
    } catch (err) {
      console.error("Failed to delete chat message:", err);
    }
  };


  const handleOpenApproveModal = (schoolId: string) => {
    setApprovingSchoolId(schoolId);
    const matched = schools.find(s => s.id === schoolId);
    if (matched) {
      setSchoolNameInput(matched.name || '');
      setSchoolBoardInput(matched.board || 'CBSE');
      setSchoolContactPersonInput(matched.contactPerson || '');
      setSchoolEmailInput(matched.email || '');
      setSchoolMobileInput(matched.mobile || '');
      setSchoolAddressInput(matched.address || '');

      setPartnershipTypeInput(matched.partnershipType || 'trial');
      setTrialUntilInput(matched.trialUntil || (() => {
        const future = new Date();
        future.setDate(future.getDate() + 14);
        return future.toISOString().split('T')[0];
      })());
      setTrialPriceInput(matched.trialPrice || '₹4,999/month (Sandbox Trial)');
      setMaxStudentsLimitInput(matched.maxStudentsLimit || 50);
      setMaxCumulativeStudentsLimitInput(matched.maxCumulativeStudentsLimit || 100);
      setMaxTeachersLimitInput(matched.maxTeachersLimit || 10);
      setMaxStructuresLimitInput(matched.maxStructuresLimit || 5);
      setCumulativeStudentsCountInput(matched.cumulativeStudentsCount || 0);
    }
  };

  const handleConfirmApprove = async () => {
    if (!approvingSchoolId) return;
    const matched = schools.find(s => s.id === approvingSchoolId);
    let approvedSchool: any = null;
    const updated = schools.map(s => {
      if (s.id === approvingSchoolId) {
        approvedSchool = {
          ...s,
          name: schoolNameInput.trim() || s.name,
          board: schoolBoardInput,
          contactPerson: schoolContactPersonInput.trim(),
          email: schoolEmailInput.trim(),
          mobile: schoolMobileInput.trim(),
          address: schoolAddressInput.trim(),
          approvalStatus: 'approved' as const,
          trialUntil: trialUntilInput,
          trialPrice: trialPriceInput,
          partnershipType: partnershipTypeInput,
          maxStudentsLimit: maxStudentsLimitInput,
          maxCumulativeStudentsLimit: maxCumulativeStudentsLimitInput,
          maxTeachersLimit: maxTeachersLimitInput,
          maxStructuresLimit: maxStructuresLimitInput,
          cumulativeStudentsCount: cumulativeStudentsCountInput,
          annualPrice: partnershipTypeInput === 'annual' ? parsePrice(trialPriceInput) : 0
        };
        return approvedSchool;
      }
      return s;
    });

    if (approvedSchool) {
      try {
        await saveSaaSSchoolToCloud(approvedSchool, approvedSchool.ownerId || "default-owner");
      } catch (err: any) {
        console.error("Failed to save approved school to cloud:", err);
        alert(`Failed to sync approval to cloud: ${err.message}`);
        return;
      }
    }

    onUpdateSchools(updated);

    // Automatically send a beautiful welcome/trial notification!
    if (onSendNotification && matched) {
      const isAnnual = partnershipTypeInput === 'annual';
      onSendNotification({
        id: `notif_approval_${Date.now()}`,
        title: isAnnual ? "🎉 Partnership Activated: Welcome to Annual Plan!" : "🎉 Registration Status: APPROVED & Trial Activated!",
        message: isAnnual
          ? `Congratulations! "${schoolNameInput.trim() || matched.name}" has been approved and activated under the Annual Partnership Plan. Your partnership is valid until ${trialUntilInput || '1 year'}. Active Student Limit: ${maxStudentsLimitInput}, All-time/Cumulative Student registration quota: ${maxCumulativeStudentsLimitInput}, Max Teacher Accounts: ${maxTeachersLimitInput}. Welcome aboard!`
          : `Congratulations! "${schoolNameInput.trim() || matched.name}" has been approved for a Sandbox Trial until ${trialUntilInput || '14 days'}. Limit: ${maxStudentsLimitInput} active student profiles (with a security lock of ${maxCumulativeStudentsLimitInput} cumulative registrations). Post-trial: ${trialPriceInput}. Keep managing student rosters and tabulation reports!`,
        type: 'success',
        sentAt: new Date().toISOString(),
        targetSchoolIds: [approvingSchoolId],
        readBy: []
      });
    }

    setApprovingSchoolId(null);
    setSuccessInfo(`School registration request approved as ${partnershipTypeInput === 'annual' ? 'Annual Partnership' : 'Sandbox Trial'} with custom plan limits!`);
    setTimeout(() => setSuccessInfo(null), 4000);
  };

  const handleRejectSchool = (schoolId: string) => {
    const matched = schools.find(s => s.id === schoolId);
    setConfirmModal({
      isOpen: true,
      title: "Decline School Registration Request",
      message: `Are you sure you want to REJECT the onboarding registration request for "${matched?.name || ''}"?`,
      onConfirm: async () => {
        let rejectedSchool: any = null;
        const updated = schools.map(s => {
          if (s.id === schoolId) {
            rejectedSchool = {
              ...s,
              approvalStatus: 'rejected' as const
            };
            return rejectedSchool;
          }
          return s;
        });

        if (rejectedSchool) {
          try {
            await saveSaaSSchoolToCloud(rejectedSchool, rejectedSchool.ownerId || "default-owner");
          } catch (err: any) {
            console.error("Failed to save rejected school to cloud:", err);
            alert(`Failed to sync rejection to cloud: ${err.message}`);
            return;
          }
        }

        onUpdateSchools(updated);
        setSuccessInfo("School registration request declined successfully.");
        setTimeout(() => setSuccessInfo(null), 4000);
        setConfirmModal(null);
      }
    });
  };

  const handleApproveSubscription = (school: SaasSchool) => {
    if (!school.subscriptionRequest) return;
    const req = school.subscriptionRequest;
    
    setConfirmModal({
      isOpen: true,
      title: "Approve Subscription Upgrade",
      message: `Are you sure you want to APPROVE the subscription upgrade to the Annual Plan for "${school.name}"? This will set their license limit to ${req.studentCount} active students and set their annual price to ₹${req.calculatedTotal.toLocaleString()}/year.`,
      onConfirm: async () => {
        let upgradedSchool: any = null;
        const updated = schools.map(s => {
          if (s.id === school.id) {
            upgradedSchool = {
              ...s,
              partnershipType: 'annual' as const,
              maxStudentsLimit: req.studentCount,
              maxCumulativeStudentsLimit: Math.floor(req.studentCount * 1.5),
              maxTeachersLimit: 1000,
              maxStructuresLimit: 50,
              trialUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
              annualPrice: req.calculatedTotal,
              subscriptionRequest: {
                ...req,
                status: 'approved' as const
              },
              updatedAt: new Date().toISOString()
            };
            return upgradedSchool;
          }
          return s;
        });
        
        if (upgradedSchool) {
          try {
            await saveSaaSSchoolToCloud(upgradedSchool, upgradedSchool.ownerId || "default-owner");
          } catch (err: any) {
            console.error("Failed to save upgraded subscription school to cloud:", err);
            alert(`Failed to sync upgrade approval to cloud: ${err.message}`);
            return;
          }
        }

        onUpdateSchools(updated);
        
        // Send a notification of success to the school
        if (onSendNotification) {
          onSendNotification({
            id: `notif_upgr_appr_${Date.now()}`,
            title: "👑 Subscription Upgrade Approved & Active!",
            message: `Congratulations! Your request to upgrade to the Annual Plan has been approved. Your limits have been updated: Max Students Limit is now ${req.studentCount}. Plan active for 1 year!`,
            type: 'success',
            sentAt: new Date().toISOString(),
            targetSchoolIds: [school.id],
            readBy: []
          });
        }
        
        setSuccessInfo(`Subscription upgrade request for "${school.name}" has been successfully approved!`);
        setTimeout(() => setSuccessInfo(null), 4000);
        setConfirmModal(null);
      }
    });
  };

  const handleRejectSubscription = (school: SaasSchool) => {
    if (!school.subscriptionRequest) return;
    const req = school.subscriptionRequest;
    
    setConfirmModal({
      isOpen: true,
      title: "Decline Subscription Upgrade",
      message: `Are you sure you want to DECLINE the subscription upgrade request for "${school.name}"?`,
      onConfirm: async () => {
        let rejectedSchool: any = null;
        const updated = schools.map(s => {
          if (s.id === school.id) {
            rejectedSchool = {
              ...s,
              subscriptionRequest: {
                ...req,
                status: 'rejected' as const
              },
              updatedAt: new Date().toISOString()
            };
            return rejectedSchool;
          }
          return s;
        });
        
        if (rejectedSchool) {
          try {
            await saveSaaSSchoolToCloud(rejectedSchool, rejectedSchool.ownerId || "default-owner");
          } catch (err: any) {
            console.error("Failed to save rejected subscription school to cloud:", err);
            alert(`Failed to sync upgrade decline to cloud: ${err.message}`);
            return;
          }
        }

        onUpdateSchools(updated);
        
        // Send a notification of rejection to the school
        if (onSendNotification) {
          onSendNotification({
            id: `notif_upgr_decl_${Date.now()}`,
            title: "❌ Subscription Upgrade Request Declined",
            message: `Your request to upgrade to the Annual Plan for ${req.studentCount} students has been declined by the system administrator. Please contact support or submit another request.`,
            type: 'warning',
            sentAt: new Date().toISOString(),
            targetSchoolIds: [school.id],
            readBy: []
          });
        }
        
        setSuccessInfo(`Subscription upgrade request for "${school.name}" was declined.`);
        setTimeout(() => setSuccessInfo(null), 4000);
        setConfirmModal(null);
      }
    });
  };

  const handleUpdateWithdrawalStatus = async (req: WithdrawalRequest, newStatus: WithdrawalRequest['status'], customRemarks?: string) => {
    try {
      let statusRemarks = customRemarks !== undefined ? customRemarks : req.remarks;
      if (customRemarks === undefined) {
        if (newStatus === 'processing') statusRemarks = 'Payment processing initiated by SaaS Admin';
        else if (newStatus === 'approved') statusRemarks = 'Approved by SaaS Admin';
        else if (newStatus === 'paid') statusRemarks = 'Payment successfully sent';
        else if (newStatus === 'rejected') statusRemarks = 'Declined by SaaS Admin';
        else statusRemarks = 'Reset to pending';
      }

      const updated: WithdrawalRequest = {
        ...req,
        status: newStatus,
        processedAt: new Date().toISOString(),
        remarks: statusRemarks
      };
      await saveWithdrawal(updated);
      setSuccessInfo(`Withdrawal payout of ₹${req.amount.toLocaleString('en-IN')} updated successfully!`);
      setTimeout(() => setSuccessInfo(null), 4000);
    } catch (err) {
      console.error("Failed to update withdrawal:", err);
      setErrorInfo("Failed to update withdrawal request status.");
      setTimeout(() => setErrorInfo(null), 4000);
    }
  };

  const handleSendAdminChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const typedText = adminChatInput.trim();
    if (!typedText || !selectedChatPartnerId) return;

    const matchedSchool = schools.find(s => s.id === selectedChatPartnerId);
    const matchedAgent = agents.find(a => a.id === selectedChatPartnerId);
    const partnerName = matchedSchool ? matchedSchool.name : (matchedAgent ? matchedAgent.fullName : 'Partner');
    const partnerRole = matchedSchool ? 'school' : 'agent';

    const newMsg: ChatMessage = {
      id: `chat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      senderId: 'admin',
      senderName: 'SaaS Admin',
      senderRole: 'admin',
      receiverId: selectedChatPartnerId,
      receiverName: partnerName,
      receiverRole: partnerRole,
      message: typedText,
      sentAt: new Date().toISOString(),
      read: false
    };

    // Optimistically update input and state instantly
    setAdminChatInput('');
    setChatMessages(prev => {
      if (prev.some(m => m.id === newMsg.id)) return prev;
      return [...prev, newMsg].sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
    });

    try {
      saveChatMessage(newMsg).catch(err => {
        console.error("Failed to save admin chat in background:", err);
      });
    } catch (err) {
      console.error("Failed to send admin chat message:", err);
    }
  };

  // Load agents list from Firestore
  React.useEffect(() => {
    if (activeDirectoryTab === 'agents') {
      setIsLoadingAgents(true);
      loadAllAgentsFromCloud()
        .then(data => {
          setAgents(data);
          setIsLoadingAgents(false);
        })
        .catch(err => {
          console.warn("Failed to load agents in SaaS Admin Dashboard:", err);
          setIsLoadingAgents(false);
        });
    }
  }, [activeDirectoryTab]);

  // Load SaaS Recycle Bin list from Firestore
  React.useEffect(() => {
    if (activeDirectoryTab === 'recycle_bin') {
      setIsLoadingSaasRecycleBin(true);
      loadSaaSRecycleBinFromCloud()
        .then(data => {
          setSaasRecycleBin(data);
          setIsLoadingSaasRecycleBin(false);
        })
        .catch(err => {
          console.warn("Failed to load SaaS Recycle Bin in SaaS Admin Dashboard:", err);
          setIsLoadingSaasRecycleBin(false);
        });
    }
  }, [activeDirectoryTab]);

  const handleUpdateAgentCommission = async (agentId: string, percentage: number) => {
    const updatedAgents = agents.map(a => {
      if (a.id === agentId) {
        const val = { ...a, commissionPercentage: percentage };
        saveAgentToCloud(val).catch(err => console.warn("Error updating agent commission in cloud:", err));
        return val;
      }
      return a;
    });
    setAgents(updatedAgents);
  };

  const handleUpdateAgentStatus = async (agentId: string, status: 'active' | 'pending' | 'suspended') => {
    const updatedAgents = agents.map(a => {
      if (a.id === agentId) {
        const val = { ...a, status };
        saveAgentToCloud(val).catch(err => console.warn("Error updating agent status in cloud:", err));
        return val;
      }
      return a;
    });
    setAgents(updatedAgents);
  };

  const handleUpdateAgentPayoutDetails = async (agentId: string, details: string) => {
    const updatedAgents = agents.map(a => {
      if (a.id === agentId) {
        const val = { ...a, paymentDetails: details };
        saveAgentToCloud(val).catch(err => console.warn("Error updating agent payout details in cloud:", err));
        return val;
      }
      return a;
    });
    setAgents(updatedAgents);
  };

  const handleDeleteAgent = async (agentId: string) => {
    const matched = agents.find(a => a.id === agentId);
    setConfirmModal({
      isOpen: true,
      title: "Delete Referral Agent",
      message: `Are you sure you want to delete the Agent profile for "${matched?.name || ''}"? This will move the partner profile into the SaaS Recycle Bin.`,
      onConfirm: async () => {
        // 1. Immediately update local state so the UI is snappy and responsive
        setAgents(prev => prev.filter(a => a.id !== agentId));
        setSuccessInfo(`Agent profile for "${matched?.name || 'Agent'}" moved to SaaS Recycle Bin successfully.`);
        setTimeout(() => setSuccessInfo(null), 4000);

        // Instantly close the confirm modal so the UI responds immediately
        setConfirmModal(null);

        // 2. Perform background cloud sync safely and asynchronously
        try {
          if (matched) {
            const binItem: SaaSRecycleBinItem = {
              id: `saas_bin_${agentId}_${Date.now()}`,
              type: 'agent',
              deletedAt: new Date().toISOString(),
              description: `Agent: ${matched.name} (${matched.email || 'No email'})`,
              payload: matched
            };
            await saveSaaSRecycleBinToCloud(binItem).catch(err => {
              console.warn("Background cloud write of deleted agent failed:", err);
            });
          }
          await deleteAgentFromCloud(agentId).catch(err => {
            console.warn("Background cloud delete of agent failed:", err);
          });
        } catch (err) {
          console.warn("Error syncing agent deletion to cloud:", err);
        }
      }
    });
  };

  // Deduplicate schools to prevent any duplication in dashboard list
  const uniqueSchools: SaasSchool[] = [];
  const seenSchoolIds = new Set<string>();
  for (const s of schools) {
    if (s && s.id && !seenSchoolIds.has(s.id)) {
      seenSchoolIds.add(s.id);
      uniqueSchools.push(s);
    }
  }

  const filteredSchools = uniqueSchools.filter(school => {
    if (activeDirectoryTab === 'approved') {
      // Show all schools
    } else if (activeDirectoryTab === 'upgrades') {
      if (school.approvalStatus !== 'approved') return false;
      if (!school.subscriptionRequest || school.subscriptionRequest.status !== 'pending') return false;
    } else {
      const status = school.approvalStatus || 'approved';
      if (status !== activeDirectoryTab) return false;
    }

    const term = searchTerm.toLowerCase();
    return school.name.toLowerCase().includes(term) || 
           school.username.toLowerCase().includes(term) ||
           (school.email || '').toLowerCase().includes(term) ||
           (school.contactPerson || '').toLowerCase().includes(term);
  });

  // Simple aggregation stats
  const totalSchoolsCount = schools.length;
  const totalTeachersOnboarded = schools.reduce((acc, current) => {
    return acc + (current.teachers?.length || 0);
  }, 0);

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-[calc(100vh-120px)] no-print">
      <style>{`
        @keyframes fadeInOnly {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeInOnly {
          animation: fadeInOnly 0.25s ease-out forwards;
        }
        @keyframes slideLeft {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slideLeft {
          animation: slideLeft 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Left Sidebar Menu */}
      <aside className="w-full lg:w-60 shrink-0 bg-white border border-slate-200/80 rounded-3xl p-4 lg:sticky lg:top-24 h-fit space-y-4 shadow-3xs select-none">
        <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
          <div className="text-left">
            <h4 className="text-[10.5px] font-black uppercase tracking-wider text-slate-800">SaaS Control Panel</h4>
            <p className="text-[9px] text-slate-400 font-semibold uppercase">System Control</p>
          </div>
        </div>
        
        <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => {
              setActiveMenuTab('overview');
              setViewingSchool(null);
            }}
            className={`shrink-0 w-auto lg:w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border text-left whitespace-nowrap ${
              activeMenuTab === 'overview'
                ? 'bg-indigo-50 text-indigo-700 border-indigo-100/80 shadow-3xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-transparent bg-transparent'
            }`}
          >
            <KeyRound className="w-4 h-4 text-indigo-650 shrink-0" />
            <span>Overview &amp; Stats</span>
          </button>
          
          <button
            type="button"
            onClick={() => {
              setActiveMenuTab('tenants');
              setViewingSchool(null);
              if (activeDirectoryTab === 'agents' || activeDirectoryTab === 'withdrawals') {
                setActiveDirectoryTab('approved');
              }
            }}
            className={`shrink-0 w-auto lg:w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border text-left relative whitespace-nowrap ${
              activeMenuTab === 'tenants'
                ? 'bg-indigo-50 text-indigo-700 border-indigo-100/80 shadow-3xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-transparent bg-transparent'
            }`}
          >
            <School className="w-4 h-4 text-rose-500 shrink-0" />
            <span>Tenants Directory</span>
             {schools.filter(s => s.approvalStatus === 'approved' && s.subscriptionRequest?.status === 'pending').length > 0 && (
              <span className="ml-2 lg:ml-auto bg-indigo-600 text-white text-[8.5px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                {schools.filter(s => s.approvalStatus === 'approved' && s.subscriptionRequest?.status === 'pending').length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMenuTab('plans_config');
              setViewingSchool(null);
            }}
            className={`shrink-0 w-auto lg:w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border text-left whitespace-nowrap ${
              activeMenuTab === 'plans_config'
                ? 'bg-indigo-50 text-indigo-700 border-indigo-100/80 shadow-3xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-transparent bg-transparent'
            }`}
          >
            <CreditCard className="w-4 h-4 text-purple-600 shrink-0" />
            <span>Plans &amp; Pricing</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMenuTab('onboard');
              setViewingSchool(null);
            }}
            className={`shrink-0 w-auto lg:w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border text-left whitespace-nowrap ${
              activeMenuTab === 'onboard'
                ? 'bg-indigo-50 text-indigo-700 border-indigo-100/80 shadow-3xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-transparent bg-transparent'
            }`}
          >
            <PlusCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Onboard School</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMenuTab('partners');
              setViewingSchool(null);
              setActiveDirectoryTab('agents');
            }}
            className={`shrink-0 w-auto lg:w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border text-left relative whitespace-nowrap ${
              activeMenuTab === 'partners'
                ? 'bg-indigo-50 text-indigo-700 border-indigo-100/80 shadow-3xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-transparent bg-transparent'
            }`}
          >
            <Users className="w-4 h-4 text-teal-600 shrink-0" />
            <span>Referral Partners</span>
            {withdrawals.filter(w => w.status === 'pending').length > 0 && (
              <span className="ml-2 lg:ml-auto bg-purple-500 text-white text-[8.5px] font-black px-1.5 py-0.5 rounded-full animate-bounce">
                {withdrawals.filter(w => w.status === 'pending').length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMenuTab('broadcast');
              setViewingSchool(null);
            }}
            className={`shrink-0 w-auto lg:w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border text-left whitespace-nowrap ${
              activeMenuTab === 'broadcast'
                ? 'bg-indigo-50 text-indigo-700 border-indigo-100/80 shadow-3xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-transparent bg-transparent'
            }`}
          >
            <Bell className="w-4 h-4 text-amber-500 shrink-0" />
            <span>SaaS Broadcasts</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMenuTab('templates');
              setViewingSchool(null);
            }}
            className={`shrink-0 w-auto lg:w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border text-left relative whitespace-nowrap ${
              activeMenuTab === 'templates'
                ? 'bg-indigo-50 text-indigo-700 border-indigo-100/80 shadow-3xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-transparent bg-transparent'
            }`}
          >
            <LayoutGrid className="w-4 h-4 text-indigo-550 shrink-0" />
            <span>Template Gallery</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMenuTab('backups');
              setViewingSchool(null);
            }}
            className={`shrink-0 w-auto lg:w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border text-left whitespace-nowrap ${
              activeMenuTab === 'backups'
                ? 'bg-indigo-50 text-indigo-700 border-indigo-100/80 shadow-3xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-transparent bg-transparent'
            }`}
          >
            <Database className="w-4 h-4 text-indigo-650 shrink-0" />
            <span>System Backups</span>
          </button>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="lg:hidden shrink-0 w-auto flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer border text-rose-600 border-transparent hover:bg-rose-50 hover:text-rose-700 bg-transparent whitespace-nowrap"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Sign Out</span>
            </button>
          )}
        </nav>

        {onLogout && (
          <div className="pt-4 border-t border-slate-100 hidden lg:block">
            <button
              type="button"
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-black text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-all cursor-pointer bg-transparent border-0"
            >
              <LogOut className="w-4.5 h-4.5 shrink-0" />
              <span>Sign Out Node</span>
            </button>
          </div>
        )}
      </aside>

      {/* Right Content Workspace */}
      <div className="flex-1 space-y-6 min-w-0 animate-fadeInOnly">

        {/* Global Floating Notifications */}
        <div className="fixed top-5 right-5 z-[99999] flex flex-col gap-3 pointer-events-none">
          {successInfo && (
            <div className="p-4 bg-emerald-600 text-white text-xs font-bold rounded-2xl flex items-center gap-3 shadow-2xl border border-emerald-500 max-w-sm animate-slideInRight pointer-events-auto">
              <Check className="w-5 h-5 shrink-0 bg-white/20 p-1 rounded-full text-white" />
              <div>{successInfo}</div>
              <button type="button" onClick={() => setSuccessInfo(null)} className="ml-auto text-white/70 hover:text-white font-extrabold text-sm bg-transparent border-0 cursor-pointer">&times;</button>
            </div>
          )}

          {errorInfo && (
            <div className="p-4 bg-rose-600 text-white text-xs font-bold rounded-2xl flex items-center gap-3 shadow-2xl border border-rose-500 max-w-sm animate-slideInRight pointer-events-auto">
              <ShieldAlert className="w-5 h-5 shrink-0 bg-white/20 p-1 rounded-full text-white" />
              <div>{errorInfo}</div>
              <button type="button" onClick={() => setErrorInfo(null)} className="ml-auto text-white/70 hover:text-white font-extrabold text-sm bg-transparent border-0 cursor-pointer">&times;</button>
            </div>
          )}
        </div>
      
      {/* SaaS Dashboard Showcase Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white relative overflow-hidden shadow-xl">
        <div className="absolute top-[-20%] right-[-10%] w-72 h-72 bg-indigo-500 rounded-full blur-[100px] opacity-20 pointer-events-none"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-60 h-60 bg-emerald-500 rounded-full blur-[90px] opacity-10 pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-2 w-full lg:w-auto">
            <div className="flex items-center justify-between gap-4 w-full">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-400 text-[10px] font-bold uppercase tracking-wider">
                <KeyRound className="w-3 h-3" />
                SaaS SaaS Management Central
              </span>
              
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="lg:hidden flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 rounded-xl text-rose-400 text-[10px] font-bold uppercase tracking-wider transition-all duration-205 shadow-md cursor-pointer active:scale-95 shrink-0"
                  title="Sign Out from Master Admin"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Sign Out</span>
                </button>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-black font-sans text-white tracking-tight">
              Main SaaS Admin &amp; Onboarding Console
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Provision independent tenant instances, manage database instances, configure global template presets, and generate secure multi-login dashboards for 100+ schools.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
            <div className="flex gap-4 shrink-0 bg-slate-950/40 p-4 border border-slate-800 rounded-2xl w-full sm:w-auto justify-around">
              <div className="text-center px-4 space-y-0.5">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Total Schools</span>
                <strong className="text-2xl font-mono text-indigo-400">{totalSchoolsCount}</strong>
              </div>
              <div className="w-px bg-slate-800 my-1"></div>
              <div className="text-center px-4 space-y-0.5">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Total Teachers</span>
                <strong className="text-2xl font-mono text-emerald-400">{totalTeachersOnboarded}</strong>
              </div>
            </div>

            {onLogout && (
              <button
                onClick={onLogout}
                id="saas_dashboard_logout_btn"
                className="hidden lg:flex items-center gap-1.5 px-3.5 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 hover:border-rose-500/50 rounded-xl text-rose-400 text-xs font-bold uppercase tracking-wider transition-all duration-200 shadow-md cursor-pointer hover:scale-[1.02] shrink-0"
                title="Sign Out from Master Admin"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cloud Sync Status / Offline Onboarding Recovery Panel */}
      {(() => {
        const unsyncedSchoolsCount = schools.filter(s => s.id.startsWith('sc_') && !cloudSchoolIds.includes(s.id)).length;
        if (unsyncedSchoolsCount > 0) {
          return (
            <div className="bg-amber-50/70 border border-amber-200 rounded-3xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 shadow-sm animate-fadeIn text-left">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-500/10 text-amber-600 rounded-2xl border border-amber-200 shrink-0">
                  <CloudLightning className="w-6 h-6 text-amber-500 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 tracking-tight flex items-center gap-2">
                    ⚠️ Offline Database Onboarding Detected
                  </h4>
                  <p className="text-slate-600 text-xs mt-1 leading-relaxed max-w-2xl font-sans">
                    You registered or onboarded <strong className="text-amber-700 font-bold">{unsyncedSchoolsCount} school account(s)</strong> while the console was in Offline Mode. 
                    These schools exist locally in your browser storage, but their logins and academic deep databases (students, grades, branding) have not been saved permanently to Firestore.
                  </p>
                </div>
              </div>
              <button
                onClick={onSyncUnsyncedSchools}
                disabled={isSyncingAll}
                className="w-full md:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 disabled:from-amber-400 disabled:to-amber-300 text-white font-extrabold text-xs px-5 py-3 rounded-2xl shadow-lg shadow-amber-600/10 active:scale-[0.98] transition-all shrink-0 cursor-pointer"
              >
                {isSyncingAll ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    {syncStatusMessage || "Synchronizing with Cloud..."}
                  </>
                ) : (
                  <>
                    <CloudLightning className="w-4 h-4" />
                    Recover &amp; Sync Local Schools
                  </>
                )}
              </button>
            </div>
          );
        }
        return null;
      })()}

      {/* Overview Tab Content */}
      {activeMenuTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeInOnly">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-3xs space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-650" />
              SaaS Control Overview
            </h3>
            <p className="text-xs text-slate-605 leading-relaxed font-sans">
              Welcome to the SaaS Administration Dashboard. Here you can onboard new schools, manage databases, set affiliate commissions, and chat with partners.
            </p>
            <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-bold">
              <span>Active Registries</span>
              <strong className="text-indigo-600">{schools.length} Schools</strong>
            </div>
          </div>

          <div className="bg-sky-50 border border-sky-100 rounded-3xl p-5 space-y-3 text-xs text-sky-950 shadow-3xs">
            <h4 className="font-extrabold flex items-center gap-1.5 uppercase tracking-wide text-[10px]">
              <Settings className="w-4 h-4 text-sky-600 animate-spin-slow" />
              Onboarding Template Presets
            </h4>
            <p className="text-[11px] text-sky-905/90 leading-relaxed font-sans font-medium">
              When a new school is onboarded, our system automatically clones CBSE primary modules, multi-assessment parameters, and mock student registries. School admins can immediately preview specimen report cards upon login!
            </p>
          </div>
        </div>
      )}

      {/* Onboarding Workspace */}
      {activeMenuTab === 'onboard' && (
        <div className="max-w-4xl mx-auto space-y-6 animate-fadeInOnly w-full">
          {/* Onboarding Panel */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5 text-left">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-indigo-600" />
                SaaS Onboarding Engine
              </h3>
              <span className="bg-indigo-100/50 text-indigo-800 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full">
                New Onboarding Model
              </span>
            </div>

            {successInfo && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold rounded-xl flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                {successInfo}
              </div>
            )}

            {errorInfo && (
              <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                {errorInfo}
              </div>
            )}

            <form onSubmit={handleCreateSchool} className="space-y-5">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Left Column: School Profile Identity & Contacts */}
                <div className="space-y-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-black uppercase text-indigo-700 tracking-wider block">1. School Profile &amp; Contact Details</span>
                  
                  <div className="space-y-3 text-xs">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-gray-500 block">School Name (Official)</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Greenwood Prep High School"
                        value={newSchoolName}
                        onChange={(e) => setNewSchoolName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 bg-white focus:bg-white rounded-lg outline-none font-semibold text-gray-700 focus:ring-2 focus:ring-indigo-500/15"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-gray-500 block">Affiliate Board</label>
                        <select
                          value={newSchoolBoard}
                          onChange={(e) => setNewSchoolBoard(e.target.value)}
                          className="w-full px-2 py-2 border border-gray-200 bg-white rounded-lg outline-none font-bold text-gray-700 focus:ring-2 focus:ring-indigo-500/15"
                        >
                          <option value="CBSE">CBSE Board</option>
                          <option value="ICSE">ICSE Board</option>
                          <option value="State Board">State Board</option>
                          <option value="IB">IB Board</option>
                          <option value="IGCSE">IGCSE Board</option>
                          <option value="Other">Other Board</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-gray-500 block">Contact Person</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Dr. Alok Kumar"
                          value={newSchoolContactPerson}
                          onChange={(e) => setNewSchoolContactPerson(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 bg-white rounded-lg outline-none font-semibold text-gray-700 focus:ring-2 focus:ring-indigo-500/15"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-gray-500 block">Email Address</label>
                        <input
                          type="email"
                          required
                          placeholder="admin@school.com"
                          value={newSchoolEmail}
                          onChange={(e) => setNewSchoolEmail(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 bg-white rounded-lg outline-none font-semibold text-gray-700 font-mono text-xs focus:ring-2 focus:ring-indigo-500/15"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase text-gray-500 block">Mobile Number</label>
                        <input
                          type="text"
                          required
                          placeholder="+91 XXXXX XXXXX"
                          value={newSchoolMobile}
                          onChange={(e) => setNewSchoolMobile(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 bg-white rounded-lg outline-none font-semibold text-gray-700 font-mono text-xs focus:ring-2 focus:ring-indigo-500/15"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-gray-500 block">Registered Physical Address</label>
                      <textarea
                        rows={2}
                        placeholder="Enter full physical address..."
                        value={newSchoolAddress}
                        onChange={(e) => setNewSchoolAddress(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 bg-white rounded-lg outline-none font-medium text-gray-700 text-xs focus:ring-2 focus:ring-indigo-500/15"
                      />
                    </div>


                  </div>
                </div>

                {/* Right Column: Quota Allocation & Access Credentials */}
                <div className="space-y-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between">
                  
                  <div className="space-y-4">
                    <span className="text-[10px] font-black uppercase text-indigo-700 tracking-wider block">2. Plan &amp; Quota Configuration</span>
                    
                    <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-2xl space-y-3">
                      <div className="flex items-center gap-2 text-indigo-850">
                        <Sparkles className="w-4 h-4 text-indigo-650 animate-pulse" />
                        <span className="text-[11px] font-extrabold uppercase tracking-wide">Automatic Plan Selection</span>
                      </div>
                      <p className="text-xs text-slate-650 leading-relaxed font-sans">
                        Newly created school tenants are <strong>approved automatically</strong> and set to <strong>Pending Activation</strong> status.
                      </p>
                      <p className="text-xs text-slate-650 leading-relaxed font-sans">
                        When the school admin logs in for the first time, they will be prompted to select and activate either:
                      </p>
                      <ul className="text-xs text-slate-650 list-disc list-inside space-y-1 pl-1">
                        <li><strong>Sandbox Free Trial</strong> (50 active students quota)</li>
                        <li><strong>Premium Annual Partnership</strong> (Custom license quota &amp; full suite)</li>
                      </ul>
                      <p className="text-[10px] text-indigo-750 italic font-medium leading-normal pt-1 border-t border-indigo-100/50">
                        This aligns SaaS-created accounts with standard self-registered users.
                      </p>
                    </div>
                  </div>

                  {/* Automatic Credential Generator section */}
                  <div className="bg-indigo-50/50 border border-indigo-100/80 p-3 rounded-2xl space-y-2 mt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-indigo-800 font-extrabold uppercase tracking-wide">Generate Tenant Credentials</span>
                      <button
                        type="button"
                        onClick={handleGenerateCredentials}
                        disabled={!newSchoolName}
                        className="text-[9px] font-black text-indigo-700 hover:text-indigo-600 disabled:text-gray-450 bg-indigo-100 hover:bg-indigo-200/50 disabled:bg-gray-150 px-2.5 py-1 rounded transition cursor-pointer flex items-center gap-0.5"
                      >
                        <Sparkles className="w-3 h-3 text-indigo-600" />
                        Randomize Key
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-gray-400 uppercase">School Login ID</label>
                        <input
                          type="text"
                          required
                          placeholder="Set login id..."
                          value={newSchoolUsername}
                          onChange={(e) => setNewSchoolUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                          className="w-full px-2 py-1 text-xs border border-gray-200 bg-white rounded outline-none font-bold text-gray-750 font-mono"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-gray-400 uppercase">Admin Passphrase</label>
                        <input
                          type="text"
                          required
                          placeholder="Passphrase..."
                          value={newSchoolPassword}
                          onChange={(e) => setNewSchoolPassword(e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-gray-200 bg-white rounded outline-none font-bold text-gray-750 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                </div>

              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-3 px-4 rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
              >
                <Database className="w-4 h-4" />
                <span>Onboard School Tenant</span>
              </button>
            </form>
          </div>

          <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 space-y-2 text-xs text-sky-950">
            <h4 className="font-extrabold flex items-center gap-1.5 uppercase tracking-wide text-[10px]">
              <Settings className="w-4 h-4 text-sky-600 animate-spin-slow" />
              Standard Boilerplate Injection
            </h4>
            <p className="text-[11px] text-sky-900/80 leading-relaxed font-sans">
              When a new school is onboarded, our system automatically clones standard grading parameters, multi-assessment score criteria, CBSE primary modules, and three test student profiles. This enables the school admin to preview results immediately upon their very first login!
            </p>
          </div>
        </div>
      )}

      {/* Plans & Pricing Configuration Workspace */}
      {activeMenuTab === 'plans_config' && (
        <div className="max-w-4xl mx-auto space-y-6 animate-fadeInOnly w-full text-left">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-600" />
                SaaS Subscription Plans &amp; Pricing Configurator
              </h3>
              <p className="text-xs text-slate-500 font-sans mt-1">
                Configure limits and automated calculated price tiers for the Free and Premium plans.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Free Plan Limits Info Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                <span className="bg-slate-200 text-slate-800 font-black text-[9px] tracking-wider uppercase px-2 py-0.5 rounded-md inline-block">
                  🆓 PLAN 1: ALWAYS FREE
                </span>
                <h4 className="text-sm font-black text-slate-800">Free Tier Configuration</h4>
                <p className="text-xs text-slate-600 leading-relaxed font-sans">
                  The Free plan is activated immediately upon school registration or anytime without admin approval.
                </p>
                <div className="space-y-2 border-t border-slate-200 pt-3.5">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>Active Student Limit:</span>
                    <span className="font-bold text-slate-900">50 profiles</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>Teacher Limit:</span>
                    <span className="font-bold text-slate-900">1 account</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>Price per Student:</span>
                    <span className="font-bold text-emerald-600 font-mono">₹0 (Free Forever)</span>
                  </div>
                </div>
              </div>

              {/* Premium Plan Setup / Payment Link Card */}
              <div className="bg-indigo-50/40 border border-indigo-100 rounded-2xl p-5 space-y-4">
                <span className="bg-indigo-600 text-white font-black text-[9px] tracking-wider uppercase px-2 py-0.5 rounded-md inline-block">
                  💎 PLAN 2: PREMIUM UPGRADE
                </span>
                <h4 className="text-sm font-black text-slate-800">Premium Gateways Configuration</h4>
                <p className="text-xs text-slate-650 leading-relaxed font-sans">
                  Schools specify their total student strength. The system calculates the price and redirects them to the payment link.
                </p>
                
                <div className="space-y-2 border-t border-indigo-100 pt-3.5">
                  <label className="text-[10px] font-black text-indigo-900 uppercase tracking-wide block">
                    Preset Payment Link URL
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. https://pages.razorpay.com/pl_school_pay"
                    value={globalSettings.presetPaymentLink || ""}
                    onChange={(e) => setGlobalSettings({ ...globalSettings, presetPaymentLink: e.target.value })}
                    className="w-full font-semibold text-xs bg-white border border-slate-200 focus:border-indigo-500 focus:outline-none rounded-lg py-2 px-3 shadow-3xs"
                  />
                  <span className="text-[9px] text-indigo-500 block leading-normal">
                    * Used for the "Pay and activate" redirect link on the school admin desk.
                  </span>
                </div>
              </div>
            </div>

            {/* Premium Range Pricing Config Table */}
            <div className="bg-white border border-slate-150 rounded-2xl p-5 space-y-4">
              <div className="space-y-1">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                  Student Licensing Pricing Tiers
                </h4>
                <p className="text-[10.5px] text-slate-500 font-sans">
                  Configure dynamic per-student rates per year depending on total student strength.
                </p>
              </div>

              <div className="space-y-3.5 pt-2">
                {(globalSettings.pricingTiers || []).map((tier, idx) => (
                  <div key={tier.id || idx} className="bg-slate-50/50 p-3.5 rounded-xl border border-slate-150 space-y-2 text-left">
                    <div className="grid grid-cols-4 gap-3 items-center">
                      <div className="space-y-1">
                        <span className="text-[8px] uppercase font-black text-gray-400 block">Min Students</span>
                        <input
                          type="number"
                          value={tier.minStudents}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 0;
                            const newTiers = [...(globalSettings.pricingTiers || [])];
                            newTiers[idx] = { ...newTiers[idx], minStudents: val };
                            setGlobalSettings({ ...globalSettings, pricingTiers: newTiers });
                          }}
                          className="w-full text-center font-bold font-mono text-xs bg-white border border-slate-200 focus:border-indigo-500 focus:outline-none rounded-lg py-1.5 px-2"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[8px] uppercase font-black text-gray-400 block">Max Students</span>
                        <input
                          type="number"
                          value={tier.maxStudents}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 0;
                            const newTiers = [...(globalSettings.pricingTiers || [])];
                            newTiers[idx] = { ...newTiers[idx], maxStudents: val };
                            setGlobalSettings({ ...globalSettings, pricingTiers: newTiers });
                          }}
                          className="w-full text-center font-bold font-mono text-xs bg-white border border-slate-200 focus:border-indigo-500 focus:outline-none rounded-lg py-1.5 px-2"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[8px] uppercase font-black text-gray-400 block">Rate per Student (₹)</span>
                        <input
                          type="number"
                          value={tier.pricePerStudent}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 0;
                            const newTiers = [...(globalSettings.pricingTiers || [])];
                            newTiers[idx] = { ...newTiers[idx], pricePerStudent: val };
                            setGlobalSettings({ ...globalSettings, pricingTiers: newTiers });
                          }}
                          className="w-full text-center font-bold font-mono text-xs bg-white border border-slate-200 focus:border-indigo-500 focus:outline-none rounded-lg py-1.5 px-2"
                        />
                      </div>
                      <div className="text-right pt-3">
                        <button
                          type="button"
                          onClick={() => {
                            const newTiers = (globalSettings.pricingTiers || []).filter((_, i) => i !== idx);
                            setGlobalSettings({ ...globalSettings, pricingTiers: newTiers });
                          }}
                          className="text-rose-600 hover:text-rose-800 font-extrabold text-[10px] bg-rose-50 hover:bg-rose-100 p-1.5 px-2.5 rounded-lg active:scale-95 transition-all cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1 pt-2 border-t border-slate-100">
                      <span className="text-[8.5px] uppercase font-black text-indigo-500 tracking-wider block">Custom Payment Link URL for this Range</span>
                      <input
                        type="text"
                        placeholder="e.g. https://pages.razorpay.com/pl_sandbox_school_pay_300"
                        value={tier.paymentLink || ""}
                        onChange={(e) => {
                          const newTiers = [...(globalSettings.pricingTiers || [])];
                          newTiers[idx] = { ...newTiers[idx], paymentLink: e.target.value };
                          setGlobalSettings({ ...globalSettings, pricingTiers: newTiers });
                        }}
                        className="w-full font-medium text-xs bg-white border border-slate-200 focus:border-indigo-500 focus:outline-none rounded-lg py-1.5 px-2.5 font-mono"
                      />
                    </div>
                  </div>
                ))}

                {(!globalSettings.pricingTiers || globalSettings.pricingTiers.length === 0) && (
                  <p className="text-center text-slate-400 text-xs py-2">No pricing tiers defined.</p>
                )}

                <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      const newTier = { id: 'tier_' + Math.random().toString(36).substring(2, 9), minStudents: 1, maxStudents: 100, pricePerStudent: 10 };
                      setGlobalSettings({
                        ...globalSettings,
                        pricingTiers: [...(globalSettings.pricingTiers || []), newTier]
                      });
                    }}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-[10.5px] px-3.5 py-1.5 rounded-lg active:scale-95 transition-all cursor-pointer flex items-center gap-1 border border-indigo-200/50"
                  >
                    + Add Pricing Tier
                  </button>

                  <button
                    type="button"
                    disabled={isUpdatingGlobalSettings}
                    onClick={async () => {
                      try {
                        setIsUpdatingGlobalSettings(true);
                        await saveGlobalSettings({
                          universalCommissionPercentage: globalSettings.universalCommissionPercentage,
                          pricingTiers: globalSettings.pricingTiers,
                          presetPaymentLink: globalSettings.presetPaymentLink
                        });
                        setSuccessInfo("Plans and pricing configuration updated successfully!");
                        setTimeout(() => setSuccessInfo(null), 4000);
                      } catch (err) {
                        setErrorInfo("Failed to save plans & pricing configuration.");
                        setTimeout(() => setErrorInfo(null), 4000);
                      } finally {
                        setIsUpdatingGlobalSettings(false);
                      }
                    }}
                    className="bg-indigo-650 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-extrabold text-[11px] px-5 py-2 rounded-xl active:scale-95 transition-all cursor-pointer shadow-sm"
                  >
                    {isUpdatingGlobalSettings ? "Saving Settings..." : "Save Plans & Pricing"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backups Workspace */}
      {activeMenuTab === 'backups' && (
        <div className="max-w-2xl mx-auto space-y-6 animate-fadeInOnly w-full">
          {/* Backup & Restore Panel */}
          <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-xs space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2 border-b border-gray-100 pb-3">
              <Database className="w-4 h-4 text-emerald-600" />
              SaaS High-Safety Backup Desk
            </h3>
            
            <p className="text-[11px] text-gray-500 leading-relaxed">
              To keep performance snappy and payloads light even with thousands of school records, deep backups have been modularized and migrated directly under individual school profiles.
            </p>

            <div className="space-y-2 text-[10.5px] bg-slate-50 p-3 rounded-lg border border-slate-100/80 leading-relaxed text-slate-605">
              <div className="flex items-start gap-1.5">
                <span className="text-indigo-500 font-bold">ℹ</span>
                <span><strong>Modular Backups:</strong> Go to any school profile to download an ultra-lightweight, highly-compressed ZIP snapshot file of that specific school's dataset.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-emerald-500 font-bold">✓</span>
                <span><strong>Flexible Restore Engine:</strong> Select any system-generated backup file below to restore or synchronize academic databases back to the live cloud system.</span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 pt-1">
              <label className={`w-full text-center select-none font-extrabold text-[11px] py-2 px-3 rounded-xl border transition-all flex items-center justify-center gap-1.5 hover:shadow-md cursor-pointer ${
                isBackingUp || isRestoring
                  ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-800'
              }`}>
                {isRestoring ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    <span>Restoring System Data...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5 animate-bounce-slow text-emerald-600" />
                    <span>Restore / Upload Backup File (.zip / .json)</span>
                  </>
                )}
                <input
                  type="file"
                  accept=".json,.zip"
                  onChange={handleRestoreData}
                  disabled={isBackingUp || isRestoring}
                  className="hidden"
                />
              </label>
            </div>

            {restoreProgress && (
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between items-center text-[10px] text-indigo-600 font-bold">
                  <span>Import progress:</span>
                  <span className="animate-pulse">{restoreProgress}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-600 rounded-full animate-pulse w-4/5" />
                </div>
              </div>
            )}

            {backupMessage && (
              <div className={`p-2.5 rounded-xl text-[10.5px] font-sans leading-relaxed border ${
                backupMessage.type === 'success' ? 'bg-emerald-50/80 border-emerald-150 text-emerald-800' : 'bg-rose-50 border-rose-150 text-rose-800'
              }`}>
                {backupMessage.text}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Template Gallery Workspace */}
      {activeMenuTab === 'templates' && (
        <div className="w-full animate-fadeInOnly">
          <TemplateGalleryManager mode="saas" />
        </div>
      )}

      {/* Broadcast Workspace */}
      {activeMenuTab === 'broadcast' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto animate-fadeInOnly w-full items-start">
          {/* Left Column: SaaS Broadcast Desk */}
          <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-gray-150 shadow-xs space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2 border-b border-gray-100 pb-3">
              <Bell className="w-4 h-4 text-indigo-650" />
              SaaS Broadcast Desk
            </h3>
            
            <p className="text-[11px] text-gray-500 leading-relaxed">
              Dispatch targeted notifications or system alerts directly to schools under your tenancy.
            </p>

            {notifSuccessMsg && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-150 rounded-xl text-[11px] text-emerald-800 font-bold flex items-center gap-1.5 animate-fadeIn">
                <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                <span>{notifSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSendBroadcast} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500 block">Notification Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., System Maintenance Active"
                  value={notifTitle}
                  onChange={(e) => setNotifTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 bg-slate-50 focus:bg-white rounded-lg outline-none font-semibold text-gray-700"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500 block">Message Body</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Enter details, trial reminders, or greetings..."
                  value={notifMessage}
                  onChange={(e) => setNotifMessage(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 bg-slate-50 focus:bg-white rounded-lg outline-none font-semibold text-gray-700 font-sans leading-relaxed resize-none"
                />
                <div className="mt-1">
                  <LinkButtonCreator textValue={notifMessage} onTextChange={setNotifMessage} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-500 block">Alert Type</label>
                  <select
                    value={notifType}
                    onChange={(e) => setNotifType(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-gray-200 text-slate-705 font-bold rounded-lg outline-none"
                  >
                    <option value="info">🔵 Info (Blue)</option>
                    <option value="success">🟢 Success (Green)</option>
                    <option value="warning">🟡 Warning (Amber)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-500 block">Recipients</label>
                  <select
                    value={notifRecipientType}
                    onChange={(e) => setNotifRecipientType(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-gray-200 text-slate-705 font-bold rounded-lg outline-none font-sans"
                  >
                    <option value="all">🌐 All Schools</option>
                    <option value="custom">🎯 Select Schools</option>
                  </select>
                </div>
              </div>

              {notifRecipientType === 'custom' && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black uppercase text-gray-400 block">Select Target Schools:</span>
                    {notifSelectedSchools.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setNotifSelectedSchools([])}
                        className="text-[9px] font-extrabold text-indigo-600 hover:text-indigo-800 transition-all cursor-pointer"
                      >
                        Clear selection
                      </button>
                    )}
                  </div>

                  {/* SEARCH BAR */}
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search schools..."
                      value={schoolSearchQuery}
                      onChange={(e) => setSchoolSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 focus:bg-white border border-gray-200 rounded-lg outline-none font-semibold text-gray-700 placeholder-slate-400 transition-all focus:ring-1 focus:ring-indigo-500/20"
                    />
                  </div>

                  <div className="max-h-32 overflow-y-auto border border-slate-100 rounded-lg p-2 bg-slate-50/50 space-y-1 divide-y divide-slate-100">
                    {uniqueSchools
                      .filter(s => s.name.toLowerCase().includes(schoolSearchQuery.toLowerCase()))
                      .map(s => {
                        const isChecked = notifSelectedSchools.includes(s.id);
                        return (
                          <label key={s.id} className="flex items-center gap-2 py-1 text-[11px] font-bold text-slate-800 cursor-pointer select-none hover:text-indigo-600">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setNotifSelectedSchools(notifSelectedSchools.filter(id => id !== s.id));
                                } else {
                                  setNotifSelectedSchools([...notifSelectedSchools, s.id]);
                                }
                              }}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20"
                            />
                            <span className="truncate">{s.name}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[12px] py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Dispatch Broadcast</span>
              </button>
            </form>
          </div>

          {/* Right Column: Broadcast History */}
          <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-gray-150 shadow-xs space-y-4">
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-emerald-600" />
                <span>Broadcast History</span>
              </div>
              <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-full text-[10px] font-black text-slate-600">
                {notifications.length} Total
              </span>
            </h3>

            {notifications.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-1.5">
                <Bell className="w-8 h-8 text-slate-300 mx-auto animate-pulse" />
                <p className="text-xs font-bold">No dispatched broadcasts found.</p>
                <p className="text-[10px] max-w-xs mx-auto text-slate-400 font-medium">Use the desk on the left to dispatch a new targeted notification.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                {notifications.map((notif) => {
                  const isAll = notif.targetSchoolIds.includes('all');
                  const targetsList = notif.targetSchoolIds
                    .map(id => schools.find(s => s.id === id)?.name || id)
                    .join(', ');

                  return (
                    <div key={notif.id} className="p-3.5 bg-slate-50/50 hover:bg-slate-50 border border-slate-150 rounded-xl space-y-2 transition-all">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-1.5">
                          {notif.type === 'success' ? (
                            <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded text-[9px] font-bold uppercase">
                              🟢 Success
                            </span>
                          ) : notif.type === 'warning' ? (
                            <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded text-[9px] font-bold uppercase">
                              🟡 Warning
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded text-[9px] font-bold uppercase">
                              🔵 Info
                            </span>
                          )}
                          <span className="text-[9px] text-slate-400 font-mono">
                            {new Date(notif.sentAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingNotification(notif);
                              setSchoolSearchQuery('');
                            }}
                            className="p-1 hover:bg-slate-200 text-slate-500 hover:text-indigo-600 rounded transition-all cursor-pointer"
                            title="Edit Notification"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteNotification(notif.id)}
                            className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-all cursor-pointer"
                            title="Delete Notification"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h4 className="font-extrabold text-xs text-slate-900 leading-snug">{notif.title}</h4>
                      <div className="text-[11px] text-slate-600 leading-relaxed font-medium">
                        {renderMessageWithLinks(notif.message, false)}
                      </div>

                      <div className="pt-1.5 border-t border-dashed border-slate-150 flex flex-wrap items-center gap-1 text-[9px] font-semibold text-slate-500">
                        <span className="text-slate-400">Recipients:</span>
                        {isAll ? (
                          <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded font-bold">🌐 All Schools</span>
                        ) : (
                          <span 
                            className="bg-blue-50 text-blue-700 px-1.5 py-0.2 rounded font-bold truncate max-w-[250px]" 
                            title={targetsList}
                          >
                            🎯 {notif.targetSchoolIds.length} Schools ({targetsList})
                          </span>
                        )}

                        <span className="text-slate-300 mx-1">|</span>
                        <span className="text-slate-400">Read:</span>
                        <span className="font-bold text-slate-600 font-mono bg-slate-100 px-1 rounded">
                          {notif.readBy?.length || 0}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Schools Directory Central table */}
      {(activeMenuTab === 'tenants' || activeMenuTab === 'partners') && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Left: Directory Column */}
          <div className="xl:col-span-8 space-y-4">
          {/* Trial Period & Amount Configuration Modal */}
          {approvingSchoolId && (
            <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeInOnly">
              <div className="bg-white border border-slate-150 rounded-3xl w-full max-w-3xl space-y-5 shadow-2xl text-slate-900 max-h-[92vh] overflow-y-auto p-6 relative">
                
                {/* Close absolute button */}
                <button 
                  type="button"
                  onClick={() => setApprovingSchoolId(null)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 hover:bg-slate-50 p-1.5 rounded-full transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Modal Header */}
                <div className="flex items-start gap-3 border-b border-gray-100 pb-4">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm uppercase tracking-wider text-slate-900">Approve &amp; Activate Tenant Setup</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                      Align credentials, review core onboarding profile fields, and establish custom system resource limits.
                    </p>
                  </div>
                </div>

                {/* Modal Content - Dual Column Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                  
                  {/* Left Column: School Identity & Contacts */}
                  <div className="space-y-4 bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-black uppercase text-indigo-700 tracking-wider block">1. Institution Profile Details</span>
                    
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase text-gray-500 block">Official School Name</label>
                        <input
                          type="text"
                          required
                          value={schoolNameInput}
                          onChange={(e) => setSchoolNameInput(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 focus:bg-white rounded-lg outline-none font-semibold text-slate-850"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-gray-500 block">Affiliated Board</label>
                          <select
                            value={schoolBoardInput}
                            onChange={(e) => setSchoolBoardInput(e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-200 bg-white rounded-lg outline-none font-bold text-slate-800"
                          >
                            <option value="CBSE">CBSE Board</option>
                            <option value="ICSE">ICSE Board</option>
                            <option value="State Board">State Board</option>
                            <option value="IB">IB Board</option>
                            <option value="IGCSE">IGCSE Board</option>
                            <option value="Other">Other Board</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-gray-500 block">Authorized Representative</label>
                          <input
                            type="text"
                            required
                            placeholder="Principal or Admin Name"
                            value={schoolContactPersonInput}
                            onChange={(e) => setSchoolContactPersonInput(e.target.value)}
                            className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-lg outline-none font-semibold text-slate-850"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-gray-500 block">Secured Email Address</label>
                          <input
                            type="email"
                            required
                            placeholder="admin@school.com"
                            value={schoolEmailInput}
                            onChange={(e) => setSchoolEmailInput(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg outline-none font-semibold text-slate-850 font-mono text-[10.5px]"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-gray-500 block">Registered Mobile No</label>
                          <input
                            type="text"
                            required
                            placeholder="+91 XXXXX XXXXX"
                            value={schoolMobileInput}
                            onChange={(e) => setSchoolMobileInput(e.target.value)}
                            className="w-full px-2.5 py-1.5 border border-slate-200 bg-white rounded-lg outline-none font-semibold text-slate-850 font-mono text-[10.5px]"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase text-gray-500 block">Physical Registered Address</label>
                        <textarea
                          rows={2}
                          placeholder="Complete physical location..."
                          value={schoolAddressInput}
                          onChange={(e) => setSchoolAddressInput(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 bg-white rounded-lg outline-none font-medium text-slate-800 leading-normal"
                        />
                      </div>


                    </div>
                  </div>

                  {/* Right Column: Partnership & Resource Quotas */}
                  <div className="space-y-4 bg-slate-50/70 p-4 rounded-2xl border border-slate-100 flex flex-col justify-between">
                    <div className="space-y-4">
                      <span className="text-[10px] font-black uppercase text-indigo-700 tracking-wider block">2. Partnership &amp; Quota Settings</span>
                      
                      {/* Partnership Type Toggle */}
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-bold uppercase text-gray-500 block">Partnership Tier</label>
                        <div className="grid grid-cols-2 gap-1.5 bg-slate-200 p-1 rounded-xl border border-slate-300">
                          <button
                            type="button"
                            onClick={() => handlePartnershipTypeChange('trial')}
                            className={`py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer ${
                              partnershipTypeInput === 'trial'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-800'
                            }`}
                          >
                            Sandbox Trial
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePartnershipTypeChange('annual')}
                            className={`py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer ${
                              partnershipTypeInput === 'annual'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-800'
                            }`}
                          >
                            Annual Partnership
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-gray-500 block">
                            {partnershipTypeInput === 'annual' ? 'Partnership Expiry' : 'Trial Expiry'}
                          </label>
                          <input
                            type="date"
                            required
                            value={trialUntilInput}
                            onChange={(e) => setTrialUntilInput(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 bg-white rounded-lg outline-none font-bold text-slate-800 font-mono"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase text-gray-500 block">
                            {partnershipTypeInput === 'annual' ? 'Partnership Price' : 'Post-Trial Charge'}
                          </label>
                          <input
                            type="text"
                            required
                            placeholder={partnershipTypeInput === 'annual' ? '₹49,999/year' : '₹4,999/month'}
                            value={trialPriceInput}
                            onChange={(e) => setTrialPriceInput(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs border border-slate-200 bg-white rounded-lg outline-none font-bold text-slate-800 font-mono"
                          />
                        </div>
                      </div>

                      {/* Quotas Grid */}
                      <div className="space-y-2 border-t border-gray-200 pt-3">
                        <span className="text-[10px] font-black uppercase text-indigo-750 tracking-wider block">Resource Limit Caps</span>
                        
                        <div className="grid grid-cols-2 gap-2.5">
                          <div className="space-y-1 bg-white p-2 rounded-xl border border-slate-150">
                            <label className="text-slate-500 block text-[8px] uppercase font-bold leading-none mb-1">Max Active Students</label>
                            <input
                              type="number"
                              min="1"
                              value={maxStudentsLimitInput}
                              onChange={(e) => setMaxStudentsLimitInput(parseInt(e.target.value, 10) || 50)}
                              className="w-full bg-slate-50 border border-slate-100 rounded-lg py-1 text-center font-bold font-mono text-slate-900 focus:outline-none focus:bg-white text-xs"
                            />
                          </div>

                          <div className="space-y-1 bg-amber-50 p-2 rounded-xl border border-amber-150">
                            <label className="text-amber-800 block text-[8px] uppercase font-bold leading-none mb-1">Max Cumulative Regs</label>
                            <input
                              type="number"
                              min="1"
                              value={maxCumulativeStudentsLimitInput}
                              onChange={(e) => setMaxCumulativeStudentsLimitInput(parseInt(e.target.value, 10) || 100)}
                              className="w-full bg-white border border-amber-200 rounded-lg py-1 text-center font-bold font-mono text-amber-950 focus:outline-none text-xs"
                            />
                          </div>

                          <div className="space-y-1 bg-white p-2 rounded-xl border border-slate-150">
                            <label className="text-slate-500 block text-[8px] uppercase font-bold leading-none mb-1">Max Teachers Accounts</label>
                            <input
                              type="number"
                              min="1"
                              value={maxTeachersLimitInput}
                              onChange={(e) => setMaxTeachersLimitInput(parseInt(e.target.value, 10) || 10)}
                              className="w-full bg-slate-50 border border-slate-100 rounded-lg py-1 text-center font-bold font-mono text-slate-900 focus:outline-none focus:bg-white text-xs"
                            />
                          </div>

                          <div className="space-y-1 bg-white p-2 rounded-xl border border-slate-150">
                            <label className="text-slate-500 block text-[8px] uppercase font-bold leading-none mb-1">Max Custom Layouts</label>
                            <input
                              type="number"
                              min="1"
                              value={maxStructuresLimitInput}
                              onChange={(e) => setMaxStructuresLimitInput(parseInt(e.target.value, 10) || 5)}
                              className="w-full bg-slate-50 border border-slate-100 rounded-lg py-1 text-center font-bold font-mono text-slate-900 focus:outline-none focus:bg-white text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-gray-200">
                      <button
                        type="button"
                        onClick={() => setApprovingSchoolId(null)}
                        className="w-full bg-slate-150 hover:bg-slate-200 text-slate-700 font-extrabold text-xs py-2 px-4 rounded-xl transition cursor-pointer text-center"
                      >
                        Cancel Setup
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmApprove}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-2 px-4 rounded-xl shadow-lg shadow-indigo-600/10 cursor-pointer text-center hover:shadow-indigo-600/20 active:scale-[0.98] transition-all"
                      >
                        Approve &amp; Activate
                      </button>
                    </div>
                  </div>

                </div>

              </div>
            </div>
          )}

          {selectedAgentForSchools && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
              <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[85vh] overflow-y-auto border border-slate-100 shadow-2xl p-6 text-slate-900 space-y-6">
                
                {/* Header */}
                <div className="flex justify-between items-center pb-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-teal-50 text-teal-650 rounded-xl">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-950 uppercase tracking-wider">
                        Referred Schools Directory
                      </h3>
                      <p className="text-[11px] text-gray-500 font-medium">
                        Onboarded by partner agent <strong className="text-slate-800 font-bold">{selectedAgentForSchools.name}</strong> ({selectedAgentForSchools.code})
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedAgentForSchools(null)}
                    className="p-1.5 hover:bg-slate-50 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Body - School List (View Only) */}
                {(() => {
                  const referredSchools = schools.filter(s => 
                    s.referredByAgentId === selectedAgentForSchools.id || 
                    (s.referredByAgentCode && s.referredByAgentCode.toUpperCase() === selectedAgentForSchools.code.toUpperCase())
                  );

                  if (referredSchools.length === 0) {
                    return (
                      <div className="py-12 text-center text-slate-400 space-y-2">
                        <School className="w-10 h-10 text-slate-300 mx-auto" />
                        <p className="text-xs font-semibold">This agent has not referred or onboarded any schools yet.</p>
                        <p className="text-[10px] text-gray-500 font-medium">Share the registration link with code <span className="font-mono bg-slate-100 p-0.5 rounded font-bold">{selectedAgentForSchools.code}</span> to get credit.</p>
                      </div>
                    );
                  }

                  const annualCount = referredSchools.filter(s => s.partnershipType === 'annual').length;
                  const trialCount = referredSchools.filter(s => s.partnershipType !== 'annual').length;

                  return (
                    <div className="space-y-4">
                      {/* Stats Overview */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
                          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total Onboarded</div>
                          <div className="text-lg font-black text-slate-900">{referredSchools.length}</div>
                        </div>
                        <div className="p-3 bg-emerald-50/50 border border-emerald-100/50 rounded-xl text-center">
                          <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Annual Subscriptions</div>
                          <div className="text-lg font-black text-emerald-800">{annualCount}</div>
                        </div>
                        <div className="p-3 bg-teal-50/50 border border-teal-100/50 rounded-xl text-center">
                          <div className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">Sandbox Trials</div>
                          <div className="text-lg font-black text-teal-800">{trialCount}</div>
                        </div>
                      </div>

                      {/* Schools Table */}
                      <div className="border border-gray-150 rounded-xl overflow-x-auto shadow-xs">
                        <table className="w-full border-collapse text-left text-xs bg-white">
                          <thead>
                            <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-150 select-none">
                              <th className="p-3">School Name</th>
                              <th className="p-3">Registration ID</th>
                              <th className="p-3">Contact Person & Email</th>
                              <th className="p-3">Onboarded At</th>
                              <th className="p-3 text-center">Plan Type</th>
                              <th className="p-3 text-center">Expiry</th>
                              <th className="p-3 text-center">Commission Earned</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {referredSchools.map(school => {
                              const basePrice = (school.partnershipType === 'annual' && school.approvalStatus === 'approved') ? (school.annualPrice || 0) : 0;
                              const commissionAmount = basePrice * (selectedAgentForSchools.commissionPercentage || 10) / 100;
                              
                              return (
                                <tr key={school.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="p-3 font-extrabold text-slate-900">
                                    {school.name}
                                  </td>
                                  <td className="p-3 font-mono font-bold text-[10px] text-slate-500">
                                    {school.username}
                                  </td>
                                  <td className="p-3">
                                    <div className="font-semibold text-slate-800">{school.contactPerson || 'N/A'}</div>
                                    <div className="text-slate-500 text-[10px]">{school.email || 'N/A'}</div>
                                  </td>
                                  <td className="p-3 text-slate-500">
                                    {school.createdAt ? new Date(school.createdAt).toLocaleDateString() : 'N/A'}
                                  </td>
                                  <td className="p-3 text-center">
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${
                                      school.partnershipType === 'annual'
                                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                        : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                    }`}>
                                      {school.partnershipType === 'annual' ? '🌟 Annual' : '🧪 Trial'}
                                    </span>
                                  </td>
                                  <td className="p-3 text-center text-slate-500 font-medium">
                                    {school.trialUntil ? new Date(school.trialUntil).toLocaleDateString() : 'N/A'}
                                  </td>
                                  <td className="p-3 text-center font-black text-emerald-600 font-mono">
                                    ₹{commissionAmount.toLocaleString('en-IN')}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-[10px] text-gray-400 italic text-center">
                        Note: Agents have view-only access to referred school accounts to ensure administrative isolation.
                      </p>
                    </div>
                  );
                })()}

                {/* Footer close button */}
                <div className="flex justify-end pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setSelectedAgentForSchools(null)}
                    className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-all"
                  >
                    Close Directory
                  </button>
                </div>

              </div>
            </div>
          )}

          {viewingSchool ? (
            /* RESPONSIVE INLINE SCHOOL PROFILE DETAILS - NO POP LIKE */
            <div className="bg-white rounded-3xl p-6 border border-gray-150 shadow-xs space-y-6 animate-fadeIn text-slate-900">
              {/* Profile Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setViewingSchool(null)}
                    className="p-2 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl transition cursor-pointer flex items-center justify-center"
                    title="Return to SaaS Directory"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-extrabold text-lg text-slate-900">{viewingSchool.name}</h3>
                      {viewingSchool.partnershipType === 'annual' ? (
                        <span className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded-full select-none shadow-xs">
                          <Sparkles className="w-2.5 h-2.5 text-indigo-500" />
                          Annual Partnership
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full select-none shadow-xs">
                          Sandbox Trial
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-mono">Tenant ID: {viewingSchool.id}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      onImpersonateSchool(viewingSchool.id);
                      setViewingSchool(null);
                    }}
                    className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs py-2 px-4 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-lg transition-transform active:scale-[0.99]"
                  >
                    <span>Impersonate Tenant</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Profile details grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Column 1: Identity & Contacts */}
                <div className="space-y-4">
                  {/* Administrative Header */}
                  <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-indigo-500" />
                      <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">Access Credentials</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-gray-400 block text-[9px] uppercase">Registered ID (User)</span>
                        <strong className="text-slate-800 font-mono select-all text-[11px]">{viewingSchool.username}</strong>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[9px] uppercase">Client Passphrase</span>
                        <strong className="text-slate-800 font-mono select-all text-[11px]">{viewingSchool.password}</strong>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[9px] uppercase">Parents Portal Code</span>
                        <strong className="text-indigo-650 font-mono select-all text-[11px]">{viewingSchool.portalCode || "Not generated"}</strong>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[9px] uppercase">SaaS Impersonation Pin</span>
                        <strong className="text-emerald-600 font-mono select-all text-[11px]">{viewingSchool.saasOwnerPin || "None set"}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Contact Grid */}
                  <div className="space-y-3">
                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Official Registration & Contacts</span>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                        <span className="text-gray-400 text-[9px] uppercase">Authorized Representative</span>
                        <p className="font-extrabold text-slate-800 mt-0.5">{viewingSchool.contactPerson || "Not recorded"}</p>
                      </div>
                      <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                        <span className="text-gray-400 text-[9px] uppercase">Registered Affiliate Board</span>
                        <p className="font-extrabold text-slate-800 mt-0.5">{viewingSchool.board || "Not specified"}</p>
                      </div>
                      <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                        <span className="text-gray-400 text-[9px] uppercase">Secured Email Address</span>
                        <p className="font-mono font-bold text-slate-800 mt-0.5 select-all text-[10.5px] truncate">{viewingSchool.email || "No email"}</p>
                      </div>
                      <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                        <span className="text-gray-400 text-[9px] uppercase">Registered Mobile No</span>
                        <p className="font-mono font-bold text-slate-800 mt-0.5 select-all text-[10.5px]">{viewingSchool.mobile || "No number"}</p>
                      </div>
                      <div className="col-span-2 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                        <span className="text-gray-400 text-[9px] uppercase">Physical Registered Address</span>
                        <p className="font-bold text-slate-700 mt-0.5 italic text-xs leading-relaxed">{viewingSchool.address || "No address listed on record"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Active Assets Indicators */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 text-center">
                      <span className="text-gray-400 text-[9px] uppercase block">Staff Registry Size</span>
                      <strong className="text-slate-800 text-sm font-mono block mt-1">{viewingSchool.teachers?.length || 0} Teachers</strong>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 text-center">
                      <span className="text-gray-400 text-[9px] uppercase block">Custom Design Layouts</span>
                      <strong className="text-slate-800 text-sm font-mono block mt-1">{viewingSchool.reportCardStructures?.length || 1} Standard</strong>
                    </div>
                  </div>
                </div>

                {/* Column 2: Simplified Plan & Payment Settings */}
                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-150 p-5 rounded-2xl space-y-4">
                    <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider block">Plan &amp; Payment Settings</span>
                    
                    {/* Partnership Type Toggle: Show only Premium Annual Section */}
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase text-gray-500 block">Active Plan Configuration</label>
                      
                      {viewingSchool.partnershipType === 'annual' ? (
                        <div className="bg-indigo-50 border-2 border-indigo-200 p-4 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-indigo-700 uppercase tracking-wider flex items-center gap-1.5 font-sans">
                              <Sparkles className="w-4 h-4 text-amber-500" />
                              <span>Premium Annual Suite</span>
                            </span>
                            <span className="bg-indigo-600 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                              Active
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-normal font-sans">
                            This school is configured under the full Premium Annual Partnership.
                          </p>
                        </div>
                      ) : (
                        <div className="bg-slate-100 border border-slate-200 p-4 rounded-xl space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
                              Premium Annual Suite
                            </span>
                            <span className="bg-slate-400 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                              Inactive
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 leading-normal font-sans">
                            Activate the annual plan with full student license quotas and unlimited teacher profiles.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              const oneYearFuture = new Date();
                              oneYearFuture.setFullYear(oneYearFuture.getFullYear() + 1);
                              const reqCount = viewingSchool.subscriptionRequest?.studentCount || 500;
                              setViewingSchool({
                                ...viewingSchool,
                                partnershipType: 'annual',
                                maxStudentsLimit: reqCount,
                                maxCumulativeStudentsLimit: Math.floor(reqCount * 1.5),
                                maxTeachersLimit: 1000,
                                maxStructuresLimit: 50,
                                trialUntil: oneYearFuture.toISOString().split('T')[0],
                                trialPrice: `₹${((viewingSchool.subscriptionRequest?.calculatedTotal) || (reqCount * 15)).toLocaleString()}/year`
                              });
                            }}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase py-2 px-3 rounded-lg transition-all cursor-pointer text-center"
                          >
                            Activate Annual Plan
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Direct Quota & Expiry Editors */}
                    <div className="bg-white border-2 border-slate-100 p-4 rounded-xl space-y-3 text-left">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Users className="w-4 h-4 text-indigo-500" />
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">Override School Plan Quotas</span>
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-gray-500 block">Licensed Students</label>
                          <input
                            type="number"
                            value={viewingSchool.maxStudentsLimit || 50}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value, 10) || 0);
                              setViewingSchool({
                                ...viewingSchool,
                                maxStudentsLimit: val
                              });
                            }}
                            className="w-full text-left font-bold font-mono text-xs bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:outline-none rounded-lg py-1.5 px-2.5"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-rose-800 block font-bold">Cumulative Limit</label>
                          <input
                            type="number"
                            value={viewingSchool.maxCumulativeStudentsLimit || 100}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value, 10) || 0);
                              setViewingSchool({
                                ...viewingSchool,
                                maxCumulativeStudentsLimit: val
                              });
                            }}
                            className="w-full text-left font-bold font-mono text-xs bg-rose-50 border border-rose-200 focus:border-rose-500 focus:outline-none rounded-lg py-1.5 px-2.5 text-rose-950 font-bold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-gray-500 block">Max Teachers</label>
                          <input
                            type="number"
                            value={viewingSchool.maxTeachersLimit || (viewingSchool.partnershipType === 'annual' ? 1000 : 1)}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value, 10) || 0);
                              setViewingSchool({
                                ...viewingSchool,
                                maxTeachersLimit: val
                              });
                            }}
                            className="w-full text-left font-bold font-mono text-xs bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:outline-none rounded-lg py-1.5 px-2.5"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-gray-500 block">Subscription Expiry</label>
                          <input
                            type="date"
                            value={viewingSchool.trialUntil || ""}
                            onChange={(e) => {
                              setViewingSchool({
                                ...viewingSchool,
                                trialUntil: e.target.value
                              });
                            }}
                            className="w-full text-left font-bold font-mono text-xs bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:outline-none rounded-lg py-1.5 px-2.5"
                          />
                        </div>
                      </div>

                      <div className="text-[8.5px] text-slate-500 leading-normal font-sans pt-1">
                        * Note: Changes will be applied instantly to student limits and synchronized with the school's Billing panel when you save.
                      </div>
                    </div>

                    {/* Quota limits managed dynamically via Subscription Request */}

                    {/* Subscription Request Status Controls */}
                    {viewingSchool.subscriptionRequest ? (
                      <div className="bg-amber-50/50 border border-amber-250 rounded-xl p-3.5 space-y-3">
                        <div className="flex justify-between items-center pb-2 border-b border-amber-200/50 text-[10px] font-black uppercase tracking-wider text-amber-800 font-mono">
                          <span>🔔 Active Upgrade Request</span>
                          <span className="bg-amber-100 border border-amber-300 text-amber-800 px-1.5 py-0.5 rounded text-[10px]">
                            {viewingSchool.subscriptionRequest.studentCount} Students
                          </span>
                        </div>
                        
                        {/* Payment Status Group */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-amber-700 block">SaaS Payment Status Selector</label>
                          <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-lg border border-amber-250">
                            <button
                              type="button"
                              onClick={() => {
                                const currentReq = viewingSchool.subscriptionRequest;
                                if (currentReq) {
                                  setViewingSchool({
                                    ...viewingSchool,
                                    subscriptionRequest: {
                                      ...currentReq,
                                      paymentStatus: 'pending',
                                      status: 'pending',
                                      verificationMessage: "His payment status is being verified and will be updated within 24 hours. Till then the school admin will use the free plan only."
                                    }
                                  });
                                }
                              }}
                              className={`py-1 text-[9px] font-black uppercase rounded-md transition-all cursor-pointer ${
                                (viewingSchool.subscriptionRequest?.paymentStatus || 'pending') === 'pending'
                                  ? 'bg-amber-500 text-white shadow-xs'
                                  : 'text-amber-800 hover:bg-amber-100'
                              }`}
                            >
                              Pending
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const currentReq = viewingSchool.subscriptionRequest;
                                if (currentReq) {
                                  // Auto-set the trial limits and plan type
                                  const oneYearFuture = new Date();
                                  oneYearFuture.setFullYear(oneYearFuture.getFullYear() + 1);
                                  const reqCount = currentReq.studentCount || 500;
                                  setViewingSchool({
                                    ...viewingSchool,
                                    partnershipType: 'annual',
                                    maxStudentsLimit: reqCount,
                                    maxCumulativeStudentsLimit: Math.floor(reqCount * 1.5),
                                    maxTeachersLimit: 1000,
                                    maxStructuresLimit: 50,
                                    trialUntil: oneYearFuture.toISOString().split('T')[0],
                                    trialPrice: `₹${currentReq.calculatedTotal.toLocaleString()}/year`,
                                    subscriptionRequest: {
                                      ...currentReq,
                                      paymentStatus: 'success',
                                      status: 'approved',
                                      verificationMessage: "🎉 Payment successfully verified! Full Premium partnership plan has been activated successfully."
                                    }
                                  });
                                }
                              }}
                              className={`py-1 text-[9px] font-black uppercase rounded-md transition-all cursor-pointer ${
                                viewingSchool.subscriptionRequest?.paymentStatus === 'success' || viewingSchool.subscriptionRequest?.status === 'approved'
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'text-emerald-800 hover:bg-emerald-100'
                              }`}
                            >
                              Success
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const currentReq = viewingSchool.subscriptionRequest;
                                if (currentReq) {
                                  setViewingSchool({
                                    ...viewingSchool,
                                    subscriptionRequest: {
                                      ...currentReq,
                                      paymentStatus: 'failed',
                                      status: 'rejected',
                                      verificationMessage: "❌ Subscription Payment Failed: The transaction could not be processed or verified. Please contact support or try paying again."
                                    }
                                  });
                                }
                              }}
                              className={`py-1 text-[9px] font-black uppercase rounded-md transition-all cursor-pointer ${
                                viewingSchool.subscriptionRequest?.paymentStatus === 'failed' || viewingSchool.subscriptionRequest?.status === 'rejected'
                                  ? 'bg-rose-600 text-white shadow-xs'
                                  : 'text-rose-800 hover:bg-rose-100'
                              }`}
                            >
                              Failed
                            </button>
                          </div>
                        </div>

                        {/* Editable Verification Message */}
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-amber-700 block">Admin Verification Status Message</label>
                          <textarea
                            rows={3}
                            value={viewingSchool.subscriptionRequest.verificationMessage || ""}
                            onChange={(e) => {
                              const currentReq = viewingSchool.subscriptionRequest;
                              if (currentReq) {
                                setViewingSchool({
                                  ...viewingSchool,
                                  subscriptionRequest: {
                                    ...currentReq,
                                    verificationMessage: e.target.value
                                  }
                                });
                              }
                            }}
                            className="w-full bg-white border border-amber-250 rounded-lg p-2 font-medium text-[11px] text-amber-900 focus:outline-none focus:border-amber-500 leading-relaxed"
                            placeholder="Enter message visible to the school admin..."
                          />
                          <p className="text-[8px] text-amber-600 font-bold leading-normal">
                            This custom message is displayed live in the school admin dashboard's Billing panel.
                          </p>
                        </div>
                      </div>
                    ) : (
                      // If no active request, allow adding/seeding a pending payment tracker
                      <div className="bg-slate-100 rounded-xl p-3 border border-slate-200 text-center">
                        <p className="text-[10px] text-slate-500 font-bold italic">
                          No active subscription upgrade requests found for this school.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setViewingSchool({
                              ...viewingSchool,
                              subscriptionRequest: {
                                studentCount: viewingSchool.maxStudentsLimit || 100,
                                calculatedTotal: 15000,
                                status: 'pending',
                                paymentStatus: 'pending',
                                verificationMessage: "His payment status is being verified and will be updated within 24 hours. Till then the school admin will use the free plan only.",
                                requestedAt: new Date().toISOString()
                              }
                            });
                          }}
                          className="mt-1.5 text-[9px] font-black bg-white hover:bg-slate-50 text-indigo-650 px-2.5 py-1 rounded border border-slate-200 cursor-pointer transition"
                        >
                          + Seed Upgrade Request Form
                        </button>
                      </div>
                    )}

                    {/* Basic counters display */}
                    <div className="bg-slate-200/50 p-2.5 rounded-lg text-[9px] font-black text-slate-650 flex justify-between items-center uppercase tracking-wide">
                      <span>Active Students: <strong className="text-slate-900">{viewingSchool.activeStudentsCount || 0}</strong> / <strong className="text-slate-900">{viewingSchool.maxStudentsLimit || 50}</strong></span>
                    </div>
                  </div>
                    
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const finalSchool = {
                            ...viewingSchool,
                            annualPrice: viewingSchool.partnershipType === 'annual' ? parsePrice(viewingSchool.trialPrice) : 0
                          };
                          await saveSaaSSchoolToCloud(finalSchool, finalSchool.ownerId || "default-owner");
                          const updated = schools.map(s => s.id === finalSchool.id ? finalSchool : s);
                          onUpdateSchools(updated);
                          setViewingSchool(finalSchool);
                          alert(`Successfully synchronized and saved subscription and record limits for ${finalSchool.name} to Cloud Firestore!`);
                        } catch (err: any) {
                          console.error("Cloud plan save failure:", err);
                          alert(`Failed to save plan changes to Cloud: ${err.message || err}`);
                        }
                      }}
                      className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] uppercase tracking-wider py-2 px-3 rounded-lg transition-colors cursor-pointer"
                    >
                      Save Changes &amp; Sync Plan Limits
                    </button>

                  {/* SOLUTION 1 & 2: HIGHLY COMPRESSED LOCAL ZIP BACKUP */}
                  <div className="bg-emerald-50/50 border border-emerald-150 p-4 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-emerald-600 animate-pulse" />
                      <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider">Academic Database Backup (Solution 1 + 2)</span>
                    </div>
                    
                    <p className="text-[10.5px] text-slate-600 leading-relaxed font-sans">
                      To keep global SaaS backups incredibly lightweight, we back up schools individually. This extracts all academic datasets (students, assessment sheets, custom layout structures, and brandings) and compresses it into an ultra-light, highly secure <strong>ZIP archive file</strong>.
                    </p>

                    {singleBackupSuccess && (
                      <div className="p-2.5 bg-emerald-100/50 border border-emerald-200 text-emerald-800 text-[10.5px] font-bold rounded-xl flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                        <span>{singleBackupSuccess}</span>
                      </div>
                    )}

                    {singleBackupError && (
                      <div className="p-2.5 bg-rose-50 border border-rose-150 text-rose-800 text-[10.5px] font-bold rounded-xl flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                        <span>{singleBackupError}</span>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleBackupSingleSchool(viewingSchool)}
                        disabled={isBackingUpSingle || isRestoringSingle}
                        className="flex-1 bg-slate-950 hover:bg-slate-850 disabled:bg-slate-400 text-white font-extrabold text-[11px] py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                      >
                        {isBackingUpSingle ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Compressing...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" />
                            <span>Download ZIP Backup</span>
                          </>
                        )}
                      </button>

                      <label className={`flex-1 text-center font-extrabold text-[11px] py-2 px-3 rounded-xl border transition flex items-center justify-center gap-1.5 cursor-pointer select-none ${
                        isBackingUpSingle || isRestoringSingle
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-800'
                      }`}>
                        {isRestoringSingle ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                            <span>Restoring...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Restore ZIP / JSON</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept=".zip,.json"
                          onChange={(e) => handleRestoreSingleSchool(e, viewingSchool)}
                          disabled={isBackingUpSingle || isRestoringSingle}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                </div>

              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-5 border border-gray-150 shadow-xs space-y-4">
            
            {/* Search Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  {activeMenuTab === 'tenants' ? (
                    <>
                      <School className="w-4 h-4 text-rose-500" />
                      SaaS Tenants Directory
                    </>
                  ) : (
                    <>
                      <Users className="w-4 h-4 text-teal-600" />
                      Referral Partners Desk
                    </>
                  )}
                </h3>
                <p className="text-[11px] text-gray-500">
                  {activeMenuTab === 'tenants'
                    ? "Search and manage credentials of schools running on your report card architecture."
                    : "Manage referral agents, customized commission rates, and commission payouts."}
                </p>
              </div>
              
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder={activeMenuTab === 'tenants' ? "Search school name or ID..." : "Search partner name..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 bg-slate-50 focus:bg-white rounded-lg outline-none font-semibold text-gray-700 focus:ring-2 focus:ring-indigo-500/15"
                />
              </div>
            </div>

            {/* Directory Tab Selector */}
            <div className="flex border-b border-gray-100 pb-1.5 gap-2 select-none overflow-x-auto">
              {activeMenuTab === 'tenants' ? (
                <>
                  <button
                    type="button"
                    onClick={() => { setActiveDirectoryTab('approved'); setSearchTerm(''); }}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all shrink-0 ${
                      activeDirectoryTab === 'approved'
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    🏫 Registered Schools ({schools.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveDirectoryTab('upgrades'); setSearchTerm(''); }}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all shrink-0 relative ${
                      activeDirectoryTab === 'upgrades'
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    💎 Pending Upgrades ({schools.filter(s => s.approvalStatus === 'approved' && s.subscriptionRequest?.status === 'pending').length})
                    {schools.some(s => s.approvalStatus === 'approved' && s.subscriptionRequest?.status === 'pending') && (
                      <span className="absolute top-0 right-0 w-2 h-2 bg-rose-500 rounded-full animate-ping"></span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveDirectoryTab('recycle_bin'); setSearchTerm(''); }}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all shrink-0 ${
                      activeDirectoryTab === 'recycle_bin'
                        ? 'bg-rose-50 text-rose-700 border border-rose-100'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    ♻️ SaaS Recycle Bin ({saasRecycleBin.length})
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => { setActiveDirectoryTab('agents'); setSearchTerm(''); }}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all shrink-0 ${
                      activeDirectoryTab === 'agents'
                        ? 'bg-teal-50 text-teal-700 border border-teal-100'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    👥 Referral Partners Desk ({agents.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveDirectoryTab('withdrawals'); setSearchTerm(''); }}
                    className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all shrink-0 relative ${
                      activeDirectoryTab === 'withdrawals'
                        ? 'bg-purple-50 text-purple-700 border border-purple-100'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    💰 Payout Requests ({withdrawals.filter(w => w.status === 'pending').length})
                    {withdrawals.some(w => w.status === 'pending') && (
                      <span className="absolute top-0 right-0 w-2 h-2 bg-purple-500 rounded-full animate-ping"></span>
                    )}
                  </button>
                </>
              )}
            </div>

            {/* Table or Agents */}
            {activeDirectoryTab === 'agents' ? (
              <div className="space-y-4">
                {/* Agents Header & Search */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-teal-600" />
                      Referral Partnership & Commission Desk
                    </h4>
                    <p className="text-[10.5px] text-slate-500 mt-0.5">Manage agents, set their customized commission rates, update bank payout credentials, and verify referred schools.</p>
                  </div>
                  <div className="w-full sm:w-64">
                    <input
                      type="text"
                      placeholder="Search agents by name, email, code..."
                      value={agentSearchTerm}
                      onChange={(e) => setAgentSearchTerm(e.target.value)}
                      className="w-full pl-3 pr-3 py-1 text-xs border border-gray-200 bg-white rounded-lg outline-none font-semibold text-gray-700 focus:ring-2 focus:ring-teal-500/15"
                    />
                  </div>
                </div>

                {/* Public Partner Registration URL Box */}
                <div className="bg-teal-50/40 border border-teal-150/60 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-left">
                  <div className="space-y-1">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-100 text-teal-800 text-[9px] font-bold uppercase rounded">
                      🔗 Private Agent Portal URL
                    </span>
                    <h5 className="text-xs font-bold text-slate-800">Separate Partner Signup &amp; Login Link</h5>
                    <p className="text-[10.5px] text-slate-500 font-sans">
                      Copy and share this dedicated link with agents. They can use it to sign up, log in, view analytics, and generate their referral code links.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                    <div className="bg-white border border-gray-200 text-slate-700 font-mono text-[10.5px] px-3 py-1.5 rounded-lg select-all max-w-[280px] truncate">
                      {window.location.origin + window.location.pathname + "?portal=partner"}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const link = window.location.origin + window.location.pathname + "?portal=partner";
                        navigator.clipboard.writeText(link);
                        setCopiedPartnerLink(true);
                        setTimeout(() => setCopiedPartnerLink(false), 3000);
                      }}
                      className="flex items-center gap-1 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-[10.5px] px-3.5 py-1.5 rounded-lg active:scale-95 transition-all cursor-pointer"
                    >
                      {copiedPartnerLink ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Universal Commission Percentage Setting Section */}
                <div className="bg-gradient-to-r from-teal-500/10 to-emerald-500/10 border border-teal-200/50 p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-left shadow-xs">
                  <div className="space-y-1">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-[9px] font-black uppercase rounded-md shadow-3xs">
                      ⚙️ Global Setting
                    </span>
                    <h5 className="text-xs font-black text-slate-800">Universal Partner Commission Percentage</h5>
                    <p className="text-[10.5px] text-slate-600 font-sans">
                      Set the default commission percentage for all referral partners. Individual agents' customized rates will override this value.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 w-full md:w-auto shrink-0 bg-white p-2 rounded-xl border border-teal-100 shadow-3xs">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={globalSettings.universalCommissionPercentage}
                        onChange={(e) => {
                          const val = Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0));
                          setGlobalSettings({ universalCommissionPercentage: val });
                        }}
                        className="w-16 text-center font-extrabold font-mono text-xs bg-slate-50 border border-slate-200 focus:border-teal-500 focus:outline-none rounded-lg py-1 px-1.5"
                      />
                      <span className="text-xs font-bold text-slate-500 font-mono">%</span>
                    </div>
                    <button
                      type="button"
                      disabled={isUpdatingGlobalSettings}
                      onClick={() => handleSaveUniversalCommission(globalSettings.universalCommissionPercentage)}
                      className="bg-slate-950 hover:bg-slate-850 disabled:bg-slate-300 text-white font-extrabold text-[11px] px-4 py-1.5 rounded-lg active:scale-95 transition-all cursor-pointer shadow-sm shrink-0 flex items-center gap-1"
                    >
                      {isUpdatingGlobalSettings ? "Saving..." : "Update Universal Rate"}
                    </button>
                  </div>
                </div>

                {/* Universal Subscription Pricing Tiers Setting Section */}
                <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-200/50 p-5 rounded-xl text-left shadow-xs space-y-4 mt-4">
                  <div className="space-y-1">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[9px] font-black uppercase rounded-md shadow-3xs">
                      💳 Universal Subscription Pricing Tiers
                    </span>
                    <h5 className="text-xs font-black text-slate-800">Global Student License Pricing Tiers</h5>
                    <p className="text-[10.5px] text-slate-600 font-sans">
                      Configure universal per-student rates depending on total students registered. Schools can also override this with custom tiers.
                    </p>
                  </div>

                  <div className="bg-white/80 backdrop-blur-xs p-4 rounded-xl border border-indigo-100/80 space-y-3">
                    {/* Preset Payment Link Input */}
                    <div className="space-y-1.5 pb-3 border-b border-indigo-50">
                      <label className="text-[10px] font-black text-indigo-950 uppercase tracking-wider block">
                        Preset Payment Link URL
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. https://pages.razorpay.com/pl_sandbox_school_pay"
                        value={globalSettings.presetPaymentLink || ""}
                        onChange={(e) => setGlobalSettings({ ...globalSettings, presetPaymentLink: e.target.value })}
                        className="w-full font-semibold text-xs bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:outline-none rounded-lg py-2 px-3 shadow-3xs"
                      />
                      <span className="text-[9.5px] text-gray-500 block leading-normal">
                        * Note: When school admins upgrade to the Premium Plan, they will be redirected to this link to complete the transaction.
                      </span>
                    </div>

                    {(globalSettings.pricingTiers || []).map((tier, idx) => (
                      <div key={tier.id || idx} className="bg-slate-50/50 p-3.5 rounded-xl border border-slate-150 space-y-2 text-left">
                        <div className="grid grid-cols-4 gap-2 items-center">
                          <div className="space-y-1">
                            <span className="text-[8px] uppercase font-black text-gray-400 block">Min Students</span>
                            <input
                              type="number"
                              value={tier.minStudents}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 0;
                                const newTiers = [...(globalSettings.pricingTiers || [])];
                                newTiers[idx] = { ...newTiers[idx], minStudents: val };
                                setGlobalSettings({ ...globalSettings, pricingTiers: newTiers });
                              }}
                              className="w-full text-center font-bold font-mono text-xs bg-white border border-slate-200 focus:border-indigo-500 focus:outline-none rounded-lg py-1 px-2"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[8px] uppercase font-black text-gray-400 block">Max Students</span>
                            <input
                              type="number"
                              value={tier.maxStudents}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 0;
                                const newTiers = [...(globalSettings.pricingTiers || [])];
                                newTiers[idx] = { ...newTiers[idx], maxStudents: val };
                                setGlobalSettings({ ...globalSettings, pricingTiers: newTiers });
                              }}
                              className="w-full text-center font-bold font-mono text-xs bg-white border border-slate-200 focus:border-indigo-500 focus:outline-none rounded-lg py-1 px-2"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[8px] uppercase font-black text-gray-400 block">Rate per Student (₹)</span>
                            <input
                              type="number"
                              value={tier.pricePerStudent}
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10) || 0;
                                const newTiers = [...(globalSettings.pricingTiers || [])];
                                newTiers[idx] = { ...newTiers[idx], pricePerStudent: val };
                                setGlobalSettings({ ...globalSettings, pricingTiers: newTiers });
                              }}
                              className="w-full text-center font-bold font-mono text-xs bg-white border border-slate-200 focus:border-indigo-500 focus:outline-none rounded-lg py-1 px-2"
                            />
                          </div>
                          <div className="text-right pt-3">
                            <button
                              type="button"
                              onClick={() => {
                                const newTiers = (globalSettings.pricingTiers || []).filter((_, i) => i !== idx);
                                setGlobalSettings({ ...globalSettings, pricingTiers: newTiers });
                              }}
                              className="text-rose-600 hover:text-rose-800 font-extrabold text-[10px] bg-rose-50 hover:bg-rose-100 p-1.5 px-2.5 rounded-lg active:scale-95 transition-all cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                        <div className="space-y-1 pt-2 border-t border-slate-100">
                          <span className="text-[8.5px] uppercase font-black text-indigo-500 tracking-wider block">Custom Payment Link URL for this Range</span>
                          <input
                            type="text"
                            placeholder="e.g. https://pages.razorpay.com/pl_sandbox_school_pay_300"
                            value={tier.paymentLink || ""}
                            onChange={(e) => {
                              const newTiers = [...(globalSettings.pricingTiers || [])];
                              newTiers[idx] = { ...newTiers[idx], paymentLink: e.target.value };
                              setGlobalSettings({ ...globalSettings, pricingTiers: newTiers });
                            }}
                            className="w-full font-medium text-xs bg-white border border-slate-200 focus:border-indigo-500 focus:outline-none rounded-lg py-1.5 px-2.5 font-mono"
                          />
                        </div>
                      </div>
                    ))}

                    {(!globalSettings.pricingTiers || globalSettings.pricingTiers.length === 0) && (
                      <p className="text-center text-slate-400 text-xs py-2">No pricing tiers defined. Standard rates will apply.</p>
                    )}

                    <div className="flex justify-between items-center pt-2 border-t border-indigo-50">
                      <button
                        type="button"
                        onClick={() => {
                          const newTier = { id: 'tier_' + Math.random().toString(36).substring(2, 9), minStudents: 1, maxStudents: 100, pricePerStudent: 10 };
                          setGlobalSettings({
                            ...globalSettings,
                            pricingTiers: [...(globalSettings.pricingTiers || []), newTier]
                          });
                        }}
                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-[10.5px] px-3.5 py-1.5 rounded-lg active:scale-95 transition-all cursor-pointer flex items-center gap-1 border border-indigo-200/50"
                      >
                        + Add Pricing Tier
                      </button>

                      <button
                        type="button"
                        disabled={isUpdatingGlobalSettings}
                        onClick={async () => {
                          try {
                            setIsUpdatingGlobalSettings(true);
                            await saveGlobalSettings({
                              universalCommissionPercentage: globalSettings.universalCommissionPercentage,
                              pricingTiers: globalSettings.pricingTiers,
                              presetPaymentLink: globalSettings.presetPaymentLink
                            });
                            setSuccessInfo("Universal pricing tiers updated successfully!");
                            setTimeout(() => setSuccessInfo(null), 4000);
                          } catch (err) {
                            setErrorInfo("Failed to save universal pricing tiers.");
                            setTimeout(() => setErrorInfo(null), 4000);
                          } finally {
                            setIsUpdatingGlobalSettings(false);
                          }
                        }}
                        className="bg-indigo-650 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-extrabold text-[11px] px-4 py-1.5 rounded-lg active:scale-95 transition-all cursor-pointer shadow-sm"
                      >
                        {isUpdatingGlobalSettings ? "Saving..." : "Save Pricing Tiers"}
                      </button>
                    </div>
                  </div>
                </div>

                {isLoadingAgents ? (
                  <div className="py-12 text-center text-slate-400 font-semibold text-xs flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-teal-600" />
                    <span>Loading registered agents database from cloud...</span>
                  </div>
                ) : (() => {
                  const filteredAgents = agents.filter(a => 
                    a.name.toLowerCase().includes(agentSearchTerm.toLowerCase()) ||
                    a.email.toLowerCase().includes(agentSearchTerm.toLowerCase()) ||
                    a.code.toLowerCase().includes(agentSearchTerm.toLowerCase())
                  );

                  if (filteredAgents.length === 0) {
                    return (
                      <div className="bg-slate-50 border border-slate-100 rounded-xl p-8 text-center text-slate-400 space-y-2">
                        <Users className="w-10 h-10 text-slate-300 mx-auto" />
                        <p className="text-xs font-semibold">No registered referral agents found matching your query.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="border border-gray-150 rounded-xl overflow-x-auto shadow-xs bg-white">
                      <table className="w-full border-collapse text-left text-xs bg-white">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-150 select-none">
                            <th className="p-3">Agent & Code</th>
                            <th className="p-3 text-center">Commission %</th>
                            <th className="p-3">Payout / Bank Details</th>
                            <th className="p-3 text-center">Status</th>
                            <th className="p-3 text-center">Referred Schools</th>
                            <th className="p-3 text-center">Commissions</th>
                            <th className="p-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredAgents.map(agent => {
                            const referred = schools.filter(s => 
                              s.referredByAgentId === agent.id || 
                              (s.referredByAgentCode && s.referredByAgentCode.toUpperCase() === agent.code.toUpperCase())
                            );

                            const annualSchools = referred.filter(s => s.partnershipType === 'annual');
                            const trialSchools = referred.filter(s => s.partnershipType !== 'annual');

                            const commPct = agent.commissionPercentage !== undefined ? agent.commissionPercentage : globalSettings.universalCommissionPercentage;

                            const totalCommEarned = referred.reduce((sum, s) => {
                              const price = (s.partnershipType === 'annual' && s.approvalStatus === 'approved') ? (s.annualPrice || 0) : 0;
                              return sum + (price * commPct / 100);
                            }, 0);

                            return (
                              <tr key={agent.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-3">
                                  <div className="font-extrabold text-slate-900">{agent.name}</div>
                                  <div className="text-gray-500 font-medium text-[10px]">{agent.email}</div>
                                  <div className="mt-1">
                                    <span className="inline-flex items-center px-1.5 py-0.5 bg-teal-50 border border-teal-100 rounded text-teal-800 font-mono text-[9px] font-bold">
                                      {agent.code}
                                    </span>
                                  </div>
                                </td>
                                <td className="p-3 text-center">
                                  <div className="flex items-center justify-center gap-1.5 font-sans">
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      key={agent.commissionPercentage !== undefined ? agent.commissionPercentage : `g-${globalSettings.universalCommissionPercentage}`}
                                      defaultValue={agent.commissionPercentage !== undefined ? agent.commissionPercentage : globalSettings.universalCommissionPercentage}
                                      onBlur={(e) => {
                                        const val = parseInt(e.target.value, 10);
                                        if (!isNaN(val)) {
                                          handleUpdateAgentCommission(agent.id, val);
                                        }
                                      }}
                                      className="w-12 text-center p-1 text-xs border border-gray-200 rounded font-bold text-gray-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
                                    />
                                    <span className="text-[10px] font-bold text-gray-400">%</span>
                                  </div>
                                </td>
                                <td className="p-3">
                                  <textarea
                                    defaultValue={agent.paymentDetails || ''}
                                    placeholder="Enter bank or PayPal instructions..."
                                    onBlur={(e) => handleUpdateAgentPayoutDetails(agent.id, e.target.value)}
                                    className="w-full text-[10.5px] p-1 border border-gray-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 rounded resize-none h-11 text-gray-700 leading-tight font-medium"
                                  />
                                </td>
                                <td className="p-3 text-center">
                                  <select
                                    value={agent.status || 'active'}
                                    onChange={(e) => handleUpdateAgentStatus(agent.id, e.target.value as any)}
                                    className={`p-1 text-[10px] font-bold border rounded outline-none cursor-pointer ${
                                      agent.status === 'active'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                        : agent.status === 'suspended'
                                        ? 'bg-rose-50 text-rose-700 border-rose-100'
                                        : 'bg-amber-50 text-amber-700 border-amber-100'
                                    }`}
                                  >
                                    <option value="active">Active</option>
                                    <option value="pending">Pending Approval</option>
                                    <option value="suspended">Suspended</option>
                                  </select>
                                </td>
                                <td className="p-3 text-center">
                                  <div className="text-xs font-extrabold text-slate-800">
                                    {referred.length} schools
                                  </div>
                                  <div className="text-[9px] text-gray-500 font-semibold mt-0.5">
                                    {annualSchools.length} Annual | {trialSchools.length} Trial
                                  </div>
                                </td>
                                <td className="p-3 text-center">
                                  <div className="text-xs font-black text-emerald-600 font-mono">
                                    ₹{totalCommEarned.toLocaleString('en-IN')}
                                  </div>
                                  <div className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">
                                    Est. Payout
                                  </div>
                                </td>
                                <td className="p-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedAgentForSchools(agent)}
                                      className="p-1 px-2 text-[10px] font-bold bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-all flex items-center gap-1 cursor-pointer"
                                      title="View referred schools"
                                    >
                                      <Eye className="w-3 h-3" />
                                      View
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteAgent(agent.id)}
                                      className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                                      title="Delete agent"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            ) : activeDirectoryTab === 'recycle_bin' ? (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-rose-50/50 p-4 rounded-xl border border-rose-100">
                  <div>
                    <h4 className="text-xs font-extrabold text-rose-950 uppercase tracking-wider flex items-center gap-1.5">
                      <Trash2 className="w-3.5 h-3.5 text-rose-700 animate-pulse" />
                      SaaS Recycle Bin Desk
                    </h4>
                    <p className="text-[10.5px] text-rose-800 mt-0.5">Restore accidentally deleted school directories or partner agents, or permanently purge them.</p>
                  </div>
                </div>

                {saasRecycleBin.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-8 text-center text-slate-400 space-y-2">
                    <Trash2 className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="text-xs font-semibold">The SaaS Recycle Bin is empty.</p>
                    <p className="text-[10px] text-slate-400">Schools or partner agents you delete will be held here safely.</p>
                  </div>
                ) : (
                  <div className="border border-rose-100 rounded-xl overflow-x-auto shadow-xs bg-white">
                    <table className="w-full border-collapse text-left text-xs bg-white">
                      <thead>
                        <tr className="bg-rose-50/25 text-rose-900 font-bold border-b border-rose-100 select-none">
                          <th className="p-3">Profile Name & Details</th>
                          <th className="p-3">Type</th>
                          <th className="p-3">Deleted On</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                        {saasRecycleBin.map((item) => (
                          <tr key={item.id} className="hover:bg-rose-50/5 transition-colors">
                            <td className="p-3 font-bold text-slate-900">
                              <div>{item.description}</div>
                              <div className="text-[9.5px] font-mono text-slate-500 mt-0.5 uppercase tracking-wider">ID: {item.payload?.id || 'N/A'}</div>
                            </td>
                            <td className="p-3 whitespace-nowrap">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                item.type === 'school'
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                  : 'bg-teal-50 text-teal-700 border border-teal-100'
                              }`}>
                                {item.type === 'school' ? '🏫 School' : '👥 Partner Agent'}
                              </span>
                            </td>
                            <td className="p-3 text-[11px] font-mono text-slate-500 whitespace-nowrap">
                              {new Date(item.deletedAt).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-3 text-right whitespace-nowrap">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      if (item.type === 'school') {
                                        // Restore school
                                        await saveSaaSSchoolToCloud(item.payload, item.payload.ownerId || 'school-admin-offline-sync');
                                        onUpdateSchools([item.payload, ...schools]);
                                      } else {
                                        // Restore agent
                                        await saveAgentToCloud(item.payload);
                                        setAgents(prev => [item.payload, ...prev]);
                                      }
                                      await deleteSaaSRecycleBinFromCloud(item.id);
                                      setSaasRecycleBin(prev => prev.filter(b => b.id !== item.id));
                                      setSuccessInfo(`Successfully restored the ${item.type} profile!`);
                                      setTimeout(() => setSuccessInfo(null), 4000);
                                    } catch (err) {
                                      console.error("Restore failed:", err);
                                      setErrorInfo("Restore failed. Please check network.");
                                      setTimeout(() => setErrorInfo(null), 4000);
                                    }
                                  }}
                                  className="px-2.5 py-1 text-[10.5px] font-black text-emerald-700 hover:text-white hover:bg-emerald-600 bg-emerald-50 rounded-xl transition cursor-pointer flex items-center gap-1"
                                >
                                  <span>Restore</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConfirmModal({
                                      isOpen: true,
                                      title: `Permanently Purge ${item.type === 'school' ? 'School' : 'Agent'}`,
                                      message: `Are you sure you want to permanently delete "${item.payload?.name || ''}"? This action is absolutely irreversible and will permanently delete all cloud registry records.`,
                                      onConfirm: async () => {
                                        try {
                                          await deleteSaaSRecycleBinFromCloud(item.id);
                                          setSaasRecycleBin(prev => prev.filter(b => b.id !== item.id));
                                          setSuccessInfo("Profile permanently deleted.");
                                          setTimeout(() => setSuccessInfo(null), 4000);
                                        } catch (err) {
                                          console.error("Failed to delete permanently:", err);
                                        }
                                        setConfirmModal(null);
                                      }
                                    });
                                  }}
                                  className="px-2.5 py-1 text-[10.5px] font-black text-rose-700 hover:text-white hover:bg-rose-600 bg-rose-50 rounded-xl transition cursor-pointer flex items-center gap-1"
                                >
                                  <span>Purge</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : activeDirectoryTab === 'withdrawals' ? (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-purple-50/50 p-4 rounded-xl border border-purple-100">
                  <div>
                    <h4 className="text-xs font-extrabold text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
                      <Landmark className="w-3.5 h-3.5 text-purple-700 animate-pulse" />
                      Partner Commission Withdrawal & Payout Desk
                    </h4>
                    <p className="text-[10.5px] text-purple-800 mt-0.5">Review, process, and payout agent commission withdrawal requests.</p>
                  </div>
                </div>

                {withdrawals.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-8 text-center text-slate-400 space-y-2">
                    <PiggyBank className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="text-xs font-semibold">No commission payout requests submitted yet.</p>
                    <p className="text-[10px] text-slate-400">Agents can request payouts once they have earned commission.</p>
                  </div>
                ) : (
                  <div className="border border-purple-100 rounded-xl overflow-x-auto shadow-xs bg-white">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead>
                        <tr className="bg-purple-50/30 text-purple-950 font-bold border-b border-purple-150 select-none">
                          <th className="p-3">Partner / Code</th>
                          <th className="p-3">Requested At</th>
                          <th className="p-3">Amount</th>
                          <th className="p-3">Payment Credentials</th>
                          <th className="p-3">Notes / Status</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-purple-50 font-semibold text-slate-700">
                        {withdrawals.map((req) => (
                          <tr key={req.id} className="hover:bg-purple-50/10 transition-colors">
                            <td className="p-3 font-bold text-slate-900">
                              <div>{req.agentName || req.senderName || 'Unknown Agent'}</div>
                              <div className="text-[9.5px] font-mono text-purple-600 mt-0.5 uppercase tracking-wider">CODE: {req.agentCode || req.senderCode || 'N/A'}</div>
                            </td>
                            <td className="p-3 text-[11px] font-mono text-slate-500 whitespace-nowrap">
                              {new Date(req.requestedAt).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="p-3 text-sm font-extrabold text-slate-900 font-mono">
                              ₹{req.amount.toLocaleString('en-IN')}
                            </td>
                            <td className="p-3 text-[11px] max-w-[200px] truncate" title={req.paymentDetails}>
                              {req.paymentDetails}
                            </td>
                            <td className="p-3">
                              <div className="flex flex-col gap-1">
                                {req.remarks && <span className="text-[10px] text-slate-500 italic max-w-[180px] break-words">"{req.remarks}"</span>}
                                <span className={`inline-flex items-center gap-1 w-max px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                  req.status === 'paid'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : req.status === 'approved' 
                                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                    : req.status === 'processing'
                                    ? 'bg-sky-50 text-sky-700 border border-sky-100 animate-pulse'
                                    : req.status === 'rejected'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-100'
                                    : 'bg-amber-50 text-amber-700 border border-amber-100 animate-pulse'
                                }`}>
                                  {req.status === 'paid' ? 'Paid / Sent' : req.status}
                                </span>
                              </div>
                            </td>
                            <td className="p-3 text-right whitespace-nowrap">
                              <div className="flex flex-col items-end gap-1.5">
                                <div className="flex justify-end items-center gap-2">
                                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Update Status:</label>
                                  <select
                                    value={req.status}
                                    onChange={(e) => handleUpdateWithdrawalStatus(req, e.target.value as any)}
                                    className="bg-white border border-slate-250 hover:border-slate-350 text-slate-800 text-[11px] font-black py-1 px-2.5 rounded-xl cursor-pointer shadow-3xs outline-none focus:ring-2 focus:ring-purple-500/10 focus:border-purple-500 transition-all"
                                  >
                                    <option value="pending">⏳ Pending</option>
                                    <option value="processing">⚙️ Processing</option>
                                    <option value="approved">👍 Approved</option>
                                    <option value="paid">✅ Paid / Sent</option>
                                    <option value="rejected">❌ Declined</option>
                                  </select>
                                </div>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    placeholder="Add transaction remarks/notes..."
                                    defaultValue={req.remarks || ''}
                                    key={req.remarks || ''}
                                    onBlur={(e) => {
                                      if (e.target.value !== (req.remarks || '')) {
                                        handleUpdateWithdrawalStatus(req, req.status, e.target.value);
                                      }
                                    }}
                                    className="px-2 py-0.5 text-[10px] border border-slate-200 focus:border-purple-400 bg-slate-50/50 rounded-lg outline-none w-48 font-semibold text-slate-700"
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : filteredSchools.length === 0 ? (
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-8 text-center text-slate-400 space-y-2">
                <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs font-semibold">No schools found matching your search.</p>
              </div>
            ) : (
              <div className="border border-gray-150 rounded-xl overflow-x-auto shadow-xs">
                <table className="w-full border-collapse text-left text-xs bg-white">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-150 select-none">
                      <th className="p-3">School Name</th>
                      <th className="p-3">Contact Details</th>
                      <th className="p-3">Credentials</th>
                      {activeDirectoryTab === 'approved' && (
                        <th className="p-3 text-center">Class Teachers</th>
                      )}
                      <th className="p-3 text-right">Administrative Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSchools.map((school) => (
                      <tr key={school.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 font-extrabold text-slate-800 space-y-1 cursor-pointer group/school" onClick={() => setViewingSchool(school)} title="Click to view full school tenant profile details">
                          <div className="text-sm font-black text-slate-800 group-hover/school:text-indigo-650 transition-colors flex items-center gap-1.5 flex-wrap">
                            <span>{school.name}</span>
                            {/* Subscription Badge */}
                            {school.partnershipType === 'annual' ? (
                              <span className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-[9px] font-black px-2 py-0.5 rounded-full select-none shadow-xs">
                                <Sparkles className="w-2.5 h-2.5 text-indigo-500" />
                                Annual Partnership
                              </span>
                            ) : school.partnershipType === 'pending_activation' ? (
                              <span className="inline-flex items-center gap-1 bg-rose-50 border border-rose-200 text-rose-700 text-[9px] font-bold px-2 py-0.5 rounded-full select-none shadow-xs">
                                Pending Activation
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-bold px-2 py-0.5 rounded-full select-none shadow-xs">
                                Sandbox Trial
                              </span>
                            )}
                            {!cloudSchoolIds.includes(school.id) && (
                              <span className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-300/50 text-amber-600 text-[8.5px] font-bold font-mono px-1.5 py-0.5 rounded-md animate-pulse uppercase select-none">
                                <CloudOff className="w-2.5 h-2.5 shrink-0" />
                                Unsynced
                              </span>
                            )}
                            <Info className="w-3.5 h-3.5 text-slate-300 group-hover/school:text-indigo-505 opacity-60 group-hover/school:opacity-100 transition-all shrink-0" />
                          </div>
                          {school.contactPerson && (
                            <div className="text-[10px] text-gray-500 font-sans font-medium">
                              Person name: <strong className="text-slate-700 font-semibold">{school.contactPerson}</strong>
                            </div>
                          )}
                          {school.board && (
                            <span className="inline-block text-[9px] bg-indigo-50 text-indigo-650 px-1.5 py-0.2 rounded font-semibold border border-indigo-100/40">
                              {school.board} Board
                            </span>
                          )}
                        </td>
                        <td className="p-3 space-y-1 font-mono text-[11px] text-slate-650">
                          {school.email && (
                            <div>
                              Email: <strong className="text-slate-800 select-all">{school.email}</strong>
                            </div>
                          )}
                          {school.mobile && (
                            <div>
                              Mobile: <strong className="text-slate-800 select-all">{school.mobile}</strong>
                            </div>
                          )}
                          {school.address && (
                            <div className="text-[10px] text-slate-400 italic truncate max-w-[150px]" title={school.address}>
                              {school.address}
                            </div>
                          )}
                        </td>
                        <td className="p-3 space-y-1 font-mono text-slate-600">
                          <div>ID: <strong className="text-slate-800 select-all">{school.username}</strong></div>
                          <div>Pwd: <strong className="text-slate-505 select-all">{school.password}</strong></div>
                          <div className="pt-1.5 border-t border-slate-100 mt-1 flex flex-col gap-0.5">
                            <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Access PIN</span>
                            <div className="flex items-center gap-1.5">
                              {school.saasOwnerPin ? (
                                <strong className="bg-indigo-50 border border-indigo-200 text-indigo-750 px-1.5 py-0.5 rounded text-[10px] font-bold select-all tracking-wider">
                                  {school.saasOwnerPin}
                                </strong>
                              ) : (
                                <span className="text-slate-400 italic text-[10px]">None</span>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  const generatedPin = Math.floor(100000 + Math.random() * 900000).toString();
                                  const updated = schools.map(s => s.id === school.id ? { ...s, saasOwnerPin: generatedPin } : s);
                                  onUpdateSchools(updated);
                                }}
                                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-650 hover:text-indigo-700 font-extrabold text-[9px] px-1.5 py-0.5 rounded border border-indigo-200 cursor-pointer transition-all active:scale-95 shrink-0"
                                title="Generate secure access PIN code"
                              >
                                {school.saasOwnerPin ? "Regen" : "Generate"}
                              </button>
                            </div>
                          </div>
                        </td>
                        {activeDirectoryTab === 'approved' && (
                          <td className="p-3 text-center font-mono font-bold text-gray-600 bg-slate-50/10">
                            {school.teachers?.length || 0} active
                          </td>
                        )}
                        <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end items-center gap-1.5">
                            <button
                              onClick={() => setViewingSchool(school)}
                              className="p-1 px-2 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-[10px] rounded transition-all flex items-center gap-1 cursor-pointer shrink-0"
                              title="View full school registration & database information sheet"
                            >
                              <Info className="w-3" />
                              <span>Profile</span>
                            </button>
                            {/* Pending Specific Buttons */}
                            {school.approvalStatus === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleOpenApproveModal(school.id)}
                                  className="p-1 px-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] rounded transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                                  title="Approve registration setup and set trial length"
                                >
                                  <Sparkles className="w-3 h-3 text-amber-300" />
                                  <span>Approve Setup</span>
                                </button>
                                <button
                                  onClick={() => handleRejectSchool(school.id)}
                                  className="p-1 px-2 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[10px] rounded transition-all cursor-pointer"
                                  title="Decline registration request"
                                >
                                  <span>Decline</span>
                                </button>
                              </>
                            )}

                            {/* Pending Upgrades Specific Buttons */}
                            {activeDirectoryTab === 'upgrades' && school.subscriptionRequest && (
                              <>
                                <button
                                  onClick={() => handleApproveSubscription(school)}
                                  className="p-1 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                                  title="Approve subscription upgrade request and activate annual plan limits"
                                >
                                  <Sparkles className="w-3 h-3 text-amber-300" />
                                  <span>Approve (₹{school.subscriptionRequest.calculatedTotal.toLocaleString()})</span>
                                </button>
                                <button
                                  onClick={() => handleRejectSubscription(school)}
                                  className="p-1 px-2 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[10px] rounded transition-all cursor-pointer"
                                  title="Decline subscription upgrade request"
                                >
                                  <span>Decline</span>
                                </button>
                              </>
                            )}

                            {/* Rejected Specific Re-approve */}
                            {school.approvalStatus === 'rejected' && (
                              <button
                                onClick={() => handleOpenApproveModal(school.id)}
                                className="p-1 px-2 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] rounded transition-all cursor-pointer"
                                title="Re-approve registration request"
                              >
                                <span>Re-Approve Setup</span>
                              </button>
                            )}

                            {/* Approved Links */}
                            {(school.approvalStatus || 'approved') === 'approved' && (
                              <>
                                <button
                                  onClick={() => handleCopyCredentials(school)}
                                  className="p-1 px-2 border border-gray-200 bg-white hover:bg-slate-50 rounded text-slate-600 font-semibold text-[10px] transition-all flex items-center gap-1"
                                  title="Copy School Admin credential message to clipboard"
                                >
                                  {copiedId === school.id ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      <span className="text-emerald-600 font-bold">Copied!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>Copy Logins</span>
                                    </>
                                  )}
                                </button>

                                <button
                                  onClick={() => onImpersonateSchool(school.id)}
                                  className="p-1 px-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] rounded transition-all flex items-center gap-1 shadow-sm"
                                  title="Impersonate &amp; login immediately to this school's custom dashboard"
                                >
                                  <span>Enter Dashboard</span>
                                  <ArrowUpRight className="w-3 h-3" />
                                </button>
                              </>
                            )}

                            <button
                              onClick={() => handleDeleteSchool(school.id, school.name)}
                              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-colors"
                              title="Delete school and purge database"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Onboarded schools count */}
            <div className="text-right text-[10px] text-gray-400 font-mono select-none">
              Directory sync active &bull; Total {totalSchoolsCount} tenants loaded from security registry
            </div>

          </div>
          )}
        </div>

        {/* Right: Sticky Support Chat Column */}
        <div className="xl:col-span-4 xl:sticky xl:top-24 space-y-4 no-print">
          <div className="bg-white rounded-3xl border border-gray-150 shadow-sm overflow-hidden flex flex-col h-[520px]">
            
            {/* Header */}
            {selectedChatPartnerId ? (
              (() => {
                const matchedSchool = schools.find(s => s.id === selectedChatPartnerId);
                const matchedAgent = agents.find(a => a.id === selectedChatPartnerId);
                const partnerName = matchedSchool ? matchedSchool.name : (matchedAgent ? matchedAgent.fullName : 'SaaS Partner');
                const partnerRole = matchedSchool ? 'School Tenant' : 'Referral Partner';
                return (
                  <div className="px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-800 text-white flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => setSelectedChatPartnerId(null)}
                        className="p-1 hover:bg-white/10 rounded-lg text-white/90 transition-all cursor-pointer shrink-0"
                        title="Back to partner list"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <div className="truncate text-left">
                        <h4 className="text-xs font-black truncate">{partnerName}</h4>
                        <p className="text-[9px] text-indigo-200 font-bold uppercase tracking-wider">{partnerRole}</p>
                      </div>
                    </div>
                    
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0 ml-2" />
                  </div>
                );
              })()
            ) : (
              <div className="px-4 py-3.5 border-b border-gray-100 bg-slate-50 flex items-center justify-between">
                <div className="text-left">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-indigo-650" />
                    SaaS Support Chat
                  </h4>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">Direct Messaging Desk</p>
                </div>
                {adminUnreadCount > 0 && (
                  <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full animate-pulse">
                    {adminUnreadCount} New
                  </span>
                )}
              </div>
            )}

            {/* Chat Body */}
            {selectedChatPartnerId ? (
              <>
                {/* Messages Area */}
                <div 
                  ref={stickyChatEndRef}
                  className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-3 scrollbar-thin text-left"
                >
                  {chatMessages.filter(m => 
                    (m.senderId === 'admin' && m.receiverId === selectedChatPartnerId) || 
                    (m.senderId === selectedChatPartnerId && m.receiverId === 'admin')
                  ).length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-4 text-gray-400 space-y-1.5">
                      <MessageSquare className="w-8 h-8 text-slate-200 animate-pulse" />
                      <span className="text-[10px] font-bold">No message logs yet</span>
                      <p className="text-[9px] text-gray-400 leading-relaxed max-w-[180px]">Type a message below to start your conversation with this school.</p>
                    </div>
                  ) : (
                    chatMessages.filter(m => 
                      (m.senderId === 'admin' && m.receiverId === selectedChatPartnerId) || 
                      (m.senderId === selectedChatPartnerId && m.receiverId === 'admin')
                    ).map((m) => {
                      const isAdmin = m.senderId === 'admin';
                      return (
                        <div key={m.id} className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'} space-y-0.5`}>
                          <div className="flex items-center gap-1 text-[9px] font-bold text-gray-400">
                            <span>{isAdmin ? 'SaaS Admin' : m.senderName}</span>
                            <span>&bull;</span>
                            <span>{new Date(m.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs font-semibold leading-relaxed shadow-3xs ${
                            isAdmin 
                              ? 'bg-indigo-600 text-white rounded-tr-none' 
                              : 'bg-white border border-gray-150 text-slate-800 rounded-tl-none'
                          }`}>
                            {renderMessageWithLinks(m.message, isAdmin)}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Link Creator Component right above input */}
                <div className="px-2.5 py-1.5 bg-white border-t border-slate-50">
                  <LinkButtonCreator textValue={adminChatInput} onTextChange={setAdminChatInput} />
                </div>

                {/* Message Input */}
                <form onSubmit={handleSendAdminChatMessage} className="p-2.5 bg-white border-t border-slate-100 flex gap-1.5">
                  <input
                    type="text"
                    required
                    placeholder="Type your response..."
                    value={adminChatInput}
                    onChange={(e) => setAdminChatInput(e.target.value)}
                    className="flex-1 min-w-0 px-3 py-2 text-xs border border-gray-200 bg-slate-50 focus:bg-white rounded-xl outline-none font-semibold text-gray-750"
                  />
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded-xl transition-all cursor-pointer shrink-0 flex items-center justify-center w-8.5 h-8.5 shadow-xs shadow-indigo-600/10"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </>
            ) : (
              <div className="flex-1 overflow-y-auto divide-y divide-gray-100 scrollbar-thin">
                {/* Category Section: Schools */}
                <div className="p-3 bg-slate-50/50">
                  <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider flex items-center gap-1">
                    <School className="w-3 h-3 text-rose-500" />
                    School Tenants
                  </span>
                </div>
                {uniqueSchools.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-400 font-bold">No active schools onboarded</div>
                ) : (
                  uniqueSchools.map((school) => {
                    const unread = chatMessages.filter(m => m.senderId === school.id && m.receiverId === 'admin' && !m.read).length;
                    const isSelected = selectedChatPartnerId === school.id;
                    const schoolName = school.name || '';
                    return (
                      <button
                        key={school.id}
                        type="button"
                        onClick={() => setSelectedChatPartnerId(school.id)}
                        className={`w-full px-4 py-3 flex items-center justify-between text-left hover:bg-indigo-50/30 transition-all border-0 bg-transparent cursor-pointer ${
                          isSelected ? 'bg-indigo-50/50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 text-xs font-black shrink-0">
                            {schoolName.substring(0, 2).toUpperCase() || 'SC'}
                          </div>
                          <div className="truncate">
                            <h5 className="text-xs font-black text-slate-800 truncate">{schoolName || 'School'}</h5>
                            <p className="text-[10px] text-gray-400 truncate">{school.contactPerson || 'School Admin'}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1.5 shrink-0">
                          {unread > 0 && (
                            <span className="bg-amber-500 text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full animate-pulse shrink-0">
                              {unread}
                            </span>
                          )}
                          <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                        </div>
                      </button>
                    );
                  })
                )}

                {/* Category Section: Agents */}
                <div className="p-3 bg-slate-50/50 border-t border-gray-100">
                  <span className="text-[9px] font-black uppercase text-gray-400 tracking-wider flex items-center gap-1">
                    <Users className="w-3 h-3 text-teal-500" />
                    Referral Partners
                  </span>
                </div>
                {agents.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-400 font-bold">No active agents registered</div>
                ) : (
                  agents.map((agent) => {
                    const unread = chatMessages.filter(m => m.senderId === agent.id && m.receiverId === 'admin' && !m.read).length;
                    const isSelected = selectedChatPartnerId === agent.id;
                    const agentName = agent.name || '';
                    return (
                      <button
                        key={agent.id}
                        type="button"
                        onClick={() => setSelectedChatPartnerId(agent.id)}
                        className={`w-full px-4 py-3 flex items-center justify-between text-left hover:bg-indigo-50/30 transition-all border-0 bg-transparent cursor-pointer ${
                          isSelected ? 'bg-indigo-50/50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 text-xs font-black shrink-0">
                            {agentName.substring(0, 2).toUpperCase() || 'AG'}
                          </div>
                          <div className="truncate">
                            <h5 className="text-xs font-black text-slate-800 truncate">{agentName || 'Partner'}</h5>
                            <p className="text-[10px] text-gray-400 truncate">{agent.email}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1.5 shrink-0">
                          {unread > 0 && (
                            <span className="bg-purple-500 text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full animate-pulse shrink-0">
                              {unread}
                            </span>
                          )}
                          <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

      </div>
    )}

      </div>

      {/* Custom Destructive Action Double Confirmation Modal */}
      {deletingSchool && (
        <div className="fixed inset-0 w-screen h-screen bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 md:p-8 z-[999999] animate-fadeIn text-slate-900">
          <div className="bg-white border-2 border-rose-500 rounded-3xl w-full max-w-xl shadow-2xl relative overflow-hidden p-8 md:p-10 space-y-6">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-4 bg-rose-50 text-rose-600 rounded-full animate-bounce">
                <ShieldAlert className="w-12 h-12" />
              </div>
              <h3 className="text-2xl font-black tracking-tight text-slate-900">CRITICAL SYSTEM DELETION</h3>
              <p className="text-sm text-rose-700 font-bold bg-rose-50 border border-rose-100 p-4 rounded-2xl leading-relaxed">
                You are about to permanently remove school <strong className="text-rose-600 font-black select-all">"{deletingSchool.name}"</strong>. This will instantly delete all student configurations, custom report cards, grading scales, and active marks sheets permanently.
              </p>
              <p className="text-xs text-slate-500 leading-normal">
                This process is completely irreversible. To proceed, please type <strong className="text-rose-600 font-extrabold select-none">DELETE</strong> or <strong className="text-indigo-600 font-extrabold select-none font-mono">CONFIRM</strong> in the box below to authorize this system purge:
              </p>
              
              <input
                type="text"
                placeholder="Type DELETE or CONFIRM here"
                value={deleteInputText}
                onChange={(e) => setDeleteInputText(e.target.value)}
                className="w-full max-w-md px-5 py-3.5 border-3 border-slate-200 focus:border-rose-500 rounded-2xl text-sm font-mono font-bold uppercase tracking-widest outline-none text-center bg-slate-50 transition-all text-slate-950 shadow-inner"
                autoFocus
              />

              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setDeletingSchool(null);
                    setDeleteInputText('');
                  }}
                  className="w-full sm:w-1/2 px-5 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl text-xs font-bold transition cursor-pointer bg-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteSchool}
                  disabled={deleteInputText.trim().toUpperCase() !== 'DELETE' && deleteInputText.trim().toUpperCase() !== 'CONFIRM'}
                  className={`w-full sm:w-1/2 px-5 py-3 rounded-2xl text-xs font-bold text-white transition flex items-center justify-center gap-2 ${
                    deleteInputText.trim().toUpperCase() === 'DELETE' || deleteInputText.trim().toUpperCase() === 'CONFIRM'
                      ? 'bg-rose-600 hover:bg-rose-700 cursor-pointer shadow-lg shadow-rose-200'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Authorize Deletion</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmModal && (
        <div className="fixed inset-0 w-screen h-screen bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 z-[999999] animate-fadeIn text-slate-900">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md shadow-2xl relative overflow-hidden p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1.5 w-full text-left">
                <h4 className="font-extrabold text-sm text-slate-950">{confirmModal.title}</h4>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  {confirmModal.message}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer bg-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-md shadow-indigo-200"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Side Chat Console Button (Responsive) */}
      <div className="fixed right-0 md:right-0 bottom-6 md:top-1/2 md:-translate-y-1/2 z-45 flex flex-col items-end no-print mr-4 md:mr-0">
        {/* Mobile: Floating Circular/Horizontal Pill FAB */}
        <button
          type="button"
          onClick={() => setShowAdminChatSidebar(true)}
          className="md:hidden flex items-center justify-center gap-1.5 bg-gradient-to-r from-indigo-600 to-indigo-800 text-white font-extrabold text-[10px] uppercase tracking-wider py-2.5 px-3.5 shadow-xl shadow-indigo-600/30 rounded-full border border-indigo-500/20 active:scale-95 transition-all cursor-pointer select-none"
        >
          <MessageSquare className="w-4 h-4 text-white animate-pulse" />
          <span>Chat {adminUnreadCount > 0 && `(${adminUnreadCount})`}</span>
        </button>

        {/* Desktop: Elegant Vertical Handle */}
        <button
          type="button"
          onClick={() => setShowAdminChatSidebar(true)}
          className="hidden md:flex relative items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white font-extrabold text-[11px] uppercase tracking-wider py-3 px-3.5 shadow-xl transition-all cursor-pointer rounded-l-2xl border-l border-y border-indigo-500/30 group select-none hover:-translate-x-1 active:scale-95"
          style={{ writingMode: 'vertical-lr', textOrientation: 'mixed' }}
        >
          {adminUnreadCount > 0 && (
            <span className="absolute -top-2 -left-2 bg-rose-500 text-white text-[9px] font-black w-5.5 h-5.5 flex items-center justify-center rounded-full border-2 border-white shadow-lg animate-bounce normal-case tracking-normal">
              {adminUnreadCount}
            </span>
          )}
          <MessageSquare className="w-4 h-4 text-white -rotate-90 group-hover:scale-110 transition-transform mb-1.5" />
          <span>SaaS Chat Console</span>
        </button>
      </div>

      {/* Support Chat Console Drawer */}
      {showAdminChatSidebar && (
        <div className="fixed inset-0 z-50 flex justify-end no-print">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity cursor-pointer"
            onClick={() => setShowAdminChatSidebar(false)}
          />
          
          {/* Drawer content */}
          <div className="relative w-full max-w-4xl bg-white h-full shadow-2xl border-l border-slate-150 flex z-10 animate-slideLeft">
            
            {/* Left sidebar - Senders/Conversations List */}
            <div className={`w-full md:w-1/3 border-r border-slate-150 flex flex-col bg-slate-50 ${selectedChatPartnerId ? 'hidden md:flex' : 'flex'}`}>
              <div className="p-4 border-b border-slate-150 bg-slate-100/50 shrink-0 flex justify-between items-center">
                <div>
                  <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">Conversations</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">Active school and agent lines.</p>
                </div>
                {/* Exit Support Console button */}
                <button
                  type="button"
                  onClick={() => setShowAdminChatSidebar(false)}
                  className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-slate-800 transition-all cursor-pointer flex items-center gap-1 border border-slate-200 bg-white shadow-3xs"
                  title="Close support chat console"
                >
                  <X className="w-4 h-4" />
                  <span className="text-[9px] font-black uppercase tracking-wider pr-1 hidden sm:inline">Exit Console</span>
                </button>
              </div>

              {/* Start any new Chat searchable field */}
              <div className="p-3 bg-white border-b border-slate-150 shrink-0 relative">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search schools / agents to chat..."
                    value={newChatSearch}
                    onChange={(e) => {
                      setNewChatSearch(e.target.value);
                      setShowNewChatDropdown(true);
                    }}
                    onFocus={() => setShowNewChatDropdown(true)}
                    className="w-full pl-8 pr-8 py-1.5 text-xs bg-slate-50 focus:bg-white border border-slate-200 rounded-xl outline-none font-semibold text-slate-705 placeholder-slate-400 transition-all focus:border-indigo-500"
                  />
                  {newChatSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewChatSearch('');
                        setShowNewChatDropdown(false);
                      }}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                
                {showNewChatDropdown && newChatSearch.trim().length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 mx-3 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto z-50 divide-y divide-slate-100">
                    {schools
                      .filter(s => s.name.toLowerCase().includes(newChatSearch.toLowerCase()) || (s.email && s.email.toLowerCase().includes(newChatSearch.toLowerCase())))
                      .slice(0, 5)
                      .map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setSelectedChatPartnerId(s.id);
                            setNewChatSearch('');
                            setShowNewChatDropdown(false);
                          }}
                          className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-indigo-50/50 flex flex-col gap-0.5 cursor-pointer transition-all border-b border-slate-50"
                        >
                          <span className="font-extrabold text-slate-900 truncate">{s.name}</span>
                          <span className="text-[9px] text-indigo-600 font-extrabold uppercase tracking-wider">School Admin • {s.email || 'No Email'}</span>
                        </button>
                      ))}
                    {agents
                      .filter(a => a.fullName.toLowerCase().includes(newChatSearch.toLowerCase()))
                      .slice(0, 5)
                      .map(a => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => {
                            setSelectedChatPartnerId(a.id);
                            setNewChatSearch('');
                            setShowNewChatDropdown(false);
                          }}
                          className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-indigo-50/50 flex flex-col gap-0.5 cursor-pointer transition-all border-b border-slate-50"
                        >
                          <span className="font-extrabold text-slate-900 truncate">{a.fullName}</span>
                          <span className="text-[9px] text-teal-600 font-extrabold uppercase tracking-wider">Partner • {a.email || 'No Email'}</span>
                        </button>
                      ))}
                    {schools.filter(s => s.name.toLowerCase().includes(newChatSearch.toLowerCase())).length === 0 &&
                     agents.filter(a => a.fullName.toLowerCase().includes(newChatSearch.toLowerCase())).length === 0 && (
                      <div className="p-3 text-center text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                        No matches found
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {(() => {
                  const partnerMap = new Map<string, { id: string; name: string; role: string; lastMsg: string; lastSent: string; unread: boolean }>();
                  
                  chatMessages.forEach((msg) => {
                    const partnerId = msg.senderId === 'admin' ? msg.receiverId : msg.senderId;
                    const partnerName = msg.senderId === 'admin' ? msg.receiverName : msg.senderName;
                    const partnerRole = msg.senderId === 'admin' ? msg.receiverRole : msg.senderRole;
                    
                    partnerMap.set(partnerId, {
                      id: partnerId,
                      name: partnerName,
                      role: partnerRole,
                      lastMsg: msg.message,
                      lastSent: msg.sentAt,
                      unread: msg.senderId !== 'admin' && !msg.read
                    });
                  });

                  const partnersList = Array.from(partnerMap.values()).sort(
                    (a, b) => new Date(b.lastSent).getTime() - new Date(a.lastSent).getTime()
                  );

                  if (partnersList.length === 0) {
                    return (
                      <div className="py-12 text-center text-slate-400 font-semibold text-[11px] p-4 flex flex-col gap-1.5 items-center justify-center">
                        <span className="font-extrabold text-slate-600 uppercase tracking-wider text-[10px]">No active conversations</span>
                        <span className="text-slate-400 font-medium max-w-[200px] text-center leading-relaxed">Use the search bar above to start chatting with any school admin or referral partner.</span>
                      </div>
                    );
                  }

                  return partnersList.map((p) => {
                    const isActive = selectedChatPartnerId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedChatPartnerId(p.id)}
                        className={`w-full text-left p-3 transition-colors flex flex-col gap-1 relative cursor-pointer ${
                          isActive ? 'bg-indigo-50/70 border-r-4 border-indigo-600 font-bold' : 'hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex justify-between items-center w-full">
                          <span className="font-extrabold text-xs text-slate-900 truncate pr-2 max-w-[120px] flex items-center gap-1.5" title={p.name}>
                            {p.unread && <span className="w-1.5 h-1.5 bg-rose-500 rounded-full shrink-0 animate-pulse" />}
                            {p.name}
                          </span>
                          <span className={`px-1.5 py-0.2 rounded-md text-[8.5px] font-bold uppercase ${
                            p.role === 'agent' ? 'bg-teal-50 text-teal-700 border border-teal-100' : 'bg-blue-50 text-blue-700 border border-blue-100'
                          }`}>
                            {p.role}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 truncate font-semibold w-full">
                          {p.lastMsg}
                        </p>
                        <span className="text-[8px] text-slate-400 font-mono self-end">
                          {new Date(p.lastSent).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </button>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Right panel - Active Chat window */}
            <div className={`flex-1 flex flex-col h-full bg-white ${selectedChatPartnerId ? 'flex' : 'hidden md:flex'}`}>
              {selectedChatPartnerId ? (() => {
                const partnerMessages = chatMessages.filter(
                  m => m.senderId === selectedChatPartnerId || m.receiverId === selectedChatPartnerId
                );
                
                // Dynamically find partner details even if there are 0 messages in the thread
                const partnerSchool = schools.find(s => s.id === selectedChatPartnerId);
                const partnerAgent = agents.find(a => a.id === selectedChatPartnerId);
                
                const partnerName = partnerSchool 
                  ? partnerSchool.name 
                  : (partnerAgent 
                      ? partnerAgent.fullName 
                      : (partnerMessages[0] 
                          ? (partnerMessages[0].senderId === 'admin' ? partnerMessages[0].receiverName : partnerMessages[0].senderName) 
                          : 'Partner'));
                          
                const partnerRole = partnerSchool 
                  ? 'school' 
                  : (partnerAgent 
                      ? 'agent' 
                      : (partnerMessages[0] 
                          ? (partnerMessages[0].senderId === 'admin' ? partnerMessages[0].receiverRole : partnerMessages[0].senderRole) 
                          : 'school'));

                return (
                  <>
                    {/* Active chat header */}
                    <div className="p-4 border-b border-slate-150 bg-indigo-600 text-white flex justify-between items-center shrink-0">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Mobile back button */}
                        <button
                          type="button"
                          onClick={() => setSelectedChatPartnerId(null)}
                          className="md:hidden p-1.5 hover:bg-white/10 rounded-lg text-white transition-all cursor-pointer shrink-0"
                          title="Back to conversations"
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </button>

                        <div className="p-1.5 bg-white/10 rounded-lg shrink-0">
                          <MessageSquare className="w-5 h-5 text-white animate-pulse" />
                        </div>
                        <div className="truncate text-left">
                          <h3 className="font-extrabold text-xs uppercase tracking-wider truncate">{partnerName}</h3>
                          <span className={`px-1.5 py-0.2 rounded text-[8.5px] font-black uppercase ${
                            partnerRole === 'agent' ? 'bg-teal-500/30 text-teal-100' : 'bg-blue-500/30 text-blue-100'
                          }`}>
                            {partnerRole} console line
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Close Thread button (desktop/tablet) */}
                        <button
                          type="button"
                          onClick={() => setSelectedChatPartnerId(null)}
                          className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all cursor-pointer text-[10px] font-bold uppercase tracking-wider"
                          title="Back to conversations list"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Close Thread</span>
                        </button>

                        {/* Exit Console button */}
                        <button
                          type="button"
                          onClick={() => setShowAdminChatSidebar(false)}
                          className="p-1.5 hover:bg-white/10 rounded-lg text-white transition-all cursor-pointer flex items-center gap-1 border border-white/20 bg-white/5"
                          title="Exit Support Console"
                        >
                          <X className="w-4 h-4 text-white" />
                          <span className="text-[9px] font-black uppercase tracking-wider pr-1 hidden sm:inline text-white">Exit Console</span>
                        </button>
                      </div>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-3.5" ref={adminChatEndRef}>
                      {partnerMessages.map((msg) => {
                        const isMe = msg.senderId === 'admin';
                        const isEditing = editingMsgId === msg.id;
                        return (
                          <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}>
                            <span className="text-[9px] font-bold text-slate-400 uppercase mb-0.5 tracking-wider px-1">
                              {isMe ? 'You (SaaS Admin)' : msg.senderName}
                            </span>
                            {isEditing ? (
                              <div className="w-full max-w-[85%] bg-indigo-50 border border-indigo-150 rounded-xl p-2.5 space-y-2 mt-1">
                                <textarea
                                  value={editingMsgText}
                                  onChange={(e) => setEditingMsgText(e.target.value)}
                                  className="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg outline-none font-medium text-slate-800 resize-none font-sans"
                                  rows={2.5}
                                  placeholder="Edit message..."
                                />
                                <div className="flex gap-1.5 justify-end">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingMsgId(null);
                                      setEditingMsgText('');
                                    }}
                                    className="px-2 py-1 text-[9px] font-bold text-slate-500 hover:bg-slate-200 rounded-md transition-all cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditChatMessage(msg.id)}
                                    className="px-2.5 py-1 text-[9px] font-extrabold bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-all cursor-pointer"
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed font-medium shadow-2xs ${
                                isMe 
                                  ? 'bg-indigo-600 text-white rounded-tr-none' 
                                  : 'bg-white text-slate-800 border border-slate-150 rounded-tl-none'
                              }`}>
                                {renderMessageWithLinks(msg.message, isMe)}
                              </div>
                            )}
                            
                            {/* Actions bar for each message */}
                            <div className="flex items-center gap-2 mt-1 px-1 text-[8.5px] text-slate-400">
                              <span className="font-semibold font-mono">
                                {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {!isEditing && (
                                <>
                                  <span className="text-slate-300 select-none">•</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingMsgId(msg.id);
                                      setEditingMsgText(msg.message);
                                    }}
                                    className="hover:text-indigo-600 font-extrabold transition-all flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <Pencil className="w-2.5 h-2.5" />
                                    <span>Edit</span>
                                  </button>
                                  <span className="text-slate-300 select-none">•</span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteChatMessage(msg.id)}
                                    className="hover:text-rose-600 font-extrabold transition-all flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <Trash2 className="w-2.5 h-2.5" />
                                    <span>Delete</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Link Creator Component right above input */}
                    <div className="px-3 py-1.5 bg-white border-t border-slate-100">
                      <LinkButtonCreator textValue={adminChatInput} onTextChange={setAdminChatInput} />
                    </div>

                    {/* Chat Input Form */}
                    <form onSubmit={handleSendAdminChatMessage} className="p-3 border-t border-slate-150 bg-white shrink-0 flex gap-2">
                      <input
                        type="text"
                        placeholder="Type reply here..."
                        value={adminChatInput}
                        onChange={(e) => setAdminChatInput(e.target.value)}
                        className="flex-1 px-3.5 py-2 text-xs border border-slate-200 bg-slate-50 rounded-xl outline-none focus:border-indigo-500 font-semibold"
                        maxLength={500}
                      />
                      <button
                        type="submit"
                        disabled={!adminChatInput.trim()}
                        className="px-3 py-2 bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 disabled:from-slate-200 disabled:to-slate-300 disabled:text-slate-400 text-white rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center shadow-xs"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </>
                );
              })() : (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2.5">
                  <MessageSquare className="w-12 h-12 text-indigo-300 animate-pulse" />
                  <div>
                    <p className="text-xs font-bold">No active conversation selected.</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Select a conversation partner from the list on the left to begin direct messaging.</p>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Edit Notification Modal */}
      {editingNotification && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn font-sans">
          <div className="bg-white border border-slate-200 p-6 rounded-2xl w-full max-w-xl space-y-4 shadow-2xl text-slate-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-indigo-600">
                <Bell className="w-5 h-5" />
                <h4 className="font-extrabold text-sm uppercase tracking-wider">Edit Notification</h4>
              </div>
              <button 
                type="button"
                onClick={() => setEditingNotification(null)}
                className="text-slate-400 hover:text-slate-600 transition-all p-1 hover:bg-slate-50 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditNotificationSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase text-gray-500 block">Notification Title</label>
                <input
                  type="text"
                  required
                  value={editingNotification.title}
                  onChange={(e) => setEditingNotification({ ...editingNotification, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-200 bg-slate-50 focus:bg-white rounded-lg outline-none font-semibold text-gray-700"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase text-gray-500 block">Message Body</label>
                <textarea
                  required
                  rows={4}
                  value={editingNotification.message}
                  onChange={(e) => setEditingNotification({ ...editingNotification, message: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-gray-200 bg-slate-50 focus:bg-white rounded-lg outline-none font-semibold text-gray-700 font-sans leading-relaxed resize-none"
                />
                <div className="mt-1">
                  <LinkButtonCreator 
                    textValue={editingNotification.message} 
                    onTextChange={(val) => setEditingNotification({ ...editingNotification, message: val })} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase text-gray-500 block">Alert Type</label>
                  <select
                    value={editingNotification.type}
                    onChange={(e) => setEditingNotification({ ...editingNotification, type: e.target.value as any })}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-gray-200 text-slate-705 font-bold rounded-lg outline-none cursor-pointer"
                  >
                    <option value="info">🔵 Info (Blue)</option>
                    <option value="success">🟢 Success (Green)</option>
                    <option value="warning">🟡 Warning (Amber)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase text-gray-500 block">Recipients</label>
                  <select
                    value={editingNotification.targetSchoolIds.includes('all') ? 'all' : 'custom'}
                    onChange={(e) => {
                      const mode = e.target.value;
                      setEditingNotification({
                        ...editingNotification,
                        targetSchoolIds: mode === 'all' ? ['all'] : []
                      });
                    }}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-gray-200 text-slate-705 font-bold rounded-lg outline-none font-sans cursor-pointer"
                  >
                    <option value="all">🌐 All Schools</option>
                    <option value="custom">🎯 Select Schools</option>
                  </select>
                </div>
              </div>

              {!editingNotification.targetSchoolIds.includes('all') && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[9px] font-black uppercase text-gray-400 block">Select Target Schools:</span>
                  {/* SEARCH BAR */}
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search schools..."
                      value={schoolSearchQuery}
                      onChange={(e) => setSchoolSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 focus:bg-white border border-gray-200 rounded-lg outline-none font-semibold text-gray-700 placeholder-slate-400 transition-all focus:ring-1 focus:ring-indigo-500/20"
                    />
                  </div>
                  <div className="max-h-32 overflow-y-auto border border-slate-100 rounded-lg p-2 bg-slate-50/50 space-y-1 divide-y divide-slate-100">
                    {uniqueSchools
                      .filter(s => s.name.toLowerCase().includes(schoolSearchQuery.toLowerCase()))
                      .map(s => {
                        const isChecked = editingNotification.targetSchoolIds.includes(s.id);
                        return (
                          <label key={s.id} className="flex items-center gap-2 py-1 text-[11px] font-bold text-slate-800 cursor-pointer select-none hover:text-indigo-600">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                const prevTargets = editingNotification.targetSchoolIds;
                                const newTargets = isChecked
                                  ? prevTargets.filter(id => id !== s.id)
                                  : [...prevTargets, s.id];
                                setEditingNotification({
                                  ...editingNotification,
                                  targetSchoolIds: newTargets
                                });
                              }}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20"
                            />
                            <span className="truncate">{s.name}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-3 justify-end border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingNotification(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
