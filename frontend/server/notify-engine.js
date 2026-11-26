// Rule-based notifications: work out today's messages from the project data and send them
// by email (Gmail SMTP, as the task reminders do) and/or to each project's Microsoft Teams channel.
// Kept outside /api so it is not deployed as its own endpoint.
import nodemailer from 'nodemailer';

const GMAIL_USER = process.env.GMAIL_USER || process.env.GMAIL_USERNAME || process.env.EMAIL_USERNAME;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASSWORD;
const EMAIL_FROM = process.env.EMAIL_FROM || GMAIL_USER;

const norm = (v) => String(v ?? '').trim().toLowerCase();
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const uniq = (list) => [...new Set(list.filter(Boolean))];

/** Today in Bangkok as YYYY-MM-DD plus day-of-week (0 = Sunday). */
export function bangkokToday(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })
    .formatToParts(now).map((p) => [p.type, p.value]));
  const iso = `${parts.year}-${parts.month}-${parts.day}`;
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  return { iso, dow, day: Number(parts.day) };
}
const addDaysIso = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const prevMonth = (iso) => { const d = new Date(`${iso.slice(0, 7)}-01T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); };
const fmt = (iso) => { if (!iso) return '—'; const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`); return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }); };
const isDone = (t) => t.status === 'Done' || Number(t.percent_complete) >= 100;

async function safe(query) { try { const { data, error } = await query; return error ? [] : data || []; } catch { return []; } }

export async function loadData(sb, period) {
  const [projects, codes, members, links, profiles, tasks, milestones, issues, budget, monthly, mDeliv, pDeliv, rules, integrations, settings] = await Promise.all([
    safe(sb.from('projects').select('id,code,name,client,customer_abbreviation,status,start_date,end_date')),
    safe(sb.from('masters_code').select('code_type,code_value,label').eq('code_type', 'project_status')),
    safe(sb.from('members').select('project_id,name,nickname,thai_name,email,role,type')),
    safe(sb.from('project_members').select('project_id,user_id')),
    safe(sb.from('profiles').select('id,email,full_name,role,is_active,project_access_scope')),
    safe(sb.from('tasks').select('id,project_id,task_name,end_date,percent_complete,status,resource,parent_id')),
    safe(sb.from('milestones').select('project_id,name,due_date,status')),
    safe(sb.from('issues').select('project_id,title,status,assigned_to,issue_date')),
    safe(sb.from('budget_reports').select('project_id,period,status').eq('period', period)),
    safe(sb.from('monthly_reports').select('project_id,period,state').eq('period', period)),
    safe(sb.from('methodology_deliverables').select('id,name,active')),
    safe(sb.from('project_deliverables').select('*')), // task_id may not exist yet, so take every column
    safe(sb.from('notification_rules').select('*').order('sort_order')),
    safe(sb.from('project_integrations').select('project_id,teams_webhook_url')),
    safe(sb.from('app_settings').select('key,value')),
  ]);
  return { projects, codes, members, links, profiles, tasks, milestones, issues, budget, monthly, mDeliv, pDeliv, rules, integrations, settings };
}

/**
 * Today's messages. Email: one digest per rule per recipient (may cover several projects).
 * Teams: one card per rule per project, to the project's channel (or the global one).
 */
export function buildQueue(data, { today = bangkokToday(), projectIds = null, appUrl = '' } = {}) {
  const label = (p) => data.codes.find((c) => c.code_value === p.status)?.label || p.status || '';
  const finished = (p) => /hyper\s*care|close|complete|done|finish|cancel/i.test(`${p.status} ${label(p)}`);
  const projects = data.projects.filter((p) => !finished(p) && (!projectIds || projectIds.includes(p.id)));
  const rule = (id) => data.rules.find((r) => r.id === id && r.enabled);
  const period = prevMonth(today.iso);
  const membersOf = (pid) => data.members.filter((m) => m.project_id === pid);
  const pmEmails = (pid) => uniq(membersOf(pid).filter((m) => /project manager/i.test(m.role || '') && m.type !== 'client' && isEmail(m.email)).map((m) => norm(m.email)));
  const admins = uniq(data.profiles.filter((p) => p.role === 'admin' && p.is_active !== false && isEmail(p.email)).map((p) => norm(p.email)));
  const withAccess = (role, pid) => uniq(data.profiles.filter((u) => u.role === role && u.is_active !== false && isEmail(u.email) && (
    u.project_access_scope === 'all'
    || data.links.some((l) => l.project_id === pid && l.user_id === u.id)
    || membersOf(pid).some((m) => norm(m.email) === norm(u.email))
  )).map((u) => norm(u.email)));
  const ownerEmails = (t) => uniq(String(t.resource || '').split(/[,;/]/).map((s) => s.trim()).filter(Boolean).map((who) => {
    if (isEmail(who)) return norm(who);
    const m = membersOf(t.project_id).find((x) => [x.name, x.nickname, x.thai_name, x.email].some((v) => norm(v) && norm(v) === norm(who)));
    return m && isEmail(m.email) ? norm(m.email) : '';
  }));
  const projectTitle = (p) => `${p.code}${p.customer_abbreviation ? ` (${p.customer_abbreviation})` : ''}`;
  const link = (p) => (appUrl ? `${appUrl}/projects/${p.id}` : '');

  // items: { ruleId, project, to[], cc[], text, when }
  const items = [];
  const push = (ruleId, project, to, cc, text, when = '') => items.push({ ruleId, project, to: uniq(to), cc: uniq(cc).filter((c) => !to.includes(c)), text, when });
  const parents = new Set(data.tasks.map((t) => t.parent_id).filter(Boolean));

  for (const p of projects) {
    const tasks = data.tasks.filter((t) => t.project_id === p.id && !parents.has(t.id) && !isDone(t) && t.end_date);
    const pm = pmEmails(p.id);
    const r1 = rule('R1');
    if (r1) tasks.filter((t) => t.end_date >= today.iso && t.end_date <= addDaysIso(today.iso, r1.days ?? 3))
      .forEach((t) => push('R1', p, ownerEmails(t), [], t.task_name, `due ${fmt(t.end_date)}`));
    if (rule('R2')) tasks.filter((t) => t.end_date < today.iso)
      .forEach((t) => push('R2', p, ownerEmails(t).length ? ownerEmails(t) : pm, pm, t.task_name, `${daysBetween(t.end_date, today.iso)} days late (due ${fmt(t.end_date)})`));
    const r3 = rule('R3');
    if (r3) data.milestones.filter((m) => m.project_id === p.id && m.status !== 'paid' && m.due_date && m.due_date <= addDaysIso(today.iso, r3.days ?? 10))
      .forEach((m) => push('R3', p, pm, [], m.name, m.due_date < today.iso ? `past due (${fmt(m.due_date)}) · ${m.status}` : `due ${fmt(m.due_date)}`));
    const r4 = rule('R4');
    // A deliverable linked to a task is due when the task ends.
    const dueOf = (d) => (d.task_id && data.tasks.find((t) => t.id === d.task_id)?.end_date) || d.due_date;
    if (r4) data.pDeliv.filter((d) => d.project_id === p.id && dueOf(d) && !['signed', 'final', 'not_required'].includes(d.status) && dueOf(d) <= addDaysIso(today.iso, r4.days ?? 7))
      .forEach((d) => push('R4', p, pm, [], data.mDeliv.find((x) => x.id === d.deliverable_id)?.name || d.deliverable_id, dueOf(d) < today.iso ? `past due (${fmt(dueOf(d))})` : `due ${fmt(dueOf(d))}`));
    if (rule('R5')) data.issues.filter((i) => i.project_id === p.id && i.status === 'Blocked')
      .forEach((i) => push('R5', p, pm, [], i.title, i.assigned_to ? `owner: ${i.assigned_to}` : ''));
    const report = data.budget.find((b) => b.project_id === p.id);
    if (rule('R6') && today.day > 5 && (!report || ['draft', 'returned'].includes(report.status)))
      push('R6', p, pm, admins, `Budget Control ${period} not submitted`, `due 5th · ${today.day - 5} days late`);
    if (rule('R7') && report?.status === 'submitted') push('R7', p, withAccess('am', p.id), [], `Budget Control ${period} waiting for your review`, '');
    if (rule('R7') && report?.status === 'reviewed') push('R7', p, withAccess('director', p.id), [], `Budget Control ${period} waiting for your approval`, '');
    if (rule('R8') && today.day > 3 && !data.monthly.some((m) => m.project_id === p.id && m.state === 'published'))
      push('R8', p, pm, [], `One Page report for ${period} not published`, '');
    if (rule('R9') && today.dow === 5) push('R9', p, pm, [], 'Prepare and send this week\'s External Status Report', 'Summary › Weekly status (PPT)');
  }

  const messages = [];
  const ruleName = (id) => data.rules.find((r) => r.id === id)?.name || id;
  // Email digests
  for (const r of data.rules.filter((x) => x.enabled && x.email)) {
    const mine = items.filter((i) => i.ruleId === r.id);
    const recipients = uniq(mine.flatMap((i) => i.to));
    for (const to of recipients) {
      const list = mine.filter((i) => i.to.includes(to));
      messages.push({ key: `${r.id}|email|${to}`, ruleId: r.id, ruleName: r.name, channel: 'email', recipient: to,
        cc: uniq(list.flatMap((i) => i.cc)).filter((c) => c !== to), projectIds: uniq(list.map((i) => i.project.id)),
        subject: `[Project Tracking] ${r.name} · ${list.length} item${list.length > 1 ? 's' : ''}`, items: list.map((i) => ({ project: projectTitle(i.project), text: i.text, when: i.when, link: link(i.project) })) });
    }
    // items with nobody to email (no owner email, no PM) — shown in the queue so they can be fixed
    mine.filter((i) => !i.to.length).forEach((i) => messages.push({ key: `${r.id}|email|-|${i.project.id}|${i.text}`, ruleId: r.id, ruleName: r.name, channel: 'email', recipient: '',
      cc: [], projectIds: [i.project.id], subject: ruleName(r.id), items: [{ project: projectTitle(i.project), text: i.text, when: i.when, link: link(i.project) }], noRecipient: true }));
  }
  // Teams cards per project
  const globalHook = data.settings.find((s) => s.key === 'teams_webhook_url')?.value || '';
  for (const r of data.rules.filter((x) => x.enabled && x.teams)) {
    for (const p of projects) {
      const list = items.filter((i) => i.ruleId === r.id && i.project.id === p.id);
      if (!list.length) continue;
      const hook = data.integrations.find((x) => x.project_id === p.id)?.teams_webhook_url || globalHook;
      messages.push({ key: `${r.id}|teams|${p.id}`, ruleId: r.id, ruleName: r.name, channel: 'teams', recipient: hook ? `Teams · ${projectTitle(p)}` : '', webhook: hook,
        cc: [], projectIds: [p.id], subject: `${projectTitle(p)} · ${r.name}`, items: list.map((i) => ({ project: projectTitle(p), text: i.text, when: i.when, link: link(p) })), noRecipient: !hook });
    }
  }
  return messages;
}

function emailHtml(m) {
  const rows = m.items.map((i) => `<tr><td style="padding:6px 10px;border-bottom:1px solid #E2E8F0">${i.link ? `<a href="${esc(i.link)}" style="color:#4F46E5">${esc(i.project)}</a>` : esc(i.project)}</td><td style="padding:6px 10px;border-bottom:1px solid #E2E8F0">${esc(i.text)}</td><td style="padding:6px 10px;border-bottom:1px solid #E2E8F0;color:#475569">${esc(i.when)}</td></tr>`).join('');
  return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0F172A">
<h2 style="font-size:18px;margin:0 0 6px">${esc(m.ruleName)}</h2>
<p style="margin:0 0 14px;color:#475569">${m.items.length} item${m.items.length > 1 ? 's' : ''} need your attention.</p>
<table style="border-collapse:collapse;width:100%;max-width:760px"><thead><tr style="background:#13284C;color:#fff"><th align="left" style="padding:8px 10px">Project</th><th align="left" style="padding:8px 10px">Item</th><th align="left" style="padding:8px 10px">When</th></tr></thead><tbody>${rows}</tbody></table>
<p style="margin:16px 0 0;font-size:12px;color:#94A3B8">Sent by Project Tracking System notifications.</p></div>`;
}

function teamsCard(m) {
  return {
    type: 'message',
    attachments: [{
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: {
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json', type: 'AdaptiveCard', version: '1.4',
        body: [
          { type: 'TextBlock', text: m.subject, weight: 'Bolder', size: 'Medium', wrap: true },
          ...m.items.slice(0, 20).map((i) => ({ type: 'TextBlock', text: `• ${i.text}${i.when ? ` — ${i.when}` : ''}`, wrap: true, spacing: 'Small' })),
          ...(m.items.length > 20 ? [{ type: 'TextBlock', text: `… and ${m.items.length - 20} more`, isSubtle: true }] : []),
        ],
        actions: m.items[0]?.link ? [{ type: 'Action.OpenUrl', title: 'Open project', url: m.items[0].link }] : [],
      },
    }],
  };
}

/** Send messages; skip any already sent today (auto runs). Logs every attempt. */
export async function sendMessages(sb, messages, { trigger = 'auto', today = bangkokToday() } = {}) {
  const sentToday = trigger === 'auto'
    ? new Set((await safe(sb.from('notification_log').select('rule_id,channel,recipient').eq('sent_on', today.iso).eq('status', 'sent'))).map((l) => `${l.rule_id}|${l.channel}|${l.recipient}`))
    : new Set();
  let transporter = null;
  const results = [];
  for (const m of messages) {
    if (m.noRecipient) continue;
    const logKey = `${m.ruleId}|${m.channel}|${m.recipient}`;
    if (sentToday.has(logKey)) { results.push({ key: m.key, status: 'skipped', error: 'Already sent today' }); continue; }
    let status = 'sent';
    let error = '';
    try {
      if (m.channel === 'email') {
        if (!GMAIL_USER || !GMAIL_APP_PASSWORD) throw new Error('Email is not configured (GMAIL_USER / GMAIL_APP_PASSWORD)');
        transporter = transporter || nodemailer.createTransport({ service: 'gmail', auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD } });
        await transporter.sendMail({ from: EMAIL_FROM, to: m.recipient, cc: m.cc.length ? m.cc : undefined, subject: m.subject, html: emailHtml(m),
          text: m.items.map((i) => `${i.project}: ${i.text} ${i.when}`).join('\n') });
      } else {
        const response = await fetch(m.webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(teamsCard(m)) });
        if (!response.ok) throw new Error(`Teams returned HTTP ${response.status}`);
      }
    } catch (e) {
      status = 'failed';
      error = String(e?.message || e).slice(0, 500);
    }
    results.push({ key: m.key, status, error });
    await sb.from('notification_log').insert({
      rule_id: m.ruleId, project_id: m.projectIds.length === 1 ? m.projectIds[0] : null, channel: m.channel, recipient: m.recipient,
      subject: m.subject, item_count: m.items.length, status, error, trigger, sent_on: today.iso,
    });
  }
  return results;
}

export { teamsCard, emailHtml, prevMonth };
