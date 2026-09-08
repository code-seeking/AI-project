package com.chatportal.ai.gateway;

import com.chatportal.ai.gateway.ModelProfile.ModelTier;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * AI 调用成本追踪器 — 按模型、日期统计 token 消耗和费用
 */
@Slf4j
@Component
public class CostTracker {

    /** 模型级日统计 */
    private final ConcurrentHashMap<String, ModelDailyStats> modelDailyStats = new ConcurrentHashMap<>();

    /** 总统计 */
    private final AtomicLong totalInputTokens = new AtomicLong(0);
    private final AtomicLong totalOutputTokens = new AtomicLong(0);
    private final AtomicLong totalCost = new AtomicLong(0); // 分（人民币）
    private final AtomicInteger totalCalls = new AtomicInteger(0);
    private final AtomicInteger failedCalls = new AtomicInteger(0);
    private final AtomicInteger fallbackCalls = new AtomicInteger(0);

    public void recordCall(String modelId, ModelTier tier, int inputTokens, int outputTokens,
                           long latencyMs, boolean isFallback, boolean success) {
        LocalDate today = LocalDate.now();
        ModelDailyStats daily = modelDailyStats.computeIfAbsent(
                modelId + ":" + today, k -> new ModelDailyStats(modelId, today));

        synchronized (daily) {
            double inputCost = inputTokens * getModelCostPerToken(modelId) / 1000.0;
            double outputCost = outputTokens * getModelCostPerToken(modelId) * 2 / 1000.0;

            totalInputTokens.addAndGet(inputTokens);
            totalOutputTokens.addAndGet(outputTokens);
            totalCost.addAndGet((long) ((inputCost + outputCost) * 100));
            totalCalls.incrementAndGet();

            daily.inputTokens += inputTokens;
            daily.outputTokens += outputTokens;
            daily.cost += (inputCost + outputCost);
            daily.callCount++;

            if (!success) {
                failedCalls.incrementAndGet();
                daily.failedCount++;
            }
            if (isFallback) {
                fallbackCalls.incrementAndGet();
            }
        }

        if (totalCalls.get() % 100 == 0) {
            log.info("AI调用统计: 总调用={}, 失败={}, 降级={}, 总费用={}元",
                    totalCalls.get(), failedCalls.get(), fallbackCalls.get(),
                    String.format("%.2f", totalCost.get() / 100.0));
        }
    }

    public GatewayStats getStats() {
        return new GatewayStats(
                totalCalls.get(),
                failedCalls.get(),
                fallbackCalls.get(),
                totalInputTokens.get(),
                totalOutputTokens.get(),
                totalCost.get() / 100.0,
                Map.copyOf(modelDailyStats)
        );
    }

    /** 重置统计 */
    public void reset() {
        modelDailyStats.clear();
        totalInputTokens.set(0);
        totalOutputTokens.set(0);
        totalCost.set(0);
        totalCalls.set(0);
        failedCalls.set(0);
        fallbackCalls.set(0);
        log.info("成本统计已重置");
    }

    private double getModelCostPerToken(String modelId) {
        // 简化的成本映射（元/1K token）
        if (modelId.contains("qwen-max")) return 0.02;
        if (modelId.contains("qwen-plus")) return 0.008;
        if (modelId.contains("qwen-turbo")) return 0.002;
        if (modelId.contains("deepseek")) return 0.002;
        return 0.0; // 本地模型免费
    }

    /** 模型日统计 */
    public static class ModelDailyStats {
        final String modelId;
        final LocalDate date;
        long inputTokens;
        long outputTokens;
        double cost;
        int callCount;
        int failedCount;

        ModelDailyStats(String modelId, LocalDate date) {
            this.modelId = modelId;
            this.date = date;
        }
    }

    /** API 返回的统计快照 */
    public record GatewayStats(
            int totalCalls,
            int failedCalls,
            int fallbackCalls,
            long totalInputTokens,
            long totalOutputTokens,
            double totalCostYuan,
            Map<String, ModelDailyStats> dailyStats
    ) {}
}
