package com.chatportal.ai.tool;

/**
 * 系统工具接口 — 所有可被 AI 调用的系统工具需实现此接口
 */
public interface SystemTool {

    /** 工具唯一标识 */
    String getName();

    /** 工具描述（供 AI 理解用途） */
    String getDescription();

    /** 参数描述（JSON Schema 格式） */
    String getParameterSchema();

    /** 执行工具 */
    ToolResult execute(ToolContext ctx, String parameters);
}
