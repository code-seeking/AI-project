<template>
  <!-- 登录页 -->
  <LoginView v-if="showLogin" @login="handleLogin" @guest="handleGuestLogin" />

  <div v-else class="app-root">
    <!-- 背景装饰 -->
    <div class="bg-decoration">
      <div class="bg-orb bg-orb-1"></div>
      <div class="bg-orb bg-orb-2"></div>
      <div class="bg-orb bg-orb-3"></div>
    </div>

    <!-- ===== 顶部导航 ===== -->
    <header class="topbar">
      <div class="topbar-inner">
        <div class="topbar-left">
          <div class="app-logo">
            <div class="logo-icon-wrap">
              <el-icon :size="20"><Connection /></el-icon>
            </div>
            <div class="logo-text-group">
              <span class="logo-title">Chat Portal</span>
              <span class="logo-sub">网址 · 文件快捷入口</span>
            </div>
          </div>
        </div>
        <div class="topbar-center">
          <div class="stats-chip">
            <el-icon :size="13"><Link /></el-icon>
            <span>{{ bookmarks.length }} 个书签</span>
          </div>
        </div>
        <div class="topbar-right">
          <el-tooltip content="通知中心" placement="bottom">
            <el-button text size="small" class="topbar-btn notify-bell" @click="showNotifyPanel = !showNotifyPanel">
              <el-icon><Bell /></el-icon>
              <span v-if="unreadCount > 0" class="notify-badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
            </el-button>
          </el-tooltip>
          <el-tooltip content="帮助" placement="bottom">
            <el-button text size="small" class="topbar-btn" @click="showHelp">
              <el-icon><QuestionFilled /></el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip content="用户" placement="bottom">
            <el-button text size="small" class="topbar-btn" @click="showLogin = true">
              <span v-if="isLoggedIn" style="font-size:12px;color:#4fc3f7">{{ authUser?.username }}</span>
              <el-icon v-else><UserFilled /></el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip v-if="isLoggedIn" content="退出" placement="bottom">
            <el-button text size="small" class="topbar-btn" @click="handleLogout">
              <el-icon><SwitchButton /></el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip content="清空对话" placement="bottom">
            <el-button text size="small" class="topbar-btn" @click="clearMessages">
              <el-icon><Delete /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
      </div>
    </header>

    <!-- ===== 通知面板 ===== -->
    <div v-if="showNotifyPanel" class="notify-panel">
      <div class="notify-panel-header">
        <span>🔔 通知中心</span>
        <div>
          <el-button text size="small" @click="handleMarkAllRead">全部已读</el-button>
          <el-button text size="small" type="danger" @click="handleClearNotifications">清空</el-button>
        </div>
      </div>
      <div class="notify-panel-body">
        <div v-if="notifyList.length === 0" class="adv-empty">暂无通知</div>
        <div v-for="n in notifyList" :key="n.id" class="notify-item" :class="{ unread: !n.read }" @click="handleReadNotify(n)">
          <span class="notify-type-icon">{{ n.type === 'workflow' ? '🔄' : n.type === 'dingtalk' ? '💬' : '📢' }}</span>
          <div class="notify-item-body">
            <div class="notify-item-msg">{{ n.message }}</div>
            <div class="notify-item-time">{{ new Date(n.createdAt).toLocaleString() }}</div>
          </div>
          <el-button text size="small" type="danger" @click.stop="handleDeleteNotify(n.id)">
            <el-icon><Close /></el-icon>
          </el-button>
        </div>
      </div>
    </div>

    <!-- ===== 主内容 ===== -->
    <main class="main-area" ref="mainRef">
      <div class="content-column">

        <!-- ===== 输入区域 ===== -->
        <section class="input-section">
          <div class="glass-card input-card">
            <div class="input-label">
              <span class="label-dot"></span>
              <span>添加网址书签或打开本地文件</span>
            </div>
            <div class="input-row">
              <div class="input-wrap">
                <el-icon class="input-prefix"><Search /></el-icon>
                <input
                  ref="inputRef"
                  v-model="inputText"
                  class="input-field"
                  :placeholder="bookmarks.length > 0 ? '输入描述+网址 或 输入关键词打开，也支持本地文件路径...' : '例：百度 https://www.baidu.com  或  C:\\文档\\report.pdf'"
                  :disabled="loading"
                  @keydown.enter.prevent="handleSend"
                />
                <el-button
                  v-if="inputText"
                  text
                  size="small"
                  class="input-clear"
                  @click="inputText = ''"
                >
                  <el-icon><Close /></el-icon>
                </el-button>
              </div>
              <el-button
                type="primary"
                :disabled="!inputText.trim() || loading"
                :loading="loading"
                class="send-btn"
                @click="handleSend"
              >
                <el-icon><Promotion /></el-icon>
                <span>发送</span>
              </el-button>
            </div>
            <div class="input-chips">
              <span class="chip-label">快捷：</span>
              <span class="chip" @click="quickInput('/list')">📋 书签列表</span>
              <span class="chip" @click="quickInput('帮助')">❓ 帮助</span>
              <span class="chip" @click="quickInput('D:\\文档')">📂 本地文件夹</span>
              <span v-if="bookmarks.length > 0" class="chip" @click="quickInput('/clear')">🗑️ 清空</span>
              <span class="chip chip-mm" @click="triggerImageUpload">🖼️ 图片分析</span>
              <span class="chip chip-mm" @click="toggleVoiceInput">🎤 {{ voiceListening ? '停止录音' : '语音输入' }}</span>
            </div>
            <!-- 图片预览 -->
            <div v-if="attachedImage" class="attached-image-preview">
              <img :src="'data:image/png;base64,' + attachedImage" alt="attached" />
              <el-button size="small" text type="danger" @click="attachedImage = ''">✖ 移除</el-button>
            </div>
            <input ref="imageInputRef" type="file" accept="image/*" style="display:none" @change="handleImageSelect" />
          </div>
        </section>

        <!-- ===== 书签卡片区域 ===== -->
        <section v-if="bookmarks.length > 0" class="bookmarks-section">
          <div class="section-bar">
            <h3 class="section-title">
              <el-icon :size="18"><Link /></el-icon>
              <span>已添加的快捷入口</span>
              <span class="section-count">{{ filteredBookmarks.length }}</span>
            </h3>
            <div class="section-tools">
              <div class="search-box">
                <el-icon :size="14"><Search /></el-icon>
                <input
                  v-model="searchKeyword"
                  class="search-input"
                  placeholder="搜索..."
                />
                <el-button v-if="searchKeyword" text size="small" class="search-clear" @click="searchKeyword = ''">
                  <el-icon><Close /></el-icon>
                </el-button>
              </div>

              <!-- 分组筛选 -->
              <el-dropdown v-if="groups.length > 0" trigger="click" @command="selectGroup">
                <el-button text size="small" class="tool-btn">
                  <el-icon><FolderOpened /></el-icon>
                  <span>{{ selectedGroupId ? groups.find(g => g.id === selectedGroupId)?.name || '分组' : '分组' }}</span>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item :command="undefined">📁 全部</el-dropdown-item>
                    <el-dropdown-item v-for="g in groups" :key="g.id" :command="g.id">
                      📂 {{ g.name }} ({{ g.bookmark_count || 0 }})
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>

              <!-- 新建分组 -->
              <el-tooltip content="新建分组" placement="top">
                <el-button text size="small" class="tool-btn" @click="showGroupDialog = true">
                  <el-icon><FolderAdd /></el-icon>
                </el-button>
              </el-tooltip>

              <el-tooltip content="导出 JSON" placement="top">
                <el-button text size="small" class="tool-btn" @click="handleExportJSON">
                  <el-icon><Download /></el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip content="导出 CSV" placement="top">
                <el-button text size="small" class="tool-btn" @click="handleExportCSV">
                  <el-icon><Download /></el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip content="导入书签" placement="top">
                <el-button text size="small" class="tool-btn" @click="showImportDialog = true">
                  <el-icon><Upload /></el-icon>
                </el-button>
              </el-tooltip>

              <el-tooltip content="AI 智能分类" placement="top">
                <el-button text size="small" class="tool-btn ai-classify" :loading="classifying" @click="handleClassifyBookmarks">
                  <el-icon><MagicStick /></el-icon>
                </el-button>
              </el-tooltip>

              <el-tooltip content="📚 知识库" placement="top">
                <el-button text size="small" class="tool-btn" @click="showKnowledgeDialog = true">
                  <el-icon><Notebook /></el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip content="📋 工作日志" placement="top">
                <el-button text size="small" class="tool-btn" @click="showWorkLogDialog = true">
                  <el-icon><Timer /></el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip content="🚀 高阶能力" placement="top">
                <el-button text size="small" class="tool-btn" @click="showAdvancedDialog = true">
                  <el-icon><MagicStick /></el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip content="清空全部书签" placement="top">
                <el-button text size="small" class="tool-btn danger" @click="handleClearAll">
                  <el-icon><Delete /></el-icon>
                </el-button>
              </el-tooltip>
            </div>
          </div>

          <!-- 标签筛选 -->
          <div v-if="tags.length > 0" class="tag-filter-bar">
            <span
              class="tag-filter-chip"
              :class="{ active: !selectedTag }"
              @click="selectTag(undefined)"
            >全部</span>
            <span
              v-for="t in tags"
              :key="t.tag"
              class="tag-filter-chip"
              :class="{ active: selectedTag === t.tag }"
              @click="selectTag(t.tag)"
            >{{ t.tag }} ({{ t.count }})</span>
          </div>

          <div class="card-grid-scroll">
          <div class="card-grid">
            <div
              v-for="bm in filteredBookmarks"
              :key="bm.id || bm.keyword"
              class="bm-card"
              :style="{ '--card-accent': getCardColor(bm.url) }"
              @click="openBookmark(bm)"
            >
              <div class="bm-card-bg"></div>
              <div class="bm-card-icon">
                <span class="bm-emoji">{{ getUrlEmoji(bm.url) }}</span>
              </div>
              <div class="bm-card-body">
                <span class="bm-card-title">{{ bm.keyword }}</span>
                <span class="bm-card-url">{{ displayUrl(bm.url) }}</span>
                <!-- 标签 -->
                <div v-if="bm.tags && bm.tags.length > 0" class="bm-card-tags">
                  <span v-for="t in bm.tags.slice(0, 3)" :key="t" class="bm-tag">{{ t }}</span>
                  <span v-if="bm.tags.length > 3" class="bm-tag-more">+{{ bm.tags.length - 3 }}</span>
                </div>
              </div>
              <div class="bm-card-actions">
                <el-tooltip content="复制链接地址" placement="top">
                  <el-button circle size="small" class="card-action-btn copy" @click.stop="copyUrl(bm.url)">
                    <el-icon><DocumentCopy /></el-icon>
                  </el-button>
                </el-tooltip>
                <el-tooltip :content="isLocalPath(bm.url) ? '打开文件' : '在 Chrome 中打开'" placement="top">
                  <el-button circle size="small" class="card-action-btn open" @click.stop="openBookmark(bm)">
                    <el-icon><TopRight /></el-icon>
                  </el-button>
                </el-tooltip>
                <el-tooltip content="删除" placement="top">
                  <el-button circle size="small" class="card-action-btn del" @click.stop="handleDelete(bm.keyword)">
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </el-tooltip>
              </div>
            </div>
          </div>
          </div>

          <!-- 分页 -->
          <div v-if="total > pageSize" class="pagination-bar">
            <el-pagination
              v-model:current-page="currentPage"
              :page-size="pageSize"
              :total="total"
              layout="prev, pager, next, total"
              small
              background
              @current-change="setPage"
            />
          </div>

          <div v-if="filteredBookmarks.length === 0 && searchKeyword" class="no-results">
            没有找到匹配「{{ searchKeyword }}」的书签
          </div>

          <!-- AI 分类结果展示 -->
          <section v-if="classifyResult && classifyResult.categories && classifyResult.categories.length > 0" class="classify-result">
            <div class="classify-header">
              <el-icon :size="16"><MagicStick /></el-icon>
              <span>AI 智能分类结果</span>
              <el-button text size="small" class="classify-close" @click="classifyResult = null">
                <el-icon><Close /></el-icon>
              </el-button>
            </div>
            <div class="classify-groups">
              <div v-for="cat in classifyResult.categories" :key="cat.name" class="classify-group">
                <div class="classify-group-header">
                  <span class="classify-group-name">{{ cat.name }}</span>
                  <span class="classify-group-count">{{ cat.items.length }} 项</span>
                </div>
                <div class="classify-items">
                  <div v-for="item in cat.items" :key="item.keyword" class="classify-item">
                    <span class="classify-item-keyword">{{ item.keyword }}</span>
                    <span class="classify-item-summary">{{ item.summary }}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </section>

        <!-- ===== 欢迎区域 ===== -->
        <section v-if="messages.length === 0" class="welcome-section">
          <div class="glass-card welcome-card">
            <div class="welcome-graphic">
              <div class="welcome-ring"></div>
              <el-icon :size="52" class="welcome-icon-el"><ChatDotRound /></el-icon>
            </div>
            <h2 class="welcome-title">欢迎使用 Chat Portal</h2>
            <p class="welcome-desc">一站式管理网页书签和本地文件，输入文字即可快速打开</p>
            <div class="welcome-grid">
              <div class="welcome-item" @click="quickInput('百度 https://www.baidu.com')">
                <div class="wi-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                </div>
                <div>
                  <div class="wi-title">添加书签</div>
                  <div class="wi-desc">描述 + 网址</div>
                </div>
              </div>
              <div class="welcome-item" @click="quickInput('D:\\文档\\report.pdf')">
                <div class="wi-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                </div>
                <div>
                  <div class="wi-title">打开文件</div>
                  <div class="wi-desc">本地路径直达</div>
                </div>
              </div>
              <div class="welcome-item" @click="quickInput('/list')">
                <div class="wi-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                </div>
                <div>
                  <div class="wi-title">查看书签</div>
                  <div class="wi-desc">/list 全部一览</div>
                </div>
              </div>
              <div class="welcome-item" @click="quickInput('帮助')">
                <div class="wi-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                </div>
                <div>
                  <div class="wi-title">帮助</div>
                  <div class="wi-desc">查看所有指令</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ===== 对话消息 ===== -->
        <section v-if="messages.length > 0" class="messages-section">
          <div class="glass-card messages-card">
            <div class="messages-scroll" ref="messagesRef">
              <div
                v-for="(msg, idx) in messages"
                :key="idx"
                class="msg-row"
                :class="msg.role"
              >
                <div class="msg-avatar" :class="msg.role">
                  <el-icon v-if="msg.role === 'assistant'"><ChatDotRound /></el-icon>
                  <el-icon v-else><User /></el-icon>
                </div>
                <div class="msg-bubble" :class="msg.role">
                  <div v-if="msg.type === 'list'" class="inline-cards">
                    <div class="inline-cards-header">📋 全部快捷入口（{{ bookmarks.length }}）</div>
                    <div v-if="bookmarks.length === 0" class="inline-cards-empty">暂无书签</div>
                    <div
                      v-for="bm in bookmarks"
                      :key="bm.keyword"
                      class="inline-card-item"
                      :style="{ '--card-accent': getCardColor(bm.url) }"
                      @click="openBookmark(bm)"
                    >
                      <div class="ici-icon">{{ getUrlEmoji(bm.url) }}</div>
                      <div class="ici-body">
                        <span class="ici-title">{{ bm.keyword }}</span>
                        <span class="ici-url">{{ displayUrl(bm.url) }}</span>
                      </div>
                      <el-icon class="ici-open"><TopRight /></el-icon>
                    </div>
                  </div>
                  <div v-else class="msg-text" v-html="renderContent(msg.content)"></div>
                  <div class="msg-time">{{ formatTime(msg.timestamp) }}</div>
                </div>
              </div>

              <div v-if="loading" class="msg-row assistant">
                <div class="msg-avatar assistant"><el-icon><ChatDotRound /></el-icon></div>
                <div class="msg-bubble assistant">
                  <div class="typing-dots"><span></span><span></span><span></span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>
    </main>

    <!-- ===== 底部 ===== -->
    <!-- 新建分组对话框 -->
    <el-dialog v-model="showGroupDialog" title="📁 新建分组" width="320px" append-to-body>
      <el-input v-model="newGroupName" placeholder="请输入分组名称" @keyup.enter="handleCreateGroup" />
      <template #footer>
        <el-button @click="showGroupDialog = false">取消</el-button>
        <el-button type="primary" @click="handleCreateGroup">创建</el-button>
      </template>
    </el-dialog>

    <!-- 导入对话框 -->
    <el-dialog v-model="showImportDialog" title="📥 导入书签" width="500px" append-to-body>
      <div style="margin-bottom: 10px;">
        <el-radio-group v-model="importFormat">
          <el-radio value="json">JSON</el-radio>
          <el-radio value="csv">CSV</el-radio>
        </el-radio-group>
      </div>
      <el-input
        v-model="importText"
        type="textarea"
        :rows="8"
        :placeholder="importPlaceholder"
      />
      <template #footer>
        <el-button @click="showImportDialog = false">取消</el-button>
        <el-button type="primary" @click="handleImport">导入</el-button>
      </template>
    </el-dialog>

    <!-- ===== RAG 知识库对话框 ===== -->
    <el-dialog v-model="showKnowledgeDialog" title="📚 知识库" width="600px" append-to-body>
      <div class="knowledge-tabs">
        <!-- Tab 1: 上传文档 -->
        <div class="knowledge-section">
          <h4 class="section-title">📤 上传文档</h4>
          <el-input v-model="knowledgeTitle" placeholder="文档标题" style="margin-bottom: 8px;" />
          <el-input
            v-model="knowledgeContent"
            type="textarea"
            :rows="6"
            placeholder="粘贴文档内容..."
            style="margin-bottom: 8px;"
          />
          <el-button type="primary" @click="handleUploadKnowledge" :loading="knowledgeUploading">
            上传到知识库
          </el-button>
        </div>

        <el-divider />

        <!-- Tab 2: 文档列表 -->
        <div class="knowledge-section">
          <h4 class="section-title" style="display: flex; justify-content: space-between; align-items: center;">
            <span>📄 已上传文档 ({{ knowledgeDocs.length }})</span>
            <el-button text size="small" @click="handleRefreshKnowledgeDocs">刷新</el-button>
          </h4>
          <div v-if="knowledgeDocs.length === 0" class="knowledge-empty">暂无文档，请上传</div>
          <div v-for="doc in knowledgeDocs" :key="doc.id" class="knowledge-doc-item">
            <div class="knowledge-doc-info">
              <span class="knowledge-doc-title">{{ doc.title }}</span>
              <span class="knowledge-doc-meta">{{ doc.chunkCount }} 块 · {{ (doc.contentLength / 1024).toFixed(1) }} KB</span>
            </div>
            <el-button text size="small" type="danger" @click="handleDeleteKnowledgeDoc(doc.id)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>

        <el-divider />

        <!-- Tab 3: RAG 问答 -->
        <div class="knowledge-section">
          <h4 class="section-title">🔍 知识库问答</h4>
          <div class="knowledge-query-input">
            <el-input
              v-model="knowledgeQuery"
              placeholder="输入你的问题..."
              @keyup.enter="handleKnowledgeQuery"
            >
              <template #append>
                <el-button @click="handleKnowledgeQuery" :loading="knowledgeQuerying">
                  <el-icon><Search /></el-icon> 查询
                </el-button>
              </template>
            </el-input>
          </div>

          <div v-if="knowledgeQueryResult" class="knowledge-query-result">
            <div v-if="knowledgeQueryResult.answer" class="knowledge-answer">
              <h5>🤖 AI 回答</h5>
              <p style="white-space: pre-wrap;">{{ knowledgeQueryResult.answer }}</p>
            </div>
            <div v-if="knowledgeQueryResult.chunks && knowledgeQueryResult.chunks.length > 0" class="knowledge-chunks">
              <h5>📖 参考文本 ({{ knowledgeQueryResult.chunks.length }} 条)</h5>
              <div v-for="(chunk, i) in knowledgeQueryResult.chunks" :key="chunk.id" class="knowledge-chunk-item">
                <div class="chunk-index">#{{ i + 1 }}</div>
                <div class="chunk-text">{{ chunk.text?.slice(0, 300) }}{{ (chunk.text?.length || 0) > 300 ? '...' : '' }}</div>
                <div v-if="chunk.score" class="chunk-score">匹配度: {{ (chunk.score * 100).toFixed(0) }}%</div>
              </div>
            </div>
            <div v-else-if="knowledgeQueryResult.totalChunks > 0 && !knowledgeQueryResult.answer" class="knowledge-empty">
              未找到相关知识
            </div>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- ===== 工作日志对话框 ===== -->
    <el-dialog v-model="showWorkLogDialog" title="📋 工作日志" width="680px" append-to-body top="5vh" @opened="handleWorkLogOpen">
      <div class="worklog-tabs">
        <!-- Tab 1: 快速记录 -->
        <div class="worklog-section">
          <h4 class="section-title">✏️ 快速记录</h4>
          <div class="worklog-form">
            <div class="wl-form-row">
              <el-input v-model="wlTitle" placeholder="做了什么事（必填）" style="flex:1" />
              <el-select v-model="wlCategory" placeholder="分类" style="width:130px;margin-left:8px">
                <el-option v-for="c in WORKLOG_CATEGORIES" :key="c" :label="c" :value="c" />
              </el-select>
            </div>
            <div class="wl-form-row">
              <el-time-picker
                v-model="wlStartTime"
                placeholder="开始"
                format="HH:mm"
                value-format="HH:mm"
                style="width:130px"
              />
              <span style="margin:0 8px;color:#64748b">→</span>
              <el-time-picker
                v-model="wlEndTime"
                placeholder="结束"
                format="HH:mm"
                value-format="HH:mm"
                style="width:130px"
              />
              <el-tag v-if="wlDuration" type="info" effect="plain" style="margin-left:8px">
                {{ wlDuration }} 分钟
              </el-tag>
            </div>
            <div class="wl-form-row">
              <el-input
                v-model="wlDescription"
                placeholder="备注（可选）"
                :rows="2"
                type="textarea"
                style="flex:1"
              />
            </div>
            <div class="wl-form-actions">
              <el-button type="primary" @click="handleAddWorkLog" :loading="wlAdding">
                <el-icon><Plus /></el-icon> 记录
              </el-button>
              <span v-if="wlAddResult" class="wl-add-result">✅ {{ wlAddResult }}</span>
            </div>
          </div>
        </div>

        <el-divider />

        <!-- Tab 2: 今日日志 -->
        <div class="worklog-section">
          <h4 class="section-title" style="display:flex;justify-content:space-between;align-items:center">
            <span>📋 今日事项 ({{ wlTodayLogs.length }})</span>
            <div>
              <el-button text size="small" @click="handleRefreshWorkLogs">刷新</el-button>
            </div>
          </h4>
          <div v-if="wlTodayLogs.length === 0" class="worklog-empty">今天还没有记录 📝</div>
          <div v-for="log in wlTodayLogs" :key="log.id" class="worklog-item">
            <div class="wl-item-header">
              <span class="wl-item-time">
                <template v-if="log.startTime">{{ log.startTime }}<template v-if="log.endTime">-{{ log.endTime }}</template></template>
                <template v-else>--:--</template>
              </span>
              <el-tag size="small" :type="getCategoryTagType(log.category)">{{ log.category }}</el-tag>
            </div>
            <div class="wl-item-title">{{ log.title }}</div>
            <div v-if="log.description" class="wl-item-desc">{{ log.description }}</div>
            <div class="wl-item-footer">
              <span v-if="log.duration" class="wl-item-duration">{{ log.duration }} 分钟</span>
              <el-button text size="small" type="danger" @click="handleDeleteWorkLog(log.id)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>
        </div>

        <el-divider />

        <!-- Tab 3: 饱和度统计 -->
        <div class="worklog-section">
          <h4 class="section-title" style="display:flex;justify-content:space-between;align-items:center">
            <span>📊 工作饱和度</span>
            <el-radio-group v-model="wlStatsMode" size="small" @change="handleLoadStats">
              <el-radio-button value="day">按天</el-radio-button>
              <el-radio-button value="week">按周</el-radio-button>
              <el-radio-button value="month">按月</el-radio-button>
            </el-radio-group>
          </h4>

          <div v-if="wlStatsLoading" class="worklog-empty">加载中...</div>
          <div v-else-if="!wlStats" class="worklog-empty">暂无统计数据，先去记录一些工作吧</div>
          <div v-else>
            <!-- 汇总卡片 -->
            <div class="wl-stats-summary">
              <div class="wl-stat-card">
                <div class="wl-stat-value">{{ wlStats.summary.totalItems }}</div>
                <div class="wl-stat-label">总事项</div>
              </div>
              <div class="wl-stat-card">
                <div class="wl-stat-value">{{ wlStats.summary.totalHours }}</div>
                <div class="wl-stat-label">总工时(h)</div>
              </div>
              <div class="wl-stat-card">
                <div class="wl-stat-value">{{ wlStats.summary.avgDailyMinutes }}</div>
                <div class="wl-stat-label">日均(分钟)</div>
              </div>
            </div>

            <!-- 分类分布 -->
            <div class="wl-stats-categories">
              <h5 style="margin:12px 0 8px;color:#94a3b8;font-size:13px">分类分布</h5>
              <div v-for="(count, cat) in wlStats.summary.categoryDistribution" :key="cat" class="wl-cat-bar-row">
                <span class="wl-cat-label">{{ cat }}</span>
                <div class="wl-cat-bar-bg">
                  <div
                    class="wl-cat-bar-fill"
                    :style="{ width: (count / Math.max(...Object.values(wlStats.summary.categoryDistribution)) * 100) + '%' }"
                  ></div>
                </div>
                <span class="wl-cat-count">{{ count }} 项</span>
              </div>
            </div>

            <!-- 每日/周/月详情 -->
            <div class="wl-stats-detail">
              <h5 style="margin:16px 0 8px;color:#94a3b8;font-size:13px">明细</h5>
              <div v-for="s in wlStats.stats.slice(0, 14)" :key="s.date" class="wl-stat-row">
                <span class="wl-stat-date">{{ s.date }}</span>
                <span class="wl-stat-count">{{ s.count }} 项</span>
                <span class="wl-stat-hours">{{ s.hours }} 小时</span>
                <div class="wl-stat-bar-bg">
                  <div
                    class="wl-stat-bar-fill"
                    :style="{ width: Math.min(100, (s.totalMinutes / 480) * 100) + '%' }"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- ===== 高阶能力对话框 ===== -->
    <el-dialog v-model="showAdvancedDialog" title="🚀 高阶能力" width="720px" append-to-body top="5vh" @opened="handleAdvancedOpen">
      <div class="advanced-content">
        <el-tabs v-model="advancedTab" class="advanced-tabs">
          <!-- Tab: 仪表盘 -->
          <el-tab-pane label="📊 仪表盘" name="dashboard">
            <div class="dash-grid">
              <div class="dash-card">
                <div class="dash-card-value">{{ dashStats?.today?.totalEvents || 0 }}</div>
                <div class="dash-card-label">今日活动</div>
              </div>
              <div class="dash-card">
                <div class="dash-card-value">{{ dashStats?.today?.aiUsage || 0 }}</div>
                <div class="dash-card-label">AI 交互</div>
              </div>
              <div class="dash-card">
                <div class="dash-card-value">{{ dashStats?.streak || 0 }}天</div>
                <div class="dash-card-label">连续活跃</div>
              </div>
              <div class="dash-card">
                <div class="dash-card-value">{{ dashStats?.peakHour || 0 }}:00</div>
                <div class="dash-card-label">Peak 时段</div>
              </div>
            </div>
            <div class="adv-section">
              <h4 class="adv-section-title">📈 本周活动分布</h4>
              <div class="dash-bar-chart">
                <div v-for="(v, i) in (dashStats?.week?.weekdayActivity || [])" :key="i" class="dash-bar-col">
                  <div class="dash-bar" :style="{ height: Math.max(4, v * 8) + 'px' }"></div>
                  <span class="dash-bar-label">{{ ['日','一','二','三','四','五','六'][i] }}</span>
                </div>
              </div>
            </div>
            <div class="adv-section">
              <h4 class="adv-section-title">🛠️ 工具 Top5</h4>
              <div v-if="(dashStats?.week?.topTools || []).length === 0" class="adv-empty">暂无数据</div>
              <div v-for="t in (dashStats?.week?.topTools || [])" :key="t.name" class="dash-tool-row">
                <span class="dash-tool-name">{{ t.name }}</span>
                <div class="dash-tool-bar-wrap"><div class="dash-tool-bar" :style="{ width: (t.count / (dashStats?.week?.topTools?.[0]?.count || 1) * 100) + '%' }"></div></div>
                <span class="dash-tool-count">{{ t.count }}</span>
              </div>
            </div>
            <div class="adv-section">
              <div class="section-bar">
                <h4 class="adv-section-title">🤖 AI 周报</h4>
                <el-button size="small" :loading="reportLoading" @click="handleGenReport">生成周报</el-button>
              </div>
              <div v-if="weeklyReport" class="dash-report">
                <div class="dash-report-insight">{{ weeklyReport.aiInsight }}</div>
                <div class="dash-report-recs">
                  <div v-for="(r, i) in weeklyReport.recommendations" :key="i" class="dash-rec-item">{{ r }}</div>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <!-- Tab: 桌面操控 -->
          <el-tab-pane label="🖥️ 桌面操控" name="desktop">
            <div class="adv-section">
              <h4 class="adv-section-title">🖥️ 桌面自动化控制</h4>
              <p style="color:#94a3b8;font-size:12px;margin:0 0 10px">控制鼠标、键盘，截屏分析 UI 元素</p>
              <div class="desktop-toolbar">
                <el-button size="small" type="primary" @click="handleDesktopScreenshot" :loading="desktopLoading">📸 截屏</el-button>
                <el-button size="small" @click="handleDesktopAnalyze" :loading="desktopAnalyzing" :disabled="!desktopScreenshotData">🔍 分析 UI</el-button>
                <el-button size="small" @click="handleDesktopRefresh">🔄 刷新状态</el-button>
              </div>
              <!-- 截屏预览 -->
              <div v-if="desktopScreenshotData" class="desktop-preview">
                <img :src="'data:image/png;base64,' + desktopScreenshotData" alt="screenshot" class="desktop-img" />
                <!-- 标注层 -->
                <div v-for="(el, i) in desktopElements" :key="i" class="desktop-bbox" :style="{ left: el.bbox.x + 'px', top: el.bbox.y + 'px', width: el.bbox.w + 'px', height: el.bbox.h + 'px' }" :title="el.label">
                  <span class="desktop-bbox-label">{{ el.label }} ({{ (el.confidence * 100).toFixed(0) }}%)</span>
                </div>
              </div>
              <!-- 操作面板 -->
              <div class="desktop-actions">
                <h4 class="adv-section-title" style="margin-top:12px">🎮 操作面板</h4>
                <div class="desktop-action-row">
                  <el-input v-model="desktopClickX" placeholder="X" size="small" style="width:70px" />
                  <el-input v-model="desktopClickY" placeholder="Y" size="small" style="width:70px" />
                  <el-button size="small" @click="handleDesktopCommand('click')">点击</el-button>
                  <el-button size="small" @click="handleDesktopCommand('doubleClick')">双击</el-button>
                </div>
                <div class="desktop-action-row">
                  <el-input v-model="desktopTypeText" placeholder="输入文字..." size="small" style="flex:1" @keydown.enter="handleDesktopCommand('type')" />
                  <el-button size="small" @click="handleDesktopCommand('type')">输入</el-button>
                </div>
                <div class="desktop-action-row">
                  <el-select v-model="desktopHotkey" placeholder="选择快捷键" size="small" style="width:160px">
                    <el-option label="Ctrl+S (保存)" value="ctrl+s" />
                    <el-option label="Ctrl+C (复制)" value="ctrl+c" />
                    <el-option label="Ctrl+V (粘贴)" value="ctrl+v" />
                    <el-option label="Alt+Tab (切换)" value="alt+tab" />
                    <el-option label="Win+D (桌面)" value="win+d" />
                    <el-option label="Win+E (资源管理器)" value="win+e" />
                    <el-option label="Enter" value="enter" />
                    <el-option label="Esc" value="esc" />
                  </el-select>
                  <el-button size="small" @click="handleDesktopCommand('hotkey')">执行快捷键</el-button>
                </div>
              </div>
              <!-- 审批弹窗 -->
              <div v-if="desktopConfirm" class="desktop-confirm-overlay">
                <div class="desktop-confirm-dialog">
                  <h4 style="margin:0 0 10px;color:#f59e0b">⚠️ 危险操作确认</h4>
                  <p style="font-size:13px;color:#e2e8f0">{{ desktopConfirmReason }}</p>
                  <p style="font-size:12px;color:#94a3b8">操作前已截屏备份，请确认是否继续执行</p>
                  <div style="display:flex;gap:10px;margin-top:12px">
                    <el-button size="small" type="danger" @click="handleDesktopConfirm(true)">确认执行</el-button>
                    <el-button size="small" @click="handleDesktopConfirm(false)">取消</el-button>
                  </div>
                </div>
              </div>
              <!-- 操作历史 -->
              <div class="desktop-history" v-if="desktopHistoryList.length > 0">
                <h4 class="adv-section-title" style="margin-top:12px">📜 操作历史</h4>
                <div v-for="(h, i) in desktopHistoryList" :key="i" class="desktop-history-item">
                  <span style="font-size:11px;color:#64748b;min-width:70px">{{ h.timestamp ? h.timestamp.slice(11,19) : '' }}</span>
                  <span style="font-size:12px;color:#e2e8f0">{{ h.description || h.action?.type }}</span>
                  <span v-if="h.dangerous" style="font-size:11px;color:#f59e0b;margin-left:auto">⚠️ 危险</span>
                </div>
              </div>
              <!-- 状态提示 -->
              <div v-if="desktopAvailable === false" class="desktop-unavailable">
                <el-icon><WarningFilled /></el-icon>
                <span>桌面自动化服务不可用 ({{ desktopPlatform }})</span>
              </div>
            </div>
          </el-tab-pane>

          <!-- Tab 0: 自主 Agent -->
          <el-tab-pane label="🧠 自主Agent" name="orchestrator">
            <div class="adv-section">
              <h4 class="adv-section-title">🎯 自主任务执行</h4>
              <p style="color:#94a3b8;font-size:12px;margin:0 0 10px">输入自然语言目标，Agent 会自主规划并执行多步任务</p>
              <div class="orch-input-row">
                <el-input v-model="orchGoal" placeholder="例如：帮我整理本周工作并发送周报给钉钉群" size="small" @keyup.enter="handleRunOrchestrator" :disabled="orchRunning" />
                <el-button size="small" type="primary" @click="handleRunOrchestrator" :loading="orchRunning" :disabled="!orchGoal.trim()">
                  {{ orchRunning ? '执行中...' : '执行' }}
                </el-button>
                <el-button v-if="orchRunning" size="small" type="danger" @click="handleCancelOrchestrator">取消</el-button>
              </div>

              <!-- 执行过程实时展示 -->
              <div v-if="orchSteps.length > 0" class="orch-timeline">
                <div v-for="(step, i) in orchSteps" :key="i" class="orch-step" :class="'orch-' + step.type">
                  <div class="orch-step-icon">
                    <template v-if="step.type === 'thought'">💭</template>
                    <template v-else-if="step.type === 'action'">⚡</template>
                    <template v-else-if="step.type === 'observation'">👁️</template>
                    <template v-else-if="step.type === 'done'">✅</template>
                    <template v-else-if="step.type === 'error'">❌</template>
                    <template v-else>❓</template>
                  </div>
                  <div class="orch-step-body">
                    <div class="orch-step-label">
                      <template v-if="step.type === 'thought'">思考 (Round {{ step.round }})</template>
                      <template v-else-if="step.type === 'action'">调用工具: {{ step.tool }}</template>
                      <template v-else-if="step.type === 'observation'">观察结果: {{ step.tool }}</template>
                      <template v-else-if="step.type === 'done'">任务完成</template>
                      <template v-else-if="step.type === 'error'">错误</template>
                      <template v-else>其他</template>
                    </div>
                    <div class="orch-step-content">
                      <template v-if="step.type === 'thought'">{{ step.thought }}</template>
                      <template v-else-if="step.type === 'action'"><code>{{ JSON.stringify(step.params) }}</code></template>
                      <template v-else-if="step.type === 'observation'"><pre class="orch-obs">{{ step.observation }}</pre></template>
                      <template v-else-if="step.type === 'done'">{{ step.summary }}</template>
                      <template v-else-if="step.type === 'error'">{{ step.error }}</template>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 执行结果摘要 -->
              <div v-if="orchResult" class="orch-result" :class="orchResult.success ? 'ok' : 'fail'">
                <div class="orch-result-header">
                  <span>{{ orchResult.success ? '✅ 任务完成' : '⚠️ 任务未完全完成' }}</span>
                  <el-tag size="small">{{ orchResult.totalDuration }}ms</el-tag>
                  <el-tag size="small" type="info">{{ orchResult.rounds }} 轮推理</el-tag>
                </div>
                <div class="orch-result-summary">{{ orchResult.summary }}</div>
              </div>
            </div>
          </el-tab-pane>

          <!-- Tab 1: Multi-Agent 协作 -->
          <el-tab-pane label="🤖 Multi-Agent 协作" name="agents">
            <div class="adv-section">
              <h4 class="adv-section-title">可用的 AI 助手</h4>
              <div class="agent-grid">
                <div v-for="agent in agents" :key="agent.id" class="agent-card" :class="{ active: chattingAgent === agent.id }" @click="chattingAgent = agent.id">
                  <div class="agent-icon">{{ agent.icon || '🤖' }}</div>
                  <div class="agent-name">{{ agent.name }}</div>
                  <div class="agent-desc">{{ agent.description }}</div>
                  <div class="agent-expertise">
                    <el-tag v-for="e in agent.expertise.slice(0, 2)" :key="e" size="small" effect="plain">{{ e }}</el-tag>
                  </div>
                </div>
              </div>

              <div v-if="chattingAgent" class="agent-chat-box">
                <h5 style="margin:0 0 8px;color:#e2e8f0;font-size:13px">与 {{ agents.find(a => a.id === chattingAgent)?.name || chattingAgent }} 对话</h5>
                <div class="agent-chat-messages" ref="agentChatRef">
                  <div v-for="(msg, i) in agentMessages" :key="i" class="agent-msg" :class="msg.role">
                    <div class="agent-msg-bubble" v-html="formatAgentMsg(msg.content)"></div>
                  </div>
                </div>
                <div class="agent-chat-input">
                  <el-input v-model="agentInput" placeholder="输入你的问题..." @keyup.enter="handleAgentChat" size="small" />
                  <el-button size="small" type="primary" @click="handleAgentChat" :loading="agentChatLoading">发送</el-button>
                </div>
              </div>

              <el-divider />

              <h4 class="adv-section-title">🔄 Multi-Agent 协作</h4>
              <p style="color:#94a3b8;font-size:13px;margin:4px 0 10px">让多个 AI 助手从不同角度分析同一个任务</p>
              <div class="agent-collab-form">
                <el-input v-model="collabTask" placeholder="输入要协作处理的任务..." size="small" style="flex:1" />
                <el-button size="small" type="primary" @click="handleAgentCollaborate" :loading="collabLoading">
                  协作分析
                </el-button>
              </div>
              <div v-if="collabResult" class="collab-results">
                <div v-for="c in collabResult.collaborations" :key="c.agent?.id || Math.random()" class="collab-item">
                  <div class="collab-header">
                    <span>{{ c.agent?.icon || '🤖' }} {{ c.agent?.name || 'Agent' }}</span>
                    <el-tag size="small" effect="plain">{{ c.agent?.expertise?.join(', ') || '通用' }}</el-tag>
                  </div>
                  <div class="collab-reply" style="white-space:pre-wrap">{{ c.reply }}</div>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <!-- Tab 2: 长期记忆与偏好学习 -->
          <el-tab-pane label="🧠 长期记忆" name="memory">
            <div class="adv-section">
              <div class="memory-insights" v-if="memoryInsights">
                <h4 class="adv-section-title">📊 记忆洞察</h4>
                <div class="insight-cards">
                  <div class="insight-card">
                    <span class="insight-value">{{ memoryInsights.totalFacts }}</span>
                    <span class="insight-label">记忆条目</span>
                  </div>
                  <div class="insight-card">
                    <span class="insight-value">{{ memoryInsights.recentFactsCount }}</span>
                    <span class="insight-label">本周新增</span>
                  </div>
                </div>
              </div>

              <h4 class="adv-section-title">✏️ 添加记忆</h4>
              <div class="memory-add-form">
                <el-input v-model="memoryContent" placeholder="记录一个事实或偏好（例如：我常用的编程语言是 Python）" size="small" />
                <div style="display:flex;gap:8px;margin-top:6px">
                  <el-select v-model="memoryCategory" placeholder="分类" size="small" style="width:120px">
                    <el-option label="通用" value="general" />
                    <el-option label="技术偏好" value="tech" />
                    <el-option label="工作习惯" value="work" />
                    <el-option label="常用工具" value="tools" />
                    <el-option label="个人偏好" value="personal" />
                  </el-select>
                  <el-button size="small" type="primary" @click="handleAddMemory" :loading="memoryAdding">记住</el-button>
                </div>
              </div>

              <el-divider />

              <h4 class="adv-section-title">📋 已记住的事实</h4>
              <div v-if="memoryFacts.length === 0" class="adv-empty">还没有记住任何事实，在上面添加一些吧</div>
              <div v-for="fact in memoryFacts" :key="fact.id" class="memory-item">
                <div class="memory-content">{{ fact.content }}</div>
                <div class="memory-meta">
                  <el-tag size="small" effect="plain">{{ fact.category }}</el-tag>
                  <el-tag size="small" :type="fact.source === 'auto' ? 'success' : 'info'" effect="light">
                    {{ fact.source === 'auto' ? '🤖 自动' : '✍️ 手动' }}
                  </el-tag>
                  <span style="color:#64748b;font-size:11px">{{ new Date(fact.createdAt).toLocaleDateString() }}</span>
                  <el-button text size="small" type="danger" @click="handleDeleteMemory(fact.id)">
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </div>
              </div>

              <el-divider />

              <!-- 用户画像 -->
              <h4 class="adv-section-title">👤 用户画像</h4>
              <div v-if="userProfile" class="user-profile-panel">
                <div class="profile-stats">
                  <div class="profile-stat"><span class="profile-num">{{ userProfile.totalMemories }}</span><span class="profile-label">总记忆</span></div>
                  <div class="profile-stat"><span class="profile-num" style="color:#4ade80">{{ userProfile.autoLearned }}</span><span class="profile-label">自动学习</span></div>
                  <div class="profile-stat"><span class="profile-num" style="color:#60a5fa">{{ userProfile.manualAdded }}</span><span class="profile-label">手动添加</span></div>
                </div>
                <div v-if="userProfile.techStack.length > 0" class="profile-tech">
                  <span style="color:#94a3b8;font-size:12px">技术栈: </span>
                  <el-tag v-for="t in userProfile.techStack" :key="t" size="small" effect="dark" style="margin:2px">{{ t }}</el-tag>
                </div>
                <div v-if="userProfile.topTags.length > 0" class="profile-tags">
                  <span style="color:#94a3b8;font-size:12px">标签: </span>
                  <el-tag v-for="t in userProfile.topTags" :key="t" size="small" type="info" style="margin:2px">{{ t }}</el-tag>
                </div>
              </div>
              <div v-else class="adv-empty">暂无画像数据</div>

              <el-divider />

              <h4 class="adv-section-title">⚙️ 用户偏好</h4>
              <div class="prefs-form">
                <div class="pref-row">
                  <span style="color:#cbd5e1;font-size:13px">首选语言:</span>
                  <el-select v-model="preferredLanguage" size="small" style="width:130px">
                    <el-option label="中文" value="zh" />
                    <el-option label="English" value="en" />
                  </el-select>
                </div>
                <div class="pref-row">
                  <span style="color:#cbd5e1;font-size:13px">工作模式:</span>
                  <el-select v-model="preferredWorkMode" size="small" style="width:130px">
                    <el-option label="开发" value="dev" />
                    <el-option label="设计" value="design" />
                    <el-option label="管理" value="management" />
                    <el-option label="其他" value="other" />
                  </el-select>
                </div>
                <el-button size="small" type="primary" @click="handleSavePreferences" :loading="prefSaving">保存偏好</el-button>
              </div>
            </div>
          </el-tab-pane>

          <!-- Tab 3: 工作流自动化 -->
          <el-tab-pane label="🔄 工作流" name="workflows">
            <div class="adv-section">
              <div class="wf-header">
                <h4 class="adv-section-title" style="margin:0">⚙️ 自动化工作流</h4>
                <el-button size="small" type="primary" @click="showWfCreateDialog = true">
                  <el-icon><Plus /></el-icon> 新建
                </el-button>
              </div>

              <div v-if="workflows.length === 0" class="adv-empty">暂无工作流，点击「新建」创建</div>
              <div v-for="wf in workflows" :key="wf.id" class="wf-card">
                <div class="wf-card-header">
                  <div class="wf-card-title">
                    <span class="wf-name">{{ wf.name }}</span>
                    <el-tag size="small" :type="wf.trigger?.type === 'schedule' ? 'warning' : wf.trigger?.type === 'condition' ? 'danger' : 'info'" effect="plain">
                      {{ wf.trigger?.type === 'schedule' ? '⏰ 定时' : wf.trigger?.type === 'condition' ? '⚡ 条件' : '👆 手动' }}
                    </el-tag>
                  </div>
                  <div class="wf-card-actions">
                    <el-button size="small" type="success" plain @click="handleRunWorkflow(wf)" :loading="wfRunning === wf.id">
                      ▶ 运行
                    </el-button>
                    <el-switch v-model="wf.enabled" size="small" @change="handleToggleWorkflow(wf)" />
                    <el-button text size="small" type="danger" @click="handleDeleteWorkflow(wf.id)">
                      <el-icon><Delete /></el-icon>
                    </el-button>
                  </div>
                </div>
                <div class="wf-desc">{{ wf.description }}</div>
                <div class="wf-steps">
                  <div v-for="(step, si) in wf.steps" :key="si" class="wf-step-chip">
                    <span class="wf-step-num">{{ si + 1 }}</span>
                    <span>{{ step.label || step.type }}</span>
                  </div>
                </div>
                <div v-if="wf.trigger?.condition" class="wf-condition">
                  <el-icon><Lightning /></el-icon> 条件: {{ wf.trigger.condition }}
                </div>
              </div>

              <el-divider />

              <h4 class="adv-section-title">📜 执行历史</h4>
              <div v-if="wfHistory.length === 0" class="adv-empty">暂无执行记录</div>
              <div v-for="h in wfHistory" :key="h.id" class="wf-history-item">
                <div class="wf-history-header">
                  <span :class="h.success ? 'wf-status-ok' : 'wf-status-fail'">{{ h.success ? '✅' : '❌' }}</span>
                  <span class="wf-history-name">{{ h.workflowName }}</span>
                  <span class="wf-history-time">{{ new Date(h.executedAt).toLocaleString() }}</span>
                  <el-tag size="small" :type="h.success ? 'success' : 'danger'">{{ h.totalDuration }}ms</el-tag>
                </div>
                <div class="wf-history-steps">
                  <span v-for="s in h.steps" :key="s.step" class="wf-history-step" :class="s.status">
                    {{ s.step }}.{{ s.label }} {{ s.status === 'success' ? '✓' : '✗' }}
                  </span>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <!-- Tab 4: 集成中心 -->
          <el-tab-pane label="🔌 集成" name="integrations">
            <div class="adv-section">
              <!-- 钉钉配置 -->
              <h4 class="adv-section-title">💬 钉钉 Webhook</h4>
              <div class="integ-form">
                <el-input v-model="dtWebhookUrl" placeholder="Webhook URL (https://oapi.dingtalk.com/robot/send?access_token=...)" size="small" />
                <div style="display:flex;gap:8px;margin-top:6px">
                  <el-input v-model="dtSecret" placeholder="加签 Secret（可选）" size="small" style="flex:1" />
                  <el-switch v-model="dtEnabled" active-text="启用" size="small" />
                  <el-button size="small" type="primary" @click="handleSaveDtConfig" :loading="dtSaving">保存</el-button>
                </div>
                <div v-if="dtConfigured" style="margin-top:6px">
                  <el-tag size="small" type="success" effect="plain">✅ 已配置</el-tag>
                  <el-button size="small" text type="primary" @click="handleTestDtSend" style="margin-left:8px">发送测试消息</el-button>
                </div>
              </div>

              <el-divider />

              <!-- Git 配置 -->
              <h4 class="adv-section-title">📂 Git 仓库</h4>
              <div class="integ-form">
                <div style="display:flex;gap:8px">
                  <el-input v-model="gitRepoPath" placeholder="本地 Git 仓库路径（如 D:\projects\my-app）" size="small" style="flex:1" />
                  <el-button size="small" type="primary" @click="handleSaveGitConfig" :loading="gitSaving">保存</el-button>
                </div>
                <div v-if="gitRepoPath" class="git-actions">
                  <el-button size="small" @click="handleGitExec('status')" :loading="gitLoading">status</el-button>
                  <el-button size="small" @click="handleGitExec('log')" :loading="gitLoading">log</el-button>
                  <el-button size="small" @click="handleGitExec('pull')" :loading="gitLoading">pull</el-button>
                  <el-button size="small" @click="handleGitExec('diff')" :loading="gitLoading">diff</el-button>
                  <el-button size="small" @click="handleGitExec('branch')" :loading="gitLoading">branch</el-button>
                  <el-button size="small" type="success" @click="handleGitDiffSummary" :loading="gitLoading">🤖 AI摘要</el-button>
                </div>
                <pre v-if="gitOutput" class="git-output">{{ gitOutput }}</pre>
              </div>

              <el-divider />

              <!-- 文件系统 -->
              <h4 class="adv-section-title">📁 文件系统</h4>
              <div class="integ-form">
                <div style="display:flex;gap:8px;align-items:center">
                  <el-input v-model="fsAllowedDir" placeholder="允许访问的目录（如 D:\文档）" size="small" style="flex:1" @keyup.enter="handleAddFsDir" />
                  <el-button size="small" @click="handleAddFsDir">添加</el-button>
                </div>
                <div v-if="fsAllowedDirs.length > 0" style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap">
                  <el-tag v-for="d in fsAllowedDirs" :key="d" size="small" closable @close="handleRemoveFsDir(d)">{{ d }}</el-tag>
                </div>
                <div style="display:flex;gap:8px;margin-top:8px">
                  <el-input v-model="fsBrowsePath" placeholder="浏览目录路径" size="small" style="flex:1" @keyup.enter="handleFsBrowse" />
                  <el-button size="small" @click="handleFsBrowse" :loading="fsLoading">浏览</el-button>
                </div>
                <div v-if="fsItems.length > 0" class="fs-list">
                  <div v-for="item in fsItems" :key="item.name" class="fs-item" @click="item.type === 'dir' ? (fsBrowsePath = fsBrowsePath + '\\' + item.name, handleFsBrowse()) : null">
                    <span>{{ item.type === 'dir' ? '📁' : '📄' }} {{ item.name }}</span>
                    <span class="fs-item-size">{{ item.type === 'file' ? (item.size / 1024).toFixed(1) + 'KB' : '' }}</span>
                  </div>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <!-- Tab: 插件系统 -->
          <el-tab-pane label="🧩 插件" name="plugins">
            <div class="adv-section">
              <div class="section-bar">
                <h4 class="adv-section-title">🧩 已安装插件</h4>
                <el-button size="small" @click="showPluginGenDialog = true">➕ 创建插件</el-button>
              </div>
              <div v-if="pluginList.length === 0" class="adv-empty">暂无插件</div>
              <div v-for="p in pluginList" :key="p.id" class="plugin-card">
                <div class="plugin-card-header">
                  <span class="plugin-name">{{ p.name }} <el-tag size="small" type="info">v{{ p.version }}</el-tag></span>
                  <el-switch v-model="p.enabled" size="small" @change="(val: any) => handleTogglePlugin(p.id, val)" />
                </div>
                <div class="plugin-desc">{{ p.description }}</div>
                <div class="plugin-tools">
                  <el-tag v-for="t in p.tools" :key="t" size="small" type="success" class="plugin-tool-tag">{{ t }}</el-tag>
                </div>
                <div class="plugin-actions">
                  <el-button size="small" text @click="handleReloadPlugin(p.id)">🔄 重载</el-button>
                  <el-button size="small" text @click="handleTestPlugin(p)">▶️ 测试</el-button>
                </div>
              </div>
            </div>
            <div class="adv-section">
              <h4 class="adv-section-title">🔗 MCP 服务器</h4>
              <div class="mcp-status">
                <el-tag :type="mcpHealth ? 'success' : 'danger'" size="small">{{ mcpHealth ? 'MCP Server 运行中' : 'MCP Server 离线' }}</el-tag>
                <span class="mcp-endpoint">/mcp</span>
              </div>
              <div v-if="mcpServers.length === 0" class="adv-empty">未配置外部 MCP Server</div>
              <div v-for="s in mcpServers" :key="s.id" class="mcp-server-item">
                <span>{{ s.name }}</span>
                <el-tag :type="s.status === 'connected' ? 'success' : 'info'" size="small">{{ s.status }}</el-tag>
                <el-button size="small" text @click="handleConnectMcp(s.id)">连接</el-button>
                <el-button size="small" text type="danger" @click="handleRemoveMcp(s.id)">删除</el-button>
              </div>
              <div class="mcp-add-row">
                <el-input v-model="mcpNewUrl" placeholder="MCP Server URL (http://...)" size="small" style="flex:1" />
                <el-button size="small" @click="handleAddMcp">添加</el-button>
              </div>
            </div>
          </el-tab-pane>

          <!-- Tab 5: 主动式 AI 助理 -->
          <el-tab-pane label="⚡ 主动式 AI 助理" name="assistant">
            <div class="adv-section">
              <h4 class="adv-section-title">💡 当前建议</h4>
              <div v-if="suggestions.length === 0" class="adv-empty">暂无主动建议</div>
              <div v-for="s in suggestions" :key="s.id" class="suggestion-item">
                <div class="suggestion-icon">
                  <template v-if="s.type === 'reminder'">⏰</template>
                  <template v-else-if="s.type === 'summary'">📊</template>
                  <template v-else-if="s.type === 'optimize'">🔧</template>
                  <template v-else>💡</template>
                </div>
                <div class="suggestion-body">
                  <div class="suggestion-title">{{ s.title }}</div>
                  <div class="suggestion-desc">{{ s.description }}</div>
                  <!-- 快速记录工作日志 -->
                  <div v-if="s.actionType === 'quick-log'" class="suggestion-inline-form">
                    <el-input
                      v-model="quickLogContent"
                      placeholder="输入工作内容，回车即可记录"
                      size="small"
                      @keyup.enter="handleQuickLog"
                      style="flex:1;min-width:160px"
                    />
                    <el-select v-model="quickLogCategory" size="small" style="width:90px">
                      <el-option label="开发" value="开发" />
                      <el-option label="会议" value="会议" />
                      <el-option label="文档" value="文档" />
                      <el-option label="其他" value="其他" />
                    </el-select>
                    <el-button size="small" type="primary" @click="handleQuickLog" :loading="quickLogging">
                      <el-icon><Lightning /></el-icon> 记录
                    </el-button>
                  </div>
                </div>
                <!-- 一键操作按钮 -->
                <div class="suggestion-actions">
                  <el-button
                    v-if="s.actionType === 'auto-classify'"
                    size="small" type="primary" plain
                    @click="handleAutoClassify" :loading="autoClassifying"
                  >{{ s.actionLabel }}</el-button>
                  <el-button
                    v-else-if="s.actionType === 'auto-summary'"
                    size="small" type="primary" plain
                    @click="handleAutoSummary" :loading="autoSummarizing"
                  >{{ s.actionLabel }}</el-button>
                  <el-button
                    v-else-if="s.actionType === 'trigger'"
                    size="small" type="info" plain
                    @click="handleExecTrigger(s)"
                  >{{ s.actionLabel }}</el-button>
                </div>
              </div>

              <!-- 自动生成结果展示 -->
              <div v-if="summaryResult" class="summary-result">
                <pre class="summary-text">{{ summaryResult }}</pre>
                <el-button size="small" @click="summaryResult = ''">关闭</el-button>
              </div>

              <el-divider />

              <h4 class="adv-section-title">⏱️ 自定义触发器</h4>
              <div class="trigger-add-form">
                <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
                  <el-input v-model="triggerName" placeholder="触发器名称" size="small" style="flex:1;min-width:140px" />
                  <el-select v-model="triggerType" size="small" style="width:90px">
                    <el-option label="定时" value="scheduled" />
                    <el-option label="条件" value="conditional" />
                    <el-option label="手动" value="manual" />
                  </el-select>
                  <el-time-picker
                    v-if="triggerType === 'scheduled'"
                    v-model="triggerSchedule"
                    placeholder="提醒时间"
                    format="HH:mm"
                    value-format="HH:mm"
                    size="small"
                    style="width:110px"
                  />
                  <el-input v-model="triggerAction" placeholder="建议内容" size="small" style="flex:1;min-width:140px" />
                  <el-button size="small" type="primary" @click="handleAddTrigger" :loading="triggerAdding">添加</el-button>
                </div>
              </div>
              <div v-if="triggers.length === 0" class="adv-empty" style="margin-top:8px">暂无触发器</div>
              <div v-for="t in triggers" :key="t.id" class="trigger-item">
                <div class="trigger-info">
                  <span class="trigger-name">{{ t.name }}</span>
                  <span style="color:#94a3b8;font-size:12px">{{ t.action }}</span>
                  <span v-if="t.schedule" style="color:#4fc3f7;font-size:11px;font-family:monospace">⏰ {{ t.schedule }}</span>
                </div>
                <div style="display:flex;align-items:center;gap:4px">
                  <el-button text size="small" @click="handleEditTrigger(t)">
                    <el-icon><Edit /></el-icon>
                  </el-button>
                  <el-switch v-model="t.enabled" size="small" @change="handleToggleTrigger(t)" />
                  <el-button text size="small" type="danger" @click="handleDeleteTrigger(t.id)">
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </div>
              </div>
            </div>
          </el-tab-pane>

          <!-- Tab: 团队协作 -->
          <el-tab-pane label="👥 团队" name="team">
            <TeamSpace :is-logged-in="isLoggedIn" :is-admin="isAdmin" />
          </el-tab-pane>

          <!-- Tab: Agent 成长 -->
          <el-tab-pane label="🌱 Agent成长" name="agentGrowth">
            <AgentGrowth />
          </el-tab-pane>

          <!-- Tab: AI 编码工作区 -->
          <el-tab-pane label="💻 编码工作区" name="codingWorkspace">
            <CodingWorkspace />
          </el-tab-pane>

          <!-- Tab: AI 网关 -->
          <el-tab-pane label="🔌 AI网关" name="aiGateway">
            <AIGatewayPanel />
          </el-tab-pane>

          <!-- Tab: Agent Mesh -->
          <el-tab-pane label="🕸️ Agent网络" name="agentMesh">
            <AgentMeshPanel />
          </el-tab-pane>

          <!-- Tab: 插件市场 -->
          <el-tab-pane label="🧩 插件市场" name="pluginStore">
            <PluginStore />
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-dialog>

    <!-- 编辑触发器对话框 -->
    <el-dialog v-model="showTriggerEditDialog" title="✏️ 编辑触发器" width="380px" append-to-body>
      <div style="display:flex;flex-direction:column;gap:10px">
        <el-input v-model="editTriggerName" placeholder="触发器名称" size="small" />
        <el-time-picker
          v-model="editTriggerTime"
          placeholder="提醒时间"
          format="HH:mm"
          value-format="HH:mm"
          size="small"
          style="width:100%"
        />
        <el-input v-model="editTriggerAction" placeholder="建议内容" size="small" />
      </div>
      <template #footer>
        <el-button size="small" @click="showTriggerEditDialog = false">取消</el-button>
        <el-button size="small" type="primary" @click="handleSaveTriggerEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 创建工作流对话框 -->
    <el-dialog v-model="showWfCreateDialog" title="🔄 新建工作流" width="520px" append-to-body>
      <div style="display:flex;flex-direction:column;gap:12px">
        <el-input v-model="wfCreateName" placeholder="工作流名称（如：每日报告）" size="small" />
        <el-input v-model="wfCreateDesc" placeholder="描述（可选）" size="small" />
        <div style="display:flex;gap:8px;align-items:center">
          <span style="color:#94a3b8;font-size:13px;white-space:nowrap">触发方式:</span>
          <el-select v-model="wfCreateTriggerType" size="small" style="width:120px">
            <el-option label="👆 手动" value="manual" />
            <el-option label="⏰ 定时" value="schedule" />
            <el-option label="⚡ 条件" value="condition" />
          </el-select>
          <el-input v-if="wfCreateTriggerType === 'condition'" v-model="wfCreateCondition" placeholder="条件表达式，如 bookmarks_unclassified > 10" size="small" style="flex:1" />
        </div>
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span style="color:#e2e8f0;font-size:13px;font-weight:500">执行步骤</span>
            <el-button size="small" text type="primary" @click="addWfStep"><el-icon><Plus /></el-icon> 添加步骤</el-button>
          </div>
          <div v-for="(step, idx) in wfCreateSteps" :key="idx" class="wf-create-step">
            <span class="wf-create-step-num">{{ idx + 1 }}</span>
            <el-select v-model="step.type" size="small" style="width:110px">
              <el-option label="🤖 LLM" value="llm" />
              <el-option label="🌐 API" value="api" />
              <el-option label="⏳ 延迟" value="delay" />
              <el-option label="📢 通知" value="notify" />
              <el-option label="📝 日志汇总" value="worklog_summary" />
              <el-option label="💾 存知识库" value="save_knowledge" />
              <el-option label="⌨️ 用户输入" value="input" />
            </el-select>
            <el-input v-model="step.label" placeholder="步骤名称" size="small" style="flex:1" />
            <el-button text size="small" type="danger" @click="removeWfStep(idx)" :disabled="wfCreateSteps.length <= 1">
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button size="small" @click="showWfCreateDialog = false">取消</el-button>
        <el-button size="small" type="primary" @click="handleCreateWorkflow">创建</el-button>
      </template>
    </el-dialog>

    <footer class="footer">
      <div class="footer-inner">
        <span>Chat Portal</span>
        <span class="dot">·</span>
        <span>{{ storageMode }}</span>
        <span class="dot">·</span>
        <span>默认浏览器 <strong>Chrome</strong></span>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { MagicStick, Upload, Download, Notebook, Delete, Search, FolderOpened, Timer, Plus, Edit, Lightning, Bell, Close } from '@element-plus/icons-vue'
import { DocumentCopy, WarningFilled, UserFilled, SwitchButton, Monitor, Connection, Grid, Goods } from '@element-plus/icons-vue'
import { useBookmarkStore } from '@/stores/bookmark'
import { openUrlInChrome, openLocalFile, searchApps, openApp, aiClassifyBookmarks, downloadFromGithub, exportBookmarks, getSystemStatus, uploadKnowledgeDoc, getKnowledgeDocs, deleteKnowledgeDoc, queryKnowledge, addWorkLog, getWorkLogs, getWorkLogDates, deleteWorkLog, getWorkLogStats, getAgents, agentChat, agentCollaborate, getMemoryFacts, addMemoryFact, deleteMemoryFact, getMemoryInsights, getMemoryPreferences, updateMemoryPreferences, getAssistantTriggers, addAssistantTrigger, updateAssistantTrigger, deleteAssistantTrigger, getAssistantSuggestions, autoSummary, getLlmStatus, getMemoryProfile, getWorkflows, createWorkflow, updateWorkflow, deleteWorkflow, runWorkflow, getWorkflowHistory, getDingtalkConfig, saveDingtalkConfig, sendDingtalkMessage, getGitConfig, saveGitConfig, gitExec, gitDiffSummary, getNotifications, markNotificationRead, deleteNotification, clearNotifications, getFsConfig, saveFsConfig, fsListDir, runOrchestratorStream, cancelOrchestratorTask, getPlugins, enablePlugin, disablePlugin, reloadPlugin, executePluginTool, generatePluginTemplate, getMcpServers, addMcpServer, removeMcpServer, connectMcpServer, getMcpHealth, analyzeImage, extractFromImage, imageToCode, getDashboardStats, generateWeeklyReport, trackEvent, desktopScreenshot, desktopAnalyzeUI, desktopExecute, desktopHistory, desktopStatus } from '@/api'
import type { UserProfile, Workflow, WorkflowRunRecord, NotificationItem, OrchestratorStep, PluginInfo, McpServerInfo, DashboardStats } from '@/api'
import type { Bookmark, ChatMessage, BookmarkGroup, TagCount, KnowledgeDoc, KnowledgeChunk, KnowledgeQueryResult, WorkLog, WorkLogStats, Agent, CollaborateResult, MemoryFact, MemoryInsights, AssistantTrigger, AssistantSuggestion } from '@/types'
import type { AIClassifyResult } from '@/api'
import LoginView from '@/components/LoginView.vue'
import TeamSpace from '@/components/TeamSpace.vue'
import AgentGrowth from '@/components/AgentGrowth.vue'
import CodingWorkspace from '@/components/CodingWorkspace.vue'
import AIGatewayPanel from '@/components/AIGatewayPanel.vue'
import AgentMeshPanel from '@/components/AgentMeshPanel.vue'
import PluginStore from '@/components/PluginStore.vue'

const bookmarkStore = useBookmarkStore()
const { bookmarks, loadBookmarks, save, clearAll, fuzzyFind,
  total, currentPage, pageSize, setPage,
  groups, loadGroups, createGroup, removeGroup,
  tags, loadTags, importBookmarks } = bookmarkStore

const searchKeyword = ref('')
const inputText = ref('')
const loading = ref(false)
const messages = ref<ChatMessage[]>([])
const messagesRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const mainRef = ref<HTMLElement | null>(null)

// AI 分类相关
const classifying = ref(false)
const classifyResult = ref<AIClassifyResult | null>(null)

// 分组/标签 筛选
const selectedGroupId = ref<number | undefined>(undefined)
const selectedTag = ref<string | undefined>(undefined)
const showGroupDialog = ref(false)
const newGroupName = ref('')

// 导入
const showImportDialog = ref(false)
const importText = ref('')
const importFormat = ref<'json' | 'csv'>('json')
const importPlaceholder = computed(() =>
  importFormat.value === 'json'
    ? `粘贴 JSON 数组，如：\n[{"keyword":"百度","url":"https://www.baidu.com"}]`
    : '粘贴 CSV 文本（首行为表头）'
)

// RAG 知识库
const showKnowledgeDialog = ref(false)
const knowledgeTitle = ref('')
const knowledgeContent = ref('')
const knowledgeUploading = ref(false)
const knowledgeDocs = ref<KnowledgeDoc[]>([])
const knowledgeQuery = ref('')
const knowledgeQuerying = ref(false)
const knowledgeQueryResult = ref<KnowledgeQueryResult | null>(null)

// 系统状态（降级提示）
const storageMode = ref('JSON 文件')

async function refreshFilters() {
  await loadGroups()
  await loadTags()
}

const filteredBookmarks = computed(() => {
  if (!searchKeyword.value) return bookmarks.value
  const kw = searchKeyword.value.toLowerCase()
  return bookmarks.value.filter(b =>
    (b.keyword?.toLowerCase().includes(kw) || false) ||
    (b.url?.toLowerCase().includes(kw) || false)
  )
})

onMounted(async () => {
  await loadBookmarks()
  await refreshFilters()
  loadNotifications()
  // 检查系统状态
  try {
    const statusRes = await getSystemStatus()
    if (statusRes.code === 200) {
      storageMode.value = statusRes.data.storage
    }
  } catch {}
  // 自动恢复登录状态
  const savedUser = localStorage.getItem('auth_user')
  const savedToken = localStorage.getItem('auth_token')
  if (savedUser && savedToken) {
    try {
      authUser.value = JSON.parse(savedUser)
      showLogin.value = false
    } catch { showLogin.value = true }
  } else {
    showLogin.value = true
  }
})

// ── 工具 ──

function scrollToBottom() {
  nextTick(() => {
    if (messagesRef.value) messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  })
}

function addMessage(role: ChatMessage['role'], content: string, type?: ChatMessage['type']) {
  messages.value.push({ role, content, timestamp: new Date().toISOString(), type })
  scrollToBottom()
}

function formatTime(ts?: string): string {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function renderContent(text: string): string {
  if (!text) return ''
  let html = text.replace(/\n/g, '<br>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" style="color:#4fc3f7;text-decoration:underline">$1</a>')
  html = html.replace(/`([^`]+)`/g, '<code style="background:#1e293b;color:#e2e8f0;padding:1px 6px;border-radius:4px;font-size:0.9em">$1</code>')
  return html
}

function quickInput(text: string) {
  inputText.value = text
  nextTick(() => inputRef.value?.focus())
}

// ── 本地路径检测 ──

function isLocalPath(url: string): boolean {
  return /^[A-Za-z]:\\|^file:\/\/|^\\\\/.test(url) || /^[A-Za-z]:\//.test(url)
}

function displayUrl(url: string): string {
  if (isLocalPath(url)) {
    const cleaned = url.replace(/^file:\/\//i, '')
    return cleaned.length > 40 ? '...' + cleaned.slice(-37) : cleaned
  }
  return url.length > 40 ? url.slice(0, 37) + '...' : url
}

function isWindowsPath(str: string): boolean {
  return /^[A-Za-z]:\\(?:[^\\<>:"|?*\n]+\\)*[^\\<>:"|?*\n]*$/.test(str) ||
         /^[A-Za-z]:\/(?:[^\/<>:"|?*\n]+\/)*[^\/<>:"|?*\n]*$/.test(str) ||
         /^file:\/\/\//i.test(str) ||
         /^\\\\/.test(str)
}

// ── 卡片样式 ──

const cardColors = [
  '#4fc3f7', '#81c784', '#ffb74d', '#e57373',
  '#ba68c8', '#4dd0e1', '#f06292', '#aed581',
  '#7986cb', '#4db6ac', '#dce775', '#ff8a65',
]

function getCardColor(url: string): string {
  if (isLocalPath(url)) return '#4db6ac'
  let hash = 0
  for (let i = 0; i < url.length; i++) { hash = ((hash << 5) - hash) + url.charCodeAt(i); hash |= 0 }
  return cardColors[Math.abs(hash) % cardColors.length]
}

function getUrlEmoji(url: string): string {
  if (isLocalPath(url)) return getFileTypeEmoji(url)
  const u = url.toLowerCase()
  if (u.includes('baidu')) return '度'
  if (u.includes('google')) return 'G'
  if (u.includes('github') || u.includes('git')) return '⚡'
  if (u.includes('zhihu')) return '知'
  if (u.includes('bilibili') || u.includes('b23')) return 'B站'
  if (u.includes('doubao') || u.includes('豆包')) return '豆'
  if (u.includes('douyin')) return '抖'
  if (u.includes('taobao') || u.includes('tmall')) return '淘'
  if (u.includes('jd.com') || u.includes('京东')) return '京'
  if (u.includes('weibo')) return '微'
  if (u.includes('qq.com') || u.includes('tencent')) return 'Q'
  if (u.includes('microsoft') || u.includes('azure') || u.includes('bing')) return 'M'
  if (u.includes('apple')) return '🍎'
  if (u.includes('stackoverflow')) return 'S'
  if (u.includes('docker')) return '🐳'
  if (u.includes('redis')) return 'R'
  if (u.includes('node')) return 'N'
  if (u.includes('react')) return '⚛'
  if (u.includes('vue')) return 'V'
  if (u.includes('python')) return '🐍'
  if (u.includes('java')) return '☕'
  if (u.includes('rust')) return '🦀'
  if (u.includes('chatgpt') || u.includes('openai') || u.includes('gpt')) return '🤖'
  if (u.includes('claude')) return '🧠'
  if (u.includes('deepseek')) return 'D'
  if (u.includes('kimi') || u.includes('月之暗面')) return 'K'
  if (u.includes('youtube') || u.includes('youtu')) return '▶'
  if (u.includes('twitter') || u.includes('x.com')) return '𝕏'
  return '🔗'
}

function getFileTypeEmoji(filePath: string): string {
  const name = filePath.toLowerCase()
  const ext = name.split('.').pop() || ''
  if ([ 'bat', 'cmd', 'ps1', 'sh', 'bash', 'zsh', 'exe', 'msi', 'lnk' ].includes(ext)) return '▶'
  if ([ 'pdf' ].includes(ext)) return '📕'
  if ([ 'html', 'htm' ].includes(ext)) return '🌐'
  if ([ 'txt', 'log' ].includes(ext)) return '📄'
  if ([
    'json', 'sql', 'js', 'ts', 'vue', 'jsx', 'tsx',
    'java', 'py', 'rb', 'php', 'go', 'rs', 'cs', 'kt', 'swift',
    'c', 'cpp', 'h', 'hpp',
    'css', 'scss', 'less', 'sass',
    'xml', 'yaml', 'yml', 'toml',
    'md', 'markdown',
    'properties', 'env',
    'gradle', 'gitignore', 'editorconfig',
    'cfg', 'ini', 'conf',
  ].includes(ext)) return '📝'
  if ([ 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg', 'webp', 'ico' ].includes(ext)) return '🖼'
  if ([ 'xlsx', 'xls', 'csv' ].includes(ext)) return '📊'
  if ([ 'docx', 'doc' ].includes(ext)) return '📋'
  if ([ 'pptx', 'ppt' ].includes(ext)) return '📑'
  if ([ 'zip', 'rar', '7z', 'tar', 'gz' ].includes(ext)) return '📦'
  if ([ 'mp3', 'wav', 'flac', 'aac' ].includes(ext)) return '🎵'
  if ([ 'mp4', 'avi', 'mkv', 'mov', 'wmv' ].includes(ext)) return '🎬'
  return '📁'
}

// ── 打开书签 ──

async function openBookmark(bm: Bookmark) {
  try {
    ElMessage.info(`正在打开: ${bm.keyword}`)
    if (isLocalPath(bm.url)) {
      const res = await openLocalFile(bm.url)
      ElMessage.success(res.message || '已打开')
    } else {
      const res = await openUrlInChrome(bm.url)
      ElMessage.success(res.message || '已打开')
    }
  } catch {
    ElMessage.error('打开失败')
  }
}

async function copyUrl(url: string) {
  try {
    await navigator.clipboard.writeText(url)
    ElMessage.success('✅ 链接已复制')
  } catch {
    // 降级：创建临时输入框
    const ta = document.createElement('textarea')
    ta.value = url
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
    ElMessage.success('✅ 链接已复制')
  }
}

// ── 处理输入 ──

async function handleSend() {
  // 如果有附加图片，走多模态分析流程
  if (attachedImage.value) {
    await handleAnalyzeAttachedImage()
    scrollToBottom()
    return
  }
  const text = inputText.value.trim()
  if (!text || loading.value) return
  inputText.value = ''
  loading.value = true
  addMessage('user', text)
  await processInput(text)
  loading.value = false
  scrollToBottom()
}

async function processInput(input: string): Promise<void> {
  const t = input.trim()

  // === 命令 ===
  if (t === '帮助' || t === '/help' || t === '?') { showHelpMessage(); return }

  if (t === '/list' || t === '所有' || t === '查看所有' || t === '书签列表') {
    if (bookmarks.value.length === 0) addMessage('assistant', '📋 当前没有任何书签，快去添加吧！')
    else addMessage('assistant', '', 'list')
    return
  }

  if (t === '/clear' || t === '清空所有') {
    try {
      await ElMessageBox.confirm('确定要清空所有书签吗？', '确认', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' })
      const ok = await clearAll()
      if (ok) addMessage('assistant', '🗑️ 已清空所有书签')
    } catch { /* */ }
    return
  }

  if (t.startsWith('/del ') || t.startsWith('删除 ')) {
    const kw = t.replace(/^\/(del|删除)\s+/, '').trim()
    if (!kw) { addMessage('assistant', '请指定关键词，例如：/del 百度'); return }
    const bm = bookmarks.value.find(b => b.keyword === kw)
    if (!bm) { addMessage('assistant', `未找到: **${kw}**`); return }
    let ok = false
    if (bm.id) {
      ok = await bookmarkStore.remove(bm.id)
    } else {
      ok = await bookmarkStore.removeByKeyword(kw)
    }
    if (ok) addMessage('assistant', `🗑️ 已删除: **${kw}**`)
    return
  }

  // === GitHub 下载 ===
  if (t.startsWith('下载') || t.startsWith('download')) {
    // 格式: 下载 https://github.com/xxx/yyy [到 路径]
    const dlMatch = t.match(/^(?:下载|download)\s+(https?:\/\/[^\s]+?github\.com\/[^\s]+)(?:\s+到\s+(.+))?$/i)
    if (dlMatch) {
      const gitUrl = dlMatch[1].replace(/[，,。.！!？?：:]$/, '')
      const targetPath = dlMatch[2]?.trim()
      addMessage('assistant', `📥 正在从 GitHub 下载...\n\nURL: ${gitUrl}\n${targetPath ? `目标路径: ${targetPath}` : '目标路径: 默认下载目录'}`)
      try {
        const res = await downloadFromGithub(gitUrl, targetPath)
        if (res.code === 200) {
          addMessage('assistant', `✅ ${res.message}`)
        } else {
          addMessage('assistant', `❌ 下载失败: ${res.message}`)
        }
      } catch (err: any) {
        addMessage('assistant', `❌ 下载失败: ${err.message || '未知错误'}`)
      }
      return
    }
    addMessage('assistant', '❌ 格式错误，请使用：\n**下载 https://github.com/owner/repo [到 D:\\路径]**')
    return
  }

  // === 本地文件路径 ===
  if (isWindowsPath(t)) {
    let filePath = t
    if (filePath.startsWith('file://')) filePath = filePath.replace(/^file:\/\//i, '')
    // 尝试提取描述前缀：前面是否有文字描述
    const descMatch = t.match(/^(.+?)\s+([A-Za-z]:\\.+)$/)
    if (descMatch) {
      // 有描述+路径 → 保存为书签
      const keyword = descMatch[1].trim()
      const rawPath = descMatch[2].trim()
      const ok = await save(keyword, rawPath)
      if (ok) addMessage('assistant', `✅ 已保存文件书签！\n\n**${keyword}** → \`${rawPath}\`\n\n点击卡片即可在默认程序中打开。`)
      else addMessage('assistant', '❌ 保存失败')
    } else {
      // 纯路径 → 直接打开
      try {
        addMessage('assistant', `📂 正在打开: \`${filePath}\``)
        const res = await openLocalFile(filePath)
        addMessage('assistant', res.message || '✅ 已打开')
      } catch { addMessage('assistant', `❌ 打开失败，路径可能不存在`) }
    }
    return
  }

  // === 检测 URL ===
  const urlRegex = /(https?:\/\/[^\s]+)|([a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/
  const urlMatch = t.match(urlRegex)

  if (urlMatch) {
    const url = urlMatch[0]
    let keyword = t.replace(urlRegex, '').trim()
    keyword = keyword.replace(/[，,。.！!？?：:]\s*$/, '').trim()

    const finalUrl = url.startsWith('http') ? url : `https://${url}`
    const isGithub = /github\.com/i.test(finalUrl)

    // GitHub URL → 自动触发下载
    if (isGithub) {
      // 检测关键词是否包含 "下载" 或 "d盘"
      const wantsDl = keyword && /下载|download/i.test(keyword)
      if (wantsDl || !keyword) {
        let targetPath: string | undefined
        if (wantsDl && /d[：:盘]?|D[：:盘]?/i.test(keyword)) targetPath = 'D:\\'
        addMessage('assistant', `📥 正在从 GitHub 下载...\n\nURL: ${finalUrl}\n${targetPath ? `目标路径: ${targetPath}` : '目标路径: 默认下载目录'}`)
        try {
          const res = await downloadFromGithub(finalUrl, targetPath)
          if (res.code === 200) addMessage('assistant', `✅ ${res.message}`)
          else addMessage('assistant', `❌ 下载失败: ${res.message}`)
        } catch (err: any) {
          addMessage('assistant', `❌ 下载失败: ${err.message || '未知错误'}`)
        }
        return
      }
      // 有关键词但不含 "下载" → 仍可保存为书签（走下面的通用逻辑）
    }

    // 非 GitHub URL 或 GitHub 但带有非下载关键词
    if (!keyword) { addMessage('assistant', '❌ 请同时提供中文描述和 URL，例如：\n**百度 https://www.baidu.com**'); return }
    const ok = await save(keyword, finalUrl)
    if (ok) addMessage('assistant', `✅ 已保存书签！\n\n**${keyword}** → ${finalUrl}\n\n点击卡片即可在 Chrome 中打开。`)
    else addMessage('assistant', '❌ 保存失败')
    return
  }

  // === 纯文字 → 匹配书签 ===
  const matches = fuzzyFind(t)
  if (matches.length === 1) {
    const bm = matches[0]
    try {
      addMessage('assistant', `🚀 正在打开 **${bm.keyword}**...`)
      if (isLocalPath(bm.url)) {
        const res = await openLocalFile(bm.url)
        addMessage('assistant', res.message || '✅ 已打开')
      } else {
        const res = await openUrlInChrome(bm.url)
        addMessage('assistant', res.message || '✅ 已打开')
      }
    } catch { addMessage('assistant', `❌ 打开失败，请手动访问`) }
    return
  } else if (matches.length > 1) {
    const list = matches.map((m, i) => `${i + 1}. **${m.keyword}** → ${displayUrl(m.url)}`).join('\n')
    addMessage('assistant', `🔍 找到多个匹配：\n\n${list}\n\n请输入更精确的关键词。`)
    return
  }

  // === 未匹配书签 → 搜索已安装应用 ===
  // 提取输入中的第一个词作为应用搜索关键词（支持 "idea windows 快捷访问" → "idea"）
  try {
    const words = t.split(/[\s,，、]+/).filter(w => w)
    let apps = null
    for (const word of words) {
      const res = await searchApps(word)
      if (res.data && res.data.length > 0) {
        apps = res.data
        break
      }
    }
    if (apps) {
      // 优先精确匹配：先归一化（去空格、去特殊符号）再比较
      const inputLower = t.toLowerCase().replace(/[\s_-]/g, '')
      const exactMatch = apps.find(a => {
        const nameNormalized = a.name.toLowerCase().replace(/[\s_-]/g, '')
        return nameNormalized === inputLower || nameNormalized.startsWith(inputLower) || inputLower.startsWith(nameNormalized)
      })
      if (exactMatch) {
        addMessage('assistant', `🚀 正在启动 **${exactMatch.name}**...`)
        await openApp(exactMatch.path)
        addMessage('assistant', `✅ 已启动 **${exactMatch.name}**`)
        return
      }
      if (apps.length === 1) {
        const app = apps[0]
        addMessage('assistant', `🚀 正在启动 **${app.name}**...`)
        await openApp(app.path)
        addMessage('assistant', `✅ 已启动 **${app.name}**`)
        return
      } else if (apps.length > 1) {
        const list = apps.slice(0, 10).map((a, i) => `${i + 1}. **${a.name}**`).join('\n')
        addMessage('assistant', `🔍 找到多个匹配的应用：\n\n${list}\n\n请输入更精确的名称。`)
        return
      }
    }
  } catch { /* 忽略搜索失败 */ }

  addMessage('assistant',
    `未找到与「**${t}**」匹配的项目。\n\n💡 **试试：**\n- 添加网址：\`百度 https://www.baidu.com\`\n- 添加文件：\`文档 D:\\报告.pdf\`\n- 启动应用：直接输入应用名（如 \`idea\` \`chrome\`）\n- 查看全部：\`/list\`\n- 帮助：\`帮助\``
  )
}

function showHelpMessage() {
  addMessage('assistant', `## 📖 Chat Portal 使用指南

### 🌐 网页书签
输入「**中文描述 URL**」保存，之后输入描述即可打开：
\`百度 https://www.baidu.com\`

### 📂 本地文件
支持 Windows 路径，自动按文件类型选择程序打开：

| 文件类型 | 打开方式 |
|----------|----------|
| \`.bat\` \`.cmd\` \`.ps1\` \`.sh\` | ▶ 直接执行/启动 |
| \`.pdf\` | 📕 Chrome 浏览器 |
| \`.html\` \`.htm\` | 🌐 Chrome 浏览器 |
| \`.txt\` \`.log\` | 📄 记事本 |
| \`.json\` \`.sql\` \`.js\` \`.ts\` \`.vue\` \`.java\` \`.py\` 等代码文件 | 📝 Notepad++（备选：记事本） |
| \`.png\` \`.jpg\` \`.gif\` 等图片 | 🖼 系统默认图片查看器 |
| \`.xlsx\` \`.docx\` \`.pptx\` 等办公文档 | 📊 系统关联程序 |
| \`.zip\` \`.rar\` 等压缩包 | 📦 系统关联程序 |
| \`.mp4\` \`.mp3\` 等音视频 | 🎬 系统关联程序 |
| 其他类型 | 系统默认程序 |
| **目录/文件夹** | 📁 资源管理器 |

例：\`D:\文档\report.pdf\` → Chrome 打开
例：\`D:\项目\config.json\` → Notepad++ 打开

也可保存为书签：
\`项目文档 D:\myapp\readme.md\`

### 🚀 启动应用
直接输入应用名称（无需事先添加），自动搜索 Windows 开始菜单中的应用并启动：
\`idea\` → IntelliJ IDEA
\`chrome\` → Google Chrome
\`notepad++\` → Notepad++

### ⚡ 快捷指令
| 指令 | 功能 |
|------|------|
| \`/list\` | 查看全部快捷入口 |
| \`/del 关键词\` | 删除指定书签 |
| \`/clear\` | 清空全部 |

### 💡 提示
- 书签卡片可直接点击打开
- 所有数据自动持久化到磁盘
`)
}

function showHelp() { showHelpMessage() }
function clearMessages() { messages.value = [] }

// ── AI 分类 ──

async function handleClassifyBookmarks() {
  if (bookmarks.value.length === 0) {
    ElMessage.warning('没有书签可供分类')
    return
  }
  classifying.value = true
  classifyResult.value = null
  try {
    const res = await aiClassifyBookmarks()
    if (res.code === 200 && res.data && res.data.categories) {
      classifyResult.value = res.data
      ElMessage.success(`AI 分类完成：${res.data.categories.length} 个类别`)
      addMessage('assistant', `🤖 AI 智能分类完成！\n\n共 ${res.data.categories.length} 个类别：\n${res.data.categories.map(c => `- **${c.name}** (${c.items.length} 项)`).join('\n')}`)
    } else {
      ElMessage.warning(res.message || '分类无结果')
      addMessage('assistant', `⚠️ AI 分类无结果：${res.message || '未知错误'}`)
    }
  } catch (err: any) {
    ElMessage.error('AI 分类失败: ' + (err.message || '未知错误'))
    addMessage('assistant', `❌ AI 分类失败：${err.message || '请检查 AI 服务是否启动'}`)
  } finally {
    classifying.value = false
  }
}

async function handleDelete(keyword: string) {
  const bm = bookmarks.value.find(b => b.keyword === keyword)
  if (bm && bm.id) {
    const ok = await bookmarkStore.remove(bm.id)
    if (ok) ElMessage.success(`已删除: ${keyword}`)
  } else {
    // 降级：按 keyword 删除
    const ok = await bookmarkStore.removeByKeyword(keyword)
    if (ok) ElMessage.success(`已删除: ${keyword}`)
  }
}

async function handleClearAll() {
  try {
    await ElMessageBox.confirm('确定要清空所有书签吗？', '确认', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' })
    await clearAll()
    ElMessage.success('已清空')
  } catch { /* */ }
}

// ── 分组管理 ──

async function handleCreateGroup() {
  const name = newGroupName.value.trim()
  if (!name) { ElMessage.warning('请输入分组名称'); return }
  const ok = await createGroup(name)
  if (ok) {
    ElMessage.success(`✅ 分组「${name}」已创建`)
    newGroupName.value = ''
    showGroupDialog.value = false
  } else {
    ElMessage.error('创建失败')
  }
}

async function handleDeleteGroup(id: number, name: string) {
  try {
    await ElMessageBox.confirm(`确定要删除分组「${name}」吗？`, '确认', { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' })
    const ok = await removeGroup(id)
    if (ok) {
      ElMessage.success(`已删除分组：${name}`)
      if (selectedGroupId.value === id) selectedGroupId.value = undefined
    }
  } catch {}
}

function selectGroup(id: number | undefined) {
  selectedGroupId.value = id
  loadBookmarks({ page: 1, pageSize: pageSize.value, group_id: id, tag: selectedTag.value })
}

function selectTag(tag: string | undefined) {
  selectedTag.value = tag
  loadBookmarks({ page: 1, pageSize: pageSize.value, group_id: selectedGroupId.value, tag })
}

// ── 导入导出 ──

function handleExportJSON() {
  exportBookmarks('json')
}

function handleExportCSV() {
  exportBookmarks('csv')
}

async function handleImport() {
  const text = importText.value.trim()
  if (!text) { ElMessage.warning('请粘贴导入数据'); return }
  try {
    let data: any
    if (importFormat.value === 'json') {
      data = JSON.parse(text)
      if (!Array.isArray(data)) data = [data]
    } else {
      // CSV 原文传给后端解析
      data = text
    }
    const res = await importBookmarks(data, importFormat.value)
    if (res.code === 200) {
      ElMessage.success(`✅ ${res.message}`)
      showImportDialog.value = false
      importText.value = ''
      await refreshFilters()
    } else {
      ElMessage.error(res.message || '导入失败')
    }
  } catch (e: any) {
    ElMessage.error('数据解析失败: ' + (e.message || '格式错误'))
  }
}

// ===== 知识库 =====

async function handleUploadKnowledge() {
  const title = knowledgeTitle.value.trim()
  const content = knowledgeContent.value.trim()
  if (!title) { ElMessage.warning('请输入文档标题'); return }
  if (!content) { ElMessage.warning('请粘贴文档内容'); return }
  knowledgeUploading.value = true
  try {
    const res = await uploadKnowledgeDoc(title, content)
    if (res.code === 200) {
      ElMessage.success(`✅ ${res.message}`)
      knowledgeTitle.value = ''
      knowledgeContent.value = ''
      await handleRefreshKnowledgeDocs()
    } else {
      ElMessage.error(res.message || '上传失败')
    }
  } catch (e: any) {
    ElMessage.error('上传失败: ' + (e.message || '未知错误'))
  } finally {
    knowledgeUploading.value = false
  }
}

async function handleRefreshKnowledgeDocs() {
  try {
    const res = await getKnowledgeDocs()
    if (res.code === 200 && res.data) {
      knowledgeDocs.value = res.data
    }
  } catch {}
}

async function handleDeleteKnowledgeDoc(id: string) {
  try {
    const res = await deleteKnowledgeDoc(id)
    if (res.code === 200) {
      ElMessage.success(`✅ ${res.message}`)
      await handleRefreshKnowledgeDocs()
    }
  } catch {}
}

async function handleKnowledgeQuery() {
  const question = knowledgeQuery.value.trim()
  if (!question) { ElMessage.warning('请输入问题'); return }
  knowledgeQuerying.value = true
  knowledgeQueryResult.value = null
  try {
    const res = await queryKnowledge(question)
    if (res.code === 200 && res.data) {
      knowledgeQueryResult.value = res.data
      if (res.data.answer) {
        addMessage('assistant', `🤖 **知识库回答**\n\n${res.data.answer}`)
      }
      if (res.data.chunks && res.data.chunks.length > 0) {
        addMessage('assistant', `📖 **参考文本** (${res.data.chunks.length} 条)\n\n${res.data.chunks.map((c, i) => `**#${i + 1}** ${c.text?.slice(0, 200)}...`).join('\n\n')}`)
      }
    } else {
      ElMessage.warning(res.message || '查询无结果')
    }
  } catch (e: any) {
    ElMessage.error('查询失败: ' + (e.message || '未知错误'))
  } finally {
    knowledgeQuerying.value = false
  }
}

// ===== 工作日志 =====

const WORKLOG_CATEGORIES = ['开发', '会议', '文档', '设计', '测试', '调研', '运维', '其他']

const showWorkLogDialog = ref(false)
const wlTitle = ref('')
const wlCategory = ref('开发')
const wlStartTime = ref('')
const wlEndTime = ref('')
const wlDescription = ref('')
const wlAdding = ref(false)
const wlAddResult = ref('')
const wlTodayLogs = ref<WorkLog[]>([])
const wlStats = ref<WorkLogStats | null>(null)
const wlStatsMode = ref<'day' | 'week' | 'month'>('day')
const wlStatsLoading = ref(false)

const wlDuration = computed(() => {
  if (!wlStartTime.value || !wlEndTime.value) return 0
  const [sh, sm] = (wlStartTime.value as string).split(':').map(Number)
  const [eh, em] = (wlEndTime.value as string).split(':').map(Number)
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0
  return Math.max(0, (eh * 60 + em) - (sh * 60 + sm))
})

function getCategoryTagType(category: string) {
  const map: Record<string, string> = {
    '开发': '',
    '会议': 'warning',
    '文档': 'info',
    '设计': 'success',
    '测试': 'danger',
    '调研': 'success',
    '运维': 'warning',
    '其他': 'info'
  }
  return map[category] || ''
}

async function handleWorkLogOpen() {
  wlTitle.value = ''
  wlCategory.value = '开发'
  wlStartTime.value = ''
  wlEndTime.value = ''
  wlDescription.value = ''
  wlAddResult.value = ''
  await Promise.all([handleRefreshWorkLogs(), handleLoadStats()])
}

async function handleAddWorkLog() {
  const title = wlTitle.value.trim()
  if (!title) { ElMessage.warning('请输入工作事项'); return }

  wlAdding.value = true
  wlAddResult.value = ''
  try {
    const today = new Date().toISOString().slice(0, 10)
    const res = await addWorkLog({
      date: today,
      title,
      category: wlCategory.value,
      startTime: (wlStartTime.value as string) || undefined,
      endTime: (wlEndTime.value as string) || undefined,
      description: wlDescription.value.trim() || undefined
    })
    if (res.code === 200) {
      wlAddResult.value = res.message || '已记录'
      wlTitle.value = ''
      wlDescription.value = ''
      wlStartTime.value = ''
      wlEndTime.value = ''
      await handleRefreshWorkLogs()
      await handleLoadStats()
      setTimeout(() => { wlAddResult.value = '' }, 3000)
    } else {
      ElMessage.warning(res.message || '添加失败')
    }
  } catch (e: any) {
    ElMessage.error('添加失败: ' + (e.message || '未知错误'))
  } finally {
    wlAdding.value = false
  }
}

async function handleRefreshWorkLogs() {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const res = await getWorkLogs({ date: today, pageSize: 100 })
    if (res.code === 200) {
      wlTodayLogs.value = res.data || []
    }
  } catch {}
}

async function handleDeleteWorkLog(id: string) {
  try {
    const res = await deleteWorkLog(id)
    if (res.code === 200) {
      ElMessage.success(`✅ ${res.message}`)
      await handleRefreshWorkLogs()
      await handleLoadStats()
    }
  } catch {}
}

async function handleLoadStats() {
  wlStatsLoading.value = true
  try {
    const res = await getWorkLogStats({ mode: wlStatsMode.value })
    if (res.code === 200 && res.data) {
      wlStats.value = res.data
    }
  } catch {
    wlStats.value = null
  } finally {
    wlStatsLoading.value = false
  }
}

// ===== 高阶能力 =====

const showAdvancedDialog = ref(false)
const advancedTab = ref('agents')

// --- Multi-Agent ---
const agents = ref<Agent[]>([])
const chattingAgent = ref('')
const agentInput = ref('')
const agentMessages = ref<{ role: string; content: string }[]>([])
const agentChatLoading = ref(false)
const agentChatRef = ref<HTMLElement | null>(null)
const collabTask = ref('')
const collabLoading = ref(false)
const collabResult = ref<CollaborateResult | null>(null)

// --- 记忆 ---
const memoryContent = ref('')
const memoryCategory = ref('general')
const memoryAdding = ref(false)
const memoryFacts = ref<MemoryFact[]>([])
const memoryInsights = ref<MemoryInsights | null>(null)
const userProfile = ref<UserProfile | null>(null)
const prefSaving = ref(false)
const preferredLanguage = ref('zh')
const preferredWorkMode = ref('dev')

// --- 主动助理 ---
const suggestions = ref<AssistantSuggestion[]>([])
const triggers = ref<AssistantTrigger[]>([])
const triggerName = ref('')
const triggerType = ref('manual')
const triggerAction = ref('')
const triggerSchedule = ref('')
const triggerAdding = ref(false)
const editingTrigger = ref<AssistantTrigger | null>(null)
const showTriggerEditDialog = ref(false)
const editTriggerName = ref('')
const editTriggerTime = ref('')
const editTriggerAction = ref('')

// --- 工作流 ---
const workflows = ref<Workflow[]>([])
const wfHistory = ref<WorkflowRunRecord[]>([])
const wfRunning = ref('')
const showWfCreateDialog = ref(false)
const wfCreateName = ref('')
const wfCreateDesc = ref('')
const wfCreateTriggerType = ref('manual')
const wfCreateCondition = ref('')
const wfCreateSteps = ref<{ type: string; label: string; config: Record<string, any> }[]>([
  { type: 'llm', label: 'AI 处理', config: { prompt: '' } }
])

// --- 通知中心 ---
const showNotifyPanel = ref(false)
const notifyList = ref<NotificationItem[]>([])
const unreadCount = ref(0)

// --- 钉钉 ---
const dtWebhookUrl = ref('')
const dtSecret = ref('')
const dtEnabled = ref(false)
const dtConfigured = ref(false)
const dtSaving = ref(false)

// --- Git ---
const gitRepoPath = ref('')
const gitSaving = ref(false)
const gitLoading = ref(false)
const gitOutput = ref('')

// --- 文件系统 ---
const fsAllowedDirs = ref<string[]>([])
const fsAllowedDir = ref('')
const fsBrowsePath = ref('')
const fsItems = ref<{ name: string; type: string; size: number; modified: string }[]>([])
const fsLoading = ref(false)

// --- 自主 Agent ---
const orchGoal = ref('')
const orchRunning = ref(false)
const orchSteps = ref<any[]>([])
const orchResult = ref<any>(null)
const orchTaskId = ref('')
let orchController: AbortController | null = null

// 插件系统状态
const pluginList = ref<PluginInfo[]>([])
const mcpServers = ref<McpServerInfo[]>([])
const mcpHealth = ref(false)
const mcpNewUrl = ref('')
const showPluginGenDialog = ref(false)
const pluginGenId = ref('')
const pluginGenName = ref('')
const pluginGenDesc = ref('')

// 多模态状态
const attachedImage = ref('')
const voiceListening = ref(false)
const imageInputRef = ref<HTMLInputElement | null>(null)
let recognition: any = null

// 仪表盘状态
const dashStats = ref<DashboardStats | null>(null)
const weeklyReport = ref<any>(null)
const reportLoading = ref(false)

// 桌面操控状态
const desktopScreenshotData = ref<string | null>(null)
const desktopElements = ref<any[]>([])
const desktopLoading = ref(false)
const desktopAnalyzing = ref(false)
const desktopAvailable = ref<boolean | null>(null)
const desktopPlatform = ref('')
const desktopClickX = ref('')
const desktopClickY = ref('')
const desktopTypeText = ref('')
const desktopHotkey = ref('')
const desktopConfirm = ref(false)
const desktopConfirmActions = ref<any[]>([])
const desktopConfirmReason = ref('')
const desktopHistoryList = ref<any[]>([])

// 登录状态
const showLogin = ref(false)
const authUser = ref<{ id: string; username: string; role: string } | null>(null)
const isLoggedIn = computed(() => !!authUser.value)
const isAdmin = computed(() => authUser.value?.role === 'admin')

async function handleLogin(data: { token: string; user: { id: string; username: string; role: string } }) {
  authUser.value = data.user
  showLogin.value = false
}

function handleGuestLogin() {
  showLogin.value = false
}

function handleLogout() {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('auth_user')
  authUser.value = null
  showLogin.value = true
  ElMessage.info('已退出登录')
}

async function handleAdvancedOpen() {
  await Promise.all([
    loadAgents(),
    loadMemoryFacts(),
    loadMemoryInsights(),
    loadUserProfile(),
    loadSuggestions(),
    loadTriggers(),
    loadWorkflows(),
    loadIntegrations(),
    loadPlugins(),
    loadDashboard()
  ])
}

async function loadAgents() {
  try {
    const res = await getAgents()
    if (res.code === 200) agents.value = res.data || []
  } catch {}
}

/** 将 Agent 回复的 Markdown 格式转为 HTML */
function formatAgentMsg(content: string): string {
  if (!content) return ''
  let html = content
  // 代码块: ```lang\n...\n```
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, lang, code) => {
    const escaped = code.replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return `<pre class="agent-code-block"><code class="lang-${lang}">${escaped}</code></pre>`
  })
  // 行内代码: `...`
  html = html.replace(/`([^`]+)`/g, '<code class="agent-inline-code">$1</code>')
  // 加粗: **...**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  // 标题行: 📌/💡 等开头的行加粗
  html = html.replace(/^(📌|💡|⚠️|✅|🔑)(.+)$/gm, '<div class="agent-tip-line">$1<strong>$2</strong></div>')
  // 有序列表: 1. 2. 3.
  html = html.replace(/^(\d+)\.\s(.+)$/gm, '<div class="agent-list-item"><span class="agent-list-num">$1.</span> $2</div>')
  // 无序列表: • 
  html = html.replace(/^\s*•\s(.+)$/gm, '<div class="agent-list-item">• $1</div>')
  // 换行
  html = html.replace(/\n/g, '<br>')
  // 清理连续 br 在 pre 内部的影响
  html = html.replace(/<pre class="agent-code-block"><code([^>]*)>([\s\S]*?)<\/code><\/pre>/g, (m) => {
    return m.replace(/<br>/g, '\n')
  })
  return html
}

async function handleAgentChat() {
  const msg = agentInput.value.trim()
  if (!msg || !chattingAgent.value) return
  agentInput.value = ''
  agentMessages.value.push({ role: 'user', content: msg })
  agentChatLoading.value = true
  try {
    const res = await agentChat(chattingAgent.value, msg)
    if (res.code === 200 && res.data) {
      agentMessages.value.push({ role: 'assistant', content: res.data.reply })
    } else {
      agentMessages.value.push({ role: 'assistant', content: '(AI 暂不可用)' })
    }
  } catch {
    agentMessages.value.push({ role: 'assistant', content: '(请求失败)' })
  } finally {
    agentChatLoading.value = false
    nextTick(() => {
      if (agentChatRef.value) {
        agentChatRef.value.scrollTop = agentChatRef.value.scrollHeight
      }
    })
  }
}

async function handleAgentCollaborate() {
  const task = collabTask.value.trim()
  if (!task) { ElMessage.warning('请输入任务'); return }
  collabLoading.value = true
  collabResult.value = null
  try {
    const res = await agentCollaborate(task)
    if (res.code === 200 && res.data) {
      collabResult.value = res.data
    }
  } catch {
    ElMessage.error('协作请求失败')
  } finally {
    collabLoading.value = false
  }
}

async function loadMemoryFacts() {
  try {
    const res = await getMemoryFacts()
    if (res.code === 200) memoryFacts.value = res.data || []
  } catch {}
}

async function loadMemoryInsights() {
  try {
    const res = await getMemoryInsights()
    if (res.code === 200) memoryInsights.value = res.data
    const prefRes = await getMemoryPreferences()
    if (prefRes.code === 200 && prefRes.data) {
      preferredLanguage.value = prefRes.data.language || 'zh'
      preferredWorkMode.value = prefRes.data.workMode || 'dev'
    }
  } catch {}
}

async function loadUserProfile() {
  try {
    const res = await getMemoryProfile()
    if (res.code === 200) userProfile.value = res.data
  } catch {}
}

async function handleAddMemory() {
  const content = memoryContent.value.trim()
  if (!content) { ElMessage.warning('请输入要记住的内容'); return }
  memoryAdding.value = true
  try {
    const res = await addMemoryFact({ content, category: memoryCategory.value })
    if (res.code === 200) {
      ElMessage.success(`✅ ${res.message}`)
      memoryContent.value = ''
      await loadMemoryFacts()
      await loadMemoryInsights()
    }
  } catch {
    ElMessage.error('添加失败')
  } finally {
    memoryAdding.value = false
  }
}

async function handleDeleteMemory(id: string) {
  try {
    const res = await deleteMemoryFact(id)
    if (res.code === 200) {
      ElMessage.success(`✅ ${res.message}`)
      await loadMemoryFacts()
      await loadMemoryInsights()
    }
  } catch {}
}

async function handleSavePreferences() {
  prefSaving.value = true
  try {
    const res = await updateMemoryPreferences({
      language: preferredLanguage.value,
      workMode: preferredWorkMode.value
    })
    if (res.code === 200) {
      ElMessage.success('✅ 偏好已保存')
    }
  } catch {
    ElMessage.error('保存失败')
  } finally {
    prefSaving.value = false
  }
}

async function loadSuggestions() {
  try {
    const res = await getAssistantSuggestions()
    if (res.code === 200) suggestions.value = res.data || []
  } catch {}
}

async function loadTriggers() {
  try {
    const res = await getAssistantTriggers()
    if (res.code === 200) triggers.value = res.data || []
  } catch {}
}

async function handleAddTrigger() {
  const name = triggerName.value.trim()
  if (!name) { ElMessage.warning('请输入触发器名称'); return }
  if (triggerType.value === 'scheduled' && !triggerSchedule.value) {
    ElMessage.warning('定时触发器请设置提醒时间'); return
  }
  triggerAdding.value = true
  try {
    const res = await addAssistantTrigger({
      type: triggerType.value,
      name,
      action: triggerAction.value.trim() || '提醒查看工作日志',
      schedule: triggerType.value === 'scheduled' ? (triggerSchedule.value as string) : undefined,
      enabled: true
    })
    if (res.code === 200) {
      ElMessage.success(`✅ ${res.message}`)
      triggerName.value = ''
      triggerAction.value = ''
      triggerSchedule.value = ''
      await loadTriggers()
    }
  } catch {
    ElMessage.error('添加失败')
  } finally {
    triggerAdding.value = false
  }
}

async function handleEditTrigger(t: AssistantTrigger) {
  editingTrigger.value = t
  editTriggerName.value = t.name
  editTriggerTime.value = t.schedule || ''
  editTriggerAction.value = t.action
  showTriggerEditDialog.value = true
}

async function handleSaveTriggerEdit() {
  if (!editingTrigger.value) return
  const name = editTriggerName.value.trim()
  if (!name) { ElMessage.warning('请输入触发器名称'); return }
  try {
    const res = await updateAssistantTrigger(editingTrigger.value.id, {
      name,
      action: editTriggerAction.value.trim() || '提醒查看工作日志',
      schedule: editTriggerTime.value || null
    })
    if (res.code === 200) {
      ElMessage.success(`✅ ${res.message}`)
      showTriggerEditDialog.value = false
      editingTrigger.value = null
      await loadTriggers()
    }
  } catch {
    ElMessage.error('保存失败')
  }
}

async function handleToggleTrigger(t: AssistantTrigger) {
  try {
    await updateAssistantTrigger(t.id, { enabled: t.enabled })
  } catch {}
}

async function handleDeleteTrigger(id: string) {
  try {
    const res = await deleteAssistantTrigger(id)
    if (res.code === 200) {
      ElMessage.success(`✅ ${res.message}`)
      await loadTriggers()
    }
  } catch {}
}

// ===== 建议一键操作 =====

const quickLogContent = ref('')
const quickLogCategory = ref('开发')
const quickLogging = ref(false)
const autoClassifying = ref(false)
const autoSummarizing = ref(false)
const summaryResult = ref('')

async function handleQuickLog() {
  const content = quickLogContent.value.trim()
  if (!content) { ElMessage.warning('请输入工作内容'); return }
  quickLogging.value = true
  try {
    const res = await addWorkLog({ content, category: quickLogCategory.value } as any)
    if (res.code === 200) {
      ElMessage.success('✅ 已记录工作')
      quickLogContent.value = ''
      await loadSuggestions()
    }
  } catch {
    ElMessage.error('记录失败')
  } finally {
    quickLogging.value = false
  }
}

async function handleAutoClassify() {
  autoClassifying.value = true
  try {
    const res = await aiClassifyBookmarks()
    if (res.code === 200) {
      ElMessage.success('✅ 分类完成，请刷新页面查看')
      await loadSuggestions()
    } else {
      ElMessage.error(res.message || '分类失败')
    }
  } catch {
    ElMessage.error('分类请求失败')
  } finally {
    autoClassifying.value = false
  }
}

async function handleAutoSummary() {
  autoSummarizing.value = true
  try {
    const res = await autoSummary()
    if (res.code === 200) {
      summaryResult.value = res.data.summary
      ElMessage.success('✅ 工作小结已生成')
      await loadSuggestions()
    }
  } catch {
    ElMessage.error('生成失败')
  } finally {
    autoSummarizing.value = false
  }
}

async function handleExecTrigger(s: AssistantSuggestion) {
  ElMessage.info(`执行触发器: ${s.title}`)
}

// ===== 工作流操作 =====

async function loadWorkflows() {
  try {
    const [wfRes, histRes] = await Promise.all([getWorkflows(), getWorkflowHistory(10)])
    if (wfRes.code === 200) workflows.value = wfRes.data || []
    if (histRes.code === 200) wfHistory.value = histRes.data || []
  } catch {}
}

async function handleRunWorkflow(wf: Workflow) {
  wfRunning.value = wf.id
  try {
    let input = ''
    // 如果工作流有 input 步骤，弹窗让用户输入
    const hasInput = wf.steps.some(s => s.type === 'input')
    if (hasInput) {
      const { value } = await ElMessageBox.prompt('请输入工作流需要的内容（如代码、文本等）', `运行: ${wf.name}`, {
        confirmButtonText: '执行',
        cancelButtonText: '取消',
        inputType: 'textarea',
        inputPlaceholder: '粘贴内容...'
      }).catch(() => ({ value: null }))
      if (!value) { wfRunning.value = ''; return }
      input = value
    }
    const res = await runWorkflow(wf.id, input)
    if (res.code === 200) {
      ElMessage.success(res.message || '✅ 执行完成')
      await loadWorkflows()
    } else {
      ElMessage.error(res.message || '执行失败')
    }
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error('执行失败: ' + (e.message || e))
  } finally {
    wfRunning.value = ''
  }
}

async function handleToggleWorkflow(wf: Workflow) {
  try {
    await updateWorkflow(wf.id, { enabled: wf.enabled })
    ElMessage.success(wf.enabled ? '✅ 已启用' : '已停用')
  } catch {}
}

async function handleDeleteWorkflow(id: string) {
  try {
    await ElMessageBox.confirm('确定删除该工作流？', '删除确认', { type: 'warning' })
    const res = await deleteWorkflow(id)
    if (res.code === 200) {
      ElMessage.success('✅ 已删除')
      await loadWorkflows()
    }
  } catch {}
}

function addWfStep() {
  wfCreateSteps.value.push({ type: 'llm', label: '', config: { prompt: '' } })
}

function removeWfStep(idx: number) {
  wfCreateSteps.value.splice(idx, 1)
}

async function handleCreateWorkflow() {
  const name = wfCreateName.value.trim()
  if (!name) { ElMessage.warning('请输入工作流名称'); return }
  if (wfCreateSteps.value.length === 0) { ElMessage.warning('至少添加一个步骤'); return }
  try {
    const trigger: any = { type: wfCreateTriggerType.value }
    if (wfCreateTriggerType.value === 'condition' && wfCreateCondition.value.trim()) {
      trigger.condition = wfCreateCondition.value.trim()
    }
    const steps = wfCreateSteps.value.map(s => ({
      type: s.type as any,
      label: s.label || s.type,
      config: s.config
    }))
    const res = await createWorkflow({ name, description: wfCreateDesc.value.trim(), steps: steps as any, trigger })
    if (res.code === 200) {
      ElMessage.success('✅ 工作流已创建')
      showWfCreateDialog.value = false
      wfCreateName.value = ''
      wfCreateDesc.value = ''
      wfCreateTriggerType.value = 'manual'
      wfCreateCondition.value = ''
      wfCreateSteps.value = [{ type: 'llm', label: 'AI 处理', config: { prompt: '' } }]
      await loadWorkflows()
    }
  } catch {
    ElMessage.error('创建失败')
  }
}

// ===== 通知中心 =====

async function loadNotifications() {
  try {
    const res = await getNotifications(false, 30)
    if (res.code === 200) {
      notifyList.value = res.data || []
      unreadCount.value = res.unread || 0
    }
  } catch {}
}

async function handleReadNotify(n: NotificationItem) {
  if (!n.read) {
    await markNotificationRead(n.id)
    n.read = true
    unreadCount.value = Math.max(0, unreadCount.value - 1)
  }
}

async function handleMarkAllRead() {
  await markNotificationRead(undefined, true)
  notifyList.value.forEach(n => n.read = true)
  unreadCount.value = 0
}

async function handleDeleteNotify(id: string) {
  await deleteNotification(id)
  notifyList.value = notifyList.value.filter(n => n.id !== id)
}

async function handleClearNotifications() {
  await clearNotifications()
  notifyList.value = []
  unreadCount.value = 0
}

// ===== 集成配置 =====

async function loadIntegrations() {
  try {
    const [dtRes, gitRes, fsRes] = await Promise.all([getDingtalkConfig(), getGitConfig(), getFsConfig()])
    if (dtRes.code === 200) {
      dtWebhookUrl.value = dtRes.data.webhookUrl || ''
      dtSecret.value = dtRes.data.secret || ''
      dtEnabled.value = dtRes.data.enabled || false
      dtConfigured.value = dtRes.data.configured || false
    }
    if (gitRes.code === 200) gitRepoPath.value = gitRes.data.repoPath || ''
    if (fsRes.code === 200) fsAllowedDirs.value = fsRes.data.allowedDirs || []
  } catch {}
}

async function handleSaveDtConfig() {
  dtSaving.value = true
  try {
    const res = await saveDingtalkConfig({ webhookUrl: dtWebhookUrl.value, secret: dtSecret.value, enabled: dtEnabled.value })
    if (res.code === 200) {
      ElMessage.success('✅ ' + res.message)
      dtConfigured.value = !!dtWebhookUrl.value
    }
  } catch { ElMessage.error('保存失败') }
  finally { dtSaving.value = false }
}

async function handleTestDtSend() {
  try {
    const res = await sendDingtalkMessage({ message: '✅ Chat Portal 钉钉集成测试成功！', title: '测试消息' })
    ElMessage[res.code === 200 ? 'success' : 'error'](res.message)
  } catch { ElMessage.error('发送失败') }
}

async function handleSaveGitConfig() {
  gitSaving.value = true
  try {
    const res = await saveGitConfig({ repoPath: gitRepoPath.value })
    ElMessage[res.code === 200 ? 'success' : 'error'](res.message)
  } catch { ElMessage.error('保存失败') }
  finally { gitSaving.value = false }
}

async function handleGitExec(action: string) {
  gitLoading.value = true
  gitOutput.value = ''
  try {
    const res = await gitExec(action)
    if (res.code === 200 && res.data) gitOutput.value = res.data.output
    else ElMessage.error(res.message || '执行失败')
  } catch { ElMessage.error('Git 操作失败') }
  finally { gitLoading.value = false }
}

async function handleGitDiffSummary() {
  gitLoading.value = true
  gitOutput.value = ''
  try {
    const res = await gitDiffSummary()
    if (res.code === 200 && res.data) gitOutput.value = res.data.summary
    else ElMessage.error('分析失败')
  } catch { ElMessage.error('AI 摘要失败') }
  finally { gitLoading.value = false }
}

async function handleAddFsDir() {
  const dir = fsAllowedDir.value.trim()
  if (!dir) return
  if (!fsAllowedDirs.value.includes(dir)) fsAllowedDirs.value.push(dir)
  fsAllowedDir.value = ''
  await saveFsConfig({ allowedDirs: fsAllowedDirs.value })
  ElMessage.success('✅ 已添加允许目录')
}

async function handleRemoveFsDir(dir: string) {
  fsAllowedDirs.value = fsAllowedDirs.value.filter(d => d !== dir)
  await saveFsConfig({ allowedDirs: fsAllowedDirs.value })
}

async function handleFsBrowse() {
  const dir = fsBrowsePath.value.trim()
  if (!dir) { ElMessage.warning('请输入目录路径'); return }
  fsLoading.value = true
  try {
    const res = await fsListDir(dir)
    if (res.code === 200 && res.data) fsItems.value = res.data.items || []
    else { ElMessage.error(res.message || '无法访问'); fsItems.value = [] }
  } catch { ElMessage.error('浏览失败'); fsItems.value = [] }
  finally { fsLoading.value = false }
}

// ===== 自主 Agent Orchestrator =====

function handleRunOrchestrator() {
  const goal = orchGoal.value.trim()
  if (!goal || orchRunning.value) return
  orchRunning.value = true
  orchSteps.value = []
  orchResult.value = null

  orchController = runOrchestratorStream(goal, (event) => {
    if (event.type === 'start') {
      orchTaskId.value = event.taskId || ''
    } else if (event.type === 'thought') {
      orchSteps.value.push({ type: 'thought', round: event.round, thought: event.thought })
    } else if (event.type === 'action') {
      orchSteps.value.push({ type: 'action', round: event.round, tool: event.tool, params: event.params })
    } else if (event.type === 'observation') {
      orchSteps.value.push({ type: 'observation', round: event.round, tool: event.tool, observation: event.observation })
    } else if (event.type === 'done') {
      orchSteps.value.push({ type: 'done', round: event.round, summary: event.summary })
    } else if (event.type === 'error') {
      orchSteps.value.push({ type: 'error', round: event.round, error: event.error })
    } else if (event.type === 'final') {
      orchResult.value = event
      orchRunning.value = false
    } else if (event.type === 'complete') {
      orchResult.value = event
      orchRunning.value = false
    } else if (event.type === 'cancelled') {
      orchRunning.value = false
      ElMessage.info('任务已取消')
    }
  })
}

async function handleCancelOrchestrator() {
  if (orchController) orchController.abort()
  if (orchTaskId.value) await cancelOrchestratorTask(orchTaskId.value)
  orchRunning.value = false
  ElMessage.info('已取消执行')
}

// ==================== 插件系统 ====================
async function loadPlugins() {
  try {
    const [pRes, mRes, hRes] = await Promise.all([
      getPlugins(),
      getMcpServers(),
      getMcpHealth()
    ])
    if (pRes.code === 200) pluginList.value = pRes.data || []
    if (mRes.code === 200) mcpServers.value = mRes.data || []
    mcpHealth.value = hRes.code === 200
  } catch {}
}

async function handleTogglePlugin(id: string, val: any) {
  const fn = val ? enablePlugin : disablePlugin
  const res = await fn(id)
  ElMessage[res.code === 200 ? 'success' : 'error'](res.message)
}

async function handleReloadPlugin(id: string) {
  const res = await reloadPlugin(id)
  ElMessage[res.code === 200 ? 'success' : 'error'](res.message)
  if (res.code === 200) await loadPlugins()
}

async function handleTestPlugin(p: PluginInfo) {
  if (!p.tools.length) { ElMessage.warning('该插件没有可执行工具'); return }
  const tool = p.tools[0]
  try {
    const res = await executePluginTool(p.id, tool, { city: '北京', input: 'test', text: 'hello', task: '测试', content: 'test', title: 'test', code: 'console.log(1)', keyword: 'test' })
    if (res.code === 200) {
      ElMessage.success('✅ 插件测试成功: ' + JSON.stringify(res.data).slice(0, 100))
    } else {
      ElMessage.error(res.message || '执行失败')
    }
  } catch (e: any) {
    ElMessage.error('插件执行异常: ' + e.message)
  }
}

async function handleAddMcp() {
  if (!mcpNewUrl.value.trim()) { ElMessage.warning('请输入 URL'); return }
  const res = await addMcpServer({ name: mcpNewUrl.value.replace(/https?:\/\//, '').split('/')[0], url: mcpNewUrl.value.trim() })
  ElMessage[res.code === 200 ? 'success' : 'error'](res.message)
  if (res.code === 200) { mcpNewUrl.value = ''; await loadPlugins() }
}

async function handleConnectMcp(id: string) {
  const res = await connectMcpServer(id)
  ElMessage[res.code === 200 ? 'success' : 'error'](res.message)
  if (res.code === 200) await loadPlugins()
}

async function handleRemoveMcp(id: string) {
  const res = await removeMcpServer(id)
  ElMessage[res.code === 200 ? 'success' : 'error'](res.message)
  if (res.code === 200) await loadPlugins()
}

async function handleGeneratePlugin() {
  if (!pluginGenId.value.trim()) { ElMessage.warning('请输入插件 ID'); return }
  const res = await generatePluginTemplate(pluginGenId.value.trim(), pluginGenName.value.trim(), pluginGenDesc.value.trim())
  ElMessage[res.code === 200 ? 'success' : 'error'](res.message)
  if (res.code === 200) {
    showPluginGenDialog.value = false
    pluginGenId.value = ''; pluginGenName.value = ''; pluginGenDesc.value = ''
    await loadPlugins()
  }
}

// ==================== 多模态交互 ====================
function triggerImageUpload() {
  imageInputRef.value?.click()
}

function handleImageSelect(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) { ElMessage.warning('请选择图片文件'); return }
  if (file.size > 5 * 1024 * 1024) { ElMessage.warning('图片不能超过 5MB'); return }
  const reader = new FileReader()
  reader.onload = () => {
    const base64 = (reader.result as string).split(',')[1]
    attachedImage.value = base64
    ElMessage.success('图片已附加，发送时将自动分析')
  }
  reader.readAsDataURL(file)
  ;(e.target as HTMLInputElement).value = ''
}

function toggleVoiceInput() {
  if (voiceListening.value) {
    recognition?.stop()
    voiceListening.value = false
    return
  }
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (!SpeechRecognition) {
    ElMessage.warning('当前浏览器不支持语音识别，请使用 Chrome')
    return
  }
  recognition = new SpeechRecognition()
  recognition.lang = 'zh-CN'
  recognition.continuous = false
  recognition.interimResults = true
  recognition.onresult = (event: any) => {
    const transcript = Array.from(event.results).map((r: any) => r[0].transcript).join('')
    inputText.value = transcript
  }
  recognition.onend = () => { voiceListening.value = false }
  recognition.onerror = () => { voiceListening.value = false; ElMessage.error('语音识别失败') }
  recognition.start()
  voiceListening.value = true
  ElMessage.info('🎤 请说话...')
}

async function handleAnalyzeAttachedImage() {
  if (!attachedImage.value) return
  const prompt = inputText.value.trim() || '请分析这张图片'
  messages.value.push({ role: 'user', content: `🖼️ [图片分析] ${prompt}` } as any)
  const img = attachedImage.value
  attachedImage.value = ''
  inputText.value = ''
  loading.value = true
  try {
    const res = await analyzeImage(img, prompt)
    if (res.code === 200 && res.data) {
      messages.value.push({ role: 'assistant', content: res.data.analysis } as any)
    } else {
      messages.value.push({ role: 'assistant', content: '图片分析失败' } as any)
    }
  } catch {
    messages.value.push({ role: 'assistant', content: '图片分析请求失败' } as any)
  } finally {
    loading.value = false
  }
}

// ==================== 仪表盘 ====================
async function loadDashboard() {
  try {
    const res = await getDashboardStats()
    if (res.code === 200) dashStats.value = res.data
  } catch {}
}

async function handleGenReport() {
  reportLoading.value = true
  try {
    const res = await generateWeeklyReport()
    if (res.code === 200 && res.data) {
      weeklyReport.value = res.data
      ElMessage.success('✅ 周报已生成')
    } else {
      ElMessage.error('生成失败')
    }
  } catch {
    ElMessage.error('周报生成失败')
  } finally {
    reportLoading.value = false
  }
}

// ==================== 桌面操控 ====================
async function handleDesktopScreenshot() {
  desktopLoading.value = true
  try {
    const res = await desktopScreenshot('fullscreen')
    if (res.code === 200 && res.data?.success) {
      desktopScreenshotData.value = res.data.image || null
      desktopElements.value = []
      ElMessage.success('📸 截屏成功')
    } else {
      ElMessage.error(res.data?.error || '截屏失败')
    }
  } catch (e: any) {
    ElMessage.error('截屏失败: ' + (e.message || ''))
  } finally {
    desktopLoading.value = false
  }
}

async function handleDesktopAnalyze() {
  if (!desktopScreenshotData.value) return
  desktopAnalyzing.value = true
  try {
    const res = await desktopAnalyzeUI(desktopScreenshotData.value, '识别所有可交互的 UI 元素')
    if (res.code === 200 && res.data?.success) {
      desktopElements.value = res.data.elements || []
      ElMessage.success('🔍 识别到 ' + desktopElements.value.length + ' 个元素')
    } else {
      ElMessage.error('分析失败')
    }
  } catch (e: any) {
    ElMessage.error('分析失败: ' + (e.message || ''))
  } finally {
    desktopAnalyzing.value = false
  }
}

async function handleDesktopCommand(type: string) {
  const actions: any[] = []
  if (type === 'click') {
    const x = parseInt(desktopClickX.value)
    const y = parseInt(desktopClickY.value)
    if (isNaN(x) || isNaN(y)) { ElMessage.warning('请输入有效的坐标'); return }
    actions.push({ type: 'click', x, y })
  } else if (type === 'doubleClick') {
    const x = parseInt(desktopClickX.value)
    const y = parseInt(desktopClickY.value)
    if (isNaN(x) || isNaN(y)) { ElMessage.warning('请输入有效的坐标'); return }
    actions.push({ type: 'doubleClick', x, y })
  } else if (type === 'type') {
    if (!desktopTypeText.value.trim()) { ElMessage.warning('请输入文字'); return }
    actions.push({ type: 'type', text: desktopTypeText.value })
  } else if (type === 'hotkey') {
    if (!desktopHotkey.value) { ElMessage.warning('请选择快捷键'); return }
    const keys = desktopHotkey.value.split('+')
    actions.push({ type: 'hotkey', keys })
  }
  try {
    const res = await desktopExecute(actions)
    if (res.code === 200 && res.data?.success) {
      ElMessage.success('✅ 操作执行成功')
      loadDesktopHistory()
      setTimeout(() => handleDesktopScreenshot(), 500)
    } else if (res.needConfirm) {
      desktopConfirmActions.value = actions
      desktopConfirmReason.value = res.message || '检测到潜在危险操作'
      desktopConfirm.value = true
    } else {
      ElMessage.error(res.message || '执行失败')
    }
  } catch (e: any) {
    ElMessage.error('执行失败: ' + (e.message || ''))
  }
}

async function handleDesktopConfirm(confirmed: boolean) {
  desktopConfirm.value = false
  if (!confirmed) {
    ElMessage.info('操作已取消')
    return
  }
  try {
    const res = await desktopExecute(desktopConfirmActions.value, true)
    if (res.code === 200 && res.data?.success) {
      ElMessage.success('✅ 操作执行成功')
      loadDesktopHistory()
      setTimeout(() => handleDesktopScreenshot(), 500)
    } else {
      ElMessage.error(res.message || '执行失败')
    }
  } catch (e: any) {
    ElMessage.error('执行失败: ' + (e.message || ''))
  }
}

async function loadDesktopHistory() {
  try {
    const res = await desktopHistory(20)
    if (res.code === 200) desktopHistoryList.value = res.data || []
  } catch {}
}

async function handleDesktopRefresh() {
  try {
    const res = await desktopStatus()
    if (res.code === 200) {
      desktopAvailable.value = res.data.available
      desktopPlatform.value = res.data.platform
    }
  } catch {}
  await loadDesktopHistory()
}
</script>

<style scoped>
/* ===== 全局 ===== */
.app-root {
  height: 100vh; width: 100vw;
  display: flex; flex-direction: column;
  background: #0f172a;
  color: #e2e8f0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif;
  overflow: hidden;
  position: relative;
}

/* ===== 背景装饰 ===== */
.bg-decoration {
  position: fixed; inset: 0; pointer-events: none; z-index: 0;
  overflow: hidden;
}
.bg-orb {
  position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.15;
}
.bg-orb-1 {
  width: 500px; height: 500px;
  background: radial-gradient(circle, #4fc3f7, transparent);
  top: -150px; right: -100px; animation: orbFloat 20s ease-in-out infinite;
}
.bg-orb-2 {
  width: 400px; height: 400px;
  background: radial-gradient(circle, #7c4dff, transparent);
  bottom: -100px; left: -80px; animation: orbFloat 25s ease-in-out infinite reverse;
}
.bg-orb-3 {
  width: 300px; height: 300px;
  background: radial-gradient(circle, #00e5ff, transparent);
  top: 50%; left: 50%; transform: translate(-50%, -50%);
  animation: orbFloat 30s ease-in-out infinite 5s;
}
@keyframes orbFloat {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -30px) scale(1.1); }
  66% { transform: translate(-20px, 20px) scale(0.9); }
}

/* ===== 顶部导航 ===== */
.topbar {
  flex-shrink: 0; z-index: 10;
  background: rgba(15, 23, 42, 0.8);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.topbar-inner {
  max-width: 900px; margin: 0 auto; padding: 0 24px;
  height: 60px; display: flex; align-items: center; justify-content: space-between;
}
.topbar-left { display: flex; align-items: center; }
.app-logo { display: flex; align-items: center; gap: 10px; }
.logo-icon-wrap {
  width: 36px; height: 36px; border-radius: 10px;
  background: linear-gradient(135deg, #4fc3f7, #7c4dff);
  display: flex; align-items: center; justify-content: center;
  color: #fff; box-shadow: 0 4px 12px rgba(79,195,247,0.3);
}
.logo-text-group { display: flex; flex-direction: column; }
.logo-title { font-size: 16px; font-weight: 700; color: #f1f5f9; letter-spacing: 0.3px; }
.logo-sub { font-size: 10px; color: #64748b; letter-spacing: 0.5px; }
.stats-chip {
  display: flex; align-items: center; gap: 4px;
  padding: 4px 14px; border-radius: 20px;
  background: rgba(79,195,247,0.1); border: 1px solid rgba(79,195,247,0.2);
  font-size: 12px; color: #4fc3f7;
}
.topbar-right { display: flex; gap: 2px; }
.topbar-btn { color: #64748b; font-size: 18px; }
.topbar-btn:hover { color: #4fc3f7; background: rgba(79,195,247,0.1); }

/* ===== 主内容 ===== */
.main-area {
  flex: 1; overflow-y: auto; overflow-x: hidden; z-index: 1;
  scroll-behavior: smooth;
}
.main-area::-webkit-scrollbar { width: 5px; }
.main-area::-webkit-scrollbar-track { background: transparent; }
.main-area::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }

.content-column {
  max-width: 720px; margin: 0 auto;
  padding: 28px 20px 32px;
  display: flex; flex-direction: column; gap: 20px;
}

/* ===== Glass 卡片 ===== */
.glass-card {
  background: rgba(30, 41, 59, 0.6);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.2);
}

/* ===== 输入区域 ===== */
.input-section { flex-shrink: 0; }
.input-card { padding: 18px 22px 14px; }
.input-label {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; font-weight: 500; color: #94a3b8; margin-bottom: 12px;
}
.label-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #4fc3f7; box-shadow: 0 0 8px rgba(79,195,247,0.5);
}
.input-row { display: flex; gap: 10px; }
.input-wrap {
  flex: 1; display: flex; align-items: center;
  gap: 8px; padding: 0 12px;
  background: rgba(15,23,42,0.6);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  transition: all 0.25s ease;
}
.input-wrap:focus-within {
  border-color: rgba(79,195,247,0.5);
  box-shadow: 0 0 0 3px rgba(79,195,247,0.1);
}
.input-prefix { color: #475569; font-size: 16px; flex-shrink: 0; }
.input-field {
  flex: 1; border: none; outline: none; background: transparent;
  font-size: 14px; color: #e2e8f0; padding: 11px 0;
  font-family: inherit;
}
.input-field::placeholder { color: #475569; }
.input-clear { color: #475569; flex-shrink: 0; }
.send-btn {
  border-radius: 12px; padding: 0 18px; height: 42px;
  background: linear-gradient(135deg, #4fc3f7, #7c4dff);
  border: none; font-weight: 600; letter-spacing: 0.3px;
  display: flex; align-items: center; gap: 4px;
}
.send-btn:hover { background: linear-gradient(135deg, #29b6f6, #651fff); box-shadow: 0 4px 16px rgba(79,195,247,0.3); }
.send-btn.is-disabled { background: rgba(255,255,255,0.05); }

.input-chips {
  display: flex; align-items: center; gap: 6px;
  margin-top: 10px; flex-wrap: wrap;
}
.chip-label { font-size: 11px; color: #475569; }
.chip {
  font-size: 11px; padding: 2px 10px; border-radius: 8px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  color: #64748b; cursor: pointer; transition: all 0.2s;
}
.chip:hover { background: rgba(79,195,247,0.1); border-color: rgba(79,195,247,0.2); color: #4fc3f7; }

/* ===== 书签卡片区域 ===== */
.bookmarks-section {
  background: rgba(30,41,59,0.4);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 16px;
  padding: 18px 20px 20px;
  backdrop-filter: blur(8px);
}
.section-bar {
  display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; gap: 10px;
}
.section-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 14px; font-weight: 600; margin: 0; color: #e2e8f0;
}
.section-count {
  background: rgba(255,255,255,0.06); padding: 0 8px; border-radius: 8px;
  font-size: 11px; color: #64748b; margin-left: 2px;
}
.section-tools { display: flex; align-items: center; gap: 6px; }
.search-box {
  display: flex; align-items: center; gap: 4px;
  padding: 0 8px; border-radius: 8px;
  background: rgba(15,23,42,0.5); border: 1px solid rgba(255,255,255,0.06);
  color: #64748b; width: 140px;
}
.search-box:focus-within { border-color: rgba(79,195,247,0.3); }
.search-input { flex: 1; border: none; outline: none; background: transparent; padding: 5px 0; font-size: 12px; color: #e2e8f0; font-family: inherit; }
.search-input::placeholder { color: #475569; }
.search-clear { color: #475569; }
.tool-btn { color: #64748b; }
.tool-btn.danger:hover { color: #ef5350; background: rgba(239,83,80,0.1); }
.tool-btn.ai-classify { color: #a78bfa; }
.tool-btn.ai-classify:hover { color: #8b5cf6; background: rgba(139,92,246,0.1); }

/* AI 分类结果 */
.classify-result {
  margin-top: 14px;
  border-top: 1px solid rgba(255,255,255,0.06);
  padding-top: 14px;
}
.classify-header {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; font-weight: 600; color: #a78bfa;
  margin-bottom: 12px;
}
.classify-close { margin-left: auto; color: #64748b; }
.classify-close:hover { color: #ef5350; }
.classify-groups {
  display: flex; flex-direction: column; gap: 10px;
}
.classify-group {
  background: rgba(15,23,42,0.4);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px;
  padding: 12px 14px;
}
.classify-group-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px;
}
.classify-group-name {
  font-size: 13px; font-weight: 600; color: #a78bfa;
}
.classify-group-count {
  font-size: 10px; color: #64748b;
  background: rgba(255,255,255,0.04);
  padding: 1px 8px;
  border-radius: 6px;
}
.classify-items {
  display: flex; flex-direction: column; gap: 4px;
}
.classify-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 10px;
  background: rgba(255,255,255,0.02);
  border-radius: 6px;
  gap: 8px;
}
.classify-item-keyword {
  font-size: 12px; font-weight: 500; color: #e2e8f0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.classify-item-summary {
  font-size: 10px; color: #64748b;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  max-width: 50%;
  flex-shrink: 0;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
}

.card-grid-scroll {
  max-height: 290px;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
}
.card-grid-scroll::-webkit-scrollbar { width: 4px; }
.card-grid-scroll::-webkit-scrollbar-track { background: transparent; }
.card-grid-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
.card-grid-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

/* 单张卡片 */
.bm-card {
  position: relative; overflow: hidden;
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background: rgba(15,23,42,0.5);
}
.bm-card:hover {
  border-color: var(--card-accent);
  background: rgba(15,23,42,0.7);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.3), 0 0 0 1px var(--card-accent) inset;
}
.bm-card:hover .bm-card-actions { opacity: 1; }
.bm-card-bg {
  position: absolute; inset: 0; opacity: 0.05;
  background: radial-gradient(ellipse at top right, var(--card-accent), transparent 70%);
  pointer-events: none;
}
.bm-card-icon {
  width: 38px; height: 38px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  background: linear-gradient(135deg, var(--card-accent), color-mix(in srgb, var(--card-accent) 60%, #000));
  color: #fff; font-size: 13px; font-weight: 700;
  box-shadow: 0 4px 12px color-mix(in srgb, var(--card-accent) 30%, transparent);
  position: relative; z-index: 1;
}
.bm-card-body { flex: 1; min-width: 0; position: relative; z-index: 1; }
.bm-card-title {
  display: block; font-size: 13px; font-weight: 600; color: #e2e8f0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.bm-card-url {
  display: block; font-size: 10px; color: #64748b; margin-top: 2px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.bm-card-actions {
  position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
  display: flex; gap: 4px; opacity: 0; transition: opacity 0.2s; z-index: 2;
}
.card-action-btn { width: 26px; height: 26px; }
.card-action-btn.open { color: #4fc3f7; }
.card-action-btn.open:hover { background: rgba(79,195,247,0.15); }
.card-action-btn.del { color: #ef5350; }
.card-action-btn.del:hover { background: rgba(239,83,80,0.15); }
.card-action-btn.copy { color: #81c784; }
.card-action-btn.copy:hover { background: rgba(129,199,132,0.15); }

.no-results { text-align: center; padding: 20px; color: #475569; font-size: 13px; }

/* ===== 标签筛选 ===== */
.tag-filter-bar {
  display: flex; flex-wrap: wrap; gap: 6px;
  margin-bottom: 12px; padding: 8px 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.tag-filter-chip {
  font-size: 11px; padding: 3px 10px; border-radius: 10px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  color: #64748b; cursor: pointer; transition: all 0.2s;
  user-select: none;
}
.tag-filter-chip:hover {
  background: rgba(79,195,247,0.1);
  border-color: rgba(79,195,247,0.2);
  color: #4fc3f7;
}
.tag-filter-chip.active {
  background: rgba(79,195,247,0.15);
  border-color: rgba(79,195,247,0.3);
  color: #4fc3f7;
  font-weight: 600;
}

/* ===== 分页 ===== */
.pagination-bar {
  display: flex; justify-content: center;
  padding: 12px 0 4px;
}
.pagination-bar :deep(.el-pagination.is-background .btn-prev),
.pagination-bar :deep(.el-pagination.is-background .btn-next),
.pagination-bar :deep(.el-pagination.is-background .el-pager li) {
  background: rgba(255,255,255,0.04);
  color: #94a3b8;
  border: 1px solid rgba(255,255,255,0.06);
}
.pagination-bar :deep(.el-pagination.is-background .el-pager li.is-active) {
  background: linear-gradient(135deg, #4fc3f7, #7c4dff);
  color: #fff;
  border-color: transparent;
}
.pagination-bar :deep(.el-pagination .el-pagination__total) {
  color: #64748b;
}

/* ===== 卡片标签 ===== */
/* ===== RAG 知识库 ===== */
.knowledge-tabs { max-height: 60vh; overflow-y: auto; }
.knowledge-section { margin-bottom: 8px; }
.section-title { margin: 0 0 10px 0; font-size: 14px; color: #e2e8f0; }
.knowledge-empty { text-align: center; color: #64748b; padding: 20px 0; font-size: 13px; }
.knowledge-doc-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border: 1px solid #334155; border-radius: 6px; margin-bottom: 6px; background: #1e293b; }

/* ===== 工作日志 ===== */
.worklog-tabs { max-height: 65vh; overflow-y: auto; padding-right: 4px; }
.worklog-tabs::-webkit-scrollbar { width: 4px; }
.worklog-tabs::-webkit-scrollbar-thumb { background: #475569; border-radius: 2px; }
.worklog-section { margin-bottom: 8px; }
.worklog-section .section-title { margin: 0 0 12px 0; font-size: 14px; color: #e2e8f0; }
.worklog-form { display: flex; flex-direction: column; gap: 10px; }
.wl-form-row { display: flex; align-items: center; }
.wl-form-actions { display: flex; align-items: center; gap: 12px; }
.wl-add-result { font-size: 13px; color: #22c55e; }
.worklog-empty { color: #64748b; font-size: 13px; padding: 20px 0; text-align: center; }
.worklog-item { padding: 10px 12px; border: 1px solid #334155; border-radius: 6px; margin-bottom: 8px; background: #1e293b; }
.wl-item-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.wl-item-time { font-size: 12px; color: #94a3b8; font-family: monospace; }
.wl-item-title { font-size: 14px; color: #e2e8f0; margin-bottom: 2px; }
.wl-item-desc { font-size: 12px; color: #64748b; }
.wl-item-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 6px; }
.wl-item-duration { font-size: 12px; color: #64748b; font-family: monospace; }
.wl-stats-summary { display: flex; gap: 12px; margin-bottom: 12px; }
.wl-stat-card { flex: 1; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 14px; text-align: center; }
.wl-stat-value { font-size: 24px; font-weight: 700; color: #60a5fa; }
.wl-stat-label { font-size: 12px; color: #94a3b8; margin-top: 4px; }
.wl-cat-bar-row { display: flex; align-items: center; margin-bottom: 6px; gap: 8px; }
.wl-cat-label { width: 50px; font-size: 12px; color: #cbd5e1; flex-shrink: 0; }
.wl-cat-bar-bg, .wl-stat-bar-bg { flex: 1; height: 8px; background: #334155; border-radius: 4px; overflow: hidden; }
.wl-cat-bar-fill { height: 100%; background: linear-gradient(90deg, #60a5fa, #818cf8); border-radius: 4px; transition: width 0.3s; }
.wl-cat-count { width: 40px; font-size: 11px; color: #94a3b8; text-align: right; flex-shrink: 0; }
.wl-stat-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid #1e293b; }
.wl-stat-date { width: 100px; font-size: 12px; color: #cbd5e1; flex-shrink: 0; }
.wl-stat-count { width: 50px; font-size: 12px; color: #94a3b8; flex-shrink: 0; }
.wl-stat-hours { width: 60px; font-size: 12px; color: #94a3b8; flex-shrink: 0; }
.wl-stat-bar-fill { height: 100%; background: linear-gradient(90deg, #60a5fa, #22c55e); border-radius: 4px; transition: width 0.3s; }
.knowledge-doc-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.knowledge-doc-title { font-size: 13px; color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.knowledge-doc-meta { font-size: 11px; color: #64748b; }
.knowledge-query-input { margin-bottom: 12px; }
.knowledge-query-result { margin-top: 10px; }
.knowledge-answer { background: #1a3a2a; border: 1px solid #2d6a4f; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
.knowledge-answer h5 { margin: 0 0 8px 0; color: #95d5b2; font-size: 13px; }
.knowledge-answer p { margin: 0; color: #d8f3dc; font-size: 13px; line-height: 1.6; }
.knowledge-chunks h5 { margin: 0 0 8px 0; color: #94a3b8; font-size: 13px; }
.knowledge-chunk-item { display: flex; gap: 10px; padding: 8px 10px; border: 1px solid #334155; border-radius: 6px; margin-bottom: 6px; background: #1e293b; }
.chunk-index { flex-shrink: 0; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: #0ea5e9; color: #fff; border-radius: 50%; font-size: 12px; font-weight: bold; }
.chunk-text { flex: 1; font-size: 12px; color: #cbd5e1; line-height: 1.5; }
.chunk-score { font-size: 11px; color: #0ea5e9; margin-top: 4px; }

.bm-card-tags {
  display: flex; flex-wrap: wrap; gap: 3px;
  margin-top: 4px;
}
.bm-tag {
  font-size: 9px; padding: 1px 6px; border-radius: 6px;
  background: rgba(79,195,247,0.1);
  border: 1px solid rgba(79,195,247,0.15);
  color: #4fc3f7;
  white-space: nowrap;
}
.bm-tag-more {
  font-size: 9px; padding: 1px 6px; border-radius: 6px;
  background: rgba(255,255,255,0.04);
  color: #64748b;
}

/* ===== 欢迎区域 ===== */
.welcome-section { flex-shrink: 0; }
.welcome-card { padding: 36px 28px; text-align: center; }
.welcome-graphic { position: relative; display: inline-block; margin-bottom: 12px; }
.welcome-ring {
  position: absolute; inset: -4px; border-radius: 50%;
  border: 2px solid rgba(79,195,247,0.15); animation: ringPulse 3s ease-in-out infinite;
}
@keyframes ringPulse { 0%,100%{transform:scale(1);opacity:0.3} 50%{transform:scale(1.15);opacity:0.1} }
.welcome-icon-el { color: #4fc3f7; }
.welcome-title { font-size: 22px; font-weight: 700; margin: 0 0 4px; color: #f1f5f9; }
.welcome-desc { font-size: 13px; color: #64748b; margin: 0 0 24px; }
.welcome-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
  max-width: 560px; margin: 0 auto;
}
@media (max-width: 600px) { .welcome-grid { grid-template-columns: repeat(2, 1fr); } }
.welcome-item {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 14px; border-radius: 12px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  cursor: pointer; transition: all 0.25s; text-align: left;
}
.welcome-item:hover {
  background: rgba(79,195,247,0.08);
  border-color: rgba(79,195,247,0.2);
  transform: translateY(-1px);
}
.wi-icon {
  width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
  background: rgba(79,195,247,0.1); color: #4fc3f7;
  display: flex; align-items: center; justify-content: center;
}
.wi-title { font-size: 13px; font-weight: 600; color: #e2e8f0; }
.wi-desc { font-size: 10px; color: #64748b; margin-top: 1px; }

/* ===== 对话消息 ===== */
.messages-section { flex-shrink: 0; }
.messages-card { overflow: hidden; }
.messages-scroll {
  max-height: 360px; overflow-y: auto; padding: 18px 20px;
}
.messages-scroll::-webkit-scrollbar { width: 4px; }
.messages-scroll::-webkit-scrollbar-track { background: transparent; }
.messages-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }

.msg-row { display: flex; gap: 10px; margin-bottom: 16px; align-items: flex-start; }
.msg-row.user { flex-direction: row-reverse; }
.msg-avatar {
  width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center; font-size: 15px;
}
.msg-avatar.assistant {
  background: linear-gradient(135deg, #4fc3f7, #7c4dff);
  color: #fff; box-shadow: 0 4px 12px rgba(79,195,247,0.25);
}
.msg-avatar.user { background: rgba(255,255,255,0.06); color: #94a3b8; }

.msg-bubble {
  max-width: 78%; padding: 10px 16px; border-radius: 14px;
  font-size: 13px; line-height: 1.7; word-break: break-word;
}
.msg-bubble.assistant {
  background: rgba(30,41,59,0.7); border: 1px solid rgba(255,255,255,0.06);
  color: #e2e8f0; border-bottom-left-radius: 4px;
}
.msg-bubble.user {
  background: linear-gradient(135deg, rgba(79,195,247,0.2), rgba(124,77,255,0.2));
  border: 1px solid rgba(79,195,247,0.15);
  color: #e2e8f0; border-bottom-right-radius: 4px;
}
.msg-text :deep(strong) { font-weight: 700; color: #4fc3f7; }
.msg-text :deep(br) { display: block; content: ''; margin: 4px 0; }
.msg-time { font-size: 10px; color: #475569; margin-top: 4px; }

/* 行内卡片列表 */
.inline-cards { min-width: 240px; }
.inline-cards-header { font-weight: 600; font-size: 13px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.06); color: #94a3b8; }
.inline-cards-empty { color: #475569; font-size: 13px; padding: 8px 0; }
.inline-card-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px; border-radius: 8px; cursor: pointer;
  transition: all 0.2s; margin-bottom: 4px;
  background: rgba(15,23,42,0.4); border: 1px solid rgba(255,255,255,0.04);
}
.inline-card-item:hover { background: rgba(79,195,247,0.06); border-color: rgba(79,195,247,0.15); }
.ici-icon {
  width: 28px; height: 28px; border-radius: 7px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, var(--card-accent), color-mix(in srgb, var(--card-accent) 50%, #000));
  color: #fff; font-size: 11px; font-weight: 700; flex-shrink: 0;
}
.ici-body { flex: 1; min-width: 0; }
.ici-title { display: block; font-size: 12px; font-weight: 600; color: #e2e8f0; }
.ici-url { display: block; font-size: 10px; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ici-open { color: #475569; flex-shrink: 0; }
.inline-card-item:hover .ici-open { color: #4fc3f7; }

/* 打字 */
.typing-dots { display: flex; gap: 4px; padding: 6px 0; }
.typing-dots span {
  width: 7px; height: 7px; background: #4fc3f7; border-radius: 50%;
  animation: dotBounce 1.4s infinite ease-in-out;
}
.typing-dots span:nth-child(2) { animation-delay: 0.2s; }
.typing-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes dotBounce {
  0%,60%,100% { opacity: 0.2; transform: translateY(0); }
  30% { opacity: 1; transform: translateY(-6px); }
}

/* ===== 底部 ===== */
.footer {
  flex-shrink: 0; z-index: 10;
  background: rgba(15,23,42,0.8); backdrop-filter: blur(12px);
  border-top: 1px solid rgba(255,255,255,0.04);
  padding: 0 24px; height: 34px;
  display: flex; align-items: center; justify-content: center;
}
.footer-inner { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #475569; }
.footer-inner .dot { color: rgba(255,255,255,0.08); }
.footer-inner strong { color: #64748b; }

/* ============================================= */
/* ===== 响应式：大屏幕（≥1400px）===== */
/* ============================================= */
@media (min-width: 1400px) {
  .topbar-inner { max-width: 1100px; }
  .content-column { max-width: 900px; }
}

/* ============================================= */
/* ===== 响应式：平板/小屏笔记本（≤900px）===== */
/* ============================================= */
@media (max-width: 900px) {
  .topbar-inner { max-width: 100%; padding: 0 20px; }
  .content-column { max-width: 100%; padding: 24px 16px 28px; }
}

/* ============================================= */
/* ===== 响应式：小平板（≤768px）===== */
/* ============================================= */
@media (max-width: 768px) {
  .topbar-inner { height: 54px; padding: 0 16px; }
  .content-column { padding: 18px 14px 24px; gap: 16px; }

  /* 顶部统计隐藏 */
  .topbar-center { display: none; }

  /* 书签区域 */
  .bookmarks-section { padding: 14px 14px 16px; }
  .section-bar { flex-wrap: wrap; gap: 8px; }
  .section-title { font-size: 13px; }
  .section-tools { width: 100%; justify-content: flex-start; }
  .search-box { flex: 1; max-width: 200px; width: auto; }

  /* 卡片网格 */
  .card-grid { grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; }
  .card-grid-scroll { max-height: 260px; }

  /* 欢迎区域 */
  .welcome-card { padding: 28px 18px; }
  .welcome-title { font-size: 19px; }
  .welcome-desc { font-size: 12px; margin-bottom: 18px; }
  .welcome-grid { max-width: 100%; }

  /* 消息区域 */
  .messages-scroll { max-height: 280px; padding: 14px 16px; }
  .msg-bubble { max-width: 86%; font-size: 12px; }

  /* 输入区域 */
  .input-card { padding: 14px 16px 12px; }
  .input-field { font-size: 13px; padding: 10px 0; }
  .send-btn { padding: 0 14px; height: 38px; }
  .send-btn span { display: none; }
  .chip { font-size: 10px; padding: 2px 8px; }
}

/* ============================================= */
/* ===== 响应式：手机（≤480px）===== */
/* ============================================= */
@media (max-width: 480px) {
  .topbar-inner { height: 48px; padding: 0 12px; }
  .app-logo { gap: 8px; }
  .logo-icon-wrap { width: 30px; height: 30px; border-radius: 8px; }
  .logo-title { font-size: 14px; }
  .logo-sub { display: none; }
  .topbar-right { gap: 0; }

  .content-column { padding: 14px 10px 20px; gap: 12px; }

  /* 输入区域 - 竖排 */
  .input-card { padding: 12px 12px 10px; }
  .input-row { flex-direction: column; gap: 8px; }
  .input-field { font-size: 12px; padding: 9px 0; }
  .send-btn { width: 100%; height: 36px; justify-content: center; border-radius: 10px; }
  .send-btn span { display: inline; }
  .chip-label { display: none; }
  .input-chips { gap: 4px; }
  .chip { font-size: 10px; padding: 2px 7px; }

  /* 书签区域 */
  .bookmarks-section { padding: 10px 10px 12px; }
  .section-bar { flex-direction: column; align-items: flex-start; }
  .section-tools { justify-content: flex-end; }
  .search-box { max-width: 100%; }
  .section-title { font-size: 12px; }
  .section-count { font-size: 10px; }

  /* 卡片网格 - 更小的卡片 */
  .card-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 6px;
  }
  .card-grid-scroll { max-height: 230px; }
  .bm-card { padding: 8px 10px; gap: 8px; }
  .bm-card-icon { width: 30px; height: 30px; border-radius: 8px; font-size: 11px; }
  .bm-card-title { font-size: 11px; }
  .bm-card-url { display: none; }
  .bm-card-actions {
    position: static;
    transform: none;
    opacity: 1;
    margin-left: auto;
  }
  .card-action-btn { width: 22px; height: 22px; }

  /* 欢迎区域 */
  .welcome-card { padding: 20px 14px; }
  .welcome-title { font-size: 17px; }
  .welcome-desc { font-size: 11px; margin-bottom: 14px; }
  .welcome-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .welcome-item { padding: 10px 10px; gap: 8px; }
  .wi-icon { width: 30px; height: 30px; }
  .wi-title { font-size: 12px; }
  .wi-desc { display: none; }

  /* 消息区域 */
  .messages-scroll { max-height: 200px; padding: 10px 12px; }
  .msg-row { gap: 8px; margin-bottom: 12px; }
  .msg-avatar { width: 26px; height: 26px; font-size: 13px; }
  .msg-bubble { max-width: 92%; padding: 8px 12px; font-size: 12px; border-radius: 12px; }
  .msg-time { font-size: 9px; }
  .inline-cards { min-width: 160px; }
  .inline-card-item { padding: 6px 8px; }

  /* 底部 */
  .footer { height: 28px; padding: 0 12px; }
  .footer-inner { font-size: 10px; gap: 4px; }
}

/* ============================================= */
/* ===== 响应式：极小屏（≤360px）===== */
/* ============================================= */
@media (max-width: 360px) {
  .logo-title { font-size: 12px; }
  .logo-icon-wrap { width: 26px; height: 26px; }
  .content-column { padding: 10px 8px 16px; gap: 10px; }
  .card-grid { grid-template-columns: 1fr; }
  .welcome-grid { grid-template-columns: 1fr; }
  .welcome-title { font-size: 15px; }
  .input-field { font-size: 11px; }
}

/* ===== 高阶能力对话框 ===== */
.advanced-content { min-height: 400px; }
.advanced-tabs { height: 65vh; }
.advanced-tabs :deep(.el-tabs__content) { overflow-y: auto; height: calc(65vh - 50px); padding-right: 4px; }
.adv-section { padding: 4px 0; }
.adv-section-title { margin: 0 0 10px 0; font-size: 14px; color: #e2e8f0; }
.adv-empty { color: #64748b; font-size: 13px; text-align: center; padding: 20px 0; }
.agent-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; margin-bottom: 12px; }
.agent-card { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 12px; cursor: pointer; transition: all 0.2s; }
.agent-card:hover { border-color: #4fc3f7; background: #263548; }
.agent-card.active { border-color: #4fc3f7; box-shadow: 0 0 12px rgba(79,195,247,0.15); }
.agent-icon { font-size: 28px; margin-bottom: 6px; }
.agent-name { font-size: 13px; font-weight: 600; color: #e2e8f0; }
.agent-desc { font-size: 11px; color: #94a3b8; margin: 2px 0 6px; }
.agent-expertise { display: flex; gap: 4px; flex-wrap: wrap; }
.agent-chat-box { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 10px; margin-bottom: 10px; }
.agent-chat-messages { max-height: 360px; overflow-y: auto; margin-bottom: 8px; }
.agent-chat-messages::-webkit-scrollbar { width: 3px; }
.agent-chat-messages::-webkit-scrollbar-thumb { background: #475569; border-radius: 2px; }
.agent-msg { margin-bottom: 6px; }
.agent-msg.user { text-align: right; }
.agent-msg-bubble { display: inline-block; padding: 6px 12px; border-radius: 12px; font-size: 13px; max-width: 85%; text-align: left; line-height: 1.6; word-break: break-word; }
.agent-msg.user .agent-msg-bubble { background: #4fc3f7; color: #fff; }
.agent-msg.assistant .agent-msg-bubble { background: #1e293b; color: #e2e8f0; border: 1px solid #334155; }
.agent-code-block { background: #0d1117; border: 1px solid #30363d; border-radius: 6px; padding: 12px; margin: 8px 0; overflow-x: auto; font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace; font-size: 12px; line-height: 1.5; color: #c9d1d9; white-space: pre; }
.agent-inline-code { background: #263041; padding: 1px 5px; border-radius: 3px; font-family: Consolas, monospace; font-size: 12px; color: #79c0ff; }
.agent-tip-line { margin: 4px 0; color: #58a6ff; }
.agent-list-item { margin: 2px 0; padding-left: 4px; }
.agent-list-num { color: #4fc3f7; font-weight: 600; margin-right: 4px; }
.agent-chat-input { display: flex; gap: 6px; }
.agent-collab-form { display: flex; gap: 8px; }
.collab-results { margin-top: 10px; }
.collab-item { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 10px; margin-bottom: 8px; }
.collab-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 13px; color: #e2e8f0; }
.collab-reply { font-size: 12px; color: #cbd5e1; line-height: 1.5; }
.insight-cards { display: flex; gap: 10px; margin-bottom: 12px; }
.insight-card { flex: 1; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px; text-align: center; }
.insight-value { font-size: 22px; font-weight: 700; color: #60a5fa; display: block; }
.insight-label { font-size: 12px; color: #94a3b8; }
.memory-item { background: #1e293b; border: 1px solid #334155; border-radius: 6px; padding: 8px 10px; margin-bottom: 6px; }
.user-profile-panel { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px; }
.profile-stats { display: flex; gap: 16px; margin-bottom: 10px; }
.profile-stat { display: flex; flex-direction: column; align-items: center; }
.profile-num { font-size: 20px; font-weight: 700; color: #e2e8f0; }
.profile-label { font-size: 11px; color: #94a3b8; }
.profile-tech, .profile-tags { margin-top: 6px; }
.memory-content { font-size: 13px; color: #e2e8f0; margin-bottom: 4px; }
.memory-meta { display: flex; align-items: center; gap: 8px; }
.prefs-form { max-width: 400px; }
.pref-row { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
.suggestion-item { display: flex; align-items: flex-start; gap: 10px; background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 10px; margin-bottom: 8px; }
.suggestion-icon { font-size: 22px; flex-shrink: 0; }
.suggestion-body { flex: 1; }
.suggestion-title { font-size: 13px; color: #e2e8f0; font-weight: 500; }
.suggestion-desc { font-size: 12px; color: #94a3b8; margin-bottom: 6px; }
.suggestion-inline-form { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
.suggestion-actions { flex-shrink: 0; display: flex; align-items: center; }
.summary-result { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px; margin-top: 8px; }
.summary-text { white-space: pre-wrap; font-family: inherit; font-size: 13px; color: #e2e8f0; line-height: 1.6; margin: 0 0 8px 0; }
.trigger-item { display: flex; justify-content: space-between; align-items: center; background: #1e293b; border: 1px solid #334155; border-radius: 6px; padding: 8px 10px; margin-bottom: 6px; }
.trigger-info { display: flex; flex-direction: column; gap: 2px; }
.trigger-name { font-size: 13px; color: #e2e8f0; }

/* ===== 工作流 ===== */
.wf-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.wf-card { background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 12px; margin-bottom: 10px; transition: border-color 0.2s; }
.wf-card:hover { border-color: #4fc3f7; }
.wf-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.wf-card-title { display: flex; align-items: center; gap: 8px; }
.wf-name { font-size: 14px; font-weight: 600; color: #e2e8f0; }
.wf-card-actions { display: flex; align-items: center; gap: 6px; }
.wf-desc { font-size: 12px; color: #94a3b8; margin-bottom: 8px; }
.wf-steps { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 6px; }
.wf-step-chip { display: flex; align-items: center; gap: 4px; background: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 3px 8px; font-size: 11px; color: #cbd5e1; }
.wf-step-num { background: #4fc3f7; color: #0f172a; border-radius: 50%; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; }
.wf-condition { font-size: 11px; color: #f59e0b; display: flex; align-items: center; gap: 4px; }
.wf-history-item { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 8px 10px; margin-bottom: 6px; }
.wf-history-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.wf-history-name { font-size: 13px; color: #e2e8f0; font-weight: 500; }
.wf-history-time { font-size: 11px; color: #64748b; flex: 1; }
.wf-history-steps { display: flex; gap: 8px; flex-wrap: wrap; }
.wf-history-step { font-size: 11px; color: #94a3b8; }
.wf-history-step.success { color: #4ade80; }
.wf-history-step.failed { color: #f87171; }
.wf-status-ok { font-size: 14px; }
.wf-status-fail { font-size: 14px; }
.wf-create-step { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.wf-create-step-num { background: #334155; color: #e2e8f0; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; flex-shrink: 0; }

/* ===== 通知面板 ===== */
.notify-bell { position: relative; }
.notify-badge { position: absolute; top: -2px; right: -2px; background: #ef4444; color: #fff; font-size: 9px; min-width: 14px; height: 14px; border-radius: 7px; display: flex; align-items: center; justify-content: center; padding: 0 3px; }
.notify-panel { position: fixed; top: 52px; right: 16px; width: 340px; max-height: 420px; background: #1e293b; border: 1px solid #334155; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.4); z-index: 2000; display: flex; flex-direction: column; overflow: hidden; }
.notify-panel-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 1px solid #334155; font-size: 14px; color: #e2e8f0; font-weight: 600; }
.notify-panel-body { overflow-y: auto; max-height: 350px; padding: 8px; }
.notify-item { display: flex; align-items: flex-start; gap: 8px; padding: 8px; border-radius: 8px; cursor: pointer; transition: background 0.15s; }
.notify-item:hover { background: #263548; }
.notify-item.unread { background: #1a2744; border-left: 2px solid #4fc3f7; }
.notify-type-icon { font-size: 16px; flex-shrink: 0; }
.notify-item-body { flex: 1; min-width: 0; }
.notify-item-msg { font-size: 12px; color: #e2e8f0; line-height: 1.4; word-break: break-all; }
.notify-item-time { font-size: 10px; color: #64748b; margin-top: 2px; }

/* ===== 集成中心 ===== */
.integ-form { margin-bottom: 4px; }
.git-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
.git-output { background: #0d1117; border: 1px solid #30363d; border-radius: 6px; padding: 10px; margin-top: 8px; font-family: 'JetBrains Mono', Consolas, monospace; font-size: 12px; color: #c9d1d9; white-space: pre-wrap; max-height: 200px; overflow-y: auto; line-height: 1.5; }
.fs-list { margin-top: 8px; max-height: 200px; overflow-y: auto; border: 1px solid #334155; border-radius: 6px; }
.fs-item { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; font-size: 12px; color: #e2e8f0; cursor: pointer; border-bottom: 1px solid #1e293b; }
.fs-item:hover { background: #263548; }
.fs-item-size { color: #64748b; font-size: 11px; }

/* ===== 自主 Agent ===== */
.orch-input-row { display: flex; gap: 8px; margin-bottom: 12px; }
.orch-timeline { max-height: 380px; overflow-y: auto; padding-right: 4px; }
.orch-step { display: flex; gap: 10px; margin-bottom: 8px; padding: 8px; border-radius: 8px; background: #1e293b; border: 1px solid #334155; }
.orch-step.orch-thought { border-left: 3px solid #a78bfa; }
.orch-step.orch-action { border-left: 3px solid #4fc3f7; }
.orch-step.orch-observation { border-left: 3px solid #4ade80; }
.orch-step.orch-done { border-left: 3px solid #22c55e; background: #14291a; }
.orch-step.orch-error { border-left: 3px solid #ef4444; background: #2a1515; }
.orch-step-icon { font-size: 16px; flex-shrink: 0; margin-top: 2px; }
.orch-step-body { flex: 1; min-width: 0; }
.orch-step-label { font-size: 11px; color: #94a3b8; font-weight: 600; margin-bottom: 3px; text-transform: uppercase; }
.orch-step-content { font-size: 13px; color: #e2e8f0; line-height: 1.5; word-break: break-word; }
.orch-step-content code { background: #263041; padding: 1px 5px; border-radius: 3px; font-size: 12px; color: #79c0ff; }
.orch-obs { background: #0d1117; border: 1px solid #30363d; border-radius: 4px; padding: 8px; font-size: 12px; color: #c9d1d9; white-space: pre-wrap; max-height: 120px; overflow-y: auto; margin: 4px 0 0 0; font-family: Consolas, monospace; }
.orch-result { margin-top: 12px; padding: 12px; border-radius: 8px; border: 1px solid #334155; }
.orch-result.ok { background: #14291a; border-color: #22c55e; }
.orch-result.fail { background: #2a1515; border-color: #ef4444; }
.orch-result-header { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #e2e8f0; font-weight: 600; margin-bottom: 6px; }
.orch-result-summary { font-size: 13px; color: #cbd5e1; line-height: 1.5; }

/* ===== 插件系统 ===== */
.plugin-card {
  background: rgba(15,23,42,0.5); border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px; padding: 14px; margin-bottom: 10px;
  transition: border-color 0.2s;
}
.plugin-card:hover { border-color: rgba(79,195,247,0.3); }
.plugin-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.plugin-name { font-size: 14px; font-weight: 600; color: #e2e8f0; display: flex; align-items: center; gap: 6px; }
.plugin-desc { font-size: 12px; color: #64748b; margin-bottom: 8px; }
.plugin-tools { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
.plugin-tool-tag { font-size: 11px; }
.plugin-actions { display: flex; gap: 4px; }
.mcp-status { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.mcp-endpoint { font-size: 12px; color: #64748b; font-family: Consolas, monospace; background: rgba(15,23,42,0.5); padding: 2px 8px; border-radius: 4px; }
.mcp-server-item { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 13px; color: #e2e8f0; }
.mcp-add-row { display: flex; gap: 8px; margin-top: 10px; }

/* ===== 多模态 ===== */
.chip-mm { color: #a78bfa; border-color: rgba(167,139,250,0.2); }
.chip-mm:hover { background: rgba(167,139,250,0.1); border-color: rgba(167,139,250,0.4); color: #c4b5fd; }
.attached-image-preview {
  margin-top: 8px; padding: 8px; border-radius: 8px;
  background: rgba(15,23,42,0.6); border: 1px solid rgba(167,139,250,0.2);
  display: flex; align-items: center; gap: 10px;
}
.attached-image-preview img {
  max-height: 80px; max-width: 200px; border-radius: 6px; object-fit: contain;
}

/* ===== 仪表盘 ===== */
.dash-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
.dash-card {
  background: rgba(15,23,42,0.6); border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px; padding: 14px 12px; text-align: center;
}
.dash-card-value { font-size: 22px; font-weight: 700; color: #4fc3f7; margin-bottom: 4px; }
.dash-card-label { font-size: 11px; color: #64748b; }
.dash-bar-chart { display: flex; align-items: flex-end; gap: 8px; height: 80px; padding: 8px 0; }
.dash-bar-col { display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; }
.dash-bar { width: 100%; max-width: 28px; background: linear-gradient(180deg, #4fc3f7, #7c4dff); border-radius: 4px 4px 0 0; min-height: 4px; }
.dash-bar-label { font-size: 10px; color: #64748b; }
.dash-tool-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.dash-tool-name { font-size: 12px; color: #e2e8f0; width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dash-tool-bar-wrap { flex: 1; height: 8px; background: rgba(255,255,255,0.04); border-radius: 4px; overflow: hidden; }
.dash-tool-bar { height: 100%; background: linear-gradient(90deg, #4fc3f7, #7c4dff); border-radius: 4px; }
.dash-tool-count { font-size: 11px; color: #64748b; width: 24px; text-align: right; }
.dash-report { background: rgba(15,23,42,0.5); border: 1px solid rgba(79,195,247,0.15); border-radius: 10px; padding: 14px; }
.dash-report-insight { font-size: 13px; color: #e2e8f0; line-height: 1.6; margin-bottom: 10px; white-space: pre-wrap; }
.dash-report-recs { display: flex; flex-direction: column; gap: 6px; }
.dash-rec-item { font-size: 12px; color: #94a3b8; padding: 6px 10px; background: rgba(255,255,255,0.03); border-radius: 6px; }

/* ===== 桌面操控 ===== */
.desktop-toolbar { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.desktop-preview { position: relative; margin-bottom: 12px; border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; overflow: hidden; }
.desktop-img { width: 100%; display: block; }
.desktop-bbox { position: absolute; border: 2px solid #4fc3f7; border-radius: 4px; pointer-events: none; }
.desktop-bbox-label { position: absolute; top: -18px; left: 0; font-size: 10px; color: #fff; background: #4fc3f7; padding: 1px 6px; border-radius: 3px; white-space: nowrap; }
.desktop-actions { display: flex; flex-direction: column; gap: 8px; }
.desktop-action-row { display: flex; gap: 8px; align-items: center; }
.desktop-confirm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10000; }
.desktop-confirm-dialog { background: #1e293b; border: 1px solid rgba(245,158,11,0.3); border-radius: 12px; padding: 20px; max-width: 400px; width: 90%; }
.desktop-history { display: flex; flex-direction: column; gap: 4px; max-height: 200px; overflow-y: auto; }
.desktop-history-item { display: flex; align-items: center; gap: 8px; padding: 4px 8px; background: rgba(255,255,255,0.02); border-radius: 4px; }
.desktop-unavailable { display: flex; align-items: center; gap: 8px; margin-top: 12px; padding: 12px; background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.2); border-radius: 8px; color: #f59e0b; font-size: 13px; }
</style>

