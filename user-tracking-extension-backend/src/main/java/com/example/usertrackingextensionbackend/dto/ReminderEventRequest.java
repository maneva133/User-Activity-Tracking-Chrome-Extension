package com.example.usertrackingextensionbackend.dto;

import com.example.usertrackingextensionbackend.model.domain.ReminderEvent.UserResponse;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.Data;

import java.time.Instant;

@Data
public class ReminderEventRequest {
    @NotBlank private String deviceId;
    @NotNull private Instant ts;
    @NotBlank private String strategy;
    @NotNull @PositiveOrZero private Long sessionLengthSecondsAtTrigger;
    @NotNull private UserResponse userResponse;
}
