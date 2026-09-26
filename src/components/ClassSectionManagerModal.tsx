import React, { useState, useEffect } from 'react';
import { SchoolClassItem, Student } from '../types';
import { getStandardClassPresets, toRomanNumeral, toOrdinalSuffix, normalizeClassName, classesMatch } from '../utils/classNormalizer';
import { 
  X, Plus, Trash2, Check, Sparkles, Building2, Layers, AlertCircle, 
  ChevronRight, RefreshCw, Save, CheckCircle2, Sliders, Hash, ArrowLeft, AlertTriangle
} from 'lucide-react';

interface ClassSectionManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: SchoolClassItem[];
  classNamingStyle?: 'roman' | 'ordinal' | 'number' | 'custom';
  currentNamingStyle?: 'roman' | 'ordinal' | 'number' | 'custom';
  onSave?: (classes: SchoolClassItem[], style: 'roman' | 'ordinal' | 'number' | 'custom') => void;
  onSaveClasses?: (classes: SchoolClassItem[], style: 'roman' | 'ordinal' | 'number' | 'custom') => void;
  schoolName?: string;
  students?: Student[];
}

interface DeleteConfirmTarget {
  type: 'class' | 'section';
  classItem: SchoolClassItem;
  section?: string;
  studentCount: number;
}

export default function ClassSectionManagerModal({
  isOpen,
  onClose,
  classes: initialClasses,
  classNamingStyle,
  currentNamingStyle = 'ordinal',
  onSave,
  onSaveClasses,
  schoolName,
  students = []
}: ClassSectionManagerModalProps) {
  const activeInitialStyle = classNamingStyle || currentNamingStyle || 'ordinal';
  const [classList, setClassList] = useState<SchoolClassItem[]>([]);
  const [namingStyle, setNamingStyle] = useState<'roman' | 'ordinal' | 'number' | 'custom'>(activeInitialStyle);
  const [newClassName, setNewClassName] = useState('');
  const [newClassSections, setNewClassSections] = useState('A, B');
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [editingSectionClassId, setEditingSectionClassId] = useState<string | null>(null);
  const [newSectionVal, setNewSectionVal] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Strict warning-based deletion state
  const [confirmDeleteTarget, setConfirmDeleteTarget] = useState<DeleteConfirmTarget | null>(null);
  const [typedConfirm, setTypedConfirm] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialClasses && initialClasses.length > 0) {
        setClassList(JSON.parse(JSON.stringify(initialClasses)));
      } else {
        // Generate standard defaults
        setClassList(getStandardClassPresets(activeInitialStyle === 'custom' ? 'ordinal' : activeInitialStyle));
      }
      setNamingStyle(activeInitialStyle);
      setConfirmDeleteTarget(null);
      setTypedConfirm('');
    }
  }, [isOpen, initialClasses, activeInitialStyle]);

  if (!isOpen) return null;

  // 1-Click Preset Switcher
  const handleApplyPreset = (style: 'roman' | 'ordinal' | 'number') => {
    setNamingStyle(style);
    setClassList(prev => {
      return prev.map(cls => {
        const norm = normalizeClassName(cls.name);
        const num = parseInt(norm, 10);
        if (!isNaN(num) && num >= 1 && num <= 12) {
          let updatedName = cls.name;
          if (style === 'roman') updatedName = `Class ${toRomanNumeral(num)}`;
          else if (style === 'number') updatedName = `Class ${num}`;
          else if (style === 'ordinal') updatedName = toOrdinalSuffix(num);
          return { ...cls, name: updatedName };
        }
        return cls;
      });
    });
    setSuccessToast(`Switched naming style to ${style.toUpperCase()}!`);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // Add section to a specific class
  const handleAddSection = (classId: string) => {
    const val = newSectionVal.trim().toUpperCase();
    if (!val) return;
    setClassList(prev => prev.map(c => {
      if (c.id === classId) {
        const currentSecs = c.sections || [];
        if (currentSecs.includes(val)) return c;
        return { ...c, sections: [...currentSecs, val].sort() };
      }
      return c;
    }));
    setNewSectionVal('');
    setEditingSectionClassId(null);
  };

  // Request Section Removal with strict warning check
  const handleRequestRemoveSection = (classItem: SchoolClassItem, sectionToRemove: string) => {
    const currentSecs = classItem.sections || [];
    if (currentSecs.length <= 1) {
      alert("Each class must retain at least one section (e.g. Section A).");
      return;
    }

    // Count enrolled students in this specific class AND section
    const enrolled = (students || []).filter(s => 
      classesMatch(s.className, classItem.name) && 
      (s.section || '').trim().toUpperCase() === sectionToRemove.trim().toUpperCase()
    ).length;

    setTypedConfirm('');
    setConfirmDeleteTarget({
      type: 'section',
      classItem,
      section: sectionToRemove,
      studentCount: enrolled
    });
  };

  // Request Class Deletion with strict warning check
  const handleRequestDeleteClass = (classItem: SchoolClassItem) => {
    if (classList.length <= 1) {
      alert("At least one class must be retained in your school curriculum.");
      return;
    }

    // Count enrolled students in this class
    const enrolled = (students || []).filter(s => 
      classesMatch(s.className, classItem.name)
    ).length;

    setTypedConfirm('');
    setConfirmDeleteTarget({
      type: 'class',
      classItem,
      studentCount: enrolled
    });
  };

  // Execute Confirmed Deletion
  const handleExecuteConfirmedDelete = () => {
    if (!confirmDeleteTarget) return;

    if (confirmDeleteTarget.type === 'class') {
      const updated = classList.filter(c => c.id !== confirmDeleteTarget.classItem.id);
      setClassList(updated);
      setSuccessToast(`Class "${confirmDeleteTarget.classItem.name}" deleted.`);
      if (onSaveClasses) {
        onSaveClasses(updated, namingStyle);
      } else if (onSave) {
        onSave(updated, namingStyle);
      }
    } else if (confirmDeleteTarget.type === 'section' && confirmDeleteTarget.section) {
      const secToRemove = confirmDeleteTarget.section;
      const updated = classList.map(c => {
        if (c.id === confirmDeleteTarget.classItem.id) {
          const filtered = (c.sections || []).filter(s => s !== secToRemove);
          return { ...c, sections: filtered.length > 0 ? filtered : ['A'] };
        }
        return c;
      });
      setClassList(updated);
      setSuccessToast(`Section "${secToRemove}" removed from ${confirmDeleteTarget.classItem.name}.`);
      if (onSaveClasses) {
        onSaveClasses(updated, namingStyle);
      } else if (onSave) {
        onSave(updated, namingStyle);
      }
    }

    setConfirmDeleteTarget(null);
    setTypedConfirm('');
    setTimeout(() => setSuccessToast(null), 3000);
  };

  // Add a new custom class
  const handleCreateNewClass = () => {
    const name = newClassName.trim();
    if (!name) return;
    const cleanId = `class_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const secs = newClassSections.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    const newClassItem: SchoolClassItem = {
      id: cleanId,
      name: name,
      sections: secs.length > 0 ? secs : ['A'],
      orderIndex: classList.length + 1
    };
    setClassList(prev => [...prev, newClassItem]);
    setNewClassName('');
    setNewClassSections('A, B');
    setIsAddingClass(false);
  };

  // Reset to complete standard curriculum
  const handleResetToFullDefaults = () => {
    if (window.confirm("Reset classes to the standard full school registry (Playgroup to 12th)? Your current custom sections will be reset to defaults.")) {
      const presets = getStandardClassPresets(namingStyle === 'custom' ? 'ordinal' : namingStyle);
      setClassList(presets);
      setSuccessToast("Reset to standard school classes.");
      setTimeout(() => setSuccessToast(null), 3000);
    }
  };

  // Save changes
  const handleSaveAndClose = () => {
    if (classList.length === 0) {
      alert("Please add at least one class.");
      return;
    }
    if (onSaveClasses) {
      onSaveClasses(classList, namingStyle);
    } else if (onSave) {
      onSave(classList, namingStyle);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-white sm:bg-slate-900/60 sm:backdrop-blur-xs flex flex-col sm:items-center sm:justify-center p-0 sm:p-4 overflow-hidden animate-fadeIn">
      <div className="bg-white w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-4xl sm:rounded-2xl rounded-none border-0 sm:border sm:border-slate-200 overflow-hidden flex flex-col shadow-none sm:shadow-2xl">
        
        {/* Header - Full mobile width with Back button */}
        <div className="px-3.5 sm:px-6 py-3.5 sm:py-4.5 bg-gradient-to-r from-indigo-700 via-indigo-650 to-purple-700 text-white flex items-center justify-between shadow-xs shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile Native Back Button */}
            <button
              type="button"
              onClick={onClose}
              className="sm:hidden p-1.5 -ml-1 text-white/90 hover:text-white hover:bg-white/10 rounded-xl transition-all shrink-0 cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex p-2 bg-white/10 rounded-xl shrink-0">
              <Layers className="w-5 h-5 text-indigo-200" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-extrabold tracking-tight truncate">Manage School Classes &amp; Sections</h2>
              <p className="text-[10px] sm:text-[11px] text-indigo-150 truncate">
                {schoolName || 'Your School'} — Configure active classes &amp; sections for report cards.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="hidden sm:inline-flex p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all shrink-0 cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preset Style Switcher */}
        <div className="px-3.5 sm:px-6 py-2.5 sm:py-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
            <span className="text-[10px] sm:text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500">Naming Style:</span>
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-2xs w-full sm:w-auto">
              <button
                type="button"
                onClick={() => handleApplyPreset('roman')}
                className={`flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  namingStyle === 'roman'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
                }`}
              >
                <span>🏛️ Roman (I – XII)</span>
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('ordinal')}
                className={`flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  namingStyle === 'ordinal'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
                }`}
              >
                <span>🔢 Ordinal (1st – 12th)</span>
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('number')}
                className={`flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  namingStyle === 'number'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
                }`}
              >
                <span>🏷️ Number (1 – 12)</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetToFullDefaults}
            className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 font-semibold hover:underline self-end sm:self-auto cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset to Standard 16 Classes</span>
          </button>
        </div>

        {/* Success Alert */}
        {successToast && (
          <div className="px-4 sm:px-6 py-2 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 shrink-0 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Classes and Sections Scrollable Body */}
        <div className="p-3 sm:p-6 overflow-y-auto space-y-3 flex-1">
          <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-slate-500 px-1 sm:px-2">
            <span>Class Name ({classList.length} Classes)</span>
            <span className="hidden sm:inline">Sections (A, B, C...)</span>
          </div>

          <div className="space-y-2.5">
            {classList.map((cls, idx) => (
              <div 
                key={cls.id || idx}
                className="p-3 bg-white hover:bg-slate-50/70 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 transition-all shadow-2xs group"
              >
                {/* Mobile Row 1 / Desktop Left: Index, Class Name Input & Mobile Delete button */}
                <div className="flex items-center justify-between gap-2 w-full sm:w-auto">
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 sm:flex-initial">
                    <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={cls.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setClassList(prev => prev.map((item, i) => i === idx ? { ...item, name: val } : item));
                      }}
                      className="text-xs sm:text-sm font-bold text-slate-800 bg-slate-50 sm:bg-transparent hover:bg-white focus:bg-white border border-slate-200 sm:border-transparent hover:border-slate-200 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 sm:py-1 outline-none transition-all flex-1 sm:w-44"
                      placeholder="Class Name"
                    />
                  </div>

                  {/* Mobile Delete Button */}
                  <button
                    type="button"
                    onClick={() => handleRequestDeleteClass(cls)}
                    className="sm:hidden p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all shrink-0 cursor-pointer"
                    title={`Delete ${cls.name}`}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>

                {/* Mobile Row 2 / Desktop Right: Sections Badges List + Add Section + Desktop Delete */}
                <div className="flex-1 flex flex-wrap items-center sm:justify-end gap-1.5 pt-2 sm:pt-0 border-t border-slate-100 sm:border-0">
                  <span className="text-[10px] font-bold uppercase text-slate-400 mr-1 sm:hidden">Sections:</span>
                  {(cls.sections || ['A']).map((sec) => (
                    <span 
                      key={sec}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60 shadow-2xs"
                    >
                      <span>Sec {sec}</span>
                      <button
                        type="button"
                        onClick={() => handleRequestRemoveSection(cls, sec)}
                        className="hover:text-red-600 hover:bg-indigo-100/80 rounded-full w-4 h-4 flex items-center justify-center transition-all text-indigo-400 hover:text-red-600 cursor-pointer"
                        title={`Remove section ${sec}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}

                  {/* Add Section Popover / Inline Input */}
                  {editingSectionClassId === cls.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={newSectionVal}
                        onChange={(e) => setNewSectionVal(e.target.value)}
                        placeholder="Sec (e.g. C)"
                        className="w-18 px-2 py-1 text-xs border border-indigo-300 rounded-lg bg-white outline-none font-bold text-center"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAddSection(cls.id);
                          if (e.key === 'Escape') setEditingSectionClassId(null);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => handleAddSection(cls.id)}
                        className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer"
                        title="Add Section"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingSectionClassId(null)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSectionClassId(cls.id);
                        // Suggest next section character
                        const secs = cls.sections || [];
                        const lastSec = secs[secs.length - 1] || 'A';
                        const nextCode = lastSec.charCodeAt(0) + 1;
                        if (nextCode >= 65 && nextCode <= 90) {
                          setNewSectionVal(String.fromCharCode(nextCode));
                        } else {
                          setNewSectionVal('');
                        }
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 border border-dashed border-indigo-200 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" /> <span>Sec</span>
                    </button>
                  )}

                  {/* Desktop Delete Class */}
                  <button
                    type="button"
                    onClick={() => handleRequestDeleteClass(cls)}
                    className="hidden sm:inline-flex p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all ml-2 cursor-pointer"
                    title={`Delete ${cls.name}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add Custom Class Form */}
          {isAddingClass ? (
            <div className="p-4 bg-indigo-50/40 border border-indigo-200 rounded-xl space-y-3 animate-fadeIn">
              <div className="font-extrabold text-xs text-indigo-900 flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-indigo-600" />
                <span>Add New Class to School</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Class Name</label>
                  <input
                    type="text"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    placeholder="e.g. Class XIII or Nursery"
                    className="w-full px-3 py-2 text-xs border border-slate-200 bg-white rounded-lg font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Sections (Comma Separated)</label>
                  <input
                    type="text"
                    value={newClassSections}
                    onChange={(e) => setNewClassSections(e.target.value)}
                    placeholder="e.g. A, B, C"
                    className="w-full px-3 py-2 text-xs border border-slate-200 bg-white rounded-lg font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingClass(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateNewClass}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  Add Class
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsAddingClass(true)}
              className="w-full py-3 border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/20 text-slate-600 hover:text-indigo-600 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Custom Class</span>
            </button>
          )}
        </div>

        {/* Footer - Full width and prominent on mobile */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-3 shrink-0">
          <div className="text-[11px] text-slate-500 leading-tight">
            💡 Templates assigned by SaaS Owner automatically match these classes.
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all text-center cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAndClose}
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Classes</span>
            </button>
          </div>
        </div>

      </div>

      {/* Strict Warning-Based Deletion Modal Overlay */}
      {confirmDeleteTarget && (
        <div className="fixed inset-0 z-[10000] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-red-200 overflow-hidden flex flex-col animate-scaleUp">
            {/* Warning Header */}
            <div className="bg-red-50 border-b border-red-150 p-4 sm:p-5 flex items-start gap-3">
              <div className="p-2.5 bg-red-100 text-red-700 rounded-xl shrink-0">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-extrabold text-red-900">
                  {confirmDeleteTarget.type === 'class' ? 'Confirm Class Deletion' : 'Confirm Section Deletion'}
                </h3>
                <p className="text-xs text-red-700 mt-0.5">
                  Strict warning check to prevent accidental loss
                </p>
              </div>
            </div>

            {/* Warning Content */}
            <div className="p-4 sm:p-6 space-y-3.5 text-xs text-slate-700">
              {confirmDeleteTarget.studentCount > 0 ? (
                <div className="space-y-3">
                  <div className="p-3 bg-red-50/80 border border-red-200 rounded-xl text-red-900 space-y-1">
                    <p className="font-extrabold flex items-center gap-1.5 text-red-800">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>{confirmDeleteTarget.studentCount} Active Student(s) Currently Enrolled!</span>
                    </p>
                    <p className="text-[11px] leading-relaxed text-red-700">
                      There are <strong>{confirmDeleteTarget.studentCount} registered student(s)</strong> belonging to{' '}
                      <strong>{confirmDeleteTarget.classItem.name}</strong>
                      {confirmDeleteTarget.section ? ` (Section ${confirmDeleteTarget.section})` : ''}.
                      Deleting this will leave their profiles unlinked from standard class lists!
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-600">
                      To confirm permanent deletion, type <strong className="text-red-600 font-mono">DELETE</strong> below:
                    </label>
                    <input
                      type="text"
                      value={typedConfirm}
                      onChange={(e) => setTypedConfirm(e.target.value)}
                      placeholder="Type DELETE to confirm"
                      className="w-full px-3 py-2 text-xs border border-red-300 rounded-xl font-bold uppercase tracking-wider text-red-900 outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                      autoFocus
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-slate-600 leading-relaxed">
                    Are you sure you want to delete{' '}
                    {confirmDeleteTarget.type === 'class' ? (
                      <span>class <strong className="text-slate-900 font-bold">{confirmDeleteTarget.classItem.name}</strong></span>
                    ) : (
                      <span>section <strong className="text-slate-900 font-bold">{confirmDeleteTarget.section}</strong> from <strong className="text-slate-900 font-bold">{confirmDeleteTarget.classItem.name}</strong></span>
                    )}?
                  </p>
                  <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl font-medium">
                    ✓ No active students are currently enrolled in this {confirmDeleteTarget.type}. Safe to remove.
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setConfirmDeleteTarget(null);
                  setTypedConfirm('');
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteConfirmedDelete}
                disabled={confirmDeleteTarget.studentCount > 0 && typedConfirm.trim().toUpperCase() !== 'DELETE'}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                  confirmDeleteTarget.studentCount > 0 && typedConfirm.trim().toUpperCase() !== 'DELETE'
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-xs'
                }`}
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete {confirmDeleteTarget.type === 'class' ? 'Class' : 'Section'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}