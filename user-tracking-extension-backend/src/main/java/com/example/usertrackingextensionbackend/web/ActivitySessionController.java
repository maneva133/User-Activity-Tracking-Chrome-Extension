package com.example.usertrackingextensionbackend.web;

import com.example.usertrackingextensionbackend.dto.ActivitySessionRequest;
import com.example.usertrackingextensionbackend.dto.ReminderEventRequest;
import com.example.usertrackingextensionbackend.model.domain.ActivitySession;
import com.example.usertrackingextensionbackend.model.domain.ReminderEvent;
import com.example.usertrackingextensionbackend.service.ActivitySessionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class ActivitySessionController {
    private final ActivitySessionService service;

    @PostMapping("/sessions")
    public ResponseEntity<ActivitySession> createSession(@Valid @RequestBody ActivitySessionRequest request) {
        return ResponseEntity.status(201).body(service.createSession(request));
    }

    @PostMapping("/reminders")
    public ResponseEntity<ReminderEvent> createReminder(@Valid @RequestBody ReminderEventRequest request) {
        return ResponseEntity.status(201).body(service.createReminder(request));
    }

    @GetMapping("/sessions")
    public List<ActivitySession> getSessions(
            @RequestParam String deviceId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to) {
        return service.findSessions(deviceId, from, to);
    }

    @GetMapping(value = "/export/{deviceId}.csv", produces = "text/csv")
    public ResponseEntity<String> exportSessions(@PathVariable String deviceId) {
        StringBuilder csv = new StringBuilder("id,deviceId,domain,pageTitle,startTs,endTs,durationSeconds,category,categorySource\n");
        for (ActivitySession session : service.exportSessions(deviceId)) {
            csv.append(session.getId()).append(',')
                    .append(cell(session.getDeviceId())).append(',')
                    .append(cell(session.getDomain())).append(',')
                    .append(cell(session.getPageTitle())).append(',')
                    .append(session.getStartTs()).append(',')
                    .append(session.getEndTs()).append(',')
                    .append(session.getDurationSeconds()).append(',')
                    .append(cell(session.getCategory())).append(',')
                    .append(cell(session.getCategorySource())).append('\n');
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + deviceId + ".csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv.toString());
    }

    private String cell(String value) {
        if (value == null) return "";
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }
}
