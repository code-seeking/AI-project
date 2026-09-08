package com.chatportal.ai.tool;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 系统工具注册中心 — 管理所有可被 AI 调用的工具
 */
@Slf4j
@Component
public class ToolRegistry {

    private final Map<String, SystemTool> tools = new ConcurrentHashMap<>();

    public ToolRegistry(List<SystemTool> toolList) {
        for (SystemTool tool : toolList) {
            tools.put(tool.getName(), tool);
        }
    }

    @PostConstruct
    public void init() {
        log.info("工具注册中心初始化完成，已注册工具: {}", tools.keySet());
    }

    /** 注册工具 */
    public void register(SystemTool tool) {
        tools.put(tool.getName(), tool);
        log.info("工具已注册: {}", tool.getName());
    }

    /** 获取工具 */
    public Optional<SystemTool> getTool(String name) {
        return Optional.ofNullable(tools.get(name));
    }

    /** 获取所有工具描述（供 AI 理解可用工具） */
    public List<Map<String, String>> getToolDescriptions() {
        return tools.values().stream()
                .map(t -> {
                    Map<String, String> desc = new LinkedHashMap<>();
                    desc.put("name", t.getName());
                    desc.put("description", t.getDescription());
                    desc.put("parameters", t.getParameterSchema());
                    return desc;
                })
                .toList();
    }

    /** 获取所有工具名称 */
    public Set<String> getToolNames() {
        return tools.keySet();
    }

    /** 执行工具调用 */
    public ToolResult execute(String toolName, ToolContext ctx, String parameters) {
        Optional<SystemTool> tool = getTool(toolName);
        if (tool.isEmpty()) {
            return ToolResult.fail("未知工具: " + toolName + "，可用工具: " + tools.keySet());
        }
        log.info("执行工具: name={}, sessionId={}, paramsLen={}", toolName, ctx.sessionId(), parameters.length());
        long start = System.currentTimeMillis();
        try {
            ToolResult result = tool.get().execute(ctx, parameters);
            long elapsed = System.currentTimeMillis() - start;
            log.info("工具执行完成: name={}, elapsed={}ms, success={}", toolName, elapsed, result.success());
            return result;
        } catch (Exception e) {
            log.error("工具执行异常: name={}, error={}", toolName, e.getMessage());
            return ToolResult.fail("工具执行异常: " + e.getMessage());
        }
    }
}
