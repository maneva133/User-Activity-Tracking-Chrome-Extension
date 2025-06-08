package com.example.usertrackingextensionbackend.web;

import com.example.usertrackingextensionbackend.dto.TrackingRequest;
import com.example.usertrackingextensionbackend.dto.TrackingStatistics;
import com.example.usertrackingextensionbackend.model.domain.WebsiteTracking;
import com.example.usertrackingextensionbackend.service.Impl.WebsiteTrackingServiceImpl;
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

    @PostMapping
    public ResponseEntity<WebsiteTracking> saveTracking(@RequestBody TrackingRequest request) {
        return ResponseEntity.ok(service.saveTracking(request.getDomain(), request.getTimeSpentSeconds()));
    }

    @GetMapping("/domain/{domain}")
    public ResponseEntity<WebsiteTracking> getTrackingByDomain(@PathVariable String domain) {
        return ResponseEntity.ok(service.getTrackingByDomain(domain));
    }

    @GetMapping("/statistics/{domain}")
    public ResponseEntity<TrackingStatistics> getStatistics(@PathVariable String domain) {
        return ResponseEntity.ok(service.getStatistics(domain));
    }

    @GetMapping("/statistics/daily/all")
    public ResponseEntity<List<TrackingStatistics>> getAllDailyStatistics() {
        return ResponseEntity.ok(service.getDailyStatisticsForAllDomains());
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
    public ResponseEntity<String> deleteById(@PathVariable Long id){
        service.deleteById(id);
        return ResponseEntity.ok("Deleted successfully");
    }


} 