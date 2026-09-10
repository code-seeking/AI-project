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

function inline(text) {
  let s = escapeHtml(text);
  // 行内代码 `code`
  s = s.replace(/`([^`]+)`/g, (m, c) => `<code>${c}</code>`);
  // 加粗 **bold**
  s = s.replace(/\*\*([^*]+)\*\*/g, (m, c) => `<strong>${c}</strong>`);
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
        out.push(`<pre><code class="lang-${escapeHtml(codeLang || 'text')}">${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
        inCode = false;
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
  if (inCode) {
    out.push(`<pre><code class="lang-${escapeHtml(codeLang || 'text')}">${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
  }
  return out.join('\n');
}

// ============ 主流程 ============

(async () => {
  // 1. 收集 md 文件（排除本脚本和临时文件）
  const files = fs.readdirSync(DIR)
    .filter(f => f.endsWith('.md') && !f.startsWith('~'))
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
</body>
</html>`;

  // 3. 生成 PDF
  const executablePath = fs.existsSync(EDGE_PATH) ? EDGE_PATH : undefined;
  console.log('🚀 启动浏览器（' + (executablePath || '默认 Chrome') + '）...');
  const browser = await puppeteer.launch({
    executablePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--font-render-hinting=none'],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0', timeout: 60000 });
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

  const size = (fs.statSync(OUTPUT_PDF).size / 1024 / 1024).toFixed(2);
  console.log(`✅ PDF 生成成功！`);
  console.log(`   文件：${OUTPUT_PDF}`);
  console.log(`   大小：${size} MB，共 ${files.length} 章`);
  console.log(`\n📌 以后追加新课程：把新的 .md 文件放入本目录（如 13-xxx.md），重新运行 node build-pdf.js 即可。`);
})().catch(err => {
  console.error('❌ PDF 生成失败：', err.message);
  process.exit(1);
});
