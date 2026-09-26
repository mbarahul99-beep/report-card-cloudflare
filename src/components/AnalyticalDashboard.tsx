import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Users, UserCheck, Award, TrendingUp, BookOpen, Filter, 
  Search, ArrowRight, Eye, ClipboardList, Settings, User, GraduationCap, 
  Palette, Trophy, Layers, ShieldCheck, ChevronRight, BarChart2, CheckCircle2, AlertCircle, Info
} from 'lucide-react';
import { 
  BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, LineChart as RechartsLineChart, Line, AreaChart, Area, Cell 
} from 'recharts';
import { Student, StudentGrades, SubjectColumn, ScoreColumn, GradeScale, SchoolBranding, SaasTeacher, SaasSchool, ReportCardStructure } from '../types';
import { matchStructureForStudent } from '../utils/classNormalizer';

interface AnalyticalDashboardProps {
  branding: SchoolBranding;
  students: Student[];
  studentGrades: StudentGrades[];
  subjects: SubjectColumn[];
  scoreColumns: ScoreColumn[];
  gradeScales: GradeScale[];
  currentRole: string;
  setActiveTab: (tab: any) => void;
  teachers: SaasTeacher[];
  activeTeacher?: SaasTeacher | null;
  isDashboardOnly?: boolean;
  isResultsAnalysisOnly?: boolean;
  activeAnalysisTab?: 'classwise' | 'subjectwise' | 'spotlight';
  onAnalysisTabChange?: (tab: 'classwise' | 'subjectwise' | 'spotlight') => void;
  school?: SaasSchool;
  reportCardStructures?: ReportCardStructure[];
}

export default function AnalyticalDashboard({
  branding,
  students,
  studentGrades,
  subjects,
  scoreColumns,
  gradeScales,
  currentRole,
  setActiveTab,
  teachers,
  activeTeacher,
  isDashboardOnly = false,
  isResultsAnalysisOnly = false,
  activeAnalysisTab,
  onAnalysisTabChange,
  school,
  reportCardStructures
}: AnalyticalDashboardProps) {
  // Configured variables
  const resolvedThemeColor = branding?.themeColor || '#4f46e5';
  const term1Enabled = branding?.term1Enabled !== false;
  const term2Enabled = branding?.term2Enabled !== false;

  // Active sub-section state inside analytics
  const [localAnalysisMode, setLocalAnalysisMode] = useState<'overview' | 'classwise' | 'subjectwise' | 'spotlight'>('overview');

  const currentAnalysisMode = isDashboardOnly 
    ? 'overview' 
    : isResultsAnalysisOnly 
    ? (activeAnalysisTab || 'classwise') 
    : localAnalysisMode;

  const setCurrentAnalysisMode = (mode: 'overview' | 'classwise' | 'subjectwise' | 'spotlight') => {
    if (isResultsAnalysisOnly) {
      if (mode !== 'overview') {
        onAnalysisTabChange?.(mode);
      }
    } else {
      setLocalAnalysisMode(mode);
    }
  };

  // Smoothly scroll window to top when sub-analysis mode changes so the target workspace is immediately shown
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentAnalysisMode]);

  // Interactive selectors
  const [selectedClass, setSelectedClass] = useState<string>(() => {
    if (currentRole === 'class_teacher' && activeTeacher) {
      return activeTeacher.assignedClass;
    }
    const classes = Array.from(new Set(students.map(s => s.className)));
    return classes[0] || '';
  });
  const [selectedSection, setSelectedSection] = useState<string>(() => {
    if (currentRole === 'class_teacher' && activeTeacher) {
      return activeTeacher.assignedSection || '';
    }
    return '';
  });

  const [selectedSubject, setSelectedSubject] = useState<string>(() => {
    return subjects[0]?.id || '';
  });
  const [spotlightSearch, setSpotlightSearch] = useState<string>('');
  const [selectedSpotlightStudent, setSelectedSpotlightStudent] = useState<string>('');

  // Dual filtering selectors
  const [subjectClass, setSubjectClass] = useState<string>(() => {
    if (currentRole === 'class_teacher' && activeTeacher) {
      return activeTeacher.assignedClass;
    }
    return 'all';
  });
  const [subjectSection, setSubjectSection] = useState<string>(() => {
    if (currentRole === 'class_teacher' && activeTeacher) {
      return activeTeacher.assignedSection || 'all';
    }
    return 'all';
  });

  const [spotlightClass, setSpotlightClass] = useState<string>(() => {
    if (currentRole === 'class_teacher' && activeTeacher) {
      return activeTeacher.assignedClass;
    }
    return 'all';
  });
  const [spotlightSection, setSpotlightSection] = useState<string>(() => {
    if (currentRole === 'class_teacher' && activeTeacher) {
      return activeTeacher.assignedSection || 'all';
    }
    return 'all';
  });

  // Extract all unique classes
  const uniqueClasses = useMemo(() => {
    return Array.from(new Set(students.map(s => s.className))).sort();
  }, [students]);

  // Classwise Student Roster breakdown
  const classwiseBreakdown = useMemo(() => {
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

    if (currentRole === 'class_teacher' && activeTeacher) {
      const teacherClass = activeTeacher.assignedClass || '';
      const teacherSection = activeTeacher.assignedSection || '';
      return list.filter(item => 
        item.className.toLowerCase().trim() === teacherClass.toLowerCase().trim() &&
        (teacherSection === 'All' || item.section.toLowerCase().trim() === teacherSection.toLowerCase().trim())
      );
    }

    return list;
  }, [students, currentRole, activeTeacher]);

  // Extract all scholastic subjects
  const scholasticSubjects = useMemo(() => {
    return subjects.filter(sub => sub.type === 'scholastic' || !sub.type);
  }, [subjects]);

  // Extract available sections dynamically for Classwise tab
  const availableSectionsClasswise = useMemo(() => {
    if (!selectedClass) return [];
    const matched = students.filter(s => s.className === selectedClass);
    return Array.from(new Set(matched.map(s => s.section))).sort();
  }, [students, selectedClass]);

  // Auto-tune Classwise section selector
  React.useEffect(() => {
    if (currentRole === 'class_teacher' && activeTeacher && activeTeacher.assignedSection && activeTeacher.assignedSection !== 'All') {
      setSelectedSection(activeTeacher.assignedSection);
      return;
    }
    if (availableSectionsClasswise.length > 0) {
      if (!selectedSection || !availableSectionsClasswise.includes(selectedSection)) {
        setSelectedSection(availableSectionsClasswise[0]);
      }
    } else {
      setSelectedSection('');
    }
  }, [availableSectionsClasswise, selectedSection, currentRole, activeTeacher]);

  // Extract sections dynamically for Subjectwise tab
  const availableSectionsSubjectwise = useMemo(() => {
    if (subjectClass === 'all') return [];
    const matched = students.filter(s => s.className === subjectClass);
    return Array.from(new Set(matched.map(s => s.section))).sort();
  }, [students, subjectClass]);

  // Auto-tune Subjectwise section selector
  React.useEffect(() => {
    if (currentRole === 'class_teacher' && activeTeacher) {
      setSubjectSection(activeTeacher.assignedSection || 'all');
    } else {
      setSubjectSection('all');
    }
  }, [subjectClass, currentRole, activeTeacher]);

  // Extract sections dynamically for Spotlight tab
  const availableSectionsSpotlight = useMemo(() => {
    if (spotlightClass === 'all') return [];
    const matched = students.filter(s => s.className === spotlightClass);
    return Array.from(new Set(matched.map(s => s.section))).sort();
  }, [students, spotlightClass]);

  // Auto-tune Spotlight section selector
  React.useEffect(() => {
    if (currentRole === 'class_teacher' && activeTeacher) {
      setSpotlightSection(activeTeacher.assignedSection || 'all');
    } else {
      setSpotlightSection('all');
    }
  }, [spotlightClass, currentRole, activeTeacher]);

  // Compute calculated metrics for EVERY student in the school
  const computedStudentStats = useMemo(() => {
    return students.map(std => {
      const gRecord = studentGrades.find(g => g.studentId === std.id);
      
      let studentTotal = 0;
      let studentMaxPossible = 0;
      const subjectAverages: { [subId: string]: number } = {};

      scholasticSubjects.forEach(sub => {
        const scoreSheet = gRecord?.scholastic?.[sub.id];
        
        let t1Sum = 0;
        let t2Sum = 0;
        
        if (scoreSheet) {
          scoreColumns.forEach(col => {
            t1Sum += scoreSheet.term1?.[col.id] ?? 0;
            t2Sum += scoreSheet.term2?.[col.id] ?? 0;
          });
        }

        let overall = 0;
        let maxSubMarksPossible = 200;

        if (term1Enabled && term2Enabled) {
          overall = t1Sum + t2Sum;
          maxSubMarksPossible = 200;
        } else if (term1Enabled) {
          overall = t1Sum;
          maxSubMarksPossible = 100;
        } else if (term2Enabled) {
          overall = t2Sum;
          maxSubMarksPossible = 100;
        }

        studentTotal += overall;
        studentMaxPossible += maxSubMarksPossible;
        
        const subPercent = maxSubMarksPossible > 0 ? (overall * 100) / maxSubMarksPossible : 0;
        subjectAverages[sub.id] = parseFloat(subPercent.toFixed(1));
      });

      const percentage = studentMaxPossible > 0 
        ? parseFloat(((studentTotal * 100) / studentMaxPossible).toFixed(1)) 
        : 0;

      // Map percentage to grade
      let letterGrade = 'D';
      const matchedStruct = reportCardStructures 
        ? matchStructureForStudent(reportCardStructures, std.className, std.section)
        : null;
      const studentGradeScales = matchedStruct?.gradeScales && matchedStruct.gradeScales.length > 0 
        ? matchedStruct.gradeScales 
        : gradeScales;

      for (const scale of studentGradeScales) {
        if (percentage >= scale.minPercent && percentage <= scale.maxPercent) {
          letterGrade = scale.grade;
          break;
        }
      }

      return {
        student: std,
        className: std.className,
        percentage,
        totalMarks: studentTotal,
        maxPossible: studentMaxPossible,
        grade: letterGrade,
        subjectAverages
      };
    });
  }, [students, studentGrades, scholasticSubjects, scoreColumns, gradeScales, term1Enabled, term2Enabled, reportCardStructures]);

  // ---------------- CLASSWISE STATS CALCULATOR ----------------
  const classwiseStatsComputed = useMemo(() => {
    if (!selectedClass) return null;
    
    // Filter class AND section both!
    const classStudents = computedStudentStats.filter(s => 
      s.className === selectedClass && 
      (!selectedSection || s.student.section === selectedSection)
    );
    
    if (classStudents.length === 0) return null;

    const totalStudents = classStudents.length;
    const classSum = classStudents.reduce((acc, curr) => acc + curr.percentage, 0);
    const averagePercent = parseFloat((classSum / totalStudents).toFixed(1));
    
    const sorted = [...classStudents].sort((a,b) => b.percentage - a.percentage);
    const highestPercent = sorted[0]?.percentage || 0;
    const lowestPercent = sorted[sorted.length - 1]?.percentage || 0;

    // Top performers (top 3)
    const podiumList = sorted.slice(0, 3);

    // Grade Distribution counting
    const gradeCountMap: { [grade: string]: number } = {};
    gradeScales.forEach(sc => {
      gradeCountMap[sc.grade] = 0;
    });
    classStudents.forEach(s => {
      gradeCountMap[s.grade] = (gradeCountMap[s.grade] || 0) + 1;
    });

    const gradeDistributionData = gradeScales.map(sc => ({
      grade: sc.grade,
      count: gradeCountMap[sc.grade] || 0,
      minPercent: sc.minPercent
    })).sort((a,b) => b.minPercent - a.minPercent); // sorted from A to E/F

    // Subject averages in this class
    const subjectWiseMetrics = scholasticSubjects.map(sub => {
      const marksSum = classStudents.reduce((acc, curr) => acc + (curr.subjectAverages[sub.id] || 0), 0);
      const subAvg = parseFloat((marksSum / totalStudents).toFixed(1));

      // find best student in this subject within this class
      let bestSubPercent = -1;
      let bestSubStudentName = 'N/A';
      
      classStudents.forEach(cs => {
        const score = cs.subjectAverages[sub.id] || 0;
        if (score > bestSubPercent) {
          bestSubPercent = score;
          bestSubStudentName = cs.student.name;
        }
      });

      return {
        subjectId: sub.id,
        subjectName: sub.name,
        classAverage: subAvg,
        bestScore: bestSubPercent,
        bestStudent: bestSubStudentName
      };
    });

    return {
      totalStudents,
      averagePercent,
      highestPercent,
      lowestPercent,
      podiumList,
      gradeDistributionData,
      subjectWiseMetrics
    };
  }, [selectedClass, selectedSection, computedStudentStats, gradeScales, scholasticSubjects]);

  // ---------------- SUBJECTWISE STATS CALCULATOR ----------------
  const subjectwiseStatsComputed = useMemo(() => {
    if (!selectedSubject) return null;
    const activeSub = scholasticSubjects.find(s => s.id === selectedSubject);
    if (!activeSub) return null;

    // Filter students by class & section both!
    const filteredStudentsForSubject = computedStudentStats.filter(s => {
      const matchClass = subjectClass === 'all' || s.className === subjectClass;
      const matchSection = subjectSection === 'all' || s.student.section === subjectSection;
      return matchClass && matchSection;
    });

    const subjectScoresList = filteredStudentsForSubject.map(s => ({
      studentId: s.student.id,
      name: s.student.name,
      className: s.className,
      section: s.student.section,
      scorePercent: s.subjectAverages[selectedSubject] || 0
    }));

    if (subjectScoresList.length === 0) return null;

    const overallSum = subjectScoresList.reduce((acc, curr) => acc + curr.scorePercent, 0);
    const overallAvg = parseFloat((overallSum / subjectScoresList.length).toFixed(1));

    // Sort to find top scoring student in this subject
    const sortedScores = [...subjectScoresList].sort((a,b) => b.scorePercent - a.scorePercent);
    const topScorer = sortedScores[0] || null;

    // Compare averages across classes (with chosen section filter)
    const classesToCompare = subjectClass === 'all' ? uniqueClasses : [subjectClass];
    const classAveragesCompare = classesToCompare.map(cls => {
      const clsStudents = computedStudentStats.filter(s => {
        const matchCls = s.className === cls;
        const matchSec = subjectSection === 'all' || s.student.section === subjectSection;
        return matchCls && matchSec;
      });
      if (clsStudents.length === 0) return { className: cls, average: 0 };
      const sum = clsStudents.reduce((acc, curr) => acc + (curr.subjectAverages[selectedSubject] || 0), 0);
      return {
        className: cls + (subjectSection !== 'all' ? ` - ${subjectSection}` : ''),
        average: parseFloat((sum / clsStudents.length).toFixed(1))
      };
    });

    // Pass failure count (pass rate >= 40%)
    const passes = subjectScoresList.filter(s => s.scorePercent >= 40).length;
    const passRate = parseFloat(((passes * 100) / subjectScoresList.length).toFixed(1));

    return {
      overallAvg,
      topScorer,
      classAveragesCompare,
      passRate,
      subjectName: activeSub.name
    };
  }, [selectedSubject, computedStudentStats, uniqueClasses, scholasticSubjects, subjectClass, subjectSection]);

  // ---------------- SPOTLIGHT STUDENT CALCS ----------------
  const filteredSpotlightStudents = useMemo(() => {
    let list = students;
    if (spotlightClass !== 'all') {
      list = list.filter(s => s.className === spotlightClass);
    }
    if (spotlightSection !== 'all') {
      list = list.filter(s => s.section === spotlightSection);
    }
    if (spotlightSearch.trim()) {
      const query = spotlightSearch.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(query));
    }
    return list;
  }, [students, spotlightClass, spotlightSection, spotlightSearch]);

  // Auto-focus first student matching filtered Spotlight list
  React.useEffect(() => {
    if (filteredSpotlightStudents.length > 0) {
      const exists = filteredSpotlightStudents.some(s => s.id === selectedSpotlightStudent);
      if (!exists) {
        setSelectedSpotlightStudent(filteredSpotlightStudents[0].id);
      }
    } else {
      setSelectedSpotlightStudent('');
    }
  }, [filteredSpotlightStudents, selectedSpotlightStudent]);

  const spotlightStudentStats = useMemo(() => {
    const activeId = selectedSpotlightStudent || (students[0]?.id || '');
    if (!activeId) return null;

    const stats = computedStudentStats.find(s => s.student.id === activeId);
    if (!stats) return null;

    // Chart profile data structured for Recharts
    const chartProfile = scholasticSubjects.map(sub => ({
      subject: sub.name,
      score: stats.subjectAverages[sub.id] || 0,
      classAvg: selectedClass ? (classwiseStatsComputed?.subjectWiseMetrics.find(m => m.subjectId === sub.id)?.classAverage || 55) : 55
    }));

    // Find custom comments based on strength & weakness
    const subjectsPerformanceSorted = [...scholasticSubjects].map(sub => ({
      name: sub.name,
      score: stats.subjectAverages[sub.id] || 0
    })).sort((a,b) => b.score - a.score);

    const strength = subjectsPerformanceSorted[0] || null;
    const growthArea = subjectsPerformanceSorted[subjectsPerformanceSorted.length - 1] || null;

    return {
      details: stats,
      chartProfile,
      strength,
      growthArea
    };
  }, [selectedSpotlightStudent, students, computedStudentStats, scholasticSubjects, selectedClass, classwiseStatsComputed]);

  // Dynamic quick work tiles depending on roles
  const navigationalQuickCards = useMemo(() => {
    const defaultCards = [
      {
        id: 'preview',
        title: 'Report Cards Desk',
        desc: 'Review final report cards, individual grades, and trigger bulk printing easily.',
        icon: Award,
        color: 'from-indigo-50/20 to-blue-50/20 border-slate-100 hover:border-indigo-400',
        textColor: 'text-indigo-800'
      },
      {
        id: 'classwise_report',
        title: 'Tabulation Matrices',
        desc: 'Inspect school grades, average columns, and compute rankings tables.',
        icon: BarChart2,
        color: 'from-emerald-50/20 to-teal-50/20 border-slate-100 hover:border-emerald-400',
        textColor: 'text-emerald-800'
      },
      {
        id: 'students',
        title: 'Scholars Directory',
        desc: 'Configure scholar properties, names, roll numbers, and input marks.',
        icon: GraduationCap,
        color: 'from-amber-50/20 to-orange-50/20 border-slate-100 hover:border-amber-400',
        textColor: 'text-amber-800'
      }
    ];

    if (currentRole === 'school_admin') {
      return [
        ...defaultCards,
        {
          id: 'sub_marks_entry',
          title: 'Class/Subject Marks Entry',
          desc: 'Directly edit class scholastic and co-scholastic marks matrices of any assigned subjects.',
          icon: ClipboardList,
          color: 'from-teal-50/10 to-emerald-50/10 border-slate-100 hover:border-teal-400',
          textColor: 'text-teal-800 font-bold'
        },
        {
          id: 'teachers',
          title: 'Teachers Directory',
          desc: 'Register staff members and configure school class-teacher & subject assignments.',
          icon: User,
          color: 'from-sky-50/20 to-cyan-50/20 border-slate-100 hover:border-sky-400',
          textColor: 'text-sky-800'
        },
        {
          id: 'portal',
          title: 'Parents Portal Hub',
          desc: 'Access the parent view simulations, roll numbers portal codes, and child report card directories.',
          icon: Users,
          color: 'from-pink-50/10 to-rose-50/10 border-slate-100 hover:border-pink-400',
          textColor: 'text-rose-800'
        },
        {
          id: 'security_desk',
          title: 'Security Desk & SSO',
          desc: 'Configure multi-factor login protocols, firewall rules, and single sign-on parameters.',
          icon: ShieldCheck,
          color: 'from-purple-50/10 to-violet-50/10 border-slate-100 hover:border-purple-400',
          textColor: 'text-purple-800 font-bold'
        }
      ];
    }

    if (currentRole === 'class_teacher') {
      return [
        ...defaultCards,
        {
          id: 'sub_marks_entry',
          title: 'Subject Marks Sheet',
          desc: 'Fill scholastic score matrices, and update student performance grades.',
          icon: ClipboardList,
          color: 'from-emerald-50/20 to-teal-50/20 border-slate-100 hover:border-emerald-400',
          textColor: 'text-emerald-800'
        },
        {
          id: 'portal',
          title: 'Parents Portal Hub',
          desc: 'Access the parent view simulations, roll numbers portal codes, and child report card directories.',
          icon: Users,
          color: 'from-pink-50/10 to-rose-50/10 border-slate-100 hover:border-pink-400',
          textColor: 'text-rose-800'
        }
      ];
    }

    return defaultCards;
  }, [currentRole]);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      
      {/* Dynamic lock banner for Class Teacher */}
      {currentRole === 'class_teacher' && activeTeacher && (
        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-fadeIn text-slate-900 text-left">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-600">Homeroom Class Specific Lock</h4>
            </div>
            <p className="text-xs text-slate-500">
              Logged in: <strong className="text-slate-800">{activeTeacher.name}</strong>. Your dashboard analytical queries are locked exclusively to <strong className="text-indigo-650">Class {activeTeacher.assignedClass} - Section {activeTeacher.assignedSection || 'All'}.</strong>
            </p>
          </div>
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-150 font-mono text-[10px] font-bold px-3 py-1 rounded-full shrink-0 uppercase">
            Active: Class {activeTeacher.assignedClass}
          </span>
        </div>
      )}

      {/* 1. ATTRACTIVE ALWAYS VISIBLE DASHBOARD SELECTION WORKSPACE */}
      {!isDashboardOnly && !isResultsAnalysisOnly && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print select-none">
          {/* Button 1: Command Center Overview */}
          {(currentRole === 'school_admin' || currentRole === 'class_teacher') && (
            <button
              onClick={() => setCurrentAnalysisMode('overview')}
              className={`group text-left p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden cursor-pointer flex flex-col justify-between min-h-[128px] ${
                currentAnalysisMode === 'overview'
                  ? 'bg-gradient-to-br from-indigo-50 to-indigo-100/50 border-indigo-300 shadow-md ring-2 ring-indigo-100'
                  : 'bg-white hover:bg-slate-50 border-slate-200 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className={`p-2.5 rounded-xl transition-colors duration-300 shadow-2xs ${
                  currentAnalysisMode === 'overview' ? 'bg-indigo-600 text-white' : 'bg-slate-105 text-slate-500 group-hover:bg-slate-200'
                }`}>
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full ${
                  currentAnalysisMode === 'overview' ? 'bg-white text-indigo-750 border border-indigo-200 shadow-2xs' : 'bg-slate-100 border-slate-200 text-slate-500 border'
                }`}>
                  {currentAnalysisMode === 'overview' ? 'Active' : currentRole === 'class_teacher' ? 'Staff' : 'Admin'}
                </span>
              </div>
              <div className="mt-4">
                <span className={`text-[9.5px] uppercase tracking-wider block font-extrabold ${
                  currentAnalysisMode === 'overview' ? 'text-indigo-600' : 'text-slate-400'
                }`}>Command Center</span>
                <h4 className={`text-sm font-black tracking-tight mt-0.5 ${
                  currentAnalysisMode === 'overview' ? 'text-indigo-950 font-extrabold' : 'text-slate-800'
                }`}>Overview &amp; Faculty</h4>
              </div>
            </button>
          )}

          {/* Button 2: Classwise Score Distribution */}
          <button
            onClick={() => setCurrentAnalysisMode('classwise')}
            className={`group text-left p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden cursor-pointer flex flex-col justify-between min-h-[128px] ${
              currentAnalysisMode === 'classwise'
                ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-300 shadow-md ring-2 ring-emerald-100'
                : 'bg-white hover:bg-slate-50 border-slate-200 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className={`p-2.5 rounded-xl transition-colors duration-300 shadow-2xs ${
                currentAnalysisMode === 'classwise' ? 'bg-emerald-600 text-white' : 'bg-slate-105 text-slate-500 group-hover:bg-slate-200'
              }`}>
                <BarChart2 className="w-5 h-5" />
              </div>
              <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full ${
                currentAnalysisMode === 'classwise' ? 'bg-white text-emerald-755 border border-emerald-200 shadow-2xs' : 'bg-slate-100 border-slate-200 text-slate-500 border'
              }`}>
                {currentAnalysisMode === 'classwise' ? 'Active' : 'Performance'}
              </span>
            </div>
            <div className="mt-4">
              <span className={`text-[9.5px] uppercase tracking-wider block font-extrabold ${
                currentAnalysisMode === 'classwise' ? 'text-emerald-700' : 'text-slate-400'
              }`}>Distribution</span>
              <h4 className={`text-sm font-black tracking-tight mt-0.5 ${
                currentAnalysisMode === 'classwise' ? 'text-emerald-950 font-extrabold' : 'text-slate-800'
              }`}>Classwise Score</h4>
            </div>
          </button>

          {/* Button 3: Subjectwise Dispersion */}
          <button
            onClick={() => setCurrentAnalysisMode('subjectwise')}
            className={`group text-left p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden cursor-pointer flex flex-col justify-between min-h-[128px] ${
              currentAnalysisMode === 'subjectwise'
                ? 'bg-gradient-to-br from-sky-50 to-sky-100/50 border-sky-300 shadow-md ring-2 ring-sky-100'
                : 'bg-white hover:bg-slate-50 border-slate-200 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className={`p-2.5 rounded-xl transition-colors duration-300 shadow-2xs ${
                currentAnalysisMode === 'subjectwise' ? 'bg-sky-600 text-white' : 'bg-slate-105 text-slate-500 group-hover:bg-slate-200'
              }`}>
                <BookOpen className="w-5 h-5" />
              </div>
              <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full ${
                currentAnalysisMode === 'subjectwise' ? 'bg-white text-sky-750 border border-sky-200 shadow-2xs' : 'bg-slate-100 border-slate-200 text-slate-500 border'
              }`}>
                {currentAnalysisMode === 'subjectwise' ? 'Active' : 'Dispersion'}
              </span>
            </div>
            <div className="mt-4">
              <span className={`text-[9.5px] uppercase tracking-wider block font-extrabold ${
                currentAnalysisMode === 'subjectwise' ? 'text-sky-700' : 'text-slate-400'
              }`}>Scholastic</span>
              <h4 className={`text-sm font-black tracking-tight mt-0.5 ${
                currentAnalysisMode === 'subjectwise' ? 'text-sky-950 font-extrabold' : 'text-slate-800'
              }`}>Subjectwise Dispersion</h4>
            </div>
          </button>

          {/* Button 4: Student Spotlight */}
          <button
            onClick={() => setCurrentAnalysisMode('spotlight')}
            className={`group text-left p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden cursor-pointer flex flex-col justify-between min-h-[128px] ${
              currentAnalysisMode === 'spotlight'
                ? 'bg-gradient-to-br from-purple-50 to-purple-100/50 border-purple-300 shadow-md ring-2 ring-purple-100'
                : 'bg-white hover:bg-slate-50 border-slate-200 hover:shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <div className={`p-2.5 rounded-xl transition-colors duration-300 shadow-2xs ${
                currentAnalysisMode === 'spotlight' ? 'bg-purple-600 text-white' : 'bg-slate-105 text-slate-500 group-hover:bg-slate-200'
              }`}>
                <Award className="w-5 h-5" />
              </div>
              <span className={`text-[9px] uppercase tracking-wider font-extrabold px-2.5 py-0.5 rounded-full ${
                currentAnalysisMode === 'spotlight' ? 'bg-white text-purple-750 border border-purple-200 shadow-2xs' : 'bg-slate-100 border-slate-200 text-slate-500 border'
              }`}>
                {currentAnalysisMode === 'spotlight' ? 'Active' : 'Spotlight'}
              </span>
            </div>
            <div className="mt-4">
              <span className={`text-[9.5px] uppercase tracking-wider block font-extrabold ${
                currentAnalysisMode === 'spotlight' ? 'text-purple-700' : 'text-slate-400'
              }`}>Student</span>
              <h4 className={`text-sm font-black tracking-tight mt-0.5 ${
                currentAnalysisMode === 'spotlight' ? 'text-purple-950 font-extrabold' : 'text-slate-800'
              }`}>Spotlight Profile</h4>
            </div>
          </button>
        </div>
      )}

      {isDashboardOnly && (
        <div className="flex justify-between items-center no-print pb-2">
          <div>
            <h2 className="text-xl font-black font-sans text-slate-900 tracking-tight flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="3" width="7" height="9" />
                <rect x="14" y="3" width="7" height="5" />
                <rect x="14" y="12" width="7" height="9" />
                <rect x="3" y="16" width="7" height="5" />
              </svg>
              <span>Dashboard</span>
            </h2>
            <p className="text-xs text-slate-500 font-sans mt-0.5">Welcome back to your school administration desk.</p>
          </div>
        </div>
      )}

      {isResultsAnalysisOnly && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-150 shadow-3xs no-print mb-2">
          <div>
            <span className="text-[9.5px] uppercase tracking-widest font-extrabold text-indigo-600 block">Results Analysis</span>
            <h3 className="font-extrabold text-sm text-slate-900 tracking-tight leading-tight mt-0.5">Performance &amp; Scholastic Analysis</h3>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setCurrentAnalysisMode('classwise')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer border flex items-center gap-1.5 ${
                currentAnalysisMode === 'classwise'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Classwise Score</span>
            </button>
            <button
              onClick={() => setCurrentAnalysisMode('subjectwise')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer border flex items-center gap-1.5 ${
                currentAnalysisMode === 'subjectwise'
                  ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Subjectwise Dispersion</span>
            </button>
            <button
              onClick={() => setCurrentAnalysisMode('spotlight')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer border flex items-center gap-1.5 ${
                currentAnalysisMode === 'spotlight'
                  ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Spotlight Profile</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. MAIN SUB-SECTIONS BODY */}
      
      {/* 2.1 COMMAND CENTER OVERVIEW */}
      {currentAnalysisMode === 'overview' && (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 text-left"
        >
          {/* Subscription & Partnership Limits Board */}
          {currentRole === 'school_admin' && school && (
            <div className="bg-white border border-gray-150 p-6 rounded-3xl shadow-xs space-y-5 animate-fadeIn" id="school-admin-subscription-plan-card">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-gray-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-2xl ${
                    school.partnershipType === 'annual' 
                      ? 'bg-indigo-50 text-indigo-650 border border-indigo-100' 
                      : 'bg-amber-50 text-amber-600 border border-amber-150'
                  }`}>
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 tracking-tight uppercase">
                      Subscription &amp; Partnership Limits Desk
                    </h3>
                    <p className="text-[11px] text-gray-500 font-sans">Live school commercial profile, quota tracking, and platform features limits.</p>
                  </div>
                </div>
                <div>
                  {school.partnershipType === 'annual' ? (
                    <span className="bg-indigo-650 text-white font-black text-[10px] tracking-wider uppercase px-3 py-1.5 rounded-full inline-flex items-center gap-1 shadow-xs shadow-indigo-500/10">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      Annual Partnership
                    </span>
                  ) : (
                    <span className="bg-amber-500 text-white font-black text-[10px] tracking-wider uppercase px-3 py-1.5 rounded-full inline-flex items-center gap-1 shadow-xs shadow-amber-500/10">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      Sandbox Trial Mode
                    </span>
                  )}
                </div>
              </div>

              {/* Partnership & Plan Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-150">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Partnership Plan Type</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-800">
                      {school.partnershipType === 'annual' ? '🌟 Annual Premium Partnership' : '🧪 Free Tier Plan'}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-normal font-sans">
                    {school.partnershipType === 'annual' 
                      ? 'Your school is registered under the full Annual Commercial Partnership Plan, unlocking expanded rosters, staff allocation privileges, and dynamic layout directories.'
                      : 'Your Free Tier plan allows tracking of student rosters, marks entry matrices, and PDF report cards with standard student limits.'
                    }
                  </p>
                </div>

                <div className="space-y-3.5 border-t md:border-t-0 md:border-l border-slate-200/60 pt-3 md:pt-0 md:pl-5">
                  <div className="text-xs">
                    <div>
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">Subscription Expiry</span>
                      <strong className="text-slate-800 font-mono text-[11.5px] block">
                        {school.trialUntil ? new Date(school.trialUntil).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'No Expiry'}
                      </strong>
                    </div>
                  </div>
                  <div className="text-[10.5px] text-slate-500 bg-white/60 p-2 rounded-xl border border-slate-100 flex items-start gap-1.5 font-sans">
                    <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                    <span>To upgrade your plan, request quota extensions, or renew partnership details, please contact SaaS Platform Operations.</span>
                  </div>
                </div>
              </div>

              {/* Progress Bars for Limits and Quotas */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-extrabold uppercase text-gray-400 tracking-wider">Plan Resource Quotas Utilization</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  {/* Active Students Limit */}
                  {(() => {
                    const currentCount = students.length;
                    const maxLimit = school.maxStudentsLimit ?? 50;
                    const ratio = Math.min(100, Math.round((currentCount / maxLimit) * 100));
                    const isNearLimit = ratio >= 85;
                    const isExceeded = currentCount >= maxLimit;
                    return (
                      <div className="bg-white border border-slate-150 p-4 rounded-2xl space-y-2 flex flex-col justify-between shadow-2xs">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-extrabold text-slate-550 uppercase tracking-wide">Active Students</span>
                          <span className={`text-[10.5px] font-mono font-bold ${isExceeded ? 'text-rose-600' : isNearLimit ? 'text-amber-600' : 'text-slate-700'}`}>
                            {currentCount} / {maxLimit}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${isExceeded ? 'bg-rose-500' : isNearLimit ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${ratio}%` }}
                          />
                        </div>
                        <span className="text-[9.5px] text-gray-400 block mt-0.5 font-sans">Active profile capacity</span>
                      </div>
                    );
                  })()}

                  {/* Cumulative Students Limit */}
                  {(() => {
                    const currentCount = school.cumulativeStudentsCount || 0;
                    const maxLimit = school.maxCumulativeStudentsLimit ?? 100;
                    const ratio = Math.min(100, Math.round((currentCount / maxLimit) * 100));
                    const isNearLimit = ratio >= 85;
                    const isExceeded = currentCount >= maxLimit;
                    return (
                      <div className="bg-white border border-slate-150 p-4 rounded-2xl space-y-2 flex flex-col justify-between shadow-2xs">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-extrabold text-slate-550 uppercase tracking-wide">Cumulative Students</span>
                          <span className={`text-[10.5px] font-mono font-bold ${isExceeded ? 'text-rose-600' : isNearLimit ? 'text-amber-600' : 'text-slate-700'}`}>
                            {currentCount} / {maxLimit}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${isExceeded ? 'bg-rose-500' : isNearLimit ? 'bg-amber-500' : 'bg-amber-600'}`}
                            style={{ width: `${ratio}%` }}
                          />
                        </div>
                        <span className="text-[9.5px] text-gray-400 block mt-0.5 font-sans">All-time registration limit</span>
                      </div>
                    );
                  })()}

                  {/* Max Teachers Limit */}
                  {(() => {
                    const currentCount = teachers.length;
                    const isAnnual = school.partnershipType === 'annual';
                    const maxLimit = school.maxTeachersLimit ?? (isAnnual ? 1000 : 1);
                    const ratio = Math.min(100, Math.round((currentCount / maxLimit) * 100));
                    const isNearLimit = ratio >= 85;
                    const isExceeded = currentCount >= maxLimit;
                    return (
                      <div className="bg-white border border-slate-150 p-4 rounded-2xl space-y-2 flex flex-col justify-between shadow-2xs">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-extrabold text-slate-505 uppercase tracking-wide">Staff Registry</span>
                          <span className={`text-[10.5px] font-mono font-bold ${isExceeded ? 'text-rose-600' : isNearLimit ? 'text-amber-600' : 'text-slate-700'}`}>
                            {currentCount} / {maxLimit}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${isExceeded ? 'bg-rose-500' : isNearLimit ? 'bg-amber-500' : 'bg-indigo-500'}`}
                            style={{ width: `${ratio}%` }}
                          />
                        </div>
                        <span className="text-[9.5px] text-gray-400 block mt-0.5 font-sans">Staff roster limits</span>
                      </div>
                    );
                  })()}

                  {/* Max Structures Limit */}
                  {(() => {
                    const currentCount = reportCardStructures?.length || 0;
                    const maxLimit = school.maxStructuresLimit ?? 5;
                    const ratio = Math.min(100, Math.round((currentCount / maxLimit) * 100));
                    const isNearLimit = ratio >= 85;
                    const isExceeded = currentCount >= maxLimit;
                    return (
                      <div className="bg-white border border-slate-150 p-4 rounded-2xl space-y-2 flex flex-col justify-between shadow-2xs">
                        <div className="flex justify-between items-start">
                          <span className="text-[10px] font-extrabold text-slate-505 uppercase tracking-wide">Custom Layouts</span>
                          <span className={`text-[10.5px] font-mono font-bold ${isExceeded ? 'text-rose-600' : isNearLimit ? 'text-amber-600' : 'text-slate-700'}`}>
                            {currentCount} / {maxLimit}
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${isExceeded ? 'bg-rose-500' : isNearLimit ? 'bg-amber-500' : 'bg-pink-500'}`}
                            style={{ width: `${ratio}%` }}
                          />
                        </div>
                        <span className="text-[9.5px] text-gray-400 block mt-0.5 font-sans">Template design capacity</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}



          {/* Full Width Overview Class Comparative Curve */}
          {!isDashboardOnly && (
            <div className="bg-white border border-gray-150 p-6 rounded-2xl shadow-xs space-y-4">
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                  Overall Class-by-Class Comparative Curve
                </h3>
                <p className="text-[10.5px] text-gray-500">Averages are dynamically calculated on actual registered scholastic mark records.</p>
              </div>

              <div className="h-64 sm:h-72 w-full">
                {uniqueClasses.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={uniqueClasses.map(cls => {
                        const matches = computedStudentStats.filter(s => s.className === cls);
                        const avg = matches.length > 0 
                          ? parseFloat((matches.reduce((sum, s) => sum + s.percentage, 0) / matches.length).toFixed(1))
                          : 0;
                        return { className: cls, averagePercent: avg };
                      })}
                      margin={{ top: 10, right: 30, left: -20, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={resolvedThemeColor} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={resolvedThemeColor} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="className" stroke="#64748b" fontSize={11} fontWeight={600} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={11} fontWeight={600} tickLine={false} domain={[0, 100]} />
                      <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '10px' }} />
                      <Area type="monotone" dataKey="averagePercent" stroke={resolvedThemeColor} strokeWidth={2.5} fillOpacity={1} fill="url(#colorAvg)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-gray-400 italic">
                    Add standard academic registry records first to see curves.
                  </div>
                )}
              </div>
            </div>
          )}



          {/* Quick Navigational Dashboard (The bento navigation tiles) */}
          <div className="space-y-4">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                <Layers className="w-4 h-4 text-slate-700" />
                Quick Work Navigation Hub
              </h3>
              <p className="text-[11px] text-gray-400 leading-snug">Jump straight into active workspaces instead of checking raw navigation buttons.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {navigationalQuickCards.map((card) => {
                const IconComp = card.icon;
                return (
                  <motion.div
                    key={card.id}
                    whileHover={{ scale: 1.015 }}
                    className={`bg-gradient-to-br ${card.color} border p-5 rounded-2xl shadow-xs cursor-pointer select-none transition-all flex flex-col justify-between space-y-4 hover:shadow-md`}
                    onClick={() => setActiveTab(card.id as any)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="p-2.5 rounded-xl bg-white shadow-xs">
                        <IconComp className="w-5 h-5 text-slate-700" />
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </div>
                    <div>
                      <h4 className="text-xs font-extrabold uppercase text-slate-800 tracking-tight">{card.title}</h4>
                      <p className="text-[11px] text-slate-500 leading-normal mt-1">{card.desc}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* 2.2 CLASSWISE PERFORMANCE ANALYSIS */}
      {currentAnalysisMode === 'classwise' && (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 text-left"
        >
          {/* Class and Section dual selector panel */}
          <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-50 p-2.5 rounded-lg text-emerald-600 shrink-0">
                <Filter className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-xs text-slate-900 leading-tight uppercase tracking-wider">Select Class & Section filters</h4>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Choose both a specific class and individual section code to view corresponding analysis metrics.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3.5">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] uppercase font-extrabold text-slate-400">Class Level:</span>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  disabled={currentRole === 'class_teacher'}
                  className="px-3.5 py-2 text-xs font-semibold border border-gray-200 outline-none rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer min-w-[140px] disabled:opacity-85 disabled:cursor-not-allowed disabled:bg-slate-100/80"
                >
                  <option value="">-- Choose Class --</option>
                  {uniqueClasses.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[9px] uppercase font-extrabold text-slate-400">Section Stream:</span>
                <select
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  disabled={currentRole === 'class_teacher' || availableSectionsClasswise.length === 0}
                  className="px-3.5 py-2 text-xs font-semibold border border-gray-200 outline-none rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer min-w-[120px] disabled:opacity-85 disabled:cursor-not-allowed disabled:bg-slate-100/80"
                >
                  {availableSectionsClasswise.map(sec => (
                    <option key={sec} value={sec}>Section {sec}</option>
                  ))}
                  {availableSectionsClasswise.length === 0 && (
                    <option value="">No Sections</option>
                  )}
                </select>
              </div>
            </div>
          </div>

          {classwiseStatsComputed ? (
            <div className="space-y-6">
              
              {/* Aggregations row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-slate-800">
                <div className="bg-slate-50 border border-slate-150 p-4.5 rounded-xl">
                  <span className="text-[9.5px] uppercase text-gray-400 font-extrabold block">Class Population</span>
                  <div className="text-2xl font-black font-mono text-slate-900 mt-1">{classwiseStatsComputed.totalStudents} Students</div>
                </div>

                <div className="bg-slate-50 border border-slate-150 p-4.5 rounded-xl">
                  <span className="text-[9.5px] uppercase text-gray-400 font-extrabold block">Class Average Percent</span>
                  <div className="text-2xl font-black font-mono text-slate-900 mt-1">{classwiseStatsComputed.averagePercent}%</div>
                </div>

                <div className="bg-slate-50 border border-slate-150 p-4.5 rounded-xl">
                  <span className="text-[9.5px] uppercase text-gray-400 font-extrabold block">Highest Score Record</span>
                  <div className="text-2xl font-black font-mono text-slate-900 mt-1 text-emerald-600">{classwiseStatsComputed.highestPercent}%</div>
                </div>

                <div className="bg-slate-50 border border-slate-150 p-4.5 rounded-xl">
                  <span className="text-[9.5px] uppercase text-gray-400 font-extrabold block">Lowest Score Range</span>
                  <div className="text-2xl font-black font-mono text-slate-900 mt-1 text-rose-500">{classwiseStatsComputed.lowestPercent}%</div>
                </div>
              </div>

              {/* Class Leaders & Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* 1. TOP PERFORMERS PODIUM */}
                <div className="lg:col-span-4 bg-gradient-to-tr from-slate-900 to-slate-800 text-white rounded-2xl p-5 border border-slate-700/50 shadow-md flex flex-col justify-between">
                  <div className="border-b border-slate-700/50 pb-3 mb-4 flex items-center justify-between">
                    <div>
                      <h4 className="font-extrabold text-xs text-amber-300 uppercase block tracking-wider leading-none">Class Leaders Podium</h4>
                      <span className="text-[9.5px] text-slate-400 mt-1 block">Highest overall academic scorers.</span>
                    </div>
                    <Award className="w-5 h-5 text-amber-400 animate-pulse" />
                  </div>

                  <div className="space-y-4">
                    {classwiseStatsComputed.podiumList.map((leader, index) => {
                      const medalBadge = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
                      return (
                        <div key={leader.student.id} className="flex items-center justify-between bg-slate-950/40 p-3.5 rounded-xl border border-slate-800">
                          <div className="flex items-center gap-3">
                            <span className="text-xl shrink-0">{medalBadge}</span>
                            <div>
                              <h5 className="text-xs font-black text-slate-100">{leader.student.name}</h5>
                              <p className="text-[9.5px] text-slate-400 font-mono mt-0.5">Roll No: {leader.student.rollNo} • Sec: {leader.student.section}</p>
                            </div>
                          </div>
                          
                          <div className="text-right">
                            <span className="font-mono text-xs font-extrabold text-slate-100">{leader.percentage}%</span>
                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">{leader.totalMarks} / {leader.maxPossible} M</span>
                          </div>
                        </div>
                      );
                    })}

                    {classwiseStatsComputed.podiumList.length === 0 && (
                      <p className="text-slate-400 text-xs text-center italic py-10">No students found matching this class.</p>
                    )}
                  </div>

                  <button
                    onClick={() => setActiveTab('classwise_report')}
                    id="btn-goto-classwise-report"
                    className="w-full mt-6 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-extrabold text-[10px] py-2 px-3 rounded-xl uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>View Full Tabulation Sheet</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 2. GRADE DISTRIBUTION BAR CHART */}
                <div className="lg:col-span-8 bg-white border border-gray-150 p-5 rounded-2xl shadow-xs">
                  <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider mb-2">Grade Scale Spread</h4>
                  <p className="text-[10px] mb-4 text-gray-500">Student count sorted from top-tier scales downwards.</p>
                  
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsBarChart
                        data={classwiseStatsComputed.gradeDistributionData}
                        margin={{ top: 10, right: 20, left: -20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="grade" stroke="#64748b" fontSize={11} fontWeight={600} tickLine={false} />
                        <YAxis stroke="#64748b" fontSize={11} fontWeight={600} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill={resolvedThemeColor} radius={[6, 6, 0, 0]}>
                          {classwiseStatsComputed.gradeDistributionData.map((entry, index) => {
                            return (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={resolvedThemeColor} 
                                fillOpacity={0.55 + (index / classwiseStatsComputed.gradeDistributionData.length) * 0.45} 
                              />
                            );
                          })}
                        </Bar>
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

              {/* Subject Breakdown list */}
              <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-xs">
                <div className="mb-4">
                  <h4 className="font-bold text-xs text-slate-900 uppercase">Subject performance breakdown</h4>
                  <p className="text-[10px] text-gray-400">Comparing class test averages against subject highest scores recorded for Class {selectedClass} - Section {selectedSection}.</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-gray-200">
                        <th className="p-3 font-extrabold uppercase text-gray-500 tracking-wider">Subject Name</th>
                        <th className="p-3 font-extrabold uppercase text-gray-500 tracking-wider">Class Average Score (%)</th>
                        <th className="p-3 font-extrabold uppercase text-gray-500 tracking-wider">Subject Topper Score (%)</th>
                        <th className="p-3 font-extrabold uppercase text-gray-500 tracking-wider">Best Scorer student</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-150">
                      {classwiseStatsComputed.subjectWiseMetrics.map(subItem => (
                        <tr key={subItem.subjectId} className="hover:bg-slate-50/50">
                          <td className="p-3 font-semibold text-slate-800">{subItem.subjectName}</td>
                          <td className="p-3 font-mono font-bold text-slate-900">{subItem.classAverage}%</td>
                          <td className="p-3 font-mono font-bold text-emerald-600">{subItem.bestScore}%</td>
                          <td className="p-3 text-slate-500 italic">{subItem.bestStudent}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-white p-12 text-center border rounded-2xl italic text-gray-400 text-xs">
              No registered student records matches this class section structure ({selectedClass} - Section {selectedSection}). Let's verify standard database indices.
            </div>
          )}
        </motion.div>
      )}

      {/* 2.3 SUBJECTWISE PERFORMANCE ANALYSIS */}
      {currentAnalysisMode === 'subjectwise' && (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 text-left"
        >
          {/* Subject selector + dual filters panel */}
          <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-50 p-2.5 rounded-lg text-indigo-600 shrink-0">
                <Filter className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-xs text-slate-800 leading-none uppercase tracking-wider">Select scholastic Subject & Cohort filters</h4>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">Inspect trends, passing ratios, and class dispersion charts for the selected combination.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] uppercase font-extrabold text-slate-400">Subject:</span>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="px-3.5 py-2 text-xs font-semibold border border-gray-200 outline-none rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer min-w-[150px]"
                >
                  <option value="">-- Choose Subject --</option>
                  {scholasticSubjects.map(sub => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[9px] uppercase font-extrabold text-slate-400">Class filter:</span>
                <select
                  value={subjectClass}
                  onChange={(e) => setSubjectClass(e.target.value)}
                  disabled={currentRole === 'class_teacher'}
                  className="px-3.5 py-2 text-xs font-semibold border border-gray-200 outline-none rounded-lg bg-slate-50 hover:bg-slate-100 cursor-pointer min-w-[130px] disabled:opacity-85 disabled:cursor-not-allowed disabled:bg-slate-100/80"
                >
                  <option value="all">📁 All Classes</option>
                  {uniqueClasses.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[9px] uppercase font-extrabold text-slate-400">Section filter:</span>
                <select
                  value={subjectSection}
                  onChange={(e) => setSubjectSection(e.target.value)}
                  disabled={currentRole === 'class_teacher' || subjectClass === 'all'}
                  className="px-3.5 py-2 text-xs font-semibold border border-gray-200 outline-none rounded-lg bg-slate-50 hover:bg-slate-105 cursor-pointer min-w-[110px] disabled:opacity-85 disabled:cursor-not-allowed disabled:bg-slate-100/80"
                >
                  <option value="all">📁 All Sections</option>
                  {availableSectionsSubjectwise.map(sec => (
                    <option key={sec} value={sec}>Section {sec}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {subjectwiseStatsComputed ? (
            <div className="space-y-6">
              
              {/* Agggregates row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 space-y-1">
                  <span className="text-[9.5px] uppercase text-gray-400 font-extrabold tracking-wider block">Subject Average Score</span>
                  <div className="text-3xl font-black text-slate-900 tracking-tight font-mono">
                    {subjectwiseStatsComputed.overallAvg}%
                  </div>
                  <p className="text-[10px] text-slate-400">Averaging within your chosen demographic filters</p>
                </div>

                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 space-y-1">
                  <span className="text-[9.5px] uppercase text-gray-400 font-extrabold tracking-wider block">Subject Passing Ratio</span>
                  <div className="text-3xl font-black text-slate-900 tracking-tight font-mono text-emerald-650">
                    {subjectwiseStatsComputed.passRate}%
                  </div>
                  <p className="text-[10px] text-emerald-600">Students scoring above 40% threshold</p>
                </div>

                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 space-y-1">
                  <span className="text-[9.5px] uppercase text-gray-400 font-extrabold tracking-wider block">Subject Outstanding Leader</span>
                  <div className="text-xl font-black text-slate-900 tracking-tight leading-tight select-none truncate">
                    {subjectwiseStatsComputed.topScorer?.name || 'N/A'}
                  </div>
                  <p className="text-[10px] text-indigo-600 font-bold font-mono">
                    Scored {subjectwiseStatsComputed.topScorer?.scorePercent}% (Class {subjectwiseStatsComputed.topScorer?.className || 'N/A'})
                  </p>
                </div>

              </div>

              {/* Class-wise averages comparison chart */}
              <div className="bg-white border border-gray-150 rounded-2xl p-5 shadow-xs">
                <div className="mb-4">
                  <h4 className="font-bold text-xs text-slate-900 uppercase">Class-wise comparative performance graph</h4>
                  <p className="text-[10px] text-gray-500 font-sans">Comparing average scores of {subjectwiseStatsComputed.subjectName} across classes.</p>
                </div>

                <div className="h-64 sm:h-72 w-full font-mono font-bold">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart
                      data={subjectwiseStatsComputed.classAveragesCompare}
                      margin={{ top: 10, right: 30, left: -25, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="className" stroke="#64748b" fontSize={11} fontWeight={600} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={11} fontWeight={600} tickLine={false} domain={[0, 100]} />
                      <Tooltip />
                      <Line type="monotone" dataKey="average" stroke={resolvedThemeColor} strokeWidth={3.5} activeDot={{ r: 8 }} />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-white p-12 text-center border rounded-2xl italic text-gray-400 text-xs">
              No registered students match the chosen Subject/Class/Section filter combinations. Try adjusting the scope values.
            </div>
          )}
        </motion.div>
      )}

      {/* 2.4 STUDENT SPOTLIGHT */}
      {currentAnalysisMode === 'spotlight' && (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 text-left"
        >
          {/* Spotlight selection row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left selector column */}
            <div className="lg:col-span-4 bg-white border border-gray-150 rounded-2xl p-4.5 sm:p-5 shadow-xs flex flex-col justify-between space-y-4">
              <div className="space-y-5">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-2.5">
                  <span style={{ color: resolvedThemeColor }} className="font-extrabold uppercase text-[10.5px] flex items-center gap-2">
                    <Search className="w-4 h-4" />
                    Spotlight Search Registry
                  </span>
                </div>

                {/* Classwise & Section filters for Search ledger list */}
                <div className="grid grid-cols-2 gap-3.5 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                  <div className="flex flex-col gap-1">
                    <label className="text-[8px] uppercase tracking-wider font-extrabold text-slate-400">In Class:</label>
                    <select
                      value={spotlightClass}
                      onChange={(e) => setSpotlightClass(e.target.value)}
                      disabled={currentRole === 'class_teacher'}
                      className="px-2 py-1 bg-white border border-slate-200 outline-none rounded-md text-[10.5px] font-bold cursor-pointer disabled:opacity-85 disabled:cursor-not-allowed disabled:bg-slate-100/80"
                    >
                      <option value="all">📂 All Classes</option>
                      {uniqueClasses.map(cls => (
                        <option key={cls} value={cls}>{cls}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[8px] uppercase tracking-wider font-extrabold text-slate-400">In Section:</label>
                    <select
                      value={spotlightSection}
                      onChange={(e) => setSpotlightSection(e.target.value)}
                      disabled={currentRole === 'class_teacher' || spotlightClass === 'all'}
                      className="px-2 py-1 bg-white border border-slate-200 outline-none rounded-md text-[10.5px] font-bold cursor-pointer disabled:opacity-85 disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                      <option value="all">📂 All</option>
                      {availableSectionsSpotlight.map(sec => (
                        <option key={sec} value={sec}>{sec}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[8px] uppercase tracking-widest font-extrabold text-slate-400">Search by Name:</label>
                  <input
                    type="text"
                    placeholder="Type scholar name to query..."
                    value={spotlightSearch}
                    onChange={(e) => setSpotlightSearch(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold border border-gray-200 outline-none rounded-xl bg-slate-50 text-slate-850 focus:bg-white focus:ring-1 focus:ring-indigo-505 transition-colors"
                  />
                </div>

                <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 pr-1.5 border border-gray-100 rounded-xl bg-slate-50/50">
                  {filteredSpotlightStudents.map(std => {
                    const isSelected = selectedSpotlightStudent === std.id;
                    return (
                      <div
                        key={std.id}
                        onClick={() => setSelectedSpotlightStudent(std.id)}
                        className={`p-3 text-xs font-extrabold cursor-pointer transition select-none flex items-center justify-between ${
                          isSelected ? 'bg-slate-900 text-white shadow-sm font-black' : 'text-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        <div>
                          <div className="line-clamp-1">{std.name}</div>
                          <div className={`text-[9.5px] font-mono mt-0.5 ${isSelected ? 'text-slate-350' : 'text-slate-400 font-semibold'}`}>
                            Roll: {std.rollNo} • Class {std.className} - {std.section}
                          </div>
                        </div>
                        <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-slate-350'}`} />
                      </div>
                    );
                  })}

                  {filteredSpotlightStudents.length === 0 && (
                    <div className="p-4 text-center text-slate-400 italic text-[11px]">No matching scholars found.</div>
                  )}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 text-slate-350 p-3.5 rounded-xl text-[10px] leading-relaxed mt-4">
                <Info className="w-4 h-4 text-sky-400 inline mr-1 mb-0.5" />
                Select a student from the filtered search registry to render their individual multi-subject profile instantly.
              </div>
            </div>

            {/* Right presentation dashboard */}
            <div className="lg:col-span-8 bg-white border border-gray-150 rounded-2xl p-5 shadow-xs space-y-6">
              {spotlightStudentStats ? (
                <div className="space-y-6">
                  
                  {/* Spotlight Name and Stats */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pb-4 border-b border-gray-100 gap-3">
                    <div>
                      <h3 className="text-lg font-black text-slate-900 tracking-tight leading-none">
                        {spotlightStudentStats.details.student.name}
                      </h3>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Roll No: <strong className="text-slate-800 font-mono">{spotlightStudentStats.details.student.rollNo}</strong> • Class level: <strong className="text-indigo-650 font-mono">{spotlightStudentStats.details.className} - {spotlightStudentStats.details.student.section}</strong> • Grade Scale: <strong className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded leading-none font-mono text-[9.5px]">{spotlightStudentStats.details.grade}</strong>
                      </p>
                    </div>

                    <div className="bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-xl text-center shadow-xs shrink-0">
                      <span className="text-[9px] uppercase tracking-wider block font-extrabold text-indigo-700 font-sans">Accumulated Score</span>
                      <span className="font-mono font-black text-slate-900 text-lg leading-tight block">
                        {spotlightStudentStats.details.percentage}%
                      </span>
                    </div>
                  </div>

                  {/* Highlighters cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3.5 text-xs text-emerald-950 flex items-center gap-3">
                      <div className="bg-emerald-100 text-emerald-700 p-2 rounded-xl shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <strong className="block text-[10px] uppercase text-emerald-800 tracking-wider font-extrabold">Academic Strong Point</strong>
                        <span>{spotlightStudentStats.strength?.name || 'All-rounder'} ({spotlightStudentStats.strength?.score || 0}%)</span>
                      </div>
                    </div>

                    <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3.5 text-xs text-slate-900 flex items-center gap-3">
                      <div className="bg-amber-100 text-amber-750 p-2 rounded-xl shrink-0">
                        <AlertCircle className="w-4 h-4 animate-pulse" />
                      </div>
                      <div>
                        <strong className="block text-[10px] uppercase text-amber-800 tracking-wider font-extrabold font-sans">Opportunity Area</strong>
                        <span>{spotlightStudentStats.growthArea?.name || 'All-rounder'} ({spotlightStudentStats.growthArea?.score || 0}%)</span>
                      </div>
                    </div>
                  </div>

                  {/* Spotlight Area Graph */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-xs uppercase text-slate-800 tracking-wider">Academic Subject Profile Map</h4>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={spotlightStudentStats.chartProfile}
                          margin={{ top: 10, right: 30, left: -25, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="subject" stroke="#64748b" fontSize={11} fontWeight={600} tickLine={false} />
                          <YAxis stroke="#64748b" fontSize={11} fontWeight={600} tickLine={false} domain={[0, 100]} />
                          <Tooltip />
                          <Legend verticalAlign="top" height={36} iconType="circle" />
                          <Area name="Student Score Percentage" type="monotone" dataKey="score" stroke="#4f46e5" strokeWidth={3} fillOpacity={0.2} fill="#818cf8" />
                          <Area name="Class Average Comparison" type="monotone" dataKey="classAvg" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" fill="transparent" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="p-12 text-center text-slate-400 italic text-xs">
                  Select a scholar from the list matching the filters to view custom grades.
                </div>
              )}
            </div>

          </div>
        </motion.div>
      )}

    </div>
  );
}
