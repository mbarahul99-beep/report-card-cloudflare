import React, { useState, useMemo } from 'react';
import { Student, StudentGrades, ScoreColumn, SubjectColumn, SaasTeacher, SchoolBranding, ReportCardStructure, SchoolClassItem } from '../types';
import { BookOpen, ClipboardList, Layers, Sliders, CheckCircle, ChevronRight, AlertCircle, Award, ArrowUp, ArrowDown } from 'lucide-react';
import { classesMatch, getCanonicalClassName, matchStructureForStudent, getSectionsForClass } from '../utils/classNormalizer';

interface SubjectMarksEntryProps {
  students: Student[];
  studentGrades: StudentGrades[];
  scoreColumns: ScoreColumn[];
  subjects: SubjectColumn[];
  currentRole: 'main_admin' | 'school_admin' | 'class_teacher' | 'parent' | null;
  activeTeacherObj: SaasTeacher | null;
  branding: SchoolBranding;
  reportCardStructures?: ReportCardStructure[];
  onUpdateGrades: (updated: StudentGrades[]) => void;
  isReadOnly?: boolean;
  selectedSession?: string;
  onRestoreSession?: (session: string) => void;
  schoolClasses?: SchoolClassItem[];
}

interface ClassSubjectItem {
  className: string;
  section: string;
  subjectId: string;
  subjectName: string;
}

export default function SubjectMarksEntry({
  students = [],
  studentGrades = [],
  scoreColumns = [],
  subjects = [],
  currentRole,
  activeTeacherObj,
  branding,
  reportCardStructures = [],
  onUpdateGrades,
  isReadOnly = false,
  selectedSession = "",
  onRestoreSession,
  schoolClasses = []
}: SubjectMarksEntryProps) {
  
  // Selected assignment config
  const [selectedClassSubject, setSelectedClassSubject] = useState<ClassSubjectItem | null>(null);

  // Smoothly scroll window to top when selected subject is updated/loaded to put entry workspace in view
  React.useEffect(() => {
    if (selectedClassSubject) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedClassSubject]);
  const [selectedTerm, setSelectedTerm] = useState<'term1' | 'term2' | 'term3'>('term1');
  const [selectedColId, setSelectedColId] = useState<string>('');
  const [activeSection, setActiveSection] = useState<string>('');
  
  // School Admin selection states
  const [adminSelectedClass, setAdminSelectedClass] = useState<string>('');
  const [adminSelectedSection, setAdminSelectedSection] = useState<string>('All');
  
  // Status feedback
  const [successMsg, setSuccessMsg] = useState('');

  // Helper values for School Admin class/section selection
  const allUniqueClasses = useMemo(() => {
    if (schoolClasses && schoolClasses.length > 0) {
      return schoolClasses.map(c => c.name);
    }
    return Array.from(new Set(students.map(s => s.className).filter(Boolean))).sort();
  }, [schoolClasses, students]);

  const allSectionsForAdminClass = useMemo(() => {
    if (!adminSelectedClass) return ['All'];
    const secs = getSectionsForClass(adminSelectedClass, schoolClasses, students, reportCardStructures);
    return ['All', ...secs];
  }, [schoolClasses, students, reportCardStructures, adminSelectedClass]);

  const matchedStructure = useMemo(() => {
    if (!selectedClassSubject || !reportCardStructures) return null;
    return matchStructureForStudent(reportCardStructures, selectedClassSubject.className, selectedClassSubject.section || activeSection);
  }, [selectedClassSubject, activeSection, reportCardStructures]);

  // Resolve if the selected class is Grade-only based
  const isPureGradeBased = useMemo(() => {
    return !!matchedStructure?.pureGradeBased;
  }, [matchedStructure]);

  // Resolve branding based on selected class's structure if available
  const resolvedBranding = useMemo(() => {
    return matchedStructure?.branding || branding;
  }, [matchedStructure, branding]);

  const resolvedScoreColumns = useMemo(() => {
    if (matchedStructure?.termSpecificScoreColumnsEnabled) {
      if (selectedTerm === 'term1' && matchedStructure.term1ScoreColumns && matchedStructure.term1ScoreColumns.length > 0) {
        return matchedStructure.term1ScoreColumns;
      }
      if (selectedTerm === 'term2' && matchedStructure.term2ScoreColumns && matchedStructure.term2ScoreColumns.length > 0) {
        return matchedStructure.term2ScoreColumns;
      }
      if (selectedTerm === 'term3' && matchedStructure.term3ScoreColumns && matchedStructure.term3ScoreColumns.length > 0) {
        return matchedStructure.term3ScoreColumns;
      }
    }
    return matchedStructure?.scoreColumns && matchedStructure.scoreColumns.length > 0 
      ? matchedStructure.scoreColumns 
      : scoreColumns;
  }, [matchedStructure, scoreColumns, selectedTerm]);

  const resolvedSubjectsForClass = useMemo(() => {
    return matchedStructure?.subjects && matchedStructure.subjects.length > 0
      ? matchedStructure.subjects
      : subjects;
  }, [matchedStructure, subjects]);

  // Find all unique sections for the selected class
  const classSections = useMemo(() => {
    if (!selectedClassSubject) return [];
    const cls = selectedClassSubject.className.toLowerCase().trim();
    
    // Find matching sections from students list belonging to this class
    const foundSections = Array.from(
      new Set(
        students
          .filter(s => s.className.toLowerCase().trim() === cls)
          .map(s => s.section && s.section.trim())
          .filter(Boolean)
      )
    ).sort();
    
    // If the teacher has a specific section assigned (not 'All'), we restrict it to that.
    if (selectedClassSubject.section && selectedClassSubject.section !== 'All') {
      return [selectedClassSubject.section];
    }
    
    return foundSections.length > 0 ? foundSections : ['A'];
  }, [students, selectedClassSubject]);

  // Sync selected section when classSections updates
  React.useEffect(() => {
    if (classSections.length > 0) {
      if (!activeSection || !classSections.includes(activeSection)) {
        setActiveSection(classSections[0]);
      }
    } else {
      setActiveSection('');
    }
  }, [classSections, activeSection]);

  // Extract scholastic subjects
  const scholasticSubjects = useMemo(() => {
    return resolvedSubjectsForClass.filter(s => s.type === 'scholastic');
  }, [resolvedSubjectsForClass]);

  // Set default exam column if not selected or if previous selected is invalid in resolvedScoreColumns
  React.useEffect(() => {
    if (resolvedScoreColumns.length > 0) {
      const exists = resolvedScoreColumns.some(col => col.id === selectedColId);
      if (!exists) {
        setSelectedColId(resolvedScoreColumns[0].id);
      }
    }
  }, [resolvedScoreColumns, selectedColId]);

  // Calculate the list of class & subject allocations assigned to the current user
  const assignedList = useMemo((): ClassSubjectItem[] => {
    const list: ClassSubjectItem[] = [];

    // Extract all unique classes registered in school database as options
    const allUniqueClasses = Array.from(new Set(students.map(s => s.className).filter(Boolean)));
    const allUniqueSectionsByClass: { [className: string]: string[] } = {};
    students.forEach(s => {
      if (!allUniqueSectionsByClass[s.className]) {
        allUniqueSectionsByClass[s.className] = [];
      }
      if (s.section && !allUniqueSectionsByClass[s.className].includes(s.section)) {
        allUniqueSectionsByClass[s.className].push(s.section);
      }
    });

    if (currentRole === 'school_admin') {
      // If no adminSelectedClass is chosen, return empty list (do not show subjects by default)
      if (!adminSelectedClass) {
        return [];
      }
      const matched = matchStructureForStudent(reportCardStructures, adminSelectedClass, adminSelectedSection);
      const resolvedClassSubjects = matched?.subjects && matched.subjects.length > 0 ? matched.subjects : subjects;

      resolvedClassSubjects.forEach(sub => {
        list.push({
          className: adminSelectedClass,
          section: adminSelectedSection,
          subjectId: sub.id,
          subjectName: sub.name
        });
      });
    } else if (currentRole === 'class_teacher' && activeTeacherObj) {
      // 1. Is Class Teacher? Add all subjects of their class
      const isLegacy = activeTeacherObj.isClassTeacher === undefined && activeTeacherObj.isSubjectTeacher === undefined;
      const cleanIsClassTeacher = isLegacy ? true : !!activeTeacherObj.isClassTeacher;
      const classTClass = isLegacy ? activeTeacherObj.assignedClass : activeTeacherObj.classTeacherClass;
      const classTSection = isLegacy ? activeTeacherObj.assignedSection : activeTeacherObj.classTeacherSection;

      if (cleanIsClassTeacher && classTClass) {
        const matched = matchStructureForStudent(reportCardStructures, classTClass, classTSection);
        const resolvedClassSubjects = matched?.subjects && matched.subjects.length > 0 ? matched.subjects : subjects;

        resolvedClassSubjects.forEach(sub => {
          list.push({
            className: classTClass,
            section: classTSection || 'All',
            subjectId: sub.id,
            subjectName: sub.name
          });
        });
      }

      // 2. Is Subject/Co-curricular Teacher? Add specific assigned rows
      const cleanIsSubjectTeacher = !!activeTeacherObj.isSubjectTeacher;
      const teacherAssignments = activeTeacherObj.subjectAssignments || [];

      if (cleanIsSubjectTeacher) {
        teacherAssignments.forEach(asg => {
          const matched = matchStructureForStudent(reportCardStructures, asg.className, asg.section);
          const resolvedClassSubjects = matched?.subjects && matched.subjects.length > 0 ? matched.subjects : subjects;

          asg.subjects?.forEach(subId => {
            const matchedSub = resolvedClassSubjects.find(sub => sub.id === subId);
            if (matchedSub) {
              // Add to list if not already duplicated exactly
              const alreadyExists = list.some(item => 
                item.className.toLowerCase() === asg.className.toLowerCase() &&
                item.section.toLowerCase() === asg.section.toLowerCase() &&
                item.subjectId === subId
              );
              if (!alreadyExists) {
                list.push({
                  className: asg.className,
                  section: asg.section || 'All',
                  subjectId: subId,
                  subjectName: matchedSub.name
                });
              }
            }
          });
        });
      }
    }

    return list;
  }, [students, subjects, currentRole, activeTeacherObj, adminSelectedClass, adminSelectedSection, reportCardStructures]);

  // Selected exam column configuration
  const selectedColumnObj = useMemo(() => {
    return resolvedScoreColumns.find(c => c.id === selectedColId) || null;
  }, [resolvedScoreColumns, selectedColId]);

  // Filter students based on selected class + section
  const targetStudents = useMemo(() => {
    if (!selectedClassSubject) return [];
    
    return students.filter(s => {
      const matchClass = s.className.toLowerCase().trim() === selectedClassSubject.className.toLowerCase().trim();
      if (!matchClass) return false;

      // Section check is now strictly against activeSection state!
      if (!activeSection) return false;
      return s.section && s.section.toLowerCase().trim() === activeSection.toLowerCase().trim();
    }).sort((a, b) => {
      // Sort numerically by roll number if possible, else alphabetically
      const rA = parseInt(a.rollNo) || 0;
      const rB = parseInt(b.rollNo) || 0;
      if (rA && rB) return rA - rB;
      return a.name.localeCompare(b.name);
    });
  }, [students, selectedClassSubject, activeSection]);

  // Handle single marks change for a student in this list
  const handleMarkChange = (studentId: string, valueStr: string) => {
    const isTermActive = selectedTerm === 'term1' 
      ? (resolvedBranding?.term1Enabled !== false)
      : selectedTerm === 'term2'
        ? (resolvedBranding?.term2Enabled !== false)
        : (resolvedBranding?.term3Enabled === true);
    if (!isTermActive) return;

    if (!selectedClassSubject) return;
    const { subjectId } = selectedClassSubject;
    const targetSub = resolvedSubjectsForClass.find(sub => sub.id === subjectId);
    const subType = targetSub ? targetSub.type : 'scholastic';

    const updatedGrades = [...studentGrades];
    const index = updatedGrades.findIndex(g => g.studentId === studentId);

    if (index >= 0) {
      const gObj = { ...updatedGrades[index] };
      if (subType === 'scholastic' || subType === 'additional') {
        const val = valueStr === '' 
          ? '' 
          : isPureGradeBased 
            ? valueStr 
            : (isNaN(parseFloat(valueStr)) ? 0 : Math.max(0, parseFloat(valueStr)));
        const currentScholastic = gObj.scholastic ? { ...gObj.scholastic } : {};
        if (!currentScholastic[subjectId]) {
          currentScholastic[subjectId] = { term1: {}, term2: {}, term3: {} };
        }
        
        const subScore = currentScholastic[subjectId];
        if (!subScore[selectedTerm]) {
          subScore[selectedTerm] = {};
        }

        subScore[selectedTerm][selectedColId] = val;
        gObj.scholastic = currentScholastic;
      } else if (subType === 'co_scholastic') {
        const currentCo = gObj.co_scholastic ? { ...gObj.co_scholastic } : {};
        currentCo[subjectId] = {
          term1: currentCo[subjectId]?.term1 || 'A',
          term2: currentCo[subjectId]?.term2 || 'A',
          term3: currentCo[subjectId]?.term3 || 'A',
          [selectedTerm]: valueStr || 'A'
        };
        gObj.co_scholastic = currentCo;
      } else if (subType === 'activity') {
        const currentAct = gObj.activity ? { ...gObj.activity } : {};
        currentAct[subjectId] = {
          term1: currentAct[subjectId]?.term1 || 'A',
          term2: currentAct[subjectId]?.term2 || 'A',
          term3: currentAct[subjectId]?.term3 || 'A',
          [selectedTerm]: valueStr || 'A'
        };
        gObj.activity = currentAct;
      }
      updatedGrades[index] = gObj;
    } else {
      // Create new grade document for this student
      const emptyScholastic: { [subId: string]: any } = {};
      const emptyCoScholastic: { [subId: string]: any } = {};
      const emptyActivity: { [subId: string]: any } = {};

      if (subType === 'scholastic' || subType === 'additional') {
        const val = valueStr === '' 
          ? '' 
          : isPureGradeBased 
            ? valueStr 
            : (isNaN(parseFloat(valueStr)) ? 0 : Math.max(0, parseFloat(valueStr)));
        emptyScholastic[subjectId] = { term1: {}, term2: {}, term3: {} };
        if (!emptyScholastic[subjectId][selectedTerm]) {
          emptyScholastic[subjectId][selectedTerm] = {};
        }
        emptyScholastic[subjectId][selectedTerm][selectedColId] = val;
      } else if (subType === 'co_scholastic') {
        emptyCoScholastic[subjectId] = { term1: 'A', term2: 'A', term3: 'A' };
        emptyCoScholastic[subjectId][selectedTerm] = valueStr || 'A';
      } else if (subType === 'activity') {
        emptyActivity[subjectId] = { term1: 'A', term2: 'A', term3: 'A' };
        emptyActivity[subjectId][selectedTerm] = valueStr || 'A';
      }

      updatedGrades.push({
        studentId,
        scholastic: emptyScholastic,
        co_scholastic: emptyCoScholastic,
        activity: emptyActivity,
        attendance: { term1: '', term2: '', term3: '' }
      });
    }

    onUpdateGrades(updatedGrades);
    setSuccessMsg('Scores saved is real-time cloud registry');
    setTimeout(() => setSuccessMsg(''), 2500);
  };

  // Up/Down Arrow keyboard navigation controller
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextInput = document.getElementById(`fast_marks_field_${index + 1}`);
      if (nextInput) {
        (nextInput as HTMLInputElement).focus();
        (nextInput as HTMLInputElement).select();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (index > 0) {
        const prevInput = document.getElementById(`fast_marks_field_${index - 1}`);
        if (prevInput) {
          (prevInput as HTMLInputElement).focus();
          (prevInput as HTMLInputElement).select();
        }
      }
    }
  };

  const isTermActive = selectedTerm === 'term1' 
    ? (resolvedBranding?.term1Enabled !== false)
    : selectedTerm === 'term2'
      ? (resolvedBranding?.term2Enabled !== false)
      : (resolvedBranding?.term3Enabled === true);

  return (
    <div className="bg-white rounded-2xl border border-gray-150 shadow-xs p-2.5 sm:p-6 space-y-4 sm:space-y-6 mx-0.5 sm:mx-0">
      
      {isReadOnly && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3 shadow-sm no-print">
          <span className="text-xl shrink-0 select-none">📂</span>
          <div className="space-y-1 text-left flex-grow">
            <h4 className="text-xs font-black uppercase text-indigo-950 tracking-wide">Historical Archive Viewer (Read-Only)</h4>
            <p className="text-[11px] text-indigo-800 leading-normal font-sans">
              You are currently inspecting exam grades for <strong>{selectedSession || "an archived session"}</strong>. Mark updates and database saves are disabled in historical mode.
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

      {/* Title block */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-gray-100 pb-3">
        <div>
          <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 flex items-center gap-2 uppercase tracking-wide">
            <ClipboardList className="w-4 h-4 text-emerald-600 animate-pulse" />
            Subject Wise Fast Marks Entry Panel
          </h3>
          <p className="text-[10px] sm:text-[11px] text-gray-500">
            Select an assigned class subject, then quickly fill up scores marks using the computer keyboard. Press <strong>UP ↑</strong> or <strong>DOWN ↓</strong> arrows to traverse boxes instantly.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isTermActive && (
            <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              FORMAT LOCKED
            </span>
          )}
          {successMsg ? (
            <span className="bg-emerald-50 text-emerald-800 border border-emerald-100 text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 animate-fadeIn font-mono self-start sm:self-auto">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {successMsg}
            </span>
          ) : (
            isTermActive && (
              <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                READY FOR INPUT
              </span>
            )
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8">
        
        {/* Left Side: Select Class & Subject List */}
        <div className="lg:col-span-4 space-y-3.5">
          {currentRole === 'school_admin' && (
            <div className="bg-white border border-gray-150 p-4 rounded-xl space-y-3 shadow-2xs">
              <h4 className="font-bold text-[10.5px] uppercase tracking-wider text-slate-705 flex items-center gap-1.5 border-b border-gray-100 pb-2">
                <Sliders className="w-3.5 h-3.5 text-indigo-600 font-extrabold animate-pulse" />
                Select Class & Section
              </h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1" htmlFor="admin-select-class">Assigned Class</label>
                  <select
                    id="admin-select-class"
                    value={adminSelectedClass}
                    onChange={(e) => {
                      const newClass = e.target.value;
                      setAdminSelectedClass(newClass);
                      setSelectedClassSubject(null);
                      setAdminSelectedSection('All');
                    }}
                    className="w-full px-3 py-2 text-xs border border-gray-150 bg-white rounded-lg outline-none font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">-- Choose Class --</option>
                    {allUniqueClasses.map(cls => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>

                {adminSelectedClass && (
                  <div>
                    <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1" htmlFor="admin-select-section">Assigned Section</label>
                    <select
                      id="admin-select-section"
                      value={adminSelectedSection}
                      onChange={(e) => {
                        const newSection = e.target.value;
                        setAdminSelectedSection(newSection);
                        if (selectedClassSubject) {
                          setSelectedClassSubject({
                            ...selectedClassSubject,
                            section: newSection
                          });
                        }
                      }}
                      className="w-full px-3 py-2 text-xs border border-gray-150 bg-white rounded-lg outline-none font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500/20"
                    >
                      {allSectionsForAdminClass.map(sec => (
                        <option key={sec} value={sec}>{sec === 'All' ? 'All Sections' : `Section ${sec}`}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="bg-slate-50 border border-slate-150/80 p-4 rounded-xl space-y-3">
            <h4 className="font-bold text-[10.5px] uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              Your Assigned Subject List
            </h4>

            {currentRole === 'school_admin' && !adminSelectedClass ? (
              <div className="py-6 px-3 text-center text-xs text-slate-400 font-medium italic space-y-1 bg-white rounded-lg border border-gray-150 shadow-2xs">
                <p className="text-slate-500 font-bold text-[11px]">No subjects shown by default</p>
                <p className="text-[10px] text-gray-400">Please select a Class first to view and edit its subjects one-by-one.</p>
              </div>
            ) : assignedList.length === 0 ? (
              <div className="p-4 text-center text-xs text-gray-400 font-medium italic">
                No subjects assigned. Please contact the administrator.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
                {assignedList.map((item, idx) => {
                  const isSelected = selectedClassSubject && 
                    selectedClassSubject.className === item.className &&
                    selectedClassSubject.section === item.section &&
                    selectedClassSubject.subjectId === item.subjectId;

                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedClassSubject(item);
                        // Focus first input box if loaded
                        setTimeout(() => {
                          const firstInput = document.getElementById('fast_marks_field_0');
                          if (firstInput) {
                            (firstInput as HTMLInputElement).focus();
                            (firstInput as HTMLInputElement).select();
                          }
                        }, 100);
                      }}
                      className={`w-full text-left p-2.5 rounded-lg border text-xs transition-all flex items-center justify-between group cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/10 font-bold scale-[1.01]'
                          : 'bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 border-gray-150 shadow-2xs'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold flex items-center gap-1.5">
                          <BookOpen className={`w-3.5 h-3.5 ${isSelected ? 'text-white' : 'text-indigo-600'}`} />
                          {item.subjectName}
                        </div>
                        <div className={`text-[10px] font-mono ${isSelected ? 'text-indigo-100' : 'text-gray-500'}`}>
                          {getCanonicalClassName(item.className, schoolClasses)} (Sec {item.section})
                        </div>
                      </div>
                      <ChevronRight className={`w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl space-y-1.5">
            <h5 className="text-[11px] font-bold text-indigo-950 uppercase flex items-center gap-1">
              <span className="text-[12px]">💡</span> Tips for Teachers
            </h5>
            <ul className="text-[10px] text-indigo-900/80 space-y-1 leading-relaxed list-disc list-inside">
              <li>Changes are saved <strong>instantly</strong> in real-time.</li>
              <li>Press <strong>Enter</strong> to jump down or specify digits directly.</li>
              <li>Values are checked against dynamic exam <strong>Max Marks</strong> parameters.</li>
            </ul>
          </div>
        </div>

        {/* Right Side: Marks Spreadsheet Editor */}
        <div className="lg:col-span-8 space-y-4">
          
          {selectedClassSubject ? (
            <div className="space-y-4">
              
              {/* Select Term & Exam Filters */}
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                
                {/* Active Info */}
                <div>
                  <h4 className="text-xs font-black text-slate-800 uppercase">
                    {getCanonicalClassName(selectedClassSubject.className, schoolClasses)} (Section {activeSection || 'N/A'}) - {selectedClassSubject.subjectName}
                  </h4>
                  <p className="text-[10px] text-indigo-600 font-semibold mt-0.5">
                    Viewing {targetStudents.length} registered students
                  </p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2.5">
                  
                  {/* Section Select */}
                  {classSections.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Section</span>
                      <select
                        value={activeSection}
                        onChange={(e) => setActiveSection(e.target.value)}
                        className="px-2.5 py-1 text-xs border border-gray-200 bg-white rounded-lg outline-none font-bold text-slate-700"
                        id="select-subject-marks-section"
                      >
                        {classSections.map(sec => (
                          <option key={sec} value={sec}>Section {sec}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Term Select */}
                  <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-gray-200">
                    <button
                      onClick={() => setSelectedTerm('term1')}
                      className={`px-2 py-1 text-[10px] font-bold rounded ${
                        selectedTerm === 'term1'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {resolvedBranding.term1Label || 'Term 1'}
                    </button>
                    <button
                      onClick={() => setSelectedTerm('term2')}
                      className={`px-2 py-1 text-[10px] font-bold rounded ${
                        selectedTerm === 'term2'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {resolvedBranding.term2Label || 'Term 2'}
                    </button>
                    {resolvedBranding.term3Enabled === true && (
                      <button
                        onClick={() => setSelectedTerm('term3')}
                        className={`px-2 py-1 text-[10px] font-bold rounded ${
                          selectedTerm === 'term3'
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {resolvedBranding.term3Label || 'Term 3'}
                      </button>
                    )}
                  </div>

                   {/* Exam selection */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Exam Column</span>
                    <select
                      value={selectedColId}
                      onChange={(e) => setSelectedColId(e.target.value)}
                      className="px-2.5 py-1 text-xs border border-gray-200 bg-white rounded-lg outline-none font-bold text-slate-700"
                    >
                      {resolvedScoreColumns.map(col => {
                        const isMidTerm = col.id === 'mid_term' || col.id === 'mid-term' || col.name.toLowerCase() === 'mid-term';
                        const colName = (selectedTerm === 'term2' && isMidTerm) ? 'Annual' : col.name;
                        const targetSub = resolvedSubjectsForClass.find(sub => sub.id === selectedClassSubject.subjectId);
                        const colMax = targetSub?.customMaxMarks?.[col.id] ?? col.maxMarks;
                        return (
                          <option key={col.id} value={col.id}>
                            {colName}
                            {!isPureGradeBased && ` (Max ${colMax})`}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                </div>

              </div>

              {/* Term Inactive Alert Banner */}
              {!isTermActive && (
                <div className="bg-amber-50 border border-amber-250 p-3 rounded-lg flex items-start gap-2.5 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 animate-bounce" />
                  <div>
                    <h5 className="font-bold text-xs text-amber-805 uppercase tracking-wide">Scores Upload Locked</h5>
                    <p className="text-[10px] sm:text-[11px] text-amber-700 leading-relaxed mt-0.5">
                      The active format has disabled <strong>{selectedTerm === 'term1' ? (resolvedBranding.term1Label || 'Term 1') : selectedTerm === 'term2' ? (resolvedBranding.term2Label || 'Term 2') : (resolvedBranding.term3Label || 'Term 3')}</strong> for this report. You cannot add or edit marks for inactive terms. Enable this term under the <strong>School Identity branding settings</strong> to unlock.
                    </p>
                  </div>
                </div>
              )}

              {/* Student spreadsheet list */}
              {targetStudents.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-gray-200 text-gray-400 italic text-xs">
                  No students registered in "{getCanonicalClassName(selectedClassSubject.className, schoolClasses)}" Section "{selectedClassSubject.section || 'All'}" yet. Manage records in Student Registry.
                </div>
              ) : (
                <div className="border border-gray-150 rounded-xl overflow-x-auto shadow-2xs">
                  <table className="w-full border-collapse text-left text-xs bg-white">
                     <thead>
                      <tr className="bg-slate-50 text-slate-655 font-bold border-b border-slate-150">
                        <th className="p-2 sm:p-3 text-center w-12 hidden md:table-cell">S.No</th>
                        <th className="p-2 sm:p-3 text-center w-14 sm:w-16">Roll No</th>
                        <th className="p-2 sm:p-3">Student Name</th>
                        <th className="p-2 sm:p-3 text-center w-28 sm:w-36 bg-indigo-50/20 text-indigo-950 font-black">
                          {(() => {
                            const targetSub = resolvedSubjectsForClass.find(sub => sub.id === selectedClassSubject.subjectId);
                            const subType = targetSub ? targetSub.type : 'scholastic';
                            return (subType === 'scholastic' || subType === 'additional') 
                              ? (isPureGradeBased ? `Grade Input (${selectedColumnObj?.name || 'Exam'})` : `Marks Input (${selectedColumnObj?.name || 'Exam'})`)
                              : `Grade Input (${selectedTerm === 'term1' ? (resolvedBranding.term1Label || 'Term 1') : selectedTerm === 'term2' ? (resolvedBranding.term2Label || 'Term 2') : (resolvedBranding.term3Label || 'Term 3')})`;
                          })()}
                          {(() => {
                            const targetSub = resolvedSubjectsForClass.find(sub => sub.id === selectedClassSubject.subjectId);
                            const subType = targetSub ? targetSub.type : 'scholastic';
                            const maxMarksLimit = targetSub?.customMaxMarks?.[selectedColId] ?? selectedColumnObj?.maxMarks ?? 100;
                            return (subType === 'scholastic' || subType === 'additional') && !isPureGradeBased && selectedColumnObj && (
                              <span className="block text-[8.5px] text-indigo-600 font-mono font-medium">Max {maxMarksLimit}</span>
                            );
                          })()}
                        </th>
                        <th className="p-2 sm:p-3 text-center w-20 hidden sm:table-cell">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150">
                      {targetStudents.map((stud, idx) => {
                        // Retrieve current scores or grades dynamically
                        const gradesObj = studentGrades.find(g => g.studentId === stud.id);
                        const targetSub = resolvedSubjectsForClass.find(sub => sub.id === selectedClassSubject.subjectId);
                        const subType = targetSub ? targetSub.type : 'scholastic';
                        
                        let currentMark = '';
                        if (subType === 'scholastic' || subType === 'additional') {
                          const scholasticData = gradesObj?.scholastic?.[selectedClassSubject.subjectId] || {};
                          const rawVal = scholasticData[selectedTerm]?.[selectedColId];
                          currentMark = (rawVal !== undefined && rawVal !== null && rawVal !== '' && String(rawVal) !== '0' && String(rawVal) !== '0.0')
                            ? String(rawVal)
                            : '';
                        } else if (subType === 'co_scholastic') {
                          const coData = gradesObj?.co_scholastic?.[selectedClassSubject.subjectId] || {};
                          const rawVal = coData[selectedTerm];
                          currentMark = (rawVal !== undefined && rawVal !== null && rawVal !== '' && String(rawVal) !== '0' && String(rawVal) !== '0.0') ? String(rawVal) : '';
                        } else if (subType === 'activity') {
                          const actData = gradesObj?.activity?.[selectedClassSubject.subjectId] || {};
                          const rawVal = actData[selectedTerm];
                          currentMark = (rawVal !== undefined && rawVal !== null && rawVal !== '' && String(rawVal) !== '0' && String(rawVal) !== '0.0') ? String(rawVal) : '';
                        }

                        const maxMarksLimit = targetSub?.customMaxMarks?.[selectedColId] ?? selectedColumnObj?.maxMarks ?? 100;
                        const isOverLimit = !isPureGradeBased && (subType === 'scholastic' || subType === 'additional') && selectedColumnObj && currentMark !== '' && Number(currentMark) > maxMarksLimit;

                        return (
                          <tr key={stud.id} className="hover:bg-slate-50/50 transition-colors align-middle">
                            <td className="p-2 sm:p-3 font-mono text-center text-slate-400 hidden md:table-cell">
                              {idx + 1}
                            </td>
                            <td className="p-2 sm:p-3 font-mono text-center font-bold text-slate-700 bg-slate-50/20 text-xs sm:text-sm">
                              {stud.rollNo || idx + 1}
                            </td>
                            <td className="p-2 sm:p-3 font-bold text-slate-800 text-xs sm:text-sm">
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                {stud.photoUrl ? (
                                  <img
                                    referrerPolicy="no-referrer"
                                    src={stud.photoUrl} 
                                    className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover border border-slate-200" 
                                    alt="" 
                                  />
                                ) : (
                                  <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-slate-150 text-[9px] sm:text-[10px] flex items-center justify-center font-black text-slate-600 shrink-0">
                                    {stud.name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <span className="truncate max-w-[105px] sm:max-w-none">{stud.name}</span>
                              </div>
                            </td>
                            <td className="p-1.5 sm:p-2.5 text-center bg-indigo-50/10 border-x border-slate-100">
                              <div className="flex items-center justify-center gap-1 sm:gap-2">
                                <input
                                  type="text"
                                  id={`fast_marks_field_${idx}`}
                                  value={currentMark}
                                  placeholder={isReadOnly ? "Archived" : isTermActive ? "-" : "Locked"}
                                  disabled={!isTermActive || isReadOnly}
                                  onKeyDown={(e) => handleInputKeyDown(e, idx)}
                                  onChange={(e) => {
                                    const val = e.target.value.trim();
                                    if (val === '') {
                                      handleMarkChange(stud.id, '');
                                    } else {
                                      handleMarkChange(stud.id, val);
                                    }
                                  }}
                                  className={`w-14 sm:w-20 px-1 py-1 sm:px-2 sm:py-1.5 text-center border font-mono font-bold text-xs rounded-lg outline-none transition-all focus:ring-2 ${
                                    !isTermActive || isReadOnly
                                      ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed select-none'
                                      : isOverLimit
                                        ? 'border-rose-450 bg-rose-50 text-rose-700 focus:ring-rose-200'
                                        : 'border-slate-200 bg-white text-slate-800 focus:ring-indigo-510/30 focus:border-indigo-600'
                                  }`}
                                />
                                {isOverLimit && (
                                  <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0 select-none animate-bounce" title="Exceeds maximum marks limit!" />
                                )}
                              </div>
                            </td>
                            <td className="p-2 sm:p-3 text-center hidden sm:table-cell">
                              {!isTermActive ? (
                                <span className="bg-amber-50 text-amber-700 border border-amber-100 font-bold text-[9px] px-1.5 py-0.5 rounded">
                                  LOCKED
                                </span>
                              ) : currentMark !== '' ? (
                                <span className={`inline-flex items-center gap-1 font-extrabold text-[9px] px-1.5 py-0.5 rounded tracking-wide ${
                                  isOverLimit
                                    ? 'bg-rose-50 text-rose-700 border border-rose-100'
                                    : 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                                }`}>
                                  {isOverLimit ? 'EXCEEDED' : 'ENTERED'}
                                </span>
                              ) : (
                                <span className="bg-slate-50 text-slate-400 font-semibold text-[9px] px-1.5 py-0.5 rounded border border-slate-100">
                                  PENDING
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          ) : (
            <div className="bg-slate-50/50 border border-gray-150 rounded-xl p-12 text-center text-slate-400 space-y-3.5">
              <ClipboardList className="w-10 h-10 text-slate-300 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-extrabold text-slate-700">No subject selected for fast-track marks entry.</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">Please select a class and subject allocation from the sidebar list on the left to begin entering student grades.</p>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
