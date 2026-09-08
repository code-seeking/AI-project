package com.chatportal.ai.dto;

import lombok.Data;
import java.util.List;

@Data
public class KnowledgeQueryResult {
    private String answer;
    private List<KnowledgeSearchResult.ChunkMatch> chunks;
    private int totalChunks;
}
