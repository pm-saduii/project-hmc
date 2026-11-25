import React, { useState } from 'react';
import { parseISO, isValid } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, ClipboardList, FileSearch, Settings, FlaskConical, Rocket, Headphones, CircleDot, FolderKanban } from 'lucide-react';
import toast from 'react-hot-toast';
import { useStore } from '../../store';
import { useRolePermissions } from '../../hooks/useRolePermissions';
import { Card, Btn, Badge, ProgressBar, Modal, C } from '../Common';
import { fmtDate } from '../../utils';
import { projectPath } from '../../utils/projectRoutes';
import type { Project } from '../../types';
import ProjectModal from './ProjectModal';

const STATUS_ACCENT_PALETTE = ['#B45309', '#0F766E', '#C2410C', '#2563EB', '#15803D', '#BE185D', '#6D28D9', '#4D7C0F', '#0369A1', '#A21CAF', '#B91C1C', '#475569'];

function getTodayDeletePassword(): string {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const month = String(today.getMonth() + 1).padStart(2, '0');
  return `${day}${month}${today.getFullYear()}`;
}

function getStatusIcon(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'planning') return <ClipboardList size={19} strokeWidth={2} />;
  if (normalized === 'req & design') return <FileSearch size={19} strokeWidth={2} />;
  if (normalized === 'setup') return <Settings size={19} strokeWidth={2} />;
  if (normalized === 'testing') return <FlaskConical size={19} strokeWidth={2} />;
  if (normalized === 'go live') return <Rocket size={19} strokeWidth={2} />;
  if (normalized === 'hyper care') return <Headphones size={19} strokeWidth={2} />;
  return <CircleDot size={19} strokeWidth={2} />;
}

/**
 * Portfolio screens.
 *  - mode "dashboard" (route /): status cards + project list + daily reminder toast
 *  - mode "projects"  (route /projects): the project list only
 */
export default function Dashboard({ mode = 'dashboard' }: { mode?: 'dashboard' | 'projects' }) {
  const { projects, tasks, milestones, deleteProject, fetchTasks, fetchMilestones, masterCodes } = useStore();
  const navigate = useNavigate();
  const permissions = useRolePermissions();
  const canEditOverview = permissions.getScreenAccess('portfolio-overview') === 'full';
  const [editing,    setEditing]    = useState<Project | null>(null);
  const [deleting,   setDeleting]   = useState<Project | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deletingProject, setDeletingProject] = useState(false);
  const [showAdd,    setShowAdd]    = useState(false);
  const [windowWidth, setWindowWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const [notificationsShown, setNotificationsShown] = useState(false);
  const isMobile = windowWidth < 768;

  React.useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Progress per project needs every accessible task; milestones feed the reminder toast.
  React.useEffect(() => {
    fetchTasks();
    fetchMilestones();
  }, [fetchTasks, fetchMilestones]);

  React.useEffect(() => {
    if (mode !== 'dashboard' || notificationsShown) return;
    if (!tasks.length && !milestones.length) return;

    const now = new Date();
    now.setHours(0, 0, 0, 0); // due dates are date-only; "due today" is not overdue
    const endIn7 = new Date(now);
    endIn7.setDate(endIn7.getDate() + 7);
    const dueIn10 = new Date(now);
    dueIn10.setDate(dueIn10.getDate() + 10);

    const parseDate = (value: string) => {
      if (!value) return null;
      const date = parseISO(value);
      return isValid(date) ? date : null;
    };

    const overdueTasks = tasks.filter((t) => {
      const due = parseDate(t.endDate);
      return due && t.percentComplete < 100 && due < now;
    });
    const upcomingTasks = tasks.filter((t) => {
      const due = parseDate(t.endDate);
      return due && t.percentComplete < 100 && due >= now && due <= endIn7;
    });
    const dueMilestones = milestones.filter((m) => {
      const due = parseDate(m.dueDate);
      return String(m.status).toLowerCase() === 'pending' && due && due <= dueIn10;
    });

    const messages: string[] = [];
    if (overdueTasks.length) messages.push(`${overdueTasks.length} task(s) are overdue`);
    if (upcomingTasks.length) messages.push(`${upcomingTasks.length} task(s) are due within 7 days`);
    if (dueMilestones.length) messages.push(`${dueMilestones.length} milestone(s) are due within 10 days`);

    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const lastNotified = window.localStorage.getItem('projectNotificationsLastDate');
    if (messages.length > 0 && lastNotified !== todayKey) {
      toast.custom(() => (
        <div style={{
          padding: 14,
          background: C.white,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          boxShadow: C.shadow,
          fontFamily: 'Poppins, sans-serif',
          color: C.text,
          maxWidth: 360,
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>Project reminders</div>
          {messages.map((msg) => (
            <div key={msg} style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 4 }}>
              {msg}
            </div>
          ))}
          <div style={{ fontSize: 11, color: C.text2, marginTop: 6 }}>See the bell icon for details.</div>
        </div>
      ));
      window.localStorage.setItem('projectNotificationsLastDate', todayKey);
    }
    setNotificationsShown(true);
  }, [mode, tasks, milestones, notificationsShown]);

  const statusOrder = masterCodes
    .filter((code) => code.codeType === 'project_status' && code.active)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((code) => code.codeValue);

  const getStatusOrder = (status: string) => {
    const index = statusOrder.indexOf(status);
    return index >= 0 ? index : statusOrder.length;
  };

  const allProjects = [...projects].sort((a, b) => getStatusOrder(a.status) - getStatusOrder(b.status));
  const openProject = (project: Project) => navigate(projectPath(project.id));

  const requestDelete = (project: Project) => {
    setDeletePassword('');
    setDeleting(project);
  };

  const cancelDelete = () => {
    if (deletingProject) return;
    setDeletePassword('');
    setDeleting(null);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    if (deletePassword !== getTodayDeletePassword()) {
      toast.error("Password doesn't match today's date (DDMMYYYY)");
      return;
    }
    setDeletingProject(true);
    try {
      await deleteProject(deleting.id);
      toast.success('Project and all related data deleted');
      setDeleting(null);
      setDeletePassword('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete project');
    } finally {
      setDeletingProject(false);
    }
  };

  const addProjectButton = (
    <Btn onClick={() => setShowAdd(true)} disabled={!canEditOverview} title={canEditOverview ? 'Add project' : 'Read-only access'} small style={{ padding: '8px 14px', height: 36, whiteSpace: 'nowrap' }}>
      <Plus size={12} style={{ marginRight: 6 }} /> New Project
    </Btn>
  );

  return (
    <div style={{ height: '100%', overflow: 'auto', background: C.bg }}>
      {permissions.canViewPortfolioOverview ? (
        <WelcomeSummary
          projects={allProjects}
          tasks={tasks}
          onOpen={openProject}
          onEdit={setEditing}
          onDelete={requestDelete}
          canEdit={canEditOverview}
          isMobile={isMobile}
          title={mode === 'dashboard' ? 'Dashboard' : 'Projects'}
          subtitle={mode === 'dashboard' ? 'Portfolio overview of all projects you can access.' : 'Every project you can access. Open one to see its workspace.'}
          showStatusCards={mode === 'dashboard'}
          actions={canEditOverview ? addProjectButton : undefined}
        />
      ) : (
        <div style={{ padding: isMobile ? '18px 14px' : '28px 32px' }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: '0 0 16px' }}>My Projects</h2>
          <div style={{ overflowX: 'auto', border: `1px solid ${C.border}`, borderRadius: 8, background: C.white }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
              <thead><tr>{['Project ID', 'Project Name', 'Customer', 'Status'].map((label) => <th key={label} style={{ textAlign: 'left', padding: '12px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.text2 }}>{label}</th>)}</tr></thead>
              <tbody>{allProjects.map((project) => <tr key={project.id} onClick={() => openProject(project)} style={{ cursor: 'pointer', borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '12px 14px', fontSize: 12, color: C.primary, fontWeight: 700 }}>{project.code || project.id}</td>
                <td style={{ padding: '12px 14px', fontSize: 12, color: C.text }}>{project.name}</td>
                <td style={{ padding: '12px 14px', fontSize: 12, color: C.text2 }}>{project.client || '—'}</td>
                <td style={{ padding: '12px 14px', fontSize: 12, color: C.text }}>{project.status || '—'}</td>
              </tr>)}</tbody>
            </table>
          </div>
        </div>
      )}

      {showAdd  && <ProjectModal onClose={() => setShowAdd(false)} />}
      {editing  && <ProjectModal project={editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <Modal title="Delete Project" onClose={cancelDelete} width={440}>
          <p style={{ margin: '0 0 16px', color: C.text2, fontSize: 13, lineHeight: 1.5 }}>
            Delete <strong style={{ color: C.text }}>{deleting.name}</strong> and all related database data? This cannot be undone.
          </p>
          <label htmlFor="delete-project-password" style={{ display: 'block', marginBottom: 6, color: C.text2, fontSize: 11, fontWeight: 700 }}>
            Input Password to Delete Project
          </label>
          <input
            id="delete-project-password"
            autoFocus
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={8}
            value={deletePassword}
            onChange={(event) => setDeletePassword(event.currentTarget.value.replace(/\D/g, '').slice(0, 8))}
            onKeyDown={(event) => { if (event.key === 'Enter' && deletePassword.length === 8) void handleDelete(); }}
            style={{ width: '100%', boxSizing: 'border-box', border: `1.5px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 14, letterSpacing: 2, outline: 'none' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <Btn variant="ghost" onClick={cancelDelete} disabled={deletingProject}>Cancel</Btn>
            <Btn variant="danger" onClick={handleDelete} disabled={deletingProject || deletePassword.length !== 8}>
              {deletingProject ? 'Deleting…' : 'Delete Project'}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Welcome / global summary ──────────────────────────────────────────────────
function WelcomeSummary({ projects, tasks, onOpen, onEdit, onDelete, canEdit, isMobile, title, subtitle, showStatusCards, actions }: { projects: Project[]; tasks: any[]; onOpen: (p: Project) => void; onEdit: (p: Project) => void; onDelete: (p: Project) => void; canEdit: boolean; isMobile: boolean; title: string; subtitle: string; showStatusCards: boolean; actions?: React.ReactNode }) {
  const { masterCodes } = useStore();
  const [showHC, setShowHC] = useState(false);
  const [projectView, setProjectView] = useState<'card' | 'table'>('table');
  const projectStatusOptions = masterCodes
    .filter((code) => code.codeType === 'project_status' && code.active)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const statusCounts = projects.reduce<Record<string, number>>((acc, project) => {
    acc[project.status] = (acc[project.status] || 0) + 1;
    return acc;
  }, {});
  const statusCards = projectStatusOptions.length > 0
    ? projectStatusOptions.map((code) => ({
        label: code.label,
        value: statusCounts[code.codeValue] || 0,
        bg: code.bgColor || C.bg2,
        color: code.textColor || C.text,
        codeValue: code.codeValue,
        icon: '📌',
      }))
    : [
        { label: 'Planning', value: projects.filter(p => p.status === 'Planning').length, bg: C.amberBg, color: C.amber, codeValue: 'Planning', icon: '📌' },
        { label: 'Req & Design', value: projects.filter(p => p.status === 'Req & Design').length, bg: C.primaryBg, color: C.primary, codeValue: 'Req & Design', icon: '📌' },
        { label: 'Setup', value: projects.filter(p => p.status === 'Setup').length, bg: '#FED7AA', color: '#9A3412', codeValue: 'Setup', icon: '📌' },
        { label: 'Testing', value: projects.filter(p => p.status === 'Testing').length, bg: '#E9D5FF', color: '#6B21A8', codeValue: 'Testing', icon: '📌' },
        { label: 'Go Live', value: projects.filter(p => p.status === 'Go Live').length, bg: C.greenBg, color: C.green, codeValue: 'Go Live', icon: '📌' },
        { label: 'Hyper Care', value: projects.filter(p => p.status === 'Hyper Care').length, bg: C.amberBg, color: C.amber, codeValue: 'Hyper Care', icon: '📌' },
      ];
  const normalProjects = projects.filter((p) => {
    const status = projectStatusOptions.find((code) => code.codeValue === p.status);
    return status ? status.label !== 'Hyper Care' : p.status !== 'Hyper Care';
  }).sort((a, b) => new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime());
  const hypercareProjects = projects.filter((p) => {
    const status = projectStatusOptions.find((code) => code.codeValue === p.status);
    return status ? status.label === 'Hyper Care' : p.status === 'Hyper Care';
  }).sort((a, b) => new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime());

  const renderOverviewProjectCard = (p: Project, fallbackColor = C.primary) => {
    const roots = tasks.filter(t => t.projectId === p.id && !t.parentId);
    const prog  = roots.length ? Math.round(roots.reduce((s: number, t: any) => s + t.percentComplete, 0) / roots.length) : 0;
    const statusCode = masterCodes.find((code) => code.codeType === 'project_status' && code.active && code.codeValue === p.status);
    const s     = statusCode ? { bg: statusCode.bgColor, color: statusCode.textColor, label: statusCode.label } : { bg: C.bg2, color: C.text, label: p.status || 'Unknown' };

    return (
      <div key={p.id}
        onClick={() => onOpen(p)}
        style={{ background: C.white, borderRadius: 10, border: `1px solid ${C.border}`, padding: '12px 14px', cursor: 'pointer', transition: 'all 0.15s', borderLeft: `4px solid ${p.color || fallbackColor}` }}
        onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFF'; }}
        onMouseLeave={e => { e.currentTarget.style.background = C.white; }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 700, color: C.text, lineHeight: 1.35, whiteSpace: 'normal', wordBreak: 'break-word' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <FolderKanban size={14} color={fallbackColor} />
              <span><span style={{ color: C.text2 }}>Project ID : </span><span style={{ color: C.primary, fontFamily: 'Poppins, sans-serif' }}>{(p.code || p.id || '-').replace(/\s+/g, ' ').trim()}</span></span>
            </span>
          </div>
          <Badge bg={s.bg} color={s.color}>{s.label}</Badge>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            {canEdit && <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(p); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3, padding: 2, display: 'flex', alignItems: 'center' }}
              title="Edit Project"
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = C.primary; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = C.text3; }}>
              <Pencil size={12} />
            </button>}
            {canEdit && <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(p); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3, padding: 2, display: 'flex', alignItems: 'center' }}
              title="Delete Project"
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = C.red; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = C.text3; }}>
              <Trash2 size={12} />
            </button>}
          </div>
        </div>

        <div style={{ fontSize: 12, color: C.text, lineHeight: 1.35, marginBottom: 4, whiteSpace: 'normal', wordBreak: 'break-word' }}>
          <span style={{ color: C.text2 }}>Project Name : </span>
          <span style={{ fontWeight: 700 }}>{p.name || '-'}</span>
        </div>

        <div style={{ fontSize: 12, color: C.text, lineHeight: 1.35, marginBottom: 5, whiteSpace: 'normal', wordBreak: 'break-word' }}>
          <span style={{ color: C.text2 }}>Client : </span>
          <span>{p.client || '-'}</span>
        </div>

        <div style={{ fontSize: 12, color: C.text2, marginBottom: 6, whiteSpace: 'normal', wordBreak: 'break-word' }}>
          {fmtDate(p.startDate)} - {fmtDate(p.endDate)}
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.text2, marginBottom: 4 }}>
            <span>% Progress</span>
            <span style={{ fontWeight: 700, color: prog >= 100 ? C.green : C.primary }}>{prog}%</span>
          </div>
          <ProgressBar value={prog} height={4} color={prog >= 100 ? C.green : p.color || fallbackColor} />
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: isMobile ? '18px 14px' : '28px 32px', width: '100%' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: isMobile ? 20 : 22, fontWeight: 800, color: C.text, margin: '0 0 6px' }}>{title}</h2>
          <p style={{ color: C.text2, fontSize: 13, margin: 0 }}>{subtitle}</p>
        </div>
        {actions}
      </div>

      {showStatusCards && <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(6, minmax(0, 1fr))', gap: 14, marginBottom: 28 }}>
        {statusCards.map((s, index) => {
          const accent = STATUS_ACCENT_PALETTE[index] || `hsl(${((index - STATUS_ACCENT_PALETTE.length) * 360) / Math.max(statusCards.length - STATUS_ACCENT_PALETTE.length, 1)} 62% 38%)`;
          return (
          <Card key={s.label} style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, border: `1px solid ${accent}66`, borderLeft: `4px solid ${accent}`, boxShadow: `0 5px 18px ${accent}1A` }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: s.bg, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{getStatusIcon(s.codeValue)}</div>
            <div><div style={{ fontSize: 24, fontWeight: 800, color: accent }}>{s.value}</div>
              <div style={{ fontSize: 11, color: C.text2 }}>{s.label}</div></div>
          </Card>
        );})}
      </div>}

      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {(['card', 'table'] as const).map((mode) => (
            <button key={mode} type="button" onClick={() => setProjectView(mode)}
              style={{
                padding: '8px 14px',
                borderRadius: 999,
                border: `1px solid ${projectView === mode ? C.primary : C.border}`,
                background: projectView === mode ? C.primaryBg : C.white,
                color: projectView === mode ? C.primary : C.text,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
              }}>
              {mode === 'card' ? 'Card' : 'Table'}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 12, color: C.text2 }}>{normalProjects.length} projects</div>
      </div>

      {projectView === 'card' ? (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(280px,1fr))', gap: 14 }}>
          {normalProjects.map(p => renderOverviewProjectCard(p, C.primary))}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Project ID', 'Project Name', 'Customer', 'Start Date', 'End Date', 'Stage', '% Progress', ''].map((label) => (
                  <th key={label} style={{ textAlign: 'left', padding: '12px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 12, color: C.text2 }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {normalProjects.map((p) => {
                const roots = tasks.filter((t) => t.projectId === p.id && !t.parentId);
                const prog = roots.length ? Math.round(roots.reduce((s: number, t: any) => s + t.percentComplete, 0) / roots.length) : 0;
                const statusCode = masterCodes.find((code) => code.codeType === 'project_status' && code.active && code.codeValue === p.status);
                const stage = statusCode?.label ?? p.status;
                return (
                  <tr key={p.id} onClick={() => onOpen(p)} style={{ cursor: 'pointer', background: C.white, transition: 'background 0.15s' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '#F8FAFF'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent'; }}>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: C.primary, fontWeight: 700 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><FolderKanban size={15} color={p.color || C.primary} />{(p.code || p.id || '-').replace(/\s+/g, ' ').trim()}</span>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: C.text }}>{p.name || '-'}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: C.text2 }}>{p.client || '-'}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: C.text2 }}>{fmtDate(p.startDate)}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: C.text2 }}>{fmtDate(p.endDate)}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: C.text }}>{stage}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: C.text }}>{prog}%</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: C.text, width: 72, whiteSpace: 'nowrap' }}>
                      {canEdit && (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onEdit(p); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3, padding: 2, display: 'inline-flex', alignItems: 'center' }}
                            title="Edit Project"
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = C.primary; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = C.text3; }}
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${p.name}`}
                            onClick={(e) => { e.stopPropagation(); onDelete(p); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text3, padding: 2, display: 'inline-flex', alignItems: 'center' }}
                            title="Delete Project"
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = C.red; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = C.text3; }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Hypercare section — collapsible, hidden by default */}
      {hypercareProjects.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <button
            onClick={() => setShowHC(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: C.amberBg, border: `1px solid ${C.amber}33`, borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: C.amber, fontFamily: 'Poppins, sans-serif', transition: 'all 0.15s', width: '100%' }}>
            {showHC ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            🛡️ Hyper Care Projects ({hypercareProjects.length})
          </button>
          {showHC && (
            <div style={{ overflowX: 'auto', marginTop: 12, border: `1px solid ${C.amber}66`, borderRadius: 8, background: C.white }}>
              <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: C.amberBg }}>
                    {['Project ID', 'Project Name', 'Customer', 'Start Date', 'End Date', '% Progress', ''].map((label) => (
                      <th key={label} style={{ textAlign: 'left', padding: '11px 14px', borderBottom: `1px solid ${C.amber}55`, fontSize: 11, color: C.text2, whiteSpace: 'nowrap' }}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hypercareProjects.map((project) => {
                    const roots = tasks.filter((task) => task.projectId === project.id && !task.parentId);
                    const progress = roots.length ? Math.round(roots.reduce((sum: number, task: any) => sum + task.percentComplete, 0) / roots.length) : 0;
                    return (
                      <tr key={project.id} onClick={() => onOpen(project)} style={{ cursor: 'pointer', borderBottom: `1px solid ${C.border}`, transition: 'background 0.15s' }}
                        onMouseEnter={(event) => { event.currentTarget.style.background = C.amberBg; }}
                        onMouseLeave={(event) => { event.currentTarget.style.background = C.white; }}>
                        <td style={{ padding: '11px 14px', fontSize: 12, fontWeight: 700, color: C.primary, whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><FolderKanban size={15} color={C.amber} />{project.code || project.id}</span>
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 12, color: C.text, fontWeight: 600 }}>{project.name || '—'}</td>
                        <td style={{ padding: '11px 14px', fontSize: 12, color: C.text2 }}>{project.client || '—'}</td>
                        <td style={{ padding: '11px 14px', fontSize: 12, color: C.text2, whiteSpace: 'nowrap' }}>{fmtDate(project.startDate)}</td>
                        <td style={{ padding: '11px 14px', fontSize: 12, color: C.text2, whiteSpace: 'nowrap' }}>{fmtDate(project.endDate)}</td>
                        <td style={{ padding: '11px 14px', fontSize: 12, color: progress >= 100 ? C.green : C.amber, fontWeight: 700 }}>{progress}%</td>
                        <td style={{ padding: '8px 12px', width: 72, whiteSpace: 'nowrap' }}>
                          {canEdit && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
                            <button type="button" aria-label={`Edit ${project.name}`} onClick={(event) => { event.stopPropagation(); onEdit(project); }} style={{ border: 0, background: 'transparent', color: C.text3, padding: 5, cursor: 'pointer' }}><Pencil size={14} /></button>
                            <button type="button" aria-label={`Delete ${project.name}`} onClick={(event) => { event.stopPropagation(); onDelete(project); }} style={{ border: 0, background: 'transparent', color: C.text3, padding: 5, cursor: 'pointer' }}><Trash2 size={14} /></button>
                          </div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
