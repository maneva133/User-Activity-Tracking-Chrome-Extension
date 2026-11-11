package com.example.usertrackingextensionbackend.web;

import com.example.usertrackingextensionbackend.dto.DeviceDomainPreferenceRequest;
import com.example.usertrackingextensionbackend.model.domain.DeviceDomainPreference;
import com.example.usertrackingextensionbackend.service.DeviceDomainPreferenceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/device-domains")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class DeviceDomainPreferenceController {
    private final DeviceDomainPreferenceService service;

    @GetMapping
    public List<DeviceDomainPreference> list(@RequestParam String deviceId) {
        return service.list(deviceId);
    }

    @PutMapping
    public DeviceDomainPreference save(@Valid @RequestBody DeviceDomainPreferenceRequest request) {
        return service.save(request);
    }

    @DeleteMapping
    public void delete(@RequestParam String deviceId, @RequestParam String domain) {
        service.delete(deviceId, domain);
    }
}
