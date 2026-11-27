import React from 'react';
import { differenceInCalendarDays, endOfMonth, format, isValid, parseISO, startOfMonth } from 'date-fns';
import { Btn, C } from '../Common';
import { fmtDate, fmtMoney } from '../../utils';
import { periodLabel, shiftPeriod, type MonthlyReportData } from '../../utils/monthlyReport';
import type { MonthlyReport, ReportStatus } from '../../types';
import { MethodologyStages, PhaseTimeline, ProgressOverview } from './ReportSections';
import { splitSummary } from '../../utils/externalStatus';

const F = 'Poppins, sans-serif';

export const STATUS_LOOK: Record<ReportStatus, { label: string; bg: string; fg: string; dot: string }> = {
  completed: { label: 'Completed', bg: '#DBE7FB', fg: '#1E4FA8', dot: '#2f6fde' },
  on_track: { label: 'On Track', bg: '#D6F0E3', fg: '#1F7A51', dot: '#2e9e6b' },
  at_risk: { label: 'At Risk', bg: '#FBF0CC', fg: '#8A6400', dot: '#e0a100' },
  off_track: { label: 'Delayed', bg: '#F8DADA', fg: '#B02E2E', dot: '#d64545' },
  not_started: { label: 'Not Started', bg: '#E6EBF2', fg: '#475569', dot: '#94a3b8' },
};

export type AreaKey = 'schedule' | 'budget' | 'scope' | 'payment';
export const AREAS: { key: AreaKey; label: string; field: keyof MonthlyReport }[] = [
  { key: 'schedule', label: 'Schedule', field: 'scheduleStatus' },
  { key: 'budget', label: 'Budget', field: 'budgetStatus' },
  { key: 'scope', label: 'Scope', field: 'scopeStatus' },
  { key: 'payment', label: 'Payment', field: 'paymentStatus' },
];

/** Status the report shows: the PM's choice, else the suggestion from the numbers. */
export function effectiveStatus(record: MonthlyReport | null, data: MonthlyReportData, key: AreaKey | 'overall'): ReportStatus {
  const field = key === 'overall' ? 'overallStatus' : AREAS.find((a) => a.key === key)!.field;
  return ((record?.[field] as ReportStatus | null) ?? data.suggested[key]);
}

/** One line on why the numbers suggest a status. */
export function statusReason(data: MonthlyReportData, key: AreaKey): string {
  const usedPct = data.manday.budget > 0 ? Math.round((data.manday.used / data.manday.budget) * 100) : 0;
  switch (key) {
    case 'schedule': return `Actual ${data.progress.actual}% vs plan ${data.progress.planned}%`;
    case 'budget': return data.manday.budget > 0 ? `Manday used ${usedPct}% vs progress ${data.progress.actual}%` : 'No manday budget set';
    case 'scope': return `${data.changeRequests.pending} CR pending · ${data.changeRequests.approvedManday} md approved this month`;
    case 'payment': return data.payment.overdue ? `${data.payment.overdue} milestone(s) past due` : 'Nothing past due';
    default: return '';
  }
}

const toDate = (v?: string | null) => { if (!v) return null; const d = parseISO(v); return isValid(d) ? d : null; };
const shortDate = (v?: string | null) => { const d = toDate(v); return d ? format(d, 'dd/MM/yyyy') : '—'; };
const lines = (text: string) => text.split('\n').map((l) => l.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean);

function StatusPill({ status, prefix, big }: { status: ReportStatus; prefix?: string; big?: boolean }) {
  const s = STATUS_LOOK[status];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: big ? 30 : 22, padding: big ? '0 12px' : '0 8px', borderRadius: 999, background: s.bg, color: s.fg, fontSize: big ? 13 : 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot }} />
      {prefix}{s.label}
    </span>
  );
}

interface Props {
  data: MonthlyReportData;
  record: MonthlyReport | null;
  showAmounts: boolean;
  canEdit: boolean;
  busy: boolean;
  publishedPeriods: string[];
  onEdit: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onOpenPeriod: (period: string) => void;
}

/** Print only the report (A4 landscape), without the app around it or the buttons. */
const PRINT_CSS = `
@media print {
  @page { size: A4 landscape; margin: 8mm; }
  body * { visibility: hidden !important; }
  .one-page-print, .one-page-print * { visibility: visible !important; }
  .one-page-print { position: absolute !important; left: 0; top: 0; width: 100% !important; padding: 0 !important; }
  .one-page-print .no-print { display: none !important; }
  .one-page-print section { break-inside: avoid; }
  html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: #fff !important; }
}`;

export default function MonthlyReportView({ data, record, showAmounts, canEdit, busy, publishedPeriods, onEdit, onPublish, onUnpublish, onOpenPeriod }: Props) {
  const published = record?.state === 'published';
  const prevLabel = format(parseISO(`${shiftPeriod(data.period, -1)}-01`), 'MMMM');
  const monthName = format(parseISO(`${data.period}-01`), 'MMMM');
  const nextName = format(parseISO(`${shiftPeriod(data.period, 1)}-01`), 'MMMM');
  const money = (n: number) => `฿${fmtMoney(n)}`;

  const card: React.CSSProperties = { background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, minWidth: 0 };
  const h3: React.CSSProperties = { margin: 0, fontSize: 16, fontWeight: 700, color: C.text };
  const sub: React.CSSProperties = { fontSize: 11, color: C.text3 };
  const row: React.CSSProperties = { display: 'flex', gap: 10, padding: '7px 0', borderTop: `1px solid ${C.border}`, fontSize: 13, alignItems: 'baseline' };

  // ── KPIs ────────────────────────────────────────────────────────────────
  const { progress, goLive, manday, payment, issues, changeRequests: cr } = data;
  const progressDelta = progress.previous == null ? 'No figure for last month' : `${progress.actual - progress.previous >= 0 ? '▲ +' : '▼ '}${progress.actual - progress.previous} pts vs ${prevLabel}`;
  const goLiveShift = goLive.previous && goLive.date && toDate(goLive.previous) && toDate(goLive.date)
    ? differenceInCalendarDays(toDate(goLive.date)!, toDate(goLive.previous)!) : null;
  const usedPct = manday.budget > 0 ? Math.round((manday.used / manday.budget) * 100) : 0;
  const paidPct = payment.total > 0 ? Math.round((payment.paid / payment.total) * 100) : 0;
  const kpis = [
    { label: 'Progress', value: `${progress.actual}%`, delta: progressDelta, deltaFg: progress.previous != null && progress.actual < progress.previous ? '#B91C1C' : C.text2, sub: `Plan today ${progress.planned}%${progress.planned > progress.actual ? ` (−${progress.planned - progress.actual} pts)` : ''}`, color: STATUS_LOOK[effectiveStatus(record, data, 'schedule')].dot },
    { label: 'Go-live', value: goLive.date ? format(toDate(goLive.date) || new Date(), 'dd/MM/yyyy') : '—', delta: goLiveShift == null ? 'Project end date' : goLiveShift === 0 ? `No change vs ${prevLabel}` : `${goLiveShift > 0 ? 'Moved +' : 'Moved '}${goLiveShift} days vs ${prevLabel}`, deltaFg: goLiveShift && goLiveShift > 0 ? '#B91C1C' : C.text2, sub: data.project.status, color: STATUS_LOOK[effectiveStatus(record, data, 'schedule')].dot },
    { label: 'Manday used', value: manday.budget > 0 ? `${usedPct}%` : '—', delta: `${fmtMoney(manday.used)} of ${fmtMoney(manday.budget)} md`, deltaFg: C.text2, sub: `Progress ${progress.actual}%`, color: STATUS_LOOK[effectiveStatus(record, data, 'budget')].dot },
    { label: 'Payment received', value: payment.total > 0 ? `${paidPct}%` : '—', delta: payment.overdue ? `${payment.overdue} milestone(s) past due` : 'Nothing past due', deltaFg: payment.overdue ? '#B91C1C' : C.text2, sub: showAmounts ? `${money(payment.paid)} of ${money(payment.total)}` : 'Amounts hidden for your role', color: STATUS_LOOK[effectiveStatus(record, data, 'payment')].dot },
    { label: 'Open issues', value: String(issues.open), delta: `+${issues.opened} new · ${issues.closed} closed`, deltaFg: C.text2, sub: `${issues.blocked} blocked · ${issues.risksOpen} open risks`, color: issues.blocked ? C.red : C.blue },
    { label: 'Change requests', value: String(cr.inMonth.length), delta: `${cr.approvedManday} md approved in ${monthName}`, deltaFg: C.text2, sub: `${cr.pending} pending review`, color: STATUS_LOOK[effectiveStatus(record, data, 'scope')].dot },
  ];
  const overall: ReportStatus = effectiveStatus(record, data, 'overall');

  // ── Timeline geometry ──────────────────────────────────────────────────
  const tl = data.timeline;
  const tlStart = tl.months.length ? startOfMonth(parseISO(`${tl.months[0]}-01`)) : null;
  const tlEnd = tl.months.length ? endOfMonth(parseISO(`${tl.months[tl.months.length - 1]}-01`)) : null;
  const span = tlStart && tlEnd ? tlEnd.getTime() - tlStart.getTime() : 1;
  const pos = (v?: string | null) => {
    const d = toDate(v);
    if (!d || !tlStart) return null;
    return Math.min(100, Math.max(0, ((d.getTime() - tlStart.getTime()) / span) * 100));
  };
  const asOfPos = pos(data.asOf);
  const asOfDate = toDate(data.asOf)!;
  const msColor = (status: string, date: string) => {
    if (status === 'paid') return C.green;
    if ((toDate(date)?.getTime() ?? Infinity) < asOfDate.getTime()) return C.red;
    return status === 'billed' ? C.blue : C.text3;
  };

  const summaryLines = lines(record?.summary || '');
  // Paragraph = executive summary; "Achieved: / In progress: / Attention required:" lines = key highlights. Old bullet-only text stays a list.
  const parsed = splitSummary(record?.summary || '');
  const summaryParts = parsed.summaryPoints.some((x) => x.label) || summaryLines.length === 1 ? parsed : { execSummary: '', summaryPoints: [] as typeof parsed.summaryPoints };
  const decisionLines = lines(record?.decisions || '');
  const projectTitle = `${data.project.code}${data.project.customerAbbreviation ? ` (${data.project.customerAbbreviation})` : ''}`;

  return (
    <div className="one-page-print" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, fontFamily: F, color: C.text }}>
      <style>{PRINT_CSS}</style>
      {/* Header */}
      <section style={{ ...card, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
        <div style={{ flex: '1 1 360px', minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: C.text2 }}>MONTHLY EXECUTIVE REPORT · INTERNAL · {periodLabel(data.period).toUpperCase()}</div>
          <h1 style={{ margin: '4px 0 2px', fontSize: 20, fontWeight: 800 }}>{projectTitle} · {data.project.name}</h1>
          <div style={{ fontSize: 13, color: C.text2 }}>
            {data.project.client || '—'} · Stage: {data.project.status || '—'} · {shortDate(data.project.startDate)} – {shortDate(data.project.endDate)}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <StatusPill status={overall} prefix="Overall: " big />
          <Btn variant="ghost" className="no-print" onClick={() => window.print()} title="Print this report or save it as PDF">Print / PDF</Btn>
          <span className="no-print" style={{ fontSize: 11, fontWeight: 600, color: published ? '#047857' : '#B45309' }}>
            {published ? `Published ${record?.publishedAt ? format(new Date(record.publishedAt), 'dd/MM/yyyy') : ''}` : 'Draft · not published'}
          </span>
          {canEdit && !published && <Btn variant="outline" className="no-print" onClick={onEdit} disabled={busy}>Edit summary</Btn>}
          {canEdit && !published && <Btn className="no-print" onClick={onPublish} disabled={busy}>Publish {monthName}</Btn>}
          {canEdit && published && <Btn variant="ghost" className="no-print" onClick={onUnpublish} disabled={busy} title="Back to draft: numbers become live again; the text is kept">Unpublish</Btn>}
        </div>
      </section>

      {/* KPIs */}
      <section aria-label="Key numbers" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        {kpis.map((k) => (
          <div key={k.label} style={{ ...card, padding: '14px 16px', borderTop: `3px solid ${k.color}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.text2 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, margin: '2px 0' }}>{k.value}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: k.deltaFg }}>{k.delta}</div>
            <div style={{ fontSize: 11, color: C.text3 }}>{k.sub}</div>
          </div>
        ))}
      </section>

      {/* Summary + status + decisions */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        <div style={card}>
          <h3 style={{ ...h3, marginBottom: 10 }}>Executive summary</h3>
          {summaryParts.execSummary || summaryParts.summaryPoints.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {summaryParts.execSummary && <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65 }}>{summaryParts.execSummary}</p>}
              {summaryParts.summaryPoints.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: C.text2, marginBottom: 6 }}>KEY HIGHLIGHTS &amp; ATTENTION REQUIRED</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {summaryParts.summaryPoints.map((p, i) => {
                      const color = /attention|depend|risk|decision/i.test(p.label) ? '#d64545' : /progress|current/i.test(p.label) ? '#2e9e6b' : /achiev|complet/i.test(p.label) ? '#2f6fde' : C.text2;
                      return (
                        <div key={i} style={{ borderLeft: `3px solid ${color}`, background: C.bg, borderRadius: '0 6px 6px 0', padding: '6px 10px', fontSize: 12.5, lineHeight: 1.5 }}>
                          {p.label && <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color }}>{p.label}</div>}
                          {p.text}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : summaryLines.length ? (
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, lineHeight: 1.6 }}>
              {summaryLines.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          ) : (
            <div style={{ fontSize: 13, color: C.text3 }}>{canEdit ? `No summary yet. Use "Edit summary": it opens with an auto draft from this month's numbers.` : 'No summary for this month yet.'}</div>
          )}
        </div>
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <h3 style={{ ...h3, marginBottom: 10 }}>Status by area</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              {AREAS.map((a) => {
                const s = STATUS_LOOK[effectiveStatus(record, data, a.key)];
                return (
                  <div key={a.key} title={statusReason(data, a.key)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, background: s.bg }}>
                    <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{a.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: s.fg }}>{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <h3 style={{ ...h3, marginBottom: 8 }}>Decisions needed from management</h3>
            {decisionLines.length ? (
              <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, lineHeight: 1.5 }}>
                {decisionLines.map((l, i) => <li key={i}>{l}</li>)}
              </ol>
            ) : <div style={{ fontSize: 13, color: C.text3 }}>None this month.</div>}
          </div>
        </div>
      </section>

      {/* Timeline */}
      {data.phasePlan ? <PhaseTimeline plan={data.phasePlan} asOf={data.asOf} published={published} /> : (
      <section style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <h3 style={h3}>Timeline</h3>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, color: C.text2 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 8, borderRadius: 4, background: '#C7D2FE' }} />Plan</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 8, borderRadius: 4, background: C.primary }} />Actual</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, transform: 'rotate(45deg)', background: C.text }} />Milestone</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 2, height: 12, background: C.red }} />{published ? 'Report date' : 'Today'}</span>
          </div>
        </div>
        {!tl.months.length || !tl.phases.length ? <div style={{ fontSize: 13, color: C.text3 }}>No plan dates yet.</div> : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: Math.max(640, 160 + tl.months.length * 64) }}>
              <div style={{ display: 'grid', gridTemplateColumns: `160px repeat(${tl.months.length}, minmax(0, 1fr))`, fontSize: 11 }}>
                <span />
                {tl.months.map((m) => {
                  const current = m === data.period;
                  return <span key={m} style={{ padding: '4px 6px', borderLeft: `1px solid ${C.border}`, color: current ? C.primary : C.text2, fontWeight: current ? 700 : 500, background: current ? C.primaryBg : 'transparent', whiteSpace: 'nowrap', overflow: 'hidden' }}>{format(parseISO(`${m}-01`), 'MMM yy')}</span>;
                })}
              </div>
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                {tl.phases.map((ph, index) => {
                  const ps = pos(ph.planStart); const pe = pos(ph.planEnd);
                  const as = pos(ph.start); const ae = pos(ph.end);
                  const actualEnd = as != null && ae != null ? as + (ae - as) * Math.min(1, ph.percent / 100) : null;
                  const late = ph.percent < 100 && (toDate(ph.end)?.getTime() ?? Infinity) < asOfDate.getTime();
                  return (
                    <div key={`${ph.name}-${index}`} style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center', height: 26 }}>
                      <span title={`${ph.name} · ${ph.percent}%`} style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 8 }}>{ph.name}</span>
                      <span style={{ position: 'relative', height: '100%' }}>
                        {ps != null && pe != null && <span style={{ position: 'absolute', top: 4, height: 8, borderRadius: 4, background: '#C7D2FE', left: `${ps}%`, width: `${Math.max(0.5, pe - ps)}%` }} />}
                        {as != null && actualEnd != null && ph.percent > 0 && <span style={{ position: 'absolute', top: 14, height: 8, borderRadius: 4, background: late ? C.amber : C.primary, left: `${as}%`, width: `${Math.max(0.5, actualEnd - as)}%` }} />}
                      </span>
                    </div>
                  );
                })}
                {tl.milestones.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center', height: 26 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>Milestones</span>
                    <span style={{ position: 'relative', height: '100%' }}>
                      {tl.milestones.map((m, i) => {
                        const p = pos(m.date);
                        return p == null ? null : (
                          <span key={`${m.name}-${i}`} title={`${m.name} · ${shortDate(m.date)} · ${m.status}`}
                            style={{ position: 'absolute', top: 8, width: 10, height: 10, marginLeft: -5, transform: 'rotate(45deg)', left: `${p}%`, background: msColor(m.status, m.date) }} />
                        );
                      })}
                    </span>
                  </div>
                )}
                {asOfPos != null && <span aria-hidden="true" style={{ position: 'absolute', top: -26, bottom: 0, width: 2, background: C.red, left: `calc(160px + (100% - 160px) * ${asOfPos / 100})` }} />}
              </div>
            </div>
          </div>
        )}
      </section>
      )}

      {/* Progress Overview */}
      {data.progressChart && <ProgressOverview chart={data.progressChart} />}

      {/* Progress by methodology stage (falls back to the old phase summary) */}
      {data.stages && data.stages.length > 0 ? <MethodologyStages stages={data.stages} asOf={data.asOf} startDate={data.project.startDate} /> : (
      <section style={card}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <h3 style={h3}>Completed since project start</h3>
          <span style={sub}>{shortDate(data.project.startDate)} – {shortDate(data.asOf)}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, fontSize: 13, color: C.text2, marginBottom: 14 }}>
          <span><strong style={{ color: C.text }}>{data.completed.tasksDone} of {data.completed.tasksTotal}</strong> tasks done</span>
          <span><strong style={{ color: C.text }}>{data.completed.milestonesAchieved} of {data.completed.milestonesTotal}</strong> milestones achieved</span>
          <span><strong style={{ color: C.text }}>{data.completed.phasesComplete} of {data.completed.phasesTotal}</strong> phases complete</span>
          <span><strong style={{ color: C.text }}>{cr.delivered}</strong> change requests delivered</span>
        </div>
        {data.completed.phases.length === 0 ? <div style={{ fontSize: 13, color: C.text3 }}>No tasks in the plan yet.</div> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {data.completed.phases.map((p, index) => {
              const done = p.state === 'done';
              const started = p.state === 'progress';
              const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
              return (
                <div key={`${p.name}-${index}`} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, background: done ? '#F0FDF4' : C.white }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '0 8px', borderRadius: 999, whiteSpace: 'nowrap', background: done ? C.greenBg : started ? C.primaryBg : C.bg2, color: done ? '#047857' : started ? '#4338CA' : C.text2 }}>
                      {done ? `Completed ${p.finishedOn ? format(parseISO(p.finishedOn), 'dd/MM/yyyy') : ''}` : started ? 'In progress' : 'Not started'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ flex: 1, height: 6, borderRadius: 3, background: C.bg2, position: 'relative', overflow: 'hidden' }}>
                      <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: done ? C.green : C.primary, borderRadius: 3 }} />
                    </span>
                    <span style={{ fontSize: 11, color: C.text2, whiteSpace: 'nowrap' }}>{p.done} / {p.total} tasks</span>
                  </div>
                  {p.items.length ? p.items.map((it, i) => (
                    <div key={i} style={{ display: 'flex', gap: 6, fontSize: 11, lineHeight: 1.5 }}>
                      <span aria-hidden="true" style={{ color: '#047857', fontWeight: 700 }}>✓</span><span>{it}</span>
                    </div>
                  )) : <div style={{ fontSize: 11, color: C.text3 }}>Nothing finished yet</div>}
                </div>
              );
            })}
          </div>
        )}
      </section>
      )}

      {/* Done / next / issues */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <div style={card}>
          <h3 style={h3}>Done this month</h3>
          <div style={{ ...sub, margin: '2px 0 10px' }}>Tasks finished in {monthName} · {data.doneThisMonth.count}</div>
          {data.doneThisMonth.items.length ? data.doneThisMonth.items.map((t, i) => (
            <div key={i} style={row}><span aria-hidden="true" style={{ color: '#047857', fontWeight: 700 }}>✓</span><span style={{ flex: 1 }}>{t.name}</span><span style={{ ...sub, whiteSpace: 'nowrap' }}>{fmtDate(t.date)}</span></div>
          )) : <div style={{ fontSize: 13, color: C.text3 }}>No tasks finished this month.</div>}
          {data.doneThisMonth.count > data.doneThisMonth.items.length && <div style={{ ...sub, marginTop: 6 }}>+{data.doneThisMonth.count - data.doneThisMonth.items.length} more</div>}
        </div>
        <div style={card}>
          <h3 style={h3}>Plan for next month</h3>
          <div style={{ ...sub, margin: '2px 0 10px' }}>Tasks due in {nextName} · {data.nextMonth.count}</div>
          {data.nextMonth.items.length ? data.nextMonth.items.map((t, i) => (
            <div key={i} style={row}><span aria-hidden="true" style={{ color: C.primary, fontWeight: 700 }}>→</span><span style={{ flex: 1 }}>{t.name}</span><span style={{ ...sub, whiteSpace: 'nowrap' }}>{fmtDate(t.date)}</span></div>
          )) : <div style={{ fontSize: 13, color: C.text3 }}>No tasks due next month.</div>}
          {data.nextMonth.count > data.nextMonth.items.length && <div style={{ ...sub, marginTop: 6 }}>+{data.nextMonth.count - data.nextMonth.items.length} more</div>}
        </div>
        <div style={card}>
          <h3 style={h3}>Top issues &amp; risks</h3>
          <div style={{ ...sub, margin: '2px 0 10px' }}>Open · {issues.open} issues · {issues.risksOpen} risks</div>
          {data.topIssues.length ? data.topIssues.map((it, i) => {
            const issue = it.kind === 'Issue';
            const blocked = it.status === 'Blocked';
            return (
              <div key={i} style={{ padding: '8px 0', borderTop: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '0 8px', borderRadius: 999, background: issue ? (blocked ? C.redBg : C.blueBg) : C.amberBg, color: issue ? (blocked ? '#B91C1C' : '#1D4ED8') : '#92400E' }}>{it.kind}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{it.title}</span>
                </div>
                <div style={{ ...sub, color: C.text2, marginTop: 3 }}>{it.meta}</div>
              </div>
            );
          }) : <div style={{ fontSize: 13, color: C.text3 }}>No open issues or risks.</div>}
        </div>
      </section>

      {/* Billing + CR */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
        <div style={{ ...card, overflowX: 'auto' }}>
          <h3 style={{ ...h3, marginBottom: 10 }}>Milestones &amp; billing</h3>
          {data.billing.length === 0 ? <div style={{ fontSize: 13, color: C.text3 }}>No milestones.</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 420 }}>
              <thead>
                <tr>
                  {['Milestone', 'Due', ...(showAmounts ? ['Amount'] : []), 'Status'].map((h) => (
                    <th key={h} style={{ textAlign: h === 'Amount' ? 'right' : 'left', fontSize: 11, color: C.text2, padding: '6px 8px', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.billing.map((b, i) => {
                  const paid = b.status === 'paid';
                  const overdue = !paid && b.overdueDays > 0;
                  const label = paid ? 'Paid' : `${b.status === 'billed' ? 'Billed' : 'Pending'}${overdue ? ` · overdue ${b.overdueDays}d` : ''}`;
                  return (
                    <tr key={i}>
                      <td style={{ padding: 8, borderBottom: `1px solid ${C.border}` }}>{b.name}</td>
                      <td style={{ padding: 8, borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{shortDate(b.due)}</td>
                      {showAmounts && <td style={{ padding: 8, borderBottom: `1px solid ${C.border}`, textAlign: 'right' }}>{money(b.amount)}</td>}
                      <td style={{ padding: 8, borderBottom: `1px solid ${C.border}` }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 999, whiteSpace: 'nowrap', background: paid ? C.greenBg : overdue ? C.redBg : C.bg2, color: paid ? '#047857' : overdue ? '#B91C1C' : C.text2 }}>{label}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div style={card}>
          <h3 style={{ ...h3, marginBottom: 10 }}>Change requests this month</h3>
          {cr.inMonth.length ? cr.inMonth.map((c, i) => (
            <div key={i} style={row}>
              <span style={{ fontWeight: 600 }}>{c.id}</span><span style={{ flex: 1 }}>{c.title}</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 999, background: c.status === 'Rejected' ? C.redBg : ['Approved', 'Implemented', 'Close'].includes(c.status) ? C.greenBg : C.blueBg, color: c.status === 'Rejected' ? '#B91C1C' : ['Approved', 'Implemented', 'Close'].includes(c.status) ? '#047857' : '#1D4ED8', whiteSpace: 'nowrap' }}>
                {c.status} · {c.manday} md
              </span>
            </div>
          )) : <div style={{ fontSize: 13, color: C.text3 }}>No change requests this month.</div>}
        </div>
      </section>

      <footer className="no-print" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, fontSize: 11, color: C.text3, padding: '0 2px 8px' }}>
        <span>
          {published
            ? `Numbers frozen on ${shortDate(data.asOf)} when the report was published`
            : data.period < format(new Date(), 'yyyy-MM')
              ? 'Not published: progress, issue and payment figures are today\'s values; task lists follow the month'
              : `Live numbers as of ${shortDate(data.asOf)} · they freeze when the report is published`}
        </span>
        {publishedPeriods.filter((p) => p !== data.period).length > 0 && (
          <span>
            Earlier reports:{' '}
            {publishedPeriods.filter((p) => p !== data.period).slice(0, 6).map((p, i) => (
              <React.Fragment key={p}>
                {i > 0 && ' · '}
                <button type="button" onClick={() => onOpenPeriod(p)} style={{ border: 0, background: 'transparent', padding: 0, color: C.primary, fontFamily: F, fontSize: 11, cursor: 'pointer' }}>{periodLabel(p)}</button>
              </React.Fragment>
            ))}
          </span>
        )}
      </footer>
    </div>
  );
}
