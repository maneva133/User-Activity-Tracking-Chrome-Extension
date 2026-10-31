package com.example.usertrackingextensionbackend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.time.Instant;

@Data
public class ActivitySessionRequest {
    @NotBlank private String deviceId;
    @NotBlank private String domain;
    private String pageTitle;
    @NotNull private Instant startTs;
    @NotNull private Instant endTs;
    @NotNull @Positive private Long durationSeconds;
    private String category;
    private String categorySource;
}
