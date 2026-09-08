package com.chatportal.ai.service;

import com.chatportal.ai.config.AppConfig;
import com.chatportal.ai.dto.BookmarkClassificationRequest;
import com.chatportal.ai.dto.BookmarkClassificationResult;
import com.chatportal.ai.dto.FolderClassificationRequest;
import com.chatportal.ai.dto.FolderClassificationResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.embedding.EmbeddingResponse;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
public class EmbeddingService {

    private final EmbeddingModel embeddingModel;
    private final JdbcTemplate vectorJdbcTemplate;
    private final AppConfig appConfig;
    private final boolean available;

    public EmbeddingService(EmbeddingModel embeddingModel,
                            @Qualifier("vectorJdbcTemplate") @Nullable JdbcTemplate vectorJdbcTemplate,
                            AppConfig appConfig) {
        this.embeddingModel = embeddingModel;
        this.vectorJdbcTemplate = vectorJdbcTemplate;
        this.appConfig = appConfig;
        this.available = vectorJdbcTemplate != null && appConfig.getVector().isEnabled();
    }

    public boolean isAvailable() {
        return available;
    }

    /**
     * 生成文本的向量 embedding
     */
    public float[] generateEmbedding(String text) {
        EmbeddingResponse response = embeddingModel.embedForResponse(List.of(text));
        return response.getResult().getOutput();
    }

    /**
     * 存储书签分类结果到向量数据库
     */
    public void storeBookmarkEmbeddings(List<BookmarkClassificationRequest.BookmarkItem> bookmarks,
                                        BookmarkClassificationResult result) {
        if (!available) {
            log.debug("Vector service not available, skipping bookmark embedding storage");
            return;
        }

        try {
            // 为每个类别创建或获取 category_id
            for (BookmarkClassificationResult.CategoryGroup category : result.getCategories()) {
                // 插入或获取分类
                Integer categoryId = getOrCreateCategory(category.getName(), null);

                for (BookmarkClassificationResult.CategoryItem item : category.getItems()) {
                    // 查找对应的原始 bookmark
                    BookmarkClassificationRequest.BookmarkItem original = bookmarks.stream()
                            .filter(b -> b.getKeyword().equals(item.getKeyword()))
                            .findFirst().orElse(null);

                    if (original == null) continue;

                    String sourceText = original.getKeyword() + " " + original.getUrl() + " " + item.getSummary();
                    float[] embedding = generateEmbedding(sourceText);

                    // 插入到 bookmark_embedding 表
                    String sql = """
                        INSERT INTO bookmark_embedding (keyword, url, category_id, source_text, embedding, model_name, ai_summary, updated_at)
                        VALUES (?, ?, ?::int, ?, ?::vector, ?, ?, NOW())
                        ON CONFLICT DO NOTHING
                        """;

                    String vectorStr = floatArrayToVectorString(embedding);
                    vectorJdbcTemplate.update(sql,
                            original.getKeyword(),
                            original.getUrl(),
                            categoryId,
                            sourceText,
                            vectorStr,
                            "nomic-embed-text",
                            item.getSummary());
                }
            }

            log.info("Stored embeddings for {} bookmarks across {} categories",
                    bookmarks.size(), result.getCategories().size());
        } catch (Exception e) {
            log.error("Failed to store bookmark embeddings: {}", e.getMessage());
        }
    }

    /**
     * 存储文件分类结果到向量数据库
     */
    public void storeFileClassifications(FolderClassificationRequest request,
                                         FolderClassificationResult result) {
        if (!available) {
            log.debug("Vector service not available, skipping file classification storage");
            return;
        }

        try {
            for (FolderClassificationResult.CategoryGroup category : result.getCategories()) {
                for (FolderClassificationResult.FileItem file : category.getFiles()) {
                    String sourceText = file.getFileName() + " " + file.getSummary() + " " + category.getCategory();
                    float[] embedding = generateEmbedding(sourceText);

                    String ext = "";
                    if (file.getFileName() != null) {
                        int dotIdx = file.getFileName().lastIndexOf('.');
                        if (dotIdx >= 0) {
                            ext = file.getFileName().substring(dotIdx);
                        }
                    }

                    String sql = """
                        INSERT INTO file_classification (file_path, file_name, file_ext, category, sub_category, ai_summary, embedding)
                        VALUES (?, ?, ?, ?, ?, ?, ?::vector)
                        ON CONFLICT DO NOTHING
                        """;

                    String vectorStr = floatArrayToVectorString(embedding);
                    vectorJdbcTemplate.update(sql,
                            file.getFilePath(),
                            file.getFileName(),
                            ext,
                            category.getCategory(),
                            category.getSubCategory(),
                            file.getSummary(),
                            vectorStr);
                }
            }

            log.info("Stored classifications for {} files across {} categories",
                    result.getCategories().stream().mapToInt(c -> c.getFiles().size()).sum(),
                    result.getCategories().size());
        } catch (Exception e) {
            log.error("Failed to store file classifications: {}", e.getMessage());
        }
    }

    // ==================== Private helpers ====================

    private Integer getOrCreateCategory(String name, String subCategory) {
        try {
            // 先查找
            String selectSql = "SELECT id FROM bookmark_category WHERE category = ? AND (sub_category IS NULL OR sub_category = ?) LIMIT 1";
            List<Integer> ids = vectorJdbcTemplate.queryForList(selectSql, Integer.class, name, subCategory != null ? subCategory : "");
            if (!ids.isEmpty()) {
                return ids.get(0);
            }

            // 不存在则创建
            String insertSql = "INSERT INTO bookmark_category (category, sub_category) VALUES (?, ?) RETURNING id";
            return vectorJdbcTemplate.queryForObject(insertSql, Integer.class, name, subCategory);
        } catch (Exception e) {
            log.warn("Failed to get/create category {}: {}", name, e.getMessage());
            return null;
        }
    }

    private String floatArrayToVectorString(float[] embedding) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < embedding.length; i++) {
            if (i > 0) sb.append(",");
            sb.append(embedding[i]);
        }
        sb.append("]");
        return sb.toString();
    }
}
