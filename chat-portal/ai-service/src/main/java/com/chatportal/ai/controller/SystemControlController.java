package com.chatportal.ai.controller;

import com.chatportal.ai.tool.ToolContext;
import com.chatportal.ai.tool.ToolRegistry;
import com.chatportal.ai.tool.ToolResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 系统通用控制 REST API — Phase 1 通用控制增强
 * <p>
 * 提供统一的接口让 AI/用户调用系统工具：文件操作、命令执行、Git 操作等。
 */
@Slf4j
@RestController
@RequestMapping("/system-control")
@RequiredArgsConstructor
public class SystemControlController {

    private final ToolRegistry toolRegistry;

    /** 执行系统工具 */
    @PostMapping("/execute")
    public ResponseEntity<Map<String, Object>> executeTool(
            @RequestHeader(name = "X-Session-Id", defaultValue = "default") String sessionId,
            @RequestBody Map<String, Object> request) {

        String toolName = (String) request.getOrDefault("tool", "");
        String parameters = request.containsKey("parameters")
                ? serializeParams(request.get("parameters"))
                : "{}";
        String workspaceDir = (String) request.getOrDefault("workspaceDir",
                System.getProperty("user.dir", ""));

        if (toolName.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "tool 不能为空"));
        }

        ToolContext ctx = new ToolContext(sessionId, "system", workspaceDir);
        ToolResult result = toolRegistry.execute(toolName, ctx, parameters);

        return ResponseEntity.ok(Map.of(
                "success", result.success(),
                "message", result.message(),
                "data", result.data()
        ));
    }

    /** 获取所有可用工具列表 */
    @GetMapping("/tools")
    public ResponseEntity<List<Map<String, String>>> listTools() {
        return ResponseEntity.ok(toolRegistry.getToolDescriptions());
    }

    /** 获取工具详情 */
    @GetMapping("/tools/{toolName}")
    public ResponseEntity<Map<String, String>> getToolDetail(@PathVariable String toolName) {
        return toolRegistry.getTool(toolName)
                .map(tool -> ResponseEntity.ok(Map.of(
                        "name", tool.getName(),
                        "description", tool.getDescription(),
                        "parameters", tool.getParameterSchema()
                )))
                .orElse(ResponseEntity.notFound().build());
    }

    @SuppressWarnings("unchecked")
    private String serializeParams(Object params) {
        if (params instanceof String s) return s;
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper()
                    .writeValueAsString(params);
        } catch (Exception e) {
            return "{}";
        }
    }
}
