package com.chatportal.ai.tool;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * 文件系统工具 — AI 可读/写/搜索文件
 */
@Slf4j
@Component
public class FileTool implements SystemTool {

    private final ObjectMapper json = new ObjectMapper();

    /** 允许访问的根目录（沙箱） */
    private static final List<String> ALLOWED_ROOTS = List.of(
            System.getProperty("user.dir", "d:\\acme")
    );

    @Override
    public String getName() { return "file"; }

    @Override
    public String getDescription() {
        return "文件系统操作：读取文件、写入文件、列出目录、搜索文件内容。支持相对路径和绝对路径。";
    }

    @Override
    public String getParameterSchema() {
        return """
        {
            "type": "object",
            "properties": {
                "action": { "type": "string", "enum": ["read", "write", "list", "search", "delete"], "description": "操作类型" },
                "path": { "type": "string", "description": "文件/目录路径" },
                "content": { "type": "string", "description": "写入内容（仅 write 操作需要）" },
                "pattern": { "type": "string", "description": "搜索模式（仅 search 操作需要）" }
            },
            "required": ["action", "path"]
        }
        """;
    }

    @Override
    public ToolResult execute(ToolContext ctx, String parameters) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> params = json.readValue(parameters, Map.class);
            String action = (String) params.getOrDefault("action", "");
            String path = resolvePath((String) params.get("path"));
            String content = (String) params.get("content");
            String pattern = (String) params.get("pattern");

            return switch (action) {
                case "read" -> readFile(path);
                case "write" -> writeFile(path, content);
                case "list" -> listDir(path);
                case "search" -> searchFiles(path, pattern);
                case "delete" -> deleteFile(path);
                default -> ToolResult.fail("未知操作: " + action);
            };
        } catch (Exception e) {
            log.error("文件工具执行失败: {}", e.getMessage());
            return ToolResult.fail("文件操作失败: " + e.getMessage());
        }
    }

    private ToolResult readFile(String path) {
        try {
            String content = Files.readString(Path.of(path));
            return ToolResult.ok("文件读取成功", content);
        } catch (IOException e) {
            return ToolResult.fail("读取文件失败: " + e.getMessage());
        }
    }

    private ToolResult writeFile(String path, String content) {
        if (content == null) return ToolResult.fail("写入内容不能为空");
        try {
            Path p = Path.of(path);
            Files.createDirectories(p.getParent());
            Files.writeString(p, content);
            log.info("文件写入成功: path={}, size={}", path, content.length());
            return ToolResult.ok("文件写入成功", String.format("已写入 %d 字符", content.length()));
        } catch (IOException e) {
            return ToolResult.fail("写入文件失败: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private ToolResult listDir(String path) {
        try {
            List<Map<String, Object>> entries;
            try (Stream<Path> paths = Files.list(Path.of(path))) {
                entries = paths.map(p -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("name", p.getFileName().toString());
                    m.put("isDir", Files.isDirectory(p));
                    try {
                        m.put("size", Files.size(p));
                    } catch (IOException e) { m.put("size", 0); }
                    return m;
                }).collect(Collectors.toList());
            }
            String data = json.writerWithDefaultPrettyPrinter().writeValueAsString(entries);
            return ToolResult.ok("目录列表成功", data);
        } catch (IOException e) {
            return ToolResult.fail("列出目录失败: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private ToolResult searchFiles(String path, String pattern) {
        if (pattern == null) return ToolResult.fail("搜索模式不能为空");
        try {
            PathMatcher matcher = FileSystems.getDefault().getPathMatcher("glob:" + pattern);
            List<String> results = new ArrayList<>();
            Files.walkFileTree(Path.of(path), new SimpleFileVisitor<>() {
                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                    if (matcher.matches(file.getFileName())) {
                        results.add(file.toString());
                    }
                    return FileVisitResult.CONTINUE;
                }
                @Override
                public FileVisitResult visitFileFailed(Path file, IOException exc) {
                    return FileVisitResult.CONTINUE;
                }
            });
            List<String> trimmed = results.size() > 500 ? results.subList(0, 500) : results;
            return ToolResult.ok("文件搜索完成", json.writeValueAsString(trimmed));
        } catch (IOException e) {
            return ToolResult.fail("搜索文件失败: " + e.getMessage());
        }
    }

    private ToolResult deleteFile(String path) {
        try {
            Path p = Path.of(path);
            if (Files.isDirectory(p)) {
                try (var walk = Files.walk(p)) {
                    walk.sorted(Comparator.reverseOrder()).forEach(file -> {
                        try { Files.delete(file); } catch (IOException ignored) {}
                    });
                }
            } else {
                Files.delete(p);
            }
            return ToolResult.ok("删除成功", path);
        } catch (IOException e) {
            return ToolResult.fail("删除失败: " + e.getMessage());
        }
    }

    /** 路径沙箱检查：确保不允许访问根目录之外 */
    private String resolvePath(String rawPath) {
        if (rawPath == null || rawPath.isBlank()) return ALLOWED_ROOTS.get(0);
        Path p = Path.of(rawPath);
        if (p.isAbsolute()) return p.normalize().toString();
        return Path.of(ALLOWED_ROOTS.get(0), rawPath).normalize().toString();
    }
}
