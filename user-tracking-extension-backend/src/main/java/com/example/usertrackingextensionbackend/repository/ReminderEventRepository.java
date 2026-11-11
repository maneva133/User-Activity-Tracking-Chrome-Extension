package com.example.usertrackingextensionbackend.repository;

import com.example.usertrackingextensionbackend.model.domain.ReminderEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;

public interface ReminderEventRepository extends JpaRepository<ReminderEvent, Long> {
    boolean existsByDeviceIdAndTsAndStrategy(String deviceId, Instant ts, String strategy);
    long deleteByDeviceIdAndTsGreaterThanEqualAndTsLessThanEqual(String deviceId, Instant from, Instant to);
}
