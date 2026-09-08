package com.chatportal.ai.controller;

import com.chatportal.ai.dto.*;
import com.chatportal.ai.service.RagService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/rag")
public class RagController {

    private final RagService ragService;

    public RagController(RagService ragService) {
        this.ragService = ragService;
    }

    /**
     * 存储知识块 embedding 到向量数据库
     */
    @PostMapping("/knowledge/embeddings")
    public ApiResult<Integer> storeEmbeddings(@RequestBody KnowledgeEmbeddingRequest request) {
        log.info("Store embeddings for {} chunks", request.getChunks() != null ? request.getChunks().size() : 0);
        try {
            int count = ragService.storeChunkEmbeddings(request);
            return ApiResult.success(count, "已存储 " + count + " 个文本块的 embedding");
        } catch (Exception e) {
            log.error("Failed to store embeddings: {}", e.getMessage(), e);
            return ApiResult.error(500, "存储失败: " + e.getMessage());
        }
    }

    /**
     * 向量相似度搜索
     */
    @PostMapping("/knowledge/search")
    public ApiResult<KnowledgeSearchResult> search(@RequestBody KnowledgeSearchRequest request) {
        log.info("Vector search: queryLen={}, topK={}", request.getQuery() != null ? request.getQuery().length() : 0, request.getTopK());
        try {
            KnowledgeSearchResult result = ragService.search(request);
            return ApiResult.success(result, "找到 " + result.getChunks().size() + " 个相关文本块");
        } catch (Exception e) {
            log.error("Vector search failed: {}", e.getMessage(), e);
            return ApiResult.error(500, "搜索失败: " + e.getMessage());
        }
    }

    /**
     * 完整 RAG 问答：向量搜索 → AI 生成回答
     */
    @PostMapping("/knowledge/query")
    public ApiResult<KnowledgeQueryResult> query(@RequestBody KnowledgeQueryRequest request) {
        log.info("RAG query: questionLen={}, topK={}",
                request.getQuestion() != null ? request.getQuestion().length() : 0, request.getTopK());
        try {
            KnowledgeQueryResult result = ragService.query(request);
            boolean hasAnswer = result.getAnswer() != null;
            return ApiResult.success(result, hasAnswer ? "AI 回答已生成" : "找到 " + (result.getChunks() != null ? result.getChunks().size() : 0) + " 个相关文本块");
        } catch (Exception e) {
            log.error("RAG query failed: {}", e.getMessage(), e);
            return ApiResult.error(500, "查询失败: " + e.getMessage());
        }
    }

    /**
     * 删除文档的所有 embedding（当文档被删除时调用）
     */
    @DeleteMapping("/knowledge/embeddings/{docId}")
    public ApiResult<Integer> deleteEmbeddings(@PathVariable String docId) {
        log.info("Delete embeddings for docId={}", docId);
        try {
            if (!ragService.isAvailable()) {
                return ApiResult.success(0, "向量服务不可用");
            }
            int deleted = ragService.deleteEmbeddingsForDoc(docId);
            return ApiResult.success(deleted, "已删除 " + deleted + " 个 embedding");
        } catch (Exception e) {
            log.error("Failed to delete embeddings: {}", e.getMessage());
            return ApiResult.error(500, "删除失败: " + e.getMessage());
        }
    }
}
