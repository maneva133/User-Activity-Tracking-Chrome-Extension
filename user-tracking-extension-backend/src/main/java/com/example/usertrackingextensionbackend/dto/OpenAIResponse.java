package com.example.usertrackingextensionbackend.dto;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OpenAIResponse {
    private Long brainrotTime;
    private Long studyTime;
    private Long entertainmentTime;
    private Long productivityTime;
    private Long socialMediaTime;
    private String analysis;
    private String recommendation;
} 