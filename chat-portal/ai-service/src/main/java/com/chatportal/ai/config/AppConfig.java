package com.chatportal.ai.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Data
@Configuration
@ConfigurationProperties(prefix = "app")
public class AppConfig {

    private Vector vector = new Vector();

    @Data
    public static class Vector {
        private boolean enabled = true;
        private int dimensions = 768;
        private VectorDatasource datasource = new VectorDatasource();
    }

    @Data
    public static class VectorDatasource {
        private String url = "jdbc:postgresql://localhost:5432/chat_portal";
        private String username = "postgres";
        private String password = "";
    }
}
