package com.example.usertrackingextensionbackend.dto;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OpenAIRequest {
    private List<WebsiteUsage> websites;
    private String timeFrame;
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class WebsiteUsage {
        private String domain;
        private Long timeSpentSeconds;
    }
} 