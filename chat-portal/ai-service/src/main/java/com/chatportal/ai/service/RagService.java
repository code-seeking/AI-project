package com.chatportal.ai.service;

import com.chatportal.ai.config.AppConfig;
import com.chatportal.ai.dto.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Service
public class RagService {

    private final EmbeddingModel embeddingModel;
    private final JdbcTemplate vectorJdbcTemplate;
    private final AiCallTemplate aiCallTemplate;
    private final AppConfig appConfig;
    private final boolean available;

    public RagService(EmbeddingModel embeddingModel,
                      @Qualifier("vectorJdbcTemplate") @Nullable JdbcTemplate vectorJdbcTemplate,
                      AiCallTemplate aiCallTemplate,
                      AppConfig appConfig) {
        this.embeddingModel = embeddingModel;
        this.vectorJdbcTemplate = vectorJdbcTemplate;
        this.aiCallTemplate = aiCallTemplate;
        this.appConfig = appConfig;
        this.available = vectorJdbcTemplate != null && appConfig.getVector().isEnabled();
    }

    public boolean isAvailable() {
        return available;
    }

    /**
     * 生成文本 embedding 向量
     */
    public float[] generateEmbedding(String text) {
        var response = embeddingModel.embedForResponse(List.of(text));
        return response.getResult().getOutput();
    }

    /**
     * 将文本块及其 embedding 存储到 pgvector
     */
    public int storeChunkEmbeddings(KnowledgeEmbeddingRequest request) {
        if (!available) {
            log.warn("Vector service not available, skipping embedding storage");
            return 0;
        }
        int count = 0;
        try {
            for (var chunk : request.getChunks()) {
                float[] embedding = generateEmbedding(chunk.getText());
                String vectorStr = floatArrayToVectorString(embedding);

                String sql = """
                    INSERT INTO knowledge_chunks (id, doc_id, chunk_index, text, embedding, created_at)
                    VALUES (?, ?, ?, ?, ?::vector, NOW())
                    ON CONFLICT (id) DO UPDATE SET
                      text = EXCLUDED.text,
                      embedding = EXCLUDED.embedding,
                      chunk_index = EXCLUDED.chunk_index
                    """;

                vectorJdbcTemplate.update(sql,
                        chunk.getId(),
                        chunk.getDocId(),
                        chunk.getChunkIndex(),
                        chunk.getText(),
                        vectorStr);
                count++;
            }
            log.info("Stored {} chunk embeddings", count);
        } catch (Exception e) {
            log.error("Failed to store chunk embeddings: {}", e.getMessage());
        }
        return count;
    }

    /**
     * 向量相似度搜索
     */
    public KnowledgeSearchResult search(KnowledgeSearchRequest request) {
        KnowledgeSearchResult result = new KnowledgeSearchResult();
        result.setChunks(new ArrayList<>());

        if (!available) {
            log.warn("Vector service not available for search");
            return result;
        }

        try {
            // 1. 为查询文本生成 embedding
            float[] queryEmbedding = generateEmbedding(request.getQuery());
            String vectorStr = floatArrayToVectorString(queryEmbedding);

            // 2. 向量搜索 topK
            String sql = """
                SELECT id, doc_id, chunk_index, text,
                       1 - (embedding <=> ?::vector) AS similarity
                FROM knowledge_chunks
                ORDER BY embedding <=> ?::vector
                LIMIT ?
                """;

            List<KnowledgeSearchResult.ChunkMatch> matches = vectorJdbcTemplate.query(
                    sql,
                    new Object[]{vectorStr, vectorStr, request.getTopK()},
                    (rs, rowNum) -> {
                        KnowledgeSearchResult.ChunkMatch m = new KnowledgeSearchResult.ChunkMatch();
                        m.setId(rs.getString("id"));
                        m.setDocId(rs.getString("doc_id"));
                        m.setChunkIndex(rs.getInt("chunk_index"));
                        m.setText(rs.getString("text"));
                        m.setScore(rs.getDouble("similarity"));
                        return m;
                    });

            result.setChunks(matches);

            // 3. 获取总 chunk 数
            Integer total = vectorJdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM knowledge_chunks", Integer.class);
            result.setTotalChunks(total != null ? total : 0);

            log.info("Vector search found {} matches for query (length={})",
                    matches.size(), request.getQuery().length());
        } catch (Exception e) {
            log.error("Vector search failed: {}", e.getMessage());
        }

        return result;
    }

    /**
     * 完整 RAG 问答：向量搜索 → 构建上下文 → AI 生成回答
     */
    public KnowledgeQueryResult query(KnowledgeQueryRequest request) {
        KnowledgeQueryResult result = new KnowledgeQueryResult();

        // 1. 向量搜索
        KnowledgeSearchRequest searchReq = new KnowledgeSearchRequest();
        searchReq.setQuery(request.getQuestion());
        searchReq.setTopK(request.getTopK());
        KnowledgeSearchResult searchResult = search(searchReq);

        result.setChunks(searchResult.getChunks());
        result.setTotalChunks(searchResult.getTotalChunks());

        if (searchResult.getChunks().isEmpty()) {
            return result;
        }

        // 2. 构建上下文
        StringBuilder context = new StringBuilder();
        for (int i = 0; i < searchResult.getChunks().size(); i++) {
            var chunk = searchResult.getChunks().get(i);
            context.append("[").append(i + 1).append("] ").append(chunk.getText()).append("\n\n---\n\n");
        }

        // 3. AI 生成回答
        String systemPrompt = "你是一个基于知识库的知识问答助手。请严格基于以下参考资料回答用户问题。"
                + "如果参考资料不足以回答问题，请如实说明。请引用相关参考资料编号 [1][2] 等。";
        String userMessage = "参考资料：\n" + context + "\n问题：" + request.getQuestion() + "\n\n请用中文回答：";

        String answer = aiCallTemplate.call(systemPrompt + "\n\n" + userMessage);
        result.setAnswer(answer);

        log.info("RAG query completed: questionLen={}, chunks={}, hasAnswer={}",
                request.getQuestion().length(), searchResult.getChunks().size(), answer != null);

        return result;
    }

    /**
     * 删除某个文档的所有 chunk embedding
     */
    public int deleteEmbeddingsForDoc(String docId) {
        if (!available) {
            return 0;
        }
        try {
            int deleted = vectorJdbcTemplate.update(
                    "DELETE FROM knowledge_chunks WHERE doc_id = ?", docId);
            log.info("Deleted {} chunk embeddings for docId={}", deleted, docId);
            return deleted;
        } catch (Exception e) {
            log.error("Failed to delete embeddings for doc {}: {}", docId, e.getMessage());
            return 0;
        }
    }

    // ==================== Private helpers ====================

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
