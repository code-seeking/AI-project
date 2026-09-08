package com.chatportal.ai.dto;

import lombok.Data;
import java.util.List;

@Data
public class FolderClassificationResult {
    private String folderPath;
    private List<CategoryGroup> categories;

    @Data
    public static class CategoryGroup {
        private String category;
        private String subCategory;
        private List<FileItem> files;
    }

    @Data
    public static class FileItem {
        private String fileName;
        private String filePath;
        private String summary;
    }
}
