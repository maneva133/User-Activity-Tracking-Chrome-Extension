package com.example.usertrackingextensionbackend.service.Impl;

import com.example.usertrackingextensionbackend.dto.CategoryPrediction;
import com.example.usertrackingextensionbackend.model.domain.Category;
import com.example.usertrackingextensionbackend.model.domain.CategoryCache;
import com.example.usertrackingextensionbackend.repository.CategoryCacheRepository;
import com.example.usertrackingextensionbackend.service.AIService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class GeminiService implements AIService {
    @Value("${gemini.api.key:}")
    private String geminiApiKey;

    @Value("${gemini.api.url:https://generativelanguage.googleapis.com/v1beta/models/}")
    private String geminiApiUrl;

    @Value("${gemini.model:gemini-1.5-flash}")
    private String geminiModel;

    private final RestTemplate restTemplate;
    private final CategoryCacheRepository cacheRepository;
    private final ObjectMapper objectMapper;

    @Override
    public CategoryPrediction classify(String domain, String title, boolean useCache) {
        String normalizedDomain = normalizeDomain(domain);
        String titleHash = hashTitle(title);
        if (useCache) {
            var cached = cacheRepository.findTopByDomainAndTitleHashAndModelOrderByCreatedAtDesc(
                    normalizedDomain, titleHash, geminiModel);
            if (cached.isPresent()) {
                return new CategoryPrediction(cached.get().getCategory(), "llm", geminiModel, true, 0);
            }
        }

        Category category;
        try {
            category = callGemini(normalizedDomain, title == null ? "" : title);
        } catch (Exception exception) {
            log.warn("Gemini classification failed for domain {}; using OTHER", normalizedDomain, exception);
            int apiCalls = geminiApiKey == null || geminiApiKey.isBlank() ? 0 : 1;
            return new CategoryPrediction(Category.OTHER, "llm", geminiModel, false, apiCalls);
        }

        try {
            CategoryCache cache = new CategoryCache();
            cache.setDomain(normalizedDomain);
            cache.setTitleHash(titleHash);
            cache.setCategory(category);
            cache.setModel(geminiModel);
            cacheRepository.save(cache);
        } catch (Exception exception) {
            log.error("Unable to cache Gemini category for domain {}", normalizedDomain, exception);
        }
        return new CategoryPrediction(category, "llm", geminiModel, false, 1);
    }

    private Category callGemini(String domain, String title) throws Exception {
        if (geminiApiKey == null || geminiApiKey.isBlank()) {
            throw new IllegalStateException("gemini.api.key is not configured");
        }
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-goog-api-key", geminiApiKey);

        Map<String, Object> schema = Map.of(
                "type", "OBJECT",
                "properties", Map.of("category", Map.of(
                        "type", "STRING",
                        "enum", new String[]{"STUDY", "WORK", "ENTERTAINMENT", "SOCIAL", "OTHER"})),
                "required", new String[]{"category"}
        );
        String prompt = "Classify this single website into exactly one category: STUDY, WORK, ENTERTAINMENT, SOCIAL, or OTHER. " +
                "Use the domain and page title only. Return the category in the required JSON schema.\n" +
                "Domain: " + domain + "\nTitle: " + title;
        Map<String, Object> requestBody = Map.of(
                "contents", new Object[]{Map.of("parts", new Object[]{Map.of("text", prompt)})},
                "generationConfig", Map.of(
                        "temperature", 0,
                        "maxOutputTokens", 64,
                        "responseMimeType", "application/json",
                        "responseSchema", schema
                )
        );
        String baseUrl = geminiApiUrl.endsWith("/") ? geminiApiUrl : geminiApiUrl + "/";
        ResponseEntity<String> response = restTemplate.postForEntity(
                baseUrl + geminiModel + ":generateContent",
                new HttpEntity<>(requestBody, headers), String.class);
        if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
            throw new IllegalStateException("Gemini returned an empty or unsuccessful response: " + response.getStatusCode());
        }
        JsonNode root = objectMapper.readTree(response.getBody());
        JsonNode text = root.path("candidates").path(0).path("content").path("parts").path(0).path("text");
        if (!text.isTextual()) throw new IllegalArgumentException("Gemini response did not contain category JSON");
        JsonNode categoryNode = objectMapper.readTree(text.asText()).path("category");
        if (!categoryNode.isTextual()) throw new IllegalArgumentException("Gemini category field is missing or invalid");
        try {
            return Category.valueOf(categoryNode.asText().trim().toUpperCase(java.util.Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Gemini returned an unknown category", exception);
        }
    }

    private String hashTitle(String title) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(
                    (title == null ? "" : title.trim().toLowerCase(java.util.Locale.ROOT)).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to hash page title", exception);
        }
    }

    private String normalizeDomain(String domain) {
        if (domain == null) return "";
        return domain.trim().toLowerCase(java.util.Locale.ROOT)
                .replaceFirst("^https?://", "").replaceFirst("/.*$", "").replaceFirst("^www\\.", "");
    }
}
