import React, { useState } from 'react';
import { SaasTeacher, Student, SubjectAssignment, ReportCardStructure, SchoolClassItem } from '../types';
import { Users, Plus, Trash2, Shield, Eye, EyeOff, UserPlus, Info, GraduationCap, AlertCircle, BookOpen, Layers, CheckSquare } from 'lucide-react';
import { classesMatch } from '../utils/classNormalizer';

interface TeacherManagerProps {
  teachers: SaasTeacher[];
  students: Student[];
  subjects: { id: string; name: string; type: string }[];
  onUpdateTeachers: (updated: SaasTeacher[]) => void;
  reportCardStructures?: ReportCardStructure[];
  maxTeachersLimit?: number;
  schoolClasses?: SchoolClassItem[];
}

export default function TeacherManager({
  teachers = [],
  students = [],
  subjects = [],
  onUpdateTeachers,
  reportCardStructures = [],
  maxTeachersLimit,
  schoolClasses = []
}: TeacherManagerProps) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Dual role state variables
  const [isClassTeacher, setIsClassTeacher] = useState(true);
  const [classTeacherClass, setClassTeacherClass] = useState('');
  const [classTeacherSection, setClassTeacherSection] = useState('All');

  const [isSubjectTeacher, setIsSubjectTeacher] = useState(false);
  const [subjectAssignments, setSubjectAssignments] = useState<SubjectAssignment[]>([
    { className: '', section: 'All', subjects: [] }
  ]);

  const [showPasswordMap, setShowPasswordMap] = useState<{ [id: string]: boolean }>({});
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Deletion double confirmation states
  const [deletingTeacher, setDeletingTeacher] = useState<{ id: string; name: string } | null>(null);
  const [deleteInputText, setDeleteInputText] = useState('');

  // Extract unique classes dynamically from schoolClasses, report card structures OR existing students list
  const availableClasses = React.useMemo(() => {
    if (schoolClasses && schoolClasses.length > 0) {
      return schoolClasses.map(c => c.name);
    }
    const structClasses = (reportCardStructures || []).flatMap(struct => struct.assignedClasses || []);
    const studentClasses = students.map(s => s.className);
    const rawClasses = structClasses.length > 0
      ? Array.from(new Set(structClasses.map(c => c.trim()).filter(Boolean)))
      : Array.from(new Set(studentClasses.map(c => c.trim()).filter(Boolean)));
    return rawClasses.length > 0 ? rawClasses.sort() : ['3rd'];
  }, [schoolClasses, reportCardStructures, students]);

  // Extract unique sections dynamically for a given class or across school
  const getSectionsForClass = (targetClass: string) => {
    if (schoolClasses && schoolClasses.length > 0) {
      const found = schoolClasses.find(c => classesMatch(c.name, targetClass));
      if (found && found.sections && found.sections.length > 0) {
        return found.sections;
      }
    }
    const secs = students.filter(s => classesMatch(s.className, targetClass)).map(s => s.section).filter(Boolean);
    return Array.from(new Set(['A', 'B', ...secs])).sort();
  };

  const availableSections = Array.from(new Set(['A', 'B', 'C', ...students.map(s => s.section).filter(Boolean)])).sort();

  // Filter fallback for scholastic subjects only
  const scholasticSubjects = subjects.filter(sub => sub.type === 'scholastic');
  const coCurricularSubjects = subjects.filter(sub => sub.type !== 'scholastic');

  // Dynamic helper to resolve subjects based on class report card structure design
  const getSubjectsForClass = (className: string) => {
    const matchedStruct = reportCardStructures?.find(s => 
      s.assignedClasses.some((c: string) => classesMatch(c, className))
    );
    const list = matchedStruct ? (matchedStruct.subjects || []) : subjects;
    return {
      scholastic: list.filter(sub => sub.type === 'scholastic'),
      coCurricular: list.filter(sub => sub.type !== 'scholastic')
    };
  };

  const handleAddAssignmentRow = () => {
    setSubjectAssignments(prev => [...prev, { className: '', section: 'All', subjects: [] }]);
  };

  const handleRemoveAssignmentRow = (index: number) => {
    setSubjectAssignments(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateAssignmentField = (index: number, field: keyof SubjectAssignment, value: any) => {
    setSubjectAssignments(prev => prev.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleToggleSubjectInAssignment = (index: number, subjectId: string) => {
    setSubjectAssignments(prev => prev.map((item, i) => {
      if (i === index) {
        const currentSubjects = item.subjects || [];
        const updatedSubjects = currentSubjects.includes(subjectId)
          ? currentSubjects.filter(id => id !== subjectId)
          : [...currentSubjects, subjectId];
        return { ...item, subjects: updatedSubjects };
      }
      return item;
    }));
  };

  const handleAddTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !username || !password) {
      setErrorMsg('Please specify Name, Login ID and Password.');
      return;
    }

    if (!isClassTeacher && !isSubjectTeacher) {
      setErrorMsg('Please assign at least one role: Class Teacher or Subjects Teacher.');
      return;
    }

    if (isClassTeacher && !classTeacherClass) {
      setErrorMsg('Please assign a Class for the Class Teacher role.');
      return;
    }

    if (isSubjectTeacher) {
      if (subjectAssignments.length === 0) {
        setErrorMsg('Please define at least one Subject Assignment row.');
        return;
      }
      for (const sa of subjectAssignments) {
        if (!sa.className) {
          setErrorMsg('Please select a Class for all subject assignment rows.');
          return;
        }
        if (!sa.subjects || sa.subjects.length === 0) {
          setErrorMsg(`Please select at least one subject for Class "${sa.className}".`);
          return;
        }
      }
    }

    // Enforce Commercial Limits
    const limit = maxTeachersLimit ?? 1;
    if (teachers.length >= limit) {
      setErrorMsg(`Operational Limit Reached: Your current plan/trial restricts the teacher registry size to a maximum of ${limit} teacher accounts. Contact the master portal admin to upgrade.`);
      return;
    }

    // Check for username conflict across this school
    const exists = teachers.some(t => t.username.toLowerCase() === username.toLowerCase());
    if (exists) {
      setErrorMsg(`Teacher Username ID "${username}" is already taken.`);
      return;
    }

    const newTeacher: SaasTeacher = {
      id: `teach_${Date.now()}`,
      name: name.trim(),
      username: username.trim().toLowerCase(),
      password: password.trim(),
      // Backward compatibility fields
      assignedClass: isClassTeacher ? classTeacherClass : '',
      assignedSection: isClassTeacher ? classTeacherSection : 'All',
      // Dynamic roles
      isClassTeacher,
      classTeacherClass: isClassTeacher ? classTeacherClass : undefined,
      classTeacherSection: isClassTeacher ? classTeacherSection : undefined,
      isSubjectTeacher,
      subjectAssignments: isSubjectTeacher ? subjectAssignments : []
    };

    onUpdateTeachers([...teachers, newTeacher]);
    
    // Reset state
    setName('');
    setUsername('');
    setPassword('');
    setClassTeacherClass('');
    setClassTeacherSection('All');
    setIsClassTeacher(true);
    setIsSubjectTeacher(false);
    setSubjectAssignments([{ className: '', section: 'All', subjects: [] }]);
    setErrorMsg('');
    setSuccessMsg(`Teacher "${newTeacher.name}" onboarded successfully!`);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleDeleteTeacher = (id: string, teacherName: string) => {
    setDeletingTeacher({ id, name: teacherName });
    setDeleteInputText('');
  };

  const confirmDeleteTeacher = () => {
    if (!deletingTeacher) return;
    const cleanInput = deleteInputText.trim().toUpperCase();
    if (cleanInput !== 'DELETE' && cleanInput !== 'CONFIRM') return;

    const updated = teachers.filter(t => t.id !== deletingTeacher.id);
    onUpdateTeachers(updated);
    setSuccessMsg(`Credentials for "${deletingTeacher.name}" revoked and deleted.`);
    setTimeout(() => setSuccessMsg(''), 3000);
    setDeletingTeacher(null);
    setDeleteInputText('');
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPasswordMap(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-150 shadow-xs p-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-100 pb-4">
        <div>
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2 uppercase tracking-wide">
            <Users className="w-4 h-4 text-indigo-600" />
            Teachers Registry & Dual Roles Manager
          </h3>
          <p className="text-[11px] text-gray-500">
            Onboard teachers and configure up to two roles: Class Teacher of a classroom, or/and Subjects Teacher of specific subject/s across multiple classrooms.
          </p>
        </div>
        <div className="bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full text-[10px] font-mono text-indigo-600 font-bold uppercase select-none">
          {teachers.length} Onboarded Teachers
        </div>
      </div>

      {/* Grid Layout: Left is Advanced Form, Right is List of Teachers */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Onboard Form */}
        <div className="xl:col-span-5 space-y-4">
          <div className="bg-slate-50/50 rounded-xl p-5 border border-slate-100 space-y-4">
            <h4 className="font-bold text-xs text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-indigo-600" />
              Onboard Teacher & Assign Roles
            </h4>

            {errorMsg && (
              <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-lg text-rose-600 text-[11px] font-semibold flex items-center gap-1.5 animate-fadeIn">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-600 text-[11px] font-semibold flex items-center gap-1.5 animate-fadeIn">
                <svg className="w-3.5 h-3.5 shrink-0 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                {successMsg}
              </div>
            )}

            <form onSubmit={handleAddTeacher} className="space-y-4">
              
              {/* Basic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-500 block">Teacher Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mr. Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-gray-200 bg-white rounded-lg outline-none font-semibold text-gray-700 focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-500 block">Login ID (Username)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-400 text-[10px] font-mono select-none">@</span>
                    <input
                      type="text"
                      required
                      placeholder="sharma_teach"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))}
                      className="w-full pl-6 pr-3 py-2 text-xs border border-gray-200 bg-white rounded-lg outline-none font-semibold text-gray-700 focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-gray-500 block">System Access Password</label>
                <input
                  type="password"
                  required
                  placeholder="Create unique password..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 bg-white rounded-lg outline-none font-semibold text-gray-700 focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500"
                />
              </div>

              {/* Roles Section */}
              <div className="border-t border-slate-200/60 pt-3 space-y-3">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wide block">Assign Role Configurations:</span>
                
                {/* ROLE 1: Class Teacher */}
                <div className="bg-white p-3 rounded-xl border border-gray-200/70 space-y-2.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isClassTeacher}
                      onChange={(e) => setIsClassTeacher(e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-505"
                    />
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                      Role #1: Class Teacher of a Class
                    </span>
                  </label>

                  {isClassTeacher && (
                    <div className="grid grid-cols-2 gap-3 pl-5 pt-1.5 border-l border-indigo-100 animate-fadeIn">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-gray-400 block">Class Assigned</label>
                        <select
                          value={classTeacherClass}
                          onChange={(e) => setClassTeacherClass(e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-gray-200 bg-white rounded-md outline-none text-gray-700 focus:ring-2 focus:ring-indigo-500/15 font-semibold"
                        >
                          <option value="">Select...</option>
                          {availableClasses.map(cls => (
                            <option key={cls} value={cls}>{cls}</option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-gray-400 block">Section Assigned</label>
                        <select
                          value={classTeacherSection}
                          onChange={(e) => setClassTeacherSection(e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-gray-200 bg-white rounded-md outline-none text-gray-700 focus:ring-2 focus:ring-indigo-500/15 font-semibold"
                        >
                          <option value="All">All Sections</option>
                          {getSectionsForClass(classTeacherClass).map(sec => (
                            <option key={sec} value={sec}>Section {sec}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* ROLE 2: Subjects Teacher */}
                <div className="bg-white p-3 rounded-xl border border-gray-200/70 space-y-3.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isSubjectTeacher}
                      onChange={(e) => setIsSubjectTeacher(e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-505"
                    />
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                      Role #2: Subjects Teacher of dynamic classes
                    </span>
                  </label>

                  {isSubjectTeacher && (
                    <div className="space-y-3 pl-5 border-l border-emerald-100 animate-fadeIn">
                      
                      {subjectAssignments.map((assignment, index) => (
                        <div key={index} className="p-3 bg-emerald-50/20 border border-emerald-100 rounded-lg space-y-2.5 relative">
                          
                          {/* Row Header with delete icon */}
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-emerald-800 uppercase font-mono tracking-wider">
                              Assignment Row #{index + 1}
                            </span>
                            {subjectAssignments.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveAssignmentRow(index)}
                                className="p-1 text-slate-400 hover:text-rose-500 rounded bg-slate-100 hover:bg-rose-50 transition-colors"
                                title="Remove assignment row"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          {/* Class / section selector */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-0.5">
                              <label className="text-[8px] font-bold uppercase text-slate-400">Class</label>
                              <select
                                value={assignment.className}
                                onChange={(e) => handleUpdateAssignmentField(index, 'className', e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-gray-200 bg-white rounded outline-none font-semibold text-gray-700"
                              >
                                <option value="">Select Class...</option>
                                {availableClasses.map(cls => (
                                  <option key={cls} value={cls}>{cls}</option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-0.5">
                              <label className="text-[8px] font-bold uppercase text-slate-400">Section</label>
                              <select
                                value={assignment.section}
                                onChange={(e) => handleUpdateAssignmentField(index, 'section', e.target.value)}
                                className="w-full px-2 py-1 text-xs border border-gray-200 bg-white rounded outline-none font-semibold text-gray-700"
                              >
                                <option value="All">All Sections</option>
                                {getSectionsForClass(assignment.className).map(sec => (
                                  <option key={sec} value={sec}>Section {sec}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Subject checkboxes Grouped Dynamically */}
                          <div className="space-y-2">
                            <label className="text-[8px] font-black uppercase text-slate-500 block pb-0.5 font-sans">Assigned Scholastic Subjects</label>
                            {getSubjectsForClass(assignment.className).scholastic.length === 0 ? (
                              <p className="text-[9px] text-gray-400 italic">No scholastic subjects configured yet. Head to "Classes & Subjects" configurations.</p>
                            ) : (
                              <div className="flex flex-wrap gap-1 px-1 py-1 bg-white rounded border border-slate-100 max-h-24 overflow-y-auto">
                                {getSubjectsForClass(assignment.className).scholastic.map(sub => {
                                  const isChecked = assignment.subjects?.includes(sub.id) || false;
                                  return (
                                    <button
                                      type="button"
                                      key={sub.id}
                                      onClick={() => handleToggleSubjectInAssignment(index, sub.id)}
                                      className={`px-2 py-0.5 text-[9.5px] rounded-full border transition-all text-left flex items-center gap-1 font-semibold cursor-pointer ${
                                        isChecked
                                          ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                                      }`}
                                    >
                                      {isChecked ? '✓ ' : ''}{sub.name}
                                    </button>
                                  );
                                })}
                              </div>
                            )}

                            {getSubjectsForClass(assignment.className).coCurricular.length > 0 && (
                              <div className="space-y-1 mt-1">
                                <label className="text-[8px] font-black uppercase text-indigo-900 block pb-0.5 font-sans">Co-Curricular / Co-Scholastic Columns</label>
                                <div className="flex flex-wrap gap-1 px-1 py-1 bg-indigo-50/20 rounded border border-indigo-150/40 max-h-24 overflow-y-auto">
                                  {getSubjectsForClass(assignment.className).coCurricular.map(sub => {
                                    const isChecked = assignment.subjects?.includes(sub.id) || false;
                                    return (
                                      <button
                                        type="button"
                                        key={sub.id}
                                        onClick={() => handleToggleSubjectInAssignment(index, sub.id)}
                                        className={`px-2 py-0.5 text-[9.5px] rounded-full border transition-all text-left flex items-center gap-1 font-semibold cursor-pointer ${
                                          isChecked
                                            ? 'bg-indigo-600 text-white border-indigo-650 font-bold shadow-sm'
                                            : 'bg-indigo-50/30 text-indigo-850 hover:bg-indigo-100/40 border-indigo-150/40'
                                        }`}
                                      >
                                        {isChecked ? '✓ ' : ''}{sub.name}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>

                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={handleAddAssignmentRow}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Class/Subjects Row
                      </button>

                    </div>
                  )}
                </div>

              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Register Teacher Node
              </button>
            </form>
          </div>

          <div className="bg-indigo-950/5 border border-indigo-900/10 rounded-xl p-3.5 space-y-2 text-xs">
            <h5 className="font-bold text-indigo-950 flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-indigo-600" />
              Dual Assignment Multi-class Rule
            </h5>
            <p className="text-[10.5px] text-indigo-900/80 leading-relaxed">
              Teachers can instantly log in with their custom Login Username. When authorized, they have access to print and manage profiles for their <strong>Class Teacher Room</strong>, and can upload scores in spreadsheet format for all <strong>Subject Teacher classrooms</strong> assigned.
            </p>
          </div>
        </div>

        {/* Teachers Table/List */}
        <div className="xl:col-span-7 space-y-4">
          {teachers.length === 0 ? (
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-8 text-center text-slate-400 space-y-3">
              <Users className="w-8 h-8 text-slate-300 mx-auto animate-pulse" />
              <p className="text-xs font-semibold">No teachers onboarded for your school yet.</p>
              <p className="text-[10px] text-slate-400">Apply the onboarding panel to generate credentials for class-specific report card logs.</p>
            </div>
          ) : (
            <div className="border border-gray-150 rounded-xl overflow-hidden shadow-xs">
              <table className="w-full border-collapse text-left text-xs bg-white">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-150">
                    <th className="p-3">Teacher Name</th>
                    <th className="p-3">Login ID</th>
                    <th className="p-3 text-center">Access Code</th>
                    <th className="p-3">Assigned Roles & Classes</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {teachers.map((teacher) => {
                    // Backwards compatibility evaluation
                    const isLegacy = teacher.isClassTeacher === undefined && teacher.isSubjectTeacher === undefined;
                    const cleanIsClassTeacher = isLegacy ? true : !!teacher.isClassTeacher;
                    const activeClass = isLegacy ? teacher.assignedClass : teacher.classTeacherClass;
                    const activeSection = isLegacy ? teacher.assignedSection : teacher.classTeacherSection;

                    const cleanIsSubjectTeacher = !!teacher.isSubjectTeacher;
                    const assignments = teacher.subjectAssignments || [];

                    return (
                      <tr key={teacher.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-3 font-bold text-slate-800">
                          <div className="flex items-center gap-2">
                            <div className="w-6.5 h-6.5 rounded-full bg-indigo-50 border border-indigo-150 flex items-center justify-center text-[10.5px] font-black text-indigo-700">
                              {teacher.name.charAt(0).toUpperCase()}
                            </div>
                            <span>{teacher.name}</span>
                          </div>
                        </td>
                        <td className="p-3 font-mono text-slate-600 bg-slate-50/20 font-bold">
                          @{teacher.username}
                        </td>
                        <td className="p-3 font-mono text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="font-semibold text-slate-600">{showPasswordMap[teacher.id] ? teacher.password : '••••••••'}</span>
                            <button
                              type="button"
                              onClick={() => togglePasswordVisibility(teacher.id)}
                              className="p-1 hover:bg-slate-100 text-slate-450 hover:text-slate-600 rounded transition-colors"
                            >
                              {showPasswordMap[teacher.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                          </div>
                        </td>
                        <td className="p-3 space-y-1.5 max-w-sm">
                          {/* Class Teacher Role Badge */}
                          {cleanIsClassTeacher && activeClass && (
                            <div className="flex flex-col gap-0.5">
                              <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-805 font-extrabold px-1.5 py-0.5 rounded border border-indigo-100 font-sans text-[9px] w-fit">
                                <GraduationCap className="w-3 h-3 text-indigo-600" />
                                CLASS TEACHER
                              </span>
                              <span className="text-[10px] text-indigo-900 font-semibold pl-1 font-mono">
                                Room {activeClass} (Sec {activeSection || 'All'})
                              </span>
                            </div>
                          )}

                          {/* Subjects Teacher Role Badge */}
                          {cleanIsSubjectTeacher && assignments.length > 0 && (
                            <div className="flex flex-col gap-1 pt-0.5 border-t border-dashed border-slate-100">
                              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-805 font-extrabold px-1.5 py-0.5 rounded border border-emerald-100 font-sans text-[9px] w-fit">
                                <BookOpen className="w-3 h-3 text-emerald-600" />
                                SUBJECTS TEACHER ({assignments.length})
                              </span>
                              
                              <div className="space-y-1 pl-1">
                                {assignments.map((asg, index) => {
                                  // Map subject ids to readable names searching comprehensive list
                                  const readableNames = asg.subjects?.map(id => {
                                    const orig = subjects.find(sub => sub.id === id);
                                    if (orig) return orig.name;
                                    if (reportCardStructures) {
                                      for (const struct of reportCardStructures) {
                                        const sub = struct.subjects?.find(s => s.id === id);
                                        if (sub) return sub.name;
                                      }
                                    }
                                    return id;
                                  }).join(', ');

                                  return (
                                    <div key={index} className="text-[9.5px] leading-relaxed text-slate-600">
                                      Class <span className="font-bold text-slate-800">{asg.className}</span> {asg.section !== 'All' ? `Section ${asg.section}` : 'All'}:{' '}
                                      <span className="font-semibold text-indigo-600 italic bg-indigo-500/5 px-1 py-0.5 rounded border border-indigo-200/20">{readableNames || 'No Subjects'}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {!cleanIsClassTeacher && !cleanIsSubjectTeacher && (
                            <span className="text-[10px] text-gray-400 italic">No Roles Configured</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => handleDeleteTeacher(teacher.id, teacher.name)}
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-all cursor-pointer"
                            title="Revoke access and delete credentials"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Guidelines info */}
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-3">
            <Shield className="w-5 h-5 text-amber-655 shrink-0 mt-0.5" />
            <div className="space-y-1 text-amber-950 text-xs">
              <h5 className="font-bold flex items-center gap-1.5">
                Dashboard Teacher Access Credentials
              </h5>
              <p className="text-[10.5px] text-slate-600 leading-relaxed">
                Provide teachers with the School Portal ID and their unique login Username &amp; Password. They can log in to view their Class and enter marks for all their assigned subjects concurrently.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Teacher Deletion Double Confirmation Modal */}
      {deletingTeacher && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-[99999] animate-fadeIn text-slate-900">
          <div className="bg-white border border-rose-200 rounded-3xl w-full max-w-md shadow-2xl relative overflow-hidden p-6 space-y-4">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-full shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1.5 w-full text-left">
                <h4 className="font-extrabold text-base text-slate-900">Revoke Access &amp; Delete</h4>
                <p className="text-xs text-rose-700 font-semibold bg-rose-50/50 p-2.5 rounded-xl border border-rose-100">
                  CRITICAL: You are about to revoke all access credentials and permanently delete teacher <strong>"{deletingTeacher.name}"</strong>.
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  To authorize this revocation, please type <strong className="text-rose-600 font-bold select-none">DELETE</strong> or <strong className="text-indigo-600 font-bold select-none">CONFIRM</strong> below:
                </p>
                
                <input
                  type="text"
                  placeholder="Type DELETE or CONFIRM here"
                  value={deleteInputText}
                  onChange={(e) => setDeleteInputText(e.target.value)}
                  className="w-full mt-3 px-3.5 py-2.5 border-2 border-slate-200 focus:border-rose-500 rounded-xl text-xs font-mono font-bold uppercase tracking-wider outline-none text-center bg-slate-50"
                  autoFocus
                />

                <div className="flex justify-end gap-2.5 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setDeletingTeacher(null);
                      setDeleteInputText('');
                    }}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-55 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer bg-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeleteTeacher}
                    disabled={deleteInputText.trim().toUpperCase() !== 'DELETE' && deleteInputText.trim().toUpperCase() !== 'CONFIRM'}
                    className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition flex items-center gap-1.5 ${
                      deleteInputText.trim().toUpperCase() === 'DELETE' || deleteInputText.trim().toUpperCase() === 'CONFIRM'
                        ? 'bg-rose-600 hover:bg-rose-700 cursor-pointer shadow-lg'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Permanently Revoke</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
