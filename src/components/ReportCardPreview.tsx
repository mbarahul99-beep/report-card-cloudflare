import React, { useState, useRef, useEffect } from 'react';
import { SchoolBranding, SubjectColumn, ScoreColumn, GradeScale, CoGradeScale, Student, StudentGrades, CoScholasticSection, SignatureItem } from '../types';
import { Printer, Award, Download, Sparkles, Smartphone, ZoomIn, ZoomOut, Maximize2, RotateCw } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import AiRemarksModal from './AiRemarksModal';
import { formatStudentFieldValue } from '../lib/studentFormatters';
import { classesMatch } from '../utils/classNormalizer';
import { normalizeExternalImageUrl } from '../utils/imageUrlHelper';

interface PreviewProps {
  branding: SchoolBranding;
  subjects: SubjectColumn[];
  scoreColumns: ScoreColumn[];
  termSpecificScoreColumnsEnabled?: boolean;
  term1ScoreColumns?: ScoreColumn[];
  term2ScoreColumns?: ScoreColumn[];
  term3ScoreColumns?: ScoreColumn[];
  gradeScales: GradeScale[];
  coGradeScales?: CoGradeScale[];
  student: Student;
  grades: StudentGrades;
  scholasticTerm1Disabled?: boolean;
  scholasticTerm2Disabled?: boolean;
  scholasticTerm3Disabled?: boolean;
  coScholasticOneColumn?: boolean;
  coScholasticSections?: CoScholasticSection[];
  signatures?: SignatureItem[];
  hideGradingScale?: boolean;
  hideAttendance?: boolean;
  pureGradeBased?: boolean;
  gradingScaleAfterSignatures?: boolean;
  gradingScaleLayout?: 'side-by-side' | 'stacked';
  verticalExamHeaders?: boolean;
  verticalSubjectsHeader?: boolean;
  subjectSpecificMaxMarksEnabled?: boolean;
  enableSubjectGrouping?: boolean;
  customSubjectGroups?: string[];
  hideTerm1Total?: boolean;
  hideTerm1Grade?: boolean;
  hideTerm2Total?: boolean;
  hideTerm2Grade?: boolean;
  hideTerm3Total?: boolean;
  hideTerm3Grade?: boolean;
  hideOverallTotal?: boolean;
  hideOverallGrade?: boolean;
  showMinMarksColumn?: boolean;
  showMaxMarksColumn?: boolean;
  showObtainedMarksColumn?: boolean;
  minMarksHeaderLabel?: string;
  maxMarksHeaderLabel?: string;
  obtainedMarksHeaderLabel?: string;
  onUpdateRemarks?: (newRemarks: string, promotionStatus?: string) => void;
}

export default function ReportCardPreview({
  branding: rawBranding,
  subjects,
  scoreColumns,
  termSpecificScoreColumnsEnabled = false,
  term1ScoreColumns,
  term2ScoreColumns,
  term3ScoreColumns,
  gradeScales,
  coGradeScales = [],
  student,
  grades,
  scholasticTerm1Disabled = false,
  scholasticTerm2Disabled = false,
  scholasticTerm3Disabled = false,
  coScholasticOneColumn = false,
  coScholasticSections = [],
  signatures,
  hideGradingScale = false,
  hideAttendance = false,
  pureGradeBased = false,
  gradingScaleAfterSignatures = false,
  gradingScaleLayout = 'side-by-side',
  verticalExamHeaders = false,
  verticalSubjectsHeader = false,
  subjectSpecificMaxMarksEnabled = false,
  enableSubjectGrouping = true,
  customSubjectGroups = [],
  hideTerm1Total = false,
  hideTerm1Grade = false,
  hideTerm2Total = false,
  hideTerm2Grade = false,
  hideTerm3Total = false,
  hideTerm3Grade = false,
  hideOverallTotal = false,
  hideOverallGrade = false,
  showMinMarksColumn: propShowMinMarksColumn,
  showMaxMarksColumn: propShowMaxMarksColumn,
  showObtainedMarksColumn: propShowObtainedMarksColumn,
  minMarksHeaderLabel: propMinMarksHeaderLabel,
  maxMarksHeaderLabel: propMaxMarksHeaderLabel,
  obtainedMarksHeaderLabel: propObtainedMarksHeaderLabel,
  onUpdateRemarks
}: PreviewProps) {
  const [isAiRemarksOpen, setIsAiRemarksOpen] = useState(false);
  
  const branding = rawBranding || {} as SchoolBranding;
  const showMinMarksColumn = propShowMinMarksColumn ?? branding.showMinMarksColumn ?? false;
  const showMaxMarksColumn = propShowMaxMarksColumn ?? branding.showMaxMarksColumn ?? false;
  const showObtainedMarksColumn = propShowObtainedMarksColumn ?? branding.showObtainedMarksColumn ?? true;
  const minMarksHeaderLabel = propMinMarksHeaderLabel || branding.minMarksHeaderLabel || "Min Marks";
  const maxMarksHeaderLabel = propMaxMarksHeaderLabel || branding.maxMarksHeaderLabel || "Max Marks";
  const obtainedMarksHeaderLabel = propObtainedMarksHeaderLabel || branding.obtainedMarksHeaderLabel || "Marks Obtained";
  const subColCount = Math.max(1, (showMinMarksColumn ? 1 : 0) + (showMaxMarksColumn ? 1 : 0) + (showObtainedMarksColumn ? 1 : 0));
  const term1Enabled = branding.term1Enabled !== false;
  const term2Enabled = branding.term2Enabled !== false;
  const term3Enabled = branding.term3Enabled === true;
  
  const scholT1Enabled = term1Enabled && !scholasticTerm1Disabled;
  const scholT2Enabled = term2Enabled && !scholasticTerm2Disabled;
  const scholT3Enabled = term3Enabled && !scholasticTerm3Disabled;
  const hasScholasticActive = scholT1Enabled || scholT2Enabled || scholT3Enabled;
  const activeTermsCount = (scholT1Enabled ? 1 : 0) + (scholT2Enabled ? 1 : 0) + (scholT3Enabled ? 1 : 0);
  const showOverall = activeTermsCount > 1;
  const term1Label = branding.term1Label || "Academic Term I";
  const term2Label = branding.term2Label || "Academic Term II";
  const term3Label = branding.term3Label || "Academic Term III";
  const scholasticLabel = branding.scholasticLabel || "Scholastic Performance";
  const term1ExamLabel = branding.term1ExamLabel || "Half Yearly";
  const term2ExamLabel = branding.term2ExamLabel || "Annual";
  const term3ExamLabel = branding.term3ExamLabel || "Final Board Test";
  const term1TotalLabel = branding.term1TotalLabel || (pureGradeBased ? "T1 Grade" : "T1 Total");
  const term2TotalLabel = branding.term2TotalLabel || (pureGradeBased ? "T2 Grade" : "T2 Total");
  const term3TotalLabel = branding.term3TotalLabel || (pureGradeBased ? "T3 Grade" : "T3 Total");
  const semestersHeaderLabel = branding.semestersHeaderLabel || "Semesters ➔";
  const scholasticSubjectsHeaderLabel = branding.scholasticSubjectsHeaderLabel || "Scholastic Subjects";
  const overallResultsHeaderLabel = branding.overallResultsHeaderLabel || "Overall Results";
  const totalMarksHeaderLabel = branding.totalMarksHeaderLabel || (pureGradeBased ? "Subject Grade" : "Total Marks");
  const gradeHeaderLabel = branding.gradeHeaderLabel || "Grade";
  const personalityHeaderLabel = branding.personalityHeaderLabel || "PART 2: PERSONALITY & CO-SCHOLASTIC (5-POINT GRADE SCALE)";
  const personalitySubjectHeaderLabel = branding.personalitySubjectHeaderLabel || "SUBJECT AREA DOMAINS";
  const coCurricularHeaderLabel = branding.coCurricularHeaderLabel || "PART 3: CO-CURRICULAR AREA & SKILLS (3-POINT GRADE SCALE)";
  const coCurricularSubjectHeaderLabel = branding.coCurricularSubjectHeaderLabel || "ACTIVITY AREAS & SKILLS";
  const gradePercentageLabel = branding.gradePercentageLabel || "Overall Percentage";
  const boardGradeLabel = branding.boardGradeLabel || "Overall Grade";
  const attendanceLabel = branding.attendanceLabel || "Working Attendance";
  const attendancePresenceLabel = branding.attendancePresenceLabel || "Class Attendance Presence:";
  const scholasticSummaryLabel = branding.scholasticSummaryLabel || "Scholastic Summary";
  const totalMarksObtainedLabel = branding.totalMarksObtainedLabel || "Total Marks Obtained";

  const renderGradingScalesRow = (microSize = false) => {
    const resolvedCoGradeScales = (coGradeScales && coGradeScales.length > 0) ? coGradeScales : [
      { score: 'A', description: 'Exemplary' },
      { score: 'B', description: 'Very Good' },
      { score: 'C', description: 'Good' },
      { score: 'D', description: 'Fair' },
      { score: 'E', description: 'Needs Imp.' }
    ];

    const isStacked = gradingScaleLayout === 'stacked';

    const containerClasses = microSize 
      ? "relative z-10 grid grid-cols-12 gap-4 mt-2.5 pt-1.5 border-t border-dashed border-gray-400 text-[8px] text-gray-500 leading-tight" 
      : "relative z-10 grid grid-cols-12 gap-4 mt-1.5 pt-1.5 border-t border-gray-100 text-[9px] text-gray-800 leading-normal";

    const resolvedGradeScales = (gradeScales && gradeScales.length > 0) ? gradeScales : [
      { grade: 'A1', minPercent: 91, maxPercent: 100, point: 10 },
      { grade: 'A2', minPercent: 81, maxPercent: 90, point: 9 },
      { grade: 'B1', minPercent: 71, maxPercent: 80, point: 8 },
      { grade: 'B2', minPercent: 61, maxPercent: 70, point: 7 },
      { grade: 'C1', minPercent: 51, maxPercent: 60, point: 6 },
      { grade: 'C2', minPercent: 41, maxPercent: 50, point: 5 },
      { grade: 'D', minPercent: 33, maxPercent: 40, point: 4 },
      { grade: 'E', minPercent: 0, maxPercent: 32, point: 3 }
    ];

    const tableClasses = microSize 
      ? "w-full table-fixed border-collapse border border-gray-400 text-[7px] text-center font-mono mt-0.5 grading-scale-table" 
      : "w-full table-fixed border-collapse border border-gray-900 text-[9px] text-center font-mono mt-0.5 grading-scale-table";

    const tdClassHeader = microSize
      ? "border border-gray-350 p-0.5 text-left font-black bg-gray-50/50 w-16 print:w-12 font-sans"
      : "border border-gray-950 p-1 text-left font-bold bg-gray-50 w-22 print:w-16 font-sans";

    const tdClassCell = microSize
      ? "border border-gray-350 p-0.5 px-0.5 font-bold text-gray-500"
      : "border border-gray-950 p-1 px-1 font-bold text-gray-700";

    const coScaleTitleClass = microSize
      ? "border-b border-gray-350 bg-gray-50/50 p-0.5 font-sans font-black text-left text-[7px]"
      : "border-b border-gray-900 bg-gray-50 p-1 font-sans font-bold text-left text-[8.5px]";

    const coScaleHeadClass = microSize
      ? "border border-gray-350 p-0.5 bg-gray-50/10 text-gray-500 font-bold font-sans"
      : "border border-gray-950 p-1 bg-gray-50/20 text-gray-650 font-bold font-sans";

    const coScaleDescClass = microSize
      ? "border border-gray-350 p-0.5 font-sans text-gray-400"
      : "border border-gray-950 p-1 font-sans text-gray-650 font-medium";

    const scholasticColSpan = isStacked 
      ? "col-span-1 md:col-span-12 print:w-full" 
      : "col-span-1 md:col-span-7 print:w-[57%] print:shrink-0";
    const coScholasticColSpan = isStacked 
      ? "col-span-1 md:col-span-12 print:w-full mt-2" 
      : "col-span-1 md:col-span-5 print:w-[41%] print:shrink-0";

    const containerClassesResponsive = microSize 
      ? `relative z-10 grid grid-cols-1 md:grid-cols-12 gap-4 mt-2 pt-1 border-t border-dashed border-gray-400 text-[8px] text-black leading-tight ${isStacked ? 'print:flex print:flex-col print:gap-1.5 print:items-stretch' : 'print:flex print:flex-row print:gap-4 print:items-start print:justify-between'}` 
      : `relative z-10 grid grid-cols-1 md:grid-cols-12 gap-4 mt-1.5 pt-1 border-t border-gray-100 text-[9px] text-black leading-normal ${isStacked ? 'print:flex print:flex-col print:gap-2 print:items-stretch' : 'print:flex print:flex-row print:gap-4 print:items-start print:justify-between'}`;

    return (
      <div className={containerClassesResponsive}>
        {/* Scholastic Grading Schedule */}
        <div className={`${scholasticColSpan} space-y-0.5`}>
          <h4 className={microSize ? "font-black text-[7.5px] text-gray-400 italic text-left uppercase whitespace-nowrap" : "font-extrabold text-[9px] text-gray-900 italic text-left"}>
            Grade Scale For Scholastic Areas:
          </h4>
          <div className="overflow-x-auto no-scrollbar print:overflow-visible">
            <table className={tableClasses}>
              <colgroup>
                <col style={{ width: '16%' }} />
                {resolvedGradeScales.map((_, idx) => (
                  <col key={`col_${idx}`} style={{ width: `${84 / resolvedGradeScales.length}%` }} />
                ))}
              </colgroup>
              <tbody>
                <tr className={microSize ? "border-b border-gray-350" : "border-b border-gray-900"}>
                  <td className={tdClassHeader}>Range (%)</td>
                  {resolvedGradeScales.map((scale, idx) => (
                    <td key={`range_${idx}`} className={tdClassCell}>
                      {scale.minPercent}-{scale.maxPercent}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className={tdClassHeader}>Grade</td>
                  {resolvedGradeScales.map((scale, idx) => (
                    <td key={`grade_val_${idx}`} className={tdClassCell}>
                      {scale.grade}{scale.description ? ` (${scale.description})` : ''}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Co-Scholastic Grading Scale */}
        <div className={`${coScholasticColSpan} space-y-0.5`}>
          <h4 className={microSize ? "font-black text-[7.5px] text-gray-400 italic text-left uppercase whitespace-nowrap" : "font-extrabold text-[9px] text-gray-900 italic text-left"}>
            Co-scholastic Grading Scale Area:
          </h4>
          <div className="overflow-x-auto no-scrollbar print:overflow-visible">
            <table className={tableClasses}>
              <colgroup>
                {resolvedCoGradeScales.map((_, idx) => (
                  <col key={`co_col_${idx}`} style={{ width: `${100 / resolvedCoGradeScales.length}%` }} />
                ))}
              </colgroup>
              <tbody>
                <tr className={microSize ? "border-b border-gray-350" : "border-b border-gray-900"}>
                  {resolvedCoGradeScales.map((scale, idx) => (
                    <td key={`co_grade_score_${idx}`} className={coScaleHeadClass}>{scale.score}</td>
                  ))}
                </tr>
                <tr>
                  {resolvedCoGradeScales.map((scale, idx) => (
                    <td key={`co_grade_desc_${idx}`} className={coScaleDescClass}>{scale.description}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const isGroupingActive = enableSubjectGrouping !== false;

  const showT1Total = !hideTerm1Total;
  const showT1Grade = !hideTerm1Grade;
  const showT2Total = !hideTerm2Total;
  const showT2Grade = !hideTerm2Grade;
  const showT3Total = !hideTerm3Total;
  const showT3Grade = !hideTerm3Grade;
  const showOverallTotal = !hideOverallTotal;
  const showOverallGrade = !hideOverallGrade;

  const t1ExtraCols = (showT1Total ? 1 : 0) + (showT1Grade ? 1 : 0);
  const t2ExtraCols = (showT2Total ? 1 : 0) + (showT2Grade ? 1 : 0);
  const t3ExtraCols = (showT3Total ? 1 : 0) + (showT3Grade ? 1 : 0);
  const overallExtraCols = (showOverallTotal ? 1 : 0) + (showOverallGrade ? 1 : 0);

  const isTermSpecific = !!termSpecificScoreColumnsEnabled && (
    (term1ScoreColumns && term1ScoreColumns.length > 0) ||
    (term2ScoreColumns && term2ScoreColumns.length > 0) ||
    (term3ScoreColumns && term3ScoreColumns.length > 0)
  );

  const t1Columns = (isTermSpecific && term1ScoreColumns && term1ScoreColumns.length > 0) ? term1ScoreColumns : scoreColumns;
  const t2Columns = (isTermSpecific && term2ScoreColumns && term2ScoreColumns.length > 0) ? term2ScoreColumns : scoreColumns;
  const t3Columns = (isTermSpecific && term3ScoreColumns && term3ScoreColumns.length > 0) ? term3ScoreColumns : scoreColumns;

  const sumOfT1ColumnMaxMarks = t1Columns.reduce((sum, col) => sum + col.maxMarks, 0);
  const sumOfT2ColumnMaxMarks = t2Columns.reduce((sum, col) => sum + col.maxMarks, 0);
  const sumOfT3ColumnMaxMarks = t3Columns.reduce((sum, col) => sum + col.maxMarks, 0);

  // Dynamically compute percentage widths for the scholastic marks table to prevent cutting off or overflowing the right page border
  const cTerm1 = scholT1Enabled ? (t1Columns.length * subColCount + (showT1Total ? subColCount : 0) + (showT1Grade ? 1 : 0)) : 0;
  const cTerm2 = scholT2Enabled ? (t2Columns.length * subColCount + (showT2Total ? subColCount : 0) + (showT2Grade ? 1 : 0)) : 0;
  const cTerm3 = scholT3Enabled ? (t3Columns.length * subColCount + (showT3Total ? subColCount : 0) + (showT3Grade ? 1 : 0)) : 0;
  const cOverall = (showOverall && overallExtraCols > 0) ? ((showOverallTotal ? subColCount : 0) + (showOverallGrade ? 1 : 0)) : 0;
  const cRem = Math.max(1, cTerm1 + cTerm2 + cTerm3 + cOverall);

  // Content-Aware Adaptive Multi-Tier Column Sizing
  // - Tier 1: Low Density (cRem <= 8) -> 1-term or 2-term totals/grades (e.g. 6 cols).
  //           Subject gets generous 36%-46% width, and ALL score columns have 100% equal/uniform width.
  //           Zero lopsided widths or awkward gaping voids.
  // - Tier 2: Moderate Density (9 <= cRem <= 12) -> 2-3 terms with moderate tests.
  //           Subject gets 22%-32% width, with gentle balanced column weighting.
  // - Tier 3: High Density (cRem >= 13) -> 3 terms with multiple component tests (14-18 cols).
  //           Subject column yields space (15%-17.5%) and Overall Total receives 1.55x width
  //           to easily fit "126/150" or "138/150" without colliding into adjacent borders.
  let subjWidth = 26;
  let testColWidth = 10;
  let termTotalColWidth = 10;
  let termGradeColWidth = 10;
  let overallTotalColWidth = 10;
  let overallGradeColWidth = 10;
  let singleColWidth = 10;

  const getSubColWidths = (parentWidthPct: number) => {
    const activeCount = Math.max(1, (showMinMarksColumn ? 1 : 0) + (showMaxMarksColumn ? 1 : 0) + (showObtainedMarksColumn ? 1 : 0));
    const equalPct = parentWidthPct / activeCount;
    return {
      minPct: showMinMarksColumn ? equalPct : 0,
      maxPct: showMaxMarksColumn ? equalPct : 0,
      obtPct: showObtainedMarksColumn ? equalPct : 0
    };
  };

  const omitExamHeaderRow = subColCount > 1 && 
    (!scholT1Enabled || t1Columns.length <= 1) && 
    (!scholT2Enabled || t2Columns.length <= 1) && 
    (!scholT3Enabled || t3Columns.length <= 1);

  if (pureGradeBased) {
    const singleGradeWidth = Math.max(7.5, Math.min(14, Math.floor(45 / cRem)));
    subjWidth = Math.max(25, 100 - (singleGradeWidth * cRem));
    const remainingWidth = 100 - subjWidth;
    const uniformColWidth = cRem > 0 ? (remainingWidth / cRem) : 10;
    testColWidth = uniformColWidth;
    termTotalColWidth = uniformColWidth;
    termGradeColWidth = uniformColWidth;
    overallTotalColWidth = uniformColWidth;
    overallGradeColWidth = uniformColWidth;
    singleColWidth = uniformColWidth;
  } else if (cRem <= 8) {
    // TIER 1: Low Density (<= 8 columns) - Standard balanced layout with weighted columns
    subjWidth = Math.max(30, Math.min(40, 100 - (cRem * 7.5)));
    const remainingWidth = 100 - subjWidth;
    const uniformColWidth = cRem > 0 ? (remainingWidth / cRem) : 10;
    testColWidth = uniformColWidth;
    termTotalColWidth = uniformColWidth;
    termGradeColWidth = uniformColWidth;
    overallTotalColWidth = uniformColWidth;
    overallGradeColWidth = uniformColWidth;
    singleColWidth = uniformColWidth;
  } else if (cRem <= 12) {
    // TIER 2: Moderate Density (9 - 12 columns) - Mildly weighted balanced layout
    subjWidth = Math.max(22.0, Math.min(32.0, 100 - (cRem * 6.5)));
    const remainingWidth = 100 - subjWidth;

    const weightTestCol = 1.0;
    const weightTermTotal = 1.05;
    const weightGradeCol = 0.90;
    const weightOverallTotal = 1.25;

    let totalColWeight = 0;
    if (scholT1Enabled) {
      totalColWeight += t1Columns.length * weightTestCol;
      if (showT1Total) totalColWeight += weightTermTotal;
      if (showT1Grade) totalColWeight += weightGradeCol;
    }
    if (scholT2Enabled) {
      totalColWeight += t2Columns.length * weightTestCol;
      if (showT2Total) totalColWeight += weightTermTotal;
      if (showT2Grade) totalColWeight += weightGradeCol;
    }
    if (scholT3Enabled) {
      totalColWeight += t3Columns.length * weightTestCol;
      if (showT3Total) totalColWeight += weightTermTotal;
      if (showT3Grade) totalColWeight += weightGradeCol;
    }
    if (showOverall && overallExtraCols > 0) {
      if (showOverallTotal) totalColWeight += weightOverallTotal;
      if (showOverallGrade) totalColWeight += weightGradeCol;
    }
    if (totalColWeight <= 0) totalColWeight = 1;

    const getColPct = (w: number) => ((w / totalColWeight) * remainingWidth);
    testColWidth = getColPct(weightTestCol);
    termTotalColWidth = getColPct(weightTermTotal);
    termGradeColWidth = getColPct(weightGradeCol);
    overallTotalColWidth = getColPct(weightOverallTotal);
    overallGradeColWidth = getColPct(weightGradeCol);
    singleColWidth = cRem > 0 ? (remainingWidth / cRem) : 10;
  } else {
    // TIER 3: High Density (>= 13 columns) - 3 terms with multiple component exams
    subjWidth = (cRem >= 16) ? 15.0 : 17.5;
    const remainingWidth = 100 - subjWidth;

    const weightTestCol = 1.0;
    const weightTermTotal = 1.15;
    const weightGradeCol = 0.80;
    const weightOverallTotal = 1.55;

    let totalColWeight = 0;
    if (scholT1Enabled) {
      totalColWeight += t1Columns.length * weightTestCol;
      if (showT1Total) totalColWeight += weightTermTotal;
      if (showT1Grade) totalColWeight += weightGradeCol;
    }
    if (scholT2Enabled) {
      totalColWeight += t2Columns.length * weightTestCol;
      if (showT2Total) totalColWeight += weightTermTotal;
      if (showT2Grade) totalColWeight += weightGradeCol;
    }
    if (scholT3Enabled) {
      totalColWeight += t3Columns.length * weightTestCol;
      if (showT3Total) totalColWeight += weightTermTotal;
      if (showT3Grade) totalColWeight += weightGradeCol;
    }
    if (showOverall && overallExtraCols > 0) {
      if (showOverallTotal) totalColWeight += weightOverallTotal;
      if (showOverallGrade) totalColWeight += weightGradeCol;
    }
    if (totalColWeight <= 0) totalColWeight = 1;

    const getColPct = (w: number) => ((w / totalColWeight) * remainingWidth);
    testColWidth = getColPct(weightTestCol);
    termTotalColWidth = getColPct(weightTermTotal);
    termGradeColWidth = getColPct(weightGradeCol);
    overallTotalColWidth = getColPct(weightOverallTotal);
    overallGradeColWidth = getColPct(weightGradeCol);
    singleColWidth = cRem > 0 ? (remainingWidth / cRem) : 10;
  }

  const totalTableColumns = 1 + cTerm1 + cTerm2 + cTerm3 + cOverall;

  // Dynamically scale down font sizes and paddings when there are many columns
  // to avoid horizontal overflow and ensure all columns fit perfectly on A4 paper width
  const tableFontSizeClass = cRem > 15 ? 'text-[8px] tracking-tight' : cRem > 12 ? 'text-[8.5px]' : cRem > 9 ? 'text-[9px]' : 'text-[10px]';
  const headerFontSizeClass = cRem > 15 ? 'text-[8px] tracking-tight' : cRem > 12 ? 'text-[8.5px]' : cRem > 9 ? 'text-[9px]' : 'text-[9.5px]';
  const subjectNameFontSizeClass = cRem > 15 ? 'text-[9px]' : cRem > 12 ? 'text-[9.5px]' : cRem > 9 ? 'text-[10px]' : 'text-[10.5px]';
  const cellPaddingClass = cRem > 15 ? 'py-[2px] px-[1px]' : cRem > 12 ? 'py-0.5 px-[1.5px]' : cRem > 9 ? 'py-1 px-0.5' : 'p-1';
  const subjectCellPaddingClass = cRem > 15 ? 'py-0.5 px-1' : cRem > 12 ? 'py-1 px-1.5' : 'py-1.5 px-2';

  const renderExamHeader = (text: string, subtext?: string) => {
    const isVertical = verticalExamHeaders;
    if (isVertical) {
      const fullText = subtext ? `${text} ${subtext}` : text;
      return (
        <div 
          className="inline-block mx-auto text-center font-black tracking-tight text-black leading-none select-all font-sans py-1 text-[9px] sm:text-[10px]" 
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap' }}
        >
          {fullText}
        </div>
      );
    } else {
      return (
        <div className="flex flex-col items-center justify-center text-center leading-tight px-0.5">
          <span className="font-black text-black">{text}</span>
          {subtext && <span className="text-[8.5px] font-bold text-black mt-0.5">{subtext}</span>}
        </div>
      );
    }
  };

  const renderSubHeader = (label: string) => {
    const isVertical = verticalExamHeaders;
    if (isVertical) {
      return (
        <div 
          className="inline-block mx-auto text-center font-black tracking-tight text-black leading-none select-all font-sans py-1 text-[8.5px] sm:text-[9px]" 
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap' }}
        >
          {label}
        </div>
      );
    } else {
      return (
        <div className="flex flex-col items-center justify-center text-center leading-tight px-1 py-0.5 font-black uppercase text-black w-full overflow-visible">
          <span className="block whitespace-nowrap text-[8.5px] sm:text-[9px] tracking-tight font-black">{label}</span>
        </div>
      );
    }
  };

  // Student details fields selection
  const rawStudentFields = branding.studentFields || [
    { id: "name", label: branding.studentNameLabel || "Student's Name" },
    { id: "fatherName", label: branding.fatherNameLabel || "Father's Name" },
    { id: "motherName", label: branding.motherNameLabel || "Mother's Name" },
    { id: "height", label: branding.heightLabel || "Height" },
    { id: "weight", label: branding.weightLabel || "Weight" },
    { id: "className", label: branding.classLabel || "Class" },
    { id: "section", label: branding.sectionLabel || "Section" },
    { id: "rollNo", label: branding.rollNoLabel || "Roll No" },
    { id: "admissionNo", label: branding.admissionNoLabel || "Admission No." },
    { id: "dob", label: branding.dobLabel || "D.O.B." }
  ];

  const fieldsToRender = rawStudentFields.filter(f => {
    if (f.disabledAll || f.disabled === true) return false;
    if (f.disabledClasses && student?.className && f.disabledClasses.some((dc: string) => classesMatch(dc, student.className))) return false;
    return true;
  });

  const midPoint = Math.ceil(fieldsToRender.length / 2);
  const col1Fields = fieldsToRender.slice(0, midPoint);
  const col2Fields = fieldsToRender.slice(midPoint);

  const getGradeFromMark = (markSumOrPercent: any, maxMarks: number) => {
    if (maxMarks <= 0) return '-';
    if (markSumOrPercent === undefined || markSumOrPercent === null) return '-';
    if (typeof markSumOrPercent === 'string' && isNaN(Number(markSumOrPercent))) return markSumOrPercent;
    
    const num = Number(markSumOrPercent);
    if (isNaN(num)) return '-';
    const pct = (num / maxMarks) * 100;
    
    for (const scale of gradeScales) {
      if (pct >= scale.minPercent && pct <= scale.maxPercent) {
        return scale.grade;
      }
    }
    return '-';
  };

  const getMidpointPercentForGrade = (gradeName: string) => {
    if (!gradeName) return 0;
    const cleanGrade = String(gradeName).trim().toUpperCase();
    const match = gradeScales.find(scale => scale.grade.trim().toUpperCase() === cleanGrade);
    if (match) {
      return (match.minPercent + match.maxPercent) / 2;
    }
    return 0;
  };

  const getSubjectMetrics = (subId: string) => {
    const scoreSheet = grades.scholastic[subId] || { term1: {}, term2: {}, term3: {} };
    const subjectObj = subjects.find(s => s.id === subId);
    
    // Calculate per-term custom column sums
    const sumOfT1ColMaxMarksForSub = t1Columns.reduce((sum, col) => sum + (subjectObj?.customMaxMarks?.[col.id] ?? col.maxMarks), 0);
    const sumOfT2ColMaxMarksForSub = t2Columns.reduce((sum, col) => sum + (subjectObj?.customMaxMarks?.[col.id] ?? col.maxMarks), 0);
    const sumOfT3ColMaxMarksForSub = t3Columns.reduce((sum, col) => sum + (subjectObj?.customMaxMarks?.[col.id] ?? col.maxMarks), 0);

    const t1SubMax = subjectSpecificMaxMarksEnabled ? sumOfT1ColMaxMarksForSub : (subjectObj?.maxMarks ?? sumOfT1ColumnMaxMarks);
    const t2SubMax = subjectSpecificMaxMarksEnabled ? sumOfT2ColMaxMarksForSub : (subjectObj?.maxMarks ?? sumOfT2ColumnMaxMarks);
    const t3SubMax = subjectSpecificMaxMarksEnabled ? sumOfT3ColMaxMarksForSub : (subjectObj?.maxMarks ?? sumOfT3ColumnMaxMarks);

    const getEquivalentMark = (val: any, maxMarks: number) => {
      const parsedMax = Number(maxMarks) || 0;
      if (val === undefined || val === null || val === '-' || val === '') return 0;
      if (typeof val === 'string' && isNaN(Number(val))) {
        // It's a grade string like "A1", get its midpoint percentage
        const midPercent = getMidpointPercentForGrade(val);
        const res = (midPercent / 100) * parsedMax;
        return isNaN(res) ? 0 : res;
      }
      const num = Number(val);
      return isNaN(num) ? 0 : num;
    };
    
    // Sum Term 1
    let t1Sum = 0;
    if (scholT1Enabled) {
      if (t1Columns.length > 0) {
        t1Sum = t1Columns.reduce((sum, col) => {
          const val = scoreSheet.term1?.[col.id];
          const colMax = subjectObj?.customMaxMarks?.[col.id] ?? col.maxMarks;
          return sum + getEquivalentMark(val, colMax);
        }, 0);
      } else {
        const directVal = scoreSheet.term1?.['_direct_grade'] ?? scoreSheet.term1?.['grade'] ?? scoreSheet.term1?.['total'];
        t1Sum = getEquivalentMark(directVal, t1SubMax);
      }
      if (!subjectSpecificMaxMarksEnabled && t1SubMax !== sumOfT1ColumnMaxMarks && sumOfT1ColumnMaxMarks > 0) {
        t1Sum = (t1Sum / sumOfT1ColumnMaxMarks) * t1SubMax;
      }
    }

    // Sum Term 2
    let t2Sum = 0;
    if (scholT2Enabled) {
      if (t2Columns.length > 0) {
        t2Sum = t2Columns.reduce((sum, col) => {
          const val = scoreSheet.term2?.[col.id];
          const colMax = subjectObj?.customMaxMarks?.[col.id] ?? col.maxMarks;
          return sum + getEquivalentMark(val, colMax);
        }, 0);
      } else {
        const directVal = scoreSheet.term2?.['_direct_grade'] ?? scoreSheet.term2?.['grade'] ?? scoreSheet.term2?.['total'];
        t2Sum = getEquivalentMark(directVal, t2SubMax);
      }
      if (!subjectSpecificMaxMarksEnabled && t2SubMax !== sumOfT2ColumnMaxMarks && sumOfT2ColumnMaxMarks > 0) {
        t2Sum = (t2Sum / sumOfT2ColumnMaxMarks) * t2SubMax;
      }
    }

    // Sum Term 3
    let t3Sum = 0;
    if (scholT3Enabled) {
      if (t3Columns.length > 0) {
        t3Sum = t3Columns.reduce((sum, col) => {
          const val = scoreSheet.term3?.[col.id];
          const colMax = subjectObj?.customMaxMarks?.[col.id] ?? col.maxMarks;
          return sum + getEquivalentMark(val, colMax);
        }, 0);
      } else {
        const directVal = scoreSheet.term3?.['_direct_grade'] ?? scoreSheet.term3?.['grade'] ?? scoreSheet.term3?.['total'];
        t3Sum = getEquivalentMark(directVal, t3SubMax);
      }
      if (!subjectSpecificMaxMarksEnabled && t3SubMax !== sumOfT3ColumnMaxMarks && sumOfT3ColumnMaxMarks > 0) {
        t3Sum = (t3Sum / sumOfT3ColumnMaxMarks) * t3SubMax;
      }
    }

    let overall = 0;
    if (scholT1Enabled) overall += t1Sum;
    if (scholT2Enabled) overall += t2Sum;
    if (scholT3Enabled) overall += t3Sum;

    const maxOverallMarksPossible = (scholT1Enabled ? t1SubMax : 0) + (scholT2Enabled ? t2SubMax : 0) + (scholT3Enabled ? t3SubMax : 0);
    const percent = maxOverallMarksPossible > 0 ? (overall / maxOverallMarksPossible) * 100 : 0;

    // Find Grade Scale
    let matchedGrade = "E";
    for (const scale of gradeScales) {
      if (percent >= scale.minPercent && percent <= scale.maxPercent) {
        matchedGrade = scale.grade;
        break;
      }
    }

    return {
      t1Sum: Math.round(t1Sum),
      t2Sum: Math.round(t2Sum),
      t3Sum: Math.round(t3Sum),
      overallRound: Math.round(overall),
      overall,
      grade: matchedGrade,
      maxOverallMarksPossible,
      subMaxMarks: maxOverallMarksPossible,
      t1SubMax,
      t2SubMax,
      t3SubMax
    };
  };

  // Compile calculations for grand sums
  const sumOfColumnMaxMarks = scoreColumns.reduce((sum, col) => sum + col.maxMarks, 0);
  let totalOverallMarks = 0;
  let scholasticCount = 0;
  let totalMaxMarksPossible = 0;

  subjects.forEach(sub => {
    if (sub.type === 'scholastic') {
      const metrics = getSubjectMetrics(sub.id);
      totalOverallMarks += metrics.overall;
      totalMaxMarksPossible += metrics.maxOverallMarksPossible;
      scholasticCount++;
    }
  });

  const averagePercentage = totalMaxMarksPossible > 0 ? parseFloat(((totalOverallMarks * 100) / totalMaxMarksPossible).toFixed(2)) : 0;

  // Compile final overall grade
  let averageGrade = "E";
  for (const scale of gradeScales) {
    if (averagePercentage >= scale.minPercent && averagePercentage <= scale.maxPercent) {
      averageGrade = scale.grade;
      break;
    }
  }

  // Term-wise calculations for scholastic totals and percentages
  let t1TotalObtained = 0;
  let t1MaxMarksPossible = 0;
  let t2TotalObtained = 0;
  let t2MaxMarksPossible = 0;
  let t3TotalObtained = 0;
  let t3MaxMarksPossible = 0;

  subjects.forEach(sub => {
    if (sub.type === 'scholastic') {
      const metrics = getSubjectMetrics(sub.id);
      
      if (scholT1Enabled) {
        t1TotalObtained += metrics.t1Sum;
        t1MaxMarksPossible += metrics.t1SubMax;
      }
      if (scholT2Enabled) {
        t2TotalObtained += metrics.t2Sum;
        t2MaxMarksPossible += metrics.t2SubMax;
      }
      if (scholT3Enabled) {
        t3TotalObtained += metrics.t3Sum;
        t3MaxMarksPossible += metrics.t3SubMax;
      }
    }
  });

  const t1Percentage = t1MaxMarksPossible > 0 ? (t1TotalObtained / t1MaxMarksPossible) * 100 : 0;
  const t2Percentage = t2MaxMarksPossible > 0 ? (t2TotalObtained / t2MaxMarksPossible) * 100 : 0;
  const t3Percentage = t3MaxMarksPossible > 0 ? (t3TotalObtained / t3MaxMarksPossible) * 100 : 0;

  // Term-wise calculations for ADDITIONAL subjects totals and percentages (for its own separate summary)
  let addT1TotalObtained = 0;
  let addT1MaxMarksPossible = 0;
  let addT2TotalObtained = 0;
  let addT2MaxMarksPossible = 0;
  let addT3TotalObtained = 0;
  let addT3MaxMarksPossible = 0;

  let addTotalOverallMarks = 0;
  let addTotalMaxMarksPossible = 0;

  subjects.forEach(sub => {
    if (sub.type === 'additional') {
      const metrics = getSubjectMetrics(sub.id);
      
      if (scholT1Enabled) {
        addT1TotalObtained += metrics.t1Sum;
        addT1MaxMarksPossible += metrics.t1SubMax;
      }
      if (scholT2Enabled) {
        addT2TotalObtained += metrics.t2Sum;
        addT2MaxMarksPossible += metrics.t2SubMax;
      }
      if (scholT3Enabled) {
        addT3TotalObtained += metrics.t3Sum;
        addT3MaxMarksPossible += metrics.t3SubMax;
      }

      addTotalOverallMarks += metrics.overall;
      addTotalMaxMarksPossible += metrics.maxOverallMarksPossible;
    }
  });

  const addT1Percentage = addT1MaxMarksPossible > 0 ? (addT1TotalObtained / addT1MaxMarksPossible) * 100 : 0;
  const addT2Percentage = addT2MaxMarksPossible > 0 ? (addT2TotalObtained / addT2MaxMarksPossible) * 100 : 0;
  const addT3Percentage = addT3MaxMarksPossible > 0 ? (addT3TotalObtained / addT3MaxMarksPossible) * 100 : 0;

  const hasAdditionalActive = hasScholasticActive && branding.additionalSubjectsEnabled === true && subjects.some(s => s.type === 'additional');

  const renderAdditionalSubjectsTable = () => {
    if (!hasAdditionalActive) return null;
    const firstAdditionalSubject = subjects.find(s => s.type === 'additional');
    const firstSubMax = firstAdditionalSubject?.maxMarks ?? sumOfColumnMaxMarks;
    const singleSubjectMaxOverall = firstSubMax * ((scholT1Enabled ? 1 : 0) + (scholT2Enabled ? 1 : 0) + (scholT3Enabled ? 1 : 0));
    const additionalLabel = branding.additionalSubjectsHeaderLabel || "Additional Subjects";

    return (
      <div className="overflow-x-auto no-scrollbar print:overflow-visible mt-2">
        <table className={`w-full table-fixed border-collapse border border-gray-900 text-center leading-tight ${tableFontSizeClass}`}>
          <colgroup>
            <col style={{ width: `${subjWidth}%` }} />
            {scholT1Enabled && (
              <>
                {t1Columns.map(col => (
                  subColCount > 1 ? (
                    <React.Fragment key={`add_col_t1_grp_${col.id}`}>
                      {showMinMarksColumn && <col key={`add_col_t1_min_${col.id}`} style={{ width: `${testColWidth / subColCount}%` }} />}
                      {showMaxMarksColumn && <col key={`add_col_t1_max_${col.id}`} style={{ width: `${testColWidth / subColCount}%` }} />}
                      {showObtainedMarksColumn && <col key={`add_col_t1_obt_${col.id}`} style={{ width: `${testColWidth / subColCount}%` }} />}
                    </React.Fragment>
                  ) : (
                    <col key={`add_col_t1_${col.id}`} style={{ width: `${testColWidth}%` }} />
                  )
                ))}
                {showT1Total && (
                  subColCount > 1 ? (
                    <React.Fragment key="add_col_t1_tot_grp">
                      {showMinMarksColumn && <col style={{ width: `${termTotalColWidth / subColCount}%` }} />}
                      {showMaxMarksColumn && <col style={{ width: `${termTotalColWidth / subColCount}%` }} />}
                      {showObtainedMarksColumn && <col style={{ width: `${termTotalColWidth / subColCount}%` }} />}
                    </React.Fragment>
                  ) : (
                    <col style={{ width: `${termTotalColWidth}%` }} />
                  )
                )}
                {showT1Grade && <col style={{ width: `${termGradeColWidth}%` }} />}
              </>
            )}
            {scholT2Enabled && (
              <>
                {t2Columns.map(col => (
                  subColCount > 1 ? (
                    <React.Fragment key={`add_col_t2_grp_${col.id}`}>
                      {showMinMarksColumn && <col key={`add_col_t2_min_${col.id}`} style={{ width: `${testColWidth / subColCount}%` }} />}
                      {showMaxMarksColumn && <col key={`add_col_t2_max_${col.id}`} style={{ width: `${testColWidth / subColCount}%` }} />}
                      {showObtainedMarksColumn && <col key={`add_col_t2_obt_${col.id}`} style={{ width: `${testColWidth / subColCount}%` }} />}
                    </React.Fragment>
                  ) : (
                    <col key={`add_col_t2_${col.id}`} style={{ width: `${testColWidth}%` }} />
                  )
                ))}
                {showT2Total && (
                  subColCount > 1 ? (
                    <React.Fragment key="add_col_t2_tot_grp">
                      {showMinMarksColumn && <col style={{ width: `${termTotalColWidth / subColCount}%` }} />}
                      {showMaxMarksColumn && <col style={{ width: `${termTotalColWidth / subColCount}%` }} />}
                      {showObtainedMarksColumn && <col style={{ width: `${termTotalColWidth / subColCount}%` }} />}
                    </React.Fragment>
                  ) : (
                    <col style={{ width: `${termTotalColWidth}%` }} />
                  )
                )}
                {showT2Grade && <col style={{ width: `${termGradeColWidth}%` }} />}
              </>
            )}
            {scholT3Enabled && (
              <>
                {t3Columns.map(col => (
                  subColCount > 1 ? (
                    <React.Fragment key={`add_col_t3_grp_${col.id}`}>
                      {showMinMarksColumn && <col key={`add_col_t3_min_${col.id}`} style={{ width: `${testColWidth / subColCount}%` }} />}
                      {showMaxMarksColumn && <col key={`add_col_t3_max_${col.id}`} style={{ width: `${testColWidth / subColCount}%` }} />}
                      {showObtainedMarksColumn && <col key={`add_col_t3_obt_${col.id}`} style={{ width: `${testColWidth / subColCount}%` }} />}
                    </React.Fragment>
                  ) : (
                    <col key={`add_col_t3_${col.id}`} style={{ width: `${testColWidth}%` }} />
                  )
                ))}
                {showT3Total && (
                  subColCount > 1 ? (
                    <React.Fragment key="add_col_t3_tot_grp">
                      {showMinMarksColumn && <col style={{ width: `${termTotalColWidth / subColCount}%` }} />}
                      {showMaxMarksColumn && <col style={{ width: `${termTotalColWidth / subColCount}%` }} />}
                      {showObtainedMarksColumn && <col style={{ width: `${termTotalColWidth / subColCount}%` }} />}
                    </React.Fragment>
                  ) : (
                    <col style={{ width: `${termTotalColWidth}%` }} />
                  )
                )}
                {showT3Grade && <col style={{ width: `${termGradeColWidth}%` }} />}
              </>
            )}
            {showOverall && overallExtraCols > 0 && (
              <>
                {showOverallTotal && (
                  subColCount > 1 ? (
                    <React.Fragment key="add_col_ov_tot_grp">
                      {showMinMarksColumn && <col style={{ width: `${overallTotalColWidth / subColCount}%` }} />}
                      {showMaxMarksColumn && <col style={{ width: `${overallTotalColWidth / subColCount}%` }} />}
                      {showObtainedMarksColumn && <col style={{ width: `${overallTotalColWidth / subColCount}%` }} />}
                    </React.Fragment>
                  ) : (
                    <col style={{ width: `${overallTotalColWidth}%` }} />
                  )
                )}
                {showOverallGrade && <col style={{ width: `${overallGradeColWidth}%` }} />}
              </>
            )}
          </colgroup>
          <thead>
            <tr className="bg-emerald-50/50 border-b border-gray-955">
              <th 
                colSpan={totalTableColumns} 
                className="border border-gray-950 p-1 text-center font-black text-gray-900 text-xs tracking-wider uppercase bg-emerald-50/50"
              >
                {additionalLabel}
              </th>
            </tr>
            <tr className="bg-gray-50/50 border-b border-gray-900">
              <th 
                rowSpan={omitExamHeaderRow ? 2 : (subColCount > 1 ? 3 : 2)} 
                className={`border border-gray-950 ${subjectCellPaddingClass} text-left font-bold text-gray-800 ${subjectNameFontSizeClass} break-words leading-tight`}
              >
                Subjects
              </th>
              {scholT1Enabled && (
                <th colSpan={t1Columns.length * subColCount + (showT1Total ? subColCount : 0) + (showT1Grade ? 1 : 0)} className={`border border-gray-955 ${cellPaddingClass} font-black text-black uppercase tracking-wide bg-gray-100/30 text-[9px] sm:text-[10px]`}>
                  {term1Label}
                </th>
              )}
              {scholT2Enabled && (
                <th colSpan={t2Columns.length * subColCount + (showT2Total ? subColCount : 0) + (showT2Grade ? 1 : 0)} className={`border border-gray-955 ${cellPaddingClass} font-black text-black uppercase tracking-wide bg-gray-100/30 text-[9px] sm:text-[10px]`}>
                  {term2Label}
                </th>
              )}
              {scholT3Enabled && (
                <th colSpan={t3Columns.length * subColCount + (showT3Total ? subColCount : 0) + (showT3Grade ? 1 : 0)} className={`border border-gray-955 ${cellPaddingClass} font-black text-black uppercase tracking-wide bg-gray-100/30 text-[9px] sm:text-[10px]`}>
                  {term3Label}
                </th>
              )}
              {showOverall && overallExtraCols > 0 && (
                <th colSpan={(showOverallTotal ? subColCount : 0) + (showOverallGrade ? 1 : 0)} className={`border border-gray-955 ${cellPaddingClass} font-black text-black uppercase tracking-wide bg-rose-50/40 text-[9px] sm:text-[10px]`}>
                  Overall
                </th>
              )}
            </tr>
            {!omitExamHeaderRow && (
              <tr className="bg-gray-100/20 border-b border-gray-900">
                {/* Term 1 sub-columns */}
                {scholT1Enabled && (
                  <>
                    {t1Columns.map(col => {
                      const isMidTerm = col.id === 'mid_term' || col.id === 'mid-term' || col.name.toLowerCase().includes('mid-term') || col.name.toLowerCase().includes('mid term');
                      const colName = isMidTerm ? 'Annual' : col.name;
                      const text = (col.id === 'hy') ? term1ExamLabel : colName;
                      const subtext = (!pureGradeBased && !subjectSpecificMaxMarksEnabled && subColCount === 1) ? `(${col.maxMarks})` : undefined;
                      return (
                        <th key={`add_t1_h_${col.id}`} colSpan={subColCount} className="border border-gray-955 p-1 bg-gray-50/10 text-[9.5px] font-black text-black align-middle text-center">
                          {renderExamHeader(text, subtext)}
                        </th>
                      );
                    })}
                    {showT1Total && (
                      <th colSpan={subColCount} className="border border-gray-955 p-1 bg-gray-100/50 text-[10px] font-black text-black align-middle text-center">
                        {renderExamHeader(term1TotalLabel, (!pureGradeBased && !subjectSpecificMaxMarksEnabled && subColCount === 1) ? `(${sumOfT1ColumnMaxMarks})` : undefined)}
                      </th>
                    )}
                    {showT1Grade && (
                      <th rowSpan={subColCount > 1 ? 2 : 1} className="border border-gray-955 p-1 bg-gray-100/50 text-[10px] font-black text-black align-middle text-center">
                        {renderExamHeader("Grade")}
                      </th>
                    )}
                  </>
                )}

                {/* Term 2 sub-columns */}
                {scholT2Enabled && (
                  <>
                    {t2Columns.map(col => {
                      const isMidTerm = col.id === 'mid_term' || col.id === 'mid-term' || col.name.toLowerCase().includes('mid-term') || col.name.toLowerCase().includes('mid term');
                      const colName = isMidTerm ? 'Annual' : col.name;
                      const text = (col.id === 'hy') ? term2ExamLabel : colName;
                      const subtext = (!pureGradeBased && !subjectSpecificMaxMarksEnabled && subColCount === 1) ? `(${col.maxMarks})` : undefined;
                      return (
                        <th key={`add_t2_h_${col.id}`} colSpan={subColCount} className="border border-gray-955 p-1 bg-gray-50/10 text-[9.5px] font-black text-black align-middle text-center">
                          {renderExamHeader(text, subtext)}
                        </th>
                      );
                    })}
                    {showT2Total && (
                      <th colSpan={subColCount} className="border border-gray-955 p-1 bg-gray-100/50 text-[10px] font-black text-black align-middle text-center">
                        {renderExamHeader(term2TotalLabel, (!pureGradeBased && !subjectSpecificMaxMarksEnabled && subColCount === 1) ? `(${sumOfT2ColumnMaxMarks})` : undefined)}
                      </th>
                    )}
                    {showT2Grade && (
                      <th rowSpan={subColCount > 1 ? 2 : 1} className="border border-gray-955 p-1 bg-gray-100/50 text-[10px] font-black text-black align-middle text-center">
                        {renderExamHeader("Grade")}
                      </th>
                    )}
                  </>
                )}

                {/* Term 3 sub-columns */}
                {scholT3Enabled && (
                  <>
                    {t3Columns.map(col => {
                      const isMidTerm = col.id === 'mid_term' || col.id === 'mid-term' || col.name.toLowerCase().includes('mid-term') || col.name.toLowerCase().includes('mid term');
                      const colName = isMidTerm ? 'Annual' : col.name;
                      const text = (col.id === 'hy') ? term3ExamLabel : colName;
                      const subtext = (!pureGradeBased && !subjectSpecificMaxMarksEnabled && subColCount === 1) ? `(${col.maxMarks})` : undefined;
                      return (
                        <th key={`add_t3_h_${col.id}`} colSpan={subColCount} className="border border-gray-955 p-1 bg-gray-50/10 text-[9.5px] font-black text-black align-middle text-center">
                          {renderExamHeader(text, subtext)}
                        </th>
                      );
                    })}
                    {showT3Total && (
                      <th colSpan={subColCount} className="border border-gray-955 p-1 bg-gray-100/50 text-[10px] font-black text-black align-middle text-center">
                        {renderExamHeader(term3TotalLabel, (!pureGradeBased && !subjectSpecificMaxMarksEnabled && subColCount === 1) ? `(${sumOfT3ColumnMaxMarks})` : undefined)}
                      </th>
                    )}
                    {showT3Grade && (
                      <th rowSpan={subColCount > 1 ? 2 : 1} className="border border-gray-955 p-1 bg-gray-100/50 text-[10px] font-black text-black align-middle text-center">
                        {renderExamHeader("Grade")}
                      </th>
                    )}
                  </>
                )}

                {/* Overall totals */}
                {showOverall && overallExtraCols > 0 && (
                  <>
                    {showOverallTotal && (
                      <th colSpan={subColCount} className="border border-gray-955 p-1 bg-sky-50/50 text-[10px] font-black text-black align-middle text-center">
                        {renderExamHeader(totalMarksHeaderLabel, (!pureGradeBased && !subjectSpecificMaxMarksEnabled && subColCount === 1) ? `(${singleSubjectMaxOverall})` : undefined)}
                      </th>
                    )}
                    {showOverallGrade && (
                      <th rowSpan={subColCount > 1 ? 2 : 1} className="border border-gray-955 p-1 bg-rose-50/50 text-[10px] font-black text-black align-middle text-center">
                        {renderExamHeader(gradeHeaderLabel)}
                      </th>
                    )}
                  </>
                )}
              </tr>
            )}

            {/* Sub-column headers row when subColCount > 1 */}
            {subColCount > 1 && (
              <tr className="bg-gray-100/60 border-b border-gray-950 font-bold text-[8px] sm:text-[9px]">
                {scholT1Enabled && (
                  <>
                    {t1Columns.map(col => (
                      <React.Fragment key={`add_t1_subhdr_${col.id}`}>
                        {showMinMarksColumn && <th className="border border-gray-955 p-0.5 text-center font-black text-gray-700 uppercase bg-gray-100/80">{renderSubHeader(minMarksHeaderLabel || "Min")}</th>}
                        {showMaxMarksColumn && <th className="border border-gray-955 p-0.5 text-center font-black text-gray-700 uppercase bg-gray-100/80">{renderSubHeader(maxMarksHeaderLabel || "Max")}</th>}
                        {showObtainedMarksColumn && <th className="border border-gray-955 p-0.5 text-center font-black text-gray-900 uppercase bg-gray-100/80">{renderSubHeader(obtainedMarksHeaderLabel || "Obt")}</th>}
                      </React.Fragment>
                    ))}
                    {showT1Total && (
                      <React.Fragment key="add_t1_tot_subhdr">
                        {showMinMarksColumn && <th className="border border-gray-955 p-0.5 text-center font-black text-gray-700 uppercase bg-gray-200/80">{renderSubHeader(minMarksHeaderLabel || "Min")}</th>}
                        {showMaxMarksColumn && <th className="border border-gray-955 p-0.5 text-center font-black text-gray-700 uppercase bg-gray-200/80">{renderSubHeader(maxMarksHeaderLabel || "Max")}</th>}
                        {showObtainedMarksColumn && <th className="border border-gray-955 p-0.5 text-center font-black text-gray-900 uppercase bg-gray-200/80">{renderSubHeader(obtainedMarksHeaderLabel || "Obt")}</th>}
                      </React.Fragment>
                    )}
                    {showT1Grade && omitExamHeaderRow && (
                      <th className="border border-gray-955 p-1 bg-gray-100/50 text-[10px] font-black text-black align-middle text-center">
                        {renderExamHeader("Grade")}
                      </th>
                    )}
                  </>
                )}
                {scholT2Enabled && (
                  <>
                    {t2Columns.map(col => (
                      <React.Fragment key={`add_t2_subhdr_${col.id}`}>
                        {showMinMarksColumn && <th className="border border-gray-955 p-0.5 text-center font-black text-gray-700 uppercase bg-gray-100/80">{renderSubHeader(minMarksHeaderLabel || "Min")}</th>}
                        {showMaxMarksColumn && <th className="border border-gray-955 p-0.5 text-center font-black text-gray-700 uppercase bg-gray-100/80">{renderSubHeader(maxMarksHeaderLabel || "Max")}</th>}
                        {showObtainedMarksColumn && <th className="border border-gray-955 p-0.5 text-center font-black text-gray-900 uppercase bg-gray-100/80">{renderSubHeader(obtainedMarksHeaderLabel || "Obt")}</th>}
                      </React.Fragment>
                    ))}
                    {showT2Total && (
                      <React.Fragment key="add_t2_tot_subhdr">
                        {showMinMarksColumn && <th className="border border-gray-955 p-0.5 text-center font-black text-gray-700 uppercase bg-gray-200/80">{renderSubHeader(minMarksHeaderLabel || "Min")}</th>}
                        {showMaxMarksColumn && <th className="border border-gray-955 p-0.5 text-center font-black text-gray-700 uppercase bg-gray-200/80">{renderSubHeader(maxMarksHeaderLabel || "Max")}</th>}
                        {showObtainedMarksColumn && <th className="border border-gray-955 p-0.5 text-center font-black text-gray-900 uppercase bg-gray-200/80">{renderSubHeader(obtainedMarksHeaderLabel || "Obt")}</th>}
                      </React.Fragment>
                    )}
                    {showT2Grade && omitExamHeaderRow && (
                      <th className="border border-gray-955 p-1 bg-gray-100/50 text-[10px] font-black text-black align-middle text-center">
                        {renderExamHeader("Grade")}
                      </th>
                    )}
                  </>
                )}
                {scholT3Enabled && (
                  <>
                    {t3Columns.map(col => (
                      <React.Fragment key={`add_t3_subhdr_${col.id}`}>
                        {showMinMarksColumn && <th className="border border-gray-955 p-0.5 text-center font-black text-gray-700 uppercase bg-gray-100/80">{renderSubHeader(minMarksHeaderLabel || "Min")}</th>}
                        {showMaxMarksColumn && <th className="border border-gray-955 p-0.5 text-center font-black text-gray-700 uppercase bg-gray-100/80">{renderSubHeader(maxMarksHeaderLabel || "Max")}</th>}
                        {showObtainedMarksColumn && <th className="border border-gray-955 p-0.5 text-center font-black text-gray-900 uppercase bg-gray-100/80">{renderSubHeader(obtainedMarksHeaderLabel || "Obt")}</th>}
                      </React.Fragment>
                    ))}
                    {showT3Total && (
                      <React.Fragment key="add_t3_tot_subhdr">
                        {showMinMarksColumn && <th className="border border-gray-955 p-0.5 text-center font-black text-gray-700 uppercase bg-gray-200/80">{renderSubHeader(minMarksHeaderLabel || "Min")}</th>}
                        {showMaxMarksColumn && <th className="border border-gray-955 p-0.5 text-center font-black text-gray-700 uppercase bg-gray-200/80">{renderSubHeader(maxMarksHeaderLabel || "Max")}</th>}
                        {showObtainedMarksColumn && <th className="border border-gray-955 p-0.5 text-center font-black text-gray-900 uppercase bg-gray-200/80">{renderSubHeader(obtainedMarksHeaderLabel || "Obt")}</th>}
                      </React.Fragment>
                    )}
                    {showT3Grade && omitExamHeaderRow && (
                      <th className="border border-gray-955 p-1 bg-gray-100/50 text-[10px] font-black text-black align-middle text-center">
                        {renderExamHeader("Grade")}
                      </th>
                    )}
                  </>
                )}
                {showOverall && overallExtraCols > 0 && (
                  <>
                    {showOverallTotal && (
                      <React.Fragment key="add_ov_tot_subhdr">
                        {showMinMarksColumn && <th className="border border-gray-955 p-0.5 text-center font-black text-gray-700 uppercase bg-sky-100/80">{renderSubHeader(minMarksHeaderLabel || "Min")}</th>}
                        {showMaxMarksColumn && <th className="border border-gray-955 p-0.5 text-center font-black text-gray-700 uppercase bg-sky-100/80">{renderSubHeader(maxMarksHeaderLabel || "Max")}</th>}
                        {showObtainedMarksColumn && <th className="border border-gray-955 p-0.5 text-center font-black text-gray-900 uppercase bg-sky-100/80">{renderSubHeader(obtainedMarksHeaderLabel || "Obt")}</th>}
                      </React.Fragment>
                    )}
                    {showOverallGrade && omitExamHeaderRow && (
                      <th className="border border-gray-955 p-1 bg-rose-50/50 text-[10px] font-black text-black align-middle text-center">
                        {renderExamHeader(gradeHeaderLabel)}
                      </th>
                    )}
                  </>
                )}
              </tr>
            )}
          </thead>
          <tbody>
            {(() => {
              const additionalList = subjects.filter(s => s.type === 'additional');
              const totalAddCols = totalTableColumns;

              return additionalList.map((sub, idx) => {
                const showGroupHdr = isGroupingActive && Boolean(sub.group && sub.group.trim()) && (idx === 0 || additionalList[idx - 1]?.group !== sub.group);
                const studentGrades = grades.scholastic[sub.id] || { term1: {}, term2: {}, term3: {} };
                const subMetrics = getSubjectMetrics(sub.id);

                return (
                  <React.Fragment key={sub.id}>
                    {showGroupHdr && (
                      <tr key={`add_group_hdr_${sub.group}_${idx}`} className="bg-gray-100/90 font-bold border-b border-gray-955">
                        <td 
                          colSpan={totalAddCols} 
                          className="p-1.5 pl-3 text-left font-black text-gray-900 bg-gray-100/90 text-[10.5px] uppercase tracking-wide border border-gray-955"
                        >
                          {sub.group}
                        </td>
                      </tr>
                    )}
                    <tr id={`preview_subject_row_${sub.id}`} className="hover:bg-gray-50/20 font-sans border-b border-gray-955">
                      <td className={`border border-gray-955 ${subjectCellPaddingClass} text-left font-black text-black ${subjectNameFontSizeClass} ${pureGradeBased ? 'whitespace-nowrap' : 'break-words leading-tight'}`}>
                        {isGroupingActive && sub.group ? (
                          <span className="inline-flex items-center pl-2.5">
                            <span className="text-gray-600 font-bold mr-1.5">-</span>
                            {sub.name.startsWith('- ') ? sub.name.substring(2) : sub.name}
                          </span>
                        ) : sub.name.startsWith('- ') ? (
                          <span className="inline-flex items-center pl-2.5">
                            <span className="text-gray-600 font-bold mr-1.5">-</span>
                            {sub.name.substring(2)}
                          </span>
                        ) : (
                          sub.name
                        )}
                      </td>
                      {/* Term 1 Scores */}
                      {scholT1Enabled && (
                        <>
                          {t1Columns.map(col => {
                            const rawVal = studentGrades.term1?.[col.id];
                            const resolvedVal = (rawVal === undefined || rawVal === null || (rawVal as any) === '') ? 0 : rawVal;
                            const colMax = sub.customMaxMarks?.[col.id] ?? col.maxMarks;
                            const colMin = col.minMarks !== undefined ? col.minMarks : Math.round(colMax * 0.33);

                            if (subColCount === 1) {
                              return (
                                <td key={`add_t1_cell_${sub.id}_${col.id}`} className={`border border-gray-955 ${cellPaddingClass} font-bold font-mono text-black ${tableFontSizeClass} text-center whitespace-nowrap overflow-hidden text-ellipsis`}>
                                  {pureGradeBased 
                                    ? getGradeFromMark(resolvedVal, colMax)
                                    : (subjectSpecificMaxMarksEnabled ? `${resolvedVal}/${colMax}` : resolvedVal)}
                                </td>
                              );
                            } else {
                              return (
                                <React.Fragment key={`add_t1_cell_sub_${sub.id}_${col.id}`}>
                                  {showMinMarksColumn && (
                                    <td className={`border border-gray-955 ${cellPaddingClass} font-mono text-gray-700 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                      {colMin}
                                    </td>
                                  )}
                                  {showMaxMarksColumn && (
                                    <td className={`border border-gray-955 ${cellPaddingClass} font-mono text-gray-700 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                      {colMax}
                                    </td>
                                  )}
                                  {showObtainedMarksColumn && (
                                    <td className={`border border-gray-955 ${cellPaddingClass} font-black font-mono text-black ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                      {pureGradeBased ? getGradeFromMark(resolvedVal, colMax) : resolvedVal}
                                    </td>
                                  )}
                                </React.Fragment>
                              );
                            }
                          })}
                          {showT1Total && (
                            subColCount === 1 ? (
                              <td className={`border border-gray-955 ${cellPaddingClass} font-black font-mono text-black bg-gray-100/50 ${tableFontSizeClass} text-center whitespace-nowrap overflow-hidden text-ellipsis`}>
                                {pureGradeBased 
                                  ? getGradeFromMark(subMetrics.t1Sum, subMetrics.t1SubMax)
                                  : (subjectSpecificMaxMarksEnabled ? `${subMetrics.t1Sum}/${subMetrics.t1SubMax}` : subMetrics.t1Sum)}
                              </td>
                            ) : (
                              <React.Fragment key={`add_t1_tot_sub_cells_${sub.id}`}>
                                {showMinMarksColumn && (
                                  <td className={`border border-gray-955 ${cellPaddingClass} font-mono text-gray-700 bg-gray-100/50 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                    {t1Columns.reduce((sum, col) => sum + (col.minMarks !== undefined ? col.minMarks : Math.round((sub.customMaxMarks?.[col.id] ?? col.maxMarks) * 0.33)), 0)}
                                  </td>
                                )}
                                {showMaxMarksColumn && (
                                  <td className={`border border-gray-955 ${cellPaddingClass} font-mono text-gray-700 bg-gray-100/50 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                    {subMetrics.t1SubMax}
                                  </td>
                                )}
                                {showObtainedMarksColumn && (
                                  <td className={`border border-gray-955 ${cellPaddingClass} font-black font-mono text-black bg-gray-100/50 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                    {pureGradeBased ? getGradeFromMark(subMetrics.t1Sum, subMetrics.t1SubMax) : subMetrics.t1Sum}
                                  </td>
                                )}
                              </React.Fragment>
                            )
                          )}
                          {showT1Grade && (
                            <td className={`border border-gray-955 ${cellPaddingClass} font-black font-mono text-black bg-gray-100/50 ${tableFontSizeClass} text-center`}>
                              {getGradeFromMark(subMetrics.t1Sum, subMetrics.t1SubMax)}
                            </td>
                          )}
                        </>
                      )}

                      {/* Term 2 Scores */}
                      {scholT2Enabled && (
                        <>
                          {t2Columns.map(col => {
                            const rawVal = studentGrades.term2?.[col.id];
                            const resolvedVal = (rawVal === undefined || rawVal === null || (rawVal as any) === '') ? 0 : rawVal;
                            const colMax = sub.customMaxMarks?.[col.id] ?? col.maxMarks;
                            const colMin = col.minMarks !== undefined ? col.minMarks : Math.round(colMax * 0.33);

                            if (subColCount === 1) {
                              return (
                                <td key={`add_t2_cell_${sub.id}_${col.id}`} className={`border border-gray-955 ${cellPaddingClass} font-bold font-mono text-black ${tableFontSizeClass} text-center whitespace-nowrap overflow-hidden text-ellipsis`}>
                                  {pureGradeBased 
                                    ? getGradeFromMark(resolvedVal, colMax)
                                    : (subjectSpecificMaxMarksEnabled ? `${resolvedVal}/${colMax}` : resolvedVal)}
                                </td>
                              );
                            } else {
                              return (
                                <React.Fragment key={`add_t2_cell_sub_${sub.id}_${col.id}`}>
                                  {showMinMarksColumn && (
                                    <td className={`border border-gray-955 ${cellPaddingClass} font-mono text-gray-700 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                      {colMin}
                                    </td>
                                  )}
                                  {showMaxMarksColumn && (
                                    <td className={`border border-gray-955 ${cellPaddingClass} font-mono text-gray-700 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                      {colMax}
                                    </td>
                                  )}
                                  {showObtainedMarksColumn && (
                                    <td className={`border border-gray-955 ${cellPaddingClass} font-black font-mono text-black ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                      {pureGradeBased ? getGradeFromMark(resolvedVal, colMax) : resolvedVal}
                                    </td>
                                  )}
                                </React.Fragment>
                              );
                            }
                          })}
                          {showT2Total && (
                            subColCount === 1 ? (
                              <td className={`border border-gray-955 ${cellPaddingClass} font-black font-mono text-black bg-gray-100/50 ${tableFontSizeClass} text-center whitespace-nowrap overflow-hidden text-ellipsis`}>
                                {pureGradeBased 
                                  ? getGradeFromMark(subMetrics.t2Sum, subMetrics.t2SubMax)
                                  : (subjectSpecificMaxMarksEnabled ? `${subMetrics.t2Sum}/${subMetrics.t2SubMax}` : subMetrics.t2Sum)}
                              </td>
                            ) : (
                              <React.Fragment key={`add_t2_tot_sub_cells_${sub.id}`}>
                                {showMinMarksColumn && (
                                  <td className={`border border-gray-955 ${cellPaddingClass} font-mono text-gray-700 bg-gray-100/50 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                    {t2Columns.reduce((sum, col) => sum + (col.minMarks !== undefined ? col.minMarks : Math.round((sub.customMaxMarks?.[col.id] ?? col.maxMarks) * 0.33)), 0)}
                                  </td>
                                )}
                                {showMaxMarksColumn && (
                                  <td className={`border border-gray-955 ${cellPaddingClass} font-mono text-gray-700 bg-gray-100/50 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                    {subMetrics.t2SubMax}
                                  </td>
                                )}
                                {showObtainedMarksColumn && (
                                  <td className={`border border-gray-955 ${cellPaddingClass} font-black font-mono text-black bg-gray-100/50 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                    {pureGradeBased ? getGradeFromMark(subMetrics.t2Sum, subMetrics.t2SubMax) : subMetrics.t2Sum}
                                  </td>
                                )}
                              </React.Fragment>
                            )
                          )}
                          {showT2Grade && (
                            <td className={`border border-gray-955 ${cellPaddingClass} font-black font-mono text-black bg-gray-100/50 ${tableFontSizeClass} text-center`}>
                              {getGradeFromMark(subMetrics.t2Sum, subMetrics.t2SubMax)}
                            </td>
                          )}
                        </>
                      )}

                      {/* Term 3 Scores */}
                      {scholT3Enabled && (
                        <>
                          {t3Columns.map(col => {
                            const rawVal = studentGrades.term3?.[col.id];
                            const resolvedVal = (rawVal === undefined || rawVal === null || (rawVal as any) === '') ? 0 : rawVal;
                            const colMax = sub.customMaxMarks?.[col.id] ?? col.maxMarks;
                            const colMin = col.minMarks !== undefined ? col.minMarks : Math.round(colMax * 0.33);

                            if (subColCount === 1) {
                              return (
                                <td key={`add_t3_cell_${sub.id}_${col.id}`} className={`border border-gray-955 ${cellPaddingClass} font-bold font-mono text-black ${tableFontSizeClass} text-center whitespace-nowrap overflow-hidden text-ellipsis`}>
                                  {pureGradeBased 
                                    ? getGradeFromMark(resolvedVal, colMax)
                                    : (subjectSpecificMaxMarksEnabled ? `${resolvedVal}/${colMax}` : resolvedVal)}
                                </td>
                              );
                            } else {
                              return (
                                <React.Fragment key={`add_t3_cell_sub_${sub.id}_${col.id}`}>
                                  {showMinMarksColumn && (
                                    <td className={`border border-gray-955 ${cellPaddingClass} font-mono text-gray-700 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                      {colMin}
                                    </td>
                                  )}
                                  {showMaxMarksColumn && (
                                    <td className={`border border-gray-955 ${cellPaddingClass} font-mono text-gray-700 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                      {colMax}
                                    </td>
                                  )}
                                  {showObtainedMarksColumn && (
                                    <td className={`border border-gray-955 ${cellPaddingClass} font-black font-mono text-black ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                      {pureGradeBased ? getGradeFromMark(resolvedVal, colMax) : resolvedVal}
                                    </td>
                                  )}
                                </React.Fragment>
                              );
                            }
                          })}
                          {showT3Total && (
                            subColCount === 1 ? (
                              <td className={`border border-gray-955 ${cellPaddingClass} font-black font-mono text-black bg-gray-100/50 ${tableFontSizeClass} text-center whitespace-nowrap overflow-hidden text-ellipsis`}>
                                {pureGradeBased 
                                  ? getGradeFromMark(subMetrics.t3Sum, subMetrics.t3SubMax)
                                  : (subjectSpecificMaxMarksEnabled ? `${subMetrics.t3Sum}/${subMetrics.t3SubMax}` : subMetrics.t3Sum)}
                              </td>
                            ) : (
                              <React.Fragment key={`add_t3_tot_sub_cells_${sub.id}`}>
                                {showMinMarksColumn && (
                                  <td className={`border border-gray-955 ${cellPaddingClass} font-mono text-gray-700 bg-gray-100/50 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                    {t3Columns.reduce((sum, col) => sum + (col.minMarks !== undefined ? col.minMarks : Math.round((sub.customMaxMarks?.[col.id] ?? col.maxMarks) * 0.33)), 0)}
                                  </td>
                                )}
                                {showMaxMarksColumn && (
                                  <td className={`border border-gray-955 ${cellPaddingClass} font-mono text-gray-700 bg-gray-100/50 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                    {subMetrics.t3SubMax}
                                  </td>
                                )}
                                {showObtainedMarksColumn && (
                                  <td className={`border border-gray-955 ${cellPaddingClass} font-black font-mono text-black bg-gray-100/50 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                    {pureGradeBased ? getGradeFromMark(subMetrics.t3Sum, subMetrics.t3SubMax) : subMetrics.t3Sum}
                                  </td>
                                )}
                              </React.Fragment>
                            )
                          )}
                          {showT3Grade && (
                            <td className={`border border-gray-955 ${cellPaddingClass} font-black font-mono text-black bg-gray-100/50 ${tableFontSizeClass} text-center`}>
                              {getGradeFromMark(subMetrics.t3Sum, subMetrics.t3SubMax)}
                            </td>
                          )}
                        </>
                      )}

                      {/* Overall */}
                      {showOverall && overallExtraCols > 0 && (
                        <>
                          {showOverallTotal && (
                            subColCount === 1 ? (
                              <td className={`border border-gray-955 ${cellPaddingClass} font-black font-mono text-black bg-sky-50/20 ${tableFontSizeClass} text-center whitespace-nowrap overflow-hidden text-ellipsis`}>
                                {subjectSpecificMaxMarksEnabled 
                                  ? `${subMetrics.overallRound}/${subMetrics.maxOverallMarksPossible}` 
                                  : subMetrics.overallRound}
                              </td>
                            ) : (
                              <React.Fragment key={`add_ov_tot_sub_cells_${sub.id}`}>
                                {showMinMarksColumn && (
                                  <td className={`border border-gray-955 ${cellPaddingClass} font-mono text-gray-700 bg-sky-50/20 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                    {((scholT1Enabled ? t1Columns : []).concat(scholT2Enabled ? t2Columns : []).concat(scholT3Enabled ? t3Columns : [])).reduce((sum, col) => sum + (col.minMarks !== undefined ? col.minMarks : Math.round((sub.customMaxMarks?.[col.id] ?? col.maxMarks) * 0.33)), 0)}
                                  </td>
                                )}
                                {showMaxMarksColumn && (
                                  <td className={`border border-gray-955 ${cellPaddingClass} font-mono text-gray-700 bg-sky-50/20 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                    {subMetrics.maxOverallMarksPossible}
                                  </td>
                                )}
                                {showObtainedMarksColumn && (
                                  <td className={`border border-gray-955 ${cellPaddingClass} font-black font-mono text-black bg-sky-50/20 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                    {subMetrics.overallRound}
                                  </td>
                                )}
                              </React.Fragment>
                            )
                          )}
                          {showOverallGrade && (
                            <td 
                              className={`border border-gray-955 ${cellPaddingClass} font-black font-mono text-black bg-rose-50/10 ${tableFontSizeClass} text-center`}
                            >
                              {subMetrics.grade}
                            </td>
                          )}
                        </>
                      )}
                    </tr>
                  </React.Fragment>
                );
              });
            })()}
          </tbody>
        </table>
      </div>
    );
  };

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isGeneratingServerPdf, setIsGeneratingServerPdf] = useState(false);

  // Print Optimization Hub States
  const [printScale, setPrintScale] = useState<number>(100);
  const [printCompactSpacing, setPrintCompactSpacing] = useState<boolean>(false);

  // Mobile Adaptive Viewport Scaler States
  const [viewMode, setViewMode] = useState<'fit' | 'actual' | 'custom'>('fit');
  const [customScale, setCustomScale] = useState<number>(100);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [cardMeasuredHeight, setCardMeasuredHeight] = useState<number>(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const containerWidthRef = useRef<number>(0);
  const cardMeasuredHeightRef = useRef<number>(0);

  // Observer to measure available container width and unscaled card height with diff-thresholding
  useEffect(() => {
    const updateDimensions = () => {
      if (viewportRef.current) {
        const rect = viewportRef.current.getBoundingClientRect();
        const newW = Math.floor(rect.width);
        if (newW > 0 && Math.abs(newW - containerWidthRef.current) >= 4) {
          containerWidthRef.current = newW;
          setContainerWidth(newW);
        }
      }
      const innerCard = document.getElementById('report_card_print_ref');
      const measuredH = innerCard ? innerCard.offsetHeight : (cardRef.current ? cardRef.current.offsetHeight : 0);
      if (measuredH > 0 && Math.abs(measuredH - cardMeasuredHeightRef.current) >= 4) {
        cardMeasuredHeightRef.current = measuredH;
        setCardMeasuredHeight(measuredH);
      }
    };

    updateDimensions();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver((entries) => {
        let shouldUpdate = false;
        for (const entry of entries) {
          if (entry.target === viewportRef.current) {
            const newW = Math.floor(entry.contentRect.width);
            if (newW > 0 && Math.abs(newW - containerWidthRef.current) >= 4) {
              shouldUpdate = true;
            }
          } else if (entry.target.id === 'report_card_print_ref') {
            const newH = Math.floor(entry.contentRect.height);
            if (newH > 0 && Math.abs(newH - cardMeasuredHeightRef.current) >= 4) {
              shouldUpdate = true;
            }
          }
        }
        if (shouldUpdate) {
          updateDimensions();
        }
      });

      if (viewportRef.current) ro.observe(viewportRef.current);
      const innerCard = document.getElementById('report_card_print_ref');
      if (innerCard) ro.observe(innerCard);
    }

    window.addEventListener('resize', updateDimensions);
    const timer = setTimeout(updateDimensions, 200);

    return () => {
      ro?.disconnect();
      clearTimeout(timer);
      window.removeEventListener('resize', updateDimensions);
    };
  }, [subjects, scoreColumns, grades, printScale, printCompactSpacing, branding]);

  // Print function
  const triggerPrint = () => {
    window.print();
  };

  // Highly optimized server-side PDF generation request
  const downloadServerSidePdf = async () => {
    setIsGeneratingServerPdf(true);
    try {
      const anyBranding = branding as any;

      // Assemble structured subject performance data
      const payloadSubjects = subjects.map(sub => {
        const metrics = getSubjectMetrics(sub.id);
        return {
          name: sub.name,
          term1: scholT1Enabled ? metrics.t1Sum.toString() : "-",
          term2: scholT2Enabled ? metrics.t2Sum.toString() : "-",
          term3: scholT3Enabled ? metrics.t3Sum.toString() : "-",
          total: metrics.overallRound.toString(),
          percentage: metrics.maxOverallMarksPossible > 0 ? `${((metrics.overall / metrics.maxOverallMarksPossible) * 100).toFixed(1)}%` : "-",
          grade: metrics.grade || "-"
        };
      });

      // Get appropriate signatures from signature items array or branding fallbacks
      const sigsToRender = (signatures && signatures.length > 0)
        ? signatures
        : [
            { id: 'parent', label: anyBranding.signParentName || "Parent's Signature" },
            { id: 'incharge', label: anyBranding.signInchargeName || "Class Incharge Signature" },
            { id: 'principal', label: anyBranding.signPrincipalName || "Principal Signature" }
          ];
      
      const teacherSig = sigsToRender.find(s => s.id === 'incharge' || s.id === 'teacher' || s.id === 'class_teacher')?.label || anyBranding.signInchargeName || "Class Teacher Signature";
      const principalSig = sigsToRender.find(s => s.id === 'principal')?.label || "Principal Signature";

      // Construct payload conforming to the full designed server schema
      const payload = {
        branding: branding,
        student: student,
        grades: grades,
        fieldsToRender: fieldsToRender,
        subjects: subjects,
        scoreColumns: scoreColumns,
        termSpecificScoreColumnsEnabled: isTermSpecific,
        term1ScoreColumns: t1Columns,
        term2ScoreColumns: t2Columns,
        term3ScoreColumns: t3Columns,
        gradeScales: gradeScales,
        coGradeScales: coGradeScales,
        scholasticTerm1Disabled: scholasticTerm1Disabled,
        scholasticTerm2Disabled: scholasticTerm2Disabled,
        scholasticTerm3Disabled: scholasticTerm3Disabled,
        coScholasticOneColumn: coScholasticOneColumn,
        coScholasticSections: coScholasticSections,
        signatures: signatures,
        hideGradingScale: hideGradingScale,
        hideAttendance: hideAttendance,
        pureGradeBased: pureGradeBased,
        gradingScaleAfterSignatures: gradingScaleAfterSignatures,
        gradingScaleLayout: gradingScaleLayout,
        verticalExamHeaders: verticalExamHeaders,
        verticalSubjectsHeader: verticalSubjectsHeader,
        subjectSpecificMaxMarksEnabled: subjectSpecificMaxMarksEnabled,
        termLabel: anyBranding.termHeaderLabel || `${term1Label} & ${term2Label} Academic Report`,
        overall: {
          totalMarks: Math.round(totalOverallMarks).toString(),
          maxMarks: totalMaxMarksPossible.toString(),
          percentage: `${averagePercentage.toFixed(2)}%`,
          grade: averageGrade,
          attendance: (grades.attendance?.term1 && typeof grades.attendance?.term1 === 'object' ? String((grades.attendance?.term1 as any)?.term1 || '') : String(grades.attendance?.term1 || '')) || "Present",
          remarks: student.remarks || "The student has demonstrated magnificent educational and sportsmanship levels throughout the calendar sessions."
        },
        signatories: {
          teacher: teacherSig,
          principal: principalSig
        }
      };

      const response = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || "Server-side engine returned an error generating the PDF document.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(student.name || "student").replace(/[^a-zA-Z0-9]/g, "_")}_Official_Report_Card.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Server PDF generation failed:", err);
      alert("Server-side PDF compile error: " + err.message);
    } finally {
      setIsGeneratingServerPdf(false);
    }
  };

  // Dedicated high-quality PDF exporter using html2canvas and jsPDF
  const downloadReportCardPdf = async () => {
    const element = document.getElementById('report_card_print_ref');
    if (!element) {
      alert("Error: Print preview card element not found.");
      return;
    }

    setIsGeneratingPdf(true);

    // Highly precise OKLCH-to-RGB compiler to prevent html2canvas styles parsing crashes
    const oklchToRgb = (lStr: string, cStr: string, hStr: string, aStr?: string): string => {
      try {
        let L = parseFloat(lStr);
        if (lStr.includes('%')) L /= 100;
        
        let C = parseFloat(cStr);
        if (cStr.includes('%')) C /= 100;
        
        let h = parseFloat(hStr);
        let hRad = (h * Math.PI) / 180;
        if (hStr.includes('rad')) {
          hRad = parseFloat(hStr);
        } else if (hStr.includes('turn')) {
          hRad = parseFloat(hStr) * 2 * Math.PI;
        }
        
        let alpha = aStr ? parseFloat(aStr) : 1;
        if (aStr && aStr.includes('%')) alpha = parseFloat(aStr) / 100;

        const aComp = C * Math.cos(hRad);
        const bComp = C * Math.sin(hRad);

        const l_ = L + 0.3963377774 * aComp + 0.2158037573 * bComp;
        const m_ = L - 0.1055613458 * aComp - 0.0540383286 * bComp;
        const s_ = L - 0.0894841775 * aComp - 1.2914855480 * bComp;

        const lLinear = Math.pow(Math.max(0, l_), 3);
        const mLinear = Math.pow(Math.max(0, m_), 3);
        const sLinear = Math.pow(Math.max(0, s_), 3);

        let rLinear = +4.0767416621 * lLinear - 3.3077115913 * mLinear + 0.2309699292 * sLinear;
        let gLinear = -1.2684380046 * lLinear + 2.6097574011 * mLinear - 0.3413193965 * sLinear;
        let bLinear = -0.0041960863 * lLinear - 0.7034186147 * mLinear + 1.7076147010 * sLinear;

        const gamma = (c: number) => {
          if (c <= 0.0031308) return 12.92 * c;
          return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
        };

        const R = Math.min(255, Math.max(0, Math.round(gamma(rLinear) * 255)));
        const G = Math.min(255, Math.max(0, Math.round(gamma(gLinear) * 255)));
        const B = Math.min(255, Math.max(0, Math.round(gamma(bLinear) * 255)));

        return alpha === 1 ? `rgb(${R}, ${G}, ${B})` : `rgba(${R}, ${G}, ${B}, ${alpha})`;
      } catch (e) {
        return 'rgb(120, 120, 120)';
      }
    };

    // Highly precise OKLAB-to-RGB compiler to prevent html2canvas styles parsing crashes
    const oklabToRgb = (lStr: string, aStr: string, bStr: string, alphaStr?: string): string => {
      try {
        let L = parseFloat(lStr);
        if (lStr.includes('%')) L /= 100;
        
        let aComp = parseFloat(aStr);
        if (aStr.includes('%')) aComp /= 100;
        
        let bComp = parseFloat(bStr);
        if (bStr.includes('%')) bComp /= 100;
        
        let alpha = alphaStr ? parseFloat(alphaStr) : 1;
        if (alphaStr && alphaStr.includes('%')) alpha = parseFloat(alphaStr) / 100;

        const l_ = L + 0.3963377774 * aComp + 0.2158037573 * bComp;
        const m_ = L - 0.1055613458 * aComp - 0.0540383286 * bComp;
        const s_ = L - 0.0894841775 * aComp - 1.2914855480 * bComp;

        const lLinear = Math.pow(Math.max(0, l_), 3);
        const mLinear = Math.pow(Math.max(0, m_), 3);
        const sLinear = Math.pow(Math.max(0, s_), 3);

        let rLinear = +4.0767416621 * lLinear - 3.3077115913 * mLinear + 0.2309699292 * sLinear;
        let gLinear = -1.2684380046 * lLinear + 2.6097574011 * mLinear - 0.3413193965 * sLinear;
        let bLinear = -0.0041960863 * lLinear - 0.7034186147 * mLinear + 1.7076147010 * sLinear;

        const gamma = (c: number) => {
          if (c <= 0.0031308) return 12.92 * c;
          return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
        };

        const R = Math.min(255, Math.max(0, Math.round(gamma(rLinear) * 255)));
        const G = Math.min(255, Math.max(0, Math.round(gamma(gLinear) * 255)));
        const B = Math.min(255, Math.max(0, Math.round(gamma(bLinear) * 255)));

        return alpha === 1 ? `rgb(${R}, ${G}, ${B})` : `rgba(${R}, ${G}, ${B}, ${alpha})`;
      } catch (e) {
        return 'rgb(120, 120, 120)';
      }
    };

    // Deep parenthesis balancer to reliably extract and replace oklch/oklab even with variables
    const cleanOklchAndOklab = (cssText: string): string => {
      if (!cssText) return '';
      let result = '';
      let index = 0;
      const lowerCssText = cssText.toLowerCase();
      
      while (index < cssText.length) {
        const nextOklch = lowerCssText.indexOf('oklch(', index);
        const nextOklab = lowerCssText.indexOf('oklab(', index);
        
        let startIdx = -1;
        let isOklch = false;
        if (nextOklch !== -1 && (nextOklab === -1 || nextOklch < nextOklab)) {
          startIdx = nextOklch;
          isOklch = true;
        } else if (nextOklab !== -1) {
          startIdx = nextOklab;
        }
        
        if (startIdx === -1) {
          result += cssText.substring(index);
          break;
        }
        
        result += cssText.substring(index, startIdx);
        
        const funcHeaderLen = 6; // Both 'oklch(' and 'oklab(' are 6 characters long
        let parenCount = 1;
        let currentPos = startIdx + funcHeaderLen;
        while (currentPos < cssText.length && parenCount > 0) {
          const char = cssText[currentPos];
          if (char === '(') {
            parenCount++;
          } else if (char === ')') {
            parenCount--;
          }
          currentPos++;
        }
        
        const matchedExpr = cssText.substring(startIdx, currentPos);
        let replacement = 'rgb(100, 100, 100)';
        try {
          const content = matchedExpr.substring(funcHeaderLen, matchedExpr.length - 1).trim();
          
          if (!content.includes('var(')) {
            const parts = content.replace(/[\/,]/g, ' ').split(/\s+/).filter(Boolean);
            if (parts.length >= 3) {
              if (isOklch) {
                replacement = oklchToRgb(parts[0], parts[1], parts[2], parts[3]);
              } else {
                replacement = oklabToRgb(parts[0], parts[1], parts[2], parts[3]);
              }
            }
          } else {
            const firstWord = content.split(/[\s,]+/)[0];
            const val = parseFloat(firstWord);
            if (!isNaN(val)) {
              if (firstWord.includes('%') ? val > 80 : val > 0.8) {
                replacement = 'rgb(245, 245, 250)';
              } else if (firstWord.includes('%') ? val < 30 : val < 0.3) {
                replacement = 'rgb(15, 23, 42)';
              } else {
                replacement = 'rgb(79, 70, 229)';
              }
            } else {
              replacement = 'rgb(100, 116, 139)';
            }
          }
        } catch (e) {
          // ignore error
        }
        
        result += replacement;
        index = currentPos;
      }
      
      return result;
    };

    const styleBackups: { element: HTMLStyleElement; originalText: string }[] = [];
    const disabledLinks: HTMLLinkElement[] = [];
    const createdStyles: HTMLStyleElement[] = [];
    const originalGetComputedStyle = window.getComputedStyle;

    // Original prototype property descriptors for deep interception
    const originalCSSRuleCssText = Object.getOwnPropertyDescriptor(CSSRule.prototype, 'cssText');
    const originalCSSStyleDecCssText = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, 'cssText');
    const originalGetPropertyValue = CSSStyleDeclaration.prototype.getPropertyValue;

    try {
      // 1. Intercept CSSRule.prototype.cssText
      if (originalCSSRuleCssText && originalCSSRuleCssText.get) {
        const origGet = originalCSSRuleCssText.get;
        Object.defineProperty(CSSRule.prototype, 'cssText', {
          get: function(this: any) {
            const val = origGet.call(this);
            if (typeof val === 'string' && (val.toLowerCase().includes('oklch') || val.toLowerCase().includes('oklab'))) {
              return cleanOklchAndOklab(val);
            }
            return val;
          },
          configurable: true
        });
      }

      // 2. Intercept CSSStyleDeclaration.prototype.cssText
      if (originalCSSStyleDecCssText && originalCSSStyleDecCssText.get) {
        const origGet = originalCSSStyleDecCssText.get;
        Object.defineProperty(CSSStyleDeclaration.prototype, 'cssText', {
          get: function(this: any) {
            const val = origGet.call(this);
            if (typeof val === 'string' && (val.toLowerCase().includes('oklch') || val.toLowerCase().includes('oklab'))) {
              return cleanOklchAndOklab(val);
            }
            return val;
          },
          configurable: true
        });
      }

      // 3. Intercept CSSStyleDeclaration.prototype.getPropertyValue
      CSSStyleDeclaration.prototype.getPropertyValue = function(this: any, propertyName: string) {
        const val = originalGetPropertyValue.call(this, propertyName);
        if (typeof val === 'string' && (val.toLowerCase().includes('oklch') || val.toLowerCase().includes('oklab'))) {
          return cleanOklchAndOklab(val);
        }
        return val;
      };

      // 4. Temporarily override window.getComputedStyle to transpile any resolved oklch/oklab styles on the fly
      window.getComputedStyle = function (elt, pseudoElt) {
        const style = originalGetComputedStyle(elt, pseudoElt);
        return new Proxy(style, {
          get(target, prop, receiver) {
            if (prop === 'getPropertyValue') {
              return function (this: any, propertyName: string) {
                const val = originalGetPropertyValue.call(target, propertyName);
                if (typeof val === 'string' && (val.toLowerCase().includes('oklch') || val.toLowerCase().includes('oklab'))) {
                  return cleanOklchAndOklab(val);
                }
                return val;
              };
            }
            const val = Reflect.get(target, prop, receiver);
            if (typeof val === 'string' && (val.toLowerCase().includes('oklch') || val.toLowerCase().includes('oklab'))) {
              return cleanOklchAndOklab(val);
            }
            if (typeof val === 'function') {
              return val.bind(target);
            }
            return val;
          }
        });
      };

      // Find all style elements with potential OKLCH / OKLAB formulas and compile them down to RGB
      const styleElements = Array.from(document.querySelectorAll('style'));
      styleElements.forEach((styleEl) => {
        try {
          let cssText = '';
          const sheet = styleEl.sheet;
          if (sheet && sheet.cssRules) {
            const rules = Array.from(sheet.cssRules);
            for (const rule of rules) {
              cssText += rule.cssText + '\n';
            }
          }
          if (!cssText) {
            cssText = styleEl.textContent || '';
          }

          if (cssText.includes('oklch') || cssText.includes('oklab')) {
            styleBackups.push({ element: styleEl, originalText: styleEl.textContent || '' });
            styleEl.textContent = cleanOklchAndOklab(cssText);
          }
        } catch (e) {
          const textContent = styleEl.textContent || '';
          if (textContent.includes('oklch') || textContent.includes('oklab')) {
            styleBackups.push({ element: styleEl, originalText: textContent });
            styleEl.textContent = cleanOklchAndOklab(textContent);
          }
        }
      });

      // Find and preprocess any external stylesheet links
      const linkElements = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
      for (const linkEl of linkElements) {
        try {
          const href = linkEl.href;
          // Only fetch stylesheets from the same origin to avoid cross-origin CORS errors or abort errors
          const isSameOrigin = href && (href.startsWith(window.location.origin) || !href.startsWith('http'));
          if (isSameOrigin) {
            const resp = await fetch(href);
            if (resp.ok) {
              const cssText = await resp.text();
              if (cssText.includes('oklch') || cssText.includes('oklab')) {
                // Disable original link tag
                linkEl.disabled = true;
                disabledLinks.push(linkEl);

                // Create a temporary override style tag with RGB compiles
                const cleanStyle = document.createElement('style');
                cleanStyle.id = 'temp-clean-override-style';
                cleanStyle.textContent = cleanOklchAndOklab(cssText);
                document.head.appendChild(cleanStyle);
                createdStyles.push(cleanStyle);
              }
            }
          }
        } catch (e) {
          console.warn("Could not fetch or override link stylesheet:", linkEl.href, e);
        }
      }

      // Temporarily clear any active mobile viewport scaler transform for pristine capture
      const scalerEl = element.closest('.mobile-adaptive-viewport-scaler') as HTMLElement | null;
      let origScalerTransform = '';
      let origScalerMargin = '';
      if (scalerEl) {
        origScalerTransform = scalerEl.style.transform;
        origScalerMargin = scalerEl.style.marginBottom;
        scalerEl.style.transform = 'none';
        scalerEl.style.marginBottom = '0';
      }

      // Force scroll offset resets for pixel-perfect capturing
      const originalScrollY = window.scrollY;
      window.scrollTo(0, 0);

      const canvas = await html2canvas(element, {
        scale: 2, // 2x device pixel ratio for super high DPI vectors and sharp text
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc) => {
          const clonedScaler = clonedDoc.querySelector('.mobile-adaptive-viewport-scaler') as HTMLElement | null;
          if (clonedScaler) {
            clonedScaler.style.transform = 'none';
            clonedScaler.style.marginBottom = '0';
          }
          const clonedCard = clonedDoc.getElementById('report_card_print_ref');
          if (clonedCard) {
            clonedCard.style.transform = 'none';
          }
        }
      });

      // Restore scaler styling if present
      if (scalerEl) {
        scalerEl.style.transform = origScalerTransform;
        scalerEl.style.marginBottom = origScalerMargin;
      }

      // Restore prototype properties immediately after capture
      window.getComputedStyle = originalGetComputedStyle;
      CSSStyleDeclaration.prototype.getPropertyValue = originalGetPropertyValue;
      if (originalCSSRuleCssText) {
        Object.defineProperty(CSSRule.prototype, 'cssText', originalCSSRuleCssText);
      }
      if (originalCSSStyleDecCssText) {
        Object.defineProperty(CSSStyleDeclaration.prototype, 'cssText', originalCSSStyleDecCssText);
      }

      // Restore scroll position
      window.scrollTo(0, originalScrollY);

      // Restore all original style tag contents and link tags immediately
      styleBackups.forEach((b) => {
        b.element.textContent = b.originalText;
      });
      disabledLinks.forEach((l) => {
        l.disabled = false;
      });
      createdStyles.forEach((s) => {
        s.parentNode?.removeChild(s);
      });

      const imgData = canvas.toDataURL('image/png');
      
      const isCardLandscape = branding.printOrientation === 'landscape';
      const pageWidth = isCardLandscape ? 297 : 210; // A4 standard width in mm
      const pageHeight = isCardLandscape ? 210 : 297; // A4 standard height in mm
      const margin = 8; // 8mm safe margin from all sides to guarantee no borders/lines get clipped
      const maxContentWidth = pageWidth - (margin * 2);
      const maxContentHeight = pageHeight - (margin * 2);

      let renderWidth = maxContentWidth;
      let renderHeight = (canvas.height * renderWidth) / canvas.width;

      if (renderHeight > maxContentHeight) {
        renderHeight = maxContentHeight;
        renderWidth = (canvas.width * renderHeight) / canvas.height;
      }

      // Center the card on the page within the safe margins
      const posX = margin + (maxContentWidth - renderWidth) / 2;
      const posY = margin + (maxContentHeight - renderHeight) / 2;

      const pdf = new jsPDF({
        orientation: isCardLandscape ? 'l' : 'p',
        unit: 'mm',
        format: 'a4'
      });

      pdf.addImage(imgData, 'PNG', posX, posY, renderWidth, renderHeight, undefined, 'FAST');

      const rawName = student.name ? student.name.trim() : "Student";
      const filename = `${rawName.replace(/[^a-zA-Z0-9]/g, '_')}_Report_Card_${student.className || ''}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error("PDF download failure:", err);
      alert("Could not generate direct PDF file. Please use 'Print / Save PDF' instead.");
    } finally {
      // Safety second cleanup rule
      window.getComputedStyle = originalGetComputedStyle;
      CSSStyleDeclaration.prototype.getPropertyValue = originalGetPropertyValue;
      if (originalCSSRuleCssText) {
        Object.defineProperty(CSSRule.prototype, 'cssText', originalCSSRuleCssText);
      }
      if (originalCSSStyleDecCssText) {
        Object.defineProperty(CSSStyleDeclaration.prototype, 'cssText', originalCSSStyleDecCssText);
      }
      styleBackups.forEach((b) => {
        b.element.textContent = b.originalText;
      });
      disabledLinks.forEach((l) => {
        l.disabled = false;
      });
      createdStyles.forEach((s) => {
        s.parentNode?.removeChild(s);
      });
      setIsGeneratingPdf(false);
    }
  };

  // Dynamically scale fonts, paddings, and panel gaps on print based on row counts to guarantee single-page fitting
  const scholCountPrint = subjects.filter(s => s.type === 'scholastic').length;
  const coScholasticCount = subjects.filter(s => s.type === 'co_scholastic').length;
  const activityCount = subjects.filter(s => s.type === 'activity').length;

  // Calculate the vertical "density slots" or complexity score
  let verticalSlots = 5.5; // Base school header, title, and outer borders

  verticalSlots += 3.5; // Student profile row height

  if (scholCountPrint > 0) {
    verticalSlots += 2.0; // Scholastic table header + total rows
    verticalSlots += scholCountPrint;
  }

  const coScholasticRows = coScholasticOneColumn 
    ? (coScholasticCount + activityCount) 
    : Math.max(coScholasticCount, activityCount);

  if (coScholasticRows > 0) {
    verticalSlots += 1.5; // Co-scholastic header row
    verticalSlots += coScholasticRows;
    if (activeTermsCount > 1) {
      verticalSlots += 1.0; // Scholastic term-wise total row appended under Co-scholastic table
    }
  }

  if (!hideAttendance || student.remarks || student.promotionStatus) {
    verticalSlots += 2.5; // Attendance, remarks, and promotion statement block
  }

  if (!hideGradingScale) {
    verticalSlots += 2.5; // Grading scale table block
  }

  verticalSlots += 2.0; // Signature columns block

  // If landscape orientation, printable height is 198mm vs 284mm for portrait (ratio ~1.43).
  // Thus we must scale down layout metrics significantly more on landscape to keep it on a single page!
  const isLandscape = branding.printOrientation === 'landscape';
  const orientationFactor = isLandscape ? 1.45 : 1.0;
  const totalComplexity = verticalSlots * orientationFactor;

  // Calculate a continuous scaling factor S based on the total complexity.
  // Standard card (complexity ~26) has S = 1.0.
  // Very simple cards (complexity <= 18) scale up to S = 1.25.
  // Highly dense or landscape cards scale down continuously, as low as S = 0.55 if needed!
  let S = 1.0;
  if (totalComplexity <= 18) {
    S = 1.25;
  } else if (totalComplexity >= 48) {
    S = 0.55;
  } else {
    // Linear interpolation between (18, 1.25) and (48, 0.55)
    const ratio = (totalComplexity - 18) / (48 - 18);
    S = 1.25 - ratio * (1.25 - 0.55);
  }

  // Apply the interactive manual scale percentage (e.g. 100% means 1.0x of auto-computed S)
  S = S * (printScale / 100);

  // Apply extra compact spacing scaling
  if (printCompactSpacing) {
    S = S * 0.90;
  }

  // If stacked grading scale layout is enabled and visible, scale S down even further (by 15%)
  // to ensure all elements fit beautifully on a single page during printing.
  if (gradingScaleLayout === 'stacked' && !hideGradingScale) {
    S = S * 0.85;
  }

  // Estimate height budget percentage dynamically.
  // Calibrated based on orientation complexity comfort thresholds.
  const baseComfortableComplexity = isLandscape ? 22 : 32;
  const estimatedPagePercent = Math.min(130, Math.round(((totalComplexity * S) / baseComfortableComplexity) * 100));

  // Derive all print metrics continuously from S
  const printFont = `${(S * 9.5).toFixed(2)}px`;
  const printHeaderFont = `${(S * 10.2).toFixed(2)}px`;
  const printPaddingY = `${(S * 3.5).toFixed(2)}px`;
  const printPaddingX = `${(S * 6.0).toFixed(2)}px`;
  const printSpacing = `${(S * 8.0).toFixed(2)}px`;
  
  const padTop = Math.round(12 * S);
  const padRight = Math.round(16 * S);
  const padBottom = Math.round(16 * S); // Slightly reduced bottom padding from 20 to 16
  const padLeft = Math.round(16 * S);
  const printBlockPadding = `${padTop}px ${padRight}px ${padBottom}px ${padLeft}px`;

  const printSigHeight = `${Math.round(S * 38)}px`; // Reduced signature height from 45 to 38 for tight spacing
  const selectedLogoSize = branding.logoSize !== undefined ? branding.logoSize : 92;
  const schoolLogoSize = `${Math.round(S * selectedLogoSize)}px`;
  const studentPhotoHeight = `${Math.round(S * 115)}px`;
  const studentPhotoWidth = `${Math.round(S * 98)}px`;

  // Mobile Adaptive Viewport Scale Calculations
  const baseCardWidth = isLandscape ? 1050 : 820;
  const isMobileConstrained = containerWidth > 0 && containerWidth < (baseCardWidth + 10);
  const availableWidth = containerWidth > 0 ? containerWidth - 4 : 0;
  const calculatedFitScale = isMobileConstrained
    ? Math.min(1, Math.max(0.22, (availableWidth > 0 ? availableWidth : 360) / baseCardWidth))
    : 1;

  let effectiveScale = 1;
  if (isMobileConstrained) {
    if (viewMode === 'fit') {
      effectiveScale = calculatedFitScale;
    } else if (viewMode === 'actual') {
      effectiveScale = 1;
    } else if (viewMode === 'custom') {
      effectiveScale = Math.max(0.25, Math.min(1.5, customScale / 100));
    }
  }

  return (
    <div className="space-y-4 w-full max-w-full">
      {/* Integrated Print Control Center */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-md no-print overflow-hidden">
        {/* Header Bar */}
        <div className="bg-slate-900 text-white px-4 py-3.5 flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-2.5">
            <span className="bg-slate-800 p-2 rounded-lg border border-slate-700">
              <Printer className="w-4 h-4 text-emerald-400" />
            </span>
            <div>
              <h4 className="font-extrabold text-xs tracking-wider uppercase text-white">Print Setup Hub</h4>
              <p className="text-[10px] text-slate-300 font-sans">Pixel-perfect document layout with live fitting diagnostics.</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              onClick={downloadReportCardPdf}
              disabled={isGeneratingPdf}
              id="preview_pdf_download_btn"
              className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-indigo-400 font-black text-xs text-white px-4 py-2.5 rounded-lg shadow-md transition-all cursor-pointer flex-1 sm:flex-none"
              title="Download print-ready A4 PDF with guaranteed 8mm safe margins"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              {isGeneratingPdf ? "Generating PDF..." : "Download PDF"}
            </button>

            <button
              onClick={triggerPrint}
              id="preview_print_btn"
              className="flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 font-black text-xs text-slate-950 px-5 py-2.5 rounded-lg shadow-lg transition-all cursor-pointer flex-1 sm:flex-none"
            >
              <Printer className="w-4 h-4 stroke-[2.5]" /> Print Report Card
            </button>
          </div>
        </div>

        {/* Diagnostic and Scale Control Panel */}
        <div className="p-4 bg-slate-50/70 border-t border-gray-100 grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Controls - 7 cols */}
          <div className="md:col-span-7 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Scale slider */}
              <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-2xs space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-bold text-gray-700 block">Print Font & Spacing Scale</label>
                  <span className="text-[10px] font-mono font-black text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                    {printScale}%
                  </span>
                </div>
                <input
                  type="range"
                  min="70"
                  max="120"
                  step="2"
                  value={printScale}
                  onChange={(e) => setPrintScale(Number(e.target.value))}
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex justify-between text-[8.5px] text-gray-400 font-mono">
                  <span>70% (Ultra-Compact)</span>
                  <button onClick={() => setPrintScale(100)} className="hover:text-emerald-600 font-bold underline">Reset (100%)</button>
                  <span>120% (Roomy)</span>
                </div>
              </div>

              {/* Spacing compact toggle */}
              <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-2xs flex flex-col justify-between">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="compact_spacing_toggle"
                    checked={printCompactSpacing}
                    onChange={(e) => setPrintCompactSpacing(e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded cursor-pointer"
                  />
                  <div>
                    <label htmlFor="compact_spacing_toggle" className="text-[11px] font-bold text-gray-700 cursor-pointer block">Extra Compact Tables</label>
                    <p className="text-[9px] text-gray-500">Shrinks table rows by an extra 10% to fit extremely long lists.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Height Diagnostic Meter */}
            <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-2xs space-y-1.5">
              <div className="flex justify-between items-center text-[10px]">
                <span className="font-bold text-gray-700">Estimated Page Height Budget:</span>
                <span className={`font-black uppercase px-2 py-0.5 rounded text-[9px] ${
                  estimatedPagePercent > 100 
                    ? "bg-red-100 text-red-700" 
                    : estimatedPagePercent >= 90 
                    ? "bg-amber-100 text-amber-700" 
                    : "bg-emerald-100 text-emerald-700"
                }`}>
                  {estimatedPagePercent}% {estimatedPagePercent > 100 ? "Overflow Risk" : estimatedPagePercent >= 90 ? "Tight Fit" : "Perfect Fit"}
                </span>
              </div>
              
              {/* Progress bar container */}
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-2 transition-all duration-300 ${
                    estimatedPagePercent > 100 
                      ? "bg-red-500" 
                      : estimatedPagePercent >= 90 
                      ? "bg-amber-500" 
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${estimatedPagePercent}%` }}
                ></div>
              </div>

              <p className="text-[9.5px] text-gray-500 leading-normal">
                {estimatedPagePercent > 100 ? (
                  <span className="text-red-600 font-medium">⚠️ Warning: The card content is too long for a single page. Try setting the Font & Spacing Scale to 90% or enabling "Extra Compact Tables" to ensure it fits perfectly.</span>
                ) : estimatedPagePercent >= 90 ? (
                  <span className="text-amber-600 font-medium">💡 Layout is dense. If it splits onto a second page, slightly reduce the scale to 95% for safety.</span>
                ) : (
                  <span className="text-emerald-600 font-medium">✨ Layout is optimal! This card will easily print on a single page with your active configurations.</span>
                )}
              </p>
            </div>
          </div>

          {/* Guidelines Checklist - 5 cols */}
          <div className="md:col-span-5 bg-slate-900 text-slate-100 p-3.5 rounded-lg flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-2.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">Worry-Free Print Recommendations</span>
              </div>

              <div className="space-y-2 text-[9.5px] font-sans text-slate-300 leading-relaxed">
                <p>
                  <strong className="text-emerald-400">1. Target Print Scale:</strong> Use the scale control slider to manually compress elements for dense student lists.
                </p>
                <p>
                  <strong className="text-emerald-400">2. Match Orientation:</strong> Set your printer settings to <strong className="text-white">{isLandscape ? "Landscape" : "Portrait"}</strong> to match this template.
                </p>
                <p>
                  <strong className="text-amber-400">3. Enable Backgrounds:</strong> Ensure <strong className="text-white">"Background Graphics"</strong> is selected in the printer preferences to print school themes and watermarks.
                </p>
                <p>
                  <strong className="text-emerald-400">4. Safe Margins:</strong> In printer preferences, set Margins to <strong className="text-white">Default</strong> or <strong className="text-white">Minimum</strong> (standard 8mm safe margin protects all border lines). Deselect <strong className="text-white">"Headers & Footers"</strong>.
                </p>
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-800 flex justify-between items-center text-[9px] text-slate-400 font-mono">
              <span>Paper size: A4 / Letter</span>
              <span>v2.2 Spacing Assist</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Adaptive Viewport Control Bar */}
      {isMobileConstrained && (
        <div className="no-print w-full bg-slate-900 text-white rounded-xl px-3 py-2 shadow-md flex flex-wrap items-center justify-between gap-2 border border-slate-700 select-none animate-fadeIn text-xs">
          <div className="flex items-center gap-2">
            <span className="bg-indigo-600/30 text-indigo-300 p-1.5 rounded-lg border border-indigo-500/30">
              <Smartphone className="w-3.5 h-3.5" />
            </span>
            <div className="leading-tight">
              <div className="font-bold flex items-center gap-1.5">
                <span>Mobile Fit</span>
                <span className="bg-slate-800 text-slate-300 text-[10px] px-1.5 py-0.5 rounded font-mono font-bold">
                  {Math.round(effectiveScale * 100)}%
                </span>
              </div>
              {isLandscape && (
                <p className="text-[10px] text-amber-300 flex items-center gap-1">
                  <RotateCw className="w-3 h-3" /> Rotate for landscape
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            {/* Fit to Screen Button */}
            <button
              type="button"
              onClick={() => setViewMode('fit')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'fit'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
              title="Fit full report card to screen"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Fit Screen</span>
            </button>

            {/* 100% Actual Size Button */}
            <button
              type="button"
              onClick={() => {
                setViewMode('actual');
                setCustomScale(100);
              }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'actual'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
              title="View at 100% actual size"
            >
              <span>100%</span>
            </button>

            {/* Zoom Out */}
            <button
              type="button"
              onClick={() => {
                setViewMode('custom');
                const currentPct = Math.round(effectiveScale * 100);
                const newPct = Math.max(30, currentPct - 15);
                setCustomScale(newPct);
              }}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            {/* Zoom In */}
            <button
              type="button"
              onClick={() => {
                setViewMode('custom');
                const currentPct = Math.round(effectiveScale * 100);
                const newPct = Math.min(150, currentPct + 15);
                setCustomScale(newPct);
              }}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-all cursor-pointer"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile Adaptive Scaler Outer Viewport */}
      <div 
        ref={viewportRef}
        className={`w-full flex justify-center mobile-adaptive-viewport-container ${
          isMobileConstrained && effectiveScale < 1 && viewMode === 'fit' 
            ? 'overflow-hidden' 
            : 'overflow-x-auto scrollbar-thin'
        }`}
        style={{
          height: (isMobileConstrained && effectiveScale < 1 && cardMeasuredHeight > 0)
            ? `${Math.ceil(cardMeasuredHeight * effectiveScale)}px`
            : undefined
        }}
      >
        <div
          ref={cardRef}
          className="mobile-adaptive-viewport-scaler shrink-0"
          style={{
            transform: (isMobileConstrained && effectiveScale !== 1) ? `scale(${effectiveScale})` : undefined,
            transformOrigin: 'top center',
            width: `${baseCardWidth}px`,
            minWidth: `${baseCardWidth}px`,
            maxWidth: `${baseCardWidth}px`
          }}
        >
          {/* Main Vector Card Border Box */}
          <div 
            id="report_card_print_ref"
            style={{ 
              '--theme-brand': branding.themeColor, 
              '--theme-border': branding.borderColor || branding.themeColor,
              '--print-spacing': printSpacing,
              '--print-padding-y': printPaddingY,
              '--print-padding-x': printPaddingX,
              '--print-font': printFont,
              '--print-header-font': printHeaderFont,
              '--print-border-padding': printBlockPadding,
              '--print-sig-height': printSigHeight,
              '--print-logo-size': schoolLogoSize,
              '--print-photo-height': studentPhotoHeight,
              '--print-photo-width': studentPhotoWidth,
              '--print-school-name-font-size': branding.schoolNameFontSize ? `${branding.schoolNameFontSize}px` : undefined,
              '--print-school-name-font-family': branding.schoolNameFontFamily || undefined,
              '--print-header-details-font-size': branding.headerDetailsFontSize ? `${branding.headerDetailsFontSize}px` : undefined,
              '--print-header-details-font-family': branding.headerDetailsFontFamily || undefined,
              '--print-helpline-font-size': branding.headerDetailsFontSize ? `${Math.max(8, (branding.headerDetailsFontSize || 10.5) - 1.5)}px` : undefined,
              '--print-report-title-font-size': branding.reportCardTitleFontSize ? `${branding.reportCardTitleFontSize}px` : undefined,
            } as React.CSSProperties}
            className={`bg-white border p-1 sm:p-2 border-gray-200 rounded-2xl shadow-sm w-full mx-auto overflow-hidden relative print:border-none print:shadow-none print:p-0 ${
              branding.printOrientation === 'landscape' ? 'print-landscape-card' : 'print-portrait-card'
            }`}
          >
        <div className="border-[4px] border-double rounded-xl p-4 sm:p-6 space-y-5 bg-white relative overflow-hidden print:p-3 print:space-y-3" style={{ borderColor: 'var(--theme-border)' }}>
          
          {/* Super soft Watermark overlay behind rows */}
          {branding.showWatermark && (
            <div className={`absolute inset-0 select-none pointer-events-none overflow-hidden z-0 ${
              branding.watermarkLayout === 'full_page' && branding.watermarkType === 'logo'
                ? 'w-full h-full' 
                : 'flex items-center justify-center'
            }`}>
              {branding.watermarkType === 'logo' ? (
                (branding.watermarkLogoUrl || branding.logoUrl) ? (
                  <img
                    src={normalizeExternalImageUrl(branding.watermarkLogoUrl || branding.logoUrl)}
                    alt="Watermark Stamp"
                    className={`select-none pointer-events-none ${
                      branding.watermarkLayout === 'full_page'
                        ? 'w-full h-full'
                        : 'object-contain max-w-full'
                    }`}
                    style={
                      branding.watermarkLayout === 'full_page'
                        ? {
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: (branding.watermarkFit || 'fill') as any,
                            opacity: branding.watermarkOpacity ?? 0.08
                          }
                        : { 
                            opacity: branding.watermarkOpacity ?? 0.08,
                            width: `${branding.watermarkSize ?? 320}px`,
                            height: `${branding.watermarkSize ?? 320}px`,
                            objectFit: 'contain'
                          }
                    }
                    referrerPolicy="no-referrer"
                  />
                ) : null
              ) : (
                <span 
                  className="font-black uppercase rotate-[-30deg] tracking-widest whitespace-normal text-center break-words select-none font-sans"
                  style={{ 
                    opacity: branding.watermarkOpacity ?? 0.04, 
                    color: 'rgb(17, 24, 39)',
                    fontSize: `${branding.watermarkSize ?? 120}px`,
                    lineHeight: 1.1
                  }}
                >
                  {branding.watermarkText || branding.schoolName || ""}
                </span>
              )}
            </div>
          )}

          {/* School Header with dynamic left & right padding based on custom logo scales */}
          {(() => {
            const logoSize = branding.logoSize !== undefined ? branding.logoSize : 92;
            const rightLogoSize = branding.rightLogoSize !== undefined ? branding.rightLogoSize : 92;
            const padSize = branding.rightLogoUrl ? Math.max(logoSize, rightLogoSize) : logoSize;
            const logoCircular = branding.logoCircular !== false;
            return (
              <div 
                className="relative z-10 flex flex-col items-center justify-center text-center border-b-2 pb-3 sm:pb-4 border-black pl-4 pr-4 min-h-[85px] print:pb-2 transition-all"
                style={{
                  paddingLeft: `calc(var(--print-logo-size, ${padSize}px) + 20px)`,
                  paddingRight: `calc(var(--print-logo-size, ${padSize}px) + 20px)`
                }}
              >
                {/* School Branded Logo with custom dimensions and shape */}
                <div className="absolute left-[15px] top-1/2 -translate-y-1/2 flex-shrink-0 my-0 animate-fade-in">
                  <div 
                    className={`${logoCircular ? 'rounded-full' : 'rounded-lg'} school-logo-container flex items-center justify-center select-none overflow-hidden transition-all duration-300 ${
                      branding.logoBorder !== false 
                        ? 'shadow-xs border-2 bg-white p-1' 
                        : 'border-0 bg-transparent p-0'
                    }`}
                    style={{ 
                      width: `${logoSize}px`, 
                      height: `${logoSize}px`,
                      borderColor: branding.logoBorder !== false ? 'var(--theme-brand)' : 'transparent', 
                      color: 'var(--theme-brand)' 
                    }}
                  >
                    {branding.logoUrl ? (
                      <img 
                        src={branding.logoUrl} 
                        alt="School Logo" 
                        className="w-full h-full object-contain" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <svg viewBox="0 0 100 100" className="w-full h-full fill-current">
                        <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="3"></circle>
                        <text x="50" y="58" fontWeight="900" fontSize="22" textAnchor="middle" fill="currentColor">Logo</text>
                      </svg>
                    )}
                  </div>
                </div>

                {/* Optional Right-Side/Secondary Logo */}
                {branding.rightLogoUrl && (
                  <div className="absolute right-[15px] top-1/2 -translate-y-1/2 flex-shrink-0 my-0 animate-fade-in">
                    <div 
                      className={`${logoCircular ? 'rounded-full' : 'rounded-lg'} school-logo-container flex items-center justify-center select-none overflow-hidden transition-all duration-300 ${
                        branding.logoBorder !== false 
                          ? 'shadow-xs border-2 bg-white p-1' 
                          : 'border-0 bg-transparent p-0'
                      }`}
                      style={{ 
                        width: `${rightLogoSize}px`, 
                        height: `${rightLogoSize}px`,
                        borderColor: branding.logoBorder !== false ? 'var(--theme-brand)' : 'transparent', 
                        color: 'var(--theme-brand)' 
                      }}
                    >
                      <img 
                        src={branding.rightLogoUrl} 
                        alt="Secondary Logo" 
                        className="w-full h-full object-contain" 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>
                )}

                {/* Branding names & address properties */}
                <div className="flex-grow space-y-1 sm:space-y-1.5 flex flex-col items-center w-full">
                  {branding.nameBannerUrl ? (
                    <img 
                       src={branding.nameBannerUrl} 
                       alt={branding.schoolName || "School Header Banner"} 
                       className="w-full max-w-[550px] h-auto object-contain my-1 print:my-0.5"
                       referrerPolicy="no-referrer"
                    />
                  ) : (
                    <h1 
                      className="font-black tracking-tight text-center leading-snug" 
                      style={{ 
                        color: 'var(--theme-brand)',
                        fontSize: branding.schoolNameFontSize ? `${branding.schoolNameFontSize}px` : '26px',
                        fontFamily: branding.schoolNameFontFamily || undefined,
                      }}
                    >
                      {branding.schoolName || "DEMO PUBLIC SCHOOL"}
                    </h1>
                  )}

                  {(!branding.nameBannerUrl || !branding.hideSchoolDetails) && (
                    <>
                      {branding.tagline && (
                        <p 
                          className="font-bold text-gray-700 text-center tracking-wide uppercase school-header-text"
                          style={{
                            fontSize: branding.headerDetailsFontSize ? `${branding.headerDetailsFontSize}px` : '11px',
                            fontFamily: branding.headerDetailsFontFamily || undefined,
                          }}
                        >
                          {branding.tagline}
                        </p>
                      )}
                      {branding.address && (
                        <p 
                          className="font-semibold text-gray-500 text-center tracking-medium max-w-lg school-header-text"
                          style={{
                            fontSize: branding.headerDetailsFontSize ? `${branding.headerDetailsFontSize}px` : '10.5px',
                            fontFamily: branding.headerDetailsFontFamily || undefined,
                          }}
                        >
                          {branding.address}
                        </p>
                      )}
                      
                      {(branding.helpline || branding.email || branding.website) && (
                        <>
                          <div className="w-[85%] border-t h-px opacity-75 mt-1" style={{ borderColor: 'var(--theme-brand)' }}></div>
                          
                          <p 
                            className="font-bold text-gray-700 text-center whitespace-normal mt-0.5 school-header-helpline"
                            style={{
                              fontSize: branding.headerDetailsFontSize ? `${Math.max(8, (branding.headerDetailsFontSize || 10.5) - 1.5)}px` : '9px',
                              fontFamily: branding.headerDetailsFontFamily || undefined,
                            }}
                          >
                            {[
                              branding.helpline && `Helpline: ${branding.helpline}`,
                              branding.email && `Email: ${branding.email}`,
                              branding.website && `Website: ${branding.website}`
                            ].filter(Boolean).join(" | ")}
                          </p>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Main Heading & Academic Session title badge group */}
          <div className="relative z-10 flex flex-col items-center gap-1.5 sm:gap-2 text-center my-1 print:my-0.5">
            <div 
              style={{ backgroundColor: branding.themeColor }}
              className="px-6 py-1.5 sm:py-2 rounded shadow-sm border border-black/10 select-none inline-block max-w-[95%] sm:max-w-[80%]"
            >
              <h2 
                className="brand-report-title text-sm sm:text-base font-black tracking-widest text-center uppercase text-white font-sans"
                style={{ 
                  color: '#ffffff',
                  fontSize: branding.reportCardTitleFontSize ? `${branding.reportCardTitleFontSize}px` : undefined,
                }}
              >
                {branding.reportCardTitle || "Annual Examination Report Card"}
              </h2>
            </div>
            <span 
              style={{ borderColor: 'var(--theme-brand)' }}
              className="px-6 py-0.5 border text-gray-800 font-extrabold text-[10px] sm:text-xs uppercase tracking-wider rounded shadow-inner bg-white select-none inline-block mt-0.5"
            >
              {branding.session ? (branding.session.toLowerCase().includes("session") ? branding.session : `Session ${branding.session}`) : "Session 2022-2023"}
            </span>
          </div>

          {/* Student details profile schema */}
          <div id="student_profile_row" className="relative z-10 grid grid-cols-12 gap-4 border-b-2 pb-4 pt-1 border-gray-900/90 text-[11px] items-stretch">
            <div className={`${branding.studentPhotoDisabled ? 'col-span-6' : 'col-span-5'} min-w-0 space-y-2 font-mono flex flex-col justify-start`}>
              {col1Fields.map(field => {
                const rawVal = (student as any)[field.id];
                const value = (rawVal !== undefined && rawVal !== null && rawVal !== '') 
                  ? formatStudentFieldValue(field.id, rawVal) 
                  : "N/A";
                return (
                  <div key={field.id} className="flex items-baseline gap-1">
                    <span className="w-28 flex-shrink-0 text-gray-700 font-sans text-[11px] font-bold truncate">
                      {field.label}
                    </span>
                    <span className="text-gray-700 font-bold font-sans pr-1 select-none">:</span>
                    <span className="flex-grow border-b border-dashed border-gray-300 pl-1 font-bold whitespace-nowrap overflow-hidden text-ellipsis uppercase text-slate-905">
                      {value}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className={`${branding.studentPhotoDisabled ? 'col-span-6' : 'col-span-4'} min-w-0 space-y-2 font-mono flex flex-col justify-start`}>
              {col2Fields.map(field => {
                const rawVal = (student as any)[field.id];
                const value = (rawVal !== undefined && rawVal !== null && rawVal !== '') 
                  ? formatStudentFieldValue(field.id, rawVal) 
                  : "N/A";
                return (
                  <div key={field.id} className="flex items-baseline gap-1">
                    <span className="w-28 flex-shrink-0 text-gray-700 font-sans text-[11px] font-bold truncate">
                      {field.label}
                    </span>
                    <span className="text-gray-700 font-bold font-sans pr-1 select-none">:</span>
                    <span className="flex-grow border-b border-dashed border-gray-300 pl-1 font-bold whitespace-nowrap overflow-hidden text-ellipsis uppercase text-slate-905">
                      {value}
                    </span>
                  </div>
                );
              })}
            </div>

            {!branding.studentPhotoDisabled && (
              <div className="col-span-3 min-w-0 flex justify-end items-center">
                <div 
                  style={{ 
                    borderColor: 'var(--theme-brand)',
                    width: 'var(--print-photo-width, 115px)',
                    height: 'var(--print-photo-height, 125px)'
                  } as React.CSSProperties}
                  className="bg-gray-50 border-2 border-solid rounded-md overflow-hidden shadow-xs flex items-center justify-center p-0"
                >
                  {student.photoUrl ? (
                    <img src={student.photoUrl} alt={student.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-[10px] text-gray-400 p-1 text-center font-sans font-medium">Student Photo</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Academic Scholastic Results and Status Overview Grouped to Minimize Spacing */}
          {hasScholasticActive && (
            <div className="relative z-10 flex flex-col gap-1.5 print:gap-1 select-all">
              {/* Academic Scholastic Results tabular Grid */}
              <div className="overflow-x-auto no-scrollbar print:overflow-visible">
                {(() => {
                  const firstScholasticSubject = subjects.find(s => s.type === 'scholastic');
                  const firstSubMaxOverall = (firstScholasticSubject ? getSubjectMetrics(firstScholasticSubject.id).maxOverallMarksPossible : (sumOfT1ColumnMaxMarks + sumOfT2ColumnMaxMarks));
                  const singleSubjectMaxOverall = firstSubMaxOverall;
                  return (
                    <table className={`w-full table-fixed border-collapse border border-gray-900 text-center leading-tight ${tableFontSizeClass}`}>
                      <colgroup>
                        <col style={{ width: `${subjWidth}%` }} />
                        {scholT1Enabled && (
                          <>
                            {t1Columns.map(col => {
                              const { minPct, maxPct, obtPct } = getSubColWidths(testColWidth);
                              return subColCount > 1 ? (
                                <React.Fragment key={`col_t1_grp_${col.id}`}>
                                  {showMinMarksColumn && <col key={`col_t1_min_${col.id}`} style={{ width: `${minPct}%` }} />}
                                  {showMaxMarksColumn && <col key={`col_t1_max_${col.id}`} style={{ width: `${maxPct}%` }} />}
                                  {showObtainedMarksColumn && <col key={`col_t1_obt_${col.id}`} style={{ width: `${obtPct}%` }} />}
                                </React.Fragment>
                              ) : (
                                <col key={`col_t1_${col.id}`} style={{ width: `${testColWidth}%` }} />
                              );
                            })}
                            {showT1Total && (() => {
                              const { minPct, maxPct, obtPct } = getSubColWidths(termTotalColWidth);
                              return subColCount > 1 ? (
                                <React.Fragment key="col_t1_tot_grp">
                                  {showMinMarksColumn && <col style={{ width: `${minPct}%` }} />}
                                  {showMaxMarksColumn && <col style={{ width: `${maxPct}%` }} />}
                                  {showObtainedMarksColumn && <col style={{ width: `${obtPct}%` }} />}
                                </React.Fragment>
                              ) : (
                                <col style={{ width: `${termTotalColWidth}%` }} />
                              );
                            })()}
                            {showT1Grade && <col style={{ width: `${termGradeColWidth}%` }} />}
                          </>
                        )}
                        {scholT2Enabled && (
                          <>
                            {t2Columns.map(col => {
                              const { minPct, maxPct, obtPct } = getSubColWidths(testColWidth);
                              return subColCount > 1 ? (
                                <React.Fragment key={`col_t2_grp_${col.id}`}>
                                  {showMinMarksColumn && <col key={`col_t2_min_${col.id}`} style={{ width: `${minPct}%` }} />}
                                  {showMaxMarksColumn && <col key={`col_t2_max_${col.id}`} style={{ width: `${maxPct}%` }} />}
                                  {showObtainedMarksColumn && <col key={`col_t2_obt_${col.id}`} style={{ width: `${obtPct}%` }} />}
                                </React.Fragment>
                              ) : (
                                <col key={`col_t2_${col.id}`} style={{ width: `${testColWidth}%` }} />
                              );
                            })}
                            {showT2Total && (() => {
                              const { minPct, maxPct, obtPct } = getSubColWidths(termTotalColWidth);
                              return subColCount > 1 ? (
                                <React.Fragment key="col_t2_tot_grp">
                                  {showMinMarksColumn && <col style={{ width: `${minPct}%` }} />}
                                  {showMaxMarksColumn && <col style={{ width: `${maxPct}%` }} />}
                                  {showObtainedMarksColumn && <col style={{ width: `${obtPct}%` }} />}
                                </React.Fragment>
                              ) : (
                                <col style={{ width: `${termTotalColWidth}%` }} />
                              );
                            })()}
                            {showT2Grade && <col style={{ width: `${termGradeColWidth}%` }} />}
                          </>
                        )}
                        {scholT3Enabled && (
                          <>
                            {t3Columns.map(col => {
                              const { minPct, maxPct, obtPct } = getSubColWidths(testColWidth);
                              return subColCount > 1 ? (
                                <React.Fragment key={`col_t3_grp_${col.id}`}>
                                  {showMinMarksColumn && <col key={`col_t3_min_${col.id}`} style={{ width: `${minPct}%` }} />}
                                  {showMaxMarksColumn && <col key={`col_t3_max_${col.id}`} style={{ width: `${maxPct}%` }} />}
                                  {showObtainedMarksColumn && <col key={`col_t3_obt_${col.id}`} style={{ width: `${obtPct}%` }} />}
                                </React.Fragment>
                              ) : (
                                <col key={`col_t3_${col.id}`} style={{ width: `${testColWidth}%` }} />
                              );
                            })}
                            {showT3Total && (() => {
                              const { minPct, maxPct, obtPct } = getSubColWidths(termTotalColWidth);
                              return subColCount > 1 ? (
                                <React.Fragment key="col_t3_tot_grp">
                                  {showMinMarksColumn && <col style={{ width: `${minPct}%` }} />}
                                  {showMaxMarksColumn && <col style={{ width: `${maxPct}%` }} />}
                                  {showObtainedMarksColumn && <col style={{ width: `${obtPct}%` }} />}
                                </React.Fragment>
                              ) : (
                                <col style={{ width: `${termTotalColWidth}%` }} />
                              );
                            })()}
                            {showT3Grade && <col style={{ width: `${termGradeColWidth}%` }} />}
                          </>
                        )}
                        {showOverall && overallExtraCols > 0 && (
                          <>
                            {showOverallTotal && (() => {
                              const { minPct, maxPct, obtPct } = getSubColWidths(overallTotalColWidth);
                              return subColCount > 1 ? (
                                <React.Fragment key="col_ov_tot_grp">
                                  {showMinMarksColumn && <col style={{ width: `${minPct}%` }} />}
                                  {showMaxMarksColumn && <col style={{ width: `${maxPct}%` }} />}
                                  {showObtainedMarksColumn && <col style={{ width: `${obtPct}%` }} />}
                                </React.Fragment>
                              ) : (
                                <col style={{ width: `${overallTotalColWidth}%` }} />
                              );
                            })()}
                            {showOverallGrade && <col style={{ width: `${overallGradeColWidth}%` }} />}
                          </>
                        )}
                      </colgroup>
                      <thead>
                        <tr className="bg-gray-100/70 border-b border-gray-955">
                          <th 
                            colSpan={totalTableColumns} 
                            className="border border-gray-950 p-1 text-center font-black text-gray-900 text-xs tracking-wider uppercase bg-gray-100/70"
                          >
                            {scholasticLabel}
                          </th>
                        </tr>
                        <tr className="bg-gray-50/50 border-b border-gray-900">
                          <th 
                            rowSpan={omitExamHeaderRow ? 2 : (subColCount > 1 ? 3 : 2)} 
                            className={`border border-gray-950 ${subjectCellPaddingClass} text-center font-bold text-gray-900 break-words leading-tight align-middle`}
                          >
                            {(() => {
                              const renderedText = scholasticSubjectsHeaderLabel.includes('<br/>') || scholasticSubjectsHeaderLabel.includes('<br />') ? (
                                scholasticSubjectsHeaderLabel.replace(/<br\s*\/?>/i, '\n').split('\n').map((part, i) => <span key={i}>{part}{i === 0 && <br/>}</span>)
                              ) : (
                                scholasticSubjectsHeaderLabel
                              );
                              if (verticalSubjectsHeader) {
                                return (
                                  <div 
                                    className="inline-block mx-auto text-center font-bold uppercase tracking-wide text-black leading-none select-all font-sans py-1 text-[9px] sm:text-[10px]" 
                                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap' }}
                                  >
                                    {scholasticSubjectsHeaderLabel.includes('<br/>') || scholasticSubjectsHeaderLabel.includes('<br />') ? (
                                      scholasticSubjectsHeaderLabel.replace(/<br\s*\/?>/i, ' ')
                                    ) : (
                                      scholasticSubjectsHeaderLabel
                                    )}
                                  </div>
                                );
                              } else {
                                return (
                                  <div className="flex flex-col items-center justify-center text-center leading-tight px-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wide text-black">
                                    {renderedText}
                                  </div>
                                );
                              }
                            })()}
                          </th>
                          {scholT1Enabled && (
                            <th colSpan={t1Columns.length * subColCount + (showT1Total ? subColCount : 0) + (showT1Grade ? 1 : 0)} className={`border border-gray-950 ${cellPaddingClass} font-black text-black uppercase tracking-wide bg-gray-100/30 text-[9px] sm:text-[10px]`}>
                              {term1Label}
                            </th>
                          )}
                          {scholT2Enabled && (
                            <th colSpan={t2Columns.length * subColCount + (showT2Total ? subColCount : 0) + (showT2Grade ? 1 : 0)} className={`border border-gray-950 ${cellPaddingClass} font-black text-black uppercase tracking-wide bg-gray-100/30 text-[9px] sm:text-[10px]`}>
                              {term2Label}
                            </th>
                          )}
                          {scholT3Enabled && (
                            <th colSpan={t3Columns.length * subColCount + (showT3Total ? subColCount : 0) + (showT3Grade ? 1 : 0)} className={`border border-gray-950 ${cellPaddingClass} font-black text-black uppercase tracking-wide bg-gray-100/30 text-[9px] sm:text-[10px]`}>
                              {term3Label}
                            </th>
                          )}
                          {showOverall && overallExtraCols > 0 && (
                            <th colSpan={(showOverallTotal ? subColCount : 0) + (showOverallGrade ? 1 : 0)} className={`border border-gray-950 ${cellPaddingClass} font-black text-black uppercase tracking-wide bg-gray-100/10 text-[9px] sm:text-[10px]`}>{overallResultsHeaderLabel}</th>
                          )}
                        </tr>
                        {!omitExamHeaderRow && (
                          <tr className="bg-gray-50/50">
                            {/* Term 1 columns */}
                            {scholT1Enabled && (
                              <>
                                {t1Columns.map(col => {
                                  const text = (col.id === 'hy') ? term1ExamLabel : col.name;
                                  const subtext = (!pureGradeBased && !subjectSpecificMaxMarksEnabled && subColCount === 1) ? `(${col.maxMarks})` : undefined;
                                  return (
                                    <th key={`t1_h_${col.id}`} colSpan={subColCount} className="border border-gray-950 p-1 bg-gray-50/10 text-[9.5px] font-black text-black align-middle text-center">
                                      {renderExamHeader(text, subtext)}
                                    </th>
                                  );
                                })}
                                {showT1Total && (
                                  <th colSpan={subColCount} className="border border-gray-950 p-1 bg-gray-100/50 text-[10px] font-black text-black align-middle text-center">
                                    {renderExamHeader(term1TotalLabel, (!pureGradeBased && !subjectSpecificMaxMarksEnabled && subColCount === 1) ? `(${sumOfT1ColumnMaxMarks})` : undefined)}
                                  </th>
                                )}
                                {showT1Grade && (
                                  <th rowSpan={subColCount > 1 ? 2 : 1} className="border border-gray-950 p-1 bg-gray-100/50 text-[10px] font-black text-black align-middle text-center">
                                    {renderExamHeader("Grade")}
                                  </th>
                                )}
                              </>
                            )}

                            {/* Term 2 columns */}
                            {scholT2Enabled && (
                              <>
                                {t2Columns.map(col => {
                                  const isMidTerm = col.id === 'mid_term' || col.id === 'mid-term' || col.name.toLowerCase().includes('mid-term') || col.name.toLowerCase().includes('mid term');
                                  const colName = isMidTerm ? 'Annual' : col.name;
                                  const text = (col.id === 'hy') ? term2ExamLabel : colName;
                                  const subtext = (!pureGradeBased && !subjectSpecificMaxMarksEnabled && subColCount === 1) ? `(${col.maxMarks})` : undefined;
                                  return (
                                    <th key={`t2_h_${col.id}`} colSpan={subColCount} className="border border-gray-950 p-1 bg-gray-50/10 text-[9.5px] font-black text-black align-middle text-center">
                                      {renderExamHeader(text, subtext)}
                                    </th>
                                  );
                                })}
                                {showT2Total && (
                                  <th colSpan={subColCount} className="border border-gray-950 p-1 bg-gray-100/50 text-[10px] font-black text-black align-middle text-center">
                                    {renderExamHeader(term2TotalLabel, (!pureGradeBased && !subjectSpecificMaxMarksEnabled && subColCount === 1) ? `(${sumOfT2ColumnMaxMarks})` : undefined)}
                                  </th>
                                )}
                                {showT2Grade && (
                                  <th rowSpan={subColCount > 1 ? 2 : 1} className="border border-gray-955 p-1 bg-gray-100/50 text-[10px] font-black text-black align-middle text-center">
                                    {renderExamHeader("Grade")}
                                  </th>
                                )}
                              </>
                            )}

                            {/* Term 3 columns */}
                            {scholT3Enabled && (
                              <>
                                {t3Columns.map(col => {
                                  const isMidTerm = col.id === 'mid_term' || col.id === 'mid-term' || col.name.toLowerCase().includes('mid-term') || col.name.toLowerCase().includes('mid term');
                                  const colName = isMidTerm ? 'Annual' : col.name;
                                  const text = (col.id === 'hy') ? term3ExamLabel : colName;
                                  const subtext = (!pureGradeBased && !subjectSpecificMaxMarksEnabled && subColCount === 1) ? `(${col.maxMarks})` : undefined;
                                  return (
                                    <th key={`t3_h_${col.id}`} colSpan={subColCount} className="border border-gray-950 p-1 bg-gray-50/10 text-[9.5px] font-black text-black align-middle text-center">
                                      {renderExamHeader(text, subtext)}
                                    </th>
                                  );
                                })}
                                {showT3Total && (
                                  <th colSpan={subColCount} className="border border-gray-950 p-1 bg-gray-100/50 text-[10px] font-black text-black align-middle text-center">
                                    {renderExamHeader(term3TotalLabel, (!pureGradeBased && !subjectSpecificMaxMarksEnabled && subColCount === 1) ? `(${sumOfT3ColumnMaxMarks})` : undefined)}
                                  </th>
                                )}
                                {showT3Grade && (
                                  <th rowSpan={subColCount > 1 ? 2 : 1} className="border border-gray-955 p-1 bg-gray-100/50 text-[10px] font-black text-black align-middle text-center">
                                    {renderExamHeader("Grade")}
                                  </th>
                                )}
                              </>
                            )}

                            {/* Overall totals */}
                            {showOverall && overallExtraCols > 0 && (
                              <>
                                {showOverallTotal && (
                                  <th colSpan={subColCount} className="border border-gray-950 p-1 bg-sky-50/50 text-[10px] font-black text-black align-middle text-center">
                                    {renderExamHeader(totalMarksHeaderLabel, (!pureGradeBased && !subjectSpecificMaxMarksEnabled && subColCount === 1) ? `(${singleSubjectMaxOverall})` : undefined)}
                                  </th>
                                )}
                                {showOverallGrade && (
                                  <th rowSpan={subColCount > 1 ? 2 : 1} className="border border-gray-955 p-1 bg-rose-50/50 text-[10px] font-black text-black align-middle text-center">
                                    {renderExamHeader(gradeHeaderLabel)}
                                  </th>
                                )}
                              </>
                            )}
                          </tr>
                        )}
                        {subColCount > 1 && (
                          <tr className="bg-gray-100/60 border-b border-gray-900 text-[8.5px] font-bold text-gray-800">
                            {scholT1Enabled && (
                              <>
                                {t1Columns.map(col => (
                                  <React.Fragment key={`t1_subh_${col.id}`}>
                                    {showMinMarksColumn && <th className="border border-gray-950 p-0.5 text-center">{renderSubHeader(minMarksHeaderLabel)}</th>}
                                    {showMaxMarksColumn && <th className="border border-gray-950 p-0.5 text-center">{renderSubHeader(maxMarksHeaderLabel)}</th>}
                                    {showObtainedMarksColumn && <th className="border border-gray-950 p-0.5 text-center">{renderSubHeader(obtainedMarksHeaderLabel)}</th>}
                                  </React.Fragment>
                                ))}
                                {showT1Total && (
                                  <React.Fragment key="t1_tot_subh">
                                    {showMinMarksColumn && <th className="border border-gray-950 p-0.5 text-center bg-gray-100/80">{renderSubHeader(minMarksHeaderLabel)}</th>}
                                    {showMaxMarksColumn && <th className="border border-gray-950 p-0.5 text-center bg-gray-100/80">{renderSubHeader(maxMarksHeaderLabel)}</th>}
                                    {showObtainedMarksColumn && <th className="border border-gray-950 p-0.5 text-center bg-gray-100/80">{renderSubHeader(obtainedMarksHeaderLabel)}</th>}
                                  </React.Fragment>
                                )}
                                {showT1Grade && omitExamHeaderRow && (
                                  <th className="border border-gray-955 p-1 bg-gray-100/50 text-[10px] font-black text-black align-middle text-center">
                                    {renderExamHeader("Grade")}
                                  </th>
                                )}
                              </>
                            )}
                            {scholT2Enabled && (
                              <>
                                {t2Columns.map(col => (
                                  <React.Fragment key={`t2_subh_${col.id}`}>
                                    {showMinMarksColumn && <th className="border border-gray-950 p-0.5 text-center">{renderSubHeader(minMarksHeaderLabel)}</th>}
                                    {showMaxMarksColumn && <th className="border border-gray-950 p-0.5 text-center">{renderSubHeader(maxMarksHeaderLabel)}</th>}
                                    {showObtainedMarksColumn && <th className="border border-gray-950 p-0.5 text-center">{renderSubHeader(obtainedMarksHeaderLabel)}</th>}
                                  </React.Fragment>
                                ))}
                                {showT2Total && (
                                  <React.Fragment key="t2_tot_subh">
                                    {showMinMarksColumn && <th className="border border-gray-950 p-0.5 text-center bg-gray-100/80">{renderSubHeader(minMarksHeaderLabel)}</th>}
                                    {showMaxMarksColumn && <th className="border border-gray-950 p-0.5 text-center bg-gray-100/80">{renderSubHeader(maxMarksHeaderLabel)}</th>}
                                    {showObtainedMarksColumn && <th className="border border-gray-950 p-0.5 text-center bg-gray-100/80">{renderSubHeader(obtainedMarksHeaderLabel)}</th>}
                                  </React.Fragment>
                                )}
                                {showT2Grade && omitExamHeaderRow && (
                                  <th className="border border-gray-955 p-1 bg-gray-100/50 text-[10px] font-black text-black align-middle text-center">
                                    {renderExamHeader("Grade")}
                                  </th>
                                )}
                              </>
                            )}
                            {scholT3Enabled && (
                              <>
                                {t3Columns.map(col => (
                                  <React.Fragment key={`t3_subh_${col.id}`}>
                                    {showMinMarksColumn && <th className="border border-gray-950 p-0.5 text-center">{renderSubHeader(minMarksHeaderLabel)}</th>}
                                    {showMaxMarksColumn && <th className="border border-gray-950 p-0.5 text-center">{renderSubHeader(maxMarksHeaderLabel)}</th>}
                                    {showObtainedMarksColumn && <th className="border border-gray-950 p-0.5 text-center">{renderSubHeader(obtainedMarksHeaderLabel)}</th>}
                                  </React.Fragment>
                                ))}
                                {showT3Total && (
                                  <React.Fragment key="t3_tot_subh">
                                    {showMinMarksColumn && <th className="border border-gray-955 p-0.5 text-center bg-gray-100/80">{renderSubHeader(minMarksHeaderLabel)}</th>}
                                    {showMaxMarksColumn && <th className="border border-gray-955 p-0.5 text-center bg-gray-100/80">{renderSubHeader(maxMarksHeaderLabel)}</th>}
                                    {showObtainedMarksColumn && <th className="border border-gray-955 p-0.5 text-center bg-gray-100/80">{renderSubHeader(obtainedMarksHeaderLabel)}</th>}
                                  </React.Fragment>
                                )}
                                {showT3Grade && omitExamHeaderRow && (
                                  <th className="border border-gray-955 p-1 bg-gray-100/50 text-[10px] font-black text-black align-middle text-center">
                                    {renderExamHeader("Grade")}
                                  </th>
                                )}
                              </>
                            )}
                            {showOverall && overallExtraCols > 0 && (
                              <>
                                {showOverallTotal && (
                                  <React.Fragment key="ov_tot_subh">
                                    {showMinMarksColumn && <th className="border border-gray-950 p-0.5 text-center bg-sky-100/60">{renderSubHeader(minMarksHeaderLabel)}</th>}
                                    {showMaxMarksColumn && <th className="border border-gray-950 p-0.5 text-center bg-sky-100/60">{renderSubHeader(maxMarksHeaderLabel)}</th>}
                                    {showObtainedMarksColumn && <th className="border border-gray-950 p-0.5 text-center bg-sky-100/60">{renderSubHeader(obtainedMarksHeaderLabel)}</th>}
                                  </React.Fragment>
                                )}
                              </>
                            )}
                          </tr>
                        )}
                      </thead>
                      <tbody>
                        {(() => {
                          const scholasticList = subjects.filter(s => s.type === 'scholastic');
                          const totalScholCols = totalTableColumns;

                          return scholasticList.map((sub, idx) => {
                            const showGroupHdr = isGroupingActive && Boolean(sub.group && sub.group.trim()) && (idx === 0 || scholasticList[idx - 1]?.group !== sub.group);
                            const studentGrades = grades.scholastic[sub.id] || { term1: {}, term2: {}, term3: {} };
                            const subMetrics = getSubjectMetrics(sub.id);

                            return (
                              <React.Fragment key={sub.id}>
                                {showGroupHdr && (
                                  <tr key={`schol_group_hdr_${sub.group}_${idx}`} className="bg-gray-100/90 font-bold border-b border-gray-950">
                                    <td 
                                      colSpan={totalScholCols} 
                                      className="p-1.5 pl-3 text-left font-black text-gray-900 bg-gray-100/90 text-[10.5px] uppercase tracking-wide border border-gray-950"
                                    >
                                      {sub.group}
                                    </td>
                                  </tr>
                                )}
                                <tr id={`preview_subject_row_${sub.id}`} className="hover:bg-gray-50/20 font-sans border-b border-gray-955">
                                  <td className={`border border-gray-955 ${subjectCellPaddingClass} text-left font-black text-black ${subjectNameFontSizeClass} ${pureGradeBased ? 'whitespace-nowrap' : 'break-words leading-tight'}`}>
                                    {isGroupingActive && sub.group ? (
                                      <span className="inline-flex items-center pl-2.5">
                                        <span className="text-gray-600 font-bold mr-1.5">-</span>
                                        {sub.name.startsWith('- ') ? sub.name.substring(2) : sub.name}
                                      </span>
                                    ) : sub.name.startsWith('- ') ? (
                                      <span className="inline-flex items-center pl-2.5">
                                        <span className="text-gray-600 font-bold mr-1.5">-</span>
                                        {sub.name.substring(2)}
                                      </span>
                                    ) : (
                                      sub.name
                                    )}
                                  </td>
                                  {/* Term 1 Scores */}
                                  {scholT1Enabled && (
                                    <>
                                      {t1Columns.map(col => {
                                        const rawVal = studentGrades.term1?.[col.id];
                                        const resolvedVal = (rawVal === undefined || rawVal === null || (rawVal as any) === '') ? 0 : rawVal;
                                        const colMax = sub.customMaxMarks?.[col.id] ?? col.maxMarks;
                                        const colMin = col.minMarks !== undefined ? col.minMarks : Math.round(colMax * 0.33);

                                        if (subColCount === 1) {
                                          return (
                                            <td key={`t1_cell_${sub.id}_${col.id}`} className={`border border-gray-955 ${cellPaddingClass} font-bold font-mono text-black ${tableFontSizeClass} text-center whitespace-nowrap overflow-hidden text-ellipsis`}>
                                              {pureGradeBased 
                                                ? getGradeFromMark(resolvedVal, colMax)
                                                : (subjectSpecificMaxMarksEnabled ? `${resolvedVal}/${colMax}` : resolvedVal)}
                                            </td>
                                          );
                                        } else {
                                          return (
                                            <React.Fragment key={`t1_cell_sub_${sub.id}_${col.id}`}>
                                              {showMinMarksColumn && (
                                                <td className={`border border-gray-955 ${cellPaddingClass} font-mono text-gray-700 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                                  {colMin}
                                                </td>
                                              )}
                                              {showMaxMarksColumn && (
                                                <td className={`border border-gray-955 ${cellPaddingClass} font-mono text-gray-700 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                                  {colMax}
                                                </td>
                                              )}
                                              {showObtainedMarksColumn && (
                                                <td className={`border border-gray-955 ${cellPaddingClass} font-black font-mono text-black ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                                  {pureGradeBased ? getGradeFromMark(resolvedVal, colMax) : resolvedVal}
                                                </td>
                                              )}
                                            </React.Fragment>
                                          );
                                        }
                                      })}
                                      {showT1Total && (
                                        subColCount === 1 ? (
                                          <td className={`border border-gray-955 ${cellPaddingClass} font-black font-mono text-black bg-gray-100/50 ${tableFontSizeClass} text-center whitespace-nowrap overflow-hidden text-ellipsis`}>
                                            {pureGradeBased 
                                              ? getGradeFromMark(subMetrics.t1Sum, subMetrics.t1SubMax)
                                              : (subjectSpecificMaxMarksEnabled ? `${subMetrics.t1Sum}/${subMetrics.t1SubMax}` : subMetrics.t1Sum)}
                                          </td>
                                        ) : (
                                          <React.Fragment key={`t1_tot_sub_cells_${sub.id}`}>
                                            {showMinMarksColumn && (
                                              <td className={`border border-gray-955 ${cellPaddingClass} font-mono text-gray-700 bg-gray-100/50 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                                {t1Columns.reduce((sum, col) => sum + (col.minMarks !== undefined ? col.minMarks : Math.round((sub.customMaxMarks?.[col.id] ?? col.maxMarks) * 0.33)), 0)}
                                              </td>
                                            )}
                                            {showMaxMarksColumn && (
                                              <td className={`border border-gray-955 ${cellPaddingClass} font-mono text-gray-700 bg-gray-100/50 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                                {subMetrics.t1SubMax}
                                              </td>
                                            )}
                                            {showObtainedMarksColumn && (
                                              <td className={`border border-gray-955 ${cellPaddingClass} font-black font-mono text-black bg-gray-100/50 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                                {pureGradeBased ? getGradeFromMark(subMetrics.t1Sum, subMetrics.t1SubMax) : subMetrics.t1Sum}
                                              </td>
                                            )}
                                          </React.Fragment>
                                        )
                                      )}
                                      {showT1Grade && (
                                        <td className={`border border-gray-955 ${cellPaddingClass} font-black font-mono text-black bg-gray-100/50 ${tableFontSizeClass} text-center`}>
                                          {getGradeFromMark(subMetrics.t1Sum, subMetrics.t1SubMax)}
                                        </td>
                                      )}
                                    </>
                                  )}

                                  {/* Term 2 Scores */}
                                  {scholT2Enabled && (
                                    <>
                                      {t2Columns.map(col => {
                                        const rawVal = studentGrades.term2?.[col.id];
                                        const resolvedVal = (rawVal === undefined || rawVal === null || (rawVal as any) === '') ? 0 : rawVal;
                                        const colMax = sub.customMaxMarks?.[col.id] ?? col.maxMarks;
                                        const colMin = col.minMarks !== undefined ? col.minMarks : Math.round(colMax * 0.33);

                                        if (subColCount === 1) {
                                          return (
                                            <td key={`t2_cell_${sub.id}_${col.id}`} className={`border border-gray-955 ${cellPaddingClass} font-bold font-mono text-black ${tableFontSizeClass} text-center whitespace-nowrap overflow-hidden text-ellipsis`}>
                                              {pureGradeBased 
                                                ? getGradeFromMark(resolvedVal, colMax)
                                                : (subjectSpecificMaxMarksEnabled ? `${resolvedVal}/${colMax}` : resolvedVal)}
                                            </td>
                                          );
                                        } else {
                                          return (
                                            <React.Fragment key={`t2_cell_sub_${sub.id}_${col.id}`}>
                                              {showMinMarksColumn && (
                                                <td className={`border border-gray-955 ${cellPaddingClass} font-mono text-gray-700 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                                  {colMin}
                                                </td>
                                              )}
                                              {showMaxMarksColumn && (
                                                <td className={`border border-gray-955 ${cellPaddingClass} font-mono text-gray-700 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                                  {colMax}
                                                </td>
                                              )}
                                              {showObtainedMarksColumn && (
                                                <td className={`border border-gray-955 ${cellPaddingClass} font-black font-mono text-black ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                                  {pureGradeBased ? getGradeFromMark(resolvedVal, colMax) : resolvedVal}
                                                </td>
                                              )}
                                            </React.Fragment>
                                          );
                                        }
                                      })}
                                      {showT2Total && (
                                        subColCount === 1 ? (
                                          <td className={`border border-gray-955 ${cellPaddingClass} font-black font-mono text-black bg-gray-100/50 ${tableFontSizeClass} text-center whitespace-nowrap overflow-hidden text-ellipsis`}>
                                            {pureGradeBased 
                                              ? getGradeFromMark(subMetrics.t2Sum, subMetrics.t2SubMax)
                                              : (subjectSpecificMaxMarksEnabled ? `${subMetrics.t2Sum}/${subMetrics.t2SubMax}` : subMetrics.t2Sum)}
                                          </td>
                                        ) : (
                                          <React.Fragment key={`t2_tot_sub_cells_${sub.id}`}>
                                            {showMinMarksColumn && (
                                              <td className={`border border-gray-955 ${cellPaddingClass} font-mono text-gray-700 bg-gray-100/50 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                                {t2Columns.reduce((sum, col) => sum + (col.minMarks !== undefined ? col.minMarks : Math.round((sub.customMaxMarks?.[col.id] ?? col.maxMarks) * 0.33)), 0)}
                                              </td>
                                            )}
                                            {showMaxMarksColumn && (
                                              <td className={`border border-gray-955 ${cellPaddingClass} font-mono text-gray-700 bg-gray-100/50 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                                {subMetrics.t2SubMax}
                                              </td>
                                            )}
                                            {showObtainedMarksColumn && (
                                              <td className={`border border-gray-955 ${cellPaddingClass} font-black font-mono text-black bg-gray-100/50 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                                {pureGradeBased ? getGradeFromMark(subMetrics.t2Sum, subMetrics.t2SubMax) : subMetrics.t2Sum}
                                              </td>
                                            )}
                                          </React.Fragment>
                                        )
                                      )}
                                      {showT2Grade && (
                                        <td className={`border border-gray-955 ${cellPaddingClass} font-black font-mono text-black bg-gray-100/50 ${tableFontSizeClass} text-center`}>
                                          {getGradeFromMark(subMetrics.t2Sum, subMetrics.t2SubMax)}
                                        </td>
                                      )}
                                    </>
                                  )}

                                  {/* Term 3 Scores */}
                                  {scholT3Enabled && (
                                    <>
                                      {t3Columns.map(col => {
                                        const rawVal = studentGrades.term3?.[col.id];
                                        const resolvedVal = (rawVal === undefined || rawVal === null || (rawVal as any) === '') ? 0 : rawVal;
                                        const colMax = sub.customMaxMarks?.[col.id] ?? col.maxMarks;
                                        const colMin = col.minMarks !== undefined ? col.minMarks : Math.round(colMax * 0.33);

                                        if (subColCount === 1) {
                                          return (
                                            <td key={`t3_cell_${sub.id}_${col.id}`} className={`border border-gray-955 ${cellPaddingClass} font-bold font-mono text-black ${tableFontSizeClass} text-center whitespace-nowrap overflow-hidden text-ellipsis`}>
                                              {pureGradeBased 
                                                ? getGradeFromMark(resolvedVal, colMax)
                                                : (subjectSpecificMaxMarksEnabled ? `${resolvedVal}/${colMax}` : resolvedVal)}
                                            </td>
                                          );
                                        } else {
                                          return (
                                            <React.Fragment key={`t3_cell_sub_${sub.id}_${col.id}`}>
                                              {showMinMarksColumn && (
                                                <td className={`border border-gray-955 ${cellPaddingClass} font-mono text-gray-700 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                                  {colMin}
                                                </td>
                                              )}
                                              {showMaxMarksColumn && (
                                                <td className={`border border-gray-955 ${cellPaddingClass} font-mono text-gray-700 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                                  {colMax}
                                                </td>
                                              )}
                                              {showObtainedMarksColumn && (
                                                <td className={`border border-gray-955 ${cellPaddingClass} font-black font-mono text-black ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                                  {pureGradeBased ? getGradeFromMark(resolvedVal, colMax) : resolvedVal}
                                                </td>
                                              )}
                                            </React.Fragment>
                                          );
                                        }
                                      })}
                                      {showT3Total && (
                                        subColCount === 1 ? (
                                          <td className={`border border-gray-955 ${cellPaddingClass} font-black font-mono text-black bg-gray-100/50 ${tableFontSizeClass} text-center whitespace-nowrap overflow-hidden text-ellipsis`}>
                                            {pureGradeBased 
                                              ? getGradeFromMark(subMetrics.t3Sum, subMetrics.t3SubMax)
                                              : (subjectSpecificMaxMarksEnabled ? `${subMetrics.t3Sum}/${subMetrics.t3SubMax}` : subMetrics.t3Sum)}
                                          </td>
                                        ) : (
                                          <React.Fragment key={`t3_tot_sub_cells_${sub.id}`}>
                                            {showMinMarksColumn && (
                                              <td className={`border border-gray-955 ${cellPaddingClass} font-mono text-gray-700 bg-gray-100/50 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                                {t3Columns.reduce((sum, col) => sum + (col.minMarks !== undefined ? col.minMarks : Math.round((sub.customMaxMarks?.[col.id] ?? col.maxMarks) * 0.33)), 0)}
                                              </td>
                                            )}
                                            {showMaxMarksColumn && (
                                              <td className={`border border-gray-955 ${cellPaddingClass} font-mono text-gray-700 bg-gray-100/50 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                                {subMetrics.t3SubMax}
                                              </td>
                                            )}
                                            {showObtainedMarksColumn && (
                                              <td className={`border border-gray-955 ${cellPaddingClass} font-black font-mono text-black bg-gray-100/50 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                                {pureGradeBased ? getGradeFromMark(subMetrics.t3Sum, subMetrics.t3SubMax) : subMetrics.t3Sum}
                                              </td>
                                            )}
                                          </React.Fragment>
                                        )
                                      )}
                                      {showT3Grade && (
                                        <td className={`border border-gray-955 ${cellPaddingClass} font-black font-mono text-black bg-gray-100/50 ${tableFontSizeClass} text-center`}>
                                          {getGradeFromMark(subMetrics.t3Sum, subMetrics.t3SubMax)}
                                        </td>
                                      )}
                                    </>
                                  )}

                                  {/* Overall */}
                                  {showOverall && overallExtraCols > 0 && (
                                    <>
                                      {showOverallTotal && (
                                        subColCount === 1 ? (
                                          <td className={`border border-gray-955 ${cellPaddingClass} font-black font-mono text-black bg-sky-50/20 ${tableFontSizeClass} text-center whitespace-nowrap overflow-hidden text-ellipsis`}>
                                            {subjectSpecificMaxMarksEnabled 
                                              ? `${subMetrics.overallRound}/${subMetrics.maxOverallMarksPossible}` 
                                              : subMetrics.overallRound}
                                          </td>
                                        ) : (
                                          <React.Fragment key={`ov_tot_sub_cells_${sub.id}`}>
                                            {showMinMarksColumn && (
                                              <td className={`border border-gray-955 ${cellPaddingClass} font-mono text-gray-700 bg-sky-50/20 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                                {subjects.filter(s => s.type === 'scholastic').reduce((sum, s) => sum, 0) /* Total min marks for single subject */}
                                                {((scholT1Enabled ? t1Columns : []).concat(scholT2Enabled ? t2Columns : []).concat(scholT3Enabled ? t3Columns : [])).reduce((sum, col) => sum + (col.minMarks !== undefined ? col.minMarks : Math.round((sub.customMaxMarks?.[col.id] ?? col.maxMarks) * 0.33)), 0)}
                                              </td>
                                            )}
                                            {showMaxMarksColumn && (
                                              <td className={`border border-gray-955 ${cellPaddingClass} font-mono text-gray-700 bg-sky-50/20 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                                {subMetrics.maxOverallMarksPossible}
                                              </td>
                                            )}
                                            {showObtainedMarksColumn && (
                                              <td className={`border border-gray-955 ${cellPaddingClass} font-black font-mono text-black bg-sky-50/20 ${tableFontSizeClass} text-center whitespace-nowrap`}>
                                                {subMetrics.overallRound}
                                              </td>
                                            )}
                                          </React.Fragment>
                                        )
                                      )}
                                      {showOverallGrade && (
                                        <td 
                                          className={`border border-gray-955 ${cellPaddingClass} font-black font-mono text-black bg-rose-50/10 ${tableFontSizeClass} text-center`}
                                        >
                                          {subMetrics.grade}
                                        </td>
                                      )}
                                    </>
                                  )}
                                </tr>
                              </React.Fragment>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  );
                })()}
              </div>              {/* Separate Scholastic Total & Percentage Table (Only shown when multiple terms are active and NOT in pure grade-only mode) */}
              {activeTermsCount > 1 && !pureGradeBased && (
                <div className="overflow-x-auto no-scrollbar print:overflow-visible mt-1">
                  {(() => {
                    const termsCount = (scholT1Enabled ? 1 : 0) + (scholT2Enabled ? 1 : 0) + (scholT3Enabled ? 1 : 0);
                    const summColWidth = 100 - (20 * termsCount);
                    return (
                      <table className="w-full table-fixed border-collapse border border-gray-900 text-center text-[10px] select-all">
                        <colgroup>
                          <col style={{ width: `${summColWidth}%` }} />
                          {scholT1Enabled && <col style={{ width: '20%' }} />}
                          {scholT2Enabled && <col style={{ width: '20%' }} />}
                          {scholT3Enabled && <col style={{ width: '20%' }} />}
                        </colgroup>
                        <thead>
                          <tr className="bg-gray-100/70 border-b border-gray-950 font-bold">
                            <th className="border border-gray-950 p-1.5 text-left pl-2 font-black text-gray-900 text-[10px] uppercase">
                              {scholasticSummaryLabel}
                            </th>
                            {scholT1Enabled && (
                              <th className="border border-gray-950 p-1.5 font-black text-gray-900 text-[10px] uppercase">
                                Term 1
                              </th>
                            )}
                            {scholT2Enabled && (
                              <th className="border border-gray-950 p-1.5 font-black text-gray-900 text-[10px] uppercase">
                                Term 2
                              </th>
                            )}
                            {scholT3Enabled && (
                              <th className="border border-gray-950 p-1.5 font-black text-gray-900 text-[10px] uppercase">
                                Term 3
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-gray-50/20 font-bold border-b border-gray-900">
                            <td className="border border-gray-950 p-1.5 text-left pl-2 font-black text-black">
                              Marks Obtained
                            </td>
                            {scholT1Enabled && (
                              <td className="border border-gray-950 p-1.5 font-black font-mono text-black bg-gray-100/20">
                                {t1TotalObtained} / {t1MaxMarksPossible}
                              </td>
                            )}
                            {scholT2Enabled && (
                              <td className="border border-gray-950 p-1.5 font-black font-mono text-black bg-gray-100/20">
                                {t2TotalObtained} / {t2MaxMarksPossible}
                              </td>
                            )}
                            {scholT3Enabled && (
                              <td className="border border-gray-950 p-1.5 font-black font-mono text-black bg-gray-100/20">
                                {t3TotalObtained} / {t3MaxMarksPossible}
                              </td>
                            )}
                          </tr>
                          <tr className="bg-gray-50/20 font-bold">
                            <td className="border border-gray-950 p-1.5 text-left pl-2 font-black text-black">
                              Percentage
                            </td>
                            {scholT1Enabled && (
                              <td className="border border-gray-950 p-1.5 font-black font-mono text-black bg-gray-100/20">
                                {t1Percentage.toFixed(1)}%
                              </td>
                            )}
                            {scholT2Enabled && (
                              <td className="border border-gray-950 p-1.5 font-black font-mono text-black bg-gray-100/20">
                                {t2Percentage.toFixed(1)}%
                              </td>
                            )}
                            {scholT3Enabled && (
                              <td className="border border-gray-950 p-1.5 font-black font-mono text-black bg-gray-100/20">
                                {t3Percentage.toFixed(1)}%
                              </td>
                            )}
                          </tr>
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              )}              {/* Separate Additional Subjects Table (Rendered only if additional subjects are enabled and some exist) */}
              {hasAdditionalActive && branding.additionalSubjectsAfterAttendance !== true && renderAdditionalSubjectsTable()}

              {/* Combined summary status details bar (Attendance, Total overall average % and final Grade keys) */}
              <div className={`summary-status-bar grid ${pureGradeBased 
                ? (hideAttendance ? 'grid-cols-1' : 'grid-cols-2') 
                : (hideAttendance ? 'grid-cols-3' : 'grid-cols-4')} border border-gray-900 text-center font-mono text-[10px] select-none`}>
                {!hideAttendance && (
                  <div className="border-r border-gray-900 p-2 space-y-0.5 flex flex-col justify-center">
                    <strong className="block text-[9px] font-sans font-black text-black uppercase">{attendanceLabel}</strong>
                    <span className="text-xs font-black text-black">
                      {grades.attendance?.term1 && typeof grades.attendance?.term1 === 'object' ? String((grades.attendance?.term1 as any)?.term1 || '') : String(grades.attendance?.term1 || '')}
                    </span>
                  </div>
                )}
                
                {!pureGradeBased && (
                  <>
                    <div className="border-r border-gray-900 p-2 space-y-0.5">
                      <strong className="block text-[9px] font-sans font-black text-black uppercase">{totalMarksObtainedLabel}</strong>
                      <span className="text-sm font-black text-black">
                        {totalOverallMarks.toFixed(1)} / {totalMaxMarksPossible}
                      </span>
                    </div>

                    <div className="border-r border-gray-900 p-2 space-y-0.5">
                      <strong className="block text-[9px] font-sans font-black text-black uppercase">{gradePercentageLabel}</strong>
                      <span className="text-sm font-black text-black">{averagePercentage.toFixed(2)} %</span>
                    </div>
                  </>
                )}

                <div 
                  style={{ backgroundColor: branding.themeColor }}
                  className="p-2 space-y-0.5 flex flex-col justify-center items-center text-white"
                >
                  <strong className="block text-[8.5px] font-sans font-bold opacity-95 uppercase text-white">{boardGradeLabel}</strong>
                  <span className="text-sm sm:text-base font-black text-white">{averageGrade}</span>
                </div>
              </div>

              {hasAdditionalActive && branding.additionalSubjectsAfterAttendance === true && renderAdditionalSubjectsTable()}
            </div>
          )}

          {!hasScholasticActive && !hideAttendance && (
            <div className="relative z-10 flex border border-gray-900 items-center justify-between p-2.5 font-mono text-[10px] select-none rounded-sm bg-gray-50/15">
              <span className="font-sans font-black text-black uppercase pl-1.5">{attendancePresenceLabel}</span>
              <span className="text-xs font-black text-black pr-1.5">{grades.attendance?.term1 && typeof grades.attendance?.term1 === 'object' ? String((grades.attendance?.term1 as any)?.term1 || '') : String(grades.attendance?.term1 || "Present")}</span>
            </div>
          )}

          {/* Dynamic Parts / Co-Scholastic and Activity areas checklist */}
          {(() => {
            const activeSections = (coScholasticSections && coScholasticSections.length > 0)
              ? coScholasticSections
              : [
                  {
                    id: 'co_scholastic',
                    title: personalityHeaderLabel,
                    subjectHeader: personalitySubjectHeaderLabel,
                    gradingScaleText: '5-Point Scale',
                    term1Enabled: term1Enabled,
                    term2Enabled: term2Enabled,
                    type: 'co_scholastic' as const
                  },
                  {
                    id: 'activity',
                    title: coCurricularHeaderLabel,
                    subjectHeader: coCurricularSubjectHeaderLabel,
                    gradingScaleText: '3-Point Scale',
                    term1Enabled: term1Enabled && !branding.coCurricularDisabled,
                    term2Enabled: term2Enabled && !branding.coCurricularDisabled,
                    type: 'activity' as const
                  }
                ];

            const printableSections = activeSections.filter(sec => {
              const secT1 = term1Enabled && sec.term1Enabled !== false;
              const secT2 = term2Enabled && sec.term2Enabled !== false;
              const secT3 = term3Enabled && sec.term3Enabled !== false;
              return secT1 || secT2 || secT3;
            });

            if (printableSections.length === 0) return null;

            return (
              <div className={`relative z-10 grid gap-4 ${(printableSections.length > 1 && !coScholasticOneColumn) ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {printableSections.map((sec) => {
                  const secT1 = term1Enabled && sec.term1Enabled !== false;
                  const secT2 = term2Enabled && sec.term2Enabled !== false;
                  const secT3 = term3Enabled && sec.term3Enabled !== false;
                  const totalCOLS = 1 + (secT1 ? 1 : 0) + (secT2 ? 1 : 0) + (secT3 ? 1 : 0);

                  const matchingSubjects = subjects.filter(s => 
                    s.sectionId === sec.id || 
                    (s.type === sec.type && (!s.sectionId || s.sectionId === sec.id))
                  );

                  if (matchingSubjects.length === 0) return null;

                  const activeTermsForSec = (secT1 ? 1 : 0) + (secT2 ? 1 : 0) + (secT3 ? 1 : 0);
                  const subjColWidth = 100 - (16 * activeTermsForSec);

                  return (
                    <div key={sec.id} className="space-y-1 overflow-x-auto no-scrollbar print:overflow-visible">
                      <table className="w-full table-fixed border-collapse border border-gray-900 text-center text-[10px]">
                        <colgroup>
                          <col style={{ width: `${subjColWidth}%` }} />
                          {secT1 && <col style={{ width: '16%' }} />}
                          {secT2 && <col style={{ width: '16%' }} />}
                          {secT3 && <col style={{ width: '16%' }} />}
                        </colgroup>
                        <thead>
                          <tr className="bg-gray-100/70 border-b border-gray-955">
                            <th 
                              colSpan={totalCOLS} 
                              className="border border-gray-955 p-1.5 text-center font-black text-gray-900 text-xs tracking-wider uppercase bg-gray-100/70"
                            >
                              {sec.title}
                            </th>
                          </tr>
                          <tr className="bg-gray-50/50 font-semibold border-b border-gray-900">
                            <th className="border border-gray-900 p-1.5 text-left font-bold text-gray-700">{sec.subjectHeader}</th>
                            {secT1 && <th className="border border-gray-900 p-1.5 w-18 font-bold">{branding.term1Label || "Term 1"}</th>}
                            {secT2 && <th className="border border-gray-900 p-1.5 w-18 font-bold">{branding.term2Label || "Term 2"}</th>}
                            {secT3 && <th className="border border-gray-900 p-1.5 w-18 font-bold">{branding.term3Label || "Term 3"}</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            return matchingSubjects.map((sub, sIdx) => {
                              const showGroupHdr = isGroupingActive && Boolean(sub.group && sub.group.trim()) && (sIdx === 0 || matchingSubjects[sIdx - 1]?.group !== sub.group);
                              const gradesMap = sec.type === 'activity' ? (grades.activity || {}) : (grades.co_scholastic || {});
                              const sc = gradesMap[sub.id] || { term1: '-', term2: '-', term3: '-' };
                              return (
                                <React.Fragment key={sub.id}>
                                  {showGroupHdr && (
                                    <tr key={`sec_group_hdr_${sub.group}_${sIdx}`} className="bg-gray-100/90 font-bold border-b border-gray-900">
                                      <td 
                                        colSpan={totalCOLS} 
                                        className="p-1.5 pl-2 text-left font-black text-gray-900 bg-gray-100/90 text-[10px] uppercase tracking-wide border border-gray-900"
                                      >
                                        {sub.group}
                                      </td>
                                    </tr>
                                  )}
                                  <tr id={`preview_subject_row_${sub.id}`} className="hover:bg-gray-50/20 font-sans border-b border-gray-900">
                                    <td className="border border-gray-900 p-1.5 text-left font-bold text-black text-[10px]">
                                      {isGroupingActive && sub.group ? (
                                        <span className="inline-flex items-center pl-2.5">
                                          <span className="text-gray-500 font-semibold mr-1.5">-</span>
                                          {sub.name.startsWith('- ') ? sub.name.substring(2) : sub.name}
                                        </span>
                                      ) : sub.name.startsWith('- ') ? (
                                        <span className="inline-flex items-center pl-2.5">
                                          <span className="text-gray-600 font-bold mr-1.5">-</span>
                                          {sub.name.substring(2)}
                                        </span>
                                      ) : (
                                        sub.name
                                      )}
                                    </td>
                                    {secT1 && <td className="border border-gray-900 p-1 font-bold text-center font-mono text-[10px] text-black">{sc.term1 || '-'}</td>}
                                    {secT2 && <td className="border border-gray-900 p-1 font-bold text-center font-mono text-[10px] text-black">{sc.term2 || '-'}</td>}
                                    {secT3 && <td className="border border-gray-900 p-1 font-bold text-center font-mono text-[10px] text-black">{sc.term3 || '-'}</td>}
                                  </tr>
                                </React.Fragment>
                              );
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Grade Rules Scale Chart list (Before Signatures Position) */}
          {!hideGradingScale && !gradingScaleAfterSignatures && renderGradingScalesRow(gradingScaleLayout === 'stacked')}

          {/* Teacher custom remarks and Promotion status box */}
          <div className="relative z-10 border border-gray-900 p-3 grid grid-cols-12 gap-3 bg-white text-[11px] group">
            <div className={`${branding.congratulationsDisabled ? 'col-span-12' : 'col-span-8'} space-y-1`}>
              <div className="flex items-center justify-between">
                <strong className="text-gray-900 font-bold uppercase tracking-tight text-[9.5px]">Teacher's Remarks:</strong>
                {onUpdateRemarks && (
                  <button
                    type="button"
                    onClick={() => setIsAiRemarksOpen(true)}
                    className="no-print inline-flex items-center gap-1 text-[9.5px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-900 px-2 py-0.5 rounded border border-indigo-200 shadow-2xs transition-all cursor-pointer"
                    title="Generate Teacher Remarks with AI"
                  >
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    <span>✨ AI Remarks</span>
                  </button>
                )}
              </div>
              <p className="text-gray-700 font-medium italic mt-0.5 leading-relaxed">
                {student.remarks || "Student has demonstrated magnificent educational and sportsmanship levels throughout the calendar sessions."}
              </p>
            </div>
            
            {!branding.congratulationsDisabled && (
              <div 
                className="col-span-4 flex items-center justify-center text-center font-black uppercase text-[11px] border-l pl-3 shrink-0"
                style={{ color: branding.themeColor, borderColor: 'var(--theme-border)' }}
              >
                {student.promotionStatus || "Congratulations! You are promoted."}
              </div>
            )}
          </div>

          {/* Dynamic/Default signature containers */}
          {(() => {
            const sigsToRender = (signatures && signatures.length > 0)
              ? signatures
              : [
                  { id: 'parent', label: branding.signParentName || "Parent's Signature" },
                  { id: 'incharge', label: branding.signInchargeName || "Class Incharge Signature" },
                  { id: 'principal', label: branding.signPrincipalName || "Principal Signature" }
                ];
            return (
              <div 
                className="relative z-10 grid gap-6 pt-3 text-center text-[10px] font-bold text-gray-700 print:pt-1.5"
                style={{ gridTemplateColumns: `repeat(${sigsToRender.length}, minmax(0, 1fr))` }}
              >
                {sigsToRender.map((sig) => (
                  <div key={sig.id} className="sig-col flex flex-col justify-end items-center h-[45px] print:h-[32px]">
                    <div className="w-full border-t border-gray-900 pt-1">{sig.label}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Grade Rules Scale Chart list (After Signatures Position option) */}
          {!hideGradingScale && gradingScaleAfterSignatures && renderGradingScalesRow(true)}

        </div>
      </div>
        </div>
      </div>

      {/* AI Remarks Assistant Modal */}
      {isAiRemarksOpen && (
        <AiRemarksModal
          isOpen={isAiRemarksOpen}
          onClose={() => setIsAiRemarksOpen(false)}
          mode="single"
          student={student}
          studentGrades={grades ? [grades] : []}
          subjects={subjects}
          scoreColumns={scoreColumns}
          gradeScales={gradeScales}
          schoolName={branding.schoolName}
          term1Active={scholT1Enabled}
          term2Active={scholT2Enabled}
          term3Active={scholT3Enabled}
          onApplySingleRemark={(remark, promo) => {
            if (onUpdateRemarks) {
              onUpdateRemarks(remark, promo);
            }
          }}
        />
      )}
    </div>
  );
}
