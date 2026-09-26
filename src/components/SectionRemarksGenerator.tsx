import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Sparkles, 
  KeyRound, 
  RefreshCw, 
  Save, 
  Check, 
  AlertCircle, 
  Info, 
  CheckCircle2, 
  Download, 
  Printer, 
  Eye, 
  Copy, 
  HelpCircle, 
  ExternalLink, 
  Lock, 
  Sliders, 
  Users, 
  X, 
  Search, 
  Trash2, 
  Zap, 
  TrendingUp,
  FileCheck2,
  Sparkle
} from 'lucide-react';
import { Student, StudentGrades, SubjectColumn, ScoreColumn, GradeScale, SchoolBranding } from '../types';
import { 
  extractStudentAcademicProfile, 
  generateAiRemarksBatch, 
  generateAiRemarkForStudent,
  incrementSectionGenerationCount, 
  canGenerateForSection, 
  getStoredGeminiApiKey, 
  setStoredGeminiApiKey, 
  clearStoredGeminiApiKey, 
  validateGeminiApiKey,
  SECTION_MAX_FREE_GENERATIONS,
  StudentAcademicSummary
} from '../lib/aiRemarksService';
import { classesMatch } from '../utils/classNormalizer';

interface SectionRemarksGeneratorProps {
  students: Student[];
  studentGrades: StudentGrades[];
  subjects: SubjectColumn[];
  scoreColumns: ScoreColumn[];
  gradeScales: GradeScale[];
  branding: SchoolBranding;
  activeSchoolId?: string;
  selectedSessionFilter?: string;
  onUpdateStudents: (updated: Student[]) => void;
  onNavigateToPreview?: () => void;
}

export default function SectionRemarksGenerator({
  students,
  studentGrades,
  subjects,
  scoreColumns,
  gradeScales,
  branding,
  activeSchoolId = 'default_school',
  selectedSessionFilter = '',
  onUpdateStudents,
  onNavigateToPreview
}: SectionRemarksGeneratorProps) {
  // Extract distinct classes & sections
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => {
      if (s.className && s.className.trim()) {
        set.add(s.className.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [students]);

  const [selectedClass, setSelectedClass] = useState<string>(() => availableClasses[0] || 'Class 1st');

  // Available sections for the selected class
  const availableSections = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => {
      if (classesMatch(s.className, selectedClass) && s.section && s.section.trim()) {
        set.add(s.section.trim());
      }
    });
    const arr = Array.from(set).sort();
    return arr.length > 0 ? arr : ['A'];
  }, [students, selectedClass]);

  const [selectedSection, setSelectedSection] = useState<string>(() => availableSections[0] || 'A');

  // Update section selection if class changes and current section is not in list
  useEffect(() => {
    if (availableSections.length > 0 && !availableSections.includes(selectedSection)) {
      setSelectedSection(availableSections[0]);
    }
  }, [availableSections, selectedSection]);

  // If no classes exist, fallback
  useEffect(() => {
    if (availableClasses.length > 0 && !availableClasses.some(c => classesMatch(c, selectedClass))) {
      setSelectedClass(availableClasses[0]);
    }
  }, [availableClasses, selectedClass]);

  // Filter students for the current section
  const sectionStudents = useMemo(() => {
    return students
      .filter(s => classesMatch(s.className, selectedClass) && (s.section || 'A').toUpperCase() === selectedSection.toUpperCase())
      .sort((a, b) => {
        const rA = parseInt(a.rollNo || '0', 10);
        const rB = parseInt(b.rollNo || '0', 10);
        if (!isNaN(rA) && !isNaN(rB) && rA !== rB) return rA - rB;
        return a.name.localeCompare(b.name);
      });
  }, [students, selectedClass, selectedSection]);

  // Local state for remarks and promotion status per student in this section
  const [localRemarks, setLocalRemarks] = useState<Record<string, { remarks: string; promotionStatus: string; isModified?: boolean }>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMissingRemarks, setFilterMissingRemarks] = useState(false);

  // Synchronize initial local state from student objects
  useEffect(() => {
    const map: Record<string, { remarks: string; promotionStatus: string; isModified?: boolean }> = {};
    sectionStudents.forEach(s => {
      map[s.id] = {
        remarks: s.remarks || '',
        promotionStatus: s.promotionStatus || '',
        isModified: false
      };
    });
    setLocalRemarks(map);
  }, [selectedClass, selectedSection, sectionStudents]);

  // Generation Settings
  const [tone, setTone] = useState<'encouraging' | 'formal' | 'warm' | 'improvement' | 'holistic' | 'concise'>('encouraging');
  const [length, setLength] = useState<'short' | 'medium' | 'detailed'>('medium');
  const [focusArea, setFocusArea] = useState<'all_round' | 'academic' | 'effort' | 'behavior_social' | 'strengths_weaknesses'>('all_round');
  const [customTeacherPrompt, setCustomTeacherPrompt] = useState<string>('');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Status & Quota States
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'warning' | 'info' | 'error'; message: string } | null>(null);
  const [copiedStudentId, setCopiedStudentId] = useState<string | null>(null);
  const [isSavedRecently, setIsSavedRecently] = useState(false);
  const [singleStudentLoadingId, setSingleStudentLoadingId] = useState<string | null>(null);

  // Custom Gemini API Key States
  const [customApiKey, setCustomApiKey] = useState<string>(() => getStoredGeminiApiKey());
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [inputApiKey, setInputApiKey] = useState<string>(() => getStoredGeminiApiKey());
  const [showApiKeyText, setShowApiKeyText] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyValidationStatus, setKeyValidationStatus] = useState<{ valid?: boolean; message?: string } | null>(null);

  // Quota calculation for active section
  const sectionQuota = useMemo(() => {
    return canGenerateForSection(activeSchoolId, selectedClass, selectedSection, selectedSessionFilter);
  }, [activeSchoolId, selectedClass, selectedSection, selectedSessionFilter, customApiKey, isGenerating]);

  // Quick statistics for the section
  const stats = useMemo(() => {
    const total = sectionStudents.length;
    let completed = 0;
    let totalPct = 0;

    sectionStudents.forEach(s => {
      const r = localRemarks[s.id]?.remarks ?? s.remarks;
      if (r && r.trim().length > 0) completed++;
      const g = studentGrades.find(gr => gr.studentId === s.id);
      const prof = extractStudentAcademicProfile(s, g, subjects, scoreColumns, gradeScales);
      totalPct += prof.percentage || 0;
    });

    const avgPct = total > 0 ? (totalPct / total).toFixed(1) : '0.0';

    return { total, completed, pending: total - completed, avgPct };
  }, [sectionStudents, localRemarks, studentGrades, subjects, scoreColumns, gradeScales]);

  // Count of unsaved modifications in current view
  const unsavedCount = useMemo(() => {
    return Object.values(localRemarks).filter(r => (r as { isModified?: boolean }).isModified).length;
  }, [localRemarks]);

  // Filtered list for search
  const filteredStudents = useMemo(() => {
    return sectionStudents.filter(s => {
      const matchQuery = !searchQuery.trim() || 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (s.rollNo && s.rollNo.includes(searchQuery)) ||
        (s.admissionNo && s.admissionNo.toLowerCase().includes(searchQuery.toLowerCase()));
      
      if (!matchQuery) return false;

      if (filterMissingRemarks) {
        const r = localRemarks[s.id]?.remarks ?? s.remarks ?? '';
        return r.trim().length === 0;
      }
      return true;
    });
  }, [sectionStudents, searchQuery, filterMissingRemarks, localRemarks]);

  // Helper: Persist remarks immediately to student list and report cards
  const commitRemarksToStudents = (remarksMap: Record<string, { remarks: string; promotionStatus: string }>) => {
    const updatedStudentList = students.map(s => {
      const updated = remarksMap[s.id];
      if (updated) {
        return {
          ...s,
          remarks: updated.remarks,
          promotionStatus: updated.promotionStatus
        };
      }
      return s;
    });
    onUpdateStudents(updatedStudentList);
  };

  // Handle Generate / Regenerate for the whole section
  const handleGenerateSectionRemarks = async () => {
    if (sectionStudents.length === 0) {
      setStatusBanner({ type: 'warning', message: 'No students found in this class & section.' });
      return;
    }

    // Check quota if user does not have custom API key
    if (!sectionQuota.hasCustomKey && !sectionQuota.allowed) {
      setStatusBanner({
        type: 'warning',
        message: `Maximum free generation limit reached (2 of 2 attempts used for ${selectedClass} - ${selectedSection}). You can edit existing remarks directly below or connect your Gemini API Key for unlimited generations.`
      });
      setIsKeyModalOpen(true);
      return;
    }

    // Confirmation if regenerating
    if (sectionQuota.count > 0 && !sectionQuota.hasCustomKey) {
      const confirmRegen = window.confirm(
        `This will be attempt ${sectionQuota.count + 1} of ${SECTION_MAX_FREE_GENERATIONS} for ${selectedClass} - ${selectedSection}.\n\nAfter this attempt, automated AI generation will be locked and remarks can be edited directly. Would you like to proceed?`
      );
      if (!confirmRegen) return;
    }

    setIsGenerating(true);
    setStatusBanner(null);
    setProgressPercent(15);
    setProgressStatus(`Analyzing academic marks for ${sectionStudents.length} students...`);

    try {
      // Build academic summaries
      const profiles: StudentAcademicSummary[] = sectionStudents.map(s => {
        const grades = studentGrades.find(g => g.studentId === s.id);
        return extractStudentAcademicProfile(s, grades, subjects, scoreColumns, gradeScales);
      });

      setProgressPercent(40);
      setProgressStatus(`Generating positive & encouraging remarks...`);

      const res = await generateAiRemarksBatch({
        apiKey: customApiKey || undefined,
        students: profiles,
        tone,
        length,
        focusArea,
        customPrompt: customTeacherPrompt,
        schoolName: branding.schoolName
      });

      if (res.success && res.results) {
        setProgressPercent(85);
        setProgressStatus(`Applying & saving to student records...`);

        const updatedLocal = { ...localRemarks };
        res.results.forEach(item => {
          if (item && item.studentId) {
            updatedLocal[item.studentId] = {
              remarks: item.remarks,
              promotionStatus: item.promotionStatus || updatedLocal[item.studentId]?.promotionStatus || '',
              isModified: false
            };
          }
        });

        setLocalRemarks(updatedLocal);

        // PERMANENT SAVE: Commit immediately to student database and report cards
        commitRemarksToStudents(updatedLocal);
        setIsSavedRecently(true);
        setTimeout(() => setIsSavedRecently(false), 4000);

        // Increment quota if no custom API key
        if (!sectionQuota.hasCustomKey) {
          const newCount = incrementSectionGenerationCount(activeSchoolId, selectedClass, selectedSection, selectedSessionFilter);
          if (newCount >= SECTION_MAX_FREE_GENERATIONS) {
            setStatusBanner({
              type: 'info',
              message: `✅ Remarks generated and permanently saved for ${res.results.length} students in Report Cards! (2 of 2 free generation attempts used).`
            });
          } else {
            setStatusBanner({
              type: 'success',
              message: `✅ Remarks generated and permanently saved for ${res.results.length} students in Report Cards! (Attempt 1 of 2 completed).`
            });
          }
        } else {
          setStatusBanner({
            type: 'success',
            message: `✨ Successfully generated and saved remarks for all ${res.results.length} students using your custom Gemini API key!`
          });
        }
      } else {
        throw new Error(res.error || 'Failed to generate remarks for section.');
      }
    } catch (err: any) {
      console.error('Section remarks generation failed:', err);
      setStatusBanner({
        type: 'error',
        message: `Generation Notice: ${err?.message || 'Could not complete section generation. Please try again.'}`
      });
    } finally {
      setIsGenerating(false);
      setProgressPercent(100);
    }
  };

  // Quick Single Student Polish / Regenerate
  const handleSingleStudentRegenerate = async (student: Student) => {
    setSingleStudentLoadingId(student.id);
    try {
      const grades = studentGrades.find(g => g.studentId === student.id);
      const profile = extractStudentAcademicProfile(student, grades, subjects, scoreColumns, gradeScales);

      const res = await generateAiRemarkForStudent({
        apiKey: customApiKey || undefined,
        student: profile,
        tone,
        length,
        focusArea,
        customPrompt: customTeacherPrompt,
        schoolName: branding.schoolName
      });

      if (res.success && res.remarks) {
        const newRemarks = res.remarks;
        const newPromo = res.promotionStatus || localRemarks[student.id]?.promotionStatus || student.promotionStatus || '';

        const updatedLocal = {
          ...localRemarks,
          [student.id]: {
            remarks: newRemarks,
            promotionStatus: newPromo,
            isModified: false
          }
        };

        setLocalRemarks(updatedLocal);

        // Permanently persist this student's updated remark
        commitRemarksToStudents(updatedLocal);

        setIsSavedRecently(true);
        setTimeout(() => setIsSavedRecently(false), 3000);
      }
    } catch (e: any) {
      alert(`Could not rewrite remark: ${e?.message || 'Error'}`);
    } finally {
      setSingleStudentLoadingId(null);
    }
  };

  // Save All Changes to Student Database
  const handleSaveAllRemarks = () => {
    commitRemarksToStudents(localRemarks);

    setIsSavedRecently(true);
    setTimeout(() => setIsSavedRecently(false), 3500);

    // Reset modification flags
    const refreshedLocal = { ...localRemarks };
    Object.keys(refreshedLocal).forEach(id => {
      refreshedLocal[id] = { ...refreshedLocal[id], isModified: false };
    });
    setLocalRemarks(refreshedLocal);

    setStatusBanner({
      type: 'success',
      message: `💾 Remarks and promotion statuses permanently saved for ${sectionStudents.length} students in ${selectedClass} - Section ${selectedSection}!`
    });
  };

  // Navigate to Report Card Preview with auto-commit
  const handleGoToReportCards = () => {
    if (unsavedCount > 0) {
      commitRemarksToStudents(localRemarks);
    }
    if (onNavigateToPreview) {
      onNavigateToPreview();
    }
  };

  // Copy Remark to Clipboard
  const handleCopyRemark = (studentId: string, text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedStudentId(studentId);
    setTimeout(() => setCopiedStudentId(null), 2000);
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (sectionStudents.length === 0) return;

    const headers = ['Roll No', 'Admission No', 'Student Name', 'Class', 'Section', 'Overall Score %', 'Grade', 'Remarks', 'Promotion Status'];
    const rows = sectionStudents.map(s => {
      const grades = studentGrades.find(g => g.studentId === s.id);
      const prof = extractStudentAcademicProfile(s, grades, subjects, scoreColumns, gradeScales);
      const r = localRemarks[s.id]?.remarks || s.remarks || '';
      const p = localRemarks[s.id]?.promotionStatus || s.promotionStatus || '';

      return [
        `"${s.rollNo || ''}"`,
        `"${s.admissionNo || ''}"`,
        `"${s.name.replace(/"/g, '""')}"`,
        `"${s.className || selectedClass}"`,
        `"${s.section || selectedSection}"`,
        `"${prof.percentage}%"`,
        `"${prof.grade}"`,
        `"${r.replace(/"/g, '""')}"`,
        `"${p.replace(/"/g, '""')}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Remarks_${selectedClass.replace(/\s+/g, '_')}_Sec_${selectedSection}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Remarks Sheet
  const handlePrint = () => {
    window.print();
  };

  // API Key Validation Handler
  const handleValidateAndSaveApiKey = async () => {
    if (!inputApiKey.trim()) {
      clearStoredGeminiApiKey();
      setCustomApiKey('');
      setKeyValidationStatus({ valid: false, message: 'API key cleared. Standard quota restored.' });
      return;
    }

    setIsTestingKey(true);
    setKeyValidationStatus(null);

    const result = await validateGeminiApiKey(inputApiKey.trim());
    setIsTestingKey(false);

    if (result.valid) {
      setStoredGeminiApiKey(inputApiKey.trim());
      setCustomApiKey(inputApiKey.trim());
      setKeyValidationStatus({ valid: true, message: '✨ Gemini API Key verified! Unlimited generations enabled.' });
      setTimeout(() => {
        setIsKeyModalOpen(false);
      }, 1500);
    } else {
      setKeyValidationStatus({ valid: false, message: result.message });
    }
  };

  return (
    <div id="section-remarks-generator" className="space-y-4 sm:space-y-6 animate-fadeIn pb-24 sm:pb-16 max-w-7xl mx-auto px-2 sm:px-4">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-xs shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight">Generate Remarks</h1>
                <p className="text-xs sm:text-sm text-slate-500 line-clamp-2 sm:line-clamp-none">
                  Analyze entire class sections to produce strictly positive, encouraging, and constructive student remarks saved permanently in report cards.
                </p>
              </div>
            </div>
          </div>

          {/* Top Badges & API Key Button */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Custom Key Status Badge */}
            {sectionQuota.hasCustomKey ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                <Zap className="w-3.5 h-3.5 text-emerald-600 fill-emerald-500 shrink-0" />
                <span>Unlimited AI Generations</span>
                <span className="text-[10px] bg-emerald-200/70 text-emerald-900 px-1.5 py-0.5 rounded-md font-mono">Custom Key</span>
              </div>
            ) : (
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                sectionQuota.count >= SECTION_MAX_FREE_GENERATIONS
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-indigo-50 border-indigo-200 text-indigo-900'
              }`}>
                <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>
                  Free Quota: {sectionQuota.count}/{SECTION_MAX_FREE_GENERATIONS} used
                  {sectionQuota.remaining > 0 ? ` (${sectionQuota.remaining} left)` : ' (Limit Reached)'}
                </span>
              </div>
            )}

            {/* Configure Key Button */}
            <button
              type="button"
              onClick={() => {
                setInputApiKey(customApiKey);
                setKeyValidationStatus(null);
                setIsKeyModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-all cursor-pointer shadow-2xs min-h-[38px]"
            >
              <KeyRound className="w-3.5 h-3.5 text-slate-500" />
              <span>{sectionQuota.hasCustomKey ? 'Manage Gemini Key' : 'Enter Gemini API Key'}</span>
            </button>
          </div>
        </div>

        {/* Section Selector Controls & Generation Bar */}
        <div className="mt-4 pt-4 sm:mt-5 sm:pt-5 border-t border-slate-100 grid grid-cols-2 md:grid-cols-12 gap-2.5 sm:gap-3.5 items-end">
          {/* Class Selector */}
          <div className="col-span-1 md:col-span-3">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Class</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs sm:text-sm font-semibold rounded-xl px-2.5 sm:px-3 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            >
              {availableClasses.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Section Selector */}
          <div className="col-span-1 md:col-span-2">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Section</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs sm:text-sm font-semibold rounded-xl px-2.5 sm:px-3 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            >
              {availableSections.map(sec => (
                <option key={sec} value={sec}>Section {sec}</option>
              ))}
            </select>
          </div>

          {/* Tone Selector */}
          <div className="col-span-2 md:col-span-3">
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">Tone & Voice</label>
            <select
              value={tone}
              onChange={(e: any) => setTone(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs sm:text-sm font-medium rounded-xl px-2.5 sm:px-3 py-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            >
              <option value="encouraging">🌟 Positive & Inspiring (Default)</option>
              <option value="warm">❤️ Warm & Celebratory</option>
              <option value="improvement">🌱 Growth Mindset & Potential</option>
              <option value="formal">🎓 Professional & Scholastic</option>
              <option value="concise">⚡ Crisp & Direct</option>
            </select>
          </div>

          {/* Action Trigger Buttons */}
          <div className="col-span-2 md:col-span-4 flex items-center gap-2 pt-1 md:pt-0">
            <button
              type="button"
              onClick={handleGenerateSectionRemarks}
              disabled={isGenerating || (!sectionQuota.allowed && !sectionQuota.hasCustomKey)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer min-h-[42px] ${
                !sectionQuota.allowed && !sectionQuota.hasCustomKey
                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-md active:scale-[0.98]'
              }`}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Analyzing Marks...</span>
                </>
              ) : sectionQuota.count > 0 && !sectionQuota.hasCustomKey ? (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Regenerate (Attempt 2/2)</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Section Remarks</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              className={`p-2.5 rounded-xl border text-slate-600 hover:bg-slate-100 transition-all cursor-pointer min-h-[42px] min-w-[42px] flex items-center justify-center ${
                showAdvancedSettings ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-200'
              }`}
              title="Advanced remark settings"
            >
              <Sliders className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Advanced Settings Drawer */}
        {showAdvancedSettings && (
          <div className="mt-3 pt-3 sm:mt-4 sm:pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 bg-slate-50/70 p-3.5 sm:p-4 rounded-xl">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Remark Length</label>
              <select
                value={length}
                onChange={(e: any) => setLength(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="short">Short (1-2 sentences, ~25 words)</option>
                <option value="medium">Medium (2-3 sentences, ~45 words)</option>
                <option value="detailed">Detailed (3-4 sentences, ~70 words)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Focus Area</label>
              <select
                value={focusArea}
                onChange={(e: any) => setFocusArea(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all_round">All-Round & Balanced</option>
                <option value="academic">Academic Strengths & Subject Mastery</option>
                <option value="effort">Effort, Perseverance & Curiosity</option>
                <option value="behavior_social">Classroom Conduct & Teamwork</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Custom Teacher Guidance</label>
              <input
                type="text"
                placeholder="e.g. Highlight term exam performance..."
                value={customTeacherPrompt}
                onChange={(e) => setCustomTeacherPrompt(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}

        {/* Generating Progress Bar */}
        {isGenerating && (
          <div className="mt-3 sm:mt-4 p-3 bg-indigo-50/80 border border-indigo-100 rounded-xl space-y-2">
            <div className="flex justify-between text-xs font-semibold text-indigo-900">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                {progressStatus}
              </span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full bg-indigo-200/60 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Status Banner */}
        {statusBanner && (
          <div className={`mt-3 sm:mt-4 p-3.5 rounded-xl border flex items-start justify-between gap-3 text-xs ${
            statusBanner.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
            statusBanner.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-900' :
            statusBanner.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-900' :
            'bg-indigo-50 border-indigo-200 text-indigo-900'
          }`}>
            <div className="flex items-start gap-2">
              {statusBanner.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
              {statusBanner.type === 'warning' && <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />}
              {statusBanner.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
              {statusBanner.type === 'info' && <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />}
              <div>
                <p className="font-semibold">{statusBanner.message}</p>
                {statusBanner.type === 'warning' && !sectionQuota.hasCustomKey && sectionQuota.count >= SECTION_MAX_FREE_GENERATIONS && (
                  <p className="mt-1 text-slate-700">
                    💡 Tip: Click <strong>"Enter Gemini API Key"</strong> above to enter your free personal key for unlimited generations.
                  </p>
                )}
              </div>
            </div>
            <button 
              type="button"
              onClick={() => setStatusBanner(null)} 
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Quota Limit Reached Notice Card (when 2 attempts reached and no custom key) */}
      {!sectionQuota.hasCustomKey && sectionQuota.count >= SECTION_MAX_FREE_GENERATIONS && (
        <div className="p-3.5 sm:p-4 bg-amber-50 border border-amber-200/90 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-950">
          <div className="flex items-start gap-2.5">
            <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-xs sm:text-sm text-amber-900">
                Generation Limit Reached for {selectedClass} - Section {selectedSection}
              </p>
              <p className="text-amber-800 mt-0.5 leading-relaxed text-[11.5px] sm:text-xs">
                Remarks can be generated up to 2 times per section on the free tier. You can freely edit, refine, or rewrite remarks directly below. To unlock unlimited AI generations for all sections, add your free Gemini API Key.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setInputApiKey(customApiKey);
              setKeyValidationStatus(null);
              setIsKeyModalOpen(true);
            }}
            className="w-full sm:w-auto shrink-0 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-2xs transition-all cursor-pointer text-center min-h-[40px]"
          >
            Connect API Key (Free)
          </button>
        </div>
      )}

      {/* Action Toolbar & Section Stats */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Statistics Badges (Horizontal scroll on mobile) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 text-xs font-semibold text-slate-600 scrollbar-none">
            <div className="px-2.5 py-1.5 bg-slate-100 rounded-lg flex items-center gap-1.5 shrink-0">
              <Users className="w-3.5 h-3.5 text-slate-500" />
              <span>Total: <strong className="text-slate-900">{stats.total}</strong></span>
            </div>
            <div className="px-2.5 py-1.5 bg-emerald-50 text-emerald-800 rounded-lg flex items-center gap-1.5 border border-emerald-100 shrink-0">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span>Filled: <strong className="text-emerald-900">{stats.completed}/{stats.total}</strong></span>
            </div>
            <div className="px-2.5 py-1.5 bg-indigo-50 text-indigo-800 rounded-lg flex items-center gap-1.5 border border-indigo-100 shrink-0">
              <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
              <span>Class Avg: <strong className="text-indigo-900">{stats.avgPct}%</strong></span>
            </div>
          </div>

          {/* Search & Actions Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Box */}
            <div className="relative flex-1 sm:flex-initial">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search student..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-44 pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Export CSV */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="p-2 sm:px-3 sm:py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-all cursor-pointer min-h-[34px]"
              title="Export CSV"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">CSV</span>
            </button>

            {/* Print */}
            <button
              type="button"
              onClick={handlePrint}
              className="p-2 sm:px-3 sm:py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-all cursor-pointer min-h-[34px]"
              title="Print Remarks Sheet"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Print</span>
            </button>

            {/* Open Report Cards */}
            {onNavigateToPreview && (
              <button
                type="button"
                onClick={handleGoToReportCards}
                className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer min-h-[34px]"
                title="Preview in Report Cards"
              >
                <Eye className="w-3.5 h-3.5 text-amber-600" />
                <span>Report Cards</span>
              </button>
            )}

            {/* Save All Remarks */}
            <button
              type="button"
              onClick={handleSaveAllRemarks}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer min-h-[34px] ${
                isSavedRecently
                  ? 'bg-emerald-600 text-white'
                  : unsavedCount > 0
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white ring-2 ring-indigo-300'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {isSavedRecently ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save All</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* STUDENT REMARKS CONTENT */}
      {filteredStudents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-10 text-center text-slate-400 space-y-2">
          <Users className="w-10 h-10 mx-auto text-slate-300 stroke-[1.5]" />
          <p className="text-sm font-semibold text-slate-600">No students found in {selectedClass} - Section {selectedSection}</p>
          <p className="text-xs text-slate-400">Try changing class/section or clearing your search filter.</p>
        </div>
      ) : (
        <>
          {/* ======================================================== */}
          {/* MOBILE VIEW: Responsive Cards for Touchscreens (< 768px) */}
          {/* ======================================================== */}
          <div className="block md:hidden space-y-3.5">
            {filteredStudents.map((student, idx) => {
              const grades = studentGrades.find(g => g.studentId === student.id);
              const profile = extractStudentAcademicProfile(student, grades, subjects, scoreColumns, gradeScales);
              const currentRemark = localRemarks[student.id]?.remarks ?? student.remarks ?? '';
              const currentPromotion = localRemarks[student.id]?.promotionStatus ?? student.promotionStatus ?? '';
              const isModified = localRemarks[student.id]?.isModified;
              const wordCount = currentRemark.trim() ? currentRemark.trim().split(/\s+/).length : 0;
              const isSingleLoading = singleStudentLoadingId === student.id;

              return (
                <div 
                  key={student.id} 
                  className={`bg-white rounded-2xl border shadow-xs p-3.5 space-y-3 transition-all ${
                    isModified ? 'border-indigo-300 ring-1 ring-indigo-200 bg-indigo-50/10' : 'border-slate-200'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Roll Badge */}
                      <span className="px-2 py-1 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-lg shrink-0 border border-indigo-100">
                        #{student.rollNo || idx + 1}
                      </span>
                      {/* Name & Father */}
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-sm truncate">{student.name}</p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {student.fatherName ? `F: ${student.fatherName}` : student.admissionNo ? `Adm: ${student.admissionNo}` : 'Student'}
                        </p>
                      </div>
                    </div>

                    {/* Academic Performance Badge */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-bold text-xs text-slate-800">{profile.percentage}%</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        (profile.grade || '').startsWith('A') ? 'bg-emerald-100 text-emerald-800' :
                        (profile.grade || '').startsWith('B') ? 'bg-blue-100 text-blue-800' :
                        (profile.grade || '').startsWith('C') ? 'bg-amber-100 text-amber-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {profile.grade}
                      </span>
                    </div>
                  </div>

                  {/* Top Strength Pill (if available) */}
                  {profile.strongSubjects && profile.strongSubjects.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <span className="text-slate-400">Strength:</span>
                      <span className="font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-[200px]">
                        {profile.strongSubjects.slice(0, 2).join(', ')}
                      </span>
                    </div>
                  )}

                  {/* Remark Textarea */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <label className="font-bold text-slate-700 flex items-center gap-1">
                        <span>Teacher's Remark:</span>
                      </label>
                      <div className="flex items-center gap-2">
                        {isModified && (
                          <span className="text-amber-600 font-bold text-[10px] animate-pulse">• Unsaved</span>
                        )}
                        <span className="text-slate-400 text-[10.5px]">{wordCount} words</span>
                      </div>
                    </div>

                    <textarea
                      rows={3}
                      value={currentRemark}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLocalRemarks(prev => ({
                          ...prev,
                          [student.id]: {
                            remarks: val,
                            promotionStatus: prev[student.id]?.promotionStatus ?? student.promotionStatus ?? '',
                            isModified: true
                          }
                        }));
                      }}
                      placeholder="Enter positive, encouraging remark for this student..."
                      className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-2.5 text-xs text-slate-800 leading-relaxed resize-y transition-all"
                    />
                  </div>

                  {/* Promotion Status Row */}
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-700">Promotion Status:</label>
                    <input
                      type="text"
                      value={currentPromotion}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLocalRemarks(prev => ({
                          ...prev,
                          [student.id]: {
                            remarks: prev[student.id]?.remarks ?? student.remarks ?? '',
                            promotionStatus: val,
                            isModified: true
                          }
                        }));
                      }}
                      placeholder="e.g. Promoted to Next Class"
                      className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-2.5 py-2 text-xs text-slate-800 transition-all"
                    />

                    {/* Quick Promotion Chips */}
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {['Promoted to Next Class', 'Promoted', 'Passed with Distinction'].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            setLocalRemarks(prev => ({
                              ...prev,
                              [student.id]: {
                                remarks: prev[student.id]?.remarks ?? student.remarks ?? '',
                                promotionStatus: preset,
                                isModified: true
                              }
                            }));
                          }}
                          className="text-[10px] px-2 py-0.5 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 rounded-md border border-slate-200/60 transition-colors"
                        >
                          + {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleCopyRemark(student.id, currentRemark)}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 py-1.5 px-2.5 rounded-lg hover:bg-slate-100 transition-colors min-h-[34px]"
                    >
                      {copiedStudentId === student.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-400" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={isSingleLoading}
                      onClick={() => handleSingleStudentRegenerate(student)}
                      className="text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 flex items-center gap-1.5 transition-all shadow-2xs min-h-[34px] active:scale-95 disabled:opacity-50"
                    >
                      {isSingleLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Polishing...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                          <span>AI Polish</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ======================================================== */}
          {/* DESKTOP VIEW: Structured Table for Large Screens (>= 768px) */}
          {/* ======================================================== */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-3.5 px-4 w-16 text-center">Roll</th>
                    <th className="py-3.5 px-4 w-52">Student Info</th>
                    <th className="py-3.5 px-4 w-36">Academic Stats</th>
                    <th className="py-3.5 px-4">Positive Teacher's Remark</th>
                    <th className="py-3.5 px-4 w-48">Promotion Status</th>
                    <th className="py-3.5 px-3 w-16 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredStudents.map((student, idx) => {
                    const grades = studentGrades.find(g => g.studentId === student.id);
                    const profile = extractStudentAcademicProfile(student, grades, subjects, scoreColumns, gradeScales);
                    const currentRemark = localRemarks[student.id]?.remarks ?? student.remarks ?? '';
                    const currentPromotion = localRemarks[student.id]?.promotionStatus ?? student.promotionStatus ?? '';
                    const isModified = localRemarks[student.id]?.isModified;
                    const wordCount = currentRemark.trim() ? currentRemark.trim().split(/\s+/).length : 0;
                    const isSingleLoading = singleStudentLoadingId === student.id;

                    return (
                      <tr 
                        key={student.id} 
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isModified ? 'bg-indigo-50/20' : ''
                        }`}
                      >
                        {/* Roll No */}
                        <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                          {student.rollNo || idx + 1}
                        </td>

                        {/* Student Info */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-100 to-indigo-50 border border-indigo-200 flex items-center justify-center font-bold text-indigo-700 text-xs shrink-0">
                              {student.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate">{student.name}</p>
                              <p className="text-[11px] text-slate-400 truncate">
                                {student.fatherName ? `F: ${student.fatherName}` : student.admissionNo ? `Adm: ${student.admissionNo}` : 'Student'}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Academic Performance */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900">{profile.percentage}%</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                (profile.grade || '').startsWith('A') ? 'bg-emerald-100 text-emerald-800' :
                                (profile.grade || '').startsWith('B') ? 'bg-blue-100 text-blue-800' :
                                (profile.grade || '').startsWith('C') ? 'bg-amber-100 text-amber-800' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                Grade {profile.grade}
                              </span>
                            </div>
                            <p className="text-[10.5px] text-slate-500 truncate" title={profile.strongSubjects?.join(', ')}>
                              Top: {profile.strongSubjects?.[0] || 'Core'}
                            </p>
                          </div>
                        </td>

                        {/* Remark Textarea */}
                        <td className="py-3.5 px-4">
                          <div className="relative">
                            <textarea
                              rows={2}
                              value={currentRemark}
                              onChange={(e) => {
                                const val = e.target.value;
                                setLocalRemarks(prev => ({
                                  ...prev,
                                  [student.id]: {
                                    remarks: val,
                                    promotionStatus: prev[student.id]?.promotionStatus ?? student.promotionStatus ?? '',
                                    isModified: true
                                  }
                                }));
                              }}
                              placeholder="Enter positive, encouraging remark for this student..."
                              className="w-full bg-slate-50/60 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 rounded-xl p-2.5 text-xs text-slate-800 leading-relaxed resize-y transition-all"
                            />
                            <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400 px-1">
                              <span>
                                {wordCount > 0 ? `${wordCount} words` : 'Empty remark'}
                              </span>
                              {isModified && (
                                <span className="text-amber-600 font-semibold">• Unsaved Edit</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Promotion Status */}
                        <td className="py-3.5 px-4">
                          <input
                            type="text"
                            value={currentPromotion}
                            onChange={(e) => {
                              const val = e.target.value;
                              setLocalRemarks(prev => ({
                                ...prev,
                                [student.id]: {
                                  remarks: prev[student.id]?.remarks ?? student.remarks ?? '',
                                  promotionStatus: val,
                                  isModified: true
                                }
                              }));
                            }}
                            placeholder="e.g. Promoted to Next Class"
                            className="w-full bg-slate-50/60 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 transition-all"
                          />
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* Copy */}
                            <button
                              type="button"
                              onClick={() => handleCopyRemark(student.id, currentRemark)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                              title="Copy remark to clipboard"
                            >
                              {copiedStudentId === student.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {/* Quick Regenerate */}
                            <button
                              type="button"
                              disabled={isSingleLoading}
                              onClick={() => handleSingleStudentRegenerate(student)}
                              className="p-1.5 rounded-lg text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 transition-colors disabled:opacity-50"
                              title="AI Polish / Rewrite this student"
                            >
                              {isSingleLoading ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                              ) : (
                                <Sparkles className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ======================================================== */}
      {/* MOBILE STICKY BOTTOM SAVE & PREVIEW BAR (< 768px) */}
      {/* ======================================================== */}
      <div className="fixed bottom-3 left-3 right-3 sm:hidden z-40 bg-slate-900/95 backdrop-blur-md text-white p-2.5 rounded-2xl shadow-2xl border border-slate-700/60 flex items-center justify-between gap-2 animate-slideUp">
        <div className="flex items-center gap-2 pl-2">
          {unsavedCount > 0 ? (
            <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              {unsavedCount} Unsaved
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
              <FileCheck2 className="w-3.5 h-3.5" />
              Saved
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {onNavigateToPreview && (
            <button
              type="button"
              onClick={handleGoToReportCards}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-all"
            >
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span>Report Cards</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSaveAllRemarks}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95 ${
              isSavedRecently
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            {isSavedRecently ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save All</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* GEMINI API KEY MODAL */}
      {isKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full max-h-[90vh] overflow-y-auto animate-scaleUp">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold">Custom Gemini API Key</h3>
                  <p className="text-[11px] sm:text-xs text-indigo-200">Unlock Unlimited AI Remark Generations</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsKeyModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 space-y-4 text-xs">
              <div className="p-3 bg-indigo-50/80 border border-indigo-100 rounded-xl text-indigo-900 space-y-1">
                <p className="font-semibold flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  Why add your personal Gemini API Key?
                </p>
                <p className="text-[11.5px] text-indigo-800 leading-relaxed">
                  By default, each section can generate remarks up to <strong>2 times</strong>. Entering your own free Gemini API key grants <strong>unlimited remark generations</strong> for all classes and sections with zero limits.
                </p>
              </div>

              {/* Key Input */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">
                  Gemini API Key (Google AI Studio)
                </label>
                <div className="relative">
                  <input
                    type={showApiKeyText ? 'text' : 'password'}
                    value={inputApiKey}
                    onChange={(e) => {
                      setInputApiKey(e.target.value);
                      setKeyValidationStatus(null);
                    }}
                    placeholder="AIzaSy..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 pr-12 text-xs font-mono text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKeyText(!showApiKeyText)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[11px] font-semibold p-1"
                  >
                    {showApiKeyText ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {/* Validation Status Notice */}
              {keyValidationStatus && (
                <div className={`p-3 rounded-xl border flex items-center gap-2 ${
                  keyValidationStatus.valid
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}>
                  {keyValidationStatus.valid ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span className="font-medium text-xs">{keyValidationStatus.message}</span>
                </div>
              )}

              {/* How to get key instructions */}
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2 text-slate-600">
                <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  How to get a Free Gemini API Key (1 minute):
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[11.5px] text-slate-600">
                  <li>Visit <strong>Google AI Studio</strong> at <code className="bg-slate-200/70 px-1 py-0.5 rounded text-[10.5px]">aistudio.google.com/app/apikey</code></li>
                  <li>Sign in with your Google account and click <strong>"Create API Key"</strong>.</li>
                  <li>Copy and paste your key in the box above, then click <strong>"Test & Save Key"</strong>.</li>
                </ol>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-bold text-[11.5px] mt-1"
                >
                  <span>Open Google AI Studio Key Page</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 sticky bottom-0">
              {customApiKey ? (
                <button
                  type="button"
                  onClick={() => {
                    clearStoredGeminiApiKey();
                    setCustomApiKey('');
                    setInputApiKey('');
                    setKeyValidationStatus({ valid: false, message: 'Custom API key removed.' });
                  }}
                  className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove</span>
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsKeyModalOpen(false)}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-200/60 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={isTestingKey}
                  onClick={handleValidateAndSaveApiKey}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 min-h-[38px]"
                >
                  {isTestingKey ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Validating...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Key</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
