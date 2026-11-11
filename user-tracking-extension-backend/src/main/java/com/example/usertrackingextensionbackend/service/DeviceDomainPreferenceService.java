package com.example.usertrackingextensionbackend.service;

import com.example.usertrackingextensionbackend.dto.DeviceDomainPreferenceRequest;
import com.example.usertrackingextensionbackend.model.domain.DeviceDomainPreference;
import com.example.usertrackingextensionbackend.repository.ActivitySessionRepository;
import com.example.usertrackingextensionbackend.repository.DeviceDomainPreferenceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class DeviceDomainPreferenceService {
    private final DeviceDomainPreferenceRepository preferences;
    private final ActivitySessionRepository sessions;

    public List<DeviceDomainPreference> list(String deviceId) {
        requireDeviceId(deviceId);
        return preferences.findAllByDeviceIdOrderByDomainAsc(deviceId);
    }

    public boolean isExcluded(String deviceId, String domain) {
        return preferences.findByDeviceIdAndDomain(deviceId, normalizeDomain(domain))
                .map(DeviceDomainPreference::isExcluded).orElse(false);
    }

    public Optional<DeviceDomainPreference> find(String deviceId, String domain) {
        return preferences.findByDeviceIdAndDomain(deviceId, normalizeDomain(domain));
    }

    @Transactional
    public DeviceDomainPreference save(DeviceDomainPreferenceRequest request) {
        requireDeviceId(request.deviceId());
        String domain = normalizeDomain(request.domain());
        if (domain.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "domain is required");

        DeviceDomainPreference preference = preferences.findByDeviceIdAndDomain(request.deviceId(), domain)
                .orElseGet(DeviceDomainPreference::new);
        preference.setDeviceId(request.deviceId());
        preference.setDomain(domain);
        preference.setExcluded(request.excluded());
        preference.setCategoryOverride(request.categoryOverride());
        DeviceDomainPreference saved = preferences.save(preference);

        if (request.excluded()) sessions.deleteByDeviceIdAndDomain(request.deviceId(), domain);
        return saved;
    }

    @Transactional
    public void delete(String deviceId, String domain) {
        requireDeviceId(deviceId);
        preferences.deleteByDeviceIdAndDomain(deviceId, normalizeDomain(domain));
    }

    private String normalizeDomain(String domain) {
        if (domain == null) return "";
        return domain.trim().toLowerCase(Locale.ROOT)
                .replaceFirst("^https?://", "").replaceFirst("/.*$", "").replaceFirst("^www\\.", "");
    }

    private void requireDeviceId(String deviceId) {
        if (deviceId == null || deviceId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "deviceId is required");
        }
    }
}
