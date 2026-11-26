import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useStore } from '../../store';
import { taskApi } from '../../services/api';
import { supabase } from '../../services/supabase';
import { Modal, FormRow, Input, Select, Textarea, Btn, C } from '../Common';
import type { Project } from '../../types';
import { imageFileToPng } from '../../utils/imagePng';

const COLORS = ['#4F46E5','#0EA5E9','#10B981','#F59E0B','#EC4899','#EF4444','#8B5CF6','#F97316'];

interface Props { project?: Project; onClose: () => void; /** Render as the Project Info › Settings page instead of a popup. */ inline?: boolean; }

interface ProjectForm {
  name: string;
  code: string;
  client: string;
  customerAbbreviation: string;
  customerId: string;
  status: string;
  startDate: string;
  endDate: string;
  description: string;
  color: string;
  emailNotificationEnabled: boolean;
  emailNotificationMode: string;
  emailNotificationRecipients: string;
  emailNotificationTime: string;
}

function normalizeDescription(raw: string): string {
  if (!raw?.startsWith('__PM_META__:')) return raw || '';
  try {
    const parsed = JSON.parse(raw.replace('__PM_META__:', '')) as { notes?: string };
    return parsed.notes || '';
  } catch {
    return '';
  }
}

export default function ProjectModal({ project, onClose, inline = false }: Props) {
  const { createProject, updateProject, fetchTasks, projects, masterCodes } = useStore();
  const [saving, setSaving] = useState(false);
  const [copyFromProjectId, setCopyFromProjectId] = useState('');
  const [copyScope, setCopyScope] = useState<'all' | 'main'>('all');
  const [testing, setTesting] = useState(false);

  const statusOptions = masterCodes
    .filter((code) => code.codeType === 'project_status' && code.active)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((code) => ({ value: code.codeValue, label: code.label }));

  const [form, setForm] = useState({
    name:                        project?.name                        ?? '',
    code:                        project?.code                        ?? '',
    client:                      project?.client                      ?? '',
    customerAbbreviation:        project?.customerAbbreviation        ?? '',
    customerId:                  project?.customerId                  ?? '',
    status:                      project?.status ?? statusOptions[0]?.value ?? 'Planning',
    startDate:                   project?.startDate                   ?? '',
    endDate:                     project?.endDate                     ?? '',
    description:                 normalizeDescription(project?.description ?? ''),
    color:                       project?.color                       ?? '#4F46E5',
    emailNotificationEnabled:    project?.emailNotificationEnabled    ?? false,
    emailNotificationMode:       project?.emailNotificationMode       ?? 'task',
    emailNotificationRecipients: project?.emailNotificationRecipients ?? '',
    emailNotificationTime:       project?.emailNotificationTime       ?? '08:00',
  });

  const fallbackStatusOptions = [
    { value: 'Planning', label: 'Planning' },
    { value: 'Req & Design', label: 'Req & Design' },
    { value: 'Setup', label: 'Setup' },
    { value: 'Testing', label: 'Testing' },
    { value: 'Go Live', label: 'Go Live' },
    { value: 'Hyper Care', label: 'Hyper Care' },
  ];

  const statusDropdownOptions = (() => {
    const baseOptions = statusOptions.length > 0 ? statusOptions : fallbackStatusOptions;
    if (form.status && !baseOptions.some((option) => option.value === form.status)) {
      return [{ value: form.status, label: form.status }, ...baseOptions];
    }
    return baseOptions;
  })();

  // Customer logo: kept apart from the form so saving works before the logo column exists.
  const [logo, setLogo] = useState<string>(project?.logo || '');
  const logoChanged = logo !== (project?.logo || '');
  const pickLogo = async (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|svg\+xml|webp|gif)$/.test(file.type)) { toast.error('Choose a PNG, JPG, SVG or WebP image'); return; }
    try { setLogo(await imageFileToPng(file, 600, 240)); } catch { toast.error('That image could not be read'); }
  };

  const up = <K extends keyof ProjectForm>(key: K, value: ProjectForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Project name is required'); return; }
    setSaving(true);
    try {
      if (project) { await updateProject(project.id, logoChanged ? { ...form, logo } : form); toast.success('Project updated'); }
      else {
        const created = await createProject(logo ? { ...form, logo } : form);
        if (copyFromProjectId) {
          const copied = await taskApi.copyFromProject(copyFromProjectId, created.id, copyScope);
          await fetchTasks();
          if (copied.data.length) {
            toast.success(copyScope === 'main' ? `Project created with ${copied.data.length} main tasks` : `Project created with ${copied.data.length} tasks`);
          } else {
            toast('Project created, but the selected source has no tasks to copy');
          }
        } else {
          toast.success('Project created');
        }
      }
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save project';
      toast.error(msg || 'Failed to save project');
    }
    setSaving(false);
  };

  const handleTestSend = async () => {
    if (!project?.id) return;
    setTesting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const res = await fetch('/api/send-task-reminders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ projectId: project.id, test: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Test send failed');
      const result = data?.results?.[0];
      if (result?.error) {
        toast.error(`Test send failed: ${result.error}`);
      } else {
        toast.success('Test email sent successfully');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Test send failed';
      toast.error(msg);
    }
    setTesting(false);
  };

  return (
    <Modal title={inline ? 'Project Settings' : project ? 'Edit Project' : 'New Project'} onClose={onClose} width={960} inline={inline}>
      <FormRow label="Project Name" required>
        <Input autoFocus value={form.name} onChange={v => up('name', v)} placeholder="e.g. E-Commerce Platform" />
      </FormRow>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <FormRow label="Project Code">
          <Input value={form.code} onChange={v => up('code', v)} placeholder="e.g. ECP-2024" />
        </FormRow>
        <FormRow label="Status">
          <Select value={form.status} onChange={v => up('status', v)} options={statusDropdownOptions} />
        </FormRow>
        <FormRow label="Client">
          <Input value={form.client} onChange={v => up('client', v)} placeholder="Client company name" />
        </FormRow>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <FormRow label="Customer Abbreviation">
          <Input value={form.customerAbbreviation} onChange={v => up('customerAbbreviation', v)} placeholder="e.g. PCHI" />
        </FormRow>
        <FormRow label="Customer ID">
          <Input value={form.customerId} onChange={v => up('customerId', v)} placeholder="Customer ID" />
        </FormRow>
        <div />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <FormRow label="Start Date"><Input type="date" value={form.startDate} onChange={v => up('startDate', v)} /></FormRow>
        <FormRow label="End Date"><Input type="date" value={form.endDate} onChange={v => up('endDate', v)} /></FormRow>
        <FormRow label="Color">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {COLORS.map(c => (
              <div key={c} onClick={() => up('color', c)}
                style={{ width: 26, height: 26, borderRadius: '50%', background: c, cursor: 'pointer', border: form.color === c ? '3px solid #0F172A' : '3px solid transparent', transition: 'all 0.15s' }} />
            ))}
          </div>
        </FormRow>
      </div>
      <FormRow label="Customer logo">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ width: 160, height: 64, border: `1px dashed ${C.border2}`, borderRadius: 8, display: 'grid', placeItems: 'center', background: '#FFFFFF', overflow: 'hidden' }}>
            {logo ? <img src={logo} alt="Customer logo" style={{ maxWidth: 150, maxHeight: 56, objectFit: 'contain' }} /> : <span style={{ fontSize: 11, color: C.text3 }}>No logo</span>}
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', height: 34, padding: '0 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, fontWeight: 600, color: C.primary, cursor: 'pointer', background: C.white }}>
            {logo ? 'Change' : 'Upload'}
            <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif" style={{ display: 'none' }} onChange={(e) => { void pickLogo(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          {logo && <button type="button" onClick={() => setLogo('')} style={{ border: 0, background: 'transparent', color: C.red, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Remove</button>}
          <span style={{ fontSize: 11, color: C.text3 }}>Shown on reports such as Budget Control. Resized automatically.</span>
        </div>
      </FormRow>
      <FormRow label="Description">
        <Textarea value={form.description} onChange={v => up('description', v)} rows={2} placeholder="Brief project description…" />
      </FormRow>
      {!project && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <FormRow label="Copy Tasks From Previous Project">
            <Select
              value={copyFromProjectId}
              onChange={setCopyFromProjectId}
              options={[
                { value: '', label: '— Do not copy —' },
                ...projects
                  .map(p => ({ value: p.id, label: `${p.code || p.id} - ${p.name}` })),
              ]}
            />
          </FormRow>
          <div />
          {copyFromProjectId && (
            <FormRow label="Copy Scope">
              <Select
                value={copyScope}
                onChange={(v) => setCopyScope(v as 'all' | 'main')}
                options={[
                  { value: 'all', label: 'Copy All Tasks (Main + Sub)' },
                  { value: 'main', label: 'Copy Main Tasks Only' },
                ]}
              />
            </FormRow>
          )}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <FormRow label="Enable Email Reminder">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="checkbox"
              checked={form.emailNotificationEnabled}
              onChange={(e) => up('emailNotificationEnabled', e.target.checked)}
            />
            <span style={{ fontSize: 13, color: '#334155' }}>Send daily reminder emails</span>
          </div>
        </FormRow>
        <FormRow label="Reminder Mode">
          <Select value={form.emailNotificationMode} onChange={v => up('emailNotificationMode', v)}
            options={[
              { value: 'task', label: 'Use task assignees and fallback recipients' },
              { value: 'custom', label: 'Send only to custom recipients' },
            ]} />
        </FormRow>
        <FormRow label="Reminder Time">
          <Input type="time" value={form.emailNotificationTime} onChange={v => up('emailNotificationTime', v)} />
        </FormRow>
      </div>
      <FormRow label="Custom Recipients">
        <Input
          value={form.emailNotificationRecipients}
          onChange={v => up('emailNotificationRecipients', v)}
          placeholder="somchai@domain.com, apichart@domain.com"
        />
      </FormRow>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 10 }}>
        If task assignee email is not available, fallback recipients from Custom Recipients will be used.
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8, flexWrap: 'wrap' }}>
        {project && (
          <Btn variant="outline" onClick={handleTestSend} disabled={testing}>
            {testing ? 'Sending test…' : 'Send Test Email'}
          </Btn>
        )}
        {!inline && <Btn variant="ghost" onClick={onClose}>Cancel</Btn>}
        <Btn onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : project ? 'Save Changes' : 'Create Project'}</Btn>
      </div>
    </Modal>
  );
}
