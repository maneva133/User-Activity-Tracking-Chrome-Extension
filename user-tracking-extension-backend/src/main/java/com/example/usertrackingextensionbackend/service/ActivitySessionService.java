package com.example.usertrackingextensionbackend.service;

import com.example.usertrackingextensionbackend.dto.ActivitySessionRequest;
import com.example.usertrackingextensionbackend.dto.ReminderEventRequest;
import com.example.usertrackingextensionbackend.model.domain.ActivitySession;
import com.example.usertrackingextensionbackend.model.domain.ReminderEvent;
import com.example.usertrackingextensionbackend.repository.ActivitySessionRepository;
import com.example.usertrackingextensionbackend.repository.ReminderEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ActivitySessionService {
    private final ActivitySessionRepository sessions;
    private final ReminderEventRepository reminders;

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
        ActivitySession entity = new ActivitySession();
        entity.setDeviceId(request.getDeviceId());
        entity.setDomain(request.getDomain());
        entity.setPageTitle(request.getPageTitle());
        entity.setStartTs(request.getStartTs());
        entity.setEndTs(request.getEndTs());
        entity.setDurationSeconds(request.getDurationSeconds());
        entity.setCategory(request.getCategory());
        entity.setCategorySource(request.getCategorySource());
        return sessions.save(entity);
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

    public List<ActivitySession> exportSessions(String deviceId) {
        if (deviceId == null || deviceId.isBlank()) throw new IllegalArgumentException("deviceId is required");
        return sessions.findByDeviceIdOrderByStartTsAsc(deviceId);
    }
}
