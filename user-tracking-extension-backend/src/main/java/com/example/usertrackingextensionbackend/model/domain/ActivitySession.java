package com.example.usertrackingextensionbackend.model.domain;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "activity_sessions", uniqueConstraints = @UniqueConstraint(
        columnNames = {"device_id", "domain", "start_ts", "end_ts"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ActivitySession {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "device_id", nullable = false)
    private String deviceId;
    @Column(nullable = false)
    private String domain;
    @Column(name = "page_title")
    private String pageTitle;
    @Column(name = "start_ts", nullable = false)
    private Instant startTs;
    @Column(name = "end_ts", nullable = false)
    private Instant endTs;
    @Column(name = "duration_seconds", nullable = false)
    private Long durationSeconds;
    private String category;
    @Column(name = "category_source")
    private String categorySource;
}
