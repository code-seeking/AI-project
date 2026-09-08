package com.chatportal.ai.dto;

import lombok.Data;
import java.util.List;

@Data
public class FolderClassificationRequest {
    private String folderPath;
    private List<FileItem> files;

    @Data
    public static class FileItem {
        private String name;
        private String path;
        private String ext;
    }
}
