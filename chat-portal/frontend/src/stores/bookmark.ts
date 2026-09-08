import { ref, computed } from 'vue'
import {
  getBookmarks, addBookmark as apiAddBookmark,
  deleteBookmarkById, clearAllBookmarks as apiClearAll,
  searchBookmarks, getGroups as apiGetGroups,
  addGroup as apiAddGroup, deleteGroup as apiDeleteGroup,
  getTags as apiGetTags,
  importBookmarks as apiImportBookmarks
} from '@/api'
import type { Bookmark, BookmarkGroup, TagCount } from '@/types'

// ===== 响应式数据 =====
const bookmarks = ref<Bookmark[]>([])
const loaded = ref(false)
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)

const groups = ref<BookmarkGroup[]>([])
const groupsLoaded = ref(false)

const tags = ref<TagCount[]>([])
const tagsLoaded = ref(false)

// ===== Store =====

export function useBookmarkStore() {
  /** 加载书签（分页） */
  async function loadBookmarks(params?: {
    page?: number
    pageSize?: number
    search?: string
    tag?: string
    group_id?: number
    language?: string
  }) {
    try {
      const res = await getBookmarks(params || { page: currentPage.value, pageSize: pageSize.value })
      if (res.code === 200) {
        bookmarks.value = res.data || []
        total.value = res.total || 0
        currentPage.value = res.page || 1
        pageSize.value = res.pageSize || 20
      }
      loaded.value = true
    } catch {
      loaded.value = true
    }
  }

  /** 分页切换 */
  async function setPage(page: number) {
    currentPage.value = page
    await loadBookmarks()
  }

  /** 添加书签 */
  async function save(keyword: string, url: string, opts?: {
    description?: string
    tags?: string[]
    group_id?: number | null
    language?: string
  }): Promise<boolean> {
    try {
      const res = await apiAddBookmark(keyword, url, opts)
      if (res.code === 200) {
        // 刷新当前页
        await loadBookmarks()
        return true
      }
      return false
    } catch {
      // 离线模式
      bookmarks.value.unshift({
        keyword,
        url,
        description: opts?.description || '',
        tags: opts?.tags || [],
        group_id: opts?.group_id || null,
        language: opts?.language || 'zh',
        createdAt: new Date().toISOString()
      })
      total.value++
      return true
    }
  }

  /** 删除书签（按 ID） */
  async function remove(id: number): Promise<boolean> {
    try {
      const res = await deleteBookmarkById(id)
      if (res.code === 200) {
        bookmarks.value = bookmarks.value.filter(b => b.id !== id)
        total.value--
        return true
      }
      return false
    } catch {
      bookmarks.value = bookmarks.value.filter(b => b.id !== id)
      total.value--
      return true
    }
  }

  /** 删除书签（按 keyword，兼容旧版） */
  async function removeByKeyword(keyword: string): Promise<boolean> {
    const bm = bookmarks.value.find(b => b.keyword === keyword)
    if (bm && bm.id) return remove(bm.id)
    bookmarks.value = bookmarks.value.filter(b => b.keyword !== keyword)
    total.value--
    return true
  }

  /** 清空所有 */
  async function clearAll(): Promise<boolean> {
    try {
      const res = await apiClearAll()
      if (res.code === 200) {
        bookmarks.value = []
        total.value = 0
        return true
      }
      return false
    } catch {
      bookmarks.value = []
      total.value = 0
      return true
    }
  }

  /** 搜索 */
  async function search(keyword: string): Promise<Bookmark[]> {
    try {
      const res = await searchBookmarks(keyword)
      return res.data || []
    } catch {
      return bookmarks.value.filter(b =>
        b.keyword.includes(keyword) || b.url.includes(keyword)
      )
    }
  }

  /** 按关键词查找 */
  function findByKeyword(keyword: string): Bookmark | undefined {
    return bookmarks.value.find(b => b.keyword === keyword)
  }

  /** 模糊匹配 */
  function fuzzyFind(input: string): Bookmark[] {
    return bookmarks.value.filter(b =>
      b.keyword.includes(input) || input.includes(b.keyword)
    )
  }

  // ===== 分组管理 =====

  async function loadGroups() {
    try {
      const res = await apiGetGroups()
      if (res.code === 200) {
        groups.value = res.data || []
      }
      groupsLoaded.value = true
    } catch {
      groupsLoaded.value = true
    }
  }

  async function createGroup(name: string, description?: string) {
    const res = await apiAddGroup(name, description)
    if (res.code === 200) {
      groups.value.push(res.data!)
      return true
    }
    return false
  }

  async function removeGroup(id: number) {
    const res = await apiDeleteGroup(id)
    if (res.code === 200) {
      groups.value = groups.value.filter(g => g.id !== id)
      return true
    }
    return false
  }

  // ===== 标签管理 =====

  async function loadTags() {
    try {
      const res = await apiGetTags()
      if (res.code === 200) {
        tags.value = res.data || []
      }
      tagsLoaded.value = true
    } catch {
      tagsLoaded.value = true
    }
  }

  // ===== 导入导出 =====

  async function importBookmarks(data: Partial<Bookmark>[], format: 'json' | 'csv' = 'json') {
    const res = await apiImportBookmarks(data, format)
    if (res.code === 200) {
      await loadBookmarks()
      await loadTags()
    }
    return res
  }

  return {
    // 数据
    bookmarks,
    loaded,
    total,
    currentPage,
    pageSize,
    groups,
    groupsLoaded,
    tags,
    tagsLoaded,

    // 书签
    loadBookmarks,
    setPage,
    save,
    remove,
    removeByKeyword,
    clearAll,
    search,
    findByKeyword,
    fuzzyFind,

    // 分组
    loadGroups,
    createGroup,
    removeGroup,

    // 标签
    loadTags,

    // 导入
    importBookmarks,
  }
}
