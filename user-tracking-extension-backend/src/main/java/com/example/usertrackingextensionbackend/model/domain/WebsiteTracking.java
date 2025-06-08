package com.example.usertrackingextensionbackend.model.domain;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "website_tracking")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class WebsiteTracking {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String domain;
    
    @Column(nullable = false)
    private Long dailyTimeSpentSeconds;
    
    @Column(nullable = false)
    private Long weeklyTimeSpentSeconds;
    
    @Column(nullable = false)
    private Long monthlyTimeSpentSeconds;
    
    @Column(nullable = false)
    private LocalDateTime lastUpdated;
    
    @Column(nullable = false)
    private LocalDateTime lastDailyReset;
    
    @Column(nullable = false)
    private LocalDateTime lastWeeklyReset;
    
    @Column(nullable = false)
    private LocalDateTime lastMonthlyReset;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        lastUpdated = now;
        lastDailyReset = now;
        lastWeeklyReset = now;
        lastMonthlyReset = now;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getDomain() {
        return domain;
    }

    public void setDomain(String domain) {
        this.domain = domain;
    }

    public Long getDailyTimeSpentSeconds() {
        return dailyTimeSpentSeconds;
    }

    public void setDailyTimeSpentSeconds(Long dailyTimeSpentSeconds) {
        this.dailyTimeSpentSeconds = dailyTimeSpentSeconds;
    }

    public Long getWeeklyTimeSpentSeconds() {
        return weeklyTimeSpentSeconds;
    }

    public void setWeeklyTimeSpentSeconds(Long weeklyTimeSpentSeconds) {
        this.weeklyTimeSpentSeconds = weeklyTimeSpentSeconds;
    }

    public Long getMonthlyTimeSpentSeconds() {
        return monthlyTimeSpentSeconds;
    }

    public void setMonthlyTimeSpentSeconds(Long monthlyTimeSpentSeconds) {
        this.monthlyTimeSpentSeconds = monthlyTimeSpentSeconds;
    }

    public LocalDateTime getLastUpdated() {
        return lastUpdated;
    }

    public void setLastUpdated(LocalDateTime lastUpdated) {
        this.lastUpdated = lastUpdated;
    }

    public LocalDateTime getLastDailyReset() {
        return lastDailyReset;
    }

    public void setLastDailyReset(LocalDateTime lastDailyReset) {
        this.lastDailyReset = lastDailyReset;
    }

    public LocalDateTime getLastWeeklyReset() {
        return lastWeeklyReset;
    }

    public void setLastWeeklyReset(LocalDateTime lastWeeklyReset) {
        this.lastWeeklyReset = lastWeeklyReset;
    }

    public LocalDateTime getLastMonthlyReset() {
        return lastMonthlyReset;
    }

    public void setLastMonthlyReset(LocalDateTime lastMonthlyReset) {
        this.lastMonthlyReset = lastMonthlyReset;
    }
}