/**
 * AI-Learning PDF 生成器
 * 
 * 用法：node build-pdf.js
 * 功能：把本目录下所有 .md 文件（按文件名排序）合并生成一个 PDF
 * 追加内容：新增编号 .md 文件后重新运行本脚本即可，PDF 自动包含新内容
 * 
 * 依赖：puppeteer（复用 D:\acme\pdf-gen\node_modules 下的安装）
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const puppeteer = require('D:/acme/pdf-gen/node_modules/puppeteer');

const DIR = __dirname;
// 输出文件名（ASCII 注释：真正的图片内嵌逻辑见 toDataUri）
const OUTPUT_PDF = path.join(DIR, 'AI应用开发.pdf');
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

// ============================================================================
// PDF 内嵌位图检查器：把 PDF 里的图像 XObject 解开导出为 png/jpg 文件。
// 目的：日志说“图已加载”不算证据，只有从 PDF 字节里把图取出来才能断言
// “架构图真的在 PDF 里”。纯 Node 实现，无第三方依赖。
// 用法：node build-pdf.js inspect [pdf] [导出目录] [报告json]
// ============================================================================
function pdfNum(win, key) {
  const m = new RegExp('/' + key + '\\s+([-\\d.]+)').exec(win);
  return m ? Number(m[1]) : null;
}
function pdfName(win, key) {
  const m = new RegExp('/' + key + '\\s*/([A-Za-z0-9_]+)').exec(win);
  return m ? m[1] : null;
}
function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
}
// Flate 图像流 → 裸像素（逆向 PNG 预测器）
function decodeFlat(inflated, w, h, colors, bpc, predictor) {
  const stride = Math.ceil(w * colors * bpc / 8);
  if (predictor === 1 || predictor == null || inflated.length === stride * h) return inflated;
  const bpp = Math.max(1, Math.ceil(colors * bpc / 8));
  const out = Buffer.alloc(stride * h);
  let prev = Buffer.alloc(stride);
  const rowLen = stride + 1;
  for (let y = 0; y < h; y++) {
    const off = y * rowLen;
    if (off + rowLen > inflated.length) break;
    const ft = inflated[off];
    const line = inflated.slice(off + 1, off + 1 + stride);
    const rec = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? rec[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v;
      switch (ft) {
        case 0: v = line[x]; break;
        case 1: v = line[x] + a; break;
        case 2: v = line[x] + b; break;
        case 3: v = line[x] + ((a + b) >> 1); break;
        case 4: v = line[x] + paeth(a, b, c); break;
        default: v = line[x];
      }
      rec[x] = v & 255;
    }
    rec.copy(out, y * stride);
    prev = rec;
  }
  return out;
}
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(b) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, colorType, pixels) {
  const ch = colorType === 0 ? 1 : colorType === 2 ? 3 : 4;
  const stride = w * ch;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    const from = y * stride, to = Math.min((y + 1) * stride, pixels.length);
    pixels.copy(raw, y * (stride + 1) + 1, from, to);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = colorType; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function inspectPdf(pdfPath, outDir, reportPath) {
  const buf = fs.readFileSync(pdfPath);
  const s = buf.toString('latin1');
  const report = {
    at: new Date().toISOString(),
    pdf: pdfPath,
    pdfMB: +(buf.length / 1048576).toFixed(2),
    pages: (s.match(/\/Type\s*\/Page[^s]/g) || []).length,
    images: [],
  };
  function streamBytesAfter(dictPos) {
    const st = /stream\r?\n/g;
    st.lastIndex = dictPos;
    const hit = st.exec(s);
    if (!hit) return null;
    const begin = hit.index + hit[0].length;
    const end = s.indexOf('endstream', begin);
    return end < 0 ? null : buf.slice(begin, end);
  }
  const re = /\/Subtype\s*\/Image/g;
  let m, ord = 0;
  while ((m = re.exec(s))) {
    const win = s.slice(Math.max(0, m.index - 1200), m.index + 1200);
    const w = pdfNum(win, 'Width'), h = pdfNum(win, 'Height');
    if (!w || !h) continue;
    const filters = [];
    const fm = /\/Filter\s*\[([^\]]*)\]/.exec(win);
    if (fm) (fm[1].match(/\/([A-Za-z0-9_]+)/g) || []).forEach(f => filters.push(f.slice(1)));
    else { const f1 = pdfName(win, 'Filter'); if (f1) filters.push(f1); }
    const cs = pdfName(win, 'ColorSpace');
    const bpc = pdfName(win, 'BitsPerComponent') ? Number(pdfName(win, 'BitsPerComponent')) : (pdfNum(win, 'BitsPerComponent') || 8);
    const dp = /\/DecodeParms\s*<<(.*?)>>/s.exec(win);
    const predictor = dp ? pdfNum(dp[1], 'Predictor') : null;
    ord++;
    const entry = { idx: ord, width: w, height: h, filters, colorSpace: cs, bpc, predictor, file: null, note: '' };
    const raw = streamBytesAfter(m.index);
    if (!raw) { entry.note = 'no stream'; report.images.push(entry); continue; }
    entry.bytes = raw.length;
    try {
      const tag = `${String(ord).padStart(2, '0')}-${w}x${h}`;
      if (filters.includes('DCTDecode')) {
        const f = path.join(outDir, `img-${tag}.jpg`);
        fs.writeFileSync(f, raw); entry.file = f;
      } else if (filters.includes('FlateDecode') && bpc === 8) {
        const colors = cs === 'DeviceRGB' ? 3 : cs === 'DeviceGray' ? 1 : cs === 'DeviceCMYK' ? 4 : 3;
        const pixels = decodeFlat(zlib.inflateSync(raw), w, h, colors, bpc, predictor);
        if (colors === 1) {
          const f = path.join(outDir, `img-${tag}-gray.png`);
          fs.writeFileSync(f, encodePNG(w, h, 0, pixels)); entry.file = f;
        } else {
          const f = path.join(outDir, `img-${tag}-rgb.png`);
          fs.writeFileSync(f, encodePNG(w, h, 2, pixels.slice(0, w * h * 3))); entry.file = f;
        }
      } else {
        entry.note = `unsupported ${filters.join('+')}/bpc${bpc}`;
      }
    } catch (e) { entry.note = 'decode fail: ' + e.message; }
    report.images.push(entry);
  }
  report.imageXObjects = report.images.length;
  report.bigImages = report.images.filter(i => i.width * i.height > 100000).length;
  report.exported = report.images.filter(i => i.file).map(i => i.file);
  report.failed = report.images.filter(i => i.note).length;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  return report;
}

if (process.argv[2] === 'inspect') {
  const target = process.argv[3] || OUTPUT_PDF;
  const outDir = process.argv[4] || 'D:/acme/pdf-img-dump';
  const repJson = process.argv[5] || 'D:/acme/pdf-inspect.json';
  fs.mkdirSync(outDir, { recursive: true });
  const rep = inspectPdf(target, outDir, repJson);
  console.log(`[inspect] ${path.basename(target)} ${rep.pdfMB}MB pages=${rep.pages} imageXObjects=${rep.imageXObjects} big=${rep.bigImages} exported=${rep.exported.length} failed=${rep.failed}`);
  process.exit(0);
}

// ============ Markdown → HTML 转换器（覆盖课程使用的语法） ============

// ============ Mermaid 库加载：本地优先，避免无头浏览器访问 CDN 失败 ============
// file:// 页面拉 CDN 的 ES Module 常被浏览器拦截，导致流程图全部退化成源码。
// 优先读取本地 vendor（仓库外，不污染课程目录），没有才回源 CDN。
const MERMAID_CANDIDATES = [
  path.join(DIR, 'mermaid.min.js'),
  'D:/acme/pdf-gen/node_modules/mermaid/dist/mermaid.min.js',
];

function loadMermaidSource() {
  for (const p of MERMAID_CANDIDATES) {
    try {
      if (fs.existsSync(p)) {
        console.log('🧩 使用本地 Mermaid 库：' + p);
        // 防止库内出现 </script> 提前闭合标签
        return fs.readFileSync(p, 'utf-8').replace(/<\/script/gi, '<\\/script');
      }
    } catch (e) { /* 尝试下一个候选 */ }
  }
  console.log('🧩 未找到本地 Mermaid 库，将尝试 CDN（失败则流程图降级为源码框）');
  return null;
}

const mermaidLib = loadMermaidSource();

// 引导脚本：本地已内联时用经典 script，否则动态 import CDN
// 踩过的坑：mermaid v10 的 render(id, text) 会按 id 回查 DOM 元素做文字测量，
// 传一个页面上并不存在的 id 会抛 “Cannot read properties of undefined (reading 'createElementNS')”，
// 31 幅流程图全灭就是这么来的。所以：先给节点补真实 id，再走官方 run()，失败的最后兜一轮 render()。
const mermaidBootstrap = mermaidLib ? `
<script>
(function () {
  function finish(s) {
    window.__mermaidStatus = s;
    setTimeout(function () { window.__bootDone = true; }, 400);
  }
  function describe(e) {
    if (!e) return 'unknown';
    var st = String(e.stack || '').split('\\n').slice(1, 3).join(' < ');
    return ((e.message || String(e)) + ' || ' + st).slice(0, 220);
  }
  try {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      fontFamily: '"Microsoft YaHei", "微软雅黑", sans-serif',
      // htmlLabels 会生成 foreignObject，打印到 PDF 时文字容易丢，改用纯 SVG 文本
      flowchart: { htmlLabels: false },
      class: { htmlLabels: false },
      state: { htmlLabels: false }
    });
    var nodes = Array.prototype.slice.call(document.querySelectorAll('.mermaid'));
    // run() 失败时会把节点内容改写成 “Syntax error in text”，先缓存原始源码，兜底才有东西可渲染
    nodes.forEach(function (n, k) { if (!n.id) n.id = 'mmd-print-' + (k + 1); n.__src = n.textContent; });
    var errs = [];
    var hasSvg = function (n) { return !!n.querySelector('svg'); };
    // 渲染成功的节点补 data-processed（走 SVG 样式），失败的摘掉（回落成虚线源码框，不至于整块空白）
    function normalize() {
      nodes.forEach(function (n) {
        if (hasSvg(n)) { n.setAttribute('data-processed', 'true'); }
        else { n.removeAttribute('data-processed'); }
      });
    }
    function renderOne(n) {
      return Promise.resolve(mermaid.render(n.id, n.__src)).then(function (res) {
        var svg = typeof res === 'string' ? res : (res && res.svg);
        if (svg && !hasSvg(n)) { n.innerHTML = svg; }
      }, function (e) { errs.push(n.id + ': ' + describe(e)); });
    }
    function seq(list) {
      return list.reduce(function (p, n) { return p.then(function () { return renderOne(n); }); }, Promise.resolve());
    }
    function report(tag) {
      normalize();
      var okCount = nodes.filter(hasSvg).length;
      window.__mermaidDetail = nodes.map(function (n) {
        return { id: n.id, ok: hasSvg(n), src: (n.__src || '').trim().slice(0, 34) };
      });
      finish((errs.length ? 'partial(' + errs.length + '): ' + errs[0] : tag) + ' => ' + okCount + '/' + nodes.length);
    }
    if (typeof mermaid.run === 'function') {
      Promise.resolve()
        .then(function () { return mermaid.run({ nodes: nodes, suppressErrors: true }); })
        .catch(function (e) { errs.push('run: ' + describe(e)); })
        .then(function () { return seq(nodes.filter(function (n) { return !hasSvg(n); })); })
        .then(function () { report('ok-run'); }, function (e) { errs.push('tail: ' + describe(e)); report('fatal'); });
    } else if (typeof mermaid.render === 'function') {
      seq(nodes).then(function () { report('ok-seq'); }, function (e) { errs.push('seq: ' + describe(e)); report('fatal'); });
    } else { finish('no-render-api'); }
  } catch (e) { finish('init-error: ' + describe(e)); }
})();
</script>` : `
<script type="module">
  try {
    const { default: mermaid } = await import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs');
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      fontFamily: '"Microsoft YaHei", "微软雅黑", sans-serif',
    });
    await mermaid.run({ querySelector: '.mermaid' });
    window.__mermaidStatus = 'ok';
  } catch (e) {
    window.__mermaidStatus = 'skip: ' + ((e && e.message) || e);
  }
  window.__bootDone = true;
</script>`;

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ============ 图片内嵌为 base64 data URI ============
// PDF 由无头浏览器打印生成，依赖相对路径/网络加载图片容易失败（尤其 file:// 页面），
// 直接内联字节可保证架构图 100% 出现在 PDF 中。
const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
};
const imgCache = new Map();
const missingImages = new Set();

function toDataUri(src) {
  if (imgCache.has(src)) return imgCache.get(src);
  let out = src;
  if (!/^(https?:|data:)/i.test(src)) {
    const abs = path.resolve(DIR, decodeURIComponent(src.split('?')[0]));
    try {
      const ext = path.extname(abs).toLowerCase();
      const b64 = fs.readFileSync(abs).toString('base64');
      out = `data:${MIME[ext] || 'application/octet-stream'};base64,${b64}`;
    } catch (e) {
      missingImages.add(src);
      console.warn(`⚠️ 图片读不到：${src} （期望 ${abs}）`);
    }
  }
  imgCache.set(src, out);
  return out;
}

function inline(text) {
  let s = escapeHtml(text);
  // 行内代码 `code`
  s = s.replace(/`([^`]+)`/g, (m, c) => `<code>${c}</code>`);
  // 加粗 **bold**
  s = s.replace(/\*\*([^*]+)\*\*/g, (m, c) => `<strong>${c}</strong>`);
  // 图片 ![alt](src) —— 必须在链接规则之前处理，否则会被当成普通链接，PDF 里就看不到图
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, src) => `<img src="${toDataUri(src)}" alt="${alt}"/>`);
  // 链接 [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, t, u) => `<a href="${u}">${t}</a>`);
  // 斜体 *italic*
  s = s.replace(/\*([^*]+)\*/g, (m, c) => `<em>${c}</em>`);
  return s;
}

// ============ 架构图专用：读取像素尺寸 + 显式 mm 排版 ============
// 为什么不用“max-width:92%”这种模糊排版：无头浏览器打印时，尺寸靠推断得出，
// 一旦推断失真或被分页规则干扰，图就会“DOM 里存在但纸面上没”。
// 这里直接按图片真实宽高比算出 mm 尺寸写进 style，打印布局完全确定。
function imageDims(abs) {
  try {
    const b = fs.readFileSync(abs);
    if (b.slice(1, 4).toString('latin1') === 'PNG') return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    if (b[0] === 0xff && b[1] === 0xd8) { // JPEG：扫 SOF 标记
      for (let i = 2; i < b.length - 9; i++) {
        if (b[i] !== 0xff) continue;
        const mk = b[i + 1];
        if (mk >= 0xc0 && mk <= 0xcf && mk !== 0xc4 && mk !== 0xc8 && mk !== 0xcc) {
          return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
        }
        if (mk !== 0xd8 && mk !== 0x01) i += b.readUInt16BE(i + 2);
      }
    }
  } catch (e) { /* 尺寸拿不到不致命，退回自适应排版 */ }
  return null;
}

const FIGURE_MAX_W_MM = 160;   // A4 减去左右页边距后的可用宽度
const FIGURE_MAX_H_MM = 205;   // 预留页眉/页脚/图题，保证单页装得下（避免 Chromium 跨页丢元素）
const figureList = [];

function figureHtml(alt, src) {
  const abs = /^(https?:|data:)/i.test(src) ? null : path.resolve(DIR, decodeURIComponent(src.split('?')[0]));
  const dims = abs ? imageDims(abs) : null;
  let wMm = FIGURE_MAX_W_MM, hMm = null;
  if (dims && dims.w > 0 && dims.h > 0) {
    const ar = dims.h / dims.w;
    hMm = wMm * ar;
    if (hMm > FIGURE_MAX_H_MM) { hMm = FIGURE_MAX_H_MM; wMm = hMm / ar; }
  }
  const sized = !!(dims && hMm);
  const style = sized
    ? `width:${wMm.toFixed(1)}mm;height:${hMm.toFixed(1)}mm`
    : `max-width:${FIGURE_MAX_W_MM}mm;max-height:${FIGURE_MAX_H_MM}mm`;
  figureList.push({ src, alt, dims, box: `${wMm.toFixed(1)}x${(hMm || 0).toFixed(1)}mm` });
  const attr = sized ? ` width="${dims.w}" height="${dims.h}"` : '';
  return `<figure class="figure"><img src="${toDataUri(src)}" alt="${escapeHtml(alt || '')}"${attr} style="${style}"/>` +
    `<figcaption>▲ ${escapeHtml(alt || '')}</figcaption></figure>`;
}

// 整行就是一张图片（或引用块里只有一张图片）→ 当图表处理
const ONLY_IMG = /^!\[([^\]]*)\]\(([^)\s]+)\)$/;
function asFigure(line) {
  const m = ONLY_IMG.exec(line.trim());
  return m ? figureHtml(m[1], m[2]) : null;
}

function mdToHtml(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let inCode = false;
  let codeLang = '';
  let codeBuf = [];
  let inTable = false;
  let tableBuf = [];
  let listType = null; // 'ul' | 'ol'

  function closeList() {
    if (listType) { out.push(`</${listType}>`); listType = null; }
  }
  function closeTable() {
    if (inTable) {
      out.push('<table>');
      const rows = tableBuf.map(r => r.map(c => `<td>${inline(c.trim())}</td>`).join(''));
      // 第一行是表头
      out.push(`<tr>${rows.shift().replace(/<td>/g, '<th>').replace(/<\/td>/g, '</th>')}</tr>`);
      rows.forEach(r => out.push(`<tr>${r}</tr>`));
      out.push('</table>');
      inTable = false;
      tableBuf = [];
    }
  }

  // 代码块出口：mermaid 源码转成待渲染容器，其余保持高亮代码块
  function flushCode() {
    const src = codeBuf.join('\n');
    if (codeLang === 'mermaid' && src.trim()) {
      out.push(`<div class="mermaid">${escapeHtml(src)}</div>`);
    } else {
      out.push(`<pre><code class="lang-${escapeHtml(codeLang || 'text')}">${escapeHtml(src)}</code></pre>`);
    }
    inCode = false;
    codeBuf = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    // 代码块开关
    if (/^```/.test(line)) {
      if (!inCode) {
        closeList(); closeTable();
        inCode = true;
        codeLang = line.slice(3).trim();
        codeBuf = [];
      } else {
        flushCode();
      }
      continue;
    }
    if (inCode) { codeBuf.push(raw); continue; }

    // 空行
    if (!line) { closeList(); closeTable(); continue; }

    // 分隔线
    if (/^-{3,}$/.test(line)) { closeList(); closeTable(); out.push('<hr/>'); continue; }

    // 标题
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      closeList(); closeTable();
      const level = h[1].length;
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }

    // 引用
    if (/^&gt;/.test(line) || line.startsWith('>')) {
      closeList(); closeTable();
      const inner = line.replace(/^>\s?/, '');
      const fig = asFigure(inner);            // 引用块里的架构图也按图排版
      out.push(fig || `<blockquote>${inline(inner)}</blockquote>`);
      continue;
    }

    // 表格行
    if (line.startsWith('|')) {
      if (!inTable) { inTable = true; tableBuf = []; }
      // 跳过 |---| 分隔行
      if (/^\|[\s\-:|]+\|$/.test(line) && line.includes('-')) continue;
      tableBuf.push(line.replace(/^\||\|$/g, '').split('|'));
      continue;
    } else if (inTable) {
      closeTable();
    }

    // 无序列表
    if (/^[-*]\s+/.test(line)) {
      if (listType !== 'ul') { closeList(); out.push('<ul>'); listType = 'ul'; }
      out.push(`<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`);
      continue;
    }
    // 有序列表
    if (/^\d+\.\s+/.test(line)) {
      if (listType !== 'ol') { closeList(); out.push('<ol>'); listType = 'ol'; }
      out.push(`<li>${inline(line.replace(/^\d+\.\s+/, ''))}</li>`);
      continue;
    }

    // 普通段落（先判是否为整行架构图）
    closeList();
    const fig = asFigure(line);
    if (fig) { out.push(fig); continue; }
    out.push(`<p>${inline(line)}</p>`);
  }
  closeList(); closeTable();
  if (inCode) flushCode();
  return out.join('\n');
}

// ============ 主流程 ============

(async () => {
  // 1. 收集 md 文件（排除本脚本和临时文件）
  const files = fs.readdirSync(DIR)
    .filter(f => f.endsWith('.md') && !f.startsWith('~') && f !== 'README.md')
    .sort((a, b) => {
      const na = parseInt(a) || 0, nb = parseInt(b) || 0;
      return na - nb || a.localeCompare(b, 'zh');
    });

  if (files.length === 0) {
    console.error('❌ 未找到任何 .md 文件');
    process.exit(1);
  }

  console.log(`📄 发现 ${files.length} 个课程文件：`);
  files.forEach(f => console.log('   - ' + f));

  // 2. 转换并拼接 HTML
  const sections = [];
  let toc = '<nav class="toc"><h1>目录</h1><ol>';
  let tocIndex = 1;

  for (const file of files) {
    const md = fs.readFileSync(path.join(DIR, file), 'utf-8');
    const body = mdToHtml(md);
    // 从 md 中提取第一个标题作为节名
    const titleMatch = md.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : file.replace('.md', '');
    const anchor = `sec-${tocIndex}`;
    toc += `<li><a href="#${anchor}">${escapeHtml(title)}</a></li>`;
    sections.push(`<section id="${anchor}" class="chapter">${body}</section>`);
    tocIndex++;
  }
  toc += '</ol></nav>';

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"/>
<title>AI 应用开发学习路线</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: "Microsoft YaHei", "微软雅黑", "PingFang SC", sans-serif;
    font-size: 11pt; line-height: 1.75; color: #1f2937;
    margin: 0; padding: 0;
  }
  .cover {
    height: 100vh; display: flex; flex-direction: column;
    justify-content: center; align-items: center; text-align: center;
    page-break-after: always;
  }
  .cover h1 { font-size: 32pt; color: #111827; margin-bottom: 16px; }
  .cover p { font-size: 14pt; color: #6b7280; }
  .toc { page-break-after: always; padding: 24px 0; }
  .toc h1 { font-size: 20pt; color: #111827; border-bottom: 2px solid #2563eb; padding-bottom: 8px; }
  .toc ol { font-size: 12pt; line-height: 2; }
  .toc a { color: #2563eb; text-decoration: none; }
  .chapter { page-break-before: always; }
  h1 { font-size: 22pt; color: #111827; border-bottom: 3px solid #2563eb; padding-bottom: 8px; margin-top: 0; }
  h2 { font-size: 16pt; color: #1d4ed8; border-left: 4px solid #2563eb; padding-left: 10px; margin-top: 28px; }
  h3 { font-size: 13.5pt; color: #374151; margin-top: 22px; }
  h4 { font-size: 12pt; color: #4b5563; }
  p { margin: 8px 0; }
  strong { color: #111827; }
  code {
    font-family: Consolas, "Courier New", monospace;
    background: #f3f4f6; color: #be185d;
    padding: 1px 5px; border-radius: 3px; font-size: 10pt;
  }
  pre {
    background: #111827; color: #e5e7eb;
    padding: 14px 18px; border-radius: 8px;
    overflow-x: auto; page-break-inside: avoid;
    font-size: 9.5pt; line-height: 1.6;
  }
  pre code { background: transparent; color: inherit; padding: 0; font-size: inherit; }
  table {
    border-collapse: collapse; width: 100%; margin: 12px 0;
    font-size: 10.5pt; page-break-inside: avoid;
  }
  th { background: #2563eb; color: #fff; padding: 8px 12px; text-align: left; }
  td { border: 1px solid #d1d5db; padding: 8px 12px; }
  tr:nth-child(even) td { background: #f9fafb; }
  blockquote {
    border-left: 4px solid #f59e0b; background: #fffbeb;
    padding: 10px 14px; margin: 12px 0; color: #92400e; border-radius: 0 6px 6px 0;
  }
  ul, ol { margin: 8px 0; padding-left: 26px; }
  li { margin: 4px 0; }
  hr { border: none; border-top: 1px dashed #d1d5db; margin: 20px 0; }
  a { color: #2563eb; }
  img { max-width: 90%; display: block; margin: 14px auto; border: 1px solid #e5e7eb; border-radius: 8px; page-break-inside: avoid; }
  /* 架构图：尺寸由 Node 按真实宽高比算好（mm），打印时不再推断 */
  .figure { margin: 18px auto; text-align: center; page-break-inside: avoid; break-inside: avoid; }
  .figure img { display: block; margin: 0 auto; background: #ffffff; box-sizing: border-box; }
  .figure figcaption { font-size: 9.5pt; color: #6b7280; margin-top: 6px; page-break-before: avoid; }
  /* Mermaid 图：渲染成功后交给 SVG；渲染失败（无网络）则降级为可读的源码框 */
  .mermaid { text-align: center; margin: 14px auto; page-break-inside: avoid; }
  .mermaid svg { max-width: 100%; height: auto; }
  .mermaid:not([data-processed="true"]) {
    display: block; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px;
    padding: 10px 14px; font-family: Consolas, "Courier New", monospace;
    font-size: 9pt; line-height: 1.5; white-space: pre-wrap; text-align: left; color: #475569;
  }
</style>
</head>
<body>
  <div class="cover">
    <h1>AI 应用开发</h1>
    <p>Java 开发者进阶指南 · 32 课系统学习路线</p>
    <p style="color:#9ca3af;font-size:10pt;">共 ${files.length} 个章节 · 由 Markdown 自动生成</p>
  </div>
  ${toc}
  ${sections.join('\n')}
${mermaidLib ? '<script>\n' + mermaidLib + '\n</script>' : ''}${mermaidBootstrap}
</body>
</html>`;

  // 3. 生成 PDF（先写入临时 HTML 文件，再用 file:// 打开，保证相对路径图片能加载）
  const tmpHtml = path.join(DIR, '~pdf-preview.html');
  // 这个中间文件内联了所有 base64 图片（数十 MB）：上一轮 page.pdf 抛异常时，
  // 后面的 unlinkSync 根本执行不到，残留会被 git add -A 当成课件提交。挂个 exit 兜底。
  try { if (fs.existsSync(tmpHtml)) fs.unlinkSync(tmpHtml); } catch (e) { /* 残留删除失败不致命 */ }
  process.on('exit', () => { try { if (fs.existsSync(tmpHtml)) fs.unlinkSync(tmpHtml); } catch (e) { /* 忽略 */ } });
  fs.writeFileSync(tmpHtml, html, 'utf-8');
  const executablePath = fs.existsSync(EDGE_PATH) ? EDGE_PATH : undefined;
  console.log('🚀 启动浏览器（' + (executablePath || '默认 Chrome') + '）...');
  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    // 473 页的长文档打印会走完整 CDP 往返，默认的协议超时会先把会话掉掉
    protocolTimeout: 1800000,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--font-render-hinting=none'],
  });
  const page = await browser.newPage();
  await page.goto('file:///' + tmpHtml.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  // 等待 Mermaid 渲染结束；超时不致命，会降级为源码框
  await page.waitForFunction('window.__bootDone === true', { timeout: 240000, polling: 500 })
    .catch(() => console.warn('⚠️ Mermaid 加载超时（无网络？），流程图将以源码形式呈现'));
  await page.evaluateHandle('document.fonts.ready').catch(() => {});

  // ---- 打印前：把每张架构图用 canvas 重编码为 JPEG（≤1600px，q0.85）----
  // 1) 原始 PNG 常有透明通道、体积上 MB，走打印管线时既慢又容易被降采样失真；
  // 2) 重编码后白底不透明，打印驱动一律当普通 JPEG 处理，可靠性最高；
  // 3) PDF 体积从 ~24MB 降到十几 MB，GitHub 预览才拉得动。
  const convert = await page.evaluate(async () => {
    const toJpeg = (img) => new Promise((resolve) => {
      try {
        const MAXW = 1600;
        const nw = img.naturalWidth || 1, nh = img.naturalHeight || 1;
        const k = Math.min(1, MAXW / nw);
        const cw = Math.max(1, Math.round(nw * k)), ch = Math.max(1, Math.round(nh * k));
        const cvs = document.createElement('canvas');
        cvs.width = cw; cvs.height = ch;
        const ctx = cvs.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, 0, 0, cw, ch);
        resolve(cvs.toDataURL('image/jpeg', 0.85));
      } catch (e) { resolve('ERR:' + ((e && e.message) || e)); }
    });
    const rows = [];
    for (const im of Array.from(document.images)) {
      const before = (im.currentSrc || im.src || '').length;
      const data = await toJpeg(im);
      if (data.indexOf('data:') === 0) {
        im.src = data;
        try { await im.decode(); } catch (e) { /* 解码失败交给下面的 diag 统计 */ }
        rows.push({ alt: im.alt || 'untitled', ok: true, beforeKB: Math.round(before / 1024), afterKB: Math.round(data.length * 0.75 / 1024), natural: im.naturalWidth + 'x' + im.naturalHeight });
      } else {
        rows.push({ alt: im.alt || 'untitled', ok: false, err: data });
      }
    }
    return rows;
  });
  const converted = convert.filter(c => c.ok).length;
  console.log(`🎨 架构图重编码为 JPEG：${converted}/${convert.length} 张`);
  convert.forEach(c => console.log('   - ' + (c.ok ? `${c.alt} ${c.natural} ${c.beforeKB}KB→${c.afterKB}KB` : `${c.alt} 失败 ${c.err}`)));

  // 诊断：把“图到底有没有进去”量化输出到日志
  const diag = await page.evaluate(() => {
    const imgs = Array.from(document.images);
    const toMm = px => +(px * 25.4 / 96).toFixed(1);
    return {
      imgTotal: imgs.length,
      imgOk: imgs.filter(i => i.complete && i.naturalWidth > 0).length,
      imgBroken: imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => (i.alt || 'untitled')),
      // 纸面尺寸：只知“加载好了”不够，必须知道它在版面上真占了一块地方
      boxes: imgs.map(i => ({ alt: i.alt || 'untitled', wMm: toMm(i.clientWidth), hMm: toMm(i.clientHeight) })),
      mermaidTotal: document.querySelectorAll('.mermaid').length,
      // 以“节点里真的长出了 <svg>”为准，data-processed 只是 mermaid 自己打的标记，不可信
      mermaidOk: Array.prototype.filter.call(document.querySelectorAll('.mermaid'), function (n) { return !!n.querySelector('svg'); }).length,
      mermaidFailed: (window.__mermaidDetail || []).filter(function (d) { return !d.ok; }).map(function (d) { return d.src; }),
      mermaidStatus: window.__mermaidStatus || 'timeout',
    };
  });
  diag.visibleBoxes = diag.boxes.filter(b => b.hMm > 20 && b.wMm > 20).length;
  console.log(`🖼  版面占位确认：${diag.visibleBoxes}/${diag.imgTotal} 张图在纸面上有真实尺寸`);
  diag.boxes.forEach(b => console.log(`   - ${b.alt}: ${b.wMm}mm × ${b.hMm}mm`));
  console.log(`📈 流程图渲染：${diag.mermaidOk}/${diag.mermaidTotal} 幅（${diag.mermaidStatus}）`);
  if (diag.mermaidFailed && diag.mermaidFailed.length) {
    console.log('   未渲染成图（保留为源码框）：' + diag.mermaidFailed.slice(0, 8).join(' / ') + (diag.mermaidFailed.length > 8 ? ` …等 ${diag.mermaidFailed.length} 幅` : ''));
  }
  if (diag.imgBroken.length) console.log('   加载失败：' + diag.imgBroken.join(', '));
  if (missingImages.size) console.log(`⚠️  MD 中引用但磁盘上不存在的图片：${[...missingImages].join(', ')}`);
  if (diag.imgTotal === 0) console.warn('❗ HTML 里一张图都没有 —— 请检查 .md 的 ![](png) 语法');

  console.log('📄 生成 PDF 中（473 页量级，预留 15 分钟）...');
  await page.pdf({
    path: OUTPUT_PDF,
    // puppeteer 默认 30s 就抛 “Timed out after waiting 30000ms”，长文档必须显式抬高
    timeout: 900000,
    format: 'A4',
    printBackground: true,
    margin: { top: '18mm', bottom: '18mm', left: '14mm', right: '14mm' },
    displayHeaderFooter: true,
    headerTemplate: '<div style="font-size:8px;color:#9ca3af;width:100%;text-align:center;padding-top:4mm;">AI 应用开发</div>',
    footerTemplate: '<div style="font-size:8px;color:#9ca3af;width:100%;text-align:center;padding-bottom:4mm;">第 <span class="pageNumber"></span> 页 / 共 <span class="totalPages"></span> 页</div>',
    preferCSSPageSize: true,
  });
  await browser.close();
  fs.unlinkSync(tmpHtml);

  // ---- 字节级取证：把刚生成的 PDF 里的图像 XObject 解出来 ----
  let pdfInspect = null;
  try {
    const dumpDir = 'D:/acme/pdf-img-dump/after';
    fs.mkdirSync(dumpDir, { recursive: true });
    pdfInspect = inspectPdf(OUTPUT_PDF, dumpDir, 'D:/acme/pdf-inspect-after.json');
    console.log(`🔬 PDF 内部检查：图像 XObject ${pdfInspect.imageXObjects} 个，大图 ${pdfInspect.bigImages} 个，导出 ${pdfInspect.exported.length} 个到 ${dumpDir}`);
  } catch (e) {
    console.warn('🔬 PDF 内部检查失败：' + e.message);
  }

  const size = (fs.statSync(OUTPUT_PDF).size / 1024 / 1024).toFixed(2);
  console.log(`✅ PDF 生成成功！`);
  console.log(`   文件：${OUTPUT_PDF}`);
  console.log(`   大小：${size} MB，共 ${files.length} 章`);

  // 结构化诊断（由 node 直接写 UTF-8，避开 PowerShell 控制台 GBK 解码乱码）
  try {
    fs.writeFileSync('D:/acme/pdf-diag.json', JSON.stringify({
      at: new Date().toISOString(),
      chapters: files.length,
      pdfMB: Number(size),
      architectureImages: `${diag.imgOk}/${diag.imgTotal}`,
      onPaperImages: diag.visibleBoxes,
      jpegReencoded: `${converted}/${convert.length}`,
      pdfImageXObjects: pdfInspect ? pdfInspect.imageXObjects : null,
      pdfBigImages: pdfInspect ? pdfInspect.bigImages : null,
      pdfPages: pdfInspect ? pdfInspect.pages : null,
      figures: figureList,
      imageDetails: convert,
      brokenImages: diag.imgBroken,
      missingImageFiles: [...missingImages],
      mermaidSource: mermaidLib ? 'local-vendor' : 'cdn',
      flowchartsRendered: `${diag.mermaidOk}/${diag.mermaidTotal}`,
      mermaidStatus: diag.mermaidStatus,
      mermaidFailed: diag.mermaidFailed || [],
    }, null, 2), 'utf-8');
  } catch (e) { /* 诊断写入失败不影响构建 */ }

  if (diag.mermaidTotal > 0 && diag.mermaidOk === 0) {
    console.warn('❗ 流程图一幅都没渲染成功（PDF 里会退化为源码虚线框），不阻断推送，但必须查 mermaidStatus 原因。');
  }

  if (diag.imgOk === 0) {
    console.error('❌ 警告：PDF 中没有任何图片，请检查图片引用！');
    process.exitCode = 2;
  } else if (pdfInspect && pdfInspect.bigImages < 8) {
    console.error(`❌ PDF 字节里只找到 ${pdfInspect.bigImages} 张大图（应有 9 张架构图）——不要推送！`);
    process.exitCode = 3;
  } else {
    console.log(`✅ 取证通过：PDF 内含 ${pdfInspect ? pdfInspect.bigImages : '?'} 张大尺寸位图`);
  }
  console.log(`\n📌 以后追加新课程：把新的 .md 文件放入本目录（如 13-xxx.md），重新运行 node build-pdf.js 即可。`);
})().catch(err => {
  console.error('❌ PDF 生成失败：', err.message);
  process.exit(1);
});
