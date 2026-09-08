package com.chatportal.ai.controller;

import com.chatportal.ai.dto.*;
import com.chatportal.ai.service.AiCallTemplate;
import com.chatportal.ai.service.ClassificationService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/classify")
public class AnalysisController {

    private final ClassificationService classificationService;
    private final AiCallTemplate aiCallTemplate;

    public AnalysisController(ClassificationService classificationService,
                              AiCallTemplate aiCallTemplate) {
        this.classificationService = classificationService;
        this.aiCallTemplate = aiCallTemplate;
    }

    /**
     * 智能分类书签
     */
    @PostMapping("/bookmarks")
    public ApiResult<BookmarkClassificationResult> classifyBookmarks(@RequestBody BookmarkClassificationRequest request) {
        log.info("Classify bookmarks: {} items", request.getBookmarks() != null ? request.getBookmarks().size() : 0);
        try {
            BookmarkClassificationResult result = classificationService.classifyBookmarks(request);
            return ApiResult.success(result);
        } catch (Exception e) {
            log.error("Failed to classify bookmarks: {}", e.getMessage(), e);
            return ApiResult.error(500, "分类失败: " + e.getMessage());
        }
    }

    /**
     * 智能分类文件夹文件
     */
    @PostMapping("/folder")
    public ApiResult<FolderClassificationResult> classifyFolder(@RequestBody FolderClassificationRequest request) {
        log.info("Classify folder: {} with {} files", request.getFolderPath(),
                request.getFiles() != null ? request.getFiles().size() : 0);
        try {
            FolderClassificationResult result = classificationService.classifyFolder(request);
            return ApiResult.success(result);
        } catch (Exception e) {
            log.error("Failed to classify folder: {}", e.getMessage(), e);
            return ApiResult.error(500, "分类失败: " + e.getMessage());
        }
    }

    /**
     * 通用 AI 对话
     */
    @PostMapping("/chat")
    public ApiResult<String> chat(@RequestBody ChatRequest request) {
        log.info("Chat request received");
        try {
            String prompt = request.getUserMessage();
            if (request.getSystemPrompt() != null && !request.getSystemPrompt().isBlank()) {
                prompt = request.getSystemPrompt() + "\n\n" + request.getUserMessage();
            }
            String result = aiCallTemplate.call(prompt);
            if (result != null) {
                return ApiResult.success(result);
            }
            return ApiResult.error(500, "AI 调用返回空结果");
        } catch (Exception e) {
            log.error("Chat failed: {}", e.getMessage(), e);
            return ApiResult.error(500, "对话失败: " + e.getMessage());
        }
    }

    /**
     * 健康检查
     */
    @GetMapping("/health")
    public ApiResult<String> health() {
        return ApiResult.success("AI Service is running");
    }
}
