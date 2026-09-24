/**
 * add-toc-backlink.js —— 给每课「## 导航」表格加"返回目录"列
 *
 *   | 上一课 | 下一课 |          →  | 上一课 | 下一课 | 返回 |
 *   | --- | --- |                  →  | --- | --- | --- |
 *   | [第 02 课…] | — |            →  | [第 02 课…] | — | [课程目录](README.md) |
 *
 * 特例：
 *   第 01 课的"上一课"为 —  →  补 [第 00 课：学习路线图](00-学习路线图.md)
 *   第 32 课的"下一课"保持 —（返回列已指向目录）
 *
 * 用法：
 *   node add-toc-backlink.js            # 干跑：只出报告，不改文件
 *   node add-toc-backlink.js --apply    # 真正写盘
 *   node add-toc-backlink.js --verify   # 改完之后重新体检（exit 1 = 有遗漏）
 * 报告：D:/acme/md-nav-report.json
 */
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const APPLY = process.argv.includes('--apply');
const VERIFY = process.argv.includes('--verify');
const REPORT = 'D:/acme/md-nav-report.json';

const LESSON = /^(\d{2})-(.+)\.md$/;
const files = fs.readdirSync(DIR)
  .filter(f => LESSON.test(f) && f !== '00-学习路线图.md')
  .sort();
const report = { mode: APPLY ? 'APPLY' : 'DRY-RUN', files: [], totalChanged: 0, skipped: [] };

for (const file of files) {
  const num = Number(LESSON.exec(file)[1]);
  const p = path.join(DIR, file);
  const src = fs.readFileSync(p, 'utf-8');
  const lines = src.split('\n');
  const changes = [];

  // 已有返回列 → 幂等跳过
  if (lines.some(l => l.replace(/\r$/, '').includes('[课程目录](README.md)'))) {
    report.skipped.push(file);
    continue;
  }

  // 定位「## 导航」表格
  const navIdx = lines.findIndex(l => /^##\s*导航\s*(\r)?$/.test(l));
  if (navIdx === -1) { report.skipped.push(file + ':no-nav'); continue; }

  let headerIdx = -1;
  for (let i = navIdx + 1; i < Math.min(navIdx + 6, lines.length); i++) {
    if (/^\|/.test(lines[i].replace(/\r$/, ''))) { headerIdx = i; break; }
  }
  if (headerIdx === -1) { report.skipped.push(file + ':no-table'); continue; }

  const cr = lines[headerIdx].endsWith('\r') ? '\r' : '';
  const bare = i => lines[i].replace(/\r$/, '');
  const sepIdx = headerIdx + 1;
  if (!/^\|\s*---/.test(bare(sepIdx))) { report.skipped.push(file + ':no-sep'); continue; }
  const bodyIdx = sepIdx + 1;
  if (!/^\|/.test(bare(bodyIdx))) { report.skipped.push(file + ':no-body'); continue; }

  // 1) 表头加"返回"列
  const headerBefore = bare(headerIdx);
  const headerAfter = headerBefore.replace(/\s*\|\s*$/, ' | 返回 |');
  lines[headerIdx] = headerAfter + cr;
  changes.push({ line: headerIdx + 1, before: headerBefore, after: headerAfter });

  // 2) 分隔行加一列
  const sepBefore = bare(sepIdx);
  const sepAfter = sepBefore.replace(/\s*\|\s*$/, ' | --- |');
  lines[sepIdx] = sepAfter + cr;
  changes.push({ line: sepIdx + 1, before: sepBefore, after: sepAfter });

  // 3) 数据行加返回链接；第 01 课的空"上一课"补学习路线图
  const bodyBefore = bare(bodyIdx);
  let bodyAfter = bodyBefore.replace(/\s*\|\s*$/, ' | [课程目录](README.md) |');
  if (num === 1) {
    bodyAfter = bodyAfter.replace(/^\|\s*—\s*\|/, '| [第 00 课：学习路线图](00-学习路线图.md) |');
  }
  lines[bodyIdx] = bodyAfter + cr;
  changes.push({ line: bodyIdx + 1, before: bodyBefore, after: bodyAfter });

  if (APPLY) fs.writeFileSync(p, lines.join('\n'), 'utf-8');
  report.files.push({ file, changes });
  report.totalChanged += changes.length;
}

fs.writeFileSync(REPORT, JSON.stringify(report, null, 2), 'utf-8');
console.log(`[${report.mode}] files=${report.files.length} lines=${report.totalChanged} skipped=${report.skipped.length} report=${REPORT}`);

// ---------- --verify：每课必须有返回列，且表格结构完好 ----------
if (VERIFY) {
  const problems = [];
  for (const file of files) {
    const ls = fs.readFileSync(path.join(DIR, file), 'utf-8').split('\n').map(l => l.replace(/\r$/, ''));
    if (!ls.some(l => l.includes('[课程目录](README.md)'))) problems.push({ file, issue: 'no-backlink' });
    const body = ls.find(l => l.includes('[课程目录](README.md)'));
    if (body && (body.match(/\|/g) || []).length < 4) problems.push({ file, issue: 'broken-table', row: body });
  }
  const v = { at: new Date().toISOString(), problems, ok: problems.length === 0 };
  fs.writeFileSync('D:/acme/md-nav-verify.json', JSON.stringify(v, null, 2), 'utf-8');
  console.log(`[verify] problems=${problems.length} ok=${v.ok}`);
  process.exit(v.ok ? 0 : 1);
}
