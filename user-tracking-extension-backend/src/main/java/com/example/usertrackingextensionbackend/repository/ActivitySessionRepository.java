package com.example.usertrackingextensionbackend.repository;

import com.example.usertrackingextensionbackend.model.domain.ActivitySession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

public interface ActivitySessionRepository extends JpaRepository<ActivitySession, Long> {
    boolean existsByDeviceIdAndDomainAndStartTsAndEndTs(String deviceId, String domain, Instant startTs, Instant endTs);
    List<ActivitySession> findByDeviceIdAndStartTsGreaterThanEqualAndEndTsLessThanEqualOrderByStartTsAsc(
            String deviceId, Instant from, Instant to);
    List<ActivitySession> findByDeviceIdOrderByStartTsAsc(String deviceId);
}
