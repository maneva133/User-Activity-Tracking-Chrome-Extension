package com.example.usertrackingextensionbackend.repository;
import com.example.usertrackingextensionbackend.model.domain.WebsiteTracking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface WebsiteTrackingRepository extends JpaRepository<WebsiteTracking, Long> {
    Optional<WebsiteTracking> findByDomain(String domain);
    Optional<WebsiteTracking> findByDomainAndDeviceId(String domain, String deviceId);
    List<WebsiteTracking> findByLastUpdatedBetween(LocalDateTime start, LocalDateTime end);
    List<WebsiteTracking> findAllByDeviceId(String deviceId);
}