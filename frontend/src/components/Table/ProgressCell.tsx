import React, { useState } from 'react';

interface Props {
  value: number;  // 0-100
  isParent: boolean;
  onSave: (v: number) => void;
}

export default function ProgressCell({ value, isParent, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  const commit = () => {
    setEditing(false);
    const num = Math.min(100, Math.max(0, parseInt(draft) || 0));
    if (num !== value) onSave(num);
  };

  const color =
    value >= 100 ? '#10B981' :
    value >= 60  ? '#3B82F6' :
    value >= 30  ? '#F59E0B' :
                   '#6366F1';

  return (
    <div className="flex items-center gap-2 w-full">
      {/* Bar */}
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>

      {/* Percentage */}
      {editing && !isParent ? (
        <input
          autoFocus
          type="number"
          min={0}
          max={100}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          className="w-12 bg-indigo-950/60 border border-indigo-500 rounded px-1 py-0.5 text-xs text-white text-right focus:outline-none"
        />
      ) : (
        <span
          onClick={() => !isParent && setEditing(true)}
          className={`text-xs font-mono w-9 text-right shrink-0 ${
            isParent ? 'text-slate-400' : 'cursor-pointer hover:text-indigo-300 transition-colors'
          }`}
          style={{ color: !isParent ? color : undefined }}
        >
          {value}%
        </span>
      )}
    </div>
  );
}
