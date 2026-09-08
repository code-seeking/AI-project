package com.chatportal.ai.entity;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class BookmarkEmbedding {
    private Integer id;
    private String keyword;
    private String url;
    private Integer categoryId;
    private String sourceText;
    private Object embedding;
    private String modelName;
    private String aiSummary;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
