package com.example.usertrackingextensionbackend.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record UsageOverview(long totalSeconds, int activeDays, int siteCount,
                            long classificationPairCount, List<DailyTotal> dailyTotals, List<SiteTotal> siteTotals,
                            List<RecentSession> recentSessions) {
    public record DailyTotal(LocalDate date, long seconds) { }
    public record SiteTotal(String domain, long seconds) { }
    public record RecentSession(String domain, String pageTitle, String category,
                                Instant startTs, Instant endTs, long durationSeconds) { }
}
