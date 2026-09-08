package com.chatportal.ai.tool;

/** 工具执行结果 */
public record ToolResult(
        boolean success,
        String message,
        String data      // 结果数据（JSON）
) {
    public static ToolResult ok(String message, String data) {
        return new ToolResult(true, message, data);
    }

    public static ToolResult fail(String message) {
        return new ToolResult(false, message, null);
    }
}
