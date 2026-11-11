package com.example.usertrackingextensionbackend.model.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "device_domain_preferences", uniqueConstraints = @UniqueConstraint(
        columnNames = {"device_id", "domain"}))
@Getter
@Setter
@NoArgsConstructor
public class DeviceDomainPreference {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "device_id", nullable = false)
    private String deviceId;

    @Column(nullable = false)
    private String domain;

    @Column(nullable = false)
    private boolean excluded;

    @Enumerated(EnumType.STRING)
    @Column(name = "category_override")
    private Category categoryOverride;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    @PreUpdate
    void updateTimestamp() {
        updatedAt = Instant.now();
    }
}
