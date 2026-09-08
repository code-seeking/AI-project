package com.chatportal.ai.gateway;

/**
 * AI 模型能力画像 — 描述一个模型的能力、成本、可用性
 */
public class ModelProfile {

    public enum ModelProvider {
        DASHSCOPE,      // 通义千问（主力）
        OLLAMA,         // 本地 Ollama（备用）
        OPENAI,         // OpenAI 兼容 API
        AZURE_OPENAI    // Azure OpenAI
    }

    public enum ModelCapability {
        CHAT,           // 通用对话
        CODE,           // 代码生成 / 审查
        ANALYZE,        // 分析 / 推理
        FAST_CHAT,      // 快速轻量对话（低成本）
        EMBEDDING       // 向量嵌入
    }

    public enum ModelTier {
        PREMIUM,    // 高质量高成本（qwen-max, gpt-4）
        STANDARD,   // 标准平衡（qwen-plus, gpt-4o-mini）
        ECONOMY,    // 低成本快速（qwen-turbo, deepseek-chat）
        LOCAL       // 本地免费（Ollama）
    }

    private final String id;
    private final String name;
    private final ModelProvider provider;
    private final ModelTier tier;
    private final ModelCapability[] capabilities;
    private final double costPer1KTokens;    // 每 1K token 成本（元人民币）
    private final int contextWindow;         // 上下文窗口大小
    private final boolean supportsStreaming;
    private final boolean supportsFunctions;

    public ModelProfile(String id, String name, ModelProvider provider, ModelTier tier,
                        ModelCapability[] capabilities, double costPer1KTokens,
                        int contextWindow, boolean supportsStreaming, boolean supportsFunctions) {
        this.id = id;
        this.name = name;
        this.provider = provider;
        this.tier = tier;
        this.capabilities = capabilities;
        this.costPer1KTokens = costPer1KTokens;
        this.contextWindow = contextWindow;
        this.supportsStreaming = supportsStreaming;
        this.supportsFunctions = supportsFunctions;
    }

    public boolean hasCapability(ModelCapability cap) {
        for (ModelCapability c : capabilities) {
            if (c == cap) return true;
        }
        return false;
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public ModelProvider getProvider() { return provider; }
    public ModelTier getTier() { return tier; }
    public ModelCapability[] getCapabilities() { return capabilities; }
    public double getCostPer1KTokens() { return costPer1KTokens; }
    public int getContextWindow() { return contextWindow; }
    public boolean isSupportsStreaming() { return supportsStreaming; }
    public boolean isSupportsFunctions() { return supportsFunctions; }
}
