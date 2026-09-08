package com.chatportal.ai.gateway;

import com.chatportal.ai.gateway.ModelProfile.*;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.Collectors;

/**
 * AI 模型注册中心 — 管理所有可用模型的画像、路由策略和健康状态
 */
@Slf4j
@Component
public class ModelRegistry {

    private final List<ModelProfile> models = new CopyOnWriteArrayList<>();
    private final Map<String, Boolean> healthMap = new HashMap<>();

    @PostConstruct
    public void init() {
        // 主力模型：DashScope 通义千问
        register(new ModelProfile("qwen-max", "通义千问-Max",
                ModelProvider.DASHSCOPE, ModelTier.PREMIUM,
                new ModelCapability[]{ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.ANALYZE},
                0.02, 32768, true, true));

        register(new ModelProfile("qwen-plus", "通义千问-Plus",
                ModelProvider.DASHSCOPE, ModelTier.STANDARD,
                new ModelCapability[]{ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.FAST_CHAT},
                0.008, 131072, true, true));

        register(new ModelProfile("qwen-turbo", "通义千问-Turbo",
                ModelProvider.DASHSCOPE, ModelTier.ECONOMY,
                new ModelCapability[]{ModelCapability.CHAT, ModelCapability.FAST_CHAT},
                0.002, 32768, true, false));

        // 备用模型：Ollama 本地
        register(new ModelProfile("qwen2.5-coder:7b", "Qwen2.5-Coder-7B",
                ModelProvider.OLLAMA, ModelTier.LOCAL,
                new ModelCapability[]{ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.ANALYZE},
                0.0, 32768, true, false));

        // 可选外部模型
        register(new ModelProfile("deepseek-chat", "DeepSeek-Chat",
                ModelProvider.OPENAI, ModelTier.ECONOMY,
                new ModelCapability[]{ModelCapability.CHAT, ModelCapability.CODE, ModelCapability.ANALYZE},
                0.002, 65536, true, true));

        // 初始全部设为健康
        for (ModelProfile m : models) {
            healthMap.put(m.getId(), true);
        }

        log.info("模型注册中心初始化完成，共 {} 个模型", models.size());
    }

    public void register(ModelProfile profile) {
        models.removeIf(m -> m.getId().equals(profile.getId()));
        models.add(profile);
        healthMap.put(profile.getId(), true);
    }

    /** 根据能力筛选可用模型 */
    public List<ModelProfile> findByCapability(ModelCapability capability) {
        return models.stream()
                .filter(m -> m.hasCapability(capability) && isHealthy(m.getId()))
                .collect(Collectors.toList());
    }

    /** 根据层级筛选 */
    public List<ModelProfile> findByTier(ModelTier tier) {
        return models.stream()
                .filter(m -> m.getTier() == tier && isHealthy(m.getId()))
                .collect(Collectors.toList());
    }

    /** 获取最优模型：按优先级（层级高→低），同层按成本（低→高） */
    public Optional<ModelProfile> getOptimal(ModelCapability capability, ModelTier maxTier) {
        return models.stream()
                .filter(m -> m.hasCapability(capability) && isHealthy(m.getId())
                        && m.getTier().ordinal() <= maxTier.ordinal())
                .min(Comparator.comparingInt(m -> {
                    int tierScore = m.getTier().ordinal();
                    int costScore = (int) (m.getCostPer1KTokens() * 10000);
                    return tierScore * 10000 + costScore;
                }));
    }

    /** 获取故障转移链 */
    public List<ModelProfile> getFallbackChain(ModelCapability capability) {
        List<ModelProfile> chain = new ArrayList<>();
        // 先按层级从高到低
        for (ModelTier tier : ModelTier.values()) {
            List<ModelProfile> atTier = models.stream()
                    .filter(m -> m.getTier() == tier && m.hasCapability(capability))
                    .sorted(Comparator.comparingDouble(ModelProfile::getCostPer1KTokens))
                    .toList();
            chain.addAll(atTier);
        }
        return chain;
    }

    public void markUnhealthy(String modelId) {
        healthMap.put(modelId, false);
        log.warn("模型 [{}] 标记为不可用", modelId);
    }

    public void markHealthy(String modelId) {
        healthMap.put(modelId, true);
        log.info("模型 [{}] 恢复可用", modelId);
    }

    public boolean isHealthy(String modelId) {
        return healthMap.getOrDefault(modelId, false);
    }

    public List<ModelProfile> getAllModels() {
        return List.copyOf(models);
    }

    public Optional<ModelProfile> getById(String modelId) {
        return models.stream().filter(m -> m.getId().equals(modelId)).findFirst();
    }
}
