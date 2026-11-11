package com.example.usertrackingextensionbackend.service;

import com.example.usertrackingextensionbackend.dto.ActivitySessionRequest;
import com.example.usertrackingextensionbackend.repository.ActivitySessionRepository;
import com.example.usertrackingextensionbackend.repository.ReminderEventRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

class ActivitySessionServiceTest {
    private final ActivitySessionRepository sessions = mock(ActivitySessionRepository.class);
    private final DeviceDomainPreferenceService domainPreferences = mock(DeviceDomainPreferenceService.class);
    private final ActivitySessionService service = new ActivitySessionService(
            sessions, mock(ReminderEventRepository.class), mock(CategoryService.class),
            mock(AIService.class), domainPreferences);

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

    @Test
    void mapsConcurrentDuplicateInsertToConflictException() {
        ActivitySessionRequest request = validRequest();
        request.setCategory("OTHER");
        when(sessions.saveAndFlush(any())).thenThrow(new DataIntegrityViolationException("duplicate key"));

        assertThrows(DuplicateRecordException.class, () -> service.createSession(request));
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
