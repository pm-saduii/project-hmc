import React from 'react';
import { CheckCircle2, Circle, MinusCircle } from 'lucide-react';
import { addMonths, differenceInCalendarDays, format, isValid, parseISO, startOfMonth } from 'date-fns';
import { C } from '../Common';
import { PhaseIconBadge } from '../Methodology/MethodBoard';
import type { MonthlyReportData } from '../../utils/monthlyReport';

/** Colours of the five statuses (same as the External Status report). */
export const STATUS_HEX: Record<string, string> = { Completed: '#2f6fde', 'On Track': '#2e9e6b', 'At Risk': '#e0a100', Delayed: '#d64545', 'Not Started': '#94a3b8' };
const STATUSES = ['Completed', 'On Track', 'At Risk', 'Delayed', 'Not Started'];
const LIGHT: Record<string, string> = { Completed: '#c9d8f6', 'On Track': '#cdeadb', 'At Risk': '#f6e7b8', Delayed: '#f5cfcf', 'Not Started': '#dde4ee' };
const toDate = (v?: string | null) => { if (!v) return null; const d = parseISO(v); return isValid(d) ? d : null; };
const dmy = (v?: string | null) => { const d = toDate(v); return d ? format(d, 'dd/MM/yyyy') : '—'; };

const card: React.CSSProperties = { background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, minWidth: 0 };
const h3: React.CSSProperties = { margin: 0, fontSize: 16, fontWeight: 700, color: C.text };
const legendDot = (color: string, label: string, w = 14) => (
  <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: w, height: 8, borderRadius: 4, background: color }} />{label}</span>
);

/* ── Overall Project Timeline (as in the External report) ─────────────── */
export function PhaseTimeline({ plan, asOf, published }: { plan: NonNullable<MonthlyReportData['phasePlan']>; asOf: string; published: boolean }) {
  const phases = plan.phases.filter((p) => toDate(p.start) && toDate(p.end));
  if (!phases.length) return <section style={card}><h3 style={h3}>Overall Project Timeline</h3><div style={{ fontSize: 13, color: C.text3, marginTop: 8 }}>No plan dates yet.</div></section>;
  const first = startOfMonth(new Date(Math.min(...phases.map((p) => toDate(p.start)!.getTime()))));
  const last = new Date(Math.max(...phases.map((p) => toDate(p.end)!.getTime())));
  const months: Date[] = [];
  for (let m = first; m <= last && months.length < 36; m = addMonths(m, 1)) months.push(m);
  const end = addMonths(months[months.length - 1], 1);
  const span = end.getTime() - first.getTime();
  const X = (d: Date) => Math.min(100, Math.max(0, ((d.getTime() - first.getTime()) / span) * 100));
  const today = toDate(asOf);
  const todayX = today && today >= first && today <= end ? X(today) : null;
  const grid = '300px 56px 110px 1fr';
  return (
    <section style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <h3 style={h3}>Overall Project Timeline</h3>
        <span style={{ fontSize: 11, color: C.text2 }}>Light bar = planned window · solid fill = % completed · yellow line = {published ? 'report date' : 'today'} ({dmy(asOf)})</span>
      </div>
      <div style={{ overflowX: 'auto', borderRadius: 10, border: `1px solid ${C.border}` }}>
        <div style={{ minWidth: 900 }}>
          <div style={{ display: 'grid', gridTemplateColumns: grid, alignItems: 'center', background: '#0f2a4a', color: '#cfe0f7', fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', minHeight: 36 }}>
            <div style={{ padding: '0 10px' }}>PHASE</div><div style={{ textAlign: 'center' }}>DONE</div><div style={{ padding: '0 10px' }}>STATUS</div>
            <div style={{ position: 'relative', height: 36 }}>
              {months.map((m, i) => (
                <span key={i} style={{ position: 'absolute', top: 12, left: `${X(m)}%`, width: `${X(addMonths(m, 1)) - X(m)}%`, textAlign: 'center', fontWeight: 500, letterSpacing: 0 }}>
                  {format(m, i === 0 || m.getMonth() === 0 ? "MMM ''yy" : 'MMM')}
                </span>
              ))}
              {todayX != null && <b style={{ position: 'absolute', top: 2, left: `${todayX}%`, transform: 'translateX(-50%)', background: '#ffd34d', color: '#0f2a4a', fontSize: 9, padding: '0 6px', borderRadius: 3 }}>{published ? 'Report' : 'Today'}</b>}
            </div>
          </div>
          {phases.map((p, i) => {
            const s = toDate(p.start)!; const e = toDate(p.end)!;
            const l = X(s); const w = Math.max(0.6, X(new Date(e.getTime() + 86400000)) - l);
            const color = STATUS_HEX[p.status] || '#94a3b8';
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: grid, alignItems: 'center', minHeight: 38, borderTop: `1px solid #edf1f6`, background: i % 2 ? '#f7f9fc' : C.white }}>
                <div style={{ padding: '4px 10px', minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.name}>{p.name}</div>
                  <div style={{ fontSize: 10, color: '#8796ab' }}>{dmy(p.start)} – {dmy(p.end)}{p.owner ? ` · ${p.owner}` : ''}</div>
                </div>
                <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 12, color }}>{p.percent}%</div>
                <div style={{ padding: '0 10px', fontSize: 11, color: C.text2, whiteSpace: 'nowrap' }}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: color, marginRight: 5 }} />{p.status}</div>
                <div style={{ position: 'relative', height: 38 }}>
                  {months.map((m, k) => <i key={k} style={{ position: 'absolute', top: 0, bottom: 0, left: `${X(m)}%`, borderLeft: '1px solid #e6ecf3' }} />)}
                  <span style={{ position: 'absolute', top: 12, height: 14, borderRadius: 7, overflow: 'hidden', left: `${l}%`, width: `${w}%`, background: LIGHT[p.status] || '#dde4ee' }}>
                    <span style={{ display: 'block', height: '100%', width: `${Math.min(100, p.percent)}%`, background: color }} />
                  </span>
                  {todayX != null && <span style={{ position: 'absolute', top: 0, bottom: 0, width: 2, left: `${todayX}%`, background: '#e8b400' }} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── Progress Overview (as in the External report) ───────────────────── */
export function ProgressOverview({ chart }: { chart: NonNullable<MonthlyReportData['progressChart']> }) {
  const { labels, plan, actual } = chart;
  const Wd = 1040, Ht = 250, L = 40, R = 24, T = 18, B = 26, iw = Wd - L - R, ih = Ht - T - B, N = labels.length;
  const x = (i: number) => L + (N <= 1 ? iw / 2 : (i * iw) / (N - 1));
  const y = (v: number) => T + ih - (v / 100) * ih;
  const path = (arr: (number | null)[]) => { let d = ''; let on = false; arr.forEach((v, i) => { if (v == null) { on = false; return; } d += `${on ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)} `; on = true; }); return d; };
  const gapColor = (g: number) => (g < 0 ? '#d64545' : g > 0 ? '#2e9e6b' : C.text2);
  const msBar = (label: string, c: Record<string, number>) => {
    const tot = STATUSES.reduce((a, s) => a + (c[s] || 0), 0);
    return (
      <div key={label} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 60px', gap: 10, alignItems: 'center', marginBottom: 6 }}>
        <b style={{ fontSize: 12 }}>{label}</b>
        {tot ? (
          <div style={{ display: 'flex', height: 16, borderRadius: 8, overflow: 'hidden', background: '#dfe6f0' }}>
            {STATUSES.map((s) => (c[s] ? <span key={s} title={`${s}: ${c[s]}`} style={{ flex: c[s], background: STATUS_HEX[s], color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c[s]}</span> : null))}
          </div>
        ) : <span style={{ fontSize: 11, color: C.text3 }}>None</span>}
        <span style={{ fontSize: 11, color: C.text2, textAlign: 'right' }}>{tot} total</span>
      </div>
    );
  };
  return (
    <section style={{ ...card, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <h3 style={h3}>Progress Overview</h3>
        <span style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, color: C.text2 }}>
          {legendDot('#9fb8da', 'Plan')}{legendDot('#1b4f8f', 'Actual')}{legendDot('#f5cfcf', 'Behind plan')}{legendDot('#cdeadb', 'Ahead of plan')}
        </span>
      </div>
      {/* overall: plan vs actual by month */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: C.text2, marginBottom: 4 }}>OVERALL PROGRESS · PLAN VS ACTUAL BY MONTH</div>
        {N === 0 ? <div style={{ fontSize: 13, color: C.text3 }}>No plan dates yet.</div> : (<>
          <svg viewBox={`0 0 ${Wd} ${Ht}`} width="100%" style={{ display: 'block' }} role="img" aria-label="Plan and actual progress by month">
            {[0, 25, 50, 75, 100].map((g) => (
              <g key={g}><line x1={L} x2={Wd - R} y1={y(g)} y2={y(g)} stroke="#e6ecf3" /><text x={L - 6} y={y(g) + 3} fontSize={9} textAnchor="end" fill="#8796ab">{g}%</text></g>
            ))}
            {labels.map((lb, i) => <text key={lb + i} x={x(i)} y={Ht - 8} fontSize={9.5} textAnchor="middle" fill="#5b6b82">{lb}</text>)}
            {actual.map((a, i) => { const p = plan[i]; if (a == null || p == null || a === p) return null;
              return <line key={`g${i}`} x1={x(i)} x2={x(i)} y1={y(p)} y2={y(a)} stroke={a < p ? '#d64545' : '#2e9e6b'} strokeWidth={6} strokeOpacity={0.22} strokeLinecap="round" />; })}
            <path d={path(plan)} fill="none" stroke="#9fb8da" strokeWidth={2.5} strokeDasharray="6 4" />
            <path d={path(actual)} fill="none" stroke="#1b4f8f" strokeWidth={3} />
            {plan.map((p, i) => { if (p == null) return null; const a = actual[i]; const above = a == null || p >= a;
              return (<g key={`p${i}`}><circle cx={x(i)} cy={y(p)} r={3} fill="#fff" stroke="#9fb8da" strokeWidth={2} />
                {!above && p < 8 ? <text x={x(i) + 7} y={y(p) - 3} fontSize={9.5} fill="#6f8bb0">{p}%</text>
                  : <text x={x(i)} y={y(p) + (above ? -8 : 15)} fontSize={9.5} textAnchor="middle" fill="#6f8bb0">{p}%</text>}</g>); })}
            {actual.map((a, i) => { if (a == null) return null; const p = plan[i]; const above = p == null || a > p;
              return (<g key={`a${i}`}><circle cx={x(i)} cy={y(a)} r={4} fill="#1b4f8f" />
                <text x={x(i)} y={y(a) + (above ? -9 : 16)} fontSize={10.5} fontWeight={700} textAnchor="middle" fill="#0f2a4a">{a}%</text></g>); })}
          </svg>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: 12 }}>
              <tbody>
                <tr><td style={{ width: 70, fontWeight: 700, color: '#6f8bb0', padding: '3px 6px' }}>Plan</td>{plan.map((v, i) => <td key={i} style={{ textAlign: 'center', padding: 3 }}>{v == null ? '–' : `${v}%`}</td>)}</tr>
                <tr style={{ background: '#f7f9fc' }}><td style={{ fontWeight: 700, color: '#0f2a4a', padding: '3px 6px' }}>Actual</td>{actual.map((v, i) => <td key={i} style={{ textAlign: 'center', padding: 3, fontWeight: 700 }}>{v == null ? '–' : `${v}%`}</td>)}</tr>
                <tr><td style={{ fontWeight: 700, color: C.text2, padding: '3px 6px' }}>Gap</td>{actual.map((a, i) => { const p = plan[i]; if (a == null || p == null) return <td key={i} style={{ textAlign: 'center', padding: 3 }}>–</td>;
                  const g = a - p; return <td key={i} style={{ textAlign: 'center', padding: 3, fontWeight: 700, color: gapColor(g) }}>{g > 0 ? '+' : ''}{g}</td>; })}</tr>
              </tbody>
            </table>
          </div>
        </>)}
      </div>
      {/* phases: actual vs plan */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: C.text2, marginBottom: 8 }}>PHASE PROGRESS · ACTUAL VS PLAN</div>
        {chart.phases.length === 0 ? <div style={{ fontSize: 13, color: C.text3 }}>No phases.</div> : chart.phases.slice(0, 12).map((p, i) => {
          const g = p.actual - p.planned;
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '230px 1fr 160px', gap: 12, alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.name}>{p.name}</div>
              <div style={{ position: 'relative', height: 12, borderRadius: 6, background: '#e3e9f1' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 6, background: STATUS_HEX[p.status] || '#1b4f8f', width: `${Math.min(100, p.actual)}%` }} />
                <div title="Plan" style={{ position: 'absolute', top: -3, bottom: -3, width: 3, borderRadius: 2, background: '#0f2a4a', left: `calc(${Math.min(100, p.planned)}% - 1px)` }} />
              </div>
              <div style={{ fontSize: 11, color: C.text2, textAlign: 'right' }}><b style={{ color: C.text }}>{p.actual}%</b> / plan {p.planned}% · <b style={{ color: gapColor(g) }}>{g > 0 ? '+' : ''}{g}</b></div>
            </div>
          );
        })}
      </div>
      {/* milestones by status */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: C.text2, marginBottom: 8 }}>MILESTONES BY STATUS</div>
        {msBar('Project milestones', chart.milestones.project || {})}
        {msBar('Billing milestones', chart.milestones.billing || {})}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, color: C.text2, marginTop: 4 }}>{STATUSES.map((s) => legendDot(STATUS_HEX[s], s, 10))}</div>
      </div>
    </section>
  );
}

/* ── Methodology stages with the project checklist of each stage ─────── */
export function MethodologyStages({ stages, asOf, startDate }: { stages: NonNullable<MonthlyReportData['stages']>; asOf: string; startDate: string }) {
  const days = toDate(startDate) && toDate(asOf) ? differenceInCalendarDays(toDate(asOf)!, toDate(startDate)!) : null;
  const LIM = 8;
  return (
    <section style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <h3 style={h3}>Progress by methodology stage</h3>
        <span style={{ fontSize: 11, color: C.text3 }}>Project checklist of each stage{days != null && days >= 0 ? ` · day ${days + 1} since project start (${dmy(startDate)})` : ''}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        {stages.map((st, i) => {
          const done = st.items.filter((x) => x.state === 'done').length;
          const total = st.items.filter((x) => x.state !== 'na').length;
          const pct = total ? Math.round((done / total) * 100) : 0;
          const tone = st.state === 'passed' ? { bg: '#F0FDF4', label: 'Completed', fg: '#047857' } : st.state === 'current' ? { bg: '#F8FAFF', label: 'In progress', fg: '#4338CA' } : { bg: C.white, label: 'Upcoming', fg: C.text3 };
          return (
            <div key={i} style={{ border: `1px solid ${st.state === 'current' ? '#C7D2FE' : C.border}`, borderRadius: 10, padding: 12, background: tone.bg, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <PhaseIconBadge phase={{ icon: st.icon, color: st.color }} index={i} size={30} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{String(i + 1).padStart(2, '0')} · {st.name}</div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: tone.fg }}>{tone.label}{st.noGate ? '' : ''}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ flex: 1, height: 6, borderRadius: 3, background: C.bg2, overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${pct}%`, background: st.state === 'passed' ? C.green : C.primary }} /></span>
                <span style={{ fontSize: 10.5, color: C.text2, whiteSpace: 'nowrap' }}>{done}/{total} checklist</span>
              </div>
              {st.deliverablesTotal > 0 && <div style={{ fontSize: 10.5, color: C.text2 }}>Deliverables {st.deliverablesDone}/{st.deliverablesTotal}</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {st.items.length === 0 && <span style={{ fontSize: 11, color: C.text3 }}>No checklist topics</span>}
                {st.items.slice(0, LIM).map((it, k) => (
                  <div key={k} style={{ display: 'flex', gap: 5, alignItems: 'flex-start', fontSize: 11, lineHeight: 1.35, color: it.state === 'na' ? C.text3 : C.text, textDecoration: it.state === 'na' ? 'line-through' : 'none' }}>
                    <span style={{ flexShrink: 0, marginTop: 1, display: 'inline-flex' }}>
                      {it.state === 'done' ? <CheckCircle2 size={12} color="#047857" /> : it.state === 'na' ? <MinusCircle size={12} color={C.text3} /> : <Circle size={12} color={C.text3} />}
                    </span>
                    <span>{it.title}</span>
                  </div>
                ))}
                {st.items.length > LIM && <span style={{ fontSize: 10.5, color: C.text3 }}>+{st.items.length - LIM} more</span>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
