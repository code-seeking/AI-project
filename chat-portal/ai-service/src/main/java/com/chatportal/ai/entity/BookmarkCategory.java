package com.chatportal.ai.entity;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class BookmarkCategory {
    private Integer id;
    private String category;
    private String subCategory;
    private String color;
    private LocalDateTime createdAt;
}
