package com.example.usertrackingextensionbackend.web;

import com.example.usertrackingextensionbackend.dto.OpenAIRequest;
import com.example.usertrackingextensionbackend.dto.OpenAIResponse;
import com.example.usertrackingextensionbackend.dto.TrackingRequest;
import com.example.usertrackingextensionbackend.dto.TrackingStatistics;
import com.example.usertrackingextensionbackend.model.domain.WebsiteTracking;
import com.example.usertrackingextensionbackend.model.domain.Category;
import com.example.usertrackingextensionbackend.service.Impl.WebsiteTrackingServiceImpl;
import com.example.usertrackingextensionbackend.service.AIService;
import com.example.usertrackingextensionbackend.service.CategoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/tracking")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class WebsiteTrackingController {

    private final WebsiteTrackingServiceImpl service;
    private final AIService aiService;
    private final CategoryService categoryService;

    @PostMapping
    public ResponseEntity<TrackingRequest> saveTracking(@RequestBody TrackingRequest request) {
        String deviceId = request.getDeviceId();

        if (deviceId == null || deviceId.isBlank()) {
            deviceId = java.util.UUID.randomUUID().toString();
        }

        WebsiteTracking saved = service.saveTracking(deviceId, request.getDomain(), request.getTimeSpentSeconds());

        TrackingRequest response = new TrackingRequest();
        response.setDeviceId(deviceId);
        response.setDomain(saved.getDomain());
        response.setTimeSpentSeconds(request.getTimeSpentSeconds());

        return ResponseEntity.ok(response);
    }


    @GetMapping("/domain/{domain}")
    public ResponseEntity<WebsiteTracking> getTrackingByDomain(@PathVariable String domain) {
        return ResponseEntity.ok(service.getTrackingByDomain(domain));
    }

    @GetMapping("/statistics/{domain}")
    public ResponseEntity<TrackingStatistics> getStatistics(
            @PathVariable String domain,
            @RequestParam(required = true) String deviceId) {

        if (deviceId == null || deviceId.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(service.getStatistics(deviceId, domain));
    }



    @GetMapping("/statistics/daily/all")
    public ResponseEntity<List<TrackingStatistics>> getAllDailyStatisticsForDevice(@RequestParam String deviceId) {
        return ResponseEntity.ok(service.getDailyStatisticsForDevice(deviceId));
    }


    @GetMapping("/date-range")
    public ResponseEntity<List<WebsiteTracking>> getTrackingBetweenDates(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end) {
        return ResponseEntity.ok(service.getTrackingBetweenDates(start, end));
    }

    @GetMapping
    public ResponseEntity<List<WebsiteTracking>> getAllTracking() {
        return ResponseEntity.ok(service.getAllTracking());
    }

    @DeleteMapping("/delete/{id}")
    public ResponseEntity<String> deleteById(@PathVariable Long id) {
        service.deleteById(id);
        return ResponseEntity.ok("Deleted successfully");
    }

    @PostMapping("/analyze")
    public ResponseEntity<OpenAIResponse> analyzeWebsiteUsage(
            @RequestBody OpenAIRequest request,
            @RequestParam(defaultValue = "rules") String classifier) {
        return ResponseEntity.ok(analyze(request, classifier));
    }

    @GetMapping("/analyze/{timeFrame}")
    public ResponseEntity<OpenAIResponse> analyzeWebsiteUsageForDevice(
            @PathVariable String timeFrame,
            @RequestParam String deviceId,
            @RequestParam(defaultValue = "rules") String classifier) {
        
        List<TrackingStatistics> statistics = service.getDailyStatisticsForDevice(deviceId);
        
        List<TrackingStatistics> nonZeroStats = statistics.stream()
                .filter(stat -> stat.getDailyTimeSpentSeconds() != null && stat.getDailyTimeSpentSeconds() > 0)
                .toList();
        
        if (nonZeroStats.isEmpty()) {
            OpenAIResponse emptyResponse = new OpenAIResponse(
                    0L, 0L, 0L, 0L, 0L,
                    "No usage data found for analysis.",
                    "Start browsing websites to generate usage statistics for analysis."
            );
            return ResponseEntity.ok(emptyResponse);
        }
        
        OpenAIRequest request = new OpenAIRequest();
        request.setTimeFrame(timeFrame);
        request.setWebsites(nonZeroStats.stream()
                .map(stat -> new OpenAIRequest.WebsiteUsage(stat.getDomain(), stat.getDailyTimeSpentSeconds()))
                .toList());
        
        return ResponseEntity.ok(analyze(request, classifier));
    }

    private OpenAIResponse analyze(OpenAIRequest request, String classifier) {
        String selected = normalizeClassifier(classifier);
        long study = 0, work = 0, entertainment = 0, social = 0, other = 0;
        for (OpenAIRequest.WebsiteUsage website : request.getWebsites()) {
            Category category = selected.equals("rules")
                    ? categoryService.classifyByRules(website.getDomain(), "")
                    : aiService.classify(website.getDomain(), "", true).category();
            long seconds = website.getTimeSpentSeconds() == null ? 0 : website.getTimeSpentSeconds();
            switch (category) {
                case STUDY -> study += seconds;
                case WORK -> work += seconds;
                case ENTERTAINMENT -> entertainment += seconds;
                case SOCIAL -> social += seconds;
                case OTHER -> other += seconds;
            }
        }
        return new OpenAIResponse(study, entertainment, work, social, other,
                "Usage totals grouped by " + selected + " classifier.",
                "Take regular breaks and review categories that do not match your goals.");
    }

    private String normalizeClassifier(String classifier) {
        String selected = classifier == null ? "rules" : classifier.trim().toLowerCase(java.util.Locale.ROOT);
        if (!selected.equals("rules") && !selected.equals("llm")) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "classifier must be rules or llm");
        }
        return selected;
    }
}
