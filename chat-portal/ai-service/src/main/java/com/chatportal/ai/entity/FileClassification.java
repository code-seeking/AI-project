package com.chatportal.ai.entity;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class FileClassification {
    private Integer id;
    private String filePath;
    private String fileName;
    private String fileExt;
    private String category;
    private String subCategory;
    private String aiSummary;
    private Object embedding;
    private LocalDateTime createdAt;
}
