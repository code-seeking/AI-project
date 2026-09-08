/**
 * 番茄钟插件 - 专注计时 + 统计
 */

exports.pomodoro_start = async (params, context) => {
  const task = params.task || '未命名任务'
  const minutes = params.minutes || (context.config && context.config.workMinutes) || 25

  // 记录专注session
  const sessions = context.storage.get('sessions') || []
  const session = {
    id: Date.now().toString(36),
    task,
    minutes,
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + minutes * 60000).toISOString(),
    completed: false
  }
  sessions.push(session)
  context.storage.set('sessions', sessions)

  return {
    success: true,
    message: `🍅 番茄钟已启动！专注任务「${task}」，时长 ${minutes} 分钟`,
    data: {
      sessionId: session.id,
      task,
      minutes,
      expectedEnd: session.endTime,
      tip: '专注期间请避免切换任务，保持心流状态'
    }
  }
}

exports.pomodoro_stats = async (params, context) => {
  const period = params.period || 'today' // today | week | all
  const sessions = context.storage.get('sessions') || []
  const now = new Date()

  let filtered = sessions
  if (period === 'today') {
    const todayStr = now.toISOString().slice(0, 10)
    filtered = sessions.filter(s => s.startTime.slice(0, 10) === todayStr)
  } else if (period === 'week') {
    const weekAgo = new Date(now - 7 * 86400000).toISOString()
    filtered = sessions.filter(s => s.startTime >= weekAgo)
  }

  const totalMinutes = filtered.reduce((sum, s) => sum + (s.minutes || 25), 0)
  const totalSessions = filtered.length
  const tasks = [...new Set(filtered.map(s => s.task))]

  return {
    success: true,
    data: {
      period,
      totalSessions,
      totalMinutes,
      totalHours: (totalMinutes / 60).toFixed(1),
      uniqueTasks: tasks.length,
      recentTasks: tasks.slice(-5),
      dailyAvg: period === 'week' ? (totalMinutes / 7).toFixed(0) : totalMinutes,
      streak: calculateStreak(sessions)
    }
  }
}

function calculateStreak(sessions) {
  if (!sessions.length) return 0
  const days = [...new Set(sessions.map(s => s.startTime.slice(0, 10)))].sort().reverse()
  let streak = 0
  const today = new Date().toISOString().slice(0, 10)
  let checkDate = new Date()

  for (let i = 0; i < 365; i++) {
    const dateStr = checkDate.toISOString().slice(0, 10)
    if (days.includes(dateStr)) {
      streak++
      checkDate = new Date(checkDate - 86400000)
    } else if (dateStr === today) {
      checkDate = new Date(checkDate - 86400000)
    } else {
      break
    }
  }
  return streak
}
