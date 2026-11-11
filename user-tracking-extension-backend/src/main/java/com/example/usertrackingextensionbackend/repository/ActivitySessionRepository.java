package com.example.usertrackingextensionbackend.repository;

import com.example.usertrackingextensionbackend.model.domain.ActivitySession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface ActivitySessionRepository extends JpaRepository<ActivitySession, Long> {
    boolean existsByDeviceIdAndDomainAndStartTsAndEndTs(String deviceId, String domain, Instant startTs, Instant endTs);
    List<ActivitySession> findByDeviceIdAndStartTsGreaterThanEqualAndEndTsLessThanEqualOrderByStartTsAsc(
            String deviceId, Instant from, Instant to);
    List<ActivitySession> findTop20ByDeviceIdAndStartTsGreaterThanEqualAndEndTsLessThanEqualOrderByEndTsDesc(
            String deviceId, Instant from, Instant to);
    List<ActivitySession> findByDeviceIdOrderByStartTsAsc(String deviceId);
    long deleteByDeviceIdAndDomain(String deviceId, String domain);
    long deleteByDeviceIdAndStartTsGreaterThanEqualAndEndTsLessThanEqual(String deviceId, Instant from, Instant to);

    @Query(value = "select to_char(end_ts at time zone :timeZone, 'YYYY-MM-DD') as day, domain as domain, " +
            "sum(duration_seconds) as seconds from activity_sessions " +
            "where device_id = :deviceId and start_ts >= :from and end_ts <= :to " +
            "group by 1, 2 order by 1, 2", nativeQuery = true)
    List<DailySiteUsage> summarizeByLocalDayAndDomain(@Param("deviceId") String deviceId,
            @Param("from") Instant from, @Param("to") Instant to, @Param("timeZone") String timeZone);

    @Query("select s.domain as domain, s.pageTitle as pageTitle, sum(s.durationSeconds) as seconds " +
            "from ActivitySession s where s.deviceId = :deviceId and s.startTs >= :from and s.endTs <= :to " +
            "group by s.domain, s.pageTitle")
    List<DomainTitleUsage> summarizeByDomainAndTitle(@Param("deviceId") String deviceId,
            @Param("from") Instant from, @Param("to") Instant to);

    @Query(value = "select count(*) from (select domain, page_title from activity_sessions " +
            "where device_id = :deviceId and start_ts >= :from and end_ts <= :to " +
            "group by domain, page_title) as page_pairs", nativeQuery = true)
    long countDistinctDomainTitlePairs(@Param("deviceId") String deviceId,
            @Param("from") Instant from, @Param("to") Instant to);
}
