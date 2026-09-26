import React, { useState } from 'react';
import { SubjectColumn, ScoreColumn } from '../types';
import { BookOpen, Plus, Trash2, AlertCircle, Sparkles, Sliders, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';

interface SubjectSettingsProps {
  subjects: SubjectColumn[];
  scoreColumns: ScoreColumn[];
  onUpdateSubjects: (updated: SubjectColumn[]) => void;
  onUpdateScoreColumns: (updated: ScoreColumn[]) => void;
}

export default function SubjectSettings({
  subjects,
  scoreColumns,
  onUpdateSubjects,
  onUpdateScoreColumns
}: SubjectSettingsProps) {
  const [newSubName, setNewSubName] = useState('');
  const [newSubType, setNewSubType] = useState<'scholastic' | 'co_scholastic' | 'activity'>('scholastic');
  
  const [newColName, setNewColName] = useState('');
  const [newColMax, setNewColMax] = useState(10);

  // Custom modal states to bypass sandboxed iframe restrictions
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    message: string;
  } | null>(null);

  // Score Column Drag and Drop State
  const [draggedColId, setDraggedColId] = useState<string | null>(null);

  // Subjects Drag and Drop State
  const [draggedSubId, setDraggedSubId] = useState<string | null>(null);

  const addSubject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName.trim()) return;
    const cleanId = newSubName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    // Check if ID already exists
    if (subjects.some(s => s.id === cleanId)) {
      setAlertDialog({
        isOpen: true,
        message: "A subject with this name already exists."
      });
      return;
    }

    const newSub: SubjectColumn = {
      id: cleanId,
      name: newSubName.trim(),
      type: newSubType
    };

    onUpdateSubjects([...subjects, newSub]);
    setNewSubName('');
  };

  const removeSubject = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Subject?",
      message: "Are you sure you want to delete this subject? All grades entered for this subject will be reset.",
      onConfirm: () => {
        onUpdateSubjects(subjects.filter(s => s.id !== id));
      }
    });
  };

  const addScoreColumn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim() || newColMax <= 0) return;
    const cleanId = newColName.toLowerCase().replace(/[^a-z0-9]/g, '_');

    if (scoreColumns.some(c => c.id === cleanId)) {
      setAlertDialog({
        isOpen: true,
        message: "A column with this label/weight already exists."
      });
      return;
    }

    const newCol: ScoreColumn = {
      id: cleanId,
      name: newColName.trim(),
      maxMarks: newColMax
    };

    onUpdateScoreColumns([...scoreColumns, newCol]);
    setNewColName('');
    setNewColMax(10);
  };

  const removeScoreColumn = (id: string) => {
    if (scoreColumns.length <= 1) {
      setAlertDialog({
        isOpen: true,
        message: "You must have at least one score column configured for scholastic subjects."
      });
      return;
    }
    setConfirmDialog({
      isOpen: true,
      title: "Delete Score Column?",
      message: "Are you sure you want to delete this score column? All grades aligned to this sub-column will be deleted.",
      onConfirm: () => {
        onUpdateScoreColumns(scoreColumns.filter(c => c.id !== id));
      }
    });
  };

  // Score Column Drag Handlers
  const handleColDragStart = (e: React.DragEvent, id: string) => {
    setDraggedColId(id);
    e.dataTransfer.effectAllowed = 'move';
    // Transparent drag preview effect
    setTimeout(() => {
      const el = document.getElementById(`col-drag-${id}`);
      if (el) el.classList.add('opacity-40');
    }, 0);
  };

  const handleColDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (!draggedColId || draggedColId === id) return;
    
    const dragIdx = scoreColumns.findIndex(c => c.id === draggedColId);
    const hoverIdx = scoreColumns.findIndex(c => c.id === id);
    if (dragIdx === -1 || hoverIdx === -1) return;
    
    const updated = [...scoreColumns];
    const [draggedItem] = updated.splice(dragIdx, 1);
    updated.splice(hoverIdx, 0, draggedItem);
    onUpdateScoreColumns(updated);
  };

  const handleColDragEnd = (id: string) => {
    setDraggedColId(null);
    const el = document.getElementById(`col-drag-${id}`);
    if (el) el.classList.remove('opacity-40');
  };

  const moveScoreColumn = (index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= scoreColumns.length) return;
    
    const updated = [...scoreColumns];
    const [moved] = updated.splice(index, 1);
    updated.splice(nextIndex, 0, moved);
    onUpdateScoreColumns(updated);
  };

  // Subject Drag Handlers
  const handleSubDragStart = (e: React.DragEvent, id: string) => {
    setDraggedSubId(id);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      const el = document.getElementById(`sub-drag-${id}`);
      if (el) el.classList.add('opacity-40');
    }, 0);
  };

  const handleSubDragOver = (e: React.DragEvent, id: string, type: 'scholastic' | 'co_scholastic' | 'activity') => {
    e.preventDefault();
    if (!draggedSubId || draggedSubId === id) return;
    
    const draggedSub = subjects.find(s => s.id === draggedSubId);
    if (!draggedSub || draggedSub.type !== type) return; // limit to same list
    
    const dragIdx = subjects.findIndex(s => s.id === draggedSubId);
    const hoverIdx = subjects.findIndex(s => s.id === id);
    if (dragIdx === -1 || hoverIdx === -1) return;
    
    const updated = [...subjects];
    const [draggedItem] = updated.splice(dragIdx, 1);
    updated.splice(hoverIdx, 0, draggedItem);
    onUpdateSubjects(updated);
  };

  const handleSubDragEnd = (id: string) => {
    setDraggedSubId(null);
    const el = document.getElementById(`sub-drag-${id}`);
    if (el) el.classList.remove('opacity-40');
  };

  const moveSubject = (id: string, direction: 'up' | 'down') => {
    const sub = subjects.find(s => s.id === id);
    if (!sub) return;
    
    const sameTypeSubs = subjects.filter(s => s.type === sub.type);
    const indexInType = sameTypeSubs.findIndex(s => s.id === id);
    const nextIndexInType = direction === 'up' ? indexInType - 1 : indexInType + 1;
    if (nextIndexInType < 0 || nextIndexInType >= sameTypeSubs.length) return;
    
    const targetSub = sameTypeSubs[nextIndexInType];
    const realIndex = subjects.findIndex(s => s.id === id);
    const realTargetIndex = subjects.findIndex(s => s.id === targetSub.id);
    
    const updated = [...subjects];
    // Swap positions
    updated[realIndex] = targetSub;
    updated[realTargetIndex] = sub;
    onUpdateSubjects(updated);
  };

  const updateSubjectMaxMarks = (id: string, maxMarks: number) => {
    const updated = subjects.map(s => s.id === id ? { ...s, maxMarks } : s);
    onUpdateSubjects(updated);
  };

  const sumMaxMarks = scoreColumns.reduce((sum, c) => sum + c.maxMarks, 0);
  const targetMax = subjects.filter(s => s.type === 'scholastic')[0]?.maxMarks ?? 100;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Dynamic Columns Configuration Column */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
        <div>
          <h2 className="text-lg font-bold font-sans text-gray-900 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-purple-600 animate-pulse" />
            Scholastic Sub-Columns
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Configure sub-columns (e.g. Theory, Oral, PT). Rearrange columns by dragging the grip icon or using arrows.
          </p>
        </div>

        {/* Column creation form */}
        <form onSubmit={addScoreColumn} className="space-y-3 bg-purple-50/50 border border-purple-100 p-4 rounded-lg">
          <h3 className="text-xs font-bold text-purple-900 uppercase tracking-wide">Add Term Column</h3>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="e.g. Portfolio"
              value={newColName}
              onChange={(e) => setNewColName(e.target.value)}
              id="sub_col_name"
              className="w-full px-3 py-1.5 border border-purple-200 rounded-lg text-xs bg-white focus:outline-none"
            />
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 whitespace-nowrap">Max Marks:</span>
              <input
                type="number"
                placeholder="Weight"
                value={newColMax}
                onChange={(e) => setNewColMax(parseInt(e.target.value) || 0)}
                id="sub_col_max"
                className="w-full px-3 py-1.5 border border-purple-200 rounded-lg text-xs bg-white focus:outline-none"
                min="1"
                max="100"
              />
              <button
                type="submit"
                id="sub_col_add_btn"
                className="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white p-1.5 rounded-lg text-xs font-semibold flex items-center justify-center flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>

        {/* Existing columns list */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1">
            <span>Score Column (Reorder / Delete)</span>
            <span>Total Weight</span>
          </div>
          <div className="divide-y divide-gray-100 max-h-[300px] overflow-y-auto pr-1 space-y-1">
            {scoreColumns.map((col, idx) => (
              <div 
                key={col.id} 
                id={`col-drag-${col.id}`}
                draggable
                onDragStart={(e) => handleColDragStart(e, col.id)}
                onDragOver={(e) => handleColDragOver(e, col.id)}
                onDragEnd={() => handleColDragEnd(col.id)}
                className={`flex justify-between items-center py-2 px-2 text-xs rounded-lg border border-transparent transition-all hover:bg-purple-50/40 hover:border-purple-100 cursor-grab active:cursor-grabbing ${draggedColId === col.id ? 'bg-purple-50 border-purple-200 opacity-40' : 'bg-slate-50/50'}`}
              >
                <div className="flex items-center gap-2 text-gray-700">
                  <span className="text-gray-400 hover:text-purple-600 select-none">
                    <GripVertical className="w-3.5 h-3.5" />
                  </span>
                  <div className="flex flex-col">
                    <span className="font-semibold">{col.name}</span>
                    <span className="text-[9px] font-mono text-gray-400">ID: {col.id}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-bold font-mono text-[10px]">
                    Max {col.maxMarks}
                  </span>
                  
                  {/* Reorder Arrows */}
                  <div className="flex flex-col gap-0.5 bg-slate-100 rounded p-0.5">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveScoreColumn(idx, 'up')}
                      className={`p-0.5 rounded transition ${idx === 0 ? 'text-gray-300' : 'text-gray-600 hover:bg-purple-100'}`}
                      title="Move Up"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === scoreColumns.length - 1}
                      onClick={() => moveScoreColumn(idx, 'down')}
                      className={`p-0.5 rounded transition ${idx === scoreColumns.length - 1 ? 'text-gray-300' : 'text-gray-600 hover:bg-purple-100'}`}
                      title="Move Down"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Fully Visible Trash Icon */}
                  <button
                    onClick={() => removeScoreColumn(col.id)}
                    className="p-1 px-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded transition"
                    title="Delete column"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          <div className="border-t border-gray-100 pt-3 flex justify-between items-center bg-gray-50 p-2.5 rounded-lg text-xs mt-2">
            <span className="font-medium text-gray-600">Calculated Maximum Limit:</span>
            <span className={`font-mono font-bold px-2 py-0.5 rounded ${sumMaxMarks === targetMax ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              {sumMaxMarks} / {targetMax}
            </span>
          </div>
          {sumMaxMarks !== targetMax && (
            <div className="text-[10px] text-amber-600 flex items-start gap-1 p-2 bg-amber-50 rounded-lg mt-1">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>For proper percentage scaling, columns should sum to {targetMax} marks per term (configured in your subject's max marks).</span>
            </div>
          )}
        </div>
      </div>

      {/* Curriculum subjects manager (two columns large) */}
      <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <h2 className="text-lg font-bold font-sans text-gray-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-sky-600" />
              Curriculum & Subject Matter
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Add curriculum subjects, co-scholastic behaviors, or activities. Reorder them within each group by dragging or clicking arrows.
            </p>
          </div>

          <form onSubmit={addSubject} className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-100 shrink-0">
            <input
              type="text"
              placeholder="e.g. Geography"
              value={newSubName}
              onChange={(e) => setNewSubName(e.target.value)}
              className="px-2.5 py-1 text-xs bg-white rounded border border-gray-200 focus:outline-none w-32 md:w-40"
              id="sub_add_input"
            />
            <select
              value={newSubType}
              onChange={(e) => setNewSubType(e.target.value as any)}
              className="px-1.5 py-1 text-xs bg-white rounded border border-gray-200 font-sans focus:outline-none"
              id="sub_add_type"
            >
              <option value="scholastic">Scholastic Area</option>
              <option value="co_scholastic">Co-Scholastic</option>
              <option value="activity">Activities/Skills</option>
            </select>
            <button
              type="submit"
              id="sub_add_btn"
              className="bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white p-1 rounded font-medium text-xs flex items-center justify-center shrink-0"
            >
              <Plus className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Group lists */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Scholastic Group */}
          <div className="border border-gray-100 rounded-xl p-3.5 space-y-3 bg-slate-50/20">
            <div className="flex items-center gap-1.5 border-b border-gray-50 pb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
              <h3 className="font-semibold text-xs text-gray-700 uppercase tracking-wide">Scholastic (Academic)</h3>
            </div>
            <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
              {subjects.filter(s => s.type === 'scholastic').map((sub, idx, arr) => (
                <div 
                  key={sub.id} 
                  id={`sub-drag-${sub.id}`}
                  draggable
                  onDragStart={(e) => handleSubDragStart(e, sub.id)}
                  onDragOver={(e) => handleSubDragOver(e, sub.id, 'scholastic')}
                  onDragEnd={() => handleSubDragEnd(sub.id)}
                  className={`flex justify-between items-center bg-white border border-gray-100 px-2 py-1.5 rounded-lg text-xs transition hover:bg-sky-50/30 font-sans cursor-grab active:cursor-grabbing ${draggedSubId === sub.id ? 'opacity-40 bg-sky-50 border-sky-200' : ''}`}
                >
                  <div className="flex items-center gap-1.5 text-gray-800 min-w-0">
                    <span className="text-gray-300 hover:text-sky-600 cursor-grab shrink-0">
                      <GripVertical className="w-3.5 h-3.5" />
                    </span>
                    <span className="font-semibold truncate">{sub.name}</span>
                    <div className="flex items-center gap-0.5 ml-1 shrink-0 bg-indigo-50/50 px-1 py-0.5 rounded border border-indigo-100/50">
                      <span className="text-[9px] text-indigo-400 font-bold uppercase select-none">Max</span>
                      <input
                        type="number"
                        min="1"
                        max="200"
                        value={sub.maxMarks ?? sumMaxMarks}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || sumMaxMarks;
                          updateSubjectMaxMarks(sub.id, val);
                        }}
                        className="w-10 px-0.5 py-px border border-indigo-200/50 rounded font-black font-mono text-[9px] text-center text-indigo-900 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        title="Edit total maximum marks for this subject"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Reorder Arrows */}
                    <div className="flex gap-0.5 bg-slate-100 rounded p-0.5">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveSubject(sub.id, 'up')}
                        className={`p-0.5 rounded transition ${idx === 0 ? 'text-gray-300' : 'text-gray-600 hover:bg-sky-100'}`}
                      >
                        <ChevronUp className="w-2.5 h-2.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === arr.length - 1}
                        onClick={() => moveSubject(sub.id, 'down')}
                        className={`p-0.5 rounded transition ${idx === arr.length - 1 ? 'text-gray-300' : 'text-gray-600 hover:bg-sky-100'}`}
                      >
                        <ChevronDown className="w-2.5 h-2.5" />
                      </button>
                    </div>

                    {/* Fully Visible Delete Button */}
                    <button
                      onClick={() => removeSubject(sub.id)}
                      className="p-1 px-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-150 rounded transition"
                      title="Delete Subject"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {subjects.filter(s => s.type === 'scholastic').length === 0 && (
                <div className="text-center text-[11px] text-gray-400 py-4 italic">No scholastic subjects configured.</div>
              )}
            </div>
          </div>

          {/* Co Scholastic Group */}
          <div className="border border-gray-100 rounded-xl p-3.5 space-y-3 bg-slate-50/20">
            <div className="flex items-center gap-1.5 border-b border-gray-50 pb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <h3 className="font-semibold text-xs text-gray-700 uppercase tracking-wide">Co-Scholastic (Traits)</h3>
            </div>
            <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
              {subjects.filter(s => s.type === 'co_scholastic').map((sub, idx, arr) => (
                <div 
                  key={sub.id} 
                  id={`sub-drag-${sub.id}`}
                  draggable
                  onDragStart={(e) => handleSubDragStart(e, sub.id)}
                  onDragOver={(e) => handleSubDragOver(e, sub.id, 'co_scholastic')}
                  onDragEnd={() => handleSubDragEnd(sub.id)}
                  className={`flex justify-between items-center bg-white border border-gray-100 px-2 py-1.5 rounded-lg text-xs transition hover:bg-emerald-50/30 font-sans cursor-grab active:cursor-grabbing ${draggedSubId === sub.id ? 'opacity-40 bg-emerald-50 border-emerald-200' : ''}`}
                >
                  <div className="flex items-center gap-1.5 text-gray-800 min-w-0">
                    <span className="text-gray-300 hover:text-emerald-600 cursor-grab shrink-0">
                      <GripVertical className="w-3.5 h-3.5" />
                    </span>
                    <span className="font-semibold truncate">{sub.name}</span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Reorder Arrows */}
                    <div className="flex gap-0.5 bg-slate-100 rounded p-0.5">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveSubject(sub.id, 'up')}
                        className={`p-0.5 rounded transition ${idx === 0 ? 'text-gray-300' : 'text-gray-600 hover:bg-emerald-100'}`}
                      >
                        <ChevronUp className="w-2.5 h-2.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === arr.length - 1}
                        onClick={() => moveSubject(sub.id, 'down')}
                        className={`p-0.5 rounded transition ${idx === arr.length - 1 ? 'text-gray-300' : 'text-gray-600 hover:bg-emerald-100'}`}
                      >
                        <ChevronDown className="w-2.5 h-2.5" />
                      </button>
                    </div>

                    {/* Fully Visible Delete Button */}
                    <button
                      onClick={() => removeSubject(sub.id)}
                      className="p-1 px-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-150 rounded transition"
                      title="Delete Trait"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {subjects.filter(s => s.type === 'co_scholastic').length === 0 && (
                <div className="text-center text-[11px] text-gray-400 py-4 italic">No co-scholastic traits configured.</div>
              )}
            </div>
          </div>

          {/* Activity Group */}
          <div className="border border-gray-100 rounded-xl p-3.5 space-y-3 bg-slate-50/20">
            <div className="flex items-center gap-1.5 border-b border-gray-50 pb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <h3 className="font-semibold text-xs text-gray-700 uppercase tracking-wide">Activities / Skills</h3>
            </div>
            <div className="space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
              {subjects.filter(s => s.type === 'activity').map((sub, idx, arr) => (
                <div 
                  key={sub.id} 
                  id={`sub-drag-${sub.id}`}
                  draggable
                  onDragStart={(e) => handleSubDragStart(e, sub.id)}
                  onDragOver={(e) => handleSubDragOver(e, sub.id, 'activity')}
                  onDragEnd={() => handleSubDragEnd(sub.id)}
                  className={`flex justify-between items-center bg-white border border-gray-100 px-2 py-1.5 rounded-lg text-xs transition hover:bg-amber-50/30 font-sans cursor-grab active:cursor-grabbing ${draggedSubId === sub.id ? 'opacity-40 bg-amber-50 border-amber-200' : ''}`}
                >
                  <div className="flex items-center gap-1.5 text-gray-800 min-w-0">
                    <span className="text-gray-300 hover:text-amber-600 cursor-grab shrink-0">
                      <GripVertical className="w-3.5 h-3.5" />
                    </span>
                    <span className="font-semibold truncate">{sub.name}</span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Reorder Arrows */}
                    <div className="flex gap-0.5 bg-slate-100 rounded p-0.5">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveSubject(sub.id, 'up')}
                        className={`p-0.5 rounded transition ${idx === 0 ? 'text-gray-300' : 'text-gray-600 hover:bg-amber-100'}`}
                      >
                        <ChevronUp className="w-2.5 h-2.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === arr.length - 1}
                        onClick={() => moveSubject(sub.id, 'down')}
                        className={`p-0.5 rounded transition ${idx === arr.length - 1 ? 'text-gray-300' : 'text-gray-600 hover:bg-amber-100'}`}
                      >
                        <ChevronDown className="w-2.5 h-2.5" />
                      </button>
                    </div>

                    {/* Fully Visible Delete Button */}
                    <button
                      onClick={() => removeSubject(sub.id)}
                      className="p-1 px-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-150 rounded transition"
                      title="Delete Activity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {subjects.filter(s => s.type === 'activity').length === 0 && (
                <div className="text-center text-[11px] text-gray-400 py-4 italic">No activities/skills configured.</div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-sky-50 text-sky-800 border border-sky-100 p-4 rounded-lg flex items-start gap-2 text-xs">
          <Sparkles className="w-5 h-5 flex-shrink-0 text-sky-600" />
          <div>
            <span className="font-semibold block">Subject Grid Structure Defined</span>
            <span className="mt-1 block">The schema is linked to both the CSV template download and the WordPress PHP system code model. Rearranging and deleting items updates all sheets, report cards, and exporters immediately.</span>
          </div>
        </div>
      </div>

      {/* Custom Confirmation Modal */}
      {confirmDialog && confirmDialog.isOpen && (
        <div id="custom-subject-confirm-modal" className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-[99999] animate-fadeIn text-slate-900">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-150 animate-in fade-in-50 zoom-in-95 duration-150 text-left">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <span className="text-rose-500 font-extrabold text-lg">⚠️</span> {confirmDialog.title}
            </h3>
            <p className="text-xs text-slate-600 mt-4 leading-relaxed font-semibold bg-rose-50/40 p-3 rounded-2xl border border-rose-100/60">
              {confirmDialog.message}
            </p>
            <div className="mt-6 flex justify-end gap-3 text-xs font-bold">
              <button
                type="button"
                id="subject-confirm-cancel"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition cursor-pointer bg-white"
              >
                Cancel
              </button>
              <button
                type="button"
                id="subject-confirm-proceed"
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition shadow-lg shadow-rose-200/50 cursor-pointer flex items-center gap-1"
              >
                Proceed Deletion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Modal */}
      {alertDialog && alertDialog.isOpen && (
        <div id="custom-subject-alert-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center p-4 z-[9999] transition-all">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 border border-slate-100 animate-in fade-in-50 zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span className="text-purple-600 font-bold">💡</span> Notice
            </h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              {alertDialog.message}
            </p>
            <div className="mt-5 flex justify-end text-xs font-semibold">
              <button
                type="button"
                id="subject-alert-ok"
                onClick={() => setAlertDialog(null)}
                className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-705 text-white transition"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
