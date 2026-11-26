import React from 'react';
import { format, parseISO } from 'date-fns';
import { Btn, C } from '../Common';
import { STANDARD_LINES, standardLineOf } from '../../utils/budgetControl';
import type { Effort } from '../../types';

const F = 'Poppins, sans-serif';
const n = (v: number) => (Math.round(v * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });

const NUM_STYLE: React.CSSProperties = { width: 56, height: 28, textAlign: 'right', border: `1px solid ${C.border}`, borderRadius: 6, padding: '0 6px', fontFamily: F, fontSize: 13, color: C.text, background: C.white, boxSizing: 'border-box' };

/** Number cell that saves on blur / Enter. Declared at module level so it keeps focus across re-renders. */
function NumInput({ value, onCommit, label, highlight }: { value: number; onCommit: (v: number) => void; label: string; highlight?: boolean }) {
  const [draft, setDraft] = React.useState(value ? String(value) : '');
  React.useEffect(() => { setDraft(value ? String(value) : ''); }, [value]);
  return (
    <input type="number" min={0} step={0.5} value={draft} aria-label={label} placeholder="–"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { const v = Number(draft) || 0; if (v !== value) onCommit(v); }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      style={{ ...NUM_STYLE, background: value > 0 ? (highlight ? '#EEF2FF' : '#FFFBEB') : C.white }} />
  );
}

interface Props {
  lines: Effort[];               // this project's standard-line efforts
  months: string[];              // YYYY-MM columns
  currentMonth: string;
  canEdit: boolean;
  missingCount: number;
  adding: boolean;
  onAddMissing: () => void;
  onBudget: (effort: Effort, manday: number) => void;
  onMonthly: (effort: Effort, month: string, manday: number) => void;
}

/** Effort in the layout of the Budget Control report: template lines by group × months, with totals. */
export default function BudgetLinesSection({ lines, months, currentMonth, canEdit, missingCount, adding, onAddMissing, onBudget, onMonthly }: Props) {
  const groups = [...new Set(STANDARD_LINES.map((l) => l.group))];
  const byCode = (code: string) => lines.filter((e) => standardLineOf(e.module)?.code === code);
  const used = (e: Effort) => Object.values(e.monthly || {}).reduce((a, v) => a + (Number(v) || 0), 0);
  const budget = lines.reduce((a, e) => a + (Number(e.budgetManday) || 0), 0);
  const usedTotal = lines.reduce((a, e) => a + used(e), 0);
  const monthTotal = (m: string) => lines.reduce((a, e) => a + (Number(e.monthly?.[m]) || 0), 0);
  let acc = 0;
  const accumulated = months.map((m) => { acc += monthTotal(m); return acc; });

  const cell: React.CSSProperties = { padding: '4px 6px', borderBottom: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`, fontSize: 13, color: C.text, textAlign: 'right', whiteSpace: 'nowrap', background: C.white };
  const head: React.CSSProperties = { ...cell, padding: '8px 6px', background: '#13284C', color: '#FFFFFF', fontSize: 11, fontWeight: 700, textAlign: 'center', position: 'sticky', top: 0, zIndex: 1 };
  const sticky: React.CSSProperties = { position: 'sticky', left: 0, zIndex: 2, textAlign: 'left', whiteSpace: 'normal', minWidth: 280, maxWidth: 320 };

  return (
    <section style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', fontFamily: F }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ flex: '1 1 320px' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text }}>Budget Control lines</h3>
          <div style={{ fontSize: 13, color: C.text2 }}>The company template's activities. Enter the budget man-days and the man-days used each month; these feed the monthly Budget Control report.</div>
        </div>
        {canEdit && missingCount > 0 && (
          <Btn small onClick={onAddMissing} disabled={adding}>{adding ? 'Adding…' : `Set up ${missingCount} missing line${missingCount > 1 ? 's' : ''}`}</Btn>
        )}
      </div>
      <div style={{ overflow: 'auto', maxHeight: '70vh' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...head, ...sticky, zIndex: 3, textAlign: 'left' }}>Stage / Phase · Activity</th>
              <th style={head}>Budget (MD)</th>
              {months.map((m) => <th key={m} style={{ ...head, background: m === currentMonth ? '#3D66C4' : '#13284C' }}>{format(parseISO(`${m}-01`), 'MMM yy')}</th>)}
              <th style={head}>Sum</th>
              <th style={head}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <React.Fragment key={g}>
                <tr>
                  <td colSpan={months.length + 4} style={{ ...cell, ...sticky, fontWeight: 700, background: '#E2E8F0', textAlign: 'left' }}>{g}</td>
                </tr>
                {STANDARD_LINES.filter((l) => l.group === g).map((std) => {
                  const efforts = byCode(std.code);
                  if (!efforts.length) {
                    return (
                      <tr key={std.code}>
                        <td style={{ ...cell, ...sticky, color: C.text3 }}>{std.name} <span style={{ fontSize: 11, color: '#B45309' }}>· not set up</span></td>
                        <td colSpan={months.length + 3} style={{ ...cell, color: C.text3, textAlign: 'left', fontSize: 11 }}>{canEdit ? 'Use "Set up missing lines" above.' : ''}</td>
                      </tr>
                    );
                  }
                  return efforts.map((e, k) => {
                    const u = used(e);
                    const bal = (Number(e.budgetManday) || 0) - u;
                    return (
                      <tr key={e.id}>
                        <td style={{ ...cell, ...sticky }}>{std.name}{k > 0 && <span style={{ fontSize: 11, color: '#B45309' }}> · duplicate</span>}</td>
                        <td style={cell}>{canEdit ? <NumInput value={Number(e.budgetManday) || 0} onCommit={(v) => onBudget(e, v)} label={`${std.name} budget`} highlight /> : n(Number(e.budgetManday) || 0)}</td>
                        {months.map((m) => (
                          <td key={m} style={{ ...cell, background: m === currentMonth ? '#F5F7FF' : C.white }}>
                            {canEdit ? <NumInput value={Number(e.monthly?.[m]) || 0} onCommit={(v) => onMonthly(e, m, v)} label={`${std.name} ${m}`} /> : (Number(e.monthly?.[m]) ? n(Number(e.monthly?.[m])) : '–')}
                          </td>
                        ))}
                        <td style={{ ...cell, fontWeight: 700 }}>{n(u)}</td>
                        <td style={{ ...cell, fontWeight: 700, color: bal < 0 ? '#B91C1C' : C.text }}>{n(bal)}</td>
                      </tr>
                    );
                  });
                })}
              </React.Fragment>
            ))}
            <tr>
              <td style={{ ...cell, ...sticky, fontWeight: 800, background: '#F1F5F9' }}>TOTAL MAN-DAY</td>
              <td style={{ ...cell, fontWeight: 800, background: '#F1F5F9' }}>{n(budget)}</td>
              {months.map((m) => <td key={m} style={{ ...cell, fontWeight: 700, background: '#F1F5F9' }}>{monthTotal(m) ? n(monthTotal(m)) : '–'}</td>)}
              <td style={{ ...cell, fontWeight: 800, background: '#F1F5F9' }}>{n(usedTotal)}</td>
              <td style={{ ...cell, fontWeight: 800, background: '#F1F5F9', color: budget - usedTotal < 0 ? '#B91C1C' : C.text }}>{n(budget - usedTotal)}</td>
            </tr>
            <tr>
              <td style={{ ...cell, ...sticky }}>ACCUMULATED MAN-DAY</td>
              <td style={cell} />
              {accumulated.map((v, i) => <td key={months[i]} style={cell}>{v ? n(v) : '–'}</td>)}
              <td style={cell} /><td style={cell} />
            </tr>
            <tr>
              <td style={{ ...cell, ...sticky }}>% ACCUMULATED OF BUDGET</td>
              <td style={cell} />
              {accumulated.map((v, i) => <td key={months[i]} style={{ ...cell, color: budget && v / budget > 1 ? '#B91C1C' : C.text }}>{budget && v ? `${Math.round((v / budget) * 100)}%` : '–'}</td>)}
              <td style={cell} /><td style={cell} />
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
