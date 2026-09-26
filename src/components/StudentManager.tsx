import React, { useState, useRef } from 'react';
import { Student, StudentGrades, SubjectColumn, ScoreColumn, SchoolBranding, RecycleBinItem, GradeScale, SchoolClassItem } from '../types';
import { 
  Users, Search, Upload, Plus, Edit, Trash2, FileSpreadsheet, 
  Download, CheckCircle, ChevronRight, X, AlertCircle, Sparkles, PlusCircle, RefreshCw, Link2, Info, Check,
  Camera, Image, TableProperties, TrendingUp, Lock, Bot
} from 'lucide-react';
import { 
  classesMatch, 
  normalizeClassName, 
  getSectionsForClass, 
  getCanonicalClassName, 
  matchStructureForStudent,
  getStandardClassPresets,
  parseClassAndSection,
  isStudentFieldActive
} from '../utils/classNormalizer';
import AiRemarksModal from './AiRemarksModal';
import ClassSectionManagerModal from './ClassSectionManagerModal';
import { 
  formatFatherName, 
  formatMotherName, 
  formatHeight, 
  formatWeight, 
  formatStudentForDisplay 
} from '../lib/studentFormatters';
import { 
  deleteIndividualStudentFromCloud, 
  saveIndividualStudentToCloud, 
  saveIndividualGradesToCloud,
  saveStudentsBatchToCloud 
} from '../lib/firebaseSync';

export interface StagedCSVChange {
  id: string;
  type: 'insert' | 'update';
  studentName: string;
  admissionNo: string;
  className: string;
  section: string;
  rollNo: string;
  studentData: Student;
  gradesData: StudentGrades;
  profileChanges: { field: string; old: string; new: string }[];
  gradeChanges: { subject: string; scoreType: string; old: string; new: string }[];
}

export function compressAndResizeStudentPhoto(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const targetWidth = 150;
        const targetHeight = 180;
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const aspect = img.width / img.height;
          const targetAspect = targetWidth / targetHeight;
          let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;
          
          if (aspect > targetAspect) {
            sWidth = img.height * targetAspect;
            sx = (img.width - sWidth) / 2;
          } else {
            sHeight = img.width / targetAspect;
            sy = (img.height - sHeight) / 2;
          }
          
          ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } else {
          reject(new Error("Canvas context is null"));
        }
      };
      img.onerror = () => reject(new Error("Image failed loading"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("FileReader error"));
    reader.readAsDataURL(file);
  });
}

interface StudentManagerProps {
  students: Student[];
  studentGrades: StudentGrades[];
  subjects: SubjectColumn[];
  scoreColumns: ScoreColumn[];
  gradeScales?: GradeScale[];
  branding: SchoolBranding;
  onUpdateStudents: (updated: Student[]) => void;
  onUpdateGrades: (updated: StudentGrades[]) => void;
  onSelectStudent: (id: string | null) => void;
  selectedStudentId: string | null;
  currentRole?: string | null;
  activeTeacherObj?: any | null;
  reportCardStructures?: any[];
  maxStudentsLimit?: number;
  cumulativeStudentsCount?: number;
  maxCumulativeStudentsLimit?: number;
  onIncrementCumulativeCount?: (incrementBy: number) => void;
  recycleBin: RecycleBinItem[];
  onUpdateRecycleBin: (updated: RecycleBinItem[]) => void;
  isReadOnly?: boolean;
  selectedSession?: string;
  onUpdateBranding?: (updated: SchoolBranding) => void;
  onRestoreSession?: (session: string) => void;
  currentSchoolId?: string | null;
  schoolClasses?: SchoolClassItem[];
  classNamingStyle?: 'roman' | 'ordinal' | 'number' | 'custom';
  onUpdateSchoolClasses?: (classes: SchoolClassItem[], style?: any) => void;
}

export default function StudentManager({
  students,
  studentGrades,
  subjects,
  scoreColumns,
  gradeScales = [],
  branding,
  onUpdateStudents,
  onUpdateGrades,
  onSelectStudent,
  selectedStudentId,
  currentRole,
  activeTeacherObj,
  reportCardStructures = [],
  maxStudentsLimit,
  cumulativeStudentsCount = 0,
  maxCumulativeStudentsLimit,
  onIncrementCumulativeCount,
  recycleBin,
  onUpdateRecycleBin,
  isReadOnly = false,
  selectedSession = "",
  onUpdateBranding,
  onRestoreSession,
  currentSchoolId,
  schoolClasses = [],
  classNamingStyle = 'roman',
  onUpdateSchoolClasses
}: StudentManagerProps) {
  const [isClassSectionModalOpen, setIsClassSectionModalOpen] = useState(false);
  const [filterClass, setFilterClass] = useState('all');
  const [filterSection, setFilterSection] = useState('all');
  const [filterQuery, setFilterQuery] = useState('');
  const [studentPage, setStudentPage] = useState(1);
  const [studentPageSize, setStudentPageSize] = useState(25);

  // Reset page when search/filter options change
  React.useEffect(() => {
    setStudentPage(1);
  }, [filterClass, filterSection, filterQuery]);

  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'scholastic' | 'co_scholastic'>('profile');
  const [isImportExpanded, setIsImportExpanded] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isSavingStudent, setIsSavingStudent] = useState(false);
  const [isExportPanelOpen, setIsExportPanelOpen] = useState(false);

  // Google Sheets integration state
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Layout specific template state variables
  const [selectedStructureId, setSelectedStructureId] = useState<string>('default');
  const [selectedTemplateClass, setSelectedTemplateClass] = useState<string>('all');
  const [selectedTemplateSection, setSelectedTemplateSection] = useState<string>('all');

  // Synchronize class teacher restrictions
  React.useEffect(() => {
    if (currentRole === 'class_teacher' && activeTeacherObj) {
      const teacherClass = activeTeacherObj.classTeacherClass || activeTeacherObj.assignedClass || '';
      const teacherSec = activeTeacherObj.classTeacherSection || activeTeacherObj.assignedSection || 'All';
      
      setSelectedTemplateClass(teacherClass);
      setSelectedTemplateSection(teacherSec);
      
      if (reportCardStructures && reportCardStructures.length > 0 && teacherClass) {
        const matched = reportCardStructures.find(struct => 
          struct.assignedClasses.some((c: string) => classesMatch(c, teacherClass))
        );
        if (matched) {
          setSelectedStructureId(matched.id);
        } else {
          setSelectedStructureId('default');
        }
      }
    }
  }, [currentRole, activeTeacherObj, reportCardStructures]);
  
  // Current student being added/edited
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editingGrades, setEditingGrades] = useState<StudentGrades | null>(null);

  // AI Remarks Assistant State
  const [isAiRemarksModalOpen, setIsAiRemarksModalOpen] = useState(false);
  const [aiRemarksModalMode, setAiRemarksModalMode] = useState<'single' | 'bulk'>('single');
  const [aiRemarksTargetStudent, setAiRemarksTargetStudent] = useState<Student | null>(null);

  const handleApplySingleRemark = (remark: string, promotionStatus?: string) => {
    if (editingStudent) {
      setEditingStudent({
        ...editingStudent,
        remarks: remark,
        ...(promotionStatus ? { promotionStatus } : {})
      });
    }

    if (aiRemarksTargetStudent) {
      const targetId = aiRemarksTargetStudent.id;
      setFastEntryRows(prev => prev.map(r => {
        if (r.id === targetId) {
          return {
            ...r,
            remarks: remark,
            ...(promotionStatus ? { promotionStatus } : {})
          };
        }
        return r;
      }));

      const updated = students.map(s => {
        if (s.id === targetId) {
          return {
            ...s,
            remarks: remark,
            ...(promotionStatus ? { promotionStatus } : {})
          };
        }
        return s;
      });
      onUpdateStudents(updated);
    }
  };

  const handleApplyBulkRemarks = (updates: { studentId: string; remarks: string; promotionStatus?: string }[]) => {
    const updateMap = new Map<string, { remarks: string; promotionStatus?: string }>();
    updates.forEach(u => updateMap.set(u.studentId, u));

    setFastEntryRows(prev => prev.map(r => {
      const u = updateMap.get(r.id);
      if (u) {
        return {
          ...r,
          remarks: u.remarks,
          ...(u.promotionStatus ? { promotionStatus: u.promotionStatus } : {})
        };
      }
      return r;
    }));

    const updated = students.map(s => {
      const u = updateMap.get(s.id);
      if (u) {
        return {
          ...s,
          remarks: u.remarks,
          ...(u.promotionStatus ? { promotionStatus: u.promotionStatus } : {})
        };
      }
      return s;
    });

    onUpdateStudents(updated);
  };

  const editingStudentStruct = React.useMemo(() => {
    if (!editingStudent || !reportCardStructures) return null;
    return matchStructureForStudent(reportCardStructures, editingStudent.className, editingStudent.section);
  }, [editingStudent, reportCardStructures]);

  const isEditingPureGradeBased = React.useMemo(() => {
    return !!editingStudentStruct?.pureGradeBased;
  }, [editingStudentStruct]);

  const resolvedBranding = React.useMemo(() => {
    return editingStudentStruct?.branding || branding;
  }, [editingStudentStruct, branding]);

  /**
   * Checks if a student profile field (e.g. 'admissionNo', 'dob') is active in the report card layout.
   * If targetClass is provided, checks that class's matched structure or falls back to global branding.
   * If targetClass is 'all' or omitted, checks if the field is active globally or in any class structure.
   */
  const isFieldActiveInLayout = React.useCallback((
    fieldId: string, 
    targetClass?: string, 
    targetSection?: string
  ): boolean => {
    return isStudentFieldActive(fieldId, targetClass, targetSection, reportCardStructures, branding);
  }, [reportCardStructures, branding]);

  const editingStudentSubjects = React.useMemo(() => {
    return editingStudentStruct?.subjects && editingStudentStruct.subjects.length > 0
      ? editingStudentStruct.subjects
      : subjects;
  }, [editingStudentStruct, subjects]);

  // Classwise Student breakdown expanded state
  const [isClasswiseBreakdownExpanded, setIsClasswiseBreakdownExpanded] = useState(false);

  // Classwise Student Roster breakdown
  const classwiseBreakdown = React.useMemo(() => {
    const rawBreakdown: { [key: string]: { className: string; section: string; count: number } } = {};
    students.forEach(s => {
      const cls = s.className || "Unassigned";
      const sec = s.section || "A";
      const key = `${cls}-${sec}`;
      if (!rawBreakdown[key]) {
        rawBreakdown[key] = { className: cls, section: sec, count: 0 };
      }
      rawBreakdown[key].count++;
    });

    const list = Object.values(rawBreakdown).sort((a, b) => {
      const clsComp = a.className.localeCompare(b.className, undefined, { numeric: true });
      if (clsComp !== 0) return clsComp;
      return a.section.localeCompare(b.section);
    });

    if (currentRole === 'class_teacher' && activeTeacherObj) {
      const teacherClass = activeTeacherObj.classTeacherClass || activeTeacherObj.assignedClass || '';
      const teacherSection = activeTeacherObj.classTeacherSection || activeTeacherObj.assignedSection || '';
      return list.filter(item => 
        item.className.toLowerCase().trim() === teacherClass.toLowerCase().trim() &&
        (teacherSection === 'All' || item.section.toLowerCase().trim() === teacherSection.toLowerCase().trim())
      );
    }

    return list;
  }, [students, currentRole, activeTeacherObj]);

  // Student Fast List Entry States
  const [isFastEntryOpen, setIsFastEntryOpen] = useState(false);
  const [fastEntryClass, setFastEntryClass] = useState<string>(() => {
    if (schoolClasses && schoolClasses.length > 0) {
      return schoolClasses[0].name;
    }
    if (students && students.length > 0) {
      return getCanonicalClassName(students[0].className, schoolClasses) || students[0].className || 'Class I';
    }
    return 'Class I';
  });
  const [fastEntrySection, setFastEntrySection] = useState<string>(() => {
    if (students && students.length > 0) {
      return students[0].section || 'A';
    }
    return 'A';
  });
  const [fastEntryRows, setFastEntryRows] = useState<any[]>([]);
  const [fastEntryError, setFastEntryError] = useState<string | null>(null);
  const [fastEntryMode, setFastEntryMode] = useState<'edit' | 'fresh'>('fresh');

  const [isAddingCustomClass, setIsAddingCustomClass] = useState(false);
  const [newCustomClassVal, setNewCustomClassVal] = useState('');
  const [isAddingCustomSection, setIsAddingCustomSection] = useState(false);
  const [newCustomSectionVal, setNewCustomSectionVal] = useState('');

  // Dynamic sync of classes across configured schoolClasses
  const allSyncedClasses = React.useMemo(() => {
    if (schoolClasses && schoolClasses.length > 0) {
      return schoolClasses.map(c => c.name);
    }
    return getStandardClassPresets((classNamingStyle === 'custom' ? 'roman' : classNamingStyle) || 'roman').map(c => c.name);
  }, [schoolClasses, classNamingStyle]);

  // Only the selected class's configured sections are visible when making students entry
  const allSyncedSections = React.useMemo(() => {
    const configuredSecs = getSectionsForClass(fastEntryClass, schoolClasses, students, reportCardStructures);
    if (configuredSecs && configuredSecs.length > 0) {
      return configuredSecs.map(s => s.trim());
    }
    return ['A', 'B'];
  }, [schoolClasses, fastEntryClass, students, reportCardStructures]);

  const handleConfirmCustomClass = () => {
    const val = newCustomClassVal.trim();
    if (!val) {
      setIsAddingCustomClass(false);
      return;
    }
    if (onUpdateSchoolClasses) {
      const exists = (schoolClasses || []).some(c => classesMatch(c.name, val));
      if (!exists) {
        const newClassItem: SchoolClassItem = {
          id: `class_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: val,
          sections: ['A'],
          orderIndex: (schoolClasses?.length || 0) + 1
        };
        onUpdateSchoolClasses([...(schoolClasses || []), newClassItem], classNamingStyle);
      }
    }
    setFastEntryClass(val);
    setNewCustomClassVal('');
    setIsAddingCustomClass(false);
    loadFastEntryRows(val, fastEntrySection, fastEntryMode);
  };

  const handleConfirmCustomSection = () => {
    const val = newCustomSectionVal.trim().toUpperCase();
    if (!val) {
      setIsAddingCustomSection(false);
      return;
    }
    if (onUpdateSchoolClasses && schoolClasses && schoolClasses.length > 0) {
      const updated = schoolClasses.map(c => {
        if (classesMatch(c.name, fastEntryClass)) {
          const currentSecs = c.sections || [];
          if (!currentSecs.includes(val)) {
            return { ...c, sections: [...currentSecs, val].sort() };
          }
        }
        return c;
      });
      onUpdateSchoolClasses(updated, classNamingStyle);
    }
    setFastEntrySection(val);
    setNewCustomSectionVal('');
    setIsAddingCustomSection(false);
    loadFastEntryRows(fastEntryClass, val, fastEntryMode);
  };

  // Keep fast entry selections in sync with active dataset
  React.useEffect(() => {
    if (allSyncedClasses && allSyncedClasses.length > 0) {
      if (!fastEntryClass || !allSyncedClasses.includes(fastEntryClass)) {
        setFastEntryClass(allSyncedClasses[0]);
      }
      if (!fastEntrySection || !allSyncedSections.includes(fastEntrySection)) {
        setFastEntrySection(allSyncedSections[0] || 'A');
      }
    }
  }, [allSyncedClasses, allSyncedSections, fastEntryClass, fastEntrySection]);

  React.useEffect(() => {
    if (filterClass !== 'all') {
      setFastEntryClass(getCanonicalClassName(filterClass, schoolClasses) || filterClass);
    }
    if (filterSection !== 'all') {
      setFastEntrySection(filterSection);
    }
  }, [filterClass, filterSection, schoolClasses]);

  // Load/sync fast entry rows with custom mode and override option to prevent stale react state closure
  const loadFastEntryRows = (cls: string, sec: string, modeOverride?: 'edit' | 'fresh', studentsListOverride?: Student[]) => {
    const activeMode = modeOverride || fastEntryMode;
    const listToUse = studentsListOverride || students;

    const existing = activeMode === 'edit'
      ? listToUse.filter(s => 
          classesMatch(s.className, cls) && 
          s.section.trim().toLowerCase() === sec.trim().toLowerCase()
        )
      : [];
    
    // Map existing students to editable cells
    const rows: any[] = existing.map(s => {
      const gradesVal = studentGrades.find(g => g.studentId === s.id);
      return {
        id: s.id,
        rollNo: s.rollNo || '',
        admissionNo: s.admissionNo || '',
        name: s.name || '',
        fatherName: s.fatherName || '',
        motherName: s.motherName || '',
        dob: s.dob || '',
        mobileNumber: s.mobileNumber || '',
        height: s.height || '',
        weight: s.weight || '',
        photoUrl: s.photoUrl || '',
        remarks: s.remarks || '',
        promotionStatus: s.promotionStatus || '',
        attendance: gradesVal?.attendance || { term1: '', term2: '' },
        ...s
      };
    });

    // Append blank row placeholders for immediate fast typing
    const blankRowsCount = activeMode === 'fresh' ? 10 : 3;
    for (let i = 0; i < blankRowsCount; i++) {
      rows.push({
        id: `new-draft-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 5)}`,
        isDraft: true,
        rollNo: '',
        admissionNo: '',
        name: '',
        fatherName: '',
        motherName: '',
        dob: '',
        mobileNumber: '',
        height: '',
        weight: '',
        photoUrl: '',
        remarks: '',
        promotionStatus: '',
        attendance: { term1: '', term2: '' }
      });
    }

    setFastEntryRows(rows);
  };

  const handleCellChange = (rowId: string, field: string, value: string) => {
    setFastEntryRows(prev => prev.map(row => {
      if (row.id === rowId) {
        return { ...row, [field]: value };
      }
      return row;
    }));
  };

  const handleSaveFastGrid = () => {
    // Filter out completely empty draft rows
    const activeRows = fastEntryRows.filter(r => {
      if (!r.isDraft) return true;
      return (r.name && r.name.trim() !== '') || (r.admissionNo && r.admissionNo.trim() !== '');
    });

    const missingName = activeRows.some(r => !r.name || r.name.trim() === '');
    if (missingName) {
      setFastEntryError("Every active student row in the grid must have a valid Student Name.");
      return;
    }

    // Determine layout structure and active student fields first
    const structForClass = matchStructureForStudent(reportCardStructures, fastEntryClass, fastEntrySection);
    const resolvedBrandingForGrid = structForClass?.branding || branding;
    const studentFieldsList = resolvedBrandingForGrid?.studentFields || [
      { id: "rollNo", label: "Roll No" },
      { id: "admissionNo", label: "Admission No" },
      { id: "name", label: "Student Name" },
      { id: "fatherName", label: "Father Name" },
      { id: "motherName", label: "Mother Name" },
      { id: "className", label: "Class" },
      { id: "section", label: "Section" },
      { id: "dob", label: "DOB" },
      { id: "height", label: "Height" },
      { id: "weight", label: "Weight" }
    ];

    const activeStudentFields = studentFieldsList.filter(f => {
      if (f.id === 'className' || f.id === 'section') return false;
      return isStudentFieldActive(f.id, fastEntryClass, fastEntrySection, reportCardStructures, branding);
    });

    const isAdmissionNoRequired = activeStudentFields.some(f => f.id === 'admissionNo');
    const isRollNoRequired = activeStudentFields.some(f => f.id === 'rollNo');

    // Validate roll numbers and admission numbers: each active row must have unique roll numbers and admission numbers
    const rollNoSet = new Set<string>();
    const rollToNameMap = new Map<string, string>();
    const admissionNoSet = new Set<string>();
    const admissionToNameMap = new Map<string, string>();
    
    for (const r of activeRows) {
      const rName = r.name?.trim() || 'Unnamed Student';
      const rRoll = (r.rollNo || '').trim().toLowerCase();
      const rAdmission = (r.admissionNo || '').trim().toLowerCase();
      
      if (isRollNoRequired && !rRoll) {
        setFastEntryError(`Roll Number is required for student "${rName}".`);
        return;
      }
      
      if (isAdmissionNoRequired && !rAdmission) {
        setFastEntryError(`Admission Number is required for student "${rName}".`);
        return;
      }
      
      if (rRoll) {
        if (rollNoSet.has(rRoll)) {
          const otherName = rollToNameMap.get(rRoll);
          setFastEntryError(`Duplicate Roll Number "${r.rollNo.trim()}" found. Both "${otherName}" and "${rName}" are assigned Roll Number "${r.rollNo.trim()}" in Class ${fastEntryClass} Section ${fastEntrySection}. Each student must have a unique roll number.`);
          return;
        }
        rollNoSet.add(rRoll);
        rollToNameMap.set(rRoll, rName);
      }
      
      if (isAdmissionNoRequired && rAdmission) {
        if (admissionNoSet.has(rAdmission)) {
          const otherName = admissionToNameMap.get(rAdmission);
          setFastEntryError(`Duplicate Admission Number "${r.admissionNo.trim()}" found. Both "${otherName}" and "${rName}" are assigned Admission Number "${r.admissionNo.trim()}". Each student must have a unique admission number.`);
          return;
        }

        // Check for conflict with other students in the database who are NOT being edited in this active grid
        const databaseDuplicate = students.find(s => 
          s.id !== r.id && 
          s.admissionNo.trim().toLowerCase() === rAdmission
        );
        if (databaseDuplicate) {
          setFastEntryError(`Duplicate Admission Number "${r.admissionNo.trim()}" conflict. The Admission Number already belongs to "${databaseDuplicate.name}" in Class ${databaseDuplicate.className} Section ${databaseDuplicate.section}.`);
          return;
        }

        admissionNoSet.add(rAdmission);
        admissionToNameMap.set(rAdmission, rName);
      }
    }

    const existingIds = new Set(students.map(s => s.id));
    const newStudentsToCreate = activeRows.filter(r => r.isDraft || !existingIds.has(r.id));
    const newCount = newStudentsToCreate.length;

    // Plan-specific student limits checks
    const limit = maxStudentsLimit ?? 50;
    if (students.length + newCount > limit) {
      setAlertDialog({
        isOpen: true,
        title: "Operational Limit Reached",
        message: `Your school's current plan/trial restricts the student registry size to a maximum of ${limit} student profiles. Adding these ${newCount} new profiles would exceed this limit.`
      });
      return;
    }

    const cumulativeLimit = maxCumulativeStudentsLimit ?? 100;
    if (cumulativeStudentsCount + newCount > cumulativeLimit) {
      setAlertDialog({
        isOpen: true,
        title: "Cumulative Lifetime Limit Reached",
        message: `Your school has reached the maximum all-time registrations limit of ${cumulativeLimit} student profiles for this subscription. Deleting old profiles does not reset this quota to prevent plan abuse.`
      });
      return;
    }

    const updatedStudents = [...students];
    const updatedGrades = [...studentGrades];

    activeRows.forEach(row => {
      const isNew = row.isDraft || !existingIds.has(row.id);
      const studentId = isNew ? (row.isDraft ? `stud_grid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}` : row.id) : row.id;

      const admissionNo = row.admissionNo && row.admissionNo.trim() !== '' 
        ? row.admissionNo.trim() 
        : `adm_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;

      const rollNo = row.rollNo && row.rollNo.trim() !== '' 
        ? row.rollNo.trim() 
        : '';

      const studentObj: Student = {
        id: studentId,
        name: row.name.trim(),
        rollNo: rollNo,
        admissionNo: admissionNo,
        fatherName: formatFatherName(row.fatherName),
        motherName: formatMotherName(row.motherName),
        className: fastEntryClass,
        section: fastEntrySection,
        dob: row.dob || '01-01-2013',
        mobileNumber: (row.mobileNumber || '').trim(),
        height: formatHeight(row.height || '120 CM'),
        weight: formatWeight(row.weight || '40 KG'),
        photoUrl: row.photoUrl || "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150",
        remarks: row.remarks || '',
        promotionStatus: row.promotionStatus || 'Congratulations!'
      };

      // Set other dynamic fields if any
      activeStudentFields.forEach(f => {
        if (
          f.id !== 'name' && 
          f.id !== 'className' && 
          f.id !== 'section' && 
          f.id !== 'rollNo' && 
          f.id !== 'admissionNo' &&
          f.id !== 'fatherName' &&
          f.id !== 'motherName' &&
          f.id !== 'mobileNumber' &&
          f.id !== 'height' &&
          f.id !== 'weight'
        ) {
          (studentObj as any)[f.id] = row[f.id] || '';
        }
      });

      const sIdx = updatedStudents.findIndex(s => s.id === studentId);
      if (sIdx >= 0) {
        updatedStudents[sIdx] = studentObj;
      } else {
        updatedStudents.push(studentObj);
      }

      // Sync grades document
      const gIdx = updatedGrades.findIndex(g => g.studentId === studentId);
      const rowAttendanceVal = typeof row.attendance === 'object' 
        ? (row.attendance?.term1 || '') 
        : (row.attendance || '');
      
      const attendanceObj = {
        term1: rowAttendanceVal || '',
        term2: rowAttendanceVal || ''
      };

      if (gIdx >= 0) {
        updatedGrades[gIdx] = {
          ...updatedGrades[gIdx],
          attendance: attendanceObj
        };
      } else {
        updatedGrades.push({
          studentId: studentId,
          scholastic: {},
          co_scholastic: {},
          activity: {},
          attendance: attendanceObj
        });
      }
    });

    onUpdateStudents(updatedStudents);
    onUpdateGrades(updatedGrades);

    const effectiveSchoolId = currentSchoolId || localStorage.getItem('class_on_saas_school_id') || '';
    if (effectiveSchoolId) {
      try {
        localStorage.setItem(`class_on_students_${effectiveSchoolId}`, JSON.stringify(updatedStudents));
        localStorage.setItem(`class_on_student_grades_${effectiveSchoolId}`, JSON.stringify(updatedGrades));
      } catch {}
      saveStudentsBatchToCloud(effectiveSchoolId, updatedStudents, updatedGrades).catch(err => {
        console.warn("[FastGrid Save] Cloud sync background notice:", err);
      });
    }

    if (newCount > 0) {
      onIncrementCumulativeCount?.(newCount);
    }

    setFastEntryError(null);
    setImportStatus(`Successfully updated and synchronized student roster for Class ${fastEntryClass} Section ${fastEntrySection}!`);
    setTimeout(() => setImportStatus(null), 3000);

    // Reload with updated students to sync values and append new draft row placeholders
    loadFastEntryRows(fastEntryClass, fastEntrySection, fastEntryMode, updatedStudents);
  };

  const editingStudentScoreColumns = React.useMemo(() => {
    return editingStudentStruct?.scoreColumns && editingStudentStruct.scoreColumns.length > 0
      ? editingStudentStruct.scoreColumns
      : scoreColumns;
  }, [editingStudentStruct, scoreColumns]);

  const editingStudentT1ScoreColumns = React.useMemo(() => {
    if (editingStudentStruct?.termSpecificScoreColumnsEnabled && editingStudentStruct.term1ScoreColumns && editingStudentStruct.term1ScoreColumns.length > 0) {
      return editingStudentStruct.term1ScoreColumns;
    }
    return editingStudentScoreColumns;
  }, [editingStudentStruct, editingStudentScoreColumns]);

  const editingStudentT2ScoreColumns = React.useMemo(() => {
    if (editingStudentStruct?.termSpecificScoreColumnsEnabled && editingStudentStruct.term2ScoreColumns && editingStudentStruct.term2ScoreColumns.length > 0) {
      return editingStudentStruct.term2ScoreColumns;
    }
    return editingStudentScoreColumns;
  }, [editingStudentStruct, editingStudentScoreColumns]);

  const editingStudentT3ScoreColumns = React.useMemo(() => {
    if (editingStudentStruct?.termSpecificScoreColumnsEnabled && editingStudentStruct.term3ScoreColumns && editingStudentStruct.term3ScoreColumns.length > 0) {
      return editingStudentStruct.term3ScoreColumns;
    }
    return editingStudentScoreColumns;
  }, [editingStudentStruct, editingStudentScoreColumns]);

  const term1Active = React.useMemo(() => {
    return resolvedBranding?.term1Enabled !== false && (editingStudentStruct ? !editingStudentStruct.scholasticTerm1Disabled : true);
  }, [resolvedBranding, editingStudentStruct]);

  const term2Active = React.useMemo(() => {
    return resolvedBranding?.term2Enabled !== false && (editingStudentStruct ? !editingStudentStruct.scholasticTerm2Disabled : true);
  }, [resolvedBranding, editingStudentStruct]);

  const term3Active = React.useMemo(() => {
    return resolvedBranding?.term3Enabled === true && (editingStudentStruct ? !editingStudentStruct.scholasticTerm3Disabled : true);
  }, [resolvedBranding, editingStudentStruct]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Photo Bulk Upload States
  const [isPhotoBulkExpanded, setIsPhotoBulkExpanded] = useState(false);
  
  // Bulk Class Deletion / Reset States
  const [isBulkDeleteExpanded, setIsBulkDeleteExpanded] = useState(false);
  const [selectedClassesToDelete, setSelectedClassesToDelete] = useState<string[]>([]);
  const [selectedClassSectionsToDelete, setSelectedClassSectionsToDelete] = useState<{ className: string; section: string }[]>([]);
  const [deletionOption, setDeletionOption] = useState<'option2' | 'option3'>('option2');
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [bulkDeleteSuccess, setBulkDeleteSuccess] = useState<string | null>(null);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);

  // Bulk Class Promotion States
  const [isPromotionExpanded, setIsPromotionExpanded] = useState(false);
  const [promotionSourceClass, setPromotionSourceClass] = useState('');
  const [promotionSourceSection, setPromotionSourceSection] = useState('all');
  const [promotionTargetClass, setPromotionTargetClass] = useState('');
  const [promotionTargetSection, setPromotionTargetSection] = useState('');
  const [promotionStatusText, setPromotionStatusText] = useState('Congratulations! Promoted to the next standard.');
  const [isPromoting, setIsPromoting] = useState(false);
  const [promotionSuccess, setPromotionSuccess] = useState<string | null>(null);
  const [promotionError, setPromotionError] = useState<string | null>(null);

  // New Session states for automatic rollover & historic archiving
  const [currentSessionToArchive, setCurrentSessionToArchive] = useState(() => branding?.session || "Session 2026-2027");
  const [newSessionName, setNewSessionName] = useState("");
  const [shouldUpdateSchoolSession, setShouldUpdateSchoolSession] = useState(true);

  React.useEffect(() => {
    if (branding?.session) {
      setCurrentSessionToArchive(branding.session);
      const activeS = branding.session;
      const match = activeS.match(/(\d{4})-(\d{4})/);
      if (match) {
        const start = parseInt(match[1]) + 1;
        const end = parseInt(match[2]) + 1;
        setNewSessionName(activeS.replace(`${match[1]}-${match[2]}`, `${start}-${end}`));
      } else {
        const singleYearMatch = activeS.match(/(\d{4})/);
        if (singleYearMatch) {
          const yr = parseInt(singleYearMatch[1]) + 1;
          setNewSessionName(activeS.replace(singleYearMatch[1], yr.toString()));
        } else {
          setNewSessionName(activeS + " (Next)");
        }
      }
    }
  }, [branding?.session]);

  // CSV Upload Staging Preview States
  const [isStagingPreviewOpen, setIsStagingPreviewOpen] = useState(false);
  const [stagedChanges, setStagedChanges] = useState<StagedCSVChange[]>([]);
  const [stagedFilter, setStagedFilter] = useState<'all' | 'insert' | 'update'>('all');
  const [stagedSearchTerm, setStagedSearchTerm] = useState('');

  // Recycle Bin States
  const [isRecycleBinExpanded, setIsRecycleBinExpanded] = useState(false);
  const [recycleConfirmId, setRecycleConfirmId] = useState<string | null>(null); // 'all' or itemId
  const [recycleConfirmInput, setRecycleConfirmInput] = useState('');
  const [isRecycleConfirmOpen, setIsRecycleConfirmOpen] = useState(false);

  const updateRecycleBin = (updatedBin: RecycleBinItem[]) => {
    onUpdateRecycleBin(updatedBin);
  };
  const [photoMatchResults, setPhotoMatchResults] = useState<{
    fileName: string;
    rollNo: string;
    studentId?: string;
    studentName?: string;
    className?: string;
    section?: string;
    matchType?: string;
    success: boolean;
    reason: string;
    previewUrl?: string;
  }[]>([]);
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);
  const [photoImportStatus, setPhotoImportStatus] = useState<string | null>(null);

  const photoFileInputRef = useRef<HTMLInputElement>(null);

  const handleBulkPhotoFiles = async (files: File[]) => {
    setIsProcessingPhotos(true);
    setPhotoImportStatus(null);

    const isClassScoped = filterClass !== 'all';
    const isSecScoped = filterSection !== 'all';

    const processedPromises = files.map(async (file) => {
      if (!file.type.startsWith('image/')) {
        return {
          fileName: file.name,
          rollNo: '',
          success: false,
          reason: 'Not a valid image file.'
        };
      }

      // Extract filename without extension
      const extensionIdx = file.name.lastIndexOf('.');
      const baseName = extensionIdx >= 0 ? file.name.substring(0, extensionIdx).trim() : file.name.trim();
      const cleanBase = baseName.trim().toLowerCase();
      const numericPart = baseName.match(/\d+/)?.[0] || null;

      let matchedStudent: Student | undefined;
      let matchType = '';
      let failureReason = '';

      // -------------------------------------------------------------
      // OPTION 2: Admission Number Match (Priority 1)
      // Works across the entire school regardless of active filters.
      // -------------------------------------------------------------
      const admCandidate = cleanBase.replace(/^(adm|admission)[-_ ]*/i, '');
      matchedStudent = students.find(s => {
        if (!s.admissionNo) return false;
        const sAdmClean = s.admissionNo.trim().toLowerCase();
        return sAdmClean === cleanBase || sAdmClean === admCandidate;
      });
      if (matchedStudent) {
        matchType = 'Admission No';
      }

      // -------------------------------------------------------------
      // OPTION 3: Composite Filename Match (Priority 2)
      // Formats: {Class}_{Section}_{Roll} or {Class}-{Section}-{Roll} or {Class}{Section}_{Roll}
      // E.g.: 3_A_10, 12_Science_01, 3A_10, Class3_SecA_10, 10A-5
      // -------------------------------------------------------------
      if (!matchedStudent) {
        const normalizedName = baseName
          .replace(/^class[-_ ]*/i, '')
          .replace(/[-_ ]*sec(tion)?[-_ ]*/i, '_')
          .replace(/[-_ ]*roll[-_ ]*/i, '_');

        const parts = normalizedName.split(/[-_ ]+/).filter(Boolean);
        if (parts.length >= 3) {
          const classPart = parts[0];
          const sectionPart = parts[1];
          const rollPart = parts[2];
          const rollNum = rollPart.match(/\d+/)?.[0];

          matchedStudent = students.find(s => {
            const cMatch = classesMatch(s.className, classPart);
            const secMatch = (s.section || '').trim().toLowerCase() === sectionPart.toLowerCase();
            const rollMatch = s.rollNo.trim().toLowerCase() === rollPart.toLowerCase() ||
              (rollNum !== undefined && s.rollNo.match(/\d+/)?.[0] !== undefined && parseInt(s.rollNo.match(/\d+/)![0]) === parseInt(rollNum));
            return cMatch && secMatch && rollMatch;
          });
          if (matchedStudent) {
            matchType = 'Class_Sec_Roll';
          }
        } else if (parts.length === 2) {
          // Check for formats like '3A_10' where '3A' is class + section and '10' is roll
          const classSecMatch = parts[0].match(/^([0-9]+|[a-zA-Z]+)([a-zA-Z])$/);
          const rollPart = parts[1];
          const rollNum = rollPart.match(/\d+/)?.[0];
          if (classSecMatch) {
            const classPart = classSecMatch[1];
            const sectionPart = classSecMatch[2];
            matchedStudent = students.find(s => {
              const cMatch = classesMatch(s.className, classPart);
              const secMatch = (s.section || '').trim().toLowerCase() === sectionPart.toLowerCase();
              const rollMatch = s.rollNo.trim().toLowerCase() === rollPart.toLowerCase() ||
                (rollNum !== undefined && s.rollNo.match(/\d+/)?.[0] !== undefined && parseInt(s.rollNo.match(/\d+/)![0]) === parseInt(rollNum));
              return cMatch && secMatch && rollMatch;
            });
            if (matchedStudent) {
              matchType = 'Class_Sec_Roll';
            }
          }
        }
      }

      // -------------------------------------------------------------
      // OPTION 1: Active Scoped Class & Section Match (Priority 3)
      // When filtered by Class (and optionally Section), match roll within that scope.
      // E.g. User is in Class 3, Section A: 10.jpg maps directly to Roll 10 of Class 3A.
      // -------------------------------------------------------------
      if (!matchedStudent && isClassScoped) {
        const scopedStudents = students.filter(s => 
          classesMatch(s.className, filterClass) && 
          (!isSecScoped || (s.section || '').trim().toLowerCase() === filterSection.trim().toLowerCase())
        );

        matchedStudent = scopedStudents.find(s => {
          const sRollClean = s.rollNo.trim().toLowerCase();
          if (sRollClean === cleanBase) return true;
          if (numericPart) {
            const sRollNumMatch = sRollClean.match(/\d+/);
            if (sRollNumMatch && parseInt(sRollNumMatch[0]) === parseInt(numericPart)) {
              return true;
            }
          }
          return false;
        });

        if (matchedStudent) {
          matchType = isSecScoped ? 'Active Class & Sec' : 'Active Class';
        } else {
          failureReason = `No student in active scope (Class ${filterClass}${isSecScoped ? ` - Sec ${filterSection}` : ''}) has Roll Number '${numericPart || baseName}'.`;
        }
      }

      // -------------------------------------------------------------
      // Fallback: Global Roll Number Check (when no filter is active)
      // If multiple classes share this roll number, flag conflict safely.
      // -------------------------------------------------------------
      if (!matchedStudent && !isClassScoped && numericPart) {
        const candidateMatches = students.filter(s => {
          const sRollClean = s.rollNo.trim().toLowerCase();
          if (sRollClean === cleanBase) return true;
          const sRollNumMatch = sRollClean.match(/\d+/);
          return sRollNumMatch && parseInt(sRollNumMatch[0]) === parseInt(numericPart);
        });

        if (candidateMatches.length === 1) {
          matchedStudent = candidateMatches[0];
          matchType = 'Roll No';
        } else if (candidateMatches.length > 1) {
          const foundClasses = candidateMatches.map(c => `Class ${c.className}-${c.section}`).join(', ');
          failureReason = `Roll #${numericPart} exists in multiple classes (${foundClasses}). Filter by Class first or name file as '${candidateMatches[0].className}_${candidateMatches[0].section}_${numericPart}.jpg'.`;
        }
      }

      if (!matchedStudent) {
        return {
          fileName: file.name,
          rollNo: numericPart || baseName,
          success: false,
          reason: failureReason || `No student record matches '${baseName}'.`
        };
      }

      try {
        // Resize and crop to 5:6 passport layout
        const resizedUrl = await compressAndResizeStudentPhoto(file);

        return {
          fileName: file.name,
          rollNo: matchedStudent.rollNo,
          studentId: matchedStudent.id,
          studentName: matchedStudent.name,
          className: matchedStudent.className,
          section: matchedStudent.section,
          matchType: matchType,
          success: true,
          reason: '',
          previewUrl: resizedUrl
        };
      } catch (err: any) {
        return {
          fileName: file.name,
          rollNo: matchedStudent.rollNo,
          studentId: matchedStudent.id,
          studentName: matchedStudent.name,
          className: matchedStudent.className,
          section: matchedStudent.section,
          success: false,
          reason: `Resize failed: ${err.message || 'Unknown error'}`
        };
      }
    });

    const parsedResults = await Promise.all(processedPromises);
    setPhotoMatchResults(parsedResults);
    setIsProcessingPhotos(false);
  };

  const savePhotoBulkChanges = () => {
    const successMatches = photoMatchResults.filter(r => r.success && r.previewUrl && r.studentId);
    if (successMatches.length === 0) return;

    const matchMap = new Map<string, string>(); // studentId -> previewUrl
    successMatches.forEach(r => {
      matchMap.set(r.studentId!, r.previewUrl!);
    });

    const updatedStudentsList = students.map(student => {
      if (matchMap.has(student.id)) {
        return {
          ...student,
          photoUrl: matchMap.get(student.id)!
        };
      }
      return student;
    });

    onUpdateStudents(updatedStudentsList);
    setPhotoImportStatus(`Successfully updated ${successMatches.length} student photos in registry!`);
    
    setTimeout(() => {
      setPhotoMatchResults([]);
      setPhotoImportStatus(null);
      setIsPhotoBulkExpanded(false);
    }, 4500);
  };

  // Custom states for alert/confirm to bypass sandbox iframe disallow-modals constraints
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  } | null>(null);

  // Floating Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Search Filter
  const uniqueClasses = React.useMemo(() => {
    if (schoolClasses && schoolClasses.length > 0) {
      return schoolClasses.map(c => c.name);
    }
    return getStandardClassPresets((classNamingStyle === 'custom' ? 'roman' : classNamingStyle) || 'roman').map(c => c.name);
  }, [schoolClasses, classNamingStyle]);

  const uniqueSections = React.useMemo(() => {
    if (filterClass !== 'all') {
      return getSectionsForClass(filterClass, schoolClasses, students, reportCardStructures);
    }
    const sectionsSet = new Set<string>();
    students.forEach(s => {
      const sec = (s.section || '').trim();
      if (sec) sectionsSet.add(sec);
    });
    if (schoolClasses && schoolClasses.length > 0) {
      schoolClasses.forEach(cls => {
        (cls.sections || []).forEach(sec => {
          if (sec) sectionsSet.add(sec.trim());
        });
      });
    }
    const list = Array.from(sectionsSet);
    return list.length > 0 ? list.sort() : ['A', 'B'];
  }, [schoolClasses, students, filterClass, reportCardStructures]);

  const uniqueClassSections = React.useMemo(() => {
    const pairs: { className: string; section: string }[] = [];
    const seen = new Set<string>();
    
    students.forEach(s => {
      const cls = (s.className || '').trim();
      const sec = (s.section || '').trim();
      if (cls) {
        const key = `${cls.toLowerCase()}|||${sec.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          pairs.push({ className: cls, section: sec });
        }
      }
    });
    
    return pairs.sort((a, b) => {
      const classCompare = a.className.localeCompare(b.className, undefined, { numeric: true });
      if (classCompare !== 0) return classCompare;
      return a.section.localeCompare(b.section);
    });
  }, [students]);

  const filteredStudents = students.filter(student => {
    const sClass = student.className?.trim().toLowerCase() || '';
    const filterClassClean = filterClass.trim().toLowerCase();
    const matchesClass = filterClassClean === 'all' || sClass === filterClassClean || classesMatch(student.className, filterClassClean);

    const sSection = (student.section || '').trim().toLowerCase();
    const filterSectionClean = filterSection.trim().toLowerCase();
    const matchesSection = filterSectionClean === 'all' || sSection === filterSectionClean;

    const sName = student.name?.toLowerCase() || '';
    const sRoll = student.rollNo?.toString().trim() || '';
    const sMobile = student.mobileNumber?.toString().trim() || '';

    // Unified search query for Name, Roll Number, or Parent Mobile
    const qClean = filterQuery.toLowerCase().trim();
    const matchesQuery = !qClean || sName.includes(qClean) || sRoll.includes(qClean) || sMobile.includes(qClean);

    return matchesClass && matchesSection && matchesQuery;
  }).sort((a, b) => {
    const rollA = parseInt(a.rollNo, 10);
    const rollB = parseInt(b.rollNo, 10);
    if (!isNaN(rollA) && !isNaN(rollB)) {
      return rollA - rollB;
    }
    return (a.rollNo || '').localeCompare(b.rollNo || '', undefined, { numeric: true });
  });

  const totalStudentPages = Math.max(1, Math.ceil(filteredStudents.length / studentPageSize));

  const paginatedStudents = React.useMemo(() => {
    const startIndex = (studentPage - 1) * studentPageSize;
    return filteredStudents.slice(startIndex, startIndex + studentPageSize);
  }, [filteredStudents, studentPage, studentPageSize]);

  // Download personalized excel template based on active terms and subjects
  const downloadCsvTemplate = () => {
    // Resolve selected structure
    let selectedStruct = reportCardStructures?.find(s => s.id === selectedStructureId);

    // If layout is 'default' but a specific class is selected, auto-resolve target structure designed for that class standard!
    if (!selectedStruct && selectedTemplateClass && selectedTemplateClass !== 'all') {
      selectedStruct = reportCardStructures?.find(s => 
        s.assignedClasses.some((c: string) => classesMatch(c, selectedTemplateClass))
      );
    }
    
    // Determine configuration and rules based on structure
    const resolvedBrandingForTemplate = selectedStruct?.branding || branding;
    const studentFields = resolvedBrandingForTemplate?.studentFields || [
      { id: "rollNo", label: "Roll No" },
      { id: "admissionNo", label: "Admission No" },
      { id: "name", label: "Student Name" },
      { id: "fatherName", label: "Father Name" },
      { id: "motherName", label: "Mother Name" },
      { id: "className", label: "Class" },
      { id: "section", label: "Section" },
      { id: "dob", label: "DOB" },
      { id: "height", label: "Height" },
      { id: "weight", label: "Weight" }
    ];

    // Filter student fields by active class standard
    const activeStudentFields = studentFields.filter(f => {
      if (f.disabledAll || f.disabled === true) return false;
      if (selectedTemplateClass !== 'all' && f.disabledClasses?.includes(selectedTemplateClass)) {
        return false;
      }
      return true;
    });

    const activeSubjects = selectedStruct ? (selectedStruct.subjects || []) : subjects;
    const activeScoreColumns = selectedStruct ? (selectedStruct.scoreColumns || []) : scoreColumns;
    const activeT1ScoreColumns = (selectedStruct?.termSpecificScoreColumnsEnabled && selectedStruct.term1ScoreColumns && selectedStruct.term1ScoreColumns.length > 0)
      ? selectedStruct.term1ScoreColumns
      : activeScoreColumns;
    const activeT2ScoreColumns = (selectedStruct?.termSpecificScoreColumnsEnabled && selectedStruct.term2ScoreColumns && selectedStruct.term2ScoreColumns.length > 0)
      ? selectedStruct.term2ScoreColumns
      : activeScoreColumns;

    // Direct helper to determine if term is active for a given subject based on the resolved structure
    const isTerm1ActiveForSubject = (sub: typeof subjects[0]) => {
      if (sub.type === 'scholastic') {
        return selectedStruct ? !selectedStruct.scholasticTerm1Disabled : (branding?.term1Enabled !== false);
      }
      // Co-scholastic / Activity sections have individual term configuration
      if (selectedStruct && selectedStruct.coScholasticSections) {
        const sec = selectedStruct.coScholasticSections.find(s => 
          sub.sectionId === s.id || (sub.type === s.type && (!sub.sectionId || sub.sectionId === s.id))
        );
        if (sec) return sec.term1Enabled !== false;
      }
      return branding?.term1Enabled !== false;
    };

    const isTerm2ActiveForSubject = (sub: typeof subjects[0]) => {
      if (sub.type === 'scholastic') {
        return selectedStruct ? !selectedStruct.scholasticTerm2Disabled : (branding?.term2Enabled !== false);
      }
      // Co-scholastic / Activity sections have individual term configuration
      if (selectedStruct && selectedStruct.coScholasticSections) {
        const sec = selectedStruct.coScholasticSections.find(s => 
          sub.sectionId === s.id || (sub.type === s.type && (!sub.sectionId || sub.sectionId === s.id))
        );
        if (sec) return sec.term2Enabled !== false;
      }
      return branding?.term2Enabled !== false;
    };

    // Build CSV headers
    const headerCols: string[] = [];
    activeStudentFields.forEach(field => {
      headerCols.push(field.label);
    });
    
    // Dedicated Parent Mobile header if not already in custom activeStudentFields
    if (!activeStudentFields.some(f => f.id === 'mobileNumber' || f.label.toLowerCase().includes('mobile') || f.label.toLowerCase().includes('phone'))) {
      headerCols.push("Parent Mobile");
    }

    // Single Attendance column
    headerCols.push("Attendance");
    headerCols.push("Remarks");
    
    const hasCongratulations = resolvedBrandingForTemplate?.congratulationsDisabled !== true;
    if (hasCongratulations) {
      headerCols.push("Promotion Status");
    }
    
    headerCols.push("Photo URL");

    // Append scholastic and co-scholastic columns
    activeSubjects.forEach(sub => {
      const subClean = sub.name.replace(/,/g, '');
      const t1ActiveForSub = isTerm1ActiveForSubject(sub);
      const t2ActiveForSub = isTerm2ActiveForSubject(sub);

      if (sub.type === 'scholastic') {
        if (t1ActiveForSub) {
          activeT1ScoreColumns.forEach(col => {
            const colClean = col.name.replace(/,/g, '');
            headerCols.push(`${subClean} T1 ${colClean}`);
          });
        }
        if (t2ActiveForSub) {
          activeT2ScoreColumns.forEach(col => {
            const colClean = col.name.replace(/,/g, '');
            headerCols.push(`${subClean} T2 ${colClean}`);
          });
        }
      } else {
        if (t1ActiveForSub) {
          headerCols.push(`${subClean} T1`);
        }
        if (t2ActiveForSub) {
          headerCols.push(`${subClean} T2`);
        }
      }
    });

    const header = headerCols.map(h => {
      if (h.includes(",") || h.includes("\"") || h.includes("\n")) {
        return `"${h.replace(/"/g, '""')}"`;
      }
      return h;
    }).join(",");

    // Gather students matching the selected Template Class and Section filters
    const targetClasses = selectedTemplateClass === 'all'
      ? (selectedStruct ? selectedStruct.assignedClasses : uniqueClasses)
      : [selectedTemplateClass];

    const targetNormalizedClassesSet = new Set(targetClasses.map(c => normalizeClassName(c)));

    const matchingStudents = students.filter(s => {
      const matchesClass = targetNormalizedClassesSet.has(normalizeClassName(s.className));
      const matchesSec = selectedTemplateSection === 'all' || s.section.toLowerCase().trim() === selectedTemplateSection.toLowerCase().trim();
      return matchesClass && matchesSec;
    });

    const rows: string[] = [];

    if (matchingStudents.length > 0) {
      // Export existing student files with grades pre-filled!
      matchingStudents.forEach(stud => {
        const gradesVal = studentGrades.find(g => g.studentId === stud.id);
        const scholasticData = gradesVal?.scholastic || {};
        const coScholasticData = gradesVal?.co_scholastic || {};
        const activityData = gradesVal?.activity || {};
        const attendanceData = gradesVal?.attendance || { term1: '', term2: '' };

        const cols = activeStudentFields.map(field => {
          return (stud as any)[field.id] || '';
        });

        if (!activeStudentFields.some(f => f.id === 'mobileNumber' || f.label.toLowerCase().includes('mobile') || f.label.toLowerCase().includes('phone'))) {
          cols.push(stud.mobileNumber || '');
        }

        // Single attendance value
        cols.push(attendanceData.term1 || '');
        cols.push(stud.remarks || '');
        if (hasCongratulations) {
          cols.push(stud.promotionStatus || '');
        }
        cols.push(stud.photoUrl || '');

        activeSubjects.forEach(sub => {
          const t1ActiveForSub = isTerm1ActiveForSubject(sub);
          const t2ActiveForSub = isTerm2ActiveForSubject(sub);

          if (sub.type === 'scholastic') {
            const subScores = scholasticData[sub.id] || { term1: {}, term2: {} };
            if (t1ActiveForSub) {
              activeT1ScoreColumns.forEach(col => {
                cols.push(subScores.term1?.[col.id] !== undefined ? String(subScores.term1[col.id]) : '');
              });
            }
            if (t2ActiveForSub) {
              activeT2ScoreColumns.forEach(col => {
                cols.push(subScores.term2?.[col.id] !== undefined ? String(subScores.term2[col.id]) : '');
              });
            }
          } else if (sub.type === 'co_scholastic') {
            const coScores = coScholasticData[sub.id] || { term1: '', term2: '' };
            if (t1ActiveForSub) cols.push(coScores.term1 || '');
            if (t2ActiveForSub) cols.push(coScores.term2 || '');
          } else {
            const actScores = activityData[sub.id] || { term1: '', term2: '' };
            if (t1ActiveForSub) cols.push(actScores.term1 || '');
            if (t2ActiveForSub) cols.push(actScores.term2 || '');
          }
        });

        const rowStr = cols.map(c => {
          if (c.includes(",") || c.includes("\"") || c.includes("\n")) {
            return `"${c.replace(/"/g, '""')}"`;
          }
          return c;
        }).join(",");
        rows.push(rowStr);
      });
    } else {
      // Output a guided sample/dummy row in accordance with the filters chosen
      const defaultClassPlaceholder = selectedTemplateClass !== 'all' ? selectedTemplateClass : (targetClasses[0] || '1st');
      const defaultSecPlaceholder = selectedTemplateSection !== 'all' ? selectedTemplateSection : 'A';

      const sampleCols = activeStudentFields.map(field => {
        if (field.id === 'rollNo') return '1';
        if (field.id === 'admissionNo') return 'ADM-1002';
        if (field.id === 'name') return 'Meera Malhotra';
        if (field.id === 'fatherName') return 'Mr. Vikrant Malhotra';
        if (field.id === 'motherName') return 'Mrs. Ridhi Malhotra';
        if (field.id === 'className') return defaultClassPlaceholder;
        if (field.id === 'section') return defaultSecPlaceholder;
        if (field.id === 'dob') return '04-10-2015';
        if (field.id === 'height') return '122 CM';
        if (field.id === 'weight') return '40 KG';
        return `sample ${field.label}`;
      });

      if (!activeStudentFields.some(f => f.id === 'mobileNumber' || f.label.toLowerCase().includes('mobile') || f.label.toLowerCase().includes('phone'))) {
        sampleCols.push("9876543210");
      }
      
      sampleCols.push("99/105"); // Single attendance
      sampleCols.push("Meera's performance is incredibly brilliant, polite, and highly disciplined.");
      
      if (hasCongratulations) {
        sampleCols.push("Congratulations! You are promoted to next standard");
      }
      
      sampleCols.push("https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150");

      activeSubjects.forEach(sub => {
        const t1ActiveForSub = isTerm1ActiveForSubject(sub);
        const t2ActiveForSub = isTerm2ActiveForSubject(sub);

        if (sub.type === 'scholastic') {
          if (t1ActiveForSub) {
            activeT1ScoreColumns.forEach(() => {
              sampleCols.push("80");
            });
          }
          if (t2ActiveForSub) {
            activeT2ScoreColumns.forEach(() => {
              sampleCols.push("85");
            });
          }
        } else {
          if (t1ActiveForSub) sampleCols.push("A");
          if (t2ActiveForSub) sampleCols.push("A");
        }
      });

      const sampleRow = sampleCols.map(c => {
        if (c.includes(",") || c.includes("\"")) {
          return `"${c.replace(/"/g, '""')}"`;
        }
        return c;
      }).join(",");
      rows.push(sampleRow);
    }

    const csvData = `${header}\r\n${rows.join("\r\n")}`;
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), new TextEncoder().encode(csvData)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    // Compose dynamic file title
    const layoutLabel = selectedStruct ? selectedStruct.name.replace(/\s+/g, '_') : 'global';
    const classLabelSuffix = selectedTemplateClass === 'all' ? 'All' : selectedTemplateClass;
    const fileTitleName = `Student_Grades_${layoutLabel}_Class_${classLabelSuffix.replace(/\//g, '_')}.csv`;

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", fileTitleName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Highly robust parser mapping columns dynamically based on custom active headers
  // Highly robust parser mapping columns dynamically based on custom active headers
  const importCsvContent = (text: string): boolean => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length <= 1) {
      setAlertDialog({
        isOpen: true,
        title: "Template Error",
        message: "Spreadsheet template headers or data rows seem completely missing."
      });
      return false;
    }

    // Auto-detect CSV delimiter (comma, semicolon, or tab)
    const firstLine = lines[0] || "";
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;

    let delimiter = ',';
    if (semicolonCount > commaCount && semicolonCount > tabCount) {
      delimiter = ';';
    } else if (tabCount > commaCount && tabCount > semicolonCount) {
      delimiter = '\t';
    }

    const parseCsvRow = (line: string): string[] => {
      const row: string[] = [];
      let currentCell = '';
      let inQuotes = false;
      for (let charIdx = 0; charIdx < line.length; charIdx++) {
        const char = line[charIdx];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === delimiter && !inQuotes) {
          row.push(currentCell.trim());
          currentCell = '';
        } else {
          currentCell += char;
        }
      }
      row.push(currentCell.trim());
      return row.map(cell => cell.replace(/^"(.*)"$/, '$1').replace(/""/g, '"'));
    };

    const csvHeaders = parseCsvRow(lines[0] || "").map(h => h.trim().toLowerCase());

    const findColIdx = (aliases: string[]) => {
      return csvHeaders.findIndex(header => 
        aliases.some(alias => header === alias || header.includes(alias))
      );
    };

    // Resolve structural details for template scoring attributes
    const selectedStruct = reportCardStructures?.find(s => s.id === selectedStructureId);
    const resolvedBrandingForImport = selectedStruct?.branding || branding;
    const studentFields = resolvedBrandingForImport?.studentFields || [
      { id: "rollNo", label: "Roll No" },
      { id: "admissionNo", label: "Admission No" },
      { id: "name", label: "Student Name" },
      { id: "fatherName", label: "Father Name" },
      { id: "motherName", label: "Mother Name" },
      { id: "className", label: "Class" },
      { id: "section", label: "Section" },
      { id: "dob", label: "DOB" },
      { id: "height", label: "Height" },
      { id: "weight", label: "Weight" }
    ];

    // Map student fields dynamically to find indices in CSV headers
    const fieldIndices = studentFields.map(field => {
      const labelLower = field.label.trim().toLowerCase();
      const idLower = field.id.trim().toLowerCase();
      
      let idx = csvHeaders.indexOf(labelLower);
      if (idx < 0) {
        idx = csvHeaders.indexOf(idLower);
      }
      if (idx < 0) {
        // Fallback containing
        idx = csvHeaders.findIndex(h => h === labelLower || h === idLower || h.includes(labelLower) || h.includes(idLower));
      }
      return { field, idx };
    });

    // Map columns dynamically
    const nameMapping = fieldIndices.find(f => f.field.id === 'name');
    const admissionMapping = fieldIndices.find(f => f.field.id === 'admissionNo');
    const rollNoMapping = fieldIndices.find(f => f.field.id === 'rollNo');
    const fatherNameMapping = fieldIndices.find(f => f.field.id === 'fatherName');
    const motherNameMapping = fieldIndices.find(f => f.field.id === 'motherName');
    const classNameMapping = fieldIndices.find(f => f.field.id === 'className');
    const sectionMapping = fieldIndices.find(f => f.field.id === 'section');
    const dobMapping = fieldIndices.find(f => f.field.id === 'dob');
    const heightMapping = fieldIndices.find(f => f.field.id === 'height');
    const weightMapping = fieldIndices.find(f => f.field.id === 'weight');

    const attIdx = findColIdx(["attendance", "attendance t1", "attendance term 1", "att"]);
    const remarksIdx = findColIdx(["remarks", "remark", "notes", "comment"]);
    const promotionIdx = findColIdx(["promotion status", "promotion_status", "promotion", "promoted"]);
    const photoIdx = findColIdx(["photo url", "photo_url", "photo", "image url", "image_url", "image"]);
    const mobileIdx = findColIdx(["parent mobile", "mobile number", "mobile", "phone", "contact", "phone number", "mob", "parent phone"]);

    // Require essential keys to proceed
    if ((!nameMapping || nameMapping.idx < 0) && (!admissionMapping || admissionMapping.idx < 0)) {
      setAlertDialog({
        isOpen: true,
        title: "Headers Mismatch",
        message: "Headers mismatch! Could not locate essential headers (Student Name and/or Admission No) in the spreadsheet."
      });
      return false;
    }

    // Role safety restrictions check for class teachers (warning denied message)
    if (currentRole === 'class_teacher' && activeTeacherObj) {
      const assignedClassClean = (activeTeacherObj.classTeacherClass || activeTeacherObj.assignedClass || '').trim().toLowerCase();
      const assignedSecClean = (activeTeacherObj.classTeacherSection || activeTeacherObj.assignedSection || '').trim().toLowerCase();

      const invalidRows: { index: number; name: string; cls: string; sec: string }[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const row = parseCsvRow(line);
        if (row.length === 0 || !row.some(cell => cell.length > 0)) continue;

        const name = nameMapping && nameMapping.idx >= 0 ? row[nameMapping.idx] || 'Unnamed Student' : 'Unnamed Student';
        const rowClassInput = classNameMapping && classNameMapping.idx >= 0 ? row[classNameMapping.idx] || '' : '';
        const rowSecInput = sectionMapping && sectionMapping.idx >= 0 ? row[sectionMapping.idx] || '' : '';

        const parsedClassClean = rowClassInput.trim().toLowerCase();
        const parsedSecClean = rowSecInput.trim().toLowerCase();

        // Must match class teacher assigned credentials precisely
        const hasClassConflict = parsedClassClean && parsedClassClean !== assignedClassClean;
        const hasSecConflict = assignedSecClean !== 'all' && parsedSecClean && parsedSecClean !== assignedSecClean;

        if (hasClassConflict || hasSecConflict) {
          invalidRows.push({
            index: i + 1,
            name,
            cls: rowClassInput || '(blank)',
            sec: rowSecInput || '(blank)'
          });
        }
      }

      if (invalidRows.length > 0) {
        const firstFew = invalidRows.slice(0, 5).map(r => `• Row ${r.index} ("${r.name}"): Class "${r.cls}", Section "${r.sec}"`).join("\n");
        const countRemaining = invalidRows.length - 5;
        const remainingText = countRemaining > 0 ? `\n• ...and ${countRemaining} more rows.` : '';

        setAlertDialog({
          isOpen: true,
          title: "Access Denied: Restricted Class Data Detected",
          message: `Operation Blocked! As a Class Teacher, you are ONLY permitted to upload or sync data for your assigned Class "${activeTeacherObj.classTeacherClass || activeTeacherObj.assignedClass}" ${activeTeacherObj.classTeacherSection !== 'All' ? `Section "${activeTeacherObj.classTeacherSection || activeTeacherObj.assignedSection}"` : 'All Sections'}.\n\nThe uploaded file contains student records from other classes/sections:\n\n${firstFew}${remainingText}\n\nPlease correct the CSV sheet content to only contain rows for your assigned class/section, or contact your School Admin to import this file.`
        });
        return false;
      }
    }

    // Pre-validate roll numbers uniqueness across database and CSV rows
    const tempStudentMap = new Map<string, { name: string; rollNo: string; className: string; section: string; admissionNo: string }>();
    
    // Populate with existing active students
    students.forEach(s => {
      tempStudentMap.set(s.admissionNo.trim().toLowerCase(), {
        name: s.name,
        rollNo: s.rollNo || '',
        className: s.className,
        section: s.section,
        admissionNo: s.admissionNo
      });
    });

    // Simulate CSV changes on temp map to check for future duplicate roll numbers
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const row = parseCsvRow(line);
      if (row.length === 0 || !row.some(cell => cell.length > 0)) continue;

      const name = (nameMapping && nameMapping.idx >= 0 && row[nameMapping.idx]) ? row[nameMapping.idx].trim() : 'Unnamed Student';
      const admissionNo = (admissionMapping && admissionMapping.idx >= 0 && row[admissionMapping.idx]) 
        ? row[admissionMapping.idx].trim() 
        : `adm_${Math.random().toString(36).substring(2, 7)}`;
      const rollNo = (rollNoMapping && rollNoMapping.idx >= 0) ? (row[rollNoMapping.idx] || '').trim() : '';

      const className = (classNameMapping && classNameMapping.idx >= 0 && row[classNameMapping.idx]) 
        ? row[classNameMapping.idx].trim() 
        : (currentRole === 'class_teacher' && activeTeacherObj ? (activeTeacherObj.classTeacherClass || activeTeacherObj.assignedClass) : '3rd');
      const section = (sectionMapping && sectionMapping.idx >= 0 && row[sectionMapping.idx]) 
        ? row[sectionMapping.idx].trim() 
        : (currentRole === 'class_teacher' && activeTeacherObj && activeTeacherObj.assignedSection !== 'All' ? (activeTeacherObj.classTeacherSection || activeTeacherObj.assignedSection) : 'A');

      if (!rollNo) {
        setAlertDialog({
          isOpen: true,
          title: "Roll Number Required",
          message: `Roll Number is missing for student "${name}" on Row ${i + 1} of the CSV. Every student must have a valid Roll Number.`
        });
        return false;
      }

      // Update in simulation map
      tempStudentMap.set(admissionNo.trim().toLowerCase(), {
        name,
        rollNo,
        className,
        section,
        admissionNo
      });
    }

    // Check for any duplicate roll numbers in the simulated merged state
    const rollCheckMap = new Map<string, { name: string; admissionNo: string }>();
    for (const [_, std] of tempStudentMap.entries()) {
      const uniqueRollKey = `${std.className.trim().toLowerCase()}_${std.section.trim().toLowerCase()}_${std.rollNo.trim().toLowerCase()}`;
      if (rollCheckMap.has(uniqueRollKey)) {
        const conflictingStudent = rollCheckMap.get(uniqueRollKey)!;
        setAlertDialog({
          isOpen: true,
          title: "Duplicate Roll Number Violation",
          message: `The Roll Number "${std.rollNo}" in Class "${std.className}" Section "${std.section}" is assigned to more than one student:\n1. "${conflictingStudent.name}" (Adm No: ${conflictingStudent.admissionNo})\n2. "${std.name}" (Adm No: ${std.admissionNo})\n\nPlease ensure every student has a unique roll number inside each class and section.`
        });
        return false;
      }
      rollCheckMap.set(uniqueRollKey, { name: std.name, admissionNo: std.admissionNo });
    }

    const activeSubjects = selectedStruct ? (selectedStruct.subjects || []) : subjects;
    const activeScoreColumns = selectedStruct ? (selectedStruct.scoreColumns || []) : scoreColumns;
    const activeT1ScoreColumns = (selectedStruct?.termSpecificScoreColumnsEnabled && selectedStruct.term1ScoreColumns && selectedStruct.term1ScoreColumns.length > 0)
      ? selectedStruct.term1ScoreColumns
      : activeScoreColumns;
    const activeT2ScoreColumns = (selectedStruct?.termSpecificScoreColumnsEnabled && selectedStruct.term2ScoreColumns && selectedStruct.term2ScoreColumns.length > 0)
      ? selectedStruct.term2ScoreColumns
      : activeScoreColumns;

    const term1Active = selectedStruct
      ? !selectedStruct.scholasticTerm1Disabled
      : (branding?.term1Enabled !== false);
    
    const term2Active = selectedStruct
      ? !selectedStruct.scholasticTerm2Disabled
      : (branding?.term2Enabled !== false);

    const tempStagedChanges: StagedCSVChange[] = [];
    const cleanStr = (s: any) => (s === undefined || s === null ? '' : String(s).trim());
    let countImported = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const row = parseCsvRow(line);
      if (row.length === 0 || !row.some(cell => cell.length > 0)) continue; // skip blank row

      const rollNo = (rollNoMapping && rollNoMapping.idx >= 0) ? row[rollNoMapping.idx] || '' : '';
      const admissionNo = (admissionMapping && admissionMapping.idx >= 0 && row[admissionMapping.idx]) 
        ? row[admissionMapping.idx].trim() 
        : `adm_${Math.random().toString(36).substring(2, 7)}`;
      const name = (nameMapping && nameMapping.idx >= 0 && row[nameMapping.idx]) ? row[nameMapping.idx].trim() : 'Unnamed Student';
      const fatherName = (fatherNameMapping && fatherNameMapping.idx >= 0) ? row[fatherNameMapping.idx] || '' : '';
      const motherName = (motherNameMapping && motherNameMapping.idx >= 0) ? row[motherNameMapping.idx] || '' : '';

      // Enforce active teacher credentials for blank configurations
      const className = (classNameMapping && classNameMapping.idx >= 0 && row[classNameMapping.idx]) 
        ? row[classNameMapping.idx].trim() 
        : (currentRole === 'class_teacher' && activeTeacherObj ? (activeTeacherObj.classTeacherClass || activeTeacherObj.assignedClass) : '3rd');
      const section = (sectionMapping && sectionMapping.idx >= 0 && row[sectionMapping.idx]) 
        ? row[sectionMapping.idx].trim() 
        : (currentRole === 'class_teacher' && activeTeacherObj && activeTeacherObj.assignedSection !== 'All' ? (activeTeacherObj.classTeacherSection || activeTeacherObj.assignedSection) : 'A');

      const dob = (dobMapping && dobMapping.idx >= 0) ? row[dobMapping.idx] || '01-01-2013' : '01-01-2013';
      const height = (heightMapping && heightMapping.idx >= 0) ? row[heightMapping.idx] || '120 CM' : '120 CM';
      const weight = (weightMapping && weightMapping.idx >= 0) ? row[weightMapping.idx] || '40 KG' : '40 KG';
      const remarks = remarksIdx >= 0 ? row[remarksIdx] || '' : '';
      const promotionStatus = promotionIdx >= 0 ? row[promotionIdx] || 'Congratulations!' : 'Congratulations!';
      const photoUrl = photoIdx >= 0 ? row[photoIdx] || '' : '';

      // Override if admission number matches, maintaining local IDs to prevent rendering breakage
      const existingStudent = students.find(s => 
        admissionNo && s.admissionNo.trim().toLowerCase() === admissionNo.trim().toLowerCase()
      );
      const studentId = existingStudent ? existingStudent.id : `stud_csv_${admissionNo}`;

      const studentData: Student = {
        id: studentId,
        name,
        rollNo,
        admissionNo,
        fatherName: formatFatherName(fatherName),
        motherName: formatMotherName(motherName),
        className,
        section,
        dob,
        mobileNumber: (mobileIdx >= 0 && row[mobileIdx]) ? row[mobileIdx].trim() : (existingStudent?.mobileNumber || ''),
        height: formatHeight(height),
        weight: formatWeight(weight),
        remarks,
        promotionStatus,
        photoUrl: photoUrl || "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150"
      };

      // Set other dynamic fields if any
      fieldIndices.forEach(({ field, idx }) => {
        if (idx >= 0 && row[idx] !== undefined && field.id !== 'id') {
          (studentData as any)[field.id] = row[idx].trim();
        }
      });

      // Bootstrap Dynamic Grades
      const attVal = attIdx >= 0 ? row[attIdx] || '' : '';

      // Find if student already has grades, or start a new grades document
      const existingGradesObj = studentGrades.find(g => g.studentId === studentId);
      const stdGrades: StudentGrades = existingGradesObj ? JSON.parse(JSON.stringify(existingGradesObj)) : {
        studentId: studentId,
        scholastic: {},
        co_scholastic: {},
        activity: {},
        attendance: { term1: '', term2: '' }
      };

      stdGrades.attendance = {
        term1: attVal || stdGrades.attendance?.term1 || '',
        term2: attVal || stdGrades.attendance?.term2 || ''
      };

      // Read columns matching layout
      activeSubjects.forEach(sub => {
        const subLower = sub.name.toLowerCase();
        if (sub.type === 'scholastic') {
          if (!stdGrades.scholastic[sub.id]) {
            stdGrades.scholastic[sub.id] = { term1: {}, term2: {} };
          }

          // Find T1 scores from sheet
          if (term1Active) {
            activeT1ScoreColumns.forEach(col => {
              const colLower = col.name.toLowerCase();
              const t1Idx = csvHeaders.findIndex(h => h.includes(subLower) && h.includes('t1') && h.includes(colLower));
              if (t1Idx >= 0 && row[t1Idx] !== undefined && row[t1Idx] !== '') {
                if (!stdGrades.scholastic[sub.id].term1) stdGrades.scholastic[sub.id].term1 = {};
                stdGrades.scholastic[sub.id].term1[col.id] = parseFloat(row[t1Idx]) || 0;
              }
            });
          }

          // Find T2 scores from sheet
          if (term2Active) {
            activeT2ScoreColumns.forEach(col => {
              const colLower = col.name.toLowerCase();
              const t2Idx = csvHeaders.findIndex(h => h.includes(subLower) && (h.includes('t2') || h.includes('term 2')) && h.includes(colLower));
              if (t2Idx >= 0 && row[t2Idx] !== undefined && row[t2Idx] !== '') {
                if (!stdGrades.scholastic[sub.id].term2) stdGrades.scholastic[sub.id].term2 = {};
                stdGrades.scholastic[sub.id].term2[col.id] = parseFloat(row[t2Idx]) || 0;
              }
            });
          }
        } else if (sub.type === 'co_scholastic') {
          const t1Idx = csvHeaders.findIndex(h => h.includes(subLower) && (h.includes('t1') || h.includes('term 1')));
          const t2Idx = csvHeaders.findIndex(h => h.includes(subLower) && (h.includes('t2') || h.includes('term 2')));

          const originalCo = stdGrades.co_scholastic[sub.id] || { term1: 'A', term2: 'A' };
          const t1Val = (term1Active && t1Idx >= 0) ? row[t1Idx] : originalCo.term1;
          const t2Val = (term2Active && t2Idx >= 0) ? row[t2Idx] : originalCo.term2;
          
          stdGrades.co_scholastic[sub.id] = { term1: t1Val || 'A', term2: t2Val || 'A' };
        } else if (sub.type === 'activity') {
          const t1Idx = csvHeaders.findIndex(h => h.includes(subLower) && (h.includes('t1') || h.includes('term 1')));
          const t2Idx = csvHeaders.findIndex(h => h.includes(subLower) && (h.includes('t2') || h.includes('term 2')));

          const originalAct = stdGrades.activity[sub.id] || { term1: 'A', term2: 'A' };
          const t1Val = (term1Active && t1Idx >= 0) ? row[t1Idx] : originalAct.term1;
          const t2Val = (term2Active && t2Idx >= 0) ? row[t2Idx] : originalAct.term2;

          stdGrades.activity[sub.id] = { term1: t1Val || 'A', term2: t2Val || 'A' };
        }
      });

      // Compute Profile and Grade changes list
      const profileChanges: { field: string; old: string; new: string }[] = [];
      const gradeChanges: { subject: string; scoreType: string; old: string; new: string }[] = [];

      if (existingStudent) {
        // Compare profile
        const fieldsToCompare = studentFields.map(f => ({ key: f.id, label: f.label }));
        fieldsToCompare.push({ key: 'mobileNumber', label: 'Parent Mobile' });
        fieldsToCompare.push({ key: 'remarks', label: 'Remarks/Tutor Feed' });
        if (resolvedBrandingForImport?.congratulationsDisabled !== true) {
          fieldsToCompare.push({ key: 'promotionStatus', label: 'Promotion Line' });
        }

        fieldsToCompare.forEach(({ key, label }) => {
          const oldVal = cleanStr((existingStudent as any)[key]);
          const newVal = cleanStr((studentData as any)[key]);
          if (oldVal !== newVal) {
            profileChanges.push({ field: label, old: oldVal || '(empty)', new: newVal || '(empty)' });
          }
        });

        // Compare grades
        if (existingGradesObj) {
          activeSubjects.forEach(sub => {
            if (sub.type === 'scholastic') {
              if (term1Active) {
                activeT1ScoreColumns.forEach(col => {
                  const oldT1 = existingGradesObj.scholastic?.[sub.id]?.term1?.[col.id] ?? 0;
                  const newT1 = stdGrades.scholastic?.[sub.id]?.term1?.[col.id] ?? 0;
                  if (oldT1 !== newT1) {
                    gradeChanges.push({
                      subject: sub.name,
                      scoreType: `Term 1 - ${col.name}`,
                      old: String(oldT1),
                      new: String(newT1)
                    });
                  }
                });
              }
              if (term2Active) {
                activeT2ScoreColumns.forEach(col => {
                  const oldT2 = existingGradesObj.scholastic?.[sub.id]?.term2?.[col.id] ?? 0;
                  const newT2 = stdGrades.scholastic?.[sub.id]?.term2?.[col.id] ?? 0;
                  if (oldT2 !== newT2) {
                    gradeChanges.push({
                      subject: sub.name,
                      scoreType: `Term 2 - ${col.name}`,
                      old: String(oldT2),
                      new: String(newT2)
                    });
                  }
                });
              }
            } else if (sub.type === 'co_scholastic' || sub.type === 'activity') {
              const typeLabel = sub.type === 'co_scholastic' ? 'Co-Scholastic' : 'Co-Curricular';
              const oldGroup = existingGradesObj[sub.type]?.[sub.id];
              const newGroup = stdGrades[sub.type]?.[sub.id];
              
              if (term1Active) {
                const oldVal = oldGroup?.term1 ?? 'A';
                const newVal = newGroup?.term1 ?? 'A';
                if (oldVal !== newVal) {
                  gradeChanges.push({
                    subject: sub.name,
                    scoreType: `${typeLabel} - Term 1 Grade`,
                    old: oldVal,
                    new: newVal
                  });
                }
              }
              if (term2Active) {
                const oldVal = oldGroup?.term2 ?? 'A';
                const newVal = newGroup?.term2 ?? 'A';
                if (oldVal !== newVal) {
                  gradeChanges.push({
                    subject: sub.name,
                    scoreType: `${typeLabel} - Term 2 Grade`,
                    old: oldVal,
                    new: newVal
                  });
                }
              }
            }
          });

          // Compare attendance
          const oldAtt1 = existingGradesObj.attendance?.term1 || '';
          const newAtt1 = stdGrades.attendance?.term1 || '';
          if (oldAtt1 !== newAtt1) {
            gradeChanges.push({
              subject: 'School Attendance',
              scoreType: 'Term 1 Days Present',
              old: oldAtt1 || '(empty)',
              new: newAtt1 || '(empty)'
            });
          }
          const oldAtt2 = existingGradesObj.attendance?.term2 || '';
          const newAtt2 = stdGrades.attendance?.term2 || '';
          if (oldAtt2 !== newAtt2) {
            gradeChanges.push({
              subject: 'School Attendance',
              scoreType: 'Term 2 Days Present',
              old: oldAtt2 || '(empty)',
              new: newAtt2 || '(empty)'
            });
          }
        }
      }

      const alreadyStagedIdx = tempStagedChanges.findIndex(c => 
        admissionNo && c.admissionNo.trim().toLowerCase() === admissionNo.trim().toLowerCase()
      );

      if (alreadyStagedIdx >= 0) {
        // Update the already staged change instead of adding a new one
        tempStagedChanges[alreadyStagedIdx] = {
          ...tempStagedChanges[alreadyStagedIdx],
          studentData,
          gradesData: stdGrades,
          profileChanges: [...tempStagedChanges[alreadyStagedIdx].profileChanges, ...profileChanges],
          gradeChanges: [...tempStagedChanges[alreadyStagedIdx].gradeChanges, ...gradeChanges]
        };
      } else {
        tempStagedChanges.push({
          id: studentId,
          type: existingStudent ? 'update' : 'insert',
          studentName: name,
          admissionNo,
          className,
          section,
          rollNo,
          studentData,
          gradesData: stdGrades,
          profileChanges,
          gradeChanges
        });
        countImported++;
      }
    }

    setStagedChanges(tempStagedChanges);
    setIsStagingPreviewOpen(true);
    setIsImportExpanded(false);
    return true;
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;
        importCsvContent(text);
      } catch (err) {
        console.error("CSV Import Error:", err);
        setAlertDialog({
          isOpen: true,
          title: "Import Error",
          message: "Failed to parse CSV file. Please make sure columns align with the template."
        });
      }
    };
    reader.readAsText(file);
  };

  // Live direct Google Sheet fetching and syncing
  const syncFromGoogleSheets = async () => {
    if (!googleSheetsUrl) {
      setSyncError("Please paste a Google Sheets sharing link.");
      return;
    }

    setSyncError(null);
    setIsSyncing(true);

    try {
      // Regex search for Sheets ID
      const match = googleSheetsUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) {
        throw new Error("Invalid Google Sheets URL structure. Confirm it contains the pattern '/spreadsheets/d/SPREADSHEET_ID'");
      }

      const spreadsheetId = match[1];
      const gidMatch = googleSheetsUrl.match(/[#&]gid=([0-9]+)/);
      const gid = gidMatch ? gidMatch[1] : '0';

      const exportCsvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
      
      const response = await fetch(exportCsvUrl);
      if (!response.ok) {
        throw new Error(`Google Sheet returned HTTP status ${response.status}. Verify that you have selected 'Anyone with the link can view' or Published to web.`);
      }

      const csvText = await response.text();
      if (!csvText || csvText.trim().length === 0) {
        throw new Error("Resulting spreadsheet data returned blank.");
      }

      const success = importCsvContent(csvText);
      if (success) {
        setGoogleSheetsUrl('');
      }

    } catch (err: any) {
      console.error("Google Sheets Sync Error:", err);
      setSyncError(err.message || "Failed to fetch spreadsheet. Confirm standard sharing properties and connection status.");
    } finally {
      setIsSyncing(false);
    }
  };

  const startEditStudent = (student: Student) => {
    setEditingStudent({ ...student });
    const grade = studentGrades.find(g => g.studentId === student.id) || {
      studentId: student.id,
      scholastic: {},
      co_scholastic: {},
      activity: {},
      attendance: { term1: '99/105', term2: '101/105' }
    };
    setEditingGrades({ ...grade });
    setIsEditing(true);
    setActiveTab('profile');
  };

  const startAddNewStudent = () => {
    const limit = maxStudentsLimit ?? 50;
    if (students.length >= limit) {
      setAlertDialog({
        isOpen: true,
        title: "Operational Limit Reached",
        message: `Your school's current plan/trial restricts the student registry size to a maximum of ${limit} student profiles. Please contact the master portal administrator to upgrade your plan.`
      });
      return;
    }

    const cumulativeLimit = maxCumulativeStudentsLimit ?? 100;
    if (cumulativeStudentsCount >= cumulativeLimit) {
      setAlertDialog({
        isOpen: true,
        title: "Cumulative Lifetime Limit Reached",
        message: `Security / Commercial Lock (Strategy 2): Your school has reached the maximum all-time registrations limit of ${cumulativeLimit} student profiles for this subscription. Deleting old profiles does not reset this quota to prevent plan abuse. Please contact the master administrator to upgrade your subscription plan.`
      });
      return;
    }

    const newId = `stud_${Date.now()}`;
    const defaultClass = (currentRole === 'class_teacher' && activeTeacherObj) 
      ? activeTeacherObj.assignedClass 
      : (filterClass !== 'all' 
          ? filterClass 
          : (students && students.length > 0 ? students[0].className : (schoolClasses && schoolClasses.length > 0 ? schoolClasses[0].name : (uniqueClasses[0] || '1st'))));
    const classSecs = getSectionsForClass(defaultClass, schoolClasses, students, reportCardStructures);
    const defaultSec = (currentRole === 'class_teacher' && activeTeacherObj && activeTeacherObj.assignedSection !== 'All') 
      ? activeTeacherObj.assignedSection 
      : ((filterSection !== 'all' && classSecs.some(s => s.toLowerCase() === filterSection.toLowerCase())) 
          ? filterSection 
          : (classSecs[0] || 'A'));

    // Auto-generate a unique next roll number in the same class & section
    const sameClassSecStudents = students.filter(s => 
      s.className.toLowerCase().trim() === defaultClass.toLowerCase().trim() &&
      s.section.toLowerCase().trim() === defaultSec.toLowerCase().trim()
    );
    const rolls = sameClassSecStudents.map(s => parseInt(s.rollNo, 10)).filter(r => !isNaN(r));
    const nextRoll = rolls.length > 0 ? (Math.max(...rolls) + 1) : 1;

    // Auto-generate a unique admission number if active in layout, or leave empty if disabled/deleted
    const isAdmissionActive = isFieldActiveInLayout('admissionNo', defaultClass, defaultSec);
    let initialAdmNo = '';
    if (isAdmissionActive) {
      let nextAdmNum = 100501;
      const adms = students.map(s => parseInt(s.admissionNo, 10)).filter(a => !isNaN(a));
      if (adms.length > 0) {
        nextAdmNum = Math.max(...adms) + 1;
      } else {
        nextAdmNum = Math.floor(Math.random() * 90000) + 10000;
      }
      initialAdmNo = nextAdmNum.toString();
    } else {
      initialAdmNo = '';
    }

    const emptyStudent: Student = {
      id: newId,
      name: '',
      fatherName: '',
      motherName: '',
      className: defaultClass,
      section: defaultSec,
      rollNo: nextRoll.toString(),
      admissionNo: initialAdmNo,
      dob: '01-01-2013',
      mobileNumber: '',
      height: '120 CM',
      weight: '40 KG',
      photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
      remarks: 'Student has excellent creative potential and high participation rates.',
      promotionStatus: 'Congratulations! You are promoted to next class.'
    };

    // Bootstrap Empty Grading values
    const emptyGrades: StudentGrades = {
      studentId: newId,
      scholastic: {},
      co_scholastic: {},
      activity: {},
      attendance: { term1: '95/105', term2: '98/105' }
    };

    subjects.forEach(sub => {
      if (sub.type === 'scholastic') {
        emptyGrades.scholastic[sub.id] = { term1: {}, term2: {} };
        scoreColumns.forEach(col => {
          emptyGrades.scholastic[sub.id].term1[col.id] = 0;
          emptyGrades.scholastic[sub.id].term2[col.id] = 0;
        });
      } else if (sub.type === 'co_scholastic') {
        emptyGrades.co_scholastic[sub.id] = { term1: 'A', term2: 'A' };
      } else if (sub.type === 'activity') {
        emptyGrades.activity[sub.id] = { term1: 'A', term2: 'A' };
      }
    });

    setEditingStudent(emptyStudent);
    setEditingGrades(emptyGrades);
    setIsEditing(true);
    setActiveTab('profile');
  };

  const saveStudentChanges = () => {
    if (!editingStudent || !editingGrades) return;
    if (!editingStudent.name.trim()) {
      setAlertDialog({
        isOpen: true,
        title: "Validation Error",
        message: "Name field cannot be left blank."
      });
      return;
    }

    const cleanAdmissionNo = (editingStudent.admissionNo || '').trim();
    const cleanRollNo = (editingStudent.rollNo || '').trim();
    const cleanClassName = (editingStudent.className || '').trim();
    const cleanSection = (editingStudent.section || '').trim();

    const isAdmissionActive = isFieldActiveInLayout('admissionNo', cleanClassName, cleanSection);

    let finalAdmissionNo = cleanAdmissionNo;
    if (!isAdmissionActive) {
      // Admission number is deleted or disabled in layout: do not force user input
      if (!finalAdmissionNo) {
        finalAdmissionNo = `adm_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
      }
    } else {
      // Admission number IS active in layout
      if (!cleanAdmissionNo) {
        setAlertDialog({
          isOpen: true,
          title: "Validation Error",
          message: "Admission Number is required and cannot be left blank. (If your school does not use admission numbers, you can delete or disable it under Report Card Layout / School Settings)."
        });
        return;
      }
    }

    if (!cleanRollNo) {
      setAlertDialog({
        isOpen: true,
        title: "Validation Error",
        message: "Roll Number is required and cannot be left blank."
      });
      return;
    }

    // Check duplicate admissionNo school-wide only if an admission number is active and not an auto-generated internal ID
    if (isAdmissionActive && cleanAdmissionNo && !cleanAdmissionNo.startsWith('adm_')) {
      const duplicateAdmission = students.find(s => 
        s.id !== editingStudent.id && 
        s.admissionNo && 
        s.admissionNo.trim().toLowerCase() === cleanAdmissionNo.toLowerCase()
      );
      if (duplicateAdmission) {
        setAlertDialog({
          isOpen: true,
          title: "Duplicate Admission Number",
          message: `An active student "${duplicateAdmission.name}" already exists with Admission No. "${cleanAdmissionNo}". Every student must have a unique admission number.`
        });
        return;
      }
    }

    // Check duplicate rollNo within same class standard and section (Natural uniqueness key)
    const duplicateRoll = students.find(s => 
      s.id !== editingStudent.id && 
      classesMatch(s.className, cleanClassName) && 
      s.section.trim().toLowerCase() === cleanSection.toLowerCase() && 
      s.rollNo.trim().toLowerCase() === cleanRollNo.toLowerCase()
    );
    if (duplicateRoll) {
      setAlertDialog({
        isOpen: true,
        title: "Duplicate Roll Number",
        message: `A student "${duplicateRoll.name}" already exists with Roll No. "${cleanRollNo}" in Class "${cleanClassName}" Section "${cleanSection}". Roll numbers must be unique within each class standard and section.`
      });
      return;
    }

    if (currentRole === 'class_teacher' && activeTeacherObj) {
      const assignedClassClean = (activeTeacherObj.assignedClass || '').trim().toLowerCase();
      const sClassClean = (editingStudent.className || '').trim().toLowerCase();
      
      const assignedSecClean = (activeTeacherObj.assignedSection || '').trim().toLowerCase();
      const sSecClean = (editingStudent.section || '').trim().toLowerCase();

      const hasClassConflict = sClassClean !== assignedClassClean;
      const hasSecConflict = assignedSecClean !== 'all' && sSecClean !== assignedSecClean;

      if (hasClassConflict || hasSecConflict) {
        setAlertDialog({
          isOpen: true,
          title: "Permission Denied: Unauthorized Cohort Change",
          message: `As a Class Teacher, you can only manage students belonging to Class "${activeTeacherObj.assignedClass}" ${activeTeacherObj.assignedSection !== 'All' ? `Section "${activeTeacherObj.assignedSection}"` : 'All Sections'}. Your changes were blocked.`
        });
        return;
      }
    }

    setIsSavingStudent(true);

    const finalizedStudent: Student = {
      ...editingStudent,
      admissionNo: finalAdmissionNo,
      rollNo: cleanRollNo,
      fatherName: formatFatherName(editingStudent.fatherName),
      motherName: formatMotherName(editingStudent.motherName),
      height: formatHeight(editingStudent.height),
      weight: formatWeight(editingStudent.weight)
    };

    const exists = students.some(s => s.id === finalizedStudent.id);
    let updatedStudentsList: Student[];
    let updatedGradesList: StudentGrades[];

    if (exists) {
      updatedStudentsList = students.map(s => s.id === finalizedStudent.id ? finalizedStudent : s);
      updatedGradesList = studentGrades.map(g => g.studentId === finalizedStudent.id ? editingGrades : g);
    } else {
      const limit = maxStudentsLimit ?? 50;
      if (students.length >= limit) {
        setAlertDialog({
          isOpen: true,
          title: "Operational Limit Reached",
          message: `Your school's current plan/trial restricts the student registry size to a maximum of ${limit} student profiles. Please contact the master portal administrator to upgrade your plan.`
        });
        setIsSavingStudent(false);
        return;
      }
      const cumulativeLimit = maxCumulativeStudentsLimit ?? 100;
      if (cumulativeStudentsCount >= cumulativeLimit) {
        setAlertDialog({
          isOpen: true,
          title: "Cumulative Lifetime Limit Reached",
          message: `Security / Commercial Lock (Strategy 2): Your school has reached the maximum all-time registrations limit of ${cumulativeLimit} student profiles for this subscription. Deleting old profiles does not reset this quota to prevent plan abuse. Please contact the master administrator to upgrade your subscription plan.`
        });
        setIsSavingStudent(false);
        return;
      }
      updatedStudentsList = [...students, finalizedStudent];
      updatedGradesList = [...studentGrades, editingGrades];
      onIncrementCumulativeCount?.(1);
    }

    // 1. Immediately update parent state
    onUpdateStudents(updatedStudentsList);
    onUpdateGrades(updatedGradesList);

    // 2. Resolve effective school ID and write immediately to local storage and Cloud Firestore
    const effectiveSchoolId = currentSchoolId || localStorage.getItem('class_on_saas_school_id') || '';
    if (effectiveSchoolId) {
      try {
        localStorage.setItem(`class_on_students_${effectiveSchoolId}`, JSON.stringify(updatedStudentsList));
        localStorage.setItem(`class_on_student_grades_${effectiveSchoolId}`, JSON.stringify(updatedGradesList));
        localStorage.setItem(`class_on_last_saved_at_${effectiveSchoolId}`, new Date().toISOString());
      } catch (e) {
        console.warn("[Local Storage] Student persistence notice:", e);
      }
      saveIndividualStudentToCloud(effectiveSchoolId, finalizedStudent).catch(err => {
        console.warn("[Student Save] Cloud individual sync notice:", err);
      });
      saveIndividualGradesToCloud(effectiveSchoolId, editingGrades).catch(err => {
        console.warn("[Student Save] Cloud grades sync notice:", err);
      });
      saveStudentsBatchToCloud(effectiveSchoolId, updatedStudentsList, updatedGradesList).catch(err => {
        console.warn("[Student Save] Cloud sync background notice:", err);
      });
    }

    setIsSavingStudent(false);
    setIsEditing(false);
    
    // Auto preview saved student
    onSelectStudent(finalizedStudent.id);
  };

  const removeStudentRecord = (id: string) => {
    const targetStudent = students.find(s => s.id === id);
    if (!targetStudent) return;
    
    const targetGrades = studentGrades.find(g => g.studentId === id);

    setConfirmDialog({
      isOpen: true,
      title: "Move to Recycle Bin?",
      message: `Are you sure you want to delete ${targetStudent.name}? This will move their profile and grades to the Recycle Bin, where they can be recovered.`,
      onConfirm: () => {
        const binItem: RecycleBinItem = {
          id: `recycle_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          type: 'student',
          deletedAt: new Date().toISOString(),
          description: `Student Profile & Grades: ${targetStudent.name} (ADM: ${targetStudent.admissionNo}) - Class ${targetStudent.className} ${targetStudent.section}`,
          payload: {
            students: [targetStudent],
            studentGrades: targetGrades ? [targetGrades] : []
          }
        };

        const updatedBin = [binItem, ...recycleBin];
        updateRecycleBin(updatedBin);

        const remainingStudents = students.filter(s => s.id !== id);
        const remainingGrades = studentGrades.filter(g => g.studentId !== id);
        onUpdateStudents(remainingStudents);
        onUpdateGrades(remainingGrades);
        if (selectedStudentId === id) {
          onSelectStudent(null);
        }

        const effectiveSchoolId = currentSchoolId || localStorage.getItem('class_on_saas_school_id') || '';
        if (effectiveSchoolId) {
          try {
            localStorage.setItem(`class_on_students_${effectiveSchoolId}`, JSON.stringify(remainingStudents));
            localStorage.setItem(`class_on_student_grades_${effectiveSchoolId}`, JSON.stringify(remainingGrades));
            localStorage.setItem(`class_on_last_saved_at_${effectiveSchoolId}`, new Date().toISOString());
          } catch {}
          saveStudentsBatchToCloud(effectiveSchoolId, remainingStudents, remainingGrades).catch(err => {
            console.warn("[Student Delete] Cloud batch sync notice:", err);
          });
          deleteIndividualStudentFromCloud(effectiveSchoolId, id).catch(err => {
            console.warn("[Student Delete] Cloud sync notice:", err);
          });
        }

        // Show instant success notification
        showToast(`Student "${targetStudent.name}" has been deleted and moved to the Recycle Bin.`);
      }
    });
  };

  const handleRestoreRecycleItem = (item: RecycleBinItem) => {
    try {
      if (item.type === 'student') {
        const restoredStudent = item.payload.students?.[0];
        if (!restoredStudent) throw new Error("No student record found in payload.");

        // Check if student with same admission number, ID, or Class-Section-RollNo already exists
        const exists = students.some(s => 
          s.id === restoredStudent.id ||
          (restoredStudent.admissionNo && s.admissionNo.trim().toLowerCase() === restoredStudent.admissionNo.trim().toLowerCase()) ||
          (restoredStudent.rollNo && 
           s.className.trim().toLowerCase() === restoredStudent.className.trim().toLowerCase() && 
           s.section.trim().toLowerCase() === restoredStudent.section.trim().toLowerCase() && 
           s.rollNo.trim().toLowerCase() === restoredStudent.rollNo.trim().toLowerCase())
        );
        if (exists) {
          throw new Error(`A student with Admission No "${restoredStudent.admissionNo}" or Roll No "${restoredStudent.rollNo}" in Class "${restoredStudent.className}" Section "${restoredStudent.section}" already exists in the active database. Restoring would create a conflict.`);
        }

        // Add back student
        const updatedStudents = [...students, restoredStudent];
        onUpdateStudents(updatedStudents);

        // Add back grades if present
        const restoredGrades = item.payload.studentGrades?.[0];
        if (restoredGrades) {
          const updatedGrades = [...studentGrades.filter(g => g.studentId !== restoredStudent.id), restoredGrades];
          onUpdateGrades(updatedGrades);
        }

        // Remove from recycle bin
        updateRecycleBin(recycleBin.filter(i => i.id !== item.id));
        setBulkDeleteSuccess(`Successfully restored ${restoredStudent.name} (${restoredStudent.admissionNo}) from the Recycle Bin!`);
      } 
      else if (item.type === 'class_purge_option3') {
        const restoredStudents = item.payload.students || [];
        const restoredGrades = item.payload.studentGrades || [];

        if (restoredStudents.length === 0) {
          throw new Error("No student records found in payload.");
        }

        // Check for duplicates
        const existingAdmissionNos = new Set(students.map(s => s.admissionNo.trim().toLowerCase()));
        const existingRollClassSecs = new Set(students.map(s => `${s.className.trim().toLowerCase()}_${s.section.trim().toLowerCase()}_${s.rollNo.trim().toLowerCase()}`));
        
        const duplicates = restoredStudents.filter(s => 
          existingAdmissionNos.has(s.admissionNo.trim().toLowerCase()) ||
          existingRollClassSecs.has(`${s.className.trim().toLowerCase()}_${s.section.trim().toLowerCase()}_${s.rollNo.trim().toLowerCase()}`)
        );
        if (duplicates.length > 0) {
          throw new Error(`Conflict: ${duplicates.length} of the students to restore already exist (e.g., ADM No: ${duplicates[0].admissionNo}, or same Roll Number inside Class & Section). Please delete or rename the conflicting active records first.`);
        }

        // Batch restore
        onUpdateStudents([...students, ...restoredStudents]);
        
        // Match restored grades by ID, replace any that exist or insert
        const restoredStudentIds = new Set(restoredStudents.map(s => s.id));
        const filteredActiveGrades = studentGrades.filter(g => !restoredStudentIds.has(g.studentId));
        onUpdateGrades([...filteredActiveGrades, ...restoredGrades]);

        // Remove from recycle bin
        updateRecycleBin(recycleBin.filter(i => i.id !== item.id));
        setBulkDeleteSuccess(`Successfully restored bulk purge: ${restoredStudents.length} student profiles and their associated grade sheets!`);
      } 
      else if (item.type === 'class_purge_option2') {
        const restoredGrades = item.payload.studentGrades || [];
        if (restoredGrades.length === 0) {
          throw new Error("No grade records found in payload.");
        }

        // Overwrite or merge grades back
        const restoredGradeStudentIds = new Set(restoredGrades.map(g => g.studentId));
        const updatedGrades = studentGrades.map(grade => {
          if (restoredGradeStudentIds.has(grade.studentId)) {
            const originalGrade = restoredGrades.find(g => g.studentId === grade.studentId);
            return originalGrade || grade;
          }
          return grade;
        });

        onUpdateGrades(updatedGrades);

        // Remove from recycle bin
        updateRecycleBin(recycleBin.filter(i => i.id !== item.id));
        setBulkDeleteSuccess(`Successfully restored cleared grades for ${restoredGrades.length} students to their original marks!`);
      }
    } catch (err: any) {
      setBulkDeleteError(err?.message || "Failed to restore item from Recycle Bin.");
    }
  };

  const handleDeletePermanently = (itemId: string) => {
    setRecycleConfirmId(itemId);
    setRecycleConfirmInput('');
    setIsRecycleConfirmOpen(true);
  };

  const handleClearRecycleBin = () => {
    setRecycleConfirmId('all');
    setRecycleConfirmInput('');
    setIsRecycleConfirmOpen(true);
  };

  const executeRecycleBinDeletion = () => {
    const upperInput = recycleConfirmInput.trim().toUpperCase();
    if (upperInput !== 'CONFIRM' && upperInput !== 'DELETE') return;
    if (recycleConfirmId === 'all') {
      updateRecycleBin([]);
      setBulkDeleteSuccess("Recycle Bin emptied successfully.");
      showToast("Recycle Bin emptied successfully.");
    } else if (recycleConfirmId) {
      updateRecycleBin(recycleBin.filter(i => i.id !== recycleConfirmId));
      setBulkDeleteSuccess("Item permanently purged from Recycle Bin.");
      showToast("Item permanently purged from Recycle Bin.");
    }
    setIsRecycleConfirmOpen(false);
    setRecycleConfirmId(null);
    setRecycleConfirmInput('');
  };

  const handleCommitStagedChanges = () => {
    if (stagedChanges.length === 0) return;

    // Verify limit first
    const limit = maxStudentsLimit ?? 50;
    const existingAdmissionNos = new Set(students.map(s => s.admissionNo.trim().toLowerCase()));
    const existingRollClassSecs = new Set(students.map(s => `${s.className.trim().toLowerCase()}_${s.section.trim().toLowerCase()}_${s.rollNo.trim().toLowerCase()}`));
    
    const newProfilesCount = stagedChanges.filter(c => 
      c.type === 'insert' && 
      !existingAdmissionNos.has(c.admissionNo.trim().toLowerCase()) && 
      !existingRollClassSecs.has(`${c.className.trim().toLowerCase()}_${c.section.trim().toLowerCase()}_${c.rollNo.trim().toLowerCase()}`)
    ).length;
    const currentCount = students.length;
    
    if (currentCount + newProfilesCount > limit) {
      setAlertDialog({
        isOpen: true,
        title: "Operational Limit Reached",
        message: `Your imported sheet contains ${newProfilesCount} new student profiles, which would exceed your school's current plan/trial limit of ${limit} student profiles (currently active: ${currentCount}). Please contact the master portal administrator to upgrade your plan.`
      });
      return;
    }

    const cumulativeLimit = maxCumulativeStudentsLimit ?? 100;
    if (cumulativeStudentsCount + newProfilesCount > cumulativeLimit) {
      setAlertDialog({
        isOpen: true,
        title: "Cumulative Lifetime Limit Reached",
        message: `Security / Commercial Lock (Strategy 2): Your imported sheet contains ${newProfilesCount} new student profiles, which would exceed your school's maximum all-time registrations limit of ${cumulativeLimit} student profiles (current cumulative count: ${cumulativeStudentsCount}). Deleting old profiles does not reset this quota to prevent plan abuse. Please contact the master administrator to upgrade your subscription plan.`
      });
      return;
    }

    const newStudents: Student[] = [...students];
    const newGradesList: StudentGrades[] = [...studentGrades];

    stagedChanges.forEach(change => {
      // Apply Student Profile - match by ID, Admission Number, or Class-Section-RollNo
      const existingStudentIdx = newStudents.findIndex(s => 
        s.id === change.id || 
        (change.admissionNo && s.admissionNo.trim().toLowerCase() === change.admissionNo.trim().toLowerCase()) ||
        (change.rollNo && 
         s.className.trim().toLowerCase() === change.className.trim().toLowerCase() && 
         s.section.trim().toLowerCase() === change.section.trim().toLowerCase() && 
         s.rollNo.trim().toLowerCase() === change.rollNo.trim().toLowerCase())
      );
      if (existingStudentIdx >= 0) {
        newStudents[existingStudentIdx] = change.studentData;
      } else {
        newStudents.push(change.studentData);
      }

      // Apply Student Grades
      const existingGradesIdx = newGradesList.findIndex(g => g.studentId === change.id);
      if (existingGradesIdx >= 0) {
        newGradesList[existingGradesIdx] = change.gradesData;
      } else {
        newGradesList.push(change.gradesData);
      }
    });

    onUpdateStudents(newStudents);
    onUpdateGrades(newGradesList);
    const effectiveSchoolId = currentSchoolId || localStorage.getItem('class_on_saas_school_id') || '';
    if (effectiveSchoolId) {
      try {
        localStorage.setItem(`class_on_students_${effectiveSchoolId}`, JSON.stringify(newStudents));
        localStorage.setItem(`class_on_student_grades_${effectiveSchoolId}`, JSON.stringify(newGradesList));
        localStorage.setItem(`class_on_last_saved_at_${effectiveSchoolId}`, new Date().toISOString());
      } catch {}
      saveStudentsBatchToCloud(effectiveSchoolId, newStudents, newGradesList).catch(err => {
        console.warn("[Staged CSV Commit] Cloud sync notice:", err);
      });
    }
    if (newProfilesCount > 0) {
      onIncrementCumulativeCount?.(newProfilesCount);
    }
    setImportStatus(`Successfully applied, committed, and synced ${stagedChanges.length} student records/grades to database!`);

    // Reset staging state
    setStagedChanges([]);
    setIsStagingPreviewOpen(false);

    setTimeout(() => {
      setImportStatus(null);
    }, 5000);
  };

  const updateScholasticMark = (subId: string, term: 'term1' | 'term2' | 'term3', colId: string, val: number | string) => {
    if (!editingGrades) return;
    const copied = { ...editingGrades };
    if (!copied.scholastic[subId]) {
      copied.scholastic[subId] = { term1: {}, term2: {}, term3: {} };
    }
    if (!copied.scholastic[subId][term]) {
      copied.scholastic[subId][term] = {};
    }
    copied.scholastic[subId][term][colId] = val;
    setEditingGrades(copied);
  };

  const handleBulkDeleteClasses = () => {
    if (selectedClassSectionsToDelete.length === 0) {
      setBulkDeleteError('Please select at least one class & section to purge.');
      return;
    }
    if (deleteConfirmationText !== 'CONFIRM') {
      setBulkDeleteError('Please type "CONFIRM" exactly to authorize the bulk delete action.');
      return;
    }

    setIsDeletingBulk(true);
    setBulkDeleteError(null);
    setBulkDeleteSuccess(null);

    try {
      const isMatch = (studentClass: string, studentSec: string) => {
        return selectedClassSectionsToDelete.some(sel => {
          const cleanC1 = (studentClass || '').toLowerCase().trim();
          const cleanC2 = (sel.className || '').toLowerCase().trim();
          const cleanS1 = (studentSec || '').toLowerCase().trim();
          const cleanS2 = (sel.section || '').toLowerCase().trim();
          return cleanC1 === cleanC2 && cleanS1 === cleanS2;
        });
      };

      const targetLabels = selectedClassSectionsToDelete.map(sel => 
        `Class ${sel.className}${sel.section ? ` - Sec ${sel.section}` : ' (No Section)'}`
      ).join(', ');

      if (deletionOption === 'option2') {
        // OPTION 2: Reset grades/marks, keep student profiles
        const studentsInSelection = students.filter(s => isMatch(s.className, s.section));
        const studentIdsInSelection = new Set(studentsInSelection.map(s => s.id));

        // Save original grades to Recycle Bin before clearing
        const originalGradesToSave = studentGrades.filter(g => studentIdsInSelection.has(g.studentId));
        if (originalGradesToSave.length > 0) {
          const binItem: RecycleBinItem = {
            id: `recycle_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            type: 'class_purge_option2',
            deletedAt: new Date().toISOString(),
            description: `Bulk Grade Reset (Marks Cleared) for: ${targetLabels} - ${originalGradesToSave.length} records affected`,
            payload: {
              studentGrades: originalGradesToSave
            }
          };
          updateRecycleBin([binItem, ...recycleBin]);
        }

        const updatedGrades = studentGrades.map(grade => {
          if (studentIdsInSelection.has(grade.studentId)) {
            return {
              ...grade,
              scholastic: {},
              co_scholastic: {},
              activity: {},
              attendance: { term1: '', term2: '', term3: '' }
            };
          }
          return grade;
        });

        onUpdateGrades(updatedGrades);
        if (currentSchoolId) {
          try {
            localStorage.setItem(`class_on_student_grades_${currentSchoolId}`, JSON.stringify(updatedGrades));
            localStorage.setItem(`class_on_last_saved_at_${currentSchoolId}`, new Date().toISOString());
          } catch {}
          saveStudentsBatchToCloud(currentSchoolId, students, updatedGrades).catch(err => console.warn(err));
        }
        const msg = `Option 2 Successful: Cleared results/grades for ${studentsInSelection.length} student records across: ${targetLabels}. Saved original grades to Recycle Bin for safety!`;
        setBulkDeleteSuccess(msg);
        showToast(msg);
      } else if (deletionOption === 'option3') {
        // OPTION 3: Complete Class Deletion (Delete student profiles and grades)
        const studentsToRemove = students.filter(s => isMatch(s.className, s.section));
        const studentIdsToRemove = new Set(studentsToRemove.map(s => s.id));
        const gradesToRemove = studentGrades.filter(g => studentIdsToRemove.has(g.studentId));

        if (studentsToRemove.length > 0) {
          const binItem: RecycleBinItem = {
            id: `recycle_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            type: 'class_purge_option3',
            deletedAt: new Date().toISOString(),
            description: `Bulk Class Section Purge (Profiles & Grades) for: ${targetLabels} - ${studentsToRemove.length} profiles wiped`,
            payload: {
              students: studentsToRemove,
              studentGrades: gradesToRemove
            }
          };
          updateRecycleBin([binItem, ...recycleBin]);
        }

        const remainingStudents = students.filter(s => !isMatch(s.className, s.section));
        const remainingGrades = studentGrades.filter(g => !studentIdsToRemove.has(g.studentId));

        onUpdateStudents(remainingStudents);
        onUpdateGrades(remainingGrades);

        const effectiveSchoolId = currentSchoolId || localStorage.getItem('class_on_saas_school_id') || '';
        if (effectiveSchoolId) {
          try {
            localStorage.setItem(`class_on_students_${effectiveSchoolId}`, JSON.stringify(remainingStudents));
            localStorage.setItem(`class_on_student_grades_${effectiveSchoolId}`, JSON.stringify(remainingGrades));
            localStorage.setItem(`class_on_last_saved_at_${effectiveSchoolId}`, new Date().toISOString());
          } catch {}
          saveStudentsBatchToCloud(effectiveSchoolId, remainingStudents, remainingGrades).catch(err => console.warn(err));
          studentIdsToRemove.forEach(stdId => {
            deleteIndividualStudentFromCloud(effectiveSchoolId, stdId).catch(err => console.warn(err));
          });
        }

        const msg = `Option 3 Successful: Wiped out ${studentsToRemove.length} student registration profiles and their associated results/grades across: ${targetLabels}. Saved everything to Recycle Bin for safety!`;
        setBulkDeleteSuccess(msg);
        showToast(msg);
      }

      // Reset state inputs
      setSelectedClassSectionsToDelete([]);
      setDeleteConfirmationText('');
    } catch (err: any) {
      setBulkDeleteError(err?.message || 'Failed to complete bulk deletion.');
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const handleBulkPromotion = () => {
    if (!promotionSourceClass || !promotionTargetClass) {
      setPromotionError("Please select both a source class standard and type/select a target class standard.");
      return;
    }

    const sourceClassClean = promotionSourceClass.trim().toLowerCase();
    const targetClassClean = promotionTargetClass.trim().toLowerCase();
    
    if (sourceClassClean === targetClassClean && promotionSourceSection === promotionTargetSection) {
      setPromotionError("Source and target class standard and section must be different.");
      return;
    }

    setIsPromoting(true);
    setPromotionError(null);
    setPromotionSuccess(null);

    setTimeout(() => {
      try {
        // Find students in the source class/section
        const targetStudents = students.filter(s => {
          const matchClass = (s.className || '').trim().toLowerCase() === sourceClassClean;
          const matchSec = promotionSourceSection === 'all' || (s.section || '').trim().toLowerCase() === promotionSourceSection.trim().toLowerCase();
          return matchClass && matchSec;
        });

        if (targetStudents.length === 0) {
          throw new Error(`No registered students found matching Class "${promotionSourceClass}" ${promotionSourceSection !== 'all' ? `Section "${promotionSourceSection}"` : '(All Sections)'}.`);
        }

        const archiveSessionNameNormalized = (currentSessionToArchive || branding.session || "Session 2026-2027").trim();

        // Map and update className, section, promotionStatus and History Archive
        const updatedStudents = students.map(s => {
          const matchClass = (s.className || '').trim().toLowerCase() === sourceClassClean;
          const matchSec = promotionSourceSection === 'all' || (s.section || '').trim().toLowerCase() === promotionSourceSection.trim().toLowerCase();
          
          if (matchClass && matchSec) {
            const studentCurrentGrades = studentGrades.find(g => g.studentId === s.id);
            const archivedRecord = {
              session: archiveSessionNameNormalized,
              className: s.className,
              section: s.section,
              rollNo: s.rollNo,
              remarks: s.remarks || '',
              promotionStatus: promotionStatusText || `Promoted to ${promotionTargetClass.trim()} ${promotionTargetSection.trim() || s.section}`,
              grades: studentCurrentGrades ? { ...studentCurrentGrades } : undefined
            };

            const updatedHistory = [
              ...(s.history || []).filter(h => h.session !== archiveSessionNameNormalized),
              archivedRecord
            ];

            return {
              ...s,
              className: promotionTargetClass.trim(),
              section: promotionTargetSection.trim() ? promotionTargetSection.trim() : s.section,
              promotionStatus: '', // reset active status for fresh start
              remarks: '', // reset remarks
              history: updatedHistory
            };
          }
          return s;
        });

        // Reset active grades of promoted students for the new academic session standard
        const promotedStudentIds = new Set(targetStudents.map(ts => ts.id));
        const updatedGrades = studentGrades.map(g => {
          if (promotedStudentIds.has(g.studentId)) {
            return {
              studentId: g.studentId,
              scholastic: {},
              co_scholastic: {},
              activity: {},
              attendance: { term1: "", term2: "" }
            } as StudentGrades;
          }
          return g;
        });

        onUpdateStudents(updatedStudents);
        onUpdateGrades(updatedGrades);

        const effectiveSchoolId = currentSchoolId || localStorage.getItem('class_on_saas_school_id') || '';
        if (effectiveSchoolId) {
          try {
            localStorage.setItem(`class_on_students_${effectiveSchoolId}`, JSON.stringify(updatedStudents));
            localStorage.setItem(`class_on_student_grades_${effectiveSchoolId}`, JSON.stringify(updatedGrades));
            localStorage.setItem(`class_on_last_saved_at_${effectiveSchoolId}`, new Date().toISOString());
          } catch {}
          saveStudentsBatchToCloud(effectiveSchoolId, updatedStudents, updatedGrades).catch(err => console.warn(err));
        }

        // Rollover school branding session if selected
        if (shouldUpdateSchoolSession && newSessionName && onUpdateBranding) {
          onUpdateBranding({
            ...branding,
            session: newSessionName.trim()
          });
        }

        setPromotionSuccess(`Successfully promoted ${targetStudents.length} students from Class ${promotionSourceClass} ${promotionSourceSection !== 'all' ? `Sec ${promotionSourceSection}` : '(All Sections)'} to Class ${promotionTargetClass.trim()} Section "${promotionTargetSection.trim() || 'same'}"! Current results were successfully archived under "${archiveSessionNameNormalized}", active grade sheets were cleared, and the active session has been rolled over to "${newSessionName.trim()}".`);
        
        // Reset selections
        setPromotionSourceClass('');
        setPromotionSourceSection('all');
        setPromotionTargetClass('');
        setPromotionTargetSection('');
      } catch (err: any) {
        setPromotionError(err.message || "Failed to execute bulk class promotion.");
      } finally {
        setIsPromoting(false);
      }
    }, 1000);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-2.5 sm:p-5 lg:p-6 space-y-4 sm:space-y-5 w-full max-w-full overflow-hidden">
      
      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-[999999] flex flex-col gap-3 pointer-events-none">
          <div className={`p-4 ${toastType === 'success' ? 'bg-emerald-600' : toastType === 'error' ? 'bg-rose-600' : 'bg-indigo-600'} text-white text-xs font-bold rounded-2xl flex items-center gap-3 shadow-2xl border ${toastType === 'success' ? 'border-emerald-500' : toastType === 'error' ? 'border-rose-500' : 'border-indigo-500'} max-w-sm animate-slideInRight pointer-events-auto`}>
            {toastType === 'success' ? (
              <CheckCircle className="w-5 h-5 shrink-0 bg-white/20 p-0.5 rounded-full text-white" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 bg-white/20 p-0.5 rounded-full text-white" />
            )}
            <div>{toastMessage}</div>
            <button type="button" onClick={() => setToastMessage(null)} className="ml-auto text-white/70 hover:text-white font-extrabold text-sm bg-transparent border-0 cursor-pointer select-none">&times;</button>
          </div>
        </div>
      )}

      {isReadOnly && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3 shadow-sm no-print">
          <span className="text-xl shrink-0 select-none">📂</span>
          <div className="space-y-1 text-left flex-grow">
            <h4 className="text-xs font-black uppercase text-indigo-950 tracking-wide">Historical Archive Viewer (Read-Only)</h4>
            <p className="text-[11px] text-indigo-800 leading-normal font-sans">
              You are currently inspecting student files and exam grades for <strong>{selectedSession || "an archived session"}</strong>. All active operations (register updates, CSV uploads, profile editing, and promotions) are disabled in this view.
            </p>
            {selectedSession && onRestoreSession && (currentRole === 'school_admin' || currentRole === 'main_admin') && (
              <div className="pt-1.5">
                <button
                  onClick={() => {
                    if (confirm(`Are you sure you want to restore the archived session "${selectedSession}" as the active session? This will restore students' original classes, previous grades, and remove this archived record from their history.`)) {
                      onRestoreSession(selectedSession);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg shadow-sm transition-all cursor-pointer"
                >
                  🔄 Restore This Session as Active
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header and Bulk functions */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div className="w-full text-left">
          <h2 className="text-lg sm:text-xl font-bold font-sans text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600 animate-pulse shrink-0" />
            <span className="truncate">Students Registry Book & Database</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
            {isReadOnly 
              ? `Inspecting and exporting archived reports database for ${selectedSession}.`
              : "Manual edits or Excel-compatible CSV template bulk imports. Check results on the live layout dynamically."}
          </p>
        </div>

        <div className="grid grid-cols-2 min-[500px]:grid-cols-2 sm:grid-cols-3 xl:flex xl:flex-row xl:items-center xl:flex-wrap gap-2.5 w-full xl:w-auto">
          {!isReadOnly && (
            <button
              onClick={() => {
                setIsImportExpanded(!isImportExpanded);
                setIsExportPanelOpen(false);
                setIsPhotoBulkExpanded(false);
                setIsBulkDeleteExpanded(false);
                setIsPromotionExpanded(false);
                setIsClasswiseBreakdownExpanded(false);
                setIsRecycleBinExpanded(false);
                setIsFastEntryOpen(false);
              }}
              id="bulk_csv_import_btn"
              className={`w-full xl:w-auto flex items-center justify-center gap-1.5 border font-semibold text-xs px-3 py-2.5 rounded-lg transition-all cursor-pointer ${
                isImportExpanded
                  ? 'border-indigo-400 bg-indigo-100 text-indigo-900 font-extrabold shadow-inner'
                  : 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-850'
              }`}
            >
              <Upload className="w-4 h-4 shrink-0" /> <span className="truncate">Bulk CSV Upload</span>
            </button>
          )}

          <button
            onClick={() => {
              setIsExportPanelOpen(!isExportPanelOpen);
              setIsImportExpanded(false);
              setIsPhotoBulkExpanded(false);
              setIsBulkDeleteExpanded(false);
              setIsPromotionExpanded(false);
              setIsClasswiseBreakdownExpanded(false);
              setIsRecycleBinExpanded(false);
              setIsFastEntryOpen(false);
            }}
            id="bulk_export_classwise_btn"
            className={`w-full xl:w-auto flex items-center justify-center gap-1.5 border font-semibold text-xs px-3 py-2.5 rounded-lg transition-all cursor-pointer ${
              isExportPanelOpen
                ? 'border-amber-400 bg-amber-100 text-amber-900 font-extrabold shadow-inner'
                : 'border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-850'
            }`}
          >
            <Download className="w-4 h-4 text-amber-600 shrink-0" /> <span className="truncate">Export Classwise</span>
          </button>

          <button
            onClick={() => {
              setIsClasswiseBreakdownExpanded(!isClasswiseBreakdownExpanded);
              setIsExportPanelOpen(false);
              setIsImportExpanded(false);
              setIsPhotoBulkExpanded(false);
              setIsBulkDeleteExpanded(false);
              setIsPromotionExpanded(false);
              setIsRecycleBinExpanded(false);
              setIsFastEntryOpen(false);
            }}
            id="classwise_strength_breakdown_btn"
            className={`w-full xl:w-auto flex items-center justify-center gap-1.5 border font-semibold text-xs px-3 py-2.5 rounded-lg transition-all cursor-pointer ${
              isClasswiseBreakdownExpanded 
                ? 'border-indigo-300 bg-indigo-100 text-indigo-900 font-extrabold shadow-inner' 
                : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800'
            }`}
          >
            <Users className="w-4 h-4 text-indigo-600 shrink-0" /> <span className="truncate">Classwise Counts</span>
          </button>

          {!isReadOnly && (
            <>
              <button
                onClick={() => {
                  setIsPhotoBulkExpanded(!isPhotoBulkExpanded);
                  setIsExportPanelOpen(false);
                  setIsImportExpanded(false);
                  setIsBulkDeleteExpanded(false);
                  setIsPromotionExpanded(false);
                  setIsClasswiseBreakdownExpanded(false);
                  setIsRecycleBinExpanded(false);
                  setIsFastEntryOpen(false);
                }}
                id="bulk_photo_import_btn"
                className={`w-full xl:w-auto flex items-center justify-center gap-1.5 border font-semibold text-xs px-3 py-2.5 rounded-lg transition-all cursor-pointer ${
                  isPhotoBulkExpanded
                    ? 'border-emerald-400 bg-emerald-100 text-emerald-900 font-extrabold shadow-inner'
                    : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                }`}
              >
                <Camera className="w-4 h-4 shrink-0" /> <span className="truncate">Bulk Photo Upload</span>
              </button>

              {currentRole === 'school_admin' && (
                <button
                  onClick={() => {
                    setIsBulkDeleteExpanded(!isBulkDeleteExpanded);
                    setIsExportPanelOpen(false);
                    setIsImportExpanded(false);
                    setIsPhotoBulkExpanded(false);
                    setIsPromotionExpanded(false);
                    setIsClasswiseBreakdownExpanded(false);
                    setIsRecycleBinExpanded(false);
                    setIsFastEntryOpen(false);
                    setBulkDeleteSuccess(null);
                    setBulkDeleteError(null);
                    setSelectedClassesToDelete([]);
                    setDeleteConfirmationText('');
                  }}
                  id="bulk_delete_classes_btn"
                  className={`w-full xl:w-auto flex items-center justify-center gap-1.5 border font-semibold text-xs px-3 py-2.5 rounded-lg transition-all cursor-pointer ${
                    isBulkDeleteExpanded 
                      ? 'border-rose-300 bg-rose-100 text-rose-900 font-extrabold shadow-inner' 
                      : 'border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800'
                  }`}
                >
                  <Trash2 className="w-4 h-4 text-rose-600 animate-pulse shrink-0" /> <span className="truncate">Bulk Purge Classes</span>
                </button>
              )}

              {currentRole === 'school_admin' && (
                <button
                  onClick={() => {
                    setIsPromotionExpanded(!isPromotionExpanded);
                    setIsExportPanelOpen(false);
                    setIsImportExpanded(false);
                    setIsPhotoBulkExpanded(false);
                    setIsBulkDeleteExpanded(false);
                    setIsRecycleBinExpanded(false);
                    setIsClasswiseBreakdownExpanded(false);
                    setIsFastEntryOpen(false);
                    setPromotionSuccess(null);
                    setPromotionError(null);
                  }}
                  id="bulk_promote_classes_btn"
                  className={`w-full xl:w-auto flex items-center justify-center gap-1.5 border font-semibold text-xs px-3 py-2.5 rounded-lg transition-all cursor-pointer ${
                    isPromotionExpanded 
                      ? 'border-indigo-300 bg-indigo-100 text-indigo-900 font-extrabold shadow-inner' 
                      : 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-800'
                  }`}
                >
                  <TrendingUp className="w-4 h-4 text-indigo-600 shrink-0" /> <span className="truncate">Bulk Class Promotion</span>
                </button>
              )}

              <button
                onClick={() => {
                  setIsRecycleBinExpanded(!isRecycleBinExpanded);
                  setIsExportPanelOpen(false);
                  setIsImportExpanded(false);
                  setIsPhotoBulkExpanded(false);
                  setIsBulkDeleteExpanded(false);
                  setIsPromotionExpanded(false);
                  setIsFastEntryOpen(false);
                  setIsClasswiseBreakdownExpanded(false);
                  setBulkDeleteSuccess(null);
                  setBulkDeleteError(null);
                }}
                id="recycle_bin_toggle_btn"
                className={`w-full xl:w-auto flex items-center justify-center gap-1.5 border font-semibold text-xs px-3 py-2.5 rounded-lg transition-all cursor-pointer ${
                  isRecycleBinExpanded 
                    ? 'border-amber-300 bg-amber-100 text-amber-900 font-extrabold shadow-inner font-sans' 
                    : 'border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 font-sans'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 text-amber-600 shrink-0 ${recycleBin.length > 0 ? 'animate-spin' : ''}`} style={{ animationDuration: '6s' }} /> <span className="truncate">Recycle Bin ({recycleBin.length})</span>
              </button>

              <button
                onClick={() => {
                  const nextVal = !isFastEntryOpen;
                  setIsFastEntryOpen(nextVal);
                  setIsExportPanelOpen(false);
                  setIsImportExpanded(false);
                  setIsPhotoBulkExpanded(false);
                  setIsBulkDeleteExpanded(false);
                  setIsRecycleBinExpanded(false);
                  setIsClasswiseBreakdownExpanded(false);
                  if (nextVal) {
                    loadFastEntryRows(fastEntryClass, fastEntrySection, fastEntryMode);
                  }
                }}
                id="fast_student_list_entry_btn"
                className={`w-full xl:w-auto flex items-center justify-center gap-1.5 border font-semibold text-xs px-3 py-2.5 rounded-lg transition-all cursor-pointer ${
                  isFastEntryOpen 
                    ? 'border-indigo-400 bg-indigo-100 text-indigo-900 font-extrabold shadow-inner' 
                    : 'border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-850'
                }`}
              >
                <TableProperties className="w-4 h-4 text-indigo-600 shrink-0" /> <span className="truncate">Fast List Entry</span>
              </button>

              {currentRole !== 'class_teacher' && (
                <button
                  onClick={() => setIsClassSectionModalOpen(true)}
                  id="manage_classes_sections_btn"
                  className="w-full xl:w-auto flex items-center justify-center gap-1.5 border font-semibold text-xs px-3 py-2.5 rounded-lg transition-all cursor-pointer border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs hover:border-indigo-300"
                  title="Configure standard school classes, Roman numerals, and sections"
                >
                  <TableProperties className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="truncate">Classes & Sections</span>
                </button>
              )}

              <button
                onClick={() => {
                  setAiRemarksModalMode('bulk');
                  setAiRemarksTargetStudent(null);
                  setIsAiRemarksModalOpen(true);
                }}
                id="bulk_ai_remarks_generator_btn"
                className="w-full xl:w-auto flex items-center justify-center gap-1.5 border font-semibold text-xs px-3 py-2.5 rounded-lg transition-all cursor-pointer border-indigo-300 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-900 shadow-2xs"
                title="Auto-generate teacher remarks using Gemini AI"
              >
                <Sparkles className="w-4 h-4 text-amber-500 animate-pulse shrink-0" />
                <span className="truncate">AI Teacher Remarks</span>
              </button>
              
              <button
                onClick={startAddNewStudent}
                id="manual_add_student_btn"
                className="w-full xl:w-auto flex items-center justify-center gap-1.5 bg-gray-900 hover:bg-gray-800 active:bg-gray-950 text-white font-semibold text-xs px-3 py-2.5 rounded-lg shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 shrink-0" /> <span className="truncate">Add Student</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* CSV Exporter / Uploader Accordion */}
      {isImportExpanded && (
        <div id="bulk_csv_panel" className="w-full bg-indigo-50/40 border border-indigo-100 rounded-xl p-3 sm:p-5 space-y-3 sm:space-y-4 animate-fadeIn">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-indigo-900 text-sm flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Bulk Spreadsheet CSV Processing</span>
              </h3>
              <p className="text-xs text-indigo-700 mt-1 leading-relaxed">
                Download a custom template tailored specifically to active report card designs. Keep the column structure intact when modifying files offline.
              </p>
            </div>
            <button 
              onClick={() => setIsImportExpanded(false)}
              className="p-1 hover:bg-indigo-100 text-indigo-400 hover:text-indigo-600 rounded shrink-0"
              title="Close Panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Design Layout and Classwise Selections */}
          <div className="bg-white p-3 sm:p-4 rounded-xl border border-indigo-100/60 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3">
            
            {/* Design Selector (Only editable by admins) */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-indigo-900 block">Report Card Design Layout</label>
              {currentRole === 'class_teacher' ? (
                <div className="px-3 py-1.5 border rounded-lg bg-slate-50 text-xs font-semibold text-slate-755 truncate">
                  {reportCardStructures?.find(s => s.id === selectedStructureId)?.name || 'Default Global Layout'}
                </div>
              ) : (
                <select
                  value={selectedStructureId}
                  onChange={(e) => {
                    setSelectedStructureId(e.target.value);
                    setSelectedTemplateClass('all'); // reset class filter on change
                  }}
                  className="w-full px-3 py-1.5 text-xs border border-indigo-150 bg-white rounded-lg outline-none font-semibold text-gray-750 focus:ring-2 focus:ring-indigo-500/15"
                >
                  <option value="default">Default Global Layout</option>
                  {reportCardStructures?.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({(s.assignedClasses || []).join(', ')})</option>
                  ))}
                </select>
              )}
            </div>

            {/* Target Class Selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-indigo-900 block">Class Template Target Scope</label>
              {currentRole === 'class_teacher' ? (
                <div className="px-3 py-1.5 border rounded-lg bg-slate-50 text-xs font-semibold text-slate-755">
                  Class {selectedTemplateClass}
                </div>
              ) : (
                <select
                  value={selectedTemplateClass}
                  onChange={(e) => setSelectedTemplateClass(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-indigo-150 bg-white rounded-lg outline-none font-semibold text-gray-750 focus:ring-2 focus:ring-indigo-500/15"
                >
                  <option value="all">Entire Group Layout (All assigned classes)</option>
                  {/* Populate classes belong to selected layout */}
                  {(() => {
                    const activeStruct = reportCardStructures?.find(s => s.id === selectedStructureId);
                    const classesToPopulate = activeStruct ? (activeStruct.assignedClasses || []) : uniqueClasses;
                    return classesToPopulate.map(cls => (
                      <option key={cls} value={cls}>{cls}</option>
                    ));
                  })()}
                </select>
              )}
            </div>

             {/* Target Section Selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-indigo-900 block">Section Filter Scope</label>
              {currentRole === 'class_teacher' ? (
                <div className="px-3 py-1.5 border rounded-lg bg-slate-50 text-xs font-semibold text-slate-755">
                  Section {selectedTemplateSection}
                </div>
              ) : (
                <select
                  value={selectedTemplateSection}
                  onChange={(e) => setSelectedTemplateSection(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-indigo-150 bg-white rounded-lg outline-none font-semibold text-gray-750 focus:ring-2 focus:ring-indigo-500/15"
                >
                  {(() => {
                    const sectionsForCurrentClass = Array.from(new Set(
                      students
                        .filter(s => selectedTemplateClass === 'all' || s.className?.trim().toLowerCase() === selectedTemplateClass.trim().toLowerCase())
                        .map(s => s.section?.trim())
                        .filter(Boolean)
                    )).sort();
                    
                    if (sectionsForCurrentClass.length === 0) {
                      sectionsForCurrentClass.push('A');
                    }

                    const sectionsString = sectionsForCurrentClass.join(' / ');

                    return (
                      <>
                        <option value="all">All Sections Combined ({sectionsString})</option>
                        {sectionsForCurrentClass.map(sec => (
                          <option key={sec} value={sec}>Section {sec}</option>
                        ))}
                      </>
                    );
                  })()}
                </select>
              )}
            </div>

          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              onClick={downloadCsvTemplate}
              id="csv_template_downloader"
              className="flex items-center justify-center gap-1.5 bg-white border border-indigo-200 hover:border-indigo-300 hover:bg-indigo-50 text-indigo-900 font-bold text-xs py-2 px-4 rounded-lg shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-4 h-4 text-indigo-600" />
              Download Excel CSV Template
            </button>
            
            <div className="relative flex-grow">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleCsvFileUpload}
                accept=".csv"
                id="csv_file_input_field"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                id="csv_uploader_trigger"
                className="w-full flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs py-2 px-4 rounded-lg shadow transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                Select Excel Result File (.csv)
              </button>
            </div>
          </div>

          {/* Google Sheets Dynamic Sync Area */}
          <div className="border-t border-indigo-100/60 pt-4 mt-2 space-y-3">
            <div className="flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-indigo-600" />
              <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wide">Google Sheets Dynamic Link Sync</h4>
            </div>
            
            <p className="text-[11px] text-gray-500 leading-normal">
              Paste your sharing link from Google Sheets below. The synchronization auto-aligns grades and records corresponding to your selected design structure filter.
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-grow">
                <input
                  type="text"
                  placeholder="https://docs.google.com/spreadsheets/d/your-id/edit#gid=0"
                  value={googleSheetsUrl}
                  onChange={(e) => setGoogleSheetsUrl(e.target.value)}
                  className="w-full px-3 py-2 pr-10 text-xs border border-indigo-150 bg-white rounded-lg outline-none text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500/15"
                />
                <FileSpreadsheet className="absolute right-3 top-2.5 w-4 h-4 text-indigo-400" />
              </div>
              
              <button
                disabled={isSyncing}
                onClick={syncFromGoogleSheets}
                className={`flex items-center justify-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold text-white transition-all shadow ${isSyncing ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 cursor-pointer'}`}
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    Sync Sheet Now
                  </>
                )}
              </button>
            </div>

            {syncError && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-800 rounded-lg text-xs space-y-1.5 leading-relaxed">
                <div className="flex items-center gap-1.5 font-semibold text-red-900">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  Connection Issue
                </div>
                <p>{syncError}</p>
                <div className="bg-white/80 p-2.5 rounded border border-red-100 text-[10.5px] text-gray-600 space-y-1 mt-1">
                  <span className="font-bold text-gray-800 block mb-0.5">How to fix in 2 simple steps:</span>
                  <div>1. Open your Google Sheet, click the blue <span className="bg-indigo-100 px-1 py-0.5 rounded font-mono font-semibold text-indigo-700">Share</span> button.</div>
                  <div>2. Change General access from Restricted to <strong className="text-gray-800">"Anyone with the link can view/comment"</strong> or click <strong className="text-gray-800">File &gt; Share &gt; Publish to web</strong>.</div>
                </div>
              </div>
            )}

            <div className="bg-indigo-50/20 border border-indigo-100/30 p-3 rounded-lg flex items-start gap-2 text-[10.5px] text-gray-500">
              <Info className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Smart Alignment:</strong> If only Term 1 is active, our sync automatically focuses purely on Term 1 scores. If admission numbers match any existing students, details will merge without replacing manually adjusted records.
              </span>
            </div>
          </div>

          {importStatus && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-lg text-xs flex items-center gap-2 font-medium">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              {importStatus}
            </div>
          )}
        </div>
      )}

      {/* Export Classwise Panel in Full Screen Mode */}
      {isExportPanelOpen && (
        <div id="export_classwise_panel" className="w-full bg-amber-50/40 border border-amber-100 rounded-xl p-3 sm:p-5 space-y-3 sm:space-y-4 animate-fadeIn">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-amber-900 text-sm flex items-center gap-2">
                <Download className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Export Classwise Template Data</span>
              </h3>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                Export pre-filled student rosters matching your selected class standards. You can edit this file offline in Microsoft Excel or Google Sheets and re-upload it later.
              </p>
            </div>
            <button 
              onClick={() => setIsExportPanelOpen(false)}
              className="p-1 hover:bg-amber-100 text-amber-500 hover:text-amber-700 rounded shrink-0"
              title="Close Panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-white p-3 sm:p-4 rounded-xl border border-amber-100/60 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3 text-left">
            {/* Design Layout Selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-amber-950 block">Report Card Design Layout</label>
              {currentRole === 'class_teacher' ? (
                <div className="px-3 py-1.5 border rounded-lg bg-slate-50 text-xs font-semibold text-slate-755 truncate">
                  {reportCardStructures?.find(s => s.id === selectedStructureId)?.name || 'Default Global Layout'}
                </div>
              ) : (
                <select
                  value={selectedStructureId}
                  onChange={(e) => {
                    setSelectedStructureId(e.target.value);
                    setSelectedTemplateClass('all'); // reset class filter on change
                  }}
                  className="w-full px-3 py-1.5 text-xs border border-amber-250 bg-white rounded-lg outline-none font-semibold text-gray-755 focus:ring-2 focus:ring-amber-500/15"
                >
                  <option value="default">Default Global Layout</option>
                  {reportCardStructures?.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({(s.assignedClasses || []).join(', ')})</option>
                  ))}
                </select>
              )}
            </div>

            {/* Target Class Selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-amber-950 block">Class Template Target Scope</label>
              {currentRole === 'class_teacher' ? (
                <div className="px-3 py-1.5 border rounded-lg bg-slate-50 text-xs font-semibold text-slate-755">
                  Class {selectedTemplateClass}
                </div>
              ) : (
                <select
                  value={selectedTemplateClass}
                  onChange={(e) => setSelectedTemplateClass(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-amber-250 bg-white rounded-lg outline-none font-semibold text-gray-755 focus:ring-2 focus:ring-amber-500/15"
                >
                  <option value="all">Entire Group Layout (All assigned classes)</option>
                  {(() => {
                    const activeStruct = reportCardStructures?.find(s => s.id === selectedStructureId);
                    const classesToPopulate = activeStruct ? (activeStruct.assignedClasses || []) : uniqueClasses;
                    return classesToPopulate.map(cls => (
                      <option key={cls} value={cls}>{cls}</option>
                    ));
                  })()}
                </select>
              )}
            </div>

            {/* Section selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-amber-950 block">Section Filter Scope</label>
              {currentRole === 'class_teacher' ? (
                <div className="px-3 py-1.5 border rounded-lg bg-slate-50 text-xs font-semibold text-slate-755">
                  Section {selectedTemplateSection}
                </div>
              ) : (
                <select
                  value={selectedTemplateSection}
                  onChange={(e) => setSelectedTemplateSection(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-amber-250 bg-white rounded-lg outline-none font-semibold text-gray-755 focus:ring-2 focus:ring-amber-500/15"
                >
                  {(() => {
                    const sectionsForCurrentClass = Array.from(new Set(
                      students
                        .filter(s => selectedTemplateClass === 'all' || s.className?.trim().toLowerCase() === selectedTemplateClass.trim().toLowerCase())
                        .map(s => s.section?.trim())
                        .filter(Boolean)
                    )).sort();
                    
                    if (sectionsForCurrentClass.length === 0) {
                      sectionsForCurrentClass.push('A');
                    }

                    const sectionsString = sectionsForCurrentClass.join(' / ');

                    return (
                      <>
                        <option value="all">All Sections Combined ({sectionsString})</option>
                        {sectionsForCurrentClass.map(sec => (
                          <option key={sec} value={sec}>Section {sec}</option>
                        ))}
                      </>
                    );
                  })()}
                </select>
              )}
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setIsExportPanelOpen(false)}
              className="w-full sm:w-auto px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg transition text-center"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                downloadCsvTemplate();
                setIsExportPanelOpen(false);
              }}
              className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition shadow-sm flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV Template
            </button>
          </div>
        </div>
      )}

      {/* Student Fast List Entry Board */}
      {isFastEntryOpen && (
        <div id="fast_student_grid_panel" className="w-full bg-indigo-50/40 border border-indigo-100 rounded-xl p-3 sm:p-5 space-y-3 sm:space-y-4 animate-fadeIn">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-indigo-900 text-sm flex items-center gap-2">
                <TableProperties className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Student Fast List Entry Board</span>
              </h3>
              <p className="text-xs text-indigo-700 mt-1 leading-relaxed">
                Add, edit, or search students in a spreadsheet-like grid format. Next row is created automatically by pressing <strong>Enter</strong> or <strong>Down Arrow</strong> on the last row's Name field.
              </p>
            </div>
            <button 
              onClick={() => setIsFastEntryOpen(false)}
              className="p-1.5 hover:bg-indigo-100 text-indigo-400 hover:text-indigo-600 rounded shrink-0"
              title="Close Fast Entry"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Target Class and Section Dropdowns inside the panel */}
          <div className="bg-white p-3 sm:p-4 rounded-xl border border-indigo-100/60 flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 flex-1 w-full">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-indigo-900 block">Class Standard</label>
                {isAddingCustomClass ? (
                  <div className="flex items-center gap-1.5 h-8">
                    <input
                      type="text"
                      value={newCustomClassVal}
                      onChange={(e) => setNewCustomClassVal(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-indigo-250 rounded-lg text-xs w-[110px] font-semibold text-gray-750 outline-none focus:ring-2 focus:ring-indigo-500/15"
                      placeholder="e.g. 11th"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleConfirmCustomClass();
                        if (e.key === 'Escape') setIsAddingCustomClass(false);
                      }}
                    />
                    <button 
                      onClick={handleConfirmCustomClass}
                      className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all"
                      title="Confirm Class"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => setIsAddingCustomClass(false)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <select
                      value={fastEntryClass}
                      onChange={(e) => {
                        const newClass = e.target.value;
                        const classSecs = getSectionsForClass(newClass, schoolClasses);
                        const nextSec = classSecs.includes(fastEntrySection) ? fastEntrySection : (classSecs[0] || 'A');
                        setFastEntryClass(newClass);
                        setFastEntrySection(nextSec);
                        loadFastEntryRows(newClass, nextSec, fastEntryMode);
                      }}
                      className="w-full px-3 py-1.5 text-xs border border-indigo-150 bg-white rounded-lg outline-none font-semibold text-gray-750 focus:ring-2 focus:ring-indigo-500/15"
                    >
                      {allSyncedClasses.map(cls => (
                        <option key={cls} value={cls}>{cls}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        setNewCustomClassVal('');
                        setIsAddingCustomClass(true);
                      }}
                      className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg flex-shrink-0 transition-all"
                      title="Add Custom Class"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-indigo-900 block">Section</label>
                {isAddingCustomSection ? (
                  <div className="flex items-center gap-1.5 h-8">
                    <input
                      type="text"
                      value={newCustomSectionVal}
                      onChange={(e) => setNewCustomSectionVal(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-indigo-250 rounded-lg text-xs w-[80px] font-semibold text-gray-750 outline-none focus:ring-2 focus:ring-indigo-500/15"
                      placeholder="e.g. F"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleConfirmCustomSection();
                        if (e.key === 'Escape') setIsAddingCustomSection(false);
                      }}
                    />
                    <button 
                      onClick={handleConfirmCustomSection}
                      className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all"
                      title="Confirm Section"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => setIsAddingCustomSection(false)}
                      className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <select
                      value={fastEntrySection}
                      onChange={(e) => {
                        setFastEntrySection(e.target.value);
                        loadFastEntryRows(fastEntryClass, e.target.value, fastEntryMode);
                      }}
                      className="w-full px-3 py-1.5 text-xs border border-indigo-150 bg-white rounded-lg outline-none font-semibold text-gray-750 focus:ring-2 focus:ring-indigo-500/15"
                    >
                      {allSyncedSections.map(sec => (
                        <option key={sec} value={sec}>Section {sec}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        setNewCustomSectionVal('');
                        setIsAddingCustomSection(true);
                      }}
                      className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg flex-shrink-0 transition-all"
                      title="Add Custom Section"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-indigo-900 block">Grid Entry Mode</label>
                <select
                  value={fastEntryMode}
                  onChange={(e) => {
                    const newMode = e.target.value as 'edit' | 'fresh';
                    setFastEntryMode(newMode);
                    loadFastEntryRows(fastEntryClass, fastEntrySection, newMode);
                  }}
                  className="w-full px-3 py-1.5 text-xs border border-indigo-150 bg-white rounded-lg outline-none font-semibold text-indigo-900 focus:ring-2 focus:ring-indigo-500/15"
                >
                  <option value="edit">✏️ Edit Existing Roster ({students.filter(s => classesMatch(s.className, fastEntryClass) && s.section.trim().toLowerCase() === fastEntrySection.trim().toLowerCase()).length})</option>
                  <option value="fresh">➕ Fresh Bulk Entry (Empty Grid)</option>
                </select>
              </div>
            </div>

            <div className="w-full lg:w-auto lg:ml-auto flex flex-wrap items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-indigo-50">
              <button
                type="button"
                onClick={() => {
                  setAiRemarksModalMode('bulk');
                  setAiRemarksTargetStudent(null);
                  setIsAiRemarksModalOpen(true);
                }}
                className="flex-1 sm:flex-initial justify-center px-3 py-2 sm:py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 font-bold text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Generate AI remarks for all students in this class/section"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>AI Remarks</span>
              </button>
              <button
                onClick={() => loadFastEntryRows(fastEntryClass, fastEntrySection, fastEntryMode)}
                className="flex-1 sm:flex-initial justify-center px-3 py-2 sm:py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg transition-all"
              >
                Reset Grid
              </button>
              <button
                onClick={handleSaveFastGrid}
                className="w-full sm:w-auto justify-center px-4 py-2 sm:py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>Save &amp; Sync Roster</span>
              </button>
            </div>
          </div>

          {fastEntryError && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-800 rounded-lg text-xs font-semibold leading-relaxed">
              ⚠️ {fastEntryError}
            </div>
          )}

          {/* Mobile Swipe Guidance Banner */}
          <div className="flex items-center justify-between px-3 py-2 bg-indigo-100/80 border border-indigo-200/80 rounded-xl text-indigo-950 text-xs font-semibold shadow-3xs">
            <span className="flex items-center gap-1.5">
              <span className="text-base select-none">👈📱👉</span>
              <span>Swipe horizontally on mobile to view &amp; edit all student columns</span>
            </span>
            <span className="hidden sm:inline text-[10.5px] text-indigo-600 font-normal">Use arrow keys or Tab to navigate cells</span>
          </div>

          {/* Grid spreadsheet table */}
          <div className="w-full bg-white border border-indigo-100/70 rounded-xl shadow-inner max-h-[520px] overflow-x-auto overflow-y-auto overscroll-x-contain touch-pan-x select-auto [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]">
            <table className="w-full min-w-[1100px] text-left border-collapse">
              <thead>
                <tr className="bg-indigo-50/70 text-indigo-950 font-black text-[10px] uppercase tracking-wider border-b border-indigo-100 sticky top-0 z-20">
                  <th className="sticky left-0 top-0 z-30 bg-indigo-100 p-2 text-center w-12 border-r border-indigo-200 shadow-[1px_0_3px_rgba(0,0,0,0.05)]">S.No</th>
                  {(() => {
                    // Resolve active fields for selected class standard
                    const struct = matchStructureForStudent(reportCardStructures, fastEntryClass, fastEntrySection);
                    const bObj = struct?.branding || branding;
                    const studentFields = bObj?.studentFields || [
                      { id: "rollNo", label: "Roll No" },
                      { id: "admissionNo", label: "Admission No" },
                      { id: "name", label: "Student Name" },
                      { id: "fatherName", label: "Father Name" },
                      { id: "motherName", label: "Mother Name" },
                      { id: "className", label: "Class" },
                      { id: "section", label: "Section" },
                      { id: "dob", label: "DOB" },
                      { id: "height", label: "Height" },
                      { id: "weight", label: "Weight" }
                    ];
                    
                    const activeStudentFields = studentFields.filter(f => {
                      if (f.id === 'className' || f.id === 'section' || f.id === 'mobileNumber') return false;
                      return isStudentFieldActive(f.id, fastEntryClass, fastEntrySection, reportCardStructures, branding);
                    });

                    return (
                      <>
                        {activeStudentFields.map(field => (
                          <th key={field.id} className="p-2 border-r border-indigo-100/30 font-bold min-w-[130px]">{field.label}</th>
                        ))}
                        <th className="p-2 border-r border-indigo-100/30 font-bold min-w-[135px] text-indigo-950">Parent Mobile</th>
                        <th className="p-2 border-r border-indigo-100/30 font-bold min-w-[120px]">Attendance</th>
                        <th className="p-2 border-r border-indigo-100/30 font-bold min-w-[160px]">Remarks</th>
                        {bObj?.congratulationsDisabled !== true && (
                          <th className="p-2 border-r border-indigo-100/30 font-bold min-w-[165px]">Promotion Status</th>
                        )}
                        <th className="p-2 font-bold min-w-[150px]">Photo URL</th>
                      </>
                    );
                  })()}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const struct = matchStructureForStudent(reportCardStructures, fastEntryClass, fastEntrySection);
                  const bObj = struct?.branding || branding;
                  const studentFields = bObj?.studentFields || [
                    { id: "rollNo", label: "Roll No" },
                    { id: "admissionNo", label: "Admission No" },
                    { id: "name", label: "Student Name" },
                    { id: "fatherName", label: "Father Name" },
                    { id: "motherName", label: "Mother Name" },
                    { id: "className", label: "Class" },
                    { id: "section", label: "Section" },
                    { id: "dob", label: "DOB" },
                    { id: "height", label: "Height" },
                    { id: "weight", label: "Weight" }
                  ];
                  
                  const activeStudentFields = studentFields.filter(f => {
                    if (f.id === 'className' || f.id === 'section' || f.id === 'mobileNumber') return false;
                    return isStudentFieldActive(f.id, fastEntryClass, fastEntrySection, reportCardStructures, branding);
                  });

                  if (fastEntryRows.length === 0) {
                    return (
                      <tr>
                        <td colSpan={activeStudentFields.length + 6} className="p-8 text-center text-xs text-slate-400 font-bold">
                          No rows available. Click "Reset Grid" to initialize.
                        </td>
                      </tr>
                    );
                  }

                  return fastEntryRows.map((row, rowIndex) => {
                    const hasPromotion = bObj?.congratulationsDisabled !== true;
                    const fieldIds: string[] = [
                      ...activeStudentFields.map(f => `grid_field_${f.id}_${rowIndex}`),
                      `grid_field_mobileNumber_${rowIndex}`,
                      `grid_field_attendance_${rowIndex}`,
                      `grid_field_remarks_${rowIndex}`,
                      ...(hasPromotion ? [`grid_field_promotionStatus_${rowIndex}`] : []),
                      `grid_field_photoUrl_${rowIndex}`
                    ];

                    const handleArrowKeyNav = (e: React.KeyboardEvent<HTMLInputElement>, currentFieldId: string) => {
                      const currentIndex = fieldIds.indexOf(currentFieldId);
                      if (currentIndex === -1) return;

                      if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        if (rowIndex > 0) {
                          const targetId = fieldIds[currentIndex].replace(`_${rowIndex}`, `_${rowIndex - 1}`);
                          document.getElementById(targetId)?.focus();
                        }
                      } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
                        e.preventDefault();
                        if (rowIndex === fastEntryRows.length - 1) {
                          // Append new row
                          setFastEntryRows(prev => [
                            ...prev,
                            {
                              id: `new-draft-${Date.now()}-${prev.length}`,
                              isDraft: true,
                              rollNo: '',
                              admissionNo: '',
                              name: '',
                              fatherName: '',
                              motherName: '',
                              dob: '',
                              mobileNumber: '',
                              height: '',
                              weight: '',
                              photoUrl: ''
                            }
                          ]);
                          setTimeout(() => {
                            const targetId = fieldIds[currentIndex].replace(`_${rowIndex}`, `_${rowIndex + 1}`);
                            document.getElementById(targetId)?.focus();
                          }, 50);
                        } else {
                          const targetId = fieldIds[currentIndex].replace(`_${rowIndex}`, `_${rowIndex + 1}`);
                          document.getElementById(targetId)?.focus();
                        }
                      } else if (e.key === 'ArrowLeft') {
                        const input = e.currentTarget;
                        if (input.selectionStart === 0 && input.selectionEnd === 0) {
                          if (currentIndex > 0) {
                            e.preventDefault();
                            const prevId = fieldIds[currentIndex - 1];
                            const prevEl = document.getElementById(prevId) as HTMLInputElement | null;
                            if (prevEl) {
                              prevEl.focus();
                              setTimeout(() => {
                                const len = prevEl.value.length;
                                prevEl.setSelectionRange(len, len);
                              }, 0);
                            }
                          }
                        }
                      } else if (e.key === 'ArrowRight') {
                        const input = e.currentTarget;
                        if (input.selectionStart === input.value.length && input.selectionEnd === input.value.length) {
                          if (currentIndex < fieldIds.length - 1) {
                            e.preventDefault();
                            const nextId = fieldIds[currentIndex + 1];
                            const nextEl = document.getElementById(nextId) as HTMLInputElement | null;
                            if (nextEl) {
                              nextEl.focus();
                              setTimeout(() => {
                                nextEl.setSelectionRange(0, 0);
                              }, 0);
                            }
                          }
                        }
                      }
                    };

                    return (
                      <tr key={row.id} className={`border-b border-indigo-50/50 hover:bg-slate-50 transition-colors ${row.isDraft ? 'bg-slate-50/30 opacity-75' : ''}`}>
                        <td className="sticky left-0 z-10 bg-slate-100/95 backdrop-blur-xs p-1 text-center font-mono text-[11px] font-bold text-slate-500 border-r border-indigo-200 shadow-[1px_0_3px_rgba(0,0,0,0.05)] select-none">
                          {rowIndex + 1}
                        </td>
                        {activeStudentFields.map(field => {
                          return (
                            <td key={field.id} className="p-1 border-r border-indigo-100/30">
                              <input
                                type="text"
                                id={`grid_field_${field.id}_${rowIndex}`}
                                value={row[field.id] || ''}
                                onChange={(e) => handleCellChange(row.id, field.id, e.target.value)}
                                onBlur={(e) => {
                                  const val = e.target.value;
                                  if (field.id === 'fatherName') {
                                    handleCellChange(row.id, 'fatherName', formatFatherName(val));
                                  } else if (field.id === 'motherName') {
                                    handleCellChange(row.id, 'motherName', formatMotherName(val));
                                  } else if (field.id === 'height') {
                                    handleCellChange(row.id, 'height', formatHeight(val));
                                  } else if (field.id === 'weight') {
                                    handleCellChange(row.id, 'weight', formatWeight(val));
                                  }
                                }}
                                onKeyDown={(e) => handleArrowKeyNav(e, `grid_field_${field.id}_${rowIndex}`)}
                                className="w-full px-2 py-1.5 text-xs bg-transparent focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded outline-none font-bold text-slate-755 leading-tight touch-manipulation"
                                placeholder={`Enter ${field.label}`}
                              />
                            </td>
                          );
                        })}
                        {/* Parent Mobile */}
                        <td className="p-1 border-r border-indigo-100/30">
                          <input
                            type="tel"
                            id={`grid_field_mobileNumber_${rowIndex}`}
                            value={row.mobileNumber || ''}
                            onChange={(e) => handleCellChange(row.id, 'mobileNumber', e.target.value)}
                            onKeyDown={(e) => handleArrowKeyNav(e, `grid_field_mobileNumber_${rowIndex}`)}
                            className="w-full px-2 py-1.5 text-xs bg-transparent focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded outline-none font-bold text-slate-755 leading-tight touch-manipulation font-mono"
                            placeholder="e.g. 9876543210"
                          />
                        </td>
                        {/* Attendance */}
                        <td className="p-1 border-r border-indigo-100/30">
                          <input
                            type="text"
                            id={`grid_field_attendance_${rowIndex}`}
                            value={typeof row.attendance === 'object' ? (row.attendance?.term1 || '') : (row.attendance || '')}
                            onChange={(e) => {
                              const val = e.target.value;
                              setFastEntryRows(prev => prev.map(r => {
                                if (r.id === row.id) {
                                  return { 
                                    ...r, 
                                    attendance: { term1: val, term2: val } 
                                  };
                                }
                                return r;
                              }));
                            }}
                            onKeyDown={(e) => handleArrowKeyNav(e, `grid_field_attendance_${rowIndex}`)}
                            className="w-full px-2 py-1.5 text-xs bg-transparent focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded outline-none font-semibold text-slate-700 touch-manipulation"
                            placeholder="Attendance"
                          />
                        </td>
                        {/* Remarks */}
                        <td className="p-1 border-r border-indigo-100/30">
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              id={`grid_field_remarks_${rowIndex}`}
                              value={row.remarks || ''}
                              onChange={(e) => handleCellChange(row.id, 'remarks', e.target.value)}
                              onKeyDown={(e) => handleArrowKeyNav(e, `grid_field_remarks_${rowIndex}`)}
                              className="w-full px-2 py-1.5 text-xs bg-transparent focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded outline-none font-semibold text-slate-700 touch-manipulation"
                              placeholder="Remarks"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const target = students.find(s => s.id === row.id) || row;
                                setAiRemarksModalMode('single');
                                setAiRemarksTargetStudent(target);
                                setIsAiRemarksModalOpen(true);
                              }}
                              className="p-1 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded transition-colors shrink-0 cursor-pointer"
                              title="Generate AI Remarks for this student"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            </button>
                          </div>
                        </td>
                        {/* Promotion Status */}
                        {hasPromotion && (
                          <td className="p-1 border-r border-indigo-100/30">
                            <input
                              type="text"
                              id={`grid_field_promotionStatus_${rowIndex}`}
                              value={row.promotionStatus || ''}
                              onChange={(e) => handleCellChange(row.id, 'promotionStatus', e.target.value)}
                              onKeyDown={(e) => handleArrowKeyNav(e, `grid_field_promotionStatus_${rowIndex}`)}
                              className="w-full px-2 py-1.5 text-xs bg-transparent focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded outline-none font-semibold text-slate-700 touch-manipulation"
                              placeholder="Promotion Status"
                            />
                          </td>
                        )}
                        {/* Photo URL */}
                        <td className="p-1">
                          <input
                            type="text"
                            id={`grid_field_photoUrl_${rowIndex}`}
                            value={row.photoUrl || ''}
                            onChange={(e) => handleCellChange(row.id, 'photoUrl', e.target.value)}
                            onKeyDown={(e) => handleArrowKeyNav(e, `grid_field_photoUrl_${rowIndex}`)}
                            className="w-full px-2 py-1.5 text-xs bg-transparent focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded outline-none font-semibold text-slate-700 font-mono touch-manipulation"
                            placeholder="Photo URL"
                          />
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>

          <p className="text-[10px] text-gray-500 leading-normal flex items-start gap-1">
            <Info className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
            <span>
              <strong>Roster Sync Strategy:</strong> New students will be initialized with a standard name and generated admission number. Old students will merge seamlessly without discarding previous score sheets or grade cards. Always click "Save & Sync Roster" to persist all rows to local and cloud caches!
            </span>
          </p>
        </div>
      )}

      {/* Classwise Student Strength Breakdown Accordion Panel */}
      {isClasswiseBreakdownExpanded && (
        <div id="classwise_breakdown_panel" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-5 space-y-3 sm:space-y-4 animate-fadeIn text-left">
          <div className="flex items-start justify-between border-b border-slate-200 pb-3">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                <Users className="w-4 h-4 text-indigo-600 animate-pulse" />
                Classwise Student Strength Breakdown
              </h3>
              <p className="text-[11px] text-gray-500 mt-1">
                {currentRole === 'class_teacher' 
                  ? "Your restricted access homeroom registered student counts." 
                  : "Autocalculated count of currently registered students grouped classwise."}
              </p>
            </div>
            <button 
              onClick={() => setIsClasswiseBreakdownExpanded(false)}
              className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {currentRole === 'class_teacher' && activeTeacherObj && (
            <div className="bg-indigo-50 border border-indigo-150 rounded-xl p-3 text-[10.5px] text-indigo-850 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-indigo-500 shrink-0 animate-pulse" />
              <span>
                <strong>Homeroom Lock Active:</strong> As a Class Teacher, you only have authorization to view student metrics belonging to your assigned <strong>Class {activeTeacherObj.classTeacherClass || activeTeacherObj.assignedClass} (Section {activeTeacherObj.classTeacherSection || activeTeacherObj.assignedSection || 'All'})</strong>.
              </span>
            </div>
          )}

          {classwiseBreakdown.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-1">
              {classwiseBreakdown.map((item) => (
                <div 
                  key={`${item.className}-${item.section}`}
                  className="bg-white border border-slate-150 hover:border-indigo-200 hover:bg-indigo-50/20 transition-all rounded-xl p-3.5 flex flex-col justify-between space-y-2 text-center shadow-3xs"
                >
                  <div>
                    <span className="text-[9px] uppercase tracking-wider font-extrabold text-gray-400 block">Class &amp; Sec</span>
                    <strong className="text-sm font-black text-slate-800 font-mono block mt-0.5">
                      {item.className} - {item.section}
                    </strong>
                  </div>
                  <div className="bg-indigo-50 border border-indigo-105 rounded-lg py-1 px-2.5 text-xs font-black text-indigo-650 font-mono">
                    {item.count} Registered
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-xs text-gray-400 italic">
              No registered student records matches the current workspace structure.
            </div>
          )}
        </div>
      )}

      {/* Bulk Photo Upload Accordion */}
      {isPhotoBulkExpanded && (
        <div id="bulk_photo_panel" className="w-full bg-emerald-50/40 border border-emerald-100 rounded-xl p-3 sm:p-5 space-y-3 sm:space-y-4 animate-fadeIn">
          {/* Panel Header */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-emerald-950 text-sm flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-600 animate-pulse" />
                Multi-Factor Batch Student Photo Upload Engine
              </h3>
              <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                Upload multiple student photos in a single batch. Files are intelligently matched using <strong>Admission Numbers</strong>, <strong>Composite filenames</strong>, or the <strong>Active Class/Section scope</strong>.
              </p>
            </div>
            <button 
              onClick={() => setIsPhotoBulkExpanded(false)}
              className="p-1 hover:bg-emerald-100 text-emerald-400 hover:text-emerald-600 rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Guidelines info box */}
          <div className="bg-white/70 border border-emerald-100/60 p-4 rounded-lg text-xs text-gray-600 space-y-2.5">
            <h4 className="font-bold text-gray-800 uppercase text-[10px] tracking-wider text-emerald-800 flex items-center gap-1">
              <Info className="w-3.5 h-3.5" />
              Supported Matching Rules (Choose what fits your workflow)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
              <div className="p-2.5 rounded-lg border border-emerald-150/70 bg-white space-y-1">
                <div className="flex items-center gap-1 text-[11px] font-black text-emerald-900">
                  <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[9px]">1</span>
                  Active Class Scoped
                </div>
                <p className="text-[10px] text-gray-600 leading-tight">
                  Filter by <strong>Class &amp; Section</strong> above. Simple roll numbers like <code className="bg-gray-100 px-1 py-0.2 rounded font-mono font-bold text-gray-800">10.jpg</code> or <code className="bg-gray-100 px-1 py-0.2 rounded font-mono font-bold text-gray-800">Roll-5.png</code> map directly to students of that active class.
                </p>
              </div>

              <div className="p-2.5 rounded-lg border border-emerald-150/70 bg-white space-y-1">
                <div className="flex items-center gap-1 text-[11px] font-black text-emerald-900">
                  <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[9px]">2</span>
                  Admission Number
                </div>
                <p className="text-[10px] text-gray-600 leading-tight">
                  Name files with admission numbers like <code className="bg-gray-100 px-1 py-0.2 rounded font-mono font-bold text-gray-800">ADM-1042.jpg</code> or <code className="bg-gray-100 px-1 py-0.2 rounded font-mono font-bold text-gray-800">1042.png</code> to match unique student records across the entire school.
                </p>
              </div>

              <div className="p-2.5 rounded-lg border border-emerald-150/70 bg-white space-y-1">
                <div className="flex items-center gap-1 text-[11px] font-black text-emerald-900">
                  <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[9px]">3</span>
                  Composite Filename
                </div>
                <p className="text-[10px] text-gray-600 leading-tight">
                  Name files as <code className="bg-gray-100 px-1 py-0.2 rounded font-mono font-bold text-gray-800">&#123;Class&#125;_&#123;Sec&#125;_&#123;Roll&#125;.jpg</code> (e.g. <code className="bg-gray-100 px-1 py-0.2 rounded font-mono font-bold text-gray-800">3_A_10.jpg</code> or <code className="bg-gray-100 px-1 py-0.2 rounded font-mono font-bold text-gray-800">12_Science_01.jpg</code>) for whole-school bulk drops.
                </p>
              </div>
            </div>
            <p className="text-[9.5px] text-gray-400 italic">
              * Images are automatically center-cropped to a standard 5:6 passport aspect ratio and compressed for fast performance.
            </p>
          </div>

          {/* Drag & Drop Upload Zone */}
          <div 
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const files = e.dataTransfer.files;
              if (files && files.length > 0) {
                handleBulkPhotoFiles(Array.from(files));
              }
            }}
            className="border-2 border-dashed border-emerald-200 hover:border-emerald-400 bg-white hover:bg-emerald-50/10 rounded-xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
            onClick={() => photoFileInputRef.current?.click()}
          >
            <input 
              type="file"
              ref={photoFileInputRef}
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                  handleBulkPhotoFiles(Array.from(files));
                }
              }}
              accept="image/*"
              multiple
              className="hidden"
            />
            <div className="bg-emerald-100/50 group-hover:bg-emerald-150 text-emerald-600 p-3 rounded-full transition-transform group-hover:scale-105 font-medium flex items-center justify-center">
              <Upload className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <span className="font-bold text-emerald-950 text-xs">Drag and drop student photos here</span>
              <span className="text-gray-400 text-xs block mt-0.5">or click to browse local folders</span>
            </div>
            <span className="text-[10px] text-gray-400">Supports PNG, JPEG, WEBP and multiple selection</span>
          </div>

          {/* Processing and feedback list */}
          {isProcessingPhotos && (
            <div className="flex items-center justify-center gap-2 py-4 text-xs font-semibold text-emerald-800 bg-white/50 border border-emerald-100/30 rounded-lg">
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
              Matching images and processing passport crops...
            </div>
          )}

          {photoMatchResults.length > 0 && (
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-emerald-100/40 p-2.5 rounded-lg border border-emerald-100 text-xs font-bold text-emerald-950">
                <span>Matched Preview ({photoMatchResults.filter(r => r.success).length} Matched, {photoMatchResults.filter(r => !r.success).length} Skipped)</span>
                <button 
                  type="button"
                  onClick={() => setPhotoMatchResults([])}
                  className="text-[10px] font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
                >
                  Clear Results List
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 max-h-60 overflow-y-auto pr-1">
                {photoMatchResults.map((result, idx) => (
                  <div 
                    key={idx} 
                    className={`p-2.5 rounded-lg border flex gap-3 items-center text-xs ${result.success ? 'bg-white border-emerald-100' : 'bg-rose-50/20 border-rose-100/45'}`}
                  >
                    {result.success && result.previewUrl ? (
                      <div className="w-12 h-14 bg-gray-100 border border-gray-100 rounded shadow-sm flex-shrink-0 overflow-hidden">
                        <img 
                          src={result.previewUrl} 
                          alt="preview" 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-14 bg-rose-150/10 text-rose-500 rounded flex-shrink-0 flex items-center justify-center">
                        <AlertCircle className="w-5 h-5 text-rose-400" />
                      </div>
                    )}

                    <div className="flex-grow min-w-0">
                      <div className="flex justify-between items-center gap-1">
                        <span className="font-bold text-[10.5px] text-gray-800 truncate select-none" title={result.fileName}>
                          {result.fileName}
                        </span>
                        {result.success ? (
                          <span className="bg-emerald-105 text-emerald-800 font-extrabold text-[8.5px] px-1.5 py-0.5 rounded font-mono uppercase bg-emerald-100">
                            Matched
                          </span>
                        ) : (
                          <span className="bg-rose-100 text-rose-800 font-extrabold text-[8.5px] px-1.5 py-0.5 rounded font-mono uppercase">
                            Skipped
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-emerald-900 mt-0.5">
                        {result.success ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="truncate">
                              {result.className && <span className="text-slate-500 font-semibold">Class {result.className}{result.section ? `-${result.section}` : ''} • </span>}
                              Roll {result.rollNo}: <strong>{result.studentName}</strong>
                            </span>
                            {result.matchType && (
                              <span className="text-[8px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-1.5 py-0.2 rounded font-mono shrink-0">
                                {result.matchType}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-rose-700 leading-tight block">{result.reason}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {photoMatchResults.some(r => r.success) && (
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={savePhotoBulkChanges}
                    id="apply_bulk_photos_btn"
                    className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs py-2.5 px-6 rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle className="w-4 h-4" /> Keep & Apply Photo Updates to Registry
                  </button>
                </div>
              )}
            </div>
          )}

          {photoImportStatus && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-850 rounded-lg text-xs flex items-center gap-2 font-medium">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              {photoImportStatus}
            </div>
          )}
        </div>
      )}

      {/* Bulk Class Deletion / Purge Accordion */}
      {isBulkDeleteExpanded && currentRole === 'school_admin' && (
        <div id="bulk_purge_panel" className="w-full bg-rose-50/40 border border-rose-100 rounded-xl p-3 sm:p-5 space-y-3 sm:space-y-4 animate-fadeIn">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h3 className="font-extrabold text-rose-950 text-sm flex items-center gap-2 uppercase tracking-tight">
                <Trash2 className="w-4 h-4 text-rose-600 animate-pulse" />
                SaaS Bulk Class Purge & Reset Desk
              </h3>
              <p className="text-xs text-rose-800 leading-relaxed max-w-3xl">
                This powerful tool is reserved for <strong>School Administrators only</strong> to correct major, class-wide data entry or file import mistakes. Please select the classes and the target operation with extreme caution.
              </p>
            </div>
            <button 
              onClick={() => setIsBulkDeleteExpanded(false)}
              className="p-1 hover:bg-rose-100 text-rose-400 hover:text-rose-600 rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Column 1: Selection of Classes and Sections */}
            <div className="bg-white p-4 rounded-xl border border-rose-100/60 space-y-3 md:col-span-1">
              <div className="flex justify-between items-center pb-2 border-b border-rose-100/40">
                <label className="text-[10px] font-black uppercase text-rose-950 block">1. Select Target Class & Sec</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedClassSectionsToDelete(uniqueClassSections)}
                    className="text-[9px] font-bold text-indigo-600 hover:underline cursor-pointer uppercase"
                  >
                    Select All
                  </button>
                  <span className="text-[9px] text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={() => setSelectedClassSectionsToDelete([])}
                    className="text-[9px] font-bold text-rose-600 hover:underline cursor-pointer uppercase"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {uniqueClassSections.length === 0 ? (
                <div className="text-xs text-slate-400 text-center py-4 font-medium italic">
                  No registered classes or sections found in database.
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1.5">
                  {uniqueClassSections.map((item) => {
                    const count = students.filter(s => 
                      (s.className || '').trim().toLowerCase() === item.className.toLowerCase() &&
                      (s.section || '').trim().toLowerCase() === item.section.toLowerCase()
                    ).length;
                    
                    const isChecked = selectedClassSectionsToDelete.some(sel => 
                      sel.className.toLowerCase().trim() === item.className.toLowerCase().trim() &&
                      sel.section.toLowerCase().trim() === item.section.toLowerCase().trim()
                    );
                    
                    const labelText = `Class ${item.className}${item.section ? ` - Sec ${item.section}` : ' (No Section)'}`;
                    
                    return (
                      <label 
                        key={`${item.className}|||${item.section}`}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer select-none transition-colors ${
                          isChecked 
                            ? 'bg-rose-50/50 border-rose-200 text-rose-900' 
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedClassSectionsToDelete(prev => [...prev, item]);
                              } else {
                                setSelectedClassSectionsToDelete(prev => 
                                  prev.filter(sel => 
                                    !(sel.className.toLowerCase().trim() === item.className.toLowerCase().trim() &&
                                      sel.section.toLowerCase().trim() === item.section.toLowerCase().trim())
                                  )
                                );
                              }
                            }}
                            className="rounded border-gray-300 text-rose-600 focus:ring-rose-500 h-3.5 w-3.5"
                          />
                          <span>{labelText}</span>
                        </div>
                        <span className="text-[9px] font-mono text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200/50">
                          {count} {count === 1 ? 'student' : 'students'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Column 2: Selection of Purge Mode / Options */}
            <div className="bg-white p-4 rounded-xl border border-rose-100/60 space-y-3.5 md:col-span-1 text-left">
              <label className="text-[10px] font-black uppercase text-rose-950 block pb-2 border-b border-rose-100/40">
                2. Select Purge Option
              </label>

              <div className="space-y-3">
                {/* Option 2 Radio */}
                <label 
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer select-none transition-all ${
                    deletionOption === 'option2' 
                      ? 'bg-amber-50/40 border-amber-200 text-amber-950 shadow-xs' 
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="deletionOption"
                    value="option2"
                    checked={deletionOption === 'option2'}
                    onChange={() => setDeletionOption('option2')}
                    className="mt-0.5 border-slate-300 text-amber-600 focus:ring-amber-500 h-3.5 w-3.5"
                  />
                  <div className="text-left">
                    <span className="text-xs font-bold block text-slate-850">Option 2: Reset/Clear Marks Only</span>
                    <span className="text-[10px] leading-relaxed text-slate-500 block mt-0.5">
                      Clears scholastic, co-scholastic, and activity marks/attendance for selected classes. Keep student registration profiles intact.
                    </span>
                  </div>
                </label>

                {/* Option 3 Radio */}
                <label 
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer select-none transition-all ${
                    deletionOption === 'option3' 
                      ? 'bg-rose-50/50 border-rose-200 text-rose-950 shadow-xs' 
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="deletionOption"
                    value="option3"
                    checked={deletionOption === 'option3'}
                    onChange={() => setDeletionOption('option3')}
                    className="mt-0.5 border-slate-300 text-rose-600 focus:ring-rose-500 h-3.5 w-3.5"
                  />
                  <div className="text-left">
                    <span className="text-xs font-bold block text-slate-850">Option 3: Complete Class Deletion</span>
                    <span className="text-[10px] leading-relaxed text-slate-500 block mt-0.5">
                      Deletes both student profiles and all their associated grades/marks entirely from the database.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Column 3: Safeguard and Actions */}
            <div className="bg-white p-4 rounded-xl border border-rose-100/60 space-y-3.5 md:col-span-1 text-left flex flex-col justify-between">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-rose-950 block pb-2 border-b border-rose-100/40">
                  3. Safety Authorization
                </label>

                <p className="text-[10px] leading-relaxed text-slate-500">
                  This action is permanent and cannot be undone. To prevent accidental keystrokes, type <strong className="text-rose-600 font-bold select-all">CONFIRM</strong> in the box below to authorize.
                </p>

                <input
                  type="text"
                  placeholder="Type CONFIRM here..."
                  value={deleteConfirmationText}
                  onChange={(e) => setDeleteConfirmationText(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-rose-200 rounded-lg outline-none font-bold uppercase tracking-wider text-rose-800 placeholder:text-slate-300 focus:ring-2 focus:ring-rose-500/20"
                />
              </div>

              <button
                type="button"
                onClick={handleBulkDeleteClasses}
                disabled={isDeletingBulk || selectedClassSectionsToDelete.length === 0 || deleteConfirmationText !== 'CONFIRM'}
                className="w-full bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs py-2.5 px-4 rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-3"
              >
                {isDeletingBulk ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Executing Purge...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Authorize & Execute Purge</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {bulkDeleteSuccess && (
            <div className="p-3 bg-teal-50 border border-teal-150 text-teal-850 rounded-lg text-xs flex items-center gap-2 font-medium animate-fadeIn">
              <CheckCircle className="w-4 h-4 text-teal-600" />
              <span>{bulkDeleteSuccess}</span>
            </div>
          )}

          {bulkDeleteError && (
            <div className="p-3 bg-rose-50 border border-rose-150 text-rose-850 rounded-lg text-xs flex items-center gap-2 font-semibold animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>{bulkDeleteError}</span>
            </div>
          )}
        </div>
      )}

      {/* Bulk Class Promotion Accordion Panel */}
      {isPromotionExpanded && currentRole === 'school_admin' && (
        <div id="bulk_promotion_panel" className="w-full bg-indigo-50/40 border border-indigo-100 rounded-xl p-3 sm:p-5 space-y-3 sm:space-y-4 animate-fadeIn">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h3 className="font-extrabold text-indigo-950 text-sm flex items-center gap-2 uppercase tracking-tight font-sans">
                <TrendingUp className="w-4.5 h-4.5 text-indigo-600 animate-pulse" />
                Bulk Class &amp; Standard Promotion Desk
              </h3>
              <p className="text-xs text-indigo-800 leading-relaxed max-w-3xl font-sans">
                Promote all students of a specific class and section to their next standard/grade in bulk. This operation keeps all basic student details, photos, registration IDs, and profiles fully intact while changing their Class level, Section, and automatic report card promotion status instantly.
              </p>
            </div>
            <button 
              onClick={() => setIsPromotionExpanded(false)}
              className="p-1 hover:bg-indigo-150 text-indigo-400 hover:text-indigo-600 rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            {/* Column 1: Source Class Configuration */}
            <div className="bg-white p-4 rounded-xl border border-indigo-100/60 space-y-3.5 text-left flex flex-col justify-between">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-indigo-950 block pb-2 border-b border-indigo-100/40 font-sans">
                  1. Source Class &amp; Section
                </label>

                <div className="space-y-3 font-sans">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Source Class Standard</span>
                    <select
                      value={promotionSourceClass}
                      onChange={(e) => {
                        setPromotionSourceClass(e.target.value);
                        setPromotionSuccess(null);
                        setPromotionError(null);
                      }}
                      className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none transition-all cursor-pointer"
                    >
                      <option value="">-- Choose Class --</option>
                      {uniqueClasses.map(cls => (
                        <option key={cls} value={cls}>{cls}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Source Section</span>
                    <select
                      value={promotionSourceSection}
                      onChange={(e) => {
                        setPromotionSourceSection(e.target.value);
                        setPromotionSuccess(null);
                        setPromotionError(null);
                      }}
                      className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none transition-all cursor-pointer"
                    >
                      <option value="all">All Sections (Entire Standard)</option>
                      {uniqueSections.map(sec => (
                        <option key={sec} value={sec}>Section {sec}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2: Target Class Configuration */}
            <div className="bg-white p-4 rounded-xl border border-indigo-100/60 space-y-3.5 text-left flex flex-col justify-between">
              <div className="space-y-3 font-sans">
                <label className="text-[10px] font-black uppercase text-indigo-950 block pb-2 border-b border-indigo-100/40 font-sans">
                  2. Target Class &amp; Section
                </label>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Target Class Standard</span>
                    <input
                      type="text"
                      placeholder="e.g. Class 6"
                      list="targetClassesList"
                      value={promotionTargetClass}
                      onChange={(e) => {
                        setPromotionTargetClass(e.target.value);
                        setPromotionSuccess(null);
                        setPromotionError(null);
                      }}
                      className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <datalist id="targetClassesList">
                      {uniqueClasses.map(cls => (
                        <option key={cls} value={cls} />
                      ))}
                    </datalist>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Target Section</span>
                    <input
                      type="text"
                      placeholder="e.g. A (Leave empty to keep original)"
                      value={promotionTargetSection}
                      onChange={(e) => {
                        setPromotionTargetSection(e.target.value);
                        setPromotionSuccess(null);
                        setPromotionError(null);
                      }}
                      className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono uppercase"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Column 3: Academic Session Configuration */}
            <div className="bg-white p-4 rounded-xl border border-indigo-100/60 space-y-3.5 text-left flex flex-col justify-between">
              <div className="space-y-3 font-sans">
                <label className="text-[10px] font-black uppercase text-indigo-950 block pb-2 border-b border-indigo-100/40 font-sans">
                  3. Session Rollover Config
                </label>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Archive Current Year To</span>
                    <input
                      type="text"
                      placeholder="e.g. Session 2026-2027"
                      value={currentSessionToArchive}
                      onChange={(e) => setCurrentSessionToArchive(e.target.value)}
                      className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <span className="text-[9px] text-gray-400 block leading-tight mt-0.5">
                      Saves active grades &amp; details under this session name before resetting.
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-1 border-t border-indigo-50/40">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={shouldUpdateSchoolSession}
                        onChange={(e) => setShouldUpdateSchoolSession(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                      />
                      <span className="text-[10px] uppercase font-black text-slate-700">Roll-over School Session</span>
                    </label>

                    {shouldUpdateSchoolSession && (
                      <div className="space-y-1 animate-fadeIn">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block">New Active Session Year</span>
                        <input
                          type="text"
                          placeholder="e.g. Session 2027-2028"
                          value={newSessionName}
                          onChange={(e) => setNewSessionName(e.target.value)}
                          className="w-full text-xs font-bold text-indigo-700 bg-indigo-50/50 border border-indigo-150 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                        <span className="text-[8px] text-indigo-600 block leading-tight">
                          Automatically updates the active school year to this value.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Column 4: Status Verdict & Execution */}
            <div className="bg-white p-4 rounded-xl border border-indigo-100/60 space-y-3.5 text-left flex flex-col justify-between">
              <div className="space-y-3 font-sans">
                <label className="text-[10px] font-black uppercase text-indigo-950 block pb-2 border-b border-indigo-100/40 font-sans">
                  4. Promotion Verdict Text
                </label>

                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Report Card Verdict</span>
                  <input
                    type="text"
                    placeholder="e.g. Congratulations! Promoted to the next standard."
                    value={promotionStatusText}
                    onChange={(e) => setPromotionStatusText(e.target.value)}
                    className="w-full text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <span className="text-[9px] text-gray-400 block leading-tight mt-1 font-sans">
                    This message is stamped onto student report cards for parents to view in the login portal.
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleBulkPromotion}
                disabled={isPromoting || !promotionSourceClass || !promotionTargetClass}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs py-2.5 px-4 rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-3 font-sans"
              >
                {isPromoting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin font-sans" />
                    <span>Promoting Students...</span>
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-3.5 h-3.5 font-sans" />
                    <span>Promote Entire Class</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {promotionSuccess && (
            <div className="p-3 bg-teal-50 border border-teal-150 text-teal-850 rounded-lg text-xs flex items-center gap-2 font-medium animate-fadeIn font-sans">
              <CheckCircle className="w-4 h-4 text-teal-600 shrink-0" />
              <span>{promotionSuccess}</span>
            </div>
          )}

          {promotionError && (
            <div className="p-3 bg-rose-50 border border-rose-150 text-rose-850 rounded-lg text-xs flex items-center gap-2 font-semibold animate-fadeIn font-sans">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{promotionError}</span>
            </div>
          )}
        </div>
      )}

      {/* Recycle Bin / Soft Delete Accordion Panel */}
      {isRecycleBinExpanded && (
        <div id="recycle_bin_panel" className="w-full bg-amber-50/40 border border-amber-200 rounded-xl p-3 sm:p-5 space-y-3 sm:space-y-4 animate-fadeIn">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <h3 className="font-extrabold text-amber-950 text-sm flex items-center gap-2 uppercase tracking-tight">
                <RefreshCw className="w-4 h-4 text-amber-600 animate-spin" style={{ animationDuration: '8s' }} />
                Student Registry Recycle Bin & Soft Recovery
              </h3>
              <p className="text-xs text-amber-800 leading-relaxed max-w-3xl">
                Accidentally deleted students or grade sheets can be recovered instantly. Preserves profiles and score sheets exactly as they were prior to removal.
              </p>
            </div>
            <button 
              onClick={() => setIsRecycleBinExpanded(false)}
              className="p-1 hover:bg-amber-100 text-amber-400 hover:text-amber-600 rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {recycleBin.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-amber-150 text-center space-y-2">
              <div className="mx-auto w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-500">
                <RefreshCw className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-800 text-sm">Recycle Bin is Empty</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                There are no deleted records currently in storage. Any student profile or class-wide score list you delete will safely show up here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-white px-3 py-2 rounded-lg border border-amber-150/60">
                <span className="text-xs font-bold text-slate-700">
                  Total stored items: <span className="font-black text-amber-700">{recycleBin.length}</span>
                </span>
                <button
                  onClick={handleClearRecycleBin}
                  className="text-xs font-bold text-rose-600 hover:text-rose-700 cursor-pointer flex items-center gap-1 hover:underline"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Empty Recycle Bin
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto space-y-2 pr-1.5">
                {recycleBin.map((item) => {
                  const typeLabel = 
                    item.type === 'student' ? 'Student Profile' :
                    item.type === 'class_purge_option2' ? 'Marks Cleared' : 'Class Deleted';

                  const badgeColors = 
                    item.type === 'student' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                    item.type === 'class_purge_option2' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-rose-50 text-rose-700 border-rose-200';

                  return (
                    <div 
                      key={item.id}
                      className="bg-white border border-slate-150 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs hover:border-amber-200 transition-colors"
                    >
                      <div className="space-y-1 text-left">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${badgeColors}`}>
                            {typeLabel}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            Deleted At: {new Date(item.deletedAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-800 leading-relaxed">
                          {item.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          onClick={() => handleRestoreRecycleItem(item)}
                          className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold text-xs py-1.5 px-3 rounded-lg flex items-center gap-1 shadow-xs transition-all cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3 animate-spin" style={{ animationDuration: '4s' }} /> Restore Data
                        </button>
                        <button
                          onClick={() => handleDeletePermanently(item.id)}
                          className="bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-600 hover:text-rose-700 font-bold text-xs py-1.5 px-3 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" /> Purge
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recycle Bin Delete Confirmation Modal */}
          {isRecycleConfirmOpen && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
              <div className="bg-white border border-rose-100 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 animate-scaleUp text-left">
                <div className="flex items-center gap-3 pb-3 border-b border-rose-100/60">
                  <div className="w-10 h-10 bg-rose-50 rounded-full flex items-center justify-center text-rose-600">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-rose-950 text-sm uppercase tracking-tight">
                      Confirm Permanent Deletion
                    </h3>
                    <p className="text-[10px] font-mono text-rose-600">
                      Recycle Bin Safeguard Active
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <p className="text-slate-700 leading-relaxed font-semibold">
                    {recycleConfirmId === 'all' 
                      ? 'You are about to empty the entire Recycle Bin. All deleted student profiles and grades stored inside will be completely purged.' 
                      : 'You are about to permanently delete this item from the Recycle Bin. This data cannot be recovered.'}
                  </p>
                  <p className="text-rose-700 font-bold leading-relaxed bg-rose-50/50 p-2.5 rounded-lg border border-rose-200/50">
                    ⚠️ Warning: This action is permanent and completely bypasses any secondary recovery caches.
                  </p>
                  <div className="space-y-1.5 pt-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">
                      To confirm, type <strong className="text-rose-600 font-black">DELETE</strong> or <strong className="text-indigo-600 font-black">CONFIRM</strong> below:
                    </label>
                    <input
                      type="text"
                      placeholder="Type DELETE or CONFIRM here..."
                      value={recycleConfirmInput}
                      onChange={(e) => setRecycleConfirmInput(e.target.value)}
                      className="w-full px-3 py-2 border border-rose-200 rounded-lg outline-none font-bold uppercase tracking-wider text-rose-800 placeholder:text-slate-300 focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRecycleConfirmOpen(false);
                      setRecycleConfirmId(null);
                      setRecycleConfirmInput('');
                    }}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2 px-4 rounded-lg transition-all cursor-pointer border border-transparent"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={executeRecycleBinDeletion}
                    disabled={recycleConfirmInput.trim().toUpperCase() !== 'CONFIRM' && recycleConfirmInput.trim().toUpperCase() !== 'DELETE'}
                    className="bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs py-2 px-4 rounded-lg shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Purge</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {bulkDeleteSuccess && (
            <div className="p-3 bg-teal-50 border border-teal-150 text-teal-850 rounded-lg text-xs flex items-center gap-2 font-medium animate-fadeIn">
              <CheckCircle className="w-4 h-4 text-teal-600" />
              <span>{bulkDeleteSuccess}</span>
            </div>
          )}

          {bulkDeleteError && (
            <div className="p-3 bg-rose-50 border border-rose-150 text-rose-850 rounded-lg text-xs flex items-center gap-2 font-semibold animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>{bulkDeleteError}</span>
            </div>
          )}
        </div>
      )}

      {/* Filter and Table Grid of existing students */}
      <div className="bg-slate-50 p-4.5 rounded-xl border border-gray-150 space-y-3">
        <div className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5 text-indigo-600" />
          Manage Student Grades Filters
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Classwise Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-gray-500 block">Class Filter (Classwise)</label>
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-200 bg-white rounded-lg outline-none font-semibold text-gray-700 focus:ring-2 focus:ring-indigo-500/15"
            >
              <option value="all">All Classes</option>
              {uniqueClasses.map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>

          {/* Unified Search Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-gray-500 block">Search Any Student (Name / Roll / Mobile)</label>
            <input
              type="text"
              placeholder="Type Name, Roll, or Mobile Number..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-200 bg-white rounded-lg outline-none font-semibold text-gray-700 focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500"
            />
          </div>

          {/* Section Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-gray-500 block">Section Filter</label>
            <select
              value={filterSection}
              onChange={(e) => setFilterSection(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-200 bg-white rounded-lg outline-none font-semibold text-gray-700 focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500"
            >
              <option value="all">All Sections</option>
              {uniqueSections.map(sec => (
                <option key={sec} value={sec}>{sec}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-3">

        {(() => {
          const isAdmissionNoVisible = isFieldActiveInLayout('admissionNo', filterClass, filterSection);
          const isDobVisible = isFieldActiveInLayout('dob', filterClass, filterSection);
          const totalCols = 5 + (isAdmissionNoVisible ? 1 : 0) + (isDobVisible ? 1 : 0);

          return (
            <div className="w-full overflow-x-auto overscroll-x-contain touch-pan-x border border-gray-100 rounded-xl [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]">
              <table className="w-full min-w-[680px] text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100 font-sans text-gray-500">
                    <th className="p-3 font-semibold w-16">Roll No</th>
                    {isAdmissionNoVisible && <th className="p-3 font-semibold w-32">Admission No</th>}
                    <th className="p-3 font-semibold">Student Name</th>
                    <th className="p-3 font-semibold">Class / Sec</th>
                    {isDobVisible && <th className="p-3 font-semibold">D.O.B</th>}
                    <th className="p-3 font-semibold">Parent Mobile</th>
                    <th className="p-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={totalCols} className="p-6 text-center text-gray-400 italic">No student records match search criteria.</td>
                    </tr>
                  ) : (
                    paginatedStudents.map((std) => (
                      <tr 
                        key={std.id}
                        id={`student_row_${std.id}`} 
                        className={`hover:bg-gray-50/50 cursor-pointer transition-colors ${selectedStudentId === std.id ? 'bg-indigo-50/20' : ''}`}
                        onClick={() => onSelectStudent(std.id)}
                      >
                        <td className="p-3 font-mono font-bold text-gray-600">{std.rollNo}</td>
                        {isAdmissionNoVisible && (
                          <td className="p-3 font-mono text-gray-500">
                            {isFieldActiveInLayout('admissionNo', std.className, std.section) && std.admissionNo && !std.admissionNo.startsWith('adm_') ? (
                              <code>{std.admissionNo}</code>
                            ) : (
                              <span className="text-slate-350 italic text-[11px]">—</span>
                            )}
                          </td>
                        )}
                        <td className="p-3 font-semibold text-gray-900">{std.name}</td>
                        <td className="p-3 text-gray-700">{std.className} - {std.section}</td>
                        {isDobVisible && (
                          <td className="p-3 text-gray-500">
                            {isFieldActiveInLayout('dob', std.className, std.section) ? std.dob : '—'}
                          </td>
                        )}
                        <td className="p-3 font-mono text-slate-600 text-xs whitespace-nowrap">
                          {std.mobileNumber ? (
                            <span className="inline-flex items-center gap-1 text-slate-700 font-semibold bg-slate-100/80 px-2 py-0.5 rounded border border-slate-200/60">
                              📞 {std.mobileNumber}
                            </span>
                          ) : (
                            <span className="text-slate-300 italic text-[11px]">—</span>
                          )}
                        </td>
                    <td className="p-3 text-right flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      {isReadOnly ? (
                        <span className="text-xs text-slate-400 font-semibold flex items-center gap-1 px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-lg select-none">
                          📂 Read Only
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => startEditStudent(std)}
                            className="p-1 px-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 font-medium rounded-md transition"
                            title="Edit Student Info"
                          >
                            <Edit className="w-3.5 h-3.5 inline mr-1" /> Edit
                          </button>
                          <button
                            onClick={() => removeStudentRecord(std.id)}
                            className="p-1 px-2.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-transparent hover:border-rose-100 font-semibold rounded-md transition flex items-center gap-1 cursor-pointer"
                            title="Delete Student Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </>
                      )}
                      <ChevronRight className="w-4 h-4 text-gray-400" />
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
        {filteredStudents.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50/50 p-3 rounded-xl border border-gray-100 text-xs no-print">
            <div className="flex items-center gap-2 text-gray-500 flex-wrap">
              <span>Show</span>
              <select
                value={studentPageSize}
                onChange={(e) => {
                  setStudentPageSize(Number(e.target.value));
                  setStudentPage(1);
                }}
                className="bg-white border border-gray-200 rounded-lg p-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>entries</span>
              <span className="mx-1 text-gray-300">|</span>
              <span>
                Showing <strong className="text-gray-900 font-semibold">{Math.min(filteredStudents.length, (studentPage - 1) * studentPageSize + 1)}</strong> to{' '}
                <strong className="text-gray-900 font-semibold">{Math.min(filteredStudents.length, studentPage * studentPageSize)}</strong> of{' '}
                <strong className="text-gray-900 font-semibold">{filteredStudents.length}</strong> students
              </span>
            </div>

            <div className="flex items-center gap-1 flex-wrap">
              <button
                disabled={studentPage === 1}
                onClick={() => setStudentPage(1)}
                className={`px-2 py-1 rounded-md border font-medium transition ${
                  studentPage === 1
                    ? 'bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed'
                    : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-200 cursor-pointer'
                }`}
              >
                First
              </button>
              <button
                disabled={studentPage === 1}
                onClick={() => setStudentPage((prev) => Math.max(1, prev - 1))}
                className={`px-2 py-1 rounded-md border font-medium transition ${
                  studentPage === 1
                    ? 'bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed'
                    : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-200 cursor-pointer'
                }`}
              >
                Prev
              </button>
              
              {/* Visible Page Numbers */}
              {Array.from({ length: totalStudentPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalStudentPages || Math.abs(p - studentPage) <= 1)
                .map((p, index, arr) => {
                  const showEllipsis = index > 0 && p - arr[index - 1] > 1;
                  return (
                    <React.Fragment key={p}>
                      {showEllipsis && <span className="px-1.5 text-gray-400">...</span>}
                      <button
                        onClick={() => setStudentPage(p)}
                        className={`px-2.5 py-1 rounded-md border font-bold transition ${
                          studentPage === p
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-200 cursor-pointer'
                        }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  );
                })}

              <button
                disabled={studentPage === totalStudentPages}
                onClick={() => setStudentPage((prev) => Math.min(totalStudentPages, prev + 1))}
                className={`px-2 py-1 rounded-md border font-medium transition ${
                  studentPage === totalStudentPages
                    ? 'bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed'
                    : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-200 cursor-pointer'
                }`}
              >
                Next
              </button>
              <button
                disabled={studentPage === totalStudentPages}
                onClick={() => setStudentPage(totalStudentPages)}
                className={`px-2 py-1 rounded-md border font-medium transition ${
                  studentPage === totalStudentPages
                    ? 'bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed'
                    : 'bg-white hover:bg-gray-50 text-gray-600 border-gray-200 cursor-pointer'
                }`}
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Manual Grade spreadsheet and Profile drawer modal */}
      {isEditing && editingStudent && editingGrades && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] sm:max-h-[85vh] overflow-hidden shadow-2xl border border-gray-100 flex flex-col">
            
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span>{editingStudent.name ? `Editing ${editingStudent.name}` : `Register New Student`}</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Fields are immediately verified by scale parameters.</p>
              </div>
              <button onClick={() => setIsEditing(false)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 shrink-0" title="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Editing tabs slider */}
            <div className="flex border-b border-gray-100 text-xs px-3 sm:px-5 overflow-x-auto whitespace-nowrap scrollbar-none touch-pan-x">
              <button 
                onClick={() => setActiveTab('profile')}
                className={`py-3 px-3 sm:px-4 font-bold border-b-2 transition-all shrink-0 ${activeTab === 'profile' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
              >
                1. Student Profile Data
              </button>
              <button 
                onClick={() => setActiveTab('scholastic')}
                className={`py-3 px-3 sm:px-4 font-bold border-b-2 transition-all shrink-0 ${activeTab === 'scholastic' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
              >
                2. Scholastic Marks Grid
              </button>
              <button 
                onClick={() => setActiveTab('co_scholastic')}
                className={`py-3 px-3 sm:px-4 font-bold border-b-2 transition-all shrink-0 ${activeTab === 'co_scholastic' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
              >
                3. Co-Scholastic Traits
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-grow max-h-[60vh] sm:max-h-[55vh]">
              {activeTab === 'profile' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-400">Full Name</label>
                    <input
                      type="text"
                      value={editingStudent.name}
                      onChange={(e) => setEditingStudent({...editingStudent, name: e.target.value})}
                      id="edit_std_name"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs"
                      placeholder="e.g. Meera Malhotra"
                    />
                  </div>
                  {(() => {
                    const activeStruct = matchStructureForStudent(reportCardStructures || [], editingStudent.className, editingStudent.section);
                    const bObj = activeStruct?.branding || branding;

                    const rawStudentFields = (activeStruct?.branding?.studentFields && Array.isArray(activeStruct.branding.studentFields))
                      ? activeStruct.branding.studentFields
                      : (branding?.studentFields && Array.isArray(branding.studentFields) && branding.studentFields.length > 0
                          ? branding.studentFields
                          : [
                              { id: "name", label: bObj?.studentNameLabel || "Student's Name" },
                              { id: "fatherName", label: bObj?.fatherNameLabel || "Father's Name" },
                              { id: "motherName", label: bObj?.motherNameLabel || "Mother's Name" },
                              { id: "height", label: bObj?.heightLabel || "Height" },
                              { id: "weight", label: bObj?.weightLabel || "Weight" },
                              { id: "className", label: bObj?.classLabel || "Class" },
                              { id: "section", label: bObj?.sectionLabel || "Section" },
                              { id: "rollNo", label: bObj?.rollNoLabel || "Roll No" },
                              { id: "admissionNo", label: bObj?.admissionNoLabel || "Admission No." },
                              { id: "dob", label: bObj?.dobLabel || "D.O.B." }
                            ]);

                    // Filter out 'name' (rendered as Full Name above) and any field inactive in this class's layout
                    const visibleFields = rawStudentFields.filter(f => {
                      if (f.id === 'name') return false;
                      return isStudentFieldActive(f.id, editingStudent.className, editingStudent.section, reportCardStructures, branding);
                    });

                    // Ensure className, section, and rollNo are always available for student management
                    const finalFieldsToRender = [...visibleFields];
                    if (!finalFieldsToRender.some(f => f.id === 'className')) {
                      finalFieldsToRender.splice(0, 0, { id: 'className', label: bObj?.classLabel || 'Class' });
                    }
                    if (!finalFieldsToRender.some(f => f.id === 'section')) {
                      const classIdx = finalFieldsToRender.findIndex(f => f.id === 'className');
                      finalFieldsToRender.splice(classIdx + 1, 0, { id: 'section', label: bObj?.sectionLabel || 'Section' });
                    }
                    if (!finalFieldsToRender.some(f => f.id === 'rollNo')) {
                      const secIdx = finalFieldsToRender.findIndex(f => f.id === 'section');
                      finalFieldsToRender.splice(secIdx + 1, 0, { id: 'rollNo', label: bObj?.rollNoLabel || 'Roll No' });
                    }

                    return finalFieldsToRender.map((field) => {
                      const isLocked = (field.id === 'className' || field.id === 'section') && currentRole === 'class_teacher';
                      const getPlaceholder = (id: string, lbl: string) => {
                        if (id === 'fatherName') return 'e.g. Ramesh Kumar (Mr. added automatically)';
                        if (id === 'motherName') return 'e.g. Sunita Devi (Mrs. added automatically)';
                        if (id === 'height') return 'e.g. 135 CM';
                        if (id === 'weight') return 'e.g. 42 KG';
                        return `e.g. enter ${lbl}`;
                      };

                      if (field.id === 'className') {
                        return (
                          <div key={field.id} className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-400">
                              {field.label} {isLocked && <span className="text-[8px] text-amber-600 font-normal italic">(locked)</span>}
                            </label>
                            <select
                              value={editingStudent.className || ''}
                              onChange={(e) => {
                                const newClass = e.target.value;
                                const classSecs = getSectionsForClass(newClass, schoolClasses, students, reportCardStructures);
                                const isCurrentSecValid = classSecs.some(s => s.toLowerCase() === (editingStudent.section || '').toLowerCase());
                                setEditingStudent({
                                  ...editingStudent,
                                  className: newClass,
                                  section: isCurrentSecValid ? editingStudent.section : (classSecs[0] || 'A')
                                });
                              }}
                              disabled={isLocked}
                              id={`edit_std_${field.id}`}
                              className="w-full px-3 py-2 border border-gray-200 bg-white font-semibold text-gray-800 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/15"
                            >
                              <option value="">-- Select Standard Class --</option>
                              {allSyncedClasses.map(cls => (
                                <option key={cls} value={cls}>{cls}</option>
                              ))}
                              {editingStudent.className && !allSyncedClasses.some(c => classesMatch(c, editingStudent.className)) && (
                                <option value={editingStudent.className}>{editingStudent.className} (Current)</option>
                              )}
                            </select>
                          </div>
                        );
                      }

                      if (field.id === 'section') {
                        const classSecs = getSectionsForClass(editingStudent.className, schoolClasses, students, reportCardStructures);
                        const availableSections = classSecs.length > 0 ? classSecs : ['A', 'B'];
                        const currentSec = (editingStudent.section || '').trim();
                        const matchedSec = availableSections.find(s => s.toLowerCase() === currentSec.toLowerCase()) || availableSections[0] || 'A';
                        return (
                          <div key={field.id} className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-gray-400">
                              {field.label} {isLocked && <span className="text-[8px] text-amber-600 font-normal italic">(locked)</span>}
                            </label>
                            <select
                              value={matchedSec}
                              onChange={(e) => setEditingStudent({...editingStudent, section: e.target.value})}
                              disabled={isLocked}
                              id={`edit_std_${field.id}`}
                              className="w-full px-3 py-2 border border-gray-200 bg-white font-semibold text-gray-800 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/15"
                            >
                              {availableSections.map(sec => (
                                <option key={sec} value={sec}>{sec.length === 1 ? `Section ${sec}` : sec}</option>
                              ))}
                            </select>
                          </div>
                        );
                      }

                      return (
                        <div key={field.id} className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-gray-400">
                            {field.label} {isLocked && <span className="text-[8px] text-amber-600 font-normal italic">(locked)</span>}
                          </label>
                          <input
                            type="text"
                            value={(editingStudent as any)[field.id] || ''}
                            onChange={(e) => setEditingStudent({...editingStudent, [field.id]: e.target.value})}
                            onBlur={(e) => {
                              const val = e.target.value;
                              if (field.id === 'fatherName') {
                                setEditingStudent(prev => prev ? { ...prev, fatherName: formatFatherName(val) } : null);
                              } else if (field.id === 'motherName') {
                                setEditingStudent(prev => prev ? { ...prev, motherName: formatMotherName(val) } : null);
                              } else if (field.id === 'height') {
                                setEditingStudent(prev => prev ? { ...prev, height: formatHeight(val) } : null);
                              } else if (field.id === 'weight') {
                                setEditingStudent(prev => prev ? { ...prev, weight: formatWeight(val) } : null);
                              }
                            }}
                            disabled={isLocked}
                            id={`edit_std_${field.id}`}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs"
                            placeholder={getPlaceholder(field.id, field.label)}
                          />
                        </div>
                      );
                    });
                  })()}

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-400">
                      Parent Mobile Number <span className="text-[8px] text-slate-400 font-normal">(for portal login)</span>
                    </label>
                    <input
                      type="tel"
                      value={editingStudent.mobileNumber || ''}
                      onChange={(e) => setEditingStudent(prev => prev ? { ...prev, mobileNumber: e.target.value } : null)}
                      id="edit_std_mobileNumber"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs"
                      placeholder="e.g. 9876543210"
                    />
                  </div>

                  <div className="space-y-1 col-span-1 md:col-span-2">
                    <label className="text-[10px] font-bold uppercase text-gray-400 block mb-1">Student Profile Photo</label>
                    <div className="flex gap-3 items-center bg-slate-50 p-2.5 rounded-xl border border-slate-150">
                      {/* Photo preview bubble */}
                      <div className="w-12 h-14 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0 flex items-center justify-center relative group/bubble">
                        {editingStudent.photoUrl ? (
                          <img 
                            src={editingStudent.photoUrl} 
                            alt="Student preview" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <Camera className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      
                      {/* Upload actions and input URL */}
                      <div className="flex-grow space-y-1.5 min-w-0">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editingStudent.photoUrl || ''}
                            onChange={(e) => setEditingStudent({...editingStudent, photoUrl: e.target.value})}
                            id="edit_std_photo"
                            className="flex-grow px-2 py-1 bg-white border border-slate-200 rounded-md text-[11px] placeholder:text-gray-300 focus:outline-none focus:border-indigo-500"
                            placeholder="Paste image URL here..."
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = 'image/*';
                              input.onchange = async (event: any) => {
                                const file = event.target.files?.[0];
                                if (file) {
                                  try {
                                    const compressed = await compressAndResizeStudentPhoto(file);
                                    setEditingStudent({ ...editingStudent, photoUrl: compressed });
                                  } catch (err) {
                                    alert("Failed to compress and upload student image.");
                                  }
                                }
                              };
                              input.click();
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-md transition-colors shrink-0 cursor-pointer flex items-center gap-1"
                          >
                            <Upload className="w-3 h-3" />
                            <span>Browse File</span>
                          </button>
                        </div>
                        <span className="text-[9px] text-gray-400 block leading-none">
                          Or upload local photo. Compressed client-side to keep database light & secure.
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="md:col-span-3 grid grid-cols-2 gap-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                    {term1Active && (
                      <div className="space-y-1 col-span-2 sm:col-span-1">
                        <label className="text-[10px] font-bold uppercase text-indigo-600 block">Term 1 Attendance (e.g. 180/220)</label>
                        <input
                          type="text"
                          value={editingGrades.attendance.term1 || ''}
                          onChange={(e) => setEditingGrades({
                            ...editingGrades,
                            attendance: { ...editingGrades.attendance, term1: e.target.value }
                          })}
                          id="edit_std_att_t1"
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
                          placeholder="e.g. 180/220"
                        />
                      </div>
                    )}

                    {term2Active && (
                      <div className="space-y-1 col-span-2 sm:col-span-1">
                        <label className="text-[10px] font-bold uppercase text-teal-600 block">Term 2 Attendance (e.g. 180/220)</label>
                        <input
                          type="text"
                          value={editingGrades.attendance.term2 || ''}
                          onChange={(e) => setEditingGrades({
                            ...editingGrades,
                            attendance: { ...editingGrades.attendance, term2: e.target.value }
                          })}
                          id="edit_std_att_t2"
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
                          placeholder="e.g. 180/220"
                        />
                      </div>
                    )}

                    {term3Active && (
                      <div className="space-y-1 col-span-2 sm:col-span-1">
                        <label className="text-[10px] font-bold uppercase text-rose-600 block">Term 3 Attendance (e.g. 180/220)</label>
                        <input
                          type="text"
                          value={editingGrades.attendance.term3 || ''}
                          onChange={(e) => setEditingGrades({
                            ...editingGrades,
                            attendance: { ...editingGrades.attendance, term3: e.target.value }
                          })}
                          id="edit_std_att_t3"
                          className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
                          placeholder="e.g. 180/220"
                        />
                      </div>
                    )}

                    <div className="space-y-1 col-span-2">
                      <label className="text-[10px] font-bold uppercase text-indigo-600">Promotion Congratulations Statement</label>
                      <input
                        type="text"
                        value={editingStudent.promotionStatus}
                        onChange={(e) => setEditingStudent({...editingStudent, promotionStatus: e.target.value})}
                        id="edit_std_promotion"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-white"
                      />
                    </div>
                    
                    <div className="space-y-1 col-span-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold uppercase text-indigo-600">Teacher's Custom Remarks</label>
                        <button
                          type="button"
                          onClick={() => {
                            setAiRemarksModalMode('single');
                            setAiRemarksTargetStudent(editingStudent);
                            setIsAiRemarksModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors shadow-2xs cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                          <span>✨ Generate with AI</span>
                        </button>
                      </div>
                      <textarea
                        value={editingStudent.remarks}
                        onChange={(e) => setEditingStudent({...editingStudent, remarks: e.target.value})}
                        id="edit_std_remarks"
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs bg-white"
                        placeholder="Enter customized remarks or use AI to generate..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'scholastic' && (
                <div className="w-full overflow-x-auto overscroll-x-contain touch-pan-x border border-gray-100 rounded-xl [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]">
                  <table className="w-full min-w-[650px] text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-50/80 border-b border-gray-100 text-gray-500">
                        <th className="p-3 font-semibold">Subject</th>
                        {/* Term 1 sub headers */}
                        {term1Active && editingStudentT1ScoreColumns.map(col => (
                          <th key={col.id} className="p-3 font-semibold text-center whitespace-nowrap bg-indigo-50/20 text-indigo-900">
                            T1 {col.name}<br/>
                            <span className="text-[9px] text-indigo-600 font-mono">Max {col.maxMarks}</span>
                          </th>
                        ))}
                        {/* Term 2 sub headers */}
                        {term2Active && editingStudentT2ScoreColumns.map(col => {
                          const isMidTerm = col.id === 'mid_term' || col.id === 'mid-term' || col.name.toLowerCase() === 'mid-term';
                          const colName = isMidTerm ? 'Annual' : col.name;
                          return (
                            <th key={col.id} className="p-3 font-semibold text-center whitespace-nowrap bg-teal-50/20 text-teal-900">
                              T2 {colName}<br/>
                              <span className="text-[9px] text-teal-600 font-mono">Max {col.maxMarks}</span>
                            </th>
                          );
                        })}
                        {/* Term 3 sub headers */}
                        {term3Active && editingStudentT3ScoreColumns.map(col => {
                          const isMidTerm = col.id === 'mid_term' || col.id === 'mid-term' || col.name.toLowerCase() === 'mid-term';
                          const colName = isMidTerm ? 'Annual' : col.name;
                          return (
                            <th key={col.id} className="p-3 font-semibold text-center whitespace-nowrap bg-rose-50/20 text-rose-900">
                              T3 {colName}<br/>
                              <span className="text-[9px] text-rose-600 font-mono">Max {col.maxMarks}</span>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {editingStudentSubjects.filter(s => s.type === 'scholastic').map((sub) => {
                        const scoreSheet = editingGrades.scholastic[sub.id] || { term1: {}, term2: {}, term3: {} };
                        return (
                          <tr key={sub.id} id={`edit_sch_row_${sub.id}`}>
                            <td className="p-3 font-bold text-gray-700">{sub.name}</td>
                            
                            {/* Term 1 cells */}
                            {term1Active && editingStudentT1ScoreColumns.map(col => {
                              const scoreVal = scoreSheet.term1?.[col.id] ?? '';
                              const displayVal = (scoreVal === 0 || scoreVal === '0' || scoreVal === 0.0 || scoreVal === '0.0') ? '' : scoreVal;
                              const currentMax = sub.customMaxMarks?.[col.id] ?? col.maxMarks;
                              return (
                                <td key={`t1_${col.id}`} className="p-2 text-center bg-indigo-50/5">
                                  {isEditingPureGradeBased ? (
                                    <input
                                      type="text"
                                      value={displayVal}
                                      onChange={(e) => updateScholasticMark(sub.id, 'term1', col.id, e.target.value)}
                                      id={`sch_t1_${sub.id}_${col.id}`}
                                      className="w-14 px-2 py-1 text-center border border-gray-200 rounded text-xs bg-white uppercase font-bold focus:ring-1 focus:ring-indigo-500"
                                      placeholder="Grade"
                                    />
                                  ) : (
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={displayVal}
                                      onChange={(e) => {
                                        const rawVal = e.target.value.trim();
                                        updateScholasticMark(sub.id, 'term1', col.id, rawVal === '' ? '' : (parseFloat(rawVal) || 0));
                                      }}
                                      id={`sch_t1_${sub.id}_${col.id}`}
                                      className="w-14 px-2 py-1 text-center border border-gray-200 rounded text-xs bg-white"
                                      max={currentMax}
                                      min="0"
                                      placeholder={`${currentMax}`}
                                    />
                                  )}
                                </td>
                              );
                            })}

                            {/* Term 2 cells */}
                            {term2Active && editingStudentT2ScoreColumns.map(col => {
                              const scoreVal = scoreSheet.term2?.[col.id] ?? '';
                              const displayVal = (scoreVal === 0 || scoreVal === '0' || scoreVal === 0.0 || scoreVal === '0.0') ? '' : scoreVal;
                              const currentMax = sub.customMaxMarks?.[col.id] ?? col.maxMarks;
                              return (
                                <td key={`t2_${col.id}`} className="p-2 text-center bg-teal-50/5">
                                  {isEditingPureGradeBased ? (
                                    <input
                                      type="text"
                                      value={displayVal}
                                      onChange={(e) => updateScholasticMark(sub.id, 'term2', col.id, e.target.value)}
                                      id={`sch_t2_${sub.id}_${col.id}`}
                                      className="w-14 px-2 py-1 text-center border border-gray-200 rounded text-xs bg-white uppercase font-bold focus:ring-1 focus:ring-indigo-500"
                                      placeholder="Grade"
                                    />
                                  ) : (
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={displayVal}
                                      onChange={(e) => {
                                        const rawVal = e.target.value.trim();
                                        updateScholasticMark(sub.id, 'term2', col.id, rawVal === '' ? '' : (parseFloat(rawVal) || 0));
                                      }}
                                      id={`sch_t2_${sub.id}_${col.id}`}
                                      className="w-14 px-2 py-1 text-center border border-gray-200 rounded text-xs bg-white"
                                      max={currentMax}
                                      min="0"
                                      placeholder={`${currentMax}`}
                                    />
                                  )}
                                </td>
                              );
                            })}

                            {/* Term 3 cells */}
                            {term3Active && editingStudentT3ScoreColumns.map(col => {
                              const scoreVal = scoreSheet.term3?.[col.id] ?? '';
                              const displayVal = (scoreVal === 0 || scoreVal === '0' || scoreVal === 0.0 || scoreVal === '0.0') ? '' : scoreVal;
                              const currentMax = sub.customMaxMarks?.[col.id] ?? col.maxMarks;
                              return (
                                <td key={`t3_${col.id}`} className="p-2 text-center bg-rose-50/5">
                                  {isEditingPureGradeBased ? (
                                    <input
                                      type="text"
                                      value={displayVal}
                                      onChange={(e) => updateScholasticMark(sub.id, 'term3', col.id, e.target.value)}
                                      id={`sch_t3_${sub.id}_${col.id}`}
                                      className="w-14 px-2 py-1 text-center border border-gray-200 rounded text-xs bg-white uppercase font-bold focus:ring-1 focus:ring-rose-500"
                                      placeholder="Grade"
                                    />
                                  ) : (
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={displayVal}
                                      onChange={(e) => {
                                        const rawVal = e.target.value.trim();
                                        updateScholasticMark(sub.id, 'term3', col.id, rawVal === '' ? '' : (parseFloat(rawVal) || 0));
                                      }}
                                      id={`sch_t3_${sub.id}_${col.id}`}
                                      className="w-14 px-2 py-1 text-center border border-gray-200 rounded text-xs bg-white"
                                      max={currentMax}
                                      min="0"
                                      placeholder={`${currentMax}`}
                                    />
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'co_scholastic' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Co-scholastic fields */}
                  <div className="border border-gray-100 rounded-xl p-4 space-y-3">
                    <h4 className="font-semibold text-xs text-gray-700 uppercase tracking-wide border-b border-gray-50 pb-2">
                      Co-Scholastic Qualities (5 point grade scale)
                    </h4>
                    <div className="space-y-3">
                      {subjects.filter(s => s.type === 'co_scholastic').map((sub) => {
                        const tr = editingGrades.co_scholastic[sub.id] || { term1: '', term2: '', term3: '' };
                        const t1Val = (tr.term1 === 0 || tr.term1 === '0') ? '' : (tr.term1 || '');
                        const t2Val = (tr.term2 === 0 || tr.term2 === '0') ? '' : (tr.term2 || '');
                        const t3Val = (tr.term3 === 0 || tr.term3 === '0') ? '' : (tr.term3 || '');
                        return (
                          <div key={sub.id} className="flex justify-between items-center text-xs">
                            <span className="font-medium text-gray-700">{sub.name}</span>
                            <div className="flex items-center gap-2">
                              {term1Active && (
                                <input
                                  type="text"
                                  value={t1Val}
                                  onChange={(e) => {
                                    const copied = { ...editingGrades };
                                    if (!copied.co_scholastic[sub.id]) copied.co_scholastic[sub.id] = { term1: '', term2: '', term3: '' };
                                    copied.co_scholastic[sub.id].term1 = e.target.value;
                                    setEditingGrades(copied);
                                  }}
                                  id={`co_t1_${sub.id}`}
                                  className="w-12 px-1.5 py-1 border border-gray-200 rounded text-center font-bold"
                                  placeholder="T1"
                                />
                              )}
                              {term2Active && (
                                <input
                                  type="text"
                                  value={t2Val}
                                  onChange={(e) => {
                                    const copied = { ...editingGrades };
                                    if (!copied.co_scholastic[sub.id]) copied.co_scholastic[sub.id] = { term1: '', term2: '', term3: '' };
                                    copied.co_scholastic[sub.id].term2 = e.target.value;
                                    setEditingGrades(copied);
                                  }}
                                  id={`co_t2_${sub.id}`}
                                  className="w-12 px-1.5 py-1 border border-gray-200 rounded text-center font-bold"
                                  placeholder="T2"
                                />
                              )}
                              {term3Active && (
                                <input
                                  type="text"
                                  value={t3Val}
                                  onChange={(e) => {
                                    const copied = { ...editingGrades };
                                    if (!copied.co_scholastic[sub.id]) copied.co_scholastic[sub.id] = { term1: '', term2: '', term3: '' };
                                    copied.co_scholastic[sub.id].term3 = e.target.value;
                                    setEditingGrades(copied);
                                  }}
                                  id={`co_t3_${sub.id}`}
                                  className="w-12 px-1.5 py-1 border border-gray-200 rounded text-center font-bold"
                                  placeholder="T3"
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Skills / Activities */}
                  <div className="border border-gray-100 rounded-xl p-4 space-y-3">
                    <h4 className="font-semibold text-xs text-gray-700 uppercase tracking-wide border-b border-gray-50 pb-2">
                      Activities & Extracurriculars (3 point grade scale)
                    </h4>
                    <div className="space-y-3">
                      {subjects.filter(s => s.type === 'activity').map((sub) => {
                        const tr = editingGrades.activity[sub.id] || { term1: '', term2: '', term3: '' };
                        const t1Val = (tr.term1 === 0 || tr.term1 === '0') ? '' : (tr.term1 || '');
                        const t2Val = (tr.term2 === 0 || tr.term2 === '0') ? '' : (tr.term2 || '');
                        const t3Val = (tr.term3 === 0 || tr.term3 === '0') ? '' : (tr.term3 || '');
                        return (
                          <div key={sub.id} className="flex justify-between items-center text-xs">
                            <span className="font-medium text-gray-700">{sub.name}</span>
                            <div className="flex items-center gap-2">
                              {term1Active && (
                                <input
                                  type="text"
                                  value={t1Val}
                                  onChange={(e) => {
                                    const copied = { ...editingGrades };
                                    if (!copied.activity[sub.id]) copied.activity[sub.id] = { term1: '', term2: '', term3: '' };
                                    copied.activity[sub.id].term1 = e.target.value;
                                    setEditingGrades(copied);
                                  }}
                                  id={`act_t1_${sub.id}`}
                                  className="w-12 px-1.5 py-1 border border-gray-200 rounded text-center font-bold"
                                  placeholder="T1"
                                />
                              )}
                              {term2Active && (
                                <input
                                  type="text"
                                  value={t2Val}
                                  onChange={(e) => {
                                    const copied = { ...editingGrades };
                                    if (!copied.activity[sub.id]) copied.activity[sub.id] = { term1: '', term2: '', term3: '' };
                                    copied.activity[sub.id].term2 = e.target.value;
                                    setEditingGrades(copied);
                                  }}
                                  id={`act_t2_${sub.id}`}
                                  className="w-12 px-1.5 py-1 border border-gray-200 rounded text-center font-bold"
                                  placeholder="T2"
                                />
                              )}
                              {term3Active && (
                                <input
                                  type="text"
                                  value={t3Val}
                                  onChange={(e) => {
                                    const copied = { ...editingGrades };
                                    if (!copied.activity[sub.id]) copied.activity[sub.id] = { term1: '', term2: '', term3: '' };
                                    copied.activity[sub.id].term3 = e.target.value;
                                    setEditingGrades(copied);
                                  }}
                                  id={`act_t3_${sub.id}`}
                                  className="w-12 px-1.5 py-1 border border-gray-200 rounded text-center font-bold"
                                  placeholder="T3"
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 sm:p-5 border-t border-gray-100 bg-gray-50 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-2.5">
              <button 
                onClick={() => setIsEditing(false)} 
                disabled={isSavingStudent}
                className={`w-full sm:w-auto px-4.5 py-2.5 border border-gray-200 text-gray-751 font-semibold text-xs rounded-lg bg-white text-center cursor-pointer transition-all ${isSavingStudent ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Close Without Saving
              </button>
              
              <button
                onClick={saveStudentChanges}
                disabled={isSavingStudent}
                id="edit_save_btn"
                className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5 justify-center cursor-pointer transition-all"
              >
                {isSavingStudent ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                    Saving Student...
                  </>
                ) : (
                  "Save Structural Information"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmDialog && confirmDialog.isOpen && (
        <div id="custom-student-confirm-modal" className="fixed inset-0 w-screen h-screen bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 md:p-8 z-[999999] animate-fadeIn text-slate-900">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full p-8 md:p-10 border border-slate-150 text-center space-y-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="p-4 bg-rose-50 text-rose-600 rounded-full animate-bounce">
                <span className="text-3xl">⚠️</span>
              </div>
              <h3 className="text-2xl font-black tracking-tight text-slate-900">{confirmDialog.title}</h3>
              <p className="text-sm text-slate-600 bg-rose-50/50 p-4 rounded-2xl border border-rose-100/60 leading-relaxed font-semibold text-center">
                {confirmDialog.message}
              </p>
              <p className="text-xs text-slate-400">
                Moving records to the Recycle Bin allows them to be recovered safely.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md pt-4 text-xs font-bold">
                <button
                  type="button"
                  id="student-confirm-cancel"
                  onClick={() => setConfirmDialog(null)}
                  className="w-full sm:w-1/2 px-5 py-3 rounded-2xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition cursor-pointer bg-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="student-confirm-proceed"
                  onClick={() => {
                    confirmDialog.onConfirm();
                    setConfirmDialog(null);
                  }}
                  className="w-full sm:w-1/2 px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white transition shadow-lg shadow-rose-200/50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  Proceed Deletion
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Modal */}
      {alertDialog && alertDialog.isOpen && (
        <div id="custom-student-alert-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-4 z-[9999] transition-all">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 border border-slate-100 animate-in fade-in-50 zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="text-indigo-600 font-bold">💡</span> {alertDialog.title || "Notice"}
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              {alertDialog.message}
            </p>
            <div className="mt-5 flex justify-end text-xs font-semibold">
              <button
                type="button"
                id="student-alert-ok"
                onClick={() => setAlertDialog(null)}
                className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-705 text-white transition"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}



      {/* CSV Bulk Upload Staging Preview & Schema Diff Modal */}
      {isStagingPreviewOpen && stagedChanges.length > 0 && (
        <div id="csv-staging-preview-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-4 z-[9999] transition-all">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full h-[85vh] flex flex-col border border-slate-150 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-indigo-950 text-white">
              <div className="space-y-0.5 text-left">
                <h3 className="text-sm md:text-base font-extrabold flex items-center gap-2 font-sans tracking-tight">
                  <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                  CSV Bulk Upload Staging Preview & Verification
                </h3>
                <p className="text-[11px] text-indigo-200">
                  Verify exactly what profile fields and grade results will change before applying updates to the live database.
                </p>
              </div>
              <button
                onClick={() => {
                  setStagedChanges([]);
                  setIsStagingPreviewOpen(false);
                }}
                className="p-1.5 bg-indigo-900 hover:bg-indigo-850 text-indigo-200 hover:text-white rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Filters Control Bar */}
            <div className="px-5 py-3.5 bg-slate-50 border-b border-gray-150 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-[10px] font-black uppercase text-slate-400 font-sans tracking-wider hidden md:inline">Change Filters:</span>
                <div className="flex bg-white p-1 rounded-lg border border-gray-200 text-xs font-bold gap-1 w-full sm:w-auto">
                  <button
                    onClick={() => setStagedFilter('all')}
                    className={`px-3 py-1.5 rounded-md transition-colors ${stagedFilter === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    All Items ({stagedChanges.length})
                  </button>
                  <button
                    onClick={() => setStagedFilter('insert')}
                    className={`px-3 py-1.5 rounded-md transition-colors ${stagedFilter === 'insert' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    New Profiles ({stagedChanges.filter(c => c.type === 'insert').length})
                  </button>
                  <button
                    onClick={() => setStagedFilter('update')}
                    className={`px-3 py-1.5 rounded-md transition-colors ${stagedFilter === 'update' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    Updates ({stagedChanges.filter(c => c.type === 'update').length})
                  </button>
                </div>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search staged by name/adm..."
                  value={stagedSearchTerm}
                  onChange={(e) => setStagedSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-200 bg-white rounded-lg outline-none font-medium text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/10"
                />
              </div>
            </div>

            {/* Modal Scrollable Diff List */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-3.5">
              {(() => {
                const filtered = stagedChanges.filter(change => {
                  const matchesFilter = 
                    stagedFilter === 'all' || 
                    (stagedFilter === 'insert' && change.type === 'insert') ||
                    (stagedFilter === 'update' && change.type === 'update');

                  const matchesSearch = 
                    !stagedSearchTerm ||
                    change.studentName.toLowerCase().includes(stagedSearchTerm.toLowerCase()) ||
                    change.admissionNo.toLowerCase().includes(stagedSearchTerm.toLowerCase());

                  return matchesFilter && matchesSearch;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="bg-white p-12 rounded-xl border border-gray-200 text-center space-y-2">
                      <div className="mx-auto w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400">
                        <Search className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-slate-800 text-sm">No Staged Records Match Filter</h4>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        Adjust your filter category or search criteria above to see matching staged spreadsheet changes.
                      </p>
                    </div>
                  );
                }

                return filtered.map((change) => {
                  const isNew = change.type === 'insert';
                  const hasDiff = change.profileChanges.length > 0 || change.gradeChanges.length > 0;

                  return (
                    <div 
                      key={change.id}
                      className={`bg-white border rounded-xl p-4 shadow-xs hover:shadow-sm transition-all ${
                        isNew ? 'border-emerald-150 hover:border-emerald-300' : 'border-slate-150 hover:border-amber-300'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-3 border-b border-slate-100">
                        <div className="space-y-1 text-left">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-extrabold text-sm text-slate-900 font-sans tracking-tight">
                              {change.studentName}
                            </h4>
                            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                              isNew 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {isNew ? 'New Registration' : 'Database Override'}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-x-4 gap-y-1 text-[10px] font-mono text-slate-500 flex-wrap">
                            <span>Admission No: <strong className="text-slate-800 font-bold">{change.admissionNo}</strong></span>
                            <span>Standard: <strong className="text-slate-800 font-bold">{change.className} - {change.section}</strong></span>
                            {change.rollNo && <span>Roll No: <strong className="text-slate-800 font-bold">{change.rollNo}</strong></span>}
                          </div>
                        </div>

                        <div className="text-right text-[10px] font-semibold text-slate-400 hidden md:block">
                          Record ID: {change.id}
                        </div>
                      </div>

                      {/* Diff report section */}
                      <div className="mt-3 text-left">
                        {isNew ? (
                          <div className="p-3 bg-emerald-50/30 border border-emerald-100 rounded-lg text-xs space-y-1.5">
                            <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Confirm Profile Registration:
                            </span>
                            <p className="text-slate-600 pl-5 text-[11px] leading-relaxed">
                              This student will be registered to <strong>Class Standard {change.className} - Section {change.section}</strong>. Blank placeholder scorecards will be automatically initialized and ready for entry.
                            </p>
                          </div>
                        ) : !hasDiff ? (
                          <div className="p-2.5 bg-slate-50 border border-slate-150 rounded-lg text-xs text-slate-500 flex items-center gap-2 font-medium">
                            <CheckCircle className="w-3.5 h-3.5 text-slate-400" />
                            <span>No changes detected. This record matches the active database file perfectly. Duplicate entry bypassed.</span>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            
                            {/* Profile overrides */}
                            {change.profileChanges.length > 0 && (
                              <div className="space-y-1.5">
                                <span className="text-[10px] font-black uppercase text-amber-800 block tracking-wider font-sans">
                                  Profile Fields to Overwrite ({change.profileChanges.length})
                                </span>
                                <div className="p-2 bg-amber-50/20 border border-amber-100 rounded-lg text-[11px] space-y-1">
                                  {change.profileChanges.map((p, pIdx) => (
                                    <div key={pIdx} className="flex flex-wrap items-center justify-between gap-2 py-0.5 border-b border-amber-50/50 last:border-0">
                                      <span className="font-bold text-slate-700">{p.field}:</span>
                                      <span className="font-mono flex items-center gap-1.5 text-slate-600">
                                        <span className="line-through text-slate-400">{p.old}</span>
                                        <ChevronRight className="w-3 h-3 text-amber-500" />
                                        <span className="font-bold text-amber-950 bg-amber-50 px-1 py-0.2 rounded border border-amber-200/50">{p.new}</span>
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Grades overrides */}
                            {change.gradeChanges.length > 0 && (
                              <div className="space-y-1.5">
                                <span className="text-[10px] font-black uppercase text-indigo-800 block tracking-wider font-sans">
                                  Academic Marks to Overwrite ({change.gradeChanges.length})
                                </span>
                                <div className="p-2 bg-indigo-50/20 border border-indigo-100 rounded-lg text-[11px] space-y-1">
                                  {change.gradeChanges.map((g, gIdx) => (
                                    <div key={gIdx} className="flex flex-wrap items-center justify-between gap-2 py-0.5 border-b border-indigo-50/50 last:border-0">
                                      <span className="font-bold text-slate-700">
                                        {g.subject} <span className="text-[9px] text-indigo-600 font-medium">({g.scoreType})</span>
                                      </span>
                                      <span className="font-mono flex items-center gap-1.5 text-slate-600">
                                        <span className="line-through text-slate-400">{g.old}</span>
                                        <ChevronRight className="w-3 h-3 text-indigo-500" />
                                        <span className="font-bold text-indigo-950 bg-indigo-50 px-1 py-0.2 rounded border border-indigo-200/50">{g.new}</span>
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Modal Actions Footer */}
            <div className="p-5 border-t border-gray-150 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
              <div className="text-xs text-slate-500 text-left w-full sm:w-auto leading-relaxed">
                By clicking <strong>Confirm & Apply Updates</strong>, your spreadsheet staging items will merge with the school records, updating all grades and rosters.
              </div>
              <div className="flex gap-2.5 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setStagedChanges([]);
                    setIsStagingPreviewOpen(false);
                  }}
                  className="px-5 py-2.5 border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs rounded-xl transition"
                >
                  Cancel & Discard CSV
                </button>
                <button
                  type="button"
                  onClick={handleCommitStagedChanges}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md flex items-center gap-2 transition"
                >
                  <CheckCircle className="w-4 h-4 text-white" />
                  Confirm & Apply All Changes
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* AI Remarks Assistant Modal */}
      {isAiRemarksModalOpen && (
        <AiRemarksModal
          isOpen={isAiRemarksModalOpen}
          onClose={() => {
            setIsAiRemarksModalOpen(false);
            setAiRemarksTargetStudent(null);
          }}
          mode={aiRemarksModalMode}
          student={aiRemarksTargetStudent || editingStudent}
          studentsList={students}
          studentGrades={studentGrades}
          subjects={subjects}
          scoreColumns={scoreColumns}
          gradeScales={gradeScales}
          selectedClass={filterClass !== 'all' ? filterClass : fastEntryClass}
          selectedSection={filterSection !== 'all' ? filterSection : fastEntrySection}
          schoolName={branding.schoolName}
          term1Active={branding.term1Enabled !== false}
          term2Active={branding.term2Enabled !== false}
          term3Active={branding.term3Enabled === true}
          onApplySingleRemark={handleApplySingleRemark}
          onApplyBulkRemarks={handleApplyBulkRemarks}
        />
      )}

      {/* School Classes & Sections Manager Modal */}
      {isClassSectionModalOpen && (
        <ClassSectionManagerModal
          isOpen={isClassSectionModalOpen}
          onClose={() => setIsClassSectionModalOpen(false)}
          classes={schoolClasses || []}
          classNamingStyle={classNamingStyle || 'roman'}
          onSaveClasses={(updatedClasses, style) => {
            if (onUpdateSchoolClasses) {
              onUpdateSchoolClasses(updatedClasses, style);
            }
          }}
          schoolName={branding.schoolName}
          students={students}
        />
      )}

    </div>
  );
}
