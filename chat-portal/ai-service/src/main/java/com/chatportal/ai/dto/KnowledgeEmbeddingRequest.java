package com.chatportal.ai.dto;

import lombok.Data;
import java.util.List;

@Data
public class KnowledgeEmbeddingRequest {
    private List<ChunkItem> chunks;

    @Data
    public static class ChunkItem {
        private String id;
        private String docId;
        private int chunkIndex;
        private String text;
    }
}
