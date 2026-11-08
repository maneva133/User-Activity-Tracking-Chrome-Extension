package com.example.usertrackingextensionbackend.service;

import com.example.usertrackingextensionbackend.model.domain.Category;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.EnumMap;
import java.util.Locale;
import java.util.Map;

@Service
@Slf4j
public class CategoryService {
    private final ObjectMapper objectMapper;
    private final Map<String, Category> domains = new java.util.HashMap<>();
    private final Map<Category, java.util.List<String>> titleKeywords = new EnumMap<>(Category.class);

    public CategoryService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @PostConstruct
    void loadRules() {
        try (InputStream input = new ClassPathResource("categories.json").getInputStream()) {
            JsonNode root = objectMapper.readTree(input);
            root.path("domains").fields().forEachRemaining(entry ->
                    domains.put(normalizeDomain(entry.getKey()), Category.valueOf(entry.getValue().asText().toUpperCase(Locale.ROOT))));
            root.path("titleKeywords").fields().forEachRemaining(entry -> {
                Category category = Category.valueOf(entry.getKey().toUpperCase(Locale.ROOT));
                java.util.List<String> keywords = new java.util.ArrayList<>();
                entry.getValue().forEach(value -> keywords.add(value.asText().toLowerCase(Locale.ROOT)));
                titleKeywords.put(category, keywords);
            });
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to load categories.json", exception);
        }
    }

    public Category classifyByRules(String domain, String title) {
        String normalizedDomain = normalizeDomain(domain);
        return domains.entrySet().stream()
                .filter(entry -> normalizedDomain.equals(entry.getKey()) || normalizedDomain.endsWith("." + entry.getKey()))
                .max(java.util.Comparator.comparingInt(entry -> entry.getKey().length()))
                .map(Map.Entry::getValue)
                .orElseGet(() -> {
                    String normalizedTitle = title == null ? "" : title.toLowerCase(Locale.ROOT);
                    for (Category category : new Category[]{Category.STUDY, Category.WORK, Category.ENTERTAINMENT, Category.SOCIAL}) {
                        if (titleKeywords.getOrDefault(category, java.util.List.of()).stream().anyMatch(normalizedTitle::contains)) {
                            return category;
                        }
                    }
                    return Category.OTHER;
                });
    }

    private String normalizeDomain(String domain) {
        if (domain == null) return "";
        String normalized = domain.trim().toLowerCase(Locale.ROOT);
        normalized = normalized.replaceFirst("^https?://", "").replaceFirst("/.*$", "").replaceFirst("^www\\.", "");
        return normalized;
    }
}
