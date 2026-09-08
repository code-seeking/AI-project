package com.chatportal.ai.tool;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.sql.*;
import java.util.*;
import java.util.stream.Collectors;

/**
 * 数据库查询工具 — AI 可对已配置的数据源执行只读 SQL 查询
 * <p>
 * 安全限制：
 * - 仅允许 SELECT 查询
 * - 自动 LIMIT 500 防止大数据量
 * - 只读事务隔离
 */
@Slf4j
@Component
public class DbTool implements SystemTool {

    private final ObjectMapper json = new ObjectMapper();

    @Value("${app.ai-gateway.db.url:}")
    private String dbUrl;

    @Value("${app.ai-gateway.db.username:}")
    private String dbUsername;

    @Value("${app.ai-gateway.db.password:}")
    private String dbPassword;

    private static final int MAX_RESULTS = 500;

    @Override
    public String getName() { return "database"; }

    @Override
    public String getDescription() {
        return "数据库查询：对已配置的数据源执行 SQL 查询。仅支持 SELECT 查询，自动限制结果数量。";
    }

    @Override
    public String getParameterSchema() {
        return """
        {
            "type": "object",
            "properties": {
                "sql": { "type": "string", "description": "SQL 查询语句（仅 SELECT 允许）" },
                "maxRows": { "type": "integer", "description": "最大返回行数（默认 100）" }
            },
            "required": ["sql"]
        }
        """;
    }

    @Override
    public ToolResult execute(ToolContext ctx, String parameters) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> params = json.readValue(parameters, Map.class);
            String sql = ((String) params.getOrDefault("sql", "")).trim();

            // 安全检查：只允许 SELECT
            if (!sql.toUpperCase().startsWith("SELECT")) {
                return ToolResult.fail("仅允许 SELECT 查询");
            }
            if (dbUrl == null || dbUrl.isBlank()) {
                return ToolResult.fail("数据库连接未配置");
            }

            int maxRows = params.containsKey("maxRows")
                    ? ((Number) params.get("maxRows")).intValue()
                    : 100;
            maxRows = Math.min(maxRows, MAX_RESULTS);

            return executeQuery(sql, maxRows);
        } catch (Exception e) {
            return ToolResult.fail("数据库查询失败: " + e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private ToolResult executeQuery(String sql, int maxRows) {
        try (Connection conn = DriverManager.getConnection(dbUrl, dbUsername, dbPassword);
             PreparedStatement stmt = conn.prepareStatement(sql)) {

            stmt.setMaxRows(maxRows);
            conn.setReadOnly(true);
            conn.setTransactionIsolation(Connection.TRANSACTION_READ_UNCOMMITTED);

            try (ResultSet rs = stmt.executeQuery()) {
                ResultSetMetaData meta = rs.getMetaData();
                int columnCount = meta.getColumnCount();

                List<String> columns = new ArrayList<>();
                for (int i = 1; i <= columnCount; i++) {
                    columns.add(meta.getColumnLabel(i));
                }

                List<Map<String, Object>> rows = new ArrayList<>();
                while (rs.next()) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    for (int i = 1; i <= columnCount; i++) {
                        row.put(columns.get(i - 1), rs.getObject(i));
                    }
                    rows.add(row);
                }

                Map<String, Object> result = new LinkedHashMap<>();
                result.put("columns", columns);
                result.put("rows", rows);
                result.put("rowCount", rows.size());
                result.put("sql", sql);

                log.info("数据库查询完成: rows={}, sql={}", rows.size(), sql.substring(0, Math.min(100, sql.length())));
                String resultJson = json.writerWithDefaultPrettyPrinter().writeValueAsString(result);
                return ToolResult.ok("查询成功", resultJson);
            }
        } catch (Exception e) {
            return ToolResult.fail("SQL 执行失败: " + e.getMessage());
        }
    }
}
