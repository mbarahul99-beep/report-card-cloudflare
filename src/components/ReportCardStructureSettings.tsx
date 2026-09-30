import React, { useState, useMemo } from 'react';
import { 
  Layers, Plus, Trash2, Check, AlertCircle, Save, Calendar, 
  CheckSquare, Square, Palette, Award, BookOpen, Clock, Settings, Eye, EyeOff, Edit, 
  ChevronDown, ChevronUp, Printer, Download, Sparkles, HelpCircle, GripVertical,
  FolderTree, Tag, Sliders, Upload, Link2, CheckCircle2, Image as ImageIcon
} from 'lucide-react';
import { SchoolBranding, SubjectColumn, ScoreColumn, ReportCardStructure, GradeScale, CoGradeScale, CoScholasticSection, SignatureItem } from '../types';
import { removeTemplateRequestForSchool } from '../lib/firebaseSync';
import ReportCardPreview from './ReportCardPreview';
import SubjectSettings from './SubjectSettings';
import { formatFatherName, formatMotherName, formatHeight, formatWeight } from '../lib/studentFormatters';
import { normalizeExternalImageUrl, isGoogleDriveUrl, compressAndResizeWatermark } from '../utils/imageUrlHelper';

// Helper image compressor & resizer
function compressAndResizeImage(file: File, maxWidth: number, quality: number, callback: (resizedBase64: string) => void) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const rawResult = e.target?.result as string;
    const img = new Image();
    img.onload = () => {
      try {
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
        if (ctx) {
          const isPNG = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
          if (!isPNG) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, width, height);
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL(isPNG ? 'image/png' : 'image/jpeg', quality);
          callback(compressedBase64);
        } else {
          callback(rawResult);
        }
      } catch (err) {
        console.warn("Canvas resizing failing, using original base64:", err);
        callback(rawResult);
      }
    };
    img.onerror = () => callback(rawResult);
    img.src = rawResult;
  };
  reader.readAsDataURL(file);
}

// Generate dynamically consistent Mock Student Marks
const makeMockGradesForPreview = (
  subjects: SubjectColumn[],
  scoreColumns: ScoreColumn[],
  termSpecificEnabled?: boolean,
  t1Cols?: ScoreColumn[],
  t2Cols?: ScoreColumn[],
  t3Cols?: ScoreColumn[]
) => {
  const scholastic: { [subId: string]: any } = {};
  const co_scholastic: { [subId: string]: any } = {};
  const activity: { [subId: string]: any } = {};

  const effectiveT1 = (termSpecificEnabled && t1Cols && t1Cols.length > 0) ? t1Cols : scoreColumns;
  const effectiveT2 = (termSpecificEnabled && t2Cols && t2Cols.length > 0) ? t2Cols : scoreColumns;
  const effectiveT3 = (termSpecificEnabled && t3Cols && t3Cols.length > 0) ? t3Cols : scoreColumns;

  subjects.filter(s => s.type === 'scholastic' || s.type === 'additional').forEach((sub, idx) => {
    const term1: { [colId: string]: any } = {};
    const term2: { [colId: string]: any } = {};
    const term3: { [colId: string]: any } = {};

    if (effectiveT1 && effectiveT1.length > 0) {
      effectiveT1.forEach(col => {
        const max = col.maxMarks || 100;
        term1[col.id] = Math.round(max * (0.75 + Math.random() * 0.22));
      });
    } else {
      const gradeT1 = (idx % 4 === 0) ? 'E' : ((idx % 4 === 1) ? 'M' : ((idx % 4 === 2) ? 'E' : 'M'));
      term1['_direct_grade'] = gradeT1;
      term1['grade'] = gradeT1;
      term1['total'] = gradeT1 === 'E' ? 90 : 75;
    }

    if (effectiveT2 && effectiveT2.length > 0) {
      effectiveT2.forEach(col => {
        const max = col.maxMarks || 100;
        term2[col.id] = Math.round(max * (0.78 + Math.random() * 0.20));
      });
    } else {
      const gradeT2 = (idx % 3 === 0) ? 'E' : 'M';
      term2['_direct_grade'] = gradeT2;
      term2['grade'] = gradeT2;
      term2['total'] = gradeT2 === 'E' ? 92 : 78;
    }

    if (effectiveT3 && effectiveT3.length > 0) {
      effectiveT3.forEach(col => {
        const max = col.maxMarks || 100;
        term3[col.id] = Math.round(max * (0.80 + Math.random() * 0.18));
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
    activity[sub.id] = { term1: 'A', term2: 'B+', term3: 'A' };
  });

  return {
    studentId: 'mock_student_id',
    scholastic,
    co_scholastic,
    activity,
    attendance: { term1: '94/102', term2: '97/105', term3: '96/102' }
  };
};

const defaultMockStudent = {
  id: "mock_student_id",
  name: "Arun Kumar Sharma",
  fatherName: "Mr. Rajinder Kumar Sharma",
  motherName: "Mrs. Meena Kumari",
  className: "4th Grade",
  section: "A",
  rollNo: "18",
  admissionNo: "SCH-2021/840",
  dob: "12/04/2015",
  height: "134 CM",
  weight: "29 KG",
  photoUrl: "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=250",
  remarks: "Arun is an exceptionally bright, inquisitive student who possesses outstanding logic-solving skills and is very respectful.",
  promotionStatus: "Promoted to 5th Grade with outstanding grades."
};

interface ReportCardStructureSettingsProps {
  schoolId?: string;
  branding: SchoolBranding;
  subjects: SubjectColumn[];
  scoreColumns: ScoreColumn[];
  students: { className: string }[];
  reportCardStructures: ReportCardStructure[];
  onUpdateStructures: (updated: ReportCardStructure[]) => void;
  onUpdateSubjects?: (updated: SubjectColumn[]) => void;
  onUpdateScoreColumns?: (updated: ScoreColumn[]) => void;
  maxStructuresLimit?: number;
}

export default function ReportCardStructureSettings({
  schoolId,
  branding,
  subjects,
  scoreColumns,
  students,
  reportCardStructures,
  onUpdateStructures,
  onUpdateSubjects,
  onUpdateScoreColumns,
  maxStructuresLimit
}: ReportCardStructureSettingsProps) {
  // Master Subjects Collapsible state
  const [isSubjectsMasterOpen, setIsSubjectsMasterOpen] = useState(false);

  // Structure creation states
  const [editingStructureId, setEditingStructureId] = useState<string | null>(null);
  const [viewingReplicaId, setViewingReplicaId] = useState<string | null>(null);

  const [promptClasses, setPromptClasses] = useState('');
  const [promptName, setPromptName] = useState('');

  // Design Workbench States
  const [name, setName] = useState('');
  const [assignedClassesText, setAssignedClassesText] = useState('');
  const [structureSubjects, setStructureSubjects] = useState<SubjectColumn[]>([]);
  const [structureScoreColumns, setStructureScoreColumns] = useState<ScoreColumn[]>([]);
  const [termSpecificScoreColumnsEnabled, setTermSpecificScoreColumnsEnabled] = useState(false);
  const [term1ScoreColumns, setTerm1ScoreColumns] = useState<ScoreColumn[]>([]);
  const [term2ScoreColumns, setTerm2ScoreColumns] = useState<ScoreColumn[]>([]);
  const [term3ScoreColumns, setTerm3ScoreColumns] = useState<ScoreColumn[]>([]);
  const [selectedExamTermTab, setSelectedExamTermTab] = useState<'term1' | 'term2' | 'term3'>('term1');
  const [structureBranding, setStructureBranding] = useState<SchoolBranding>({ ...branding });
  const [structureGradeScales, setStructureGradeScales] = useState<GradeScale[]>([]);
  const [structureCoGradeScales, setStructureCoGradeScales] = useState<CoGradeScale[]>([]);

  // Extra customizable terms, co-scholastic sections, grading scales, and signatures details
  const [scholasticTerm1Disabled, setScholasticTerm1Disabled] = useState(false);
  const [scholasticTerm2Disabled, setScholasticTerm2Disabled] = useState(false);
  const [scholasticTerm3Disabled, setScholasticTerm3Disabled] = useState(false);
  const [coScholasticSections, setCoScholasticSections] = useState<CoScholasticSection[]>([]);
  const [coScholasticOneColumn, setCoScholasticOneColumn] = useState(false);
  const [signatures, setSignatures] = useState<SignatureItem[]>([]);
  const [hideGradingScale, setHideGradingScale] = useState(false);
  const [hideAttendance, setHideAttendance] = useState(false);
  const [pureGradeBased, setPureGradeBased] = useState(false);
  const [verticalExamHeaders, setVerticalExamHeaders] = useState(false);
  const [verticalSubjectsHeader, setVerticalSubjectsHeader] = useState(false);
  const [subjectSpecificMaxMarksEnabled, setSubjectSpecificMaxMarksEnabled] = useState(false);
  const [gradingScaleAfterSignatures, setGradingScaleAfterSignatures] = useState(false);
  const [gradingScaleLayout, setGradingScaleLayout] = useState<'side-by-side' | 'stacked'>('side-by-side');

  // Min Marks, Max Marks, Marks Obtained layout column toggles & custom headers
  const [showMinMarksColumn, setShowMinMarksColumn] = useState(false);
  const [showMaxMarksColumn, setShowMaxMarksColumn] = useState(false);
  const [showObtainedMarksColumn, setShowObtainedMarksColumn] = useState(true);
  const [landscapeMarksHeaders, setLandscapeMarksHeaders] = useState(false);
  const [minMarksHeaderLabel, setMinMarksHeaderLabel] = useState('Min Marks');
  const [maxMarksHeaderLabel, setMaxMarksHeaderLabel] = useState('Max Marks');
  const [obtainedMarksHeaderLabel, setObtainedMarksHeaderLabel] = useState('Marks Obtained');

  // Subject grouping and term totals/levels visibility controls
  const [enableSubjectGrouping, setEnableSubjectGrouping] = useState(true);
  const [customSubjectGroups, setCustomSubjectGroups] = useState<string[]>([
    "Language & Literacy",
    "Mathematics & Logic",
    "General Awareness & Science",
    "Physical & Motor Growth",
    "Personal & Social Development"
  ]);
  const [newGroupNameInput, setNewGroupNameInput] = useState('');

  // Term totals and level/grade visibility flags
  const [hideTerm1Total, setHideTerm1Total] = useState(false);
  const [hideTerm1Grade, setHideTerm1Grade] = useState(false);
  const [hideTerm2Total, setHideTerm2Total] = useState(false);
  const [hideTerm2Grade, setHideTerm2Grade] = useState(false);
  const [hideTerm3Total, setHideTerm3Total] = useState(false);
  const [hideTerm3Grade, setHideTerm3Grade] = useState(false);
  const [hideOverallTotal, setHideOverallTotal] = useState(false);
  const [hideOverallGrade, setHideOverallGrade] = useState(false);

  const [activeAccordion, setActiveAccordion] = useState<string>('general');
  const [completedSections, setCompletedSections] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [deletingStructureId, setDeletingStructureId] = useState<string | null>(null);
  const [deleteStructureInputText, setDeleteStructureInputText] = useState('');

  // Inherit/Override status
  const [overrideIdentity, setOverrideIdentity] = useState(false);

  // Drag states
  const [draggedSubId, setDraggedSubId] = useState<string | null>(null);
  const [draggedColId, setDraggedColId] = useState<string | null>(null);
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null);
  const [draggedGradeIdx, setDraggedGradeIdx] = useState<number | null>(null);

  // New field addition input state
  const [newFieldNameInput, setNewFieldNameInput] = useState('');

  // Extract unique registered student classes
  const uniqueStudentClasses = Array.from(new Set(students.map(s => s.className.trim()))).filter(Boolean);

  // Derive combined list of available groups (from customSubjectGroups + any group already on subjects)
  const allAvailableGroups = useMemo(() => {
    const set = new Set<string>(customSubjectGroups);
    structureSubjects.forEach(s => {
      if (s.group && s.group.trim()) {
        set.add(s.group.trim());
      }
    });
    return Array.from(set).filter(Boolean);
  }, [customSubjectGroups, structureSubjects]);

  const handleAddCustomGroup = (nameToAdd?: string) => {
    const trimmed = (nameToAdd !== undefined ? nameToAdd : newGroupNameInput).trim();
    if (!trimmed) return;
    if (!customSubjectGroups.includes(trimmed)) {
      setCustomSubjectGroups(prev => [...prev, trimmed]);
    }
    if (nameToAdd === undefined) {
      setNewGroupNameInput('');
    }
  };

  const handleRemoveCustomGroup = (groupToRemove: string) => {
    setCustomSubjectGroups(prev => prev.filter(g => g !== groupToRemove));
  };

  const handleStartDesigningNew = () => {
    setErrorMsg(null);
    const limit = maxStructuresLimit ?? 5;
    if (reportCardStructures.length >= limit) {
      setErrorMsg(`Operational Limit Reached: Your current plan/trial restricts the report card layout registry to a maximum of ${limit} layouts. Contact the master portal admin to upgrade.`);
      return;
    }
    if (!promptClasses.trim()) {
      setErrorMsg("Please assign at least one class (e.g. LKG, UKG) to start designing.");
      return;
    }
    const derivedName = promptName.trim() || `Report Card for ${promptClasses.trim()}`;

    setEditingStructureId('new');
    setName(derivedName);
    setAssignedClassesText(promptClasses);
    setStructureSubjects([...subjects]);
    setStructureScoreColumns([...scoreColumns]);
    setTermSpecificScoreColumnsEnabled(false);
    setTerm1ScoreColumns([...scoreColumns]);
    setTerm2ScoreColumns([...scoreColumns]);
    setTerm3ScoreColumns([...scoreColumns]);
    setSelectedExamTermTab('term1');
    
    // Default student field configurations
    const freshBranding = {
      ...branding,
      reportCardTitle: "Annual Statement of Marks",
      session: branding.session || "2024-2025"
    };

    freshBranding.studentFields = [
      { id: "name", label: "Student's Name" },
      { id: "fatherName", label: "Father's Name" },
      { id: "motherName", label: "Mother's Name" },
      { id: "height", label: "Height" },
      { id: "weight", label: "Weight" },
      { id: "className", label: "Class" },
      { id: "section", label: "Section" },
      { id: "rollNo", label: "Roll No" },
      { id: "admissionNo", label: "Admission No." },
      { id: "dob", label: "D.O.B." }
    ];

    setStructureBranding(freshBranding);
    setOverrideIdentity(false);
    setStructureGradeScales([
      { minPercent: 91, maxPercent: 100, grade: 'A1' },
      { minPercent: 81, maxPercent: 90, grade: 'A2' },
      { minPercent: 71, maxPercent: 80, grade: 'B1' },
      { minPercent: 61, maxPercent: 70, grade: 'B2' },
      { minPercent: 51, maxPercent: 60, grade: 'C1' },
      { minPercent: 41, maxPercent: 50, grade: 'C2' },
      { minPercent: 33, maxPercent: 40, grade: 'D' },
      { minPercent: 0, maxPercent: 32, grade: 'E' }
    ]);
    setStructureCoGradeScales([
      { score: 'A', description: 'Exemplary' },
      { score: 'B', description: 'Very Good' },
      { score: 'C', description: 'Good' },
      { score: 'D', description: 'Fair' },
      { score: 'E', description: 'Needs Imp.' }
    ]);

    setScholasticTerm1Disabled(false);
    setScholasticTerm2Disabled(false);
    setCoScholasticSections([
      {
        id: 'co_scholastic',
        title: 'Personality & Co-Scholastic Traits (5-Point)',
        subjectHeader: 'Trait / Aspect',
        gradingScaleText: '5-Point Scale',
        term1Enabled: true,
        term2Enabled: true,
        type: 'co_scholastic',
        isDefault: true
      },
      {
        id: 'activity',
        title: 'Co-Curricular / Extracurricular Activities',
        subjectHeader: 'Activity / Skill Area',
        gradingScaleText: '3-Point Scale',
        term1Enabled: true,
        term2Enabled: true,
        type: 'activity',
        isDefault: true
      }
    ]);
    setSignatures([
      { id: 'parent', label: "Parent's Signature" },
      { id: 'incharge', label: "Class Incharge Signature" },
      { id: 'principal', label: "Principal Signature" }
    ]);
    setShowMinMarksColumn(branding.showMinMarksColumn ?? false);
    setShowMaxMarksColumn(branding.showMaxMarksColumn ?? false);
    setShowObtainedMarksColumn(branding.showObtainedMarksColumn ?? true);
    setLandscapeMarksHeaders(branding.landscapeMarksHeaders ?? false);
    setMinMarksHeaderLabel(branding.minMarksHeaderLabel || 'Min Marks');
    setMaxMarksHeaderLabel(branding.maxMarksHeaderLabel || 'Max Marks');
    setObtainedMarksHeaderLabel(branding.obtainedMarksHeaderLabel || 'Marks Obtained');
    setHideGradingScale(false);
    setHideAttendance(false);
    setPureGradeBased(false);
    setGradingScaleAfterSignatures(false);
    setEnableSubjectGrouping(true);
    setCustomSubjectGroups([
      "Language & Literacy",
      "Mathematics & Logic",
      "General Awareness & Science",
      "Physical & Motor Growth",
      "Personal & Social Development"
    ]);
    setNewGroupNameInput('');
    setHideTerm1Total(false);
    setHideTerm1Grade(false);
    setHideTerm2Total(false);
    setHideTerm2Grade(false);
    setHideTerm3Total(false);
    setHideTerm3Grade(false);
    setHideOverallTotal(false);
    setHideOverallGrade(false);

    setCompletedSections(['general']);
    setActiveAccordion('branding');
    setPromptName('');
    setPromptClasses('');
  };

  const handleEditStructure = (struct: ReportCardStructure) => {
    setEditingStructureId(struct.id);
    setName(struct.name);
    setAssignedClassesText((struct.assignedClasses || []).join(', '));
    setStructureSubjects(struct.subjects || []);
    setStructureScoreColumns(struct.scoreColumns || []);
    setTermSpecificScoreColumnsEnabled(struct.termSpecificScoreColumnsEnabled || false);
    setTerm1ScoreColumns(struct.term1ScoreColumns && struct.term1ScoreColumns.length > 0 ? [...struct.term1ScoreColumns] : (struct.scoreColumns ? [...struct.scoreColumns] : []));
    setTerm2ScoreColumns(struct.term2ScoreColumns && struct.term2ScoreColumns.length > 0 ? [...struct.term2ScoreColumns] : (struct.scoreColumns ? [...struct.scoreColumns] : []));
    setTerm3ScoreColumns(struct.term3ScoreColumns && struct.term3ScoreColumns.length > 0 ? [...struct.term3ScoreColumns] : (struct.scoreColumns ? [...struct.scoreColumns] : []));
    setSelectedExamTermTab('term1');

    const loadedBranding = { ...branding, ...struct.branding };
    if (!loadedBranding.studentFields || loadedBranding.studentFields.length === 0) {
      loadedBranding.studentFields = [
        { id: "name", label: loadedBranding.studentNameLabel || "Student's Name" },
        { id: "fatherName", label: loadedBranding.fatherNameLabel || "Father's Name" },
        { id: "motherName", label: loadedBranding.motherNameLabel || "Mother's Name" },
        { id: "height", label: loadedBranding.heightLabel || "Height" },
        { id: "weight", label: loadedBranding.weightLabel || "Weight" },
        { id: "className", label: loadedBranding.classLabel || "Class" },
        { id: "section", label: loadedBranding.sectionLabel || "Section" },
        { id: "rollNo", label: loadedBranding.rollNoLabel || "Roll No" },
        { id: "admissionNo", label: loadedBranding.admissionNoLabel || "Admission No." },
        { id: "dob", label: loadedBranding.dobLabel || "D.O.B." }
      ];
    }

    setStructureBranding(loadedBranding);

    const hasOverride = struct.useCustomBranding ?? struct.overrideIdentity ?? struct.branding?.useCustomBranding ?? struct.branding?.overrideIdentity ?? !!(struct.branding?.schoolName || struct.branding?.logoUrl || struct.branding?.address || struct.branding?.helpline || struct.branding?.email || struct.branding?.website || struct.branding?.tagline || struct.branding?.watermarkText || struct.branding?.watermarkLogoUrl);
    setOverrideIdentity(hasOverride);

    setStructureGradeScales(struct.gradeScales || [
      { minPercent: 91, maxPercent: 100, grade: 'A1' },
      { minPercent: 81, maxPercent: 90, grade: 'A2' },
      { minPercent: 71, maxPercent: 80, grade: 'B1' },
      { minPercent: 61, maxPercent: 70, grade: 'B2' },
      { minPercent: 51, maxPercent: 60, grade: 'C1' },
      { minPercent: 41, maxPercent: 50, grade: 'C2' },
      { minPercent: 33, maxPercent: 40, grade: 'D' },
      { minPercent: 0, maxPercent: 32, grade: 'E' }
    ]);

    setStructureCoGradeScales(struct.coGradeScales || [
      { score: 'A', description: 'Exemplary' },
      { score: 'B', description: 'Very Good' },
      { score: 'C', description: 'Good' },
      { score: 'D', description: 'Fair' },
      { score: 'E', description: 'Needs Imp.' }
    ]);

    setScholasticTerm1Disabled(struct.scholasticTerm1Disabled || false);
    setScholasticTerm2Disabled(struct.scholasticTerm2Disabled || false);
    setScholasticTerm3Disabled(struct.scholasticTerm3Disabled || false);
    setCoScholasticOneColumn(struct.coScholasticOneColumn || false);
    setCoScholasticSections(struct.coScholasticSections || [
      {
        id: 'co_scholastic',
        title: 'Personality & Co-Scholastic Traits (5-Point)',
        subjectHeader: 'Trait / Aspect',
        gradingScaleText: '5-Point Scale',
        term1Enabled: true,
        term2Enabled: true,
        type: 'co_scholastic',
        isDefault: true
      },
      {
        id: 'activity',
        title: 'Co-Curricular / Extracurricular Activities',
        subjectHeader: 'Activity / Skill Area',
        gradingScaleText: '3-Point Scale',
        term1Enabled: true,
        term2Enabled: true,
        type: 'activity',
        isDefault: true
      }
    ]);
    setSignatures(struct.signatures || [
      { id: 'parent', label: struct.branding?.signParentName || "Parent's Signature" },
      { id: 'incharge', label: struct.branding?.signInchargeName || "Class Incharge Signature" },
      { id: 'principal', label: struct.branding?.signPrincipalName || "Principal Signature" }
    ]);
    setHideGradingScale(struct.hideGradingScale || false);
    setHideAttendance(struct.hideAttendance || false);
    setPureGradeBased(struct.pureGradeBased || false);
    setVerticalExamHeaders(struct.verticalExamHeaders || false);
    setVerticalSubjectsHeader(struct.verticalSubjectsHeader || false);
    setSubjectSpecificMaxMarksEnabled(struct.subjectSpecificMaxMarksEnabled || false);
    setGradingScaleAfterSignatures(struct.gradingScaleAfterSignatures || false);
    setGradingScaleLayout(struct.gradingScaleLayout || 'side-by-side');
    setEnableSubjectGrouping(struct.enableSubjectGrouping !== false);
    setCustomSubjectGroups(
      struct.customSubjectGroups && struct.customSubjectGroups.length > 0
        ? struct.customSubjectGroups
        : [
            "Language & Literacy",
            "Mathematics & Logic",
            "General Awareness & Science",
            "Physical & Motor Growth",
            "Personal & Social Development"
          ]
    );
    setNewGroupNameInput('');
    setShowMinMarksColumn(struct.showMinMarksColumn ?? struct.branding?.showMinMarksColumn ?? false);
    setShowMaxMarksColumn(struct.showMaxMarksColumn ?? struct.branding?.showMaxMarksColumn ?? false);
    setShowObtainedMarksColumn(struct.showObtainedMarksColumn ?? struct.branding?.showObtainedMarksColumn ?? true);
    setLandscapeMarksHeaders(struct.landscapeMarksHeaders ?? struct.branding?.landscapeMarksHeaders ?? false);
    setMinMarksHeaderLabel(struct.minMarksHeaderLabel || struct.branding?.minMarksHeaderLabel || 'Min Marks');
    setMaxMarksHeaderLabel(struct.maxMarksHeaderLabel || struct.branding?.maxMarksHeaderLabel || 'Max Marks');
    setObtainedMarksHeaderLabel(struct.obtainedMarksHeaderLabel || struct.branding?.obtainedMarksHeaderLabel || 'Marks Obtained');
    setHideTerm1Total(struct.hideTerm1Total || false);
    setHideTerm1Grade(struct.hideTerm1Grade || false);
    setHideTerm2Total(struct.hideTerm2Total || false);
    setHideTerm2Grade(struct.hideTerm2Grade || false);
    setHideTerm3Total(struct.hideTerm3Total || false);
    setHideTerm3Grade(struct.hideTerm3Grade || false);
    setHideOverallTotal(struct.hideOverallTotal || false);
    setHideOverallGrade(struct.hideOverallGrade || false);

    setCompletedSections(struct.completedSections || ['general']);
    setActiveAccordion('branding');
  };

  const handleCancelDesign = () => {
    setEditingStructureId(null);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleAddFieldSuggestionPrompt = (cls: string) => {
    const currentList = promptClasses.split(',').map(c => c.trim()).filter(Boolean);
    if (currentList.includes(cls)) {
      setPromptClasses(currentList.filter(c => c !== cls).join(', '));
    } else {
      currentList.push(cls);
      setPromptClasses(currentList.join(', '));
    }
  };

  const handleAddFieldSuggestionWorkbench = (cls: string) => {
    const currentList = assignedClassesText.split(',').map(c => c.trim()).filter(Boolean);
    if (currentList.includes(cls)) {
      setAssignedClassesText(currentList.filter(c => c !== cls).join(', '));
    } else {
      currentList.push(cls);
      setAssignedClassesText(currentList.join(', '));
    }
  };

  const markSectionCompletedAndNext = (sectionId: string, nextSectionId: string | null) => {
    if (!completedSections.includes(sectionId)) {
      setCompletedSections(prev => [...prev, sectionId]);
    }
    setErrorMsg(null);
    if (nextSectionId) {
      setActiveAccordion(nextSectionId);
      setTimeout(() => {
        const el = document.getElementById(`heading_${nextSectionId}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  };

  const handleBrandingFieldChange = (key: string, val: any) => {
    setStructureBranding(prev => ({ ...prev, [key]: val }));
  };

  // SUBJECT DND & BUTTONS HANDLERS
  const handleSubDragStart = (e: React.DragEvent, id: string) => {
    setDraggedSubId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleSubDragOver = (e: React.DragEvent, id: string, type: 'scholastic' | 'co_scholastic' | 'activity' | 'additional') => {
    e.preventDefault();
    if (!draggedSubId || draggedSubId === id) return;
    
    const draggedSub = structureSubjects.find(s => s.id === draggedSubId);
    if (!draggedSub || draggedSub.type !== type) return;

    const dragIdx = structureSubjects.findIndex(s => s.id === draggedSubId);
    const hoverIdx = structureSubjects.findIndex(s => s.id === id);
    if (dragIdx === -1 || hoverIdx === -1) return;

    const updated = [...structureSubjects];
    const [draggedItem] = updated.splice(dragIdx, 1);
    updated.splice(hoverIdx, 0, draggedItem);
    setStructureSubjects(updated);
  };

  const moveSubjectItem = (id: string, direction: 'up' | 'down') => {
    const sub = structureSubjects.find(s => s.id === id);
    if (!sub) return;

    const sameTypeSubs = structureSubjects.filter(s => s.type === sub.type);
    const indexInType = sameTypeSubs.findIndex(s => s.id === id);
    const nextIndexInType = direction === 'up' ? indexInType - 1 : indexInType + 1;
    if (nextIndexInType < 0 || nextIndexInType >= sameTypeSubs.length) return;

    const targetSub = sameTypeSubs[nextIndexInType];
    const realIndex = structureSubjects.findIndex(s => s.id === id);
    const realTargetIndex = structureSubjects.findIndex(s => s.id === targetSub.id);

    const updated = [...structureSubjects];
    updated[realIndex] = targetSub;
    updated[realTargetIndex] = sub;
    setStructureSubjects(updated);
  };

  const handleUpdateSubjectMaxMarks = (subId: string, val: number) => {
    setStructureSubjects(prev => prev.map(s => s.id === subId ? { ...s, maxMarks: Math.max(1, val) } : s));
  };

  const handleUpdateSubjectColumnMaxMarks = (subId: string, colId: string, val: number) => {
    setStructureSubjects(prev => prev.map(s => {
      if (s.id === subId) {
        const customMax = { ...(s.customMaxMarks || {}) };
        customMax[colId] = Math.max(0, val);
        return { ...s, customMaxMarks: customMax };
      }
      return s;
    }));
  };

  const handleAddCustomSubjectToStructure = (type: 'scholastic' | 'co_scholastic' | 'activity' | 'additional') => {
    const labelType = type === 'scholastic' 
      ? 'Scholastic' 
      : type === 'additional'
        ? 'Additional Subject'
        : type === 'co_scholastic' 
          ? 'Co-Scholastic Trait' 
          : 'Activity Area';
    const randId = `custom_sub_${Date.now()}`;
    const newSub: SubjectColumn = {
      id: randId,
      name: `New Custom ${labelType}`,
      type,
      maxMarks: (type === 'scholastic' || type === 'additional') ? 100 : undefined,
      sequence: structureSubjects.length
    };
    setStructureSubjects(prev => [...prev, newSub]);
  };

  const handleAddItemToPart = (sectionId: string, sectionType: 'co_scholastic' | 'activity' | 'custom') => {
    const randId = `custom_sub_${Date.now()}`;
    const newSub: SubjectColumn = {
      id: randId,
      name: `New Item`,
      type: sectionType,
      sectionId: sectionId,
      sequence: structureSubjects.length
    };
    setStructureSubjects(prev => [...prev, newSub]);
  };

  const handleModifySubjectName = (subId: string, name: string) => {
    setStructureSubjects(prev => prev.map(s => s.id === subId ? { ...s, name } : s));
  };

  const handleRemoveSubjectFromStructure = (subId: string) => {
    setStructureSubjects(prev => prev.filter(s => s.id !== subId));
  };

  const handleToggleSubjectInStructure = (sub: SubjectColumn) => {
    const exists = structureSubjects.some(s => s.id === sub.id);
    if (exists) {
      setStructureSubjects(prev => prev.filter(s => s.id !== sub.id));
    } else {
      setStructureSubjects(prev => [...prev, { ...sub }]);
    }
  };

  // SCORE COLUMNS DND & BUTTONS HANDLERS
  const getActiveScoreColumns = (): ScoreColumn[] => {
    if (!termSpecificScoreColumnsEnabled) return structureScoreColumns;
    if (selectedExamTermTab === 'term1') return term1ScoreColumns;
    if (selectedExamTermTab === 'term2') return term2ScoreColumns;
    return term3ScoreColumns;
  };

  const updateActiveScoreColumns = (updater: (prev: ScoreColumn[]) => ScoreColumn[]) => {
    if (!termSpecificScoreColumnsEnabled) {
      setStructureScoreColumns(updater);
    } else if (selectedExamTermTab === 'term1') {
      setTerm1ScoreColumns(updater);
    } else if (selectedExamTermTab === 'term2') {
      setTerm2ScoreColumns(updater);
    } else {
      setTerm3ScoreColumns(updater);
    }
  };

  const handleColDragStart = (e: React.DragEvent, id: string) => {
    setDraggedColId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleColDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (!draggedColId || draggedColId === id) return;

    updateActiveScoreColumns(currentCols => {
      const dragIdx = currentCols.findIndex(c => c.id === draggedColId);
      const hoverIdx = currentCols.findIndex(c => c.id === id);
      if (dragIdx === -1 || hoverIdx === -1) return currentCols;

      const updated = [...currentCols];
      const [draggedItem] = updated.splice(dragIdx, 1);
      updated.splice(hoverIdx, 0, draggedItem);
      return updated;
    });
  };

  const moveScoreColItem = (idx: number, direction: 'up' | 'down') => {
    updateActiveScoreColumns(currentCols => {
      const nextIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (nextIdx < 0 || nextIdx >= currentCols.length) return currentCols;

      const updated = [...currentCols];
      const [moved] = updated.splice(idx, 1);
      updated.splice(nextIdx, 0, moved);
      return updated;
    });
  };

  const handleAddCustomExamColumn = () => {
    const randId = `custom_exam_${Date.now()}`;
    updateActiveScoreColumns(currentCols => {
      const newCol: ScoreColumn = {
        id: randId,
        name: "Short Assessment",
        maxMarks: 20,
        sequence: currentCols.length
      };
      return [...currentCols, newCol];
    });
  };

  const handleToggleScoreColumnInStructure = (col: ScoreColumn) => {
    updateActiveScoreColumns(currentCols => {
      const exists = currentCols.some(c => c.id === col.id);
      if (exists) {
        return currentCols.filter(c => c.id !== col.id);
      } else {
        return [...currentCols, { ...col }];
      }
    });
  };

  const handleRemoveCustomExamColumn = (colId: string) => {
    updateActiveScoreColumns(currentCols => currentCols.filter(c => c.id !== colId));
  };

  const handleUpdateCustomExamColumnName = (colId: string, name: string) => {
    updateActiveScoreColumns(currentCols => currentCols.map(c => c.id === colId ? { ...c, name } : c));
  };

  const handleUpdateColumnMaxMarks = (colId: string, val: number) => {
    updateActiveScoreColumns(currentCols => currentCols.map(c => c.id === colId ? { ...c, maxMarks: Math.max(1, val) } : c));
  };

  const handleUpdateColumnMinMarks = (colId: string, val: number | undefined) => {
    updateActiveScoreColumns(currentCols => currentCols.map(c => c.id === colId ? { ...c, minMarks: val !== undefined ? Math.max(0, val) : undefined } : c));
  };

  const handleCopyColumnsToActiveTerm = (source: 'uniform' | 'term1' | 'term2' | 'term3') => {
    let sourceCols: ScoreColumn[] = [];
    if (source === 'uniform') sourceCols = structureScoreColumns;
    else if (source === 'term1') sourceCols = term1ScoreColumns;
    else if (source === 'term2') sourceCols = term2ScoreColumns;
    else if (source === 'term3') sourceCols = term3ScoreColumns;

    updateActiveScoreColumns(() => sourceCols.map(c => ({ ...c, id: `${c.id}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}` })));
  };

  const handleCopyActiveTermToAll = () => {
    const activeCols = getActiveScoreColumns();
    setTerm1ScoreColumns(activeCols.map(c => ({ ...c, id: `${c.id.split('_')[0]}_t1_${Date.now()}_${Math.random().toString(36).substr(2, 4)}` })));
    setTerm2ScoreColumns(activeCols.map(c => ({ ...c, id: `${c.id.split('_')[0]}_t2_${Date.now()}_${Math.random().toString(36).substr(2, 4)}` })));
    setTerm3ScoreColumns(activeCols.map(c => ({ ...c, id: `${c.id.split('_')[0]}_t3_${Date.now()}_${Math.random().toString(36).substr(2, 4)}` })));
  };

  // DRAGGABLE CUSTOM STUDENT DETAILS FIELDS
  const handleFieldDragStart = (e: React.DragEvent, id: string) => {
    setDraggedFieldId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleFieldDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    const fields = structureBranding.studentFields || [];
    if (!draggedFieldId || draggedFieldId === id) return;

    const dragIdx = fields.findIndex(f => f.id === draggedFieldId);
    const hoverIdx = fields.findIndex(f => f.id === id);
    if (dragIdx === -1 || hoverIdx === -1) return;

    const updated = [...fields];
    const [draggedItem] = updated.splice(dragIdx, 1);
    updated.splice(hoverIdx, 0, draggedItem);
    handleBrandingFieldChange('studentFields', updated);
  };

  const moveFieldItem = (idx: number, direction: 'up' | 'down') => {
    const fields = structureBranding.studentFields || [];
    const nextIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= fields.length) return;

    const updated = [...fields];
    const [moved] = updated.splice(idx, 1);
    updated.splice(nextIdx, 0, moved);
    handleBrandingFieldChange('studentFields', updated);
  };

  const handleEditFieldLabel = (id: string, newLabel: string) => {
    const fields = structureBranding.studentFields || [];
    const updated = fields.map(f => f.id === id ? { ...f, label: newLabel } : f);
    handleBrandingFieldChange('studentFields', updated);
  };

  const handleDeleteField = (id: string) => {
    const fields = structureBranding.studentFields || [];
    const updated = fields.filter(f => f.id !== id);
    handleBrandingFieldChange('studentFields', updated);
  };

  const handleAddCustomField = () => {
    if (!newFieldNameInput.trim()) return;
    const fields = structureBranding.studentFields || [];
    const cleanId = 'cust_' + newFieldNameInput.toLowerCase().trim().replace(/[^a-z0-9]/g, '_') + '_' + Date.now().toString().substring(8);
    const newField = { id: cleanId, label: newFieldNameInput.trim() };
    handleBrandingFieldChange('studentFields', [...fields, newField]);
    setNewFieldNameInput('');
  };

  // DRAGGABLE GRADING SCALE LABELS
  const handleGradeDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedGradeIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleGradeDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedGradeIdx === null || draggedGradeIdx === idx) return;

    const updated = [...structureGradeScales];
    const [draggedItem] = updated.splice(draggedGradeIdx, 1);
    updated.splice(idx, 0, draggedItem);
    setStructureGradeScales(updated);
    setDraggedGradeIdx(idx);
  };

  const moveGradeScaleItem = (idx: number, direction: 'up' | 'down') => {
    const nextIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= structureGradeScales.length) return;

    const updated = [...structureGradeScales];
    const [moved] = updated.splice(idx, 1);
    updated.splice(nextIdx, 0, moved);
    setStructureGradeScales(updated);
  };

  const handleAddGradeScale = () => {
    setStructureGradeScales(prev => [...prev, { minPercent: 0, maxPercent: 0, grade: 'NEW' }]);
  };

  const handleRemoveGradeScaleIndex = (idx: number) => {
    setStructureGradeScales(prev => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateGradeScaleItem = (idx: number, field: keyof GradeScale, val: any) => {
    setStructureGradeScales(prev => prev.map((item, i) => {
      if (i === idx) {
        return {
          ...item,
          [field]: (field === 'minPercent' || field === 'maxPercent') ? (parseInt(val, 10) || 0) : String(val)
        };
      }
      return item;
    }));
  };

  const handleAddCoGradeScale = () => {
    setStructureCoGradeScales(prev => [...prev, { score: 'A', description: 'Excellent' }]);
  };

  const handleUpdateCoGradeScaleItem = (idx: number, field: 'score' | 'description', value: string) => {
    setStructureCoGradeScales(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const handleRemoveCoGradeScaleIdx = (idx: number) => {
    setStructureCoGradeScales(prev => prev.filter((_, i) => i !== idx));
  };

  // SAVE STRUCTURE ACTION
  const handleSaveWholeStructure = () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (editingStructureId === 'new') {
      const limit = maxStructuresLimit ?? 5;
      if (reportCardStructures.length >= limit) {
        setErrorMsg(`Operational Limit Reached: Your current plan/trial restricts the report card layout registry to a maximum of ${limit} layouts. Contact the master portal admin to upgrade.`);
        return;
      }
    }

    const classesArray = assignedClassesText.split(',').map(c => c.trim()).filter(Boolean);
    if (!name.trim()) {
      setErrorMsg("Please provide a descriptive Layout Name.");
      setActiveAccordion('general');
      return;
    }
    if (classesArray.length === 0) {
      setErrorMsg("Please assign at least one designated target Class.");
      setActiveAccordion('general');
      return;
    }

    const brandingPayload = { 
      ...structureBranding,
      useCustomBranding: overrideIdentity,
      overrideIdentity: overrideIdentity,
      showMinMarksColumn,
      showMaxMarksColumn,
      showObtainedMarksColumn,
      landscapeMarksHeaders,
      minMarksHeaderLabel,
      maxMarksHeaderLabel,
      obtainedMarksHeaderLabel
    };
    if (!overrideIdentity) {
      delete brandingPayload.schoolName;
      delete brandingPayload.logoUrl;
      delete brandingPayload.rightLogoUrl;
      delete brandingPayload.rightLogoSize;
      delete brandingPayload.address;
      delete brandingPayload.helpline;
      delete brandingPayload.email;
      delete brandingPayload.website;
      delete brandingPayload.tagline;
    }

    const existingStruct = reportCardStructures.find(s => s.id === editingStructureId);

    const savedStructure: ReportCardStructure = {
      id: editingStructureId === 'new' ? `struct_${Date.now()}` : editingStructureId!,
      name: name.trim(),
      assignedClasses: classesArray,
      useCustomBranding: overrideIdentity,
      overrideIdentity: overrideIdentity,
      branding: brandingPayload,
      subjects: structureSubjects,
      scoreColumns: structureScoreColumns,
      termSpecificScoreColumnsEnabled,
      term1ScoreColumns,
      term2ScoreColumns,
      term3ScoreColumns,
      gradeScales: structureGradeScales,
      coGradeScales: structureCoGradeScales,
      completedSections: [...new Set([...completedSections, 'general', 'branding', 'subjects', 'exams', 'terms', 'grades'])],
      scholasticTerm1Disabled,
      scholasticTerm2Disabled,
      scholasticTerm3Disabled,
      coScholasticOneColumn,
      coScholasticSections,
      signatures,
      hideGradingScale,
      hideAttendance,
      pureGradeBased,
      verticalExamHeaders,
      verticalSubjectsHeader,
      subjectSpecificMaxMarksEnabled,
      gradingScaleAfterSignatures,
      gradingScaleLayout,
      enableSubjectGrouping,
      customSubjectGroups,
      hideTerm1Total,
      hideTerm1Grade,
      hideTerm2Total,
      hideTerm2Grade,
      hideTerm3Total,
      hideTerm3Grade,
      hideOverallTotal,
      hideOverallGrade,
      showMinMarksColumn,
      showMaxMarksColumn,
      showObtainedMarksColumn,
      landscapeMarksHeaders,
      minMarksHeaderLabel,
      maxMarksHeaderLabel,
      obtainedMarksHeaderLabel,
      templateId: existingStruct?.templateId,
      demoStudentName: existingStruct?.demoStudentName,
      demoRollNo: existingStruct?.demoRollNo,
      demoClassName: existingStruct?.demoClassName || classesArray[0],
      demoFatherName: existingStruct?.demoFatherName,
      demoMotherName: existingStruct?.demoMotherName
    };

    let updatedList: ReportCardStructure[] = [];
    if (editingStructureId === 'new') {
      updatedList = [...reportCardStructures, savedStructure];
    } else {
      updatedList = reportCardStructures.map(s => s.id === editingStructureId ? savedStructure : s);
    }

    onUpdateStructures(updatedList);
    setSuccessMsg("🎉 Saved successfully!");
    setEditingStructureId(null);
  };

  const handleDeleteStructure = (structId: string) => {
    setDeletingStructureId(structId);
    setDeleteStructureInputText('');
  };

  const confirmDeleteStructure = () => {
    if (!deletingStructureId) return;
    if (deleteStructureInputText.trim().toUpperCase() !== 'DELETE' && deleteStructureInputText.trim().toUpperCase() !== 'CONFIRM') {
      return;
    }
    const structToDelete = reportCardStructures.find(s => s.id === deletingStructureId);
    onUpdateStructures(reportCardStructures.filter(s => s.id !== deletingStructureId));

    if (schoolId && structToDelete) {
      removeTemplateRequestForSchool(schoolId, structToDelete.id, structToDelete.name).catch(err => {
        console.warn("Failed to remove template request on structure deletion:", err);
      });
    }

    setSuccessMsg("Custom format layout configuration deleted.");
    setDeletingStructureId(null);
    setDeleteStructureInputText('');
  };

  // PREVIEW MODAL PROP CONFIGURATION SETUP
  const previewStructure = reportCardStructures.find(s => s.id === viewingReplicaId);
  const isCustomReplica = previewStructure ? (
    previewStructure.useCustomBranding === true || 
    previewStructure.overrideIdentity === true || 
    previewStructure.branding?.useCustomBranding === true || 
    previewStructure.branding?.overrideIdentity === true
  ) : false;

  const replicaBranding = previewStructure ? (
    isCustomReplica ? {
      ...branding,
      ...(previewStructure.branding || {}),
      useCustomBranding: true,
      overrideIdentity: true,
      schoolName: previewStructure.branding?.schoolName !== undefined ? previewStructure.branding.schoolName : (branding.schoolName || "My School"),
      schoolNameFontSize: previewStructure.branding?.schoolNameFontSize ?? branding.schoolNameFontSize ?? 32,
      schoolNameFontFamily: previewStructure.branding?.schoolNameFontFamily || branding.schoolNameFontFamily || "Georgia, serif",
      headerDetailsFontSize: previewStructure.branding?.headerDetailsFontSize ?? branding.headerDetailsFontSize ?? 10.5,
      headerDetailsFontFamily: previewStructure.branding?.headerDetailsFontFamily || branding.headerDetailsFontFamily || "sans-serif",
      reportCardTitleFontSize: previewStructure.branding?.reportCardTitleFontSize ?? branding.reportCardTitleFontSize,
      tagline: previewStructure.branding?.tagline !== undefined ? previewStructure.branding.tagline : "",
      address: previewStructure.branding?.address !== undefined ? previewStructure.branding.address : "",
      helpline: previewStructure.branding?.helpline !== undefined ? previewStructure.branding.helpline : "",
      email: previewStructure.branding?.email !== undefined ? previewStructure.branding.email : "",
      website: previewStructure.branding?.website !== undefined ? previewStructure.branding.website : "",
      logoUrl: previewStructure.branding?.logoUrl !== undefined ? previewStructure.branding.logoUrl : "",
      logoSize: previewStructure.branding?.logoSize !== undefined ? previewStructure.branding.logoSize : (branding.logoSize ?? 92),
      logoCircular: previewStructure.branding?.logoCircular !== undefined ? previewStructure.branding.logoCircular : (branding.logoCircular ?? true),
      logoBorder: previewStructure.branding?.logoBorder !== undefined ? previewStructure.branding.logoBorder : (branding.logoBorder ?? true),
      rightLogoUrl: previewStructure.branding?.rightLogoUrl !== undefined ? previewStructure.branding.rightLogoUrl : "",
      rightLogoSize: previewStructure.branding?.rightLogoSize !== undefined ? previewStructure.branding.rightLogoSize : (branding.rightLogoSize ?? 92),
      nameBannerUrl: previewStructure.branding?.nameBannerUrl !== undefined ? previewStructure.branding.nameBannerUrl : "",
      hideSchoolDetails: previewStructure.branding?.hideSchoolDetails !== undefined ? previewStructure.branding.hideSchoolDetails : false,
      themeColor: previewStructure.branding?.themeColor || branding.themeColor || "#DE2F2F",
      borderColor: previewStructure.branding?.borderColor || branding.borderColor || "#C22121",
      reportCardTitle: previewStructure.branding?.reportCardTitle || branding.reportCardTitle || "Annual Examination Report Card",
      session: branding.session || previewStructure.branding?.session || "2024-2025",
      showWatermark: previewStructure.branding?.showWatermark !== undefined ? previewStructure.branding.showWatermark : (branding.showWatermark ?? true),
      watermarkType: previewStructure.branding?.watermarkType || 'logo',
      watermarkText: previewStructure.branding?.watermarkText !== undefined ? previewStructure.branding.watermarkText : (previewStructure.branding?.schoolName || ""),
      watermarkLogoUrl: previewStructure.branding?.watermarkLogoUrl !== undefined ? previewStructure.branding.watermarkLogoUrl : (previewStructure.branding?.logoUrl || ""),
      watermarkOpacity: previewStructure.branding?.watermarkOpacity ?? 0.08,
      watermarkSize: previewStructure.branding?.watermarkSize ?? 320,
      watermarkLayout: previewStructure.branding?.watermarkLayout || 'center',
      watermarkFit: previewStructure.branding?.watermarkFit || 'contain',
      signParentName: previewStructure.branding?.signParentName || branding.signParentName || "Parent's Signature",
      signInchargeName: previewStructure.branding?.signInchargeName || branding.signInchargeName || "Class Incharge Signature",
      signPrincipalName: previewStructure.branding?.signPrincipalName || branding.signPrincipalName || "Principal Signature",
      studentFields: previewStructure.branding?.studentFields || branding.studentFields
    } : {
      ...branding,
      ...(previewStructure.branding || {}),
      useCustomBranding: false,
      overrideIdentity: false,
      schoolNameFontSize: previewStructure.branding?.schoolNameFontSize ?? branding.schoolNameFontSize ?? 32,
      schoolNameFontFamily: previewStructure.branding?.schoolNameFontFamily || branding.schoolNameFontFamily || "Georgia, serif",
      headerDetailsFontSize: previewStructure.branding?.headerDetailsFontSize ?? branding.headerDetailsFontSize ?? 10.5,
      headerDetailsFontFamily: previewStructure.branding?.headerDetailsFontFamily || branding.headerDetailsFontFamily || "sans-serif",
      reportCardTitleFontSize: previewStructure.branding?.reportCardTitleFontSize ?? branding.reportCardTitleFontSize,
      logoSize: previewStructure.branding?.logoSize !== undefined ? previewStructure.branding.logoSize : (branding.logoSize ?? 92),
      rightLogoSize: previewStructure.branding?.rightLogoSize !== undefined ? previewStructure.branding.rightLogoSize : (branding.rightLogoSize ?? 92),
      showWatermark: previewStructure.branding?.showWatermark !== undefined ? previewStructure.branding.showWatermark : (branding.showWatermark ?? true),
      watermarkType: previewStructure.branding?.watermarkType || branding.watermarkType || 'logo',
      watermarkText: previewStructure.branding?.watermarkText !== undefined ? previewStructure.branding.watermarkText : (branding.watermarkText !== undefined ? branding.watermarkText : (branding.schoolName || "")),
      watermarkLogoUrl: previewStructure.branding?.watermarkLogoUrl || branding.watermarkLogoUrl || branding.logoUrl || "",
      watermarkOpacity: previewStructure.branding?.watermarkOpacity ?? branding.watermarkOpacity ?? 0.08,
      watermarkSize: previewStructure.branding?.watermarkSize ?? branding.watermarkSize ?? 320,
      watermarkLayout: previewStructure.branding?.watermarkLayout || branding.watermarkLayout || 'center',
      watermarkFit: previewStructure.branding?.watermarkFit || branding.watermarkFit || 'contain',
      studentFields: previewStructure.branding?.studentFields || branding.studentFields
    }
  ) : branding;
  const replicaSubjects = previewStructure && previewStructure.subjects && previewStructure.subjects.length > 0 ? previewStructure.subjects : subjects;
  const replicaScoreColumns = previewStructure 
    ? (previewStructure.pureGradeBased ? [] : (previewStructure.scoreColumns ?? []))
    : scoreColumns;
  const replicaGradeScales = previewStructure && previewStructure.gradeScales && previewStructure.gradeScales.length > 0 ? previewStructure.gradeScales : [];
  const replicaCoGradeScales = previewStructure && previewStructure.coGradeScales && previewStructure.coGradeScales.length > 0 ? previewStructure.coGradeScales : [];
  const replicaMockGrades = makeMockGradesForPreview(
    replicaSubjects,
    replicaScoreColumns,
    previewStructure?.termSpecificScoreColumnsEnabled,
    previewStructure?.term1ScoreColumns,
    previewStructure?.term2ScoreColumns,
    previewStructure?.term3ScoreColumns
  );

  // Dynamic values injected for custom profile labels in template mock preview
  const fieldsToRender = replicaBranding.studentFields || [];
  const targetClassForMock = previewStructure?.demoClassName || (previewStructure?.assignedClasses && previewStructure.assignedClasses[0]) || defaultMockStudent.className;
  const isEarlyYears = targetClassForMock.toLowerCase().includes("nursery") || targetClassForMock.toLowerCase().includes("kg") || targetClassForMock.toLowerCase().includes("kindergarten");

  const resolvedMockStudentInstance = {
    ...defaultMockStudent,
    className: targetClassForMock,
    name: previewStructure?.demoStudentName || (isEarlyYears ? "Aditya Vardhan" : defaultMockStudent.name),
    rollNo: previewStructure?.demoRollNo || (isEarlyYears ? "01" : defaultMockStudent.rollNo),
    fatherName: formatFatherName(previewStructure?.demoFatherName || (isEarlyYears ? "Mr. Ramesh Vardhan" : defaultMockStudent.fatherName)),
    motherName: formatMotherName(previewStructure?.demoMotherName || (isEarlyYears ? "Mrs. Shreya Vardhan" : defaultMockStudent.motherName)),
    dob: isEarlyYears ? "05/08/2018" : defaultMockStudent.dob,
    admissionNo: isEarlyYears ? "ADM-2024/001" : defaultMockStudent.admissionNo,
    height: formatHeight(isEarlyYears ? "115 CM" : defaultMockStudent.height),
    weight: formatWeight(isEarlyYears ? "21 KG" : defaultMockStudent.weight),
    remarks: isEarlyYears ? "Aditya has shown spectacular progress in early literacy and motor skills." : defaultMockStudent.remarks,
    promotionStatus: isEarlyYears ? "Promoted to Kindergarten with outstanding praise." : defaultMockStudent.promotionStatus,
    ...fieldsToRender.reduce((acc, field) => {
      if (!defaultMockStudent.hasOwnProperty(field.id)) {
        let val = "A+";
        if (field.label.toLowerCase().includes("blood")) val = "O +ve";
        else if (field.label.toLowerCase().includes("aadhar") || field.label.toLowerCase().includes("uid")) val = "9087-3212-0098";
        else if (field.label.toLowerCase().includes("roll")) val = isEarlyYears ? "01" : "18";
        else if (field.label.toLowerCase().includes("house")) val = "Gandhi House";
        else if (field.label.toLowerCase().includes("route")) val = "Route #14";
        acc[field.id] = val;
      }
      return acc;
    }, {} as any)
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      
      {/* Banner Head */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5 font-sans">
              <Layers className="w-6 h-6 text-indigo-400" />
              Design Report Card
            </h1>
            <p className="text-xs text-slate-350 max-w-xl font-sans">
              Build custom target layout report cards matching LKG and UKG or Secondary groupings with selective subjects and dynamic drag parameters.
            </p>
          </div>
          
          <div className="flex gap-4 bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
            <div className="text-center">
              <span className="block text-2xl font-black text-indigo-400">{reportCardStructures.length}</span>
              <span className="text-[10px] uppercase font-bold text-slate-400">Custom Groupings layouts</span>
            </div>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border-l-4 border-rose-500 rounded-xl text-xs font-semibold text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500" />
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-500" />
          {successMsg}
        </div>
      )}

      {editingStructureId !== null ? (
        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b pb-4">
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-wide">
              <Settings className="w-5 h-5 text-indigo-500" />
              {editingStructureId === 'new' ? 'Create Custom Card Format' : `Modify Format Details: ${name}`}
            </h2>
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleCancelDesign} className="px-4 py-2 text-xs font-bold text-slate-500 bg-white border rounded-xl hover:bg-slate-50">Cancel</button>
              <button type="button" onClick={handleSaveWholeStructure} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 flex items-center gap-1.5 shadow-sm">
                <Save className="w-4 h-4" /> Save Template
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            
            {/* ACCORDION 1: CLASSES */}
            <div className="border-b">
              <button type="button" id="heading_general" onClick={() => setActiveAccordion('general')} className="w-full px-5 py-3.5 flex items-center justify-between bg-slate-50 hover:bg-slate-100 text-left">
                <span className="font-bold text-xs text-slate-800 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 border flex items-center justify-center text-[10px] font-bold">1</span>
                  General Layout & Target Classes
                  {completedSections.includes('general') && (
                    <span className="inline-flex items-center justify-center p-1 text-emerald-600 bg-emerald-50 rounded-full border border-emerald-250 ml-2" title="Completed">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </span>
                {activeAccordion === 'general' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {activeAccordion === 'general' && (
                <div className="p-5 space-y-4 animate-fadeIn">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-450 uppercase">Format Descriptive Name</span>
                      <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 text-xs border rounded-lg bg-slate-50 focus:bg-white focus:outline-none font-bold" placeholder="e.g. LKG and UKG Layout" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-450 uppercase">Classes scopes (Comma Separated)</span>
                      <input type="text" value={assignedClassesText} onChange={(e) => setAssignedClassesText(e.target.value)} className="w-full px-3 py-2 text-xs border rounded-lg bg-slate-50 focus:bg-white focus:outline-none" placeholder="e.g. LKG, UKG" />
                    </div>
                  </div>
                  {uniqueStudentClasses.length > 0 && (
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block mb-1.5">Registered recommend classes labels:</span>
                      <div className="flex flex-wrap gap-1">
                        {uniqueStudentClasses.map(cls => (
                          <button key={cls} type="button" onClick={() => handleAddFieldSuggestionWorkbench(cls)} className="px-2 py-0.5 text-[10.5px] bg-white border rounded hover:bg-slate-100 font-semibold">{cls}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex justify-end"><button type="button" onClick={() => markSectionCompletedAndNext('general', 'branding')} className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold flex items-center gap-1">Continue & Next</button></div>
                </div>
              )}
            </div>

            {/* ACCORDION 2: BRANDING IDENTITY & WATERMARKS */}
            <div className="border-b">
              <button type="button" id="heading_branding" onClick={() => setActiveAccordion('branding')} className="w-full px-5 py-3.5 flex items-center justify-between bg-slate-50 hover:bg-slate-100 text-left">
                <span className="font-bold text-xs text-slate-800 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 border flex items-center justify-center text-[10px] font-bold">2</span>
                  Header School Branding, Stamp & Signatures
                  {completedSections.includes('branding') && (
                    <span className="inline-flex items-center justify-center p-1 text-emerald-600 bg-emerald-50 rounded-full border border-emerald-250 ml-2" title="Completed">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </span>
                {activeAccordion === 'branding' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {activeAccordion === 'branding' && (
                <div className="p-5 space-y-5 animate-fadeIn">
                  
                  {/* Global default switch option */}
                  <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-3">
                    <span className="text-[10px] font-black text-indigo-900 uppercase">Header Branding Details mode:</span>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer font-bold">
                        <input type="radio" checked={!overrideIdentity} onChange={() => setOverrideIdentity(false)} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                        🌐 Default (Inherit Main School Identity)
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer font-bold">
                        <input type="radio" checked={overrideIdentity} onChange={() => setOverrideIdentity(true)} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                        ✏️ Custom (Enable separate header overrides)
                      </label>
                    </div>

                    {!overrideIdentity ? (
                      <div className="text-[11px] text-slate-450 leading-relaxed max-w-xl">
                        Applying global header details automatically (<strong>Name: {branding.schoolName}, Logo: {branding.logoUrl ? "Set" : "None"}</strong>). No separate overrides will be written for these fields.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
                        <div className="md:col-span-2 p-3 bg-white border rounded-xl space-y-2">
                          <span className="text-[9px] font-bold text-slate-500 block">Custom Header Logo Option</span>
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                            <div className="lg:col-span-6 flex items-center gap-4">
                              {structureBranding.logoUrl ? (
                                <div className="relative shrink-0">
                                  <img src={structureBranding.logoUrl} alt="Logo" className={`w-12 h-12 ${structureBranding.logoBorder !== false ? 'border bg-slate-50 p-0.5' : ''} ${structureBranding.logoCircular !== false ? 'rounded-full' : 'rounded-lg'} object-contain`} />
                                  <button type="button" onClick={() => handleBrandingFieldChange('logoUrl', '')} className="absolute -top-1 -right-1 bg-red-600 hover:bg-red-700 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">✕</button>
                                </div>
                              ) : (
                                <div className="w-12 h-12 bg-slate-100 border border-dashed rounded-lg flex items-center justify-center text-[9px] text-slate-400 font-bold">Default</div>
                              )}
                              <div className="flex flex-col gap-1 w-full">
                                <input type="text" value={structureBranding.logoUrl || ''} onChange={(e) => handleBrandingFieldChange('logoUrl', e.target.value)} className="w-full px-2 py-1 text-xs border rounded bg-slate-50" placeholder="Direct logotype URL override..." />
                                <label className="cursor-pointer bg-slate-800 hover:bg-slate-900 text-white text-[9.5px] font-bold py-1 px-2.5 rounded text-center inline-block max-w-max select-none">
                                  Upload file
                                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) compressAndResizeImage(f, 200, 0.9, (b64) => handleBrandingFieldChange('logoUrl', b64));
                                  }} />
                                </label>
                              </div>
                            </div>
                            
                            <div className="lg:col-span-6 border-t lg:border-t-0 lg:border-l border-slate-100 pt-2 lg:pt-0 lg:pl-3.5 space-y-2">
                              <div className="space-y-0.5">
                                <div className="flex justify-between text-[10px]">
                                  <span className="font-bold text-slate-500">Logo Scale Size:</span>
                                  <span className="font-mono text-indigo-600 font-bold">{structureBranding.logoSize !== undefined ? structureBranding.logoSize : 80}px</span>
                                </div>
                                <input
                                  type="range"
                                  min="40"
                                  max="200"
                                  step="2"
                                  value={structureBranding.logoSize !== undefined ? structureBranding.logoSize : 80}
                                  onChange={(e) => handleBrandingFieldChange('logoSize', parseInt(e.target.value))}
                                  className="w-full accent-indigo-650 h-1 bg-slate-205"
                                />
                              </div>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="checkbox"
                                  id="struct_logo_circular"
                                  checked={structureBranding.logoCircular !== false}
                                  onChange={(e) => handleBrandingFieldChange('logoCircular', e.target.checked)}
                                  className="w-3.5 h-3.5 text-indigo-650 cursor-pointer"
                                />
                                <label htmlFor="struct_logo_circular" className="text-[11px] font-semibold text-slate-700 cursor-pointer">
                                  Enable Circle Frame around Logo (Default)
                                </label>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="checkbox"
                                  id="struct_logo_border"
                                  checked={structureBranding.logoBorder !== false}
                                  onChange={(e) => handleBrandingFieldChange('logoBorder', e.target.checked)}
                                  className="w-3.5 h-3.5 text-indigo-650 cursor-pointer"
                                />
                                <label htmlFor="struct_logo_border" className="text-[11px] font-semibold text-slate-700 cursor-pointer">
                                  Enable Border box & Background around Logo (Default)
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Custom Right Logo Option (Optional) */}
                        <div className="md:col-span-2 p-3 bg-white border rounded-xl space-y-2">
                          <span className="text-[9px] font-bold text-slate-500 block">Custom Right Logo Option (Optional)</span>
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                            <div className="lg:col-span-6 flex items-center gap-4">
                              {structureBranding.rightLogoUrl ? (
                                <div className="relative shrink-0">
                                  <img src={structureBranding.rightLogoUrl} alt="Right Logo" className={`w-12 h-12 ${structureBranding.logoBorder !== false ? 'border bg-slate-50 p-0.5' : ''} ${structureBranding.logoCircular !== false ? 'rounded-full' : 'rounded-lg'} object-contain`} />
                                  <button type="button" onClick={() => handleBrandingFieldChange('rightLogoUrl', '')} className="absolute -top-1 -right-1 bg-red-600 hover:bg-red-700 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">✕</button>
                                </div>
                              ) : (
                                <div className="w-12 h-12 bg-slate-100 border border-dashed rounded-lg flex items-center justify-center text-[9px] text-slate-400 font-bold">None</div>
                              )}
                              <div className="flex flex-col gap-1 w-full">
                                <input type="text" value={structureBranding.rightLogoUrl || ''} onChange={(e) => handleBrandingFieldChange('rightLogoUrl', e.target.value)} className="w-full px-2 py-1 text-xs border rounded bg-slate-50" placeholder="Direct right-logo URL override..." />
                                <label className="cursor-pointer bg-slate-800 hover:bg-slate-900 text-white text-[9.5px] font-bold py-1 px-2.5 rounded text-center inline-block max-w-max select-none">
                                  Upload file
                                  <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) compressAndResizeImage(f, 200, 0.9, (b64) => handleBrandingFieldChange('rightLogoUrl', b64));
                                  }} />
                                </label>
                              </div>
                            </div>
                            
                            <div className="lg:col-span-6 border-t lg:border-t-0 lg:border-l border-slate-100 pt-2 lg:pt-0 lg:pl-3.5 space-y-2">
                              <div className="space-y-0.5">
                                <div className="flex justify-between text-[10px]">
                                  <span className="font-bold text-slate-500">Right Logo Scale Size:</span>
                                  <span className="font-mono text-indigo-600 font-bold">{structureBranding.rightLogoSize !== undefined ? structureBranding.rightLogoSize : 80}px</span>
                                </div>
                                <input
                                  type="range"
                                  min="40"
                                  max="200"
                                  step="2"
                                  value={structureBranding.rightLogoSize !== undefined ? structureBranding.rightLogoSize : 80}
                                  onChange={(e) => handleBrandingFieldChange('rightLogoSize', parseInt(e.target.value))}
                                  className="w-full accent-indigo-650 h-1 bg-slate-205"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Landscape Logo/Banner Optional Option */}
                        <div className="md:col-span-2 p-3 bg-indigo-50/15 border border-indigo-100 rounded-xl space-y-2">
                          <label className="text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1.5 font-sans">
                            <span className="bg-indigo-150 text-indigo-700 font-sans font-extrabold px-1.5 py-0.2 rounded text-[8px]">New</span>
                            Optional Landscape Name/Header Banner Image Override
                          </label>
                          <div className="flex items-center gap-4">
                            {structureBranding.nameBannerUrl ? (
                              <div className="relative shrink-0 max-w-[150px]">
                                <img src={structureBranding.nameBannerUrl} alt="Banner" className="h-10 w-auto border rounded object-contain bg-slate-50 p-0.5" />
                                <button type="button" onClick={() => handleBrandingFieldChange('nameBannerUrl', '')} className="absolute -top-1 -right-1 bg-red-600 hover:bg-red-700 text-white text-[8px] font-bold rounded-full w-4 h-4 flex items-center justify-center">✕</button>
                              </div>
                            ) : (
                              <div className="w-[150px] h-10 bg-slate-100 border border-dashed rounded flex items-center justify-center text-[8.5px] text-slate-400 font-bold select-none text-center">Using School Name</div>
                            )}
                            <div className="flex flex-col gap-1 w-full">
                              <input type="text" value={structureBranding.nameBannerUrl || ''} onChange={(e) => handleBrandingFieldChange('nameBannerUrl', e.target.value)} className="w-full px-2 py-1 text-xs border rounded bg-slate-50" placeholder="Direct landscape banner image URL override..." />
                              <label className="cursor-pointer bg-slate-800 hover:bg-slate-900 text-white text-[9.5px] font-bold py-1 px-2.5 rounded text-center inline-block max-w-max select-none">
                                Upload banner
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) compressAndResizeImage(f, 800, 0.95, (b64) => handleBrandingFieldChange('nameBannerUrl', b64));
                                }} />
                              </label>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1.5 pt-1">
                            <input
                              type="checkbox"
                              id="struct_hide_school_details"
                              checked={structureBranding.hideSchoolDetails === true}
                              onChange={(e) => handleBrandingFieldChange('hideSchoolDetails', e.target.checked)}
                              className="w-3.5 h-3.5 text-indigo-650 cursor-pointer"
                            />
                            <label htmlFor="struct_hide_school_details" className="text-[11px] font-semibold text-slate-700 cursor-pointer">
                              Hide secondary text details (tagline, address, helpline, etc.) under the custom name banner.
                            </label>
                          </div>
                        </div>

                        {/* Text fields */}
                        <div>
                          <label className="text-[9px] uppercase font-bold text-slate-400">School Name</label>
                          <input type="text" value={structureBranding.schoolName || ''} onChange={(e) => handleBrandingFieldChange('schoolName', e.target.value)} placeholder={branding.schoolName} className="w-full border rounded px-2 py-1 text-xs" />
                        </div>
                        <div>
                          <label className="text-[9px] uppercase font-bold text-slate-400">Affiliation Tagline</label>
                          <input type="text" value={structureBranding.tagline || ''} onChange={(e) => handleBrandingFieldChange('tagline', e.target.value)} placeholder={branding.tagline} className="w-full border rounded px-2 py-1 text-xs" />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[9px] uppercase font-bold text-slate-400">Complete Address</label>
                          <input type="text" value={structureBranding.address || ''} onChange={(e) => handleBrandingFieldChange('address', e.target.value)} placeholder={branding.address} className="w-full border rounded px-2 py-1 text-xs" />
                        </div>
                        <div>
                          <label className="text-[9px] uppercase font-bold text-slate-400">Helpline Phone</label>
                          <input type="text" value={structureBranding.helpline || ''} onChange={(e) => handleBrandingFieldChange('helpline', e.target.value)} placeholder={branding.helpline} className="w-full border rounded px-2 py-1 text-xs" />
                        </div>
                        <div>
                          <label className="text-[9px] uppercase font-bold text-slate-400">Official Website</label>
                          <input type="text" value={structureBranding.website || ''} onChange={(e) => handleBrandingFieldChange('website', e.target.value)} placeholder={branding.website} className="w-full border rounded px-2 py-1 text-xs" />
                        </div>
                        <div>
                          <label className="text-[9px] uppercase font-bold text-slate-400">Official Email</label>
                          <input type="text" value={structureBranding.email || ''} onChange={(e) => handleBrandingFieldChange('email', e.target.value)} placeholder={branding.email} className="w-full border rounded px-2 py-1 text-xs" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Stamp watermark nesting */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-3.5 border-t">
                    <div className="md:col-span-7 space-y-2.5 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <span className="text-[10px] font-black text-slate-700 block uppercase tracking-wide">Watermark Background Stamp Setup</span>
                        <div className="flex items-center gap-1.5">
                          <input 
                            type="checkbox" 
                            checked={structureBranding.showWatermark === true} 
                            onChange={(e) => handleBrandingFieldChange('showWatermark', e.target.checked)} 
                            id="swm" 
                            className="w-4 h-4 text-indigo-600 rounded cursor-pointer focus:ring-indigo-500" 
                          />
                          <label htmlFor="swm" className="text-xs font-bold text-slate-800 cursor-pointer select-none">Show Watermark Stamp</label>
                        </div>
                      </div>

                      {structureBranding.showWatermark && (
                        <div className="space-y-3.5 pt-1">
                          {/* Type Selector: Text vs Logo */}
                          <div className="flex gap-4 p-1.5 bg-white rounded-lg border border-slate-200/80">
                            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer font-bold select-none px-2 py-1 rounded hover:bg-slate-50">
                              <input 
                                type="radio" 
                                name="struct_watermark_type"
                                checked={structureBranding.watermarkType === 'text'} 
                                onChange={() => handleBrandingFieldChange('watermarkType', 'text')} 
                                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                              <span>Text Stamp</span>
                            </label>
                            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer font-bold select-none px-2 py-1 rounded hover:bg-slate-50">
                              <input 
                                type="radio" 
                                name="struct_watermark_type"
                                checked={structureBranding.watermarkType !== 'text'} 
                                onChange={() => {
                                  handleBrandingFieldChange('watermarkType', 'logo');
                                  if (!structureBranding.watermarkLogoUrl && structureBranding.logoUrl) {
                                    handleBrandingFieldChange('watermarkLogoUrl', structureBranding.logoUrl);
                                  }
                                  if (!structureBranding.watermarkSize || structureBranding.watermarkSize === 120) {
                                    handleBrandingFieldChange('watermarkSize', 320);
                                  }
                                }} 
                                className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                              <span>Logo Stamp</span>
                            </label>
                          </div>

                          {structureBranding.watermarkType === 'text' ? (
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold uppercase text-slate-500 block">Stamp Text:</span>
                              <input 
                                type="text" 
                                value={structureBranding.watermarkText || ''} 
                                onChange={(e) => handleBrandingFieldChange('watermarkText', e.target.value)} 
                                className="w-full px-2.5 py-1.5 border text-xs rounded-lg bg-white font-black text-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" 
                                placeholder="E.g. SCHOOL NAME OR CONFIDENTIAL"
                              />
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {/* Upload Image Button & Clear Controls */}
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="cursor-pointer inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold py-1.5 px-3 rounded-lg shadow-2xs transition-all select-none">
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

                                {structureBranding.watermarkLogoUrl && (
                                  <button
                                    type="button"
                                    onClick={() => handleBrandingFieldChange('watermarkLogoUrl', '')}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                                    title="Remove watermark image"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    Remove Image
                                  </button>
                                )}
                              </div>

                              {/* Google Drive or Web Link Input */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] font-bold uppercase text-slate-500 flex items-center gap-1">
                                    <Link2 className="w-3 h-3 text-indigo-500" />
                                    Or Paste Google Drive / Web Link:
                                  </span>
                                  {structureBranding.watermarkLogoUrl && isGoogleDriveUrl(structureBranding.watermarkLogoUrl) && (
                                    <span className="inline-flex items-center gap-1 text-[8.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full font-mono">
                                      <CheckCircle2 className="w-2.5 h-2.5" /> Google Drive Link Converted
                                    </span>
                                  )}
                                </div>
                                <input
                                  type="text"
                                  value={structureBranding.watermarkLogoUrl || ''}
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
                                  className="w-full px-2.5 py-1.5 border text-xs rounded-lg bg-white font-mono text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                  placeholder="Paste Google Drive share link (e.g. drive.google.com/file/d/...) or web image URL..."
                                />
                                <p className="text-[9px] text-slate-400 leading-tight">
                                  💡 <strong>Google Drive:</strong> Paste any share link. Ensure the file permission is set to <em>&ldquo;Anyone with the link can view&rdquo;</em>.
                                </p>
                              </div>

                              {/* Visual Thumbnail Preview */}
                              {structureBranding.watermarkLogoUrl && (
                                <div className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center gap-3 shadow-2xs">
                                  <div 
                                    className="relative w-14 h-14 rounded-lg border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden"
                                    style={{
                                      backgroundImage: 'linear-gradient(45deg, #f1f5f9 25%, transparent 25%), linear-gradient(-45deg, #f1f5f9 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f1f5f9 75%), linear-gradient(-45deg, transparent 75%, #f1f5f9 75%)',
                                      backgroundSize: '12px 12px',
                                      backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px'
                                    }}
                                    title="Watermark image preview (transparency checkerboard)"
                                  >
                                    <img
                                      src={normalizeExternalImageUrl(structureBranding.watermarkLogoUrl)}
                                      alt="Watermark Stamp Preview"
                                      className="max-w-full max-h-full object-contain pointer-events-none"
                                      style={{ opacity: Math.max(0.2, structureBranding.watermarkOpacity ?? 0.15) }}
                                      referrerPolicy="no-referrer"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLElement).style.display = 'none';
                                        const badge = (e.currentTarget.parentElement as HTMLElement)?.querySelector('.watermark-err-box');
                                        if (badge) (badge as HTMLElement).style.display = 'flex';
                                      }}
                                    />
                                    <div className="watermark-err-box hidden absolute inset-0 bg-rose-50/95 text-rose-700 text-[8px] font-bold p-1 text-center items-center justify-center flex-col leading-tight">
                                      <span>⚠️ Failed to load</span>
                                      <span className="text-[7px] text-rose-500 font-normal">Check link permission</span>
                                    </div>
                                  </div>

                                  <div className="flex-1 min-w-0 space-y-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[11px] font-bold text-slate-800 truncate">
                                        {structureBranding.watermarkLogoUrl.startsWith('data:') 
                                          ? 'Local Image File (Uploaded)' 
                                          : isGoogleDriveUrl(structureBranding.watermarkLogoUrl) 
                                            ? 'Google Drive Direct Link'
                                            : 'Web Image URL'}
                                      </span>
                                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[8px] font-bold px-1.5 py-0.2 rounded-full">
                                        Ready
                                      </span>
                                    </div>
                                    <p className="text-[9.5px] text-slate-500 leading-tight">
                                      Stamp is active and configured for report cards.
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Coverage / Layout Mode for Logo Watermarks */}
                          {structureBranding.watermarkType === 'logo' && (
                            <div className="space-y-2 pt-2 border-t border-dashed">
                              <span className="text-[9.5px] font-black uppercase text-slate-600 block">Watermark Page Coverage / Layout:</span>
                              <div className="grid grid-cols-2 gap-2">
                                <label className={`flex flex-col gap-1 p-2 rounded-lg border cursor-pointer transition-all ${
                                  (structureBranding.watermarkLayout === 'full_page') 
                                    ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-500' 
                                    : 'bg-white border-slate-200 hover:border-slate-300'
                                }`}>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="radio"
                                      name="struct_wm_layout"
                                      checked={structureBranding.watermarkLayout === 'full_page'}
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
                                  (structureBranding.watermarkLayout !== 'full_page') 
                                    ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-500' 
                                    : 'bg-white border-slate-200 hover:border-slate-300'
                                }`}>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="radio"
                                      name="struct_wm_layout"
                                      checked={structureBranding.watermarkLayout !== 'full_page'}
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

                              {structureBranding.watermarkLayout === 'full_page' && (
                                <div className="flex items-center justify-between p-2 bg-indigo-50/60 rounded-lg border border-indigo-150">
                                  <span className="text-[9.5px] font-bold text-indigo-900">A4 Fitting Mode:</span>
                                  <select
                                    value={structureBranding.watermarkFit || 'fill'}
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

                          {/* Size & Opacity Sliders */}
                          <div className={`grid ${structureBranding.watermarkLayout === 'full_page' ? 'grid-cols-1' : 'grid-cols-2'} gap-3 text-[10px] font-extrabold text-slate-600 pt-1 border-t border-dashed`}>
                            {structureBranding.watermarkLayout !== 'full_page' && (
                              <div>
                                <div className="flex justify-between items-center mb-1">
                                  <span>Stamp Size:</span>
                                  <span className="font-mono text-indigo-600 font-black">{structureBranding.watermarkSize || (structureBranding.watermarkType === 'logo' ? 320 : 120)}px</span>
                                </div>
                                <input 
                                  type="range" 
                                  min="30" 
                                  max="1200" 
                                  step="10" 
                                  value={structureBranding.watermarkSize || (structureBranding.watermarkType === 'logo' ? 320 : 120)} 
                                  onChange={(e) => handleBrandingFieldChange('watermarkSize', parseInt(e.target.value))} 
                                  className="w-full accent-indigo-650 h-1.5 bg-slate-200 rounded-lg cursor-pointer" 
                                />
                              </div>
                            )}
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span>Opacity:</span>
                                <span className="font-mono text-indigo-600 font-black">{Math.round((structureBranding.watermarkOpacity ?? 0.08) * 100)}%</span>
                              </div>
                              <input 
                                type="range" 
                                min="0.01" 
                                max="0.40" 
                                step="0.01" 
                                value={structureBranding.watermarkOpacity ?? 0.08} 
                                onChange={(e) => handleBrandingFieldChange('watermarkOpacity', parseFloat(e.target.value))} 
                                className="w-full accent-indigo-650 h-1.5 bg-slate-200 rounded-lg cursor-pointer" 
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Mini Live Preview simulation of the watermark on a report card */}
                    <div className="md:col-span-5 p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
                      <div>
                        <span className="text-[10px] font-black text-slate-700 block uppercase tracking-wide mb-2">Live Watermark Stamp Preview</span>
                        <div className="relative w-full h-48 bg-white border border-slate-200 rounded-lg p-2.5 overflow-hidden flex flex-col justify-between shadow-2xs">
                          {/* Sample Header */}
                          <div className="flex justify-between items-center border-b pb-1 text-[8.5px] text-slate-400 font-bold">
                            <span>ACADEMIC REPORT CARD</span>
                            <span>{structureBranding.session || '2024-2025'}</span>
                          </div>

                          {/* Watermark in background */}
                          {structureBranding.showWatermark && (
                            <div className={`absolute inset-0 pointer-events-none select-none overflow-hidden z-0 ${
                              structureBranding.watermarkLayout === 'full_page' ? 'w-full h-full' : 'flex items-center justify-center'
                            }`}>
                              {structureBranding.watermarkType === 'logo' ? (
                                (structureBranding.watermarkLogoUrl || structureBranding.logoUrl) ? (
                                  <img
                                    src={normalizeExternalImageUrl(structureBranding.watermarkLogoUrl || structureBranding.logoUrl)}
                                    alt="Watermark Stamp"
                                    className="pointer-events-none select-none"
                                    style={
                                      structureBranding.watermarkLayout === 'full_page'
                                        ? {
                                            position: 'absolute',
                                            inset: 0,
                                            width: '100%',
                                            height: '100%',
                                            objectFit: (structureBranding.watermarkFit || 'fill') as any,
                                            opacity: structureBranding.watermarkOpacity ?? 0.08
                                          }
                                        : {
                                            objectFit: 'contain',
                                            maxHeight: '85%',
                                            maxWidth: '85%',
                                            opacity: structureBranding.watermarkOpacity ?? 0.08,
                                            width: `${Math.min(170, (structureBranding.watermarkSize || 320) * 0.45)}px`,
                                            height: `${Math.min(170, (structureBranding.watermarkSize || 320) * 0.45)}px`
                                          }
                                    }
                                    referrerPolicy="no-referrer"
                                  />
                                ) : null
                              ) : (
                                <span
                                  className="font-black uppercase rotate-[-25deg] tracking-widest text-center select-none font-sans"
                                  style={{
                                    opacity: structureBranding.watermarkOpacity ?? 0.08,
                                    color: 'rgb(17, 24, 39)',
                                    fontSize: `${Math.min(28, (structureBranding.watermarkSize || 120) * 0.22)}px`
                                  }}
                                >
                                  {structureBranding.watermarkText || structureBranding.schoolName || 'WATERMARK'}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Sample Table Mock */}
                          <div className="relative z-10 space-y-1 my-auto">
                            <table className="w-full text-[8px] border-collapse bg-white/75 rounded">
                              <thead>
                                <tr className="border-b text-slate-600 bg-slate-100/70">
                                  <th className="p-0.5 text-left font-bold">Subject</th>
                                  <th className="p-0.5 text-center font-bold">Marks</th>
                                  <th className="p-0.5 text-center font-bold">Grade</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-slate-600 font-medium">
                                <tr><td className="p-0.5">Mathematics</td><td className="p-0.5 text-center font-mono">94/100</td><td className="p-0.5 text-center font-bold text-emerald-600">A1</td></tr>
                                <tr><td className="p-0.5">Science</td><td className="p-0.5 text-center font-mono">89/100</td><td className="p-0.5 text-center font-bold text-emerald-600">A2</td></tr>
                                <tr><td className="p-0.5">English Core</td><td className="p-0.5 text-center font-mono">92/100</td><td className="p-0.5 text-center font-bold text-emerald-600">A1</td></tr>
                              </tbody>
                            </table>
                          </div>

                          {/* Sample Footer */}
                          <div className="flex justify-between items-center text-[7.5px] text-slate-400 border-t pt-1 font-semibold">
                            <span>Principal Signature</span>
                            <span>Class Teacher</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-[9px] text-slate-400 mt-2 text-center">
                        {structureBranding.watermarkLayout === 'full_page' 
                          ? 'Full Page Mode: Watermark covers entire A4 report card background.'
                          : 'Centered Stamp Mode: Watermark appears centered behind marks.'}
                      </p>
                    </div>
                  </div>

                  {/* Rest template colors */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-3.5 border-t">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-450 uppercase">Session Year Text</span>
                      <input type="text" value={structureBranding.session || ''} onChange={(e) => handleBrandingFieldChange('session', e.target.value)} className="w-full px-2.5 py-1 text-xs border rounded-lg" placeholder={branding.session} />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-455 uppercase">Card Head Badge Title</span>
                      <input type="text" value={structureBranding.reportCardTitle || ''} onChange={(e) => handleBrandingFieldChange('reportCardTitle', e.target.value)} className="w-full px-2.5 py-1 text-xs border rounded-lg font-bold" placeholder="Annual Exam Report Card" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-455 block">Theme Color</span>
                        <div className="flex items-center gap-1">
                          <input type="color" value={structureBranding.themeColor || branding.themeColor} onChange={(e) => handleBrandingFieldChange('themeColor', e.target.value)} className="w-7 h-7 border rounded cursor-pointer" />
                          <span className="text-[9px] font-mono">{structureBranding.themeColor || branding.themeColor}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-455 block">Border Color</span>
                        <div className="flex items-center gap-1">
                          <input type="color" value={structureBranding.borderColor || branding.borderColor || '#D12121'} onChange={(e) => handleBrandingFieldChange('borderColor', e.target.value)} className="w-7 h-7 border rounded cursor-pointer" />
                          <span className="text-[9px] font-mono">{structureBranding.borderColor || branding.borderColor || '#D12121'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Print orientation option */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-3.5 border-t">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-indigo-600 block uppercase tracking-wider">Report Card Orientation</span>
                      <p className="text-[9px] text-slate-400 mb-1 leading-normal">
                        Select whether results for this specific class group should be displayed and printed vertically or horizontally (landscape).
                      </p>
                      <select 
                        value={structureBranding.printOrientation || 'portrait'} 
                        onChange={(e) => handleBrandingFieldChange('printOrientation', e.target.value)} 
                        className="w-full md:max-w-md px-2.5 py-1.5 text-xs border rounded-lg bg-white font-bold text-slate-750"
                      >
                        <option value="portrait">📄 Standard Portrait Layout (Vertical)</option>
                        <option value="landscape">📐 Modern Landscape Layout (Horizontal)</option>
                      </select>
                    </div>
                  </div>

                  {/* EDITABLE SCHOLASTIC TABLE HEADINGS */}
                  <div className="pt-3.5 border-t space-y-3">
                    <span className="text-[10px] font-extrabold text-indigo-650 uppercase tracking-widest block">Custom Scholastic Table Headings Config</span>
                    <p className="text-[9.5px] text-slate-400 mb-2 leading-relaxed">
                      Customize the text headings displayed in the scholastic performance marks table of the report card.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      <div className="space-y-1">
                        <span className="text-[9.5px] font-bold text-slate-500 block">Scholastic Table Title</span>
                        <input type="text" value={structureBranding.scholasticLabel ?? ''} onChange={(e) => handleBrandingFieldChange('scholasticLabel', e.target.value)} className="w-full px-2.5 py-1 text-xs border rounded-lg font-medium" placeholder="Scholastic Performance" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9.5px] font-bold text-slate-500 block">Scholastic Subjects Heading</span>
                        <input type="text" value={structureBranding.scholasticSubjectsHeaderLabel ?? ''} onChange={(e) => handleBrandingFieldChange('scholasticSubjectsHeaderLabel', e.target.value)} className="w-full px-2.5 py-1 text-xs border rounded-lg font-medium" placeholder="Scholastic Subjects" />
                      </div>
                      <div className="space-y-1 md:col-span-2 p-2 bg-indigo-50/20 border border-indigo-100 rounded-lg flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-slate-700 block">Enable Additional Subjects Section</span>
                          <span className="text-[9px] text-slate-500">Separates main subjects from non-academic/additional subjects</span>
                        </div>
                        <input type="checkbox" checked={structureBranding.additionalSubjectsEnabled === true} onChange={(e) => handleBrandingFieldChange('additionalSubjectsEnabled', e.target.checked)} className="w-4 h-4 text-indigo-600 rounded cursor-pointer" />
                      </div>
                      {structureBranding.additionalSubjectsEnabled === true && (
                        <>
                          <div className="space-y-1">
                            <span className="text-[9.5px] font-bold text-slate-500 block">Additional Subjects Table Heading</span>
                            <input type="text" value={structureBranding.additionalSubjectsHeaderLabel ?? ''} onChange={(e) => handleBrandingFieldChange('additionalSubjectsHeaderLabel', e.target.value)} className="w-full px-2.5 py-1 text-xs border rounded-lg font-medium" placeholder="Additional Subjects" />
                          </div>
                          <div className="space-y-1 md:col-span-2 p-2 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                            <div>
                              <span className="text-xs font-bold text-slate-700 block">Show After Attendance Table</span>
                              <span className="text-[9px] text-slate-500">Renders the additional subjects table below the combined attendance/summary bar</span>
                            </div>
                            <input type="checkbox" checked={structureBranding.additionalSubjectsAfterAttendance === true} onChange={(e) => handleBrandingFieldChange('additionalSubjectsAfterAttendance', e.target.checked)} className="w-4 h-4 text-indigo-600 rounded cursor-pointer" />
                          </div>
                        </>
                      )}
                      <div className="space-y-1">
                        <span className="text-[9.5px] font-bold text-slate-500 block">Term 1 Total / Grade Heading</span>
                        <input type="text" value={structureBranding.term1TotalLabel ?? ''} onChange={(e) => handleBrandingFieldChange('term1TotalLabel', e.target.value)} className="w-full px-2.5 py-1 text-xs border rounded-lg font-medium" placeholder={structureBranding.pureGradeBased ? "T1 Grade" : "T1 Total"} />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9.5px] font-bold text-slate-500 block">Term 2 Total / Grade Heading</span>
                        <input type="text" value={structureBranding.term2TotalLabel ?? ''} onChange={(e) => handleBrandingFieldChange('term2TotalLabel', e.target.value)} className="w-full px-2.5 py-1 text-xs border rounded-lg font-medium" placeholder={structureBranding.pureGradeBased ? "T2 Grade" : "T2 Total"} />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9.5px] font-bold text-slate-500 block">Overall Results Heading</span>
                        <input type="text" value={structureBranding.overallResultsHeaderLabel ?? ''} onChange={(e) => handleBrandingFieldChange('overallResultsHeaderLabel', e.target.value)} className="w-full px-2.5 py-1 text-xs border rounded-lg font-medium" placeholder="Overall Results" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9.5px] font-bold text-slate-500 block">Total Marks / Subject Grade Heading</span>
                        <input type="text" value={structureBranding.totalMarksHeaderLabel ?? ''} onChange={(e) => handleBrandingFieldChange('totalMarksHeaderLabel', e.target.value)} className="w-full px-2.5 py-1 text-xs border rounded-lg font-medium" placeholder={structureBranding.pureGradeBased ? "Subject Grade" : "Total Marks"} />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9.5px] font-bold text-slate-500 block">Grade Column Heading</span>
                        <input type="text" value={structureBranding.gradeHeaderLabel ?? ''} onChange={(e) => handleBrandingFieldChange('gradeHeaderLabel', e.target.value)} className="w-full px-2.5 py-1 text-xs border rounded-lg font-medium" placeholder="Grade" />
                      </div>
                    </div>
                  </div>

                  {/* EDITABLE SUMMARY & ATTENDANCE TABLE HEADINGS */}
                  <div className="pt-3.5 border-t space-y-3">
                    <span className="text-[10px] font-extrabold text-indigo-650 uppercase tracking-widest block">Summary &amp; Attendance Headings Config</span>
                    <p className="text-[9.5px] text-slate-400 mb-2 leading-relaxed">
                      Customize the main text headings and labels printed in the scholastic summary section and the overall results panel.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      <div className="space-y-1">
                        <span className="text-[9.5px] font-bold text-slate-500 block">Scholastic Summary Heading</span>
                        <input type="text" value={structureBranding.scholasticSummaryLabel ?? ''} onChange={(e) => handleBrandingFieldChange('scholasticSummaryLabel', e.target.value)} className="w-full px-2.5 py-1 text-xs border rounded-lg font-medium" placeholder="Scholastic Summary" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9.5px] font-bold text-slate-500 block">Working Attendance Heading</span>
                        <input type="text" value={structureBranding.attendanceLabel ?? ''} onChange={(e) => handleBrandingFieldChange('attendanceLabel', e.target.value)} className="w-full px-2.5 py-1 text-xs border rounded-lg font-medium" placeholder="Working Attendance" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9.5px] font-bold text-slate-500 block">Total Marks Obtained Heading</span>
                        <input type="text" value={structureBranding.totalMarksObtainedLabel ?? ''} onChange={(e) => handleBrandingFieldChange('totalMarksObtainedLabel', e.target.value)} className="w-full px-2.5 py-1 text-xs border rounded-lg font-medium" placeholder="Total Marks Obtained" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9.5px] font-bold text-slate-500 block">Overall Percentage Heading</span>
                        <input type="text" value={structureBranding.gradePercentageLabel ?? ''} onChange={(e) => handleBrandingFieldChange('gradePercentageLabel', e.target.value)} className="w-full px-2.5 py-1 text-xs border rounded-lg font-medium" placeholder="Overall Percentage" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9.5px] font-bold text-slate-500 block">Overall Grade Heading</span>
                        <input type="text" value={structureBranding.boardGradeLabel ?? ''} onChange={(e) => handleBrandingFieldChange('boardGradeLabel', e.target.value)} className="w-full px-2.5 py-1 text-xs border rounded-lg font-medium" placeholder="Overall Grade" />
                      </div>
                    </div>
                  </div>

                  {/* DESIGN OPTIONS: CONGRATULATIONS / PROMOTION BOX VISIBILITY */}
                  <div className="pt-3.5 border-t space-y-3">
                    <span className="text-[10px] font-extrabold text-indigo-650 uppercase tracking-widest block">Design-Specific Layout Toggles</span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3.5 bg-indigo-50/40 rounded-xl border border-indigo-100/70">
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          id="struct_student_photo_disabled"
                          checked={structureBranding.studentPhotoDisabled !== true}
                          onChange={(e) => handleBrandingFieldChange('studentPhotoDisabled', !e.target.checked)}
                          className="w-4 h-4 mt-0.5 text-indigo-650 rounded border-slate-350 cursor-pointer"
                        />
                        <div>
                          <label htmlFor="struct_student_photo_disabled" className="text-xs font-black text-slate-800 cursor-pointer select-none flex items-center gap-1">
                            Show Student Profile Photo
                          </label>
                          <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                            Toggle visibility of the student profile photo box. When disabled, student details stretch to fill full-width.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          id="struct_congratulations_disabled"
                          checked={structureBranding.congratulationsDisabled !== true}
                          onChange={(e) => handleBrandingFieldChange('congratulationsDisabled', !e.target.checked)}
                          className="w-4 h-4 mt-0.5 text-indigo-650 rounded border-slate-350 cursor-pointer"
                        />
                        <div>
                          <label htmlFor="struct_congratulations_disabled" className="text-xs font-black text-slate-800 cursor-pointer select-none flex items-center gap-1">
                            Show Congratulations / Promotion Line Box
                          </label>
                          <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                            Toggle visibility of the "Congratulations! Promoted to Class..." promotion box. When disabled, the Remarks input block expands to take up full-width row space.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2"><button type="button" onClick={() => markSectionCompletedAndNext('branding', 'subjects')} className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold">Save & Next</button></div>
                </div>
              )}
            </div>

            {/* ACCORDION 3: DRUGGABLE & EDITABLE TEACHING CURRICULUM SUBJECTS */}
            <div className="border-b">
              <button type="button" id="heading_subjects" onClick={() => setActiveAccordion('subjects')} className="w-full px-5 py-3.5 flex items-center justify-between bg-slate-50 hover:bg-slate-100 text-left">
                <span className="font-bold text-xs text-slate-800 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 border flex items-center justify-center text-[10px] font-bold">3</span>
                  Teaching Subjects Set up, (with teaching subjects only)
                  {completedSections.includes('subjects') && (
                    <span className="inline-flex items-center justify-center p-1 text-emerald-600 bg-emerald-50 rounded-full border border-emerald-250 ml-2" title="Completed">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </span>
                {activeAccordion === 'subjects' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {activeAccordion === 'subjects' && (
                <div className="p-5 space-y-5 animate-fadeIn">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                    <p className="text-[11px] text-slate-600 leading-normal">
                      Reorder subjects by dragging with the grip handle or clicking Chevrons. Assign optional <strong className="text-indigo-900 font-bold">Skill Groups / Categories</strong> for grouped report cards.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (!window.confirm("Load Foundational Learning (Skills & Indicators) Grouped Structure? This will configure Skills grouped under Language & Literacy, Numeracy & Logic, and set Grade-Only mode.")) return;
                        setPureGradeBased(true);
                        setScholasticTerm1Disabled(false);
                        setScholasticTerm2Disabled(true);
                        setScholasticTerm3Disabled(true);
                        setStructureScoreColumns([]);
                        setStructureSubjects([
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
                        ]);
                        setStructureGradeScales([
                          { minPercent: 85, maxPercent: 100, grade: 'E' },
                          { minPercent: 60, maxPercent: 84, grade: 'M' },
                          { minPercent: 0, maxPercent: 59, grade: 'D' }
                        ]);
                        setStructureBranding(prev => ({
                          ...prev,
                          scholasticPerformanceHeaderLabel: "FOUNDATIONAL LEARNING",
                          scholasticSubjectsHeaderLabel: "SKILLS & INDICATORS",
                          term1Label: "TERM 1 LEVEL",
                          gradeHeaderLabel: "TERM 1 LEVEL",
                          gradingScaleRulesHeading: "ASSESSMENT CRITERIA: (E: Exceeding Expectations | M: Meets Expectations | D: Developing)"
                        }));
                      }}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold shrink-0 shadow-2xs flex items-center gap-1.5"
                    >
                      🌟 Load Foundational Learning Preset
                    </button>
                  </div>

                  {/* Scholastic subjects block */}
                  <div className="p-4 bg-slate-50/55 border border-slate-200 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4 text-indigo-550" /> Academic Scholastic Subjects
                      </span>
                      <button type="button" onClick={() => handleAddCustomSubjectToStructure('scholastic')} className="px-2.5 py-1 text-[11px] font-bold bg-white hover:bg-slate-50 text-indigo-600 border border-indigo-200 rounded-lg">＋ Add Scholastic Subject</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                      {structureSubjects.filter(s => s.type === 'scholastic').map((sub) => (
                        <div
                          key={sub.id} id={`sub-drag-${sub.id}`} draggable
                          onDragStart={(e) => handleSubDragStart(e, sub.id)}
                          onDragOver={(e) => handleSubDragOver(e, sub.id, 'scholastic')}
                          onDragEnd={() => setDraggedSubId(null)}
                          className={`flex flex-col p-3 bg-white rounded-xl border border-slate-251 transition-all hover:border-indigo-305 ${draggedSubId === sub.id ? 'opacity-40 bg-slate-100' : ''}`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-1.5 w-full mr-2 min-w-0">
                              <span className="text-slate-400 cursor-grab active:cursor-grabbing hover:text-indigo-610 px-0.5">
                                <GripVertical className="w-3.5 h-3.5" />
                              </span>
                              <div className="flex items-center flex-shrink-0">
                                <button type="button" onClick={() => moveSubjectItem(sub.id, 'up')} className="p-0.5 hover:bg-slate-100 rounded text-slate-500"><ChevronUp className="w-3 h-3" /></button>
                                <button type="button" onClick={() => moveSubjectItem(sub.id, 'down')} className="p-0.5 hover:bg-slate-100 rounded text-slate-500"><ChevronDown className="w-3 h-3" /></button>
                              </div>
                              <input type="text" value={sub.name} onChange={(e) => handleModifySubjectName(sub.id, e.target.value)} className="bg-transparent border-b border-transparent focus:border-indigo-400 focus:bg-slate-50 px-1 py-0.5 font-bold text-slate-800 w-full text-xs focus:outline-none" />
                            </div>
                            
                            <div className="flex items-center gap-2 select-none flex-shrink-0">
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] font-black text-slate-400">TOTAL MAX:</span>
                                <input type="number" min="5" max="300" value={sub.maxMarks || 100} onChange={(e) => handleUpdateSubjectMaxMarks(sub.id, parseInt(e.target.value, 10))} className="w-12 px-1 py-0.5 border text-center rounded text-xs font-bold bg-slate-50 focus:bg-white" />
                              </div>
                              <button type="button" onClick={() => handleRemoveSubjectFromStructure(sub.id)} className="p-1 hover:bg-rose-50 text-rose-500 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>

                          {/* Skill / Category Group input or dropdown */}
                          {enableSubjectGrouping ? (
                            <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-slate-100">
                              <div className="flex items-center justify-between">
                                <span className="text-[9.5px] font-bold text-indigo-700 uppercase shrink-0 flex items-center gap-1">
                                  <FolderTree className="w-3 h-3 text-indigo-500" /> Group / Category:
                                </span>
                                {sub.group && (
                                  <span className="text-[9px] px-1.5 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded">
                                    {sub.group}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={sub.group || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setStructureSubjects(prev => prev.map(s => s.id === sub.id ? { ...s, group: val || undefined } : s));
                                  }}
                                  className="w-full text-xs font-semibold px-2 py-1 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-indigo-400 focus:outline-none"
                                >
                                  <option value="">-- No Group (Ungrouped) --</option>
                                  {allAvailableGroups.map((grp) => (
                                    <option key={grp} value={grp}>{grp}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[9.5px] text-slate-400">
                              <span className="flex items-center gap-1"><FolderTree className="w-3 h-3 text-slate-400" /> Grouping:</span>
                              <span className="font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">Disabled</span>
                            </div>
                          )}

                          {/* Render custom column maximum marks if enabled */}
                          {subjectSpecificMaxMarksEnabled && structureScoreColumns.length > 0 && (
                            <div className="mt-2.5 pt-2.5 border-t border-dashed border-slate-200">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[9.5px] uppercase font-extrabold text-amber-800">Custom Column Max Marks:</span>
                                <span className="text-[8.5px] text-slate-400">Updates here apply only to {sub.name || 'this subject'}</span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {structureScoreColumns.map((col) => {
                                  const customVal = sub.customMaxMarks?.[col.id] !== undefined ? sub.customMaxMarks[col.id] : col.maxMarks;
                                  return (
                                    <div key={col.id} className="flex flex-col gap-0.5 bg-amber-50/25 p-1 px-1.5 rounded-lg border border-amber-100">
                                      <span className="text-[9px] font-bold text-slate-600 truncate" title={col.name}>{col.name}</span>
                                      <div className="flex items-center gap-1 mt-0.5">
                                        <input 
                                          type="number" 
                                          min="0" 
                                          max="300" 
                                          value={customVal} 
                                          onChange={(e) => handleUpdateSubjectColumnMaxMarks(sub.id, col.id, parseInt(e.target.value, 10) || 0)} 
                                          className="w-full text-[10.5px] px-1 py-0.5 border text-center rounded font-extrabold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500" 
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-slate-200">
                      <span className="text-[9.5px] uppercase font-black text-slate-400 block mb-1">Toggle additions from master schema checklist:</span>
                      <div className="flex flex-wrap gap-1">
                        {subjects.filter(s => s.type === 'scholastic' && !structureSubjects.some(p => p.id === s.id)).map(sub => (
                          <button key={sub.id} type="button" onClick={() => handleToggleSubjectInStructure(sub)} className="px-2 py-0.5 bg-white hover:bg-slate-105 border rounded text-[10.5px] text-slate-705 font-bold">＋ {sub.name}</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Additional subjects block */}
                  {structureBranding.additionalSubjectsEnabled === true && (
                    <div className="p-4 bg-emerald-50/20 border border-emerald-200 rounded-2xl space-y-3 mt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                          <BookOpen className="w-4 h-4 text-emerald-600" /> {structureBranding.additionalSubjectsHeaderLabel || "Additional Subjects"}
                        </span>
                        <button type="button" onClick={() => handleAddCustomSubjectToStructure('additional')} className="px-2.5 py-1 text-[11px] font-bold bg-white hover:bg-slate-50 text-emerald-600 border border-emerald-200 rounded-lg">＋ Add Additional Subject</button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                        {structureSubjects.filter(s => s.type === 'additional').map((sub) => (
                          <div
                            key={sub.id} id={`sub-drag-${sub.id}`} draggable
                            onDragStart={(e) => handleSubDragStart(e, sub.id)}
                            onDragOver={(e) => handleSubDragOver(e, sub.id, 'additional')}
                            onDragEnd={() => setDraggedSubId(null)}
                            className={`flex flex-col p-3 bg-white rounded-xl border border-slate-251 transition-all hover:border-emerald-305 ${draggedSubId === sub.id ? 'opacity-40 bg-slate-100' : ''}`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-1.5 w-full mr-2 min-w-0">
                                <span className="text-slate-400 cursor-grab active:cursor-grabbing hover:text-emerald-610 px-0.5">
                                  <GripVertical className="w-3.5 h-3.5" />
                                </span>
                                <div className="flex items-center flex-shrink-0">
                                  <button type="button" onClick={() => moveSubjectItem(sub.id, 'up')} className="p-0.5 hover:bg-slate-100 rounded text-slate-500"><ChevronUp className="w-3 h-3" /></button>
                                  <button type="button" onClick={() => moveSubjectItem(sub.id, 'down')} className="p-0.5 hover:bg-slate-100 rounded text-slate-500"><ChevronDown className="w-3 h-3" /></button>
                                </div>
                                <input type="text" value={sub.name} onChange={(e) => handleModifySubjectName(sub.id, e.target.value)} className="bg-transparent border-b border-transparent focus:border-emerald-400 focus:bg-slate-50 px-1 py-0.5 font-bold text-slate-800 w-full text-xs focus:outline-none" />
                              </div>
                              
                              <div className="flex items-center gap-2 select-none flex-shrink-0">
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] font-black text-slate-400">TOTAL MAX:</span>
                                  <input type="number" min="5" max="300" value={sub.maxMarks || 100} onChange={(e) => handleUpdateSubjectMaxMarks(sub.id, parseInt(e.target.value, 10))} className="w-12 px-1 py-0.5 border text-center rounded text-xs font-bold bg-slate-50 focus:bg-white" />
                                </div>
                                <button type="button" onClick={() => handleRemoveSubjectFromStructure(sub.id)} className="p-1 hover:bg-rose-50 text-rose-500 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>

                            {/* Skill / Category Group input or dropdown */}
                            {enableSubjectGrouping ? (
                              <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-slate-100">
                                <div className="flex items-center justify-between">
                                  <span className="text-[9.5px] font-bold text-emerald-700 uppercase shrink-0 flex items-center gap-1">
                                    <FolderTree className="w-3 h-3 text-emerald-500" /> Group / Category:
                                  </span>
                                  {sub.group && (
                                    <span className="text-[9px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded">
                                      {sub.group}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <select
                                    value={sub.group || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setStructureSubjects(prev => prev.map(s => s.id === sub.id ? { ...s, group: val || undefined } : s));
                                    }}
                                    className="w-full text-xs font-semibold px-2 py-1 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:border-emerald-400 focus:outline-none"
                                  >
                                    <option value="">-- No Group (Ungrouped) --</option>
                                    {allAvailableGroups.map((grp) => (
                                      <option key={grp} value={grp}>{grp}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[9.5px] text-slate-400">
                                <span className="flex items-center gap-1"><FolderTree className="w-3 h-3 text-slate-400" /> Grouping:</span>
                                <span className="font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">Disabled</span>
                              </div>
                            )}

                            {/* Render custom column maximum marks if enabled */}
                            {subjectSpecificMaxMarksEnabled && structureScoreColumns.length > 0 && (
                              <div className="mt-2.5 pt-2.5 border-t border-dashed border-slate-200">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-[9.5px] uppercase font-extrabold text-amber-800">Custom Column Max Marks:</span>
                                  <span className="text-[8.5px] text-slate-400">Updates here apply only to {sub.name || 'this subject'}</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                  {structureScoreColumns.map((col) => {
                                    const customVal = sub.customMaxMarks?.[col.id] !== undefined ? sub.customMaxMarks[col.id] : col.maxMarks;
                                    return (
                                      <div key={col.id} className="flex flex-col gap-0.5 bg-amber-50/25 p-1 px-1.5 rounded-lg border border-amber-100">
                                        <span className="text-[9px] font-bold text-slate-600 truncate" title={col.name}>{col.name}</span>
                                        <div className="flex items-center gap-1 mt-0.5">
                                          <input 
                                            type="number" 
                                            min="0" 
                                            max="300" 
                                            value={customVal} 
                                            onChange={(e) => handleUpdateSubjectColumnMaxMarks(sub.id, col.id, parseInt(e.target.value, 10) || 0)} 
                                            className="w-full text-[10.5px] px-1 py-0.5 border text-center rounded font-extrabold text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-amber-500" 
                                          />
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="pt-2 border-t border-slate-200">
                        <span className="text-[9.5px] uppercase font-black text-slate-400 block mb-1">Toggle additions from master schema checklist:</span>
                        <div className="flex flex-wrap gap-1">
                          {subjects.filter(s => s.type === 'additional' && !structureSubjects.some(p => p.id === s.id)).map(sub => (
                            <button key={sub.id} type="button" onClick={() => handleToggleSubjectInStructure(sub)} className="px-2 py-0.5 bg-white hover:bg-slate-105 border rounded text-[10.5px] text-slate-705 font-bold">＋ {sub.name}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-2"><button type="button" onClick={() => markSectionCompletedAndNext('subjects', 'exams')} className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold">Save & Next</button></div>
                </div>
              )}
            </div>

            {/* ACCORDION 4: ASSESSMENT EXAMS & COLUMNS */}
            <div className="border-b">
              <button type="button" id="heading_exams" onClick={() => setActiveAccordion('exams')} className="w-full px-5 py-3.5 flex items-center justify-between bg-slate-50 hover:bg-slate-100 text-left">
                <span className="font-bold text-xs text-slate-800 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 border flex items-center justify-center text-[10px] font-bold">4</span>
                  Scholastic Assessment Exam Columns & Weights
                  {completedSections.includes('exams') && (
                    <span className="inline-flex items-center justify-center p-1 text-emerald-600 bg-emerald-50 rounded-full border border-emerald-250 ml-2" title="Completed">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </span>
                {activeAccordion === 'exams' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {activeAccordion === 'exams' && (() => {
                const activeCols = getActiveScoreColumns();
                return (
                <div className="p-5 space-y-4 animate-fadeIn">
                  {/* ARCHITECTURE TOGGLE: UNIFORM VS PER-TERM */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-indigo-600" />
                          Exam Weight Scheme Architecture
                        </span>
                        <p className="text-[10.5px] text-slate-500 mt-0.5">
                          Choose whether exam columns & max marks apply uniformly to all terms or are configured separately per term.
                        </p>
                      </div>
                      <div className="inline-flex rounded-xl bg-slate-200/80 p-1 shrink-0 self-start sm:self-auto">
                        <button
                          type="button"
                          onClick={() => setTermSpecificScoreColumnsEnabled(false)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${!termSpecificScoreColumnsEnabled ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                          Uniform Across Terms
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTermSpecificScoreColumnsEnabled(true);
                            if (term1ScoreColumns.length === 0) setTerm1ScoreColumns([...structureScoreColumns]);
                            if (term2ScoreColumns.length === 0) setTerm2ScoreColumns([...structureScoreColumns]);
                            if (term3ScoreColumns.length === 0) setTerm3ScoreColumns([...structureScoreColumns]);
                          }}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${termSpecificScoreColumnsEnabled ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                          Configure Each Term Separately
                        </button>
                      </div>
                    </div>

                    {termSpecificScoreColumnsEnabled && (
                      <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                        {/* Term Tabs */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedExamTermTab('term1')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${selectedExamTermTab === 'term1' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`}
                          >
                            <span>{structureBranding.term1Label || 'Term 1'}</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${selectedExamTermTab === 'term1' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                              {term1ScoreColumns.length} cols • {term1ScoreColumns.reduce((s, c) => s + (c.maxMarks || 0), 0)}M
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedExamTermTab('term2')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${selectedExamTermTab === 'term2' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`}
                          >
                            <span>{structureBranding.term2Label || 'Term 2'}</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${selectedExamTermTab === 'term2' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                              {term2ScoreColumns.length} cols • {term2ScoreColumns.reduce((s, c) => s + (c.maxMarks || 0), 0)}M
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedExamTermTab('term3')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${selectedExamTermTab === 'term3' ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`}
                          >
                            <span>{structureBranding.term3Label || 'Term 3'}</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${selectedExamTermTab === 'term3' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                              {term3ScoreColumns.length} cols • {term3ScoreColumns.reduce((s, c) => s + (c.maxMarks || 0), 0)}M
                            </span>
                          </button>
                        </div>

                        {/* Quick copy tools */}
                        <div className="flex flex-wrap items-center gap-1 text-[10.5px]">
                          <span className="text-slate-400 font-semibold">Copy:</span>
                          <button
                            type="button"
                            onClick={() => handleCopyColumnsToActiveTerm('uniform')}
                            className="px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-700 font-semibold cursor-pointer"
                            title="Copy default uniform score columns"
                          >
                            From Master
                          </button>
                          {selectedExamTermTab !== 'term1' && (
                            <button
                              type="button"
                              onClick={() => handleCopyColumnsToActiveTerm('term1')}
                              className="px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-200 rounded text-indigo-600 font-semibold cursor-pointer"
                              title="Copy all columns and weights from Term 1"
                            >
                              From Term 1
                            </button>
                          )}
                          {selectedExamTermTab !== 'term2' && (
                            <button
                              type="button"
                              onClick={() => handleCopyColumnsToActiveTerm('term2')}
                              className="px-2 py-0.5 bg-white hover:bg-slate-100 border border-slate-200 rounded text-indigo-600 font-semibold cursor-pointer"
                              title="Copy all columns and weights from Term 2"
                            >
                              From Term 2
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleCopyActiveTermToAll}
                            className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded text-indigo-700 font-bold cursor-pointer"
                            title="Duplicate current term columns to all other terms"
                          >
                            Apply Active Term to All
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-center pb-1">
                    <span className="text-[11px] text-slate-500 leading-relaxed block">
                      {termSpecificScoreColumnsEnabled ? (
                        <>Customizing exam columns for <strong className="text-indigo-600">{selectedExamTermTab === 'term1' ? (structureBranding.term1Label || 'Term 1') : selectedExamTermTab === 'term2' ? (structureBranding.term2Label || 'Term 2') : (structureBranding.term3Label || 'Term 3')}</strong>. Drag columns to re-sequence.</>
                      ) : (
                        <>Define the assessment sub-columns and weights (Theory, Oral, PT) that compile to make the scholastic term grade. Drag columns to re-sequence.</>
                      )}
                    </span>
                    <button type="button" onClick={handleAddCustomExamColumn} className="px-2.5 py-1 text-[11px] font-bold bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg flex items-center gap-1 cursor-pointer">＋ Add Exam Weight Column</button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {activeCols.map((col, idx) => {
                      const isMasterCopy = scoreColumns.some(c => c.id === col.id);
                      return (
                        <div
                          key={col.id} id={`col-drag-${col.id}`} draggable
                          onDragStart={(e) => handleColDragStart(e, col.id)}
                          onDragOver={(e) => handleColDragOver(e, col.id)}
                          onDragEnd={() => setDraggedColId(null)}
                          className={`flex items-center justify-between p-3 bg-white hover:border-indigo-305 border rounded-xl transition-all ${draggedColId === col.id ? 'opacity-40 bg-slate-50' : ''}`}
                        >
                          <div className="flex items-center gap-1.5 w-full mr-2 min-w-0">
                            <span className="text-slate-400 cursor-grab active:cursor-grabbing px-1">
                              <GripVertical className="w-3.5 h-3.5" />
                            </span>
                            <div className="flex items-center flex-shrink-0">
                              <button type="button" onClick={() => moveScoreColItem(idx, 'up')} className="p-0.5 hover:bg-slate-100 rounded text-slate-500 cursor-pointer"><ChevronUp className="w-3 h-3" /></button>
                              <button type="button" onClick={() => moveScoreColItem(idx, 'down')} className="p-0.5 hover:bg-slate-100 rounded text-slate-500 cursor-pointer"><ChevronDown className="w-3 h-3" /></button>
                            </div>
                            {isMasterCopy && !termSpecificScoreColumnsEnabled ? (
                              <span className="text-xs font-black text-slate-800 truncate">{col.name}</span>
                            ) : (
                              <input type="text" value={col.name} onChange={(e) => handleUpdateCustomExamColumnName(col.id, e.target.value)} className="text-xs font-extrabold text-indigo-600 border-b border-dashed focus:outline-none focus:bg-slate-50 px-1 py-0.5 w-full" />
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-black text-slate-400">MIN:</span>
                              <input 
                                type="number" 
                                min="0" 
                                max={col.maxMarks || 50} 
                                value={col.minMarks !== undefined ? col.minMarks : ''} 
                                placeholder={Math.round((col.maxMarks || 50) * 0.33).toString()}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                                  handleUpdateColumnMinMarks(col.id, val);
                                }} 
                                className="w-11 px-1 py-0.5 border text-center rounded text-xs font-bold font-sans bg-slate-50 focus:bg-white" 
                                title="Minimum / Pass Marks"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-black text-slate-400">MAX:</span>
                              <input type="number" min="1" max="500" value={col.maxMarks || 50} onChange={(e) => handleUpdateColumnMaxMarks(col.id, parseInt(e.target.value, 10))} className="w-12 px-1 py-0.5 border text-center rounded text-xs font-bold font-sans bg-slate-50 focus:bg-white" />
                            </div>
                            {(!isMasterCopy || termSpecificScoreColumnsEnabled) ? (
                              <button type="button" onClick={() => handleRemoveCustomExamColumn(col.id)} className="p-1 hover:bg-rose-50 text-rose-500 rounded cursor-pointer" title="Delete Column"><Trash2 className="w-3.5 h-3.5" /></button>
                            ) : (
                              <button type="button" onClick={() => handleToggleScoreColumnInStructure(col)} className="p-1 hover:bg-slate-100 rounded text-slate-400 cursor-pointer" title="Enable/Disable Column">✕</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Min Marks, Max Marks, Obtained Marks Layout Column Controls */}
                  <div className="p-4 bg-indigo-50/40 border border-indigo-100 rounded-2xl space-y-3">
                    <span className="text-xs font-black text-indigo-900 block uppercase tracking-wide">
                      📊 Min Marks, Max Marks & Marks Obtained Column Settings
                    </span>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Enable or disable independent columns for Minimum (Pass) Marks, Maximum Marks, and Marks Obtained in report card layouts, and customize their table header titles.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
                      {/* Min Marks Toggle & Header */}
                      <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <label htmlFor="toggle_min_marks" className="text-xs font-bold text-slate-800 cursor-pointer">
                            Show Min Marks Column
                          </label>
                          <input
                            type="checkbox"
                            id="toggle_min_marks"
                            checked={showMinMarksColumn}
                            onChange={(e) => setShowMinMarksColumn(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9.5px] font-bold text-slate-400 block uppercase">Header Title:</span>
                          <input
                            type="text"
                            value={minMarksHeaderLabel}
                            onChange={(e) => setMinMarksHeaderLabel(e.target.value)}
                            disabled={!showMinMarksColumn}
                            className="w-full text-xs font-bold border rounded-lg px-2 py-1 bg-slate-50 focus:bg-white disabled:opacity-40"
                            placeholder="Min Marks"
                          />
                        </div>
                      </div>

                      {/* Max Marks Toggle & Header */}
                      <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <label htmlFor="toggle_max_marks" className="text-xs font-bold text-slate-800 cursor-pointer">
                            Show Max Marks Column
                          </label>
                          <input
                            type="checkbox"
                            id="toggle_max_marks"
                            checked={showMaxMarksColumn}
                            onChange={(e) => setShowMaxMarksColumn(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9.5px] font-bold text-slate-400 block uppercase">Header Title:</span>
                          <input
                            type="text"
                            value={maxMarksHeaderLabel}
                            onChange={(e) => setMaxMarksHeaderLabel(e.target.value)}
                            disabled={!showMaxMarksColumn}
                            className="w-full text-xs font-bold border rounded-lg px-2 py-1 bg-slate-50 focus:bg-white disabled:opacity-40"
                            placeholder="Max Marks"
                          />
                        </div>
                      </div>

                      {/* Marks Obtained Toggle & Header */}
                      <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <label htmlFor="toggle_obtained_marks" className="text-xs font-bold text-slate-800 cursor-pointer">
                            Show Marks Obtained Column
                          </label>
                          <input
                            type="checkbox"
                            id="toggle_obtained_marks"
                            checked={showObtainedMarksColumn}
                            onChange={(e) => setShowObtainedMarksColumn(e.target.checked)}
                            className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9.5px] font-bold text-slate-400 block uppercase">Header Title:</span>
                          <input
                            type="text"
                            value={obtainedMarksHeaderLabel}
                            onChange={(e) => setObtainedMarksHeaderLabel(e.target.value)}
                            disabled={!showObtainedMarksColumn}
                            className="w-full text-xs font-bold border rounded-lg px-2 py-1 bg-slate-50 focus:bg-white disabled:opacity-40"
                            placeholder="Marks Obtained"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Landscape Mode for Marks Headings Toggle */}
                    <div className="p-3 bg-white border border-indigo-200/60 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 mt-2">
                      <div className="space-y-0.5">
                        <span className="text-xs font-extrabold text-slate-800 block font-sans">Orientation for Marks Headings</span>
                        <p className="text-[10.5px] text-slate-400 font-sans">If enabled, Min Marks, Max Marks, and Marks Obtained headings render in landscape (horizontal) orientation for maximum clarity. Preserves exact capital and small letter casing as typed.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                        <input 
                          type="checkbox" 
                          checked={landscapeMarksHeaders} 
                          onChange={(e) => setLandscapeMarksHeaders(e.target.checked)} 
                          className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        <span className="ml-3 text-xs font-bold text-slate-700 font-mono">
                          {landscapeMarksHeaders ? 'Landscape Mode' : 'Vertical Mode'}
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-[9.5px] uppercase font-black text-slate-405 block mb-1">Standard layouts score column checklists:</span>
                    <div className="flex flex-wrap gap-1">
                      {scoreColumns.filter(c => !activeCols.some(p => p.id === c.id)).map(col => (
                        <button key={col.id} type="button" onClick={() => handleToggleScoreColumnInStructure(col)} className="px-2 py-0.5 bg-white hover:bg-slate-105 border rounded text-[10.5px] text-slate-700 font-bold cursor-pointer">＋ Enable {col.name}</button>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end pt-2"><button type="button" onClick={() => markSectionCompletedAndNext('exams', 'terms')} className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold">Save & Next</button></div>
                </div>
                );
              })()}
            </div>

            {/* ACCORDION 5: ACTIVE TERMS & DRAGGABLE CUSTOM PROFILE DETAILS */}
            <div className="border-b">
              <button type="button" id="heading_terms" onClick={() => setActiveAccordion('terms')} className="w-full px-5 py-3.5 flex items-center justify-between bg-slate-50 hover:bg-slate-100 text-left">
                <span className="font-bold text-xs text-slate-800 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 border flex items-center justify-center text-[10px] font-bold">5</span>
                  Active Academic Terms & Draggable Student Profile Fields
                  {completedSections.includes('terms') && (
                    <span className="inline-flex items-center justify-center p-1 text-emerald-600 bg-emerald-50 rounded-full border border-emerald-250 ml-2" title="Completed">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </span>
                {activeAccordion === 'terms' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {activeAccordion === 'terms' && (
                <div className="p-5 space-y-5 animate-fadeIn">
                  
                  {/* Target assessment terms checkboxes */}
                  <div className="space-y-2 p-4 bg-slate-50 border rounded-2xl">
                    <span className="text-[10px] uppercase font-extrabold text-slate-500 block mb-1">Enabled Terms for layout template:</span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="p-2.5 bg-white rounded-xl border space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">Term I (T1)</span>
                          <input type="checkbox" checked={structureBranding.term1Enabled !== false} onChange={(e) => handleBrandingFieldChange('term1Enabled', e.target.checked)} className="w-4 h-4 text-indigo-605 cursor-pointer animate-pulse" />
                        </div>
                        <input type="text" value={structureBranding.term1Label || 'Term I'} onChange={(e) => handleBrandingFieldChange('term1Label', e.target.value)} disabled={structureBranding.term1Enabled === false} className="w-full text-xs border rounded-lg px-2 py-1 text-slate-700 disabled:opacity-40" />
                        <div className="pt-1.5 flex items-center gap-1.5 border-t border-slate-100">
                          <input 
                            type="checkbox" 
                            id="scholasticT1Toggle"
                            checked={!scholasticTerm1Disabled} 
                            onChange={(e) => setScholasticTerm1Disabled(!e.target.checked)} 
                            disabled={structureBranding.term1Enabled === false}
                            className="w-3.5 h-3.5 text-indigo-600 rounded cursor-pointer disabled:opacity-30" 
                          />
                          <label htmlFor="scholasticT1Toggle" className="text-[10px] text-slate-600 font-black cursor-pointer disabled:opacity-30">
                            Enable Scholastic Table
                          </label>
                        </div>
                      </div>
                      <div className="p-2.5 bg-white rounded-xl border space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">Term II (T2)</span>
                          <input type="checkbox" checked={structureBranding.term2Enabled !== false} onChange={(e) => handleBrandingFieldChange('term2Enabled', e.target.checked)} className="w-4 h-4 text-indigo-610 cursor-pointer animate-pulse" />
                        </div>
                        <input type="text" value={structureBranding.term2Label || 'Term II'} onChange={(e) => handleBrandingFieldChange('term2Label', e.target.value)} disabled={structureBranding.term2Enabled === false} className="w-full text-xs border rounded-lg px-2 py-1 text-slate-700 disabled:opacity-40" />
                        <div className="pt-1.5 flex items-center gap-1.5 border-t border-slate-100">
                          <input 
                            type="checkbox" 
                            id="scholasticT2Toggle"
                            checked={!scholasticTerm2Disabled} 
                            onChange={(e) => setScholasticTerm2Disabled(!e.target.checked)} 
                            disabled={structureBranding.term2Enabled === false}
                            className="w-3.5 h-3.5 text-indigo-600 rounded cursor-pointer disabled:opacity-30" 
                          />
                          <label htmlFor="scholasticT2Toggle" className="text-[10px] text-slate-600 font-black cursor-pointer disabled:opacity-30">
                            Enable Scholastic Table
                          </label>
                        </div>
                      </div>
                      <div className="p-2.5 bg-white rounded-xl border space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold">Term III (T3-TriTerm)</span>
                          <input type="checkbox" checked={structureBranding.term3Enabled === true} onChange={(e) => handleBrandingFieldChange('term3Enabled', e.target.checked)} className="w-4 h-4 text-indigo-610 cursor-pointer" />
                        </div>
                        <input type="text" value={structureBranding.term3Label || 'Term III'} onChange={(e) => handleBrandingFieldChange('term3Label', e.target.value)} disabled={!structureBranding.term3Enabled} className="w-full text-xs border rounded-lg px-2 py-1 text-slate-700 disabled:opacity-40" />
                        <div className="pt-1.5 flex items-center gap-1.5 border-t border-slate-100">
                          <input 
                            type="checkbox" 
                            id="scholasticT3Toggle"
                            checked={!scholasticTerm3Disabled} 
                            onChange={(e) => setScholasticTerm3Disabled(!e.target.checked)} 
                            disabled={!structureBranding.term3Enabled}
                            className="w-3.5 h-3.5 text-indigo-600 rounded cursor-pointer disabled:opacity-30" 
                          />
                          <label htmlFor="scholasticT3Toggle" className="text-[10px] text-slate-600 font-black cursor-pointer disabled:opacity-30">
                            Enable Scholastic Table
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CUSTOM PROFILE FIELD DRAGGABLE LIST */}
                  <div className="space-y-3">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-slate-750 block">Draggable & Editable Student Profile Fields</span>
                      <p className="text-[10.5px] text-slate-400">Reorder fields using drag handle or arrows. Edit name value placeholders or delete custom fields directly. Missing keys will fall back to "N/A" in PDF preview.</p>
                    </div>

                    <div className="p-4 bg-slate-50 border rounded-2xl space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[460px] overflow-y-auto pr-1">
                        {(structureBranding.studentFields || []).map((field, idx) => (
                          <div
                            key={field.id} id={`field-drag-${field.id}`} draggable
                            onDragStart={(e) => handleFieldDragStart(e, field.id)}
                            onDragOver={(e) => handleFieldDragOver(e, field.id)}
                            onDragEnd={() => setDraggedFieldId(null)}
                            className={`flex flex-col p-3 bg-white border rounded-xl hover:border-indigo-300 transition-all shadow-xs space-y-2.5 ${draggedFieldId === field.id ? 'opacity-40 bg-indigo-50 border-indigo-200' : ''}`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 w-full mr-2 min-w-0">
                                <span className="text-slate-400 cursor-grab active:cursor-grabbing px-1">
                                  <GripVertical className="w-3.5 h-3.5" />
                                </span>
                                <div className="flex items-center flex-shrink-0">
                                  <button type="button" onClick={() => moveFieldItem(idx, 'up')} className="p-0.5 hover:bg-slate-100 rounded text-slate-450" title="Move up"><ChevronUp className="w-3.5 h-3.5" /></button>
                                  <button type="button" onClick={() => moveFieldItem(idx, 'down')} className="p-0.5 hover:bg-slate-100 rounded text-slate-450" title="Move down"><ChevronDown className="w-3.5 h-3.5" /></button>
                                </div>
                                <div className="flex flex-col w-full min-w-0">
                                  <span className="text-[9px] uppercase font-bold text-indigo-600 truncate">Field Identifier: {field.id}</span>
                                  <input type="text" value={field.label} onChange={(e) => handleEditFieldLabel(field.id, e.target.value)} className="w-full text-xs font-bold text-slate-800 bg-transparent border-b border-dashed border-slate-200 focus:border-indigo-500 px-1 py-0.5 focus:outline-none" />
                                </div>
                              </div>
                              <button type="button" onClick={() => handleDeleteField(field.id)} className="p-1 hover:bg-rose-50 text-rose-500 rounded flex-shrink-0" title="Delete Profile field"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>

                            {/* Enable/Disable controls for each class or all classes together */}
                            <div className="pt-2 border-t border-slate-100 space-y-2 text-[10.5px]">
                              {/* Global status toggle */}
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-slate-500">Global Activation:</span>
                                <label className="inline-flex items-center cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    checked={field.disabled !== true} 
                                    onChange={(e) => {
                                      const updated = (structureBranding.studentFields || []).map(f => 
                                        f.id === field.id ? { ...f, disabled: !e.target.checked } : f
                                      );
                                      handleBrandingFieldChange('studentFields', updated);
                                    }}
                                    className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                                  />
                                  <span className="ml-1 text-[10px] font-bold text-slate-700">
                                    {field.disabled === true ? "🚫 Off (All Classes)" : "✅ On (All Classes)"}
                                  </span>
                                </label>
                              </div>

                              {/* Class specific overrides if not globally disabled */}
                              {field.disabled !== true && uniqueStudentClasses.length > 0 && (
                                <div className="space-y-1">
                                  <span className="font-semibold text-slate-500 block">Class-Specific Toggles (click to switch):</span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {uniqueStudentClasses.map(cls => {
                                      const isRestricted = field.disabledClasses?.includes(cls);
                                      return (
                                        <button
                                          key={cls}
                                          type="button"
                                          onClick={() => {
                                            const disabledClasses = field.disabledClasses || [];
                                            const updatedClasses = isRestricted 
                                              ? disabledClasses.filter(c => c !== cls) 
                                              : [...disabledClasses, cls];
                                            const updated = (structureBranding.studentFields || []).map(f => 
                                              f.id === field.id ? { ...f, disabledClasses: updatedClasses } : f
                                            );
                                            handleBrandingFieldChange('studentFields', updated);
                                          }}
                                          className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold border transition-colors ${isRestricted ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100' : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'}`}
                                          title={isRestricted ? `Enable for ${cls}` : `Disable for ${cls}`}
                                        >
                                          {cls}: {isRestricted ? "🚫 Off" : "✅ On"}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="pt-2 border-t flex items-center gap-2">
                        <input type="text" value={newFieldNameInput} onChange={(e) => setNewFieldNameInput(e.target.value)} placeholder="Type new label, e.g. Roll No, Blood Group, Aadhaar Header..." className="flex-grow px-3 py-1.5 border leading-tight text-xs rounded-xl focus:outline-none" />
                        <button type="button" onClick={handleAddCustomField} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 font-bold text-white text-xs rounded-xl flex-shrink-0">＋ Add Parameter</button>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2"><button type="button" onClick={() => markSectionCompletedAndNext('terms', 'grades')} className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold">Save & Next</button></div>
                </div>
              )}
            </div>

            {/* ACCORDION 6: DRAGGABLE GRADING SCALE */}
            <div className="border-b-0">
              <button type="button" id="heading_grades" onClick={() => setActiveAccordion('grades')} className="w-full px-5 py-3.5 flex items-center justify-between bg-slate-50 hover:bg-slate-100 text-left">
                <span className="font-bold text-xs text-slate-800 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 border flex items-center justify-center text-[10px] font-bold">6</span>
                  Grading Tiers Range Scales Limits
                  {completedSections.includes('grades') && (
                    <span className="inline-flex items-center justify-center p-1 text-emerald-600 bg-emerald-50 rounded-full border border-emerald-250 ml-2" title="Completed">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </span>
                {activeAccordion === 'grades' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {activeAccordion === 'grades' && (
                <div className="p-5 space-y-4 animate-fadeIn">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-slate-415 block">Set custom percentage limits to grade terms. Reorder grades sequence priority by dragging or clicking chevrons.</span>
                    <button type="button" onClick={handleAddGradeScale} className="px-2.5 py-1 text-xs bg-indigo-50 hover:bg-indigo-150 border rounded font-black text-indigo-700">＋ Add Grade Tier</button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl">
                    {structureGradeScales.map((item, idx) => (
                      <div
                        key={idx} id={`grade-drag-${idx}`} draggable
                        onDragStart={(e) => handleGradeDragStart(e, idx)}
                        onDragOver={(e) => handleGradeDragOver(e, idx)}
                        onDragEnd={() => setDraggedGradeIdx(null)}
                        className={`flex items-center justify-between p-2.5 bg-white border rounded-xl hover:border-indigo-400 transition-all ${draggedGradeIdx === idx ? 'opacity-40 bg-indigo-55' : ''}`}
                      >
                        <div className="space-y-1.5 w-full mr-2">
                          <div className="flex justify-between items-center text-[10px] uppercase font-black text-slate-400">
                            <div className="flex items-center gap-1">
                              <span className="text-slate-400 cursor-grab active:cursor-grabbing px-1.5">
                                <GripVertical className="w-3.5 h-3.5" />
                              </span>
                              <button type="button" onClick={() => moveGradeScaleItem(idx, 'up')} className="text-slate-500"><ChevronUp className="w-3.5 h-3.5" /></button>
                              <button type="button" onClick={() => moveGradeScaleItem(idx, 'down')} className="text-slate-500"><ChevronDown className="w-3.5 h-3.5" /></button>
                            </div>
                            <span>Tier #{idx+1}</span>
                          </div>
                          
                          <input type="text" value={item.grade} onChange={(e) => handleUpdateGradeScaleItem(idx, 'grade', e.target.value)} className="w-full text-xs font-sans font-black border rounded px-2 py-1 text-indigo-610 text-center" />
                          <div className="grid grid-cols-2 gap-1 text-[9px] font-extrabold text-slate-455 text-center">
                            <div>
                              <span>Min %</span>
                              <input type="number" value={item.minPercent} onChange={(e) => handleUpdateGradeScaleItem(idx, 'minPercent', e.target.value)} className="w-full text-center border rounded px-1" />
                            </div>
                            <div>
                              <span>Max %</span>
                              <input type="number" value={item.maxPercent} onChange={(e) => handleUpdateGradeScaleItem(idx, 'maxPercent', e.target.value)} className="w-full text-center border rounded px-1" />
                            </div>
                          </div>
                        </div>

                        <button type="button" onClick={() => handleRemoveGradeScaleIndex(idx)} className="p-1 hover:bg-rose-50 text-rose-500 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>

                  {/* CO-SCHOLASTIC GRADING SCALE CONFIGURATION */}
                  <div className="pt-4 border-t space-y-4">
                    <div className="flex justify-between items-center animate-fadeIn">
                      <div className="space-y-0.5">
                        <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1">
                          📊 Co-Scholastic Grading Scale Config
                        </span>
                        <p className="text-[10.5px] text-slate-400">Configure the single custom grading scale printed on the report card for co-scholastic domains / physical education / traits.</p>
                      </div>
                      <button type="button" onClick={handleAddCoGradeScale} className="px-2.5 py-1 text-xs bg-indigo-50 hover:bg-indigo-150 border rounded font-black text-indigo-700">＋ Add Co-Scholastic Grade</button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl">
                      {structureCoGradeScales.map((item, idx) => (
                        <div
                          key={`co_grade_${idx}`}
                          className="flex items-center justify-between p-2.5 bg-white border rounded-xl hover:border-indigo-400 transition-all animate-fadeIn"
                        >
                          <div className="space-y-1.5 w-full mr-2">
                            <div className="flex justify-between items-center text-[10px] uppercase font-black text-slate-400">
                              <span>Tier #{idx+1}</span>
                            </div>
                            
                            <div className="space-y-1">
                              <div>
                                <span className="text-[9px] font-bold text-slate-500 block">Grade Code/Score</span>
                                <input type="text" value={item.score} onChange={(e) => handleUpdateCoGradeScaleItem(idx, 'score', e.target.value)} className="w-full text-xs font-sans font-black border rounded px-2 py-1 text-indigo-610 text-center" />
                              </div>
                              <div>
                                <span className="text-[9px] font-bold text-slate-500 block">Description / Meaning</span>
                                <input type="text" value={item.description} onChange={(e) => handleUpdateCoGradeScaleItem(idx, 'description', e.target.value)} className="w-full border rounded px-1.5 py-1 text-xs text-slate-700" />
                              </div>
                            </div>
                          </div>

                          <button type="button" onClick={() => handleRemoveCoGradeScaleIdx(idx)} className="p-1 hover:bg-rose-50 text-rose-500 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  </div>

                   <div className="flex justify-end pt-2">
                    <button type="button" onClick={() => markSectionCompletedAndNext('grades', 'custom_addons')} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-black flex items-center gap-1.5">
                      <Check className="w-4 h-4" /> Save & Next
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ACCORDION 7: CUSTOM CO-SCHOLASTIC & SIGNATURE WORKSPACE */}
            <div className="border-b">
              <button type="button" id="heading_custom_addons" onClick={() => setActiveAccordion('custom_addons')} className="w-full px-5 py-3.5 flex items-center justify-between bg-slate-50 hover:bg-slate-100 text-left">
                <span className="font-bold text-xs text-slate-800 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 border flex items-center justify-center text-[10px] font-bold">7</span>
                  Custom Scholastic Parts, signature, Footer Layout
                  {completedSections.includes('custom_addons') && (
                    <span className="inline-flex items-center justify-center p-1 text-emerald-600 bg-emerald-50 rounded-full border border-emerald-250 ml-2" title="Completed">
                      <Check className="w-3 h-3" />
                    </span>
                  )}
                </span>
                {activeAccordion === 'custom_addons' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {activeAccordion === 'custom_addons' && (
                <div className="p-5 space-y-6 animate-fadeIn">
                  
                  {/* CO-SCHOLASTIC SECTIONS */}
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <span className="text-xs font-black text-slate-800 block">Custom Scholastic & Co-Scholastic Parts</span>
                        <p className="text-[10.5px] text-slate-400">Add or remove custom scholastic parts as needed. Customize terms, layout options, and add/remove individual items.</p>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => {
                          const newId = `coschol_${Date.now()}`;
                          setCoScholasticSections(prev => [
                            ...prev, 
                            { 
                              id: newId, 
                              title: 'Part B: Health & Physical Education', 
                              subjectHeader: 'Activity Area', 
                              gradingScaleText: '3-Point Scale', 
                              term1Enabled: true, 
                              term2Enabled: true,
                              term3Enabled: true,
                              type: 'custom'
                            }
                          ]);
                        }} 
                        className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold border rounded-lg flex-shrink-0"
                      >
                        ＋ Add Scholastic Part
                      </button>
                    </div>

                    {/* CO-SCHOLASTIC LAYOUT TWEAKS */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-3.5 bg-indigo-50/40 rounded-2xl border border-indigo-100/70">
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          id="coScholasticOneColumnToggle"
                          checked={coScholasticOneColumn}
                          onChange={(e) => setCoScholasticOneColumn(e.target.checked)}
                          className="w-4 h-4 mt-0.5 text-indigo-600 rounded border-slate-350 cursor-pointer"
                        />
                        <div>
                          <label htmlFor="coScholasticOneColumnToggle" className="text-xs font-black text-slate-800 cursor-pointer select-none">
                            Keep Co-Scholastic Parts stacked vertically? (One Above Other)
                          </label>
                          <p className="text-[10px] text-slate-500 font-medium">When checked, co-scholastic sections display one below the other (single-column). Keep unchecked to show sections side-by-side (two columns if room allows).</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {coScholasticSections.map((section, idx) => (
                        <div key={section.id} className="p-4 bg-slate-50 border rounded-2xl relative space-y-3">
                          <div className="flex items-start justify-between">
                            <span className="text-[10px] uppercase font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border">
                              Part #{idx + 1} ({section.type === 'custom' ? 'Custom Added' : 'Standard Core'})
                            </span>
                            <button 
                              type="button" 
                              onClick={() => {
                                setCoScholasticSections(prev => prev.filter(s => s.id !== section.id));
                              }}
                              className="p-1 hover:bg-rose-50 text-rose-500 rounded" 
                              title="Delete scholastic part"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <span className="text-[10px] uppercase font-black text-slate-400">Section Header Title</span>
                              <input 
                                type="text" 
                                value={section.title} 
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setCoScholasticSections(prev => prev.map(s => s.id === section.id ? { ...s, title: val } : s));
                                }}
                                className="w-full text-xs font-black border rounded-lg p-2 bg-white" 
                              />
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] uppercase font-black text-slate-400">Subject/Trait Title Header</span>
                              <input 
                                type="text" 
                                value={section.subjectHeader} 
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setCoScholasticSections(prev => prev.map(s => s.id === section.id ? { ...s, subjectHeader: val } : s));
                                }}
                                className="w-full text-xs font-black border rounded-lg p-2 bg-white" 
                              />
                            </div>
                            <div className="space-y-1">
                              <span className="text-[10px] uppercase font-black text-slate-400">Grading Scale Display Text</span>
                              <input 
                                type="text" 
                                value={section.gradingScaleText} 
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setCoScholasticSections(prev => prev.map(s => s.id === section.id ? { ...s, gradingScaleText: val } : s));
                                }}
                                className="w-full text-xs font-black border rounded-lg p-2 bg-white" 
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-4 pt-1 text-xs">
                            <div className="flex items-center gap-1.5">
                              <input 
                                type="checkbox" 
                                id={`t1_en_${section.id}`} 
                                checked={section.term1Enabled !== false} 
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setCoScholasticSections(prev => prev.map(s => s.id === section.id ? { ...s, term1Enabled: checked } : s));
                                }}
                                className="w-4 h-4 text-indigo-650 cursor-pointer rounded" 
                              />
                              <label htmlFor={`t1_en_${section.id}`} className="font-bold text-slate-700 cursor-pointer select-none">
                                Enable in Term I Column
                              </label>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <input 
                                type="checkbox" 
                                id={`t2_en_${section.id}`} 
                                checked={section.term2Enabled !== false} 
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setCoScholasticSections(prev => prev.map(s => s.id === section.id ? { ...s, term2Enabled: checked } : s));
                                }}
                                className="w-4 h-4 text-indigo-650 cursor-pointer rounded" 
                              />
                              <label htmlFor={`t2_en_${section.id}`} className="font-bold text-slate-700 cursor-pointer select-none">
                                Enable in Term II Column
                              </label>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <input 
                                type="checkbox" 
                                id={`t3_en_${section.id}`} 
                                checked={section.term3Enabled !== false} 
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setCoScholasticSections(prev => prev.map(s => s.id === section.id ? { ...s, term3Enabled: checked } : s));
                                }}
                                className="w-4 h-4 text-indigo-650 cursor-pointer rounded" 
                              />
                              <label htmlFor={`t3_en_${section.id}`} className="font-bold text-slate-700 cursor-pointer select-none">
                                Enable in Term III Column
                              </label>
                            </div>
                          </div>

                          {/* List & Add items for this section/part */}
                          <div className="pt-2 border-t border-slate-200 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase font-bold text-slate-500 block">Traits / Items inside this Part</span>
                              <button 
                                type="button" 
                                onClick={() => handleAddItemToPart(section.id, section.type)} 
                                className="px-2 py-0.5 text-[10px] bg-white hover:bg-slate-50 text-indigo-700 rounded border border-indigo-200 font-bold"
                              >
                                ＋ Add Trait/Activity Item
                              </button>
                            </div>
                            
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                              {structureSubjects.filter(sub => 
                                sub.sectionId === section.id || 
                                (sub.type === section.type && (!sub.sectionId || sub.sectionId === section.id))
                              ).length === 0 ? (
                                <span className="text-[10px] italic text-slate-400 block pt-0.5">No items configured in this part yet. Click 'Add Trait/Activity Item' above to start adding!</span>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {structureSubjects.filter(sub => 
                                    sub.sectionId === section.id || 
                                    (sub.type === section.type && (!sub.sectionId || sub.sectionId === section.id))
                                  ).map((sub) => (
                                    <div key={sub.id} className="flex items-center justify-between p-1.5 bg-white border border-slate-200 rounded-lg text-xs hover:border-slate-300">
                                      <div className="flex items-center gap-1.5 w-full min-w-0 mr-1">
                                        <div className="flex items-center flex-shrink-0">
                                          <button 
                                            type="button" 
                                            onClick={() => moveSubjectItem(sub.id, 'up')} 
                                            className="p-0.5 hover:bg-slate-100 rounded text-slate-500"
                                          >
                                            <ChevronUp className="w-3 h-3" />
                                          </button>
                                          <button 
                                            type="button" 
                                            onClick={() => moveSubjectItem(sub.id, 'down')} 
                                            className="p-0.5 hover:bg-slate-100 rounded text-slate-500"
                                          >
                                            <ChevronDown className="w-3 h-3" />
                                          </button>
                                        </div>
                                        <input 
                                          type="text" 
                                          value={sub.name} 
                                          onChange={(e) => handleModifySubjectName(sub.id, e.target.value)} 
                                          className="bg-transparent border-b border-transparent focus:border-indigo-400 focus:bg-slate-50 font-bold text-slate-800 w-full text-[11px] focus:outline-none" 
                                        />
                                      </div>
                                      <button 
                                        type="button" 
                                        onClick={() => handleRemoveSubjectFromStructure(sub.id)} 
                                        className="p-0.5 hover:bg-rose-50 text-rose-500 rounded flex-shrink-0"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>


                  {/* SIGNATURE CONFIGURATION AREA */}
                  <div className="space-y-3 pt-3 border-t">
                    <div className="flex justify-between items-center gap-2">
                      <div>
                        <span className="text-xs font-black text-slate-800 block">Custom Certificate Signature Rows</span>
                        <p className="text-[10.5px] text-slate-400">Establish dynamic signature placeholders. Add/delete space and customize names.</p>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => {
                          const newId = `sig_${Date.now()}`;
                          setSignatures(prev => [...prev, { id: newId, label: 'Authorized Officer Signature' }]);
                        }} 
                        className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-bold border rounded-lg flex-shrink-0"
                      >
                        ＋ Add Signature Space
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl">
                      {signatures.map((sig, idx) => (
                        <div key={sig.id} className="p-3 bg-white border rounded-xl flex items-center justify-between gap-2 max-w-full">
                          <div className="w-full">
                            <span className="block text-[8px] uppercase font-extrabold text-indigo-500">Sign #{idx + 1} Label</span>
                            <input 
                              type="text" 
                              value={sig.label} 
                              onChange={(e) => {
                                const val = e.target.value;
                                setSignatures(prev => prev.map(s => s.id === sig.id ? { ...s, label: val } : s));
                              }}
                              className="w-full text-xs font-bold border-b border-dashed focus:outline-none focus:border-indigo-500 py-0.5" 
                            />
                          </div>
                          <button 
                            type="button" 
                            onClick={() => {
                              setSignatures(prev => prev.filter(s => s.id !== sig.id));
                            }}
                            className="p-1 hover:bg-rose-50 text-rose-500 rounded flex-shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* BOTTOM GRADING RULE BLOCK CONTROL ABOVE SIGNATURE */}
                  <div className="space-y-3 pt-4 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-indigo-50/50 p-4 rounded-2xl">
                    <div className="space-y-0.5">
                      <span className="text-xs font-extrabold text-slate-800 block">Enable/Disable Grading Scale Columns</span>
                      <p className="text-[10.5px] text-slate-400">Decide if you want to display or completely hide the scholastic points scale criteria legend above the bottom signature panel.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={!hideGradingScale} 
                        onChange={(e) => setHideGradingScale(!e.target.checked)} 
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      <span className="ml-3 text-xs font-bold text-slate-700">
                        {hideGradingScale ? 'Hidden' : 'Visible'}
                      </span>
                    </label>
                  </div>

                  {/* POSITION TOGGLE: GRADING SCALE AFTER SIGNATURES */}
                  {!hideGradingScale && (
                    <div className="space-y-3 pt-4 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-emerald-50/40 p-4 rounded-2xl border border-emerald-100/60">
                      <div className="space-y-0.5">
                        <span className="text-xs font-extrabold text-emerald-950 block">Show Grading Scale After Signatures Area</span>
                        <p className="text-[10.5px] text-emerald-800">Place both scholastic and co-scholastic scales after signatures in micro-font sizes to optimize height spacing.</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer select-none">
                        <input 
                          type="checkbox" 
                          checked={gradingScaleAfterSignatures} 
                          onChange={(e) => setGradingScaleAfterSignatures(e.target.checked)} 
                          className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        <span className="ml-3 text-xs font-black text-emerald-900 font-mono">
                          {gradingScaleAfterSignatures ? 'After Signatures' : 'Before Signatures'}
                        </span>
                      </label>
                    </div>
                  )}

                  {/* LAYOUT STYLE TOGGLE: GRADING SCALE LAYOUT STYLE */}
                  {!hideGradingScale && (
                    <div className="space-y-3 pt-4 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-violet-50/40 p-4 rounded-2xl border border-violet-100/60">
                      <div className="space-y-0.5">
                        <span className="text-xs font-extrabold text-violet-950 block">Grading Scale Layout Style</span>
                        <p className="text-[10.5px] text-violet-800">Choose whether to display scholastic and co-scholastic scales side by side or stacked above one another in full-width.</p>
                      </div>
                      <div className="flex bg-slate-150 rounded-xl p-0.5 border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setGradingScaleLayout('side-by-side')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${gradingScaleLayout === 'side-by-side' ? 'bg-white text-violet-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                          Side-by-Side
                        </button>
                        <button
                          type="button"
                          onClick={() => setGradingScaleLayout('stacked')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${gradingScaleLayout === 'stacked' ? 'bg-white text-violet-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                          Stacked (Full Width)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* BOTTOM CLASS ATTENDANCE TOGGLE ROW */}
                  <div className="space-y-3 pt-4 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-indigo-50/50 p-4 rounded-2xl">
                    <div className="space-y-0.5">
                      <span className="text-xs font-extrabold text-slate-800 block">Enable / Disable Class Attendance Area</span>
                      <p className="text-[10.5px] text-slate-400">Toggle this to show or hide the Working Attendance metric in the overall summary panel of the report card.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={!hideAttendance} 
                        onChange={(e) => setHideAttendance(!e.target.checked)} 
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      <span className="ml-3 text-xs font-bold text-slate-700">
                        {hideAttendance ? 'Hidden' : 'Visible'}
                      </span>
                    </label>
                  </div>

                  {/* BOTTOM PURE GRADE-BASED TOGGLE ROW */}
                  <div className="space-y-3 pt-4 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-indigo-50/50 p-4 rounded-2xl">
                    <div className="space-y-0.5">
                      <span className="text-xs font-extrabold text-slate-800 block">Purely Grade-Based Scholastic Criteria</span>
                      <p className="text-[10.5px] text-slate-400">If enabled, scholastic marks are hidden and only computed or entered grades (e.g. A1, B2) are shown in report card cells.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={pureGradeBased} 
                        onChange={(e) => setPureGradeBased(e.target.checked)} 
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      <span className="ml-3 text-xs font-bold text-slate-700 font-mono">
                        {pureGradeBased ? 'Grades Only (Enabled)' : 'Marks & Grades (Disabled)'}
                      </span>
                    </label>
                  </div>

                  {/* SUBJECT GROUPING CONFIGURATION (UNDER PURE GRADING SECTION) */}
                  <div className="space-y-4 pt-4 border-t bg-gradient-to-r from-violet-50/40 via-purple-50/30 to-indigo-50/40 p-4 rounded-2xl border border-violet-200/70">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <FolderTree className="w-4 h-4 text-violet-600" />
                          <span className="text-xs font-extrabold text-violet-950 block">Enable / Disable Subject Group Configurations</span>
                        </div>
                        <p className="text-[10.5px] text-slate-500 leading-relaxed">
                          Organize curriculum subjects into distinct skill domains/categories (e.g., Language & Literacy, Numeracy & Logic) with category header banners across the report card. Disable when you prefer a direct flat list of subjects.
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer select-none shrink-0">
                        <input 
                          type="checkbox" 
                          checked={enableSubjectGrouping} 
                          onChange={(e) => setEnableSubjectGrouping(e.target.checked)} 
                          className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                        <span className="ml-3 text-xs font-bold text-violet-900 font-mono">
                          {enableSubjectGrouping ? 'Grouping Active' : 'Grouping Disabled'}
                        </span>
                      </label>
                    </div>

                    {/* Group creation and management when grouping is enabled */}
                    {enableSubjectGrouping && (
                      <div className="mt-3 pt-3 border-t border-violet-100 space-y-3">
                        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                          <div className="relative flex-grow">
                            <input
                              type="text"
                              value={newGroupNameInput}
                              onChange={(e) => setNewGroupNameInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddCustomGroup();
                                }
                              }}
                              placeholder="Create new group (e.g. Cognitive Skills, Environmental Studies)..."
                              className="w-full text-xs px-3 py-2 border border-violet-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 font-medium placeholder:text-slate-400"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddCustomGroup()}
                            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Group</span>
                          </button>
                        </div>

                        {/* Quick Presets */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[10.5px]">
                          <span className="text-slate-400 font-bold uppercase text-[9px]">Quick Presets:</span>
                          <button
                            type="button"
                            onClick={() => {
                              const kindergartenPresets = ["Language & Literacy", "Numeracy & Logic", "General Awareness & Science", "Physical & Motor Growth", "Personal & Social Development"];
                              setCustomSubjectGroups(prev => [...new Set([...prev, ...kindergartenPresets])]);
                            }}
                            className="px-2 py-0.5 bg-white border border-violet-200 hover:border-violet-400 text-violet-700 rounded-lg font-semibold hover:bg-violet-50 transition"
                          >
                            ＋ Kindergarten / Pre-Primary
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const primaryPresets = ["Scholastic Core", "Languages", "Scientific Inquiry", "Visual & Performing Arts"];
                              setCustomSubjectGroups(prev => [...new Set([...prev, ...primaryPresets])]);
                            }}
                            className="px-2 py-0.5 bg-white border border-violet-200 hover:border-violet-400 text-violet-700 rounded-lg font-semibold hover:bg-violet-50 transition"
                          >
                            ＋ Primary Domains
                          </button>
                        </div>

                        {/* Active Groups Chips */}
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase">
                            <span>Active Group Registry ({customSubjectGroups.length}):</span>
                            <span className="text-violet-600 font-normal normal-case">Select these in subject cards</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {customSubjectGroups.map((grp) => (
                              <span
                                key={grp}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-violet-200 rounded-lg text-xs font-bold text-violet-900 shadow-xs"
                              >
                                <FolderTree className="w-3 h-3 text-violet-500 shrink-0" />
                                <span>{grp}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveCustomGroup(grp)}
                                  className="text-slate-400 hover:text-rose-600 p-0.5 hover:bg-rose-50 rounded"
                                  title={`Remove ${grp}`}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                            {customSubjectGroups.length === 0 && (
                              <span className="text-xs text-slate-400 italic">No custom groups created yet. Type a name above to add one.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* TERM TOTALS & LEVEL / GRADE VISIBILITY CONTROLS (UNDER PURE GRADING SECTION) */}
                  <div className="space-y-4 pt-4 border-t bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-indigo-600" />
                        <span className="text-xs font-extrabold text-slate-900 block">Term Totals & Term Levels / Grades Visibility Controls</span>
                      </div>
                      <p className="text-[10.5px] text-slate-500 leading-relaxed">
                        Customize whether Total Marks and Level/Grade columns appear for Term 1, Term 2, Term 3, and Overall Results. Perfect for pure grading layouts or when specific term totals/levels are unneeded.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                      {/* Term 1 Box */}
                      <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-3 shadow-xs">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                          <span className="text-xs font-black text-indigo-900">Term 1 (T1)</span>
                          <span className="text-[9px] px-1.5 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded">T1 Columns</span>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="flex items-center justify-between cursor-pointer select-none">
                            <span className="text-[11px] font-bold text-slate-700">T1 Total Marks</span>
                            <input
                              type="checkbox"
                              checked={!hideTerm1Total}
                              onChange={(e) => setHideTerm1Total(!e.target.checked)}
                              className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                            />
                          </label>
                          <p className="text-[9.5px] text-slate-400">{hideTerm1Total ? '❌ T1 Total Hidden' : '✓ T1 Total Visible'}</p>

                          <label className="flex items-center justify-between cursor-pointer select-none pt-1 border-t border-slate-100">
                            <span className="text-[11px] font-bold text-slate-700">Term 1 Level / Grade</span>
                            <input
                              type="checkbox"
                              checked={!hideTerm1Grade}
                              onChange={(e) => setHideTerm1Grade(!e.target.checked)}
                              className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                            />
                          </label>
                          <p className="text-[9.5px] text-slate-400">{hideTerm1Grade ? '❌ Term 1 Level Hidden' : '✓ Term 1 Level Visible'}</p>
                        </div>
                      </div>

                      {/* Term 2 Box */}
                      <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-3 shadow-xs">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                          <span className="text-xs font-black text-indigo-900">Term 2 (T2)</span>
                          <span className="text-[9px] px-1.5 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded">T2 Columns</span>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="flex items-center justify-between cursor-pointer select-none">
                            <span className="text-[11px] font-bold text-slate-700">T2 Total Marks</span>
                            <input
                              type="checkbox"
                              checked={!hideTerm2Total}
                              onChange={(e) => setHideTerm2Total(!e.target.checked)}
                              className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                            />
                          </label>
                          <p className="text-[9.5px] text-slate-400">{hideTerm2Total ? '❌ T2 Total Hidden' : '✓ T2 Total Visible'}</p>

                          <label className="flex items-center justify-between cursor-pointer select-none pt-1 border-t border-slate-100">
                            <span className="text-[11px] font-bold text-slate-700">Term 2 Level / Grade</span>
                            <input
                              type="checkbox"
                              checked={!hideTerm2Grade}
                              onChange={(e) => setHideTerm2Grade(!e.target.checked)}
                              className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                            />
                          </label>
                          <p className="text-[9.5px] text-slate-400">{hideTerm2Grade ? '❌ Term 2 Level Hidden' : '✓ Term 2 Level Visible'}</p>
                        </div>
                      </div>

                      {/* Term 3 Box */}
                      <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-3 shadow-xs">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                          <span className="text-xs font-black text-indigo-900">Term 3 (T3)</span>
                          <span className="text-[9px] px-1.5 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded">T3 Columns</span>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="flex items-center justify-between cursor-pointer select-none">
                            <span className="text-[11px] font-bold text-slate-700">T3 Total Marks</span>
                            <input
                              type="checkbox"
                              checked={!hideTerm3Total}
                              onChange={(e) => setHideTerm3Total(!e.target.checked)}
                              className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                            />
                          </label>
                          <p className="text-[9.5px] text-slate-400">{hideTerm3Total ? '❌ T3 Total Hidden' : '✓ T3 Total Visible'}</p>

                          <label className="flex items-center justify-between cursor-pointer select-none pt-1 border-t border-slate-100">
                            <span className="text-[11px] font-bold text-slate-700">Term 3 Level / Grade</span>
                            <input
                              type="checkbox"
                              checked={!hideTerm3Grade}
                              onChange={(e) => setHideTerm3Grade(!e.target.checked)}
                              className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                            />
                          </label>
                          <p className="text-[9.5px] text-slate-400">{hideTerm3Grade ? '❌ Term 3 Level Hidden' : '✓ Term 3 Level Visible'}</p>
                        </div>
                      </div>

                      {/* Overall Box */}
                      <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-3 shadow-xs">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                          <span className="text-xs font-black text-indigo-900">Overall Annual</span>
                          <span className="text-[9px] px-1.5 py-0.5 bg-purple-50 text-purple-700 font-bold rounded">Overall</span>
                        </div>
                        
                        <div className="space-y-2">
                          <label className="flex items-center justify-between cursor-pointer select-none">
                            <span className="text-[11px] font-bold text-slate-700">Overall Total Marks</span>
                            <input
                              type="checkbox"
                              checked={!hideOverallTotal}
                              onChange={(e) => setHideOverallTotal(!e.target.checked)}
                              className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                            />
                          </label>
                          <p className="text-[9.5px] text-slate-400">{hideOverallTotal ? '❌ Overall Total Hidden' : '✓ Overall Total Visible'}</p>

                          <label className="flex items-center justify-between cursor-pointer select-none pt-1 border-t border-slate-100">
                            <span className="text-[11px] font-bold text-slate-700">Overall Level / Grade</span>
                            <input
                              type="checkbox"
                              checked={!hideOverallGrade}
                              onChange={(e) => setHideOverallGrade(!e.target.checked)}
                              className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500"
                            />
                          </label>
                          <p className="text-[9.5px] text-slate-400">{hideOverallGrade ? '❌ Overall Level Hidden' : '✓ Overall Level Visible'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SUBJECT-SPECIFIC MAXIMUM MARKS (CUSTOM SCHEME PER SUBJECT) */}
                  <div className="space-y-3 pt-4 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-amber-50/50 p-4 rounded-2xl mt-3">
                    <div className="space-y-0.5">
                      <span className="text-xs font-extrabold text-amber-950 block">Custom Subject Marking Scheme (Subject-Specific Max Marks)</span>
                      <p className="text-[10.5px] text-amber-700 leading-relaxed">If enabled, you can customize the maximum marks for individual exam columns (like Periodic Test, NB, SE, Mid-Term, etc.) on a per-subject basis, showing them side-by-side (e.g., 8/10, 25/30).</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={subjectSpecificMaxMarksEnabled} 
                        onChange={(e) => setSubjectSpecificMaxMarksEnabled(e.target.checked)} 
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                      <span className="ml-3 text-xs font-bold text-amber-800 font-mono">
                        {subjectSpecificMaxMarksEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </label>
                  </div>

                  {/* VERTICAL EXAM HEADERS TOGGLE ROW */}
                  <div className="space-y-3 pt-4 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50 p-4 rounded-2xl mt-3">
                    <div className="space-y-0.5">
                      <span className="text-xs font-extrabold text-slate-800 block">Vertical Table Headers (Compact Layout)</span>
                      <p className="text-[10.5px] text-slate-400">If enabled, exam headings, totals, and grades (Periodic Test to Overall Grade row) are displayed vertically with center alignment. Keeps words fully visible without breaking.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={verticalExamHeaders} 
                        onChange={(e) => setVerticalExamHeaders(e.target.checked)} 
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      <span className="ml-3 text-xs font-bold text-slate-700 font-mono">
                        {verticalExamHeaders ? 'Vertical (Enabled)' : 'Horizontal (Disabled)'}
                      </span>
                    </label>
                  </div>

                  {/* VERTICAL SUBJECTS HEADER TOGGLE ROW */}
                  <div className="space-y-3 pt-4 border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50 p-4 rounded-2xl mt-3">
                    <div className="space-y-0.5">
                      <span className="text-xs font-extrabold text-slate-800 block">Vertical 'Subjects' Header</span>
                      <p className="text-[10.5px] text-slate-400">If enabled, the main 'Subjects' column header is also rotated and rendered vertically. Otherwise, it stays horizontal and centered.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input 
                        type="checkbox" 
                        checked={verticalSubjectsHeader} 
                        onChange={(e) => setVerticalSubjectsHeader(e.target.checked)} 
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      <span className="ml-3 text-xs font-bold text-slate-700 font-mono">
                        {verticalSubjectsHeader ? 'Vertical (Enabled)' : 'Horizontal (Disabled)'}
                      </span>
                    </label>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button type="button" onClick={() => markSectionCompletedAndNext('custom_addons', 'portal_visibility')} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-black flex items-center gap-1.5 shadow">
                      <Check className="w-4 h-4" /> Finalize Work & Save Green Ticks
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ACCORDION 8: Parents Portal Visibility Control */}
            <div className="border-t">
              <button
                type="button"
                onClick={() => setActiveAccordion(activeAccordion === 'portal_visibility' ? '' : 'portal_visibility')}
                className="w-full flex justify-between items-center p-4 sm:p-5 bg-slate-50/60 hover:bg-slate-50 transition text-left cursor-pointer select-none"
              >
                <span className="font-bold text-xs text-slate-800 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 border flex items-center justify-center text-[10px] font-bold">8</span>
                  🌐 Parents Portal Visibility Control (PTM Results Release)
                </span>
                {activeAccordion === 'portal_visibility' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {activeAccordion === 'portal_visibility' && (
                <div className="p-5 space-y-6 animate-fadeIn">
                  <div>
                    <span className="text-xs font-black text-slate-800 block">PTM Results Release &amp; Parents Portal Visibilities</span>
                    <p className="text-[10.5px] text-slate-400 leading-relaxed">
                      Configure which layout metrics and results are visible on the Parents Portal. This allows schools to hold results or release them on different days for different classes (e.g., LKG PTM vs Xth Board Results release).
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Toggle 1: Interactive Progress Dashboard */}
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-start gap-3 hover:border-indigo-200 hover:bg-white transition">
                      <input
                        id="structure_portal_analytics_toggle"
                        type="checkbox"
                        checked={structureBranding.parentPortalAnalyticsDisabled !== true}
                        onChange={(e) => setStructureBranding(prev => ({ ...prev, parentPortalAnalyticsDisabled: !e.target.checked }))}
                        className="w-4.5 h-4.5 text-indigo-600 border-slate-300 rounded focus:ring-2 focus:ring-indigo-500/20 mt-0.5 cursor-pointer"
                      />
                      <div className="space-y-0.5 cursor-pointer" onClick={() => setStructureBranding(prev => ({ ...prev, parentPortalAnalyticsDisabled: !prev.parentPortalAnalyticsDisabled }))}>
                        <label htmlFor="structure_portal_analytics_toggle" className="text-xs font-bold text-slate-850 cursor-pointer block">
                          Interactive Progress Dashboard
                        </label>
                        <p className="text-[10px] text-slate-500 leading-normal">
                          Displays student percentage metrics, grade bands, and dynamic performance charts.
                        </p>
                      </div>
                    </div>

                    {/* Toggle 2: Attendance statistics */}
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-start gap-3 hover:border-indigo-200 hover:bg-white transition">
                      <input
                        id="structure_portal_attendance_toggle"
                        type="checkbox"
                        checked={structureBranding.parentPortalAttendanceDisabled !== true}
                        onChange={(e) => setStructureBranding(prev => ({ ...prev, parentPortalAttendanceDisabled: !e.target.checked }))}
                        className="w-4.5 h-4.5 text-indigo-600 border-slate-300 rounded focus:ring-2 focus:ring-indigo-500/20 mt-0.5 cursor-pointer"
                      />
                      <div className="space-y-0.5 cursor-pointer" onClick={() => setStructureBranding(prev => ({ ...prev, parentPortalAttendanceDisabled: !prev.parentPortalAttendanceDisabled }))}>
                        <label htmlFor="structure_portal_attendance_toggle" className="text-xs font-bold text-slate-850 cursor-pointer block">
                          Attendance Percentage Gauge
                        </label>
                        <p className="text-[10px] text-slate-500 leading-normal">
                          Calculates and displays annual presents/total working days ratio as a colorful widget.
                        </p>
                      </div>
                    </div>

                    {/* Toggle 3: Rankings Comparison */}
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-start gap-3 hover:border-indigo-200 hover:bg-white transition">
                      <input
                        id="structure_portal_rank_toggle"
                        type="checkbox"
                        checked={structureBranding.parentPortalTopperStatsDisabled !== true}
                        onChange={(e) => setStructureBranding(prev => ({ ...prev, parentPortalTopperStatsDisabled: !e.target.checked }))}
                        className="w-4.5 h-4.5 text-indigo-600 border-slate-300 rounded focus:ring-2 focus:ring-indigo-500/20 mt-0.5 cursor-pointer"
                      />
                      <div className="space-y-0.5 cursor-pointer" onClick={() => setStructureBranding(prev => ({ ...prev, parentPortalTopperStatsDisabled: !prev.parentPortalTopperStatsDisabled }))}>
                        <label htmlFor="structure_portal_rank_toggle" className="text-xs font-bold text-slate-850 cursor-pointer block">
                          Class Comparative Benchmarks
                        </label>
                        <p className="text-[10px] text-slate-500 leading-normal">
                          Compares subject scores against class averages and highest mark boundaries on charts.
                        </p>
                      </div>
                    </div>

                    {/* Toggle 4: Remarks Box */}
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-start gap-3 hover:border-indigo-200 hover:bg-white transition">
                      <input
                        id="structure_portal_remarks_toggle"
                        type="checkbox"
                        checked={structureBranding.parentPortalRemarksDisabled !== true}
                        onChange={(e) => setStructureBranding(prev => ({ ...prev, parentPortalRemarksDisabled: !e.target.checked }))}
                        className="w-4.5 h-4.5 text-indigo-600 border-slate-300 rounded focus:ring-2 focus:ring-indigo-500/20 mt-0.5 cursor-pointer"
                      />
                      <div className="space-y-0.5 cursor-pointer" onClick={() => setStructureBranding(prev => ({ ...prev, parentPortalRemarksDisabled: !prev.parentPortalRemarksDisabled }))}>
                        <label htmlFor="structure_portal_remarks_toggle" className="text-xs font-bold text-slate-850 cursor-pointer block">
                          Remarks &amp; Promotion Box
                        </label>
                        <p className="text-[10.5px] text-slate-500 leading-normal">
                          Renders the subjective class teacher assessment remarks and standard promotion status badge.
                        </p>
                      </div>
                    </div>

                    {/* Toggle 5: Formal Printable PDF Card button */}
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-start gap-3 hover:border-indigo-200 hover:bg-white transition">
                      <input
                        id="structure_portal_reportcard_toggle"
                        type="checkbox"
                        checked={structureBranding.parentPortalReportCardDisabled !== true}
                        onChange={(e) => setStructureBranding(prev => ({ ...prev, parentPortalReportCardDisabled: !e.target.checked }))}
                        className="w-4.5 h-4.5 text-indigo-600 border-slate-300 rounded focus:ring-2 focus:ring-indigo-500/20 mt-0.5 cursor-pointer"
                      />
                      <div className="space-y-0.5 cursor-pointer" onClick={() => setStructureBranding(prev => ({ ...prev, parentPortalReportCardDisabled: !prev.parentPortalReportCardDisabled }))}>
                        <label htmlFor="structure_portal_reportcard_toggle" className="text-xs font-bold text-slate-850 cursor-pointer block">
                          Full Termly Report Card Viewer &amp; PDF Download
                        </label>
                        <p className="text-[10px] text-slate-500 leading-normal">
                          Renders the official formatted board template so parents can view or download the paper card.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Lock Screen Overrides */}
                  <div className="border-t border-slate-100 pt-4 mt-2 space-y-4">
                    <div>
                      <span className="text-xs font-black text-slate-800 block">Parents Portal Lock Screen Custom Overrides</span>
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        Specify custom lock screen messages for this specific group of classes. If left empty, the primary default messages configured by the School Admin will be used.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-black text-slate-500 block">Override Lock Title Text</label>
                        <input
                          type="text"
                          value={structureBranding.lockScreenTitle || ''}
                          onChange={(e) => setStructureBranding(prev => ({ ...prev, lockScreenTitle: e.target.value }))}
                          placeholder={branding.lockScreenTitle || "PTM Academic Results On Hold"}
                          className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-black text-slate-500 block">Override Lock Message Description</label>
                        <textarea
                          rows={2}
                          value={structureBranding.lockScreenDesc || ''}
                          onChange={(e) => setStructureBranding(prev => ({ ...prev, lockScreenDesc: e.target.value }))}
                          placeholder={branding.lockScreenDesc || "The school administration has scheduled results or parents digital dashboard modules as scheduled or currently on hold."}
                          className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/15 font-sans"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-black text-slate-500 block">Override Lock Footer Text</label>
                        <input
                          type="text"
                          value={structureBranding.lockScreenFooter || ''}
                          onChange={(e) => setStructureBranding(prev => ({ ...prev, lockScreenFooter: e.target.value }))}
                          placeholder={branding.lockScreenFooter || "Please check back later or get in touch with your classroom teachers for offline copy inquiries."}
                          className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button type="button" onClick={() => markSectionCompletedAndNext('portal_visibility', null)} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-black flex items-center gap-1.5 shadow">
                      <Check className="w-4 h-4" /> Finalize Release Controls
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

          <div className="flex justify-end gap-3.5 pt-4 border-t">
            <button type="button" onClick={handleCancelDesign} className="px-4.5 py-2 text-xs font-bold text-slate-505 bg-white border rounded-xl hover:bg-slate-100">Cancel Design Space</button>
            <button type="button" onClick={handleSaveWholeStructure} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow">Save Entire Design Template</button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">

          {/* Quick Create design form header */}
          <div className="bg-white rounded-3xl p-5 border shadow-xs space-y-4">
            <h2 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
              <Sparkles className="w-4.5 h-4.5 text-indigo-500" />
              Design New Class-Group Report Card Template
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Class / target Classes scope:</span>
                <input type="text" value={promptClasses} onChange={(e) => setPromptClasses(e.target.value)} placeholder="e.g. LKG, UKG or Nursery to UKG" className="w-full px-3 py-2 text-xs border rounded-xl focus:outline-none bg-slate-50 focus:bg-white leading-tight" />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Descriptive Template Name:</span>
                <input type="text" value={promptName} onChange={(e) => setPromptName(e.target.value)} placeholder="e.g. Pre-Primary Section Format" className="w-full px-3 py-2 text-xs border rounded-xl focus:outline-none bg-slate-50 focus:bg-white leading-tight" />
              </div>
              <div>
                <button type="button" onClick={handleStartDesigningNew} className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-xs flex items-center justify-center gap-1 mt-0.5">
                  <Plus className="w-4 h-4" /> Start Designing Beautifully
                </button>
              </div>
            </div>

            {uniqueStudentClasses.length > 0 && (
              <div className="pt-1.5 flex flex-wrap gap-1.5 items-center">
                <span className="text-[9.5px] uppercase font-bold text-slate-400 block">Or add registered recommed class labels:</span>
                {uniqueStudentClasses.map(cls => (
                  <button key={cls} type="button" onClick={() => handleAddFieldSuggestionPrompt(cls)} className="px-2 py-0.5 text-[10.5px] bg-slate-50 hover:bg-slate-205 text-slate-705 rounded border font-semibold">＋ {cls}</button>
                ))}
              </div>
            )}
          </div>

          {/* MASTER CLASSES & SUBJECTS SETUP COLLAPSIBLE PANEL */}
          <div className="bg-white rounded-3xl border shadow-xs overflow-hidden">
            <button
              type="button"
              onClick={() => setIsSubjectsMasterOpen(!isSubjectsMasterOpen)}
              className="w-full px-5 py-4 flex items-center justify-between bg-slate-50 hover:bg-slate-100/70 text-left transition-colors"
            >
              <div className="flex items-center gap-2">
                <BookOpen className="w-4.5 h-4.5 text-indigo-500 animate-pulse" />
                <span className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                  Manage General Master Classes & Subjects Listing (Applied by Default)
                </span>
              </div>
              {isSubjectsMasterOpen ? <ChevronUp className="w-4 h-4 text-slate-455" /> : <ChevronDown className="w-4 h-4 text-slate-455" />}
            </button>

            {isSubjectsMasterOpen && (
              <div className="p-5 border-t animate-fadeIn">
                <SubjectSettings
                  subjects={subjects}
                  scoreColumns={scoreColumns}
                  onUpdateSubjects={(updated) => {
                    if (onUpdateSubjects) onUpdateSubjects(updated);
                  }}
                  onUpdateScoreColumns={(updated) => {
                    if (onUpdateScoreColumns) onUpdateScoreColumns(updated);
                  }}
                />
              </div>
            )}
          </div>

          {/* Configured designed layouts horizontal lists row */}
          <div className="space-y-2">
            <h3 className="text-[10.5px] font-black text-slate-455 uppercase tracking-wider">Configured Designed Formats Separately:</h3>

            {reportCardStructures.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-3xl border border-dashed text-slate-450 border-slate-250">
                <Layers className="w-8 h-8 mx-auto stroke-[1.25] text-slate-400 mb-2 animate-bounce" />
                <span className="block text-xs font-bold text-slate-700">No Target Layout Cards Configured</span>
                <p className="text-[10px] text-slate-400 max-w-sm mx-auto mt-1 leading-normal">
                  All classes currently default to using global settings. Define a separate format above for targeted LKG and UKG section classes specifically!
                </p>
              </div>
            ) : (
              <div className="flex flex-row overflow-x-auto gap-4 pb-4 px-1 pt-1 scrollbar-thin scrollbar-thumb-slate-200">
                {reportCardStructures.map((struct) => {
                  const compCount = struct.completedSections?.length || 1;
                  const totalSections = 6;
                  const percentComplete = Math.round((compCount / totalSections) * 100);

                  return (
                    <div key={struct.id} className="min-w-[280px] md:min-w-[325px] max-w-[340px] bg-white rounded-2xl border p-4 flex flex-col justify-between shadow-xs hover:shadow-sm hover:border-indigo-305 transition-all">
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-[9px] uppercase font-bold text-slate-400">
                          <span>Id: {struct.id.substring(0, 10)}</span>
                          <span className="text-emerald-600 flex items-center gap-0.5 bg-emerald-50 px-1 py-0.5 rounded border border-emerald-100">{compCount}/{totalSections} Steps Designed Complete</span>
                        </div>

                        <h4 className="font-extrabold text-[13.5px] text-slate-900 tracking-tight leading-tight">{struct.name}</h4>
                        
                        <div className="flex flex-wrap gap-1 leading-none select-none">
                          {(struct.assignedClasses || []).map(cls => (
                            <span key={cls} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded">Class {cls}</span>
                          ))}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-400 bg-slate-50 p-2 rounded-xl">
                          <div>
                            <span className="block text-slate-705">{(struct.subjects || []).filter(s => s.type === 'scholastic').length} Subjects</span>
                            <span className="text-[9px] text-slate-400 uppercase">Part 1 scholastic</span>
                          </div>
                          <div>
                            <span className="block text-slate-705">{(struct.scoreColumns || []).length} Columns</span>
                            <span className="text-[9px] text-slate-400 uppercase">Term Weight columns</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 pt-3 border-t mt-3.5 leading-none">
                        <button type="button" onClick={() => setViewingReplicaId(struct.id)} className="px-2 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-[10px] flex items-center justify-center gap-0.5 select-none"><Eye className="w-3.5 h-3.5" /> View</button>
                        <button type="button" onClick={() => handleEditStructure(struct)} className="px-2 py-2 bg-slate-50 hover:bg-slate-105 text-slate-700 font-bold rounded-lg text-[10px] flex items-center justify-center gap-0.5 select-none"><Edit className="w-3.5 h-3.5" /> Edit</button>
                        <button type="button" onClick={() => handleDeleteStructure(struct.id)} className="px-2 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-[10px] flex items-center justify-center gap-0.5 select-none"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom Destructive Action Double Confirmation Modal for Layout Structure */}
      {deletingStructureId && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-fadeIn text-slate-950">
          <div className="bg-white border border-rose-200 rounded-3xl w-full max-w-md shadow-2xl relative overflow-hidden p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-full shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1.5 w-full">
                <h4 className="font-extrabold text-base text-slate-900">Confirm Format Deletion</h4>
                <p className="text-xs text-rose-700 font-semibold bg-rose-50/50 p-2.5 rounded-xl border border-rose-100">
                  CRITICAL: You are about to permanently delete custom layout format <strong>"{reportCardStructures.find(s => s.id === deletingStructureId)?.name || 'Custom Layout'}"</strong>.
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  This action is irreversible. To authorize this deletion, please type <strong className="text-rose-600 font-bold select-none">DELETE</strong> or <strong className="text-indigo-600 font-bold select-none">CONFIRM</strong> below:
                </p>
                
                <input
                  type="text"
                  placeholder="Type DELETE or CONFIRM here"
                  value={deleteStructureInputText}
                  onChange={(e) => setDeleteStructureInputText(e.target.value)}
                  className="w-full mt-3 px-3.5 py-2.5 border-2 border-slate-200 focus:border-rose-500 rounded-xl text-xs font-mono font-bold uppercase tracking-wider outline-none text-center bg-slate-50"
                  autoFocus
                />

                <div className="flex justify-end gap-2.5 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setDeletingStructureId(null);
                      setDeleteStructureInputText('');
                    }}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-55 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeleteStructure}
                    disabled={deleteStructureInputText.trim().toUpperCase() !== 'DELETE' && deleteStructureInputText.trim().toUpperCase() !== 'CONFIRM'}
                    className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition flex items-center gap-1.5 ${
                      deleteStructureInputText.trim().toUpperCase() === 'DELETE' || deleteStructureInputText.trim().toUpperCase() === 'CONFIRM'
                        ? 'bg-rose-600 hover:bg-rose-700 cursor-pointer shadow-lg shadow-rose-200'
                        : 'bg-slate-300 cursor-not-allowed'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Permanently Delete</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINT DIALOG PREVIEW GATE MODAL */}
      {viewingReplicaId && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center z-50 p-1 sm:p-4 backdrop-blur-xs">
          <div className="bg-slate-950 w-full max-w-5xl rounded-2xl sm:rounded-3xl p-3 sm:p-6 shadow-2xl relative border border-slate-800 flex flex-col justify-between max-h-[98vh] sm:max-h-[96vh] my-auto">
            
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
              <div className="space-y-0.5 leading-none">
                <span className="text-[9.5px] uppercase tracking-widest text-indigo-400 font-extrabold">Report Card Preview Replica</span>
                <span className="block text-white font-black text-base">Format Design: {previewStructure?.name}</span>
              </div>
              <button type="button" onClick={() => setViewingReplicaId(null)} className="text-slate-400 hover:text-white bg-slate-800 rounded-full w-8 h-8 flex items-center justify-center transition-all">✕</button>
            </div>

            <div className="overflow-x-hidden overflow-y-auto py-2 sm:py-4 flex-grow my-2 sm:my-3 scrollbar-thin flex justify-center items-start w-full">
              <div className="bg-white rounded-xl sm:rounded-2xl p-1 sm:p-4 md:p-8 text-black border border-slate-300 mx-auto select-none w-full max-w-full">
                <ReportCardPreview
                  branding={replicaBranding}
                  subjects={replicaSubjects}
                  scoreColumns={replicaScoreColumns}
                  gradeScales={replicaGradeScales.length > 0 ? replicaGradeScales : [
                    { minPercent: 91, maxPercent: 100, grade: 'A1' },
                    { minPercent: 81, maxPercent: 90, grade: 'A2' },
                    { minPercent: 71, maxPercent: 80, grade: 'B1' },
                    { minPercent: 61, maxPercent: 70, grade: 'B2' },
                    { minPercent: 51, maxPercent: 60, grade: 'C1' },
                    { minPercent: 41, maxPercent: 50, grade: 'C2' },
                    { minPercent: 33, maxPercent: 40, grade: 'D' },
                    { minPercent: 0, maxPercent: 32, grade: 'E' }
                  ]}
                  student={resolvedMockStudentInstance}
                  grades={replicaMockGrades}
                  scholasticTerm1Disabled={previewStructure?.scholasticTerm1Disabled}
                  scholasticTerm2Disabled={previewStructure?.scholasticTerm2Disabled}
                  scholasticTerm3Disabled={previewStructure?.scholasticTerm3Disabled}
                  coScholasticOneColumn={previewStructure?.coScholasticOneColumn}
                  coScholasticSections={previewStructure?.coScholasticSections}
                  coGradeScales={replicaCoGradeScales}
                  signatures={previewStructure?.signatures}
                  hideGradingScale={previewStructure?.hideGradingScale}
                  hideAttendance={previewStructure?.hideAttendance}
                  pureGradeBased={previewStructure?.pureGradeBased}
                  verticalExamHeaders={previewStructure?.verticalExamHeaders}
                  verticalSubjectsHeader={previewStructure?.verticalSubjectsHeader}
                  subjectSpecificMaxMarksEnabled={previewStructure?.subjectSpecificMaxMarksEnabled}
                  gradingScaleAfterSignatures={previewStructure?.gradingScaleAfterSignatures}
                  gradingScaleLayout={previewStructure?.gradingScaleLayout}
                  enableSubjectGrouping={previewStructure?.enableSubjectGrouping}
                  customSubjectGroups={previewStructure?.customSubjectGroups}
                  hideTerm1Total={previewStructure?.hideTerm1Total}
                  hideTerm1Grade={previewStructure?.hideTerm1Grade}
                  hideTerm2Total={previewStructure?.hideTerm2Total}
                  hideTerm2Grade={previewStructure?.hideTerm2Grade}
                  hideTerm3Total={previewStructure?.hideTerm3Total}
                  hideTerm3Grade={previewStructure?.hideTerm3Grade}
                  hideOverallTotal={previewStructure?.hideOverallTotal}
                  hideOverallGrade={previewStructure?.hideOverallGrade}
                  termSpecificScoreColumnsEnabled={previewStructure?.termSpecificScoreColumnsEnabled}
                  term1ScoreColumns={previewStructure?.term1ScoreColumns}
                  term2ScoreColumns={previewStructure?.term2ScoreColumns}
                  term3ScoreColumns={previewStructure?.term3ScoreColumns}
                />
              </div>
            </div>

            <div className="border-t border-slate-800 pt-3.5 flex items-center justify-between leading-none font-sans select-none shrink-0">
              <span className="text-[10px] text-slate-455 flex items-center gap-1"><HelpCircle className="w-3.5 h-3.5" /> Generates highly realistic printable replicas for live audits.</span>
              <div className="flex gap-2.5">
                <button type="button" onClick={() => setViewingReplicaId(null)} className="px-4.5 py-2 text-xs font-bold text-slate-400 bg-slate-900 border border-slate-800 rounded-xl hover:text-white">Close</button>
                <button type="button" onClick={() => window.print()} className="px-5 py-2.5 bg-yellow-400 hover:bg-yellow-500 font-extrabold text-[11px] rounded-xl text-slate-950 flex items-center gap-1.5"><Printer className="w-4 h-4 stroke-[2.5]" /> Print Layout Format</button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
