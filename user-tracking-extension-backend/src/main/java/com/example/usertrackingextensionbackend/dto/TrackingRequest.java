package com.example.usertrackingextensionbackend.dto;

public class TrackingRequest {
    private String domain;
    private Long timeSpentSeconds;
    private String deviceId;

    public String getDomain() {
        return domain;
    }

    public String getDeviceId() {
        return deviceId;
    }
    public void setDeviceId(String deviceId) {
        this.deviceId = deviceId;
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