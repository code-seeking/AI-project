package com.chatportal.ai.dto;

import lombok.Data;
import java.util.List;

@Data
public class BookmarkClassificationResult {
    private List<CategoryGroup> categories;

    @Data
    public static class CategoryGroup {
        private String name;
        private List<CategoryItem> items;
    }

    @Data
    public static class CategoryItem {
        private String keyword;
        private String summary;
    }
}
