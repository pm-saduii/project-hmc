import React from 'react';
import { FileDown, Lock, PenLine } from 'lucide-react';
import { C } from '../components/Common';
import { OWNER_INFO, methodologyApi, type Methodology } from '../services/methodology';

const F = 'Poppins, sans-serif';

const CADENCE: [string, string, string][] = [
  ['Every Friday', 'External Status Report', 'Weekly status sent to the customer'],
  ['Every week', 'Internal Status', 'Status, activities and billing for the team only'],
  ['Within 2 working days', 'Minutes of Meeting', 'MOM with actions, issues and decisions after each meeting'],
  ['Monthly', 'Steering Committee', 'Status by area, decisions needed, risks and change requests'],
  ['Monthly, by the 5th', 'Budget Control Report', 'Prepared by the PM → reviewed by the Account Manager → approved by a Director'],
  ['When scope changes', 'Change Request', 'Pre-check, then the CR form'],
];

/** /methodology — the company implementation methodology: phases, steps, deliverables and gates. */
export default function MethodologyPage() {
  const [method, setMethod] = React.useState<Methodology | null>(null);
  const [error, setError] = React.useState('');
  React.useEffect(() => {
    methodologyApi.load().then(setMethod).catch((e) => setError(e instanceof Error ? e.message : 'Unable to load'));
  }, []);

  const card: React.CSSProperties = { background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18 };

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px 32px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 16, fontFamily: F }}>
      <div>
        <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: C.text }}>Methodology</h1>
        <p style={{ margin: 0, fontSize: 13, color: C.text2, maxWidth: 760 }}>
          The company's implementation protocol: five phases, the steps in each, the documents every project delivers, and the gate a phase must pass before the next one starts.
          Track a project against it in the project's Delivery › Deliverables page.
        </p>
      </div>

      {error && <div style={{ ...card, color: C.red, fontSize: 13 }}>{/relation|schema cache/i.test(error) ? 'The methodology is not set up yet: run the migration 2026-11-27-methodology-and-budget-control.sql.' : error}</div>}
      {!method && !error && <div style={{ fontSize: 13, color: C.text2 }}>Loading…</div>}

      {method && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${method.phases.filter((p) => p.active).length || 1}, minmax(0, 1fr))`, gap: 6 }}>
            {method.phases.filter((p) => p.active).sort((a, b) => a.sortOrder - b.sortOrder).map((p, i) => (
              <a key={p.id} href={`#phase-${p.id}`} style={{ padding: '10px 12px', borderRadius: 10, textDecoration: 'none', background: i === 0 ? '#C7D2FE' : i === 1 ? '#A5B4FC' : i === 2 ? '#6366F1' : i === 3 ? '#4F46E5' : '#312E81', color: i < 2 ? '#1E1B4B' : '#FFFFFF' }}>
                <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.85 }}>PHASE {i + 1}</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div>
              </a>
            ))}
          </div>

          {method.phases.filter((p) => p.active).sort((a, b) => a.sortOrder - b.sortOrder).map((p, i) => {
            const steps = method.steps.filter((s) => s.phaseId === p.id).sort((a, b) => a.sortOrder - b.sortOrder);
            const loose = method.deliverables.filter((d) => d.active && d.phaseId === p.id && !steps.some((s) => s.id === d.stepId));
            return (
              <section key={p.id} id={`phase-${p.id}`} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.text2 }}>PHASE {i + 1}</div>
                  <h2 style={{ margin: '2px 0 2px', fontSize: 16, fontWeight: 700, color: C.text }}>{p.name}</h2>
                  <div style={{ fontSize: 13, color: C.text2 }}>{p.description}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
                  {steps.map((s) => {
                    const dels = method.deliverables.filter((d) => d.active && d.stepId === s.id).sort((a, b) => a.sortOrder - b.sortOrder);
                    const o = OWNER_INFO[s.owner];
                    return (
                      <div key={s.id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{s.name}</span>
                          <span title="Main owner" style={{ fontSize: 11, fontWeight: 700, padding: '0 8px', borderRadius: 999, background: o.bg, color: o.fg, whiteSpace: 'nowrap' }}>{o.label}</span>
                        </div>
                        <div style={{ fontSize: 13, color: C.text2 }}>{s.objective}</div>
                        {s.activities.length > 0 && (
                          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: C.text, lineHeight: 1.7 }}>
                            {s.activities.map((a, k) => <li key={k}>{a}</li>)}
                          </ul>
                        )}
                        {dels.length > 0 && (
                          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {dels.map((d) => (
                              <div key={d.id} style={{ fontSize: 11, color: C.text, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                                <span style={{ fontWeight: 600, fontSize: 13 }}>{d.name}</span>
                                {d.requiresSignoff && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#047857', background: C.greenBg, padding: '0 6px', borderRadius: 999, fontWeight: 600 }}><PenLine size={11} />Sign-off</span>}
                                {d.internalOnly && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: C.text2, background: C.bg2, padding: '0 6px', borderRadius: 999, fontWeight: 600 }}><Lock size={11} />Internal</span>}
                                <span style={{ color: C.text3 }}>{d.format}</span>
                                {d.templateUrl && <a href={d.templateUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: C.primary, fontWeight: 600 }}><FileDown size={11} />Template</a>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {loose.length > 0 && <div style={{ fontSize: 13, color: C.text2 }}>Also delivered: {loose.map((d) => d.name).join(', ')}</div>}
                <div style={{ padding: '10px 12px', borderRadius: 10, background: '#F8FAFC', border: `1px dashed ${C.border2}` }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.text2 }}>GATE · </span>
                  <span style={{ fontSize: 13, color: C.text }}>{p.gate}</span>
                </div>
              </section>
            );
          })}

          <section style={card}>
            <h2 style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 700, color: C.text }}>Reporting cadence</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
              {CADENCE.map(([when, what, desc]) => (
                <div key={what} style={{ padding: '10px 12px', borderRadius: 10, background: C.bg }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#4338CA' }}>{when}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{what}</div>
                  <div style={{ fontSize: 11, color: C.text2 }}>{desc}</div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
