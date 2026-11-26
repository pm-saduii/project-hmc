import React from 'react';
import { C, FormRow, Input, Select } from '../Common';

export interface ExternalFieldValues {
  dueDate?: string | null; impactArea?: string; nextAction?: string; visibility?: 'External' | 'Internal'; steering?: string; steeringAsk?: string;
}
const IMPACTS: [string, string][] = [['S', 'Scope'], ['T', 'Time'], ['C', 'Cost'], ['Q', 'Quality']];

/** Fields an issue or risk needs for the External Status Report (and Items for Steering). */
export default function ExternalFields({ value, withAction, onChange }: {
  value: ExternalFieldValues; withAction?: boolean; onChange: (key: keyof ExternalFieldValues, v: string | null) => void;
}) {
  const picked = new Set(String(value.impactArea || '').split(',').map((x) => x.trim()).filter(Boolean));
  const toggle = (k: string) => {
    const next = new Set(picked);
    if (next.has(k)) next.delete(k); else next.add(k);
    onChange('impactArea', IMPACTS.map(([x]) => x).filter((x) => next.has(x)).join(','));
  };
  return (
    <div style={{ border: `1px dashed ${C.border2}`, borderRadius: 10, padding: '10px 12px', margin: '4px 0 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', color: C.text2 }}>EXTERNAL STATUS REPORT</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <FormRow label="Due date"><Input type="date" value={value.dueDate || ''} onChange={(v) => onChange('dueDate', v || null)} /></FormRow>
        <FormRow label="Impact">
          <div role="group" aria-label="Impact" style={{ display: 'flex', gap: 4, height: 36, alignItems: 'center' }}>
            {IMPACTS.map(([k, label]) => (
              <button key={k} type="button" title={label} aria-pressed={picked.has(k)} onClick={() => toggle(k)}
                style={{ width: 32, height: 30, borderRadius: 6, cursor: 'pointer', fontFamily: 'Poppins, sans-serif', fontSize: 13, fontWeight: 700,
                  border: `1px solid ${picked.has(k) ? C.primary : C.border}`, background: picked.has(k) ? C.primary : C.white, color: picked.has(k) ? '#fff' : C.text2 }}>{k}</button>
            ))}
          </div>
        </FormRow>
        <FormRow label="Show to customer">
          <Select value={value.visibility || 'External'} onChange={(v) => onChange('visibility', v)}
            options={[{ value: 'External', label: 'Yes (External)' }, { value: 'Internal', label: 'No (Internal)' }]} />
        </FormRow>
      </div>
      {withAction && <FormRow label="Next action"><Input value={value.nextAction || ''} onChange={(v) => onChange('nextAction', v)} placeholder="What happens next and by whom" /></FormRow>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
        <FormRow label="Steering">
          <Select value={value.steering || ''} onChange={(v) => onChange('steering', v)}
            options={[{ value: '', label: '— Not for Steering —' }, { value: 'Decision', label: 'Decision needed' }, { value: 'Acknowledge', label: 'For acknowledgement' }]} />
        </FormRow>
        {value.steering ? (
          <FormRow label="Ask from Steering"><Input value={value.steeringAsk || ''} onChange={(v) => onChange('steeringAsk', v)} placeholder="e.g. Approve the new UAT date" /></FormRow>
        ) : <span />}
      </div>
    </div>
  );
}
