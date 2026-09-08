package com.chatportal.ai.gateway;

import com.chatportal.ai.gateway.AiGatewayRouter.GatewayResult;
import com.chatportal.ai.gateway.AiGatewayRouter.RouteRequest;
import com.chatportal.ai.gateway.CostTracker.GatewayStats;
import com.chatportal.ai.gateway.ModelProfile.ModelCapability;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * AI 网关 REST API — 统一的 AI 调用入口
 */
@Slf4j
@RestController
@RequestMapping("/ai-gateway")
@RequiredArgsConstructor
public class AiGatewayController {

    private final AiGatewayRouter router;
    private final ModelRegistry modelRegistry;
    private final CostTracker costTracker;
    private final PromptCache promptCache;

    /** 智能路由调用 */
    @PostMapping("/chat")
    public ResponseEntity<Map<String, Object>> chat(@RequestBody Map<String, Object> request) {
        String prompt = (String) request.getOrDefault("prompt", "");
        String systemPrompt = (String) request.getOrDefault("systemPrompt", "");
        String strategy = (String) request.getOrDefault("strategy", "cost_optimized");
        String model = (String) request.getOrDefault("model", null);
        String capability = (String) request.getOrDefault("capability", "CHAT");
        boolean cacheEnabled = (boolean) request.getOrDefault("cacheEnabled", true);

        if (prompt.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "prompt 不能为空"));
        }

        ModelCapability cap;
        try {
            cap = ModelCapability.valueOf(capability.toUpperCase());
        } catch (IllegalArgumentException e) {
            cap = ModelCapability.CHAT;
        }

        RouteRequest routeRequest = new RouteRequest(prompt, systemPrompt, model, strategy, cap, cacheEnabled);
        GatewayResult result = router.execute(routeRequest);

        if (!result.success()) {
            return ResponseEntity.status(503).body(Map.of(
                    "error", "所有模型均不可用",
                    "latencyMs", result.latencyMs()
            ));
        }

        return ResponseEntity.ok(Map.of(
                "content", result.content(),
                "modelUsed", result.modelUsed(),
                "inputTokens", result.inputTokens(),
                "outputTokens", result.outputTokens(),
                "latencyMs", result.latencyMs(),
                "isFallback", result.isFallback()
        ));
    }

    /** 获取可用模型列表 */
    @GetMapping("/models")
    public ResponseEntity<List<Map<String, Object>>> listModels() {
        List<Map<String, Object>> models = modelRegistry.getAllModels().stream()
                .map(m -> Map.<String, Object>of(
                        "id", m.getId(),
                        "name", m.getName(),
                        "provider", m.getProvider().name(),
                        "tier", m.getTier().name(),
                        "costPer1KTokens", m.getCostPer1KTokens(),
                        "contextWindow", m.getContextWindow(),
                        "healthy", modelRegistry.isHealthy(m.getId())
                ))
                .toList();
        return ResponseEntity.ok(models);
    }

    /** 获取调用统计 */
    @GetMapping("/stats")
    public ResponseEntity<GatewayStats> getStats() {
        return ResponseEntity.ok(costTracker.getStats());
    }

    /** 重置统计 */
    @PostMapping("/stats/reset")
    public ResponseEntity<Map<String, String>> resetStats() {
        costTracker.reset();
        return ResponseEntity.ok(Map.of("message", "统计已重置"));
    }

    /** 清除缓存 */
    @PostMapping("/cache/clear")
    public ResponseEntity<Map<String, Object>> clearCache() {
        promptCache.clear();
        return ResponseEntity.ok(Map.of("message", "缓存已清空", "cleared", true));
    }

    /** 手动标记模型健康状态 */
    @PostMapping("/models/{modelId}/health")
    public ResponseEntity<Map<String, Object>> setModelHealth(
            @PathVariable String modelId,
            @RequestBody Map<String, Object> body) {
        boolean healthy = (boolean) body.getOrDefault("healthy", true);
        if (healthy) {
            modelRegistry.markHealthy(modelId);
        } else {
            modelRegistry.markUnhealthy(modelId);
        }
        return ResponseEntity.ok(Map.of(
                "modelId", modelId,
                "healthy", healthy
        ));
    }
}
