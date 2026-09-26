import React, { useState, useMemo } from "react";
import {
  SchoolBranding,
  ScoreColumn,
  SubjectColumn,
  GradeScale,
  Student,
  StudentGrades,
  ReportCardStructure,
  CoScholasticSection,
} from "../types";
import { matchStructureForStudent } from "../utils/classNormalizer";
import {
  Printer,
  Trophy,
  Table,
  ArrowLeft,
  Download,
  ShieldCheck,
  UserCheck,
  LayoutList,
  Copy,
} from "lucide-react";

interface ClasswiseMasterReportProps {
  branding: SchoolBranding;
  subjects: SubjectColumn[];
  scoreColumns: ScoreColumn[];
  gradeScales: GradeScale[];
  students: Student[];
  studentGrades: StudentGrades[];
  currentRole?: string | null;
  activeTeacherObj?: any | null;
  reportCardStructures?: ReportCardStructure[];
}

export default function ClasswiseMasterReport({
  branding,
  subjects,
  scoreColumns,
  gradeScales: globalGradeScales,
  students,
  studentGrades,
  currentRole,
  activeTeacherObj,
  reportCardStructures = [],
}: ClasswiseMasterReportProps) {
  // Navigation tabs inside Report tab
  const [reportTab, setReportTab] = useState<"tabulation" | "ranks">(
    "tabulation",
  );

  // Available classes & sections with robust trim checks
  const uniqueClasses = useMemo(() => {
    return Array.from(
      new Set(students.map((s) => s.className?.trim()).filter(Boolean)),
    ).sort();
  }, [students]);

  // Selected filters
  const [selectedClass, setSelectedClass] = useState<string>("");

  // Auto-select the first available class for non-teachers so the sheet displays immediately
  React.useEffect(() => {
    if (!selectedClass && uniqueClasses.length > 0 && currentRole !== "class_teacher") {
      setSelectedClass(uniqueClasses[0]);
    }
  }, [uniqueClasses, selectedClass, currentRole]);

  // Smoothly scroll window to top when selectedClass changes to put main tabulation report in view
  React.useEffect(() => {
    if (selectedClass) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [selectedClass]);
  const [selectedSection, setSelectedSection] = useState<string>("all");
  const [marksView, setMarksView] = useState<"overall" | "term1" | "term2" | "term3">(
    "overall",
  );
  const [sortBy, setSortBy] = useState<"roll" | "rank" | "name">("roll");

  // Pagination states for master list and registers
  const [registerPage, setRegisterPage] = useState<number>(1);
  const [registerPageSize, setRegisterPageSize] = useState<number>(25);

  // Reset pagination on filter changes
  React.useEffect(() => {
    setRegisterPage(1);
  }, [selectedClass, selectedSection, marksView, sortBy]);

  // Interactive print settings to hide/show columns and individual rows
  const [hiddenSubjects, setHiddenSubjects] = useState<Set<string>>(new Set());
  const [hiddenCoScholastics, setHiddenCoScholastics] = useState<Set<string>>(
    new Set(),
  );
  const [hiddenScoreCols, setHiddenScoreCols] = useState<Set<string>>(
    new Set(),
  );
  const [hiddenSummaryCols, setHiddenSummaryCols] = useState<Set<string>>(
    new Set(),
  );
  const [hiddenStudentIds, setHiddenStudentIds] = useState<Set<string>>(
    new Set(),
  );
  const [designerTab, setDesignerTab] = useState<"columns" | null>(
    null,
  );

  // Offline Blank List & Printing Customizations
  const [isBlankPrintMode, setIsBlankPrintMode] = useState<boolean>(false);
  const [printOrientation, setPrintOrientation] = useState<"portrait" | "landscape">("landscape");
  const [isDoubleCopyEnabled, setIsDoubleCopyEnabled] = useState<boolean>(false);
  const [blankSubjectMode, setBlankSubjectMode] = useState<"blank" | "selective">("blank");
  const [selectedBlankSubject, setSelectedBlankSubject] = useState<string>("");

  const handleToggleBlankMode = (checked: boolean) => {
    setIsBlankPrintMode(checked);
    if (checked) {
      setPrintOrientation("portrait");
    } else {
      setPrintOrientation("landscape");
    }
  };

  // Bulk Selection Helper Functions for Column Groups
  const showAllGeneralExam = () => {
    setHiddenSummaryCols((prev) => {
      const next = new Set(prev);
      next.delete("rollNo");
      next.delete("classSec");
      return next;
    });
    setHiddenScoreCols(new Set());
  };

  const hideAllGeneralExam = () => {
    setHiddenSummaryCols((prev) => {
      const next = new Set(prev);
      next.add("rollNo");
      next.add("classSec");
      return next;
    });
    const allColIds = classStructure.resolvedScoreColumns.map((c) => c.id);
    setHiddenScoreCols(new Set(allColIds));
  };

  const showAllScholastic = () => {
    setHiddenSubjects(new Set());
  };

  const hideAllScholastic = () => {
    setHiddenSubjects(new Set(scholasticSubjects.map((s) => s.id)));
  };

  const showAllCoScholastic = () => {
    setHiddenCoScholastics(new Set());
  };

  const hideAllCoScholastic = () => {
    setHiddenCoScholastics(new Set(activeCoScholasticSubjects.map((s) => s.id)));
  };

  const showAllAggregates = () => {
    setHiddenSummaryCols((prev) => {
      const next = new Set(prev);
      [
        "t1Total",
        "t1Pct",
        "t1Grade",
        "t2Total",
        "t2Pct",
        "t2Grade",
        "combTotal",
        "combPct",
        "combGrade",
        "rank",
      ].forEach((id) => next.delete(id));
      return next;
    });
  };

  const hideAllAggregates = () => {
    setHiddenSummaryCols((prev) => {
      const next = new Set(prev);
      [
        "t1Total",
        "t1Pct",
        "t1Grade",
        "t2Total",
        "t2Pct",
        "t2Grade",
        "combTotal",
        "combPct",
        "combGrade",
        "rank",
      ].forEach((id) => next.add(id));
      return next;
    });
  };

  const toggleSubjectVisibility = (subId: string) => {
    setHiddenSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(subId)) {
        next.delete(subId);
      } else {
        next.add(subId);
      }
      return next;
    });
  };

  const toggleCoScholasticVisibility = (subId: string) => {
    setHiddenCoScholastics((prev) => {
      const next = new Set(prev);
      if (next.has(subId)) {
        next.delete(subId);
      } else {
        next.add(subId);
      }
      return next;
    });
  };

  const toggleScoreColVisibility = (colId: string) => {
    setHiddenScoreCols((prev) => {
      const next = new Set(prev);
      if (next.has(colId)) {
        next.delete(colId);
      } else {
        next.add(colId);
      }
      return next;
    });
  };

  const toggleSummaryColVisibility = (colKey: string) => {
    setHiddenSummaryCols((prev) => {
      const next = new Set(prev);
      if (next.has(colKey)) {
        next.delete(colKey);
      } else {
        next.add(colKey);
      }
      return next;
    });
  };

  const toggleStudentVisibility = (studentId: string) => {
    setHiddenStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const toggleAllStudentsVisibility = (
    showAll: boolean,
    matchingStudentIds: string[],
  ) => {
    setHiddenStudentIds((prev) => {
      if (showAll) {
        return new Set();
      } else {
        return new Set(matchingStudentIds);
      }
    });
  };

  // Keep teachers synchronized to their single assigned class and section
  React.useEffect(() => {
    if (currentRole === "class_teacher" && activeTeacherObj) {
      if (activeTeacherObj.assignedClass) {
        setSelectedClass(activeTeacherObj.assignedClass);
      }
      if (activeTeacherObj.assignedSection) {
        setSelectedSection(activeTeacherObj.assignedSection);
      }
    }
  }, [students, currentRole, activeTeacherObj]);

  // Filter sections based on selected class
  const uniqueSectionsForClass = useMemo(() => {
    const clsStudents = students.filter((s) => {
      const sClass = s.className?.trim().toLowerCase() || "";
      const filterClassLower = selectedClass?.trim().toLowerCase() || "";
      if (filterClassLower === "all") return true;
      return sClass === filterClassLower;
    });
    return Array.from(
      new Set(clsStudents.map((s) => s.section?.trim()).filter(Boolean)),
    ).sort();
  }, [students, selectedClass]);

  // A helper to resolve the effective structure for the selected class
  const classStructure = useMemo(() => {
    if (!students || students.length === 0) {
      return {
        resolvedBranding: branding,
        resolvedSubjects: subjects,
        resolvedScoreColumns: scoreColumns,
        resolvedGradeScales: globalGradeScales,
        resolvedCoScholasticSections: [] as CoScholasticSection[],
        resolvedCoScholasticOneColumn: false,
      };
    }

    // Find a student from the filtered class, or if selectedClass === 'all', the first student
    const representativeStudent =
      students.find((s) => {
        if (selectedClass === "all") return true;
        return (
          s.className?.trim().toLowerCase() ===
          selectedClass.trim().toLowerCase()
        );
      }) || students[0];

    if (!representativeStudent || !reportCardStructures) {
      return {
        resolvedBranding: branding,
        resolvedSubjects: subjects,
        resolvedScoreColumns: scoreColumns,
        resolvedGradeScales: globalGradeScales,
        resolvedCoScholasticSections: [] as CoScholasticSection[],
        resolvedCoScholasticOneColumn: false,
      };
    }

    const matchedStruct = matchStructureForStudent(
      reportCardStructures,
      representativeStudent.className,
      representativeStudent.section
    );

    if (matchedStruct) {
      return {
        resolvedBranding: {
          ...(matchedStruct.branding || {}),
          ...branding,
          schoolName: branding.schoolName || matchedStruct.branding?.schoolName || "DEMO PUBLIC SCHOOL",
        },
        resolvedSubjects:
          matchedStruct.subjects && matchedStruct.subjects.length > 0
            ? matchedStruct.subjects
            : subjects,
        resolvedScoreColumns:
          matchedStruct.scoreColumns && matchedStruct.scoreColumns.length > 0
            ? matchedStruct.scoreColumns
            : scoreColumns,
        resolvedGradeScales:
          matchedStruct.gradeScales && matchedStruct.gradeScales.length > 0
            ? matchedStruct.gradeScales
            : globalGradeScales,
        resolvedCoScholasticSections: matchedStruct.coScholasticSections || [],
        resolvedCoScholasticOneColumn:
          matchedStruct.coScholasticOneColumn || false,
        resolvedPureGradeBased: matchedStruct.pureGradeBased || false,
        resolvedTermSpecificScoreColumnsEnabled: matchedStruct.termSpecificScoreColumnsEnabled || false,
        resolvedTerm1ScoreColumns: matchedStruct.term1ScoreColumns || [],
        resolvedTerm2ScoreColumns: matchedStruct.term2ScoreColumns || [],
        resolvedTerm3ScoreColumns: matchedStruct.term3ScoreColumns || [],
      };
    }

    return {
      resolvedBranding: branding,
      resolvedSubjects: subjects,
      resolvedScoreColumns: scoreColumns,
      resolvedGradeScales: globalGradeScales,
      resolvedCoScholasticSections: [] as CoScholasticSection[],
      resolvedCoScholasticOneColumn: false,
      resolvedPureGradeBased: false,
      resolvedTermSpecificScoreColumnsEnabled: false,
      resolvedTerm1ScoreColumns: [] as ScoreColumn[],
      resolvedTerm2ScoreColumns: [] as ScoreColumn[],
      resolvedTerm3ScoreColumns: [] as ScoreColumn[],
    };
  }, [
    selectedClass,
    students,
    reportCardStructures,
    branding,
    subjects,
    scoreColumns,
    globalGradeScales,
  ]);

  const gradeScales = classStructure.resolvedGradeScales;

  const term1Enabled = classStructure.resolvedBranding?.term1Enabled !== false;
  const term2Enabled = classStructure.resolvedBranding?.term2Enabled !== false;
  const term3Enabled = classStructure.resolvedBranding?.term3Enabled === true;

  // Active scholastic subjects as per resolved class structure
  const scholasticSubjects = useMemo(() => {
    return classStructure.resolvedSubjects.filter(
      (sub) => sub.type === "scholastic",
    );
  }, [classStructure.resolvedSubjects]);

  // Active co-scholastics sections list
  const coScholasticSectionsList = useMemo(() => {
    const sections = classStructure.resolvedCoScholasticSections;
    if (sections && sections.length > 0) {
      return sections;
    }

    const personalityHeaderLabel =
      branding.personalityHeaderLabel ||
      "Part II: Personality & Co-Scholastic Traits (5-Point Scale)";
    const coCurricularHeaderLabel =
      branding.coCurricularHeaderLabel ||
      "Part III: Co-Curricular / Extracurricular Activities";

    const defaults = [];
    defaults.push({
      id: "co_scholastic",
      title: personalityHeaderLabel,
      subjectHeader: branding.personalitySubjectHeaderLabel || "Trait / Aspect",
      gradingScaleText: "5-Point Scale",
      term1Enabled: term1Enabled,
      term2Enabled: term2Enabled,
      type: "co_scholastic" as const,
    });

    if (!branding.coCurricularDisabled) {
      defaults.push({
        id: "activity",
        title: coCurricularHeaderLabel,
        subjectHeader:
          branding.coCurricularSubjectHeaderLabel || "Activity / Aspect",
        gradingScaleText: "3-Point Scale",
        term1Enabled: term1Enabled,
        term2Enabled: term2Enabled,
        type: "activity" as const,
      });
    }

    return defaults;
  }, [classStructure, branding, term1Enabled, term2Enabled]);

  // Active co-scholastic subjects as per resolved class structure, filtering out if custom card has no active sections
  const activeCoScholasticSubjects = useMemo(() => {
    const hasCustomStructure = !!matchStructureForStudent(
      reportCardStructures,
      selectedClass,
      selectedSection !== 'all' ? selectedSection : undefined
    );

    const effectiveSections =
      hasCustomStructure &&
      (!classStructure.resolvedCoScholasticSections ||
        classStructure.resolvedCoScholasticSections.length === 0)
        ? []
        : coScholasticSectionsList;

    const list: SubjectColumn[] = [];
    effectiveSections.forEach((sec) => {
      const matchSubs = classStructure.resolvedSubjects.filter(
        (s) =>
          s.sectionId === sec.id ||
          (s.type === sec.type && (!s.sectionId || s.sectionId === sec.id)),
      );
      list.push(...matchSubs);
    });

    return Array.from(new Map(list.map((s) => [s.id, s])).values());
  }, [
    coScholasticSectionsList,
    classStructure,
    reportCardStructures,
    selectedClass,
  ]);

  // Hidden/Visible filter selections for presentation rendering
  const visibleScholasticSubjects = useMemo(() => {
    return scholasticSubjects.filter((sub) => !hiddenSubjects.has(sub.id));
  }, [scholasticSubjects, hiddenSubjects]);

  const visibleCoScholasticSubjects = useMemo(() => {
    return activeCoScholasticSubjects.filter(
      (sub) => !hiddenCoScholastics.has(sub.id),
    );
  }, [activeCoScholasticSubjects, hiddenCoScholastics]);

  const visibleScoreColumns = useMemo(() => {
    return classStructure.resolvedScoreColumns.filter(
      (col) => !hiddenScoreCols.has(col.id),
    );
  }, [classStructure.resolvedScoreColumns, hiddenScoreCols]);

  const getGradeForValueAndMax = (scoreVal: number, maxVal: number) => {
    if (maxVal <= 0) return "-";
    const pct = (scoreVal * 100) / maxVal;
    for (const scale of gradeScales) {
      if (pct >= scale.minPercent && pct <= scale.maxPercent) {
        return scale.grade;
      }
    }
    return "-";
  };

  // Get a student's grade/rating for a co-scholastic subject
  const getCoScholasticSubjectGrade = (
    studentId: string,
    subject: SubjectColumn,
    term: number,
  ) => {
    const grades = studentGrades.find((g) => g.studentId === studentId);
    const termKey = term === 1 ? "term1" : term === 2 ? "term2" : "term3";
    if (subject.type === "co_scholastic") {
      return grades?.co_scholastic?.[subject.id]?.[termKey] || "-";
    } else if (subject.type === "activity") {
      return grades?.activity?.[subject.id]?.[termKey] || "-";
    } else {
      return (
        grades?.co_scholastic?.[subject.id]?.[termKey] ||
        grades?.activity?.[subject.id]?.[termKey] ||
        "-"
      );
    }
  };

  // Process data for the selected filtered class/section
  const processedStudentsData = useMemo(() => {
    const getMidpointPercentForGrade = (gradeName: string) => {
      if (!gradeName) return 0;
      const cleanGrade = String(gradeName).trim().toUpperCase();
      const match = gradeScales.find(scale => scale.grade.trim().toUpperCase() === cleanGrade);
      if (match) {
        return (match.minPercent + match.maxPercent) / 2;
      }
      return 0;
    };

    const getEquivalentMark = (val: any, maxMarks: number) => {
      const parsedMax = Number(maxMarks) || 0;
      if (val === undefined || val === null || val === '') return 0;
      if (typeof val === 'string' && isNaN(Number(val))) {
        // It's a grade string like "A1", get its midpoint percentage
        const midPercent = getMidpointPercentForGrade(val);
        const res = (midPercent / 100) * parsedMax;
        return isNaN(res) ? 0 : res;
      }
      const num = Number(val);
      return isNaN(num) ? 0 : num;
    };

    // 1. Filter students with robust trim and case-insensitive matching
    let filtered = students.filter((s) => {
      const sClass = s.className?.trim().toLowerCase() || "";
      const sSection = s.section?.trim().toLowerCase() || "";
      const filterClassLower = selectedClass?.trim().toLowerCase() || "";
      const filterSecLower = selectedSection?.trim().toLowerCase() || "";

      const matchClass =
        filterClassLower === "all" || sClass === filterClassLower;
      const matchSection =
        filterSecLower === "all" || sSection === filterSecLower;
      return matchClass && matchSection;
    });

    // 2. Compute academic scores & metrics for each student
    const resultList = filtered.map((std) => {
      const grades = studentGrades.find((g) => g.studentId === std.id);

      const subjectScores: {
        [subId: string]: {
          overall: number;
          t1Sum: number;
          t2Sum: number;
          t3Sum: number;
          grade: string;
        };
      } = {};
      let studentT1Total = 0;
      let studentT2Total = 0;
      let studentT3Total = 0;
      let scholasticCount = 0;

      const activeScholSubjects = classStructure.resolvedSubjects.filter(
        (sub) => sub.type === "scholastic",
      );
      const activeScoreCols = classStructure.resolvedScoreColumns;
      const activeT1Cols = (classStructure.resolvedTermSpecificScoreColumnsEnabled && classStructure.resolvedTerm1ScoreColumns && classStructure.resolvedTerm1ScoreColumns.length > 0)
        ? classStructure.resolvedTerm1ScoreColumns
        : activeScoreCols;
      const activeT2Cols = (classStructure.resolvedTermSpecificScoreColumnsEnabled && classStructure.resolvedTerm2ScoreColumns && classStructure.resolvedTerm2ScoreColumns.length > 0)
        ? classStructure.resolvedTerm2ScoreColumns
        : activeScoreCols;
      const activeT3Cols = (classStructure.resolvedTermSpecificScoreColumnsEnabled && classStructure.resolvedTerm3ScoreColumns && classStructure.resolvedTerm3ScoreColumns.length > 0)
        ? classStructure.resolvedTerm3ScoreColumns
        : activeScoreCols;

      activeScholSubjects.forEach((sub) => {
        const scoreSheet = grades?.scholastic?.[sub.id] || {
          term1: {},
          term2: {},
          term3: {},
        };
        scholasticCount++;

        // Sum Term 1
        const t1Sum = activeT1Cols.reduce((sum, col) => {
          const val = scoreSheet.term1?.[col.id];
          const equivalentMark = getEquivalentMark(val, col.maxMarks);
          return sum + equivalentMark;
        }, 0);

        // Sum Term 2
        const t2Sum = activeT2Cols.reduce((sum, col) => {
          const val = scoreSheet.term2?.[col.id];
          const equivalentMark = getEquivalentMark(val, col.maxMarks);
          return sum + equivalentMark;
        }, 0);

        // Sum Term 3
        const t3Sum = activeT3Cols.reduce((sum, col) => {
          const val = scoreSheet.term3?.[col.id];
          const equivalentMark = getEquivalentMark(val, col.maxMarks);
          return sum + equivalentMark;
        }, 0);

        studentT1Total += t1Sum;
        studentT2Total += t2Sum;
        studentT3Total += t3Sum;

        let overall = 0;
        let percent = 0;
        let activeTermsCount = 0;
        let sumTotal = 0;

        if (term1Enabled) {
          sumTotal += t1Sum;
          activeTermsCount++;
        }
        if (term2Enabled) {
          sumTotal += t2Sum;
          activeTermsCount++;
        }
        if (term3Enabled) {
          sumTotal += t3Sum;
          activeTermsCount++;
        }

        overall = parseFloat(sumTotal.toFixed(1));
        if (activeTermsCount > 0) {
          percent = sumTotal / activeTermsCount;
        }

        // Find subject grade from percent
        let subjectGrade = "E";
        for (const scale of gradeScales) {
          if (percent >= scale.minPercent && percent <= scale.maxPercent) {
            subjectGrade = scale.grade;
            break;
          }
        }

        subjectScores[sub.id] = {
          overall,
          t1Sum,
          t2Sum,
          t3Sum,
          grade: subjectGrade,
        };
      });

      // Max single term marks for all scholastic subjects combined
      const maxSingleTermScholasticMarks =
        scholasticCount *
        activeScoreCols.reduce((sum, col) => sum + col.maxMarks, 0);

      // Calculations of T1 Pct & Grade
      const t1Pct =
        maxSingleTermScholasticMarks > 0
          ? parseFloat(
              ((studentT1Total * 100) / maxSingleTermScholasticMarks).toFixed(
                2,
              ),
            )
          : 0;
      let t1Grade = "E";
      for (const scale of gradeScales) {
        if (t1Pct >= scale.minPercent && t1Pct <= scale.maxPercent) {
          t1Grade = scale.grade;
          break;
        }
      }

      // Calculations of T2 Pct & Grade
      const t2Pct =
        maxSingleTermScholasticMarks > 0
          ? parseFloat(
              ((studentT2Total * 100) / maxSingleTermScholasticMarks).toFixed(
                2,
              ),
            )
          : 0;
      let t2Grade = "E";
      for (const scale of gradeScales) {
        if (t2Pct >= scale.minPercent && t2Pct <= scale.maxPercent) {
          t2Grade = scale.grade;
          break;
        }
      }

      // Calculations of T3 Pct & Grade
      const t3Pct =
        maxSingleTermScholasticMarks > 0
          ? parseFloat(
              ((studentT3Total * 100) / maxSingleTermScholasticMarks).toFixed(
                2,
              ),
            )
          : 0;
      let t3Grade = "E";
      for (const scale of gradeScales) {
        if (t3Pct >= scale.minPercent && t3Pct <= scale.maxPercent) {
          t3Grade = scale.grade;
          break;
        }
      }

      // Active selected total & percentage
      let activeTotal = 0;
      let activeMaxPossible = 0;

      if (marksView === "term1") {
        activeTotal = studentT1Total;
        activeMaxPossible = maxSingleTermScholasticMarks;
      } else if (marksView === "term2") {
        activeTotal = studentT2Total;
        activeMaxPossible = maxSingleTermScholasticMarks;
      } else if (marksView === "term3") {
        activeTotal = studentT3Total;
        activeMaxPossible = maxSingleTermScholasticMarks;
      } else {
        // overall
        let termTotalsSum = 0;
        let termCount = 0;
        if (term1Enabled) {
          termTotalsSum += studentT1Total;
          termCount++;
        }
        if (term2Enabled) {
          termTotalsSum += studentT2Total;
          termCount++;
        }
        if (term3Enabled) {
          termTotalsSum += studentT3Total;
          termCount++;
        }
        activeTotal = termTotalsSum;
        activeMaxPossible = maxSingleTermScholasticMarks * termCount;
      }

      const activePct =
        activeMaxPossible > 0
          ? parseFloat(((activeTotal * 100) / activeMaxPossible).toFixed(2))
          : 0;

      let activeGrade = "E";
      for (const scale of gradeScales) {
        if (activePct >= scale.minPercent && activePct <= scale.maxPercent) {
          activeGrade = scale.grade;
          break;
        }
      }

      return {
        student: std,
        subjectScores,
        t1Total: studentT1Total,
        t1Pct,
        t1Grade,
        t2Total: studentT2Total,
        t2Pct,
        t2Grade,
        t3Total: studentT3Total,
        t3Pct,
        t3Grade,
        totalMarks: parseFloat(activeTotal.toFixed(1)),
        maxPossibleMarks: activeMaxPossible,
        percentage: activePct,
        overallGrade: activeGrade,
      };
    });

    // 3. Sort descending by marks to assign true ranks
    const sortedForRank = [...resultList].sort(
      (a, b) => b.totalMarks - a.totalMarks,
    );

    // 4. Assign competition ranks
    const rankedList = sortedForRank.map((item, idx) => {
      let rank = idx + 1;

      // If same marks as previous, assign same rank
      if (idx > 0 && item.totalMarks === sortedForRank[idx - 1].totalMarks) {
        rank = (sortedForRank[idx - 1] as any).assignedRank || rank;
      }

      (item as any).assignedRank = rank;
      return {
        ...item,
        rank,
      };
    });

    // 5. Apply secondary sorting criteria (sortBy)
    const finalSorted = [...rankedList].sort((a, b) => {
      if (sortBy === "rank") {
        return a.rank - b.rank;
      } else if (sortBy === "name") {
        return a.student.name.localeCompare(b.student.name);
      } else {
        // Default: Sort by Roll Number (numerically if possible)
        const rollA = parseInt(a.student.rollNo) || 0;
        const rollB = parseInt(b.student.rollNo) || 0;
        if (rollA !== rollB) return rollA - rollB;
        return a.student.rollNo.localeCompare(b.student.rollNo);
      }
    });

    return finalSorted;
  }, [
    students,
    studentGrades,
    classStructure,
    gradeScales,
    selectedClass,
    selectedSection,
    marksView,
    sortBy,
    term1Enabled,
    term2Enabled,
    term3Enabled,
  ]);

  const visibleProcessedStudents = useMemo(() => {
    return processedStudentsData.filter(
      (row) => !hiddenStudentIds.has(row.student.id),
    );
  }, [processedStudentsData, hiddenStudentIds]);

  const totalRegisterPages = useMemo(() => {
    return Math.max(1, Math.ceil(visibleProcessedStudents.length / registerPageSize));
  }, [visibleProcessedStudents, registerPageSize]);

  const paginatedRegisterStudents = useMemo(() => {
    if (registerPageSize >= 9999) return visibleProcessedStudents;
    const startIndex = (registerPage - 1) * registerPageSize;
    return visibleProcessedStudents.slice(startIndex, startIndex + registerPageSize);
  }, [visibleProcessedStudents, registerPage, registerPageSize]);

  const paginatedRankStudents = useMemo(() => {
    const sorted = [...processedStudentsData].sort((a, b) => a.rank - b.rank);
    if (registerPageSize >= 9999) return sorted;
    const startIndex = (registerPage - 1) * registerPageSize;
    return sorted.slice(startIndex, startIndex + registerPageSize);
  }, [processedStudentsData, registerPage, registerPageSize]);

  const effectiveT1Cols = useMemo(() => {
    return (classStructure.resolvedTermSpecificScoreColumnsEnabled && classStructure.resolvedTerm1ScoreColumns && classStructure.resolvedTerm1ScoreColumns.length > 0)
      ? classStructure.resolvedTerm1ScoreColumns.filter(col => !hiddenScoreCols.has(col.id))
      : visibleScoreColumns;
  }, [classStructure, visibleScoreColumns, hiddenScoreCols]);

  const effectiveT2Cols = useMemo(() => {
    return (classStructure.resolvedTermSpecificScoreColumnsEnabled && classStructure.resolvedTerm2ScoreColumns && classStructure.resolvedTerm2ScoreColumns.length > 0)
      ? classStructure.resolvedTerm2ScoreColumns.filter(col => !hiddenScoreCols.has(col.id))
      : visibleScoreColumns;
  }, [classStructure, visibleScoreColumns, hiddenScoreCols]);

  const effectiveT3Cols = useMemo(() => {
    return (classStructure.resolvedTermSpecificScoreColumnsEnabled && classStructure.resolvedTerm3ScoreColumns && classStructure.resolvedTerm3ScoreColumns.length > 0)
      ? classStructure.resolvedTerm3ScoreColumns.filter(col => !hiddenScoreCols.has(col.id))
      : visibleScoreColumns;
  }, [classStructure, visibleScoreColumns, hiddenScoreCols]);

  const t1SubColDetails = useMemo(() => {
    if (classStructure.resolvedPureGradeBased && !isBlankPrintMode) {
      return [{ id: "grade", label: "Grade" }];
    }
    const cols = effectiveT1Cols.map((col) => ({
      id: col.id,
      label: classStructure.resolvedPureGradeBased ? col.name : `${col.name} (${col.maxMarks})`,
    }));
    if (isBlankPrintMode) return cols;
    return [...cols, { id: "total", label: "Total" }];
  }, [effectiveT1Cols, isBlankPrintMode, classStructure.resolvedPureGradeBased]);

  const t2SubColDetails = useMemo(() => {
    if (classStructure.resolvedPureGradeBased && !isBlankPrintMode) {
      return [{ id: "grade", label: "Grade" }];
    }
    const cols = effectiveT2Cols.map((col) => ({
      id: col.id,
      label: classStructure.resolvedPureGradeBased ? col.name : `${col.name} (${col.maxMarks})`,
    }));
    if (isBlankPrintMode) return cols;
    return [...cols, { id: "total", label: "Total" }];
  }, [effectiveT2Cols, isBlankPrintMode, classStructure.resolvedPureGradeBased]);

  const t3SubColDetails = useMemo(() => {
    if (classStructure.resolvedPureGradeBased && !isBlankPrintMode) {
      return [{ id: "grade", label: "Grade" }];
    }
    const cols = effectiveT3Cols.map((col) => ({
      id: col.id,
      label: classStructure.resolvedPureGradeBased ? col.name : `${col.name} (${col.maxMarks})`,
    }));
    if (isBlankPrintMode) return cols;
    return [...cols, { id: "total", label: "Total" }];
  }, [effectiveT3Cols, isBlankPrintMode, classStructure.resolvedPureGradeBased]);

  const totalColumnsCount = useMemo(() => {
    let count = 1; // Student Name
    if (!hiddenSummaryCols.has("rollNo")) count++;
    if (!hiddenSummaryCols.has("classSec")) count++;
    // Checkbox Column is removed

    if (classStructure.resolvedPureGradeBased) {
      if (marksView === "term1" || marksView === "overall") {
        if (marksView === "term1" || term1Enabled) {
          count += visibleScholasticSubjects.length * t1SubColDetails.length;
          count += visibleCoScholasticSubjects.length;
          if (!isBlankPrintMode) {
            count++; // T1 Grade only
          }
        }
      }
      if (marksView === "term2" || marksView === "overall") {
        if (marksView === "term2" || term2Enabled) {
          count += visibleScholasticSubjects.length * t2SubColDetails.length;
          count += visibleCoScholasticSubjects.length;
          if (!isBlankPrintMode) {
            count++; // T2 Grade only
          }
        }
      }
      if (marksView === "term3" || marksView === "overall") {
        if (marksView === "term3" || term3Enabled) {
          count += visibleScholasticSubjects.length * t3SubColDetails.length;
          count += visibleCoScholasticSubjects.length;
          if (!isBlankPrintMode) {
            count++; // T3 Grade only
          }
        }
      }
      if (marksView === "overall") {
        if (!isBlankPrintMode) {
          count++; // Overall Grade only
        }
      }
    } else {
      if (marksView === "term1" || marksView === "overall") {
        if (marksView === "term1" || term1Enabled) {
          count += visibleScholasticSubjects.length * t1SubColDetails.length;
          count += visibleCoScholasticSubjects.length;
          if (!isBlankPrintMode) {
            if (!hiddenSummaryCols.has("t1Total")) count++;
            if (!hiddenSummaryCols.has("t1Pct")) count++;
            if (!hiddenSummaryCols.has("t1Grade")) count++;
          }
        }
      }

      if (marksView === "term2" || marksView === "overall") {
        if (marksView === "term2" || term2Enabled) {
          count += visibleScholasticSubjects.length * t2SubColDetails.length;
          count += visibleCoScholasticSubjects.length;
          if (!isBlankPrintMode) {
            if (!hiddenSummaryCols.has("t2Total")) count++;
            if (!hiddenSummaryCols.has("t2Pct")) count++;
            if (!hiddenSummaryCols.has("t2Grade")) count++;
          }
        }
      }

      if (marksView === "term3" || marksView === "overall") {
        if (marksView === "term3" || term3Enabled) {
          count += visibleScholasticSubjects.length * t3SubColDetails.length;
          count += visibleCoScholasticSubjects.length;
          if (!isBlankPrintMode) {
            if (!hiddenSummaryCols.has("t3Total")) count++;
            if (!hiddenSummaryCols.has("t3Pct")) count++;
            if (!hiddenSummaryCols.has("t3Grade")) count++;
          }
        }
      }

      if (marksView === "overall") {
        if (!isBlankPrintMode) {
          if (!hiddenSummaryCols.has("combTotal")) count++;
          if (!hiddenSummaryCols.has("combPct")) count++;
          if (!hiddenSummaryCols.has("combGrade")) count++;
        }
      }
    }

    if (!isBlankPrintMode) {
      if (!hiddenSummaryCols.has("rank")) count++;
    }

    return count;
  }, [
    marksView,
    term1Enabled,
    term2Enabled,
    term3Enabled,
    visibleScholasticSubjects,
    visibleCoScholasticSubjects,
    visibleScoreColumns,
    hiddenSummaryCols,
    isBlankPrintMode,
  ]);

  const maxSingleTermMarksOfClass = useMemo(() => {
    return (
      classStructure.resolvedScoreColumns.reduce(
        (sum, col) => sum + col.maxMarks,
        0,
      ) || 100
    );
  }, [classStructure.resolvedScoreColumns]);

  // Dynamic sub-columns for each subject depending on marksView selection
  const subjectSubColumns = useMemo(() => {
    const list: {
      id: string;
      label: string;
      term?: number;
      type: "score" | "total" | "overall_total";
    }[] = [];

    if (marksView === "term1") {
      effectiveT1Cols.forEach((col) => {
        list.push({ id: col.id, label: col.name, type: "score", term: 1 });
      });
      list.push({ id: "t1_total", label: "Total", type: "total", term: 1 });
    } else if (marksView === "term2") {
      effectiveT2Cols.forEach((col) => {
        list.push({ id: col.id, label: col.name, type: "score", term: 2 });
      });
      list.push({ id: "t2_total", label: "Total", type: "total", term: 2 });
    } else if (marksView === "term3") {
      effectiveT3Cols.forEach((col) => {
        list.push({ id: col.id, label: col.name, type: "score", term: 3 });
      });
      list.push({ id: "t3_total", label: "Total", type: "total", term: 3 });
    } else {
      // All Terms / Overall View
      if (term1Enabled) {
        effectiveT1Cols.forEach((col) => {
          list.push({
            id: col.id,
            label: `${col.name} (T1)`,
            type: "score",
            term: 1,
          });
        });
        list.push({
          id: "t1_total",
          label: "T1 Total",
          type: "total",
          term: 1,
        });
      }
      if (term2Enabled) {
        effectiveT2Cols.forEach((col) => {
          list.push({
            id: col.id,
            label: `${col.name} (T2)`,
            type: "score",
            term: 2,
          });
        });
        list.push({
          id: "t2_total",
          label: "T2 Total",
          type: "total",
          term: 2,
        });
      }
      if (term3Enabled) {
        effectiveT3Cols.forEach((col) => {
          list.push({
            id: col.id,
            label: `${col.name} (T3)`,
            type: "score",
            term: 3,
          });
        });
        list.push({
          id: "t3_total",
          label: "T3 Total",
          type: "total",
          term: 3,
        });
      }
      list.push({
        id: "overall_total",
        label: "Comb. Total",
        type: "overall_total",
      });
    }
    return list;
  }, [
    marksView,
    effectiveT1Cols,
    effectiveT2Cols,
    effectiveT3Cols,
    term1Enabled,
    term2Enabled,
    term3Enabled,
  ]);

  // Dynamic sub-columns for each co-scholastic subject
  const coScholasticSubColumns = useMemo(() => {
    const list: { id: string; label: string; term?: 1 | 2 | 3; type: "grade" }[] =
      [];
    if (marksView === "term1") {
      list.push({
        id: "t1_grade",
        label: classStructure.resolvedBranding.term1Label || "Term I",
        term: 1,
        type: "grade",
      });
    } else if (marksView === "term2") {
      list.push({
        id: "t2_grade",
        label: classStructure.resolvedBranding.term2Label || "Term II",
        term: 2,
        type: "grade",
      });
    } else if (marksView === "term3") {
      list.push({
        id: "t3_grade",
        label: classStructure.resolvedBranding.term3Label || "Term III",
        term: 3,
        type: "grade",
      });
    } else {
      if (term1Enabled) {
        list.push({
          id: "t1_grade",
          label: `${classStructure.resolvedBranding.term1Label || "Term I"} Grade`,
          term: 1,
          type: "grade",
        });
      }
      if (term2Enabled) {
        list.push({
          id: "t2_grade",
          label: `${classStructure.resolvedBranding.term2Label || "Term II"} Grade`,
          term: 2,
          type: "grade",
        });
      }
      if (term3Enabled) {
        list.push({
          id: "t3_grade",
          label: `${classStructure.resolvedBranding.term3Label || "Term III"} Grade`,
          term: 3,
          type: "grade",
        });
      }
    }
    return list;
  }, [marksView, term1Enabled, term2Enabled, term3Enabled, classStructure.resolvedBranding]);

  // Combined end columns representing student final performance metrics
  const finalSummaryColumns = useMemo(() => {
    const cols: {
      id: string;
      label: string;
      type:
        | "t1_total"
        | "t1_pct"
        | "t1_grade"
        | "t2_total"
        | "t2_pct"
        | "t2_grade"
        | "t3_total"
        | "t3_pct"
        | "t3_grade"
        | "comb_total"
        | "comb_pct"
        | "comb_grade"
        | "rank";
    }[] = [];
    if (marksView === "term1") {
      if (classStructure.resolvedPureGradeBased) {
        cols.push({ id: "t1_grade", label: "T1 Grade", type: "t1_grade" });
      } else {
        cols.push({ id: "t1_total", label: "T1 Total", type: "t1_total" });
        cols.push({ id: "t1_pct", label: "T1 %", type: "t1_pct" });
        cols.push({ id: "t1_grade", label: "T1 Grade", type: "t1_grade" });
      }
      cols.push({ id: "rank", label: "Rank", type: "rank" });
    } else if (marksView === "term2") {
      if (classStructure.resolvedPureGradeBased) {
        cols.push({ id: "t2_grade", label: "T2 Grade", type: "t2_grade" });
      } else {
        cols.push({ id: "t2_total", label: "T2 Total", type: "t2_total" });
        cols.push({ id: "t2_pct", label: "T2 %", type: "t2_pct" });
        cols.push({ id: "t2_grade", label: "T2 Grade", type: "t2_grade" });
      }
      cols.push({ id: "rank", label: "Rank", type: "rank" });
    } else if (marksView === "term3") {
      if (classStructure.resolvedPureGradeBased) {
        cols.push({ id: "t3_grade", label: "T3 Grade", type: "t3_grade" });
      } else {
        cols.push({ id: "t3_total", label: "T3 Total", type: "t3_total" });
        cols.push({ id: "t3_pct", label: "T3 %", type: "t3_pct" });
        cols.push({ id: "t3_grade", label: "T3 Grade", type: "t3_grade" });
      }
      cols.push({ id: "rank", label: "Rank", type: "rank" });
    } else {
      if (classStructure.resolvedPureGradeBased) {
        if (term1Enabled) {
          cols.push({ id: "t1_grade", label: "T1 Grade", type: "t1_grade" });
        }
        if (term2Enabled) {
          cols.push({ id: "t2_grade", label: "T2 Grade", type: "t2_grade" });
        }
        if (term3Enabled) {
          cols.push({ id: "t3_grade", label: "T3 Grade", type: "t3_grade" });
        }
        cols.push({ id: "comb_grade", label: "Overall Grade", type: "comb_grade" });
      } else {
        if (term1Enabled) {
          cols.push({ id: "t1_total", label: "Term 1 Total", type: "t1_total" });
          cols.push({ id: "t1_pct", label: "Term 1 %", type: "t1_pct" });
          cols.push({ id: "t1_grade", label: "Term 1 Grade", type: "t1_grade" });
        }
        if (term2Enabled) {
          cols.push({ id: "t2_total", label: "Term 2 Total", type: "t2_total" });
          cols.push({ id: "t2_pct", label: "Term 2 %", type: "t2_pct" });
          cols.push({ id: "t2_grade", label: "Term 2 Grade", type: "t2_grade" });
        }
        if (term3Enabled) {
          cols.push({ id: "t3_total", label: "Term 3 Total", type: "t3_total" });
          cols.push({ id: "t3_pct", label: "Term 3 %", type: "t3_pct" });
          cols.push({ id: "t3_grade", label: "Term 3 Grade", type: "t3_grade" });
        }
        cols.push({ id: "comb_total", label: "Comb. Total", type: "comb_total" });
        cols.push({ id: "comb_pct", label: "Comb. %", type: "comb_pct" });
        cols.push({ id: "comb_grade", label: "Comb. Grade", type: "comb_grade" });
      }
      cols.push({ id: "rank", label: "Rank", type: "rank" });
    }
    return cols;
  }, [marksView, term1Enabled, term2Enabled, term3Enabled, classStructure.resolvedPureGradeBased]);

  // Handle immediate window-level printing with temporary pagination disablement so all student rows render perfectly for print output!
  const handlePrint = () => {
    const prevPageSize = registerPageSize;
    setRegisterPageSize(9999);
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        setRegisterPageSize(prevPageSize);
      }, 1000);
    }, 250);
  };

  const exportTabulationToCsv = () => {
    const classNameForExport = selectedClass || "All_Classes";
    const sectionNameForExport = selectedSection || "all";

    const headers = [
      "Roll No",
      "Admission No",
      "Student Name",
      "Class",
      "Section"
    ];

    // Get active scholastic subjects
    const activeSubjects = classStructure.resolvedSubjects.filter(sub => sub.type === 'scholastic');

    // Build header columns
    activeSubjects.forEach(sub => {
      if (term1Enabled) {
        effectiveT1Cols.forEach(col => {
          headers.push(`${sub.name} - T1 ${col.name}`);
        });
        headers.push(`${sub.name} - T1 Total`);
      }
      if (term2Enabled) {
        effectiveT2Cols.forEach(col => {
          headers.push(`${sub.name} - T2 ${col.name}`);
        });
        headers.push(`${sub.name} - T2 Total`);
      }
      if (term3Enabled) {
        effectiveT3Cols.forEach(col => {
          headers.push(`${sub.name} - T3 ${col.name}`);
        });
        headers.push(`${sub.name} - T3 Total`);
      }
    });

    if (term1Enabled) {
      headers.push("Term 1 Total", "Term 1 %", "Term 1 Grade");
    }
    if (term2Enabled) {
      headers.push("Term 2 Total", "Term 2 %", "Term 2 Grade");
    }
    if (term3Enabled) {
      headers.push("Term 3 Total", "Term 3 %", "Term 3 Grade");
    }
    headers.push("Combined Total", "Combined %", "Combined Grade", "Rank");

    const csvRows = [headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",")];

    visibleProcessedStudents.forEach(row => {
      const lineCols: any[] = [
        row.student.rollNo || "",
        row.student.admissionNo || "",
        row.student.name || "",
        row.student.className || "",
        row.student.section || ""
      ];

      activeSubjects.forEach(sub => {
        // Resolve student grades from studentGrades list
        const gradeVal = studentGrades.find(g => g.studentId === row.student.id);
        const scholasticData = gradeVal?.scholastic || {};
        const subScores = scholasticData[sub.id] || { term1: {}, term2: {}, term3: {} };

        if (term1Enabled) {
          let t1SubTotal = 0;
          effectiveT1Cols.forEach(col => {
            const val = subScores.term1?.[col.id] ?? "";
            lineCols.push(val);
            const scoreVal = parseFloat(String(val || "0"));
            if (!isNaN(scoreVal)) t1SubTotal += scoreVal;
          });
          lineCols.push(t1SubTotal || "0");
        }

        if (term2Enabled) {
          let t2SubTotal = 0;
          effectiveT2Cols.forEach(col => {
            const val = subScores.term2?.[col.id] ?? "";
            lineCols.push(val);
            const scoreVal = parseFloat(String(val || "0"));
            if (!isNaN(scoreVal)) t2SubTotal += scoreVal;
          });
          lineCols.push(t2SubTotal || "0");
        }

        if (term3Enabled) {
          let t3SubTotal = 0;
          effectiveT3Cols.forEach(col => {
            const val = subScores.term3?.[col.id] ?? "";
            lineCols.push(val);
            const scoreVal = parseFloat(String(val || "0"));
            if (!isNaN(scoreVal)) t3SubTotal += scoreVal;
          });
          lineCols.push(t3SubTotal || "0");
        }
      });

      if (term1Enabled) {
        lineCols.push(row.t1Total, row.t1Pct, row.t1Grade);
      }
      if (term2Enabled) {
        lineCols.push(row.t2Total, row.t2Pct, row.t2Grade);
      }
      if (term3Enabled) {
        lineCols.push(row.t3Total, row.t3Pct, row.t3Grade);
      }
      lineCols.push(row.totalMarks, row.percentage, row.overallGrade, row.rank);

      csvRows.push(lineCols.map(val => {
        const sVal = String(val ?? "");
        if (sVal.includes(",") || sVal.includes("\"") || sVal.includes("\n")) {
          return `"${sVal.replace(/"/g, '""')}"`;
        }
        return sVal;
      }).join(","));
    });

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows.join("\n"));
    const downloadLink = document.createElement("a");
    downloadLink.setAttribute("href", csvContent);
    downloadLink.setAttribute("download", `tabulation_sheet_${classNameForExport.replace(/\s+/g, '_')}_Section_${sectionNameForExport}.csv`);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
  };

  const activeMarksTypeLabel = () => {
    if (marksView === "term1")
      return `${classStructure.resolvedBranding.term1Label || "Term I"} (${classStructure.resolvedBranding.term1ExamLabel || "Half Yearly"})`;
    if (marksView === "term2")
      return `${classStructure.resolvedBranding.term2Label || "Term II"} (${classStructure.resolvedBranding.term2ExamLabel || "Annual"})`;
    if (marksView === "term3")
      return `${classStructure.resolvedBranding.term3Label || "Term III"} (${classStructure.resolvedBranding.term3ExamLabel || "Final"})`;
    return "Consolidated Annual / Overall";
  };

  const getSubMaxColLabel = () => {
    if (marksView === "term1" || marksView === "term2" || marksView === "term3") return "Max: 100";
    let activeTermsCount = 0;
    if (term1Enabled) activeTermsCount++;
    if (term2Enabled) activeTermsCount++;
    if (term3Enabled) activeTermsCount++;
    return `Max: ${activeTermsCount * 100}`;
  };

  return (
    <div className="space-y-6 pt-1 font-sans">
      {/* Styles Injection for Perfect Document Printing with Dynamic Orientation */}
      <style>{`
        @media print {
          /* Force physical A4 size layout with dynamic orientation */
          @page {
            size: A4 ${printOrientation};
            margin: 6mm 6mm !important;
          }
          body {
            background-color: #ffffff;
            color: #000000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
          .print-full-viewport {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
          /* Prevent layout splitting inside records */
          .print-page-break-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          /* Stylized crisp table borders with ultra-compact cell density for 25+ rows in one page */
          table {
            border-collapse: collapse !important;
            width: 100% !important;
            font-size: 8.5px !important;
            line-height: 1.1 !important;
          }
          th, td {
            border: 1px solid #111111 !important;
            padding: 2.5px 4px !important;
            color: #000000 !important;
            height: auto !important;
          }
          td p, td div, th div {
            margin: 0 !important;
            padding: 0 !important;
          }
          th {
            background-color: #f3f4f6 !important;
            font-weight: bold !important;
            font-size: 8.5px !important;
          }
          .print-header-brand {
            display: block !important;
            text-align: center !important;
            margin-bottom: 6px !important;
            border-bottom: 1.5px double #111111;
            padding-bottom: 4px;
          }
          .print-header-brand h1 {
            font-size: 14px !important;
            margin: 0 !important;
          }
          .print-header-brand p {
            font-size: 8.5px !important;
            margin: 1px 0 0 0 !important;
          }
          /* Compact signatures area to prevent line trailing overflows */
          .mt-12 {
            margin-top: 14px !important;
          }
          .pt-6 {
            padding-top: 3px !important;
          }
          .mt-6 {
            margin-top: 3px !important;
          }
          .h-10 {
            height: 18px !important;
          }
        }
      `}</style>

      {/* Control Panel: Filters & Exporter Controls */}
      <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-xs space-y-4 no-print animate-fadeIn">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-gray-100 pb-3">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-gray-100 pb-3 w-full">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2 mr-2">
                <Trophy className="w-4 h-4 text-amber-500 animate-pulse" />
                Classwise Master Tabulation Grid & Ranks List
              </h3>
              <p className="text-[11px] text-gray-400">
                Review cumulative registers, verify scores without student photos,
                generate official tabulation sheets, or publish student marks ranks.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 self-stretch md:self-auto ml-auto">
              {/* Blank Fill Settings */}
              <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 text-xs shadow-3xs">
                <label className="flex items-center gap-1.5 px-2.5 py-1.5 font-bold text-slate-700 select-none cursor-pointer hover:text-slate-900 transition-colors">
                  <input
                    type="checkbox"
                    checked={isBlankPrintMode}
                    onChange={(e) => handleToggleBlankMode(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-0 w-4 h-4 accent-indigo-600 cursor-pointer"
                  />
                  Blank List (No Marks)
                </label>

                {isBlankPrintMode && (
                  <>
                    <div className="h-5 w-px bg-slate-300"></div>
                    <select
                      value={blankSubjectMode}
                      onChange={(e) => setBlankSubjectMode(e.target.value as any)}
                      className="bg-transparent font-bold text-slate-700 outline-none pr-1.5 cursor-pointer py-1 text-xs hover:text-slate-900 transition-colors"
                      title="Subject configuration for blank list"
                    >
                      <option value="blank">Without Subject (Blank Line)</option>
                      <option value="selective">With Subject Name</option>
                    </select>

                    {blankSubjectMode === "selective" && (
                      <>
                        <div className="h-5 w-px bg-slate-300"></div>
                        <select
                          value={selectedBlankSubject}
                          onChange={(e) => setSelectedBlankSubject(e.target.value)}
                          className="bg-transparent font-bold text-indigo-700 outline-none pr-1.5 cursor-pointer py-1 text-xs hover:text-indigo-900 transition-colors"
                          title="Select subject for blank list"
                        >
                          <option value="">-- Choose Subject --</option>
                          {classStructure.resolvedSubjects.map((sub) => (
                            <option key={`blank_subject_sel_${sub.id}`} value={sub.id}>
                              {sub.name}
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </>
                )}

                <div className="h-5 w-px bg-slate-300"></div>

                <select
                  value={printOrientation}
                  onChange={(e) => setPrintOrientation(e.target.value as any)}
                  className="bg-transparent font-bold text-slate-700 outline-none pr-1.5 cursor-pointer py-1 text-xs hover:text-slate-900 transition-colors"
                  title="Page orientation for printing"
                >
                  <option value="landscape">Landscape Print</option>
                  <option value="portrait">Portrait Print</option>
                </select>

                <div className="h-5 w-px bg-slate-300"></div>

                <button
                  onClick={() => setIsDoubleCopyEnabled(!isDoubleCopyEnabled)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 font-bold rounded-lg transition-all text-xs cursor-pointer ${
                    isDoubleCopyEnabled
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-800 hover:bg-slate-200/50"
                  }`}
                  title="Print two identical lists on a single page"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy List (2-in-1)</span>
                </button>
              </div>

              <button
                onClick={exportTabulationToCsv}
                id="btn_export_tabulation"
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                title="Export this tabulation matrix to an Excel-compatible CSV file"
              >
                <Download className="w-3.5 h-3.5 text-emerald-200" />
                Export Tabulation (CSV)
              </button>

              <button
                onClick={handlePrint}
                id="btn_print_master_report"
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-3.5 h-3.5 text-indigo-200" />
                Print (A4 {printOrientation === "landscape" ? "Landscape" : "Portrait"})
              </button>
            </div>
          </div>
        </div>

        {/* Filters Matrix */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-gray-500 block">
              Select Target Class
              {currentRole === "class_teacher" && (
                <span className="text-[8.5px] lowercase font-normal italic ml-1 text-amber-600">
                  (locked to class)
                </span>
              )}
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              disabled={currentRole === "class_teacher"}
              className="w-full px-3 py-1.5 text-xs border border-gray-200 bg-white rounded-lg outline-none font-semibold text-gray-700 focus:ring-2 focus:ring-indigo-500/15 disabled:bg-slate-100 disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              {currentRole !== "class_teacher" && (
                <>
                  <option value="">-- Select Class --</option>
                  <option value="all">All Classes Combined</option>
                </>
              )}
              {uniqueClasses.map((cls) => (
                <option key={cls} value={cls}>
                  {cls} Standard
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-gray-500 block">
              Section Filter
              {currentRole === "class_teacher" &&
                activeTeacherObj?.assignedSection !== "All" && (
                  <span className="text-[8.5px] lowercase font-normal italic ml-1 text-amber-600">
                    (locked to section)
                  </span>
                )}
            </label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              disabled={
                currentRole === "class_teacher" &&
                activeTeacherObj?.assignedSection !== "All"
              }
              className="w-full px-3 py-1.5 text-xs border border-gray-200 bg-white rounded-lg outline-none font-semibold text-gray-700 focus:ring-2 focus:ring-indigo-500/15 disabled:bg-slate-100 disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              {currentRole === "class_teacher" &&
              activeTeacherObj?.assignedSection !== "All" ? (
                <option value={activeTeacherObj?.assignedSection}>
                  {activeTeacherObj?.assignedSection}
                </option>
              ) : (
                <>
                  <option value="all">All Sections (A/B/C)</option>
                  {uniqueSectionsForClass.map((sec) => (
                    <option key={sec} value={sec}>
                      Section {sec}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-gray-500 block">
              Marks Dimension
            </label>
            <select
              value={marksView}
              onChange={(e) => setMarksView(e.target.value as any)}
              className="w-full px-3 py-1.5 text-xs border border-gray-200 bg-white rounded-lg outline-none font-semibold text-gray-700 focus:ring-2 focus:ring-indigo-500/15"
            >
              <option value="overall">Consolidated overall marks (All Terms)</option>
              {term1Enabled && (
                <option value="term1">
                  {classStructure.resolvedBranding.term1Label || "Term I"} Only ({classStructure.resolvedBranding.term1ExamLabel || "Half Yearly"})
                </option>
              )}
              {term2Enabled && (
                <option value="term2">
                  {classStructure.resolvedBranding.term2Label || "Term II"} Only ({classStructure.resolvedBranding.term2ExamLabel || "Annual"})
                </option>
              )}
              {term3Enabled && (
                <option value="term3">
                  {classStructure.resolvedBranding.term3Label || "Term III"} Only ({classStructure.resolvedBranding.term3ExamLabel || "Final"})
                </option>
              )}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-gray-500 block">
              Tabulation Row Sorting
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full px-3 py-1.5 text-xs border border-gray-200 bg-white rounded-lg outline-none font-semibold text-gray-700 focus:ring-2 focus:ring-indigo-500/15"
            >
              <option value="roll">Sort by Student Roll Number</option>
              <option value="rank">Sort by Cumulative Rank List</option>
              <option value="name">Sort alphabetically by Name</option>
            </select>
          </div>
        </div>

        {/* Print Configuration Toggles button */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex gap-2">
            <button
              onClick={() =>
                setDesignerTab((prev) =>
                  prev === "columns" ? null : "columns",
                )
              }
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                designerTab === "columns"
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-extrabold shadow-sm"
                  : "bg-white border-gray-200 text-gray-600 hover:text-gray-800"
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              {designerTab === "columns"
                ? "Hide Printable Columns Config"
                : "Configure Columns to Print"}
              {hiddenSubjects.size +
                hiddenCoScholastics.size +
                hiddenScoreCols.size +
                hiddenSummaryCols.size >
                0 && (
                <span className="bg-indigo-200 text-indigo-800 font-bold px-1.5 py-0.5 rounded-full text-[9px] scale-90">
                  {hiddenSubjects.size +
                    hiddenCoScholastics.size +
                    hiddenScoreCols.size +
                    hiddenSummaryCols.size}{" "}
                  Hidden
                </span>
              )}
            </button>
          </div>

          {(hiddenSubjects.size > 0 ||
            hiddenCoScholastics.size > 0 ||
            hiddenScoreCols.size > 0 ||
            hiddenSummaryCols.size > 0) && (
            <button
              onClick={() => {
                setHiddenSubjects(new Set());
                setHiddenCoScholastics(new Set());
                setHiddenScoreCols(new Set());
                setHiddenSummaryCols(new Set());
              }}
              className="text-[11px] font-bold text-red-600 hover:text-red-700 hover:underline flex items-center gap-1 cursor-pointer"
            >
              ✕ Reset All Hidden Filters
            </button>
          )}
        </div>

        {/* Designer Customisation Panels */}
        {designerTab === "columns" && (
          <div className="p-4 bg-indigo-50/10 border border-indigo-100 rounded-xl space-y-4 animate-fadeIn">
            <h4 className="text-xs font-black uppercase text-indigo-950 flex items-center gap-1">
              🛠️ Printable Column Designer Settings
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Core & Exam Components Group */}
              <div className="bg-white p-3 rounded-lg border border-gray-150 space-y-2">
                <div className="flex items-center justify-between border-b pb-1">
                  <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    General & Exam Parts
                  </h5>
                  <div className="flex gap-1.5 text-[9px] font-bold">
                    <button
                      onClick={showAllGeneralExam}
                      className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                    >
                      Show All
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={hideAllGeneralExam}
                      className="text-red-600 hover:text-red-700 hover:underline cursor-pointer"
                    >
                      Hide All
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs text-slate-700">
                  <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded transition">
                    <input
                      type="checkbox"
                      checked={!hiddenSummaryCols.has("rollNo")}
                      onChange={() => toggleSummaryColVisibility("rollNo")}
                      className="rounded accent-indigo-600"
                    />
                    <span>Roll Number Column</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded transition">
                    <input
                      type="checkbox"
                      checked={!hiddenSummaryCols.has("classSec")}
                      onChange={() => toggleSummaryColVisibility("classSec")}
                      className="rounded accent-indigo-600"
                    />
                    <span>Class - Section Column</span>
                  </label>

                  {classStructure.resolvedScoreColumns.map((col) => (
                    <label
                      key={col.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded transition"
                    >
                      <input
                        type="checkbox"
                        checked={!hiddenScoreCols.has(col.id)}
                        onChange={() => toggleScoreColVisibility(col.id)}
                        className="rounded accent-indigo-600"
                      />
                      <span className="font-medium text-slate-900">
                        Exam Part: {col.name}{" "}
                        <span className="text-[10px] text-gray-400 font-normal">
                          ({col.maxMarks} M)
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Scholastic Subjects Column Toggles */}
              <div className="bg-white p-3 rounded-lg border border-gray-150 space-y-2">
                <div className="flex items-center justify-between border-b pb-1">
                  <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Scholastic Subjects
                  </h5>
                  <div className="flex gap-1.5 text-[9px] font-bold">
                    <button
                      onClick={showAllScholastic}
                      className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                    >
                      Show All
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={hideAllScholastic}
                      className="text-red-600 hover:text-red-700 hover:underline cursor-pointer"
                    >
                      Hide All
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs text-slate-700 max-h-56 overflow-y-auto scrollbar-thin">
                  {scholasticSubjects.length === 0 ? (
                    <p className="text-gray-400 italic text-[11px] p-2">
                      No scholastic subjects declared for this class structure.
                    </p>
                  ) : (
                    scholasticSubjects.map((sub) => (
                      <label
                        key={sub.id}
                        className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded transition"
                      >
                        <input
                          type="checkbox"
                          checked={!hiddenSubjects.has(sub.id)}
                          onChange={() => toggleSubjectVisibility(sub.id)}
                          className="rounded accent-indigo-600"
                        />
                        <span className="truncate" title={sub.name}>
                          {sub.name}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Aggregates Summary Column Toggles */}
              <div className="bg-white p-3 rounded-lg border border-gray-150 space-y-2">
                <div className="flex items-center justify-between border-b pb-1">
                  <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Term Aggregates & Rank
                  </h5>
                  <div className="flex gap-1.5 text-[9px] font-bold">
                    <button
                      onClick={showAllAggregates}
                      className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                    >
                      Show All
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={hideAllAggregates}
                      className="text-red-600 hover:text-red-700 hover:underline cursor-pointer"
                    >
                      Hide All
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5 text-xs text-slate-700 font-medium">
                  {/* Term 1 Summaries Toggle */}
                  {(marksView === "term1" || marksView === "overall") && (
                    <div className="border-b border-gray-100 pb-2 space-y-1">
                      <p className="text-[9px] font-bold text-indigo-700 uppercase">
                        Term 1 Summaries
                      </p>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-0.5 rounded transition">
                        <input
                          type="checkbox"
                          checked={!hiddenSummaryCols.has("t1Total")}
                          onChange={() => toggleSummaryColVisibility("t1Total")}
                          className="rounded accent-indigo-600"
                        />
                        <span>T1 Total Obtained</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-0.5 rounded transition">
                        <input
                          type="checkbox"
                          checked={!hiddenSummaryCols.has("t1Pct")}
                          onChange={() => toggleSummaryColVisibility("t1Pct")}
                          className="rounded accent-indigo-600"
                        />
                        <span>T1 Percentage %</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-0.5 rounded transition">
                        <input
                          type="checkbox"
                          checked={!hiddenSummaryCols.has("t1Grade")}
                          onChange={() => toggleSummaryColVisibility("t1Grade")}
                          className="rounded accent-indigo-600"
                        />
                        <span>T1 Cumulative Grade</span>
                      </label>
                    </div>
                  )}

                  {/* Term 2 Summaries Toggle */}
                  {(marksView === "term2" || marksView === "overall") && (
                    <div className="border-b border-gray-100 pb-2 space-y-1">
                      <p className="text-[9px] font-bold text-teal-700 uppercase">
                        Term 2 Summaries
                      </p>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-0.5 rounded transition">
                        <input
                          type="checkbox"
                          checked={!hiddenSummaryCols.has("t2Total")}
                          onChange={() => toggleSummaryColVisibility("t2Total")}
                          className="rounded accent-indigo-600"
                        />
                        <span>T2 Total Obtained</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-0.5 rounded transition">
                        <input
                          type="checkbox"
                          checked={!hiddenSummaryCols.has("t2Pct")}
                          onChange={() => toggleSummaryColVisibility("t2Pct")}
                          className="rounded accent-indigo-600"
                        />
                        <span>T2 Percentage %</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-0.5 rounded transition">
                        <input
                          type="checkbox"
                          checked={!hiddenSummaryCols.has("t2Grade")}
                          onChange={() => toggleSummaryColVisibility("t2Grade")}
                          className="rounded accent-indigo-600"
                        />
                        <span>T2 Cumulative Grade</span>
                      </label>
                    </div>
                  )}

                  {/* Combined Summaries Toggle */}
                  {marksView === "overall" && (
                    <div className="pb-1 space-y-1">
                      <p className="text-[9px] font-bold text-amber-700 uppercase">
                        Overall Combined Summaries
                      </p>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-0.5 rounded transition">
                        <input
                          type="checkbox"
                          checked={!hiddenSummaryCols.has("combTotal")}
                          onChange={() =>
                            toggleSummaryColVisibility("combTotal")
                          }
                          className="rounded accent-indigo-600"
                        />
                        <span>Combined Overall Total</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-0.5 rounded transition">
                        <input
                          type="checkbox"
                          checked={!hiddenSummaryCols.has("combPct")}
                          onChange={() => toggleSummaryColVisibility("combPct")}
                          className="rounded accent-indigo-600"
                        />
                        <span>Combined Percentage %</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-0.5 rounded transition">
                        <input
                          type="checkbox"
                          checked={!hiddenSummaryCols.has("combGrade")}
                          onChange={() =>
                            toggleSummaryColVisibility("combGrade")
                          }
                          className="rounded accent-indigo-600"
                        />
                        <span>Combined Cumulative Grade</span>
                      </label>
                    </div>
                  )}

                  {/* Rank Toggle */}
                  <label className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded border-t border-gray-100 pt-2 transition">
                    <input
                      type="checkbox"
                      checked={!hiddenSummaryCols.has("rank")}
                      onChange={() => toggleSummaryColVisibility("rank")}
                      className="rounded accent-indigo-600"
                    />
                    <span className="font-bold text-slate-900">
                      Merit Rank Column
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Co-Scholastic Toggles Group */}
            {activeCoScholasticSubjects.length > 0 && (
              <div className="bg-white p-3 rounded-lg border border-gray-150 space-y-2">
                <div className="flex items-center justify-between border-b pb-1">
                  <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Co-Scholastic & Co-Curricular Traits
                  </h5>
                  <div className="flex gap-1.5 text-[9px] font-bold">
                    <button
                      onClick={showAllCoScholastic}
                      className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                    >
                      Show All
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={hideAllCoScholastic}
                      className="text-red-600 hover:text-red-700 hover:underline cursor-pointer"
                    >
                      Hide All
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-xs text-slate-700 max-h-40 overflow-y-auto scrollbar-thin">
                  {activeCoScholasticSubjects.map((sub) => (
                    <label
                      key={sub.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-slate-5 p-1 rounded transition border border-transparent hover:border-gray-100"
                    >
                      <input
                        type="checkbox"
                        checked={!hiddenCoScholastics.has(sub.id)}
                        onChange={() => toggleCoScholasticVisibility(sub.id)}
                        className="rounded accent-indigo-600"
                      />
                      <span className="truncate" title={sub.name}>
                        {sub.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* View Segment Button Selectors */}
        <div className="flex gap-1.5 border-b border-gray-150 pt-1">
          <button
            onClick={() => setReportTab("tabulation")}
            className={`flex items-center gap-1.5 py-2 px-3 text-xs font-bold border-b-2 transition-all ${
              reportTab === "tabulation"
                ? "border-indigo-600 text-indigo-600 font-extrabold bg-indigo-50/10"
                : "border-transparent text-gray-500 hover:text-slate-800"
            }`}
          >
            <Table className="w-3.5 h-3.5" /> Classwise Tabulation Sheet
          </button>
          <button
            onClick={() => setReportTab("ranks")}
            className={`flex items-center gap-1.5 py-2 px-3 text-xs font-bold border-b-2 transition-all ${
              reportTab === "ranks"
                ? "border-indigo-600 text-indigo-600 font-extrabold bg-indigo-50/10"
                : "border-transparent text-gray-500 hover:text-slate-800"
            }`}
          >
            <Trophy className="w-3.5 h-3.5" /> Consolidated Merit & Ranks List
          </button>
        </div>
      </div>

      {/* RENDER MASTER REPORT CARD (PRINT IN LANDSCAPE) */}
      {selectedClass === "" ? (
        <div className="bg-white border border-gray-150 rounded-2xl p-12 text-center space-y-3 shadow-3xs animate-fadeIn no-print mt-4">
          <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-2">
            <LayoutList className="w-8 h-8 animate-pulse" />
          </div>
          <h4 className="text-base font-bold text-slate-900">No Target Class Selected</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto font-sans">
            Please click on "Select Target Class" dropdown above and choose a standard class to dynamically fetch student records, map structural report card columns, and load the tabulation sheet matrix.
          </p>
        </div>
      ) : (
        <div
          id="master_report_print_ref"
          className="bg-white border border-gray-150 rounded-2xl p-4 sm:p-6 shadow-xs relative print-full-viewport print:rounded-none"
        >
        {/* Dynamic Branded Header Visible ONLY in Print Output */}
        {!isBlankPrintMode && (
          <div className="hidden print-header-brand">
            <h1 className="text-lg font-black tracking-tight uppercase">
              {branding.schoolName || "School Registry Node"}
            </h1>
            <p className="text-[10px] text-gray-700 font-medium">
              {branding.address} &bull; {branding.helpline}
            </p>
            <div className="mt-3.5 border-t border-gray-900 pt-2 flex justify-between text-[11px] font-bold">
              <span>OFFICIAL REPORT: CLASSWISE TABULATION MATRIX</span>
              <span className="uppercase">
                {branding.session || "Session 2026"}
              </span>
            </div>
          </div>
        )}

        {/* Dynamic metadata tag bar */}
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-100 no-print">
          <div>
            <h4 className="text-gray-900 font-bold text-sm">
              {reportTab === "tabulation"
                ? "Class Tabulation Sheet Registry"
                : "Consolidated Student Ranks Leaderboard"}
            </h4>
            <p className="text-[11px] text-gray-400">
              Class:{" "}
              <span className="font-bold text-indigo-600">
                {selectedClass === "all"
                  ? "All Classes Combined"
                  : selectedClass}
              </span>
              {selectedSection !== "all" && (
                <>
                  {" "}
                  &bull; Section:{" "}
                  <span className="font-bold text-indigo-600">
                    {selectedSection}
                  </span>
                </>
              )}
              &bull; Scores View:{" "}
              <span className="font-bold text-indigo-600">
                {activeMarksTypeLabel()}
              </span>
            </p>
          </div>
          <div className="text-[10px] font-semibold text-slate-500 bg-slate-100 rounded px-2 py-1 select-none self-start sm:self-auto uppercase tracking-wide font-mono">
            {processedStudentsData.length} Records Loaded
          </div>
        </div>

        {/* TABULATION SHEET VIEW */}
        {reportTab === "tabulation" && (
          <>
            <div className={`w-full ${isDoubleCopyEnabled ? "flex flex-col lg:flex-row gap-4 print:flex print:flex-row print:justify-between items-stretch relative" : "flex flex-col gap-8"}`}>
            {Array.from({ length: isDoubleCopyEnabled ? 2 : 1 }).map((_, copyIndex) => (
              <React.Fragment key={copyIndex}>
                {copyIndex > 0 && (
                  <>
                    <div className="border-l-2 border-dashed border-gray-400 mx-2 px-1 text-center text-xs font-mono text-gray-500 relative select-none no-print self-stretch flex items-center justify-center">
                      <span className="bg-white py-3 [writing-mode:vertical-lr] rotate-180 flex items-center gap-1 leading-none select-none">
                        ✂️ SCISSORS CUT HERE (DUPLICATE COPY) ✂️
                      </span>
                    </div>
                    <div className="hidden print:flex border-l-2 border-dashed border-black/60 mx-2 px-1 text-center text-[10px] font-mono text-black select-none self-stretch items-center justify-center">
                      <span className="[writing-mode:vertical-lr] rotate-180 flex items-center gap-1 leading-none py-4">
                        ✂ - - - SCISSORS CUT HERE (DUPLICATE COPY) - - - ✂
                      </span>
                    </div>
                  </>
                )}

                <div className={`${isDoubleCopyEnabled ? "w-full lg:w-[48%] print:w-[48%] overflow-x-auto print:overflow-visible flex-1 flex flex-col justify-between animate-fadeIn" : "w-full overflow-x-auto print:overflow-visible"}`}>
                  {isBlankPrintMode && (
                    <div className="mb-4 text-center font-sans space-y-1 pb-2 border-b border-gray-200">
                      <h2 className="text-xs font-bold text-slate-900 uppercase tracking-tight">
                        {classStructure.resolvedBranding.schoolName || branding.schoolName}
                      </h2>
                      <p className="text-[10px] text-slate-600 font-semibold uppercase font-mono tracking-wider">
                        {activeMarksTypeLabel()} &bull; Class {selectedClass} {selectedSection !== "all" ? `- ${selectedSection}` : ""}
                      </p>
                    </div>
                  )}

                  <table
                    className="w-full border border-gray-200 border-collapse text-left text-xs min-w-max print:min-w-0"
                    id={copyIndex === 0 ? "tabulation_register" : `tabulation_register_copy_${copyIndex}`}
                  >
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold border-b border-gray-300 text-[10px] print:bg-gray-100 divide-x divide-gray-200">
                  {!hiddenSummaryCols.has("rollNo") && (
                    <th
                      rowSpan={2}
                      className="p-2 text-center font-mono font-black border-b border-gray-300 w-14"
                    >
                      Roll No
                    </th>
                  )}
                  <th
                    rowSpan={2}
                    className="p-2 min-w-[145px] border-b border-gray-300"
                  >
                    Student Name
                  </th>
                  {!hiddenSummaryCols.has("classSec") && (
                    <th
                      rowSpan={2}
                      className="p-2 text-center text-gray-500 font-bold bg-slate-50 border-b border-gray-300 w-20"
                    >
                      Class-Sec
                    </th>
                  )}

                  {/* Term 1 Header Component Group */}
                  {(marksView === "term1" || marksView === "overall") &&
                    (marksView === "term1" || term1Enabled) && (
                      <>
                        {/* Term 1 Scholastic Subjects */}
                        {visibleScholasticSubjects.map((sub) => (
                          <th
                            key={`t1_sub_${sub.id}`}
                            colSpan={t1SubColDetails.length}
                            className="p-2 text-center bg-indigo-50/40 text-indigo-950 font-black uppercase text-[9.5px] border-b border-indigo-200"
                          >
                            <div
                              className="truncate max-w-[170px] mx-auto text-center font-bold"
                              title={sub.name}
                            >
                              T1: {sub.name}
                            </div>
                          </th>
                        ))}

                        {/* Term 1 Co-Scholastic Traits */}
                        {visibleCoScholasticSubjects.map((sub) => (
                          <th
                            key={`t1_co_${sub.id}`}
                            rowSpan={2}
                            className="p-1 px-1.5 text-center bg-teal-50/40 text-teal-950 font-semibold uppercase text-[8px] border-b border-teal-200 min-w-[55px] max-w-[75px]"
                          >
                            <div className="flex items-center justify-center h-28 mx-auto text-center select-none">
                              <span className="whitespace-normal break-words leading-tight font-extrabold text-center uppercase tracking-tighter max-w-[65px] block">
                                T1: {sub.name}
                              </span>
                            </div>
                          </th>
                        ))}

                        {/* Term 1 Totals, Percentage, Grade */}
                        {!isBlankPrintMode && !hiddenSummaryCols.has("t1Total") && !classStructure.resolvedPureGradeBased && (
                          <th
                            rowSpan={2}
                            className="p-2 text-center text-[10px] bg-emerald-50/50 text-emerald-950 border-b border-gray-300 font-extrabold"
                          >
                            <div className="flex items-center justify-center h-28 mx-auto text-center select-none">
                              <span className="[writing-mode:vertical-lr] rotate-180 whitespace-nowrap tracking-wider uppercase text-center font-black">
                                T1 Total (Sch.)
                              </span>
                            </div>
                          </th>
                        )}
                        {!isBlankPrintMode && !hiddenSummaryCols.has("t1Pct") && !classStructure.resolvedPureGradeBased && (
                          <th
                            rowSpan={2}
                            className="p-2 text-center text-[10px] bg-blue-50/50 text-blue-950 border-b border-gray-300 font-extrabold"
                          >
                            <div className="flex items-center justify-center h-28 mx-auto text-center select-none">
                              <span className="[writing-mode:vertical-lr] rotate-180 whitespace-nowrap tracking-wider uppercase text-center font-black">
                                T1 % Percentage
                              </span>
                            </div>
                          </th>
                        )}
                        {!isBlankPrintMode && !hiddenSummaryCols.has("t1Grade") && (
                          <th
                            rowSpan={2}
                            className="p-2 text-center text-[10px] bg-purple-50/50 text-purple-950 border-b border-gray-300 font-extrabold"
                          >
                            <div className="flex items-center justify-center h-28 mx-auto text-center select-none">
                              <span className="[writing-mode:vertical-lr] rotate-180 whitespace-nowrap tracking-wider uppercase text-center font-black">
                                T1 Grade
                              </span>
                            </div>
                          </th>
                        )}
                      </>
                    )}

                  {/* Term 2 Header Component Group */}
                  {(marksView === "term2" || marksView === "overall") &&
                    (marksView === "term2" || term2Enabled) && (
                      <>
                        {/* Term 2 Scholastic Subjects */}
                        {visibleScholasticSubjects.map((sub) => (
                          <th
                            key={`t2_sub_${sub.id}`}
                            colSpan={t2SubColDetails.length}
                            className="p-2 text-center bg-indigo-50/40 text-indigo-950 font-black uppercase text-[9.5px] border-b border-indigo-200"
                          >
                            <div
                              className="truncate max-w-[170px] mx-auto text-center font-bold"
                              title={sub.name}
                            >
                              T2: {sub.name}
                            </div>
                          </th>
                        ))}

                        {/* Term 2 Co-Scholastic Traits */}
                        {visibleCoScholasticSubjects.map((sub) => (
                          <th
                            key={`t2_co_${sub.id}`}
                            rowSpan={2}
                            className="p-1 px-1.5 text-center bg-teal-50/40 text-teal-950 font-semibold uppercase text-[8px] border-b border-teal-200 min-w-[55px] max-w-[75px]"
                          >
                            <div className="flex items-center justify-center h-28 mx-auto text-center select-none">
                              <span className="whitespace-normal break-words leading-tight font-extrabold text-center uppercase tracking-tighter max-w-[65px] block">
                                T2: {sub.name}
                              </span>
                            </div>
                          </th>
                        ))}

                        {/* Term 2 Totals, Percentage, Grade */}
                        {!isBlankPrintMode && !hiddenSummaryCols.has("t2Total") && !classStructure.resolvedPureGradeBased && (
                          <th
                            rowSpan={2}
                            className="p-2 text-center text-[10px] bg-emerald-50/50 text-emerald-950 border-b border-gray-300 font-extrabold"
                          >
                            <div className="flex items-center justify-center h-28 mx-auto text-center select-none">
                              <span className="[writing-mode:vertical-lr] rotate-180 whitespace-nowrap tracking-wider uppercase text-center font-black">
                                T2 Total (Sch.)
                              </span>
                            </div>
                          </th>
                        )}
                        {!isBlankPrintMode && !hiddenSummaryCols.has("t2Pct") && !classStructure.resolvedPureGradeBased && (
                          <th
                            rowSpan={2}
                            className="p-2 text-center text-[10px] bg-blue-50/50 text-blue-950 border-b border-gray-300 font-extrabold"
                          >
                            <div className="flex items-center justify-center h-28 mx-auto text-center select-none">
                              <span className="[writing-mode:vertical-lr] rotate-180 whitespace-nowrap tracking-wider uppercase text-center font-black">
                                T2 % Percentage
                              </span>
                            </div>
                          </th>
                        )}
                        {!isBlankPrintMode && !hiddenSummaryCols.has("t2Grade") && (
                          <th
                            rowSpan={2}
                            className="p-2 text-center text-[10px] bg-purple-50/50 text-purple-950 border-b border-gray-300 font-extrabold"
                          >
                            <div className="flex items-center justify-center h-28 mx-auto text-center select-none">
                              <span className="[writing-mode:vertical-lr] rotate-180 whitespace-nowrap tracking-wider uppercase text-center font-black">
                                T2 Grade
                              </span>
                            </div>
                          </th>
                        )}
                      </>
                    )}

                  {/* Term 3 Header Component Group */}
                  {(marksView === "term3" || marksView === "overall") &&
                    (marksView === "term3" || term3Enabled) && (
                      <>
                        {/* Term 3 Scholastic Subjects */}
                        {visibleScholasticSubjects.map((sub) => (
                          <th
                            key={`t3_sub_${sub.id}`}
                            colSpan={t3SubColDetails.length}
                            className="p-2 text-center bg-indigo-50/40 text-indigo-950 font-black uppercase text-[9.5px] border-b border-indigo-200"
                          >
                            <div
                              className="truncate max-w-[170px] mx-auto text-center font-bold"
                              title={sub.name}
                            >
                              T3: {sub.name}
                            </div>
                          </th>
                        ))}

                        {/* Term 3 Co-Scholastic Traits */}
                        {visibleCoScholasticSubjects.map((sub) => (
                          <th
                            key={`t3_co_${sub.id}`}
                            rowSpan={2}
                            className="p-1 px-1.5 text-center bg-teal-50/40 text-teal-950 font-semibold uppercase text-[8px] border-b border-teal-200 min-w-[55px] max-w-[75px]"
                          >
                            <div className="flex items-center justify-center h-28 mx-auto text-center select-none">
                              <span className="whitespace-normal break-words leading-tight font-extrabold text-center uppercase tracking-tighter max-w-[65px] block">
                                T3: {sub.name}
                              </span>
                            </div>
                          </th>
                        ))}

                        {/* Term 3 Totals, Percentage, Grade */}
                        {!isBlankPrintMode && !hiddenSummaryCols.has("t3Total") && !classStructure.resolvedPureGradeBased && (
                          <th
                            rowSpan={2}
                            className="p-2 text-center text-[10px] bg-emerald-50/50 text-emerald-950 border-b border-gray-300 font-extrabold"
                          >
                            <div className="flex items-center justify-center h-28 mx-auto text-center select-none">
                              <span className="[writing-mode:vertical-lr] rotate-180 whitespace-nowrap tracking-wider uppercase text-center font-black">
                                T3 Total (Sch.)
                              </span>
                            </div>
                          </th>
                        )}
                        {!isBlankPrintMode && !hiddenSummaryCols.has("t3Pct") && !classStructure.resolvedPureGradeBased && (
                          <th
                            rowSpan={2}
                            className="p-2 text-center text-[10px] bg-blue-50/50 text-blue-950 border-b border-gray-300 font-extrabold"
                          >
                            <div className="flex items-center justify-center h-28 mx-auto text-center select-none">
                              <span className="[writing-mode:vertical-lr] rotate-180 whitespace-nowrap tracking-wider uppercase text-center font-black">
                                T3 % Percentage
                              </span>
                            </div>
                          </th>
                        )}
                        {!isBlankPrintMode && !hiddenSummaryCols.has("t3Grade") && (
                          <th
                            rowSpan={2}
                            className="p-2 text-center text-[10px] bg-purple-50/50 text-purple-950 border-b border-gray-300 font-extrabold"
                          >
                            <div className="flex items-center justify-center h-28 mx-auto text-center select-none">
                              <span className="[writing-mode:vertical-lr] rotate-180 whitespace-nowrap tracking-wider uppercase text-center font-black">
                                T3 Grade
                              </span>
                            </div>
                          </th>
                        )}
                      </>
                    )}

                  {/* Combined Overall summaries at the very end */}
                  {marksView === "overall" && (
                    <>
                      {!isBlankPrintMode && !hiddenSummaryCols.has("combTotal") && !classStructure.resolvedPureGradeBased && (
                        <th
                          rowSpan={2}
                          className="p-2 text-center text-[10px] bg-emerald-50/85 text-emerald-950 border-b border-gray-300 font-black"
                        >
                          <div className="flex items-center justify-center h-28 mx-auto text-center select-none">
                            <span className="[writing-mode:vertical-lr] rotate-180 whitespace-nowrap tracking-wider uppercase text-center font-black">
                              Overall Total
                            </span>
                          </div>
                        </th>
                      )}
                      {!isBlankPrintMode && !hiddenSummaryCols.has("combPct") && !classStructure.resolvedPureGradeBased && (
                        <th
                          rowSpan={2}
                          className="p-2 text-center text-[10px] bg-blue-50/85 text-blue-950 border-b border-gray-300 font-black"
                        >
                          <div className="flex items-center justify-center h-28 mx-auto text-center select-none">
                            <span className="[writing-mode:vertical-lr] rotate-180 whitespace-nowrap tracking-wider uppercase text-center font-black">
                              Overall % Pct
                            </span>
                          </div>
                        </th>
                      )}
                      {!isBlankPrintMode && !hiddenSummaryCols.has("combGrade") && (
                        <th
                          rowSpan={2}
                          className="p-2 text-center text-[10px] bg-purple-50/85 text-purple-950 border-b border-gray-300 font-black"
                        >
                          <div className="flex items-center justify-center h-28 mx-auto text-center select-none">
                            <span className="[writing-mode:vertical-lr] rotate-180 whitespace-nowrap tracking-wider uppercase text-center font-black">
                              Overall Grade
                            </span>
                          </div>
                        </th>
                      )}
                    </>
                  )}

                  {!isBlankPrintMode && !hiddenSummaryCols.has("rank") && (
                    <th
                      rowSpan={2}
                      className="p-2 text-center text-[10px] bg-amber-50 text-amber-950 border-b border-gray-300 font-black"
                    >
                      <div className="flex items-center justify-center h-28 mx-auto text-center select-none">
                        <span className="[writing-mode:vertical-lr] rotate-180 whitespace-nowrap tracking-wider uppercase text-center font-black">
                          Merit Rank
                        </span>
                      </div>
                    </th>
                  )}
                </tr>

                <tr className="bg-slate-50 text-slate-700 text-[8.5px] font-bold divide-x divide-gray-200 border-b border-gray-300">
                  {/* Scholastic subjects sub columns for Term 1 if visible */}
                  {(marksView === "term1" || marksView === "overall") &&
                    (marksView === "term1" || term1Enabled) &&
                    visibleScholasticSubjects.map((sub) =>
                      t1SubColDetails.map((subCol, colIdx) => (
                        <th
                          key={`t1_sub_${sub.id}_sh_${subCol.id}_${colIdx}`}
                          className={`p-1.5 text-center font-bold border-b border-gray-300 ${
                            subCol.id === "total"
                              ? "bg-indigo-50/30 text-indigo-950 font-black"
                              : "bg-slate-50/60 text-slate-500"
                          }`}
                          style={{
                            width: subCol.id !== "total" ? "45px" : "65px",
                          }}
                        >
                          <div className="flex items-center justify-center h-24 mx-auto text-center select-none">
                            <span className="[writing-mode:vertical-lr] rotate-180 whitespace-nowrap text-[9px] font-semibold tracking-wider uppercase text-center">
                              {subCol.label}
                            </span>
                          </div>
                        </th>
                      )),
                    )}

                   {/* Scholastic subjects sub columns for Term 2 if visible */}
                  {(marksView === "term2" || marksView === "overall") &&
                    (marksView === "term2" || term2Enabled) &&
                    visibleScholasticSubjects.map((sub) =>
                      t2SubColDetails.map((subCol, colIdx) => (
                        <th
                          key={`t2_sub_${sub.id}_sh_${subCol.id}_${colIdx}`}
                          className={`p-1.5 text-center font-bold border-b border-gray-300 ${
                            subCol.id === "total"
                              ? "bg-indigo-50/30 text-indigo-950 font-black"
                              : "bg-slate-50/60 text-slate-500"
                          }`}
                          style={{
                            width: subCol.id !== "total" ? "45px" : "65px",
                          }}
                        >
                          <div className="flex items-center justify-center h-24 mx-auto text-center select-none">
                            <span className="[writing-mode:vertical-lr] rotate-180 whitespace-nowrap text-[9px] font-semibold tracking-wider uppercase text-center">
                              {subCol.label}
                            </span>
                          </div>
                        </th>
                      )),
                    )}

                  {/* Scholastic subjects sub columns for Term 3 if visible */}
                  {(marksView === "term3" || marksView === "overall") &&
                    (marksView === "term3" || term3Enabled) &&
                    visibleScholasticSubjects.map((sub) =>
                      t3SubColDetails.map((subCol, colIdx) => (
                        <th
                          key={`t3_sub_${sub.id}_sh_${subCol.id}_${colIdx}`}
                          className={`p-1.5 text-center font-bold border-b border-gray-300 ${
                            subCol.id === "total"
                              ? "bg-indigo-50/30 text-indigo-950 font-black"
                              : "bg-slate-50/60 text-slate-500"
                          }`}
                          style={{
                            width: subCol.id !== "total" ? "45px" : "65px",
                          }}
                        >
                          <div className="flex items-center justify-center h-24 mx-auto text-center select-none">
                            <span className="[writing-mode:vertical-lr] rotate-180 whitespace-nowrap text-[9px] font-semibold tracking-wider uppercase text-center">
                              {subCol.label}
                            </span>
                          </div>
                        </th>
                      )),
                    )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {visibleProcessedStudents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={totalColumnsCount}
                      className="p-6 text-center text-gray-400 italic font-medium"
                    >
                      {processedStudentsData.length === 0
                        ? "No records matched the filter criteria. Please check selection."
                        : "All students are filtered out of print. Change deselect checklist above to restore."}
                    </td>
                  </tr>
                ) : (
                  paginatedRegisterStudents.map((row) => {
                    const grades = studentGrades.find(
                      (g) => g.studentId === row.student.id,
                    );
                    return (
                      <tr
                        key={row.student.id}
                        className="hover:bg-slate-50/75 transition-colors text-slate-800 font-medium divide-x divide-gray-200"
                      >
                        {!hiddenSummaryCols.has("rollNo") && (
                          <td className="p-2 text-center font-mono font-bold text-gray-500 print:text-black">
                            {row.student.rollNo}
                          </td>
                        )}
                        <td
                          className="p-2 font-bold text-slate-900 print:text-black truncate max-w-[170px]"
                          title={row.student.name}
                        >
                          {row.student.name}
                        </td>
                        {!hiddenSummaryCols.has("classSec") && (
                          <td className="p-2 text-center font-semibold text-slate-500 bg-slate-50/35 print:bg-transparent print:text-black">
                            {row.student.className} - {row.student.section}
                          </td>
                        )}

                        {/* Term 1 Student Cells Group */}
                        {(marksView === "term1" || marksView === "overall") &&
                          (marksView === "term1" || term1Enabled) && (
                            <>
                              {/* T1 Scholastic Subject Cells */}
                              {visibleScholasticSubjects.map((sub) => {
                                const subMetric = row.subjectScores[sub.id];
                                const scoreSheet = grades?.scholastic?.[
                                  sub.id
                                ] || { term1: {}, term2: {} };

                                return t1SubColDetails.map(
                                  (subCol, colIdx) => {
                                    let val: string | number = "-";
                                    let cellBg = "";

                                    if (isBlankPrintMode) {
                                      val = "\u00a0";
                                    } else if (subCol.id === "grade") {
                                      const subMaxMarks = sub.maxMarks ?? effectiveT1Cols.reduce((sum, col) => sum + col.maxMarks, 0);
                                      val = getGradeForValueAndMax(subMetric?.t1Sum ?? 0, subMaxMarks);
                                    } else if (subCol.id !== "total") {
                                      const scoreVal =
                                        scoreSheet?.term1?.[subCol.id];
                                      val =
                                        scoreVal !== undefined &&
                                        scoreVal !== null &&
                                        (scoreVal as any) !== ""
                                          ? scoreVal
                                          : 0;
                                    } else {
                                      val = subMetric?.t1Sum ?? 0;
                                      cellBg =
                                        "bg-indigo-50/15 font-black text-indigo-900 border-r border-indigo-200";
                                    }

                                    return (
                                      <td
                                        key={`t1_${sub.id}_cval_${subCol.id}_${colIdx}`}
                                        className={`p-1.5 text-center text-[10px] font-mono leading-none border-b border-gray-150 ${cellBg}`}
                                      >
                                        {val}
                                      </td>
                                    );
                                  },
                                );
                              })}

                              {/* T1 Co-Scholastic Traits Cells */}
                              {visibleCoScholasticSubjects.map((sub) => {
                                const val = isBlankPrintMode ? "\u00a0" : getCoScholasticSubjectGrade(
                                  row.student.id,
                                  sub,
                                  1,
                                );
                                const cellBg =
                                  "bg-teal-50/5 text-emerald-950 font-semibold";
                                return (
                                  <td
                                    key={`t1_co_${sub.id}_val`}
                                    className={`p-1.5 text-center text-[10px] border-b border-gray-150 ${cellBg}`}
                                  >
                                    {val}
                                  </td>
                                );
                              })}

                              {/* Term 1 Summaries Cells */}
                              {!isBlankPrintMode && !hiddenSummaryCols.has("t1Total") && !classStructure.resolvedPureGradeBased && (
                                <td className="p-1.5 text-center text-[10px] font-extrabold text-emerald-950 bg-emerald-50/15 border-b border-gray-150">
                                  {isBlankPrintMode ? "\u00a0" : row.t1Total}
                                </td>
                              )}
                              {!isBlankPrintMode && !hiddenSummaryCols.has("t1Pct") && !classStructure.resolvedPureGradeBased && (
                                <td className="p-1.5 text-center text-[10px] font-black text-blue-900 bg-blue-50/15 border-b border-gray-150">
                                  {isBlankPrintMode ? "\u00a0" : `${row.t1Pct}%`}
                                </td>
                              )}
                              {!isBlankPrintMode && !hiddenSummaryCols.has("t1Grade") && (
                                <td className="p-1.5 text-center text-[10px] font-black text-purple-950 bg-purple-50/15 border-b border-gray-150">
                                  {isBlankPrintMode ? "\u00a0" : row.t1Grade}
                                </td>
                              )}
                            </>
                          )}

                        {/* Term 2 Student Cells Group */}
                        {(marksView === "term2" || marksView === "overall") &&
                          (marksView === "term2" || term2Enabled) && (
                            <>
                              {/* T2 Scholastic Subject Cells */}
                              {visibleScholasticSubjects.map((sub) => {
                                const subMetric = row.subjectScores[sub.id];
                                const scoreSheet = grades?.scholastic?.[
                                  sub.id
                                ] || { term1: {}, term2: {} };

                                return t2SubColDetails.map(
                                  (subCol, colIdx) => {
                                    let val: string | number = "-";
                                    let cellBg = "";

                                    if (isBlankPrintMode) {
                                      val = "\u00a0";
                                    } else if (subCol.id === "grade") {
                                      const subMaxMarks = sub.maxMarks ?? effectiveT2Cols.reduce((sum, col) => sum + col.maxMarks, 0);
                                      val = getGradeForValueAndMax(subMetric?.t2Sum ?? 0, subMaxMarks);
                                    } else if (subCol.id !== "total") {
                                      const scoreVal =
                                        scoreSheet?.term2?.[subCol.id];
                                      val =
                                        scoreVal !== undefined &&
                                        scoreVal !== null &&
                                        (scoreVal as any) !== ""
                                          ? scoreVal
                                          : 0;
                                    } else {
                                      val = subMetric?.t2Sum ?? 0;
                                      cellBg =
                                        "bg-indigo-50/15 font-black text-indigo-900 border-r border-indigo-200";
                                    }

                                    return (
                                      <td
                                        key={`t2_${sub.id}_cval_${subCol.id}_${colIdx}`}
                                        className={`p-1.5 text-center text-[10px] font-mono leading-none border-b border-gray-150 ${cellBg}`}
                                      >
                                        {val}
                                      </td>
                                    );
                                  },
                                );
                              })}

                              {/* T2 Co-Scholastic Traits Cells */}
                              {visibleCoScholasticSubjects.map((sub) => {
                                const val = isBlankPrintMode ? "\u00a0" : getCoScholasticSubjectGrade(
                                  row.student.id,
                                  sub,
                                  2,
                                );
                                const cellBg =
                                  "bg-teal-50/5 text-emerald-950 font-semibold";
                                return (
                                  <td
                                    key={`t2_co_${sub.id}_val`}
                                    className={`p-1.5 text-center text-[10px] border-b border-gray-150 ${cellBg}`}
                                  >
                                    {val}
                                  </td>
                                );
                              })}

                              {/* Term 2 Summaries Cells */}
                              {!isBlankPrintMode && !hiddenSummaryCols.has("t2Total") && !classStructure.resolvedPureGradeBased && (
                                <td className="p-1.5 text-center text-[10px] font-extrabold text-emerald-950 bg-emerald-50/15 border-b border-gray-150">
                                  {isBlankPrintMode ? "\u00a0" : row.t2Total}
                                </td>
                              )}
                              {!isBlankPrintMode && !hiddenSummaryCols.has("t2Pct") && !classStructure.resolvedPureGradeBased && (
                                <td className="p-1.5 text-center text-[10px] font-black text-blue-900 bg-blue-50/15 border-b border-gray-150">
                                  {isBlankPrintMode ? "\u00a0" : `${row.t2Pct}%`}
                                </td>
                              )}
                              {!isBlankPrintMode && !hiddenSummaryCols.has("t2Grade") && (
                                <td className="p-1.5 text-center text-[10px] font-black text-purple-950 bg-purple-50/15 border-b border-gray-150">
                                  {isBlankPrintMode ? "\u00a0" : row.t2Grade}
                                </td>
                              )}
                            </>
                          )}

                        {/* Term 3 Student Cells Group */}
                        {(marksView === "term3" || marksView === "overall") &&
                          (marksView === "term3" || term3Enabled) && (
                            <>
                              {/* T3 Scholastic Subject Cells */}
                              {visibleScholasticSubjects.map((sub) => {
                                const subMetric = row.subjectScores[sub.id];
                                const scoreSheet = grades?.scholastic?.[
                                  sub.id
                                ] || { term1: {}, term2: {}, term3: {} };

                                return t3SubColDetails.map(
                                  (subCol, colIdx) => {
                                    let val: string | number = "-";
                                    let cellBg = "";

                                    if (isBlankPrintMode) {
                                      val = "\u00a0";
                                    } else if (subCol.id === "grade") {
                                      const subMaxMarks = sub.maxMarks ?? effectiveT3Cols.reduce((sum, col) => sum + col.maxMarks, 0);
                                      val = getGradeForValueAndMax(subMetric?.t3Sum ?? 0, subMaxMarks);
                                    } else if (subCol.id !== "total") {
                                      const scoreVal =
                                        scoreSheet?.term3?.[subCol.id];
                                      val =
                                        scoreVal !== undefined &&
                                        scoreVal !== null &&
                                        (scoreVal as any) !== ""
                                          ? scoreVal
                                          : 0;
                                    } else {
                                      val = subMetric?.t3Sum ?? 0;
                                      cellBg =
                                        "bg-indigo-50/15 font-black text-indigo-900 border-r border-indigo-200";
                                    }

                                    return (
                                      <td
                                        key={`t3_${sub.id}_cval_${subCol.id}_${colIdx}`}
                                        className={`p-1.5 text-center text-[10px] font-mono leading-none border-b border-gray-150 ${cellBg}`}
                                      >
                                        {val}
                                      </td>
                                    );
                                  },
                                );
                              })}

                              {/* T3 Co-Scholastic Traits Cells */}
                              {visibleCoScholasticSubjects.map((sub) => {
                                const val = isBlankPrintMode ? "\u00a0" : getCoScholasticSubjectGrade(
                                  row.student.id,
                                  sub,
                                  3,
                                );
                                const cellBg =
                                  "bg-teal-50/5 text-emerald-950 font-semibold";
                                return (
                                  <td
                                    key={`t3_co_${sub.id}_val`}
                                    className={`p-1.5 text-center text-[10px] border-b border-gray-150 ${cellBg}`}
                                  >
                                    {val}
                                  </td>
                                );
                              })}

                              {/* Term 3 Summaries Cells */}
                              {!isBlankPrintMode && !hiddenSummaryCols.has("t3Total") && !classStructure.resolvedPureGradeBased && (
                                <td className="p-1.5 text-center text-[10px] font-extrabold text-emerald-950 bg-emerald-50/15 border-b border-gray-150">
                                  {isBlankPrintMode ? "\u00a0" : row.t3Total}
                                </td>
                              )}
                              {!isBlankPrintMode && !hiddenSummaryCols.has("t3Pct") && !classStructure.resolvedPureGradeBased && (
                                <td className="p-1.5 text-center text-[10px] font-black text-blue-900 bg-blue-50/15 border-b border-gray-150">
                                  {isBlankPrintMode ? "\u00a0" : `${row.t3Pct}%`}
                                </td>
                              )}
                              {!isBlankPrintMode && !hiddenSummaryCols.has("t3Grade") && (
                                <td className="p-1.5 text-center text-[10px] font-black text-purple-950 bg-purple-50/15 border-b border-gray-150">
                                  {isBlankPrintMode ? "\u00a0" : row.t3Grade}
                                </td>
                              )}
                            </>
                          )}

                        {/* Overall Cumulative summaries cells */}
                        {marksView === "overall" && (
                          <>
                            {!isBlankPrintMode && !hiddenSummaryCols.has("combTotal") && !classStructure.resolvedPureGradeBased && (
                              <td className="p-1.5 text-center text-[10px] font-bold text-center bg-emerald-50/35 border-b border-gray-150">
                                {isBlankPrintMode ? "\u00a0" : row.totalMarks}
                              </td>
                            )}
                            {!isBlankPrintMode && !hiddenSummaryCols.has("combPct") && !classStructure.resolvedPureGradeBased && (
                              <td className="p-1.5 text-center text-[10px] font-bold text-center bg-blue-50/35 border-b border-gray-150">
                                {isBlankPrintMode ? "\u00a0" : `${row.percentage}%`}
                              </td>
                            )}
                            {!isBlankPrintMode && !hiddenSummaryCols.has("combGrade") && (
                              <td className="p-1.5 text-center text-[10px] font-black text-center bg-purple-50/25 border-b border-gray-150">
                                {isBlankPrintMode ? "\u00a0" : row.overallGrade}
                              </td>
                            )}
                          </>
                        )}

                        {!isBlankPrintMode && !hiddenSummaryCols.has("rank") && (
                          <td className="p-1.5 text-center text-[10px] font-mono font-bold text-amber-950 bg-amber-500/5 border-b border-gray-150">
                            {isBlankPrintMode ? "\u00a0" : `#${row.rank}`}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {isBlankPrintMode && (
              <div className="mt-8 pt-6 border-t border-gray-300">
                <div className="flex justify-between items-center text-[10px] font-black tracking-wide text-gray-700 font-sans">
                  <div className="text-center w-[45%]">
                    <div className="h-10 border-b border-dashed border-gray-300 mb-2"></div>
                    <p className="uppercase text-[9px] tracking-wider text-gray-600 font-sans">Exam Incharge Signature</p>
                  </div>
                  <div className="text-center w-[45%]">
                    <div className="h-10 border-b border-dashed border-gray-300 mb-2"></div>
                    <p className="uppercase text-[9px] tracking-wider text-gray-600 font-sans">Subject Teacher Signature</p>
                  </div>
                </div>
              </div>
            )}
          </div>
              </React.Fragment>
            ))}
          </div>

          {/* Tabulation Pagination Controls */}
          {visibleProcessedStudents.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 p-3 rounded-xl border border-gray-150 text-xs no-print mt-4">
              <div className="flex items-center gap-2 text-slate-500 flex-wrap">
                <span>Show</span>
                <select
                  value={registerPageSize}
                  onChange={(e) => {
                    setRegisterPageSize(Number(e.target.value));
                    setRegisterPage(1);
                  }}
                  className="bg-white border border-gray-200 rounded-lg p-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-slate-800"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={9999}>All (Disable Pagination)</option>
                </select>
                <span>students per page</span>
                <span className="mx-1 text-gray-300">|</span>
                <span>
                  Showing <strong className="text-slate-950 font-semibold">{Math.min(visibleProcessedStudents.length, (registerPage - 1) * registerPageSize + 1)}</strong> to{' '}
                  <strong className="text-slate-950 font-semibold">{Math.min(visibleProcessedStudents.length, registerPage * registerPageSize)}</strong> of{' '}
                  <strong className="text-slate-950 font-semibold">{visibleProcessedStudents.length}</strong> students
                </span>
              </div>

              {registerPageSize < 9999 && (
                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    disabled={registerPage === 1}
                    onClick={() => setRegisterPage(1)}
                    className={`px-2.5 py-1 rounded-md border font-medium transition ${
                      registerPage === 1
                        ? 'bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed'
                        : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 cursor-pointer'
                    }`}
                  >
                    First
                  </button>
                  <button
                    disabled={registerPage === 1}
                    onClick={() => setRegisterPage((prev) => Math.max(1, prev - 1))}
                    className={`px-2.5 py-1 rounded-md border font-medium transition ${
                      registerPage === 1
                        ? 'bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed'
                        : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 cursor-pointer'
                    }`}
                  >
                    Prev
                  </button>
                  
                  {/* Visible Page Numbers */}
                  {Array.from({ length: totalRegisterPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalRegisterPages || Math.abs(p - registerPage) <= 1)
                    .map((p, index, arr) => {
                      const showEllipsis = index > 0 && p - arr[index - 1] > 1;
                      return (
                        <React.Fragment key={p}>
                          {showEllipsis && <span className="px-1.5 text-slate-400">...</span>}
                          <button
                            onClick={() => setRegisterPage(p)}
                            className={`px-2.5 py-1 rounded-md border font-bold transition ${
                              registerPage === p
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 cursor-pointer'
                            }`}
                          >
                            {p}
                          </button>
                        </React.Fragment>
                      );
                    })}

                  <button
                    disabled={registerPage === totalRegisterPages}
                    onClick={() => setRegisterPage((prev) => Math.min(totalRegisterPages, prev + 1))}
                    className={`px-2.5 py-1 rounded-md border font-medium transition ${
                      registerPage === totalRegisterPages
                        ? 'bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed'
                        : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 cursor-pointer'
                    }`}
                  >
                    Next
                  </button>
                  <button
                    disabled={registerPage === totalRegisterPages}
                    onClick={() => setRegisterPage(totalRegisterPages)}
                    className={`px-2.5 py-1 rounded-md border font-medium transition ${
                      registerPage === totalRegisterPages
                        ? 'bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed'
                        : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 cursor-pointer'
                    }`}
                  >
                    Last
                  </button>
                </div>
              )}
            </div>
          )}
          </>
        )}

        {/* RANKS LIST VIEW (Simplified display matching class awards lists) */}
        {reportTab === "ranks" && (
          <div className="w-full">
            <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-xl mb-4 text-[11px] text-amber-800 font-semibold no-print">
              💡 Ranks list organizes all matching students strictly from
              Highest Scored Marks downwards. Tied totals are assigned shared
              competition ranks seamlessly.
            </div>

            <div className="w-full overflow-x-auto">
              <table
                className="w-full border-collapse text-left text-xs min-w-[700px] print:min-w-0"
                id="ranks_list_table"
              >
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-bold border-b border-gray-300 text-[11px] print:bg-gray-100">
                    <th className="p-2.5 w-18 text-center bg-amber-500/10 text-amber-950 font-black tracking-wide">
                      Merit Rank
                    </th>
                    <th className="p-2.5 w-16 text-center font-mono">
                      Roll No
                    </th>
                    <th className="p-2.5">Student Name</th>
                    <th className="p-2.5 text-center">Class & Sec</th>
                    <th className="p-2.5 text-center bg-emerald-50/40 text-emerald-950 font-bold">
                      Total Marks Obtained
                    </th>
                    <th className="p-2.5 text-center bg-blue-50/40 text-blue-950 font-bold">
                      Percentage (%)
                    </th>
                    <th className="p-2.5 text-center bg-purple-50/40 text-purple-950 font-bold">
                      Grade
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {processedStudentsData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="p-6 text-center text-gray-400 italic"
                      >
                        No records matched the filter criteria. Please check
                        selection.
                      </td>
                    </tr>
                  ) : (
                    // Always sort ranks list strictly by rank
                    paginatedRankStudents.map((row) => (
                        <tr
                          key={row.student.id}
                          className="hover:bg-amber-500/[0.02] transition-colors text-slate-800 font-medium text-[11.5px]"
                        >
                          <td className="p-2.5 text-center bg-amber-500/5 text-amber-950 font-black font-mono text-[14px]">
                            🥇 Rank #{row.rank}
                          </td>
                          <td className="p-2.5 text-center font-mono text-gray-500 font-bold">
                            {row.student.rollNo}
                          </td>
                          <td className="p-2.5 font-bold text-gray-900">
                            {row.student.name}
                          </td>
                          <td className="p-2.5 text-center text-slate-500 font-bold">
                            {row.student.className} - {row.student.section}
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold bg-emerald-50/20 text-emerald-950">
                            {row.totalMarks}{" "}
                            <span className="text-[10px] text-gray-400 font-normal">
                              / {row.maxPossibleMarks}
                            </span>
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold bg-blue-50/20 text-blue-950">
                            {row.percentage}%
                          </td>
                          <td className="p-2.5 text-center font-bold bg-purple-50/25 text-purple-950">
                            {row.overallGrade}
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Ranks Pagination Controls */}
            {processedStudentsData.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-amber-50/20 p-3 rounded-xl border border-amber-100 text-xs no-print mt-4">
                <div className="flex items-center gap-2 text-slate-500 flex-wrap">
                  <span>Show</span>
                  <select
                    value={registerPageSize}
                    onChange={(e) => {
                      setRegisterPageSize(Number(e.target.value));
                      setRegisterPage(1);
                    }}
                    className="bg-white border border-gray-200 rounded-lg p-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer text-slate-800"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={9999}>All (Disable Pagination)</option>
                  </select>
                  <span>students per page</span>
                  <span className="mx-1 text-gray-300">|</span>
                  <span>
                    Showing <strong className="text-slate-950 font-semibold">{Math.min(processedStudentsData.length, (registerPage - 1) * registerPageSize + 1)}</strong> to{' '}
                    <strong className="text-slate-950 font-semibold">{Math.min(processedStudentsData.length, registerPage * registerPageSize)}</strong> of{' '}
                    <strong className="text-slate-950 font-semibold">{processedStudentsData.length}</strong> students
                  </span>
                </div>

                {registerPageSize < 9999 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <button
                      disabled={registerPage === 1}
                      onClick={() => setRegisterPage(1)}
                      className={`px-2.5 py-1 rounded-md border font-medium transition ${
                        registerPage === 1
                          ? 'bg-amber-50 text-amber-300 border-amber-50 cursor-not-allowed'
                          : 'bg-white hover:bg-amber-50/50 text-amber-800 border-amber-200 cursor-pointer'
                      }`}
                    >
                      First
                    </button>
                    <button
                      disabled={registerPage === 1}
                      onClick={() => setRegisterPage((prev) => Math.max(1, prev - 1))}
                      className={`px-2.5 py-1 rounded-md border font-medium transition ${
                        registerPage === 1
                          ? 'bg-amber-50 text-amber-300 border-amber-50 cursor-not-allowed'
                          : 'bg-white hover:bg-amber-50/50 text-amber-800 border-amber-200 cursor-pointer'
                      }`}
                    >
                      Prev
                    </button>
                    
                    {/* Visible Page Numbers */}
                    {Array.from({ length: totalRegisterPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalRegisterPages || Math.abs(p - registerPage) <= 1)
                      .map((p, index, arr) => {
                        const showEllipsis = index > 0 && p - arr[index - 1] > 1;
                        return (
                          <React.Fragment key={p}>
                            {showEllipsis && <span className="px-1.5 text-amber-400">...</span>}
                            <button
                              onClick={() => setRegisterPage(p)}
                              className={`px-2.5 py-1 rounded-md border font-bold transition ${
                                registerPage === p
                                  ? 'bg-amber-600 text-white border-amber-600'
                                  : 'bg-white hover:bg-amber-50/50 text-amber-800 border-amber-200 cursor-pointer'
                              }`}
                            >
                              {p}
                            </button>
                          </React.Fragment>
                        );
                      })}

                    <button
                      disabled={registerPage === totalRegisterPages}
                      onClick={() => setRegisterPage((prev) => Math.min(totalRegisterPages, prev + 1))}
                      className={`px-2.5 py-1 rounded-md border font-medium transition ${
                        registerPage === totalRegisterPages
                          ? 'bg-amber-50 text-amber-300 border-amber-50 cursor-not-allowed'
                          : 'bg-white hover:bg-amber-50/50 text-amber-800 border-amber-200 cursor-pointer'
                      }`}
                    >
                      Next
                    </button>
                    <button
                      disabled={registerPage === totalRegisterPages}
                      onClick={() => setRegisterPage(totalRegisterPages)}
                      className={`px-2.5 py-1 rounded-md border font-medium transition ${
                        registerPage === totalRegisterPages
                          ? 'bg-amber-50 text-amber-300 border-amber-50 cursor-not-allowed'
                          : 'bg-white hover:bg-amber-50/50 text-amber-800 border-amber-200 cursor-pointer'
                      }`}
                    >
                      Last
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Dynamic Branded Footer Visible ONLY in Print Output */}
        {!isBlankPrintMode && (
          <div className="hidden print:block mt-12 pt-6 border-t border-gray-400">
            <div className="flex justify-between items-center text-[10px] font-bold text-gray-600">
              {reportTab !== "tabulation" && (
                <div className="text-center w-1/3">
                  <div className="h-10"></div>
                  <p className="border-t border-gray-400 pt-1 uppercase">
                    {branding.signParentName || "Parent Signature"}
                  </p>
                </div>
              )}
              <div className={`text-center ${reportTab === "tabulation" ? "w-1/2" : "w-1/3"}`}>
                <div className="h-10"></div>
                <p className="border-t border-gray-400 pt-1 uppercase">
                  {branding.signInchargeName || "Class Teacher Signature"}
                </p>
              </div>
              <div className={`text-center ${reportTab === "tabulation" ? "w-1/2" : "w-1/3"}`}>
                <div className="h-10"></div>
                <p className="border-t border-gray-400 pt-1 uppercase">
                  {branding.signPrincipalName || "Principal Signature"}
                </p>
              </div>
            </div>
            <div className="mt-6 text-center text-[8.5px] font-mono text-gray-400 block uppercase">
              Parents Report Gateway Tabulation Sheet &bull; generated digitally
              on {new Date().toLocaleDateString()}
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
