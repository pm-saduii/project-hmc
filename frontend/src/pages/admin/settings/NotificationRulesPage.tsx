import React from 'react';
import toast from 'react-hot-toast';
import { Btn, C } from '../../../components/Common';
import { AdminHeader, Switch, hint, input, panel, td, th } from '../../../components/Admin/AdminUi';
import { notificationsApi, type NotifyRule } from '../../../services/notifications';

/** Settings › Notifications: switch rules on/off, choose email / Teams, tune days, default Teams channel. */
export default function NotificationRulesPage({ eyebrow }: { eyebrow: string }) {
  const [rules, setRules] = React.useState<NotifyRule[] | null>(null);
  const [error, setError] = React.useState('');
  const [hook, setHook] = React.useState('');
  const [savedHook, setSavedHook] = React.useState('');

  React.useEffect(() => {
    notificationsApi.rules().then(setRules).catch((e) => setError(e instanceof Error ? e.message : 'Unable to load'));
    notificationsApi.globalHook().then((v) => { setHook(v); setSavedHook(v); }).catch(() => undefined);
  }, []);

  const patch = async (r: NotifyRule, p: Partial<NotifyRule>) => {
    setRules((list) => list?.map((x) => (x.id === r.id ? { ...x, ...p } : x)) || null);
    try { await notificationsApi.saveRule(r.id, p); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save'); setRules((list) => list?.map((x) => (x.id === r.id ? r : x)) || null); }
  };
  const saveHook = async () => {
    const url = hook.trim();
    if (url && !/^https:\/\//i.test(url)) { toast.error('The link must start with https://'); return; }
    try { await notificationsApi.saveGlobalHook(url); setSavedHook(url); toast.success('Saved'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not save'); }
  };

  if (error) return <div style={{ ...panel, padding: 18, color: C.red, fontSize: 13 }}>{/relation|schema cache/i.test(error) ? 'Run the migration 2026-11-29-notifications.sql first.' : error}</div>;

  return (
    <>
      <AdminHeader eyebrow={eyebrow} title="Notification rules"
        description="Checked every morning at 08:30 (Bangkok). Email goes to the people named in each rule; Teams posts one card per project to the project's channel." />
      <section style={{ ...panel, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
          <thead><tr><th style={th}>Rule</th><th style={th}>Sent to</th><th style={{ ...th, width: 90 }}>Days</th><th style={{ ...th, width: 70 }}>On</th><th style={{ ...th, width: 70 }}>Email</th><th style={{ ...th, width: 70 }}>Teams</th></tr></thead>
          <tbody>
            {!rules ? <tr><td colSpan={6} style={{ ...td, color: C.text2 }}>Loading…</td></tr> : rules.map((r) => (
              <tr key={r.id} style={{ opacity: r.enabled ? 1 : 0.55 }}>
                <td style={td}><div style={{ fontWeight: 600 }}>{r.id} · {r.name}</div><div style={{ fontSize: 11, color: C.text2 }}>{r.description}</div></td>
                <td style={{ ...td, color: C.text2 }}>{r.recipients}</td>
                <td style={td}>{r.days == null ? <span style={{ color: C.text3 }}>—</span> : (
                  <input type="number" min={1} max={60} defaultValue={r.days} aria-label={`${r.name} days`} style={{ ...input, height: 30, width: 64 }}
                    onBlur={(e) => { const v = Math.max(1, Math.min(60, Number(e.target.value) || r.days || 1)); if (v !== r.days) void patch(r, { days: v }); }} />
                )}</td>
                <td style={td}><Switch checked={r.enabled} onChange={(v) => void patch(r, { enabled: v })} label={`${r.name} on`} /></td>
                <td style={td}><Switch checked={r.email} disabled={!r.enabled} onChange={(v) => void patch(r, { email: v })} label={`${r.name} email`} /></td>
                <td style={td}><Switch checked={r.teams} disabled={!r.enabled} onChange={(v) => void patch(r, { teams: v })} label={`${r.name} Teams`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ ...panel, padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text }}>Default Teams channel</h2>
        <div style={hint}>Used for projects that have no channel of their own (set in Notifications › Teams channels). In Teams: ⋯ › Workflows › "Post to a channel when a webhook request is received".</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={hook} onChange={(e) => setHook(e.target.value)} placeholder="https://…" aria-label="Default Teams link" style={{ ...input, flex: 1 }} />
          <Btn onClick={() => void saveHook()} disabled={hook.trim() === savedHook}>Save</Btn>
        </div>
      </section>
      <div style={hint}>Finished projects (Hyper Care, closed) get no notifications. Each message goes out at most once a day.</div>
    </>
  );
}
