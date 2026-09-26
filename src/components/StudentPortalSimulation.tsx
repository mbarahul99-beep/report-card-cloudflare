import React, { useState } from 'react';
import { Student, StudentGrades, SubjectColumn, ScoreColumn, GradeScale, SchoolBranding, SaasSchool, ReportCardStructure, ParentPortalLoginConfig } from '../types';
import ReportCardPreview from './ReportCardPreview';
import { Search, Info, HelpCircle, GraduationCap, Copy, Check, RefreshCw, Users, Globe, Code, ExternalLink, FileJson, KeyRound, Smartphone, Calendar, Hash, ShieldCheck, AlertCircle } from 'lucide-react';
import { getParentPortalLoginConfig, ParentLoginMethod } from '../utils/parentPortalAuth';

interface PortalProps {
  students: Student[];
  studentGrades: StudentGrades[];
  subjects: SubjectColumn[];
  scoreColumns: ScoreColumn[];
  gradeScales: GradeScale[];
  branding: SchoolBranding;
  schools?: SaasSchool[];
  currentSchoolId?: string | null;
  onUpdatePortalCode?: (schoolId: string, newCode: string) => void;
  onImpersonateParent?: (studentId: string) => void;
  onUpdateBranding?: (branding: SchoolBranding) => void;
  reportCardStructures?: ReportCardStructure[];
}

export default function StudentPortalSimulation({
  students,
  studentGrades,
  subjects,
  scoreColumns,
  gradeScales,
  branding: propBranding,
  schools = [],
  currentSchoolId = null,
  onUpdatePortalCode,
  onImpersonateParent,
  onUpdateBranding,
  reportCardStructures = []
}: PortalProps) {
  const branding = propBranding || {
    schoolName: 'School Report Card',
    themeColor: '#4f46e5',
    borderColor: '#D12121',
  } as SchoolBranding;

  const [searchQuery, setSearchQuery] = useState('');
  const [queried, setQueried] = useState(false);
  const [foundStudent, setFoundStudent] = useState<Student | null>(null);
  const [foundGrades, setFoundGrades] = useState<StudentGrades | null>(null);
  const [copied, setCopied] = useState(false);

  const [directorySearch, setDirectorySearch] = useState('');
  const [copiedLinkStudentId, setCopiedLinkStudentId] = useState<string | null>(null);

  const [integrationTab, setIntegrationTab] = useState<'iframe' | 'standalone'>('iframe');
  const [copiedIntegration, setCopiedIntegration] = useState(false);

  // Find the current school
  const currentSchool = schools.find(s => s.id === currentSchoolId);

  const handleCopyCode = () => {
    if (!currentSchool?.portalCode) return;
    navigator.clipboard.writeText(currentSchool.portalCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerateCode = () => {
    if (!currentSchoolId || !onUpdatePortalCode) return;
    // Generate code with school abbreviation + random 4 digit number
    const schoolName = branding?.schoolName || 'School Report Card';
    const prefix = schoolName.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'SCH';
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const newCode = `${prefix}-${randNum}`;
    onUpdatePortalCode(currentSchoolId, newCode);
  };

  const handleQuery = (e: React.FormEvent) => {
    e.preventDefault();
    setQueried(true);
    
    const cleanQuery = searchQuery.trim().toLowerCase();
    if (!cleanQuery) return;

    // Search by Roll No or Admission No
    const std = students.find(s => 
      s.rollNo.toString().toLowerCase() === cleanQuery || 
      s.admissionNo.toLowerCase() === cleanQuery ||
      s.name.toLowerCase() === cleanQuery
    );

    if (std) {
      setFoundStudent(std);
      const gd = studentGrades.find(g => g.studentId === std.id);
      setFoundGrades(gd || null);
    } else {
      setFoundStudent(null);
      setFoundGrades(null);
    }
  };

  const handleClear = () => {
    setSearchQuery('');
    setQueried(false);
    setFoundStudent(null);
    setFoundGrades(null);
  };

  const activeLoginConfig = getParentPortalLoginConfig(branding, reportCardStructures);

  const handleUpdateLoginMethodToggle = (key: keyof ParentPortalLoginConfig, value: boolean) => {
    if (!onUpdateBranding) return;
    const current = branding.parentPortalLoginConfig || {
      rollNoDobEnabled: true,
      admissionNoDobEnabled: false,
      mobileRollNoEnabled: false,
      mobileAdmissionNoEnabled: false,
      defaultLoginMode: 'roll_dob',
    };

    // Calculate how many methods will remain active
    const candidate = { ...current, [key]: value };
    const resolvedCandidate = getParentPortalLoginConfig({
      ...branding,
      parentPortalLoginConfig: candidate,
    }, reportCardStructures);

    if (resolvedCandidate.availableMethods.length === 0) {
      alert("At least one login option must remain enabled for parents.");
      return;
    }

    // If default method is being turned off, pick the first remaining available method
    let newDefault = current.defaultLoginMode;
    if (!resolvedCandidate.availableMethods.includes(newDefault)) {
      newDefault = resolvedCandidate.availableMethods[0];
    }

    onUpdateBranding({
      ...branding,
      parentPortalLoginConfig: {
        ...candidate,
        defaultLoginMode: newDefault,
      },
    });
  };

  const handleUpdateDefaultMethod = (mode: ParentLoginMethod) => {
    if (!onUpdateBranding) return;
    const current = branding.parentPortalLoginConfig || {
      rollNoDobEnabled: true,
      admissionNoDobEnabled: false,
      mobileRollNoEnabled: false,
      mobileAdmissionNoEnabled: false,
      defaultLoginMode: 'roll_dob',
    };
    onUpdateBranding({
      ...branding,
      parentPortalLoginConfig: {
        ...current,
        defaultLoginMode: mode,
      },
    });
  };

  const handleCopyInvite = (student: Student) => {
    const origin = window.location.origin;
    const directLink = `${origin}/?portal=parent&code=${currentSchool?.portalCode || 'XAVI-9821'}&roll=${student.rollNo}&dob=${student.dob}${student.admissionNo && !student.admissionNo.startsWith('adm_') ? `&adm=${student.admissionNo}` : ''}${student.mobileNumber ? `&mob=${student.mobileNumber}` : ''}`;
    
    const methods = activeLoginConfig.availableMethods;
    let methodInstructions = '';
    if (methods.includes('roll_dob')) {
      methodInstructions += `\n• Option 1: Roll No (${student.rollNo}) + Date of Birth (${student.dob})`;
    }
    if (methods.includes('adm_dob') && student.admissionNo && !student.admissionNo.startsWith('adm_')) {
      methodInstructions += `\n• Option 2: Admission No (${student.admissionNo}) + Date of Birth (${student.dob})`;
    }
    if (methods.includes('mob_roll') && student.mobileNumber) {
      methodInstructions += `\n• Option 3: Registered Mobile (${student.mobileNumber}) + Roll No (${student.rollNo})`;
    }
    if (methods.includes('mob_adm') && student.mobileNumber && student.admissionNo && !student.admissionNo.startsWith('adm_')) {
      methodInstructions += `\n• Option 4: Registered Mobile (${student.mobileNumber}) + Admission No (${student.admissionNo})`;
    }

    const text = `Dear Parent, you can view your child ${student.name}'s report card on the official school reports portal.\n\nInstructions:\n1. Website: ${origin}\n2. Choose Tab: Parents Portal\n3. Portal Access Code: ${currentSchool?.portalCode || 'XAVI-9821'}\n4. Login using your enabled credential:${methodInstructions || `\n• Roll No: ${student.rollNo} and DOB: ${student.dob}`}\n\nDirect Access Link: ${directLink}`;
    
    navigator.clipboard.writeText(text);
    setCopiedLinkStudentId(student.id);
    setTimeout(() => setCopiedLinkStudentId(null), 2000);
  };

  const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://class-on-reports.com';
  const portalCode = currentSchool?.portalCode || 'XAVI-9821';

  // Option 1: iframe embed code
  const iframeCode = `<iframe 
  src="${appOrigin}/?portal=parent&code=${portalCode}" 
  style="border: none; width: 100%; height: 750px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);" 
  title="Parents Portal"
  allow="clipboard-write"
></iframe>`;

  // Option 2: standalone login gate html code
  const standaloneHtmlCode = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Parents Reports Portal - ${branding?.schoolName || 'School Report Card'}</title>
  <!-- Load Tailwind CSS for beautiful styling -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Load elegant Inter font -->
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Inter', sans-serif;
    }
  </style>
</head>
<body class="bg-slate-50 min-h-screen flex items-center justify-center p-4">

  <div class="w-full max-w-md bg-white rounded-2xl border border-slate-100 shadow-xl overflow-hidden transition-all duration-300 hover:shadow-2xl">
    <!-- Header with custom brand color -->
    <div style="background-color: ${branding?.themeColor || '#4f46e5'}" class="p-6 text-white text-center relative">
      <div class="mx-auto w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mb-3">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6 text-white">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A5.906 5.906 0 0 1 1.151 6.097a12.018 12.018 0 0 1 20.081 0 5.908 5.908 0 0 1-1.15 3.237 50.636 50.636 0 0 0-2.658.813m-11.162 0A51.339 51.339 0 0 1 12 12.5c2.117 0 4.167-.127 6.162-.373m-11.162 0a50.64 50.64 0 0 0-1.575-3.023m14.312 3.023a50.64 50.64 0 0 1 1.575-3.023m-3.4 15.622a2.25 2.25 0 0 0 2.25-2.25V18.14" />
        </svg>
      </div>
      <h2 class="text-lg font-extrabold tracking-tight">\${encodeHtml("${branding?.schoolName || 'School Report Card'}")}</h2>
      <p class="text-xs text-white/85 mt-1">Parents Online Report Card Gateway</p>
    </div>

    <!-- Login Form -->
    <form id="portalLoginForm" class="p-6 sm:p-8 space-y-4">
      
      <!-- Port Access Code (read-only / auto prefilled) -->
      <div class="space-y-1">
        <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Access Code</label>
        <input 
          type="text" 
          value="${portalCode}" 
          id="accessCode" 
          readonly
          class="w-full px-3 py-2.5 bg-slate-100 border border-slate-200 text-slate-500 font-mono font-bold rounded-lg text-sm outline-none cursor-not-allowed"
          required
        >
      </div>

      <!-- Roll Number Input -->
      <div class="space-y-1">
        <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Student Roll Number</label>
        <input 
          type="text" 
          id="rollNo" 
          placeholder="e.g. 10 or 12" 
          class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 focus:bg-white rounded-lg text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 font-medium transition"
          required
        >
      </div>

      <!-- Date of Birth Input -->
      <div class="space-y-1">
        <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Student Date of Birth (DOB)</label>
        <input 
          type="date" 
          id="dob" 
          class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 focus:bg-white rounded-lg text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-600 font-semibold font-mono transition"
          required
        >
      </div>

      <!-- Submit Button -->
      <button 
        type="submit" 
        style="background-color: ${branding.themeColor || '#4f46e5'}"
        class="w-full text-white font-bold py-3 px-4 rounded-xl text-xs tracking-wider uppercase shadow-md active:scale-95 transition duration-150 hover:brightness-110 mt-2 flex items-center justify-center gap-1.5"
      >
        <span>Access Report Card</span>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="w-3.5 h-3.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
        </svg>
      </button>

    </form>
    
    <!-- Footer Branding -->
    <div class="bg-slate-50 px-6 py-4 border-t border-slate-100 text-center text-[10px] text-slate-400 font-medium">
      Security provided by School Report Card &bull; &copy; 2026
    </div>
  </div>

  <script>
    document.getElementById('portalLoginForm').addEventListener('submit', function(e) {
      e.preventDefault();
      const code = document.getElementById('accessCode').value.trim();
      const roll = document.getElementById('rollNo').value.trim();
      const dob = document.getElementById('dob').value;
      
      if (!code || !roll || !dob) {
        alert('Please fill out all inputs correctly.');
        return;
      }
      
      // Redirect to the parents portal on the central secure cluster
      const centralUrl = "${appOrigin}/?portal=parent&code=" + encodeURIComponent(code) + "&roll=" + encodeURIComponent(roll) + "&dob=" + encodeURIComponent(dob);
      window.open(centralUrl, '_blank');
    });
  </script>
</body>
</html>`;

  function encodeHtml(str: string) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  const handleCopyIntegrationCode = (codeText: string) => {
    navigator.clipboard.writeText(codeText);
    setCopiedIntegration(true);
    setTimeout(() => setCopiedIntegration(false), 2000);
  };

  return (
    <div className="space-y-6">
      
      {/* Official Parents Portal Code Setup banner */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 sm:p-6 shadow-xs relative overflow-hidden animate-fadeIn no-print">
        <div className="absolute right-0 bottom-0 opacity-[0.03] pointer-events-none transform translate-y-6 translate-x-6">
          <GraduationCap className="w-56 h-56 text-slate-800" />
        </div>
        <div className="space-y-4 relative z-10">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <span className="text-[10px] font-sans font-extrabold tracking-wider uppercase text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-full">School Integration Portal</span>
              <h3 className="font-extrabold text-slate-900 text-base mt-1.5 flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-indigo-600" />
                Parents Portal Access Code
              </h3>
              <p className="text-xs text-slate-500 max-w-xl mt-1 leading-relaxed">
                This unique access code allows parents to log in securely from the main portal with their ward's <strong>Roll No</strong> and <strong>Date of Birth (DOB)</strong> to view or print official status report cards.
              </p>
            </div>
            
            {/* The Code Display */}
            <div className="bg-white border-2 border-dashed border-indigo-200 p-4 rounded-xl text-center space-y-1 shadow-sm shrink-0 w-full sm:w-auto sm:min-w-[200px]">
              <span className="text-[9px] uppercase font-extrabold text-indigo-500 tracking-wider">Parents Access Code</span>
              <div className="text-xl font-black font-mono tracking-wider text-slate-900 flex items-center justify-center gap-1.5 uppercase select-all">
                {currentSchool?.portalCode || 'XAVI-4821'}
              </div>
              
              <div className="flex justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="text-[10.5px] font-bold text-indigo-600 hover:text-indigo-800 transition flex items-center gap-1 underline cursor-pointer"
                  title="Copy Code"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
          
          <div className="border-t border-indigo-100 pt-4 flex flex-col sm:flex-row justify-between gap-4 text-xs text-indigo-900 font-sans leading-relaxed">
            <div>
              <h4 className="font-bold text-slate-800 text-xs mb-1">How do parents log in?</h4>
              <ol className="list-decimal pl-4 space-y-1 font-medium text-slate-500 text-[11px]">
                <li>Give them this Access Code (e.g. <strong>{currentSchool?.portalCode || 'XAVI-9821'}</strong>).</li>
                <li>They visit the login page and click the <strong>Parents Portal</strong> tab.</li>
                <li>They enter this <strong>Access Code</strong>, the student's <strong>Roll Number</strong>, and <strong>DOB</strong> to get instant secure results!</li>
              </ol>
            </div>
            <div className="sm:max-w-xs text-[10.5px] text-indigo-700 bg-indigo-100/40 p-3 rounded-lg border border-indigo-100/50">
              <strong>💡 Administrator Note:</strong> This is completely safe, offline-capable code. It avoids unnecessary data overhead and ensures parents only see their specific child's verified report card.
            </div>
          </div>
        </div>
      </div>

      {/* Parents Portal Control Desk Settings and Feature Configuration */}
      <div className="bg-slate-900 border border-slate-850 rounded-xl p-5 sm:p-6 shadow-md text-white space-y-4 no-print animate-fadeIn">
        <div className="flex items-center gap-2.5 border-b border-slate-800 pb-3">
          <div className="bg-indigo-600/20 p-2 rounded-lg text-indigo-400">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-white text-sm sm:text-base">
              Parents Portal Visibility Control Desk
            </h3>
            <p className="text-[11px] text-slate-400">
              Configure which sections are viewable to parents when they access their child's Parents Portal dashboard.
            </p>
          </div>
        </div>

        {onUpdateBranding ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
            
            {/* Toggle 1: Analytics Dashboard */}
            <div className="bg-slate-850/50 border border-slate-800 p-4 rounded-xl flex items-start gap-3 hover:border-slate-700 transition">
              <input
                id="portal_analytics_toggle"
                type="checkbox"
                checked={branding.parentPortalAnalyticsDisabled !== true}
                onChange={(e) => onUpdateBranding({ ...branding, parentPortalAnalyticsDisabled: !e.target.checked })}
                className="w-4.5 h-4.5 text-indigo-600 border-slate-700 rounded bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 mt-0.5 cursor-pointer"
              />
              <div className="space-y-0.5 cursor-pointer" onClick={() => onUpdateBranding({ ...branding, parentPortalAnalyticsDisabled: !branding.parentPortalAnalyticsDisabled })}>
                <label htmlFor="portal_analytics_toggle" className="text-xs font-bold text-slate-100 cursor-pointer block">
                  Interactive Progress Dashboard
                </label>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Displays student percentage metrics, grade bands, and dynamic performance charts.
                </p>
              </div>
            </div>

            {/* Toggle 2: Attendance statistics */}
            <div className="bg-slate-850/50 border border-slate-800 p-4 rounded-xl flex items-start gap-3 hover:border-slate-700 transition">
              <input
                id="portal_attendance_toggle"
                type="checkbox"
                checked={branding.parentPortalAttendanceDisabled !== true}
                onChange={(e) => onUpdateBranding({ ...branding, parentPortalAttendanceDisabled: !e.target.checked })}
                className="w-4.5 h-4.5 text-indigo-600 border-slate-700 rounded bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 mt-0.5 cursor-pointer"
              />
              <div className="space-y-0.5 cursor-pointer" onClick={() => onUpdateBranding({ ...branding, parentPortalAttendanceDisabled: !branding.parentPortalAttendanceDisabled })}>
                <label htmlFor="portal_attendance_toggle" className="text-xs font-bold text-slate-100 cursor-pointer block">
                  Attendance Percentage Gauge
                </label>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Calculates and displays annual presents/total working days ratio as a colorful widget.
                </p>
              </div>
            </div>

            {/* Toggle 3: Rankings Comparison */}
            <div className="bg-slate-850/50 border border-slate-800 p-4 rounded-xl flex items-start gap-3 hover:border-slate-700 transition">
              <input
                id="portal_rank_toggle"
                type="checkbox"
                checked={branding.parentPortalTopperStatsDisabled !== true}
                onChange={(e) => onUpdateBranding({ ...branding, parentPortalTopperStatsDisabled: !e.target.checked })}
                className="w-4.5 h-4.5 text-indigo-600 border-slate-700 rounded bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 mt-0.5 cursor-pointer"
              />
              <div className="space-y-0.5 cursor-pointer" onClick={() => onUpdateBranding({ ...branding, parentPortalTopperStatsDisabled: !branding.parentPortalTopperStatsDisabled })}>
                <label htmlFor="portal_rank_toggle" className="text-xs font-bold text-slate-100 cursor-pointer block">
                  Class Comparative Benchmarks
                </label>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Compares subject scores against class averages and highest mark boundaries on charts.
                </p>
              </div>
            </div>

            {/* Toggle 4: Remarks Box */}
            <div className="bg-slate-850/50 border border-slate-800 p-4 rounded-xl flex items-start gap-3 hover:border-slate-700 transition">
              <input
                id="portal_remarks_toggle"
                type="checkbox"
                checked={branding.parentPortalRemarksDisabled !== true}
                onChange={(e) => onUpdateBranding({ ...branding, parentPortalRemarksDisabled: !e.target.checked })}
                className="w-4.5 h-4.5 text-indigo-600 border-slate-700 rounded bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 mt-0.5 cursor-pointer"
              />
              <div className="space-y-0.5 cursor-pointer" onClick={() => onUpdateBranding({ ...branding, parentPortalRemarksDisabled: !branding.parentPortalRemarksDisabled })}>
                <label htmlFor="portal_remarks_toggle" className="text-xs font-bold text-slate-100 cursor-pointer block">
                  Remarks &amp; Promotion Box
                </label>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Renders the subjective class teacher assessment remarks and standard promotion status badge.
                </p>
              </div>
            </div>

            {/* Toggle 5: Formal Printable PDF Card button */}
            <div className="bg-slate-850/50 border border-slate-800 p-4 rounded-xl flex items-start gap-3 hover:border-slate-700 transition">
              <input
                id="portal_reportcard_toggle"
                type="checkbox"
                checked={branding.parentPortalReportCardDisabled !== true}
                onChange={(e) => onUpdateBranding({ ...branding, parentPortalReportCardDisabled: !e.target.checked })}
                className="w-4.5 h-4.5 text-indigo-600 border-slate-700 rounded bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 mt-0.5 cursor-pointer"
              />
              <div className="space-y-0.5 cursor-pointer" onClick={() => onUpdateBranding({ ...branding, parentPortalReportCardDisabled: !branding.parentPortalReportCardDisabled })}>
                <label htmlFor="portal_reportcard_toggle" className="text-xs font-bold text-slate-100 cursor-pointer block">
                  Full Termly Report Card Viewer &amp; PDF Download
                </label>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Renders the official formatted board template so parents can view or download the paper card.
                </p>
              </div>
            </div>

            <div className="bg-indigo-950/40 border border-indigo-900/30 p-4 rounded-xl flex flex-col justify-center text-xs text-indigo-200">
              <div className="font-bold flex items-center gap-1.5 text-indigo-300">
                <Info className="w-3.5 h-3.5" /> Core Synchronization Note
              </div>
              <p className="text-[10.5px] mt-1 leading-relaxed text-indigo-300/80">
                Your selected filters synchronize across cloud databases instantly, updating parents' personal views in real-time.
              </p>
            </div>

          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">Branding editing controls are disabled in teacher clearance node roles.</p>
        )}
      </div>

      {/* Parents Portal Login Methods & Credentials Configuration Desk */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 shadow-md text-white space-y-5 no-print animate-fadeIn">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="bg-emerald-600/20 p-2 rounded-lg text-emerald-400 border border-emerald-500/20">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-white text-sm sm:text-base">
                  Parents Portal Login Methods &amp; Credentials Desk
                </h3>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  {activeLoginConfig.availableMethods.length} Active {activeLoginConfig.availableMethods.length === 1 ? 'Method' : 'Methods'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Enable any 1 or more login options. If a school does not use or print Admission Numbers or Mobile Numbers, the parents portal automatically conforms to the enabled methods.
              </p>
            </div>
          </div>

          {/* Default method selector if multiple are active */}
          {activeLoginConfig.availableMethods.length > 1 && onUpdateBranding && (
            <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 text-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Default Tab:</span>
              <select
                value={activeLoginConfig.defaultLoginMode}
                onChange={(e) => handleUpdateDefaultMethod(e.target.value as ParentLoginMethod)}
                className="bg-slate-900 text-white font-semibold text-xs rounded px-2 py-1 outline-none border border-slate-700 focus:border-indigo-500 cursor-pointer"
              >
                {activeLoginConfig.availableMethods.map(method => (
                  <option key={method} value={method}>
                    {method === 'roll_dob' && 'Roll No + DOB'}
                    {method === 'adm_dob' && 'Admission No + DOB'}
                    {method === 'mob_roll' && 'Mobile + Roll No'}
                    {method === 'mob_adm' && 'Mobile + Admission No'}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {onUpdateBranding ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {/* Option 1: Roll No + DOB */}
            <div className={`p-4 rounded-xl border transition ${activeLoginConfig.rollNoDobEnabled ? 'bg-slate-850/80 border-indigo-500/50 shadow-xs' : 'bg-slate-900/50 border-slate-800 opacity-60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <input
                    id="login_opt_roll_dob"
                    type="checkbox"
                    checked={activeLoginConfig.rollNoDobEnabled}
                    onChange={(e) => handleUpdateLoginMethodToggle('rollNoDobEnabled', e.target.checked)}
                    className="w-4.5 h-4.5 text-indigo-600 border-slate-700 rounded bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 mt-0.5 cursor-pointer"
                  />
                  <div className="space-y-1">
                    <label htmlFor="login_opt_roll_dob" className="text-xs font-bold text-slate-100 flex items-center gap-2 cursor-pointer">
                      <span>Roll Number + Date of Birth (DOB)</span>
                      {activeLoginConfig.defaultLoginMode === 'roll_dob' && activeLoginConfig.rollNoDobEnabled && (
                        <span className="text-[9px] bg-indigo-500/20 text-indigo-300 font-bold px-1.5 py-0.2 rounded border border-indigo-500/30">DEFAULT</span>
                      )}
                    </label>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Universal verification using student's assigned class Roll Number and verified Date of Birth. Ideal for all schools without admission numbers.
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${activeLoginConfig.rollNoDobEnabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>
                    {activeLoginConfig.rollNoDobEnabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>

            {/* Option 2: Admission No + DOB */}
            <div className={`p-4 rounded-xl border transition ${
              !activeLoginConfig.admissionFieldEnabled 
                ? 'bg-slate-900/30 border-slate-800/60 opacity-40' 
                : activeLoginConfig.admissionNoDobEnabled 
                  ? 'bg-slate-850/80 border-indigo-500/50 shadow-xs' 
                  : 'bg-slate-900/50 border-slate-800 opacity-60'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <input
                    id="login_opt_adm_dob"
                    type="checkbox"
                    disabled={!activeLoginConfig.admissionFieldEnabled}
                    checked={activeLoginConfig.admissionNoDobEnabled}
                    onChange={(e) => handleUpdateLoginMethodToggle('admissionNoDobEnabled', e.target.checked)}
                    className="w-4.5 h-4.5 text-indigo-600 border-slate-700 rounded bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 mt-0.5 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <div className="space-y-1">
                    <label htmlFor="login_opt_adm_dob" className="text-xs font-bold text-slate-100 flex items-center gap-2 cursor-pointer">
                      <span>Admission Number + Date of Birth (DOB)</span>
                      {activeLoginConfig.defaultLoginMode === 'adm_dob' && activeLoginConfig.admissionNoDobEnabled && (
                        <span className="text-[9px] bg-indigo-500/20 text-indigo-300 font-bold px-1.5 py-0.2 rounded border border-indigo-500/30">DEFAULT</span>
                      )}
                    </label>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Parent enters student's permanent Admission/Registration Number and Date of Birth.
                    </p>
                    {!activeLoginConfig.admissionFieldEnabled && (
                      <span className="inline-flex items-center gap-1 text-[9.5px] text-amber-400 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded font-medium mt-1">
                        <AlertCircle className="w-3 h-3" /> Auto-disabled (Admission No hidden in school layout)
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${activeLoginConfig.admissionNoDobEnabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>
                    {activeLoginConfig.admissionNoDobEnabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>

            {/* Option 3: Mobile Number + Roll Number */}
            <div className={`p-4 rounded-xl border transition ${activeLoginConfig.mobileRollNoEnabled ? 'bg-slate-850/80 border-indigo-500/50 shadow-xs' : 'bg-slate-900/50 border-slate-800 opacity-60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <input
                    id="login_opt_mob_roll"
                    type="checkbox"
                    checked={activeLoginConfig.mobileRollNoEnabled}
                    onChange={(e) => handleUpdateLoginMethodToggle('mobileRollNoEnabled', e.target.checked)}
                    className="w-4.5 h-4.5 text-indigo-600 border-slate-700 rounded bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 mt-0.5 cursor-pointer"
                  />
                  <div className="space-y-1">
                    <label htmlFor="login_opt_mob_roll" className="text-xs font-bold text-slate-100 flex items-center gap-2 cursor-pointer">
                      <span>Mobile Number + Roll Number</span>
                      {activeLoginConfig.defaultLoginMode === 'mob_roll' && activeLoginConfig.mobileRollNoEnabled && (
                        <span className="text-[9px] bg-indigo-500/20 text-indigo-300 font-bold px-1.5 py-0.2 rounded border border-indigo-500/30">DEFAULT</span>
                      )}
                    </label>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Parent enters their registered 10-digit mobile number and student's Roll Number. Multi-child sibling resolution dialog included automatically.
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${activeLoginConfig.mobileRollNoEnabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>
                    {activeLoginConfig.mobileRollNoEnabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>

            {/* Option 4: Mobile Number + Admission Number */}
            <div className={`p-4 rounded-xl border transition ${
              !activeLoginConfig.admissionFieldEnabled 
                ? 'bg-slate-900/30 border-slate-800/60 opacity-40' 
                : activeLoginConfig.mobileAdmissionNoEnabled 
                  ? 'bg-slate-850/80 border-indigo-500/50 shadow-xs' 
                  : 'bg-slate-900/50 border-slate-800 opacity-60'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <input
                    id="login_opt_mob_adm"
                    type="checkbox"
                    disabled={!activeLoginConfig.admissionFieldEnabled}
                    checked={activeLoginConfig.mobileAdmissionNoEnabled}
                    onChange={(e) => handleUpdateLoginMethodToggle('mobileAdmissionNoEnabled', e.target.checked)}
                    className="w-4.5 h-4.5 text-indigo-600 border-slate-700 rounded bg-slate-800 focus:ring-2 focus:ring-indigo-500/20 mt-0.5 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <div className="space-y-1">
                    <label htmlFor="login_opt_mob_adm" className="text-xs font-bold text-slate-100 flex items-center gap-2 cursor-pointer">
                      <span>Mobile Number + Admission Number</span>
                      {activeLoginConfig.defaultLoginMode === 'mob_adm' && activeLoginConfig.mobileAdmissionNoEnabled && (
                        <span className="text-[9px] bg-indigo-500/20 text-indigo-300 font-bold px-1.5 py-0.2 rounded border border-indigo-500/30">DEFAULT</span>
                      )}
                    </label>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Parent enters their registered mobile number and student's Admission Number.
                    </p>
                    {!activeLoginConfig.admissionFieldEnabled && (
                      <span className="inline-flex items-center gap-1 text-[9.5px] text-amber-400 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded font-medium mt-1">
                        <AlertCircle className="w-3 h-3" /> Auto-disabled (Admission No hidden in school layout)
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${activeLoginConfig.mobileAdmissionNoEnabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>
                    {activeLoginConfig.mobileAdmissionNoEnabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">Login configuration controls are disabled in view mode.</p>
        )}
      </div>

      {/* School-wide Parents Portal Credentials Directory */}
      <div className="bg-white border border-gray-150 rounded-xl p-5 sm:p-6 shadow-xs space-y-4 no-print animate-fadeIn">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-100 pb-4">
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              School Students Parents Portal Credentials Directory
            </h3>
            <p className="text-[11px] text-gray-500">
              View all student portal login credentials below. Copy custom WhatsApp invites, or click "Simulate Parents View" to instantly preview that specific child's report card.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Search by name, roll, admission, mobile..."
              value={directorySearch}
              onChange={(e) => setDirectorySearch(e.target.value)}
              className="w-full text-xs py-2 pl-8 pr-3.5 bg-slate-50 border border-gray-150 rounded-lg outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/10 placeholder:text-gray-400 font-medium"
            />
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* Directory List Container */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs border-collapse min-w-[850px]">
            <thead>
              <tr className="border-b border-gray-150 text-gray-450 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Student Name</th>
                <th className="py-2.5 px-3">Class / Section</th>
                <th className="py-2.5 px-3">Roll No</th>
                <th className="py-2.5 px-3">Admission No</th>
                <th className="py-2.5 px-3">Parent Mobile</th>
                <th className="py-2.5 px-3">DOB</th>
                <th className="py-2.5 px-3">Promotion Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students
                .filter(s => {
                  const q = directorySearch.trim().toLowerCase();
                  return !q || 
                    s.name.toLowerCase().includes(q) || 
                    s.rollNo.toString().toLowerCase().includes(q) ||
                    (s.admissionNo && s.admissionNo.toLowerCase().includes(q)) ||
                    (s.mobileNumber && s.mobileNumber.toLowerCase().includes(q)) ||
                    s.className.toLowerCase().includes(q);
                })
                .map(student => {
                  const isCopied = copiedLinkStudentId === student.id;
                  const displayAdmissionNo = student.admissionNo && !student.admissionNo.startsWith('adm_') ? student.admissionNo : '—';
                  return (
                    <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-3 font-bold text-slate-800 flex items-center gap-2">
                        {student.photoUrl ? (
                          <img 
                            src={student.photoUrl} 
                            alt={student.name} 
                            className="w-6.5 h-6.5 rounded-full object-cover border border-gray-200 shadow-xs"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-6.5 h-6.5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-black border border-gray-200">
                            {student.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <span>{student.name}</span>
                      </td>
                      <td className="py-3 px-3 uppercase text-gray-550 font-semibold">{student.className} - {student.section}</td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-700">{student.rollNo}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">
                        {displayAdmissionNo === '—' ? (
                          <span className="text-slate-300 italic">None</span>
                        ) : (
                          <span className="font-semibold text-slate-800">{displayAdmissionNo}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-600">
                        {student.mobileNumber ? (
                          <span className="font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100/60 px-2 py-0.5 rounded text-[11px]">
                            {student.mobileNumber}
                          </span>
                        ) : (
                          <span className="text-slate-300 italic text-[11px]">Not set</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-100/50 px-2 py-0.5 rounded">
                          {student.dob}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {student.promotionStatus ? (
                          <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full text-[10.5px]">
                            {student.promotionStatus}
                          </span>
                        ) : (
                          <span className="text-slate-400">Regular</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => handleCopyInvite(student)}
                          className={`inline-flex items-center gap-1.5 py-1 px-2.5 rounded-lg border text-[11px] font-bold transition cursor-pointer leading-tight ${
                            isCopied 
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                              : 'bg-white border-gray-200 text-slate-700 hover:bg-slate-50 hover:border-gray-300'
                          }`}
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-indigo-650" />}
                          {isCopied ? 'Instructions Copied!' : 'Copy Share Code'}
                        </button>
                        
                        {onImpersonateParent && (
                          <button
                            onClick={() => onImpersonateParent(student.id)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold py-1 px-3 rounded-lg text-[11px] transition cursor-pointer inline-flex items-center gap-1 leading-tight shadow-sm shadow-indigo-600/10 active:scale-95"
                          >
                            <GraduationCap className="w-3.5 h-3.5" />
                            Simulate Parents View
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              {students.filter(s => {
                const q = directorySearch.trim().toLowerCase();
                return !q || 
                  s.name.toLowerCase().includes(q) || 
                  s.rollNo.toString().toLowerCase().includes(q) ||
                  (s.admissionNo && s.admissionNo.toLowerCase().includes(q)) ||
                  (s.mobileNumber && s.mobileNumber.toLowerCase().includes(q)) ||
                  s.className.toLowerCase().includes(q);
              }).length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                    No registry students matched your filter "{directorySearch}".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Website Integration Code Copier */}
      <div className="bg-white border border-gray-150 rounded-xl p-5 sm:p-6 shadow-xs space-y-4 no-print animate-fadeIn">
        <div>
          <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
            <Globe className="w-4 h-4 text-indigo-600" />
            Website Integration Hub: Copy Embed Code for Your School Website
          </h3>
          <p className="text-[11px] text-gray-500">
            Easily integrate only the Parents Portal into your school's official local website. Parents can log in and view dynamic reports directly. Choose your preferred integration type:
          </p>
        </div>

        {/* Integration Selection Tabs */}
        <div className="flex border-b border-gray-150 text-xs">
          <button
            onClick={() => setIntegrationTab('iframe')}
            className={`py-2 px-4 font-bold border-b-2 -mb-px transition-all flex items-center gap-2 cursor-pointer ${
              integrationTab === 'iframe'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-450 hover:text-slate-800'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            Option 1: Modern Iframe Embed (Recommended)
          </button>
          <button
            onClick={() => setIntegrationTab('standalone')}
            className={`py-2 px-4 font-bold border-b-2 -mb-px transition-all flex items-center gap-2 cursor-pointer ${
              integrationTab === 'standalone'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-450 hover:text-slate-800'
            }`}
          >
            <FileJson className="w-3.5 h-3.5" />
            Option 2: Standalone Full HTML Login Gateway
          </button>
        </div>

        {/* Tab Code Box Display */}
        <div className="space-y-3">
          {integrationTab === 'iframe' ? (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-600">
                Place this seamless iframe code inside any webpage, sidebar widget, or page builder (such as Elementor, Wix, or custom HTML editor) on your local school website to embed the login interface instantly:
              </p>
              <div className="relative">
                <pre className="p-4 bg-slate-905 bg-slate-900 text-slate-100 rounded-xl text-[10.5px] font-mono overflow-x-auto whitespace-pre leading-relaxed select-all max-h-52 scrollbar-thin">
                  {iframeCode}
                </pre>
                <button
                  type="button"
                  onClick={() => handleCopyIntegrationCode(iframeCode)}
                  className="absolute top-2.5 right-2.5 bg-white/10 hover:bg-white/20 text-white font-bold py-1.5 px-3 rounded text-[10.5px] flex items-center gap-1 transition cursor-pointer"
                >
                  {copiedIntegration ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copiedIntegration ? 'Copied Snippet!' : 'Copy Iframe Code'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-600">
                A completely self-contained, responsive login portal with your custom school brand color (<strong>{branding.themeColor}</strong>) and name. 
                Save this as <strong>parents-portal.html</strong> and upload it directly to your school's server to create a dedicated local page:
              </p>
              <div className="relative">
                <pre className="p-4 bg-slate-905 bg-slate-900 text-slate-100 rounded-xl text-[10px] font-mono overflow-x-auto whitespace-pre leading-relaxed select-all max-h-64 scrollbar-thin">
                  {standaloneHtmlCode}
                </pre>
                <button
                  type="button"
                  onClick={() => handleCopyIntegrationCode(standaloneHtmlCode)}
                  className="absolute top-2.5 right-2.5 bg-white/10 hover:bg-white/20 text-white font-bold py-1.5 px-3 rounded text-[10.5px] flex items-center gap-1 transition cursor-pointer"
                >
                  {copiedIntegration ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copiedIntegration ? 'Copied File Code!' : 'Copy Page Source'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
