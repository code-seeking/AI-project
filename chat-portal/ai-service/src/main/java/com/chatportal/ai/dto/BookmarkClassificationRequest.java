package com.chatportal.ai.dto;

import lombok.Data;
import java.util.List;

@Data
public class BookmarkClassificationRequest {
    private List<BookmarkItem> bookmarks;

    @Data
    public static class BookmarkItem {
        private String keyword;
        private String url;
    }
}
