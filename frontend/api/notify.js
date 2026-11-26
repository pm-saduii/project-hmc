// Rule-based notifications.
//   GET  (Vercel Cron, Authorization: Bearer $CRON_SECRET — or x-reminder-secret: $REMINDER_API_SECRET):
//        work out today's messages for every project and send them (each at most once a day).
//   POST (signed-in user, Bearer token):
//        { action: 'preview' }                    → today's queue for the caller's projects
//        { action: 'send', keys?: string[] }      → send now (admin, or a PM for their projects)
//        { action: 'test-teams', projectId }      → post a test card to the project's Teams channel
import { getServiceClient, getCaller, canAccessProject } from '../server/auth.js';
import { bangkokToday, buildQueue, loadData, prevMonth, sendMessages } from '../server/notify-engine.js';

const CRON_SECRET = process.env.CRON_SECRET;
const REMINDER_API_SECRET = process.env.REMINDER_API_SECRET || process.env.REMINDER_SECRET;

const appUrl = (req) => (process.env.APP_URL
  || (req.headers.origin && /^https?:\/\//.test(req.headers.origin) ? req.headers.origin : '')
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')).replace(/\/$/, '');

const publicMessage = (m) => ({
  key: m.key, ruleId: m.ruleId, ruleName: m.ruleName, channel: m.channel, recipient: m.recipient, cc: m.cc,
  projectIds: m.projectIds, subject: m.subject, items: m.items, noRecipient: !!m.noRecipient,
});

export default async function handler(req, res) {
  const sb = getServiceClient();
  if (!sb) return res.status(500).json({ error: 'Server is missing SUPABASE_URL / SUPABASE_SERVICE_KEY' });
  const today = bangkokToday();

  // ── Scheduled run ──────────────────────────────────────────────────────
  const auth = String(req.headers.authorization || '');
  const isCron = (CRON_SECRET && auth === `Bearer ${CRON_SECRET}`)
    || (REMINDER_API_SECRET && req.headers['x-reminder-secret'] === REMINDER_API_SECRET);
  if (req.method === 'GET') {
    if (!isCron) return res.status(401).json({ error: 'UNAUTHORIZED' });
    const data = await loadData(sb, prevMonth(today.iso));
    const queue = buildQueue(data, { today, appUrl: appUrl(req) });
    const results = await sendMessages(sb, queue, { trigger: 'auto', today });
    return res.status(200).json({ date: today.iso, messages: queue.length, sent: results.filter((r) => r.status === 'sent').length,
      failed: results.filter((r) => r.status === 'failed').length, skipped: results.filter((r) => r.status === 'skipped').length });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // ── Signed-in user ─────────────────────────────────────────────────────
  const caller = await getCaller(sb, req);
  if (!caller) return res.status(401).json({ error: 'UNAUTHENTICATED' });
  if (!['admin', 'pm', 'am', 'director'].includes(caller.role)) return res.status(403).json({ error: 'FORBIDDEN' });
  const action = req.body?.action;

  const data = await loadData(sb, prevMonth(today.iso));
  // Projects the caller may see; senders: admins for all, PMs for their own projects.
  let projectIds = null;
  if (caller.role !== 'admin') {
    const checks = await Promise.all(data.projects.map(async (p) => ((await canAccessProject(sb, caller, p.id)) ? p.id : null)));
    projectIds = checks.filter(Boolean);
  }

  if (action === 'test-teams') {
    const projectId = String(req.body?.projectId || '');
    if (!projectId || (projectIds && !projectIds.includes(projectId)) || !['admin', 'pm'].includes(caller.role)) return res.status(403).json({ error: 'FORBIDDEN' });
    const hook = data.integrations.find((x) => x.project_id === projectId)?.teams_webhook_url
      || data.settings.find((s) => s.key === 'teams_webhook_url')?.value || '';
    if (!hook) return res.status(400).json({ error: 'No Teams channel link is set for this project' });
    const p = data.projects.find((x) => x.id === projectId);
    const [result] = await sendMessages(sb, [{ key: 'test', ruleId: 'TEST', ruleName: 'Test', channel: 'teams', recipient: `Teams · ${p?.code || ''}`, webhook: hook, cc: [], projectIds: [projectId],
      subject: `${p?.code || 'Project'} · Test message from Project Tracking System`, items: [{ project: p?.code || '', text: 'Notifications for this project will appear in this channel.', when: '', link: `${appUrl(req)}/projects/${projectId}` }] }],
    { trigger: 'manual', today });
    return result?.status === 'sent' ? res.status(200).json({ ok: true }) : res.status(400).json({ error: result?.error || 'Teams did not accept the message' });
  }

  const queue = buildQueue(data, { today, projectIds, appUrl: appUrl(req) })
    // non-admins only see messages for themselves or for projects they manage
    .filter((m) => caller.role === 'admin' || m.recipient === caller.email || caller.role === 'pm');

  if (action === 'preview') {
    return res.status(200).json({ date: today.iso, period: prevMonth(today.iso), rules: data.rules, messages: queue.map(publicMessage) });
  }
  if (action === 'send') {
    if (!['admin', 'pm'].includes(caller.role)) return res.status(403).json({ error: 'FORBIDDEN' });
    const keys = Array.isArray(req.body?.keys) ? new Set(req.body.keys.map(String)) : null;
    const chosen = queue.filter((m) => !keys || keys.has(m.key));
    const results = await sendMessages(sb, chosen, { trigger: 'manual', today });
    return res.status(200).json({ results });
  }
  return res.status(400).json({ error: 'Unknown action' });
}
