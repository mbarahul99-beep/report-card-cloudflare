import React, { useState, useEffect } from 'react';
import { 
  LayoutGrid, Layers, Plus, Trash2, Check, AlertCircle, Save, Calendar, 
  Settings, Eye, Edit, ChevronDown, ChevronUp, Sparkles, Filter, 
  ArrowUpRight, Clock, HelpCircle, RefreshCw, X, ShieldAlert, CheckCircle2,
  Bookmark, ArrowRight, Palette, Trophy, FileText, Lock, GripVertical, BookOpen, Type,
  ArrowLeft, Printer, Building2, Upload, Link2
} from 'lucide-react';
import { 
  SchoolBranding, SubjectColumn, ScoreColumn, ReportCardStructure, 
  GradeScale, CoGradeScale, CoScholasticSection, SignatureItem, 
  ReportCardTemplate, TemplateRequest, TemplateRecycleBinItem, Student, StudentGrades, SaasSchool, SaasNotification,
  SchoolClassItem
} from '../types';
import { classesMatch, getStandardClassPresets, parseClassAndSection, formatClassSectionTarget } from '../utils/classNormalizer';
import { normalizeExternalImageUrl, isGoogleDriveUrl, compressAndResizeWatermark } from '../utils/imageUrlHelper';
import ReportCardPreview from './ReportCardPreview';
import { 
  loadAllTemplatesFromCloud, saveTemplateToCloud, deleteTemplateFromCloud, subscribeTemplates,
  loadAllTemplateRequestsFromCloud, saveTemplateRequestToCloud, subscribeTemplateRequests,
  deleteTemplateRequestFromCloud,
  loadTemplateRecycleBinFromCloud, saveTemplateRecycleBinToCloud, deleteTemplateFromRecycleBinCloud,
  saveSchoolToCloud, loadSchoolFromCloud, saveNotificationToCloud,
  assignTemplateToSchool, loadAllSchoolsFromCloud, subscribeSchoolsFromCloud, normalizeCloudSchoolId
} from '../lib/firebaseSync';
import { 
  initialBranding, 
  defaultSubjects as defaultDemoSubjects, 
  defaultScoreColumns as defaultDemoScoreColumns, 
  defaultGradeScales as defaultDemoGradeScales 
} from '../data/defaultData';

const FONT_FAMILIES = [
  { label: 'Georgia (Serif)', value: 'Georgia, serif' },
  { label: 'Playfair Display (Serif)', value: '"Playfair Display", Georgia, serif' },
  { label: 'Merriweather (Serif)', value: '"Merriweather", serif' },
  { label: 'Cinzel (Decorative Serif)', value: '"Cinzel", serif' },
  { label: 'Garamond (Classic Serif)', value: 'Garamond, serif' },
  { label: 'Times New Roman (Formal)', value: '"Times New Roman", Times, serif' },
  { label: 'Inter (Modern Sans)', value: 'Inter, sans-serif' },
  { label: 'Montserrat (Bold Sans)', value: '"Montserrat", sans-serif' },
  { label: 'Poppins (Geometric Sans)', value: '"Poppins", sans-serif' },
  { label: 'Roboto (Clean Sans)', value: 'Roboto, sans-serif' },
  { label: 'Arial (Standard Sans)', value: 'Arial, sans-serif' },
];

const STANDARD_ADDITIONAL_SUBJECTS = [
  "Moral Science",
  "General Knowledge (G.K.)",
  "Computer Science",
  "French",
  "Sanskrit",
  "Urdu",
  "Environmental Studies (EVS)",
  "Art & Craft",
  "Physical & Health Education",
  "Music & Dance",
  "Yoga & Health",
  "Value Education"
];

const STANDARD_SCHOLASTIC_SUBJECTS = [
  "Mathematics",
  "English Language",
  "General Science",
  "Social Studies / EVS",
  "Hindi Course",
  "Physics",
  "Chemistry",
  "Biology",
  "History & Civics",
  "Geography",
  "Information Technology"
];

const STANDARD_EXAM_SUGGESTIONS = [
  { name: "Theory Exam", maxMarks: 80 },
  { name: "Oral / Viva", maxMarks: 20 },
  { name: "Periodic Test (PT)", maxMarks: 10 },
  { name: "Practical / Lab", maxMarks: 30 },
  { name: "Project Work", maxMarks: 20 },
  { name: "Notebook Submission", maxMarks: 5 },
  { name: "Subject Enrichment", maxMarks: 5 },
  { name: "Unit Test", maxMarks: 25 },
  { name: "Half Yearly", maxMarks: 50 },
  { name: "Annual Exam", maxMarks: 100 }
];

const STANDARD_PROFILE_FIELDS = [
  "Scholar's Name",
  "Father's Name",
  "Mother's Name",
  "Class & Section",
  "Roll No.",
  "Scholar / Admission Id",
  "Date of Birth (DOB)",
  "Attendance (Present/Total)",
  "Blood Group",
  "House / Team",
  "Aadhaar / UID",
  "Contact Number",
  "Residential Address"
];

const STANDARD_SIGNATURE_SUGGESTIONS = [
  "Class Teacher / Tutor",
  "Head of Department / HOD",
  "Examination Controller",
  "Principal Stamp & Sign",
  "Director / Administrator",
  "Parent / Guardian"
];

// Helper to generate mock grades for the live preview with demo data
const makeDemoGrades = (
  subjects: SubjectColumn[],
  scoreColumns: ScoreColumn[],
  termSpecificScoreColumnsEnabled?: boolean,
  term1ScoreColumns?: ScoreColumn[],
  term2ScoreColumns?: ScoreColumn[],
  term3ScoreColumns?: ScoreColumn[]
) => {
  const scholastic: { [subId: string]: any } = {};
  const co_scholastic: { [subId: string]: any } = {};
  const activity: { [subId: string]: any } = {};

  const t1Cols = (termSpecificScoreColumnsEnabled && term1ScoreColumns && term1ScoreColumns.length > 0) ? term1ScoreColumns : scoreColumns;
  const t2Cols = (termSpecificScoreColumnsEnabled && term2ScoreColumns && term2ScoreColumns.length > 0) ? term2ScoreColumns : scoreColumns;
  const t3Cols = (termSpecificScoreColumnsEnabled && term3ScoreColumns && term3ScoreColumns.length > 0) ? term3ScoreColumns : scoreColumns;

  subjects.filter(s => s.type === 'scholastic' || s.type === 'additional').forEach((sub, idx) => {
    const term1: { [colId: string]: any } = {};
    const term2: { [colId: string]: any } = {};
    const term3: { [colId: string]: any } = {};

    if (t1Cols && t1Cols.length > 0) {
      t1Cols.forEach(col => {
        const max = col.maxMarks || 100;
        term1[col.id] = Math.round(max * (idx % 2 === 0 ? 0.88 : 0.78));
      });
    } else {
      const gradeT1 = (idx % 4 === 0) ? 'E' : ((idx % 4 === 1) ? 'M' : ((idx % 4 === 2) ? 'E' : 'M'));
      term1['_direct_grade'] = gradeT1;
      term1['grade'] = gradeT1;
      term1['total'] = gradeT1 === 'E' ? 90 : 75;
    }

    if (t2Cols && t2Cols.length > 0) {
      t2Cols.forEach(col => {
        const max = col.maxMarks || 100;
        term2[col.id] = Math.round(max * (idx % 2 === 0 ? 0.92 : 0.84));
      });
    } else {
      const gradeT2 = (idx % 3 === 0) ? 'E' : 'M';
      term2['_direct_grade'] = gradeT2;
      term2['grade'] = gradeT2;
      term2['total'] = gradeT2 === 'E' ? 92 : 78;
    }

    if (t3Cols && t3Cols.length > 0) {
      t3Cols.forEach(col => {
        const max = col.maxMarks || 100;
        term3[col.id] = Math.round(max * (idx % 2 === 0 ? 0.90 : 0.82));
      });
    } else {
      term3['_direct_grade'] = 'E';
      term3['grade'] = 'E';
      term3['total'] = 90;
    }

    scholastic[sub.id] = { term1, term2, term3 };
  });

  subjects.filter(s => s.type === 'co_scholastic').forEach(sub => {
    co_scholastic[sub.id] = { term1: 'A', term2: 'A+', term3: 'A' };
  });

  subjects.filter(s => s.type === 'activity').forEach(sub => {
    activity[sub.id] = { term1: 'A', term2: 'A', term3: 'A' };
  });

  return {
    studentId: 'demo_student_id',
    scholastic,
    co_scholastic,
    activity,
    attendance: { term1: '95/100', term2: '98/100', term3: '96/100' }
  } as StudentGrades;
};

function compressAndResizeImage(file: File, maxWidth: number, quality: number, callback: (resizedBase64: string) => void) {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = (event) => {
    const img = new Image();
    img.src = event.target?.result as string;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL(file.type || 'image/jpeg', quality);
      callback(dataUrl);
    };
  };
}

// Default Demo Student Profile
const defaultDemoStudent: Student = {
  id: "demo_student_id",
  name: "Aditya Vardhan",
  fatherName: "Mr. Ramesh Vardhan",
  motherName: "Mrs. Shreya Vardhan",
  className: "1st Grade",
  section: "A",
  rollNo: "01",
  admissionNo: "ADM-2024/001",
  dob: "05/08/2018",
  height: "115 cm",
  weight: "21 kg",
  photoUrl: "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=250",
  remarks: "Aditya has shown spectacular performance this year with outstanding analytical thinking and proactive involvement in group tasks.",
  promotionStatus: "Promoted to 2nd Grade with high distinction."
};

interface TemplateGalleryProps {
  mode: 'saas' | 'school';
  schoolId?: string;
  schoolName?: string;
  currentSchoolStructures?: ReportCardStructure[];
  onUpdateSchoolStructures?: (updated: ReportCardStructure[]) => void;
  schoolClasses?: SchoolClassItem[];
}

export default function TemplateGalleryManager({
  mode,
  schoolId = '',
  schoolName = '',
  currentSchoolStructures = [],
  onUpdateSchoolStructures,
  schoolClasses = []
}: TemplateGalleryProps) {
  // Global states
  const [templates, setTemplates] = useState<ReportCardTemplate[]>([]);
  const [requests, setRequests] = useState<TemplateRequest[]>([]);
  const [recycleBin, setRecycleBin] = useState<TemplateRecycleBinItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active sub-tabs
  const [activeTab, setActiveTab] = useState<'gallery' | 'requests' | 'recycle' | 'my_templates'>('gallery');

  // Filtering
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [classFilter, setClassFilter] = useState<string>('');

  // Previewing
  const [previewTemplate, setPreviewTemplate] = useState<ReportCardTemplate | null>(null);

  // Designing states
  const [editingTemplate, setEditingTemplate] = useState<Partial<ReportCardTemplate> | null>(null);
  const [designAccordion, setDesignAccordion] = useState<string>('basic');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Deletion Confirmation Modal
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [confirmDeleteText, setConfirmDeleteText] = useState('');

  // Local subject additions state
  const [newSubName, setNewSubName] = useState('');
  const [newAdditionalSubName, setNewAdditionalSubName] = useState('');
  const [newSubType, setNewSubType] = useState<'scholastic' | 'co_scholastic' | 'activity' | 'additional'>('scholastic');

  // Local exam additions state
  const [newExamName, setNewExamName] = useState('');
  const [newExamMax, setNewExamMax] = useState(100);
  const [selectedExamTermTab, setSelectedExamTermTab] = useState<1 | 2 | 3>(1);

  // Direct Template Assignment to School (SaaS mode)
  const [assigningTemplate, setAssigningTemplate] = useState<ReportCardTemplate | null>(null);
  const [targetSchoolId, setTargetSchoolId] = useState<string>('');
  const [targetClassesText, setTargetClassesText] = useState<string>('');
  const [schoolsList, setSchoolsList] = useState<SaasSchool[]>([]);
  const [isAssigning, setIsAssigning] = useState<boolean>(false);
  const [assignSuccessMsg, setAssignSuccessMsg] = useState<string | null>(null);

  // Target school classes state & dynamic section adding
  const [targetSchoolClasses, setTargetSchoolClasses] = useState<SchoolClassItem[]>([]);
  const [isLoadingTargetClasses, setIsLoadingTargetClasses] = useState<boolean>(false);
  const [activeAddSecClass, setActiveAddSecClass] = useState<string | null>(null);
  const [newSecInput, setNewSecInput] = useState<string>('');
  const [isAddingNewClass, setIsAddingNewClass] = useState<boolean>(false);
  const [newClassNameInput, setNewClassNameInput] = useState<string>('');
  const [newClassSecInput, setNewClassSecInput] = useState<string>('A, B');

  // Load all registered schools for SaaS assignment selector
  useEffect(() => {
    if (mode === 'saas') {
      const unsub = subscribeSchoolsFromCloud((schools) => {
        setSchoolsList(schools);
        if (schools.length > 0 && !targetSchoolId) {
          const gautam = schools.find(s => s.name?.toLowerCase().includes('gautam') || s.id === 'sc_1786849346387');
          setTargetSchoolId(gautam ? gautam.id : schools[0].id);
        }
      });
      return () => unsub();
    }
  }, [mode]);

  useEffect(() => {
    if (assigningTemplate) {
      setTargetClassesText((assigningTemplate.assignedClasses || []).join(', '));
      setAssignSuccessMsg(null);
      if (!targetSchoolId && schoolsList.length > 0) {
        const gautam = schoolsList.find(s => s.name?.toLowerCase().includes('gautam') || s.id === 'sc_1786849346387');
        setTargetSchoolId(gautam ? gautam.id : schoolsList[0].id);
      }
    }
  }, [assigningTemplate, schoolsList]);

  // Load target school's classes whenever targetSchoolId changes
  useEffect(() => {
    if (!targetSchoolId) {
      setTargetSchoolClasses([]);
      return;
    }
    const cleanId = normalizeCloudSchoolId(targetSchoolId);
    const targetSchool = schoolsList.find(s => s.id === targetSchoolId || normalizeCloudSchoolId(s.id) === cleanId);

    // 1. Instant check from schoolsList
    let foundClasses: SchoolClassItem[] = targetSchool?.classes && targetSchool.classes.length > 0 
      ? targetSchool.classes 
      : [];

    // 2. Check localStorage cache
    if (foundClasses.length === 0) {
      try {
        const cached = localStorage.getItem(`class_on_classes_${cleanId}`) || localStorage.getItem(`class_on_classes_${targetSchoolId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) foundClasses = parsed;
        }
      } catch {}
    }

    if (foundClasses.length > 0) {
      setTargetSchoolClasses(foundClasses);
    }

    // 3. Asynchronously fetch full school document & subcollections (including students) from cloud
    setIsLoadingTargetClasses(true);
    loadSchoolFromCloud(targetSchoolId).then((cloudData) => {
      if (cloudData) {
        let classesFromCloud = cloudData.classes && cloudData.classes.length > 0 ? cloudData.classes : [];
        const classMap = new Map<string, Set<string>>();
        classesFromCloud.forEach(c => {
          classMap.set(c.name.toLowerCase().trim(), new Set((c.sections || []).map(s => s.toUpperCase().trim())));
        });

        // Merge sections from active students so any section created via student roster is recognized
        if (cloudData.students && cloudData.students.length > 0) {
          cloudData.students.forEach(std => {
            if (std.className) {
              const key = std.className.toLowerCase().trim();
              if (!classMap.has(key)) {
                classMap.set(key, new Set());
              }
              if (std.section) {
                classMap.get(key)!.add(std.section.toUpperCase().trim());
              }
            }
          });

          if (classesFromCloud.length === 0) {
            const reconstructed: SchoolClassItem[] = [];
            let idx = 1;
            classMap.forEach((secSet, clsKey) => {
              const secs = Array.from(secSet);
              const origStd = cloudData.students?.find(s => s.className?.toLowerCase().trim() === clsKey);
              const displayName = origStd?.className || clsKey;
              reconstructed.push({
                id: `cls_auto_${idx++}`,
                name: displayName,
                sections: secs.length > 0 ? secs : ['A', 'B']
              });
            });
            if (reconstructed.length > 0) classesFromCloud = reconstructed;
          } else {
            classesFromCloud = classesFromCloud.map(c => {
              const key = c.name.toLowerCase().trim();
              const secs = new Set((c.sections || []).map(s => s.toUpperCase().trim()));
              if (classMap.has(key)) {
                classMap.get(key)!.forEach(s => secs.add(s));
              }
              return {
                ...c,
                sections: Array.from(secs)
              };
            });
          }
        }

        if (classesFromCloud.length > 0) {
          setTargetSchoolClasses(classesFromCloud);
          try {
            localStorage.setItem(`class_on_classes_${cleanId}`, JSON.stringify(classesFromCloud));
          } catch {}
        } else if (foundClasses.length === 0) {
          const style = cloudData.classNamingStyle || targetSchool?.classNamingStyle || 'roman';
          setTargetSchoolClasses(getStandardClassPresets(style as any));
        }
      }
    }).catch(err => {
      console.warn("Could not fetch target school cloud classes:", err);
    }).finally(() => {
      setIsLoadingTargetClasses(false);
    });
  }, [targetSchoolId, schoolsList]);

  const handleConfirmAssignToSchool = async () => {
    if (!assigningTemplate || !targetSchoolId) return;
    setIsAssigning(true);
    try {
      const customClasses = targetClassesText
        .split(',')
        .map(c => c.trim())
        .filter(Boolean);

      const assignedStructure = await assignTemplateToSchool(
        targetSchoolId,
        assigningTemplate,
        customClasses.length > 0 ? customClasses : undefined
      );

      const targetSchool = schoolsList.find(s => s.id === targetSchoolId);
      const schoolDisplayName = targetSchool?.name || "Target School";

      // If currently viewing/impersonating this target school, update the local structure state immediately
      if (schoolId === targetSchoolId && onUpdateSchoolStructures) {
        const updated = (currentSchoolStructures || []).filter(s => s.id !== assignedStructure.id);
        updated.push(assignedStructure);
        onUpdateSchoolStructures(updated);
      }

      setAssignSuccessMsg(`Successfully assigned '${assigningTemplate.name}' to ${schoolDisplayName}! The template structure is now fully live and synced in the school's database.`);
      setTimeout(() => {
        setAssigningTemplate(null);
        setAssignSuccessMsg(null);
      }, 2500);
    } catch (err: any) {
      console.error("Failed to assign template to school:", err);
      alert("Failed to assign template to school: " + (err?.message || "Unknown error"));
    } finally {
      setIsAssigning(false);
    }
  };

  // Drag-and-drop & editing helpers for the SaaS Blueprint Designer
  const [draggedSubId, setDraggedSubId] = useState<string | null>(null);
  const [draggedColId, setDraggedColId] = useState<string | null>(null);
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null);
  const [draggedGradeIdx, setDraggedGradeIdx] = useState<number | null>(null);
  const [newFieldNameInput, setNewFieldNameInput] = useState('');

  const handleBrandingFieldChange = (key: string, val: any) => {
    setEditingTemplate(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        branding: { ...(prev.branding || {}), [key]: val } as SchoolBranding
      };
    });
  };

  const handleSubDragStart = (e: React.DragEvent, id: string) => {
    setDraggedSubId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSubDragOver = (e: React.DragEvent, id: string, type: string) => {
    e.preventDefault();
    if (!draggedSubId || draggedSubId === id) return;
    
    setEditingTemplate(prev => {
      if (!prev || !prev.subjects) return prev;
      const subjects = prev.subjects;
      const draggedSub = subjects.find(s => s.id === draggedSubId);
      if (!draggedSub || draggedSub.type !== type) return prev;

      const dragIdx = subjects.findIndex(s => s.id === draggedSubId);
      const hoverIdx = subjects.findIndex(s => s.id === id);
      if (dragIdx === -1 || hoverIdx === -1) return prev;

      const updated = [...subjects];
      const [draggedItem] = updated.splice(dragIdx, 1);
      updated.splice(hoverIdx, 0, draggedItem);
      return { ...prev, subjects: updated };
    });
  };

  const moveSubjectItem = (id: string, direction: 'up' | 'down') => {
    setEditingTemplate(prev => {
      if (!prev || !prev.subjects) return prev;
      const subjects = prev.subjects;
      const sub = subjects.find(s => s.id === id);
      if (!sub) return prev;

      const sameTypeSubs = subjects.filter(s => s.type === sub.type && s.sectionId === sub.sectionId);
      const indexInType = sameTypeSubs.findIndex(s => s.id === id);
      const nextIndexInType = direction === 'up' ? indexInType - 1 : indexInType + 1;
      if (nextIndexInType < 0 || nextIndexInType >= sameTypeSubs.length) return prev;

      const targetSub = sameTypeSubs[nextIndexInType];
      const realIndex = subjects.findIndex(s => s.id === id);
      const realTargetIndex = subjects.findIndex(s => s.id === targetSub.id);

      const updated = [...subjects];
      updated[realIndex] = targetSub;
      updated[realTargetIndex] = sub;
      return { ...prev, subjects: updated };
    });
  };

  const handleModifySubjectName = (subId: string, name: string) => {
    setEditingTemplate(prev => {
      if (!prev || !prev.subjects) return prev;
      return {
        ...prev,
        subjects: prev.subjects.map(s => s.id === subId ? { ...s, name } : s)
      };
    });
  };

  const handleUpdateSubjectMaxMarks = (subId: string, val: number) => {
    setEditingTemplate(prev => {
      if (!prev || !prev.subjects) return prev;
      return {
        ...prev,
        subjects: prev.subjects.map(s => s.id === subId ? { ...s, maxMarks: Math.max(1, val) } : s)
      };
    });
  };

  const handleUpdateSubjectColumnMaxMarks = (subId: string, colId: string, val: number) => {
    setEditingTemplate(prev => {
      if (!prev || !prev.subjects) return prev;
      return {
        ...prev,
        subjects: prev.subjects.map(s => {
          if (s.id === subId) {
            const customMax = { ...(s.customMaxMarks || {}) };
            customMax[colId] = Math.max(0, val);
            return { ...s, customMaxMarks: customMax };
          }
          return s;
        })
      };
    });
  };

  const handleAddCustomSubjectToTemplate = (type: 'scholastic' | 'co_scholastic' | 'activity' | 'additional', customName?: string) => {
    const labelType = type === 'scholastic' 
      ? 'Scholastic' 
      : type === 'additional'
        ? 'Additional'
        : type === 'co_scholastic'
          ? 'Co-Scholastic'
          : 'Activity';

    setEditingTemplate(prev => {
      if (!prev) return prev;
      const currentSubs = prev.subjects || [];
      const randId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      const newSub: SubjectColumn = {
        id: randId,
        name: customName?.trim() || `New ${labelType} Subject`,
        type,
        sequence: currentSubs.length,
        maxMarks: (type === 'scholastic' || type === 'additional') ? 100 : undefined
      };
      return {
        ...prev,
        subjects: [...currentSubs, newSub]
      };
    });
  };

  const handleLoadCbse8PointGrades = () => {
    const cbseScales: GradeScale[] = [
      { grade: 'A1', minPercent: 91, maxPercent: 100 },
      { grade: 'A2', minPercent: 81, maxPercent: 90 },
      { grade: 'B1', minPercent: 71, maxPercent: 80 },
      { grade: 'B2', minPercent: 61, maxPercent: 70 },
      { grade: 'C1', minPercent: 51, maxPercent: 60 },
      { grade: 'C2', minPercent: 41, maxPercent: 50 },
      { grade: 'D', minPercent: 33, maxPercent: 40 },
      { grade: 'E', minPercent: 0, maxPercent: 32 },
    ];
    setEditingTemplate(prev => prev ? ({ ...prev, gradeScales: cbseScales }) : prev);
  };

  const handleLoad5PointGrades = () => {
    const scales: GradeScale[] = [
      { grade: 'A', minPercent: 80, maxPercent: 100 },
      { grade: 'B', minPercent: 65, maxPercent: 79 },
      { grade: 'C', minPercent: 50, maxPercent: 64 },
      { grade: 'D', minPercent: 35, maxPercent: 49 },
      { grade: 'E', minPercent: 0, maxPercent: 34 },
    ];
    setEditingTemplate(prev => prev ? ({ ...prev, gradeScales: scales }) : prev);
  };

  const handleLoad10PointGpaGrades = () => {
    const scales: GradeScale[] = [
      { grade: 'O', minPercent: 90, maxPercent: 100 },
      { grade: 'A+', minPercent: 80, maxPercent: 89 },
      { grade: 'A', minPercent: 70, maxPercent: 79 },
      { grade: 'B+', minPercent: 60, maxPercent: 69 },
      { grade: 'B', minPercent: 50, maxPercent: 59 },
      { grade: 'C', minPercent: 40, maxPercent: 49 },
      { grade: 'F', minPercent: 0, maxPercent: 39 },
    ];
    setEditingTemplate(prev => prev ? ({ ...prev, gradeScales: scales }) : prev);
  };

  const handleLoadCoGradePreset5 = () => {
    const coScales: CoGradeScale[] = [
      { score: 'A', description: 'Outstanding / Exemplary Performance' },
      { score: 'B', description: 'Very Good / Commendable' },
      { score: 'C', description: 'Good / Competent' },
      { score: 'D', description: 'Fair / Needs Guidance' },
      { score: 'E', description: 'Basic / Scope for Improvement' },
    ];
    setEditingTemplate(prev => prev ? ({ ...prev, coGradeScales: coScales }) : prev);
  };

  const handleLoadCoGradePreset3 = () => {
    const coScales: CoGradeScale[] = [
      { score: 'A', description: 'Outstanding' },
      { score: 'B', description: 'Very Good' },
      { score: 'C', description: 'Fair / Satisfactory' },
    ];
    setEditingTemplate(prev => prev ? ({ ...prev, coGradeScales: coScales }) : prev);
  };

  const handleColDragStart = (e: React.DragEvent, id: string) => {
    setDraggedColId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const getActiveTemplateScoreColumns = (): ScoreColumn[] => {
    if (!editingTemplate) return [];
    if (!editingTemplate.termSpecificScoreColumnsEnabled) {
      return editingTemplate.scoreColumns || [];
    }
    if (selectedExamTermTab === 1) return editingTemplate.term1ScoreColumns || editingTemplate.scoreColumns || [];
    if (selectedExamTermTab === 2) return editingTemplate.term2ScoreColumns || editingTemplate.scoreColumns || [];
    return editingTemplate.term3ScoreColumns || editingTemplate.scoreColumns || [];
  };

  const updateActiveTemplateScoreColumns = (
    updater: (cols: ScoreColumn[]) => ScoreColumn[]
  ) => {
    setEditingTemplate((prev) => {
      if (!prev) return prev;
      if (!prev.termSpecificScoreColumnsEnabled) {
        const current = prev.scoreColumns || [];
        return { ...prev, scoreColumns: updater(current) };
      }
      if (selectedExamTermTab === 1) {
        const current = prev.term1ScoreColumns || prev.scoreColumns || [];
        return { ...prev, term1ScoreColumns: updater(current) };
      }
      if (selectedExamTermTab === 2) {
        const current = prev.term2ScoreColumns || prev.scoreColumns || [];
        return { ...prev, term2ScoreColumns: updater(current) };
      }
      const current = prev.term3ScoreColumns || prev.scoreColumns || [];
      return { ...prev, term3ScoreColumns: updater(current) };
    });
  };

  const handleColDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (!draggedColId || draggedColId === id) return;
    updateActiveTemplateScoreColumns(cols => {
      const dragIdx = cols.findIndex(c => c.id === draggedColId);
      const hoverIdx = cols.findIndex(c => c.id === id);
      if (dragIdx === -1 || hoverIdx === -1) return cols;

      const updated = [...cols];
      const [draggedItem] = updated.splice(dragIdx, 1);
      updated.splice(hoverIdx, 0, draggedItem);
      return updated;
    });
  };

  const moveScoreColItem = (idx: number, direction: 'up' | 'down') => {
    updateActiveTemplateScoreColumns(cols => {
      const nextIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (nextIdx < 0 || nextIdx >= cols.length) return cols;

      const updated = [...cols];
      const [moved] = updated.splice(idx, 1);
      updated.splice(nextIdx, 0, moved);
      return updated;
    });
  };

  const handleAddCustomExamColumn = () => {
    const currentCols = getActiveTemplateScoreColumns();
    const randId = `custom_exam_${Date.now()}`;
    const newCol: ScoreColumn = {
      id: randId,
      name: "Short Assessment",
      maxMarks: 20,
      sequence: currentCols.length
    };
    updateActiveTemplateScoreColumns(cols => [...cols, newCol]);
  };

  const handleRemoveCustomExamColumn = (colId: string) => {
    updateActiveTemplateScoreColumns(cols => cols.filter(c => c.id !== colId));
  };

  const handleUpdateCustomExamColumnName = (colId: string, name: string) => {
    updateActiveTemplateScoreColumns(cols => cols.map(c => c.id === colId ? { ...c, name } : c));
  };

  const handleUpdateColumnMaxMarks = (colId: string, val: number) => {
    updateActiveTemplateScoreColumns(cols => cols.map(c => c.id === colId ? { ...c, maxMarks: Math.max(1, val) } : c));
  };

  const handleCopyTemplateTermCols = (source: 'master' | 'term1' | 'term2' | 'term3') => {
    let sourceCols: ScoreColumn[] = [];
    if (source === 'master') sourceCols = editingTemplate?.scoreColumns || [];
    else if (source === 'term1') sourceCols = editingTemplate?.term1ScoreColumns || editingTemplate?.scoreColumns || [];
    else if (source === 'term2') sourceCols = editingTemplate?.term2ScoreColumns || editingTemplate?.scoreColumns || [];
    else if (source === 'term3') sourceCols = editingTemplate?.term3ScoreColumns || editingTemplate?.scoreColumns || [];

    const cloned = sourceCols.map((c, i) => ({
      ...c,
      id: `col_copy_${Date.now()}_${i}`,
    }));

    updateActiveTemplateScoreColumns(() => cloned);
  };

  const handleApplyTemplateActiveTermToAll = () => {
    const activeCols = getActiveTemplateScoreColumns();
    const cloneForTerm = () => activeCols.map((c, i) => ({ ...c, id: `col_rep_${Date.now()}_${Math.random().toString(36).substr(2, 4)}_${i}` }));

    setEditingTemplate(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        term1ScoreColumns: cloneForTerm(),
        term2ScoreColumns: cloneForTerm(),
        term3ScoreColumns: cloneForTerm(),
      };
    });
  };

  const handleFieldDragStart = (e: React.DragEvent, id: string) => {
    setDraggedFieldId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleFieldDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (!draggedFieldId || draggedFieldId === id) return;
    setEditingTemplate(prev => {
      if (!prev || !prev.branding || !prev.branding.studentFields) return prev;
      const fields = prev.branding.studentFields;
      const dragIdx = fields.findIndex(f => f.id === draggedFieldId);
      const hoverIdx = fields.findIndex(f => f.id === id);
      if (dragIdx === -1 || hoverIdx === -1) return prev;

      const updated = [...fields];
      const [draggedItem] = updated.splice(dragIdx, 1);
      updated.splice(hoverIdx, 0, draggedItem);
      return {
        ...prev,
        branding: { ...prev.branding, studentFields: updated }
      };
    });
  };

  const moveFieldItem = (idx: number, direction: 'up' | 'down') => {
    setEditingTemplate(prev => {
      if (!prev || !prev.branding || !prev.branding.studentFields) return prev;
      const fields = prev.branding.studentFields;
      const nextIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (nextIdx < 0 || nextIdx >= fields.length) return prev;

      const updated = [...fields];
      const [moved] = updated.splice(idx, 1);
      updated.splice(nextIdx, 0, moved);
      return {
        ...prev,
        branding: { ...prev.branding, studentFields: updated }
      };
    });
  };

  const handleEditFieldLabel = (id: string, newLabel: string) => {
    setEditingTemplate(prev => {
      if (!prev || !prev.branding || !prev.branding.studentFields) return prev;
      const fields = prev.branding.studentFields;
      const updated = fields.map(f => f.id === id ? { ...f, label: newLabel } : f);
      return {
        ...prev,
        branding: { ...prev.branding, studentFields: updated }
      };
    });
  };

  const handleDeleteField = (id: string) => {
    setEditingTemplate(prev => {
      if (!prev || !prev.branding || !prev.branding.studentFields) return prev;
      const fields = prev.branding.studentFields;
      const updated = fields.filter(f => f.id !== id);
      return {
        ...prev,
        branding: { ...prev.branding, studentFields: updated }
      };
    });
  };

  const handleAddCustomField = () => {
    if (!newFieldNameInput.trim()) return;
    setEditingTemplate(prev => {
      if (!prev || !prev.branding) return prev;
      const fields = prev.branding.studentFields || [];
      const cleanId = 'cust_' + newFieldNameInput.toLowerCase().trim().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString().substring(8);
      const newField = { id: cleanId, label: newFieldNameInput.trim() };
      return {
        ...prev,
        branding: { ...prev.branding, studentFields: [...fields, newField] }
      };
    });
    setNewFieldNameInput('');
  };

  const handleGradeDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedGradeIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleGradeDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedGradeIdx === null || draggedGradeIdx === idx) return;
    setEditingTemplate(prev => {
      if (!prev || !prev.gradeScales) return prev;
      const updated = [...prev.gradeScales];
      const [draggedItem] = updated.splice(draggedGradeIdx, 1);
      updated.splice(idx, 0, draggedItem);
      return { ...prev, gradeScales: updated };
    });
    setDraggedGradeIdx(idx);
  };

  const moveGradeScaleItem = (idx: number, direction: 'up' | 'down') => {
    setEditingTemplate(prev => {
      if (!prev || !prev.gradeScales) return prev;
      const scales = prev.gradeScales;
      const nextIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (nextIdx < 0 || nextIdx >= scales.length) return prev;

      const updated = [...scales];
      const [moved] = updated.splice(idx, 1);
      updated.splice(nextIdx, 0, moved);
      return { ...prev, gradeScales: updated };
    });
  };

  const handleAddGradeScale = () => {
    setEditingTemplate(prev => {
      if (!prev) return prev;
      const scales = prev.gradeScales || [];
      return { ...prev, gradeScales: [...scales, { minPercent: 0, maxPercent: 0, grade: 'NEW' }] };
    });
  };

  const handleRemoveGradeScaleIndex = (idx: number) => {
    setEditingTemplate(prev => {
      if (!prev || !prev.gradeScales) return prev;
      return { ...prev, gradeScales: prev.gradeScales.filter((_, i) => i !== idx) };
    });
  };

  const handleUpdateGradeScaleItem = (idx: number, field: keyof GradeScale, val: any) => {
    setEditingTemplate(prev => {
      if (!prev || !prev.gradeScales) return prev;
      const updated = prev.gradeScales.map((item, i) => {
        if (i === idx) {
          return {
            ...item,
            [field]: (field === 'minPercent' || field === 'maxPercent') ? (parseInt(val, 10) || 0) : String(val)
          };
        }
        return item;
      });
      return { ...prev, gradeScales: updated };
    });
  };

  const handleAddCoGradeScale = () => {
    setEditingTemplate(prev => {
      if (!prev) return prev;
      const scales = prev.coGradeScales || [];
      return { ...prev, coGradeScales: [...scales, { score: 'NEW', description: 'New tier explanation' }] };
    });
  };

  const handleRemoveCoGradeScaleIdx = (idx: number) => {
    setEditingTemplate(prev => {
      if (!prev || !prev.coGradeScales) return prev;
      return { ...prev, coGradeScales: prev.coGradeScales.filter((_, i) => i !== idx) };
    });
  };

  const handleUpdateCoGradeScaleItem = (idx: number, field: keyof CoGradeScale, val: any) => {
    setEditingTemplate(prev => {
      if (!prev || !prev.coGradeScales) return prev;
      const updated = prev.coGradeScales.map((item, i) => {
        if (i === idx) {
          return { ...item, [field]: String(val) };
        }
        return item;
      });
      return { ...prev, coGradeScales: updated };
    });
  };

  const handleAddItemToPart = (sectionId: string, sectionType: string) => {
    setEditingTemplate(prev => {
      if (!prev) return prev;
      const currentSubs = prev.subjects || [];
      const randId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      const newSub: SubjectColumn = {
        id: randId,
        name: `New Aspect/Activity`,
        type: sectionType as any,
        sectionId: sectionId,
        sequence: currentSubs.length
      };
      return {
        ...prev,
        subjects: [...currentSubs, newSub]
      };
    });
  };

  // Load cloud data
  useEffect(() => {
    let unsubscribeRequests: (() => void) | undefined;
    let unsubscribeTemplates: (() => void) | undefined;

    setIsLoading(true);

    try {
      unsubscribeTemplates = subscribeTemplates((tps) => {
        setTemplates(tps || []);
        setIsLoading(false);
      });
    } catch (err) {
      console.warn("Failed to subscribe templates:", err);
      loadAllTemplatesFromCloud().then((tps) => {
        setTemplates(tps || []);
        setIsLoading(false);
      });
    }

    if (mode === 'saas') {
      loadTemplateRecycleBinFromCloud().then(bin => {
        setRecycleBin(bin);
      }).catch(err => {
        console.warn("Failed to load recycle bin:", err);
      });
    }

    try {
      unsubscribeRequests = subscribeTemplateRequests((updated) => {
        if (mode === 'saas') {
          setRequests(updated);
        } else {
          setRequests(updated.filter(r => r.schoolId === schoolId));
        }
      });
    } catch (err) {
      console.warn("Failed to subscribe template requests in useEffect:", err);
    }

    return () => {
      if (unsubscribeTemplates) {
        unsubscribeTemplates();
      }
      if (unsubscribeRequests) {
        unsubscribeRequests();
      }
    };
  }, [mode, schoolId]);

  // Handle template delete request with CONFIRM protection
  const handleDeleteTemplate = (tplId: string) => {
    // Check if assigned to any school based on existing requests that are assigned
    const isAssigned = requests.some(r => r.templateId === tplId && r.status === 'assigned');
    if (isAssigned) {
      alert("⚠️ Security Protection Activated: This template is currently assigned to one or more schools. It cannot be permanently deleted from active galleries to protect existing academic print history. However, you can delete other unused templates.");
      return;
    }
    setDeletingTemplateId(tplId);
    setConfirmDeleteText('');
  };

  const confirmDeleteTemplate = async () => {
    if (confirmDeleteText.trim().toUpperCase() !== 'CONFIR' && confirmDeleteText.trim().toUpperCase() !== 'CONFIRM') {
      setErrorMsg("Error: Please type 'CONFIR' exactly to authorize template deletion.");
      return;
    }
    const target = templates.find(t => t.id === deletingTemplateId);
    if (!target) return;

    try {
      // 1. Move to template recycle bin
      const recycleItem: TemplateRecycleBinItem = {
        id: `recycle_${Date.now()}`,
        template: target,
        deletedAt: new Date().toISOString()
      };
      await saveTemplateRecycleBinToCloud(recycleItem);
      setRecycleBin(prev => [recycleItem, ...prev]);

      // 2. Remove from active gallery
      await deleteTemplateFromCloud(target.id);
      setTemplates(prev => prev.filter(t => t.id !== target.id));

      setSuccessMsg(`Template "${target.name}" has been stored in the Platform Recycle Bin successfully.`);
      setDeletingTemplateId(null);
      setConfirmDeleteText('');
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to delete the template. Please check Cloudflare D1 permissions.");
    }
  };

  // Restore Template from Recycle Bin
  const handleRestoreTemplate = async (binItem: TemplateRecycleBinItem) => {
    try {
      await saveTemplateToCloud(binItem.template);
      await deleteTemplateFromRecycleBinCloud(binItem.id);
      setTemplates(prev => [binItem.template, ...prev]);
      setRecycleBin(prev => prev.filter(item => item.id !== binItem.id));
      setSuccessMsg(`Template "${binItem.template.name}" successfully restored to the Active Gallery!`);
    } catch (err) {
      setErrorMsg("Failed to restore the template.");
    }
  };

  // Permanent Delete from Recycle Bin
  const handlePermanentDelete = async (binItemId: string) => {
    if (!window.confirm("Are you absolutely sure you want to permanently delete this template from the recycle bin? This action cannot be undone.")) {
      return;
    }
    try {
      await deleteTemplateFromRecycleBinCloud(binItemId);
      setRecycleBin(prev => prev.filter(item => item.id !== binItemId));
      setSuccessMsg("Template deleted permanently.");
    } catch (err) {
      setErrorMsg("Failed to permanently delete the template.");
    }
  };

  // Onboard/Design New Template Initiation
  const handleStartDesigningNew = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const defaultBranding: SchoolBranding = {
      ...initialBranding,
      studentFields: [
        { id: "name", label: "Scholar's Name" },
        { id: "fatherName", label: "Father's Name" },
        { id: "motherName", label: "Mother's Name" },
        { id: "className", label: "Class" },
        { id: "section", label: "Section" },
        { id: "rollNo", label: "Roll No." },
        { id: "admissionNo", label: "Scholar Id" },
        { id: "dob", label: "Date of Birth" }
      ]
    };

    const initialSubjects: SubjectColumn[] = [
      { id: "english", name: "English Language & Lit.", type: "scholastic", sequence: 0, maxMarks: 100 },
      { id: "maths", name: "Mathematics Logic", type: "scholastic", sequence: 1, maxMarks: 100 },
      { id: "science", name: "General Sciences", type: "scholastic", sequence: 2, maxMarks: 100 },
      { id: "co_curricular_art", name: "Art & Crafts Expression", type: "co_scholastic", sequence: 0 },
      { id: "activity_sports", name: "Physical Education & Games", type: "activity", sequence: 0 }
    ];

    const initialScoreColumns: ScoreColumn[] = [
      { id: "exam_t1_tests", name: "Unit Assessments", maxMarks: 20, sequence: 0 },
      { id: "exam_t1_final", name: "Term Final Paper", maxMarks: 80, sequence: 1 }
    ];

    const initialGradeScales: GradeScale[] = [
      { minPercent: 91, maxPercent: 100, grade: 'A1' },
      { minPercent: 81, maxPercent: 90, grade: 'A2' },
      { minPercent: 71, maxPercent: 80, grade: 'B1' },
      { minPercent: 61, maxPercent: 70, grade: 'B2' },
      { minPercent: 51, maxPercent: 60, grade: 'C1' },
      { minPercent: 41, maxPercent: 50, grade: 'C2' },
      { minPercent: 33, maxPercent: 40, grade: 'D' },
      { minPercent: 0, maxPercent: 32, grade: 'E' }
    ];

    const initialCoGradeScales: CoGradeScale[] = [
      { score: 'A', description: 'Excellent / Exemplary' },
      { score: 'B', description: 'Very Good' },
      { score: 'C', description: 'Good' },
      { score: 'D', description: 'Fair' },
      { score: 'E', description: 'Needs Improvement' }
    ];

    const initialCoScholasticSections: CoScholasticSection[] = [
      { id: 'co_scholastic', title: 'Personality & Co-Scholastic Traits (5-Point)', subjectHeader: 'Trait / Aspect', gradingScaleText: '5-Point Scale', term1Enabled: true, term2Enabled: true, type: 'co_scholastic', isDefault: true },
      { id: 'activity', title: 'Co-Curricular / Extracurricular Activities', subjectHeader: 'Activity / Skill Area', gradingScaleText: '3-Point Scale', term1Enabled: true, term2Enabled: true, type: 'activity', isDefault: true }
    ];

    setEditingTemplate({
      id: `tpl_${Date.now()}`,
      name: "Standard Academic Layout",
      assignedClasses: ["1st Grade", "2nd Grade", "3rd Grade", "4th Grade", "5th Grade"],
      branding: defaultBranding,
      subjects: initialSubjects,
      scoreColumns: initialScoreColumns,
      gradeScales: initialGradeScales,
      coGradeScales: initialCoGradeScales,
      coScholasticSections: initialCoScholasticSections,
      signatures: [
        { id: "parent", label: "Parent Signature" },
        { id: "tutor", label: "Class Tutor" },
        { id: "principal", label: "Principal Stamp" }
      ],
      scholasticTerm1Disabled: false,
      scholasticTerm2Disabled: false,
      scholasticTerm3Disabled: true,
      coScholasticOneColumn: false,
      hideGradingScale: false,
      hideAttendance: false,
      pureGradeBased: false,
      verticalExamHeaders: false,
      verticalSubjectsHeader: false,
      subjectSpecificMaxMarksEnabled: false,
      termSpecificScoreColumnsEnabled: false,
      term1ScoreColumns: [...initialScoreColumns],
      term2ScoreColumns: [...initialScoreColumns],
      term3ScoreColumns: [...initialScoreColumns],
      category: "Primary",
      demoStudentName: "Aditya Vardhan",
      demoRollNo: "01",
      demoClassName: "1st Grade",
      createdAt: new Date().toISOString()
    });
    setSelectedExamTermTab(1);
    setDesignAccordion('basic');
  };

  const handleEditTemplate = (tpl: ReportCardTemplate) => {
    setEditingTemplate({
      ...tpl,
      termSpecificScoreColumnsEnabled: !!tpl.termSpecificScoreColumnsEnabled,
      term1ScoreColumns: tpl.term1ScoreColumns ? [...tpl.term1ScoreColumns] : (tpl.scoreColumns ? [...tpl.scoreColumns] : []),
      term2ScoreColumns: tpl.term2ScoreColumns ? [...tpl.term2ScoreColumns] : (tpl.scoreColumns ? [...tpl.scoreColumns] : []),
      term3ScoreColumns: tpl.term3ScoreColumns ? [...tpl.term3ScoreColumns] : (tpl.scoreColumns ? [...tpl.scoreColumns] : []),
    });
    setSelectedExamTermTab(1);
    setDesignAccordion('basic');
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  // Save/Update template
  const handleSaveTemplate = async () => {
    if (!editingTemplate.name?.trim()) {
      setErrorMsg("Please provide a name for the template.");
      return;
    }
    if (!editingTemplate.category?.trim()) {
      setErrorMsg("Please provide a category for the template.");
      return;
    }
    if (!editingTemplate.assignedClasses || editingTemplate.assignedClasses.length === 0) {
      setErrorMsg("Please add at least one target class or group.");
      return;
    }

    try {
      const payload = {
        ...editingTemplate,
        createdAt: editingTemplate.createdAt || new Date().toISOString()
      } as ReportCardTemplate;

      await saveTemplateToCloud(payload);
      setTemplates(prev => {
        const exists = prev.some(t => t.id === payload.id);
        if (exists) {
          return prev.map(t => t.id === payload.id ? payload : t);
        } else {
          return [payload, ...prev];
        }
      });
      setSuccessMsg(`Template "${payload.name}" saved in active gallery database successfully.`);
      setEditingTemplate(null);
    } catch (err: any) {
      console.error("Error saving template to cloud:", err);
      setErrorMsg(`An error occurred while saving the template: ${err?.message || err}`);
    }
  };

  // Add Subject inside editor
  const handleAddSubjectToTemplate = () => {
    if (!newSubName.trim()) return;
    const currentSubs = editingTemplate.subjects || [];
    const newSub: SubjectColumn = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: newSubName.trim(),
      type: newSubType,
      sequence: currentSubs.length,
      maxMarks: (newSubType === 'scholastic' || newSubType === 'additional') ? 100 : undefined
    };

    setEditingTemplate(prev => ({
      ...prev,
      subjects: [...(prev.subjects || []), newSub]
    }));
    setNewSubName('');
  };

  // Remove subject
  const handleRemoveSubjectFromTemplate = (subId: string) => {
    setEditingTemplate(prev => ({
      ...prev,
      subjects: (prev.subjects || []).filter(s => s.id !== subId)
    }));
  };

  // Add Exam Column inside editor
  const handleAddExamToTemplate = () => {
    if (!newExamName.trim()) return;
    const currentExams = getActiveTemplateScoreColumns();
    const newExam: ScoreColumn = {
      id: `exam_${Date.now()}`,
      name: newExamName.trim(),
      maxMarks: newExamMax,
      sequence: currentExams.length
    };

    updateActiveTemplateScoreColumns(cols => [...cols, newExam]);
    setNewExamName('');
    setNewExamMax(100);
  };

  // Remove Exam Column
  const handleRemoveExamFromTemplate = (examId: string) => {
    updateActiveTemplateScoreColumns(cols => cols.filter(e => e.id !== examId));
  };

  // Handle requesting templates for school admin
  const handleRequestTemplate = async (tpl: ReportCardTemplate) => {
    const alreadyRequested = requests.some(r => r.templateId === tpl.id && r.status === 'pending');
    if (alreadyRequested) {
      alert("This template request is already pending with the sandbox master administrator. They will assign it to your school shortly.");
      return;
    }

    try {
      const newRequest: TemplateRequest = {
        id: `req_${schoolId}_${tpl.id}`,
        templateId: tpl.id,
        templateName: tpl.name,
        schoolId: schoolId,
        schoolName: schoolName,
        status: 'pending',
        requestedAt: new Date().toISOString(),
        targetClasses: (schoolClasses && schoolClasses.length > 0) ? schoolClasses.map(c => c.name) : tpl.assignedClasses
      };

      await saveTemplateRequestToCloud(newRequest);

      // Create a SaaS notification alert
      try {
        const newNotif: SaasNotification = {
          id: `notif_req_${schoolId}_${tpl.id}_${Date.now()}`,
          title: "New Template Request",
          message: `Institution "${schoolName}" has requested assignment of template "${tpl.name}".`,
          type: 'info',
          sentAt: new Date().toISOString(),
          targetSchoolIds: ['all'],
          readBy: []
        };
        await saveNotificationToCloud(newNotif);
      } catch (nErr) {
        console.warn("Failed to create SaaS notification:", nErr);
      }

      setRequests(prev => [newRequest, ...prev]);
      alert("🎉 Success! Your template request has been sent to the System Admin. You will receive the assigned template in the 'My Templates' section once approved.");
    } catch (err) {
      alert("Failed to submit template request. Please check permissions.");
    }
  };

  // SaaS Admin assigns/approves template to a school
  const handleAssignTemplate = async (req: TemplateRequest) => {
    // 1. Fetch template structure from templates state
    const targetTpl = templates.find(t => t.id === req.templateId);
    if (!targetTpl) {
      alert("Error: The requested template could not be found in the active gallery.");
      return;
    }

    try {
      setIsLoading(true);

      // 2. Fetch target school full data
      const schoolData = await loadSchoolFromCloud(req.schoolId);
      if (!schoolData) {
        alert("Failed to load school profile to copy template.");
        setIsLoading(false);
        return;
      }

      // 3. Create a cloned structure inside school's local structures
      const templateIdClean = targetTpl.id.startsWith('struct_') ? targetTpl.id.replace('struct_', '') : targetTpl.id;
      const clonedStructureId = `struct_tpl_${templateIdClean}`;

      const clonedStructure: ReportCardStructure = {
        id: clonedStructureId, // Maintain link to template or create unique structure ID
        name: targetTpl.name,
        assignedClasses: targetTpl.assignedClasses || [],
        branding: {
          ...targetTpl.branding,
          // Adopt the school's identity without overwriting the template's design/terms/labels
          schoolName: schoolData.branding?.schoolName || targetTpl.branding?.schoolName || "Unnamed School",
          address: schoolData.branding?.address || targetTpl.branding?.address || "",
          helpline: schoolData.branding?.helpline || targetTpl.branding?.helpline || "",
          email: schoolData.branding?.email || targetTpl.branding?.email || "",
          website: schoolData.branding?.website || targetTpl.branding?.website || "",
          logoUrl: schoolData.branding?.logoUrl || targetTpl.branding?.logoUrl || "",
          rightLogoUrl: schoolData.branding?.rightLogoUrl || targetTpl.branding?.rightLogoUrl || "",
          showWatermark: schoolData.branding?.showWatermark !== undefined ? schoolData.branding.showWatermark : (targetTpl.branding?.showWatermark ?? true),
          watermarkType: schoolData.branding?.watermarkType || targetTpl.branding?.watermarkType || 'text',
          watermarkText: schoolData.branding?.watermarkText || targetTpl.branding?.watermarkText || schoolData.branding?.schoolName || "",
          watermarkLogoUrl: schoolData.branding?.watermarkLogoUrl || targetTpl.branding?.watermarkLogoUrl || "",
          watermarkOpacity: schoolData.branding?.watermarkOpacity ?? targetTpl.branding?.watermarkOpacity ?? 0.08,
          watermarkSize: schoolData.branding?.watermarkSize ?? targetTpl.branding?.watermarkSize ?? 320,
          watermarkLayout: schoolData.branding?.watermarkLayout || targetTpl.branding?.watermarkLayout,
          watermarkFit: schoolData.branding?.watermarkFit || targetTpl.branding?.watermarkFit,
          signParentName: schoolData.branding?.signParentName || targetTpl.branding?.signParentName,
          signInchargeName: schoolData.branding?.signInchargeName || targetTpl.branding?.signInchargeName,
          signPrincipalName: schoolData.branding?.signPrincipalName || targetTpl.branding?.signPrincipalName,
        },
        subjects: targetTpl.subjects || [],
        scoreColumns: targetTpl.scoreColumns || [],
        gradeScales: targetTpl.gradeScales || [],
        coGradeScales: targetTpl.coGradeScales || [],
        completedSections: targetTpl.completedSections || [],
        scholasticTerm1Disabled: targetTpl.scholasticTerm1Disabled || false,
        scholasticTerm2Disabled: targetTpl.scholasticTerm2Disabled || false,
        scholasticTerm3Disabled: targetTpl.scholasticTerm3Disabled || false,
        coScholasticOneColumn: targetTpl.coScholasticOneColumn || false,
        coScholasticSections: targetTpl.coScholasticSections || [],
        signatures: targetTpl.signatures || [],
        hideGradingScale: targetTpl.hideGradingScale || false,
        hideAttendance: targetTpl.hideAttendance || false,
        pureGradeBased: targetTpl.pureGradeBased || false,
        gradingScaleAfterSignatures: targetTpl.gradingScaleAfterSignatures || false,
        gradingScaleLayout: targetTpl.gradingScaleLayout || 'side-by-side',
        verticalExamHeaders: targetTpl.verticalExamHeaders || false,
        verticalSubjectsHeader: targetTpl.verticalSubjectsHeader || false,
        subjectSpecificMaxMarksEnabled: targetTpl.subjectSpecificMaxMarksEnabled || false,
        enableSubjectGrouping: targetTpl.enableSubjectGrouping !== undefined ? targetTpl.enableSubjectGrouping : true,
        customSubjectGroups: targetTpl.customSubjectGroups || [],
        hideTerm1Total: targetTpl.hideTerm1Total || false,
        hideTerm1Grade: targetTpl.hideTerm1Grade || false,
        hideTerm2Total: targetTpl.hideTerm2Total || false,
        hideTerm2Grade: targetTpl.hideTerm2Grade || false,
        hideTerm3Total: targetTpl.hideTerm3Total || false,
        hideTerm3Grade: targetTpl.hideTerm3Grade || false,
        hideOverallTotal: targetTpl.hideOverallTotal || false,
        hideOverallGrade: targetTpl.hideOverallGrade || false,
        templateId: targetTpl.id,
        demoStudentName: targetTpl.demoStudentName || "Aditya Vardhan",
        demoRollNo: targetTpl.demoRollNo || "01",
        demoClassName: targetTpl.demoClassName || (targetTpl.assignedClasses && targetTpl.assignedClasses[0]) || "Nursery"
      };

      // Ensure we don't duplicate structure
      const currentStructures = schoolData.reportCardStructures || [];
      const updatedStructures = currentStructures.filter(s => s.id !== clonedStructureId && s.id !== `struct_${targetTpl.id}`);
      updatedStructures.push(clonedStructure);

      schoolData.reportCardStructures = updatedStructures;

      // Save school back to cloud
      await saveSchoolToCloud(req.schoolId, schoolData, schoolData.branding?.schoolName || req.schoolName);

      // Trigger local in-memory state update and sync to localStorage if we are working on the currently loaded school
      if (req.schoolId === schoolId) {
        try {
          localStorage.setItem(`class_on_structures_${schoolId}`, JSON.stringify(updatedStructures));
        } catch (e) {
          console.warn("Failed to update local storage for structures:", e);
        }
        if (onUpdateSchoolStructures) {
          onUpdateSchoolStructures(updatedStructures);
        }
      }

      // 4. Update request status to assigned
      const updatedRequest: TemplateRequest = {
        ...req,
        status: 'assigned',
        assignedAt: new Date().toISOString()
      };
      await saveTemplateRequestToCloud(updatedRequest);
      setRequests(prev => prev.map(r => r.id === req.id ? updatedRequest : r));

      alert(`🎉 Assigned successfully! Template "${clonedStructure.name}" has been cloned and pushed to ${req.schoolName}'s local layout structures.`);
    } catch (err) {
      console.error(err);
      alert("Failed to assign template. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to determine if a template is genuinely currently active in currentSchoolStructures
  const isTemplateActiveInSchool = (tpl: ReportCardTemplate, structures: ReportCardStructure[]): boolean => {
    if (!tpl || !structures || structures.length === 0) return false;
    const tplCleanId = tpl.id.startsWith('struct_') ? tpl.id.replace('struct_', '') : tpl.id;
    return structures.some(s => {
      if (!s) return false;
      const sCleanId = s.id ? (s.id.startsWith('struct_') ? s.id.replace('struct_', '') : s.id) : '';
      const sTplCleanId = s.id ? (s.id.startsWith('struct_tpl_') ? s.id.replace('struct_tpl_', '') : '') : '';
      const matchId = Boolean(
        s.id === tpl.id ||
        s.id === `struct_${tpl.id}` ||
        s.id === `struct_tpl_${tpl.id}` ||
        s.id === `struct_tpl_${tplCleanId}` ||
        sCleanId === tplCleanId ||
        sTplCleanId === tplCleanId ||
        (s.id && s.id.includes(tplCleanId)) ||
        (s as any).templateId === tpl.id ||
        (s as any).templateId === tplCleanId
      );
      const matchName = Boolean(s.name && tpl.name && s.name.trim().toLowerCase() === tpl.name.trim().toLowerCase());
      return matchId || matchName;
    });
  };

  // Filter templates
  const filteredTemplates = templates.filter(tpl => {
    if (categoryFilter !== 'all' && tpl.category !== categoryFilter) return false;
    if (classFilter.trim()) {
      const matchWord = classFilter.toLowerCase().trim();
      const hasClass = (tpl.assignedClasses || []).some(c => c.toLowerCase().includes(matchWord)) || tpl.name.toLowerCase().includes(matchWord);
      if (!hasClass) return false;
    }
    return true;
  });

  // Assigned templates for the current school
  const myAssignedTemplates = (currentSchoolStructures || []).filter(s => 
    s && s.id && (
      s.id.startsWith('struct_tpl_') || 
      s.id.startsWith('struct_struct_') || 
      (s as any).templateId ||
      templates.some(t => isTemplateActiveInSchool(t, [s]))
    )
  );

  // ----------------- DEDICATED FULL-WIDTH TEMPLATE VIEW PAGE -----------------
  if (previewTemplate) {
    const isAssigned = isTemplateActiveInSchool(previewTemplate, currentSchoolStructures);
    const hasPendingReq = (requests || []).some(r => 
      (r.schoolId ? r.schoolId === schoolId : true) &&
      (r.templateId === previewTemplate.id || r.templateId.replace('struct_', '') === previewTemplate.id.replace('struct_', '') || r.templateName === previewTemplate.name) &&
      r.status === 'pending'
    );

    return (
      <div id="template-full-width-view" className="w-full min-h-screen bg-slate-100 flex flex-col animate-fadeIn">
        {/* Top Control Bar */}
        <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => setPreviewTemplate(null)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Gallery</span>
            </button>

            <div className="h-5 w-px bg-slate-300 hidden sm:block" />

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {previewTemplate.category || "Standard Layout"}
                </span>
                <h1 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                  {previewTemplate.name}
                </h1>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Dedicated full-page layout view with exact columns, styling parameters, and grading rules.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
              title="Print Template Blueprint"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">Print Preview</span>
            </button>

            {mode === 'school' && (
              <>
                {isAssigned ? (
                  <span className="px-3.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Active in School</span>
                  </span>
                ) : hasPendingReq ? (
                  <span className="px-3.5 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>Request Pending Approval</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      handleRequestTemplate(previewTemplate);
                    }}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Request This Template</span>
                  </button>
                )}
              </>
            )}

            {mode === 'saas' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAssigningTemplate(previewTemplate)}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors active:scale-95"
                  title="Assign this layout blueprint directly to any registered school"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Assign to School</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleEditTemplate(previewTemplate);
                    setPreviewTemplate(null);
                  }}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors active:scale-95"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit Blueprint</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setPreviewTemplate(null)}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              title="Close Page"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Informational Guidance Banner */}
        <div className="bg-indigo-50/80 border-b border-indigo-100 px-4 sm:px-8 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-indigo-900">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              Full-width inspection mode for <strong>{previewTemplate.name}</strong>.
              Assigned classes: <strong className="font-semibold text-slate-800">{previewTemplate.assignedClasses?.join(', ') || 'All Classes'}</strong>
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            Rendered with dynamic score calculations and authentic demo student records
          </div>
        </div>

        {/* Full-width Main Paper Container */}
        <main className="flex-1 w-full max-w-7xl mx-auto p-1 sm:p-4 md:p-8 flex flex-col items-center">
          <div className="w-full max-w-5xl bg-white shadow-xl rounded-xl sm:rounded-2xl border border-slate-200 p-1 sm:p-6 md:p-8 overflow-x-hidden print:shadow-none print:border-none print:p-0">
            <ReportCardPreview
              branding={{
                ...(previewTemplate.branding || {}),
                schoolName: schoolName || previewTemplate.branding?.schoolName || "DEMO PUBLIC SCHOOL"
              }}
              subjects={previewTemplate.subjects || []}
              scoreColumns={previewTemplate.scoreColumns || []}
              termSpecificScoreColumnsEnabled={previewTemplate.termSpecificScoreColumnsEnabled}
              term1ScoreColumns={previewTemplate.term1ScoreColumns}
              term2ScoreColumns={previewTemplate.term2ScoreColumns}
              term3ScoreColumns={previewTemplate.term3ScoreColumns}
              gradeScales={previewTemplate.gradeScales || []}
              coGradeScales={previewTemplate.coGradeScales}
              coScholasticSections={previewTemplate.coScholasticSections}
              signatures={previewTemplate.signatures}
              scholasticTerm1Disabled={previewTemplate.scholasticTerm1Disabled}
              scholasticTerm2Disabled={previewTemplate.scholasticTerm2Disabled}
              scholasticTerm3Disabled={previewTemplate.scholasticTerm3Disabled}
              coScholasticOneColumn={previewTemplate.coScholasticOneColumn}
              hideGradingScale={previewTemplate.hideGradingScale}
              hideAttendance={previewTemplate.hideAttendance}
              pureGradeBased={previewTemplate.pureGradeBased}
              gradingScaleAfterSignatures={previewTemplate.gradingScaleAfterSignatures}
              gradingScaleLayout={previewTemplate.gradingScaleLayout}
              verticalExamHeaders={previewTemplate.verticalExamHeaders}
              verticalSubjectsHeader={previewTemplate.verticalSubjectsHeader}
              subjectSpecificMaxMarksEnabled={previewTemplate.subjectSpecificMaxMarksEnabled}
              enableSubjectGrouping={previewTemplate.enableSubjectGrouping}
              customSubjectGroups={previewTemplate.customSubjectGroups}
              hideTerm1Total={previewTemplate.hideTerm1Total}
              hideTerm1Grade={previewTemplate.hideTerm1Grade}
              hideTerm2Total={previewTemplate.hideTerm2Total}
              hideTerm2Grade={previewTemplate.hideTerm2Grade}
              hideTerm3Total={previewTemplate.hideTerm3Total}
              hideTerm3Grade={previewTemplate.hideTerm3Grade}
              hideOverallTotal={previewTemplate.hideOverallTotal}
              hideOverallGrade={previewTemplate.hideOverallGrade}
              student={{
                ...defaultDemoStudent,
                name: previewTemplate.demoStudentName || defaultDemoStudent.name,
                rollNo: previewTemplate.demoRollNo || defaultDemoStudent.rollNo,
                className: previewTemplate.demoClassName || (previewTemplate.assignedClasses || [])[0] || defaultDemoStudent.className
              }}
              grades={makeDemoGrades(
                previewTemplate.subjects || [],
                previewTemplate.scoreColumns || [],
                previewTemplate.termSpecificScoreColumnsEnabled,
                previewTemplate.term1ScoreColumns,
                previewTemplate.term2ScoreColumns,
                previewTemplate.term3ScoreColumns
              )}
            />
          </div>

          {/* Bottom Back Button */}
          <div className="mt-8 mb-6 flex items-center justify-center">
            <button
              type="button"
              onClick={() => setPreviewTemplate(null)}
              className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Template Gallery</span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-full px-2 sm:px-4 md:px-6 py-4 mx-auto">
      {/* Banner Head */}
      <div className="bg-slate-900 text-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2.5 font-sans">
              <LayoutGrid className="w-5 h-5 sm:w-6 h-6 text-indigo-400" />
              {mode === 'saas' ? 'Report Card Template Gallery Desk' : 'Template Gallery'}
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-300 max-w-xl font-sans">
              {mode === 'saas' 
                ? 'Design multiple beautiful pre-configured report card templates, manage requests, and push direct installations to school profiles.' 
                : 'Browse beautiful pre-designed report card layouts matching scholastic/nursery tiers and request custom assignments for your school.'}
            </p>
          </div>

          <div className="flex gap-4 bg-slate-800/80 p-3 rounded-xl sm:rounded-2xl border border-slate-700 justify-around sm:justify-start">
            <div className="text-center min-w-[80px] sm:min-w-20">
              <span className="block text-lg sm:text-xl font-black text-indigo-400">{templates.length}</span>
              <span className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400">Total Templates</span>
            </div>
            {mode === 'saas' && (
              <div className="text-center min-w-[80px] sm:min-w-20 border-l border-slate-700">
                <span className="block text-lg sm:text-xl font-black text-amber-400">{requests.filter(r => r.status === 'pending').length}</span>
                <span className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400">Pending Requests</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border-l-4 border-rose-500 rounded-xl text-xs font-semibold text-rose-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500" />
            {errorMsg}
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700 font-bold">✕</button>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-xl text-xs font-bold text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-500" />
            {successMsg}
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900 font-bold">✕</button>
        </div>
      )}

      {/* Tabs Menu */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 gap-3 pb-2 sm:pb-0">
        <div className="flex flex-wrap gap-1 sm:gap-2">
          <button
            onClick={() => { setActiveTab('gallery'); setEditingTemplate(null); }}
            className={`px-3 sm:px-4 py-2 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'gallery' && !editingTemplate
                ? 'border-indigo-600 text-indigo-600 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            🗂️ Active Gallery
          </button>
          
          {mode === 'saas' ? (
            <>
              <button
                onClick={() => { setActiveTab('requests'); setEditingTemplate(null); }}
                className={`px-3 sm:px-4 py-2 text-xs font-bold border-b-2 transition-all relative ${
                  activeTab === 'requests'
                    ? 'border-indigo-600 text-indigo-600 font-black'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                📩 School Requests
                {requests.filter(r => r.status === 'pending').length > 0 && (
                  <span className="absolute -top-1 -right-1.5 bg-rose-500 text-white text-[8px] font-bold px-1 rounded-full animate-pulse">
                    {requests.filter(r => r.status === 'pending').length}
                  </span>
                )}
              </button>
              <button
                onClick={() => { setActiveTab('recycle'); setEditingTemplate(null); }}
                className={`px-3 sm:px-4 py-2 text-xs font-bold border-b-2 transition-all ${
                  activeTab === 'recycle'
                    ? 'border-indigo-600 text-indigo-600 font-black'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                🗑️ Recycle Bin
              </button>
            </>
          ) : (
            <button
              onClick={() => { setActiveTab('my_templates'); setEditingTemplate(null); }}
              className={`px-3 sm:px-4 py-2 text-xs font-bold border-b-2 transition-all ${
                activeTab === 'my_templates'
                  ? 'border-indigo-600 text-indigo-600 font-black'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              ⭐ My Assigned Templates ({myAssignedTemplates.length})
            </button>
          )}
        </div>

        {mode === 'saas' && !editingTemplate && (
          <button
            onClick={handleStartDesigningNew}
            className="mb-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 w-full sm:w-auto justify-center"
          >
            <Plus className="w-4 h-4" /> Design Template Card
          </button>
        )}
      </div>

      {/* ----------------- EDITOR WORKSPACE (SAAS ONLY) ----------------- */}
      {editingTemplate && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm animate-fadeIn">
          <div className="flex items-center justify-between border-b pb-4">
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-wide">
              <Sparkles className="w-5 h-5 text-indigo-500 animate-spin-slow" />
              Platform Blueprint Designer: {editingTemplate.name || 'New Template'}
            </h2>
            <div className="flex items-center gap-2">
              <button onClick={() => setEditingTemplate(null)} className="px-4 py-2 text-xs font-bold text-slate-500 bg-white border rounded-xl hover:bg-slate-50">Cancel</button>
              <button onClick={handleSaveTemplate} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm">
                <Save className="w-4 h-4" /> Save Template to Gallery
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            {/* Editor Accordions (Full Width) */}
            <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-4">
              {/* ACCORDION 1: BASIC METADATA */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <button
                  type="button"
                  onClick={() => setDesignAccordion(designAccordion === 'basic' ? '' : 'basic')}
                  className="w-full px-4 py-3 bg-slate-50 text-slate-800 font-bold text-xs flex justify-between items-center"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 border flex items-center justify-center text-[10px] font-bold">1</span>
                    1. Template Basic Profile &amp; Class Scope
                  </span>
                  {designAccordion === 'basic' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {designAccordion === 'basic' && (
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Template Gallery Name</span>
                        <input
                          type="text"
                          value={editingTemplate.name || ''}
                          onChange={(e) => setEditingTemplate(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full px-3 py-1.5 text-xs border rounded-lg bg-slate-50 focus:bg-white focus:outline-none font-bold"
                          placeholder="e.g., CBSEC Primary Excellence Card"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Category Tag</span>
                        <select
                          value={editingTemplate.category || 'Primary'}
                          onChange={(e) => setEditingTemplate(prev => ({ ...prev, category: e.target.value }))}
                          className="w-full px-3 py-1.5 text-xs border rounded-lg bg-slate-50 focus:bg-white focus:outline-none font-bold"
                        >
                          <option value="Nursery">Nursery / Play school</option>
                          <option value="Primary">Primary (Grade 1-5)</option>
                          <option value="Secondary">Secondary (Grade 6-10)</option>
                          <option value="Custom">Custom Boards</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Target Classes (Comma Separated)</span>
                      <input
                        type="text"
                        value={editingTemplate.assignedClasses?.join(', ') || ''}
                        onChange={(e) => setEditingTemplate(prev => ({ ...prev, assignedClasses: e.target.value.split(',').map(c => c.trim()).filter(Boolean) }))}
                        className="w-full px-3 py-1.5 text-xs border rounded-lg bg-slate-50 focus:bg-white"
                        placeholder="e.g., LKG, UKG, 1st Grade, 2nd Grade"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ACCORDION 2: BRANDING IDENTITY OVERRIDES */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <button
                  type="button"
                  onClick={() => setDesignAccordion(designAccordion === 'branding' ? '' : 'branding')}
                  className="w-full px-4 py-3 bg-slate-50 text-slate-800 font-bold text-xs flex justify-between items-center"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 border flex items-center justify-center text-[10px] font-bold">2</span>
                    2. Layout Branding, Logos &amp; Custom Table Headings
                  </span>
                  {designAccordion === 'branding' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {designAccordion === 'branding' && (
                  <div className="p-4 space-y-6 max-h-[70vh] overflow-y-auto scrollbar-thin">
                    
                    {/* SUBSECTION 1: SCHOOL IDENTITY & CONTACT INFO */}
                    <div className="space-y-3.5 pb-4 border-b">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1">
                        🏫 School Identity &amp; Contact Info
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">School Name</span>
                          <input
                            type="text"
                            value={editingTemplate.branding?.schoolName || ''}
                            onChange={(e) => handleBrandingFieldChange('schoolName', e.target.value)}
                            className="w-full px-3 py-1.5 text-xs border rounded-lg"
                            placeholder="e.g. DEMO PUBLIC SCHOOL"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Affiliation / Tagline</span>
                          <input
                            type="text"
                            value={editingTemplate.branding?.tagline || ''}
                            onChange={(e) => handleBrandingFieldChange('tagline', e.target.value)}
                            className="w-full px-3 py-1.5 text-xs border rounded-lg"
                            placeholder="Affiliated to CBSE Board"
                          />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Complete Address</span>
                          <input
                            type="text"
                            value={editingTemplate.branding?.address || ''}
                            onChange={(e) => handleBrandingFieldChange('address', e.target.value)}
                            className="w-full px-3 py-1.5 text-xs border rounded-lg"
                            placeholder="85, Sunil Park, Opp. MBD Mall, Ludhiana"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Helpline / Phone</span>
                          <input
                            type="text"
                            value={editingTemplate.branding?.helpline || ''}
                            onChange={(e) => handleBrandingFieldChange('helpline', e.target.value)}
                            className="w-full px-3 py-1.5 text-xs border rounded-lg"
                            placeholder="+91 90237 90237"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Official Website</span>
                          <input
                            type="text"
                            value={editingTemplate.branding?.website || ''}
                            onChange={(e) => handleBrandingFieldChange('website', e.target.value)}
                            className="w-full px-3 py-1.5 text-xs border rounded-lg"
                            placeholder="www.demoschool.com"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Official Email</span>
                          <input
                            type="text"
                            value={editingTemplate.branding?.email || ''}
                            onChange={(e) => handleBrandingFieldChange('email', e.target.value)}
                            className="w-full px-3 py-1.5 text-xs border rounded-lg"
                            placeholder="info@demoschool.com"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Session Year Text</span>
                          <input
                            type="text"
                            value={editingTemplate.branding?.session || ''}
                            onChange={(e) => handleBrandingFieldChange('session', e.target.value)}
                            className="w-full px-3 py-1.5 text-xs border rounded-lg"
                            placeholder="Session 2026-2027"
                          />
                        </div>
                      </div>
                    </div>

                    {/* SUBSECTION 2: SCHOOL LOGOS & HEADER LAYOUT */}
                    <div className="space-y-4 pb-4 border-b">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1">
                        🖼️ School Logos &amp; Header Layout
                      </h4>
                      
                      {/* Left Logo */}
                      <div className="p-3 bg-slate-55 border rounded-xl space-y-3">
                        <span className="text-[10px] font-black text-slate-700 block uppercase">Left Header Logo</span>
                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                          {editingTemplate.branding?.logoUrl ? (
                            <div className="relative shrink-0">
                              <img
                                src={editingTemplate.branding.logoUrl}
                                alt="Logo"
                                className={`w-12 h-12 ${editingTemplate.branding.logoBorder !== false ? 'border bg-white p-0.5' : ''} ${editingTemplate.branding.logoCircular !== false ? 'rounded-full' : 'rounded-lg'} object-contain`}
                              />
                              <button
                                type="button"
                                onClick={() => handleBrandingFieldChange('logoUrl', '')}
                                className="absolute -top-1 -right-1 bg-red-600 hover:bg-red-700 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="w-12 h-12 bg-slate-100 border border-dashed rounded-lg flex items-center justify-center text-[9px] text-slate-400 font-bold">
                              None
                            </div>
                          )}
                          <div className="flex-grow space-y-1.5 w-full">
                            <input
                              type="text"
                              value={editingTemplate.branding?.logoUrl || ''}
                              onChange={(e) => handleBrandingFieldChange('logoUrl', e.target.value)}
                              placeholder="Direct logo image URL..."
                              className="w-full px-2 py-1 text-xs border rounded bg-white"
                            />
                            <label className="cursor-pointer bg-slate-800 hover:bg-slate-900 text-white text-[9.5px] font-bold py-1 px-2.5 rounded text-center inline-block max-w-max select-none">
                              Upload Logo File
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) compressAndResizeImage(f, 200, 0.9, (b64) => handleBrandingFieldChange('logoUrl', b64));
                                }}
                              />
                            </label>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-dashed">
                          <div className="space-y-0.5">
                            <div className="flex justify-between text-[10px]">
                              <span className="font-bold text-slate-500">Logo Size:</span>
                              <span className="font-mono text-indigo-600 font-bold">{editingTemplate.branding?.logoSize !== undefined ? editingTemplate.branding.logoSize : 92}px</span>
                            </div>
                            <input
                              type="range"
                              min="40"
                              max="200"
                              step="2"
                              value={editingTemplate.branding?.logoSize !== undefined ? editingTemplate.branding.logoSize : 92}
                              onChange={(e) => handleBrandingFieldChange('logoSize', parseInt(e.target.value))}
                              className="w-full accent-indigo-650 h-1 bg-slate-200"
                            />
                          </div>
                          <div className="flex flex-col gap-1.5 justify-center">
                            <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editingTemplate.branding?.logoCircular !== false}
                                onChange={(e) => handleBrandingFieldChange('logoCircular', e.target.checked)}
                                className="w-3.5 h-3.5 text-indigo-600 rounded"
                              />
                              Circular Frame Shape
                            </label>
                            <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editingTemplate.branding?.logoBorder !== false}
                                onChange={(e) => handleBrandingFieldChange('logoBorder', e.target.checked)}
                                className="w-3.5 h-3.5 text-indigo-600 rounded"
                              />
                              Enable Logo Border Box
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Right Logo */}
                      <div className="p-3 bg-slate-55 border rounded-xl space-y-3">
                        <span className="text-[10px] font-black text-slate-700 block uppercase">Right Header Logo (Optional)</span>
                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                          {editingTemplate.branding?.rightLogoUrl ? (
                            <div className="relative shrink-0">
                              <img
                                src={editingTemplate.branding.rightLogoUrl}
                                alt="Right Logo"
                                className={`w-12 h-12 ${editingTemplate.branding.logoBorder !== false ? 'border bg-white p-0.5' : ''} ${editingTemplate.branding.logoCircular !== false ? 'rounded-full' : 'rounded-lg'} object-contain`}
                              />
                              <button
                                type="button"
                                onClick={() => handleBrandingFieldChange('rightLogoUrl', '')}
                                className="absolute -top-1 -right-1 bg-red-600 hover:bg-red-700 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="w-12 h-12 bg-slate-100 border border-dashed rounded-lg flex items-center justify-center text-[9px] text-slate-400 font-bold">
                              None
                            </div>
                          )}
                          <div className="flex-grow space-y-1.5 w-full">
                            <input
                              type="text"
                              value={editingTemplate.branding?.rightLogoUrl || ''}
                              onChange={(e) => handleBrandingFieldChange('rightLogoUrl', e.target.value)}
                              placeholder="Direct right logo URL..."
                              className="w-full px-2 py-1 text-xs border rounded bg-white"
                            />
                            <label className="cursor-pointer bg-slate-800 hover:bg-slate-900 text-white text-[9.5px] font-bold py-1 px-2.5 rounded text-center inline-block max-w-max select-none">
                              Upload Right Logo
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) compressAndResizeImage(f, 200, 0.9, (b64) => handleBrandingFieldChange('rightLogoUrl', b64));
                                }}
                              />
                            </label>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-dashed">
                          <div className="space-y-0.5 max-w-xs">
                            <div className="flex justify-between text-[10px]">
                              <span className="font-bold text-slate-500">Right Logo Size:</span>
                              <span className="font-mono text-indigo-600 font-bold">{editingTemplate.branding?.rightLogoSize !== undefined ? editingTemplate.branding.rightLogoSize : 92}px</span>
                            </div>
                            <input
                              type="range"
                              min="40"
                              max="200"
                              step="2"
                              value={editingTemplate.branding?.rightLogoSize !== undefined ? editingTemplate.branding.rightLogoSize : 92}
                              onChange={(e) => handleBrandingFieldChange('rightLogoSize', parseInt(e.target.value))}
                              className="w-full accent-indigo-650 h-1 bg-slate-200"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Header Landscape Banner */}
                      <div className="p-3 bg-indigo-50/15 border border-indigo-100 rounded-xl space-y-3">
                        <span className="text-[10px] font-black text-indigo-950 block uppercase">Landscape Name/Header Banner Image</span>
                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                          {editingTemplate.branding?.nameBannerUrl ? (
                            <div className="relative shrink-0 max-w-[150px]">
                              <img src={editingTemplate.branding.nameBannerUrl} alt="Banner" className="h-10 w-auto border rounded object-contain bg-white p-0.5" />
                              <button
                                type="button"
                                onClick={() => handleBrandingFieldChange('nameBannerUrl', '')}
                                className="absolute -top-1 -right-1 bg-red-600 hover:bg-red-700 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="w-[150px] h-10 bg-slate-100 border border-dashed rounded flex items-center justify-center text-[8.5px] text-slate-400 font-bold text-center">
                              Using Text School Name
                            </div>
                          )}
                          <div className="flex-grow space-y-1.5 w-full">
                            <input
                              type="text"
                              value={editingTemplate.branding?.nameBannerUrl || ''}
                              onChange={(e) => handleBrandingFieldChange('nameBannerUrl', e.target.value)}
                              placeholder="Direct banner image URL..."
                              className="w-full px-2 py-1 text-xs border rounded bg-white"
                            />
                            <label className="cursor-pointer bg-slate-800 hover:bg-slate-900 text-white text-[9.5px] font-bold py-1 px-2.5 rounded text-center inline-block max-w-max select-none">
                              Upload Banner Image
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) compressAndResizeImage(f, 800, 0.95, (b64) => handleBrandingFieldChange('nameBannerUrl', b64));
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      </div>

                      {/* Global Theme, Borders, Orientation, Paper sizes */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Theme Primary Color</span>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={editingTemplate.branding?.themeColor || '#4f46e5'}
                              onChange={(e) => handleBrandingFieldChange('themeColor', e.target.value)}
                              className="w-8 h-8 rounded border cursor-pointer shrink-0"
                            />
                            <input
                              type="text"
                              value={editingTemplate.branding?.themeColor || '#4f46e5'}
                              onChange={(e) => handleBrandingFieldChange('themeColor', e.target.value)}
                              className="w-full px-3 py-1 text-xs border rounded-lg font-mono"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Table Outer Border Color</span>
                          <div className="flex gap-2">
                            <input
                              type="color"
                              value={editingTemplate.branding?.borderColor || '#cbd5e1'}
                              onChange={(e) => handleBrandingFieldChange('borderColor', e.target.value)}
                              className="w-8 h-8 rounded border cursor-pointer shrink-0"
                            />
                            <input
                              type="text"
                              value={editingTemplate.branding?.borderColor || '#cbd5e1'}
                              onChange={(e) => handleBrandingFieldChange('borderColor', e.target.value)}
                              className="w-full px-3 py-1 text-xs border rounded-lg font-mono"
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Print Orientation</span>
                          <select
                            value={editingTemplate.branding?.printOrientation || 'portrait'}
                            onChange={(e) => handleBrandingFieldChange('printOrientation', e.target.value)}
                            className="w-full px-3 py-1.5 text-xs border rounded-lg bg-slate-50 font-bold text-slate-800"
                          >
                            <option value="portrait">📄 Standard Portrait (Vertical)</option>
                            <option value="landscape">📐 Modern Landscape (Horizontal)</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Target Paper Dimensions</span>
                          <select
                            value={editingTemplate.branding?.paperSize || 'A4'}
                            onChange={(e) => handleBrandingFieldChange('paperSize', e.target.value)}
                            className="w-full px-3 py-1.5 text-xs border rounded-lg bg-slate-50 font-bold text-slate-800"
                          >
                            <option value="A4">A4 size Paper (Standard)</option>
                            <option value="Letter">Letter size Paper (US Standard)</option>
                          </select>
                        </div>
                      </div>

                      {/* Header display flags */}
                      <div className="p-3 bg-indigo-50/40 border border-indigo-100 rounded-xl space-y-2">
                        <span className="text-[10px] font-black text-indigo-900 uppercase">Layout Header Display Rules</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            id="tpl_hide_school_details"
                            checked={editingTemplate.branding?.hideSchoolDetails === true}
                            onChange={(e) => handleBrandingFieldChange('hideSchoolDetails', e.target.checked)}
                            className="w-4 h-4 text-indigo-650 cursor-pointer"
                          />
                          <label htmlFor="tpl_hide_school_details" className="text-xs text-slate-700 cursor-pointer select-none">
                            Hide secondary address/contacts/helplines under banner
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* SUBSECTION 3: BACKGROUND WATERMARK STAMP */}
                    <div className="space-y-3.5 pb-4 border-b">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1">
                        💮 Background Watermark Stamp Setup
                      </h4>
                      <div className="flex items-center gap-1.5 py-1">
                        <input
                          type="checkbox"
                          checked={editingTemplate.branding?.showWatermark !== false}
                          onChange={(e) => handleBrandingFieldChange('showWatermark', e.target.checked)}
                          id="tpl_swm"
                          className="w-4 h-4 text-indigo-600 cursor-pointer"
                        />
                        <label htmlFor="tpl_swm" className="text-xs font-bold cursor-pointer select-none">
                          Show Background Watermark Overlays
                        </label>
                      </div>

                      {editingTemplate.branding?.showWatermark !== false && (
                        <div className="space-y-3 p-3 bg-slate-50 border rounded-xl">
                          <div className="flex gap-4">
                            <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer font-bold">
                              <input
                                type="radio"
                                checked={editingTemplate.branding?.watermarkType === 'text'}
                                onChange={() => handleBrandingFieldChange('watermarkType', 'text')}
                                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                              />
                              Text Stamp
                            </label>
                            <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer font-bold">
                              <input
                                type="radio"
                                checked={editingTemplate.branding?.watermarkType !== 'text'}
                                onChange={() => {
                                  handleBrandingFieldChange('watermarkType', 'logo');
                                  if (!editingTemplate.branding?.watermarkLogoUrl && editingTemplate.branding?.logoUrl) {
                                    handleBrandingFieldChange('watermarkLogoUrl', editingTemplate.branding.logoUrl);
                                  }
                                }}
                                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                              />
                              Logo Stamp
                            </label>
                          </div>

                          {editingTemplate.branding?.watermarkType === 'text' ? (
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold uppercase text-slate-400">Stamp Text:</span>
                              <input
                                type="text"
                                value={editingTemplate.branding?.watermarkText || ''}
                                onChange={(e) => handleBrandingFieldChange('watermarkText', e.target.value)}
                                className="w-full px-2 py-1 border text-xs rounded bg-white font-extrabold text-indigo-600"
                                placeholder="DEMO PUBLIC SCHOOL"
                              />
                            </div>
                          ) : (
                            <div className="space-y-2.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="cursor-pointer inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold py-1.5 px-3 rounded-lg shadow-2xs transition-all select-none">
                                  <Upload className="w-3.5 h-3.5" />
                                  Upload Watermark Image
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) {
                                        compressAndResizeWatermark(f, (b64) => {
                                          handleBrandingFieldChange('watermarkLogoUrl', b64);
                                        });
                                      }
                                      e.target.value = '';
                                    }}
                                  />
                                </label>

                                {editingTemplate.branding?.watermarkLogoUrl && (
                                  <button
                                    type="button"
                                    onClick={() => handleBrandingFieldChange('watermarkLogoUrl', '')}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    Remove
                                  </button>
                                )}
                              </div>

                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] font-bold uppercase text-slate-500 flex items-center gap-1">
                                    <Link2 className="w-3 h-3 text-indigo-500" />
                                    Or Paste Google Drive / Web Link:
                                  </span>
                                  {editingTemplate.branding?.watermarkLogoUrl && isGoogleDriveUrl(editingTemplate.branding.watermarkLogoUrl) && (
                                    <span className="inline-flex items-center gap-1 text-[8px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full font-mono">
                                      <CheckCircle2 className="w-2.5 h-2.5" /> Google Drive Link Converted
                                    </span>
                                  )}
                                </div>
                                <input
                                  type="text"
                                  value={editingTemplate.branding?.watermarkLogoUrl || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const normalized = normalizeExternalImageUrl(val);
                                    handleBrandingFieldChange('watermarkLogoUrl', normalized);
                                  }}
                                  onPaste={(e) => {
                                    const text = e.clipboardData.getData('text');
                                    if (text) {
                                      e.preventDefault();
                                      const normalized = normalizeExternalImageUrl(text);
                                      handleBrandingFieldChange('watermarkLogoUrl', normalized);
                                    }
                                  }}
                                  className="w-full px-2 py-1.5 border text-xs rounded-lg bg-white font-mono text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                  placeholder="Paste Google Drive link or web image URL..."
                                />
                                <p className="text-[8.5px] text-slate-400 leading-tight">
                                  💡 Paste any Google Drive link with &ldquo;Anyone with link can view&rdquo; permission.
                                </p>
                              </div>

                              {editingTemplate.branding?.watermarkLogoUrl && (
                                <div className="p-2 bg-white border border-slate-200 rounded-lg flex items-center gap-2.5">
                                  <div 
                                    className="relative w-12 h-12 rounded border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden"
                                    style={{
                                      backgroundImage: 'linear-gradient(45deg, #f1f5f9 25%, transparent 25%), linear-gradient(-45deg, #f1f5f9 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f1f5f9 75%), linear-gradient(-45deg, transparent 75%, #f1f5f9 75%)',
                                      backgroundSize: '10px 10px',
                                      backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px'
                                    }}
                                  >
                                    <img
                                      src={normalizeExternalImageUrl(editingTemplate.branding.watermarkLogoUrl)}
                                      alt="Watermark Preview"
                                      className="max-w-full max-h-full object-contain pointer-events-none"
                                      style={{ opacity: Math.max(0.2, editingTemplate.branding.watermarkOpacity ?? 0.15) }}
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-[10px] font-bold text-slate-800 truncate block">
                                      {editingTemplate.branding.watermarkLogoUrl.startsWith('data:') ? 'Local Image File' : 'Linked Image'}
                                    </span>
                                    <span className="text-[9px] text-emerald-600 font-semibold">Active for template</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Coverage / Layout Mode for Logo Watermarks */}
                          {editingTemplate.branding?.watermarkType === 'logo' && (
                            <div className="space-y-2 pt-2 border-t border-dashed">
                              <span className="text-[9.5px] font-black uppercase text-slate-600 block">Watermark Page Coverage / Layout:</span>
                              <div className="grid grid-cols-2 gap-2">
                                <label className={`flex flex-col gap-1 p-2 rounded-lg border cursor-pointer transition-all ${
                                  (editingTemplate.branding?.watermarkLayout === 'full_page') 
                                    ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-500' 
                                    : 'bg-white border-slate-200 hover:border-slate-300'
                                }`}>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="radio"
                                      name="tpl_wm_layout"
                                      checked={editingTemplate.branding?.watermarkLayout === 'full_page'}
                                      onChange={() => handleBrandingFieldChange('watermarkLayout', 'full_page')}
                                      className="w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-[11px] font-bold text-slate-800">Full Page (A4 Sheet)</span>
                                  </div>
                                  <span className="text-[8.5px] text-slate-500 leading-tight">
                                    Covers entire report card from header to signatures.
                                  </span>
                                </label>

                                <label className={`flex flex-col gap-1 p-2 rounded-lg border cursor-pointer transition-all ${
                                  (editingTemplate.branding?.watermarkLayout !== 'full_page') 
                                    ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-500' 
                                    : 'bg-white border-slate-200 hover:border-slate-300'
                                }`}>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="radio"
                                      name="tpl_wm_layout"
                                      checked={editingTemplate.branding?.watermarkLayout !== 'full_page'}
                                      onChange={() => handleBrandingFieldChange('watermarkLayout', 'center')}
                                      className="w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-[11px] font-bold text-slate-800">Centered Stamp</span>
                                  </div>
                                  <span className="text-[8.5px] text-slate-500 leading-tight">
                                    Scalable logo emblem centered in the page.
                                  </span>
                                </label>
                              </div>

                              {editingTemplate.branding?.watermarkLayout === 'full_page' && (
                                <div className="flex items-center justify-between p-2 bg-indigo-50/60 rounded-lg border border-indigo-150">
                                  <span className="text-[9.5px] font-bold text-indigo-900">A4 Fitting Mode:</span>
                                  <select
                                    value={editingTemplate.branding?.watermarkFit || 'fill'}
                                    onChange={(e) => handleBrandingFieldChange('watermarkFit', e.target.value)}
                                    className="text-[10px] font-bold border border-indigo-200 rounded px-2 py-1 bg-white text-indigo-950 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  >
                                    <option value="fill">Exact 100% Page Fit (Fill Edges)</option>
                                    <option value="cover">Proportional Cover (Crop Excess)</option>
                                    <option value="contain">Fit Proportional (Contain)</option>
                                  </select>
                                </div>
                              )}
                            </div>
                          )}

                          <div className={`grid ${editingTemplate.branding?.watermarkLayout === 'full_page' ? 'grid-cols-1' : 'grid-cols-2'} gap-3 text-[10px] font-extrabold text-slate-500 pt-1 border-t border-dashed`}>
                            {editingTemplate.branding?.watermarkLayout !== 'full_page' && (
                              <div>
                                <span>Size: {editingTemplate.branding?.watermarkSize || 320}px</span>
                                <input
                                  type="range"
                                  min="30"
                                  max="1200"
                                  step="10"
                                  value={editingTemplate.branding?.watermarkSize || 320}
                                  onChange={(e) => handleBrandingFieldChange('watermarkSize', parseInt(e.target.value))}
                                  className="w-full accent-indigo-650 h-1 bg-slate-200"
                                />
                              </div>
                            )}
                            <div>
                              <span>Opacity: {Math.round((editingTemplate.branding?.watermarkOpacity ?? 0.08) * 100)}%</span>
                              <input
                                type="range"
                                min="0.01"
                                max="0.30"
                                step="0.01"
                                value={editingTemplate.branding?.watermarkOpacity ?? 0.08}
                                onChange={(e) => handleBrandingFieldChange('watermarkOpacity', parseFloat(e.target.value))}
                                className="w-full accent-indigo-650 h-1 bg-slate-200"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* SUBSECTION 4: CUSTOM SCHOLASTIC TABLE HEADINGS */}
                    <div className="space-y-3.5 pb-4 border-b">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1">
                        📊 Scholastic Table Headings Config
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">Scholastic Table Title</span>
                          <input
                            type="text"
                            value={editingTemplate.branding?.scholasticLabel ?? ''}
                            onChange={(e) => handleBrandingFieldChange('scholasticLabel', e.target.value)}
                            className="w-full px-2.5 py-1 text-xs border rounded-lg"
                            placeholder="Scholastic Performance"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">Scholastic Subjects Label</span>
                          <input
                            type="text"
                            value={editingTemplate.branding?.scholasticSubjectsHeaderLabel ?? ''}
                            onChange={(e) => handleBrandingFieldChange('scholasticSubjectsHeaderLabel', e.target.value)}
                            className="w-full px-2.5 py-1 text-xs border rounded-lg"
                            placeholder="Scholastic Subjects"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">Term 1 Total / Grade Header</span>
                          <input
                            type="text"
                            value={editingTemplate.branding?.term1TotalLabel ?? ''}
                            onChange={(e) => handleBrandingFieldChange('term1TotalLabel', e.target.value)}
                            className="w-full px-2.5 py-1 text-xs border rounded-lg"
                            placeholder="T1 Total"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">Term 2 Total / Grade Header</span>
                          <input
                            type="text"
                            value={editingTemplate.branding?.term2TotalLabel ?? ''}
                            onChange={(e) => handleBrandingFieldChange('term2TotalLabel', e.target.value)}
                            className="w-full px-2.5 py-1 text-xs border rounded-lg"
                            placeholder="T2 Total"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">Overall Results Title</span>
                          <input
                            type="text"
                            value={editingTemplate.branding?.overallResultsHeaderLabel ?? ''}
                            onChange={(e) => handleBrandingFieldChange('overallResultsHeaderLabel', e.target.value)}
                            className="w-full px-2.5 py-1 text-xs border rounded-lg"
                            placeholder="Overall Results"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Marks / Subject Grade Header</span>
                          <input
                            type="text"
                            value={editingTemplate.branding?.totalMarksHeaderLabel ?? ''}
                            onChange={(e) => handleBrandingFieldChange('totalMarksHeaderLabel', e.target.value)}
                            className="w-full px-2.5 py-1 text-xs border rounded-lg"
                            placeholder="Total Marks"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">Grade Column Header Label</span>
                          <input
                            type="text"
                            value={editingTemplate.branding?.gradeHeaderLabel ?? ''}
                            onChange={(e) => handleBrandingFieldChange('gradeHeaderLabel', e.target.value)}
                            className="w-full px-2.5 py-1 text-xs border rounded-lg"
                            placeholder="Grade"
                          />
                        </div>
                      </div>

                      {/* Additional Subjects Toggle Section */}
                      <div className="p-3 bg-slate-50 border rounded-xl space-y-3 mt-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-slate-800 block">Enable Additional Subjects Row Section</span>
                            <span className="text-[9px] text-slate-450">Separate non-scholastic rows under their own sub-table</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={editingTemplate.branding?.additionalSubjectsEnabled === true}
                            onChange={(e) => handleBrandingFieldChange('additionalSubjectsEnabled', e.target.checked)}
                            className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                          />
                        </div>
                        {editingTemplate.branding?.additionalSubjectsEnabled === true && (
                          <div className="space-y-2 pt-2 border-t border-dashed">
                            <div className="space-y-1">
                              <span className="text-[9.5px] font-bold text-slate-500 block">Additional Subjects Table Title</span>
                              <input
                                type="text"
                                value={editingTemplate.branding?.additionalSubjectsHeaderLabel ?? ''}
                                onChange={(e) => handleBrandingFieldChange('additionalSubjectsHeaderLabel', e.target.value)}
                                className="w-full px-2.5 py-1 text-xs border rounded-lg"
                                placeholder="Additional Subjects"
                              />
                            </div>
                            <div className="flex items-center justify-between py-1">
                              <div>
                                <span className="text-xs font-semibold text-slate-700 block">Render After Attendance block</span>
                                <span className="text-[9px] text-slate-450 font-medium">Position the table under the combined attendance summary bar</span>
                              </div>
                              <input
                                type="checkbox"
                                checked={editingTemplate.branding?.additionalSubjectsAfterAttendance === true}
                                onChange={(e) => handleBrandingFieldChange('additionalSubjectsAfterAttendance', e.target.checked)}
                                className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* SUBSECTION 5: SUMMARY & ATTENDANCE LABELS */}
                    <div className="space-y-3.5 pt-1">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1">
                        📝 Summary &amp; Attendance Labels
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">Scholastic Summary Title</span>
                          <input
                            type="text"
                            value={editingTemplate.branding?.scholasticSummaryLabel ?? ''}
                            onChange={(e) => handleBrandingFieldChange('scholasticSummaryLabel', e.target.value)}
                            className="w-full px-2.5 py-1 text-xs border rounded-lg"
                            placeholder="Scholastic Summary"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">Working Attendance Title</span>
                          <input
                            type="text"
                            value={editingTemplate.branding?.attendanceLabel ?? ''}
                            onChange={(e) => handleBrandingFieldChange('attendanceLabel', e.target.value)}
                            className="w-full px-2.5 py-1 text-xs border rounded-lg"
                            placeholder="Working Attendance"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Marks Obtained Label</span>
                          <input
                            type="text"
                            value={editingTemplate.branding?.totalMarksObtainedLabel ?? ''}
                            onChange={(e) => handleBrandingFieldChange('totalMarksObtainedLabel', e.target.value)}
                            className="w-full px-2.5 py-1 text-xs border rounded-lg"
                            placeholder="Total Marks Obtained"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">Overall Percentage Label</span>
                          <input
                            type="text"
                            value={editingTemplate.branding?.gradePercentageLabel ?? ''}
                            onChange={(e) => handleBrandingFieldChange('gradePercentageLabel', e.target.value)}
                            className="w-full px-2.5 py-1 text-xs border rounded-lg"
                            placeholder="Overall Percentage"
                          />
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">Overall Grade Row Label</span>
                          <input
                            type="text"
                            value={editingTemplate.branding?.boardGradeLabel ?? ''}
                            onChange={(e) => handleBrandingFieldChange('boardGradeLabel', e.target.value)}
                            className="w-full px-2.5 py-1 text-xs border rounded-lg"
                            placeholder="Overall Grade"
                          />
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </div>

              {/* ACCORDION 3: ACADEMIC SCHOLASTIC SUBJECTS */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <button
                  type="button"
                  onClick={() => setDesignAccordion(designAccordion === 'subjects' ? '' : 'subjects')}
                  className="w-full px-4 py-3 bg-slate-50 text-slate-800 font-bold text-xs flex justify-between items-center"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 border flex items-center justify-center text-[10px] font-bold">3</span>
                    3. Academic Scholastic Subjects Setup
                  </span>
                  {designAccordion === 'subjects' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {designAccordion === 'subjects' && (
                  <div className="p-4 space-y-4">
                    {/* Kindergarten / Foundational Learning Quick Preset Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-gradient-to-r from-amber-50/70 to-indigo-50/70 border border-indigo-100 rounded-xl">
                      <p className="text-[11px] text-slate-700 leading-normal">
                        Configure Core Curriculum Subjects or assign <strong className="text-indigo-900 font-bold">Skill Groups / Categories</strong> for grouped report cards.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          if (!window.confirm("Load Foundational Learning (Skills & Indicators) Grouped Structure? This will configure Skills grouped under Language & Literacy, Numeracy & Logic, and set Grade-Only mode.")) return;
                          setEditingTemplate(prev => {
                            if (!prev) return prev;
                            return {
                              ...prev,
                              pureGradeBased: true,
                              scholasticTerm1Disabled: false,
                              scholasticTerm2Disabled: true,
                              scholasticTerm3Disabled: true,
                              scoreColumns: [],
                              subjects: [
                                { id: "found_lang_1", name: "Identifies uppercase & lowercase letters", group: "Language & Literacy", type: "scholastic", sequence: 0, maxMarks: 100 },
                                { id: "found_lang_2", name: "Recites rhymes with expression", group: "Language & Literacy", type: "scholastic", sequence: 1, maxMarks: 100 },
                                { id: "found_lang_3", name: "Traces lines and basic curves", group: "Language & Literacy", type: "scholastic", sequence: 2, maxMarks: 100 },
                                { id: "found_num_1", name: "Counts objects accurately up to 10", group: "Numeracy & Logic", type: "scholastic", sequence: 3, maxMarks: 100 },
                                { id: "found_num_2", name: "Identifies basic shapes and colors", group: "Numeracy & Logic", type: "scholastic", sequence: 4, maxMarks: 100 },
                                { id: "found_num_3", name: "Demonstrates pattern recognition", group: "Numeracy & Logic", type: "scholastic", sequence: 5, maxMarks: 100 },
                                { id: "found_phys_1", name: "Demonstrates fine motor grip & scissor skills", group: "Physical & Motor Growth", type: "scholastic", sequence: 6, maxMarks: 100 },
                                { id: "found_phys_2", name: "Participates actively in outdoor games & balance", group: "Physical & Motor Growth", type: "scholastic", sequence: 7, maxMarks: 100 },
                                { id: "found_soc_1", name: "Demonstrates sharing and turn-taking", group: "Personal & Social Development", type: "scholastic", sequence: 8, maxMarks: 100 },
                                { id: "found_soc_2", name: "Follows multi-step classroom routines", group: "Personal & Social Development", type: "scholastic", sequence: 9, maxMarks: 100 }
                              ],
                              gradeScales: [
                                { minPercent: 85, maxPercent: 100, grade: 'E' },
                                { minPercent: 60, maxPercent: 84, grade: 'M' },
                                { minPercent: 0, maxPercent: 59, grade: 'D' }
                              ],
                              enableSubjectGrouping: true,
                              customSubjectGroups: ["Language & Literacy", "Numeracy & Logic", "Physical & Motor Growth", "Personal & Social Development"],
                              hideTerm1Total: true,
                              hideTerm1Grade: false,
                              hideTerm2Total: true,
                              hideTerm2Grade: false,
                              hideTerm3Total: true,
                              hideTerm3Grade: false,
                              hideOverallTotal: true,
                              hideOverallGrade: false,
                              branding: {
                                ...(prev.branding || initialBranding),
                                term1Enabled: true,
                                term2Enabled: false,
                                term3Enabled: false,
                                scholasticPerformanceHeaderLabel: "FOUNDATIONAL LEARNING",
                                scholasticSubjectsHeaderLabel: "SKILLS & INDICATORS",
                                term1Label: "TERM 1 LEVEL",
                                gradeHeaderLabel: "TERM 1 LEVEL",
                                gradingScaleRulesHeading: "ASSESSMENT CRITERIA: (E: Exceeding Expectations | M: Meets Expectations | D: Developing)"
                              }
                            };
                          });
                        }}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold shrink-0 shadow-2xs flex items-center gap-1.5"
                      >
                        🌟 Load Foundational Learning Preset
                      </button>
                    </div>

                    <div className="p-3 bg-indigo-50 rounded-xl space-y-2.5">
                      <span className="text-[10px] font-extrabold text-indigo-950 uppercase block">Quick Add Scholastic Subject</span>
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                        <input
                          type="text"
                          value={newSubName}
                          onChange={(e) => setNewSubName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newSubName.trim()) {
                              handleAddCustomSubjectToTemplate('scholastic', newSubName.trim());
                              setNewSubName('');
                            }
                          }}
                          className="md:col-span-9 px-3.5 py-1.5 text-xs border rounded-lg bg-white"
                          placeholder="e.g., Mathematics, English, General Science..."
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!newSubName.trim()) return;
                            handleAddCustomSubjectToTemplate('scholastic', newSubName.trim());
                            setNewSubName('');
                          }}
                          className="md:col-span-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center justify-center gap-1"
                        >
                          <Plus className="w-4.5 h-4.5" /> Add
                        </button>
                      </div>

                      {/* Clickable Quick Add Chips for Scholastic Subjects */}
                      <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-indigo-100/60">
                        <span className="text-[9.5px] font-extrabold text-indigo-900 uppercase tracking-wider mr-1">Suggestions:</span>
                        {STANDARD_SCHOLASTIC_SUBJECTS.map((subName) => {
                          const alreadyAdded = (editingTemplate.subjects || []).some(s => s.type === 'scholastic' && s.name.toLowerCase() === subName.toLowerCase());
                          return (
                            <button
                              key={subName}
                              type="button"
                              onClick={() => handleAddCustomSubjectToTemplate('scholastic', subName)}
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-md border transition-all ${
                                alreadyAdded 
                                  ? 'bg-indigo-100/70 text-indigo-800 border-indigo-200 opacity-60' 
                                  : 'bg-white hover:bg-indigo-50 text-indigo-700 border-indigo-200 shadow-2xs hover:scale-105'
                              }`}
                            >
                              ＋ {subName}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase">
                        <span>Configured Core Subjects ({editingTemplate.subjects?.filter(s => s.type === 'scholastic').length || 0})</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            id="tpl_subject_specific_max"
                            checked={editingTemplate.subjectSpecificMaxMarksEnabled === true}
                            onChange={(e) => setEditingTemplate(prev => ({ ...prev, subjectSpecificMaxMarksEnabled: e.target.checked }))}
                            className="w-3.5 h-3.5 text-indigo-650 cursor-pointer"
                          />
                          <label htmlFor="tpl_subject_specific_max" className="text-[10px] text-slate-500 font-extrabold cursor-pointer">
                            Enable Subject-Specific Max Column Marks
                          </label>
                        </div>
                      </div>

                      <div className="max-h-80 overflow-y-auto space-y-2 border p-3 rounded-xl bg-slate-50">
                        {editingTemplate.subjects?.filter(s => s.type === 'scholastic').length === 0 ? (
                          <div className="p-4 text-center text-xs italic text-slate-400">No scholastic subjects configured yet. Add subjects above.</div>
                        ) : (
                          editingTemplate.subjects?.filter(s => s.type === 'scholastic').map((sub, idx) => (
                            <div
                              key={sub.id}
                              draggable
                              onDragStart={(e) => handleSubDragStart(e, sub.id)}
                              onDragOver={(e) => handleSubDragOver(e, sub.id, 'scholastic')}
                              onDragEnd={() => setDraggedSubId(null)}
                              className={`flex flex-col p-3.5 bg-white border rounded-xl hover:border-indigo-305 transition-all ${draggedSubId === sub.id ? 'opacity-40 bg-slate-100' : ''}`}
                            >
                              <div className="flex items-center justify-between w-full">
                                <div className="flex items-center gap-1.5 w-full mr-2 min-w-0">
                                  <span className="text-slate-400 cursor-grab active:cursor-grabbing px-1">
                                    <GripVertical className="w-3.5 h-3.5" />
                                  </span>
                                  <div className="flex items-center flex-shrink-0">
                                    <button type="button" onClick={() => moveSubjectItem(sub.id, 'up')} className="p-0.5 hover:bg-slate-100 rounded text-slate-500"><ChevronUp className="w-3.5 h-3.5" /></button>
                                    <button type="button" onClick={() => moveSubjectItem(sub.id, 'down')} className="p-0.5 hover:bg-slate-100 rounded text-slate-500"><ChevronDown className="w-3.5 h-3.5" /></button>
                                  </div>
                                  <input
                                    type="text"
                                    value={sub.name}
                                    onChange={(e) => handleModifySubjectName(sub.id, e.target.value)}
                                    className="bg-transparent border-b border-dashed border-slate-200 focus:border-indigo-405 font-bold text-slate-800 text-xs w-full focus:outline-none focus:bg-slate-55"
                                  />
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <div className="flex items-center gap-1">
                                    <span className="text-[10px] font-black text-slate-400">MAX:</span>
                                    <input
                                      type="number"
                                      value={sub.maxMarks || 100}
                                      onChange={(e) => handleUpdateSubjectMaxMarks(sub.id, parseInt(e.target.value, 10) || 100)}
                                      className="w-12 px-1 py-0.5 border text-center rounded text-xs font-bold"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSubjectFromTemplate(sub.id)}
                                    className="p-1 hover:bg-rose-50 text-rose-500 rounded"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Skill / Category Group input */}
                              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
                                <span className="text-[9.5px] font-bold text-slate-400 uppercase shrink-0">Skill Group / Category:</span>
                                <input
                                  type="text"
                                  placeholder="e.g. Language & Literacy, Numeracy & Logic (Optional)"
                                  value={sub.group || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditingTemplate(prev => ({
                                      ...prev,
                                      subjects: (prev.subjects || []).map(s => s.id === sub.id ? { ...s, group: val || undefined } : s)
                                    }));
                                  }}
                                  className="w-full text-xs font-semibold px-2 py-0.5 border border-slate-200 rounded bg-slate-50 focus:bg-white focus:border-indigo-400 focus:outline-none"
                                />
                              </div>

                              {/* Column level maximum marks overrides */}
                              {editingTemplate.subjectSpecificMaxMarksEnabled && (editingTemplate.scoreColumns || []).length > 0 && (
                                <div className="mt-3.5 pt-2 border-t border-slate-100 space-y-2 bg-indigo-50/20 p-2.5 rounded-lg">
                                  <span className="text-[9.5px] font-black text-indigo-900 block uppercase font-sans">Custom Column-Level Maximum Marks Overrides:</span>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-sans">
                                    {editingTemplate.scoreColumns?.map(col => (
                                      <div key={col.id} className="flex flex-col p-1.5 bg-white border rounded">
                                        <span className="text-[9px] text-slate-400 font-bold truncate">{col.name}</span>
                                        <input
                                          type="number"
                                          value={sub.customMaxMarks?.[col.id] !== undefined ? sub.customMaxMarks[col.id] : col.maxMarks || 50}
                                          onChange={(e) => handleUpdateSubjectColumnMaxMarks(sub.id, col.id, parseInt(e.target.value, 10) || 0)}
                                          className="w-full text-center text-xs font-bold border rounded focus:outline-none"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* ADDITIONAL SUBJECTS ROW SECTION */}
                    {editingTemplate.branding?.additionalSubjectsEnabled === true ? (
                      <div className="p-4 bg-emerald-50/25 border border-emerald-200 rounded-2xl space-y-3 mt-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                            <BookOpen className="w-4 h-4 text-emerald-600" /> {editingTemplate.branding?.additionalSubjectsHeaderLabel || "Additional Subjects"} ({editingTemplate.subjects?.filter(s => s.type === 'additional').length || 0})
                          </span>
                          <button
                            type="button"
                            onClick={() => handleAddCustomSubjectToTemplate('additional')}
                            className="px-2.5 py-1 text-[11px] font-bold bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-lg flex items-center gap-1 self-start sm:self-auto shadow-2xs"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add Additional Subject
                          </button>
                        </div>

                        {/* Quick Add Bar for Additional Subject */}
                        <div className="p-2.5 bg-white border border-emerald-100 rounded-xl space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newAdditionalSubName}
                              onChange={(e) => setNewAdditionalSubName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && newAdditionalSubName.trim()) {
                                  handleAddCustomSubjectToTemplate('additional', newAdditionalSubName.trim());
                                  setNewAdditionalSubName('');
                                }
                              }}
                              placeholder="Type additional subject name (e.g. Moral Science, French, G.K., Sanskrit)..."
                              className="flex-grow px-3 py-1.5 text-xs border rounded-lg bg-emerald-50/30 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (!newAdditionalSubName.trim()) return;
                                handleAddCustomSubjectToTemplate('additional', newAdditionalSubName.trim());
                                setNewAdditionalSubName('');
                              }}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 shrink-0"
                            >
                              <Plus className="w-3.5 h-3.5" /> Add
                            </button>
                          </div>

                          {/* Quick clickable chips for additional subjects */}
                          <div className="flex flex-wrap items-center gap-1 pt-1">
                            <span className="text-[9.5px] font-extrabold text-emerald-800 uppercase tracking-wider mr-1">Quick Add:</span>
                            {STANDARD_ADDITIONAL_SUBJECTS.map((subName) => {
                              const alreadyAdded = (editingTemplate.subjects || []).some(s => s.type === 'additional' && s.name.toLowerCase() === subName.toLowerCase());
                              return (
                                <button
                                  key={subName}
                                  type="button"
                                  onClick={() => handleAddCustomSubjectToTemplate('additional', subName)}
                                  className={`px-2 py-0.5 text-[10.5px] font-bold rounded-md border transition-all ${
                                    alreadyAdded 
                                      ? 'bg-emerald-100/60 text-emerald-800 border-emerald-200 opacity-60' 
                                      : 'bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-200 shadow-2xs hover:scale-105'
                                  }`}
                                >
                                  ＋ {subName}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* List of Additional Subjects */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                          {editingTemplate.subjects?.filter(s => s.type === 'additional').length === 0 ? (
                            <div className="col-span-2 p-4 text-center text-xs italic text-slate-400 bg-white border border-dashed rounded-xl">
                              No additional subjects added yet. Use the quick add input or chips above to add subjects like Moral Science, G.K., or Foreign Languages.
                            </div>
                          ) : (
                            editingTemplate.subjects?.filter(s => s.type === 'additional').map((sub) => (
                              <div
                                key={sub.id}
                                draggable
                                onDragStart={(e) => handleSubDragStart(e, sub.id)}
                                onDragOver={(e) => handleSubDragOver(e, sub.id, 'additional')}
                                onDragEnd={() => setDraggedSubId(null)}
                                className={`flex flex-col p-3 bg-white rounded-xl border border-slate-200 transition-all hover:border-emerald-300 ${draggedSubId === sub.id ? 'opacity-40 bg-slate-100' : ''}`}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <div className="flex items-center gap-1.5 w-full mr-2 min-w-0">
                                    <span className="text-slate-400 cursor-grab active:cursor-grabbing hover:text-emerald-600 px-0.5">
                                      <GripVertical className="w-3.5 h-3.5" />
                                    </span>
                                    <div className="flex items-center flex-shrink-0">
                                      <button type="button" onClick={() => moveSubjectItem(sub.id, 'up')} className="p-0.5 hover:bg-slate-100 rounded text-slate-500"><ChevronUp className="w-3.5 h-3.5" /></button>
                                      <button type="button" onClick={() => moveSubjectItem(sub.id, 'down')} className="p-0.5 hover:bg-slate-100 rounded text-slate-500"><ChevronDown className="w-3.5 h-3.5" /></button>
                                    </div>
                                    <input
                                      type="text"
                                      value={sub.name}
                                      onChange={(e) => handleModifySubjectName(sub.id, e.target.value)}
                                      className="bg-transparent border-b border-transparent focus:border-emerald-400 focus:bg-slate-50 px-1 py-0.5 font-bold text-slate-800 w-full text-xs focus:outline-none"
                                    />
                                  </div>
                                  
                                  <div className="flex items-center gap-2 select-none flex-shrink-0">
                                    <div className="flex items-center gap-1">
                                      <span className="text-[10px] font-black text-slate-400">TOTAL MAX:</span>
                                      <input
                                        type="number"
                                        min="5"
                                        max="300"
                                        value={sub.maxMarks || 100}
                                        onChange={(e) => handleUpdateSubjectMaxMarks(sub.id, parseInt(e.target.value, 10) || 100)}
                                        className="w-12 px-1 py-0.5 border text-center rounded text-xs font-bold bg-slate-50 focus:bg-white"
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSubjectFromTemplate(sub.id)}
                                      className="p-1 hover:bg-rose-50 text-rose-500 rounded"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>

                                {/* Skill / Category Group input */}
                                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
                                  <span className="text-[9.5px] font-bold text-slate-400 uppercase shrink-0">Skill Group / Category:</span>
                                  <input
                                    type="text"
                                    placeholder="e.g. Activity Areas, Value Education (Optional)"
                                    value={sub.group || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setEditingTemplate(prev => ({
                                        ...prev,
                                        subjects: (prev.subjects || []).map(s => s.id === sub.id ? { ...s, group: val || undefined } : s)
                                      }));
                                    }}
                                    className="w-full text-xs font-semibold px-2 py-0.5 border border-slate-200 rounded bg-slate-50 focus:bg-white focus:border-emerald-400 focus:outline-none"
                                  />
                                </div>

                                {/* Custom column maximum marks if enabled */}
                                {editingTemplate.subjectSpecificMaxMarksEnabled && (editingTemplate.scoreColumns || []).length > 0 && (
                                  <div className="mt-2.5 pt-2.5 border-t border-dashed border-slate-200">
                                    <div className="flex items-center justify-between mb-1.5">
                                      <span className="text-[9.5px] uppercase font-extrabold text-amber-800">Custom Column Max Marks:</span>
                                      <span className="text-[8.5px] text-slate-400">Applies only to {sub.name}</span>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                      {editingTemplate.scoreColumns?.map((col) => {
                                        const customVal = sub.customMaxMarks?.[col.id] !== undefined ? sub.customMaxMarks[col.id] : col.maxMarks;
                                        return (
                                          <div key={col.id} className="flex flex-col gap-0.5 bg-amber-50/25 p-1 px-1.5 rounded-lg border border-amber-100">
                                            <span className="text-[9px] font-bold text-slate-600 truncate" title={col.name}>{col.name}</span>
                                            <input 
                                              type="number" 
                                              min="0" 
                                              max="300" 
                                              value={customVal} 
                                              onChange={(e) => handleUpdateSubjectColumnMaxMarks(sub.id, col.id, parseInt(e.target.value, 10) || 0)} 
                                              className="w-full text-[10.5px] px-1 py-0.5 border text-center rounded font-extrabold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500" 
                                            />
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 bg-gradient-to-r from-emerald-50/60 to-teal-50/60 border border-emerald-200/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-3">
                        <div className="flex items-center gap-2.5">
                          <span className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                            <BookOpen className="w-4 h-4" />
                          </span>
                          <div>
                            <span className="text-xs font-bold text-slate-800 block">Additional Subjects Row Section (Optional)</span>
                            <span className="text-[10px] text-slate-500">Enable to configure subjects like Moral Science, G.K., Computer, French, Sanskrit, etc.</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleBrandingFieldChange('additionalSubjectsEnabled', true)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow-xs shrink-0 self-stretch sm:self-auto justify-center"
                        >
                          <Plus className="w-3.5 h-3.5" /> Enable Additional Subjects
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ACCORDION 4: SCHOLASTIC ASSESSMENT EXAM COLUMNS */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <button
                  type="button"
                  onClick={() => setDesignAccordion(designAccordion === 'exams' ? '' : 'exams')}
                  className="w-full px-4 py-3 bg-slate-50 text-slate-800 font-bold text-xs flex justify-between items-center"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 border flex items-center justify-center text-[10px] font-bold">4</span>
                    4. Scholastic Assessment Exam Columns &amp; Weights
                  </span>
                  {designAccordion === 'exams' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {designAccordion === 'exams' && (
                  <div className="p-4 space-y-4">
                    {/* Architecture Mode Switcher */}
                    <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">Exam Column Architecture</span>
                        <span className="text-[10px] text-slate-500">Choose whether all terms share identical exam columns or each term has custom exam names and weights.</span>
                      </div>
                      <div className="inline-flex bg-white p-1 rounded-xl border border-indigo-200 shadow-2xs shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditingTemplate(prev => prev ? { ...prev, termSpecificScoreColumnsEnabled: false } : prev)}
                          className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                            !editingTemplate.termSpecificScoreColumnsEnabled
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50'
                          }`}
                        >
                          Uniform Across Terms
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTemplate(prev => {
                              if (!prev) return prev;
                              const currentCols = prev.scoreColumns || [];
                              return {
                                ...prev,
                                termSpecificScoreColumnsEnabled: true,
                                term1ScoreColumns: prev.term1ScoreColumns?.length ? prev.term1ScoreColumns : [...currentCols],
                                term2ScoreColumns: prev.term2ScoreColumns?.length ? prev.term2ScoreColumns : [...currentCols],
                                term3ScoreColumns: prev.term3ScoreColumns?.length ? prev.term3ScoreColumns : [...currentCols],
                              };
                            });
                          }}
                          className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                            editingTemplate.termSpecificScoreColumnsEnabled
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50'
                          }`}
                        >
                          Configure Each Term Separately
                        </button>
                      </div>
                    </div>

                    {/* Term Tabs & Copy Options if Term-Specific enabled */}
                    {editingTemplate.termSpecificScoreColumnsEnabled && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-slate-100/80 rounded-xl border border-slate-200">
                        <div className="inline-flex bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                          {([1, 2, 3] as const).map(termNum => (
                            <button
                              key={termNum}
                              type="button"
                              onClick={() => setSelectedExamTermTab(termNum)}
                              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                                selectedExamTermTab === termNum
                                  ? 'bg-indigo-600 text-white shadow-2xs'
                                  : 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50'
                              }`}
                            >
                              Term {termNum} Exams ({(termNum === 1 ? editingTemplate.term1ScoreColumns : termNum === 2 ? editingTemplate.term2ScoreColumns : editingTemplate.term3ScoreColumns)?.length || 0})
                            </button>
                          ))}
                        </div>

                        {/* Fast Copy / Replicate Actions */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          <span className="font-extrabold text-slate-400 uppercase tracking-wider">Fast Copy:</span>
                          <button
                            type="button"
                            onClick={() => handleCopyTemplateTermCols('master')}
                            className="px-2 py-0.5 bg-white hover:bg-slate-50 text-slate-700 font-bold border border-slate-200 rounded-md shadow-2xs"
                            title="Copy baseline columns from uniform master setup"
                          >
                            From Master
                          </button>
                          {selectedExamTermTab !== 1 && (
                            <button
                              type="button"
                              onClick={() => handleCopyTemplateTermCols('term1')}
                              className="px-2 py-0.5 bg-white hover:bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 rounded-md shadow-2xs"
                            >
                              From Term 1
                            </button>
                          )}
                          {selectedExamTermTab !== 2 && (
                            <button
                              type="button"
                              onClick={() => handleCopyTemplateTermCols('term2')}
                              className="px-2 py-0.5 bg-white hover:bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 rounded-md shadow-2xs"
                            >
                              From Term 2
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleApplyTemplateActiveTermToAll}
                            className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-300 rounded-md shadow-2xs"
                            title="Copy active term's column configuration into all other terms"
                          >
                            Apply Term {selectedExamTermTab} to All
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="p-3 bg-indigo-50 rounded-xl space-y-2.5">
                      <span className="text-[10px] font-extrabold text-indigo-950 uppercase block">
                        Add Exam Component {editingTemplate.termSpecificScoreColumnsEnabled ? `for Term ${selectedExamTermTab}` : ''} (e.g. Theory, Oral, Practical, PT)
                      </span>
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                        <input
                          type="text"
                          value={newExamName}
                          onChange={(e) => setNewExamName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddExamToTemplate();
                          }}
                          className="md:col-span-5 px-3.5 py-1.5 text-xs border rounded-lg bg-white"
                          placeholder="e.g., Oral Test"
                        />
                        <div className="md:col-span-4 flex items-center gap-1">
                          <span className="text-[10px] font-bold text-indigo-900">Max Marks:</span>
                          <input
                            type="number"
                            value={newExamMax}
                            onChange={(e) => setNewExamMax(parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 text-xs border rounded-lg bg-white"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleAddExamToTemplate}
                          className="md:col-span-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center justify-center gap-1"
                        >
                          <Plus className="w-4.5 h-4.5" /> Add
                        </button>
                      </div>

                      {/* Clickable Quick Add Chips for Exam Components */}
                      <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-indigo-100/60">
                        <span className="text-[9.5px] font-extrabold text-indigo-900 uppercase tracking-wider mr-1">Suggestions:</span>
                        {STANDARD_EXAM_SUGGESTIONS.map((examSugg) => {
                          const activeCols = getActiveTemplateScoreColumns();
                          const alreadyAdded = activeCols.some(c => c.name.toLowerCase() === examSugg.name.toLowerCase());
                          return (
                            <button
                              key={examSugg.name}
                              type="button"
                              onClick={() => {
                                const newCol = {
                                  id: `col_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                                  name: examSugg.name,
                                  maxMarks: examSugg.maxMarks
                                };
                                updateActiveTemplateScoreColumns(cols => [...cols, newCol]);
                              }}
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-md border transition-all ${
                                alreadyAdded 
                                  ? 'bg-indigo-100/70 text-indigo-800 border-indigo-200 opacity-60' 
                                  : 'bg-white hover:bg-indigo-50 text-indigo-700 border-indigo-200 shadow-2xs hover:scale-105'
                              }`}
                            >
                              ＋ {examSugg.name} ({examSugg.maxMarks}M)
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        {editingTemplate.termSpecificScoreColumnsEnabled ? `Term ${selectedExamTermTab} ` : ''}Assessment Columns ({getActiveTemplateScoreColumns().length})
                      </span>
                      <div className="max-h-60 overflow-y-auto space-y-1.5 border p-2 rounded-xl bg-slate-50">
                        {getActiveTemplateScoreColumns().length === 0 ? (
                          <div className="p-4 text-center text-xs italic text-slate-400">No exam columns configured yet.</div>
                        ) : (
                          getActiveTemplateScoreColumns().map((exam, idx) => (
                            <div
                              key={exam.id}
                              draggable
                              onDragStart={(e) => handleColDragStart(e, exam.id)}
                              onDragOver={(e) => handleColDragOver(e, exam.id)}
                              className="flex justify-between items-center bg-white p-2.5 rounded-lg border text-xs hover:border-indigo-200"
                            >
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-400 cursor-grab px-0.5">
                                  <GripVertical className="w-3.5 h-3.5" />
                                </span>
                                <div className="flex items-center flex-shrink-0">
                                  <button type="button" onClick={() => moveScoreColItem(idx, 'up')} className="p-0.5 hover:bg-slate-100 rounded text-slate-500"><ChevronUp className="w-3 h-3" /></button>
                                  <button type="button" onClick={() => moveScoreColItem(idx, 'down')} className="p-0.5 hover:bg-slate-100 rounded text-slate-500"><ChevronDown className="w-3 h-3" /></button>
                                </div>
                                <input
                                  type="text"
                                  value={exam.name}
                                  onChange={(e) => handleUpdateCustomExamColumnName(exam.id, e.target.value)}
                                  className="font-bold text-slate-800 text-xs border-b border-dashed border-slate-200 focus:border-indigo-505 bg-transparent focus:outline-none px-1"
                                />
                              </div>

                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1">
                                  <span className="text-[9.5px] text-slate-400 font-bold uppercase">MAX:</span>
                                  <input
                                    type="number"
                                    value={exam.maxMarks || 50}
                                    onChange={(e) => handleUpdateColumnMaxMarks(exam.id, parseInt(e.target.value, 10) || 50)}
                                    className="w-12 px-1 py-0.5 border text-center rounded text-xs font-bold"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveExamFromTemplate(exam.id)}
                                  className="p-1 hover:bg-rose-50 text-rose-500 rounded"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ACCORDION 5: ACTIVE TERMS & STUDENT PROFILE PARAMETERS */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <button
                  type="button"
                  onClick={() => setDesignAccordion(designAccordion === 'terms' ? '' : 'terms')}
                  className="w-full px-4 py-3 bg-slate-50 text-slate-800 font-bold text-xs flex justify-between items-center"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 border flex items-center justify-center text-[10px] font-bold">5</span>
                    5. Active Academic Terms &amp; Draggable Student Profile Fields
                  </span>
                  {designAccordion === 'terms' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {designAccordion === 'terms' && (
                  <div className="p-4 space-y-4">
                    {/* Active Terms Checkboxes & Labels */}
                    <div className="p-3 bg-indigo-50/50 border rounded-xl space-y-3.5">
                      <span className="text-[10px] font-black text-indigo-900 uppercase block">Active Academic Terms Config</span>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Term 1 */}
                        <div className="p-2 bg-white rounded-lg border space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold">Term I (T1)</span>
                            <input
                              type="checkbox"
                              checked={!editingTemplate.scholasticTerm1Disabled}
                              onChange={(e) => setEditingTemplate(prev => ({ ...prev, scholasticTerm1Disabled: !e.target.checked }))}
                              className="w-4 h-4 text-indigo-600 rounded"
                            />
                          </div>
                          <input
                            type="text"
                            value={editingTemplate.branding?.term1Label || 'Term I'}
                            onChange={(e) => handleBrandingFieldChange('term1Label', e.target.value)}
                            disabled={editingTemplate.scholasticTerm1Disabled}
                            className="w-full text-[11px] border rounded px-1.5 py-0.5 text-slate-700 disabled:opacity-40"
                          />
                        </div>

                        {/* Term 2 */}
                        <div className="p-2 bg-white rounded-lg border space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold">Term II (T2)</span>
                            <input
                              type="checkbox"
                              checked={!editingTemplate.scholasticTerm2Disabled}
                              onChange={(e) => setEditingTemplate(prev => ({ ...prev, scholasticTerm2Disabled: !e.target.checked }))}
                              className="w-4 h-4 text-indigo-600 rounded"
                            />
                          </div>
                          <input
                            type="text"
                            value={editingTemplate.branding?.term2Label || 'Term II'}
                            onChange={(e) => handleBrandingFieldChange('term2Label', e.target.value)}
                            disabled={editingTemplate.scholasticTerm2Disabled}
                            className="w-full text-[11px] border rounded px-1.5 py-0.5 text-slate-700 disabled:opacity-40"
                          />
                        </div>

                        {/* Term 3 */}
                        <div className="p-2 bg-white rounded-lg border space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold">Term III (T3)</span>
                            <input
                              type="checkbox"
                              checked={!editingTemplate.scholasticTerm3Disabled}
                              onChange={(e) => setEditingTemplate(prev => ({ ...prev, scholasticTerm3Disabled: !e.target.checked }))}
                              className="w-4 h-4 text-indigo-600 rounded"
                            />
                          </div>
                          <input
                            type="text"
                            value={editingTemplate.branding?.term3Label || 'Term III'}
                            onChange={(e) => handleBrandingFieldChange('term3Label', e.target.value)}
                            disabled={editingTemplate.scholasticTerm3Disabled}
                            className="w-full text-[11px] border rounded px-1.5 py-0.5 text-slate-700 disabled:opacity-40"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Draggable Student Fields */}
                    <div className="space-y-2.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Draggable &amp; Editable Student Profile Fields</span>
                      <div className="p-3 bg-slate-100 rounded-xl space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-y-auto">
                          {(editingTemplate.branding?.studentFields || []).map((field, idx) => (
                            <div
                              key={field.id}
                              draggable
                              onDragStart={(e) => handleFieldDragStart(e, field.id)}
                              onDragOver={(e) => handleFieldDragOver(e, field.id)}
                              className="flex items-center justify-between p-2 bg-white border rounded-lg hover:border-indigo-305 transition-all text-xs"
                            >
                              <div className="flex items-center gap-1 w-full min-w-0">
                                <span className="text-slate-400 cursor-grab px-0.5">
                                  <GripVertical className="w-3 h-3" />
                                </span>
                                <div className="flex flex-col flex-shrink-0">
                                  <button type="button" onClick={() => moveFieldItem(idx, 'up')} className="p-0.2 hover:bg-slate-55 rounded text-slate-500"><ChevronUp className="w-3 h-3" /></button>
                                  <button type="button" onClick={() => moveFieldItem(idx, 'down')} className="p-0.2 hover:bg-slate-55 rounded text-slate-500"><ChevronDown className="w-3 h-3" /></button>
                                </div>
                                <input
                                  type="text"
                                  value={field.label}
                                  onChange={(e) => handleEditFieldLabel(field.id, e.target.value)}
                                  className="w-full text-[11px] font-bold text-slate-700 bg-transparent border-b border-dashed border-slate-200 focus:outline-none focus:border-indigo-505 truncate px-1"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteField(field.id)}
                                className="text-rose-500 hover:text-rose-700 p-0.5"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>

                        <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2">
                          <input
                            type="text"
                            value={newFieldNameInput}
                            onChange={(e) => setNewFieldNameInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleAddCustomField();
                            }}
                            placeholder="Add Profile parameter, e.g. Attendance, Blood Group..."
                            className="flex-grow px-3 py-1 text-xs border rounded-lg bg-white"
                          />
                          <button
                            type="button"
                            onClick={handleAddCustomField}
                            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex-shrink-0"
                          >
                            ＋ Add Field
                          </button>
                        </div>

                        {/* Quick suggestions chips for student fields */}
                        <div className="flex flex-wrap items-center gap-1 pt-1.5 border-t border-slate-200/40">
                          <span className="text-[9.5px] font-extrabold text-slate-500 uppercase tracking-wider mr-1">Suggestions:</span>
                          {STANDARD_PROFILE_FIELDS.map((fieldName) => {
                            const alreadyAdded = (editingTemplate.branding?.studentFields || []).some(f => f.label.toLowerCase() === fieldName.toLowerCase());
                            return (
                              <button
                                key={fieldName}
                                type="button"
                                onClick={() => {
                                  if (alreadyAdded) return;
                                  const currentFields = editingTemplate.branding?.studentFields || [];
                                  const newField = {
                                    id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                                    label: fieldName,
                                    visible: true
                                  };
                                  handleBrandingFieldChange('studentFields', [...currentFields, newField]);
                                }}
                                className={`px-2 py-0.5 text-[10px] font-bold rounded-md border transition-all ${
                                  alreadyAdded 
                                    ? 'bg-slate-200 text-slate-500 border-slate-300 opacity-60' 
                                    : 'bg-white hover:bg-indigo-50 text-indigo-700 border-indigo-200 shadow-2xs hover:scale-105'
                                }`}
                              >
                                ＋ {fieldName}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ACCORDION 6: DRAGGABLE GRADING SCALE */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <button
                  type="button"
                  onClick={() => setDesignAccordion(designAccordion === 'grades' ? '' : 'grades')}
                  className="w-full px-4 py-3 bg-slate-50 text-slate-800 font-bold text-xs flex justify-between items-center"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 border flex items-center justify-center text-[10px] font-bold">6</span>
                    6. Scholastic Grading Tiers Range Scales Limits
                  </span>
                  {designAccordion === 'grades' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {designAccordion === 'grades' && (
                  <div className="p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Core Scholastic Grade Ranges Setup</span>
                        <span className="text-[9px] text-slate-400">Define grade tiers mapped to percentage ranges</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={handleLoadCbse8PointGrades}
                          className="px-2 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border rounded"
                        >
                          CBSE 8-Point
                        </button>
                        <button
                          type="button"
                          onClick={handleLoad5PointGrades}
                          className="px-2 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border rounded"
                        >
                          5-Point (A-E)
                        </button>
                        <button
                          type="button"
                          onClick={handleLoad10PointGpaGrades}
                          className="px-2 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border rounded"
                        >
                          10-Point GPA
                        </button>
                        <button
                          type="button"
                          onClick={handleAddGradeScale}
                          className="px-2 py-0.5 text-xs bg-indigo-50 text-indigo-700 font-black border border-indigo-200 rounded hover:bg-indigo-100"
                        >
                          ＋ Add Grade Tier
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 bg-slate-100 p-3 rounded-xl max-h-56 overflow-y-auto">
                      {(editingTemplate.gradeScales || []).map((item, idx) => (
                        <div
                          key={idx}
                          draggable
                          onDragStart={(e) => handleGradeDragStart(e, idx)}
                          onDragOver={(e) => handleGradeDragOver(e, idx)}
                          className="flex items-center justify-between p-2 bg-white border rounded-lg text-xs"
                        >
                          <div className="flex items-center gap-1 w-full mr-2">
                            <span className="text-slate-400 cursor-grab px-0.5">
                              <GripVertical className="w-3 h-3" />
                            </span>
                            <div className="flex flex-col">
                              <button type="button" onClick={() => moveGradeScaleItem(idx, 'up')} className="text-slate-500"><ChevronUp className="w-3 h-3" /></button>
                              <button type="button" onClick={() => moveGradeScaleItem(idx, 'down')} className="text-slate-500"><ChevronDown className="w-3 h-3" /></button>
                            </div>
                            <div className="space-y-1 w-full">
                              <input
                                type="text"
                                value={item.grade}
                                onChange={(e) => handleUpdateGradeScaleItem(idx, 'grade', e.target.value)}
                                className="w-full text-center font-black text-indigo-700 bg-slate-50 border rounded py-0.5"
                              />
                              <div className="grid grid-cols-2 gap-1 text-[8px] font-extrabold text-slate-400 text-center">
                                <div>
                                  <span>Min %</span>
                                  <input
                                    type="number"
                                    value={item.minPercent}
                                    onChange={(e) => handleUpdateGradeScaleItem(idx, 'minPercent', e.target.value)}
                                    className="w-full text-center border rounded font-bold"
                                  />
                                </div>
                                <div>
                                  <span>Max %</span>
                                  <input
                                    type="number"
                                    value={item.maxPercent}
                                    onChange={(e) => handleUpdateGradeScaleItem(idx, 'maxPercent', e.target.value)}
                                    className="w-full text-center border rounded font-bold"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveGradeScaleIndex(idx)}
                            className="text-rose-500 hover:text-rose-700 p-0.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Co-Scholastic Grade Legend Config */}
                    <div className="pt-3 border-t border-slate-200">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Co-Scholastic Grading Scale Config</span>
                          <span className="text-[9px] text-slate-400">Scale for non-scholastic parameters &amp; life skills</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={handleLoadCoGradePreset5}
                            className="px-2 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border rounded"
                          >
                            5-Scale (A-E)
                          </button>
                          <button
                            type="button"
                            onClick={handleLoadCoGradePreset3}
                            className="px-2 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold border rounded"
                          >
                            3-Scale (A-C)
                          </button>
                          <button
                            type="button"
                            onClick={handleAddCoGradeScale}
                            className="px-2 py-0.5 text-xs bg-indigo-50 text-indigo-700 font-black border border-indigo-200 rounded hover:bg-indigo-100"
                          >
                            ＋ Add Co-Scholastic Grade
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-100 p-3 rounded-xl max-h-52 overflow-y-auto">
                        {(editingTemplate.coGradeScales || []).map((item, idx) => (
                          <div key={idx} className="flex justify-between items-start p-2 bg-white border rounded-lg text-xs gap-1.5">
                            <div className="space-y-1.5 w-full">
                              <div className="flex items-center gap-1">
                                <span className="text-[9px] font-bold text-slate-400">Score Code:</span>
                                <input
                                  type="text"
                                  value={item.score}
                                  onChange={(e) => handleUpdateCoGradeScaleItem(idx, 'score', e.target.value)}
                                  className="w-12 text-center text-xs font-black border rounded py-0.2"
                                />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[9px] font-bold text-slate-400">Meaning / Description:</span>
                                <input
                                  type="text"
                                  value={item.description}
                                  onChange={(e) => handleUpdateCoGradeScaleItem(idx, 'description', e.target.value)}
                                  className="w-full text-[11px] border rounded px-1"
                                />
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveCoGradeScaleIdx(idx)}
                              className="text-rose-500 hover:text-rose-700 p-0.5"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ACCORDION 7: CUSTOM SCHOLASTIC PARTS & ADDDONS */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <button
                  type="button"
                  onClick={() => setDesignAccordion(designAccordion === 'custom_addons' ? '' : 'custom_addons')}
                  className="w-full px-4 py-3 bg-slate-50 text-slate-800 font-bold text-xs flex justify-between items-center"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 border flex items-center justify-center text-[10px] font-bold">7</span>
                    7. Custom Scholastic Parts, signature, Footer Layout
                  </span>
                  {designAccordion === 'custom_addons' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {designAccordion === 'custom_addons' && (
                  <div className="p-4 space-y-4">
                    {/* Add Custom Co-Scholastic Section / Block */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center pb-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Custom Co-Scholastic Parts / Blocks</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTemplate(prev => {
                              if (!prev) return prev;
                              const sections = prev.coScholasticSections || [];
                              const newId = `co_${Date.now()}`;
                              const newSection: CoScholasticSection = {
                                id: newId,
                                title: "Personality Traits / Physical Health",
                                subjectHeader: "Aspect / Parameter Area",
                                gradingScaleText: "5-Point Scale",
                                term1Enabled: true,
                                term2Enabled: true,
                                type: 'co_scholastic'
                              };
                              return { ...prev, coScholasticSections: [...sections, newSection] };
                            });
                          }}
                          className="px-2.5 py-1 text-[11px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg flex items-center gap-1"
                        >
                          ＋ Add Custom Block
                        </button>
                      </div>

                      <div className="space-y-3.5 max-h-[300px] overflow-y-auto">
                        {(editingTemplate.coScholasticSections || []).map((section, sIdx) => (
                          <div key={section.id} className="p-3 bg-white border rounded-xl shadow-2xs space-y-3">
                            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                              <span className="text-xs font-black text-slate-750 flex items-center gap-1.5">
                                <span className="bg-indigo-50 text-indigo-650 rounded-full w-4.5 h-4.5 flex items-center justify-center text-[9px] border font-black">{sIdx + 1}</span>
                                Block Header: {section.title}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTemplate(prev => {
                                    if (!prev || !prev.coScholasticSections) return prev;
                                    return { ...prev, coScholasticSections: prev.coScholasticSections.filter(s => s.id !== section.id) };
                                  });
                                }}
                                className="text-rose-500 hover:text-rose-700"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                              <div>
                                <span className="text-[9px] text-slate-400 font-extrabold uppercase">Block Display Title</span>
                                <input
                                  type="text"
                                  value={section.title}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditingTemplate(prev => ({
                                      ...prev,
                                      coScholasticSections: prev.coScholasticSections?.map(s => s.id === section.id ? { ...s, title: val } : s)
                                    }));
                                  }}
                                  className="w-full border rounded px-2 py-1"
                                />
                              </div>
                              <div>
                                <span className="text-[9px] text-slate-400 font-extrabold uppercase">Subject Column Header</span>
                                <input
                                  type="text"
                                  value={section.subjectHeader}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditingTemplate(prev => ({
                                      ...prev,
                                      coScholasticSections: prev.coScholasticSections?.map(s => s.id === section.id ? { ...s, subjectHeader: val } : s)
                                    }));
                                  }}
                                  className="w-full border rounded px-2 py-1"
                                />
                              </div>
                              <div>
                                <span className="text-[9px] text-slate-400 font-extrabold uppercase">Grading Scale Label</span>
                                <input
                                  type="text"
                                  value={section.gradingScaleText}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditingTemplate(prev => ({
                                      ...prev,
                                      coScholasticSections: prev.coScholasticSections?.map(s => s.id === section.id ? { ...s, gradingScaleText: val } : s)
                                    }));
                                  }}
                                  className="w-full border rounded px-2 py-1"
                                />
                              </div>
                            </div>

                            <div className="p-2.5 bg-slate-50 border rounded-lg space-y-2">
                              <div className="flex justify-between items-center text-[10px] font-bold text-slate-505">
                                <span>Traits / Activities inside Block ({editingTemplate.subjects?.filter(sub => sub.sectionId === section.id || (sub.type === section.type && (!sub.sectionId || sub.sectionId === section.id))).length || 0})</span>
                                <button
                                  type="button"
                                  onClick={() => handleAddItemToPart(section.id, section.type)}
                                  className="px-2 py-0.2 text-[9px] bg-indigo-55 hover:bg-indigo-100 text-indigo-700 border rounded font-black"
                                >
                                  ＋ Add Trait/Activity
                                </button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
                                {(editingTemplate.subjects?.filter(sub => sub.sectionId === section.id || (sub.type === section.type && (!sub.sectionId || sub.sectionId === section.id))) || []).map((sub) => (
                                  <div key={sub.id} className="flex items-center justify-between p-1.5 bg-white border rounded-md text-xs">
                                    <input
                                      type="text"
                                      value={sub.name}
                                      onChange={(e) => handleModifySubjectName(sub.id, e.target.value)}
                                      className="font-bold text-slate-700 bg-transparent focus:outline-none w-full border-b border-transparent focus:border-slate-300 px-1 py-0.2"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSubjectFromTemplate(sub.id)}
                                      className="text-rose-500 hover:text-rose-700 p-0.5"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Signature Rows configuration */}
                    <div className="pt-3 border-t border-slate-200 space-y-2">
                      <div className="flex justify-between items-center pb-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Custom Certificate Signature Rows</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingTemplate(prev => {
                              if (!prev) return prev;
                              const sigs = prev.signatures || [];
                              const newId = `sig_${Date.now()}`;
                              return { ...prev, signatures: [...sigs, { id: newId, label: 'Authorized Officer Signature' }] };
                            });
                          }}
                          className="px-2 py-0.5 text-xs bg-indigo-55 text-indigo-750 font-black border border-indigo-200 rounded hover:bg-indigo-100"
                        >
                          ＋ Add Signature Space
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 bg-slate-100 p-2.5 rounded-xl">
                        {(editingTemplate.signatures || []).map((sig, idx) => (
                          <div key={sig.id} className="p-2 bg-white border rounded-lg flex items-center justify-between text-xs gap-1.5">
                            <input
                              type="text"
                              value={sig.label}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditingTemplate(prev => ({
                                  ...prev,
                                  signatures: prev.signatures?.map(s => s.id === sig.id ? { ...s, label: val } : s)
                                }));
                              }}
                              className="font-black text-slate-700 w-full focus:outline-none bg-slate-50 border rounded px-1.5 py-0.5"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setEditingTemplate(prev => {
                                  if (!prev || !prev.signatures) return prev;
                                  return { ...prev, signatures: prev.signatures.filter(s => s.id !== sig.id) };
                                });
                              }}
                              className="text-rose-500 hover:text-rose-700"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Quick Suggestions for Signatures */}
                      <div className="flex flex-wrap items-center gap-1 pt-1">
                        <span className="text-[9.5px] font-extrabold text-slate-500 uppercase tracking-wider mr-1">Suggestions:</span>
                        {STANDARD_SIGNATURE_SUGGESTIONS.map((sigName) => {
                          const alreadyAdded = (editingTemplate.signatures || []).some(s => s.label.toLowerCase() === sigName.toLowerCase());
                          return (
                            <button
                              key={sigName}
                              type="button"
                              onClick={() => {
                                if (alreadyAdded) return;
                                setEditingTemplate(prev => {
                                  if (!prev) return prev;
                                  const sigs = prev.signatures || [];
                                  const newId = `sig_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
                                  return { ...prev, signatures: [...sigs, { id: newId, label: sigName }] };
                                });
                              }}
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-md border transition-all ${
                                alreadyAdded 
                                  ? 'bg-slate-200 text-slate-500 border-slate-300 opacity-60' 
                                  : 'bg-white hover:bg-indigo-50 text-indigo-700 border-indigo-200 shadow-2xs hover:scale-105'
                              }`}
                            >
                              ＋ {sigName}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Checkboxes & additional controls */}
                    <div className="pt-3 border-t border-slate-200 space-y-2 bg-slate-50 p-3.5 rounded-xl">
                      <span className="text-[10px] font-black text-slate-500 block uppercase">Advanced Layout Parameters Controls</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingTemplate.pureGradeBased === true}
                            onChange={(e) => setEditingTemplate(prev => ({ ...prev, pureGradeBased: e.target.checked }))}
                            className="w-4 h-4 text-indigo-600 rounded"
                          />
                          Pure Grade-Based report card (Hide marks columns)
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingTemplate.hideAttendance === true}
                            onChange={(e) => setEditingTemplate(prev => ({ ...prev, hideAttendance: e.target.checked }))}
                            className="w-4 h-4 text-indigo-600 rounded"
                          />
                          Hide student attendance panel completely
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingTemplate.hideGradingScale === true}
                            onChange={(e) => setEditingTemplate(prev => ({ ...prev, hideGradingScale: e.target.checked }))}
                            className="w-4 h-4 text-indigo-600 rounded"
                          />
                          Hide general grading scale guide block
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingTemplate.verticalExamHeaders === true}
                            onChange={(e) => setEditingTemplate(prev => ({ ...prev, verticalExamHeaders: e.target.checked }))}
                            className="w-4 h-4 text-indigo-600 rounded"
                          />
                          Render exam headers vertically (prevents overflow)
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingTemplate.verticalSubjectsHeader === true}
                            onChange={(e) => setEditingTemplate(prev => ({ ...prev, verticalSubjectsHeader: e.target.checked }))}
                            className="w-4 h-4 text-indigo-600 rounded"
                          />
                          Render subject names column header vertically
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingTemplate.coScholasticOneColumn === true}
                            onChange={(e) => setEditingTemplate(prev => ({ ...prev, coScholasticOneColumn: e.target.checked }))}
                            className="w-4 h-4 text-indigo-600 rounded"
                          />
                          Co-Scholastic parts in single integrated column layout
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingTemplate.enableSubjectGrouping !== false}
                            onChange={(e) => setEditingTemplate(prev => ({ ...prev, enableSubjectGrouping: e.target.checked }))}
                            className="w-4 h-4 text-indigo-600 rounded"
                          />
                          Enable Subject Grouping by Category / Skill Group
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingTemplate.hideTerm1Total === true}
                            onChange={(e) => setEditingTemplate(prev => ({ ...prev, hideTerm1Total: e.target.checked }))}
                            className="w-4 h-4 text-indigo-600 rounded"
                          />
                          Hide Term 1 Total Marks Column
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingTemplate.hideTerm1Grade === true}
                            onChange={(e) => setEditingTemplate(prev => ({ ...prev, hideTerm1Grade: e.target.checked }))}
                            className="w-4 h-4 text-indigo-600 rounded"
                          />
                          Hide Term 1 Grade Column
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingTemplate.hideTerm2Total === true}
                            onChange={(e) => setEditingTemplate(prev => ({ ...prev, hideTerm2Total: e.target.checked }))}
                            className="w-4 h-4 text-indigo-600 rounded"
                          />
                          Hide Term 2 Total Marks Column
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingTemplate.hideTerm2Grade === true}
                            onChange={(e) => setEditingTemplate(prev => ({ ...prev, hideTerm2Grade: e.target.checked }))}
                            className="w-4 h-4 text-indigo-600 rounded"
                          />
                          Hide Term 2 Grade Column
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingTemplate.hideTerm3Total === true}
                            onChange={(e) => setEditingTemplate(prev => ({ ...prev, hideTerm3Total: e.target.checked }))}
                            className="w-4 h-4 text-indigo-600 rounded"
                          />
                          Hide Term 3 Total Marks Column
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingTemplate.hideTerm3Grade === true}
                            onChange={(e) => setEditingTemplate(prev => ({ ...prev, hideTerm3Grade: e.target.checked }))}
                            className="w-4 h-4 text-indigo-600 rounded"
                          />
                          Hide Term 3 Grade Column
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingTemplate.hideOverallTotal === true}
                            onChange={(e) => setEditingTemplate(prev => ({ ...prev, hideOverallTotal: e.target.checked }))}
                            className="w-4 h-4 text-indigo-600 rounded"
                          />
                          Hide Overall Total Marks Column
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingTemplate.hideOverallGrade === true}
                            onChange={(e) => setEditingTemplate(prev => ({ ...prev, hideOverallGrade: e.target.checked }))}
                            className="w-4 h-4 text-indigo-600 rounded"
                          />
                          Hide Overall Grade Column
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ACCORDION 8: DYNAMIC PREVIEW CUSTOMIZER */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <button
                  type="button"
                  onClick={() => setDesignAccordion(designAccordion === 'demo_student' ? '' : 'demo_student')}
                  className="w-full px-4 py-3 bg-slate-50 text-slate-800 font-bold text-xs flex justify-between items-center"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 border flex items-center justify-center text-[10px] font-bold">8</span>
                    8. Live Preview Demo Scholar Details
                  </span>
                  {designAccordion === 'demo_student' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {designAccordion === 'demo_student' && (
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Demo Scholar Name</span>
                        <input
                          type="text"
                          value={editingTemplate.demoStudentName || ''}
                          onChange={(e) => setEditingTemplate(prev => ({ ...prev, demoStudentName: e.target.value }))}
                          className="w-full px-3 py-1 text-xs border rounded-lg bg-slate-50 focus:bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Demo Roll No</span>
                        <input
                          type="text"
                          value={editingTemplate.demoRollNo || ''}
                          onChange={(e) => setEditingTemplate(prev => ({ ...prev, demoRollNo: e.target.value }))}
                          className="w-full px-3 py-1 text-xs border rounded-lg bg-slate-50 focus:bg-white font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Demo Class Scope</span>
                        <input
                          type="text"
                          value={editingTemplate.demoClassName || ''}
                          onChange={(e) => setEditingTemplate(prev => ({ ...prev, demoClassName: e.target.value }))}
                          className="w-full px-3 py-1 text-xs border rounded-lg bg-slate-55 focus:bg-white"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Live Interactive Preview Box (Full Width stacked below design section) */}
            <div className="w-full flex flex-col space-y-4">
              <span className="text-xs font-black text-slate-700 flex items-center gap-1 bg-slate-100 px-3 py-1.5 rounded-xl max-w-max border">
                <Eye className="w-4 h-4 text-indigo-500 animate-pulse" /> Live Blueprint Preview
              </span>
              
              <div className="border border-slate-200/80 rounded-2xl sm:rounded-3xl overflow-x-hidden overflow-y-auto shadow-sm bg-slate-100 p-1 sm:p-4 min-h-[450px] max-h-[85vh] h-auto scrollbar-thin flex justify-center items-start">
                <div className="w-full max-w-full shrink-0">
                  <ReportCardPreview
                    branding={{
                      ...(editingTemplate.branding || {}),
                      schoolName: schoolName || (editingTemplate.branding as SchoolBranding)?.schoolName || "DEMO PUBLIC SCHOOL"
                    } as SchoolBranding}
                    subjects={editingTemplate.subjects || []}
                    scoreColumns={editingTemplate.scoreColumns || []}
                    termSpecificScoreColumnsEnabled={editingTemplate.termSpecificScoreColumnsEnabled}
                    term1ScoreColumns={editingTemplate.term1ScoreColumns}
                    term2ScoreColumns={editingTemplate.term2ScoreColumns}
                    term3ScoreColumns={editingTemplate.term3ScoreColumns}
                    gradeScales={editingTemplate.gradeScales || []}
                    coGradeScales={editingTemplate.coGradeScales}
                    coScholasticSections={editingTemplate.coScholasticSections}
                    signatures={editingTemplate.signatures}
                    scholasticTerm1Disabled={editingTemplate.scholasticTerm1Disabled}
                    scholasticTerm2Disabled={editingTemplate.scholasticTerm2Disabled}
                    scholasticTerm3Disabled={editingTemplate.scholasticTerm3Disabled}
                    coScholasticOneColumn={editingTemplate.coScholasticOneColumn}
                    hideGradingScale={editingTemplate.hideGradingScale}
                    hideAttendance={editingTemplate.hideAttendance}
                    pureGradeBased={editingTemplate.pureGradeBased}
                    gradingScaleAfterSignatures={editingTemplate.gradingScaleAfterSignatures}
                    gradingScaleLayout={editingTemplate.gradingScaleLayout}
                    verticalExamHeaders={editingTemplate.verticalExamHeaders}
                    verticalSubjectsHeader={editingTemplate.verticalSubjectsHeader}
                    subjectSpecificMaxMarksEnabled={editingTemplate.subjectSpecificMaxMarksEnabled}
                    enableSubjectGrouping={editingTemplate.enableSubjectGrouping}
                    customSubjectGroups={editingTemplate.customSubjectGroups}
                    hideTerm1Total={editingTemplate.hideTerm1Total}
                    hideTerm1Grade={editingTemplate.hideTerm1Grade}
                    hideTerm2Total={editingTemplate.hideTerm2Total}
                    hideTerm2Grade={editingTemplate.hideTerm2Grade}
                    hideTerm3Total={editingTemplate.hideTerm3Total}
                    hideTerm3Grade={editingTemplate.hideTerm3Grade}
                    hideOverallTotal={editingTemplate.hideOverallTotal}
                    hideOverallGrade={editingTemplate.hideOverallGrade}
                    student={{
                      ...defaultDemoStudent,
                      name: editingTemplate.demoStudentName || defaultDemoStudent.name,
                      rollNo: editingTemplate.demoRollNo || defaultDemoStudent.rollNo,
                      className: editingTemplate.demoClassName || defaultDemoStudent.className
                    }}
                    grades={makeDemoGrades(
                      editingTemplate.subjects || [],
                      editingTemplate.scoreColumns || [],
                      editingTemplate.termSpecificScoreColumnsEnabled,
                      editingTemplate.term1ScoreColumns,
                      editingTemplate.term2ScoreColumns,
                      editingTemplate.term3ScoreColumns
                    )}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- TABS CONTENT ----------------- */}
      {!editingTemplate && (
        <div className="space-y-6">
          {/* SEARCH & FILTER BAR */}
          {activeTab === 'gallery' && (
            <div className="bg-slate-50 border border-slate-200 p-3 sm:p-4 rounded-2xl sm:rounded-3xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
                <span className="text-xs font-black text-slate-700 flex items-center gap-1 shrink-0">
                  <Filter className="w-4 h-4 text-indigo-500" /> Filters:
                </span>

                {/* Category selectors */}
                <div className="flex flex-wrap gap-1 border bg-white p-1 rounded-xl w-full sm:w-auto">
                  {['all', 'Nursery', 'Primary', 'Secondary', 'Custom'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`flex-1 sm:flex-none px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold capitalize transition-all text-center ${
                        categoryFilter === cat
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                      }`}
                    >
                      {cat === 'all' ? 'All' : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text search class wise */}
              <div className="relative w-full md:w-64">
                <input
                  type="text"
                  placeholder="Search classwise (e.g. LKG)..."
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="w-full px-3 py-2 pl-9 text-xs border rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="p-20 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-500">Loading templates workspace datasets...</p>
            </div>
          ) : (
            <>
              {/* 1. GALLERY TAB */}
              {activeTab === 'gallery' && (
                <>
                  {filteredTemplates.length === 0 ? (
                    <div className="text-center p-20 border-2 border-dashed border-slate-200 rounded-3xl space-y-3">
                      <span className="text-2xl block">🗂️</span>
                      <h4 className="font-extrabold text-sm text-slate-800">No Templates Found</h4>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        There are no template blueprints matching the configured category or classwise search criteria. 
                        {mode === 'saas' && ' Click "Design Template Card" to construct your very first gallery blueprint!'}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredTemplates.map((tpl, idx) => {
                        const hasRequested = (requests || []).some(r => 
                          (r.schoolId ? r.schoolId === schoolId : true) && 
                          (r.templateId === tpl.id || r.templateId.replace('struct_', '') === tpl.id.replace('struct_', '') || r.templateName === tpl.name) && 
                          r.status === 'pending'
                        );
                        const isLocallyInstalled = isTemplateActiveInSchool(tpl, currentSchoolStructures);

                        return (
                          <div 
                            key={`${tpl.id}-${idx}`} 
                            className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl overflow-hidden hover:shadow-lg transition-all flex flex-col relative group"
                          >
                            {/* Accent indicator color bar */}
                            <div className="h-2 w-full" style={{ backgroundColor: tpl.branding?.themeColor || '#4f46e5' }} />
                            
                            <div className="p-4 sm:p-5 flex-1 flex flex-col space-y-4">
                              <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                                <div className="space-y-1">
                                  <span className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[9.5px] font-black rounded-lg uppercase tracking-wide border">
                                    {tpl.category}
                                  </span>
                                  <h3 className="font-extrabold text-sm text-slate-800 tracking-tight group-hover:text-indigo-600 transition-colors">
                                    {tpl.name}
                                  </h3>
                                </div>

                                <div className="sm:text-right shrink-0">
                                  <span className="text-[9.5px] font-semibold text-slate-400 block uppercase sm:inline-block sm:mr-1">Classes:</span>
                                  <span className="inline-block text-[10px] font-bold text-indigo-650 bg-indigo-50/50 border px-1.5 py-0.5 rounded max-w-[120px] truncate sm:max-w-none" title={(tpl.assignedClasses || []).join(', ')}>
                                    {(tpl.assignedClasses || []).join(', ')}
                                  </span>
                                </div>
                              </div>

                              <div className="space-y-3.5 p-3.5 bg-slate-50/70 rounded-2xl border border-slate-100 text-[11px] flex-1 flex flex-col justify-between">
                                <div className="space-y-1.5">
                                  <span className="text-slate-400 block font-extrabold text-[9px] uppercase tracking-wider">
                                    Subjects ({tpl.subjects?.length || 0})
                                  </span>
                                  {tpl.subjects && tpl.subjects.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5 max-h-[85px] overflow-y-auto no-scrollbar">
                                      {tpl.subjects.map((sub, sIdx) => {
                                        const badgeColor = sub.type === 'scholastic' 
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                          : sub.type === 'co_scholastic' 
                                          ? 'bg-amber-50 text-amber-700 border-amber-100' 
                                          : 'bg-indigo-50 text-indigo-700 border-indigo-100';
                                        return (
                                          <span 
                                            key={`${sub.id}-${sIdx}`} 
                                            className={`px-2 py-0.5 border rounded-lg text-[9.5px] font-bold tracking-tight ${badgeColor}`}
                                            title={`${sub.name} (${sub.type})`}
                                          >
                                            {sub.name}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 text-[10px] italic">No subjects configured</span>
                                  )}
                                </div>
                                
                                <div className="border-t border-slate-200/50 my-1" />

                                <div className="space-y-1.5">
                                  <span className="text-slate-400 block font-extrabold text-[9px] uppercase tracking-wider">
                                    Assessments ({tpl.scoreColumns?.length || 0})
                                  </span>
                                  {tpl.scoreColumns && tpl.scoreColumns.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5 max-h-[85px] overflow-y-auto no-scrollbar">
                                      {tpl.scoreColumns.map((col, cIdx) => (
                                        <span 
                                          key={`${col.id}-${cIdx}`} 
                                          className="px-2 py-0.5 bg-indigo-50/80 text-indigo-700 border border-indigo-100 rounded-lg text-[9.5px] font-black tracking-tight"
                                          title={`${col.name} (Max Marks: ${col.maxMarks})`}
                                        >
                                          {col.name} <span className="text-indigo-400">({col.maxMarks}M)</span>
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 text-[10px] italic">No exams configured</span>
                                  )}
                                </div>
                              </div>

                              {/* Action buttons inside Card */}
                              <div className="flex flex-col sm:flex-row gap-2 pt-2 mt-auto">
                                <button
                                  type="button"
                                  onClick={() => setPreviewTemplate(tpl)}
                                  className="flex-grow py-2.5 border rounded-xl text-xs font-bold text-slate-650 hover:bg-slate-50 flex items-center justify-center gap-1 transition-all active:scale-95"
                                >
                                  <Eye className="w-4 h-4 text-slate-500" /> View Live Card
                                </button>

                                {mode === 'saas' ? (
                                  <div className="flex gap-2 w-full sm:w-auto">
                                    <button
                                      type="button"
                                      onClick={() => setAssigningTemplate(tpl)}
                                      className="flex-1 sm:flex-none py-2.5 px-3 border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs active:scale-95"
                                      title="Assign template directly to any registered school"
                                    >
                                      <Building2 className="w-4 h-4 text-emerald-600" />
                                      <span>Assign to School</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleEditTemplate(tpl)}
                                      className="py-2.5 px-3 border border-indigo-200 text-indigo-600 hover:bg-indigo-50 rounded-xl text-xs font-bold flex items-center justify-center transition-all"
                                      title="Edit layout blueprint"
                                    >
                                      <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteTemplate(tpl.id)}
                                      className="py-2.5 px-3 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold flex items-center justify-center transition-all"
                                      title="Delete template to Recycle bin"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    {isLocallyInstalled ? (
                                      <span className="flex-grow py-2.5 bg-emerald-50 border border-emerald-150 rounded-xl text-xs font-black text-emerald-800 flex items-center justify-center gap-1.5 shadow-2xs">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Active Structure
                                      </span>
                                    ) : hasRequested ? (
                                      <span className="flex-grow py-2.5 bg-amber-50 border border-amber-150 rounded-xl text-xs font-black text-amber-800 flex items-center justify-center gap-1.5 animate-pulse">
                                        <Clock className="w-4 h-4 text-amber-650" /> Pending Approval
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleRequestTemplate(tpl)}
                                        className="flex-grow py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95"
                                      >
                                        <Sparkles className="w-4 h-4 text-indigo-200 animate-pulse" /> Request Template
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {/* 2. REQUESTS INBOX TAB (SAAS ONLY) */}
              {activeTab === 'requests' && mode === 'saas' && (
                <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm space-y-4">
                  <h3 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-3 uppercase flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-500 animate-pulse" /> Pending School Assignments Inbox
                  </h3>

                  {requests.length === 0 ? (
                    <div className="text-center p-12 text-slate-400 text-xs font-bold leading-relaxed">
                      No institution requests are currently in the queue. Complete school onboarding or impersonations.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 font-extrabold border-b uppercase text-[9.5px]">
                            <th className="p-3">Requested Template</th>
                            <th className="p-3">School Name</th>
                            <th className="p-3">Request Date</th>
                            <th className="p-3">Status</th>
                            <th className="p-3 text-right">Approval Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y font-medium text-slate-700">
                          {requests.map((req, idx) => (
                            <tr key={`${req.id}-${idx}`} className="hover:bg-slate-50/50">
                              <td className="p-3 font-extrabold text-slate-900">{req.templateName}</td>
                              <td className="p-3">{req.schoolName}</td>
                              <td className="p-3 font-mono text-slate-400">{new Date(req.requestedAt).toLocaleDateString()}</td>
                              <td className="p-3">
                                {req.status === 'pending' ? (
                                  <span className="px-2 py-0.5 bg-amber-50 text-amber-850 border border-amber-200 rounded text-[10px] font-black uppercase animate-pulse">Pending Approval</span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-850 border border-emerald-200 rounded text-[10px] font-black uppercase">Assigned Successfully</span>
                                )}
                              </td>
                              <td className="p-3 text-right">
                                {req.status === 'pending' ? (
                                  <div className="flex items-center gap-1.5 justify-end">
                                    <button
                                      onClick={() => handleAssignTemplate(req)}
                                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-2xs"
                                    >
                                      <Check className="w-4 h-4" /> Assign Structure To School
                                    </button>
                                    <button
                                      onClick={async () => {
                                        if (confirm(`Dismiss request for "${req.templateName}" from ${req.schoolName}?`)) {
                                          await deleteTemplateRequestFromCloud(req.id);
                                          setRequests(prev => prev.filter(r => r.id !== req.id));
                                        }
                                      }}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                      title="Dismiss request"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 justify-end">
                                    <span className="text-[10px] font-black text-emerald-600">✓ Assigned record</span>
                                    <button
                                      onClick={async () => {
                                        if (confirm(`Remove assignment log for "${req.templateName}" from ${req.schoolName}?`)) {
                                          await deleteTemplateRequestFromCloud(req.id);
                                          setRequests(prev => prev.filter(r => r.id !== req.id));
                                        }
                                      }}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                      title="Remove record"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* 3. RECYCLE BIN TAB (SAAS ONLY) */}
              {activeTab === 'recycle' && mode === 'saas' && (
                <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm space-y-4">
                  <h3 className="text-sm font-black text-rose-900 border-b border-slate-100 pb-3 uppercase flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-rose-500 animate-bounce-slow" /> Secure Template Recycle Bin
                  </h3>

                  {recycleBin.length === 0 ? (
                    <div className="text-center p-12 text-slate-400 text-xs font-bold leading-relaxed">
                      Recycle Bin is empty. No deleted templates found in the database.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {recycleBin.map((item, idx) => (
                        <div key={`${item.id}-${idx}`} className="p-4 border border-rose-100 bg-rose-50/30 rounded-2xl flex flex-col space-y-3 justify-between">
                          <div className="space-y-1">
                            <span className="px-1.5 py-0.5 bg-rose-50 text-rose-600 border border-rose-200 rounded text-[9px] font-bold uppercase">
                              Deleted at: {new Date(item.deletedAt).toLocaleDateString()}
                            </span>
                            <h4 className="font-extrabold text-sm text-slate-800">{item.template.name}</h4>
                            <p className="text-[10.5px] text-slate-500">Scope: {(item.template?.assignedClasses || []).join(', ')}</p>
                          </div>

                          <div className="flex gap-2 pt-1 border-t border-rose-100/40">
                            <button
                              onClick={() => handleRestoreTemplate(item)}
                              className="px-3 py-1.5 bg-white border border-emerald-200 hover:bg-emerald-50 text-emerald-800 rounded-lg text-xs font-bold flex items-center gap-1.5"
                            >
                              <RefreshCw className="w-3.5 h-3.5" /> Restore to Active
                            </button>
                            <button
                              onClick={() => handlePermanentDelete(item.id)}
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs ml-auto"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Permanent Purge
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 4. MY ASSIGNED TEMPLATES (SCHOOL ADMIN ONLY) */}
              {activeTab === 'my_templates' && mode === 'school' && (
                <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm space-y-4">
                  <h3 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-3 uppercase flex items-center gap-2">
                    <Bookmark className="w-5 h-5 text-indigo-500" /> My Assigned / Installed Templates Gallery
                  </h3>

                  {myAssignedTemplates.length === 0 ? (
                    <div className="text-center p-12 text-slate-450 text-xs font-bold leading-relaxed space-y-2">
                      <p>No template formats have been assigned to your school yet.</p>
                      <button 
                        onClick={() => setActiveTab('gallery')} 
                        className="text-indigo-600 hover:underline font-extrabold uppercase text-[10.5px] tracking-wider"
                      >
                        Explore Active Gallery & Request Blueprints &rarr;
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {myAssignedTemplates.map((struct, idx) => (
                        <div key={`${struct.id}-${idx}`} className="p-4 border rounded-2xl bg-slate-50 border-slate-200 shadow-3xs flex flex-col justify-between">
                          <div className="space-y-1.5">
                            <h4 className="font-extrabold text-sm text-slate-850">{struct.name}</h4>
                            <p className="text-[11px] text-slate-500">Assigned scope: <strong>{(struct.assignedClasses || []).join(', ')}</strong></p>
                            <p className="text-[10px] text-emerald-600 font-extrabold uppercase mb-2">✓ Template Cloned and Sync Ready</p>

                            {/* Visual Listing of Subjects & Exams */}
                            <div className="space-y-2.5 p-3 bg-white rounded-xl border border-slate-200 text-[11px] mt-2 shadow-3xs">
                              <div>
                                <span className="text-slate-400 block font-extrabold text-[8.5px] uppercase tracking-wider mb-1">Subjects ({struct.subjects?.length || 0})</span>
                                {struct.subjects && struct.subjects.length > 0 ? (
                                  <div className="flex flex-wrap gap-1 max-h-[50px] overflow-y-auto no-scrollbar">
                                    {struct.subjects.map((sub, sIdx) => (
                                      <span key={`${sub.id}-${sIdx}`} className="px-1.5 py-0.5 bg-slate-50 border border-slate-100 rounded text-[9px] font-bold text-slate-600">
                                        {sub.name}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-[9px] italic">No subjects configured</span>
                                )}
                              </div>
                              <div className="border-t border-slate-100" />
                              <div>
                                <span className="text-slate-400 block font-extrabold text-[8.5px] uppercase tracking-wider mb-1">Assessments ({struct.scoreColumns?.length || 0})</span>
                                {struct.scoreColumns && struct.scoreColumns.length > 0 ? (
                                  <div className="flex flex-wrap gap-1 max-h-[50px] overflow-y-auto no-scrollbar">
                                    {struct.scoreColumns.map((col, cIdx) => (
                                      <span key={`${col.id}-${cIdx}`} className="px-1.5 py-0.5 bg-indigo-50/50 text-indigo-700 border border-indigo-100 rounded text-[9px] font-bold">
                                        {col.name} ({col.maxMarks}M)
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-[9px] italic">No assessments configured</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2 pt-3 border-t mt-4">
                            <button
                              onClick={() => {
                                // Wrap ReportCardStructure in Partial<ReportCardTemplate> to view preview
                                const tplWrapper = {
                                  ...struct,
                                  demoStudentName: defaultDemoStudent.name,
                                  demoRollNo: defaultDemoStudent.rollNo,
                                  demoClassName: (struct.assignedClasses || [])[0] || defaultDemoStudent.className
                                } as ReportCardTemplate;
                                setPreviewTemplate(tplWrapper);
                              }}
                              className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 w-full justify-center transition-all active:scale-95"
                            >
                              <Eye className="w-4 h-4 text-slate-500" /> Preview Template Layout
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ----------------- SECURITY DELETION CONFIRMATION MODAL ----------------- */}
      {deletingTemplateId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-xl shadow-inner animate-pulse">
              ⚠️
            </div>

            <div className="space-y-1.5">
              <h3 className="font-extrabold text-sm text-slate-850">Confirm Deletion of Gallery Blueprint</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                This template will be moved to the Platform Recycle Bin and hidden from the school administrators' view. 
                Existing installations at school sites are fully protected and will not be impacted.
              </p>
            </div>

            <div className="space-y-1 bg-rose-50 p-3 rounded-xl border border-rose-150">
              <span className="text-[10px] uppercase font-bold text-rose-800 block">Security Verification Code</span>
              <p className="text-[11px] text-rose-950 font-medium">To authorize this deletion, please type <strong className="font-mono bg-white px-1.5 py-0.5 rounded border">CONFIR</strong> below.</p>
              
              <input
                type="text"
                placeholder="Type CONFIR..."
                value={confirmDeleteText}
                onChange={(e) => setConfirmDeleteText(e.target.value)}
                className="w-full mt-2 px-3 py-1.5 text-xs font-bold font-mono border border-rose-250 bg-white rounded-lg focus:outline-none focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="flex gap-2 pt-2 justify-end">
              <button
                onClick={() => setDeletingTemplateId(null)}
                className="px-4 py-2 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteTemplate}
                disabled={confirmDeleteText.trim().toUpperCase() !== 'CONFIR' && confirmDeleteText.trim().toUpperCase() !== 'CONFIRM'}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white text-xs font-bold rounded-xl shadow-xs transition-all active:scale-95"
              >
                Delete to Recycle Bin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- ASSIGN TEMPLATE TO SCHOOL MODAL (SaaS Mode) ----------------- */}
      {assigningTemplate && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-5 border border-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-150 flex items-center justify-center shrink-0">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Direct School Assignment
                  </span>
                  <h3 className="font-black text-base text-slate-900 mt-1">
                    Assign "{assigningTemplate.name}"
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAssigningTemplate(null);
                  setAssignSuccessMsg(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {assignSuccessMsg ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs font-bold animate-fadeIn">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <p>{assignSuccessMsg}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* School Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Select Target School <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={targetSchoolId}
                    onChange={(e) => setTargetSchoolId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:outline-none transition-colors"
                  >
                    {schoolsList.length === 0 && (
                      <option value="">Loading registered schools...</option>
                    )}
                    {schoolsList.map((sc) => (
                      <option key={sc.id} value={sc.id}>
                        {sc.name} ({sc.portalCode || sc.id}) {sc.contactPerson ? `- ${sc.contactPerson}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10.5px] text-slate-400 mt-1">
                    The template will be cloned into this school's report card layouts database with their logo & contact information.
                  </p>
                </div>

                {/* Assigned Classes */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-700">
                      Applicable Classes for this Template
                    </label>
                    {(() => {
                      const targetSchool = schoolsList.find(s => s.id === targetSchoolId);
                      if (targetSchool?.classNamingStyle) {
                        return (
                          <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-150">
                            Style: {targetSchool.classNamingStyle}
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  {/* Interactive Class & Section Badges */}
                  {(() => {
                    const cleanTargetId = normalizeCloudSchoolId(targetSchoolId);
                    const targetSchool = schoolsList.find(s => s.id === targetSchoolId || normalizeCloudSchoolId(s.id) === cleanTargetId);
                    
                    const isConfiguredBySchool = targetSchoolClasses.length > 0 || (targetSchool?.classes && targetSchool.classes.length > 0);
                    const classesListToDisplay: SchoolClassItem[] = targetSchoolClasses.length > 0
                      ? targetSchoolClasses
                      : (targetSchool?.classes && targetSchool.classes.length > 0)
                        ? targetSchool.classes
                        : getStandardClassPresets((targetSchool?.classNamingStyle as any) || 'roman');

                    const currentSelected = targetClassesText
                      .split(',')
                      .map(c => c.trim())
                      .filter(Boolean);

                    const toggleClassAll = (clsName: string) => {
                      const isAllSelected = currentSelected.some(c => {
                        const parsed = parseClassAndSection(c);
                        return !parsed.section && classesMatch(parsed.className, clsName);
                      });
                      let updated: string[];
                      if (isAllSelected) {
                        updated = currentSelected.filter(c => {
                          const parsed = parseClassAndSection(c);
                          return !classesMatch(parsed.className, clsName);
                        });
                      } else {
                        const filtered = currentSelected.filter(c => {
                          const parsed = parseClassAndSection(c);
                          return !classesMatch(parsed.className, clsName);
                        });
                        updated = [...filtered, clsName];
                      }
                      setTargetClassesText(updated.join(', '));
                    };

                    const toggleClassSection = (clsName: string, sec: string) => {
                      const targetTag = formatClassSectionTarget(clsName, sec);
                      const isSecSelected = currentSelected.some(c => {
                        const parsed = parseClassAndSection(c);
                        return parsed.section === sec.toUpperCase() && classesMatch(parsed.className, clsName);
                      });

                      let updated: string[];
                      if (isSecSelected) {
                        updated = currentSelected.filter(c => {
                          const parsed = parseClassAndSection(c);
                          return !(parsed.section === sec.toUpperCase() && classesMatch(parsed.className, clsName));
                        });
                      } else {
                        const filtered = currentSelected.filter(c => {
                          const parsed = parseClassAndSection(c);
                          return !(!parsed.section && classesMatch(parsed.className, clsName));
                        });
                        updated = [...filtered, targetTag];
                      }
                      setTargetClassesText(updated.join(', '));
                    };

                    const handleAddCustomSection = (clsName: string) => {
                      const rawSec = newSecInput.trim().toUpperCase();
                      if (!rawSec) {
                        setActiveAddSecClass(null);
                        return;
                      }

                      let updatedList = (targetSchoolClasses.length > 0 ? targetSchoolClasses : classesListToDisplay).map(c => {
                        if (classesMatch(c.name, clsName)) {
                          const existing = new Set((c.sections || []).map(s => s.toUpperCase().trim()));
                          existing.add(rawSec);
                          return { ...c, sections: Array.from(existing) };
                        }
                        return c;
                      });

                      // If class was not yet in targetSchoolClasses
                      if (!updatedList.some(c => classesMatch(c.name, clsName))) {
                        const presetMatch = getStandardClassPresets('roman').find(c => classesMatch(c.name, clsName));
                        const baseSecs = presetMatch ? [...presetMatch.sections] : ['A', 'B'];
                        if (!baseSecs.includes(rawSec)) baseSecs.push(rawSec);
                        updatedList.push({
                          id: `cls_${Date.now()}`,
                          name: clsName,
                          sections: baseSecs
                        });
                      }

                      setTargetSchoolClasses(updatedList);
                      if (targetSchoolId) {
                        const cleanId = normalizeCloudSchoolId(targetSchoolId);
                        try {
                          localStorage.setItem(`class_on_classes_${cleanId}`, JSON.stringify(updatedList));
                        } catch {}
                        saveSchoolToCloud(targetSchoolId, { classes: updatedList } as any, targetSchool?.name || '').catch(err => {
                          console.warn("Background school classes save deferred:", err);
                        });
                      }

                      // Automatically select this section
                      toggleClassSection(clsName, rawSec);
                      setNewSecInput('');
                      setActiveAddSecClass(null);
                    };

                    const handleAddNewClassToTargetSchool = () => {
                      const clsName = newClassNameInput.trim();
                      if (!clsName) return;
                      const secs = newClassSecInput
                        .split(',')
                        .map(s => s.trim().toUpperCase())
                        .filter(Boolean);
                      const newClassItem: SchoolClassItem = {
                        id: `cls_custom_${Date.now()}`,
                        name: clsName,
                        sections: secs.length > 0 ? secs : ['A', 'B'],
                        orderIndex: (targetSchoolClasses.length > 0 ? targetSchoolClasses.length : classesListToDisplay.length) + 1
                      };
                      const baseList = targetSchoolClasses.length > 0 ? targetSchoolClasses : classesListToDisplay;
                      const updated = [...baseList, newClassItem];
                      setTargetSchoolClasses(updated);
                      setIsAddingNewClass(false);
                      setNewClassNameInput('');
                      setNewClassSecInput('A, B');

                      if (targetSchoolId) {
                        const cleanId = normalizeCloudSchoolId(targetSchoolId);
                        try {
                          localStorage.setItem(`class_on_classes_${cleanId}`, JSON.stringify(updated));
                        } catch {}
                        saveSchoolToCloud(targetSchoolId, { classes: updated } as any, targetSchool?.name || '').catch(err => {
                          console.warn("Background school classes save deferred:", err);
                        });
                      }
                      // Automatically toggle all for the new class
                      toggleClassAll(clsName);
                    };

                    const selectAll = () => {
                      setTargetClassesText(classesListToDisplay.map(c => c.name).join(', '));
                    };

                    const clearAll = () => {
                      setTargetClassesText('');
                    };

                    return (
                      <div className="mb-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5 font-bold text-slate-800">
                            {isConfiguredBySchool ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                                <span>{targetSchool?.name || "School"}'s Classes & Sections ({classesListToDisplay.length})</span>
                                <span className="text-[9.5px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-semibold">Active Profile</span>
                              </>
                            ) : (
                              <>
                                <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                                <span>Standard Class Presets (Click to toggle):</span>
                              </>
                            )}
                            {isLoadingTargetClasses && (
                              <RefreshCw className="w-3 h-3 animate-spin text-slate-400 ml-1" />
                            )}
                          </div>
                          <div className="flex gap-2 text-[10px] font-bold">
                            <button type="button" onClick={selectAll} className="text-indigo-600 hover:underline cursor-pointer">Select All</button>
                            <span className="text-slate-300">|</span>
                            <button type="button" onClick={clearAll} className="text-slate-500 hover:underline cursor-pointer">Clear</button>
                          </div>
                        </div>

                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {classesListToDisplay.map(clsItem => {
                            const clsName = clsItem.name;
                            
                            // Reconcile all sections: from school configuration + any mentioned in targetClassesText
                            const sectionSet = new Set<string>(
                              (clsItem.sections && clsItem.sections.length > 0 ? clsItem.sections : ['A', 'B']).map(s => s.toUpperCase().trim())
                            );
                            currentSelected.forEach(c => {
                              const parsed = parseClassAndSection(c);
                              if (parsed.section && classesMatch(parsed.className, clsName)) {
                                sectionSet.add(parsed.section.toUpperCase().trim());
                              }
                            });
                            const allSections = Array.from(sectionSet);

                            const isAllSelected = currentSelected.some(c => {
                              const parsed = parseClassAndSection(c);
                              return !parsed.section && classesMatch(parsed.className, clsName);
                            });

                            return (
                              <div key={clsItem.id || clsName} className="p-2 bg-white rounded-lg border border-slate-200/80 flex flex-wrap items-center justify-between gap-1.5 shadow-2xs">
                                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                                  {clsName}
                                </span>

                                <div className="flex flex-wrap items-center gap-1">
                                  {/* All Sections Button */}
                                  <button
                                    type="button"
                                    onClick={() => toggleClassAll(clsName)}
                                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                      isAllSelected
                                        ? 'bg-indigo-600 text-white shadow-2xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                    title={`Assign to all sections of ${clsName}`}
                                  >
                                    {isAllSelected ? '✓ All Sections' : 'All Sections'}
                                  </button>

                                  {/* Individual Section Buttons */}
                                  {allSections.map(sec => {
                                    const isSecSelected = currentSelected.some(c => {
                                      const parsed = parseClassAndSection(c);
                                      return parsed.section === sec.toUpperCase() && classesMatch(parsed.className, clsName);
                                    });

                                    return (
                                      <button
                                        key={sec}
                                        type="button"
                                        onClick={() => toggleClassSection(clsName, sec)}
                                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                                          isSecSelected
                                            ? 'bg-purple-600 text-white shadow-2xs'
                                            : 'bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100'
                                        }`}
                                        title={`Assign exclusively to ${clsName} Section ${sec}`}
                                      >
                                        {isSecSelected ? `✓ Sec ${sec}` : `+ Sec ${sec}`}
                                      </button>
                                    );
                                  })}

                                  {/* Inline Add Section for this class */}
                                  {activeAddSecClass === clsName ? (
                                    <div className="flex items-center gap-1 bg-purple-50 p-0.5 rounded-md border border-purple-200">
                                      <input
                                        type="text"
                                        placeholder="Sec"
                                        value={newSecInput}
                                        onChange={(e) => setNewSecInput(e.target.value.toUpperCase())}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddCustomSection(clsName);
                                          } else if (e.key === 'Escape') {
                                            setActiveAddSecClass(null);
                                          }
                                        }}
                                        className="w-10 px-1 py-0.5 text-[10.5px] font-bold uppercase border border-purple-300 rounded bg-white text-center focus:outline-none focus:ring-1 focus:ring-purple-500"
                                        autoFocus
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleAddCustomSection(clsName)}
                                        disabled={!newSecInput.trim()}
                                        className="px-1.5 py-0.5 bg-purple-600 text-white text-[10px] font-bold rounded hover:bg-purple-700 disabled:opacity-50 cursor-pointer"
                                      >
                                        Add
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setActiveAddSecClass(null)}
                                        className="p-0.5 text-slate-400 hover:text-slate-600"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveAddSecClass(clsName);
                                        setNewSecInput('');
                                      }}
                                      className="px-1.5 py-0.5 rounded-md text-[10.5px] font-bold border border-dashed border-slate-300 text-slate-500 hover:text-purple-600 hover:border-purple-300 hover:bg-purple-50/50 transition-colors cursor-pointer flex items-center gap-0.5"
                                      title={`Add another section (e.g. C, D) to ${clsName}`}
                                    >
                                      <Plus className="w-2.5 h-2.5" /> Sec
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                          {/* Quick Add Class to School Registry */}
                          {isAddingNewClass ? (
                            <div className="p-2 bg-indigo-50/60 border border-indigo-200 rounded-lg flex flex-wrap items-center gap-1.5 text-xs">
                              <input
                                type="text"
                                placeholder="Class Name (e.g. Class 11)"
                                value={newClassNameInput}
                                onChange={(e) => setNewClassNameInput(e.target.value)}
                                className="flex-1 min-w-[130px] px-2 py-1 text-xs font-bold border border-indigo-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                autoFocus
                              />
                              <input
                                type="text"
                                placeholder="Sections (e.g. A, B, C)"
                                value={newClassSecInput}
                                onChange={(e) => setNewClassSecInput(e.target.value)}
                                className="w-28 px-2 py-1 text-xs font-bold border border-indigo-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                              />
                              <button
                                type="button"
                                onClick={handleAddNewClassToTargetSchool}
                                disabled={!newClassNameInput.trim()}
                                className="px-2.5 py-1 bg-indigo-600 text-white text-xs font-bold rounded-md hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                              >
                                Add Class
                              </button>
                              <button
                                type="button"
                                onClick={() => setIsAddingNewClass(false)}
                                className="p-1 text-slate-400 hover:text-slate-600"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setIsAddingNewClass(true);
                                setNewClassNameInput('');
                                setNewClassSecInput('A, B');
                              }}
                              className="w-full py-1.5 text-center text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-white hover:bg-indigo-50/60 border border-dashed border-indigo-200 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> Add New Class to School
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  <input
                    type="text"
                    value={targetClassesText}
                    onChange={(e) => setTargetClassesText(e.target.value)}
                    placeholder="e.g., Nursery, 1st Grade, 2nd Grade..."
                    className="w-full px-3.5 py-2.5 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none"
                  />
                  <p className="text-[10.5px] text-slate-400 mt-1">
                    Comma-separated class names that should use this report card layout.
                  </p>
                </div>

                <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-2xl text-[11px] text-indigo-900 leading-relaxed">
                  <div className="font-bold flex items-center gap-1.5 text-indigo-700 mb-0.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Instant Database Synchronization
                  </div>
                  Once assigned, the school administrator and teachers will immediately see this format in their Report Card Structures, Marks Entry, and Print engine without needing page reloads.
                </div>

                <div className="flex gap-2.5 pt-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setAssigningTemplate(null)}
                    disabled={isAssigning}
                    className="px-4 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAssignToSchool}
                    disabled={isAssigning || !targetSchoolId}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-black rounded-xl shadow-xs flex items-center gap-2 transition-all active:scale-95"
                  >
                    {isAssigning ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Pushing to School...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Confirm & Assign Template</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
