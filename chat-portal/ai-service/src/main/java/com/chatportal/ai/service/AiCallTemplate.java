package com.chatportal.ai.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

/**
 * 统一 AI 调用模板 — 封装重试 + Fallback
 * <p>
 * - primaryClient: DashScope (通义千问) — 主力模型
 * - fallbackClient: Ollama 本地模型 — 备用降级
 */
@Slf4j
@Component
public class AiCallTemplate {

    private final ChatClient primaryClient;
    private final ChatClient fallbackClient;

    private static final int DEFAULT_MAX_RETRIES = 0;

    public AiCallTemplate(@Qualifier("chatClient") ChatClient primaryClient,
                          @Qualifier("fallbackClient") ChatClient fallbackClient) {
        this.primaryClient = primaryClient;
        this.fallbackClient = fallbackClient;
    }

    /**
     * 同步调用 AI，带重试和 Fallback
     */
    public String call(String prompt) {
        return call(prompt, DEFAULT_MAX_RETRIES);
    }

    /**
     * 同步调用 AI，自定义重试次数
     */
    public String call(String prompt, int maxRetries) {
        long start = System.currentTimeMillis();

        // 1. 尝试主模型（带重试）
        for (int i = 0; i <= maxRetries; i++) {
            try {
                String result = primaryClient.prompt().user(prompt).call().content();
                if (result != null && !result.isBlank()) {
                    long latency = System.currentTimeMillis() - start;
                    log.info("AI主模型调用成功: latency={}ms, promptLen={}", latency, prompt.length());
                    return result;
                }
                log.warn("主模型返回空响应 (第{}次)", i + 1);
            } catch (Exception e) {
                log.warn("主模型调用失败 (第{}次): {}", i + 1, e.getMessage());
                if (i == maxRetries) break;
            }
        }

        // 2. 降级到备用模型
        log.info("主模型不可用，降级到 Ollama 备用模型");
        try {
            String result = fallbackClient.prompt().user(prompt).call().content();
            if (result != null && !result.isBlank()) {
                long latency = System.currentTimeMillis() - start;
                log.info("Ollama备用模型调用成功: latency={}ms", latency);
                return result;
            }
        } catch (Exception e) {
            log.error("备用模型调用也失败: {}", e.getMessage());
        }

        log.error("所有AI模型调用均失败，promptLen={}", prompt.length());
        return null;
    }
}
