package com.chatportal.ai.react;

import com.chatportal.ai.gateway.AiGatewayRouter;
import com.chatportal.ai.gateway.ModelProfile.ModelCapability;
import com.chatportal.ai.tool.ToolContext;
import com.chatportal.ai.tool.ToolRegistry;
import com.chatportal.ai.tool.ToolResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * ReAct Agent Orchestrator — 推理 + 行动循环智能体
 * <p>
 * 核心流程：
 * 1. Thought（思考） → AI 分析目标，决定下一步
 * 2. Action（行动） → 调用系统工具执行操作
 * 3. Observation（观察） → 获取工具执行结果
 * 4. Reflection（反思） → 判断目标是否达成，或继续循环
 * <p>
 * 基于现有工作流引擎模式演进，增加 Agent 自主推理和工具调用能力。
 */
@Slf4j
@Component
public class ReActOrchestrator {

    private final AiGatewayRouter router;
    private final ToolRegistry toolRegistry;

    /** 会话最大循环次数 */
    private static final int MAX_ITERATIONS = 15;
    /** 会话存储 */
    private final Map<String, ReActSession> sessions = new ConcurrentHashMap<>();

    public ReActOrchestrator(AiGatewayRouter router, ToolRegistry toolRegistry) {
        this.router = router;
        this.toolRegistry = toolRegistry;
    }

    /**
     * 执行 ReAct 循环
     *
     * @param sessionId  会话 ID
     * @param userGoal   用户目标描述
     * @param maxSteps   最大步骤数
     * @return 执行结果
     */
    public ReActResult execute(String sessionId, String userGoal, int maxSteps) {
        maxSteps = Math.min(maxSteps, MAX_ITERATIONS);

        ReActSession session = sessions.computeIfAbsent(sessionId, k -> {
            log.info("创建新 ReAct 会话: sessionId={}", sessionId);
            return new ReActSession(sessionId);
        });

        session.addMessage("user", userGoal);
        long startTime = System.currentTimeMillis();
        int step = 0;
        List<String> errors = new ArrayList<>();

        while (step < maxSteps) {
            step++;
            log.info("ReAct 步骤 {}/{}: sessionId={}", step, maxSteps, sessionId);

            // 1. Thought — 让 AI 分析当前状态并决定下一步
            ThoughtResult thought = think(session, step);
            if (!thought.success()) {
                errors.add("思考失败: " + thought.error());
                break;
            }

            session.addMessage("assistant", thought.reasoning());
            log.info("Step {} Thought: {}", step, thought.reasoning().substring(0, Math.min(150, thought.reasoning().length())));

            // AI 判断是否已完成
            if (thought.isComplete()) {
                log.info("AI 判断目标已完成，结束循环");
                session.setStatus("completed");
                break;
            }

            // 2. Action — 执行工具调用
            if (thought.toolCall() != null) {
                ToolCall tc = thought.toolCall();
                ToolContext ctx = new ToolContext(sessionId, "react-agent", System.getProperty("user.dir", ""));
                ToolResult toolResult = toolRegistry.execute(tc.toolName(), ctx, tc.parameters());

                // 记录观察结果
                String observation = toolResult.success()
                        ? "工具 [" + tc.toolName() + "] 执行成功：" + toolResult.message()
                        : "工具 [" + tc.toolName() + "] 执行失败：" + toolResult.message();

                if (toolResult.data() != null && !toolResult.data().isBlank()) {
                    String dataPreview = toolResult.data().length() > 500
                            ? toolResult.data().substring(0, 500) + "..."
                            : toolResult.data();
                    observation += "\n数据：" + dataPreview;
                }

                session.addMessage("observation", observation);
                log.info("Step {} Observation: {}", step, observation.substring(0, Math.min(100, observation.length())));
            }

            // 检查超时
            if (System.currentTimeMillis() - startTime > 300_000) { // 5 min
                errors.add("执行超时");
                break;
            }
        }

        // 构建最终结果
        String finalAnswer = generateFinalAnswer(session, userGoal);
        long totalTime = System.currentTimeMillis() - startTime;

        ReActResult result = new ReActResult(
                sessionId,
                session.getStatus(),
                step,
                totalTime,
                finalAnswer,
                session.getMessageHistory(),
                errors.isEmpty() ? null : errors
        );

        log.info("ReAct 执行完成: sessionId={}, steps={}, status={}, time={}ms",
                sessionId, step, session.getStatus(), totalTime);
        return result;
    }

    /** 让 AI 思考下一步 */
    private ThoughtResult think(ReActSession session, int step) {
        try {
            // 构建 ReAct prompt
            String systemPrompt = buildSystemPrompt();
            String userPrompt = buildContextPrompt(session, step);

            // 调用 AI
            String response = router.execute(new AiGatewayRouter.RouteRequest(
                    userPrompt, systemPrompt, null, "quality",
                    ModelCapability.ANALYZE, false
            )).content();

            if (response == null || response.isBlank()) {
                return ThoughtResult.error("AI 返回空响应");
            }

            return parseThought(response);
        } catch (Exception e) {
            log.error("ReAct 思考过程出错: {}", e.getMessage());
            return ThoughtResult.error("思考过程异常: " + e.getMessage());
        }
    }

    /** 构建系统 Prompt */
    private String buildSystemPrompt() {
        StringBuilder sb = new StringBuilder();
        sb.append("你是一个智能 ReAct Agent，通过'思考->行动->观察->反思'的循环来完成任务。\n\n");
        sb.append("## 可用工具\n");
        for (var desc : toolRegistry.getToolDescriptions()) {
            sb.append("- ").append(desc.get("name")).append(": ").append(desc.get("description")).append("\n");
        }
        sb.append("""

        ## 输出格式
        你必须始终以以下 JSON 格式回复：

        ```json
        {
            "reasoning": "你的推理过程，分析当前状态和下一步计划",
            "isComplete": false,
            "finalAnswer": "",
            "toolCall": {
                "toolName": "要调用的工具名",
                "parameters": "工具参数的 JSON 字符串"
            }
        }
        ```

        规则：
        1. 如果目标已完成或无法继续，设置 isComplete=true 并填写 finalAnswer
        2. 如果需要调用工具，填写 toolCall 字段
        3. 每次只执行一步操作，不要一次执行多个工具
        4. 从观察中学习，逐步推进任务
        5. 如果工具调用失败，尝试其他方法或不同的参数
        """);
        return sb.toString();
    }

    /** 构建上下文 Prompt（包含历史） */
    private String buildContextPrompt(ReActSession session, int step) {
        StringBuilder sb = new StringBuilder();
        sb.append("## 步骤 ").append(step).append("\n\n");
        sb.append("### 对话历史\n");

        List<Map.Entry<String, String>> history = session.getMessageHistory();
        // 只取最近 20 条消息
        int start = Math.max(0, history.size() - 20);
        for (int i = start; i < history.size(); i++) {
            var entry = history.get(i);
            String role = entry.getKey();
            String content = entry.getValue();
            // 截断过长内容
            if (content.length() > 1000) {
                content = content.substring(0, 1000) + "...(截断)";
            }
            sb.append("[").append(role).append("]: ").append(content).append("\n\n");
        }

        sb.append("### 当前任务\n").append(session.getUserGoal()).append("\n\n");
        sb.append("请分析当前状态，决定下一步是调用工具还是完成任务。");
        return sb.toString();
    }

    /** 解析 AI 的 JSON 回复 */
    private ThoughtResult parseThought(String response) {
        try {
            // 提取 JSON
            int jsonStart = response.indexOf('{');
            int jsonEnd = response.lastIndexOf('}');
            if (jsonStart == -1 || jsonEnd == -1) {
                // 非 JSON 格式，尝试把整个响应当作最终答案
                return new ThoughtResult(response, true, response.trim(), null);
            }

            String jsonStr = response.substring(jsonStart, jsonEnd + 1);
            var mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            @SuppressWarnings("unchecked")
            Map<String, Object> parsed = mapper.readValue(jsonStr, Map.class);

            String reasoning = (String) parsed.getOrDefault("reasoning", "");
            boolean isComplete = Boolean.TRUE.equals(parsed.get("isComplete"));
            String finalAnswer = (String) parsed.getOrDefault("finalAnswer", "");

            ToolCall toolCall = null;
            if (parsed.containsKey("toolCall") && !isComplete) {
                @SuppressWarnings("unchecked")
                Map<String, Object> tcMap = (Map<String, Object>) parsed.get("toolCall");
                String toolName = (String) tcMap.getOrDefault("toolName", "");
                String params = tcMap.containsKey("parameters")
                        ? mapper.writeValueAsString(tcMap.get("parameters"))
                        : "{}";
                if (!toolName.isBlank()) {
                    toolCall = new ToolCall(toolName, params);
                }
            }

            return new ThoughtResult(reasoning, isComplete, finalAnswer, toolCall);
        } catch (Exception e) {
            log.warn("解析 AI 回复失败: {}", e.getMessage());
            // 降级：把整个回复当作最终答案
            return new ThoughtResult(response, true, response.trim(), null);
        }
    }

    /** 生成最终答案 */
    private String generateFinalAnswer(ReActSession session, String userGoal) {
        try {
            String prompt = """
                    基于以下对话历史，为用户的目标生成最终的总结回答。

                    用户目标：%s

                    请给出清晰、完整的回答，包含执行了哪些步骤，以及最终结果。
                    """.formatted(userGoal);

            var result = router.execute(new AiGatewayRouter.RouteRequest(
                    prompt, "你是一个智能助手，请总结任务执行结果。", null,
                    "quality", ModelCapability.ANALYZE, false
            ));

            return result.content() != null ? result.content() : "任务执行完成，共 " + session.getMessageHistory().size() + " 步。";
        } catch (Exception e) {
            return "任务执行完成（步骤数: " + session.getMessageHistory().size() + "）";
        }
    }

    /** 获取会话状态 */
    public ReActSession getSession(String sessionId) {
        return sessions.get(sessionId);
    }

    /** 清除会话 */
    public void clearSession(String sessionId) {
        sessions.remove(sessionId);
    }

    // ===== 内部类 =====

    /** Thought 结果 */
    public static class ThoughtResult {
        private final String reasoning;
        private final boolean isComplete;
        private final String finalAnswer;
        private final ToolCall toolCall;
        private final boolean success;
        private final String error;

        public ThoughtResult(String reasoning, boolean isComplete, String finalAnswer, ToolCall toolCall) {
            this.reasoning = reasoning;
            this.isComplete = isComplete;
            this.finalAnswer = finalAnswer;
            this.toolCall = toolCall;
            this.success = true;
            this.error = null;
        }

        private ThoughtResult(String reasoning, boolean isComplete, String finalAnswer, ToolCall toolCall,
                             boolean success, String error) {
            this.reasoning = reasoning;
            this.isComplete = isComplete;
            this.finalAnswer = finalAnswer;
            this.toolCall = toolCall;
            this.success = success;
            this.error = error;
        }

        public static ThoughtResult error(String msg) {
            return new ThoughtResult(msg, true, "", null, false, msg);
        }

        public boolean success() { return success; }
        public String error() { return error; }
        public String reasoning() { return reasoning; }
        public boolean isComplete() { return isComplete; }
        public String finalAnswer() { return finalAnswer; }
        public ToolCall toolCall() { return toolCall; }
    }

    /** 工具调用 */
    public record ToolCall(String toolName, String parameters) {}

    /** ReAct 会话 */
    public static class ReActSession {
        private final String sessionId;
        private final String userGoal;
        private final List<Map.Entry<String, String>> messageHistory = new ArrayList<>();
        private String status = "running";

        public ReActSession(String sessionId) {
            this.sessionId = sessionId;
            this.userGoal = "";
        }

        public void addMessage(String role, String content) {
            messageHistory.add(new AbstractMap.SimpleEntry<>(role, content));
        }

        public String getSessionId() { return sessionId; }
        public String getUserGoal() { return userGoal; }
        public List<Map.Entry<String, String>> getMessageHistory() { return List.copyOf(messageHistory); }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
    }

    /** ReAct 执行结果 */
    public record ReActResult(
            String sessionId,
            String status,
            int stepsExecuted,
            long totalTimeMs,
            String finalAnswer,
            List<Map.Entry<String, String>> messageHistory,
            List<String> errors
    ) {}
}
