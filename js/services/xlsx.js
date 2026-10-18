/* Minimal .xlsx writer with no libraries: builds the SpreadsheetML parts and packs them
   into a stored (uncompressed) ZIP. Input: [{ name, head: [..], rows: [[..], ..] }]. */
(function (OPF) {
  "use strict";

  const MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  // Headings that hold money get the #,##0.00 format (style 2); quantities stay plain.
  const MONEY_HEAD = /total|amount|rate|due|paid|cost|price|value|balance|cod|advance|charge|debit|credit|discount|transport|loading|bill|payable|receivable|sales|purchase|expense|p\/l|returns/i;
  const QTY_HEAD = /pcs|qty/i;

  const xmlEsc = (v) => String(v).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
  const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

  // 0 -> A, 25 -> Z, 26 -> AA
  function colName(i) {
    let s = "";
    for (i++; i; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
    return s;
  }

  function cell(v, ref, style) {
    if (v == null || v === "") return "";
    if (typeof v == "number" && isFinite(v)) return `<c r="${ref}"${style ? ` s="${style}"` : ""}><v>${v}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${style == 1 ? ' s="1"' : ""}><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
  }

  function sheetXml(sheet) {
    const moneyCol = sheet.head.map((h) => MONEY_HEAD.test(h) && !QTY_HEAD.test(h));
    const widths = sheet.head.map((h, i) => {
      let w = String(h).length;
      sheet.rows.slice(0, 300).forEach((r) => { w = Math.max(w, String(r[i] == null ? "" : r[i]).length); });
      return Math.min(w + 2, 50);
    });
    const rows = [`<row r="1">${sheet.head.map((h, i) => cell(h, colName(i) + "1", 1)).join("")}</row>`];
    sheet.rows.forEach((r, ri) => rows.push(`<row r="${ri + 2}">${r.map((v, i) => cell(v, colName(i) + (ri + 2), moneyCol[i] ? 2 : 0)).join("")}</row>`));
    return XML + `<worksheet xmlns="${NS_MAIN}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
      `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>` +
      `<sheetData>${rows.join("")}</sheetData></worksheet>`;
  }

  // Excel sheet names: max 31 chars, no \ / ? * [ ] :, unique (case-insensitive).
  function sheetNames(sheets) {
    const used = {};
    return sheets.map((s) => {
      let n = s.name.replace(/[\\\/\?\*\[\]:]/g, " ").slice(0, 31);
      const base = n;
      for (let i = 2; used[n.toLowerCase()]; i++) n = base.slice(0, 28) + " " + i;
      used[n.toLowerCase()] = true;
      return n;
    });
  }

  const STYLES = XML + `<styleSheet xmlns="${NS_MAIN}"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>` +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDDE4EE"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  function build(sheets) {
    const names = sheetNames(sheets);
    const n = sheets.length;
    const each = (fn) => sheets.map((s, i) => fn(i + 1)).join("");
    const files = [
      { name: "[Content_Types].xml", data: XML + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + each((i) => `<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`) + "</Types>" },
      { name: "_rels/.rels", data: XML + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
      { name: "xl/workbook.xml", data: XML + `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheets>${names.map((nm, i) => `<sheet name="${xmlEsc(nm)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>` },
      { name: "xl/_rels/workbook.xml.rels", data: XML + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + each((i) => `<Relationship Id="rId${i}" Type="${NS_REL}/worksheet" Target="worksheets/sheet${i}.xml"/>`) + `<Relationship Id="rId${n + 1}" Type="${NS_REL}/styles" Target="styles.xml"/></Relationships>` },
      { name: "xl/styles.xml", data: STYLES }
    ].concat(sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s) })));
    return zip(files, MIME);
  }

  /* ---- ZIP (store method, UTF-8 names) ---- */
  let crcTable = null;
  function crc32(bytes) {
    if (!crcTable) {
      crcTable = [];
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        crcTable[n] = c >>> 0;
      }
    }
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function zip(files, mime) {
    const enc = new TextEncoder(), parts = [], central = [], d = new Date();
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    let offset = 0, cdSize = 0;

    files.forEach((f) => {
      const name = enc.encode(f.name), data = enc.encode(f.data), crc = crc32(data);
      const local = new DataView(new ArrayBuffer(30)), dir = new DataView(new ArrayBuffer(46));
      [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, time, 2], [12, date, 2], [14, crc, 4], [18, data.length, 4], [22, data.length, 4], [26, name.length, 2], [28, 0, 2]]
        .forEach(([at, v, size]) => (size == 4 ? local.setUint32(at, v, true) : local.setUint16(at, v, true)));
      [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, time, 2], [14, date, 2], [16, crc, 4], [20, data.length, 4], [24, data.length, 4], [28, name.length, 2], [42, offset, 4]]
        .forEach(([at, v, size]) => (size == 4 ? dir.setUint32(at, v, true) : dir.setUint16(at, v, true)));
      parts.push(local, name, data);
      central.push(dir, name);
      offset += 30 + name.length + data.length;
      cdSize += 46 + name.length;
    });

    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true);
    end.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [end]), { type: mime });
  }

  OPF.xlsx = { build };
})(window.OPF = window.OPF || {});
