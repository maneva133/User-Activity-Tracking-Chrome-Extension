package com.example.usertrackingextensionbackend.service.Impl;
import com.example.usertrackingextensionbackend.dto.OpenAIRequest;
import com.example.usertrackingextensionbackend.dto.OpenAIResponse;
import com.example.usertrackingextensionbackend.service.AIService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class GeminiService implements AIService {
    @Value("${gemini.api.key}")
    private String geminiApiKey;

    @Value("${gemini.api.url:https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent}")
    private String geminiApiUrl;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public OpenAIResponse analyzeWebsiteUsage(OpenAIRequest request) {
        try {
            String prompt = buildPrompt(request);
            String response = callGemini(prompt);
            return parseGeminiResponse(response);
        } catch (Exception e) {
            log.error("Error analyzing website usage with Gemini", e);
            return createDefaultResponse();
        }
    }

    private String buildPrompt(OpenAIRequest request) {
        StringBuilder prompt = new StringBuilder();
        prompt.append("Analyze the following website usage statistics and categorize the time spent into different activities. ");
        prompt.append("IMPORTANT: Return ONLY a valid JSON object. All time values must be single numbers (no math expressions like '180 + 120'). ");
        prompt.append("Calculate the total time for each category and provide only the final number in seconds.\n\n");
        prompt.append("Required JSON structure:\n");
        prompt.append("{\n");
        prompt.append("  \"brainrotTime\": <total seconds as number>,\n");
        prompt.append("  \"studyTime\": <total seconds as number>,\n");
        prompt.append("  \"entertainmentTime\": <total seconds as number>,\n");
        prompt.append("  \"productivityTime\": <total seconds as number>,\n");
        prompt.append("  \"socialMediaTime\": <total seconds as number>,\n");
        prompt.append("  \"analysis\": \"<brief analysis>\",\n");
        prompt.append("  \"recommendation\": \"<recommendation>\"\n");
        prompt.append("}\n\n");

        prompt.append("Website usage for ").append(request.getTimeFrame()).append(":\n");

        for (OpenAIRequest.WebsiteUsage usage : request.getWebsites()) {
            long hours = usage.getTimeSpentSeconds() / 3600;
            long minutes = (usage.getTimeSpentSeconds() % 3600) / 60;
            prompt.append("- ").append(usage.getDomain()).append(": ");
            if (hours > 0) {
                prompt.append(hours).append("h");
            }
            if (minutes > 0) {
                prompt.append(minutes).append("min");
            }
            prompt.append(" (").append(usage.getTimeSpentSeconds()).append(" seconds)\n");
        }

        prompt.append("\nCategorize these websites into:\n");
        prompt.append("- brainrotTime: Time spent on mindless scrolling, addictive content\n");
        prompt.append("- studyTime: Time spent on educational websites, learning platforms\n");
        prompt.append("- entertainmentTime: Time spent on entertainment, gaming, streaming\n");
        prompt.append("- productivityTime: Time spent on work, productivity tools, professional development\n");
        prompt.append("- socialMediaTime: Time spent on social networking sites\n");
        prompt.append("\nRemember: All time values must be single numbers, not mathematical expressions!\n");

        return prompt.toString();
    }

    private String callGemini(String prompt) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("contents", new Object[]{
                    Map.of("parts", new Object[]{
                            Map.of("text", prompt)
                    })
            });
            requestBody.put("generationConfig", Map.of(
                    "temperature", 0.3,
                    "maxOutputTokens", 500
            ));

            String url = geminiApiUrl + "?key=" + geminiApiKey;
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);

            log.info("Calling Gemini API with URL: {}", url);
            log.info("Request body: {}", objectMapper.writeValueAsString(requestBody));

            ResponseEntity<String> response = restTemplate.postForEntity(url, request, String.class);

            log.info("Gemini API response status: {}", response.getStatusCode());
            log.info("Gemini API response body: {}", response.getBody());

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return response.getBody();
            } else {
                log.error("Gemini API returned non-successful status: {}", response.getStatusCode());
                throw new RuntimeException("Gemini API request failed");
            }
        } catch (Exception e) {
            log.error("Error calling Gemini API", e);
            throw new RuntimeException("Failed to call Gemini API", e);
        }
    }

    private OpenAIResponse parseGeminiResponse(String geminiResponse) {
        try {
            log.info("Parsing Gemini response: {}", geminiResponse);

            JsonNode responseNode = objectMapper.readTree(geminiResponse);

            if (responseNode.has("error")) {
                log.error("Gemini API returned error: {}", responseNode.get("error"));
                return createDefaultResponse();
            }

            if (!responseNode.has("candidates") || responseNode.get("candidates").isEmpty()) {
                log.error("No candidates found in Gemini response");
                return createDefaultResponse();
            }

            JsonNode candidate = responseNode.get("candidates").get(0);
            if (!candidate.has("content") || !candidate.get("content").has("parts")) {
                log.error("Invalid candidate structure in Gemini response");
                return createDefaultResponse();
            }

            String content = candidate.get("content").get("parts").get(0).get("text").asText();
            log.info("Extracted content from Gemini: {}", content);

            content = content.trim();
            if (content.startsWith("```json")) {
                content = content.substring(7);
            }
            if (content.endsWith("```")) {
                content = content.substring(0, content.length() - 3);
            }
            content = content.trim();

            log.info("Cleaned content for JSON parsing: {}", content);

            content = fixJsonContent(content);

            JsonNode analysisNode = objectMapper.readTree(content);

            return new OpenAIResponse(
                    analysisNode.get("brainrotTime").asLong(),
                    analysisNode.get("studyTime").asLong(),
                    analysisNode.get("entertainmentTime").asLong(),
                    analysisNode.get("productivityTime").asLong(),
                    analysisNode.get("socialMediaTime").asLong(),
                    analysisNode.get("analysis").asText(),
                    analysisNode.get("recommendation").asText()
            );
        } catch (Exception e) {
            log.error("Error parsing Gemini response: {}", geminiResponse, e);
            return createDefaultResponse();
        }
    }

    private String fixJsonContent(String content) {
        content = content.replaceAll("\"productivityTime\":\\s*([0-9]+)\\s*\\+\\s*([0-9]+)",
                "\"productivityTime\": $1");
        content = content.replaceAll("\"brainrotTime\":\\s*([0-9]+)\\s*\\+\\s*([0-9]+)",
                "\"brainrotTime\": $1");
        content = content.replaceAll("\"studyTime\":\\s*([0-9]+)\\s*\\+\\s*([0-9]+)",
                "\"studyTime\": $1");
        content = content.replaceAll("\"entertainmentTime\":\\s*([0-9]+)\\s*\\+\\s*([0-9]+)",
                "\"entertainmentTime\": $1");
        content = content.replaceAll("\"socialMediaTime\":\\s*([0-9]+)\\s*\\+\\s*([0-9]+)",
                "\"socialMediaTime\": $1");
        log.info("Fixed JSON content: {}", content);
        return content;
    }

    private OpenAIResponse createDefaultResponse() {
        return new OpenAIResponse(
                0L, 0L, 0L, 0L, 0L,
                "Unable to analyze usage at this time.",
                "Try again later or check your internet connection."
        );
    }
}

