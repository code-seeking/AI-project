package com.chatportal.ai.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Slf4j
@Configuration
public class AiConfig {

    /**
     * 默认 ChatClient（无 @Primary，让 AiGatewayRouter 的 dashscopeClient 优先）
     * 供 AiCallTemplate 通过 @Qualifier("chatClient") 注入
     */
    @Bean(name = "chatClient")
    public ChatClient chatClient(ChatClient.Builder builder) {
        return builder
                .defaultSystem("你是一个智能分类助手。请对用户提供的内容进行智能分类。")
                .build();
    }

    @Bean
    public ObjectMapper objectMapper() {
        return new ObjectMapper();
    }
}
