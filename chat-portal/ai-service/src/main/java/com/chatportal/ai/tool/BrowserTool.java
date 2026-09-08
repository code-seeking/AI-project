package com.chatportal.ai.tool;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 浏览器自动化工具 — AI 可操控浏览器执行页面操作
 * <p>
 * 通过 Playwright / Selenium 集成实现 Web 自动化。
 * 当前为接口定义和模拟实现，集成真实浏览器驱动后即可工作。
 */
@Slf4j
@Component
public class BrowserTool implements SystemTool {

    private final ObjectMapper json = new ObjectMapper();

    @Override
    public String getName() { return "browser"; }

    @Override
    public String getDescription() {
        return "浏览器自动化操作：打开网页、点击元素、填写表单、截图、获取页面内容等。支持通过 CSS 选择器定位元素。";
    }

    @Override
    public String getParameterSchema() {
        return """
        {
            "type": "object",
            "properties": {
                "action": { "type": "string", "enum": ["navigate", "click", "fill", "screenshot", "getContent", "evaluate"], "description": "浏览器操作类型" },
                "url": { "type": "string", "description": "目标 URL（navigate 操作需要）" },
                "selector": { "type": "string", "description": "CSS 选择器（click/fill 操作需要）" },
                "value": { "type": "string", "description": "输入值（fill 操作需要）" },
                "script": { "type": "string", "description": "JavaScript 脚本（evaluate 操作需要）" }
            },
            "required": ["action"]
        }
        """;
    }

    @Override
    public ToolResult execute(ToolContext ctx, String parameters) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> params = json.readValue(parameters, Map.class);
            String action = (String) params.getOrDefault("action", "");

            // 返回说明，提示需要集成 Playwright/Selenium
            return ToolResult.ok("浏览器操作已提交。注意：当前为接口定义阶段，" +
                    "集成 Playwright/Selenium 驱动后可执行实际操作。", """
                {
                    "action": "%s",
                    "status": "pending_driver_integration",
                    "note": "请配置 Playwright WebDriver 后启用真实浏览器操作"
                }
                """.formatted(action));
        } catch (Exception e) {
            return ToolResult.fail("浏览器工具执行失败: " + e.getMessage());
        }
    }
}
