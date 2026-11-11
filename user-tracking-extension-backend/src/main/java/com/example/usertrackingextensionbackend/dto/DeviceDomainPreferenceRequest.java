package com.example.usertrackingextensionbackend.dto;

import com.example.usertrackingextensionbackend.model.domain.Category;
import jakarta.validation.constraints.NotBlank;

public record DeviceDomainPreferenceRequest(
        @NotBlank String deviceId,
        @NotBlank String domain,
        boolean excluded,
        Category categoryOverride) { }
