package com.example.usertrackingextensionbackend.service;

import com.example.usertrackingextensionbackend.dto.ActivitySessionRequest;
import com.example.usertrackingextensionbackend.repository.ActivitySessionRepository;
import com.example.usertrackingextensionbackend.repository.ReminderEventRepository;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

class ActivitySessionServiceTest {
    private final ActivitySessionService service = new ActivitySessionService(
            mock(ActivitySessionRepository.class), mock(ReminderEventRepository.class));

    @Test
    void rejectsEndBeforeStart() {
        ActivitySessionRequest request = validRequest();
        request.setEndTs(request.getStartTs());
        assertThrows(IllegalArgumentException.class, () -> service.createSession(request));
    }

    @Test
    void rejectsNonPositiveDuration() {
        ActivitySessionRequest request = validRequest();
        request.setDurationSeconds(0L);
        assertThrows(IllegalArgumentException.class, () -> service.createSession(request));
    }

    @Test
    void rejectsBlankDomain() {
        ActivitySessionRequest request = validRequest();
        request.setDomain("  ");
        assertThrows(IllegalArgumentException.class, () -> service.createSession(request));
    }

    private ActivitySessionRequest validRequest() {
        ActivitySessionRequest request = new ActivitySessionRequest();
        request.setDeviceId("device");
        request.setDomain("example.com");
        request.setStartTs(Instant.parse("2026-01-01T00:00:00Z"));
        request.setEndTs(Instant.parse("2026-01-01T00:00:10Z"));
        request.setDurationSeconds(10L);
        return request;
    }
}
