// Chat Portal 悬浮球 - Content Script
// 在每个页面注入悬浮球 UI

;(function () {
  'use strict'

  // ===== 防止重复注入 =====
  if (document.getElementById('chat-portal-float-root')) return

  const BACKEND = 'http://localhost:3001'

  // ===== 样式定义（先用 IIFE 加载到 shadow DOM）=====
  const CSS_STYLES = `/* ===== Chat Portal 悬浮球全局样式 ===== */

/* ===== 容器 ===== */
.cpf-wrap {
  position: fixed;
  z-index: 2147483647;
  user-select: none;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

/* ===== 悬浮球主体 ===== */
.cpf-ball {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4fc3f7, #7c4dff);
  cursor: pointer;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease;
  box-shadow: 0 4px 20px rgba(79, 195, 247, 0.3), 0 0 60px rgba(79, 195, 247, 0.1);
}

.cpf-ball:hover {
  transform: scale(1.08);
  box-shadow: 0 6px 28px rgba(79, 195, 247, 0.4), 0 0 80px rgba(79, 195, 247, 0.15);
}

.cpf-ball.dragging {
  transform: scale(1.12);
  box-shadow: 0 8px 32px rgba(79, 195, 247, 0.5), 0 0 100px rgba(79, 195, 247, 0.2);
}

/* ===== 发光 ===== */
.cpf-glow {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4fc3f7, #7c4dff);
  opacity: 0.3;
  filter: blur(8px);
  animation: cpfGlowPulse 3s ease-in-out infinite;
}

@keyframes cpfGlowPulse {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.08); }
}

/* ===== 旋转环 ===== */
.cpf-ring {
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  border: 2px solid transparent;
  border-top-color: rgba(79, 195, 247, 0.4);
  border-right-color: rgba(124, 77, 255, 0.4);
  animation: cpfRingRotate 4s linear infinite;
}

@keyframes cpfRingRotate {
  to { transform: rotate(360deg); }
}

/* ===== 脉动点 ===== */
.cpf-pulse {
  position: absolute;
  inset: -12px;
  border-radius: 50%;
  border: 2px solid rgba(79, 195, 247, 0.15);
  animation: cpfPulseRing 2s ease-out infinite;
}

@keyframes cpfPulseRing {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(1.5); opacity: 0; }
}

/* ===== 内部图标 ===== */
.cpf-inner {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.cpf-icon {
  width: 22px;
  height: 22px;
  transition: transform 0.3s ease;
}

.cpf-ball.dragging .cpf-icon {
  transform: scale(1.1);
}

/* ===== 菜单 ===== */
.cpf-menu {
  position: absolute;
  right: 64px;
  top: 50%;
  transform: translateY(-50%) scale(0.85);
  transform-origin: right center;
  background: rgba(30, 41, 59, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 8px;
  min-width: 180px;
  opacity: 0;
  visibility: hidden;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  max-height: 420px;
  overflow-y: auto;
}

.cpf-wrap.expanded .cpf-menu {
  opacity: 1;
  visibility: visible;
  transform: translateY(-50%) scale(1);
}

.cpf-menu-header {
  font-size: 11px;
  color: #64748b;
  padding: 4px 10px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  margin-bottom: 4px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.cpf-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  color: #e2e8f0;
  font-size: 13px;
  position: relative;
}

.cpf-menu-item:hover {
  background: rgba(255, 255, 255, 0.06);
  transform: translateX(3px);
}

.cpf-mi-badge {
  margin-left: auto;
  background: rgba(79, 195, 247, 0.15);
  color: #4fc3f7;
  font-size: 10px;
  padding: 1px 7px;
  border-radius: 10px;
  display: none;
  font-weight: 600;
}

.cpf-mi-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.cpf-mi-icon svg {
  width: 16px;
  height: 16px;
}

.cpf-mi-icon.bookmarks { background: rgba(79, 195, 247, 0.15); color: #4fc3f7; }
.cpf-mi-icon.weread { background: rgba(129, 199, 132, 0.15); color: #81c784; }
.cpf-mi-icon.portal { background: rgba(255, 183, 77, 0.15); color: #ffb74d; }
.cpf-mi-icon.search { background: rgba(167, 139, 250, 0.15); color: #a78bfa; }

.cpf-menu-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
  margin: 6px 10px;
}

.cpf-menu-footer {
  padding: 6px 10px 2px;
}

.cpf-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #64748b;
}

.cpf-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
}

.cpf-status-dot.online {
  background: #4caf50;
  box-shadow: 0 0 6px rgba(76, 175, 80, 0.5);
}

.cpf-status-dot.offline {
  background: #ef5350;
  box-shadow: 0 0 6px rgba(239, 83, 80, 0.5);
}

.cpf-status-dot.error {
  background: #ff9800;
  box-shadow: 0 0 6px rgba(255, 152, 0, 0.5);
}

/* ===== 搜索面板 ===== */
.cpf-search-panel {
  position: absolute;
  right: 64px;
  top: 50%;
  transform: translateY(-50%) scale(0.85);
  transform-origin: right center;
  background: rgba(30, 41, 59, 0.97);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  width: 320px;
  max-height: 420px;
  opacity: 0;
  visibility: hidden;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.cpf-search-panel.active {
  opacity: 1;
  visibility: visible;
  transform: translateY(-50%) scale(1);
}

.cpf-search-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.cpf-search-icon {
  width: 16px;
  height: 16px;
  color: #64748b;
  flex-shrink: 0;
}

.cpf-search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: #e2e8f0;
  font-size: 14px;
  font-family: inherit;
}

.cpf-search-input::placeholder {
  color: #475569;
}

.cpf-search-close {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #64748b;
  border-radius: 6px;
  transition: all 0.2s;
}

.cpf-search-close:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #ef5350;
}

.cpf-search-close svg {
  width: 14px;
  height: 14px;
}

.cpf-search-results {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  max-height: 340px;
}

.cpf-search-results::-webkit-scrollbar {
  width: 4px;
}

.cpf-search-results::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.cpf-search-empty,
.cpf-search-loading {
  text-align: center;
  padding: 24px 12px;
  color: #475569;
  font-size: 13px;
}

.cpf-search-section-label {
  font-size: 10px;
  color: #64748b;
  padding: 6px 8px 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.cpf-search-result-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.cpf-search-result-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.cpf-sri-icon {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: rgba(79, 195, 247, 0.12);
  color: #4fc3f7;
}

.cpf-sri-icon.app {
  background: rgba(167, 139, 250, 0.12);
  color: #a78bfa;
}

.cpf-sri-icon svg {
  width: 14px;
  height: 14px;
}

.cpf-sri-body {
  flex: 1;
  min-width: 0;
}

.cpf-sri-title {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: #e2e8f0;
}

.cpf-sri-url {
  display: block;
  font-size: 10px;
  color: #475569;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ===== Toast ===== */
.cpf-toast {
  position: fixed;
  bottom: 90px;
  right: 80px;
  background: rgba(30, 41, 59, 0.95);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  padding: 14px 18px;
  max-width: 380px;
  color: #e2e8f0;
  font-size: 13px;
  line-height: 1.6;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  z-index: 2147483646;
  opacity: 0;
  transform: translateY(10px);
  transition: all 0.3s ease;
}

.cpf-toast.show {
  opacity: 1;
  transform: translateY(0);
}

.cpf-toast strong {
  color: #4fc3f7;
}
`

  // ===== 创建 DOM 结构 =====
  const root = document.createElement('div')
  root.id = 'chat-portal-float-root'
  root.style.cssText = 'all: initial; position: fixed; z-index: 2147483647; top: 0; left: 0; width: 0; height: 0;'

  // Shadow DOM 隔离
  const shadow = root.attachShadow({ mode: 'closed' })

  // 注入样式到 Shadow DOM
  const style = document.createElement('style')
  style.textContent = CSS_STYLES
  shadow.appendChild(style)

  // ===== HTML 结构 =====
  const template = document.createElement('div')
  template.innerHTML = `
    <div class="cpf-wrap" id="cpfWrap">
      <!-- 悬浮球主体 -->
      <div class="cpf-ball" id="cpfBall">
        <div class="cpf-glow"></div>
        <div class="cpf-ring"></div>
        <div class="cpf-inner" id="cpfInner">
          <svg class="cpf-icon" id="cpfIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
          </svg>
        </div>
        <div class="cpf-pulse"></div>
      </div>

      <!-- 菜单 -->
      <div class="cpf-menu" id="cpfMenu">
        <div class="cpf-menu-header">Chat Portal</div>

        <div class="cpf-menu-item" data-action="bookmarks">
          <div class="cpf-mi-icon bookmarks">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <span>书签列表</span>
          <span class="cpf-mi-badge" id="cpfBadge"></span>
        </div>

        <div class="cpf-menu-item" data-action="weread">
          <div class="cpf-mi-icon weread">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          </div>
          <span>微信阅读</span>
        </div>

        <div class="cpf-menu-item" data-action="portal">
          <div class="cpf-mi-icon portal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          </div>
          <span>打开 Chat Portal</span>
        </div>

        <div class="cpf-menu-item" data-action="search">
          <div class="cpf-mi-icon search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <span>快速搜索</span>
        </div>

        <div class="cpf-menu-divider"></div>

        <div class="cpf-menu-footer" id="cpfFooter">
          <div class="cpf-status" id="cpfStatus">
            <span class="cpf-status-dot" id="cpfStatusDot"></span>
            <span id="cpfStatusText">检测服务...</span>
          </div>
        </div>
      </div>

      <!-- 搜索面板 -->
      <div class="cpf-search-panel" id="cpfSearchPanel">
        <div class="cpf-search-header">
          <svg class="cpf-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input class="cpf-search-input" id="cpfSearchInput" type="text" placeholder="搜索书签或应用..." />
          <div class="cpf-search-close" id="cpfSearchClose">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </div>
        </div>
        <div class="cpf-search-results" id="cpfSearchResults">
          <div class="cpf-search-empty">输入关键词开始搜索...</div>
        </div>
      </div>
    </div>
  `

  shadow.appendChild(template)

  // 挂载到页面
  document.documentElement.appendChild(root)

  // ===== DOM 引用 =====
  const wrap = shadow.getElementById('cpfWrap')
  const ball = shadow.getElementById('cpfBall')
  const icon = shadow.getElementById('cpfIcon')
  const menu = shadow.getElementById('cpfMenu')
  const badge = shadow.getElementById('cpfBadge')
  const statusDot = shadow.getElementById('cpfStatusDot')
  const statusText = shadow.getElementById('cpfStatusText')
  const footer = shadow.getElementById('cpfFooter')
  const searchPanel = shadow.getElementById('cpfSearchPanel')
  const searchInput = shadow.getElementById('cpfSearchInput')
  const searchResults = shadow.getElementById('cpfSearchResults')
  const searchClose = shadow.getElementById('cpfSearchClose')

  let isExpanded = false
  let isSearchOpen = false
  let isDragging = false
  let dragStartX = 0, dragStartY = 0
  let startX = 0, startY = 0
  let moved = false

  // 位置持久化
  let ballPos = { x: window.innerWidth - 90, y: Math.floor(window.innerHeight * 0.25) }
  try {
    const saved = localStorage.getItem('cpf_ball_pos')
    if (saved) ballPos = JSON.parse(saved)
  } catch (e) {}

  updatePosition()

  // ===== 位置管理 =====
  function updatePosition() {
    wrap.style.left = ballPos.x + 'px'
    wrap.style.top = ballPos.y + 'px'
  }

  function savePosition() {
    try { localStorage.setItem('cpf_ball_pos', JSON.stringify(ballPos)) } catch (e) {}
  }

  // ===== 拖拽 =====
  ball.addEventListener('mousedown', onDragStart)
  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)

  ball.addEventListener('touchstart', onTouchStart, { passive: true })
  document.addEventListener('touchmove', onTouchMove, { passive: true })
  document.addEventListener('touchend', onTouchEnd)

  function onDragStart(e) {
    if (isExpanded || isSearchOpen) return
    isDragging = true
    moved = false
    dragStartX = e.clientX
    dragStartY = e.clientY
    startX = ballPos.x
    startY = ballPos.y
    ball.classList.add('dragging')
  }

  function onDragMove(e) {
    if (!isDragging) return
    const dx = e.clientX - dragStartX
    const dy = e.clientY - dragStartY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true
    ballPos.x = Math.max(0, Math.min(window.innerWidth - 60, startX + dx))
    ballPos.y = Math.max(0, Math.min(window.innerHeight - 60, startY + dy))
    updatePosition()
  }

  function onDragEnd() {
    if (isDragging) {
      isDragging = false
      ball.classList.remove('dragging')
      savePosition()
    }
  }

  function onTouchStart(e) {
    if (isExpanded || isSearchOpen) return
    const touch = e.touches[0]
    isDragging = true
    moved = false
    dragStartX = touch.clientX
    dragStartY = touch.clientY
    startX = ballPos.x
    startY = ballPos.y
  }

  function onTouchMove(e) {
    if (!isDragging) return
    const touch = e.touches[0]
    const dx = touch.clientX - dragStartX
    const dy = touch.clientY - dragStartY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true
    ballPos.x = Math.max(0, Math.min(window.innerWidth - 60, startX + dx))
    ballPos.y = Math.max(0, Math.min(window.innerHeight - 60, startY + dy))
    updatePosition()
  }

  function onTouchEnd() {
    isDragging = false
    savePosition()
  }

  // ===== 点击展开/收缩 =====
  ball.addEventListener('click', function (e) {
    if (moved) return
    if (isSearchOpen) return
    isExpanded = !isExpanded
    wrap.classList.toggle('expanded', isExpanded)
    if (isExpanded) {
      icon.innerHTML = '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'
      checkStatus()
      loadBookmarkCount()
    } else {
      icon.innerHTML = '<circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>'
    }
  })

  // 点击外部关闭
  document.addEventListener('click', function (e) {
    if (e.target.closest && !e.target.closest('#chat-portal-float-root')) {
      if (isExpanded) {
        isExpanded = false
        wrap.classList.remove('expanded')
        icon.innerHTML = '<circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>'
      }
      if (isSearchOpen) closeSearch()
    }
  }, true)

  // ===== 菜单操作 =====
  shadow.querySelectorAll('.cpf-menu-item').forEach(item => {
    item.addEventListener('click', function () {
      const action = this.dataset.action
      handleAction(action)
      isExpanded = false
      wrap.classList.remove('expanded')
      icon.innerHTML = '<circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>'
    })
  })

  function handleAction(action) {
    switch (action) {
      case 'bookmarks':
        showBookmarks()
        break
      case 'weread':
        openUrl('https://weread.qq.com/web/shelf')
        break
      case 'portal':
        chrome.runtime.sendMessage({ action: 'openChatPortal' })
        break
      case 'search':
        openSearch()
        break
    }
  }

  // ===== 书签列表 =====
  function showBookmarks() {
    chrome.runtime.sendMessage({ action: 'getBookmarks' }, (res) => {
      if (res && res.code === 200 && res.data && res.data.length > 0) {
        const list = res.data.map((b, i) =>
          `${i + 1}. <strong>${escapeHtml(b.keyword)}</strong> — ${escapeHtml(b.url)}`
        ).join('<br>')
        showToast(`📋 共 ${res.data.length} 个书签：<br><br>${list}`)
      } else {
        showToast('📋 暂无书签')
      }
    })
  }

  // ===== 搜索功能 =====
  function openSearch() {
    isSearchOpen = true
    searchPanel.classList.add('active')
    wrap.classList.add('search-active')
    setTimeout(() => searchInput.focus(), 100)
  }

  function closeSearch() {
    isSearchOpen = false
    searchPanel.classList.remove('active')
    wrap.classList.remove('search-active')
    searchInput.value = ''
    searchResults.innerHTML = '<div class="cpf-search-empty">输入关键词开始搜索...</div>'
  }

  searchClose.addEventListener('click', closeSearch)

  // 搜索防抖
  let searchTimer = null
  searchInput.addEventListener('input', function () {
    clearTimeout(searchTimer)
    const q = this.value.trim()
    if (!q) {
      searchResults.innerHTML = '<div class="cpf-search-empty">输入关键词开始搜索...</div>'
      return
    }
    searchTimer = setTimeout(() => doSearch(q), 300)
  })

  searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeSearch()
    if (e.key === 'Enter' && this.value.trim()) {
      clearTimeout(searchTimer)
      doSearch(this.value.trim())
    }
  })

  function doSearch(keyword) {
    searchResults.innerHTML = '<div class="cpf-search-loading">搜索中...</div>'

    // 搜索书签
    fetch(BACKEND + '/api/bookmarks/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword })
    })
      .then(r => r.json())
      .then(bookmarkRes => {
        let html = ''

        // 显示书签结果
        if (bookmarkRes.code === 200 && bookmarkRes.data && bookmarkRes.data.length > 0) {
          html += `<div class="cpf-search-section-label">书签 (${bookmarkRes.data.length})</div>`
          bookmarkRes.data.slice(0, 8).forEach(b => {
            html += `<div class="cpf-search-result-item" data-url="${escapeHtml(b.url)}" data-keyword="${escapeHtml(b.keyword)}">
              <div class="cpf-sri-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div class="cpf-sri-body">
                <span class="cpf-sri-title">${escapeHtml(b.keyword)}</span>
                <span class="cpf-sri-url">${escapeHtml(truncate(b.url, 50))}</span>
              </div>
            </div>`
          })
        }

        // 搜索应用
        return fetch(BACKEND + '/api/apps/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword })
        })
          .then(r => r.json())
          .then(appRes => {
            if (appRes.code === 200 && appRes.data && appRes.data.length > 0) {
              html += `<div class="cpf-search-section-label">应用 (${appRes.data.length})</div>`
              appRes.data.slice(0, 6).forEach(a => {
                html += `<div class="cpf-search-result-item" data-app-path="${escapeHtml(a.path)}" data-keyword="${escapeHtml(a.name)}">
                  <div class="cpf-sri-icon app">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <line x1="3" y1="9" x2="21" y2="9"/>
                      <line x1="9" y1="21" x2="9" y2="9"/>
                    </svg>
                  </div>
                  <div class="cpf-sri-body">
                    <span class="cpf-sri-title">${escapeHtml(a.name)}</span>
                  </div>
                </div>`
              })
            }

            if (!html) {
              html = '<div class="cpf-search-empty">未找到匹配结果</div>'
            }

            searchResults.innerHTML = html

            // 绑定结果点击事件
            searchResults.querySelectorAll('.cpf-search-result-item').forEach(el => {
              el.addEventListener('click', function () {
                const url = this.dataset.url
                const appPath = this.dataset.appPath
                const keyword = this.dataset.keyword
                if (url) {
                  openUrl(url)
                } else if (appPath) {
                  chrome.runtime.sendMessage({ action: 'openLocalFile', path: appPath })
                }
                showToast(`🚀 正在打开 ${keyword}...`)
                closeSearch()
              })
            })
          })
      })
      .catch(err => {
        searchResults.innerHTML = `<div class="cpf-search-empty">搜索失败: ${err.message}</div>`
      })
  }

  // ===== 打开 URL =====
  function openUrl(url) {
    chrome.runtime.sendMessage({ action: 'openInChrome', url })
  }

  // ===== 服务状态检测（只在菜单打开时调用）=====
  function checkStatus() {
    fetch(BACKEND + '/api/bookmarks', { signal: AbortSignal.timeout(3000) })
      .then(r => {
        if (r.ok) {
          statusDot.className = 'cpf-status-dot online'
          statusText.textContent = '服务在线'
        } else {
          statusDot.className = 'cpf-status-dot error'
          statusText.textContent = '服务异常'
        }
      })
      .catch(() => {
        statusDot.className = 'cpf-status-dot offline'
        statusText.textContent = '后端未启动'
      })
  }

  function loadBookmarkCount() {
    fetch(BACKEND + '/api/bookmarks', { signal: AbortSignal.timeout(3000) })
      .then(r => r.json())
      .then(data => {
        if (data.code === 200 && data.data) {
          badge.textContent = data.data.length
          badge.style.display = 'inline'
        }
      })
      .catch(() => {})
  }

  // ===== Toast 提示 =====
  function showToast(msg) {
    const existing = shadow.getElementById('cpfToast')
    if (existing) existing.remove()

    const toast = document.createElement('div')
    toast.id = 'cpfToast'
    toast.className = 'cpf-toast'
    toast.innerHTML = msg
    shadow.appendChild(toast)

    setTimeout(() => {
      toast.classList.add('show')
    }, 10)

    setTimeout(() => {
      toast.classList.remove('show')
      setTimeout(() => toast.remove(), 300)
    }, 3000)
  }

  // ===== 工具函数 =====
  function escapeHtml(str) {
    const div = document.createElement('div')
    div.textContent = str
    return div.innerHTML
  }

  function truncate(str, len) {
    return str.length > len ? str.slice(0, len) + '...' : str
  }

  // ===== 初始化（仅添加点击菜单的监听，不主动轮询）=====
  console.log('[ChatPortal] 悬浮球已加载')
})()
