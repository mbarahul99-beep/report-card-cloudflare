import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Bot, 
  Check, 
  Copy, 
  RefreshCw, 
  X, 
  Sliders, 
  Award, 
  CheckCircle2, 
  ChevronRight, 
  GraduationCap, 
  BookOpen, 
  Heart, 
  TrendingUp, 
  Zap, 
  Edit3,
  Users,
  AlertCircle,
  Info
} from 'lucide-react';
import { Student, StudentGrades, SubjectColumn, ScoreColumn, GradeScale } from '../types';
import { 
  extractStudentAcademicProfile, 
  generateAiRemarkForStudent, 
  generateAiRemarksBatch, 
  StudentAcademicSummary, 
  BulkRemarkResultItem 
} from '../lib/aiRemarksService';

export interface AiRemarksModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'single' | 'bulk';
  student?: Student | null;
  studentsList?: Student[];
  studentGrades?: StudentGrades[];
  subjects?: SubjectColumn[];
  scoreColumns?: ScoreColumn[];
  gradeScales?: GradeScale[];
  selectedClass?: string;
  selectedSection?: string;
  schoolName?: string;
  term1Active?: boolean;
  term2Active?: boolean;
  term3Active?: boolean;
  onApplySingleRemark?: (remark: string, promotionStatus?: string) => void;
  onApplyBulkRemarks?: (updates: { studentId: string; remarks: string; promotionStatus?: string }[]) => void;
}

export default function AiRemarksModal({
  isOpen,
  onClose,
  mode,
  student,
  studentsList = [],
  studentGrades = [],
  subjects = [],
  scoreColumns = [],
  gradeScales = [],
  selectedClass = 'all',
  selectedSection = 'all',
  schoolName = '',
  term1Active = true,
  term2Active = true,
  term3Active = false,
  onApplySingleRemark,
  onApplyBulkRemarks,
}: AiRemarksModalProps) {
  // Common Settings
  const [tone, setTone] = useState<'encouraging' | 'formal' | 'warm' | 'improvement' | 'concise'>('encouraging');
  const [length, setLength] = useState<'short' | 'medium' | 'detailed'>('medium');
  const [focusArea, setFocusArea] = useState<'all_round' | 'academic' | 'effort' | 'behavior_social' | 'strengths_weaknesses'>('all_round');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [applyPromotion, setApplyPromotion] = useState<boolean>(true);

  // Single Student States
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [generatedOptions, setGeneratedOptions] = useState<string[]>([]);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number>(0);
  const [customEditedRemark, setCustomEditedRemark] = useState<string>('');
  const [promotionSuggestion, setPromotionSuggestion] = useState<string>('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isAiPowered, setIsAiPowered] = useState<boolean>(true);
  const [noticeMsg, setNoticeMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Bulk Mode States
  const [bulkFilterClass, setBulkFilterClass] = useState<string>(selectedClass !== 'all' ? selectedClass : '');
  const [bulkFilterSection, setBulkFilterSection] = useState<string>(selectedSection !== 'all' ? selectedSection : 'all');
  const [overwriteExisting, setOverwriteExisting] = useState<boolean>(false);
  const [bulkProgress, setBulkProgress] = useState<number>(0);
  const [bulkResults, setBulkResults] = useState<{ [studentId: string]: { remarks: string; promotionStatus?: string; edited?: boolean } }>({});
  const [bulkStatusText, setBulkStatusText] = useState<string>('');
  const [isBulkCompleted, setIsBulkCompleted] = useState<boolean>(false);

  // Filter students for bulk mode
  const targetBulkStudents = React.useMemo(() => {
    let list = [...studentsList];
    if (bulkFilterClass && bulkFilterClass !== 'all') {
      list = list.filter(s => s.className.trim().toLowerCase() === bulkFilterClass.trim().toLowerCase());
    }
    if (bulkFilterSection && bulkFilterSection !== 'all') {
      list = list.filter(s => s.section.trim().toLowerCase() === bulkFilterSection.trim().toLowerCase());
    }
    return list;
  }, [studentsList, bulkFilterClass, bulkFilterSection]);

  // Unique classes and sections for dropdowns
  const availableClasses = React.useMemo(() => {
    const set = new Set(studentsList.map(s => s.className).filter(Boolean));
    return Array.from(set);
  }, [studentsList]);

  const availableSections = React.useMemo(() => {
    let list = studentsList;
    if (bulkFilterClass && bulkFilterClass !== 'all') {
      list = list.filter(s => s.className.trim().toLowerCase() === bulkFilterClass.trim().toLowerCase());
    }
    const set = new Set(list.map(s => s.section).filter(Boolean));
    return Array.from(set);
  }, [studentsList, bulkFilterClass]);

  // Get current student academic profile
  const currentProfile = React.useMemo(() => {
    if (!student) return null;
    const grades = studentGrades.find(g => g.studentId === student.id);
    return extractStudentAcademicProfile(
      student,
      grades,
      subjects,
      scoreColumns,
      gradeScales,
      term1Active,
      term2Active,
      term3Active
    );
  }, [student, studentGrades, subjects, scoreColumns, gradeScales, term1Active, term2Active, term3Active]);

  // Initial load when modal opens
  useEffect(() => {
    if (isOpen) {
      if (mode === 'single' && student) {
        setCustomEditedRemark(student.remarks || '');
        setPromotionSuggestion(student.promotionStatus || '');
        // If student already has remarks, keep it in editable box, and generate options if empty
        if (!student.remarks) {
          handleGenerateSingle();
        }
      } else if (mode === 'bulk') {
        if (!bulkFilterClass && availableClasses.length > 0) {
          setBulkFilterClass(availableClasses[0]);
        }
        setBulkResults({});
        setIsBulkCompleted(false);
      }
    }
  }, [isOpen, mode, student?.id]);

  if (!isOpen) return null;

  // Generate for single student
  const handleGenerateSingle = async () => {
    if (!student || !currentProfile) return;
    setIsLoading(true);
    setErrorMsg('');
    setNoticeMsg('');
    try {
      const res = await generateAiRemarkForStudent({
        student: currentProfile,
        tone,
        length,
        focusArea,
        customPrompt,
        schoolName,
      });

      if (res.success) {
        setIsAiPowered(res.isAiPowered !== false);
        if (res.notice) {
          setNoticeMsg(res.notice);
        }
        const opts = res.options && res.options.length > 0 ? res.options : [res.remarks];
        setGeneratedOptions(opts);
        setSelectedOptionIndex(0);
        setCustomEditedRemark(opts[0] || res.remarks);
        if (res.promotionStatus) {
          setPromotionSuggestion(res.promotionStatus);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate AI remarks. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Generate for bulk students
  const handleGenerateBulk = async () => {
    const list = overwriteExisting ? targetBulkStudents : targetBulkStudents.filter(s => !s.remarks);
    if (list.length === 0) {
      setErrorMsg('No students found matching the criteria or all students already have remarks. Enable "Overwrite existing remarks" if you want to replace them.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setNoticeMsg('');
    setBulkProgress(10);
    setBulkStatusText(`Preparing performance data for ${list.length} students...`);

    try {
      // Build profiles for all students
      const profiles: StudentAcademicSummary[] = list.map(std => {
        const grades = studentGrades.find(g => g.studentId === std.id);
        return extractStudentAcademicProfile(
          std,
          grades,
          subjects,
          scoreColumns,
          gradeScales,
          term1Active,
          term2Active,
          term3Active
        );
      });

      setBulkProgress(40);
      setBulkStatusText(`Generating personalized remarks with ${tone} tone...`);

      const res = await generateAiRemarksBatch({
        students: profiles,
        tone,
        length,
        focusArea,
        customPrompt,
        schoolName,
      });

      if (res.success && res.results) {
        setIsAiPowered(res.isAiPowered !== false);
        if (res.notice) {
          setNoticeMsg(res.notice);
        }
        setBulkProgress(90);
        setBulkStatusText(`Formatting and verifying remarks...`);

        const resultMap: { [studentId: string]: { remarks: string; promotionStatus?: string } } = {};
        res.results.forEach((item: BulkRemarkResultItem) => {
          resultMap[item.studentId] = {
            remarks: item.remarks,
            promotionStatus: item.promotionStatus,
          };
        });

        setBulkResults(resultMap);
        setIsBulkCompleted(true);
        setBulkProgress(100);
        setBulkStatusText(`Successfully generated remarks for ${res.results.length} students!`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate batch remarks.');
    } finally {
      setIsLoading(false);
    }
  };

  // Copy text to clipboard
  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Apply single student remark
  const handleApplySingle = () => {
    const finalRemark = customEditedRemark.trim();
    if (onApplySingleRemark) {
      onApplySingleRemark(finalRemark, applyPromotion ? promotionSuggestion : undefined);
    }
    onClose();
  };

  // Apply bulk remarks
  const handleApplyBulk = () => {
    if (!onApplyBulkRemarks) return;

    const updates: { studentId: string; remarks: string; promotionStatus?: string }[] = [];
    Object.entries(bulkResults).forEach(([stdId, data]: [string, { remarks: string; promotionStatus?: string; edited?: boolean }]) => {
      updates.push({
        studentId: stdId,
        remarks: data.remarks,
        promotionStatus: applyPromotion ? data.promotionStatus : undefined,
      });
    });

    onApplyBulkRemarks(updates);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto no-print">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/30 border border-indigo-400/40 flex items-center justify-center shadow-inner">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold tracking-tight">AI Report Card Remarks Assistant</h2>
                <span className="bg-amber-400/20 border border-amber-300/40 text-amber-200 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Bot className="w-3 h-3" /> Gemini 3.7
                </span>
              </div>
              <p className="text-xs text-indigo-200 mt-0.5">
                {mode === 'single' 
                  ? `Craft personalized teacher remarks for ${student?.name || 'student'}` 
                  : 'Auto-generate unique, contextual remarks for entire class'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-indigo-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-slate-800">
          
          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2.5 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Generation Notice</p>
                <p className="mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Info / Fallback Notice Banner */}
          {noticeMsg && (
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-start space-x-2.5 text-amber-900 text-xs">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-amber-950">High AI Traffic Status</p>
                <p className="mt-0.5 text-amber-800">{noticeMsg}</p>
              </div>
            </div>
          )}

          {/* SINGLE STUDENT VIEW */}
          {mode === 'single' && student && currentProfile && (
            <div className="space-y-5">
              {/* Student Overview Card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm flex items-center justify-center border border-indigo-200">
                    {student.name ? student.name.charAt(0).toUpperCase() : 'S'}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{student.name}</h3>
                    <p className="text-xs text-slate-500">
                      Class: <strong className="text-slate-700">{student.className} - {student.section}</strong> | Roll No: <strong className="text-slate-700">{student.rollNo || 'N/A'}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-center shadow-xs">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Percentage</div>
                    <div className="text-xs font-black text-indigo-700">{currentProfile.percentage}%</div>
                  </div>
                  <div className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-center shadow-xs">
                    <div className="text-[10px] text-slate-400 uppercase font-semibold">Grade</div>
                    <div className="text-xs font-black text-emerald-700">{currentProfile.grade}</div>
                  </div>
                  {currentProfile.attendance && (
                    <div className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-center shadow-xs">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Attendance</div>
                      <div className="text-xs font-bold text-slate-700">{currentProfile.attendance}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Controls Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tone Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Heart className="w-3.5 h-3.5 text-rose-500" /> Remark Tone & Style
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'encouraging', label: '🌟 Encouraging', desc: 'Positive & supportive' },
                      { id: 'formal', label: '🎓 Formal', desc: 'Official academic tone' },
                      { id: 'warm', label: '💖 Warm & Proud', desc: 'Joyful & appreciative' },
                      { id: 'improvement', label: '📈 Growth Focus', desc: 'Constructive feedback' },
                    ].map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTone(t.id as any)}
                        className={`p-2 rounded-lg text-left border text-xs transition-all ${
                          tone === t.id
                            ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 font-semibold ring-1 ring-indigo-500'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="font-bold">{t.label}</div>
                        <div className="text-[10px] text-slate-500">{t.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Length & Focus Area */}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-indigo-500" /> Desired Length
                    </label>
                    <div className="flex gap-2">
                      {[
                        { id: 'short', label: 'Short (1-2 lines)' },
                        { id: 'medium', label: 'Medium (2-3 lines)' },
                        { id: 'detailed', label: 'Detailed (3-4 lines)' },
                      ].map(l => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => setLength(l.id as any)}
                          className={`flex-1 py-1.5 px-2 rounded-lg border text-xs text-center transition-all ${
                            length === l.id
                              ? 'border-indigo-600 bg-indigo-600 text-white font-semibold shadow-xs'
                              : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-emerald-500" /> Teacher's Specific Note (Optional)
                    </label>
                    <input
                      type="text"
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="e.g. Highlight debate team captaincy, or needs daily maths practice"
                      className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Generate Trigger Button */}
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleGenerateSingle}
                  disabled={isLoading}
                  className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
                >
                  <Sparkles className={`w-4 h-4 ${isLoading ? 'animate-spin' : 'text-amber-300'}`} />
                  <span>{isLoading ? 'Generating Tailored AI Remarks...' : '✨ Generate AI Remarks'}</span>
                </button>
              </div>

              {/* Generated Suggestions */}
              {generatedOptions.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Generated Options (Click to select & edit)
                    </label>
                    <span className="text-[11px] text-slate-500">3 creative variations generated</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5">
                    {generatedOptions.map((option, idx) => {
                      const isSelected = selectedOptionIndex === idx;
                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            setSelectedOptionIndex(idx);
                            setCustomEditedRemark(option);
                          }}
                          className={`p-3.5 rounded-xl border text-xs cursor-pointer transition-all relative ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50/50 shadow-xs ring-1 ring-indigo-500'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5">
                              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                                isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {idx + 1}
                              </span>
                              <p className="text-slate-800 font-normal leading-relaxed italic">
                                &ldquo;{option}&rdquo;
                              </p>
                            </div>
                            <div className="flex items-center space-x-1 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopy(option, idx);
                                }}
                                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md"
                                title="Copy to clipboard"
                              >
                                {copiedIndex === idx ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Editable Final Remark Box */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Edit3 className="w-3.5 h-3.5 text-indigo-600" /> Final Remark for Report Card (Editable)
                      </label>
                      <span className="text-[10px] text-slate-400">You can customize the text freely</span>
                    </div>
                    <textarea
                      rows={3}
                      value={customEditedRemark}
                      onChange={(e) => setCustomEditedRemark(e.target.value)}
                      className="w-full p-3 border border-indigo-200 rounded-xl text-xs bg-indigo-50/20 text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 leading-relaxed outline-hidden"
                      placeholder="Selected remark will appear here for final adjustments..."
                    />
                  </div>

                  {/* Promotion Statement Suggestion */}
                  {promotionSuggestion && (
                    <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between gap-3">
                      <div className="flex items-center space-x-2.5">
                        <Award className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                            Recommended Promotion Statement
                          </div>
                          <input
                            type="text"
                            value={promotionSuggestion}
                            onChange={(e) => setPromotionSuggestion(e.target.value)}
                            className="bg-transparent border-b border-emerald-300 text-xs font-semibold text-emerald-950 focus:outline-hidden w-full max-w-md"
                          />
                        </div>
                      </div>
                      <label className="flex items-center space-x-1.5 text-xs text-emerald-900 font-medium cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={applyPromotion}
                          onChange={(e) => setApplyPromotion(e.target.checked)}
                          className="rounded-sm border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>Apply Promotion</span>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* BULK / CLASS MODE VIEW */}
          {mode === 'bulk' && (
            <div className="space-y-5">
              {/* Class & Filter Bar */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Target Class</label>
                  <select
                    value={bulkFilterClass}
                    onChange={(e) => {
                      setBulkFilterClass(e.target.value);
                      setBulkResults({});
                      setIsBulkCompleted(false);
                    }}
                    className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
                  >
                    <option value="all">All Classes</option>
                    {availableClasses.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500">Target Section</label>
                  <select
                    value={bulkFilterSection}
                    onChange={(e) => {
                      setBulkFilterSection(e.target.value);
                      setBulkResults({});
                      setIsBulkCompleted(false);
                    }}
                    className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800"
                  >
                    <option value="all">All Sections</option>
                    {availableSections.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col justify-end">
                  <div className="text-xs text-slate-600 font-semibold">
                    Matching Students: <strong className="text-indigo-600 font-bold">{targetBulkStudents.length}</strong>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Without remarks: {targetBulkStudents.filter(s => !s.remarks).length}
                  </div>
                </div>
              </div>

              {/* Bulk Parameters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Remark Tone</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 'encouraging', label: '🌟 Encouraging' },
                      { id: 'formal', label: '🎓 Formal' },
                      { id: 'warm', label: '💖 Warm' },
                      { id: 'improvement', label: '📈 Growth' },
                    ].map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTone(t.id as any)}
                        className={`py-1.5 px-2.5 rounded-lg border text-xs text-left transition-all ${
                          tone === t.id
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-semibold'
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Desired Length</label>
                    <div className="flex gap-2">
                      {['short', 'medium', 'detailed'].map(l => (
                        <button
                          key={l}
                          type="button"
                          onClick={() => setLength(l as any)}
                          className={`flex-1 py-1 px-2 rounded-lg border text-xs capitalize ${
                            length === l
                              ? 'border-indigo-600 bg-indigo-600 text-white font-semibold'
                              : 'border-slate-200 bg-white text-slate-700'
                          }`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center space-x-2 text-xs text-slate-700 font-medium cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={overwriteExisting}
                      onChange={(e) => setOverwriteExisting(e.target.checked)}
                      className="rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Overwrite existing remarks for all students</span>
                  </label>
                </div>
              </div>

              {/* Bulk Generation Progress & Trigger */}
              <div className="pt-2">
                {isLoading && (
                  <div className="mb-4 space-y-2">
                    <div className="flex justify-between text-xs font-medium text-slate-600">
                      <span>{bulkStatusText}</span>
                      <span>{bulkProgress}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-300"
                        style={{ width: `${bulkProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleGenerateBulk}
                  disabled={isLoading || targetBulkStudents.length === 0}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
                >
                  <Sparkles className={`w-4 h-4 ${isLoading ? 'animate-spin' : 'text-amber-300'}`} />
                  <span>
                    {isLoading
                      ? 'Generating AI Remarks in Progress...'
                      : `✨ Generate AI Remarks for All ${targetBulkStudents.length} Students`}
                  </span>
                </button>
              </div>

              {/* Bulk Results Table & Review */}
              {isBulkCompleted && Object.keys(bulkResults).length > 0 && (
                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <h4 className="text-xs font-bold text-slate-900">
                        Generated Remarks Preview ({Object.keys(bulkResults).length} Students)
                      </h4>
                    </div>
                    <span className="text-[11px] text-slate-500">Review or tweak before saving</span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto divide-y divide-slate-100">
                    {targetBulkStudents.map((std) => {
                      const res = bulkResults[std.id];
                      if (!res) return null;

                      return (
                        <div key={std.id} className="p-3 bg-white hover:bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                          <div className="w-full sm:w-48 shrink-0">
                            <div className="font-bold text-slate-900">{std.name}</div>
                            <div className="text-[10px] text-slate-500">
                              Roll: {std.rollNo || '-'} | Class: {std.className}-{std.section}
                            </div>
                          </div>

                          <div className="flex-1 w-full">
                            <textarea
                              rows={2}
                              value={res.remarks}
                              onChange={(e) => {
                                setBulkResults({
                                  ...bulkResults,
                                  [std.id]: { ...res, remarks: e.target.value, edited: true }
                                });
                              }}
                              className="w-full p-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 leading-snug"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center space-x-3">
            {mode === 'single' ? (
              <button
                type="button"
                onClick={handleApplySingle}
                disabled={!customEditedRemark.trim()}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center space-x-2 transition-all disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>Apply Remark to Student</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleApplyBulk}
                disabled={!isBulkCompleted || Object.keys(bulkResults).length === 0}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center space-x-2 transition-all disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>Save All Remarks to Students ({Object.keys(bulkResults).length})</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
