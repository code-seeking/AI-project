/**
 * Desktop Agent - 桌面自动化引擎
 * 屏幕感知 + 操控执行 + 安全审批
 * 技术: screenshot-desktop (截屏) + child_process (操控)
 */
const { execSync, exec } = require('child_process')
const fs = require('fs')
const path = require('path')

const RECORDS_DIR = path.join(__dirname, 'data', 'desktop-records')
if (!fs.existsSync(RECORDS_DIR)) fs.mkdirSync(RECORDS_DIR, { recursive: true })

// 操作历史记录
const actionHistory = []
const MAX_HISTORY = 100

// 危险操作关键词（需要审批）
const DANGEROUS_KEYWORDS = ['delete', 'format', 'remove', 'rm ', 'del ', 'rmdir', 'shutdown', 'restart', 'reg delete']

/**
 * 截取屏幕
 * @param {string} target - "fullscreen" | "active_window" | { x, y, w, h }
 * @returns {{ image: string, timestamp: string, screenSize: {width, height} }}
 */
async function takeScreenshot(target = 'fullscreen') {
  const timestamp = new Date().toISOString()
  const filename = `screen_${Date.now()}.png`
  const filepath = path.join(RECORDS_DIR, filename)

  try {
    // Windows: 使用 PowerShell 截屏
    const script = target === 'fullscreen'
      ? `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen | ForEach-Object { $bmp = New-Object System.Drawing.Bitmap($_.Bounds.Width, $_.Bounds.Height); $g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($_.Bounds.Location, [System.Drawing.Point]::Empty, $_.Bounds.Size); $bmp.Save('${filepath.replace(/\\/g, '\\\\')}') }`
      : `Add-Type -AssemblyName System.Windows.Forms; $bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen; $bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height); $g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size); $bmp.Save('${filepath.replace(/\\/g, '\\\\')}')`

    execSync(`powershell -NoProfile -Command "${script}"`, { timeout: 10000 })

    if (fs.existsSync(filepath)) {
      const imageBuffer = fs.readFileSync(filepath)
      const base64 = imageBuffer.toString('base64')

      // 获取屏幕尺寸
      let screenSize = { width: 1920, height: 1080 }
      try {
        const sizeOut = execSync('powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; $s = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; Write-Output \\"$($s.Width)x$($s.Height)\\""', { timeout: 5000 }).toString().trim()
        const [w, h] = sizeOut.split('x').map(Number)
        if (w && h) screenSize = { width: w, height: h }
      } catch {}

      // 清理临时文件（保留最近10张）
      cleanupScreenshots()

      return { success: true, image: base64, timestamp, screenSize, file: filename }
    }
    return { success: false, error: '截屏文件未生成' }
  } catch (err) {
    return { success: false, error: `截屏失败: ${err.message}` }
  }
}

/**
 * 分析 UI 元素（通过 LLM Vision）
 * @param {string} imageBase64 - 截屏 base64
 * @param {string} instruction - 分析指令
 * @param {Function} callLLM - LLM 调用函数
 */
async function analyzeUI(imageBase64, instruction, callLLM) {
  const prompt = `你是一个桌面 UI 分析助手。分析截图中的 UI 元素。
用户指令: ${instruction || '识别所有可交互元素'}

请以 JSON 数组格式返回找到的元素，每个元素包含:
- label: 元素文字/描述
- type: 元素类型 (button/input/text/icon/menu/window/taskbar)
- bbox: 边界框 {x, y, w, h} (像素坐标，基于图片尺寸估算)
- confidence: 置信度 0-1

只返回 JSON 数组，不要其他文字。`

  try {
    const result = await callLLM([
      { role: 'system', content: '你是桌面 UI 元素检测专家。根据截图识别 UI 元素并返回坐标。' },
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageBase64 } },
          { type: 'text', text: prompt }
        ]
      }
    ])

    // 尝试解析 JSON
    let elements = []
    try {
      const jsonMatch = result.match(/\[[\s\S]*\]/)
      if (jsonMatch) elements = JSON.parse(jsonMatch[0])
    } catch {}

    return { success: true, elements, raw: result }
  } catch (err) {
    return { success: false, error: err.message, elements: [] }
  }
}

/**
 * 执行桌面操控动作
 * @param {Array} actions - 动作列表
 * @returns {{ success, results }}
 */
async function executeActions(actions) {
  const results = []

  for (const action of actions) {
    try {
      const result = await executeSingleAction(action)
      results.push({ action, ...result })
      recordAction(action, result)

      // 动作间延迟，避免过快
      await sleep(300)
    } catch (err) {
      results.push({ action, success: false, error: err.message })
      recordAction(action, { success: false, error: err.message })
    }
  }

  return { success: results.every(r => r.success), results }
}

/**
 * 执行单个动作
 */
async function executeSingleAction(action) {
  const { type } = action

  switch (type) {
    case 'click':
      return await mouseClick(action.x, action.y, action.button || 'left')
    case 'double_click':
      return await mouseDoubleClick(action.x, action.y)
    case 'right_click':
      return await mouseClick(action.x, action.y, 'right')
    case 'move':
      return await mouseMove(action.x, action.y)
    case 'drag':
      return await mouseDrag(action.fromX, action.fromY, action.toX, action.toY)
    case 'scroll':
      return await mouseScroll(action.x, action.y, action.delta || -3)
    case 'type':
      return await keyType(action.text)
    case 'hotkey':
      return await keyHotkey(action.keys)
    case 'key':
      return await keyPress(action.key)
    case 'wait':
      await sleep(action.ms || 1000)
      return { success: true, message: `等待 ${action.ms || 1000}ms` }
    default:
      return { success: false, error: `未知动作类型: ${type}` }
  }
}

// ===== 鼠标操作 (PowerShell + user32.dll) =====

async function mouseClick(x, y, button = 'left') {
  const btn = button === 'right' ? 'RightButton' : 'LeftButton'
  const script = `Add-Type @'
using System; using System.Runtime.InteropServices;
public class Mouse {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
  public static void Click(int x, int y, bool right) {
    SetCursorPos(x, y);
    int down = right ? 0x0008 : 0x0002;
    int up = right ? 0x0010 : 0x0004;
    mouse_event(down, 0, 0, 0, 0);
    mouse_event(up, 0, 0, 0, 0);
  }
}
'@; [Mouse]::Click(${x}, ${y}, ${button === 'right' ? '$true' : '$false'})`

  execSync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"')}"`, { timeout: 5000 })
  return { success: true, message: `${button} click at (${x}, ${y})` }
}

async function mouseDoubleClick(x, y) {
  await mouseClick(x, y, 'left')
  await sleep(50)
  await mouseClick(x, y, 'left')
  return { success: true, message: `double click at (${x}, ${y})` }
}

async function mouseMove(x, y) {
  const script = `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Cursor { [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y); }'; [Cursor]::SetCursorPos(${x}, ${y})`
  execSync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"')}"`, { timeout: 5000 })
  return { success: true, message: `move to (${x}, ${y})` }
}

async function mouseDrag(fromX, fromY, toX, toY) {
  const script = `Add-Type @'
using System; using System.Runtime.InteropServices;
public class Drag {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
  public static void Do(int fx, int fy, int tx, int ty) {
    SetCursorPos(fx, fy);
    mouse_event(0x0002, 0, 0, 0, 0);
    SetCursorPos(tx, ty);
    mouse_event(0x0004, 0, 0, 0, 0);
  }
}
'@; [Drag]::Do(${fromX}, ${fromY}, ${toX}, ${toY})`
  execSync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"')}"`, { timeout: 5000 })
  return { success: true, message: `drag (${fromX},${fromY}) -> (${toX},${toY})` }
}

async function mouseScroll(x, y, delta) {
  const script = `Add-Type @'
using System; using System.Runtime.InteropServices;
public class Scroll {
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
  public static void Do(int x, int y, int d) { SetCursorPos(x, y); mouse_event(0x0800, 0, 0, d * 120, 0); }
}
'@; [Scroll]::Do(${x}, ${y}, ${delta})`
  execSync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"')}"`, { timeout: 5000 })
  return { success: true, message: `scroll ${delta} at (${x}, ${y})` }
}

// ===== 键盘操作 =====

async function keyType(text) {
  // 使用 PowerShell SendKeys
  const escaped = text.replace(/([+^%~(){}[\]])/g, '{$1}').replace(/"/g, '`"')
  const script = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("${escaped}")`
  execSync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"')}"`, { timeout: 5000 })
  return { success: true, message: `typed: "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"` }
}

async function keyHotkey(keys) {
  // keys: ["ctrl", "s"] -> ^s
  const map = { ctrl: '^', alt: '%', shift: '+', win: '#' }
  let prefix = ''
  let main = ''
  for (const k of keys) {
    const lower = k.toLowerCase()
    if (map[lower]) prefix += map[lower]
    else main = lower === 'enter' ? '{ENTER}' : lower === 'tab' ? '{TAB}' : lower === 'escape' ? '{ESC}' : lower === 'delete' ? '{DELETE}' : lower === 'backspace' ? '{BACKSPACE}' : lower.length === 1 ? lower : `{${upper.toUpperCase()}}`
  }
  const combo = prefix + main
  const script = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("${combo}")`
  execSync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"')}"`, { timeout: 5000 })
  return { success: true, message: `hotkey: ${keys.join('+')}` }
}

async function keyPress(key) {
  const specialMap = { enter: '{ENTER}', tab: '{TAB}', escape: '{ESC}', delete: '{DELETE}', backspace: '{BACKSPACE}', up: '{UP}', down: '{DOWN}', left: '{LEFT}', right: '{RIGHT}', home: '{HOME}', end: '{END}', pageup: '{PGUP}', pagedown: '{PGDN}', f5: '{F5}', f11: '{F11}' }
  const k = specialMap[key.toLowerCase()] || (key.length === 1 ? key : `{${key.toUpperCase()}}`)
  const script = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("${k}")`
  execSync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"')}"`, { timeout: 5000 })
  return { success: true, message: `key: ${key}` }
}

// ===== 安全机制 =====

/**
 * 检查操作是否危险
 */
function isDangerousAction(actions) {
  const actionStr = JSON.stringify(actions).toLowerCase()
  return DANGEROUS_KEYWORDS.some(kw => actionStr.includes(kw))
}

/**
 * 记录操作历史
 */
function recordAction(action, result) {
  actionHistory.push({
    id: Date.now().toString(36),
    action,
    result: { success: result.success, message: result.message || result.error },
    timestamp: new Date().toISOString()
  })
  if (actionHistory.length > MAX_HISTORY) actionHistory.shift()
}

/**
 * 获取操作历史
 */
function getActionHistory(limit = 20) {
  return actionHistory.slice(-limit).reverse()
}

/**
 * 清理旧截屏文件
 */
function cleanupScreenshots() {
  try {
    const files = fs.readdirSync(RECORDS_DIR)
      .filter(f => f.startsWith('screen_') && f.endsWith('.png'))
      .sort()
    if (files.length > 10) {
      for (const f of files.slice(0, files.length - 10)) {
        fs.unlinkSync(path.join(RECORDS_DIR, f))
      }
    }
  } catch {}
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports = {
  takeScreenshot,
  analyzeUI,
  executeActions,
  isDangerousAction,
  getActionHistory,
  RECORDS_DIR
}
