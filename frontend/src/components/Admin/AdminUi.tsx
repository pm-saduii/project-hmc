import React from 'react';
import { X } from 'lucide-react';
import { C } from '../Common';

export const F = 'Poppins, sans-serif';

/** Page title block used by every admin page. */
export function AdminHeader({ eyebrow, title, description, actions }: { eyebrow?: React.ReactNode; title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ minWidth: 0 }}>
        {eyebrow && <div style={{ fontSize: 11, color: C.text2, marginBottom: 2 }}>{eyebrow}</div>}
        <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: C.text }}>{title}</h1>
        {description && <p style={{ margin: 0, fontSize: 13, color: C.text2, maxWidth: 720 }}>{description}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
    </div>
  );
}

export const panel: React.CSSProperties = { background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, minWidth: 0 };
export const th: React.CSSProperties = { textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 700, color: C.text2, borderBottom: `1px solid ${C.border}`, background: '#F8FAFC', whiteSpace: 'nowrap' };
export const td: React.CSSProperties = { padding: '10px 14px', fontSize: 13, color: C.text, borderBottom: `1px solid ${C.border}`, verticalAlign: 'middle' };
export const fieldLabel: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: C.text };
export const input: React.CSSProperties = { height: 38, border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '0 12px', fontFamily: F, fontSize: 13, fontWeight: 400, color: C.text, background: C.white, outline: 'none', width: '100%', boxSizing: 'border-box' };
export const hint: React.CSSProperties = { fontSize: 11, color: C.text3, fontWeight: 400 };

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label style={{ flex: '1 1 240px', display: 'flex', alignItems: 'center', gap: 8, height: 34, padding: '0 10px', border: `1px solid ${C.border}`, borderRadius: 8, background: C.bg }}>
      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.text3} strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        style={{ border: 0, background: 'transparent', outline: 'none', fontFamily: F, fontSize: 13, width: '100%', color: C.text }} />
    </label>
  );
}

export function Pill({ children, bg, fg }: { children: React.ReactNode; bg: string; fg: string }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: bg, color: fg, whiteSpace: 'nowrap' }}>{children}</span>;
}

export function StatusDot({ active, labels = ['Active', 'Inactive'] }: { active: boolean; labels?: [string, string] }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: active ? '#047857' : C.text2 }}>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: active ? C.green : C.text3 }} />
      {active ? labels[0] : labels[1]}
    </span>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      style={{ display: 'inline-flex', width: 36, height: 20, borderRadius: 999, padding: 2, border: 0, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
        background: checked ? C.primary : C.border2, justifyContent: checked ? 'flex-end' : 'flex-start', boxSizing: 'border-box' }}>
      <span style={{ width: 16, height: 16, borderRadius: '50%', background: C.white }} />
    </button>
  );
}

/** Right-hand panel for add / edit forms. */
export function SidePanel({ title, subtitle, onClose, children, footer, busy }: {
  title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode; busy?: boolean;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, fontFamily: F }}>
      <div onClick={busy ? undefined : onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.35)' }} />
      <aside role="dialog" aria-modal="true" aria-label={title}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(460px, 100vw)', background: C.white, boxShadow: '-12px 0 40px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 22px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text }}>{title}</h2>
            {subtitle && <div style={{ fontSize: 13, color: C.text2 }}>{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close"
            style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, color: C.text2, cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
        <div style={{ padding: '14px 22px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, alignItems: 'center' }}>{footer}</div>
      </aside>
    </div>
  );
}
