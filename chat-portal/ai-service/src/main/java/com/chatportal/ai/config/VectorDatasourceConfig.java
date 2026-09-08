package com.chatportal.ai.config;

import com.zaxxer.hikari.HikariDataSource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;

@Slf4j
@Configuration
@ConditionalOnProperty(name = "app.vector.enabled", havingValue = "true", matchIfMissing = false)
public class VectorDatasourceConfig {

    private final AppConfig appConfig;

    public VectorDatasourceConfig(AppConfig appConfig) {
        this.appConfig = appConfig;
    }

    @Bean(name = "vectorDataSource", destroyMethod = "close")
    public DataSource vectorDataSource() {
        AppConfig.VectorDatasource dsConfig = appConfig.getVector().getDatasource();
        HikariDataSource ds = new HikariDataSource();
        ds.setJdbcUrl(dsConfig.getUrl());
        ds.setUsername(dsConfig.getUsername());
        ds.setPassword(dsConfig.getPassword());
        ds.setDriverClassName("org.postgresql.Driver");
        ds.setMaximumPoolSize(5);
        ds.setMinimumIdle(1);
        ds.setConnectionTimeout(10000);
        ds.setPoolName("vector-pool");

        try (var conn = ds.getConnection()) {
            log.info("PostgreSQL vector datasource connected: {}", dsConfig.getUrl());
            // 初始化向量相关表
            initVectorSchema(conn);
        } catch (Exception e) {
            log.error("Failed to connect PostgreSQL vector datasource: {}. Vector matching will be disabled.", e.getMessage());
            ds.close();
            appConfig.getVector().setEnabled(false);
            throw new RuntimeException("PostgreSQL vector datasource unavailable", e);
        }

        return ds;
    }

    @Bean(name = "vectorJdbcTemplate")
    public JdbcTemplate vectorJdbcTemplate(@Qualifier("vectorDataSource") DataSource vectorDataSource) {
        return new JdbcTemplate(vectorDataSource);
    }

    /**
     * 初始化向量相关表结构（pgvector）
     */
    private void initVectorSchema(java.sql.Connection conn) {
        String[] ddl = {
            "CREATE EXTENSION IF NOT EXISTS vector",
            """
            CREATE TABLE IF NOT EXISTS knowledge_chunks (
              id          VARCHAR(100) PRIMARY KEY,
              doc_id      VARCHAR(100) NOT NULL,
              chunk_index INTEGER NOT NULL DEFAULT 0,
              text        TEXT NOT NULL,
              embedding   VECTOR(768),
              created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
            """,
            "CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc_id ON knowledge_chunks(doc_id)",
            "CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding ON knowledge_chunks USING hnsw (embedding vector_cosine_ops)"
        };
        try (var stmt = conn.createStatement()) {
            for (String sql : ddl) {
                stmt.execute(sql);
            }
            log.info("✅ Knowledge chunks vector schema initialized");
        } catch (Exception e) {
            log.warn("Failed to init vector schema: {}. If 'vector' extension fails, ensure pgvector is installed.", e.getMessage());
        }
    }
}
