import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Copy, FolderOpen, Layers, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../../store';
import { useAuth } from '../../contexts/AuthContext';
import { taskApi, taskTemplateApi } from '../../services/api';
import { methodologyApi } from '../../services/methodology';
import { compareWbs } from '../../utils';
import type { TaskTemplateItem, TaskTemplate } from '../../types';
import { Btn, C, FormRow, Input, Modal, Select } from '../Common';

function getTodayPassword(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  return `${dd}${mm}${yyyy}`;
}

type CopySourceMode = 'project' | 'template';

interface Props {
  onClose: () => void;
  /** Render as a page section instead of a popup. */
  inline?: boolean;
  /** Open on this view and hide the Copy/Templates switch. */
  only?: 'copy' | 'templates';
}

export default function TaskTemplateModal({ onClose, inline = false, only }: Props) {
  const { profile } = useAuth();
  const { activeProject, projects, fetchProjects, fetchTasks } = useStore();

  const [activeView, setActiveView] = useState<'copy' | 'templates'>(only ?? 'copy');
  const [loading, setLoading] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [savingTemplateName, setSavingTemplateName] = useState(false);
  const [savingItems, setSavingItems] = useState(false);

  const [sourceMode, setSourceMode] = useState<CopySourceMode>('project');
  const [sourceProjectId, setSourceProjectId] = useState('');
  const [sourceTemplateId, setSourceTemplateId] = useState('');
  const [password, setPassword] = useState('');

  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [templateNameDraft, setTemplateNameDraft] = useState('');
  const [templateNameDraftId, setTemplateNameDraftId] = useState('');
  const [itemsDraft, setItemsDraft] = useState<TaskTemplateItem[]>([]);
  // Methodology names for the link column (phase of a top-level row / deliverable of a task)
  const [methodNames, setMethodNames] = useState<{ phases: Record<string, string>; deliverables: Record<string, string> }>({ phases: {}, deliverables: {} });
  useEffect(() => {
    void methodologyApi.load().then((m) => setMethodNames({
      phases: Object.fromEntries(m.phases.map((p) => [p.id, p.name])),
      deliverables: Object.fromEntries(m.deliverables.map((d) => [d.id, d.shortName || d.name])),
    })).catch(() => undefined);
  }, []);
  const [itemsSavedSnapshot, setItemsSavedSnapshot] = useState('');
  const [itemsDraftId, setItemsDraftId] = useState('');
  const nameSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const itemsSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const nameSaveRevision = useRef(0);
  const itemsSaveRevision = useRef(0);

  const [createName, setCreateName] = useState('');
  const [createSourceProjectId, setCreateSourceProjectId] = useState('');

  const isAdmin = profile?.role === 'admin';

  const sourceProjectOptions = useMemo(() => {
    const currentId = activeProject?.id || '';
    return projects
      .filter((p) => p.id !== currentId)
      .map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` }));
  }, [projects, activeProject?.id]);

  const allProjectOptions = useMemo(
    () => projects.map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` })),
    [projects],
  );

  const templateOptions = useMemo(
    () => templates.map((t) => ({ value: t.id, label: `Template ${t.templateNo} - ${t.name}` })),
    [templates],
  );

  useEffect(() => {
    if (!sourceProjectId && sourceProjectOptions.length > 0) {
      setSourceProjectId(sourceProjectOptions[0].value);
    }
    if (!createSourceProjectId && allProjectOptions.length > 0) {
      setCreateSourceProjectId(allProjectOptions[0].value);
    }
  }, [sourceProjectId, createSourceProjectId, sourceProjectOptions, allProjectOptions]);

  const loadTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const res = await taskTemplateApi.getAll();
      setTemplates(res.data);
      if (!selectedTemplateId && res.data.length > 0) {
        setSelectedTemplateId(res.data[0].id);
      }
      if (!sourceTemplateId && res.data.length > 0) {
        setSourceTemplateId(res.data[0].id);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load templates');
    } finally {
      setTemplatesLoading(false);
    }
  };

  const loadTemplateItems = async (templateId: string) => {
    if (!templateId) {
      setItemsDraft([]);
      setItemsSavedSnapshot('[]');
      setItemsDraftId('');
      setTemplateNameDraft('');
      setTemplateNameDraftId('');
      return;
    }
    try {
      const [templateRes, itemRes] = await Promise.all([
        taskTemplateApi.getAll(),
        taskTemplateApi.getItems(templateId),
      ]);
      const found = templateRes.data.find((t) => t.id === templateId);
      setTemplateNameDraft(found?.name || '');
      setTemplateNameDraftId(templateId);
      const sortedItems = itemRes.data.slice().sort((a, b) => compareWbs(a.wbs || '', b.wbs || ''));
      setItemsDraft(sortedItems);
      setItemsSavedSnapshot(JSON.stringify(sortedItems));
      setItemsDraftId(templateId);
      setTemplates(templateRes.data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load template items');
    }
  };

  useEffect(() => {
    if (projects.length === 0) {
      fetchProjects();
    }
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedTemplateId) {
      loadTemplateItems(selectedTemplateId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId]);

  const handleConfirmCopy = async () => {
    if (!activeProject?.id) {
      toast.error('Please open a project first');
      return;
    }
    if (password.trim() !== getTodayPassword()) {
      toast.error('Invalid password');
      return;
    }

    setLoading(true);
    try {
      if (sourceMode === 'project') {
        if (!sourceProjectId) {
          toast.error('Please select source project');
          return;
        }
        await taskApi.replaceFromProject(sourceProjectId, activeProject.id);
      } else {
        if (!sourceTemplateId) {
          toast.error('Please select template');
          return;
        }
        await taskTemplateApi.applyToProject(sourceTemplateId, activeProject.id);
      }

      await fetchTasks(activeProject.id);
      toast.success('Tasks copied successfully');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Copy failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!isAdmin) {
      toast.error('Admin only');
      return;
    }
    if (!createName.trim()) {
      toast.error('Template name is required');
      return;
    }
    if (!createSourceProjectId) {
      toast.error('Please select source project');
      return;
    }

    setLoading(true);
    try {
      const res = await taskTemplateApi.createFromProject(createName.trim(), createSourceProjectId);
      toast.success(`Created Template ${res.data.templateNo}`);
      setCreateName('');
      await loadTemplates();
      setSelectedTemplateId(res.data.id);
      setActiveView('templates');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create template');
    } finally {
      setLoading(false);
    }
  };

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  useEffect(() => {
    if (!isAdmin || !selectedTemplate || templateNameDraftId !== selectedTemplateId || !templateNameDraft.trim() || templateNameDraft.trim() === selectedTemplate.name) return;
    const revision = ++nameSaveRevision.current;
    const timeout = window.setTimeout(() => {
      nameSaveQueue.current = nameSaveQueue.current.catch(() => undefined).then(async () => {
        if (revision !== nameSaveRevision.current) return;
        setSavingTemplateName(true);
        try {
          const saved = await taskTemplateApi.updateTemplate(selectedTemplateId, { name: templateNameDraft.trim() });
          if (revision === nameSaveRevision.current) {
            setTemplates((current) => current.map((template) => template.id === selectedTemplateId ? saved.data : template));
          }
        } catch (error) {
          if (revision === nameSaveRevision.current) toast.error(error instanceof Error ? error.message : 'Failed to save template name');
        } finally {
          if (revision === nameSaveRevision.current) setSavingTemplateName(false);
        }
      });
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [isAdmin, selectedTemplate, selectedTemplateId, templateNameDraft, templateNameDraftId]);

  useEffect(() => {
    if (!isAdmin || !selectedTemplateId || itemsDraftId !== selectedTemplateId || templatesLoading || JSON.stringify(itemsDraft) === itemsSavedSnapshot) return;
    const revision = ++itemsSaveRevision.current;
    const timeout = window.setTimeout(() => {
      itemsSaveQueue.current = itemsSaveQueue.current.catch(() => undefined).then(async () => {
        if (revision !== itemsSaveRevision.current) return;
        setSavingItems(true);
        try {
          const sortedItems = [...itemsDraft].sort((a, b) => compareWbs(a.wbs || '', b.wbs || ''));
          await taskTemplateApi.replaceItems(
            selectedTemplateId,
            sortedItems.map((item, index) => ({
              wbs: item.wbs,
              parentWbs: item.parentWbs,
              level: Number(item.level || 0),
              sortOrder: (index + 1) * 10,
              taskName: item.taskName,
              duration: Number(item.duration || 0),
              effortManday: Number(item.effortManday || 0),
              resource: item.resource || '',
              isMilestone: !!item.isMilestone,
              visibility: item.visibility === 'internal' ? 'internal' : 'external',
              methodologyPhaseId: item.methodologyPhaseId || null,
              deliverableId: item.deliverableId || null,
            })),
          );
          if (revision === itemsSaveRevision.current) setItemsSavedSnapshot(JSON.stringify(itemsDraft));
        } catch (error) {
          if (revision === itemsSaveRevision.current) toast.error(error instanceof Error ? error.message : 'Failed to save template items');
        } finally {
          if (revision === itemsSaveRevision.current) setSavingItems(false);
        }
      });
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [isAdmin, itemsDraft, itemsDraftId, itemsSavedSnapshot, selectedTemplateId, templatesLoading]);

  const handleDeleteTemplate = async () => {
    if (!isAdmin) return;
    if (!selectedTemplateId) return;
    if (!window.confirm('Delete this template?')) return;

    setLoading(true);
    try {
      await taskTemplateApi.removeTemplate(selectedTemplateId);
      toast.success('Template deleted');
      const remaining = templates.filter((t) => t.id !== selectedTemplateId);
      setSelectedTemplateId(remaining[0]?.id || '');
      setItemsDraft([]);
      await loadTemplates();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete template');
    } finally {
      setLoading(false);
    }
  };

  const updateItemFlag = (index: number, patch: Partial<TaskTemplateItem>) => setItemsDraft((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  const updateItemField = (index: number, field: keyof TaskTemplateItem, value: string) => {
    setItemsDraft((prev) => {
      const next = [...prev];
      const current = next[index];
      if (!current) return prev;
      if (field === 'duration' || field === 'effortManday' || field === 'sortOrder' || field === 'level') {
        next[index] = { ...current, [field]: Number(value || 0) } as TaskTemplateItem;
      } else {
        next[index] = { ...current, [field]: value } as TaskTemplateItem;
      }
      return next;
    });
  };

  const addItem = () => {
    const maxSort = itemsDraft.reduce((m, it) => Math.max(m, it.sortOrder || 0), 0);
    setItemsDraft((prev) => [
      ...prev,
      {
        id: '',
        templateId: selectedTemplateId,
        wbs: '',
        parentWbs: '',
        level: 0,
        sortOrder: maxSort + 10,
        taskName: '',
        duration: 0,
        effortManday: 0,
        createdAt: new Date().toISOString(),
      },
    ]);
  };

  const removeItem = (index: number) => {
    setItemsDraft((prev) => prev.filter((_, i) => i !== index));
  };

  const cellInput: React.CSSProperties = {
    width: '100%', height: '100%', border: 'none', outline: 'none',
    background: 'transparent', fontSize: 11, color: C.text, padding: '0 6px',
    fontFamily: 'inherit',
  };

  return (
    <Modal title={only === 'templates' ? 'Task Templates' : only === 'copy' ? 'Replace Tasks' : 'Task Copy & WBS Template'} onClose={onClose} width={1180} closeOnBackdrop={false} inline={inline}>
      <div style={{ display: 'grid', gap: 10 }}>
        {!only && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn small variant={activeView === 'copy' ? 'primary' : 'ghost'} onClick={() => setActiveView('copy')}>
            <Copy size={14} /> Copy Tasks
          </Btn>
          <Btn small variant={activeView === 'templates' ? 'primary' : 'ghost'} onClick={() => setActiveView('templates')}>
            <Layers size={14} /> Templates
          </Btn>
        </div>}

        {activeView === 'copy' && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ fontSize: 13, color: C.text2 }}>
              Target Project: <strong>{activeProject?.name || '-'}</strong>
            </div>

            <FormRow label="Copy Source">
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setSourceMode('project')}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: `1px solid ${sourceMode === 'project' ? C.primary : C.border}`,
                    background: sourceMode === 'project' ? C.primaryBg : C.white,
                    color: sourceMode === 'project' ? C.primary : C.text,
                    cursor: 'pointer',
                  }}
                >
                  From Project
                </button>
                <button
                  type="button"
                  onClick={() => setSourceMode('template')}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: `1px solid ${sourceMode === 'template' ? C.primary : C.border}`,
                    background: sourceMode === 'template' ? C.primaryBg : C.white,
                    color: sourceMode === 'template' ? C.primary : C.text,
                    cursor: 'pointer',
                  }}
                >
                  From Template
                </button>
              </div>
            </FormRow>

            {sourceMode === 'project' ? (
              <FormRow label="Source Project" required>
                <Select
                  value={sourceProjectId}
                  onChange={setSourceProjectId}
                  options={sourceProjectOptions.length ? sourceProjectOptions : [{ value: '', label: 'No source project available' }]}
                  disabled={!sourceProjectOptions.length}
                />
              </FormRow>
            ) : (
              <FormRow label="Template" required>
                <Select
                  value={sourceTemplateId}
                  onChange={setSourceTemplateId}
                  options={templateOptions.length ? templateOptions : [{ value: '', label: 'No template available' }]}
                  disabled={!templateOptions.length || templatesLoading}
                />
              </FormRow>
            )}

            <FormRow label="Password" required>
              <Input value={password} onChange={setPassword} placeholder="*********" />
            </FormRow>

            <div style={{ padding: '10px 12px', borderRadius: 10, background: C.amberBg, fontSize: 13, color: C.text2 }}>
              This action replaces all tasks in the target project.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Btn variant="ghost" onClick={onClose} disabled={loading}>Cancel</Btn>
              <Btn
                onClick={handleConfirmCopy}
                disabled={loading || !activeProject?.id || !password.trim() || (sourceMode === 'project' ? !sourceProjectId : !sourceTemplateId)}
              >
                {loading ? 'Copying…' : 'Confirm Copy'}
              </Btn>
            </div>
          </div>
        )}

        {activeView === 'templates' && (
          <div style={{ display: 'grid', gap: 8 }}>
            {!isAdmin && (
              <div style={{ padding: '6px 10px', borderRadius: 8, background: C.redBg, color: C.red, fontSize: 11 }}>
                Template create/edit/delete is available for admin only.
              </div>
            )}

            {/* Create Template */}
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 12px', display: 'grid', gap: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.text2, textTransform: 'uppercase', letterSpacing: 1 }}>Create Template From Project</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <Input value={createName} onChange={setCreateName} placeholder="Template name" />
                <Select
                  value={createSourceProjectId}
                  onChange={setCreateSourceProjectId}
                  options={allProjectOptions.length ? allProjectOptions : [{ value: '', label: 'No project' }]}
                  disabled={!allProjectOptions.length}
                />
                <Btn small onClick={handleCreateTemplate} disabled={!isAdmin || loading || !createName.trim() || !createSourceProjectId}>
                  <Plus size={13} /> Create
                </Btn>
              </div>
            </div>

            {/* Edit Template */}
            <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 12px', display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.text2, textTransform: 'uppercase', letterSpacing: 1 }}>Edit Template</div>
                <Btn small variant="ghost" onClick={loadTemplates} disabled={templatesLoading}>
                  <FolderOpen size={13} /> Refresh
                </Btn>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <Select
                    value={selectedTemplateId}
                    onChange={setSelectedTemplateId}
                    options={templateOptions.length ? templateOptions : [{ value: '', label: 'No template' }]}
                    disabled={!templateOptions.length}
                  />
                </div>
                {selectedTemplate && (
                  <>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <Input value={templateNameDraft} onChange={setTemplateNameDraft} placeholder="Template name" />
                    </div>
                    {savingTemplateName && <span role="status" style={{ color: C.text3, fontSize: 11 }}>Saving…</span>}
                    <Btn small variant="danger" onClick={handleDeleteTemplate} disabled={!isAdmin || loading}>
                      <Trash2 size={13} />
                    </Btn>
                  </>
                )}
              </div>

              {selectedTemplate && (
                <>
                  {/* Compact items table */}
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', marginTop: 2 }}>
                    {/* Header */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '64px 64px 1fr 92px 34px 58px 120px 60px 70px 32px',
                      background: C.bg2,
                      height: 32,
                      borderBottom: `1px solid ${C.border}`,
                    }}>
                      {['WBS', 'Parent', 'Task Name', 'Owner', '◆', 'Internal', 'Methodology', 'Days', 'MD', ''].map((label) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', padding: '0 6px', fontSize: 11, fontWeight: 700, color: C.text2 }}>
                          {label}
                        </div>
                      ))}
                    </div>
                    {/* Rows */}
                    <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                      {itemsDraft.length === 0 && (
                        <div style={{ height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: C.text3 }}>
                          No items — click + Add Row below
                        </div>
                      )}
                      {itemsDraft.map((item, index) => (
                        <div
                          key={item.id || `draft-${index}`}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '64px 64px 1fr 92px 34px 58px 120px 60px 70px 32px',
                            height: 36,
                            borderBottom: `1px solid ${C.border}`,
                            background: index % 2 === 1 ? C.bg2 : C.white,
                          }}
                        >
                          <input style={cellInput} value={item.wbs} onChange={(e) => updateItemField(index, 'wbs', e.target.value)} />
                          <input style={{ ...cellInput, borderLeft: `1px solid ${C.border}` }} value={item.parentWbs || ''} onChange={(e) => updateItemField(index, 'parentWbs', e.target.value)} />
                          <input style={{ ...cellInput, borderLeft: `1px solid ${C.border}`, fontWeight: Number(item.level || 0) < 2 ? 700 : 400, paddingLeft: 6 + Number(item.level || 0) * 12 }} value={item.taskName} onChange={(e) => updateItemField(index, 'taskName', e.target.value)} />
                          <select aria-label="Owner" value={item.resource || ''} onChange={(e) => updateItemFlag(index, { resource: e.target.value })} disabled={!isAdmin}
                            style={{ ...cellInput, borderLeft: `1px solid ${C.border}`, padding: '0 2px' }}>
                            <option value="">—</option><option value="HMC">HMC</option><option value="Customer">Customer</option><option value="Joint">Joint</option>
                          </select>
                          <label title="Key milestone" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: `1px solid ${C.border}` }}>
                            <input type="checkbox" checked={!!item.isMilestone} disabled={!isAdmin} onChange={(e) => updateItemFlag(index, { isMilestone: e.target.checked })} style={{ accentColor: C.primary }} />
                          </label>
                          <label title="Internal: never shown to the customer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, borderLeft: `1px solid ${C.border}`, fontSize: 11 }}>
                            <input type="checkbox" checked={item.visibility === 'internal'} disabled={!isAdmin} onChange={(e) => updateItemFlag(index, { visibility: e.target.checked ? 'internal' : 'external' })} style={{ accentColor: '#B45309' }} />
                            {item.visibility === 'internal' ? '🔒' : ''}
                          </label>
                          <div title={item.methodologyPhaseId ? 'Phase gate links to this task' : item.deliverableId ? 'Deliverable produced by this task' : ''}
                            style={{ display: 'flex', alignItems: 'center', padding: '0 6px', borderLeft: `1px solid ${C.border}`, fontSize: 10.5, color: item.methodologyPhaseId ? C.primary : '#047857', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.methodologyPhaseId ? `Phase · ${methodNames.phases[item.methodologyPhaseId] || '…'}` : item.deliverableId ? `📄 ${methodNames.deliverables[item.deliverableId] || '…'}` : ''}
                          </div>
                          <input style={{ ...cellInput, borderLeft: `1px solid ${C.border}`, textAlign: 'right' }} type="number" value={item.duration || 0} onChange={(e) => updateItemField(index, 'duration', e.target.value)} />
                          <input style={{ ...cellInput, borderLeft: `1px solid ${C.border}`, textAlign: 'right' }} type="number" value={item.effortManday || 0} onChange={(e) => updateItemField(index, 'effortManday', e.target.value)} />
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: `1px solid ${C.border}` }}>
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              disabled={!isAdmin}
                              style={{ background: 'none', border: 'none', cursor: isAdmin ? 'pointer' : 'default', color: C.red, opacity: isAdmin ? 1 : 0.3, padding: 4, display: 'flex', alignItems: 'center' }}
                              title="Delete row"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Add row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 2 }}>
                    <Btn small variant="ghost" onClick={addItem} disabled={!isAdmin}>
                      <Plus size={13} /> Add Row
                    </Btn>
                    {savingItems && <span role="status" style={{ color: C.text3, fontSize: 11 }}>Saving…</span>}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
