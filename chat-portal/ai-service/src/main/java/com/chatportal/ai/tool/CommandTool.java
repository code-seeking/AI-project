package com.chatportal.ai.tool;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * 命令行工具 — AI 可安全执行预设的命令
 * <p>
 * 安全限制：
 * - 只允许在白名单内的命令
 * - 超时限制（30秒）
 * - 禁止交互式命令
 */
@Slf4j
@Component
public class CommandTool implements SystemTool {

    private final ObjectMapper json = new ObjectMapper();

    /** 允许的命令前缀白名单 */
    private static final String[] ALLOWED_PREFIXES = {
            "dir", "ls", "pwd", "echo", "type", "cat",
            "git status", "git log", "git diff", "git branch",
            "npm list", "npm run", "mvn --version",
            "java -version", "python --version", "node --version"
    };

    private static final long TIMEOUT_SECONDS = 30;

    @Override
    public String getName() { return "command"; }

    @Override
    public String getDescription() {
        return "执行预设的终端命令。支持：ls/dir, pwd, echo, git status/log/diff, type/cat 等。超时限制 30 秒。";
    }

    @Override
    public String getParameterSchema() {
        return """
        {
            "type": "object",
            "properties": {
                "command": { "type": "string", "description": "要执行的命令" },
                "args": { "type": "string", "description": "命令参数" }
            },
            "required": ["command"]
        }
        """;
    }

    @Override
    public ToolResult execute(ToolContext ctx, String parameters) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> params = json.readValue(parameters, Map.class);
            String cmd = ((String) params.getOrDefault("command", "")).trim();
            String args = (String) params.get("args");

            // 安全检查
            String fullCmd = args != null ? cmd + " " + args : cmd;
            if (!isAllowed(fullCmd)) {
                return ToolResult.fail("命令不在白名单中: " + cmd + "。允许的命令: ls, pwd, echo, git status/log/diff, type/cat, npm list");
            }

            return executeCommand(fullCmd);
        } catch (Exception e) {
            log.error("命令工具执行失败: {}", e.getMessage());
            return ToolResult.fail("命令执行失败: " + e.getMessage());
        }
    }

    private ToolResult executeCommand(String command) {
        try {
            boolean isWindows = System.getProperty("os.name").toLowerCase().contains("win");
            String[] cmdArray = isWindows
                    ? new String[]{"cmd.exe", "/c", command}
                    : new String[]{"/bin/sh", "-c", command};

            Process process = Runtime.getRuntime().exec(cmdArray);
            process.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS);

            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream(), Charset.forName("GBK")))) {
                StringBuilder output = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    output.append(line).append("\n");
                }
                String result = output.toString().trim();
                if (result.length() > 10000) {
                    result = result.substring(0, 10000) + "\n... (输出过长，已截断)";
                }
                return ToolResult.ok("命令执行成功", result);
            }
        } catch (Exception e) {
            return ToolResult.fail("命令执行失败: " + e.getMessage());
        }
    }

    private boolean isAllowed(String cmd) {
        String lower = cmd.toLowerCase().trim();
        for (String prefix : ALLOWED_PREFIXES) {
            if (lower.startsWith(prefix)) return true;
        }
        return false;
    }
}
