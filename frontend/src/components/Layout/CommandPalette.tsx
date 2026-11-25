import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, FileText, FolderKanban, Search } from 'lucide-react';
import { useStore } from '../../store';
import { useRolePermissions } from '../../hooks/useRolePermissions';
import { PROJECT_GROUPS } from '../../utils/projectRoutes';
import { C } from '../Common';

const F = 'Poppins, sans-serif';

interface Command {
  id: string;
  kind: 'Page' | 'Project' | 'Screen';
  label: string;
  hint?: string;
  to: string;
  keywords: string;
}

export interface PageLink {
  to: string;
  label: string;
}

/**
 * Ctrl+K / ⌘K: jump to any page, any project, or a screen of the open project.
 * `open` is owned by the shell so the top-bar search button can open it too.
 */
export default function CommandPalette({ open, onClose, pages }: { open: boolean; onClose: () => void; pages: PageLink[] }) {
  const navigate = useNavigate();
  const projects = useStore((state) => state.projects);
  const activeProject = useStore((state) => state.activeProject);
  const permissions = useRolePermissions();
  const [query, setQuery] = React.useState('');
  const [cursor, setCursor] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setQuery('');
    setCursor(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  // Rebuilt each render: permissions can change after load and the lists are small.
  const commands: Command[] = (() => {
    const list: Command[] = pages.map((page) => ({ id: `page:${page.to}`, kind: 'Page', label: page.label, to: page.to, keywords: page.label }));
    if (activeProject) {
      const base = `/projects/${encodeURIComponent(activeProject.id)}`;
      PROJECT_GROUPS.forEach((group) => group.subs.forEach((sub) => {
        const allowed = sub.screen === 'portfolio-overview'
          ? permissions.getScreenAccess('portfolio-overview') === 'full'
          : permissions.isTabVisible(sub.screen);
        if (!allowed) return;
        list.push({
          id: `screen:${group.key}/${sub.key}`, kind: 'Screen', label: sub.label,
          hint: `${activeProject.code || activeProject.name} › ${group.label}`,
          to: `${base}/${group.key}/${sub.key}`, keywords: `${sub.label} ${group.label}`,
        });
      }));
    }
    projects.forEach((project) => list.push({
      id: `project:${project.id}`, kind: 'Project', label: `${project.code} · ${project.name}`,
      hint: project.client, to: `/projects/${encodeURIComponent(project.id)}`,
      keywords: `${project.code} ${project.name} ${project.client} ${project.customerAbbreviation}`,
    }));
    return list;
  })();

  const results = (() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matched = words.length
      ? commands.filter((cmd) => { const text = `${cmd.label} ${cmd.keywords} ${cmd.hint || ''}`.toLowerCase(); return words.every((w) => text.includes(w)); })
      : commands;
    return matched.slice(0, 50);
  })();

  React.useEffect(() => { setCursor(0); }, [query]);
  React.useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  const go = (cmd: Command | undefined) => {
    if (!cmd) return;
    onClose();
    navigate(cmd.to);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (event.key === 'Enter') { event.preventDefault(); go(results[cursor]); }
    else if (event.key === 'Escape') { event.preventDefault(); onClose(); }
  };

  const icon = (kind: Command['kind']) => (kind === 'Project'
    ? <FolderKanban size={16} />
    : kind === 'Screen' ? <FileText size={16} /> : <CornerDownLeft size={16} />);

  return (
    <div role="dialog" aria-modal="true" aria-label="Search" style={{ position: 'fixed', inset: 0, zIndex: 500, fontFamily: F }} onKeyDown={onKeyDown}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.45)' }} />
      <div style={{
        position: 'absolute', top: '12vh', left: '50%', transform: 'translateX(-50%)', width: 'min(600px, calc(100vw - 32px))',
        background: C.white, borderRadius: 14, boxShadow: '0 20px 50px rgba(0,0,0,0.25)', overflow: 'hidden', border: `1px solid ${C.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', borderBottom: `1px solid ${C.border}` }}>
          <Search size={16} color={C.text3} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects and pages…"
            aria-label="Search projects and pages"
            aria-controls="command-results"
            aria-activedescendant={results[cursor] ? `cmd-${cursor}` : undefined}
            style={{ flex: 1, height: 48, border: 0, outline: 'none', fontSize: 14, fontFamily: F, background: 'transparent', color: C.text }}
          />
          <kbd style={kbd}>Esc</kbd>
        </div>
        <div id="command-results" ref={listRef} role="listbox" style={{ maxHeight: 'min(420px, 60vh)', overflowY: 'auto', padding: 6 }}>
          {results.length === 0 ? (
            <div style={{ padding: 16, fontSize: 13, color: C.text2 }}>No results.</div>
          ) : results.map((cmd, index) => {
            const active = index === cursor;
            const prev = results[index - 1];
            return (
              <React.Fragment key={cmd.id}>
                {(!prev || prev.kind !== cmd.kind) && (
                  <div style={{ padding: '8px 10px 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.text3 }}>
                    {cmd.kind === 'Page' ? 'Pages' : cmd.kind === 'Screen' ? 'This project' : 'Projects'}
                  </div>
                )}
                <div
                  id={`cmd-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={active}
                  onMouseMove={() => setCursor(index)}
                  onClick={() => go(cmd)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                    background: active ? C.primaryBg : 'transparent', color: active ? C.primary : C.text,
                  }}
                >
                  <span style={{ display: 'inline-flex', color: active ? C.primary : C.text3 }} aria-hidden="true">{icon(cmd.kind)}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cmd.label}</span>
                  {cmd.hint && <span style={{ marginLeft: 'auto', fontSize: 11, color: C.text3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '40%' }}>{cmd.hint}</span>}
                </div>
              </React.Fragment>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 14, padding: '8px 14px', borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.text3 }}>
          <span><kbd style={kbd}>↑</kbd> <kbd style={kbd}>↓</kbd> move</span>
          <span><kbd style={kbd}>Enter</kbd> open</span>
        </div>
      </div>
    </div>
  );
}

const kbd: React.CSSProperties = {
  fontFamily: F, fontSize: 10, padding: '1px 6px', borderRadius: 5, border: `1px solid ${C.border}`, background: C.bg, color: C.text2,
};
