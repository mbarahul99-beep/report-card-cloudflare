import React from 'react';
import { GradeScale } from '../types';
import { Trophy, Plus, Trash2, ArrowUpRight } from 'lucide-react';

interface GradeSettingsProps {
  gradeScales: GradeScale[];
  onUpdateScales: (updated: GradeScale[]) => void;
}

export default function GradeSettings({ gradeScales, onUpdateScales }: GradeSettingsProps) {
  
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const updateGradeScale = (index: number, field: keyof GradeScale, value: any) => {
    setErrorMsg(null);
    const updated = [...gradeScales];
    updated[index] = {
      ...updated[index],
      [field]: field === 'grade' ? value : parseFloat(value) || 0
    };
    onUpdateScales(updated);
  };

  const addScale = () => {
    setErrorMsg(null);
    const newScale: GradeScale = {
      minPercent: 0,
      maxPercent: 30,
      grade: 'F'
    };
    onUpdateScales([...gradeScales, newScale]);
  };

  const removeScale = (index: number) => {
    setErrorMsg(null);
    if (gradeScales.length <= 2) {
      setErrorMsg("You must have at least two grading threshold boundaries configured.");
      return;
    }
    onUpdateScales(gradeScales.filter((_, idx) => idx !== index));
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-100 text-rose-800 p-3 rounded-lg text-xs flex justify-between items-center animate-in fade-in slide-in-from-top-1 duration-150">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="font-bold text-[10px] uppercase text-rose-500 hover:text-rose-700 px-1 py-0.5">Dismiss</button>
        </div>
      )}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold font-sans text-gray-900 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500 animate-bounce" />
            Grade Scale Configuration (Scholastic Areas)
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Configure automatic threshold ranges mapping overall student percentages to final board grades (e.g., A1, A2, B1).
          </p>
        </div>
        <button
          onClick={addScale}
          id="grade_add_btn"
          className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-800 text-white font-medium text-xs px-3 py-1.5 rounded-lg shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Range
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {gradeScales.map((scale, index) => (
          <div
            key={index}
            className="border border-gray-100 rounded-xl p-4 bg-gray-50/50 hover:bg-gray-50 flex items-center justify-between"
          >
            <div className="space-y-2 flex-grow">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Grade:</span>
                <input
                  type="text"
                  value={scale.grade}
                  onChange={(e) => updateGradeScale(index, 'grade', e.target.value)}
                  className="w-12 px-1.5 py-0.5 border border-gray-200 rounded text-xs font-bold text-gray-800 uppercase text-center bg-white"
                />
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={scale.minPercent}
                  onChange={(e) => updateGradeScale(index, 'minPercent', e.target.value)}
                  className="w-14 px-1 py-0.5 border border-gray-200 rounded text-[11px] font-mono text-center bg-white"
                  placeholder="Min %"
                />
                <span className="text-gray-400 text-xs">to</span>
                <input
                  type="number"
                  value={scale.maxPercent}
                  onChange={(e) => updateGradeScale(index, 'maxPercent', e.target.value)}
                  className="w-14 px-1 py-0.5 border border-gray-200 rounded text-[11px] font-mono text-center bg-white"
                  placeholder="Max %"
                />
                <span className="text-gray-400 text-xs">%</span>
              </div>
            </div>
            <button
              onClick={() => removeScale(index)}
              className="p-1 px-1.5 text-gray-300 hover:text-red-500 rounded bg-transparent transition-colors ml-2"
              title="Delete grade rule"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-4 text-xs text-amber-800 leading-relaxed flex items-center gap-2">
        <ArrowUpRight className="w-5 h-5 flex-shrink-0 text-amber-600" />
        <span>Sorting is handled alphabetically/numerically within our render engine. It is recommended to keep percentages contiguous and non-overlapping for precise score translation (e.g. 91-100, 81-90.99, etc.).</span>
      </div>
    </div>
  );
}
