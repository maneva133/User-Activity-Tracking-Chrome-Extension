package com.example.usertrackingextensionbackend.service;

import com.example.usertrackingextensionbackend.dto.TrackingStatistics;
import com.example.usertrackingextensionbackend.model.domain.WebsiteTracking;

import java.time.LocalDateTime;
import java.util.List;

public interface WebsiteTrackingService {
    WebsiteTracking saveTracking(String deviceId, String domain, Long timeSpentSeconds);

    List<WebsiteTracking> getTrackingBetweenDates(LocalDateTime start, LocalDateTime end);

    List<WebsiteTracking> getAllTracking();

    WebsiteTracking getTrackingByDomain(String domain);

    void deleteById(Long id);

    TrackingStatistics getStatistics(String deviceId, String domain);

    WebsiteTracking getTrackingByDeviceIdAndDomain(String deviceId, String domain) ;

    void checkAndResetTimers();

    List<TrackingStatistics> getDailyStatisticsForAllDomains();

    List<TrackingStatistics> getDailyStatisticsForDevice(String deviceId);
}
