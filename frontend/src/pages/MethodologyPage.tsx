import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, FileDown, Lock, PenLine, Repeat } from 'lucide-react';
import { Btn, C } from '../components/Common';
import { FormModal } from '../components/Admin/AdminUi';
import { useStore } from '../store';
import { currentPhase, methodologyApi, type MethodStep, type Methodology, type Owner, type PhaseGate } from '../services/methodology';
import { isClosedStatus, isHyperCareStatus } from '../utils/projectHealth';
import { projectPath } from '../utils/projectRoutes';

const F = 'Poppins, sans-serif';
const OWNER_COLOR: Record<Owner, string> = { HMC: '#2563EB', Client: '#EA580C', Joint: '#0D9488' };
const PHASE_BG = ['#A5B4FC', '#818CF8', '#6366F1', '#4338CA', '#1E1B4B'];
const CADENCE: { when: string; what: string; note: string; hot?: boolean }[] = [
  { when: 'Every Friday', what: 'External Status', note: 'To the customer · PowerPoint' },
  { when: 'Weekly', what: 'Internal Status', note: 'Team only · with billing' },
  { when: '≤ 2 working days', what: 'Minutes of Meeting', note: 'After each meeting' },
  { when: 'Monthly · by the 5th', what: 'Budget Control', note: 'PM → AM → Director', hot: true },
  { when: 'Ongoing', what: 'RAIDD log', note: 'Risks · actions · issues · decisions' },
  { when: 'When scope changes', what: 'Change Request', note: 'CR form v1.4' },
  { when: 'Monthly', what: 'Steering Committee', note: 'Status · decisions · risks' },
];

/** /methodology — the company implementation protocol on one board: phases → steps → deliverables → gates. */
export default function MethodologyPage() {
  const navigate = useNavigate();
  const projects = useStore((s) => s.projects);
  const masterCodes = useStore((s) => s.masterCodes);
  const [method, setMethod] = React.useState<Methodology | null>(null);
  const [gates, setGates] = React.useState<PhaseGate[]>([]);
  const [error, setError] = React.useState('');
  const [step, setStep] = React.useState<MethodStep | null>(null);

  React.useEffect(() => {
    methodologyApi.load().then(setMethod).catch((e) => setError(e instanceof Error ? e.message : 'Unable to load'));
    methodologyApi.allGates().then(setGates).catch(() => undefined);
  }, []);

  if (error) {
    return <div style={{ padding: 32, fontSize: 13, color: C.red, fontFamily: F }}>{/relation|schema cache/i.test(error) ? 'The methodology is not set up yet: run the migration 2026-11-27-methodology-and-budget-control.sql.' : error}</div>;
  }
  if (!method) return <div style={{ padding: 32, fontSize: 13, color: C.text2, fontFamily: F }}>Loading…</div>;

  const phases = method.phases.filter((p) => p.active).sort((a, b) => a.sortOrder - b.sortOrder);
  const stepsOf = (phaseId: string) => method.steps.filter((s) => s.phaseId === phaseId).sort((a, b) => a.sortOrder - b.sortOrder);
  const delsOf = (stepId: string) => method.deliverables.filter((d) => d.active && d.stepId === stepId).sort((a, b) => a.sortOrder - b.sortOrder);
  // Which running projects are in which phase (first phase whose gate is not passed).
  const label = (status: string) => masterCodes.find((c) => c.codeType === 'project_status' && c.codeValue === status)?.label || '';
  const running = projects.filter((p) => !isClosedStatus(p.status, label(p.status)) && !isHyperCareStatus(p.status, label(p.status)));
  const projectsIn = (phaseId: string) => running.filter((p) => currentPhase(phases, gates.filter((g) => g.projectId === p.id))?.id === phaseId);

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px 32px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 18, fontFamily: F, color: C.text }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800 }}>Methodology</h1>
          <p style={{ margin: 0, fontSize: 13, color: C.text2 }}>One protocol for every project. Click a step for its checklist and templates.</p>
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, color: C.text2 }}>
          {(Object.keys(OWNER_COLOR) as Owner[]).map((o) => (
            <span key={o} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: OWNER_COLOR[o] }} />{o === 'HMC' ? 'HMC leads' : o === 'Client' ? 'Client leads' : 'Joint'}</span>
          ))}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><PenLine size={11} />Sign-off</span>
        </div>
      </div>

      <section style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, padding: 18, overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, phases.length)}, minmax(200px, 1fr))`, gap: 12, minWidth: phases.length * 212 }}>
          {phases.map((p, i) => {
            const light = i < 2;
            const inPhase = projectsIn(p.id);
            return (
              <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                <div style={{ padding: '10px 24px 10px 14px', background: PHASE_BG[i % PHASE_BG.length], color: light ? '#1E1B4B' : '#FFFFFF',
                  clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)', borderRadius: '8px 0 0 8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.03em' }}>{p.name.toUpperCase()}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.7 }}>{i + 1}/{phases.length}</span>
                  </div>
                  <div title={p.description} style={{ fontSize: 11, opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.description}</div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, minHeight: 22 }}>
                  {inPhase.map((x) => (
                    <button key={x.id} type="button" title={`${x.name} — open its methodology`} onClick={() => navigate(projectPath(x.id, 'checklists'))}
                      style={{ border: 0, cursor: 'pointer', fontFamily: F, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#FFEDD5', color: '#9A3412' }}>
                      {x.customerAbbreviation || x.code}
                    </button>
                  ))}
                </div>

                {stepsOf(p.id).map((s, k, arr) => (
                  <React.Fragment key={s.id}>
                    <button type="button" onClick={() => setStep(s)}
                      style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 10, cursor: 'pointer', fontFamily: F, background: C.white,
                        border: `1px solid ${C.border}`, borderLeft: `4px solid ${OWNER_COLOR[s.owner]}`, transition: 'box-shadow .15s, border-color .15s' }}
                      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 14px rgba(15,23,42,0.08)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.3 }}>{s.name}</div>
                      {delsOf(s.id).length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                          {delsOf(s.id).map((d) => (
                            <span key={d.id} title={d.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, padding: '1px 7px', borderRadius: 6,
                              background: d.requiresSignoff ? '#ECFDF5' : C.bg, color: d.requiresSignoff ? '#047857' : C.text2, fontWeight: 600 }}>
                              {d.shortName || d.name}{d.requiresSignoff && <PenLine size={10} />}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                    {k < arr.length - 1 && <span aria-hidden="true" style={{ alignSelf: 'center', width: 2, height: 6, background: C.border2, margin: '-8px 0' }} />}
                  </React.Fragment>
                ))}

                <div style={{ marginTop: 'auto', display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, background: '#FFFBEB', border: '1px dashed #FCD34D' }}>
                  <span aria-hidden="true" style={{ width: 10, height: 10, marginTop: 3, transform: 'rotate(45deg)', background: '#D97706', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: '#78350F', lineHeight: 1.5 }}><strong>Gate</strong> · {p.gate}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section style={{ background: C.white, border: `1px solid ${C.border}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#1E1B4B', color: '#FFFFFF', fontSize: 13, fontWeight: 700 }}>
          <Repeat size={15} aria-hidden="true" />Reporting & governance — through every phase
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          {CADENCE.map((c) => (
            <div key={c.what} style={{ padding: '12px 14px', borderRight: `1px solid ${C.border}`, borderTop: `1px solid ${C.border}`, background: c.hot ? '#FFFBEB' : C.white }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{c.what}</div>
              <div style={{ fontSize: 11, color: C.text2, margin: '2px 0 6px' }}>{c.note}</div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 999, background: c.hot ? '#DC2626' : '#4338CA', color: '#FFFFFF' }}>{c.when}</span>
            </div>
          ))}
        </div>
      </section>

      {step && (() => {
        const phase = phases.find((p) => p.id === step.phaseId);
        const dels = delsOf(step.id);
        return (
          <FormModal title={step.name} subtitle={`${phase?.name || ''} · led by ${step.owner === 'Joint' ? 'HMC and the client' : step.owner}`} onClose={() => setStep(null)} width={640}
            footer={<><span style={{ marginLeft: 'auto' }} /><Btn variant="ghost" onClick={() => setStep(null)}>Close</Btn></>}>
            <div style={{ fontSize: 13, color: C.text, padding: '10px 12px', borderRadius: 10, background: C.bg }}>{step.objective}</div>
            {step.activities.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.text2 }}>CHECKLIST</div>
                {step.activities.map((a, k) => (
                  <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}><CheckSquare size={15} color={C.primary} style={{ marginTop: 2, flexShrink: 0 }} />{a}</div>
                ))}
              </div>
            )}
            {dels.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.text2 }}>DELIVERABLES</div>
                {dels.map((d) => (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, border: `1px solid ${C.border}` }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 600 }}>{d.name}</span>
                      <span style={{ display: 'flex', gap: 8, fontSize: 11, color: C.text3, flexWrap: 'wrap' }}>
                        {d.format}
                        {d.requiresSignoff && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#047857', fontWeight: 600 }}><PenLine size={10} />Sign-off</span>}
                        {d.internalOnly && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 600 }}><Lock size={10} />Internal</span>}
                      </span>
                    </span>
                    {d.templateUrl
                      ? <a href={d.templateUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600, color: C.primary, textDecoration: 'none' }}><FileDown size={14} />Template</a>
                      : <span style={{ fontSize: 11, color: C.text3 }}>No template yet</span>}
                  </div>
                ))}
              </div>
            )}
            {phase?.gate && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, background: '#FFFBEB', border: '1px dashed #FCD34D', fontSize: 13, color: '#78350F' }}>
                <span aria-hidden="true" style={{ width: 10, height: 10, marginTop: 4, transform: 'rotate(45deg)', background: '#D97706', flexShrink: 0 }} />
                <span><strong>Phase gate</strong> · {phase.gate}</span>
              </div>
            )}
          </FormModal>
        );
      })()}
    </div>
  );
}
