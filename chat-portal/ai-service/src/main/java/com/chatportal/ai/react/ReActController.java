package com.chatportal.ai.react;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * ReAct Agent REST API — 执行推理 + 行动循环
 */
@Slf4j
@RestController
@RequestMapping("/react")
@RequiredArgsConstructor
public class ReActController {

    private final ReActOrchestrator orchestrator;

    /** 执行 ReAct 任务 */
    @PostMapping("/execute")
    public ResponseEntity<Map<String, Object>> execute(@RequestBody Map<String, Object> request) {
        String sessionId = (String) request.getOrDefault("sessionId",
                java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 16));
        String goal = (String) request.getOrDefault("goal", "");
        int maxSteps = request.containsKey("maxSteps")
                ? ((Number) request.get("maxSteps")).intValue()
                : 10;

        if (goal.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "goal 不能为空"));
        }

        log.info("ReAct 执行请求: sessionId={}, goal={}, maxSteps={}", sessionId, goal, maxSteps);

        ReActOrchestrator.ReActResult result = orchestrator.execute(sessionId, goal, maxSteps);

        return ResponseEntity.ok(buildResponse(result));
    }

    /** 获取会话状态 */
    @GetMapping("/session/{sessionId}")
    public ResponseEntity<Map<String, Object>> getSession(@PathVariable String sessionId) {
        ReActOrchestrator.ReActSession session = orchestrator.getSession(sessionId);
        if (session == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of(
                "sessionId", session.getSessionId(),
                "status", session.getStatus(),
                "messageCount", session.getMessageHistory().size()
        ));
    }

    /** 清除会话 */
    @DeleteMapping("/session/{sessionId}")
    public ResponseEntity<Map<String, String>> clearSession(@PathVariable String sessionId) {
        orchestrator.clearSession(sessionId);
        return ResponseEntity.ok(Map.of("message", "会话已清除: " + sessionId));
    }

    private Map<String, Object> buildResponse(ReActOrchestrator.ReActResult result) {
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("sessionId", result.sessionId());
        resp.put("status", result.status());
        resp.put("stepsExecuted", result.stepsExecuted());
        resp.put("totalTimeMs", result.totalTimeMs());
        resp.put("finalAnswer", result.finalAnswer());

        // 构建步骤摘要
        List<Map<String, Object>> steps = result.messageHistory().stream()
                .filter(e -> List.of("assistant", "observation").contains(e.getKey()))
                .map(e -> {
                    Map<String, Object> step = new LinkedHashMap<>();
                    step.put("type", e.getKey());
                    String content = e.getValue();
                    step.put("content", content.length() > 300 ? content.substring(0, 300) + "..." : content);
                    return step;
                })
                .toList();
        resp.put("steps", steps);

        if (result.errors() != null && !result.errors().isEmpty()) {
            resp.put("errors", result.errors());
        }

        return resp;
    }
}
