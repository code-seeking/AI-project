package com.chatportal.ai.gateway;

import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

/**
 * AI 网关配置 — 注入各模型 ChatClient bean
 */
@Slf4j
@Configuration
public class GatewayConfig {

    @Primary
    @Bean(name = "dashscopeClient")
    public ChatClient dashscopeClient(ChatClient.Builder builder) {
        return builder
                .defaultSystem("你是一个智能 AI 助手。")
                .build();
    }

    @Bean(name = "ollamaClient")
    public ChatClient ollamaClient(@Qualifier("fallbackClient") ChatClient fallbackClient) {
        return fallbackClient;
    }

    @Bean(name = "openaiClient")
    public ChatClient openaiClient(ChatClient.Builder builder) {
        return builder
                .defaultSystem("你是一个智能 AI 助手。")
                .build();
    }
}
