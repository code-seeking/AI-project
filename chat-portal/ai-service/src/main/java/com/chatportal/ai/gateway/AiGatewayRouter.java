package com.chatportal.ai.gateway;

import com.chatportal.ai.gateway.ModelProfile.ModelCapability;
import com.chatportal.ai.gateway.ModelProfile.ModelTier;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

/**
 * AI 智能网关路由核心 — 多模型智能路由 + 故障转移 + 缓存
 * <p>
 * 支持的策略：
 * - cost_optimized: 成本优先（默认使用最便宜的可用模型）
 * - quality: 质量优先（使用最高能力的模型）
 * - latency: 延迟优先（使用最快的模型）
 * - manual: 手动指定模型
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AiGatewayRouter {

    private final ModelRegistry modelRegistry;
    private final CostTracker costTracker;
    private final PromptCache promptCache;

    private final ChatClient dashscopeClient;   // DashScope (qwen)
    private final ChatClient ollamaClient;      // Ollama 本地
    private final ChatClient openaiClient;      // OpenAI 兼容

    /** 执行 AI 调用，自动路由 */
    public GatewayResult execute(RouteRequest request) {
        long start = System.currentTimeMillis();

        // 1. 检查缓存
        if (request.cacheEnabled()) {
            String cacheKey = promptCache.hash(request.prompt(), request.systemPrompt());
            String cached = promptCache.get(cacheKey);
            if (cached != null) {
                log.info("缓存命中，跳过 AI 调用: model={}, cacheKey={}", request.preferredModel(), cacheKey.substring(0, 8));
                return new GatewayResult(cached, "cache", 0, 0, 0, false);
            }
        }

        // 2. 选模型
        ModelProfile selected = selectModel(request);
        if (selected == null) {
            log.error("无可用模型处理请求: capability={}", request.requiredCapability());
            return new GatewayResult(null, "none", 0, 0, 0, false);
        }

        // 3. 执行调用（带故障转移链）
        GatewayResult result = executeWithFallback(selected, request, start);

        // 4. 缓存结果
        if (result.success() && request.cacheEnabled() && result.modelUsed() != null) {
            String cacheKey = promptCache.hash(request.prompt(), request.systemPrompt());
            promptCache.put(cacheKey, result.content());
        }

        return result;
    }

    /** 选择最适合的模型 */
    private ModelProfile selectModel(RouteRequest request) {
        // 手动指定
        if (request.preferredModel() != null) {
            Optional<ModelProfile> preferred = modelRegistry.getById(request.preferredModel());
            if (preferred.isPresent() && modelRegistry.isHealthy(request.preferredModel())) {
                return preferred.get();
            }
            log.warn("首选模型不可用，切换到自动路由: {}", request.preferredModel());
        }

        // 按策略路由
        String strategy = request.strategy();
        if ("quality".equals(strategy)) {
            var opt = modelRegistry.getOptimal(request.requiredCapability(), ModelTier.PREMIUM);
            if (opt.isEmpty()) {
                opt = modelRegistry.getOptimal(request.requiredCapability(), ModelTier.STANDARD);
            }
            return opt.orElse(null);
        } else if ("latency".equals(strategy)) {
            return modelRegistry.getOptimal(request.requiredCapability(), ModelTier.ECONOMY)
                    .orElse(null);
        }
        // cost_optimized (默认): 成本优先
        return modelRegistry.getOptimal(request.requiredCapability(), ModelTier.STANDARD)
                .orElse(null);
    }

    /** 执行调用，带故障转移链 */
    private GatewayResult executeWithFallback(ModelProfile primary, RouteRequest request, long start) {
        List<ModelProfile> fallbackChain = modelRegistry.getFallbackChain(request.requiredCapability());
        // 从 primary 开始
        int startIndex = 0;
        for (int i = 0; i < fallbackChain.size(); i++) {
            if (fallbackChain.get(i).getId().equals(primary.getId())) {
                startIndex = i;
                break;
            }
        }

        List<String> errors = new java.util.ArrayList<>();

        for (int i = startIndex; i < fallbackChain.size(); i++) {
            ModelProfile model = fallbackChain.get(i);
            if (!modelRegistry.isHealthy(model.getId())) continue;

            try {
                String result = callModel(model, request.systemPrompt(), request.prompt());
                if (result != null && !result.isBlank()) {
                    long latency = System.currentTimeMillis() - start;
                    int inputTokens = estimateTokens(request.prompt());
                    int outputTokens = estimateTokens(result);

                    costTracker.recordCall(model.getId(), model.getTier(),
                            inputTokens, outputTokens, latency, i > startIndex, true);

                    log.info("AI 调用成功: model={}, latency={}ms, inputTokens={}, outputTokens={}",
                            model.getId(), latency, inputTokens, outputTokens);

                    if (i > startIndex) {
                        // 主模型恢复标记
                        modelRegistry.markHealthy(primary.getId());
                    }

                    return new GatewayResult(result, model.getId(), inputTokens, outputTokens, latency, i > startIndex);
                }
                errors.add(model.getId() + ": 空响应");
            } catch (Exception e) {
                log.warn("模型 [{}] 调用失败: {}", model.getId(), e.getMessage());
                modelRegistry.markUnhealthy(model.getId());
                errors.add(model.getId() + ": " + e.getMessage());
            }
        }

        // 全部失败
        long latency = System.currentTimeMillis() - start;
        costTracker.recordCall("none", ModelTier.LOCAL, 0, 0, latency, false, false);
        log.error("所有模型调用均失败: errors={}", String.join(" | ", errors));
        return new GatewayResult(null, null, 0, 0, latency, false);
    }

    /** 调用具体模型 */
    private String callModel(ModelProfile model, String systemPrompt, String userPrompt) {
        ChatClient client = resolveClient(model);
        if (client == null) return null;

        var spec = client.prompt();
        if (systemPrompt != null && !systemPrompt.isBlank()) {
            spec = spec.system(s -> s.text(systemPrompt));
        }
        spec = spec.user(u -> u.text(userPrompt));

        String response = spec.call().content();
        return (response != null && !response.isBlank()) ? response : null;
    }

    /** 根据模型提供商选择对应的 ChatClient */
    private ChatClient resolveClient(ModelProfile model) {
        return switch (model.getProvider()) {
            case DASHSCOPE -> dashscopeClient;
            case OLLAMA -> ollamaClient;
            case OPENAI, AZURE_OPENAI -> openaiClient;
        };
    }

    /** 粗略估计 token 数（中英文混合按字符数 * 系数） */
    private int estimateTokens(String text) {
        if (text == null) return 0;
        int chineseChars = 0;
        int asciiChars = 0;
        for (char c : text.toCharArray()) {
            if (c > 127) chineseChars++;
            else asciiChars++;
        }
        return (int) (chineseChars * 1.5 + asciiChars * 0.25);
    }

    /** 路由请求参数 */
    public record RouteRequest(
            String prompt,
            String systemPrompt,
            String preferredModel,
            String strategy,         // cost_optimized, quality, latency, manual
            ModelCapability requiredCapability,
            boolean cacheEnabled
    ) {
        public RouteRequest {
            if (strategy == null) strategy = "cost_optimized";
            if (requiredCapability == null) requiredCapability = ModelCapability.CHAT;
        }
    }

    /** 路由结果 */
    public record GatewayResult(
            String content,
            String modelUsed,
            int inputTokens,
            int outputTokens,
            long latencyMs,
            boolean isFallback
    ) {
        public boolean success() { return content != null; }
    }
}
