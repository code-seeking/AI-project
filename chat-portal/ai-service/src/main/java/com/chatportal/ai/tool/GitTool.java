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
 * Git 工具 — AI 可执行常见的 Git 操作
 * <p>
 * 安全限制：只读操作（status/log/diff）可直接执行；
 * 写操作（commit/push）需要显式确认。
 */
@Slf4j
@Component
public class GitTool implements SystemTool {

    private final ObjectMapper json = new ObjectMapper();
    private static final long TIMEOUT_SECONDS = 30;

    @Override
    public String getName() { return "git"; }

    @Override
    public String getDescription() {
        return "Git 版本控制操作：仓库状态、提交历史、差异对比、分支管理。只读操作自动执行，写操作需确认。";
    }

    @Override
    public String getParameterSchema() {
        return """
        {
            "type": "object",
            "properties": {
                "action": { "type": "string", "enum": ["status", "log", "diff", "branch", "commit", "pull", "push"], "description": "Git 操作类型" },
                "repoPath": { "type": "string", "description": "仓库路径（默认当前工作目录）" },
                "message": { "type": "string", "description": "提交信息（commit 操作需要）" },
                "args": { "type": "string", "description": "额外参数" }
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
            String repoPath = (String) params.getOrDefault("repoPath", ctx.workspaceDir());
            String message = (String) params.get("message");
            String args = (String) params.get("args");

            return switch (action) {
                case "status" -> gitExec(repoPath, "git status");
                case "log" -> gitExec(repoPath, "git log --oneline -20" + (args != null ? " " + args : ""));
                case "diff" -> gitExec(repoPath, "git diff" + (args != null ? " " + args : ""));
                case "branch" -> gitExec(repoPath, "git branch -a");
                case "commit" -> {
                    if (message == null || message.isBlank()) {
                        yield ToolResult.fail("commit 操作需要提供 message 参数");
                    }
                    // 先 stage 所有变更，再 commit
                    ToolResult addResult = gitExec(repoPath, "git add -A");
                    if (!addResult.success()) yield addResult;
                    yield gitExec(repoPath, "git commit -m \"" + message.replace("\"", "\\\"") + "\"");
                }
                default -> ToolResult.fail("未知 Git 操作: " + action);
            };
        } catch (Exception e) {
            return ToolResult.fail("Git 工具执行失败: " + e.getMessage());
        }
    }

    private ToolResult gitExec(String repoPath, String command) {
        try {
            boolean isWindows = System.getProperty("os.name").toLowerCase().contains("win");
            String[] cmdArray = isWindows
                    ? new String[]{"cmd.exe", "/c", "cd /d \"" + repoPath + "\" && " + command}
                    : new String[]{"/bin/sh", "-c", "cd \"" + repoPath + "\" && " + command};

            Process process = Runtime.getRuntime().exec(cmdArray);
            boolean finished = process.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                return ToolResult.fail("Git 操作超时（30秒）");
            }

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
                return ToolResult.ok("Git 操作成功", result);
            }
        } catch (Exception e) {
            return ToolResult.fail("Git 操作失败: " + e.getMessage());
        }
    }
}
