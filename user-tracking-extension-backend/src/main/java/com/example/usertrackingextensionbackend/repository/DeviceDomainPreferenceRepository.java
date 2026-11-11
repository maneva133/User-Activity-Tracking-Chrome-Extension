package com.example.usertrackingextensionbackend.repository;

import com.example.usertrackingextensionbackend.model.domain.DeviceDomainPreference;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DeviceDomainPreferenceRepository extends JpaRepository<DeviceDomainPreference, Long> {
    List<DeviceDomainPreference> findAllByDeviceIdOrderByDomainAsc(String deviceId);
    Optional<DeviceDomainPreference> findByDeviceIdAndDomain(String deviceId, String domain);
    void deleteByDeviceIdAndDomain(String deviceId, String domain);
}
