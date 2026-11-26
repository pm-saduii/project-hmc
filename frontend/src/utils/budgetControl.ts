/**
 * Monthly Budget Control: man-day budget vs. man-days used, per the company template
 * (public/templates/budget-control-template.xlsx, sheet "Clients").
 * The figures come from the project's Effort lines (budget man-days + man-days per month).
 */
import { addMonths, endOfMonth, format, isValid, parseISO, startOfMonth } from 'date-fns';
import type { Effort, Project } from '../types';
import { patchXlsx, downloadBytes, type RowEdit } from './xlsxPatch';

/** Standard budget lines and their row in the template. */
export const STANDARD_LINES: { code: string; name: string; group: string; row: number }[] = [
  { code: '1.1', name: '1.1 Kickoff Meeting', group: '1. Project Management', row: 13 },
  { code: '1.2', name: '1.2 Project Meeting', group: '1. Project Management', row: 14 },
  { code: '1.3', name: '1.3 Project Document (Minute, Progress status, Issue Log, Change Request)', group: '1. Project Management', row: 15 },
  { code: '2.1', name: '2.1 Requirement Assessment', group: '2. Implementation & Consults', row: 17 },
  { code: '2.2', name: '2.2 Analysis & Design (BBP)', group: '2. Implementation & Consults', row: 18 },
  { code: '2.3', name: '2.3 System Configuration', group: '2. Implementation & Consults', row: 19 },
  { code: '2.4', name: '2.4 Customization', group: '2. Implementation & Consults', row: 20 },
  { code: '2.5', name: '2.5 User Acceptance Test (UAT)', group: '2. Implementation & Consults', row: 21 },
  { code: '2.6', name: '2.6 Support Parallel & Golive', group: '2. Implementation & Consults', row: 22 },
  { code: '3.1', name: '3.1 Migration Template Training', group: '3. Data Conversion', row: 24 },
  { code: '3.2', name: '3.2 Migration data on Test base', group: '3. Data Conversion', row: 25 },
  { code: '3.3', name: '3.3 Migration data on Production base', group: '3. Data Conversion', row: 26 },
  { code: '4.1', name: '4.1 HR Training', group: '4. Training', row: 28 },
  { code: '4.2', name: '4.2 ESS Training', group: '4. Training', row: 29 },
];
const MONTH_COLUMNS = 12;   // template columns D..O
const FIRST_MONTH_COL = 4;

/** The standard line an Effort module belongs to: by its leading code ("2.3 …") or by its exact name. */
export function standardLineOf(module: string) {
  const text = String(module || '').trim();
  const code = /^(\d+\.\d+)\b/.exec(text)?.[1];
  return STANDARD_LINES.find((l) => (code && l.code === code) || l.name.toLowerCase() === text.toLowerCase()) || null;
}

/**
 * Effort lines that count for reporting. Once any standard line has a budget or man-days,
 * only standard lines count — older free-form lines are being copied into them and would
 * otherwise be counted twice. Before that, every line counts.
 */
export function reportedEfforts<T extends Pick<Effort, 'module' | 'budgetManday' | 'monthly'>>(efforts: T[]): T[] {
  const standard = efforts.filter((e) => standardLineOf(e.module));
  const inUse = standard.some((e) => Number(e.budgetManday) > 0 || Object.values(e.monthly || {}).some((v) => Number(v) > 0));
  return inUse ? standard : efforts;
}

export interface BudgetLine { module: string; code: string | null; budget: number; used: Record<string, number> }
export interface BudgetSnapshot {
  version: 1;
  period: string;                // YYYY-MM reported
  months: string[];              // 12-month window shown / exported
  lines: BudgetLine[];
  budget: number;
  usedToDate: number;
  usedInMonth: number;
  progress: number;              // actual % complete when taken
  takenAt: string;
}

const round = (n: number) => Math.round(n * 100) / 100;
const toDate = (v?: string) => { if (!v) return null; const d = parseISO(v); return isValid(d) ? d : null; };

export const periodLabel = (period: string) => format(parseISO(`${period}-01`), 'MMMM yyyy');
export const shiftPeriod = (period: string, n: number) => format(addMonths(parseISO(`${period}-01`), n), 'yyyy-MM');
/** The report for a month is due on the 5th of the next month. */
export const dueDateOf = (period: string) => new Date(addMonths(parseISO(`${period}-01`), 1).getFullYear(), addMonths(parseISO(`${period}-01`), 1).getMonth(), 5);
/** Last finished month: the one whose report is being prepared now. */
export const defaultPeriod = (today = new Date()) => format(addMonths(startOfMonth(today), -1), 'yyyy-MM');

/** 12 months from the project start, moved forward so the reported month is included. */
export function monthWindow(project: Pick<Project, 'startDate'>, period: string): string[] {
  const start = toDate(project.startDate);
  let first = start ? startOfMonth(start) : addMonths(parseISO(`${period}-01`), -(MONTH_COLUMNS - 1));
  const last = parseISO(`${period}-01`);
  while (addMonths(first, MONTH_COLUMNS - 1) < last) first = addMonths(first, 1);
  return Array.from({ length: MONTH_COLUMNS }, (_, i) => format(addMonths(first, i), 'yyyy-MM'));
}

export function buildBudgetSnapshot(project: Project, efforts: Effort[], period: string, progress: number): BudgetSnapshot {
  const months = monthWindow(project, period);
  const lines: BudgetLine[] = reportedEfforts(efforts).map((e) => {
    const used: Record<string, number> = {};
    Object.entries(e.monthly || {}).forEach(([m, v]) => { if (m <= period && Number(v)) used[m] = round(Number(v)); });
    return { module: e.module, code: standardLineOf(e.module)?.code || null, budget: round(Number(e.budgetManday) || 0), used };
  }).sort((a, b) => (a.code || '9').localeCompare(b.code || '9', undefined, { numeric: true }) || a.module.localeCompare(b.module));
  const sum = (f: (l: BudgetLine) => number) => round(lines.reduce((s, l) => s + f(l), 0));
  return {
    version: 1, period, months, lines,
    budget: sum((l) => l.budget),
    usedToDate: sum((l) => Object.values(l.used).reduce((a, v) => a + v, 0)),
    usedInMonth: sum((l) => l.used[period] || 0),
    progress: Math.round(progress),
    takenAt: new Date().toISOString(),
  };
}

export const usedToDate = (l: BudgetLine) => round(Object.values(l.used).reduce((a, v) => a + v, 0));

/** Fill the company template and download it. Lines that are not standard lines are not in the template. */
export async function exportBudgetXlsx(args: {
  snapshot: BudgetSnapshot; project: Project; pmName: string; reviewedName: string; approvedName: string;
}): Promise<{ skipped: string[] }> {
  const { snapshot: s, project } = args;
  const response = await fetch('/templates/budget-control-template.xlsx');
  if (!response.ok) throw new Error('The Budget Control template could not be loaded');
  const template = await response.arrayBuffer();
  const ms = (d: Date | null) => (d ? { date: Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) } : null);
  const edits: RowEdit[] = [];
  const row = (r: number, cells: RowEdit['cells']) => edits.push({ sheet: 'Clients', row: r, cells });

  row(5, { 3: project.client || project.name, 11: project.code });
  row(6, { 3: project.softwareVersion || project.name, 11: args.pmName });
  row(7, { 3: ms(endOfMonth(parseISO(`${s.period}-01`))), 11: ms(toDate(project.startDate)) });
  row(8, { 3: ms(toDate(project.startDate)), 11: ms(toDate(project.endDate)) });
  row(11, Object.fromEntries(s.months.map((m, i) => [FIRST_MONTH_COL + i, ms(parseISO(`${m}-01`))])));

  const skipped: string[] = [];
  const byRow = new Map<number, { budget: number; used: Record<string, number> }>();
  s.lines.forEach((l) => {
    const std = l.code ? STANDARD_LINES.find((x) => x.code === l.code) : null;
    if (!std) { if (l.budget || usedToDate(l)) skipped.push(l.module); return; }
    const acc = byRow.get(std.row) || { budget: 0, used: {} };
    acc.budget += l.budget;
    Object.entries(l.used).forEach(([m, v]) => { acc.used[m] = (acc.used[m] || 0) + v; });
    byRow.set(std.row, acc);
  });
  STANDARD_LINES.forEach((std) => {
    const acc = byRow.get(std.row);
    const cells: RowEdit['cells'] = { 3: acc ? round(acc.budget) : null };
    s.months.forEach((m, i) => { const v = acc?.used[m]; cells[FIRST_MONTH_COL + i] = m <= s.period && v ? round(v) : null; });
    row(std.row, cells);
  });
  row(41, { 2: args.pmName || null, 4: args.approvedName || null, 10: args.reviewedName || null });

  const bytes = await patchXlsx(template, edits);
  downloadBytes(bytes, `Project Budget control report ${project.code || project.name} ${s.period.replace('-', '')}.xlsx`);
  return { skipped };
}

/**
 * PDF of the report in the layout of the company template: project details, one row per budget
 * line with man-days used per month, totals, accumulated use against progress, and the three sign-offs.
 */
export interface BudgetPdfArgs {
  snapshot: BudgetSnapshot; project: Project; pmName: string; status: string;
  preparedAt: string | null;
  /** Project Manager signature from Members (PNG data URL). */
  pmSignature?: string;
  /** Project Advisor from Members ("Reviewed / Approved By"); no signature. */
  advisorName?: string;
}

/** One project's report as a PDF. */
export async function exportBudgetPdf(args: BudgetPdfArgs): Promise<void> {
  await exportBudgetPdfs([args], `Project Budget control report ${args.project.code || args.project.name} ${args.snapshot.period.replace('-', '')}.pdf`);
}

/** Several projects' reports in one PDF, each project starting on a new page. */
export async function exportBudgetPdfs(list: BudgetPdfArgs[], fileName?: string): Promise<void> {
  if (!list.length) return;
  const [{ default: JsPDF }, { default: autoTable }, { ensurePoppinsFont, hasThai }] = await Promise.all([
    import('jspdf'), import('jspdf-autotable'), import('./pdfFont'),
  ]);
  const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  // Poppins like the app; Sarabun only for text with Thai letters (Poppins has none).
  const fonts = await ensurePoppinsFont(doc);
  const W = doc.internal.pageSize.getWidth();
  const generated = format(new Date(), 'dd/MM/yyyy HH:mm');
  list.forEach((args, i) => {
    if (i > 0) doc.addPage();
    const first = doc.getNumberOfPages();
    (doc as unknown as { lastAutoTable?: unknown }).lastAutoTable = undefined;
    drawBudgetReport(doc, autoTable as never, fonts, hasThai, args);
    // Footer numbered within each project
    const last = doc.getNumberOfPages();
    for (let p = first; p <= last; p += 1) {
      doc.setPage(p); doc.setFont(fonts.latin, 'normal'); doc.setFontSize(7.5); doc.setTextColor(148, 163, 184);
      doc.text(`${args.project.code || args.project.name} · Generated ${generated} · Page ${p - first + 1} of ${last - first + 1}`, W - 12, doc.internal.pageSize.getHeight() - 6, { align: 'right' });
    }
    doc.setPage(last);
  });
  doc.save(fileName || `Project Budget control report ${list[0].snapshot.period.replace('-', '')} (${list.length} projects).pdf`);
}

function drawBudgetReport(
  doc: import('jspdf').jsPDF,
  autoTable: (d: import('jspdf').jsPDF, o: Record<string, unknown>) => void,
  fonts: { latin: string; thai: string; fontFor: (t: unknown) => string },
  hasThai: (t: unknown) => boolean,
  args: BudgetPdfArgs,
): void {
  const { snapshot: s, project } = args;
  const { latin: font, thai: thaiFont, fontFor } = fonts;
  const thaiCells = (data: { cell: { text: string[]; styles: { font?: string } } }) => { if (hasThai(data.cell.text.join(' '))) data.cell.styles.font = thaiFont; };
  const W = doc.internal.pageSize.getWidth();
  const navy: [number, number, number] = [19, 40, 76];
  const d = (v?: string | null) => { const x = toDate(v || undefined); return x ? format(x, 'dd/MM/yyyy') : '—'; };
  const n = (v: number) => (v ? String(Math.round(v * 100) / 100) : '');

  // Title and project details
  doc.setFont(font, 'bold'); doc.setFontSize(14); doc.setTextColor(...navy);
  doc.text('Project Budget Control Report', 12, 14);
  doc.setFont(font, 'normal'); doc.setFontSize(9); doc.setTextColor(90, 90, 90);
  // Customer logo (top right, fitted into 46 × 14 mm); the period and status sit under the title.
  let logoDrawn = false;
  if (project.logo && project.logo.startsWith('data:image/')) {
    try {
      const props = doc.getImageProperties(project.logo);
      const scale = Math.min(46 / props.width, 14 / props.height);
      const w = props.width * scale; const h = props.height * scale;
      doc.addImage(project.logo, 'PNG', W - 12 - w, 6 + (14 - h) / 2, w, h);
      logoDrawn = true;
    } catch { /* unreadable image: leave it out */ }
  }
  doc.text(`${periodLabel(s.period)} · Status: ${args.status}`, logoDrawn ? 12 : W - 12, logoDrawn ? 19 : 14, { align: logoDrawn ? 'left' : 'right' });
  const info: [string, string, string, string][] = [
    ['Client (Company Name)', project.client || project.name, 'Job Code', project.code || '—'],
    ['Application / Module', project.softwareVersion || project.name, 'Project Manager', args.pmName || '—'],
    ['Date as of', d(format(endOfMonth(parseISO(`${s.period}-01`)), 'yyyy-MM-dd')), 'Budget Created Date', d(project.startDate)],
    ['Project Started Date', d(project.startDate), 'Plan End Date', d(project.endDate)],
  ];
  autoTable(doc, {
    startY: logoDrawn ? 22 : 18, theme: 'plain', margin: { left: 12, right: 12 }, didParseCell: thaiCells,
    styles: { font, fontSize: 8, cellPadding: 0.7, textColor: [30, 41, 59] },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 42 }, 1: { cellWidth: 95 }, 2: { fontStyle: 'bold', cellWidth: 38 } },
    body: info,
  });

  // Lines grouped like the template; non-template lines under "Other".
  const months = s.months;
  const head = [['Stage / Phase · Activity', 'Budget (MD)', ...months.map((m) => format(parseISO(`${m}-01`), 'MMM yy')), 'Sum', 'Balance']];
  const body: (string | { content: string; colSpan?: number; styles?: Record<string, unknown> })[][] = [];
  const lineRow = (label: string, budget: number, used: Record<string, number>) => {
    const total = Object.entries(used).filter(([m]) => m <= s.period).reduce((a, [, v]) => a + v, 0);
    return [label, n(budget), ...months.map((m) => (m <= s.period ? n(used[m] || 0) : '')), n(total) || '0', n(budget - total) || '0'];
  };
  const groups = [...new Set(STANDARD_LINES.map((l) => l.group))];
  groups.forEach((g) => {
    body.push([{ content: g, colSpan: months.length + 4, styles: { fontStyle: 'bold', fillColor: [226, 232, 240] } }]);
    STANDARD_LINES.filter((l) => l.group === g).forEach((std) => {
      const matched = s.lines.filter((l) => l.code === std.code);
      const used: Record<string, number> = {};
      matched.forEach((l) => Object.entries(l.used).forEach(([m, v]) => { used[m] = (used[m] || 0) + v; }));
      body.push(lineRow(std.name, matched.reduce((a, l) => a + l.budget, 0), used));
    });
  });
  const others = s.lines.filter((l) => !l.code);
  if (others.length) {
    body.push([{ content: 'Other', colSpan: months.length + 4, styles: { fontStyle: 'bold', fillColor: [226, 232, 240] } }]);
    others.forEach((l) => body.push(lineRow(l.module, l.budget, l.used)));
  }
  // Totals, accumulated man-days and accumulated % of budget
  const monthTotal = (m: string) => s.lines.reduce((a, l) => a + (l.used[m] || 0), 0);
  let acc = 0;
  const accRow = months.map((m) => { if (m > s.period) return ''; acc += monthTotal(m); return n(acc) || '0'; });
  const pctRow = accRow.map((v) => (v === '' || !s.budget ? '' : `${Math.round((Number(v) / s.budget) * 100)}%`));
  const bold = { fontStyle: 'bold', fillColor: [241, 245, 249] };
  body.push([{ content: 'TOTAL MAN-DAY', styles: bold }, { content: n(s.budget), styles: bold },
    ...months.map((m) => ({ content: m <= s.period ? n(monthTotal(m)) || '0' : '', styles: bold })),
    { content: n(s.usedToDate) || '0', styles: bold }, { content: n(s.budget - s.usedToDate) || '0', styles: bold }]);
  body.push(['ACCUMULATED MAN-DAY', '', ...accRow, '', '']);
  body.push([`% ACCUMULATED OF BUDGET (progress ${s.progress}%)`, '', ...pctRow, '', '']);

  autoTable(doc, {
    startY: ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 40) + 3,
    margin: { left: 12, right: 12 },
    head, body: body as never,
    styles: { font, fontSize: 7, cellPadding: 0.8, lineColor: [203, 213, 225], lineWidth: 0.1, textColor: [30, 41, 59], halign: 'right' },
    headStyles: { font, fontStyle: 'bold', fillColor: navy, textColor: 255, halign: 'center' },
    columnStyles: { 0: { halign: 'left', cellWidth: 82 } },
    theme: 'grid',
    didParseCell: thaiCells,
  });

  // Sign-offs: Prepared By (Project Manager, with signature) · Reviewed / Approved By (Project Advisor) ·
  // Reviewed By (Account Manager, name left blank to fill in by hand).
  const BH = 34;
  let y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 150) + 5;
  if (y > doc.internal.pageSize.getHeight() - BH - 10) { doc.addPage(); y = 20; }
  const boxes: { title: string; role: string; name: string; signature?: string; date: string | null }[] = [
    { title: 'Prepared By', role: 'Project Manager', name: args.pmName, signature: args.pmSignature, date: args.preparedAt },
    { title: 'Reviewed / Approved By', role: 'Project Advisor', name: args.advisorName || '', date: null },
    { title: 'Reviewed By', role: 'Account Manager', name: '', date: null },
  ];
  const bw = (W - 24 - 16) / 3;
  boxes.forEach((b, i) => {
    const x = 12 + i * (bw + 8);
    const cx = x + bw / 2;
    doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.2); doc.roundedRect(x, y, bw, BH, 2, 2);
    doc.setFont(font, 'bold'); doc.setFontSize(8.5); doc.setTextColor(...navy); doc.text(b.title, x + 4, y + 6);
    // Signature area (image fitted into 50 × 12 mm) above a signing line
    if (b.signature && b.signature.startsWith('data:image/')) {
      try {
        const p = doc.getImageProperties(b.signature);
        const k = Math.min(50 / p.width, 12 / p.height);
        const w = p.width * k; const h = p.height * k;
        doc.addImage(b.signature, 'PNG', cx - w / 2, y + 20 - h, w, h);
      } catch { /* unreadable image: leave the line empty */ }
    }
    doc.setDrawColor(148, 163, 184); doc.setLineWidth(0.15); doc.line(cx - 30, y + 21, cx + 30, y + 21);
    const name = b.name.trim();
    doc.setFont(fontFor(name), 'normal'); doc.setFontSize(9.5); doc.setTextColor(30, 41, 59);
    doc.text(name ? `( ${name} )` : '( ...................................................... )', cx, y + 26, { align: 'center' });
    doc.setFont(font, 'normal'); doc.setFontSize(8); doc.setTextColor(100, 116, 139);
    doc.text(`${b.role} · Date ${b.date ? format(new Date(b.date), 'dd/MM/yyyy') : '____/____/______'}`, cx, y + 31, { align: 'center' });
  });

}
