package com.chatportal.ai.dto;

import lombok.Data;

@Data
public class KnowledgeSearchRequest {
    private String query;
    private int topK = 5;
}
