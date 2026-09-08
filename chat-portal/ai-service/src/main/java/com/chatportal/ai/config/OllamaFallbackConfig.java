package com.chatportal.ai.config;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.ollama.OllamaChatModel;
import org.springframework.ai.ollama.api.OllamaApi;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Ollama 备用 ChatClient 配置
 * <p>
 * 由于 OllamaChatAutoConfiguration 被排除（避免与 DashScope ChatClient bean 冲突），
 * 这里手动创建 Ollama ChatClient 作为 Fallback 备用模型。
 */
@Configuration
public class OllamaFallbackConfig {

    @Bean(name = "fallbackClient")
    public ChatClient ollamaChatClient(
            OllamaApi ollamaApi,
            @Value("${spring.ai.ollama.chat.model:qwen2.5-coder:7b}") String model) {
        OllamaChatModel chatModel = OllamaChatModel.builder()
                .ollamaApi(ollamaApi)
                .options(org.springframework.ai.ollama.api.OllamaChatOptions.builder()
                        .model(model)
                        .build())
                .build();
        return ChatClient.builder(chatModel).build();
    }
}
