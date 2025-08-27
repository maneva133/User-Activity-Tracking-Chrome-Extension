package com.example.usertrackingextensionbackend.service;

import com.example.usertrackingextensionbackend.dto.OpenAIRequest;
import com.example.usertrackingextensionbackend.dto.OpenAIResponse;

public interface AIService {
    OpenAIResponse analyzeWebsiteUsage(OpenAIRequest request);
} 