package com.example.usertrackingextensionbackend.service.Impl;

import com.example.usertrackingextensionbackend.dto.TrackingStatistics;
import com.example.usertrackingextensionbackend.model.domain.WebsiteTracking;
import com.example.usertrackingextensionbackend.repository.WebsiteTrackingRepository;
import com.example.usertrackingextensionbackend.service.WebsiteTrackingService;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WebsiteTrackingServiceImpl implements WebsiteTrackingService {

    private final WebsiteTrackingRepository repository;

    @Override
    @Transactional
    public WebsiteTracking saveTracking(String deviceId, String domain, Long timeSpentSeconds) {
        WebsiteTracking tracking = repository.findByDomainAndDeviceId(domain, deviceId)
                .orElseGet(() -> {
                    WebsiteTracking newTracking = new WebsiteTracking();
                    newTracking.setDeviceId(deviceId);
                    newTracking.setDomain(domain);
                    newTracking.setDailyTimeSpentSeconds(0L);
                    newTracking.setWeeklyTimeSpentSeconds(0L);
                    newTracking.setMonthlyTimeSpentSeconds(0L);
                    return newTracking;
                });

        checkAndResetTimers(tracking);
        
        tracking.setDailyTimeSpentSeconds((tracking.getDailyTimeSpentSeconds() != null ? tracking.getDailyTimeSpentSeconds() : 0L) + timeSpentSeconds);
        tracking.setWeeklyTimeSpentSeconds((tracking.getWeeklyTimeSpentSeconds() != null ? tracking.getWeeklyTimeSpentSeconds() : 0L) + timeSpentSeconds);
        tracking.setMonthlyTimeSpentSeconds((tracking.getMonthlyTimeSpentSeconds() != null ? tracking.getMonthlyTimeSpentSeconds() : 0L) + timeSpentSeconds);
        tracking.setLastUpdated(LocalDateTime.now());
        
        return repository.save(tracking);
    }

    @Override
    public WebsiteTracking getTrackingByDomain(String domain) {
        return repository.findByDomain(domain)
                .orElseThrow(() -> new RuntimeException("Tracking not found for domain: " + domain));
    }
    @Override
    public WebsiteTracking getTrackingByDeviceIdAndDomain(String deviceId, String domain) {
        return repository.findByDomainAndDeviceId(domain, deviceId)
                .orElseThrow(() -> new RuntimeException("Tracking not found for domain: " + domain + " and deviceId: " + deviceId));
    }

    @Override
    public List<WebsiteTracking> getTrackingBetweenDates(LocalDateTime start, LocalDateTime end) {
        return repository.findByLastUpdatedBetween(start, end);
    }

    @Override
    public List<WebsiteTracking> getAllTracking() {
        return repository.findAll();
    }

    @Override
    public void deleteById(Long id) {
        repository.deleteById(id);
    }

    @Override
    public TrackingStatistics getStatistics(String deviceId, String domain) {
        WebsiteTracking tracking = getTrackingByDeviceIdAndDomain(deviceId, domain);
        checkAndResetTimers(tracking);
        repository.save(tracking);
        
        return new TrackingStatistics(
                tracking.getDomain(),
                tracking.getDailyTimeSpentSeconds(),
                tracking.getWeeklyTimeSpentSeconds(),
                tracking.getMonthlyTimeSpentSeconds()
        );
    }

    @Override
    @Scheduled(cron = "0 0 0 * * ?")
    @Transactional
    public void checkAndResetTimers() {
        List<WebsiteTracking> allTracking = repository.findAll();

        for (WebsiteTracking tracking : allTracking) {
            checkAndResetTimers(tracking);
        }
        
        repository.saveAll(allTracking);
    }

    @Override
    public List<TrackingStatistics> getDailyStatisticsForAllDomains() {

        List<WebsiteTracking> allTracking = repository.findAll();
        return allTracking.stream()
                .map(tracking -> {
                    checkAndResetTimers(tracking);
                    return new TrackingStatistics(
                            tracking.getDomain(),
                            tracking.getDailyTimeSpentSeconds(),
                            tracking.getWeeklyTimeSpentSeconds(),
                            tracking.getMonthlyTimeSpentSeconds()
                    );
                })
                .collect(Collectors.toList());
    }

    @Override
    public List<TrackingStatistics> getDailyStatisticsForDevice(String deviceId) {
        List<WebsiteTracking> allTracking = repository.findAllByDeviceId(deviceId);
        return allTracking.stream()
                .map(tracking -> {
                    checkAndResetTimers(tracking);
                    return new TrackingStatistics(
                            tracking.getDomain(),
                            tracking.getDailyTimeSpentSeconds(),
                            tracking.getWeeklyTimeSpentSeconds(),
                            tracking.getMonthlyTimeSpentSeconds()
                    );
                })
                .collect(Collectors.toList());
    }

    private void checkAndResetTimers(WebsiteTracking tracking) {
        LocalDateTime now = LocalDateTime.now();

        if (tracking.getLastDailyReset() == null) {
            tracking.setLastDailyReset(now);
        }
        if (tracking.getLastWeeklyReset() == null) {
            tracking.setLastWeeklyReset(now);
        }
        if (tracking.getLastMonthlyReset() == null) {
            tracking.setLastMonthlyReset(now);
        }
        if (tracking.getDailyTimeSpentSeconds() == null) {
            tracking.setDailyTimeSpentSeconds(0L);
        }
        if (tracking.getWeeklyTimeSpentSeconds() == null) {
            tracking.setWeeklyTimeSpentSeconds(0L);
        }
        if (tracking.getMonthlyTimeSpentSeconds() == null) {
            tracking.setMonthlyTimeSpentSeconds(0L);
        }

        if (ChronoUnit.DAYS.between(tracking.getLastDailyReset(), now) >= 1) {
            tracking.setDailyTimeSpentSeconds(0L);
            tracking.setLastDailyReset(now);
        }

        if (ChronoUnit.WEEKS.between(tracking.getLastWeeklyReset(), now) >= 1) {
            tracking.setWeeklyTimeSpentSeconds(0L);
            tracking.setLastWeeklyReset(now);
        }

        if (ChronoUnit.MONTHS.between(tracking.getLastMonthlyReset(), now) >= 1) {
            tracking.setMonthlyTimeSpentSeconds(0L);
            tracking.setLastMonthlyReset(now);
        }
    }
} 