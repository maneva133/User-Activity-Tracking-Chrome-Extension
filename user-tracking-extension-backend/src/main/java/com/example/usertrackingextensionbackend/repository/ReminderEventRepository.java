package com.example.usertrackingextensionbackend.repository;

import com.example.usertrackingextensionbackend.model.domain.ReminderEvent;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReminderEventRepository extends JpaRepository<ReminderEvent, Long> {
    boolean existsByDeviceIdAndTsAndStrategy(String deviceId, java.time.Instant ts, String strategy);
}
