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

const puppeteer = require('D:/acme/pdf-gen/node_modules/puppeteer');

const DIR = __dirname;
const OUTPUT_PDF = path.join(DIR, 'AI应用开发.pdf');
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

// ============ Markdown → HTML 转换器（覆盖课程使用的语法） ============

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
      out.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`);
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

    // 普通段落
    closeList();
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
  img { max-width: 92%; max-height: 225mm; display: block; margin: 14px auto; border: 1px solid #e5e7eb; border-radius: 8px; page-break-inside: avoid; }
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
<script type="module">
  // 流程图渲染：失败不阻断构建（架构图为 PNG内联，不依赖此处）
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
</script>
</body>
</html>`;

  // 3. 生成 PDF（先写入临时 HTML 文件，再用 file:// 打开，保证相对路径图片能加载）
  const tmpHtml = path.join(DIR, '~pdf-preview.html');
  fs.writeFileSync(tmpHtml, html, 'utf-8');
  const executablePath = fs.existsSync(EDGE_PATH) ? EDGE_PATH : undefined;
  console.log('🚀 启动浏览器（' + (executablePath || '默认 Chrome') + '）...');
  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--font-render-hinting=none'],
  });
  const page = await browser.newPage();
  await page.goto('file:///' + tmpHtml.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  // 等待 Mermaid 渲染结束；超时不致命，会降级为源码框
  await page.waitForFunction('window.__bootDone === true', { timeout: 60000, polling: 500 })
    .catch(() => console.warn('⚠️ Mermaid 加载超时（无网络？），流程图将以源码形式呈现'));
  await page.evaluateHandle('document.fonts.ready').catch(() => {});

  // 诊断：把“图到底有没有进去”量化输出到日志
  const diag = await page.evaluate(() => {
    const imgs = Array.from(document.images);
    return {
      imgTotal: imgs.length,
      imgOk: imgs.filter(i => i.complete && i.naturalWidth > 0).length,
      imgBroken: imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => (i.alt || 'untitled')),
      mermaidTotal: document.querySelectorAll('.mermaid').length,
      mermaidOk: document.querySelectorAll('.mermaid[data-processed="true"]').length,
      mermaidStatus: window.__mermaidStatus || 'timeout',
    };
  });
  console.log(`🖼  架构图加载：${diag.imgOk}/${diag.imgTotal} 张`);
  if (diag.imgBroken.length) console.log('   加载失败：' + diag.imgBroken.join(', '));
  console.log(`📈 流程图渲染：${diag.mermaidOk}/${diag.mermaidTotal} 幅（${diag.mermaidStatus}）`);
  if (missingImages.size) console.log(`⚠️  MD 中引用但磁盘上不存在的图片：${[...missingImages].join(', ')}`);
  if (diag.imgTotal === 0) console.warn('❗ HTML 里一张图都没有 —— 请检查 .md 的 ![](png) 语法');

  console.log('📄 生成 PDF 中...');
  await page.pdf({
    path: OUTPUT_PDF,
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

  const size = (fs.statSync(OUTPUT_PDF).size / 1024 / 1024).toFixed(2);
  console.log(`✅ PDF 生成成功！`);
  console.log(`   文件：${OUTPUT_PDF}`);
  console.log(`   大小：${size} MB，共 ${files.length} 章`);
  if (diag.imgOk === 0) {
    console.error('❌ 警告：PDF 中没有任何图片，请检查图片引用！');
    process.exitCode = 2;
  }
  console.log(`\n📌 以后追加新课程：把新的 .md 文件放入本目录（如 13-xxx.md），重新运行 node build-pdf.js 即可。`);
})().catch(err => {
  console.error('❌ PDF 生成失败：', err.message);
  process.exit(1);
});
