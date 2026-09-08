package com.chatportal.ai.gateway;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * AI 提示缓存 — 对相同 prompt 的去重和缓存，降低 API 调用成本
 */
@Slf4j
@Component
public class PromptCache {

    private final ConcurrentHashMap<String, CacheEntry> cache = new ConcurrentHashMap<>();
    private final ScheduledExecutorService cleaner = Executors.newSingleThreadScheduledExecutor();

    @Value("${app.ai-gateway.cache.max-size:500}")
    private int maxSize;

    @Value("${app.ai-gateway.cache.ttl-minutes:30}")
    private int ttlMinutes;

    public PromptCache() {
        cleaner.scheduleAtFixedRate(this::evictExpired, 5, 5, TimeUnit.MINUTES);
    }

    /** 计算 prompt 的 SHA-256 哈希作为缓存键 */
    public String hash(String prompt, String systemPrompt) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            md.update(prompt.getBytes(StandardCharsets.UTF_8));
            if (systemPrompt != null) {
                md.update(systemPrompt.getBytes(StandardCharsets.UTF_8));
            }
            return HexFormat.of().formatHex(md.digest());
        } catch (NoSuchAlgorithmException e) {
            return String.valueOf(prompt.hashCode());
        }
    }

    /** 获取缓存 */
    public String get(String key) {
        CacheEntry entry = cache.get(key);
        if (entry == null) return null;
        if (isExpired(entry)) {
            cache.remove(key);
            return null;
        }
        entry.lastAccess = System.currentTimeMillis();
        log.debug("Prompt 缓存命中: key={}", key.substring(0, 8));
        return entry.result;
    }

    /** 存入缓存 */
    public void put(String key, String result) {
        if (cache.size() >= maxSize) {
            evictLRU();
        }
        cache.put(key, new CacheEntry(result, System.currentTimeMillis()));
    }

    /** 清除缓存 */
    public void clear() {
        cache.clear();
        log.info("Prompt 缓存已清空");
    }

    public int size() { return cache.size(); }

    private boolean isExpired(CacheEntry entry) {
        return System.currentTimeMillis() - entry.createdAt > (long) ttlMinutes * 60 * 1000;
    }

    /** LRU 淘汰：移除最久未访问的条目 */
    private void evictLRU() {
        cache.entrySet().stream()
                .min((a, b) -> Long.compare(a.getValue().lastAccess, b.getValue().lastAccess))
                .ifPresent(entry -> cache.remove(entry.getKey()));
    }

    /** 定期清理过期条目 */
    private void evictExpired() {
        int before = cache.size();
        cache.entrySet().removeIf(e -> isExpired(e.getValue()));
        int evicted = before - cache.size();
        if (evicted > 0) {
            log.debug("Prompt 缓存清理: 移除 {} 条过期条目", evicted);
        }
    }

    private static class CacheEntry {
        final String result;
        final long createdAt;
        long lastAccess;

        CacheEntry(String result, long createdAt) {
            this.result = result;
            this.createdAt = createdAt;
            this.lastAccess = createdAt;
        }
    }
}
