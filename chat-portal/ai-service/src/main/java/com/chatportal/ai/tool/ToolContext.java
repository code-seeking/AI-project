package com.chatportal.ai.tool;

/** 工具执行上下文 */
public record ToolContext(
        String sessionId,
        String userId,
        String workspaceDir
) {}
