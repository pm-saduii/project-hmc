import React from 'react';
import { Btn, C, Modal } from '../Common';
import { periodLabel, type MonthlyReportData } from '../../utils/monthlyReport';
import type { MonthlyReport, ReportStatus } from '../../types';
import { AREAS, STATUS_LOOK, statusReason, type AreaKey } from './MonthlyReportView';

const F = 'Poppins, sans-serif';
/** Overall and schedule can be any of the five; budget, scope and payment are only on track / at risk / delayed. */
const ALL: ReportStatus[] = ['completed', 'on_track', 'at_risk', 'off_track', 'not_started'];
const AREA_ONLY: ReportStatus[] = ['on_track', 'at_risk', 'off_track'];

export interface ReportDraft {
  summary: string;
  decisions: string;
  overallStatus: ReportStatus | null;
  scheduleStatus: ReportStatus | null;
  budgetStatus: ReportStatus | null;
  scopeStatus: ReportStatus | null;
  paymentStatus: ReportStatus | null;
}

export function draftFrom(record: MonthlyReport | null): ReportDraft {
  return {
    summary: record?.summary || '',
    decisions: record?.decisions || '',
    overallStatus: record?.overallStatus ?? null,
    scheduleStatus: record?.scheduleStatus ?? null,
    budgetStatus: record?.budgetStatus ?? null,
    scopeStatus: record?.scopeStatus ?? null,
    paymentStatus: record?.paymentStatus ?? null,
  };
}

interface Props {
  data: MonthlyReportData;
  record: MonthlyReport | null;
  previousSummary: string;
  busy: boolean;
  onClose: () => void;
  onSave: (draft: ReportDraft) => void;
  onPublish: (draft: ReportDraft) => void;
}

/** PM writes the month's summary, decisions and status by area, then saves or publishes. */
export default function MonthlyReportEditor({ data, record, previousSummary, busy, onClose, onSave, onPublish }: Props) {
  const [draft, setDraft] = React.useState<ReportDraft>(() => draftFrom(record));
  const set = <K extends keyof ReportDraft>(key: K, value: ReportDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const fieldOf = (key: AreaKey | 'overall') => (key === 'overall' ? 'overallStatus' : `${key}Status`) as keyof ReportDraft;

  const picker = (key: AreaKey | 'overall', label: string, reason: string) => {
    const field = fieldOf(key);
    const suggested = data.suggested[key];
    const chosen = (draft[field] as ReportStatus | null) ?? suggested;
    return (
      <div key={key} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
          <span style={{ fontSize: 11, color: C.text3 }}>Suggested: {STATUS_LOOK[suggested].label}</span>
        </div>
        <div role="radiogroup" aria-label={`${label} status`} style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {(key === 'overall' || key === 'schedule' ? ALL : AREA_ONLY).map((option) => {
            const look = STATUS_LOOK[option];
            const on = chosen === option;
            return (
              <button key={option} type="button" role="radio" aria-checked={on}
                onClick={() => set(field, (option === suggested ? null : option) as never)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 10px', borderRadius: 999, cursor: 'pointer',
                  fontFamily: F, fontSize: 11, fontWeight: 600,
                  border: `1px solid ${on ? look.dot : C.border}`, background: on ? look.bg : C.white, color: on ? look.fg : C.text2,
                }}>
                <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: look.dot }} />{look.label}
              </button>
            );
          })}
        </div>
        {reason && <div style={{ fontSize: 11, color: C.text3, marginTop: 6 }}>{reason}</div>}
      </div>
    );
  };

  const textarea = (value: string, onChange: (v: string) => void, rows: number, placeholder: string, id: string) => (
    <textarea id={id} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
      style={{ fontFamily: F, fontSize: 13, lineHeight: 1.6, padding: '10px 12px', border: `1.5px solid ${C.border}`, borderRadius: 10, resize: 'vertical', width: '100%', boxSizing: 'border-box', color: C.text, outline: 'none' }} />
  );

  return (
    <Modal title={`Monthly report · ${periodLabel(data.period)}`} onClose={busy ? () => undefined : onClose} width={760} closeOnBackdrop={false}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, fontFamily: F }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <label htmlFor="mr-summary" style={{ fontSize: 13, fontWeight: 600 }}>
              Executive summary <span style={{ fontWeight: 400, color: C.text3 }}>· 3–5 short points: what happened and why</span>
            </label>
            {previousSummary && !draft.summary && (
              <button type="button" onClick={() => set('summary', previousSummary)}
                style={{ border: 0, background: 'transparent', color: C.primary, fontFamily: F, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                Copy last month's text
              </button>
            )}
          </div>
          {textarea(draft.summary, (v) => set('summary', v), 6, 'One point per line', 'mr-summary')}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Status <span style={{ fontWeight: 400, color: C.text3 }}>· suggested from the numbers; pick another to override</span></span>
          {picker('overall', 'Overall', '')}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
            {AREAS.map((a) => picker(a.key, a.label, statusReason(data, a.key)))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label htmlFor="mr-decisions" style={{ fontSize: 13, fontWeight: 600 }}>
            Decisions needed from management <span style={{ fontWeight: 400, color: C.text3 }}>· optional, one per line</span>
          </label>
          {textarea(draft.decisions, (v) => set('decisions', v), 3, 'e.g. Approve moving UAT start to 15 Dec', 'mr-decisions')}
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 10, background: C.primaryBg, fontSize: 13, color: '#3730A3', lineHeight: 1.5 }}>
          Publishing freezes this month's numbers, lists and text so the report shows the same thing at every later meeting. You can unpublish to correct it.
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Btn variant="ghost" onClick={onClose} disabled={busy}>Cancel</Btn>
          <Btn variant="outline" onClick={() => onSave(draft)} disabled={busy}>{busy ? 'Saving…' : 'Save draft'}</Btn>
          <Btn onClick={() => onPublish(draft)} disabled={busy}>Publish {periodLabel(data.period).split(' ')[0]}</Btn>
        </div>
      </div>
    </Modal>
  );
}
