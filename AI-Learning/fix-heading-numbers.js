/**
 * fix-heading-numbers.js —— 课程 Markdown 章节序号统一为阿拉伯数字
 *
 *   ## 七、与你项目的关联          →  ## 7. 与你项目的关联
 *   ## 七点五、用 AI 工具实际体验   →  ## 7.5 用 AI 工具实际体验
 *   ## 六点六、Java 开发者视角：…   →  ## 6.6 Java 开发者视角：…
 *   ## 七、A   /  ## 七、B（重复号） →  第二个降为 ## 7.5 B（保留"插了一节"的语义，不顺延后续编号）
 *   ### 2.1 已是阿拉伯数字          →  不动（幂等）
 *   ## 导航 / ## 附录 A             →  不动（无序号）
 *
 * 用法：
 *   node fix-heading-numbers.js            # 干跑：只出报告，不改文件
 *   node fix-heading-numbers.js --apply    # 真正写盘
 * 报告：D:/acme/md-heading-report.json
 *   - files[].changes   逐条 before/after
 *   - files[].sequence  转换后 ## 序号序列（自检是否单调、有无重复）
 *   - files[].dups      被降级为 x.5 / x.6 的重复编号
 *   - refs              正文里残留的中文序号引用 / 锚点链接（只报告，人工判断）
 */
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const APPLY = process.argv.includes('--apply');
const REPORT = 'D:/acme/md-heading-report.json';

const DIGITS = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

// 中文数字 → 整数（支持 一..九十九，含 十/百 的省略写法）
function cn2int(s) {
  if (!s) return null;
  let total = 0, cur = 0, hit = false;
  for (const ch of s) {
    if (ch in DIGITS) { cur = DIGITS[ch]; hit = true; continue; }
    if (ch === '十') { total += (cur || 1) * 10; cur = 0; hit = true; continue; }
    if (ch === '百') { total += (cur || 1) * 100; cur = 0; hit = true; continue; }
    return null; // 含非数字汉字 → 不是序号
  }
  return hit ? total + cur : null;
}

// 中文序号标题；分隔符（、. ：:）必须存在，否则 "## 十种常见模式" 会被误读成 "## 10. 种常见模式"
const HEAD_CN = /^(#{1,6})\s+([零〇一两二三四五六七八九十百]+)(?:点([零〇一两二三四五六七八九十百]+))?\s*[、.：:]\s*(.*)$/;
// 转换后（或本来就写成阿拉伯数字）的标题
const HEAD_NUM = /^(#{1,6})\s+(\d+)(?:\.(\d+))?\s*[.、]?\s+(.*)$/;

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.md') && !f.startsWith('~')).sort();
const report = { mode: APPLY ? 'APPLY' : 'DRY-RUN', files: [], totalChanged: 0, refs: [] };

for (const file of files) {
  const p = path.join(DIR, file);
  const src = fs.readFileSync(p, 'utf-8');
  const lines = src.split('\n');
  const changes = [];

  // ---------- Pass A：中文序号 → 阿拉伯数字 ----------
  const out = lines.map((line, idx) => {
    const bare = line.replace(/\r$/, '');
    const m = HEAD_CN.exec(bare);
    if (!m) return line;
    const [, hashes, mainCn, subCn, title] = m;
    const main = cn2int(mainCn);
    if (main === null || main === 0 || main > 60) return line;
    if (!title.trim()) return line;

    let after;
    if (subCn) {
      const sub = cn2int(subCn);
      if (sub === null) return line;
      after = `${hashes} ${main}.${sub} ${title}`;      // 七点五 → 7.5（小数不带点号，与 ### 2.1 风格一致）
    } else {
      after = `${hashes} ${main}. ${title}`;            // 七 → 7.
    }
    changes.push({ line: idx + 1, before: bare, after });
    return line.endsWith('\r') ? after + '\r' : after;
  });

  // ---------- Pass B：## 层重复编号 → 降级为 x.5 / x.6 ----------
  const dups = [];
  const seen = new Map(); // 整数 -> 已出现次数
  for (let i = 0; i < out.length; i++) {
    const bare = out[i].replace(/\r$/, '');
    const m = HEAD_NUM.exec(bare);
    if (!m || m[1] !== '##') continue;
    const main = Number(m[2]);
    const sub = m[3] === undefined ? null : Number(m[3]);
    const title = m[4];
    if (sub !== null) continue; // 已经是 7.5 这类，跳过
    const n = (seen.get(main) || 0) + 1;
    seen.set(main, n);
    if (n >= 2) {
      const half = 3 + n; // 第 2 次出现 → x.5，第 3 次 → x.6（上次算成 4+n，把 7.5 写成了 7.6）
      const after = `## ${main}.${half} ${title}`;
      dups.push({ line: i + 1, before: bare, after });
      out[i] = bare === out[i] ? after : after + '\r';
      changes.push({ line: i + 1, before: bare, after, reason: 'duplicate-number' });
    }
  }

  // ---------- 自检：最终 ## 序号序列 ----------
  const sequence = out
    .map(l => l.replace(/\r$/, ''))
    .filter(l => /^##\s/.test(l))
    .map(l => {
      const m = HEAD_NUM.exec(l);
      if (!m) return l.replace(/^##\s+/, '');           // 无序号标题（导航/附录）原样记录
      return m[3] !== undefined ? `${m[2]}.${m[3]}` : `${m[2]}.`;
    });

  // ---------- 正文残留引用（不自动改，只登记） ----------
  out.forEach((line, idx) => {
    const t = line.replace(/\r$/, '');
    if (/^#{1,6}\s/.test(t)) return;
    if (/[零〇一两二三四五六七八九十百]+点[零〇一两二三四五六七八九十百]+/.test(t)
      || /第[零〇一两二三四五六七八九十百]+[章节]/.test(t)
      || /\]\(#%?[零〇一二三四五六七八九十]/.test(t)) {
      report.refs.push({ file, line: idx + 1, text: t.slice(0, 140) });
    }
  });

  if (changes.length || dups.length) {
    if (APPLY) fs.writeFileSync(p, out.join('\n'), 'utf-8');
    report.files.push({ file, changed: changes.length, dups, sequence, changes });
    report.totalChanged += changes.length;
  }
}

fs.writeFileSync(REPORT, JSON.stringify(report, null, 2), 'utf-8');
const dupTotal = report.files.reduce((a, f) => a + f.dups.length, 0);
console.log(`[${report.mode}] files=${report.files.length} headings=${report.totalChanged} dupFixed=${dupTotal} refs=${report.refs.length} report=${REPORT}`);

// ---------- --verify：改完之后重新体检，必须“零中文序号残留 + 零重复 ## 编号” ----------
if (process.argv.includes('--verify')) {
  const leftover = [];
  const dupLeft = [];
  for (const file of files) {
    const ls = fs.readFileSync(path.join(DIR, file), 'utf-8').split('\n').map(l => l.replace(/\r$/, ''));
    const seen = new Map();
    ls.forEach((l, i) => {
      if (HEAD_CN.test(l)) leftover.push({ file, line: i + 1, text: l.slice(0, 100) });
      const m = HEAD_NUM.exec(l);
      if (m && m[1] === '##' && m[3] === undefined) {
        const n = (seen.get(m[2]) || 0) + 1;
        seen.set(m[2], n);
        if (n >= 2) dupLeft.push({ file, line: i + 1, text: l.slice(0, 100) });
      }
    });
  }
  const v = { at: new Date().toISOString(), leftover, duplicateNumbers: dupLeft, ok: !leftover.length && !dupLeft.length };
  fs.writeFileSync('D:/acme/md-heading-verify.json', JSON.stringify(v, null, 2), 'utf-8');
  console.log(`[verify] leftover=${leftover.length} duplicate=${dupLeft.length} ok=${v.ok}`);
  process.exit(v.ok ? 0 : 1);
}

