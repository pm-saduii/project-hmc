import React from 'react';
import {
  CalendarCheck, CheckCircle2, Circle, CircleDot, ClipboardCheck, Database, FileCheck2, Flag, Headset, LifeBuoy, Monitor, Presentation,
  Rocket, Settings, ShieldCheck, Target, Users, Wrench, type LucideIcon,
} from 'lucide-react';
import { C } from '../Common';
import type { MethodDeliverable, MethodPhase, MethodStep, Owner } from '../../services/methodology';

const F = 'Poppins, sans-serif';

/** Icons a phase can use (Settings › Methodology › Phases). */
export const PHASE_ICONS: Record<string, { label: string; Icon: LucideIcon }> = {
  calendar: { label: 'Calendar', Icon: CalendarCheck },
  monitor: { label: 'Screen', Icon: Monitor },
  settings: { label: 'Gear', Icon: Settings },
  clipboard: { label: 'Checklist', Icon: ClipboardCheck },
  rocket: { label: 'Rocket', Icon: Rocket },
  headset: { label: 'Headset', Icon: Headset },
  database: { label: 'Data', Icon: Database },
  users: { label: 'People', Icon: Users },
  flag: { label: 'Flag', Icon: Flag },
  target: { label: 'Target', Icon: Target },
  shield: { label: 'Shield', Icon: ShieldCheck },
  file: { label: 'Document', Icon: FileCheck2 },
  wrench: { label: 'Wrench', Icon: Wrench },
  presentation: { label: 'Presentation', Icon: Presentation },
  lifebuoy: { label: 'Support', Icon: LifeBuoy },
};
const FALLBACK_COLORS = ['#22C5DC', '#14B8A6', '#0EA5B7', '#38BDF8', '#2563EB', '#1E3A8A', '#6366F1', '#0F766E'];
const FALLBACK_ICONS = ['calendar', 'monitor', 'settings', 'clipboard', 'rocket', 'headset', 'flag', 'target'];
export const phaseColor = (p: Pick<MethodPhase, 'color'>, i: number) => (p.color && /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : FALLBACK_COLORS[i % FALLBACK_COLORS.length]);
export const phaseIcon = (p: Pick<MethodPhase, 'icon'>, i: number) => (PHASE_ICONS[p.icon || ''] || PHASE_ICONS[FALLBACK_ICONS[i % FALLBACK_ICONS.length]]).Icon;
export const OWNER_COLOR: Record<Owner, string> = { HMC: '#2563EB', Client: '#EA580C', Joint: '#0D9488' };

export function PhaseIconBadge({ phase, index, size = 64 }: { phase: Pick<MethodPhase, 'icon' | 'color'>; index: number; size?: number }) {
  const Icon = phaseIcon(phase, index);
  const color = phaseColor(phase, index);
  return (
    <span aria-hidden="true" style={{ width: size, height: size, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0,
      background: `radial-gradient(circle at 30% 30%, ${color}CC, ${color})`, color: '#FFFFFF', boxShadow: `0 6px 16px ${color}55` }}>
      <Icon size={Math.round(size * 0.46)} strokeWidth={1.8} />
    </span>
  );
}

export type StepMark = 'done' | 'current' | 'upcoming';
export interface DeliverableTone { bg: string; fg: string; title?: string; after?: React.ReactNode }

/**
 * The methodology as the company chart: one column per phase — icon, name, steps, big number, deliverables — with
 * rows aligned across phases. Project pages add status marks, deliverable colours and the gate.
 */
export default function MethodBoard({ phases, stepsOf, deliverablesOf, onStep, onDeliverable, stepMark, deliverableTone, phaseExtra, phaseFooter, highlight }: {
  phases: MethodPhase[];
  stepsOf: (phaseId: string) => MethodStep[];
  deliverablesOf: (phaseId: string) => MethodDeliverable[];
  onStep?: (step: MethodStep) => void;
  onDeliverable?: (d: MethodDeliverable) => void;
  stepMark?: (phase: MethodPhase, step: MethodStep) => StepMark | undefined;
  deliverableTone?: (d: MethodDeliverable) => DeliverableTone;
  phaseExtra?: (phase: MethodPhase, index: number) => React.ReactNode;
  phaseFooter?: (phase: MethodPhase, index: number) => React.ReactNode;
  highlight?: string | null;
}) {
  const n = Math.max(1, phases.length);
  const cellBase = (i: number, p: MethodPhase): React.CSSProperties => ({
    padding: '0 14px', minWidth: 0, borderLeft: i ? `1px solid ${C.border}` : 'none',
    background: highlight === p.id ? '#F5F8FF' : 'transparent',
  });
  const rows: React.ReactNode[] = [];
  // 1 · icon and name
  phases.forEach((p, i) => rows.push(
    <div key={`h${p.id}`} style={{ ...cellBase(i, p), paddingTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
      <PhaseIconBadge phase={p} index={i} />
      <div style={{ fontSize: 16, fontWeight: 800, color: C.text, lineHeight: 1.2 }}>{p.name}</div>
      {phaseExtra?.(p, i)}
    </div>,
  ));
  // 2 · steps
  phases.forEach((p, i) => rows.push(
    <ul key={`s${p.id}`} style={{ ...cellBase(i, p), margin: 0, paddingTop: 12, paddingBottom: 12, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {stepsOf(p.id).map((st) => {
        const mark = stepMark?.(p, st);
        const icon = mark === 'done' ? <CheckCircle2 size={13} color="#047857" />
          : mark === 'current' ? <CircleDot size={13} color={C.primary} />
          : mark === 'upcoming' ? <Circle size={13} color={C.text3} />
          : <span style={{ width: 6, height: 6, borderRadius: '50%', background: OWNER_COLOR[st.owner], marginTop: 6 }} />;
        return (
          <li key={st.id}>
            <button type="button" onClick={() => onStep?.(st)} title={`${st.objective}${st.owner ? ` · led by ${st.owner}` : ''}`} disabled={!onStep}
              style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 7, textAlign: 'left', padding: '4px 6px', border: 0, borderRadius: 6, background: 'transparent',
                cursor: onStep ? 'pointer' : 'default', fontFamily: F, fontSize: 13, lineHeight: 1.35, color: mark === 'upcoming' ? C.text2 : C.text }}
              onMouseEnter={(e) => { if (onStep) e.currentTarget.style.background = C.bg; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
              <span style={{ display: 'inline-flex', flexShrink: 0, marginTop: 2 }}>{icon}</span>
              <span>{st.name}</span>
            </button>
          </li>
        );
      })}
    </ul>,
  ));
  // 3 · number
  phases.forEach((p, i) => rows.push(
    <div key={`n${p.id}`} style={{ ...cellBase(i, p), display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingBottom: 14 }}>
      <span style={{ fontSize: 32, fontWeight: 800, color: '#0F172A', lineHeight: 1, letterSpacing: '0.02em' }}>{String(i + 1).padStart(2, '0')}</span>
      <span style={{ width: 64, height: 4, borderRadius: 2, background: phaseColor(p, i) }} />
    </div>,
  ));
  // 4 · deliverables
  phases.forEach((p, i) => {
    const list = deliverablesOf(p.id);
    rows.push(
      <div key={`d${p.id}`} style={{ ...cellBase(i, p), borderLeft: 'none', paddingBottom: 10 }}>
        <div style={{ height: '100%', boxSizing: 'border-box', border: `1px solid ${C.border}`, borderRadius: 12, background: C.white, padding: '10px 8px', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', gap: 4, minHeight: 64 }}>
          {list.length === 0 && <span style={{ fontSize: 11, color: C.text3 }}>No deliverables</span>}
          {list.map((d) => {
            const tone = deliverableTone?.(d);
            const content = <>{d.shortName || d.name}{tone?.after}</>;
            const style: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, border: 0, fontFamily: F,
              background: tone?.bg || C.bg, color: tone?.fg || C.text2, cursor: onDeliverable ? 'pointer' : 'default' };
            return onDeliverable
              ? <button key={d.id} type="button" title={tone?.title || d.name} onClick={() => onDeliverable(d)} style={style}>{content}</button>
              : <span key={d.id} title={tone?.title || d.name} style={style}>{content}</span>;
          })}
        </div>
      </div>,
    );
  });
  // 5 · footer (gate)
  if (phaseFooter) phases.forEach((p, i) => rows.push(
    <div key={`f${p.id}`} style={{ ...cellBase(i, p), borderLeft: 'none', paddingBottom: 14, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>{phaseFooter(p, i)}</div>,
  ));

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(180px, 1fr))`, minWidth: n * 190, fontFamily: F }}>{rows}</div>
    </div>
  );
}
