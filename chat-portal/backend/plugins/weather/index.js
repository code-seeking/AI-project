/**
 * 天气查询插件 - 查询城市天气 + 穿衣建议
 */

// 模拟天气数据（实际可接入和风天气/心知天气API）
const WEATHER_DATA = {
  '北京': { temp: 28, condition: '晴', humidity: 45, wind: '东南风3级', aqi: 72 },
  '上海': { temp: 31, condition: '多云', humidity: 68, wind: '南风2级', aqi: 58 },
  '广州': { temp: 33, condition: '雷阵雨', humidity: 82, wind: '西南风2级', aqi: 45 },
  '深圳': { temp: 32, condition: '阵雨', humidity: 78, wind: '东风3级', aqi: 40 },
  '杭州': { temp: 30, condition: '晴转多云', humidity: 60, wind: '北风2级', aqi: 65 },
  '成都': { temp: 27, condition: '阴', humidity: 72, wind: '微风', aqi: 88 }
}

function getClothingAdvice(temp, condition) {
  if (temp >= 33) return '🌡️ 高温天气，建议穿轻薄透气衣物，注意防晒补水'
  if (temp >= 26) return '👕 温暖舒适，短袖T恤+薄裤即可'
  if (temp >= 20) return '🧥 微凉，建议薄外套或长袖'
  if (temp >= 10) return '🧣 较冷，建议穿毛衣+外套'
  return '🧤 寒冷，注意保暖，穿厚外套'
}

function getUvAdvice(condition) {
  if (condition.includes('晴')) return '☀️ 紫外线较强，出门请做好防晒'
  if (condition.includes('多云')) return '⛅ 紫外线中等，适当防晒'
  return '☁️ 紫外线较弱，无需特别防晒'
}

exports.weather_query = async (params, context) => {
  const city = params.city || (context.config && context.config.defaultCity) || '北京'
  const weather = WEATHER_DATA[city]

  if (!weather) {
    // 生成随机天气数据
    const temp = Math.floor(Math.random() * 20) + 15
    const conditions = ['晴', '多云', '阴', '小雨', '雷阵雨']
    const condition = conditions[Math.floor(Math.random() * conditions.length)]
    const result = {
      city,
      temp,
      condition,
      humidity: Math.floor(Math.random() * 50) + 40,
      wind: '微风',
      aqi: Math.floor(Math.random() * 100) + 20,
      advice: getClothingAdvice(temp, condition),
      uv: getUvAdvice(condition),
      updatedAt: new Date().toISOString()
    }
    return { success: true, data: result }
  }

  return {
    success: true,
    data: {
      city,
      ...weather,
      advice: getClothingAdvice(weather.temp, weather.condition),
      uv: getUvAdvice(weather.condition),
      updatedAt: new Date().toISOString()
    }
  }
}
