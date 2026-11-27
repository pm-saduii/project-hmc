/* Project Status Report – PowerPoint export (editable, native shapes / tables / text).
   Browser: PSRPPTX.download(model, mode)  ·  Node: require("./pptx-export.js").build(model, mode, PptxGenJS)
   Fonts: theme = Poppins (latin) + Kanit (Thai, complex-script slot) – patched into the theme after writing. */
(function (root) {
  "use strict";
  var W = 13.333, H = 7.5;                                     // LAYOUT_WIDE
  var THEME = { name: "Project Status", colors: {
    dk1: "14233A", lt1: "FFFFFF", dk2: "0F2A4A", lt2: "EEF3F9", accent1: "1B4F8F", accent2: "2F6FDE",
    accent3: "2E9E6B", accent4: "E0A100", accent5: "D64545", accent6: "F6B26B", hlink: "2F6FDE", folHlink: "5B6B82" } };
  var K_ = { navy: "0F2A4A", navy2: "1B4F8F", blue: "2F6FDE", sky: "E3ECF8", bg: "EEF3F9", ink: "14233A", mut: "5B6B82", soft: "8796AB",
    line: "DBE3EE", white: "FFFFFF", slate: "475569", ok: "2E9E6B", risk: "E0A100", late: "D64545", ns: "94A3B8", client: "F6B26B", hmc: "3B74D9", joint: "94A3B8" };
  var SC = { "Completed": K_.blue, "On Track": K_.ok, "At Risk": K_.risk, "Delayed": K_.late, "Not Started": K_.ns };
  var SC_DARK = { "Completed": "1D4FB8", "On Track": "17734A", "At Risk": "B07800", "Delayed": "A92D2D", "Not Started": "64748B" };
  var BC = { "Paid": K_.blue, "Invoiced": K_.ok, "Ready to Invoice": K_.risk, "Overdue": K_.late, "Milestone Delayed": K_.late, "Pending Milestone": K_.ns };

  function cut(t, n) { t = String(t == null ? "" : t); return t.length > n ? t.slice(0, n - 1) + "…" : t; }
  function owC(cls) { return cls === "ow-h" ? K_.hmc : cls === "ow-c" ? K_.client : K_.joint; }

  function build(M, mode, PptxGenJS, H_) {
    var h = H_, P = M.P, internal = mode === "internal";
    var pres = localize(new PptxGenJS(), h);
    pres.layout = "LAYOUT_WIDE";
    pres.theme = { headFontFace: "Poppins", bodyFontFace: "Poppins" };
    pres.title = (P.short || "Project") + " – " + (P.title || "Status Update");
    pres.author = P.lead || P.vendor || "";
    pres.company = String(P.vendor || "").replace(/&/g, "&amp;");

    // ---------- layouts (editable frames; new slides can be added on these)
    var foot = function (objs) {
      objs.push({ text: { text: (P.vendor || "") + (internal ? " · Internal use only" : " · Confidential"), options: { x: 0.5, y: H - 0.42, w: 6, h: 0.3, fontSize: 9, color: K_.soft, margin: 0 } } });
      return objs;
    };
    pres.defineSlideMaster({ title: "PSR Cover", background: { color: K_.navy },
      objects: [
        /humanica/i.test(P.vendor || "HUMANICA") ? { image: { x: 0.7, y: 0.75, w: 0.34 * h.BRAND.hratio, h: 0.34, data: h.BRAND.hw.replace(/^data:/, "") } }
          : { text: { text: (P.vendor || "").toUpperCase(), options: { x: 0.7, y: 0.75, w: 6, h: 0.35, fontSize: 12, bold: true, color: "8FB4E8", charSpacing: 6, margin: 0 } } },
        { placeholder: { options: { name: "title", type: "title", x: 0.7, y: 2.6, w: 11.5, h: 1.05, fontSize: 40, bold: true, color: K_.white, align: "left", valign: "bottom", margin: 0 }, text: "Project Progress Status" } },
        { placeholder: { options: { name: "body", type: "body", x: 0.7, y: 3.75, w: 11.5, h: 0.95, fontSize: 18, color: "B9CBE4", align: "left", valign: "top", margin: 0 }, text: "Client · Update · Date" } }
      ] });
    var HW = 0.24 * h.BRAND.hratio;   // HUMANICA logo width in the header band
    var TX = 0.5 + HW + 0.4;          // title and subtitle start after the logo and the divider
    pres.defineSlideMaster({ title: "PSR Content", background: { color: K_.bg },
      objects: foot([
        { rect: { x: 0, y: 0, w: W, h: 1.05, fill: { color: K_.navy } } },
        /humanica/i.test(P.vendor || "HUMANICA") ? { image: { x: 0.5, y: 0.405, w: HW, h: 0.24, data: h.BRAND.hw.replace(/^data:/, "") } }
          : { text: { text: (P.vendor || "").toUpperCase(), options: { x: 0.5, y: 0.37, w: HW, h: 0.3, fontSize: 11, bold: true, color: "8FB4E8", charSpacing: 4, margin: 0 } } },
        { line: { x: 0.5 + HW + 0.2, y: 0.25, w: 0, h: 0.55, line: { color: "4A6A92", width: 0.75 } } },
        { placeholder: { options: { name: "title", type: "title", x: TX, y: 0.14, w: W - 0.5 - 2.2 - TX, h: 0.58, fontSize: 26, bold: true, color: K_.white, align: "left", valign: "middle", margin: 0 }, text: "Slide title" } },
        { placeholder: { options: { name: "sub", type: "body", x: TX, y: 0.68, w: W - 0.5 - 2.2 - TX - 3.0, h: 0.28, fontSize: 11, color: "B9CBE4", align: "left", valign: "middle", margin: 0 }, text: "Project · Report · Date" } }
      ]), slideNumber: { x: W - 1.0, y: H - 0.42, w: 0.5, h: 0.3, fontSize: 9, color: K_.mut, align: "right" } });
    pres.defineSlideMaster({ title: "PSR Text", background: { color: K_.bg },
      objects: foot([
        { rect: { x: 0, y: 0, w: W, h: 1.05, fill: { color: K_.navy } } },
        { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.14, w: 8.4, h: 0.58, fontSize: 26, bold: true, color: K_.white, align: "left", valign: "middle", margin: 0 }, text: "Slide title" } },
        { placeholder: { options: { name: "sub", type: "body", x: 0.5, y: 0.68, w: 8.4, h: 0.28, fontSize: 11, color: "B9CBE4", align: "left", valign: "middle", margin: 0 }, text: "Subtitle" } },
        { placeholder: { options: { name: "body", type: "body", x: 0.5, y: 1.35, w: W - 1.0, h: 5.5, fontSize: 16, color: K_.ink, align: "left", valign: "top", margin: 0.1 }, text: "Text" } }
      ]), slideNumber: { x: W - 1.0, y: H - 0.42, w: 0.5, h: 0.3, fontSize: 9, color: K_.mut, align: "right" } });

    var subline = (P.client || P.name || "Project") + "  |  Update · " + h.fmtD(P.rd);
    var hasLogo = !!(P.logo && /^data:image\//.test(P.logo));
    function content(title, section) {
      var s = pres.addSlide({ masterName: "PSR Content", sectionTitle: section });
      s.addText(title, { placeholder: "title" });
      s.addText(subline, { placeholder: "sub" });
      // top right: client logo (white box) and the Project Manager under it
      if (hasLogo) {
        var lx = W - 0.5 - 1.6;
        s.addShape(pres.ShapeType.roundRect, { x: lx, y: 0.08, w: 1.6, h: 0.56, rectRadius: 0.06, fill: { color: K_.white }, line: { type: "none" }, objectName: "Logo box" });
        s.addImage({ data: P.logo.replace(/^data:/, ""), x: lx + 0.08, y: 0.12, w: 1.44, h: 0.48, sizing: { type: "contain", w: 1.44, h: 0.48 }, altText: P.client || "Client logo" });
      }
      s.addText([{ text: "Project Manager: ", options: { color: "B9CBE4" } }, { text: P.lead || "–", options: { color: K_.white } }],
        { x: W - 0.5 - 5.0, y: 0.72, w: 5.0, h: 0.26, fontSize: 10, align: "right", valign: "middle", margin: 0, isTextBox: true, objectName: "Project manager" });
      if (internal) s.addText("INTERNAL", { shape: pres.ShapeType.roundRect, rectRadius: 0.15, x: W - 0.5 - 1.6 - 1.45, y: 0.2, w: 1.3, h: 0.32, fontSize: 9, bold: true, charSpacing: 2,
        color: K_.white, align: "center", valign: "middle", fill: { color: K_.late }, line: { color: K_.late, width: 0.75 }, margin: 0, objectName: "Badge" });
      return s;
    }
    function card(s, x, y, w, hh, name) {
      s.addShape(pres.ShapeType.roundRect, { x: x, y: y, w: w, h: hh, rectRadius: 0.08, fill: { color: K_.white }, line: { color: "E1E8F1", width: 0.75 }, objectName: name || "Card" });
    }
    function cardTitle(s, x, y, w, t, dotColor) {
      s.addShape(pres.ShapeType.ellipse, { x: x + 0.18, y: y + 0.16, w: 0.12, h: 0.12, fill: { color: dotColor || K_.navy2 }, line: { type: "none" } });
      s.addText(t.toUpperCase(), { x: x + 0.38, y: y + 0.08, w: w - 0.5, h: 0.28, fontSize: 10, bold: true, color: K_.navy, charSpacing: 1, margin: 0, valign: "middle", isTextBox: true });
    }
    function chip(s, text, x, y, w, color, fontColor) {
      s.addText(text, { shape: pres.ShapeType.roundRect, rectRadius: 0.12, x: x, y: y, w: w, h: 0.26, fontSize: 9, bold: true, color: fontColor || K_.white,
        fill: { color: color }, line: { type: "none" }, align: "center", valign: "middle", margin: 0 });
    }
    var hdr = function (t, opt) { return { text: t, options: Object.assign({ bold: true, color: K_.white, fill: { color: K_.navy }, fontSize: 10, valign: "middle" }, opt || {}) }; };
    var cell = function (t, opt) { return { text: t == null ? "" : String(t), options: Object.assign({ fontSize: 10, color: K_.ink, valign: "middle" }, opt || {}) }; };

    // ---------- 1. cover
    pres.addSection({ title: "Status report" });
    var cv = pres.addSlide({ masterName: "PSR Cover", sectionTitle: "Status report" });
    cv.addText("Project Progress Status", { placeholder: "title" });
    cv.addText([{ text: P.client || P.name || "", options: { bold: true, color: K_.white, fontSize: 20, breakLine: true } },
      { text: "Update · " + h.fmtD(P.rd), options: { fontSize: 20 } }], { placeholder: "body" });
    var stc = SC[P.overallStatus] || K_.ns;
    cv.addText("OVERALL STATUS", { x: 0.7, y: 6.0, w: 2.6, h: 0.3, fontSize: 10, bold: true, color: "8FB4E8", charSpacing: 2, margin: 0, isTextBox: true });
    cv.addText(P.overallStatus, { shape: pres.ShapeType.roundRect, rectRadius: 0.2, x: 0.7, y: 6.32, w: 2.4, h: 0.55, fontSize: 18, bold: true, color: K_.white, fill: { color: stc }, line: { type: "none" }, align: "center", valign: "middle", margin: 0 });
    cv.addText([{ text: "Progress ", options: { color: "8FB4E8" } }, { text: h.fmtP(P.overall), options: { bold: true, color: K_.white } },
      { text: "  ·  Plan " + h.fmtP(P.overallPlanned), options: { color: "8FB4E8" } }], { x: 3.4, y: 6.32, w: 4.2, h: 0.55, fontSize: 16, valign: "middle", margin: 0, isTextBox: true });
    cv.addText([{ text: "Project Manager : ", options: { color: "8FB4E8" } }, { text: P.lead || "–", options: { color: K_.white } }],
      { x: 7.6, y: 6.32, w: 5.0, h: 0.55, fontSize: 14, valign: "middle", align: "right", margin: 0, isTextBox: true });
    if (P.logo && /^data:image\//.test(P.logo)) {   // client logo (picture in sheet Kickoff B13, or chosen in the Generator)
      var cx = W - 0.4 - 2.15;
      cv.addShape(pres.ShapeType.roundRect, { x: cx, y: 0.45, w: 2.15, h: 0.95, rectRadius: 0.08, fill: { color: K_.white }, line: { type: "none" } });
      cv.addImage({ data: P.logo.replace(/^data:/, ""), x: cx + 0.15, y: 0.55, w: 1.85, h: 0.75, sizing: { type: "contain", w: 1.85, h: 0.75 }, altText: P.client || "Client logo" });
    }
    if (internal) cv.addText("INTERNAL · CONFIDENTIAL", { x: 0.7, y: 1.2, w: 4.0, h: 0.35, fontSize: 11, bold: true, color: "FF8A8A", charSpacing: 2, margin: 0, isTextBox: true });

    // ---------- 2. summary
    var s2 = content("Project Status Summary", "Status report");
    var keyMs = M.milestones.filter(function (m) { return m.key; });
    var cnt = {}; h.STATUS.forEach(function (x) { cnt[x] = 0; }); keyMs.forEach(function (m) { cnt[m.status]++; });
    var days = P.goLive != null ? Math.round((P.goLive - P.rd) / h.DAY) : null, gap = P.overallPlanned - P.overall;
    var y0 = 1.25, ch = 1.2;
    // status (colour = status), progress (blue), go-live (slate), key milestones (white)
    s2.addShape(pres.ShapeType.roundRect, { x: 0.5, y: y0, w: 3.0, h: ch, rectRadius: 0.1, fill: { color: SC_DARK[P.overallStatus] || "64748B" }, line: { type: "none" }, objectName: "Status card" });
    s2.addText([{ text: "OVERALL STATUS", options: { fontSize: 10, bold: true, color: "E8EEF7", charSpacing: 1, breakLine: true } },
      { text: P.overallStatus, options: { fontSize: 26, bold: true, color: K_.white, breakLine: true } },
      { text: gap > 0.005 ? "Behind plan by " + Math.round(gap * 100) + " pts" : "On or ahead of plan", options: { fontSize: 10, color: "E8EEF7" } }],
      { x: 0.75, y: y0 + 0.1, w: 2.6, h: ch - 0.2, valign: "middle", margin: 0, isTextBox: true });
    s2.addShape(pres.ShapeType.roundRect, { x: 3.7, y: y0, w: 3.0, h: ch, rectRadius: 0.1, fill: { color: K_.navy2 }, line: { type: "none" }, objectName: "Progress card" });
    s2.addText([{ text: "OVERALL PROGRESS", options: { fontSize: 10, bold: true, color: "D3E2F8", charSpacing: 1, breakLine: true } },
      { text: h.fmtP(P.overall), options: { fontSize: 26, bold: true, color: K_.white } }], { x: 3.95, y: y0 + 0.08, w: 2.6, h: 0.75, valign: "top", margin: 0, isTextBox: true });
    s2.addShape(pres.ShapeType.roundRect, { x: 3.95, y: y0 + 0.88, w: 2.5, h: 0.1, rectRadius: 0.05, fill: { color: "4C74B0" }, line: { type: "none" } });
    if (P.overall > 0.005) s2.addShape(pres.ShapeType.roundRect, { x: 3.95, y: y0 + 0.88, w: Math.max(0.1, 2.5 * Math.min(1, P.overall)), h: 0.1, rectRadius: 0.05, fill: { color: K_.white }, line: { type: "none" } });
    s2.addShape(pres.ShapeType.rect, { x: 3.95 + 2.5 * Math.min(1, P.overallPlanned) - 0.015, y: y0 + 0.82, w: 0.03, h: 0.22, fill: { color: "FFD34D" }, line: { type: "none" } });
    s2.addText("Plan " + h.fmtP(P.overallPlanned) + " at " + h.short(P.rd), { x: 3.95, y: y0 + 1.0, w: 2.6, h: 0.2, fontSize: 9, color: "D3E2F8", margin: 0, isTextBox: true });
    s2.addShape(pres.ShapeType.roundRect, { x: 6.9, y: y0, w: 2.2, h: ch, rectRadius: 0.1, fill: { color: "334155" }, line: { type: "none" }, objectName: "Go-live card" });
    s2.addText([{ text: "GO-LIVE", options: { fontSize: 10, bold: true, color: "C3CDDB", charSpacing: 1, breakLine: true } },
      { text: days == null ? "–" : days >= 0 ? days + " days" : "Live", options: { fontSize: 26, bold: true, color: K_.white, breakLine: true } },
      { text: h.fmtD(P.goLive) || "", options: { fontSize: 10, color: "C3CDDB" } }], { x: 7.15, y: y0 + 0.1, w: 1.85, h: ch - 0.2, valign: "middle", margin: 0, isTextBox: true });
    card(s2, 9.3, y0, 3.53, ch, "Key milestones card");
    s2.addText("KEY MILESTONES (" + keyMs.length + ")", { x: 9.5, y: y0 + 0.1, w: 3.2, h: 0.28, fontSize: 10, bold: true, color: K_.mut, charSpacing: 1, margin: 0, isTextBox: true });
    var bx = 9.5, bw = 3.13;
    h.STATUS.forEach(function (st) { if (!cnt[st] || !keyMs.length) return; var w = bw * cnt[st] / keyMs.length;
      s2.addShape(pres.ShapeType.rect, { x: bx, y: y0 + 0.45, w: w, h: 0.16, fill: { color: SC[st] }, line: { color: K_.white, width: 1 } }); bx += w; });
    var leg = h.STATUS.filter(function (st) { return cnt[st]; }).map(function (st, i, arr) {
      return { text: "● " + cnt[st] + " " + st + (i < arr.length - 1 ? "   " : ""), options: { color: SC[st], fontSize: 9, bold: false } }; });
    if (leg.length) s2.addText(leg, { x: 9.5, y: y0 + 0.7, w: 3.2, h: 0.45, valign: "top", margin: 0, isTextBox: true, color: K_.ink });
    // rationale
    var ry = y0 + ch + 0.12;
    // project summary (written by the PM) + assessment rationale
    var exS = P.execSummary ? cut(P.execSummary, 620) : "", exP = (P.summaryPoints || []).slice(0, 3);
    var sumL = exS || exP.length ? [] : (P.projectSummary || []).slice(0, 4), rh;
    if (exS || exP.length) {
      var exL = exS ? Math.min(4, Math.ceil(exS.length / 190)) : 0;
      rh = Math.min(1.85, 0.42 + 0.19 * exL + (exP.length ? 0.26 + 0.2 * exP.length : 0));
      card(s2, 0.5, ry, W - 1.0, rh, "Executive summary"); cardTitle(s2, 0.5, ry, W - 1.0, "Executive summary", K_.navy2);
      var er = [];
      if (exS) er.push({ text: exS, options: { breakLine: exP.length > 0, paraSpaceAfter: 4 } });
      if (exP.length) er.push({ text: "KEY HIGHLIGHTS & ATTENTION REQUIRED", options: { fontSize: 8.5, bold: true, color: K_.mut, charSpacing: 1, breakLine: true } });
      exP.forEach(function (x, i) {
        var col = /attention|depend|risk|decision/i.test(x.label) ? K_.late : /progress|current/i.test(x.label) ? K_.ok : K_.blue;
        if (x.label) er.push({ text: x.label + ": ", options: { bold: true, color: col, bullet: { indent: 12 } } });
        er.push({ text: cut(x.text, 150), options: x.label ? { breakLine: i < exP.length - 1 } : { bullet: { indent: 12 }, breakLine: i < exP.length - 1 } });
      });
      s2.addText(er, { x: 0.7, y: ry + 0.38, w: W - 1.4, h: rh - 0.42, fontSize: 10, color: K_.ink, valign: "top", margin: 0, isTextBox: true });
    } else {
    rh = sumL.length ? 0.42 + 0.21 * sumL.length + (P.rationale ? 0.22 : 0) : 0.56;
    card(s2, 0.5, ry, W - 1.0, rh, sumL.length ? "Project summary" : "Assessment rationale");
    if (sumL.length) {
      cardTitle(s2, 0.5, ry, W - 1.0, "Project summary", K_.navy2);
      var runs = sumL.map(function (t, i) { return { text: cut(t, 160), options: { bullet: { indent: 12 }, breakLine: i < sumL.length - 1 || !!P.rationale } }; });
      if (P.rationale) runs.push({ text: cut(P.rationale, 220), options: { italic: true, color: K_.mut } });
      s2.addText(runs, { x: 0.7, y: ry + 0.38, w: W - 1.4, h: rh - 0.42, fontSize: 10, color: K_.ink, valign: "top", margin: 0, isTextBox: true });
    } else s2.addText(cut(P.rationale || (P.placeholder ? "Assessment Rationale – สรุปภาพรวมโครงการและเหตุผลของสถานะ 2–3 บรรทัด" : "–"), 300),
      { x: 0.7, y: ry + 0.03, w: W - 1.4, h: 0.5, fontSize: 10, color: K_.slate, italic: !P.rationale, valign: "middle", margin: 0, isTextBox: true });
    }
    // three columns
    var vis = function (x) { return internal || x.vis !== "Internal"; };
    var acc = M.highlights.filter(function (x) { return x.type === "Accomplishment" && vis(x); });
    var up = M.highlights.filter(function (x) { return x.type === "Upcoming" && vis(x); });
    var rank = { "Delayed": 0, "At Risk": 1, "On Track": 2, "Not Started": 3, "Completed": 4 };
    var attn = keyMs.filter(function (m) { return m.status === "Delayed" || m.status === "At Risk"; }).sort(function (a, b) { return (rank[a.status] - rank[b.status]) || (a.end - b.end); });
    var cy = ry + rh + 0.12, chh = Math.max(1.3, 1.95 - (rh - 0.56)), cw = (W - 1.0 - 0.3) / 3;
    var bullets = function (arr) {
      if (!arr.length) return [{ text: "–", options: { color: K_.soft } }];
      var L = arr.slice(0, 3).map(function (x, i, a) { return { text: cut(x.text, 85), options: { bullet: { indent: 12 }, breakLine: i < a.length - 1 || arr.length > 3, paraSpaceAfter: 4 } }; });
      if (arr.length > 3) L.push({ text: "+ " + (arr.length - 3) + " more", options: { color: K_.soft, fontSize: 9 } });
      return L;
    };
    [["Key accomplishments", acc, K_.blue], ["Next steps", up, K_.ok]].forEach(function (c, i) {
      var x = 0.5 + i * (cw + 0.15); card(s2, x, cy, cw, chh, c[0]); cardTitle(s2, x, cy, cw, c[0], c[2]);
      s2.addText(bullets(c[1]), { x: x + 0.2, y: cy + 0.42, w: cw - 0.35, h: chh - 0.5, fontSize: 10.5, color: K_.ink, valign: "top", margin: 0, isTextBox: true });
    });
    var x3 = 0.5 + 2 * (cw + 0.15); card(s2, x3, cy, cw, chh, "Milestones needing attention"); cardTitle(s2, x3, cy, cw, "Milestones needing attention", K_.late);
    var at = attn.slice(0, 3).map(function (m, i, a) {
      return [{ text: "● ", options: { color: SC[m.status], bold: true } }, { text: cut(m.name, 48), options: { bold: true, breakLine: true } },
        { text: "   " + h.fmtP(m.pct) + " · target " + h.short(m.end) + (m.status === "Delayed" ? " · overdue" : ""), options: { fontSize: 9, color: m.status === "Delayed" ? K_.late : K_.mut, breakLine: i < a.length - 1, paraSpaceAfter: 5 } }];
    }).reduce(function (a, b) { return a.concat(b); }, []);
    if (!at.length) at = [{ text: "All key milestones on track", options: { color: K_.mut } }];
    if (attn.length > 3) at.push({ text: "", options: { breakLine: true } }, { text: "+ " + (attn.length - 3) + " more", options: { color: K_.soft, fontSize: 9 } });
    s2.addText(at, { x: x3 + 0.2, y: cy + 0.42, w: cw - 0.35, h: chh - 0.5, fontSize: 10.5, color: K_.ink, valign: "top", margin: 0, isTextBox: true });
    // issues
    var iss = M.issues.filter(function (i) { return i.open && vis(i); }).sort(function (a, b) { return (rank[a.rag] - rank[b.rag]) || ((a.due == null ? 9e15 : a.due) - (b.due == null ? 9e15 : b.due)); });
    var iy = cy + chh + 0.12;
    var rows = [[hdr(""), hdr("Top issues, risks & decisions (" + iss.length + " open)"), hdr("Impact", { align: "center" }), hdr("Action"), hdr("Owner · Due")]];
    iss.slice(0, 3).forEach(function (i) {
      rows.push([cell("●", { color: SC[i.rag] || K_.ns, align: "center", fontSize: 12 }), cell(cut(i.type.toUpperCase() + " · " + i.text, 82), { bold: true, fontSize: 9.5 }),
        cell(i.impact, { align: "center", color: K_.navy2, bold: true }), cell(cut(i.action, 85), { color: K_.mut, fontSize: 9 }),
        cell((i.owner || "") + (i.due != null ? "  " + h.fmtD(i.due) : ""), { fontSize: 9 })]);
    });
    if (!iss.length) rows.push([cell(""), cell("No open items", { color: K_.mut }), cell(""), cell(""), cell("")]);
    s2.addTable(rows, { x: 0.5, y: iy, w: W - 1.0, colW: [0.35, 5.0, 0.7, 4.6, 1.68], rowH: 0.28, border: { type: "solid", pt: 0.5, color: K_.line }, fill: { color: K_.white }, margin: [3, 6, 3, 6], objectName: "Issues table" });

    // ---------- 4. key upcoming activities (5-week look-ahead, native shapes)
    (function () {
      var s4 = content("Key Upcoming Activities", "Status report");
      var rd = M.rd, dow = (new Date(rd).getUTCDay() + 6) % 7, ND = 35, WE = 0.35, c0 = rd - dow * h.DAY, c1 = c0 + (ND - 1) * h.DAY;
      // left half: activity · start · end; right half: the 5-week chart
      var LX = 0.5, GW = (W - 1.0) / 2, GX = W - 0.5 - GW, LW = GX - LX, DW = 0.95, NW = LW - 2 * DW;
      var dmy = function (t) { return h.fmtD(t); }, dm = function (t) { var d = new Date(t); return ("0" + d.getUTCDate()).slice(-2) + "/" + ("0" + (d.getUTCMonth() + 1)).slice(-2); };
      var wt = function (i) { return (i % 7) > 4 ? WE : 1; }, tot = 0, xs = [];
      for (var i = 0; i < ND; i++) { xs.push(tot); tot += wt(i); }
      var X = function (t) { var i = Math.round((t - c0) / h.DAY); return GX + (i <= 0 ? 0 : i >= ND ? GW : xs[i] / tot * GW); };
      var XE = function (t) { var i = Math.round((t - c0) / h.DAY); return GX + (i < 0 ? 0 : i >= ND - 1 ? GW : (xs[i] + wt(i)) / tot * GW); };
      var ms = {}; M.milestones.forEach(function (m) { ms[m.id] = true; });
      var acts = M.activities.filter(function (a) { return ms[a.ms] && a.start != null && a.status !== "N/A"; });
      var cur = acts.some(function (a) { return a.label; });
      var items = acts.filter(function (a) { var e = a.end == null ? a.start : a.end;
        return (cur ? !!a.label : a.status !== "Done") && a.start <= c1 && e >= c0 && !(a.status === "Done" && e < rd); })
        .map(function (a) { var e = a.end == null ? a.start : a.end; return { s: a.start, e: e, t: cut(a.label || a.name, 46), c: owC(h.ownerClass(a.owner)), one: e === a.start, late: a.status !== "Done" && e < rd }; });
      var keys = items.filter(function (x) { return x.one; }).sort(function (a, b) { return a.s - b.s; });
      var rows = items.filter(function (x) { return !x.one; }).sort(function (a, b) { return (a.s - b.s) || (a.e - b.e); }).slice(0, 14);
      s4.addText([{ text: dmy(c0) + " – " + dmy(c1), options: { bold: true, color: K_.navy } }, { text: "  ·  5-week look-ahead", options: { color: K_.mut } }],
        { x: 0.5, y: 1.18, w: 6, h: 0.32, fontSize: 13, margin: 0, isTextBox: true });
      var lg = [["HMC", K_.hmc], ["Client", K_.client], ["Joint", K_.joint]], lx = 8.2;
      lg.forEach(function (l) { s4.addShape(pres.ShapeType.roundRect, { x: lx, y: 1.28, w: 0.28, h: 0.13, rectRadius: 0.06, fill: { color: l[1] }, line: { type: "none" } });
        s4.addText(l[0], { x: lx + 0.33, y: 1.2, w: 0.7, h: 0.28, fontSize: 9.5, color: K_.mut, margin: 0, isTextBox: true }); lx += 1.05; });
      s4.addShape(pres.ShapeType.diamond, { x: lx, y: 1.26, w: 0.16, h: 0.16, fill: { color: "64748B" }, line: { type: "none" } });
      s4.addText("Key date", { x: lx + 0.22, y: 1.2, w: 0.8, h: 0.28, fontSize: 9.5, color: K_.mut, margin: 0, isTextBox: true });
      s4.addShape(pres.ShapeType.rect, { x: lx + 1.05, y: 1.23, w: 0.04, h: 0.22, fill: { color: "F2B705" }, line: { type: "none" } });
      s4.addText("Report date", { x: lx + 1.14, y: 1.2, w: 1.0, h: 0.28, fontSize: 9.5, color: K_.mut, margin: 0, isTextBox: true });
      var top = 1.6, hh = 0.62, keyH = keys.length ? 0.42 + Math.min(2, Math.ceil(keys.length / 4)) * 0.0 : 0;
      var lanes = [], kpos = keys.map(function (k) { var x = (X(k.s) + XE(k.s)) / 2, L = 0; while (lanes[L] != null && x - lanes[L] < 1.9) L++; lanes[L] = x; return { k: k, x: x, L: L }; });
      keyH = keys.length ? 0.15 + lanes.length * 0.32 : 0;
      var rowH = Math.min(0.36, (H - 0.95 - top - hh - keyH) / Math.max(rows.length, 1));
      var bodyH = keyH + rows.length * rowH, frameH = hh + bodyH;
      card(s4, LX, top, W - 1.0, frameH + 0.05, "Look-ahead frame");
      s4.addShape(pres.ShapeType.rect, { x: LX, y: top, w: W - 1.0, h: hh, fill: { color: K_.navy }, line: { type: "none" } });
      for (var w = 0; w < 5; w++) {
        var ws = c0 + w * 7 * h.DAY, we = ws + 6 * h.DAY;
        if (w % 2) s4.addShape(pres.ShapeType.rect, { x: X(ws), y: top + hh, w: XE(we) - X(ws), h: bodyH, fill: { color: "F6F9FD" }, line: { type: "none" } });
        s4.addShape(pres.ShapeType.rect, { x: X(ws + 5 * h.DAY), y: top + hh, w: XE(we) - X(ws + 5 * h.DAY), h: bodyH, fill: { color: "EEF2F7" }, line: { type: "none" } });
        s4.addText([{ text: w === 0 ? "This week " : "Week +" + w + " ", options: { bold: true, color: K_.white } },
          { text: dm(ws) + "–" + dm(we), options: { color: "9FB8DA" } }],
          { x: X(ws) + 0.03, y: top + 0.04, w: XE(we) - X(ws) - 0.03, h: 0.26, fontSize: 7, margin: 0, isTextBox: true });
        for (var d = 0; d < 5; d++) { var t = ws + d * h.DAY;
          s4.addText(String(new Date(t).getUTCDate()), { x: X(t), y: top + 0.32, w: XE(t) - X(t), h: 0.24, fontSize: 8, align: "center", valign: "middle", margin: 0, isTextBox: true,
            bold: t === rd, color: t === rd ? K_.navy : t < rd ? "6F8BB0" : "CFE0F7", fill: t === rd ? { color: "FFD34D" } : undefined }); }
      }
      [["ACTIVITY", LX + 0.15, NW - 0.2, "left"], ["START", LX + NW, DW, "center"], ["END", LX + NW + DW, DW, "center"]].forEach(function (c) {
        s4.addText(c[0], { x: c[1], y: top, w: c[2], h: hh, fontSize: 9, bold: true, color: "CFE0F7", charSpacing: 1, align: c[3], valign: "middle", margin: 0, isTextBox: true }); });
      var rdx = (X(rd) + XE(rd)) / 2;
      var y = top + hh;
      if (keys.length) {
        s4.addText("KEY DATES", { x: LX + 0.15, y: y, w: LW - 0.2, h: keyH, fontSize: 9, bold: true, color: K_.navy2, charSpacing: 1, valign: "middle", margin: 0, isTextBox: true });
        kpos.forEach(function (p) { var ky = y + 0.1 + p.L * 0.32;
          s4.addShape(pres.ShapeType.diamond, { x: p.x - 0.08, y: ky + 0.04, w: 0.16, h: 0.16, fill: { color: p.k.c === K_.client ? "F2994A" : p.k.c === K_.hmc ? K_.hmc : "64748B" }, line: { type: "none" } });
          s4.addText([{ text: p.k.t + " ", options: { bold: true, color: K_.navy } }, { text: h.short(p.k.s), options: { color: K_.mut, fontSize: 8 } }],
            { x: p.x + 0.12, y: ky - 0.02, w: 2.2, h: 0.28, fontSize: 9, margin: 0, valign: "middle", isTextBox: true }); });
        y += keyH;
        s4.addShape(pres.ShapeType.line, { x: LX, y: y, w: W - 1.0, h: 0, line: { color: K_.line, width: 0.75 } });
      }
      rows.forEach(function (r) {
        s4.addShape(pres.ShapeType.rect, { x: LX + 0.15, y: y + rowH / 2 - 0.06, w: 0.12, h: 0.12, fill: { color: r.c }, line: { type: "none" } });
        s4.addText(r.t, { x: LX + 0.35, y: y, w: NW - 0.4, h: rowH, fontSize: 9.5, bold: true, color: r.late ? K_.late : K_.ink, valign: "middle", margin: 0, isTextBox: true });
        s4.addText(dmy(r.s), { x: LX + NW, y: y, w: DW, h: rowH, fontSize: 9, color: K_.mut, align: "center", valign: "middle", margin: 0, isTextBox: true });
        s4.addText(dmy(r.e), { x: LX + NW + DW, y: y, w: DW, h: rowH, fontSize: 9, bold: r.late, color: r.late ? K_.late : K_.mut, align: "center", valign: "middle", margin: 0, isTextBox: true });
        var l = X(r.s), rr = XE(r.e);
        s4.addShape(pres.ShapeType.roundRect, { x: l, y: y + rowH / 2 - 0.07, w: Math.max(rr - l, 0.12), h: 0.14, rectRadius: 0.07, fill: { color: r.c }, line: { type: "none" } });
        y += rowH;
        s4.addShape(pres.ShapeType.line, { x: LX, y: y, w: W - 1.0, h: 0, line: { color: "EDF1F6", width: 0.5 } });
      });
      s4.addShape(pres.ShapeType.rect, { x: rdx - 0.012, y: top + hh, w: 0.024, h: bodyH, fill: { color: "F2B705" }, line: { type: "none" } });
      if (!items.length) s4.addText("ไม่มี Activity ในช่วงนี้ – ใส่ Calendar Label (ชีท Plan คอลัมน์ X)", { x: GX, y: top + hh + 0.1, w: 6, h: 0.3, fontSize: 10, color: K_.mut, margin: 0, isTextBox: true });
    })();

    // ---------- 3. items for steering
    var st = h.steerItems(M, mode);
    if (st.length) {
      var SPER = 5;
      for (var p0 = 0; p0 < st.length; p0 += SPER) {
        var part = st.slice(p0, p0 + SPER);
        var s3 = content("Items for Steering" + (st.length > SPER ? " (" + (p0 / SPER + 1) + "/" + Math.ceil(st.length / SPER) + ")" : ""), "Status report");
        var nd = st.filter(function (i) { return i.steer === "Decision"; }).length;
        chip(s3, nd + "  Decision needed · ขอให้ตัดสินใจ", 0.5, 1.3, 3.4, K_.navy2);
        chip(s3, (st.length - nd) + "  For acknowledgement · ขอให้รับทราบ", 4.05, 1.3, 3.8, "64748B");
        var r3 = [[hdr("#", { align: "center" }), hdr("Topic"), hdr("Details / current status"), hdr("Ask from Steering"), hdr("Owner · Due")]];
        part.forEach(function (i, k) {
          r3.push([cell(p0 + k + 1, { align: "center", bold: true, color: K_.navy2 }),
            { text: [{ text: i.steer.toUpperCase() + "\n", options: { fontSize: 8, bold: true, color: i.steer === "Decision" ? K_.navy2 : "64748B" } }, { text: cut(i.text, 120), options: { bold: true } }], options: { fontSize: 10.5, color: K_.ink, valign: "middle" } },
            cell(cut(i.action, 140), { color: K_.mut, fontSize: 10 }),
            cell(cut(i.ask || "–", 120), { bold: true, color: K_.navy, fill: { color: "EEF4FD" } }),
            cell((i.owner || "") + "\n" + (h.fmtD(i.due) || "–"), { fontSize: 9.5 })]);
        });
        s3.addTable(r3, { x: 0.5, y: 1.75, w: W - 1.0, colW: [0.45, 3.75, 3.6, 3.3, 1.23], rowH: 0.72, border: { type: "solid", pt: 0.5, color: K_.line }, fill: { color: K_.white }, margin: [4, 7, 4, 7], objectName: "Steering items" });
      }
    }

    // ---------- 5. timeline
    (function () {
      var s5 = content("Overall Project Timeline", "Status report");
      var ph = M.phases, dated = ph.filter(function (p) { return p.start != null && p.end != null; });
      var t0 = dated.length ? Math.min.apply(null, dated.map(function (p) { return p.start; })) : M.rd;
      var t1 = dated.length ? Math.max.apply(null, dated.map(function (p) { return p.end; })) : M.rd + 330 * h.DAY;
      var d0 = new Date(t0), d1 = new Date(t1), start = Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), 1), end = Date.UTC(d1.getUTCFullYear(), d1.getUTCMonth() + 1, 1);
      var LX = 0.5, LW = 3.4, DW = 0.65, SW = 1.25, GX = LX + LW + DW + SW, GW = W - 0.5 - GX, top = 1.3, hh = 0.42;
      var rowH = Math.min(0.42, (H - 0.75 - top - hh) / Math.max(ph.length, 1));
      var X = function (t) { return GX + (t - start) / (end - start) * GW; };
      card(s5, LX, top, W - 1.0, hh + rowH * ph.length + 0.05, "Timeline frame");
      s5.addShape(pres.ShapeType.rect, { x: LX, y: top, w: W - 1.0, h: hh, fill: { color: K_.navy }, line: { type: "none" } });
      [["PHASE", LX + 0.15, LW], ["DONE", LX + LW, DW], ["STATUS", LX + LW + DW + 0.05, SW]].forEach(function (c) {
        s5.addText(c[0], { x: c[1], y: top, w: c[2], h: hh, fontSize: 9, bold: true, color: "CFE0F7", charSpacing: 1, valign: "middle", align: c[0] === "DONE" ? "center" : "left", margin: 0, isTextBox: true }); });
      var mths = []; for (var y = d0.getUTCFullYear(), mo = d0.getUTCMonth(); Date.UTC(y, mo, 1) < end; mo++) { if (mo > 11) { mo = 0; y++; } mths.push(Date.UTC(y, mo, 1)); }
      mths.forEach(function (m, i) { var nx = i < mths.length - 1 ? mths[i + 1] : end, dm = new Date(m);
        s5.addText(h.MON[dm.getUTCMonth()] + (dm.getUTCMonth() === 0 || i === 0 ? " '" + String(dm.getUTCFullYear()).slice(2) : ""), { x: X(m), y: top, w: X(nx) - X(m), h: hh, fontSize: 8.5, color: "CFE0F7", align: "center", valign: "middle", margin: 0, isTextBox: true });
        if (i) s5.addShape(pres.ShapeType.line, { x: X(m), y: top + hh, w: 0, h: rowH * ph.length, line: { color: "E6ECF3", width: 0.5 } }); });
      ph.forEach(function (p, i) {
        var y = top + hh + i * rowH, col = SC[p.status] || K_.ns;
        if (i % 2) s5.addShape(pres.ShapeType.rect, { x: LX, y: y, w: W - 1.0, h: rowH, fill: { color: "F7F9FC" }, line: { type: "none" } });
        s5.addText([{ text: cut(p.name, 46), options: { bold: true, color: K_.ink, fontSize: 10, breakLine: true } },
          { text: (p.start == null ? "– ยังไม่ระบุวันที่ –" : h.fmtD(p.start) + " – " + h.fmtD(p.end)) + " · " + (p.owner || ""), options: { color: K_.soft, fontSize: 7.5 } }],
          { x: LX + 0.15, y: y, w: LW - 0.2, h: rowH, valign: "middle", margin: 0, isTextBox: true });
        s5.addText(p.pct || p.status !== "Not Started" ? h.fmtP(p.pct) : "–", { x: LX + LW, y: y, w: DW, h: rowH, fontSize: 10, bold: true, color: col, align: "center", valign: "middle", margin: 0, isTextBox: true });
        s5.addText([{ text: "● ", options: { color: col } }, { text: p.status, options: { color: K_.mut } }], { x: LX + LW + DW + 0.05, y: y, w: SW, h: rowH, fontSize: 9, valign: "middle", margin: 0, isTextBox: true });
        if (p.start != null && p.end != null) {
          var bx = X(p.start), bw = Math.max(X(p.end + h.DAY) - bx, 0.08), by = y + rowH / 2 - 0.08;
          s5.addShape(pres.ShapeType.roundRect, { x: bx, y: by, w: bw, h: 0.16, rectRadius: 0.08, fill: { color: col, transparency: 70 }, line: { type: "none" } });
          if (p.pct > 0.005) s5.addShape(pres.ShapeType.roundRect, { x: bx, y: by, w: Math.max(bw * Math.min(1, p.pct), 0.1), h: 0.16, rectRadius: 0.08, fill: { color: col }, line: { type: "none" } });
        }
      });
      if (M.rd >= start && M.rd <= end) {
        var rx = X(M.rd);
        s5.addShape(pres.ShapeType.rect, { x: rx - 0.012, y: top + hh, w: 0.024, h: rowH * ph.length, fill: { color: "F2B705" }, line: { type: "none" } });
        s5.addText("Today", { shape: pres.ShapeType.roundRect, rectRadius: 0.05, x: rx - 0.3, y: top - 0.2, w: 0.6, h: 0.2, fontSize: 8, bold: true, color: K_.navy, fill: { color: "FFD34D" }, line: { type: "none" }, align: "center", valign: "middle", margin: 0 });
      }
    })();

    // ---------- 5b. progress overview (one column: S-curve with monthly values + plan/actual/gap table · phases · milestones)
    if (M.chart) (function () {
      var C = M.chart, sp = content("Progress Overview", "Status report"), N = C.labels.length, FW = W - 1.0;
      card(sp, 0.5, 1.2, FW, 3.62, "S-curve"); cardTitle(sp, 0.5, 1.2, FW, "Overall progress · plan vs actual by month");
      sp.addChart(pres.ChartType.line, [{ name: "Plan", labels: C.labels, values: C.plan }, { name: "Actual", labels: C.labels, values: C.actual }],
        { x: 0.6, y: 1.5, w: FW - 0.2, h: 2.3, chartColors: ["9FB8DA", "1B4F8F"], lineSize: 2, lineDataSymbol: "circle", lineDataSymbolSize: 6,
          valAxisMinVal: 0, valAxisMaxVal: 100, valAxisLabelFormatCode: '0"%"', valAxisLabelFontSize: 8, catAxisLabelFontSize: 8, valGridLine: { color: "E6ECF3", size: 0.5 },
          showValue: true, dataLabelFormatCode: '0"%"', dataLabelPosition: "t", dataLabelFontSize: 8, dataLabelColor: "0F2A4A",
          showLegend: true, legendPos: "t", legendFontSize: 8, displayBlanksAs: "gap", objectName: "S-curve chart" });
      // month table under the chart
      var lw = 0.9, cw = (FW - 0.3 - lw) / Math.max(N, 1), f = function (v) { return v == null ? "–" : v + "%"; };
      var rowsT = [[cell("", { fill: { color: K_.sky } })].concat(C.labels.map(function (l) { return cell(l, { align: "center", bold: true, fontSize: 8, color: K_.navy, fill: { color: K_.sky } }); })),
        [cell("Plan", { bold: true, fontSize: 8.5, color: "6F8BB0" })].concat(C.plan.map(function (v) { return cell(f(v), { align: "center", fontSize: 8.5, color: "6F8BB0" }); })),
        [cell("Actual", { bold: true, fontSize: 8.5, color: K_.navy })].concat(C.actual.map(function (v) { return cell(f(v), { align: "center", fontSize: 8.5, bold: true, color: K_.navy }); })),
        [cell("Gap", { bold: true, fontSize: 8.5, color: K_.mut })].concat(C.actual.map(function (a, k) { var p = C.plan[k];
          if (a == null || p == null) return cell("–", { align: "center", fontSize: 8.5, color: K_.mut });
          var g = a - p; return cell((g > 0 ? "+" : "") + g, { align: "center", fontSize: 8.5, bold: true, color: g < 0 ? K_.late : g > 0 ? K_.ok : K_.mut }); }))];
      sp.addTable(rowsT, { x: 0.65, y: 3.86, w: FW - 0.3, colW: [lw].concat(C.labels.map(function () { return cw; })), rowH: 0.22, border: { type: "solid", pt: 0.5, color: K_.line }, margin: [1, 2, 1, 2], objectName: "Monthly plan vs actual" });
      // phases actual vs plan
      var ph = C.phases.slice(0, 10);
      card(sp, 0.5, 4.92, FW, 1.38, "Phases"); cardTitle(sp, 0.5, 4.92, FW, "Phase progress · actual vs plan");
      if (ph.length) sp.addChart(pres.ChartType.bar, [{ name: "Plan", labels: ph.map(function (p) { return cut(p.name, 34); }), values: ph.map(function (p) { return p.planned; }) },
          { name: "Actual", labels: ph.map(function (p) { return cut(p.name, 34); }), values: ph.map(function (p) { return p.actual; }) }],
        { x: 0.6, y: 5.2, w: FW - 0.2, h: 1.08, barDir: "bar", barGrouping: "clustered", chartColors: ["9FB8DA", "1B4F8F"], catAxisOrientation: "maxMin",
          valAxisMinVal: 0, valAxisMaxVal: 100, valAxisHidden: true, valGridLine: { style: "none" }, catAxisLabelFontSize: 7.5,
          showValue: true, dataLabelFormatCode: '0"%"', dataLabelFontSize: 7, showLegend: true, legendPos: "r", legendFontSize: 8, objectName: "Phase chart" });
      // milestones by status (stacked)
      card(sp, 0.5, 6.38, FW, 0.68, "Milestones by status");
      var ST = h.STATUS, cats = ["Project milestones", "Billing milestones"], mc = [C.milestones.project || {}, C.milestones.billing || {}];
      sp.addChart(pres.ChartType.bar, ST.map(function (st) { return { name: st, labels: cats, values: mc.map(function (c) { return c[st] || 0; }) }; }),
        { x: 0.6, y: 6.4, w: FW - 0.2, h: 0.64, barDir: "bar", barGrouping: "stacked", chartColors: ST.map(function (st) { return SC[st] || K_.ns; }), catAxisOrientation: "maxMin",
          valAxisHidden: true, valGridLine: { style: "none" }, catAxisLabelFontSize: 8, showLegend: true, legendPos: "r", legendFontSize: 7.5,
          showValue: true, dataLabelColor: "FFFFFF", dataLabelFontSize: 7.5, dataLabelFormatCode: '0;;;', objectName: "Milestone chart" });
    })();

    // ---------- 6. key milestones (12 rows per column, 24 per slide)
    (function () {
      var km = M.milestones.filter(function (m) { return m.key; }), n = Math.max(1, Math.ceil(km.length / 24)), PERS = Math.ceil(km.length / n) || 1;
      for (var pg = 0; pg < n; pg++) {
        var part = km.slice(pg * PERS, (pg + 1) * PERS), half = Math.ceil(part.length / 2);
        var s6 = content("Key Milestone Tracker" + (n > 1 ? " (" + (pg + 1) + "/" + n + ")" : ""), "Status report");
        [part.slice(0, half), part.slice(half)].forEach(function (arr, c) {
          if (!arr.length) return;
          var r = [[hdr("Milestone"), hdr("Target"), hdr("Done", { align: "right" }), hdr("Status", { align: "center" })]];
          arr.forEach(function (m) { r.push([cell(cut(m.name, 40), { bold: true }), cell(h.fmtD(m.end) || "–", { color: K_.mut, fontSize: 9.5 }),
            cell(h.fmtP(m.pct), { align: "right", bold: true, color: K_.navy }), cell(m.status, { align: "center", bold: true, fontSize: 9, color: K_.white, fill: { color: SC[m.status] || K_.ns } })]); });
          s6.addTable(r, { x: 0.5 + c * 6.25, y: 1.3, w: 6.0, colW: [3.0, 1.1, 0.65, 1.25], rowH: 0.4, border: { type: "solid", pt: 0.5, color: K_.line }, fill: { color: K_.white }, margin: [3, 6, 3, 6], objectName: "Milestones " + (c + 1) });
        });
      }
    })();

    if (internal) {
      // ---------- 7. billing
      pres.addSection({ title: "Internal" });
      (function () {
        var B = M.billing, s7 = content("Billing & Payment Status", "Internal");
        var tot = 0, paid = 0, inv = 0, over = 0, ready = 0, late = 0;
        B.forEach(function (b) { tot += b.amount; if (b.status === "Paid") paid += b.paidAmt || b.amount; else if (b.status === "Invoiced") inv += b.amount;
          else if (b.status === "Overdue") over += b.amount; else if (b.status === "Ready to Invoice") ready += b.amount; else if (b.status === "Milestone Delayed") late += b.amount; });
        var big = function (v) { return v >= 1e6 ? (v / 1e6).toFixed(2).replace(/\.?0+$/, "") + "M" : v >= 1e3 ? Math.round(v / 1e3) + "K" : h.money(v); };
        [["CONTRACT VALUE (" + P.currency + ")", tot, K_.navy2], ["COLLECTED", paid, K_.blue], ["OUTSTANDING", inv + over, over ? K_.late : K_.ok], ["READY TO INVOICE", ready, K_.risk], ["AT RISK – MS LATE", late, K_.late]]
          .forEach(function (t, i) { var x = 0.5 + i * 2.5; card(s7, x, 1.3, 2.35, 1.0, t[0]);
            s7.addShape(pres.ShapeType.ellipse, { x: x + 0.18, y: 1.45, w: 0.12, h: 0.12, fill: { color: t[2] }, line: { type: "none" } });
            s7.addText([{ text: t[0], options: { fontSize: 8.5, bold: true, color: K_.mut, breakLine: true } }, { text: big(t[1]), options: { fontSize: 22, bold: true, color: K_.navy } }],
              { x: x + 0.38, y: 1.35, w: 1.9, h: 0.9, valign: "top", margin: 0, isTextBox: true }); });
        var r = [[hdr("งวด"), hdr("Amount (" + P.currency + ")", { align: "right" }), hdr("Trigger milestone"), hdr("Target"), hdr("Invoice / payment"), hdr("Status", { align: "center" })]];
        var groups = []; B.forEach(function (b) { if (groups.indexOf(b.fee) < 0) groups.push(b.fee); });
        groups.forEach(function (g) {
          var it = B.filter(function (b) { return b.fee === g; });
          r.push([{ text: g + "  ·  " + h.money(it.reduce(function (s, b) { return s + b.amount; }, 0)) + " " + P.currency + "  ·  " + it.map(function (b) { return Math.round(b.pct * 100); }).join("/"),
            options: { colspan: 6, bold: true, color: K_.navy, fill: { color: "DBE6F4" }, fontSize: 10 } }]);
          it.forEach(function (b) { r.push([cell(b.inst + " (" + h.fmtP(b.pct) + ")", { align: "center" }), cell(h.money(b.amount), { align: "right", bold: true }),
            cell(cut(b.msName, 46) + "  ·  " + h.fmtP(b.msPct)), cell(h.fmtD(b.msEnd) || "–", { fontSize: 9.5, color: K_.mut }),
            cell(b.paidDate ? "Paid " + h.fmtD(b.paidDate) : b.invDate ? b.invNo + " · due " + h.fmtD(b.due) : "–", { fontSize: 9.5 }),
            cell(b.status, { align: "center", bold: true, fontSize: 9, color: K_.white, fill: { color: BC[b.status] || K_.ns } })]); });
        });
        if (B.length) s7.addTable(r, { x: 0.5, y: 2.5, w: W - 1.0, colW: [1.1, 1.6, 4.5, 1.3, 2.2, 1.63], rowH: 0.3, border: { type: "solid", pt: 0.5, color: K_.line }, fill: { color: K_.white }, margin: [3, 6, 3, 6], objectName: "Billing table" });
      })();

      // ---------- 8+. activity breakdown (chunked, one table per slide)
      (function () {
        var rd = M.rd, tol = P.tol;
        var ST = { done: ["✓ Done", K_.ok], prog: ["In Progress", K_.blue], behind: ["Behind", K_.risk], late: ["Overdue", K_.late], lstart: ["Late start", K_.risk],
          ns: ["Not Started", "C9D2DE"], hold: ["On Hold", "B07800"], na: ["N/A", "C9D2DE"] };
        var stOf = function (a) { if (a.status === "N/A") return "na"; if (a.status === "Done") return "done"; if (a.status === "On Hold") return "hold";
          if (a.end != null && a.end < rd) return "late"; if (a.status === "Not Started" || !a.status) return (a.start != null && a.start < rd) ? "lstart" : "ns";
          return h.planned(rd, a.start, a.end) - a.eff > tol ? "behind" : "prog"; };
        var lines = [];
        M.milestones.forEach(function (m) { if (!m.acts.length) return; lines.push({ g: m });
          m.acts.forEach(function (a) { lines.push({ a: a, k: stOf(a) }); }); });
        var pages = Math.ceil(lines.length / 15), PER = Math.ceil(lines.length / pages);
        for (var pg = 0; pg < pages; pg++) {
          var chunk = lines.slice(pg * PER, (pg + 1) * PER);
          if (chunk.length && !chunk[0].g) { var prev; for (var j = pg * PER; j >= 0; j--) if (lines[j].g) { prev = lines[j].g; break; } if (prev) chunk.unshift({ g: prev, cont: true }); }
          var s8 = content("Activity Breakdown" + (pages > 1 ? " (" + (pg + 1) + "/" + pages + ")" : ""), "Internal");
          var r = [[hdr("Activity"), hdr("Owner"), hdr("Plan"), hdr("Wt", { align: "center" }), hdr("Status", { align: "center" }), hdr("%", { align: "right" }), hdr("Remark")]];
          chunk.forEach(function (l) {
            if (l.g) { r.push([{ text: (l.cont ? "(ต่อ) " : "") + l.g.name + "   ·   " + h.fmtP(l.g.pct) + " · " + l.g.status + (l.g.end != null ? "   ·   target " + h.short(l.g.end) : ""),
              options: { colspan: 7, bold: true, fontSize: 10, color: K_.navy, fill: { color: "DBE6F4" } } }]); return; }
            var a = l.a, s = ST[l.k], tint = l.k === "late" ? "FDF1F1" : l.k === "behind" || l.k === "lstart" ? "FFFAF0" : K_.white;
            var dim = l.k === "done" || l.k === "na";
            r.push([cell(cut(a.name, 70), { fill: { color: tint }, color: l.k === "late" ? "8F2424" : dim ? "6B7A8F" : K_.ink, bold: l.k === "late" }),
              cell(a.owner, { fill: { color: tint }, fontSize: 9.5 }),
              cell(h.short(a.start) + " – " + h.short(a.end), { fill: { color: tint }, fontSize: 9.5, color: l.k === "late" ? K_.late : K_.ink }),
              cell(a.weight, { fill: { color: tint }, align: "center", fontSize: 9.5 }),
              cell(s[0] + (l.k === "late" ? " +" + Math.round((rd - a.end) / h.DAY) + "d" : ""), { align: "center", bold: true, fontSize: 8.5, color: l.k === "ns" || l.k === "na" ? K_.mut : K_.white, fill: { color: s[1] } }),
              cell(h.fmtP(a.eff), { fill: { color: tint }, align: "right", bold: true, color: K_.navy, fontSize: 9.5 }),
              cell(cut(a.remark, 60), { fill: { color: tint }, fontSize: 8.5, color: K_.soft })]);
          });
          s8.addTable(r, { x: 0.5, y: 1.25, w: W - 1.0, colW: [4.3, 0.75, 1.45, 0.45, 1.25, 0.6, 3.53], rowH: 0.3, border: { type: "solid", pt: 0.5, color: "E6ECF3" }, fill: { color: K_.white }, margin: [2, 5, 2, 5], objectName: "Activities" });
        }
      })();
    }
    return pres;
  }


  // =====================================================================================
  // Kick-off deck (uses sheets Kickoff + Schedule; dates computed from Go-live − duration)
  // =====================================================================================
  var TH_MON = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
  function thDate(t) { if (t == null) return "–"; var d = new Date(t); return d.getUTCDate() + " " + TH_MON[d.getUTCMonth()] + " " + (d.getUTCFullYear() + 543); }
  // ---- TH / EN: in Thai mode every text run / table cell / master text passes through h.tr()
  function localize(pres, h) {
    if (!h.lang || h.lang() !== "th") return pres;
    var T = function (v) { return typeof v === "string" ? h.tr(v) : v; };
    var TH_RE = /[\u0E00-\u0E7F]/, noSp = function (txt, o) { if (o && o.charSpacing && TH_RE.test(typeof txt === "string" ? txt : (txt || []).map(function (r) { return r && r.text || ""; }).join(""))) { o = Object.assign({}, o); o.charSpacing = 0; } return o; };
    var runs = function (t) { return Array.isArray(t) ? t.map(function (r) { return r && typeof r === "object" && "text" in r ? Object.assign({}, r, { text: T(r.text) }) : T(r); }) : T(t); };
    var od = pres.defineSlideMaster.bind(pres);
    pres.defineSlideMaster = function (m) { (m.objects || []).forEach(function (o) { if (o.text && o.text.text) o.text.text = T(o.text.text); if (o.placeholder) { if (o.placeholder.text) o.placeholder.text = T(o.placeholder.text); if (o.placeholder.options && o.placeholder.options.charSpacing) o.placeholder.options.charSpacing = 0; } }); return od(m); };
    var oa = pres.addSlide.bind(pres);
    pres.addSlide = function (o) {
      var s = oa(o), at = s.addText.bind(s), tb = s.addTable.bind(s);
      s.addText = function (t, opt) { var x = runs(t); if (opt && opt.placeholder && TH_RE.test(typeof x === "string" ? x : "")) opt = Object.assign({ charSpacing: 0 }, opt); return at(x, noSp(x, opt)); };
      s.addTable = function (rows, opt) { return tb(rows.map(function (r) { return r.map(function (c) { return c && typeof c === "object" && "text" in c ? Object.assign({}, c, { text: runs(c.text) }) : T(c); }); }), opt); };
      return s;
    };
    return pres;
  }
  // shared base for the HUMANICA-style decks (Kick-off + Charter): palette, slide masters, helpers
  function koBase(M, PptxGenJS, h, A, deckTitle) {
    var P = M.P; A = A || {};
    var C = { navy: "13284C", ink: "262626", grey: "595959", soft: "8C8C8C", line: "D9D9D9", card: "F2F2F2", card2: "F9F9F9", blue: "4472C4", blue2: "2F5597",
      orange: "FF9823", orange2: "FFB14B", red: "C00000", green: "70AD47", amber: "FFC000", white: "FFFFFF", ice: "8FB4E8" };
    var enDate = h.enDate, dShort = h.dShort;
    var client = P.client || "Client", vendor = P.vendor || "HUMANICA";
    var pres = localize(new PptxGenJS(), h);
    pres.layout = "LAYOUT_WIDE";
    pres.theme = { headFontFace: "Poppins", bodyFontFace: "Poppins" };
    pres.title = (P.short || "Project") + " – " + (deckTitle || "Project Kick-off");
    pres.author = P.lead || "";
    pres.company = String(vendor).replace(/&/g, "&amp;");
    if (h.BRAND && h.BRAND.hn) A = Object.assign({}, A, { logoN: h.BRAND.hn.replace(/^data:/, ""), logoW: h.BRAND.hw.replace(/^data:/, ""), logoRatio: h.BRAND.hratio });
    var LR = A.logoRatio || 7.1, logo = function (dark) { return A[dark ? "logoW" : "logoN"] ? { image: { x: W - 0.5 - 0.22 * LR, y: H - 0.42, w: 0.22 * LR, h: 0.22, data: A[dark ? "logoW" : "logoN"] } } : null; };
    var conf = function (dark) { return { text: { text: "Confidential", options: { x: W - 2.0, y: 0.12, w: 1.6, h: 0.25, fontSize: 9, color: dark ? "8FA3BF" : C.soft, align: "right", charSpacing: 1, margin: 0 } } }; };
    var objs = function (list) { return list.filter(function (o) { return o; }); };
    // ---- layouts
    pres.defineSlideMaster({ title: "KO Cover", background: A.cover ? { data: A.cover } : { color: "F7F7F7" }, objects: objs([conf(false), logo(false),
      { placeholder: { options: { name: "title", type: "title", x: 4.6, y: 2.45, w: 8.2, h: 0.8, fontSize: 36, bold: true, color: C.blue, charSpacing: 3, align: "left", valign: "bottom", margin: 0 }, text: "PROJECT KICK-OFF" } },
      { placeholder: { options: { name: "body", type: "body", x: 4.6, y: 3.3, w: 8.2, h: 0.9, fontSize: 16, color: C.grey, align: "left", valign: "top", margin: 0 }, text: "Implementation Project for (Client Name)" } }]) });
    pres.defineSlideMaster({ title: "KO Part", background: A.divider ? { data: A.divider } : { color: C.navy }, objects: objs([conf(true), logo(true),
      { placeholder: { options: { name: "sub", type: "body", x: 1.0, y: 2.5, w: W - 2.0, h: 0.5, fontSize: 18, bold: true, color: C.ice, charSpacing: 3, align: "center", valign: "bottom", margin: 0 }, text: "PART I" } },
      { placeholder: { options: { name: "title", type: "title", x: 1.0, y: 3.05, w: W - 2.0, h: 1.5, fontSize: 32, bold: true, color: C.white, charSpacing: 1, align: "center", valign: "top", margin: 0 }, text: "SECTION TITLE" } }]) });
    var titleBar = function (center) { return { rect: { x: center ? W / 2 - 0.3 : 0.6, y: 0.5, w: 0.6, h: 0.05, fill: { color: C.blue } } }; };
    pres.defineSlideMaster({ title: "KO Content", background: { color: "FAFAFA" }, objects: objs([conf(false), logo(false), titleBar(false),
      { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.62, w: 9.5, h: 0.55, fontSize: 24, bold: true, color: C.ink, charSpacing: 3, align: "left", valign: "middle", margin: 0 }, text: "SLIDE TITLE" } },
      { placeholder: { options: { name: "sub", type: "body", x: 0.6, y: 1.15, w: 9.5, h: 0.32, fontSize: 12, color: C.grey, align: "left", valign: "middle", margin: 0 }, text: "Subtitle" } }]),
      slideNumber: { x: 0.6, y: H - 0.42, w: 0.6, h: 0.25, fontSize: 9, color: C.soft } });
    pres.defineSlideMaster({ title: "KO Content Center", background: { color: "FAFAFA" }, objects: objs([conf(false), logo(false), titleBar(true),
      { placeholder: { options: { name: "title", type: "title", x: 1.0, y: 0.62, w: W - 2.0, h: 0.55, fontSize: 24, bold: true, color: C.ink, charSpacing: 3, align: "center", valign: "middle", margin: 0 }, text: "SLIDE TITLE" } },
      { placeholder: { options: { name: "sub", type: "body", x: 1.0, y: 1.15, w: W - 2.0, h: 0.32, fontSize: 12, color: C.grey, align: "center", valign: "middle", margin: 0 }, text: "Subtitle" } }]),
      slideNumber: { x: 0.6, y: H - 0.42, w: 0.6, h: 0.25, fontSize: 9, color: C.soft } });
    pres.defineSlideMaster({ title: "KO Closing", background: A.thanks ? { data: A.thanks } : { color: "F7F7F7" }, objects: objs([logo(false),
      { placeholder: { options: { name: "title", type: "title", x: 1.0, y: 4.55, w: W - 2.0, h: 0.6, fontSize: 28, bold: true, color: C.blue2, charSpacing: 3, align: "center", valign: "middle", margin: 0 }, text: "THANK YOU" } },
      { placeholder: { options: { name: "body", type: "body", x: 1.0, y: 5.15, w: W - 2.0, h: 0.4, fontSize: 13, color: C.grey, align: "center", valign: "top", margin: 0 }, text: "If you have any questions, please feel free to ask!" } }]) });

    var slide = function (master, title, sub, sec) {
      var s = pres.addSlide({ masterName: master, sectionTitle: sec });
      s.addText(title, { placeholder: "title" }); if (sub != null) s.addText(sub, { placeholder: "sub" });
      return s;
    };
    var box = function (s, x, y, w, hh, fill, line) { s.addShape(pres.ShapeType.roundRect, { x: x, y: y, w: w, h: hh, rectRadius: 0.1, fill: { color: fill || C.white },
      line: { color: line || "E7E7E7", width: 0.75 }, shadow: { type: "outer", color: "000000", opacity: 0.08, blur: 6, offset: 2, angle: 90 } }); };
    var sq = function (s, n, x, y, d, col) { s.addText(String(n), { shape: pres.ShapeType.roundRect, rectRadius: 0.04, x: x, y: y, w: d, h: d, fontSize: d > 0.4 ? 13 : 10, bold: true,
      color: C.white, fill: { color: col || C.blue2 }, line: { type: "none" }, align: "center", valign: "middle", margin: 0 }); };
    var hdr = function (t, o) { return { text: t, options: Object.assign({ bold: true, color: C.white, fill: { color: C.navy }, fontSize: 10, valign: "middle", align: "center" }, o || {}) }; };
    var cell = function (t, o) { return { text: t == null ? "" : String(t), options: Object.assign({ fontSize: 10, color: C.ink, valign: "middle" }, o || {}) }; };
    var ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
    var partN = 0;
    var part = function (title) {
      var sec = "Part " + ROMAN[partN] + " – " + title; partN++;
      pres.addSection({ title: sec });
      var d = pres.addSlide({ masterName: "KO Part", sectionTitle: sec });
      d.addText("PART " + ROMAN[partN - 1], { placeholder: "sub" }); d.addText(title, { placeholder: "title" });
      return sec;
    };
    return { pres: pres, C: C, P: P, A: A, enDate: enDate, dShort: dShort, client: client, vendor: vendor, slide: slide, box: box, sq: sq, hdr: hdr, cell: cell, part: part };
  }

  function buildKickoff(M, PptxGenJS, h, A) {
    // Layout and topics follow "Kick Off Template" (HUMANICA): white content slides, navy photo dividers, PART I–VII + Appendix
    var P = M.P, K = M.kickoff;
    if (!K) throw new Error("ไฟล์นี้ยังไม่มีชีท Kickoff / Schedule – ใช้ Template V.1 ขึ้นไป");
    A = A || {}; var KO = h.KO;
    var B = koBase(M, PptxGenJS, h, A, "Project Kick-off");
    var C = B.C, enDate = B.enDate, dShort = B.dShort, client = B.client, vendor = B.vendor, pres = B.pres, slide = B.slide, box = B.box, sq = B.sq, hdr = B.hdr, cell = B.cell, part = B.part;
    var has2 = K.start2 != null && K.golive2 != null;
    var mods = function (ph) { return K.modules.filter(function (m) { return m.name && m.phase === ph; }); };
    var byId = {}; K.stages.forEach(function (s0) { byId[s0.id] = s0; });

    // ===== cover
    pres.addSection({ title: "Opening" });
    var cv = pres.addSlide({ masterName: "KO Cover", sectionTitle: "Opening" });
    cv.addText("PROJECT KICK-OFF", { placeholder: "title" });
    cv.addText([{ text: (P.name || "Implementation Project") + " for " + client, options: { breakLine: true } }, { text: enDate(K.kickoff), options: { fontSize: 13, color: C.soft } }], { placeholder: "body" });
    if (P.logo && /^data:image\//.test(P.logo)) cv.addImage({ data: P.logo.replace(/^data:/, ""), x: 4.6, y: 4.45, w: 2.0, h: 0.9, sizing: { type: "contain", w: 2.0, h: 0.9 } });
    else cv.addText("Client's Logo", { x: 4.6, y: 4.45, w: 2.0, h: 0.8, fontSize: 10, color: C.soft, align: "center", valign: "middle", margin: 0, line: { color: C.line, width: 1, dashType: "dash" }, isTextBox: true });
    // ===== agenda
    var AG = KO.AGENDA;
    var ag = slide("KO Content", "MEETING AGENDA", null, "Opening");
    if (A.building) ag.addImage({ data: A.building, x: W - 4.6, y: 0, w: 4.6, h: H, sizing: { type: "cover", w: 4.6, h: H } });
    AG.forEach(function (t, i) {
      var y = 1.55 + i * 0.72;
      ag.addText(("0" + (i + 1)).slice(-2), { x: 0.6, y: y, w: 0.7, h: 0.5, fontSize: 20, bold: true, color: C.blue, valign: "middle", margin: 0, isTextBox: true });
      ag.addText(t, { x: 1.4, y: y, w: 6.8, h: 0.5, fontSize: 14, color: C.ink, charSpacing: 1, valign: "middle", margin: 0, isTextBox: true });
    });

    // ===== PART I objectives
    var sec = part("THE OBJECTIVES OF TODAY'S MEETING");
    var ob = slide("KO Content", "THE OBJECTIVES", null, sec);
    if (A.strip) ob.addImage({ data: A.strip, x: 0, y: 4.1, w: W, h: H - 4.1, sizing: { type: "cover", w: W, h: H - 4.1 } });
    [[{ text: "Formal kick-off for " }, { text: client + " " + (P.name || ""), options: { bold: true, color: C.blue2 } }]].concat(KO.OBJ.map(function (t) { return [{ text: t }]; })).forEach(function (runs, i) {
      var y = 1.45 + i * 0.85;
      sq(ob, i + 1, 5.6, y + 0.05, 0.42);
      ob.addText(runs.map(function (r) { return { text: r.text, options: Object.assign({ fontSize: 15, color: C.ink }, r.options || {}) }; }), { x: 6.25, y: y, w: 6.5, h: 0.55, valign: "middle", margin: 0, isTextBox: true });
    });

    // ===== PART II scope & benefits
    sec = part("SCOPE OF WORK AND KEY BENEFITS");
    ["Phase 1", "Phase 2"].forEach(function (ph, pi) {
      var ms = mods(ph); if (!ms.length) return;
      var core = ms.filter(function (m) { return /core/i.test(m.group); }), other = ms.filter(function (m) { return !/core/i.test(m.group); });
      var s = slide("KO Content Center", "SCOPE OF WORK", (has2 ? "Phase " + (pi + 1) + " · " : "") + "Go-live " + enDate(pi ? K.golive2 : K.golive1), sec);
      var cw = 3.85, ch = 1.0, top = 1.75;
      // centre panel – Core HR
      if (core.length) {
        var cx = W / 2 - 1.95, chh = Math.min(5.0, 0.62 + core.length * 0.95);
        s.addShape(pres.ShapeType.roundRect, { x: cx, y: top, w: 3.9, h: chh, rectRadius: 0.12, fill: { color: C.navy }, line: { type: "none" } });
        s.addText("CORE HR", { x: cx, y: top + 0.12, w: 3.9, h: 0.4, fontSize: 15, bold: true, color: C.white, charSpacing: 2, align: "center", margin: 0, isTextBox: true });
        core.forEach(function (m, i) {
          s.addText([{ text: m.name.toUpperCase(), options: { bold: true, color: C.ice, fontSize: 11, breakLine: true } }, { text: (m.features || "").replace(/ · /g, "  |  "), options: { color: C.white, fontSize: 9.5 } }],
            { x: cx + 0.25, y: top + 0.6 + i * 0.95, w: 3.4, h: 0.85, valign: "top", margin: 0, isTextBox: true });
        });
      }
      var cols = core.length ? [0.6, W - 0.6 - cw] : [0.6, 0.6 + cw + 0.25, 0.6 + 2 * (cw + 0.25)];
      var perCol = Math.ceil(other.length / cols.length);
      other.forEach(function (m, i) {
        var c = Math.floor(i / perCol), r = i % perCol, x = cols[c], y = top + r * (ch + 0.18);
        box(s, x, y, cw, ch);
        s.addShape(pres.ShapeType.ellipse, { x: x + 0.2, y: y + 0.27, w: 0.46, h: 0.46, fill: { color: "E9EEF8" }, line: { type: "none" } });
        s.addText(m.name.charAt(0).toUpperCase(), { x: x + 0.2, y: y + 0.27, w: 0.46, h: 0.46, fontSize: 14, bold: true, color: C.blue2, align: "center", valign: "middle", margin: 0, isTextBox: true });
        s.addText([{ text: m.name.toUpperCase(), options: { bold: true, color: C.ink, fontSize: 11.5, breakLine: true } }, { text: (m.features || "").replace(/ · /g, "  |  "), options: { color: C.grey, fontSize: 9.5 } }],
          { x: x + 0.8, y: y + 0.08, w: cw - 0.95, h: ch - 0.16, valign: "middle", margin: 0, isTextBox: true });
      });
    });
    var ints = K.integrations.filter(function (x) { return x.system; });
    if (ints.length) {
      var IPG = Math.ceil(ints.length / Math.ceil(ints.length / 10)), DC = { "Inbound": C.green, "Outbound": C.orange, "2-ways": C.blue };
      for (var i0 = 0; i0 < ints.length; i0 += IPG) {
        var it = slide("KO Content Center", "SYSTEM INTEGRATION", "Interfaces in scope" + (ints.length > IPG ? " (" + (i0 / IPG + 1) + "/" + Math.ceil(ints.length / IPG) + ")" : ""), sec);
        var r = [[hdr("System / Interface"), hdr("Direction"), hdr("Data"), hdr("Phase")]];
        ints.slice(i0, i0 + IPG).forEach(function (x) { r.push([cell(x.system, { bold: true }), cell(x.dir, { align: "center", bold: true, fontSize: 9.5, color: C.white, fill: { color: DC[x.dir] || C.soft } }),
          cell(cut(x.data, 110), { color: C.grey }), cell(x.phase, { align: "center", fontSize: 9.5 })]); });
        it.addTable(r, { x: 0.8, y: 1.75, w: W - 1.6, colW: [3.3, 1.4, 5.6, 1.43], rowH: 0.42, border: { type: "solid", pt: 0.5, color: C.line }, fill: { color: C.white }, margin: [4, 8, 4, 8] });
      }
    }
    var bn = slide("KO Content Center", "KEY BENEFITS & OUTCOME", null, sec);
    KO.BENEFITS.forEach(function (t, i) {
      var c = i % 2, rr = Math.floor(i / 2), x = 1.2 + c * 5.7, y = 1.8 + rr * 0.78;
      sq(bn, i + 1, x, y + 0.06, 0.4);
      bn.addText(t, { x: x + 0.6, y: y, w: 4.9, h: 0.52, fontSize: 13, bold: true, color: C.ink, valign: "middle", margin: 0, isTextBox: true });
    });

    // ===== PART III methodology
    sec = part("PROJECT METHODOLOGY");
    var po = KO.isPO(P);
    var md = slide("KO Content Center", "PROJECT METHODOLOGY", po ? "Payroll Outsourcing Model (PO)" : "Payroll Outsourcing & ESS Model / SaaS (PE / SaaS)", sec);
    var MS = KO.method(po);
    var mw = (W - 1.2 - 4 * 0.22) / 5, tint = ["9DB5E3", "6F95D8", C.blue, C.blue2, C.navy];
    MS.forEach(function (m, i) {
      var x = 0.6 + i * (mw + 0.22);
      box(md, x, 1.85, mw, 4.5);
      md.addShape(pres.ShapeType.rect, { x: x + mw - 0.09, y: 1.95, w: 0.09, h: 4.3, fill: { color: tint[i] }, line: { type: "none" } });
      md.addText(String(i + 1), { shape: pres.ShapeType.ellipse, x: x + 0.25, y: 2.1, w: 0.5, h: 0.5, fontSize: 14, bold: true, color: C.white, fill: { color: tint[i] }, line: { type: "none" }, align: "center", valign: "middle", margin: 0 });
      md.addText(m[0], { x: x + 0.25, y: 2.75, w: mw - 0.45, h: 0.4, fontSize: 13, bold: true, color: tint[i] === "9DB5E3" ? "6F95D8" : tint[i], charSpacing: 1, margin: 0, isTextBox: true });
      md.addText(m[1].map(function (b, j, a) { return { text: b, options: { bullet: { indent: 10 }, breakLine: j < a.length - 1, paraSpaceAfter: 8 } }; }),
        { x: x + 0.25, y: 3.3, w: mw - 0.45, h: 2.9, fontSize: 12, color: C.grey, valign: "top", margin: 0, isTextBox: true });
    });

    // ===== PART IV team & governance
    sec = part("PROJECT TEAM AND GOVERNANCE");
    if (K.team.some(function (t) { return t.name; })) {
      // org chart: Steering Committee → Project Advisors → Project Leads → Project Team → Technical Team
      var OT = KO.orgTiers(K);
      var s = slide("KO Content Center", "PROJECT TEAM", "Project Organization Chart", sec);
      var TC = ["1F3864", "2F5597", "4472C4", "5B8BD4", "7F9FD6"], y0 = 1.75, rh = 0.9, gap = 0.12, lx = 0.6, lw = 2.0, nx = 2.75, nw = 9.95;
      s.addText([{ text: "● ", options: { color: C.navy } }, { text: client + "    ", options: { color: "1F3864" } }, { text: "● ", options: { color: C.orange } }, { text: vendor, options: { color: "C55A11" } }],
        { x: 7.5, y: 1.35, w: 5.2, h: 0.3, fontSize: 9, bold: true, align: "right", margin: 0, isTextBox: true });
      OT.forEach(function (t, i) {
        var y = y0 + i * (rh + gap), ppl = t.client.map(function (p) { return [p, 0]; }).concat(t.hmc.map(function (p) { return [p, 1]; }));
        s.addShape(pres.ShapeType.roundRect, { x: lx, y: y, w: lw, h: rh, fill: { color: TC[i] }, line: { color: TC[i] }, rectRadius: 0.08 });
        s.addText([{ text: (i + 1) + "  ", options: { bold: true, color: "D9E4F6" } }, { text: t.label.toUpperCase(), options: { bold: true, color: C.white } }],
          { x: lx + 0.12, y: y, w: lw - 0.2, h: rh, fontSize: 10.5, valign: "middle", margin: 0, isTextBox: true });
        s.addShape(pres.ShapeType.roundRect, { x: nx, y: y, w: nw, h: rh, fill: { color: "F7F9FC" }, line: { color: "E1E8F2", width: 0.75 }, rectRadius: 0.08 });
        if (i > 0) s.addShape(pres.ShapeType.line, { x: nx + nw / 2, y: y - gap, w: 0, h: gap, line: { color: "B4C7E7", width: 1.5 } });
        if (!ppl.length) { s.addText("To be assigned", { x: nx, y: y, w: nw, h: rh, fontSize: 10, italic: true, color: "8A99B3", align: "center", valign: "middle", margin: 0, isTextBox: true }); return; }
        var n = Math.min(ppl.length, 8), cw = Math.min(2.35, (nw - 0.3 - (n - 1) * 0.12) / n), tot = n * cw + (n - 1) * 0.12, x0 = nx + (nw - tot) / 2;
        ppl.slice(0, 8).forEach(function (pp, k) {
          var p = pp[0], hmc = pp[1] === 1, col = hmc ? C.orange : C.navy, x = x0 + k * (cw + 0.12), cy = y + 0.14, ch = rh - 0.28;
          s.addShape(pres.ShapeType.roundRect, { x: x, y: cy, w: cw, h: ch, fill: { color: C.white }, line: { color: hmc ? "F6D3BB" : "D6E0EF", width: 0.75 }, rectRadius: 0.06 });
          s.addShape(pres.ShapeType.rect, { x: x, y: cy, w: 0.06, h: ch, fill: { color: col }, line: { color: col } });
          s.addText(KO.initial(p.name), { shape: pres.ShapeType.ellipse, x: x + 0.13, y: cy + (ch - 0.36) / 2, w: 0.36, h: 0.36, fontSize: 10, bold: true, color: C.white, fill: { color: col }, line: { color: col }, align: "center", valign: "middle", margin: 0 });
          s.addText([{ text: cut(p.name, 24), options: { bold: true, color: C.ink, fontSize: 9, breakLine: true } }, { text: cut(p.pos || p.role || "", 30), options: { italic: true, color: hmc ? "C55A11" : C.grey, fontSize: 7.5 } }],
            { x: x + 0.55, y: cy, w: cw - 0.62, h: ch, valign: "middle", margin: 0, isTextBox: true });
        });
        if (ppl.length > 8) s.addText("+" + (ppl.length - 8), { x: nx + nw - 0.6, y: y, w: 0.5, h: rh, fontSize: 9, bold: true, color: C.grey, valign: "middle", margin: 0, isTextBox: true });
      });
    }
    var gv = slide("KO Content", "GOVERNANCE STRUCTURE", "Project Governance & Reporting", sec);
    gv.addShape(pres.ShapeType.triangle, { x: 1.35, y: 1.75, w: 4.6, h: 4.5, fill: { color: "EEF2F9" }, line: { color: "B4C7E7", width: 1 } });
    [2.85, 4.1, 5.45].map(function (y, i) { return [y].concat(KO.GOV_TIERS[i]); }).forEach(function (t, i) {
      gv.addShape(pres.ShapeType.line, { x: 0.6, y: t[0] + (i === 0 ? 0 : 0), w: 5.5, h: 0, line: { color: "B4C7E7", width: 0.75, dashType: "dash" } });
      gv.addText(t[1], { x: 0.6, y: t[0] - 0.4, w: 0.8, h: 0.35, fontSize: 14, bold: true, color: C.blue2, margin: 0, isTextBox: true });
      gv.addText([{ text: t[2], options: { bold: true, fontSize: 11.5, color: C.navy, breakLine: true } }, { text: t[3], options: { fontSize: 9, color: C.grey } }],
        { x: 2.25, y: t[0] - (i === 0 ? 0.75 : 0.85), w: 2.8, h: 0.75, align: "center", valign: "middle", margin: 0, isTextBox: true });
    });
    gv.addText("ESCALATION TIER", { x: 0.6, y: 1.55, w: 2, h: 0.25, fontSize: 9, bold: true, color: C.soft, charSpacing: 1, margin: 0, isTextBox: true });
    gv.addText("To ensure successful delivery of the project implementation, " + client + " and " + vendor + " need to work closely together as a united team.",
      { x: 6.7, y: 1.6, w: 6.0, h: 0.7, fontSize: 12, color: C.ink, valign: "top", margin: 0, isTextBox: true });
    [["PROJECT TEAM WEEKLY STATUS UPDATE MEETING", K.weekly || "–"], ["MONTHLY STEERING COMMITTEE", K.steering || "–"]].forEach(function (m0, i) {
      var y = 2.45 + i * 1.15;
      gv.addText(m0[0], { x: 6.7, y: y, w: 6.0, h: 0.3, fontSize: 11, bold: true, color: C.blue2, margin: 0, isTextBox: true });
      gv.addText("◷  " + m0[1], { x: 6.7, y: y + 0.35, w: 6.0, h: 0.5, fontSize: 12, color: C.ink, valign: "top", margin: 0, isTextBox: true });
    });
    KO.GOV_BOX.forEach(function (b, i) {
      var x = 6.7 + i * 3.05;
      box(gv, x, 4.85, 2.9, 1.85, C.white);
      gv.addText([{ text: b[0], options: { bold: true, color: C.navy, fontSize: 10.5, breakLine: true } }].concat(b[1].map(function (t, j, a) { return { text: t, options: { bullet: { indent: 10 }, fontSize: 10, color: C.grey, breakLine: j < a.length - 1 } }; })),
        { x: x + 0.15, y: 4.95, w: 2.6, h: 1.65, valign: "top", margin: 0, paraSpaceAfter: 3, isTextBox: true });
    });

    // ===== PART V timeline (+ payment milestones)
    sec = part("OVERALL PROJECT TIMELINE");
    var OWN = KO.OWN;
    [["p1", K.start1, K.golive1, "Phase 1"], ["p2", K.start2, K.golive2, "Phase 2"]].forEach(function (ph) {
      if (ph[1] == null) return;
      var key = ph[0], T = KO.timeline(K, key);
      if (!T) return;
      var st = T.st, weekly = T.weekly, start = T.start, end = T.end, cols = T.cols;
      var s = slide("KO Content", "OVERALL PROJECT TIMELINE", (has2 ? ph[3] + " · " : "") + enDate(ph[1]) + " → Go-live " + enDate(ph[2]), sec);
      var TX = 0.6, TW = 6.25, GX = TX + TW, GW = W - 0.6 - GX, top = 1.7, hh = 0.42, rowH = Math.min(0.36, (H - 0.75 - top - hh) / st.length);
      var X = function (v) { return GX + (v - start) / (end - start) * GW; };
      var widths = [2.55, 0.85, 0.85, 0.7, 0.6, 0.7];
      ["Phase", "Start Date", "End Date", "Owner", "% Done", "Status"].forEach(function (t, i) {
        var x = TX + widths.slice(0, i).reduce(function (a, b) { return a + b; }, 0);
        s.addText(t, { x: x, y: top, w: widths[i], h: hh, fontSize: 9, bold: true, color: C.white, fill: { color: C.navy }, align: i ? "center" : "left", valign: "middle", margin: [0, 6, 0, 6], isTextBox: true });
      });
      s.addShape(pres.ShapeType.rect, { x: GX, y: top, w: GW, h: hh, fill: { color: C.navy }, line: { type: "none" } });
      cols.forEach(function (c, i) { var nx = i < cols.length - 1 ? cols[i + 1] : end, dc = new Date(c);
        s.addText(T.label(c), { x: X(c), y: top, w: X(nx) - X(c), h: hh, fontSize: 8, color: "D6DCE5", align: "center", valign: "middle", margin: 0, isTextBox: true });
        if (i) s.addShape(pres.ShapeType.line, { x: X(c), y: top + hh, w: 0, h: rowH * st.length, line: { color: "E7E7E7", width: 0.5 } }); });
      st.forEach(function (x, i) {
        var y = top + hh + i * rowH, a = x[key][0], b = x[key][1];
        if (i % 2) s.addShape(pres.ShapeType.rect, { x: TX, y: y, w: W - 1.2, h: rowH, fill: { color: C.card }, line: { type: "none" } });
        var vals = [h.stageName(x), dShort(a), dShort(b), OWN[x.id] || "Joint", "0%", "OPEN"];
        vals.forEach(function (v, j) { var xx = TX + widths.slice(0, j).reduce(function (p, q) { return p + q; }, 0);
          s.addText(v, { x: xx, y: y, w: widths[j], h: rowH, fontSize: 8.5, bold: j === 0 && x.id === "S13", color: j === 5 ? C.blue2 : C.ink, align: j ? "center" : "left", valign: "middle", margin: [0, 6, 0, 6], isTextBox: true }); });
        if (a === b) s.addShape(pres.ShapeType.diamond, { x: X(a) - 0.1, y: y + rowH / 2 - 0.1, w: 0.2, h: 0.2, fill: { color: C.blue }, line: { type: "none" } });
        else s.addShape(pres.ShapeType.rect, { x: X(a), y: y + rowH / 2 - 0.07, w: Math.max(X(b + h.DAY) - X(a), 0.06), h: 0.14, fill: { color: x.id === "S14" ? "A5A5A5" : C.blue }, line: { type: "none" } });
      });
      var kx = K.kickoff != null && K.kickoff >= start && K.kickoff <= end ? X(K.kickoff) : null;
      if (kx != null && key === "p1") {
        s.addShape(pres.ShapeType.rect, { x: kx - 0.01, y: top + hh, w: 0.02, h: rowH * st.length, fill: { color: C.red }, line: { type: "none" } });
        s.addText("Kick-off", { x: kx - 0.5, y: top + hh + rowH * st.length + 0.02, w: 1.0, h: 0.22, fontSize: 8, bold: true, color: C.red, align: "center", margin: 0, isTextBox: true });
      }
    });
    var B = M.billing.filter(function (b) { return b.fee; });
    if (B.length) {
      var pm = slide("KO Content Center", "PAYMENT MILESTONES", "Installments and target dates follow the project milestones", sec);
      var t4 = [[hdr("Fee"), hdr("Installment"), hdr("%"), hdr("Condition / Trigger Milestone"), hdr("Target Date")]];
      B.forEach(function (b) { t4.push([cell(b.fee, { bold: true, fontSize: 9.5 }), cell(b.inst, { align: "center" }), cell(h.fmtP(b.pct), { align: "center", bold: true, color: C.blue2 }),
        cell(cut(b.cond || b.msName, 90), { fontSize: 9.5 }), cell(b.msEnd != null ? enDate(b.msEnd) : "–", { align: "center", fontSize: 9.5 })]); });
      pm.addTable(t4, { x: 0.8, y: 1.75, w: W - 1.6, colW: [3.0, 1.1, 0.8, 5.0, 1.83], rowH: 0.36, border: { type: "solid", pt: 0.5, color: C.line }, fill: { color: C.white }, margin: [3, 7, 3, 7] });
    }

    // ===== PART VI key success factors
    sec = part("KEY SUCCESS FACTORS");
    var ks = slide("KO Content", "KEY SUCCESS FACTORS", null, sec);
    if (A.ksf) ks.addImage({ data: A.ksf, x: 0.6, y: 1.55, w: 3.6, h: 5.15, sizing: { type: "cover", w: 3.6, h: 5.15 } });
    KO.KSF.forEach(function (t, i) {
      var y = 1.65 + i * 1.0;
      sq(ks, i + 1, 4.75, y + 0.12, 0.45);
      ks.addText(t, { x: 5.45, y: y, w: 7.3, h: 0.7, fontSize: 14, color: C.ink, valign: "middle", margin: 0, isTextBox: true });
    });

    // ===== PART VII next steps
    sec = part("NEXT STEPS");
    if (K.kickoff != null) {
      var CL = KO.calendar(K), m0 = CL.m0, dow0 = CL.dow0, weeks = CL.weeks, ev = CL.ev, KC = { start: C.blue2, chg: C.orange, done: C.red, ko: C.red };
      var cal = slide("KO Content", "KEY UPCOMING ACTIVITIES", CL.title, sec);
      var gx = 0.6, gw = W - 1.2, cwid = [1, 1, 1, 1, 1, 0.55, 0.55], sw = cwid.reduce(function (a, b) { return a + b; }, 0), top = 1.65, hh = 0.38, rh = (H - 0.75 - top - hh) / weeks;
      var cx = function (i) { return gx + cwid.slice(0, i).reduce(function (a, b) { return a + b; }, 0) / sw * gw; };
      ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].forEach(function (d, i) {
        cal.addText(d, { x: cx(i), y: top, w: cwid[i] / sw * gw, h: hh, fontSize: 9.5, bold: true, color: C.white, fill: { color: i > 4 ? "44546A" : C.navy }, align: "center", valign: "middle", margin: 0, isTextBox: true }); });
      for (var c0 = 0; c0 < weeks * 7; c0++) {
        var wi = Math.floor(c0 / 7), di = c0 % 7, day = c0 - dow0 + 1, x = cx(di), y = top + hh + wi * rh, wdt = cwid[di] / sw * gw;
        cal.addShape(pres.ShapeType.rect, { x: x, y: y, w: wdt, h: rh, fill: { color: di > 4 ? "F2F2F2" : C.white }, line: { color: C.line, width: 0.5 } });
        if (day < 1 || day > CL.days) continue;
        var t = m0 + (day - 1) * h.DAY;
        cal.addText(String(day), { x: x + wdt - 0.45, y: y + 0.03, w: 0.4, h: 0.22, fontSize: 9, color: C.soft, align: "right", margin: 0, isTextBox: true });
        var e = ev[String(t)];
        if (e) cal.addText(e.slice(0, 3).map(function (o, j, a) { return { text: cut(o.t, 34), options: { color: KC[o.k], bold: true, breakLine: j < a.length - 1 } }; }),
          { x: x + 0.06, y: y + 0.24, w: wdt - 0.12, h: rh - 0.28, fontSize: 8, valign: "top", margin: 0, isTextBox: true });
      }
      var nxs = slide("KO Content", "NEXT STEPS / ACTIONS", "First " + "6 weeks after kick-off", sec);
      var DEL = KO.DEL;
      var acts = KO.nextSteps(K);
      var t5 = [[hdr("#"), hdr("Next Steps / Actions"), hdr("Owner"), hdr("Due Date"), hdr("Expected Deliverables"), hdr("Remarks")]];
      acts.forEach(function (x, i) { t5.push([cell(i + 1, { align: "center" }), cell(h.stageName(x), { bold: true }), cell(OWN[x.id] || "Joint", { align: "center" }), cell(dShort(x.p1[1]), { align: "center" }), cell(DEL[x.id] || "", { color: C.grey }), cell("")]); });
      for (var k = acts.length; k < 10; k++) t5.push([cell(k + 1, { align: "center" }), cell(""), cell(""), cell(""), cell(""), cell("")]);
      nxs.addTable(t5, { x: 0.6, y: 1.65, w: W - 1.2, colW: [0.5, 4.2, 1.0, 1.2, 3.4, 1.83], rowH: 0.42, border: { type: "solid", pt: 0.5, color: C.line }, fill: { color: C.white }, margin: [3, 7, 3, 7] });
    }

    // ===== Appendix
    sec = "Appendix"; pres.addSection({ title: sec });
    var ap = pres.addSlide({ masterName: "KO Part", sectionTitle: sec }); ap.addText(" ", { placeholder: "sub" }); ap.addText("APPENDIX", { placeholder: "title" });
    var rk = slide("KO Content", "RISK MANAGEMENT", null, sec);
    var LV = { Low: C.green, Medium: C.amber, High: C.red };
    var RISKS = KO.RISKS;
    var t6 = [[hdr("#"), hdr("Risks"), hdr("Plan"), hdr("Probability"), hdr("Impact"), hdr("Risk Impact")]];
    RISKS.forEach(function (r0, i) { t6.push([cell(i + 1, { align: "center" }), cell(r0[0]), cell(r0[1], { color: C.grey }), cell(r0[2], { align: "center", bold: true, color: LV[r0[2]] }), cell(r0[3], { align: "center", bold: true, color: LV[r0[3]] }), cell(r0[4], { fontSize: 9 })]); });
    rk.addTable(t6, { x: 0.6, y: 1.55, w: W - 1.2, colW: [0.45, 4.1, 4.3, 1.0, 0.9, 1.38], rowH: 0.45, border: { type: "solid", pt: 0.5, color: C.line }, fill: { color: C.white }, margin: [2, 6, 2, 6], fontSize: 9.5 });
    var rr = slide("KO Content", "ROLE & RESPONSIBILITIES", null, sec);
    if (A.rr) rr.addImage({ data: A.rr, x: 0, y: 1.55, w: 3.7, h: 5.2, sizing: { type: "cover", w: 3.7, h: 5.2 } });
    var RR = KO.RR;
    rr.addText(RR.map(function (r0, i, a) { return [{ text: r0[0], options: { bold: true, color: C.blue2, fontSize: 11.5, breakLine: true } }, { text: r0[1], options: { color: C.ink, fontSize: 10.5, breakLine: i < a.length - 1, paraSpaceAfter: 8 } }]; })
      .reduce(function (a, b) { return a.concat(b); }, []), { x: 4.2, y: 1.6, w: 8.6, h: 5.1, valign: "top", margin: 0, isTextBox: true });
    var rp = slide("KO Content Center", "PROJECT REPORTING", null, sec);
    var DOCS = KO.DOCS;
    var t7 = [[hdr("Document List"), hdr("Objectives"), hdr("Timeline")]];
    DOCS.forEach(function (d) { t7.push([cell(d[0], { bold: true }), cell(d[1], { color: C.grey }), cell(d[2], { align: "center", fontSize: 9.5 })]); });
    rp.addTable(t7, { x: 0.8, y: 1.6, w: W - 1.6, colW: [2.8, 6.4, 2.53], rowH: 0.47, border: { type: "solid", pt: 0.5, color: C.line }, fill: { color: C.white }, margin: [3, 7, 3, 7] });
    var sr = slide("KO Content Center", "SYSTEM REQUIREMENTS", null, sec);
    var t8 = [[hdr("Items"), hdr("Information")]].concat(KO.SYSREQ.map(function (d) { return [cell(d[0], { bold: true }), cell(d[1])]; }));
    sr.addTable(t8, { x: 1.6, y: 1.9, w: W - 3.2, colW: [2.8, 7.33], rowH: 0.75, border: { type: "solid", pt: 0.5, color: C.line }, fill: { color: C.white }, margin: [5, 10, 5, 10], fontSize: 12 });

    // ===== closing
    var cl0 = pres.addSlide({ masterName: "KO Closing", sectionTitle: sec });
    cl0.addText("THANK YOU", { placeholder: "title" }); cl0.addText("If you have any questions, please feel free to ask!", { placeholder: "body" });
    return pres;
  }

  // =====================================================================================
  // Project Charter deck (PMI / PMBOK) – same masters as the Kick-off deck; content from h.charterModel(M)
  // =====================================================================================
  function buildCharter(M, PptxGenJS, h, A) {
    var CH = h.charterModel(M);
    if (!CH) throw new Error("ไฟล์นี้ยังไม่มีชีท Charter – ใช้ Template V.1 ฉบับล่าสุด");
    var B = koBase(M, PptxGenJS, h, A, "Project Charter"), KO = h.KO, R = h.CHR;
    var C = B.C, P = B.P, enDate = B.enDate, dShort = B.dShort, pres = B.pres, slide = B.slide, box = B.box, sq = B.sq, hdr = B.hdr, cell = B.cell;
    var client = CH.client, vendor = CH.vendor, sec = "Project Charter";
    var money = function (v) { return Math.round(v).toLocaleString("en-US"); };
    var stCol = /approved/i.test(CH.status) ? "2E9E6B" : /approval/i.test(CH.status) ? C.blue : "E0A100";
    var LV = { Low: C.green, Medium: C.amber, High: C.red };
    var bul = function (arr, o) { return arr.map(function (t, i, a) { return { text: t, options: Object.assign({ bullet: { indent: 9 }, breakLine: i < a.length - 1 }, o || {}) }; }); };
    var tbl = function (s, rows, o) { s.addTable(rows, Object.assign({ border: { type: "solid", pt: 0.5, color: C.line }, fill: { color: C.white }, margin: [3, 6, 3, 6] }, o)); };
    var head = function (s, t, x, y, w, col) { s.addText(t, { x: x, y: y, w: w, h: 0.3, fontSize: 10.5, bold: true, color: col || C.blue2, charSpacing: 1, margin: 0, isTextBox: true }); };
    var pill = function (s, x, y) { s.addText(CH.status, { shape: pres.ShapeType.roundRect, rectRadius: 0.12, x: x, y: y, w: 1.25, h: 0.28, fontSize: 9.5, bold: true, color: C.white, fill: { color: stCol }, line: { type: "none" }, align: "center", valign: "middle", margin: 0 }); };
    pres.addSection({ title: sec });

    // 1 cover
    var cv = pres.addSlide({ masterName: "KO Cover", sectionTitle: sec });
    cv.addText("PROJECT CHARTER", { placeholder: "title" });
    cv.addText([{ text: CH.name + " for " + client, options: { breakLine: true } }, { text: "Version " + CH.version + " · " + enDate(CH.date), options: { fontSize: 13, color: C.soft } }], { placeholder: "body" });
    pill(cv, 4.6, 4.2);
    if (P.logo && /^data:image\//.test(P.logo)) cv.addImage({ data: P.logo.replace(/^data:/, ""), x: 4.6, y: 4.75, w: 2.0, h: 0.9, sizing: { type: "contain", w: 2.0, h: 0.9 } });
    else cv.addText("Client's Logo", { x: 4.6, y: 4.75, w: 2.0, h: 0.8, fontSize: 10, color: C.soft, align: "center", valign: "middle", margin: 0, line: { color: C.line, width: 1, dashType: "dash" }, isTextBox: true });

    // 2 canvas
    var cs = slide("KO Content", "PROJECT CHARTER CANVAS", "One-page summary for Sponsor approval · Version " + CH.version, sec);
    pill(cs, 5.6, 1.17);
    var gx = 0.6, gy = 1.6, gw = W - 1.2, gap = 0.08, cw = (gw - 3 * gap) / 4, rh = 1.48;
    var tile = function (c, r, span, k, t, col, runs) {
      var x = gx + c * (cw + gap), y = gy + r * (rh + gap), w = cw * span + gap * (span - 1);
      cs.addShape(pres.ShapeType.rect, { x: x, y: y, w: w, h: rh, fill: { color: C.white }, line: { color: "E7E7E7", width: 0.5 } });
      cs.addShape(pres.ShapeType.rect, { x: x, y: y, w: 0.05, h: rh, fill: { color: col }, line: { type: "none" } });
      cs.addText([{ text: k + "  ", options: { bold: true, color: C.navy, fontSize: 9, charSpacing: 1 } }, { text: t.toUpperCase(), options: { color: C.soft, fontSize: 7 } }], { x: x + 0.12, y: y + 0.04, w: w - 0.2, h: 0.22, margin: 0, isTextBox: true });
      cs.addText(runs, { x: x + 0.12, y: y + 0.27, w: w - 0.2, h: rh - 0.32, fontSize: 7.5, color: C.ink, valign: "top", margin: 0, paraSpaceAfter: 1.5, isTextBox: true, fit: "shrink" });
    };
    var b = function (t) { return { text: t, options: { bold: true } }; };
    tile(0, 0, 1, "WHY", "Business case", C.navy, [{ text: h.short ? (CH.businessCase || CH.purpose) : (CH.businessCase || CH.purpose) }]);
    tile(1, 0, 2, "WHAT", "SMART objectives", C.navy, CH.objectives.slice(0, 5).map(function (o, i, a) { return { text: o.text + (o.target ? "  → " + o.target : ""), options: { bullet: { indent: 9 }, breakLine: i < a.length - 1 } }; }));
    tile(3, 0, 1, "DONE", "Success criteria", C.navy, bul(CH.success.slice(0, 5).map(function (o) { return o.text; })));
    tile(0, 1, 1, "IN", "In scope", C.blue, bul(CH.phases.map(function (p) { return p.name + ": " + (p.modules.map(function (m) { return m.name; }).join(", ") || "–"); }).concat(CH.intsAll.length ? ["Interfaces: " + CH.intsAll.length + " systems"] : [])));
    tile(1, 1, 1, "OUT", "Out of scope", "A5A5A5", bul(CH.outScope.slice(0, 5)));
    tile(2, 1, 1, "DELIVER", "Key deliverables", C.blue, bul(CH.deliverables.slice(0, 6).map(function (d) { return d.text; })));
    tile(3, 1, 1, "WHEN", "Key milestones", C.blue, bul(CH.milestones.map(function (m) { return m.name + ": " + m.items.filter(function (x) { return /Kick|Go-live/.test(x.name); }).map(function (x) { return x.name + " " + dShort(x.date); }).join(" → "); })));
    tile(0, 2, 1, "COST", "Budget", C.orange, [{ text: (CH.total ? money(CH.total) + " " + CH.currency : "As per contract") + " · reserve " + h.fmtP(CH.contingency), options: { bold: true, breakLine: true } }]
      .concat(bul(CH.fees.map(function (f) { return f.fee + " – " + f.inst.length + " installments"; }))));
    var nC = M.kickoff ? M.kickoff.team.filter(function (t) { return t.name && t.side !== "HMC"; }).length : 0, nH = M.kickoff ? M.kickoff.team.filter(function (t) { return t.name && t.side === "HMC"; }).length : 0;
    tile(1, 2, 1, "WHO", "Sponsors & team", C.orange, bul(["Sponsors: " + (CH.sponsorC || "–") + " · " + (CH.sponsorH || "–"), "PMs: " + (CH.pmC || "–") + " · " + (CH.pmH || "–"), "Team: " + nC + " " + client + " · " + nH + " " + vendor]));
    tile(2, 2, 1, "RISK", "Top risks", C.red, bul(CH.risks.slice().sort(function (a, c) { return c.score - a.score; }).slice(0, 3).map(function (r) { return "[" + r.prob.charAt(0) + "/" + r.impact.charAt(0) + "] " + r.text; })));
    tile(3, 2, 1, "IF", "Assumptions & constraints", "E0A100", bul(CH.assumptions.slice(0, 2).map(function (x) { return "A · " + x; }).concat(CH.constraints.slice(0, 2).map(function (x) { return "C · " + x; }))));
    var sy = gy + 3 * (rh + gap);
    cs.addShape(pres.ShapeType.rect, { x: gx, y: sy, w: gw, h: 0.5, fill: { color: "EEF2F9" }, line: { type: "none" } });
    CH.approvers.slice(0, 4).forEach(function (a, i) { var x = gx + 0.2 + i * (gw / 4);
      cs.addShape(pres.ShapeType.line, { x: x, y: sy + 0.18, w: gw / 4 - 0.4, h: 0, line: { color: "8C8C8C", width: 0.75 } });
      cs.addText([{ text: (a.name || "") + "  ", options: { bold: true, color: C.ink } }, { text: a.title + " · " + a.org, options: { color: C.grey } }], { x: x, y: sy + 0.21, w: gw / 4 - 0.3, h: 0.25, fontSize: 7.5, margin: 0, isTextBox: true, fit: "shrink" }); });

    // 3 business case & purpose
    var bc = slide("KO Content", "BUSINESS CASE & PURPOSE", "Why we are doing this project and what success looks like", sec);
    bc.addShape(pres.ShapeType.roundRect, { x: 0.6, y: 1.65, w: 6.4, h: 1.9, rectRadius: 0.12, fill: { color: C.navy }, line: { type: "none" } });
    bc.addText([{ text: "PROJECT PURPOSE / VISION", options: { fontSize: 8.5, color: C.ice, charSpacing: 2, breakLine: true } }, { text: CH.purpose, options: { fontSize: 15, bold: true, color: C.white } }],
      { x: 0.85, y: 1.75, w: 5.9, h: 1.7, valign: "middle", margin: 0, isTextBox: true, fit: "shrink" });
    head(bc, "BUSINESS CASE / PROBLEM STATEMENT", 0.6, 3.75, 6.4);
    bc.addText(CH.businessCase || "(กรอก Business Case ในชีท Charter: ปัญหาเดิม · โอกาส · ผลกระทบถ้าไม่ทำ)", { x: 0.6, y: 4.1, w: 6.4, h: 2.6, fontSize: 12.5, color: CH.businessCase ? C.ink : "B45309", valign: "top", margin: 0, isTextBox: true, fit: "shrink" });
    head(bc, "EXPECTED BENEFITS", 7.6, 1.6, 5);
    KO.BENEFITS.slice(0, 8).forEach(function (t, i) { var y = 2.0 + i * 0.6; sq(bc, i + 1, 7.6, y, 0.36); bc.addText(t, { x: 8.1, y: y - 0.04, w: 4.7, h: 0.44, fontSize: 12.5, bold: true, color: C.ink, valign: "middle", margin: 0, isTextBox: true }); });

    // 4 objectives & success
    var ob = slide("KO Content", "OBJECTIVES & SUCCESS CRITERIA", null, sec);
    if (h.lang && h.lang() === "th") ob.addText([{ text: "วัตถุประสงค์ต้องเป็นแบบ " }, { text: "SMART: เฉพาะเจาะจง · วัดผลได้ · ทำได้จริง · สอดคล้อง · มีกรอบเวลา", options: { bold: true, color: C.blue2 } }], { placeholder: "sub" }); else
    ob.addText([{ text: "Objectives are " }].concat(["Specific ", "Measurable ", "Achievable ", "Relevant ", "Time-bound"].map(function (w0) { return { text: w0.charAt(0), options: { bold: true, color: C.blue, fontSize: 14 } }; })
      .reduce(function (a, r, i) { return a.concat([r, { text: ["pecific ", "easurable ", "chievable ", "elevant ", "ime-bound"][i], options: { bold: true, color: C.blue2 } }]); }, [])), { placeholder: "sub" });
    var to = [[hdr("#"), hdr("Objective"), hdr("KPI / Measure"), hdr("Target"), hdr("Owner")]];
    CH.objectives.forEach(function (o, i) { to.push([cell(i + 1, { align: "center" }), cell(o.text, { bold: true }), cell(o.kpi, { color: C.grey }), cell(o.target, { bold: true, color: C.blue2 }), cell(o.owner, { align: "center" })]); });
    tbl(ob, to, { x: 0.6, y: 1.6, w: W - 1.2, colW: [0.4, 4.6, 2.3, 3.25, 1.58], rowH: 0.32, fontSize: 9.5 });
    var oy = 1.6 + 0.32 * (CH.objectives.length + 1) + 0.25;
    head(ob, "SUCCESS CRITERIA (PROJECT ACCEPTANCE)", 0.6, oy, 8);
    var ts = [[hdr("✓"), hdr("Success criterion"), hdr("Evidence / Measure"), hdr("Accepted by")]];
    CH.success.forEach(function (o) { ts.push([cell("✓", { align: "center", bold: true, color: "2E9E6B" }), cell(o.text, { bold: true }), cell(o.measure, { color: C.grey }), cell(o.by, { align: "center" })]); });
    tbl(ob, ts, { x: 0.6, y: oy + 0.35, w: W - 1.2, colW: [0.4, 5.6, 3.6, 2.53], rowH: 0.3, fontSize: 9.5 });

    // 5 scope
    var sc = slide("KO Content", "SCOPE STATEMENT", "What is in and out · anything outside goes through Change Request", sec);
    box(sc, 0.6, 1.6, 7.0, 5.1); box(sc, 7.85, 1.6, 4.88, 5.1);
    head(sc, "✓ IN SCOPE", 0.85, 1.75, 4, "2E9E6B"); head(sc, "✕ OUT OF SCOPE", 8.1, 1.75, 4, C.red);
    var yy = 2.15;
    CH.phases.forEach(function (p) {
      sc.addText([{ text: p.name + "  ", options: { bold: true, color: C.navy, fontSize: 12 } }, { text: "Go-live " + enDate(p.golive), options: { color: C.soft, fontSize: 9.5 } }], { x: 0.85, y: yy, w: 6.5, h: 0.3, margin: 0, isTextBox: true });
      yy += 0.36; var x = 0.85;
      p.modules.forEach(function (m) { var w0 = Math.min(3, 0.3 + m.name.length * 0.075); if (x + w0 > 7.35) { x = 0.85; yy += 0.36; }
        sc.addText(m.name, { shape: pres.ShapeType.roundRect, rectRadius: 0.15, x: x, y: yy, w: w0, h: 0.28, fontSize: 9, bold: true, color: C.blue2, fill: { color: "E9EEF8" }, line: { type: "none" }, align: "center", valign: "middle", margin: 0 }); x += w0 + 0.08; });
      yy += 0.38;
      if (p.ints.length) { sc.addText("Interfaces: " + p.ints.map(function (i0) { return i0.system; }).join(" · "), { x: 0.85, y: yy, w: 6.5, h: 0.45, fontSize: 8.5, color: C.grey, valign: "top", margin: 0, isTextBox: true, fit: "shrink" }); yy += 0.5; }
      yy += 0.15;
    });
    sc.addText(CH.outScope.map(function (t, i, a) { return { text: "✕  " + t, options: { breakLine: i < a.length - 1, paraSpaceAfter: 7 } }; }), { x: 8.1, y: 2.15, w: 4.4, h: 4.4, fontSize: 10.5, color: C.ink, valign: "top", margin: 0, isTextBox: true, fit: "shrink" });

    // 6 deliverables
    var dl = slide("KO Content Center", "DELIVERABLES & ACCEPTANCE", "Due dates follow the Schedule stage linked in sheet Charter", sec);
    var td0 = [[hdr("#"), hdr("Deliverable"), hdr("Phase"), hdr("Accepted by"), hdr("Due (Phase 1 / Phase 2)")]];
    CH.deliverables.forEach(function (d, i) { td0.push([cell(i + 1, { align: "center" }), cell(d.text, { bold: true }), cell(d.phase, { align: "center" }), cell(d.by, { align: "center" }), cell(d.due.length ? d.due.map(dShort).join(" / ") : "–", { align: "center" })]); });
    tbl(dl, td0, { x: 0.6, y: 1.6, w: W - 1.2, colW: [0.45, 4.6, 1.2, 2.6, 3.28], rowH: Math.min(0.42, 5.0 / (CH.deliverables.length + 1)), fontSize: 10 });

    // 7 milestones
    var mlS = slide("KO Content", "SUMMARY MILESTONE SCHEDULE", "Calculated from Go-live − duration (sheet Kickoff / Schedule)", sec);
    if (!CH.milestones.length) mlS.addText("(ใส่ Go-live Date และ Duration ในชีท Kickoff แล้ววันที่ทุก Milestone จะคำนวณให้อัตโนมัติ)", { x: 0.6, y: 1.7, w: 10, h: 0.4, fontSize: 12, color: "B45309", margin: 0, isTextBox: true });
    CH.milestones.forEach(function (m, mi) {
      var y0 = 1.65 + mi * 2.6, t0 = m.start, t1 = Math.max.apply(null, m.items.map(function (x) { return x.date; }).concat([m.golive]));
      var X = function (t) { return 0.85 + (t - t0) / (t1 - t0 || 1) * (W - 1.9); };
      mlS.addText([{ text: m.name + "  ", options: { bold: true, color: C.navy, fontSize: 13 } }, { text: enDate(m.start) + " → Go-live " + enDate(m.golive), options: { color: C.grey, fontSize: 10 } }], { x: 0.6, y: y0, w: 9, h: 0.3, margin: 0, isTextBox: true });
      var ly = y0 + 1.25;
      mlS.addShape(pres.ShapeType.rect, { x: 0.7, y: ly - 0.025, w: W - 1.6, h: 0.05, fill: { color: C.blue }, line: { type: "none" } });
      m.items.forEach(function (x, i) { var cx = X(x.date), up = i % 2 === 0, gl = /Go-live/.test(x.name);
        mlS.addShape(pres.ShapeType.diamond, { x: cx - 0.1, y: ly - 0.1, w: 0.2, h: 0.2, fill: { color: gl ? C.orange : C.white }, line: { color: gl ? C.orange : C.blue, width: 2 } });
        mlS.addText([{ text: x.name, options: { bold: true, color: C.ink, fontSize: 9.5, breakLine: true } }, { text: enDate(x.date), options: { bold: true, color: C.blue2, fontSize: 9 } }],
          { x: cx - 0.95, y: up ? ly - 0.75 : ly + 0.18, w: 1.9, h: 0.55, align: "center", valign: up ? "bottom" : "top", margin: 0, isTextBox: true }); });
    });

    // 8 budget
    var bu = slide("KO Content", "BUDGET SUMMARY", "Payment installments are triggered by project milestones (sheet Billing)", sec);
    [["TOTAL BUDGET", CH.total ? money(CH.total) + " " + CH.currency : "As per contract", true], ["CONTINGENCY RESERVE", h.fmtP(CH.contingency) + (CH.reserve ? " · " + money(CH.reserve) + " " + CH.currency : ""), false],
     ["INSTALLMENTS", CH.fees.reduce(function (a, f) { return a + f.inst.length; }, 0) + " across " + CH.fees.length + " fee types", false]].forEach(function (k, i) {
      var y = 1.65 + i * 0.95;
      bu.addShape(pres.ShapeType.roundRect, { x: 0.6, y: y, w: 3.2, h: 0.82, rectRadius: 0.1, fill: { color: k[2] ? C.navy : "EEF2F9" }, line: { type: "none" } });
      bu.addText([{ text: k[0], options: { fontSize: 7.5, color: k[2] ? C.ice : C.soft, charSpacing: 1.5, breakLine: true } }, { text: k[1], options: { fontSize: k[2] ? 18 : 12.5, bold: true, color: k[2] ? C.white : C.navy } }],
        { x: 0.8, y: y + 0.05, w: 2.9, h: 0.72, valign: "middle", margin: 0, isTextBox: true, fit: "shrink" }); });
    bu.addText("Use of contingency is reported to the Steering Committee · new scope is costed through Change Request", { x: 0.6, y: 4.6, w: 3.2, h: 0.8, fontSize: 9.5, color: C.grey, valign: "top", margin: 0, isTextBox: true });
    var tb = [[hdr("Fee"), hdr("#"), hdr("%"), hdr("Trigger milestone"), hdr("Target date"), hdr("Amount")]];
    CH.fees.forEach(function (f) { f.inst.forEach(function (x, i) { tb.push([cell(i ? "" : f.fee, { bold: true, fontSize: 8.5 }), cell(x.n, { align: "center", fontSize: 8.5 }), cell(h.fmtP(x.pct), { align: "center", bold: true, color: C.blue2, fontSize: 8.5 }),
      cell(x.trigger || x.cond || "", { fontSize: 8.5 }), cell(x.date != null ? enDate(x.date) : "–", { align: "center", fontSize: 8.5 }), cell(f.amount ? money(f.amount * x.pct) : "–", { align: "right", fontSize: 8.5 })]); }); });
    tbl(bu, tb, { x: 4.1, y: 1.65, w: W - 4.7, colW: [2.2, 0.35, 0.5, 2.9, 1.25, 1.43], rowH: Math.min(0.32, 5.1 / tb.length), margin: [2, 5, 2, 5] });

    // 9 stakeholder map
    var sm = slide("KO Content", "STAKEHOLDER MAP", "Power / interest grid · engagement strategy per quadrant" + (CH.stakeAuto ? " · grouped from the project team (sheet Kickoff)" : ""), sec);
    var qx = 0.95, qy = 1.55, qw = (W - 1.55 - 0.1) / 2, qh = 2.6;
    sm.addText("INFLUENCE →", { x: 0.0, y: qy + qh - 0.15, w: 1.6, h: 0.3, fontSize: 8, bold: true, color: C.soft, charSpacing: 2, rotate: 270, align: "center", margin: 0, isTextBox: true });
    sm.addText("INTEREST →", { x: W - 2.2, y: qy + 2 * qh + 0.12, w: 1.6, h: 0.25, fontSize: 8, bold: true, color: C.soft, charSpacing: 2, align: "right", margin: 0, isTextBox: true });
    R.QUAD.forEach(function (q, i) {
      var x = qx + (i % 2) * (qw + 0.1), y = qy + Math.floor(i / 2) * (qh + 0.1), list = CH.quads[i];
      sm.addShape(pres.ShapeType.roundRect, { x: x, y: y, w: qw, h: qh, rectRadius: 0.08, fill: { color: i === 1 ? "E5EDFB" : "F2F5FA" }, line: { color: i === 1 ? "B4C7E7" : "E3E8F0", width: 0.75 } });
      sm.addText([{ text: q[0], options: { bold: true, color: C.navy, fontSize: 13, breakLine: true } }, { text: q[1], options: { color: C.soft, fontSize: 8.5 } }], { x: x + 0.2, y: y + 0.1, w: qw - 0.4, h: 0.5, margin: 0, isTextBox: true });
      var cx = x + 0.2, cy = y + 0.72;
      list.slice(0, 12).forEach(function (s0) { var lab = s0.name + (s0.n ? " ×" + s0.n : "") + "  " + (s0.org === "Client" ? (P.short || "Client") : s0.org), w0 = Math.min(qw - 0.4, 0.3 + lab.length * 0.068);
        if (cx + w0 > x + qw - 0.2) { cx = x + 0.2; cy += 0.36; }
        sm.addText(lab, { shape: pres.ShapeType.roundRect, rectRadius: 0.15, x: cx, y: cy, w: w0, h: 0.28, fontSize: 8.5, bold: true, color: C.white, fill: { color: /hmc|human/i.test(s0.org) ? C.orange : /third/i.test(s0.org) ? "7F7F7F" : C.navy }, line: { type: "none" }, align: "center", valign: "middle", margin: 0 });
        cx += w0 + 0.08; });
    });

    // 10 RACI
    var rc = slide("KO Content Center", "RACI MATRIX", "Who is Responsible · Accountable · Consulted · Informed", sec);
    var RF = { R: ["DBE7FB", C.blue2], A: [C.navy, C.white], C: ["FFF1DC", "C55A11"], I: [C.white, C.soft] };
    var tr = [[hdr("Activity / Deliverable")].concat(R.RACI_ROLES.map(function (r0) { return hdr(r0, { fontSize: 9 }); }))];
    R.RACI.forEach(function (r0) { tr.push([cell(r0[0], { bold: true })].concat(r0.slice(1).map(function (v) { return cell(v, { align: "center", bold: true, fontSize: 11, fill: { color: RF[v][0] }, color: RF[v][1] }); }))); });
    tbl(rc, tr, { x: 0.6, y: 1.6, w: W - 1.2, colW: [3.0, 1.5, 1.2, 1.2, 2.13, 1.5, 1.6], rowH: 0.4 });
    R.RACI_KEY.forEach(function (k, i) { var x = 1.6 + i * 2.7;
      rc.addText(k[0], { x: x, y: 6.3, w: 0.32, h: 0.32, fontSize: 11, bold: true, align: "center", valign: "middle", margin: 0, color: RF[k[0]][1], fill: { color: RF[k[0]][0] }, line: { color: C.line, width: 0.5 } });
      rc.addText([{ text: k[1] + " ", options: { bold: true, color: C.ink } }, { text: k[2], options: { color: C.grey } }], { x: x + 0.4, y: 6.3, w: 2.2, h: 0.32, fontSize: 9.5, valign: "middle", margin: 0, isTextBox: true }); });

    // 11 risks / assumptions / constraints
    var ra = slide("KO Content", "RISKS · ASSUMPTIONS · CONSTRAINTS", "High-level risks at initiation" + (CH.riskAuto ? " (standard register – add project-specific risks in sheet Charter)" : ""), sec);
    var trk = [[hdr("Risk"), hdr("P"), hdr("I"), hdr("Response"), hdr("Owner")]];
    CH.risks.slice(0, 6).forEach(function (r0) { trk.push([cell(r0.text, { fontSize: 9 }), cell(r0.prob.charAt(0), { align: "center", bold: true, color: LV[r0.prob] || C.amber }), cell(r0.impact.charAt(0), { align: "center", bold: true, color: LV[r0.impact] || C.amber }),
      cell(r0.resp, { fontSize: 9, color: C.grey }), cell(r0.owner, { align: "center", fontSize: 9 })]); });
    tbl(ra, trk, { x: 0.6, y: 1.6, w: 7.4, colW: [2.9, 0.4, 0.4, 2.95, 0.75], rowH: 0.5 });
    head(ra, "ASSUMPTIONS", 8.35, 1.6, 4.3);
    ra.addText(bul(CH.assumptions, { paraSpaceAfter: 4 }), { x: 8.35, y: 1.95, w: 4.4, h: 2.3, fontSize: 10, color: C.ink, valign: "top", margin: 0, isTextBox: true, fit: "shrink" });
    head(ra, "CONSTRAINTS", 8.35, 4.35, 4.3);
    ra.addText(bul(CH.constraints, { paraSpaceAfter: 4 }), { x: 8.35, y: 4.7, w: 4.4, h: 2.0, fontSize: 10, color: C.ink, valign: "top", margin: 0, isTextBox: true, fit: "shrink" });

    // 12 governance & authority
    var gv = slide("KO Content", "GOVERNANCE & PM AUTHORITY", "Decision rights, escalation path and change control", sec);
    [["Sponsors / Steering Committee", "Scope, budget, milestone changes · CR > " + CH.crLimit + " man-days", CH.steering, C.navy],
     ["Project Managers", "Resolve within " + CH.sla + " business days · CR ≤ " + CH.crLimit + " man-days", "", C.blue2],
     ["Project Team", "Day-to-day issues · weekly status", CH.weekly, "6F95D8"]].forEach(function (l, i) {
      var y = 1.65 + i * 1.45;
      gv.addShape(pres.ShapeType.roundRect, { x: 0.6, y: y, w: 4.7, h: 1.1, rectRadius: 0.1, fill: { color: l[3] }, line: { type: "none" } });
      gv.addText([{ text: l[0], options: { bold: true, fontSize: 13, color: C.white, breakLine: true } }, { text: l[1], options: { fontSize: 9.5, color: "E6ECF5", breakLine: !!l[2] } }].concat(l[2] ? [{ text: "◷ " + l[2], options: { fontSize: 9, color: "D6E2F5" } }] : []),
        { x: 0.8, y: y + 0.05, w: 4.4, h: 1.0, valign: "middle", margin: 0, isTextBox: true });
      if (i < 2) gv.addText("▲ escalate", { x: 0.6, y: y + 1.12, w: 4.7, h: 0.3, fontSize: 8.5, color: C.soft, align: "center", margin: 0, isTextBox: true });
    });
    var ta = [[hdr("Area"), hdr("Project Manager authority")]];
    CH.authority.forEach(function (a) { ta.push([cell(a.area, { bold: true }), cell(a.level, { fontSize: 9.5 })]); });
    tbl(gv, ta, { x: 5.7, y: 1.65, w: W - 6.3, colW: [1.6, W - 7.9], rowH: Math.min(0.62, 5.0 / ta.length) });

    // 13 approval
    var ap = slide("KO Content", "APPROVAL & SIGN-OFF", "Charter version " + CH.version + " · " + enDate(CH.date), sec);
    ap.addText("By signing this charter the sponsors formally authorize the project, commit the resources described above and give the Project Managers the authority stated in Governance & PM Authority.",
      { x: 0.6, y: 1.55, w: 10.5, h: 0.6, fontSize: 12, color: C.grey, valign: "top", margin: 0, isTextBox: true });
    CH.approvers.slice(0, 6).forEach(function (a, i) {
      var nRow = Math.ceil(Math.min(CH.approvers.length, 6) / 2), bh = nRow > 2 ? 1.4 : 1.95, x = 0.6 + (i % 2) * 6.2, y = 2.35 + Math.floor(i / 2) * (bh + 0.2);
      box(ap, x, y, 5.9, bh);
      ap.addText([{ text: String(a.org).toUpperCase(), options: { fontSize: 8, color: C.soft, charSpacing: 1, breakLine: true } }, { text: a.name || "", options: { fontSize: 15, bold: true, color: C.ink, breakLine: true } }, { text: a.title, options: { fontSize: 10.5, color: C.blue2 } }],
        { x: x + 0.25, y: y + 0.12, w: 5.4, h: 0.85, valign: "top", margin: 0, isTextBox: true });
      [["Signature", 0.25, 3.0], ["Date", 3.5, 2.15]].forEach(function (f) {
        ap.addShape(pres.ShapeType.line, { x: x + f[1], y: y + bh - 0.38, w: f[2], h: 0, line: { color: "8C8C8C", width: 0.75 } });
        ap.addText(f[0], { x: x + f[1], y: y + bh - 0.35, w: f[2], h: 0.22, fontSize: 8, color: C.soft, margin: 0, isTextBox: true }); });
    });
    return pres;
  }

  // =====================================================================================
  // Steering Committee deck – same masters as Kick-off / Charter; content from h.steeringModel(M)
  // =====================================================================================
  var CRF_OPEN = ["Draft", "Submitted", "Approved", "In Progress"];
  function buildSteering(M, PptxGenJS, h, A, mode) {
    var S = h.steeringModel(M, mode), B = koBase(M, PptxGenJS, h, A, "Steering Committee");
    var C = B.C, P = B.P, enDate = B.enDate, pres = B.pres, slide = B.slide, box = B.box, hdr = B.hdr, cell = B.cell, sec = "Steering Committee";
    var SCOL = { "Completed": "2F6FDE", "On Track": "2E9E6B", "At Risk": "E0A100", "Delayed": "D64545", "Not Started": "94A3B8" };
    var col = function (s0) { return SCOL[s0] || "94A3B8"; };
    var fd = h.fmtD, fp = h.fmtP;
    var pill = function (s, t, x, y, w) { s.addText(t, { shape: pres.ShapeType.roundRect, rectRadius: 0.1, x: x, y: y, w: w || 1.15, h: 0.26, fontSize: 9, bold: true, color: C.white, fill: { color: col(t) }, line: { type: "none" }, align: "center", valign: "middle", margin: 0 }); };
    var bar = function (s, x, y, w, pct, plan, c) {
      s.addShape(pres.ShapeType.roundRect, { x: x, y: y, w: w, h: 0.11, rectRadius: 0.05, fill: { color: "E7EBF1" }, line: { type: "none" } });
      if (pct > 0) s.addShape(pres.ShapeType.roundRect, { x: x, y: y, w: Math.max(0.05, w * Math.min(1, pct)), h: 0.11, rectRadius: 0.05, fill: { color: c }, line: { type: "none" } });
      if (plan != null) s.addShape(pres.ShapeType.rect, { x: x + w * Math.min(1, plan) - 0.012, y: y - 0.05, w: 0.025, h: 0.21, fill: { color: C.navy }, line: { type: "none" } });
    };
    var imp = function (v) { return String(v || "").split(/[^A-Za-z]+/).filter(Boolean).map(function (x) { return x.toUpperCase(); }).join(" · "); };
    var chunk = function (arr, k) { var n0 = Math.ceil(arr.length / k) || 1, per = Math.ceil(arr.length / n0) || k, o = []; for (var i = 0; i < arr.length; i += per) o.push(arr.slice(i, i + per)); return o.length ? o : [[]]; };
    var none = function (s, t) { s.addText(t, { x: 0.6, y: 2.2, w: W - 1.2, h: 3.5, fontSize: 16, color: C.soft, align: "center", valign: "middle", margin: 0, line: { color: C.line, width: 1.5, dashType: "dash" }, isTextBox: true }); };
    pres.addSection({ title: sec });

    // 1 cover
    var cv = pres.addSlide({ masterName: "KO Cover", sectionTitle: sec });
    cv.addText("STEERING COMMITTEE", { placeholder: "title" });
    cv.addText([{ text: (P.name || "Project") + " · " + (P.client || ""), options: { breakLine: true } }, { text: enDate(S.rd), options: { fontSize: 13, color: C.soft } }], { placeholder: "body" });
    pill(cv, P.overallStatus, 4.6, 4.25, 1.4);
    if (P.logo && /^data:image\//.test(P.logo)) cv.addImage({ data: P.logo.replace(/^data:/, ""), x: 4.6, y: 4.75, w: 2.0, h: 0.9, sizing: { type: "contain", w: 2.0, h: 0.9 } });
    // 2 agenda
    var AG = ["EXECUTIVE DASHBOARD", "DECISIONS NEEDED (" + S.decisions.length + ")", "FOR ACKNOWLEDGEMENT (" + S.acks.length + ")", "KEY MILESTONE STATUS", "TOP RISKS & ISSUES"].concat(M.crs && M.crs.length ? ["CHANGE REQUESTS"] : []).concat(S.hasBill ? ["PAYMENT MILESTONES VS PLAN"] : []).concat(["NEXT 30 DAYS"]);
    var ag = slide("KO Content", "AGENDA", null, sec);
    if (B.A.building) ag.addImage({ data: B.A.building, x: W - 4.6, y: 0, w: 4.6, h: H, sizing: { type: "cover", w: 4.6, h: H } });
    AG.forEach(function (t, i) { var y = 1.55 + i * 0.72;
      ag.addText(("0" + (i + 1)).slice(-2), { x: 0.6, y: y, w: 0.7, h: 0.5, fontSize: 20, bold: true, color: C.blue, valign: "middle", margin: 0, isTextBox: true });
      ag.addText(t, { x: 1.4, y: y, w: 6.8, h: 0.5, fontSize: 14, color: C.ink, charSpacing: 1, valign: "middle", margin: 0, isTextBox: true }); });
    // 3 dashboard
    var db = slide("KO Content", "EXECUTIVE DASHBOARD", "Status as of " + enDate(S.rd) + " · RAG by PMI performance dimension", sec);
    db.addShape(pres.ShapeType.roundRect, { x: 0.6, y: 1.55, w: 3.4, h: 2.3, rectRadius: 0.12, fill: { color: col(P.overallStatus) }, line: { type: "none" } });
    db.addText([{ text: "OVERALL STATUS", options: { fontSize: 8.5, charSpacing: 2, breakLine: true } }, { text: P.overallStatus, options: { fontSize: 28, bold: true, breakLine: true } },
      { text: "Progress " + fp(P.overall) + "  ·  Plan " + fp(P.overallPlanned), options: { fontSize: 11, breakLine: true } }].concat(S.days != null ? [{ text: S.days + " days to go-live · " + enDate(S.golive), options: { fontSize: 10.5, bold: true } }] : []),
      { x: 0.8, y: 1.65, w: 3.0, h: 1.65, color: C.white, valign: "top", margin: 0, isTextBox: true });
    db.addShape(pres.ShapeType.roundRect, { x: 0.8, y: 3.45, w: 3.0, h: 0.12, rectRadius: 0.06, fill: { color: "FFFFFF", transparency: 60 }, line: { type: "none" } });
    db.addShape(pres.ShapeType.roundRect, { x: 0.8, y: 3.45, w: Math.max(0.06, 3.0 * P.overall), h: 0.12, rectRadius: 0.06, fill: { color: C.white }, line: { type: "none" } });
    db.addShape(pres.ShapeType.rect, { x: 0.8 + 3.0 * Math.min(1, P.overallPlanned) - 0.015, y: 3.39, w: 0.03, h: 0.24, fill: { color: C.navy }, line: { type: "none" } });
    var dw = (W - 4.3 - 0.6 - 3 * 0.12) / 4;
    S.dims.forEach(function (d, i) { var x = 4.3 + i * (dw + 0.12);
      db.addShape(pres.ShapeType.rect, { x: x, y: 1.55, w: dw, h: 1.0, fill: { color: C.white }, line: { color: "E7E7E7", width: 0.5 } });
      db.addShape(pres.ShapeType.rect, { x: x, y: 1.55, w: dw, h: 0.06, fill: { color: col(d.s) }, line: { type: "none" } });
      db.addText(d.k, { x: x + 0.12, y: 1.66, w: dw - 0.2, h: 0.22, fontSize: 9, bold: true, color: C.navy, charSpacing: 1.5, margin: 0, isTextBox: true });
      pill(db, d.s, x + 0.12, 1.92, 1.0);
      db.addText(d.d, { x: x + 0.12, y: 2.22, w: dw - 0.2, h: 0.28, fontSize: 8.5, color: C.grey, margin: 0, isTextBox: true, fit: "shrink" }); });
    db.addShape(pres.ShapeType.rect, { x: 4.3, y: 2.68, w: W - 4.9, h: 1.17, fill: { color: C.white }, line: { color: "E7E7E7", width: 0.5 } });
    db.addShape(pres.ShapeType.rect, { x: 4.3, y: 2.68, w: 0.05, h: 1.17, fill: { color: C.blue }, line: { type: "none" } });
    db.addText([{ text: "ASSESSMENT", options: { fontSize: 7.5, color: C.soft, charSpacing: 1.5, breakLine: true } }, { text: P.rationale || "(ใส่ Assessment Rationale ในชีท Project)", options: { fontSize: 9.5, color: P.rationale ? C.ink : "B45309" } }],
      { x: 4.45, y: 2.72, w: W - 5.2, h: 1.1, valign: "top", margin: 0, isTextBox: true, fit: "shrink" });
    box(db, 0.6, 4.0, W - 1.2, 2.75);
    db.addText("PHASE PROGRESS · ACTUAL vs PLAN", { x: 0.8, y: 4.08, w: 6, h: 0.22, fontSize: 7.5, color: C.soft, charSpacing: 1.5, margin: 0, isTextBox: true });
    var half = Math.ceil(S.phases.length / 2), rowH = Math.min(0.32, 2.3 / Math.max(1, half));
    S.phases.forEach(function (p, i) { var c0 = i < half ? 0 : 1, r = i < half ? i : i - half, x = 0.8 + c0 * 6.1, y = 4.38 + r * rowH;
      db.addText(p.name, { x: x, y: y, w: 2.55, h: rowH, fontSize: 8.5, color: C.ink, valign: "middle", margin: 0, isTextBox: true, fit: "shrink" });
      bar(db, x + 2.65, y + rowH / 2 - 0.055, 2.55, p.pct, p.planned, col(p.status));
      db.addText(fp(p.pct), { x: x + 5.25, y: y, w: 0.55, h: rowH, fontSize: 8.5, bold: true, align: "right", valign: "middle", margin: 0, isTextBox: true }); });
    // 4 decisions
    chunk(S.decisions, 4).forEach(function (pg, pi, all) {
      var s = slide("KO Content", "DECISIONS NEEDED", "Steering Committee is asked to decide" + (all.length > 1 ? " (" + (pi + 1) + "/" + all.length + ")" : "") + " · tick the resolution in the meeting", sec);
      if (!pg.length) return none(s, "No decision needed this period");
      var cw = (W - 1.2 - 0.2) / 2, chh = pg.length > 2 ? 2.5 : 5.0;
      pg.forEach(function (it, k) { var x = 0.6 + (k % 2) * (cw + 0.2), y = 1.55 + Math.floor(k / 2) * (chh + 0.15);
        box(s, x, y, cw, chh); s.addShape(pres.ShapeType.rect, { x: x, y: y, w: 0.07, h: chh, fill: { color: "D64545" }, line: { type: "none" } });
        s.addText("D" + (pi * 4 + k + 1), { shape: pres.ShapeType.roundRect, rectRadius: 0.05, x: x + 0.22, y: y + 0.14, w: 0.42, h: 0.28, fontSize: 10, bold: true, color: C.white, fill: { color: "D64545" }, line: { type: "none" }, align: "center", valign: "middle", margin: 0 });
        s.addText([{ text: imp(it.impact) + "   ", options: { bold: true, color: C.navy } }, { text: (it.owner || "") + (it.due != null ? " · by " + fd(it.due) : ""), options: { bold: true, color: C.blue2 } }], { x: x + 0.75, y: y + 0.14, w: cw - 0.95, h: 0.28, fontSize: 9, align: "right", valign: "middle", margin: 0, isTextBox: true });
        s.addText([{ text: it.text, options: { bold: true, fontSize: 12, color: C.ink, breakLine: true } }, { text: it.ask || it.action || "", options: { fontSize: 10.5, color: C.grey } }],
          { x: x + 0.22, y: y + 0.5, w: cw - 0.4, h: chh - 1.0, valign: "top", margin: 0, paraSpaceAfter: 4, isTextBox: true, fit: "shrink" });
        s.addShape(pres.ShapeType.line, { x: x + 0.22, y: y + chh - 0.42, w: cw - 0.44, h: 0, line: { color: C.line, width: 0.75, dashType: "dash" } });
        s.addText("☐ Approved    ☐ Approved with conditions    ☐ Rejected    ☐ Deferred", { x: x + 0.22, y: y + chh - 0.38, w: cw - 0.4, h: 0.3, fontSize: 9, bold: true, color: C.navy, valign: "middle", margin: 0, isTextBox: true }); });
    });
    // 5 acknowledgement
    chunk(S.acks, 5).forEach(function (pg, pi, all) {
      var s = slide("KO Content", "FOR ACKNOWLEDGEMENT", "Status and response plans the Steering Committee is asked to note" + (all.length > 1 ? " (" + (pi + 1) + "/" + all.length + ")" : ""), sec);
      if (!pg.length) return none(s, "Nothing for acknowledgement this period");
      pg.forEach(function (it, k) { var y = 1.55 + k * 1.02;
        box(s, 0.6, y, W - 1.2, 0.9);
        s.addShape(pres.ShapeType.ellipse, { x: 0.8, y: y + 0.37, w: 0.16, h: 0.16, fill: { color: col(it.rag) }, line: { type: "none" } });
        s.addText("A" + (pi * 5 + k + 1), { shape: pres.ShapeType.roundRect, rectRadius: 0.05, x: 1.1, y: y + 0.31, w: 0.42, h: 0.28, fontSize: 10, bold: true, color: C.white, fill: { color: "E0A100" }, line: { type: "none" }, align: "center", valign: "middle", margin: 0 });
        s.addText([{ text: it.text, options: { bold: true, fontSize: 11, color: C.ink, breakLine: true } }, { text: it.ask || it.action || "", options: { fontSize: 9.5, color: C.grey } }], { x: 1.7, y: y + 0.06, w: 8.6, h: 0.78, valign: "middle", margin: 0, isTextBox: true, fit: "shrink" });
        s.addText([{ text: imp(it.impact), options: { bold: true, color: C.navy, breakLine: true } }, { text: it.owner || "", options: { bold: true, color: C.blue2 } }], { x: 10.4, y: y + 0.1, w: 2.15, h: 0.7, fontSize: 9, align: "right", valign: "middle", margin: 0, isTextBox: true }); });
    });
    // 6 milestones
    chunk(S.keyMs, 12).forEach(function (pg, pi, all) {
      var s = slide("KO Content", "KEY MILESTONE STATUS", "Actual vs planned % at " + fd(S.rd) + " · bar = actual, line = plan" + (all.length > 1 ? " (" + (pi + 1) + "/" + all.length + ")" : ""), sec);
      var rh = Math.min(0.4, 4.9 / (pg.length + 1)), cw = [4.3, 1.0, 1.25, 4.18, 1.4], x0 = 0.6, top = 1.6;
      var r0 = [[hdr("Milestone"), hdr("Owner"), hdr("Target"), hdr("Progress (actual vs plan)"), hdr("Status")]];
      pg.forEach(function (m) { r0.push([cell(m.name, { bold: true, fontSize: 9.5 }), cell(m.owner || "", { align: "center", fontSize: 9 }), cell(fd(m.end), { align: "center", fontSize: 9 }), cell(""), cell("")]); });
      s.addTable(r0, { x: x0, y: top, w: W - 1.2, colW: cw, rowH: rh, border: { type: "solid", pt: 0.5, color: C.line }, fill: { color: C.white }, margin: [2, 6, 2, 6] });
      pg.forEach(function (m, i) { var y = top + rh * (i + 1);
        bar(s, x0 + cw[0] + cw[1] + cw[2] + 0.12, y + rh / 2 - 0.055, 2.75, m.pct, m.planned, col(m.status));
        s.addText(fp(m.pct) + " / " + fp(m.planned), { x: x0 + cw[0] + cw[1] + cw[2] + 2.95, y: y, w: 1.15, h: rh, fontSize: 8, color: C.grey, valign: "middle", margin: 0, isTextBox: true });
        pill(s, m.status, x0 + cw[0] + cw[1] + cw[2] + cw[3] + 0.12, y + rh / 2 - 0.13, 1.15); });
    });
    // 7 risks & issues
    var ri = slide("KO Content", "TOP RISKS & ISSUES", S.openN + " open items · top " + S.top.length + " by severity · decisions are on their own page", sec);
    var tr = [[hdr(""), hdr("Type"), hdr("Risk / Issue"), hdr("Impact"), hdr("Response / Mitigation"), hdr("Owner · Due")]];
    S.top.forEach(function (i) { tr.push([cell("●", { align: "center", color: col(i.rag), fontSize: 14 }), cell(i.type, { fontSize: 8.5, bold: true, color: C.blue2 }), cell(i.text, { bold: true, fontSize: 9 }), cell(imp(i.impact), { align: "center", bold: true, fontSize: 9 }),
      cell(i.action || "", { fontSize: 8.5, color: C.grey }), cell((i.owner || "") + (i.due != null ? "\n" + fd(i.due) : ""), { align: "center", fontSize: 8.5, bold: true })]); });
    ri.addTable(tr, { x: 0.6, y: 1.6, w: W - 1.2, colW: [0.4, 1.3, 4.1, 0.8, 4.0, 1.53], rowH: 0.7, border: { type: "solid", pt: 0.5, color: C.line }, fill: { color: C.white }, margin: [3, 6, 3, 6] });
    // 8a change requests
    var CRm = h.crModel(M);
    if (CRm && CRm.crs.length) {
      var crs0 = slide("KO Content", "CHANGE REQUESTS", "Register status · Submitted CRs above the PM limit (" + CRm.limit + " MD) need a Steering decision", sec);
      crRegisterSlide(crs0, { kpi: CRm.kpi, crs: CRm.crs.filter(function (c) { return CRF_OPEN.indexOf(c.status) >= 0; }), currency: CRm.currency, limit: CRm.limit }, B, h, 1.55);
    }
    // 8 payments
    if (S.hasBill) {
      var py = slide("KO Content", "PAYMENT MILESTONES VS PLAN", "Planned = installments whose trigger milestone was due by " + fd(S.rd), sec);
      var BC = { "Paid": ["E3F4EC", "1D7A4F"], "Invoiced": ["E3ECFB", "1B4F8F"], "Ready to Invoice": ["FFF4D6", "8A6200"], "Overdue": ["FDE8E8", "9B1C1C"], "Milestone Delayed": ["FDE8E8", "9B1C1C"] };
      var fw = (W - 1.2 - 0.2 * (S.fees.length - 1)) / Math.max(1, S.fees.length);
      S.fees.forEach(function (f, i) { var x = 0.6 + i * (fw + 0.2), y = 1.6;
        box(py, x, y, fw, 1.75 + f.inst.length * 0.36);
        py.addText([{ text: f.fee, options: { bold: true, fontSize: 12, color: C.navy, breakLine: !!f.value } }].concat(f.value ? [{ text: Math.round(f.value).toLocaleString("en-US") + " " + (P.currency || ""), options: { fontSize: 10, color: C.grey } }] : []), { x: x + 0.2, y: y + 0.1, w: fw - 0.4, h: 0.5, valign: "top", margin: 0, isTextBox: true });
        [["Planned", f.plan, "94A3B8"], ["Invoiced", f.inv, "2F6FDE"], ["Paid", f.paid, "2E9E6B"]].forEach(function (r, k) { var yy = y + 0.7 + k * 0.3;
          py.addText(r[0], { x: x + 0.2, y: yy, w: 1.0, h: 0.24, fontSize: 9, color: C.ink, valign: "middle", margin: 0, isTextBox: true });
          bar(py, x + 1.2, yy + 0.065, fw - 2.0, r[1], null, r[2]);
          py.addText(fp(r[1]), { x: x + fw - 0.75, y: yy, w: 0.55, h: 0.24, fontSize: 9, bold: true, align: "right", valign: "middle", margin: 0, isTextBox: true }); });
        f.inst.forEach(function (b, k) { var c0 = BC[b.status] || ["F2F2F2", C.grey];
          py.addText(b.inst + " · " + fp(b.pct) + " · " + b.status + (b.msName ? "  (" + b.msName + ")" : ""), { x: x + 0.2, y: y + 1.68 + k * 0.36, w: fw - 0.4, h: 0.3, fontSize: 8.5, bold: true, color: c0[1], fill: { color: c0[0] }, valign: "middle", margin: [0, 6, 0, 6], isTextBox: true, fit: "shrink" }); }); });
    }
    // 9 next 30 days
    var nx = slide("KO Content", "NEXT 30 DAYS", "Key milestones due in the next 45 days · activities in the next 30 days", sec);
    if (S.steering) nx.addText([{ text: "NEXT STEERING  ", options: { bold: true, color: C.blue2, charSpacing: 1 } }, { text: S.steering, options: { color: C.ink } }], { x: 0.6, y: 6.35, w: 7, h: 0.3, fontSize: 10, margin: 0, isTextBox: true });
    nx.addText("KEY MILESTONES DUE", { x: 0.6, y: 1.55, w: 4.5, h: 0.3, fontSize: 10.5, bold: true, color: C.blue2, charSpacing: 1, margin: 0, isTextBox: true });
    (S.next.length ? S.next : [null]).forEach(function (m, i) { var y = 1.95 + i * 0.68;
      box(nx, 0.6, y, 4.5, 0.58);
      if (!m) return nx.addText("No key milestone due", { x: 0.8, y: y, w: 4.1, h: 0.58, fontSize: 10, color: C.soft, valign: "middle", margin: 0, isTextBox: true });
      nx.addShape(pres.ShapeType.ellipse, { x: 0.78, y: y + 0.21, w: 0.15, h: 0.15, fill: { color: col(m.status) }, line: { type: "none" } });
      nx.addText([{ text: m.name, options: { bold: true, fontSize: 10.5, color: C.ink, breakLine: true } }, { text: fd(m.end) + " · " + fp(m.pct), options: { bold: true, fontSize: 9, color: C.blue2 } }], { x: 1.05, y: y + 0.03, w: 3.95, h: 0.52, valign: "middle", margin: 0, isTextBox: true }); });
    nx.addText("ACTIVITIES IN PROGRESS / STARTING", { x: 5.45, y: 1.55, w: 7, h: 0.3, fontSize: 10.5, bold: true, color: C.blue2, charSpacing: 1, margin: 0, isTextBox: true });
    var ta = [[hdr("Activity"), hdr("Owner"), hdr("Due")]];
    S.acts.forEach(function (a) { var cl = /^(client|hp|ลูกค้า)/i.test(a.owner || "") || (a.owner || "") === (P.short || "#"); ta.push([cell(a.name, { fontSize: 9 }), cell(a.owner || "", { align: "center", fontSize: 9, bold: cl, color: cl ? "C55A11" : C.ink }), cell(fd(a.end), { align: "center", fontSize: 9 })]); });
    nx.addTable(ta, { x: 5.45, y: 1.95, w: W - 6.05, colW: [5.0, 0.9, 1.38], rowH: 0.42, border: { type: "solid", pt: 0.5, color: C.line }, fill: { color: C.white }, margin: [2, 6, 2, 6] });
    var cl0 = pres.addSlide({ masterName: "KO Closing", sectionTitle: sec });
    cl0.addText("THANK YOU", { placeholder: "title" }); cl0.addText("Questions and decisions", { placeholder: "body" });
    return pres;
  }

  // =====================================================================================
  // Change Request pack (register + one slide per CR) – content from h.crModel(M)
  // =====================================================================================
  function crRegisterSlide(s, R, B, h, y0) {
    var C = B.C, pres = B.pres, hdr = B.hdr, cell = B.cell, k = R.kpi, cur = R.currency;
    var money = function (v) { return v == null ? "–" : Math.round(v).toLocaleString("en-US"); }, md = function (v) { return v == null ? "–" : String(Math.round(v * 10) / 10); };
    var SC = h.CRF.STATUS_COL, hex = function (c) { return (c || "#94a3b8").replace("#", "").toUpperCase(); };
    var tw = (W - 1.2 - 3 * 0.15) / 4;
    [["CHANGE REQUESTS", String(k.total), k.draft ? k.draft + " draft" : "in register"], ["PENDING APPROVAL", String(k.pending), md(k.pendMd) + " MD · " + k.steer + " need Steering"],
     ["APPROVED", String(k.apprN), md(k.apprMd) + " MD · " + money(k.apprCost) + " " + cur], ["CHARGEABLE (APPROVED)", money(k.chargeCost), cur]].forEach(function (t, i) {
      var x = 0.6 + i * (tw + 0.15);
      s.addShape(pres.ShapeType.rect, { x: x, y: y0, w: tw, h: 0.95, fill: { color: C.white }, line: { color: "E7E7E7", width: 0.5 } });
      s.addShape(pres.ShapeType.rect, { x: x, y: y0, w: tw, h: 0.06, fill: { color: i === 1 && k.steer ? "E0A100" : C.blue }, line: { type: "none" } });
      s.addText([{ text: t[0], options: { fontSize: 7.5, color: C.soft, charSpacing: 1.5, breakLine: true } }, { text: t[1], options: { fontSize: 20, bold: true, color: C.navy, breakLine: true } }, { text: t[2], options: { fontSize: 8.5, color: C.grey } }],
        { x: x + 0.15, y: y0 + 0.08, w: tw - 0.3, h: 0.84, valign: "middle", margin: 0, isTextBox: true }); });
    if (!R.crs.length) return;
    var rows = [[hdr("CR No"), hdr("Name of Request"), hdr("Status"), hdr("Priority"), hdr("Service Type"), hdr("MD"), hdr("Cost (" + cur + ")"), hdr("Approval by"), hdr("Exp. Finish"), hdr("Check")]];
    R.crs.forEach(function (c) { rows.push([cell(c.no, { bold: true, fontSize: 9 }), cell(c.name, { bold: true, fontSize: 9 }), cell(c.status, { align: "center", bold: true, fontSize: 8.5, color: C.white, fill: { color: hex(SC[c.status]) } }),
      cell(c.prio, { align: "center", fontSize: 9, bold: c.prio === "Urgent", color: c.prio === "Urgent" ? "D64545" : C.ink }), cell(c.type || "–", { align: "center", fontSize: 9 }), cell(md(c.total), { align: "center", fontSize: 9 }),
      cell(money(c.cost), { align: "right", fontSize: 9 }), cell(c.level || "–", { align: "center", fontSize: 8.5, bold: c.level === "Steering Committee", color: c.level === "Steering Committee" ? "B45309" : C.ink }),
      cell(h.fmtD(c.finish), { align: "center", fontSize: 9 }), cell(c.warnN ? "⚠ " + c.warnN : "✓", { align: "center", bold: true, color: c.warnN ? "B45309" : "2E9E6B" })]); });
    s.addTable(rows, { x: 0.6, y: y0 + 1.15, w: W - 1.2, colW: [0.85, 3.85, 1.05, 0.75, 1.15, 0.5, 1.0, 1.3, 0.95, 0.73], rowH: Math.min(0.42, (6.75 - y0 - 1.15) / rows.length), border: { type: "solid", pt: 0.5, color: C.line }, fill: { color: C.white }, margin: [2, 5, 2, 5] });
  }
  function buildCR(M, PptxGenJS, h, A) {
    var R = h.crModel(M); if (!R) throw new Error("ไฟล์นี้ยังไม่มีชีท CR – ใช้ Template V.1 ฉบับล่าสุด");
    var B = koBase(M, PptxGenJS, h, A, "Change Requests"), C = B.C, pres = B.pres, slide = B.slide, box = B.box, sec = "Change Requests", CRF = h.CRF, cur = R.currency;
    var money = function (v) { return v == null ? "–" : Math.round(v).toLocaleString("en-US"); }, md = function (v) { return v == null ? "–" : String(Math.round(v * 10) / 10); };
    var hex = function (c) { return (c || "#94a3b8").replace("#", "").toUpperCase(); };
    pres.addSection({ title: sec });
    var rg = slide("KO Content", "CHANGE REQUEST REGISTER", "Sheet CR · approval limit for Project Managers: " + R.limit + " man-days (sheet Charter)", sec);
    crRegisterSlide(rg, R, B, h, 1.55);
    R.crs.forEach(function (c) {
      var s = pres.addSlide({ masterName: "KO Content", sectionTitle: sec }), tt = c.no + " · " + c.name;
      s.addText(tt.length > 46 ? tt.slice(0, 44).replace(/\s+\S*$/, "") + " …" : tt, { placeholder: "title" });
      s.addText([{ text: " " + c.status + " ", options: { bold: true, color: C.white, highlight: hex(CRF.STATUS_COL[c.status]) } },
        { text: "   " + c.prio + " · " + (c.type || "Service type?") + " · requested " + h.fmtD(c.date) + (c.by ? " by " + c.by : "") + " · expected finish " + h.fmtD(c.finish), options: { color: C.grey } }], { placeholder: "sub" });
      box(s, 0.6, 1.55, 6.9, 5.2);
      var runs = [];
      [["NAME OF REQUEST", c.name], ["BACKGROUND", c.bg], ["SCOPE OF WORK", c.scope], ["IMPLEMENTATION REQUIREMENT", c.req], ["RISKS", c.risks]].forEach(function (p0) { if (!p0[1]) return;
        runs.push({ text: p0[0], options: { bold: true, fontSize: 8, color: C.blue2, charSpacing: 1.5, breakLine: true } }); runs.push({ text: p0[1], options: { fontSize: 10, color: C.ink, breakLine: true, paraSpaceAfter: 6 } }); });
      if (c.mods.length) { runs.push({ text: "IMPACTED MODULES", options: { bold: true, fontSize: 8, color: C.blue2, charSpacing: 1.5, breakLine: true } });
        c.mods.forEach(function (m0) { runs.push({ text: "• " + m0 + (c.det[m0] ? " – " + c.det[m0] : ""), options: { fontSize: 9.5, color: C.ink, breakLine: true } }); }); }
      s.addText(runs, { x: 0.8, y: 1.65, w: 6.5, h: 5.0, valign: "top", margin: 0, isTextBox: true, fit: "shrink" });
      // effort
      var x = 7.75, w = W - 0.6 - x; box(s, x, 1.55, w, 1.95);
      s.addText("EFFORT & COST", { x: x + 0.2, y: 1.62, w: 3, h: 0.22, fontSize: 8, bold: true, color: C.blue2, charSpacing: 1.5, margin: 0, isTextBox: true });
      var mx = Math.max(1, c.md.sa, c.md.dev, c.md.qa, c.md.imp);
      [["SA/SE", c.md.sa], ["DEV", c.md.dev], ["QA", c.md.qa], ["IMP/OP", c.md.imp]].forEach(function (e, i) { var y = 1.9 + i * 0.24;
        s.addText(e[0], { x: x + 0.2, y: y, w: 0.7, h: 0.2, fontSize: 8.5, margin: 0, isTextBox: true });
        s.addShape(pres.ShapeType.roundRect, { x: x + 0.95, y: y + 0.06, w: w - 1.75, h: 0.09, rectRadius: 0.04, fill: { color: "E7EBF1" }, line: { type: "none" } });
        if (e[1] > 0) s.addShape(pres.ShapeType.roundRect, { x: x + 0.95, y: y + 0.06, w: Math.max(0.05, (w - 1.75) * e[1] / mx), h: 0.09, rectRadius: 0.04, fill: { color: C.blue }, line: { type: "none" } });
        s.addText(md(e[1]), { x: x + w - 0.75, y: y, w: 0.55, h: 0.2, fontSize: 8.5, bold: true, align: "right", margin: 0, isTextBox: true }); });
      s.addText([{ text: md(c.total), options: { bold: true, fontSize: 15, color: C.navy } }, { text: " MD", options: { fontSize: 9, color: C.grey } }], { x: x + 0.2, y: 2.88, w: 2, h: 0.3, margin: 0, isTextBox: true });
      s.addText([{ text: money(c.cost), options: { bold: true, fontSize: 15, color: C.navy } }, { text: " " + cur, options: { fontSize: 9, color: C.grey } }], { x: x + w - 2.7, y: 2.88, w: 2.5, h: 0.3, align: "right", margin: 0, isTextBox: true });
      s.addText("Approval by " + (c.level || "–") + (c.pay ? " · " + c.pay : ""), { x: x + 0.2, y: 3.18, w: w - 0.4, h: 0.24, fontSize: 8.5, bold: true, color: c.level === "Steering Committee" ? "B45309" : "2E9E6B", margin: 0, isTextBox: true });
      // plan
      box(s, x, 3.6, w, 1.65);
      s.addText("PLAN (PART 3)", { x: x + 0.2, y: 3.66, w: 3, h: 0.2, fontSize: 8, bold: true, color: C.blue2, charSpacing: 1.5, margin: 0, isTextBox: true });
      CRF.MS.forEach(function (m0, i) { var y = 3.88 + i * 0.165;
        s.addText([{ text: m0.split(" (")[0].split(":")[0], options: { color: C.ink } }], { x: x + 0.2, y: y, w: w - 2.2, h: 0.16, fontSize: 7.5, margin: 0, isTextBox: true });
        s.addText(CRF.PIC[i], { x: x + w - 2.0, y: y, w: 0.85, h: 0.16, fontSize: 7, color: C.soft, margin: 0, isTextBox: true });
        s.addText(c.ms[i] != null ? h.fmtD(c.ms[i]) : "N/A", { x: x + w - 1.15, y: y, w: 0.95, h: 0.16, fontSize: 7.5, bold: c.ms[i] != null, color: c.ms[i] != null ? C.blue2 : C.soft, align: "right", margin: 0, isTextBox: true }); });
      // pre-check
      box(s, x, 5.35, w, 1.4);
      s.addText([{ text: "PM PRE-CHECK", options: { bold: true, fontSize: 8, color: C.blue2, charSpacing: 1.5, breakLine: true } }].concat(c.check.map(function (q, i, a) {
        return { text: (q.l === "warn" ? "⚠ " : q.l === "ok" ? "✓ " : "ℹ ") + q.t, options: { fontSize: 8.5, bold: q.l === "warn", color: q.l === "warn" ? "B45309" : q.l === "ok" ? "1D7A4F" : C.grey, breakLine: i < a.length - 1 } }; })),
        { x: x + 0.2, y: 5.42, w: w - 0.4, h: 1.28, valign: "top", margin: 0, isTextBox: true, fit: "shrink" });
    });
    return pres;
  }

  // theme colours + fonts (Poppins latin, Kanit Thai/cs) into ppt/theme/theme1.xml; drop folder entries
  function themeXml(xml) {
    var SLOTS = ["dk1", "lt1", "dk2", "lt2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"];
    var scheme = '<a:clrScheme name="' + THEME.name + '">' + SLOTS.map(function (k) { return "<a:" + k + '><a:srgbClr val="' + THEME.colors[k] + '"/></a:' + k + ">"; }).join("") + "</a:clrScheme>";
    xml = xml.replace(/<a:clrScheme\b[\s\S]*?<\/a:clrScheme>/, scheme);
    xml = xml.replace(/(<a:(?:majorFont|minorFont)>[\s\S]*?)<a:cs typeface="[^"]*"\s*\/>/g, '$1<a:cs typeface="Kanit"/>');
    xml = xml.replace(/<a:font script="Thai" typeface="[^"]*"\s*\/>/g, '<a:font script="Thai" typeface="Kanit"/>');
    xml = xml.replace(/(<a:(majorFont|minorFont)>[\s\S]*?<a:cs typeface="Kanit"\/>)(?![\s\S]*?<a:font script="Thai")/g, '$1');
    return xml.replace(/(<a:(?:theme|fontScheme)\b[^>]*?\bname=")[^"]*"/g, '$1' + THEME.name + '"');
  }
  function finalize(zip) {
    var part = "ppt/theme/theme1.xml";
    return zip.file(part).async("string").then(function (x) {
      zip.file(part, themeXml(x));
      Object.keys(zip.files).forEach(function (n) { if (zip.files[n].dir) delete zip.files[n]; });
      var jobs = Object.keys(zip.files).filter(function (n) { return /\.xml$/.test(n); }).map(function (n) {
        return zip.file(n).async("string").then(function (s) {
          var t = s.split('<c:crossesAt val="autoZero"/>').join('<c:crosses val="autoZero"/>')
            .replace(/<c:pt idx="\d+"><c:v><\/c:v><\/c:pt>/g, "");   // empty chart points = gaps (S-curve actual after the report date)
          if (t !== s) zip.file(n, t);
        });
      });
      return Promise.all(jobs).then(function () { return zip; });
    });
  }
  function fileName(M, mode) {
    var cm = mode === "charter" && root.PSR ? root.PSR._h.charterModel(M) : mode === "charter" && typeof require === "function" ? require("./report-core.js")._h.charterModel(M) : null;
    var d = new Date(cm ? cm.date : mode === "kickoff" && M.kickoff && M.kickoff.kickoff != null ? M.kickoff.kickoff : M.P.rd), p = function (n) { return ("0" + n).slice(-2); };
    if (mode === "cr") return (M.P.short || "Project").replace(/[^\w\-]+/g, "_") + "_Change_Requests_" + d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + ".pptx";
    if (mode === "steering") return (M.P.short || "Project").replace(/[^\w\-]+/g, "_") + "_Steering_" + d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + ".pptx";
    if (mode === "charter") return (M.P.short || "Project").replace(/[^\w\-]+/g, "_") + "_Charter_" + d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + ".pptx";
    if (mode === "kickoff") return (M.P.short || "Project").replace(/[^\w\-]+/g, "_") + "_Kickoff_" + d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + ".pptx";
    return (M.P.short || "Project").replace(/[^\w\-]+/g, "_") + "_Status_" + (mode === "internal" ? "Internal" : "External") + "_" + d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + ".pptx";
  }
  // browser: build → patch theme → download
  function download(M, mode) {
    var pres = mode === "cr" ? buildCR(M, root.PptxGenJS, root.PSR._h, root.PSR_KO_ASSETS) : mode === "steering" ? buildSteering(M, root.PptxGenJS, root.PSR._h, root.PSR_KO_ASSETS, "external") : mode === "charter" ? buildCharter(M, root.PptxGenJS, root.PSR._h, root.PSR_KO_ASSETS) : mode === "kickoff" ? buildKickoff(M, root.PptxGenJS, root.PSR._h, root.PSR_KO_ASSETS) : build(M, mode, root.PptxGenJS, root.PSR._h);
    return pres.write({ outputType: "arraybuffer" }).then(function (buf) { return root.JSZip.loadAsync(buf); }).then(finalize)
      .then(function (zip) { return zip.generateAsync({ type: "blob", compression: "DEFLATE", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }); })
      .then(function (blob) { var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = fileName(M, mode);
        document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 800); });
  }
  var api = { build: build, buildKickoff: buildKickoff, buildCharter: buildCharter, buildSteering: buildSteering, buildCR: buildCR, finalize: finalize, fileName: fileName, download: download, themeXml: themeXml };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.PSRPPTX = api;
})(this);
