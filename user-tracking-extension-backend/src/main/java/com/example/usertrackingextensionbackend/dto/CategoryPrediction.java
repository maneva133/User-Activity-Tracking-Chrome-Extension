package com.example.usertrackingextensionbackend.dto;

import com.example.usertrackingextensionbackend.model.domain.Category;

public record CategoryPrediction(Category category, String classifier, String model,
                                boolean cacheHit, int apiCalls) { }
