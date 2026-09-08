package com.chatportal.ai.dto;

import lombok.Data;

@Data
public class ChatRequest {
    private String systemPrompt;
    private String userMessage;
}
