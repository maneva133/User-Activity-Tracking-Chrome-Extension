package com.example.usertrackingextensionbackend.dto;

public class TrackingRequest {
    private String domain;
    private Long timeSpentSeconds;

    public String getDomain() {
        return domain;
    }

    public void setDomain(String domain) {
        this.domain = domain;
    }

    public Long getTimeSpentSeconds() {
        return timeSpentSeconds;
    }

    public void setTimeSpentSeconds(Long timeSpentSeconds) {
        this.timeSpentSeconds = timeSpentSeconds;
    }
}