/**
 * Multimodal Module - 多模态交互处理
 * 支持图片理解、OCR提取、语音转文字
 */
const fs = require('fs')
const path = require('path')

const UPLOAD_DIR = path.join(__dirname, 'data', 'uploads')

// 确保上传目录存在
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

/**
 * 分析图片 - 调用 LLM Vision API
 * @param {string} imageBase64 - Base64 编码的图片
 * @param {string} prompt - 分析提示词
 * @param {Function} callLLM - LLM 调用函数
 */
async function analyzeImage(imageBase64, prompt, callLLM) {
  const systemPrompt = `你是一个多模态AI助手，擅长分析图片内容。请根据用户的提示分析图片。
如果用户没有给出具体提示，请：
1. 描述图片的主要内容
2. 如果包含文字，提取所有文字
3. 如果包含代码，提取并格式化代码
4. 如果包含表格/图表，提取结构化数据
5. 给出有用的分析和建议`

  const userPrompt = prompt || '请分析这张图片的内容'

  try {
    const result = await callLLM([
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: imageBase64
            }
          },
          {
            type: 'text',
            text: userPrompt
          }
        ]
      }
    ])
    return { success: true, analysis: result }
  } catch (err) {
    // 降级：如果 Vision API 不可用，返回模拟分析
    return {
      success: true,
      analysis: `[图片分析] 已收到图片 (${(imageBase64.length * 0.75 / 1024).toFixed(1)}KB)。\n提示: ${userPrompt}\n\n注意: 当前 LLM 可能不支持 Vision API，请确认模型配置。`,
      degraded: true
    }
  }
}

/**
 * OCR 提取 - 从图片中提取结构化数据
 */
async function extractStructured(imageBase64, extractType, callLLM) {
  const prompts = {
    table: '请识别图片中的表格，以 JSON 数组格式返回，每行一个对象。只返回 JSON，不要其他文字。',
    text: '请提取图片中的所有文字内容，保持原始格式。',
    code: '请提取图片中的代码，以代码块格式返回。指明编程语言。',
    card: '请提取图片中的关键信息（姓名、电话、邮箱、公司、职位等），以 JSON 格式返回。',
    receipt: '请提取图片中的账单/发票信息（日期、金额、项目、商家等），以 JSON 格式返回。'
  }

  const prompt = prompts[extractType] || prompts.text
  return await analyzeImage(imageBase64, prompt, callLLM)
}

/**
 * 语音转文字 (服务端处理 - 接收音频数据)
 * 实际使用浏览器 Web Speech API，这里提供备用方案
 */
function processAudio(audioBase64, format = 'webm') {
  // 保存音频文件（备用）
  const filename = `audio_${Date.now()}.${format}`
  const filepath = path.join(UPLOAD_DIR, filename)
  fs.writeFileSync(filepath, Buffer.from(audioBase64, 'base64'))

  return {
    success: true,
    message: '音频已接收，请使用浏览器 Web Speech API 进行语音识别',
    file: filename,
    size: (audioBase64.length * 0.75 / 1024).toFixed(1) + 'KB'
  }
}

/**
 * 生成图片描述（用于无障碍访问）
 */
async function describeImage(imageBase64, callLLM) {
  return await analyzeImage(imageBase64, '请用一句话简洁描述这张图片的内容，用于无障碍访问。', callLLM)
}

/**
 * 图片转代码
 */
async function imageToCode(imageBase64, language, callLLM) {
  const prompt = `请分析这张 UI 设计稿/截图，生成对应的 ${language || 'HTML + CSS'} 代码。
要求：
1. 尽可能还原设计稿的布局和样式
2. 使用语义化标签
3. 响应式设计
4. 代码注释清晰`

  return await analyzeImage(imageBase64, prompt, callLLM)
}

module.exports = {
  analyzeImage,
  extractStructured,
  processAudio,
  describeImage,
  imageToCode,
  UPLOAD_DIR
}
