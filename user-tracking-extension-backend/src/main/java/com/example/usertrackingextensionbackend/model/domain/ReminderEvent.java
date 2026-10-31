package com.example.usertrackingextensionbackend.model.domain;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "reminder_events", uniqueConstraints = @UniqueConstraint(
        columnNames = {"device_id", "ts", "strategy"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReminderEvent {
    public enum UserResponse { ACCEPTED, SNOOZED, DISMISSED, IGNORED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "device_id", nullable = false)
    private String deviceId;
    @Column(nullable = false)
    private Instant ts;
    @Column(nullable = false)
    private String strategy;
    @Column(name = "session_length_seconds_at_trigger", nullable = false)
    private Long sessionLengthSecondsAtTrigger;
    @Enumerated(EnumType.STRING)
    @Column(name = "user_response", nullable = false)
    private UserResponse userResponse;
}
