package com.example.usertrackingextensionbackend.service;

import com.example.usertrackingextensionbackend.dto.ActivitySessionRequest;
import com.example.usertrackingextensionbackend.dto.DeletedUsageRange;
import com.example.usertrackingextensionbackend.dto.OpenAIResponse;
import com.example.usertrackingextensionbackend.dto.ReminderEventRequest;
import com.example.usertrackingextensionbackend.dto.UsageOverview;
import com.example.usertrackingextensionbackend.model.domain.ActivitySession;
import com.example.usertrackingextensionbackend.model.domain.Category;
import com.example.usertrackingextensionbackend.model.domain.ReminderEvent;
import com.example.usertrackingextensionbackend.repository.DailySiteUsage;
import com.example.usertrackingextensionbackend.repository.DomainTitleUsage;
import com.example.usertrackingextensionbackend.repository.ActivitySessionRepository;
import com.example.usertrackingextensionbackend.repository.ReminderEventRepository;
import org.springframework.dao.DataIntegrityViolationException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ActivitySessionService {
    private final ActivitySessionRepository sessions;
    private final ReminderEventRepository reminders;
    private final CategoryService categories;
    private final AIService aiService;
    private final DeviceDomainPreferenceService domainPreferences;

    @Transactional
    public ActivitySession createSession(ActivitySessionRequest request) {
        if (request.getDeviceId() == null || request.getDeviceId().isBlank()
                || request.getDomain() == null || request.getDomain().isBlank()) {
            throw new IllegalArgumentException("deviceId and domain must not be blank");
        }
        if (request.getStartTs() == null || request.getEndTs() == null
                || !request.getEndTs().isAfter(request.getStartTs())) {
            throw new IllegalArgumentException("endTs must be after startTs");
        }
        if (request.getDurationSeconds() == null || request.getDurationSeconds() <= 0) {
            throw new IllegalArgumentException("durationSeconds must be positive");
        }
        if (sessions.existsByDeviceIdAndDomainAndStartTsAndEndTs(request.getDeviceId(), request.getDomain(), request.getStartTs(), request.getEndTs())) {
            throw new DuplicateRecordException("Activity session already exists");
        }
        if (domainPreferences.isExcluded(request.getDeviceId(), request.getDomain())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This domain is excluded from tracking");
        }
        ActivitySession entity = new ActivitySession();
        Category category;
        String categorySource;
        try {
            category = request.getCategory() == null || request.getCategory().isBlank()
                    ? categories.classifyByRules(request.getDomain(), request.getPageTitle())
                    : Category.valueOf(request.getCategory().trim().toUpperCase(java.util.Locale.ROOT));
            categorySource = request.getCategorySource() == null || request.getCategorySource().isBlank()
                    ? "rules" : request.getCategorySource();
        } catch (IllegalArgumentException exception) {
            category = categories.classifyByRules(request.getDomain(), request.getPageTitle());
            categorySource = "rules";
        }
        entity.setDeviceId(request.getDeviceId());
        entity.setDomain(request.getDomain());
        entity.setPageTitle(request.getPageTitle());
        entity.setStartTs(request.getStartTs());
        entity.setEndTs(request.getEndTs());
        entity.setDurationSeconds(request.getDurationSeconds());
        entity.setCategory(category.name());
        entity.setCategorySource(categorySource);
        try {
            // Flush here so a concurrent retry that passes the existence check is translated
            // into the same 409 response as a duplicate found by the check above.
            return sessions.saveAndFlush(entity);
        } catch (DataIntegrityViolationException exception) {
            throw new DuplicateRecordException("Activity session already exists");
        }
    }

    @Transactional
    public ReminderEvent createReminder(ReminderEventRequest request) {
        if (request.getDeviceId() == null || request.getDeviceId().isBlank()
                || request.getTs() == null || request.getStrategy() == null || request.getStrategy().isBlank()
                || request.getSessionLengthSecondsAtTrigger() == null || request.getSessionLengthSecondsAtTrigger() < 0
                || request.getUserResponse() == null) {
            throw new IllegalArgumentException("Reminder event fields are invalid");
        }
        if (reminders.existsByDeviceIdAndTsAndStrategy(request.getDeviceId(), request.getTs(), request.getStrategy())) {
            throw new DuplicateRecordException("Reminder event already exists");
        }
        ReminderEvent entity = new ReminderEvent();
        entity.setDeviceId(request.getDeviceId());
        entity.setTs(request.getTs());
        entity.setStrategy(request.getStrategy());
        entity.setSessionLengthSecondsAtTrigger(request.getSessionLengthSecondsAtTrigger());
        entity.setUserResponse(request.getUserResponse());
        return reminders.save(entity);
    }

    public List<ActivitySession> findSessions(String deviceId, Instant from, Instant to) {
        if (deviceId == null || deviceId.isBlank() || from == null || to == null || to.isBefore(from)) {
            throw new IllegalArgumentException("deviceId, valid from, and to are required");
        }
        return sessions.findByDeviceIdAndStartTsGreaterThanEqualAndEndTsLessThanEqualOrderByStartTsAsc(deviceId, from, to);
    }

    public UsageOverview getOverview(String deviceId, Instant from, Instant to, String timeZone) {
        if (deviceId == null || deviceId.isBlank() || from == null || to == null || to.isBefore(from)) {
            throw new IllegalArgumentException("deviceId, valid from, and to are required");
        }
        ZoneId zone;
        try {
            zone = ZoneId.of(timeZone == null || timeZone.isBlank() ? "UTC" : timeZone);
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "timeZone must be a valid IANA time zone");
        }

        List<DailySiteUsage> grouped = sessions.summarizeByLocalDayAndDomain(deviceId, from, to, zone.getId());
        Map<LocalDate, Long> daily = new java.util.TreeMap<>();
        Map<String, Long> sites = new HashMap<>();
        for (DailySiteUsage usage : grouped) {
            daily.merge(LocalDate.parse(usage.getDay()), usage.getSeconds(), Long::sum);
            sites.merge(usage.getDomain(), usage.getSeconds(), Long::sum);
        }
        long total = daily.values().stream().mapToLong(Long::longValue).sum();
        List<UsageOverview.DailyTotal> days = daily.entrySet().stream()
                .map(entry -> new UsageOverview.DailyTotal(entry.getKey(), entry.getValue())).toList();
        List<UsageOverview.SiteTotal> topSites = sites.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .map(entry -> new UsageOverview.SiteTotal(entry.getKey(), entry.getValue())).toList();
        List<UsageOverview.RecentSession> recent = sessions
                .findTop20ByDeviceIdAndStartTsGreaterThanEqualAndEndTsLessThanEqualOrderByEndTsDesc(deviceId, from, to)
                .stream()
                .map(session -> new UsageOverview.RecentSession(session.getDomain(), session.getPageTitle(),
                        session.getCategory(), session.getStartTs(), session.getEndTs(), session.getDurationSeconds()))
                .toList();
        long pairCount = sessions.countDistinctDomainTitlePairs(deviceId, from, to);
        return new UsageOverview(total, daily.size(), sites.size(), pairCount, days, topSites, recent);
    }

    public OpenAIResponse analyzeSessions(String deviceId, Instant from, Instant to, String classifier) {
        String selected = classifier == null ? "rules" : classifier.trim().toLowerCase(Locale.ROOT);
        if (!selected.equals("rules") && !selected.equals("llm")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "classifier must be rules or llm");
        }

        List<DomainTitleUsage> records = sessions.summarizeByDomainAndTitle(deviceId, from, to);
        long study = 0, entertainment = 0, work = 0, social = 0, other = 0;
        Map<String, Category> classifiedPairs = new HashMap<>();
        Map<String, Category> overrides = domainPreferences.list(deviceId).stream()
                .filter(preference -> preference.getCategoryOverride() != null)
                .collect(java.util.stream.Collectors.toMap(
                        com.example.usertrackingextensionbackend.model.domain.DeviceDomainPreference::getDomain,
                        com.example.usertrackingextensionbackend.model.domain.DeviceDomainPreference::getCategoryOverride));
        for (DomainTitleUsage session : records) {
            String title = session.getPageTitle() == null ? "" : session.getPageTitle();
            String pairKey = session.getDomain() + "\u0000" + title;
            Category override = overrides.get(session.getDomain());
            Category category = override != null ? override : classifiedPairs.computeIfAbsent(pairKey, ignored ->
                    selected.equals("rules") ? categories.classifyByRules(session.getDomain(), title)
                            : aiService.classify(session.getDomain(), title, true).category());
            long seconds = session.getSeconds() == null ? 0 : session.getSeconds();
            switch (category) {
                case STUDY -> study += seconds;
                case ENTERTAINMENT -> entertainment += seconds;
                case WORK -> work += seconds;
                case SOCIAL -> social += seconds;
                case OTHER -> other += seconds;
            }
        }

        String summary = records.isEmpty()
                ? "No usage data found for this period."
                : "Usage totals grouped by the " + selected + " classifier.";
        String recommendation = records.isEmpty()
                ? "Browse tracked websites to generate usage data for analysis."
                : "Review the category totals and take regular breaks during long browsing sessions.";
        return new OpenAIResponse(study, entertainment, work, social, other, summary, recommendation);
    }

    @Transactional
    public DeletedUsageRange deleteUsageRange(String deviceId, Instant from, Instant to) {
        if (deviceId == null || deviceId.isBlank() || from == null || to == null || to.isBefore(from)) {
            throw new IllegalArgumentException("deviceId, valid from, and to are required");
        }
        long sessionCount = sessions.deleteByDeviceIdAndStartTsGreaterThanEqualAndEndTsLessThanEqual(deviceId, from, to);
        long reminderCount = reminders.deleteByDeviceIdAndTsGreaterThanEqualAndTsLessThanEqual(deviceId, from, to);
        return new DeletedUsageRange(sessionCount, reminderCount);
    }

    public List<ActivitySession> exportSessions(String deviceId) {
        if (deviceId == null || deviceId.isBlank()) throw new IllegalArgumentException("deviceId is required");
        return sessions.findByDeviceIdOrderByStartTsAsc(deviceId);
    }
}
