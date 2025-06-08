package com.example.usertrackingextensionbackend.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TrackingStatistics {
    private String domain;
    private Long dailyTimeSpentSeconds;
    private Long weeklyTimeSpentSeconds;
    private Long monthlyTimeSpentSeconds;
} 