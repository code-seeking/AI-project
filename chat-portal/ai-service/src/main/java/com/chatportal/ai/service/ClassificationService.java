package com.chatportal.ai.service;

import com.chatportal.ai.dto.BookmarkClassificationResult;
import com.chatportal.ai.dto.BookmarkClassificationRequest;
import com.chatportal.ai.dto.FolderClassificationRequest;
import com.chatportal.ai.dto.FolderClassificationResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class ClassificationService {

    private final AiCallTemplate aiCallTemplate;
    private final EmbeddingService embeddingService;
    private final ObjectMapper objectMapper;

    public ClassificationService(AiCallTemplate aiCallTemplate,
                                  EmbeddingService embeddingService,
                                  ObjectMapper objectMapper) {
        this.aiCallTemplate = aiCallTemplate;
        this.embeddingService = embeddingService;
        this.objectMapper = objectMapper;
    }

    /**
     * 对书签列表进行 AI 智能分类
     */
    public BookmarkClassificationResult classifyBookmarks(BookmarkClassificationRequest request) {
        List<BookmarkClassificationRequest.BookmarkItem> bookmarks = request.getBookmarks();
        if (bookmarks == null || bookmarks.isEmpty()) {
            BookmarkClassificationResult empty = new BookmarkClassificationResult();
            empty.setCategories(Collections.emptyList());
            return empty;
        }

        // 构造 Prompt
        String prompt = buildBookmarkPrompt(bookmarks);
        String aiResponse = aiCallTemplate.call(prompt);

        if (aiResponse == null) {
            log.warn("AI returned null for bookmark classification, using fallback logic");
            return fallbackClassifyBookmarks(bookmarks);
        }

        // 解析 JSON 响应
        try {
            // 尝试从响应中提取 JSON 对象
            String jsonStr = extractJson(aiResponse);
            BookmarkClassificationResult result = objectMapper.readValue(jsonStr, BookmarkClassificationResult.class);

            if (result.getCategories() != null && !result.getCategories().isEmpty()) {
                log.info("Bookmark classification success: {} categories", result.getCategories().size());

                // 异步存储到向量数据库
                try {
                    embeddingService.storeBookmarkEmbeddings(bookmarks, result);
                } catch (Exception e) {
                    log.warn("Failed to store embeddings: {}", e.getMessage());
                }

                return result;
            }
        } catch (Exception e) {
            log.warn("Failed to parse AI response as JSON: {}", e.getMessage());
        }

        // 降级：按域名归类
        return fallbackClassifyBookmarks(bookmarks);
    }

    /**
     * 对文件夹文件进行 AI 智能分类
     */
    public FolderClassificationResult classifyFolder(FolderClassificationRequest request) {
        List<FolderClassificationRequest.FileItem> files = request.getFiles();
        if (files == null || files.isEmpty()) {
            FolderClassificationResult empty = new FolderClassificationResult();
            empty.setFolderPath(request.getFolderPath());
            empty.setCategories(Collections.emptyList());
            return empty;
        }

        // 构造 Prompt
        String prompt = buildFolderPrompt(request.getFolderPath(), files);
        String aiResponse = aiCallTemplate.call(prompt);

        if (aiResponse == null) {
            log.warn("AI returned null for folder classification, using fallback logic");
            return fallbackClassifyFolder(request);
        }

        // 解析 JSON 响应
        try {
            String jsonStr = extractJson(aiResponse);
            FolderClassificationResult result = objectMapper.readValue(jsonStr, FolderClassificationResult.class);

            if (result.getCategories() != null && !result.getCategories().isEmpty()) {
                log.info("Folder classification success: {} categories", result.getCategories().size());

                // 异步存储分类结果
                try {
                    embeddingService.storeFileClassifications(request, result);
                } catch (Exception e) {
                    log.warn("Failed to store file classifications: {}", e.getMessage());
                }

                return result;
            }
        } catch (Exception e) {
            log.warn("Failed to parse AI response as JSON: {}", e.getMessage());
        }

        return fallbackClassifyFolder(request);
    }

    // ==================== Prompt 构建 ====================

    private String buildBookmarkPrompt(List<BookmarkClassificationRequest.BookmarkItem> bookmarks) {
        StringBuilder sb = new StringBuilder();
        sb.append("你是一个智能书签分类助手。请对用户提供的书签列表进行分类整理。\n\n");
        sb.append("书签列表：\n");
        for (BookmarkClassificationRequest.BookmarkItem bm : bookmarks) {
            sb.append("- ").append(bm.getKeyword()).append(" → ").append(bm.getUrl()).append("\n");
        }
        sb.append("\n请按以下规则分类：\n");
        sb.append("1. 自定义合适的类别名称（如 开发工具、新闻资讯、AI平台、设计资源、项目管理 等）\n");
        sb.append("2. 同类书签合并到同一类别下\n");
        sb.append("3. 为每个类别生成一个简洁的类别名称\n");
        sb.append("\n返回严格的 JSON 格式（不要包含 markdown 代码块标记）：\n");
        sb.append("{\n");
        sb.append("  \"categories\": [\n");
        sb.append("    {\n");
        sb.append("      \"name\": \"类别名称\",\n");
        sb.append("      \"items\": [\n");
        sb.append("        {\"keyword\": \"...\", \"summary\": \"简短描述\"}\n");
        sb.append("      ]\n");
        sb.append("    }\n");
        sb.append("  ]\n");
        sb.append("}\n");
        return sb.toString();
    }

    private String buildFolderPrompt(String folderPath, List<FolderClassificationRequest.FileItem> files) {
        StringBuilder sb = new StringBuilder();
        sb.append("分析以下文件夹中的文件，按用途分类。\n\n");
        sb.append("文件夹：").append(folderPath).append("\n\n");
        sb.append("文件列表：\n");
        for (FolderClassificationRequest.FileItem file : files) {
            sb.append("- ").append(file.getName()).append(" (").append(file.getPath()).append(")\n");
        }
        sb.append("\n请按以下规则分类：\n");
        sb.append("1. 根据文件名、扩展名和路径判断文件用途\n");
        sb.append("2. 自定义合适的类别名称（如 工作文档、项目代码、媒体文件、配置文件 等）\n");
        sb.append("3. 同类文件合并到同一类别下\n");
        sb.append("\n返回严格的 JSON 格式（不要包含 markdown 代码块标记）：\n");
        sb.append("{\n");
        sb.append("  \"folderPath\": \"").append(folderPath).append("\",\n");
        sb.append("  \"categories\": [\n");
        sb.append("    {\n");
        sb.append("      \"category\": \"类别名称\",\n");
        sb.append("      \"subCategory\": \"子类别\",\n");
        sb.append("      \"files\": [\n");
        sb.append("        {\"fileName\": \"...\", \"filePath\": \"...\", \"summary\": \"简短描述\"}\n");
        sb.append("      ]\n");
        sb.append("    }\n");
        sb.append("  ]\n");
        sb.append("}\n");
        return sb.toString();
    }

    // ==================== 降级逻辑 ====================

    private BookmarkClassificationResult fallbackClassifyBookmarks(List<BookmarkClassificationRequest.BookmarkItem> bookmarks) {
        // 按域名的顶级域或子域名简单归类
        Map<String, List<BookmarkClassificationResult.CategoryItem>> groups = new LinkedHashMap<>();

        for (BookmarkClassificationRequest.BookmarkItem bm : bookmarks) {
            String category = guessCategoryFromUrl(bm.getUrl());
            groups.computeIfAbsent(category, k -> new ArrayList<>())
                    .add(createCategoryItem(bm));
        }

        BookmarkClassificationResult result = new BookmarkClassificationResult();
        result.setCategories(groups.entrySet().stream().map(entry -> {
            BookmarkClassificationResult.CategoryGroup group = new BookmarkClassificationResult.CategoryGroup();
            group.setName(entry.getKey());
            group.setItems(entry.getValue());
            return group;
        }).collect(Collectors.toList()));

        return result;
    }

    private FolderClassificationResult fallbackClassifyFolder(FolderClassificationRequest request) {
        // 按文件扩展名归类
        Map<String, List<FolderClassificationResult.FileItem>> groups = new LinkedHashMap<>();

        for (FolderClassificationRequest.FileItem file : request.getFiles()) {
            String category = guessCategoryFromExt(file.getExt());
            groups.computeIfAbsent(category, k -> new ArrayList<>())
                    .add(createFolderFileItem(file));
        }

        FolderClassificationResult result = new FolderClassificationResult();
        result.setFolderPath(request.getFolderPath());
        result.setCategories(groups.entrySet().stream().map(entry -> {
            FolderClassificationResult.CategoryGroup group = new FolderClassificationResult.CategoryGroup();
            group.setCategory(entry.getKey());
            group.setFiles(entry.getValue());
            return group;
        }).collect(Collectors.toList()));

        return result;
    }

    private BookmarkClassificationResult.CategoryItem createCategoryItem(BookmarkClassificationRequest.BookmarkItem bm) {
        BookmarkClassificationResult.CategoryItem item = new BookmarkClassificationResult.CategoryItem();
        item.setKeyword(bm.getKeyword());
        item.setSummary("来自 " + bm.getUrl());
        return item;
    }

    private FolderClassificationResult.FileItem createFolderFileItem(FolderClassificationRequest.FileItem file) {
        FolderClassificationResult.FileItem item = new FolderClassificationResult.FileItem();
        item.setFileName(file.getName());
        item.setFilePath(file.getPath());
        item.setSummary(file.getName() + " (" + file.getExt() + " 文件)");
        return item;
    }

    private String guessCategoryFromUrl(String url) {
        String u = url.toLowerCase();
        if (u.contains("github") || u.contains("gitlab") || u.contains("code")) return "开发工具";
        if (u.contains("zhihu") || u.contains("weibo") || u.contains("bilibili")) return "社交/社区";
        if (u.contains("baidu") || u.contains("google") || u.contains("bing")) return "搜索引擎";
        if (u.contains("openai") || u.contains("chatgpt") || u.contains("claude")) return "AI平台";
        if (u.contains("doubao") || u.contains("kimi") || u.contains("deepseek")) return "AI平台";
        if (u.contains("youtube") || u.contains("bilibili") || u.contains("douyin")) return "视频/娱乐";
        if (u.contains("taobao") || u.contains("jd.com") || u.contains("pinduoduo")) return "购物";
        return "其他";
    }

    private String guessCategoryFromExt(String ext) {
        if (ext == null) return "其他";
        String e = ext.toLowerCase();
        if (List.of(".java", ".py", ".js", ".ts", ".vue", ".go", ".rs", ".c", ".cpp", ".cs", ".kt").contains(e)) return "代码文件";
        if (List.of(".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt").contains(e)) return "文档";
        if (List.of(".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg", ".webp").contains(e)) return "图片";
        if (List.of(".mp4", ".avi", ".mkv", ".mov", ".wmv").contains(e)) return "视频";
        if (List.of(".mp3", ".wav", ".flac", ".aac").contains(e)) return "音频";
        if (List.of(".zip", ".rar", ".7z", ".tar", ".gz").contains(e)) return "压缩包";
        if (List.of(".json", ".xml", ".yaml", ".yml", ".toml", ".properties", ".ini", ".conf").contains(e)) return "配置文件";
        if (List.of(".bat", ".cmd", ".ps1", ".sh", ".exe", ".msi").contains(e)) return "可执行文件";
        return "其他";
    }

    // ==================== JSON 提取工具 ====================

    private String extractJson(String text) {
        if (text == null) return "{}";
        // 去掉 markdown 代码块标记
        text = text.replaceAll("```(?:json)?\\s*", "").trim();
        // 找到第一个 { 和最后一个 }
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return text.substring(start, end + 1);
        }
        return text;
    }
}
