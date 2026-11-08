package com.example.usertrackingextensionbackend.service;

import com.example.usertrackingextensionbackend.dto.CategoryPrediction;

public interface AIService {
    CategoryPrediction classify(String domain, String title, boolean useCache);
}
