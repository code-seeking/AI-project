package com.chatportal.ai.dto;

import lombok.Data;

@Data
public class KnowledgeQueryRequest {
    private String question;
    private int topK = 5;
}
