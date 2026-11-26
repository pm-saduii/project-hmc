import React from 'react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { Mail, MessageSquare, RefreshCw, Send } from 'lucide-react';
import { Btn, C } from '../components/Common';
import { AdminHeader, F, Pill, input, panel, td, th } from '../components/Admin/AdminUi';
import { useAuth } from '../contexts/AuthContext';
import { useStore } from '../store';
import { notificationsApi, type LogRow, type QueueMessage } from '../services/notifications';
import { isClosedStatus, isHyperCareStatus } from '../utils/projectHealth';

/** /notifications — today's rule-based notifications, sending, history and each project's Teams channel. */
export default function NotificationsPage() {
  const { profile } = useAuth();
  const role = profile?.role || '';
  const canSend = role === 'admin' || role === 'pm';
  const projects = useStore((s) => s.projects);
  const masterCodes = useStore((s) => s.masterCodes);
  const [queue, setQueue] = React.useState<QueueMessage[] | null>(null);
  const [date, setDate] = React.useState('');
  const [log, setLog] = React.useState<LogRow[]>([]);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState('');
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  const [hooks, setHooks] = React.useState<Record<string, string>>({});
  const [tab, setTab] = React.useState<'queue' | 'history' | 'teams'>('queue');

  const load = React.useCallback(async () => {
    setError('');
    try {
      const [q, l, h] = await Promise.all([notificationsApi.preview(), notificationsApi.log().catch(() => []), notificationsApi.hooks().catch(() => ({}))]);
      setQueue(q.messages); setDate(q.date); setLog(l); setHooks(h);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load notifications'); setQueue([]); }
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  const send = async (keys?: string[]) => {
    setBusy(keys ? keys[0] : 'all');
    try {
      const { results } = await notificationsApi.send(keys);
      const sent = results.filter((r) => r.status === 'sent').length;
      const failed = results.filter((r) => r.status === 'failed');
      if (failed.length) toast.error(`${sent} sent, ${failed.length} failed: ${failed[0].error}`, { duration: 7000 });
      else toast.success(`${sent} message${sent === 1 ? '' : 's'} sent`);
      setLog(await notificationsApi.log().catch(() => log));
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not send'); }
    finally { setBusy(''); }
  };

  const projectName = (id: string | null) => { const p = projects.find((x) => x.id === id); return p ? `${p.code}${p.customerAbbreviation ? ` (${p.customerAbbreviation})` : ''}` : '—'; };
  const statusLabel = (status: string) => masterCodes.find((c) => c.codeType === 'project_status' && c.codeValue === status)?.label || '';
  const running = projects.filter((p) => !isClosedStatus(p.status, statusLabel(p.status)) && !isHyperCareStatus(p.status, statusLabel(p.status)));
  const sendable = (queue || []).filter((m) => !m.noRecipient);
  const missing = (queue || []).filter((m) => m.noRecipient);
  const migrationMissing = /relation|schema cache|notification_rules/i.test(error);

  const tabBtn = (key: typeof tab, label: string) => (
    <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)}
      style={{ height: 32, padding: '0 14px', borderRadius: 999, fontFamily: F, fontSize: 13, cursor: 'pointer', fontWeight: tab === key ? 600 : 500,
        border: `1px solid ${tab === key ? '#C7D2FE' : C.border}`, background: tab === key ? C.primaryBg : C.white, color: tab === key ? '#4338CA' : C.text2 }}>{label}</button>
  );

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '24px 32px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 16, fontFamily: F }}>
      <AdminHeader title="Notifications"
        description="Reminders worked out from the projects every morning (08:30) and sent by email and to each project's Microsoft Teams channel. Rules are set in Settings › Notifications."
        actions={<>
          <Btn variant="ghost" onClick={() => void load()} title="Refresh"><RefreshCw size={14} /></Btn>
          {canSend && <Btn onClick={() => void send()} disabled={!!busy || !sendable.length}><Send size={14} style={{ marginRight: 6 }} />{busy === 'all' ? 'Sending…' : `Send all now (${sendable.length})`}</Btn>}
        </>} />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {tabBtn('queue', `Today${date ? ` · ${date.split('-').reverse().join('/')}` : ''}`)}{tabBtn('history', 'History')}{(role === 'admin' || role === 'pm') && tabBtn('teams', 'Teams channels')}
      </div>

      {error && <div style={{ ...panel, padding: 16, fontSize: 13, color: C.red }}>{migrationMissing ? 'Notifications are not set up yet: run the migration 2026-11-29-notifications.sql.' : error}</div>}

      {tab === 'queue' && (
        <section style={{ ...panel, overflow: 'hidden' }}>
          {queue === null ? <div style={{ padding: 16, fontSize: 13, color: C.text2 }}>Working out today's notifications…</div>
            : queue.length === 0 ? <div style={{ padding: 16, fontSize: 13, color: C.text2 }}>Nothing to send today.</div> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Rule</th><th style={th}>Channel</th><th style={th}>To</th><th style={th}>Items</th>{canSend && <th style={{ ...th, width: 90 }}><span style={{ position: 'absolute', left: -9999 }}>Send</span></th>}</tr></thead>
                <tbody>
                  {[...sendable, ...missing].map((m) => (
                    <React.Fragment key={m.key}>
                      <tr style={{ background: m.noRecipient ? '#FFFBEB' : undefined }}>
                        <td style={td}><div style={{ fontWeight: 600 }}>{m.ruleName}</div><div style={{ fontSize: 11, color: C.text3 }}>{m.ruleId}</div></td>
                        <td style={td}>{m.channel === 'email' ? <Pill bg={C.blueBg} fg="#1D4ED8"><Mail size={11} style={{ marginRight: 4 }} />Email</Pill> : <Pill bg="#EDE9FE" fg="#5B21B6"><MessageSquare size={11} style={{ marginRight: 4 }} />Teams</Pill>}</td>
                        <td style={td}>
                          {m.noRecipient
                            ? <span style={{ fontSize: 13, color: '#B45309' }}>{m.channel === 'teams' ? 'No Teams channel set for this project' : 'No email found — add the person\'s email in Members, or a Project Manager'}</span>
                            : <><div>{m.recipient}</div>{m.cc.length > 0 && <div style={{ fontSize: 11, color: C.text3 }}>cc {m.cc.join(', ')}</div>}</>}
                        </td>
                        <td style={td}>
                          <button type="button" onClick={() => setOpen((o) => ({ ...o, [m.key]: !o[m.key] }))} style={{ border: 0, background: 'transparent', color: C.primary, fontFamily: F, fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                            {m.items.length} item{m.items.length > 1 ? 's' : ''} · {[...new Set(m.items.map((i) => i.project))].join(', ')}
                          </button>
                        </td>
                        {canSend && <td style={{ ...td, textAlign: 'right' }}>{!m.noRecipient && <Btn small variant="outline" onClick={() => void send([m.key])} disabled={!!busy}>{busy === m.key ? '…' : 'Send'}</Btn>}</td>}
                      </tr>
                      {open[m.key] && (
                        <tr><td colSpan={canSend ? 5 : 4} style={{ ...td, background: C.bg }}>
                          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.7 }}>
                            {m.items.map((i, k) => <li key={k}><strong>{i.project}</strong> · {i.text}{i.when && <span style={{ color: C.text2 }}> — {i.when}</span>}</li>)}
                          </ul>
                        </td></tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
        </section>
      )}

      {tab === 'history' && (
        <section style={{ ...panel, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead><tr><th style={th}>When</th><th style={th}>Rule</th><th style={th}>Channel</th><th style={th}>To</th><th style={th}>Project</th><th style={th}>Status</th></tr></thead>
            <tbody>
              {log.length === 0 ? <tr><td colSpan={6} style={{ ...td, color: C.text2 }}>Nothing sent yet.</td></tr> : log.map((l) => (
                <tr key={l.id}>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>{format(new Date(l.createdAt), 'dd/MM/yyyy HH:mm')}<div style={{ fontSize: 11, color: C.text3 }}>{l.trigger}</div></td>
                  <td style={td}>{l.ruleId}<div style={{ fontSize: 11, color: C.text3 }}>{l.subject}</div></td>
                  <td style={td}>{l.channel}</td>
                  <td style={td}>{l.recipient}</td>
                  <td style={td}>{projectName(l.projectId)}</td>
                  <td style={td}>
                    <Pill bg={l.status === 'sent' ? C.greenBg : l.status === 'failed' ? C.redBg : C.bg2} fg={l.status === 'sent' ? '#047857' : l.status === 'failed' ? '#B91C1C' : C.text2}>{l.status}</Pill>
                    {l.error && <div style={{ fontSize: 11, color: '#B91C1C', marginTop: 2 }}>{l.error}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === 'teams' && (
        <section style={{ ...panel, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, color: C.text2, lineHeight: 1.6 }}>
            In the Teams channel: <strong>⋯ › Workflows › "Post to a channel when a webhook request is received"</strong>, copy the link it gives and paste it here.
            Projects without a link use the default channel set by an admin in Settings › Notifications.
          </div>
          {running.map((p) => <HookRow key={p.id} projectId={p.id} label={projectName(p.id)} name={p.name} value={hooks[p.id] || ''} onSaved={(v) => setHooks((h) => ({ ...h, [p.id]: v }))} />)}
        </section>
      )}
    </div>
  );
}

function HookRow({ projectId, label, name, value, onSaved }: { projectId: string; label: string; name: string; value: string; onSaved: (v: string) => void }) {
  const [draft, setDraft] = React.useState(value);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { setDraft(value); }, [value]);
  const save = async () => {
    const url = draft.trim();
    if (url && !/^https:\/\//i.test(url)) { toast.error('The link must start with https://'); return; }
    setBusy(true);
    try { await notificationsApi.saveHook(projectId, url); onSaved(url); toast.success('Saved'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save'); }
    finally { setBusy(false); }
  };
  const test = async () => {
    setBusy(true);
    try { await notificationsApi.testTeams(projectId); toast.success('Test message posted to Teams'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Teams test failed'); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 240px) 1fr auto auto', gap: 8, alignItems: 'center' }}>
      <div><div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{label}</div><div style={{ fontSize: 11, color: C.text3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div></div>
      <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="https://… (Teams workflow link)" aria-label={`${label} Teams link`} style={{ ...input, height: 34 }} />
      <Btn small variant="outline" onClick={() => void save()} disabled={busy || draft.trim() === value}>Save</Btn>
      <Btn small variant="ghost" onClick={() => void test()} disabled={busy || !value}>Test</Btn>
    </div>
  );
}
