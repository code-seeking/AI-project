package com.chatportal.ai.dto;

import lombok.Data;
import java.util.List;

@Data
public class KnowledgeSearchResult {
    private List<ChunkMatch> chunks;
    private int totalChunks;

    @Data
    public static class ChunkMatch {
        private String id;
        private String docId;
        private int chunkIndex;
        private String text;
        private double score;
    }
}
