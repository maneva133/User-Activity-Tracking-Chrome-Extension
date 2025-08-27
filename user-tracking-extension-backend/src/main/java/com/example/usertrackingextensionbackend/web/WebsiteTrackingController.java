package com.example.usertrackingextensionbackend.web;

import com.example.usertrackingextensionbackend.dto.OpenAIRequest;
import com.example.usertrackingextensionbackend.dto.OpenAIResponse;
import com.example.usertrackingextensionbackend.dto.TrackingRequest;
import com.example.usertrackingextensionbackend.dto.TrackingStatistics;
import com.example.usertrackingextensionbackend.model.domain.WebsiteTracking;
import com.example.usertrackingextensionbackend.service.Impl.WebsiteTrackingServiceImpl;
import com.example.usertrackingextensionbackend.service.AIService;
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
    public ResponseEntity<OpenAIResponse> analyzeWebsiteUsage(@RequestBody OpenAIRequest request) {
        return ResponseEntity.ok(aiService.analyzeWebsiteUsage(request));
    }

    @GetMapping("/analyze/{timeFrame}")
    public ResponseEntity<OpenAIResponse> analyzeWebsiteUsageForDevice(
            @PathVariable String timeFrame,
            @RequestParam String deviceId) {
        
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
        
        return ResponseEntity.ok(aiService.analyzeWebsiteUsage(request));
    }
} 