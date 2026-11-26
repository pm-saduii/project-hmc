/**
 * Company Word documents generated from the official templates (the Implementation Hub's fillers,
 * served from /vendor/hub/*.js with the templates embedded):
 *   - Change Request Form v1.4
 *   - Project Deliverable Sign-off v1.3
 * Layout, fonts and checkboxes of each template are kept; only cells are written.
 */
import type { ChangeRequest, Member, Project } from '../types';
import { downloadBytes } from './xlsxPatch';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/* ── loading the fillers ─────────────────────────────────────────────────── */
type Filler = {
  fill?: (buf: Uint8Array, cr: unknown, ctx: unknown, JSZip: unknown) => Promise<{ generateAsync: (o: unknown) => Promise<Uint8Array> }>;
  fillSignoff?: (buf: Uint8Array, so: unknown, ctx: unknown, JSZip: unknown) => Promise<{ generateAsync: (o: unknown) => Promise<Uint8Array> }>;
};
declare global {
  interface Window { PSRCR?: Filler; PSRDOCS?: Filler; PSR_CR_TEMPLATE?: string; PSR_DOC_TPL?: Record<string, string> }
}
const loaded = new Map<string, Promise<void>>();
function loadScript(src: string): Promise<void> {
  if (!loaded.has(src)) {
    loaded.set(src, new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { loaded.delete(src); reject(new Error('The document template could not be loaded')); };
      document.head.appendChild(s);
    }));
  }
  return loaded.get(src)!;
}
const b64 = (s: string) => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i += 1) u[i] = bin.charCodeAt(i); return u; };
const utc = (iso?: string | null) => { if (!iso) return null; const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`); return Number.isNaN(d.getTime()) ? null : d.getTime(); };
const ymd = (iso?: string | null) => (iso || new Date().toISOString()).slice(0, 10).replace(/-/g, '');
const lines = (t?: string) => String(t || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

/* ── people on the forms, from the project's member list ─────────────────── */
export interface DocContacts { sponsorClient: string; sponsorHmc: string; pmClient: string; pmHmc: string; leadClient: string; leadHmc: string }
export function contactsFromMembers(members: Member[]): DocContacts {
  const pick = (role: RegExp, client: boolean) => members.find((m) => role.test(m.role || '') && (client ? m.type === 'client' : m.type !== 'client'))?.name || '';
  return {
    sponsorClient: pick(/sponsor/i, true), sponsorHmc: pick(/sponsor/i, false),
    pmClient: pick(/project manager/i, true), pmHmc: pick(/project manager/i, false),
    leadClient: pick(/project lead/i, true) || pick(/project manager/i, true), leadHmc: pick(/project lead/i, false) || pick(/project manager/i, false),
  };
}

/* ── Change Request Form v1.4 ────────────────────────────────────────────── */
export const CR_MODULES = ['Organization Master', 'Personnel', 'Payroll', 'Time & Attendance', 'Leave', 'Benefits', 'Recruitment', 'PMS', 'Merit', 'Training', 'Workflow', 'User Access', 'Integration'];
export const CR_MILESTONES: { name: string; pic: string }[] = [
  { name: 'Change Request Confirmation', pic: 'Client' },
  { name: 'Requirement Confirmation', pic: 'Client' },
  { name: 'Software Configuration', pic: 'HMC' },
  { name: 'Software Modification (design, develop, testing)', pic: 'HMC' },
  { name: 'Functional Test', pic: 'HMC' },
  { name: 'User Acceptance Test (HMC / Client)', pic: 'HMC / Client' },
  { name: 'Production Deployment: 21:00 – 24:00 (System Downtime)', pic: 'HMC' },
  { name: 'System go-live / Rollout', pic: 'HMC' },
];

/** Extra fields of the CR form (saved in change_requests.form). */
export interface CrForm {
  serviceType: 'Chargeable' | 'Non-chargeable';
  preparedBy: string;
  projectModel: string;
  expectedFinish: string;            // YYYY-MM-DD
  background: string;
  scope: string;
  requirement: string;
  risks: string;
  priority: 'Urgent' | 'Normal';
  remarks: string;
  modules: string[];
  moduleDetails: Record<string, string>;
  manday: { sa: number; dev: number; qa: number; imp: number };
  rate: number;
  payment: '' | 'Partial' | 'Advance';
  milestones: string[];              // planned finish per CR_MILESTONES ('' = N/A)
  assumptions: string;
  references: string;
}

export function defaultCrForm(cr: ChangeRequest & { items?: { detail: string; manday: number }[] }): CrForm {
  return {
    serviceType: 'Chargeable', preparedBy: '', projectModel: '', expectedFinish: '',
    background: cr.notes || '', scope: (cr.items || []).map((i) => i.detail).filter(Boolean).join('\n'), requirement: '', risks: '',
    priority: 'Normal', remarks: '', modules: [], moduleDetails: {},
    manday: { sa: 0, dev: 0, qa: 0, imp: Number(cr.totalManday) || 0 }, rate: 15000, payment: '',
    milestones: CR_MILESTONES.map(() => ''), assumptions: '', references: '',
  };
}

const STATUS_FOR_FORM: Record<string, string> = { Approved: 'Approved', Implemented: 'Completed', Close: 'Completed', Rejected: 'Rejected' };

export async function downloadCrForm(project: Project, cr: ChangeRequest, form: CrForm, contacts: DocContacts) {
  const [{ default: JSZip }] = await Promise.all([import('jszip'), loadScript('/vendor/hub/cr-docx.js')]);
  const filler = window.PSRCR;
  if (!filler?.fill || !window.PSR_CR_TEMPLATE) throw new Error('The CR template is not available');
  const md = { sa: Number(form.manday.sa) || 0, dev: Number(form.manday.dev) || 0, qa: Number(form.manday.qa) || 0, imp: Number(form.manday.imp) || 0 };
  const total = md.sa + md.dev + md.qa + md.imp;
  const model = {
    no: cr.crId, date: utc(cr.requestDate), finish: utc(form.expectedFinish), job: project.code, type: form.serviceType, prep: form.preparedBy,
    name: cr.title, bg: form.background, scope: form.scope, req: form.requirement, risks: form.risks, prio: form.priority, rem: form.remarks,
    status: STATUS_FOR_FORM[cr.status] || cr.status, dec: utc(cr.approvalDate),
    mods: form.modules, det: form.moduleDetails, rate: Number(form.rate) || 15000,
    md, total, cost: total ? total * (Number(form.rate) || 15000) - (Number(cr.discount) || 0) : null,
    ms: form.milestones.map((d) => utc(d)), asm: lines(form.assumptions), refs: lines(form.references),
    pay: form.payment === 'Advance' ? 'Paid in Advance' : form.payment === 'Partial' ? 'Partial Payment' : '',
  };
  const ctx = {
    lang: 'en', client: project.client || project.name, model: form.projectModel,
    sponsorC: contacts.sponsorClient, sponsorH: contacts.sponsorHmc, pmC: contacts.pmClient, pmH: contacts.pmHmc,
    MODULES: CR_MODULES, MS: CR_MILESTONES.map((m) => m.name), inScope: null,
  };
  const zip = await filler.fill(b64(window.PSR_CR_TEMPLATE), model, ctx, JSZip);
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', mimeType: DOCX });
  downloadBytes(bytes, `${ymd(cr.requestDate)} ${cr.crId || 'CR'} ${project.customerAbbreviation || project.code} Change Request Form.docx`, DOCX);
}

/* ── Project Deliverable Sign-off v1.3 ───────────────────────────────────── */
export interface Participant { name: string; title: string }
/** Extra fields of the sign-off form (saved in project_deliverables.form). */
export interface SignoffForm {
  documentNo: string;
  application: string;
  module: string;
  projectModel: string;
  place: string;
  phase: string;
  start: string;                     // YYYY-MM-DD
  end: string;
  description: string;
  deliverables: string;              // one per line
  clientParticipants: Participant[];
  hmcParticipants: Participant[];
}

export function defaultSignoffForm(project: Project, deliverableName: string, phaseName: string, members: Member[]): SignoffForm {
  const people = (client: boolean) => members.filter((m) => (client ? m.type === 'client' : m.type !== 'client'))
    .slice(0, 6).map((m) => ({ name: m.name, title: m.position || m.role || '' }));
  return {
    documentNo: '', application: project.softwareVersion || '', module: '', projectModel: '', place: '',
    phase: phaseName, start: project.startDate?.slice(0, 10) || '', end: '', description: deliverableName, deliverables: deliverableName,
    clientParticipants: people(true), hmcParticipants: people(false),
  };
}

export async function downloadSignoff(project: Project, deliverableName: string, form: SignoffForm, contacts: DocContacts, signedDate: string | null) {
  const [{ default: JSZip }] = await Promise.all([import('jszip'), loadScript('/vendor/hub/cr-docx.js')]);
  await loadScript('/vendor/hub/project-docs.js');
  const filler = window.PSRDOCS;
  const tpl = window.PSR_DOC_TPL?.signoff;
  if (!filler?.fillSignoff || !tpl) throw new Error('The sign-off template is not available');
  const so = {
    app: form.application, module: form.module, no: form.documentNo, place: form.place, start: utc(form.start), end: utc(form.end), phase: form.phase,
    desc: form.description, name: deliverableName, items: lines(form.deliverables),
    pc: form.clientParticipants.filter((p) => p.name.trim()), ph: form.hmcParticipants.filter((p) => p.name.trim()),
    status: signedDate ? 'Signed' : '', signed: utc(signedDate),
  };
  const ctx = {
    lang: 'en', tr: (v: string) => v, client: project.client || project.name, job: project.code, model: form.projectModel,
    leadC: contacts.leadClient, leadH: contacts.leadHmc, pmC: contacts.pmClient, pmH: contacts.pmHmc, sponsorC: contacts.sponsorClient, sponsorH: contacts.sponsorHmc,
  };
  const zip = await filler.fillSignoff(b64(tpl), so, ctx, JSZip);
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', mimeType: DOCX });
  downloadBytes(bytes, `${ymd(signedDate)} ${project.customerAbbreviation || project.code} ${deliverableName} Sign-off.docx`, DOCX);
}
