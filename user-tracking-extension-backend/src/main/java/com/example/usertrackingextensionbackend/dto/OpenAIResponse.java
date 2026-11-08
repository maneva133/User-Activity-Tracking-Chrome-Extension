package com.example.usertrackingextensionbackend.dto;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OpenAIResponse {
    private Long studyTime;
    private Long entertainmentTime;
    private Long workTime;
    private Long socialTime;
    private Long otherTime;
    private String analysis;
    private String recommendation;
}
