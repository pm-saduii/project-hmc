/**
 * Write cell values into an existing .xlsx without touching anything else (styles, formulas, dropdowns,
 * protection, pictures). Only the edited <c> elements change; the workbook recalculates on open.
 * Ported from the Implementation Hub's Excel writer.
 *
 *   patchXlsx(templateBytes, [{ sheet: 'Clients', row: 13, cells: { 3: 12.5, 4: { date: ms }, 5: null } }])
 */
export type CellValue = string | number | { date: number } | null;
export interface RowEdit { sheet: string; row: number; cells: Record<number, CellValue> }

export const colName = (n: number): string => {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
};
const colNum = (s: string) => [...s].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
const serial = (ms: number) => ms / 86400000 + 25569;

function cellXml(ref: string, style: string | null, v: CellValue): string {
  const st = style ? ` s="${style}"` : '';
  if (v == null || v === '') return `<c r="${ref}"${st}/>`;
  if (typeof v === 'object') return `<c r="${ref}"${st}><v>${serial(v.date)}</v></c>`;
  if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${st}><v>${v}</v></c>`;
  return `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
}

function patchRow(rowXml: string, rowNo: number, cells: Record<number, CellValue>): string {
  const open = /^<row\b[^>]*?(\/?)>/.exec(rowXml)!;
  const selfClosed = open[1] === '/';
  const head = open[0].replace(/\/>$/, '>');
  const body = selfClosed ? '' : rowXml.slice(open[0].length, rowXml.length - 6);
  const list: { col: number; xml: string }[] = [];
  const re = /<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) { const r = /\br="([A-Z]+)\d+"/.exec(m[0]); list.push({ col: r ? colNum(r[1]) : 0, xml: m[0] }); }
  Object.keys(cells).forEach((k) => {
    const c = Number(k);
    const ref = colName(c) + rowNo;
    const existing = list.find((q) => q.col === c);
    let style = existing ? (/\bs="(\d+)"/.exec(existing.xml) || [])[1] || null : null;
    if (!style) { const near = list.filter((q) => q.col < c).pop(); style = near ? (/\bs="(\d+)"/.exec(near.xml) || [])[1] || null : null; }
    const xml = cellXml(ref, style, cells[c]);
    if (existing) existing.xml = xml; else list.push({ col: c, xml });
  });
  list.sort((a, b) => a.col - b.col);
  return head.replace(/\sspans="[^"]*"/, '') + list.map((q) => q.xml).join('') + '</row>';
}

export async function patchXlsx(template: ArrayBuffer | Uint8Array, edits: RowEdit[]): Promise<Uint8Array> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(template);
  const workbook = await zip.file('xl/workbook.xml')!.async('string');
  const rels = await zip.file('xl/_rels/workbook.xml.rels')!.async('string');
  const sheetPath = (name: string) => {
    const re = /<(?:\w+:)?sheet\b[^>]*>/g;
    let m: RegExpExecArray | null;
    let rid: string | null = null;
    while ((m = re.exec(workbook))) {
      const nm = /\bname="([^"]*)"/.exec(m[0]);
      if (nm && nm[1].replace(/&amp;/g, '&') === name) { rid = (/\br:id="([^"]*)"/.exec(m[0]) || /\bid="([^"]*)"/.exec(m[0]))?.[1] || null; break; }
    }
    if (!rid) throw new Error(`Sheet "${name}" not found in the template`);
    const rel = new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*>`).exec(rels);
    const target = rel && /Target="([^"]*)"/.exec(rel[0])?.[1];
    if (!target) throw new Error(`File of sheet "${name}" not found`);
    return target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`;
  };

  const bySheet = new Map<string, RowEdit[]>();
  edits.forEach((e) => bySheet.set(e.sheet, [...(bySheet.get(e.sheet) || []), e]));
  for (const [name, list] of bySheet) {
    const path = sheetPath(name);
    let xml = await zip.file(path)!.async('string');
    list.forEach((e) => {
      const m = new RegExp(`<row\\b[^>]*\\br="${e.row}"[^>]*?(?:/>|>[\\s\\S]*?</row>)`).exec(xml);
      if (m) { xml = xml.slice(0, m.index) + patchRow(m[0], e.row, e.cells) + xml.slice(m.index + m[0].length); return; }
      const nr = patchRow(`<row r="${e.row}"/>`, e.row, e.cells);
      const rs = /<row\b[^>]*\br="(\d+)"/g;
      let mm: RegExpExecArray | null;
      let at = -1;
      while ((mm = rs.exec(xml))) if (Number(mm[1]) > e.row) { at = mm.index; break; }
      if (at < 0) at = xml.indexOf('</sheetData>');
      xml = at < 0 ? xml.replace(/<sheetData\s*\/>/, `<sheetData>${nr}</sheetData>`) : xml.slice(0, at) + nr + xml.slice(at);
    });
    const dm = /<dimension ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/.exec(xml);
    const maxRow = Math.max(...list.map((e) => e.row));
    if (dm && Number(dm[4]) < maxRow) xml = xml.replace(dm[0], `<dimension ref="${dm[1]}${dm[2]}:${dm[3]}${maxRow}"/>`);
    zip.file(path, xml);
  }
  let wb = workbook;
  if (/<calcPr\b/.test(wb)) { if (!/fullCalcOnLoad=/.test(wb)) wb = wb.replace(/<calcPr\b/, '<calcPr fullCalcOnLoad="1"'); }
  else wb = wb.replace('</workbook>', '<calcPr fullCalcOnLoad="1"/></workbook>');
  zip.file('xl/workbook.xml', wb);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

export function downloadBytes(bytes: Uint8Array, fileName: string, type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
  const url = URL.createObjectURL(new Blob([bytes as unknown as BlobPart], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click();
  window.setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 800);
}
