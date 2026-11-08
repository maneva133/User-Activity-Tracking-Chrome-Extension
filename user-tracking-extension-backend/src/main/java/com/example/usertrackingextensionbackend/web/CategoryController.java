package com.example.usertrackingextensionbackend.web;

import com.example.usertrackingextensionbackend.dto.CategoryPrediction;
import com.example.usertrackingextensionbackend.service.AIService;
import com.example.usertrackingextensionbackend.service.CategoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class CategoryController {
    private final CategoryService categoryService;
    private final AIService aiService;

    @GetMapping("/classify")
    public ResponseEntity<CategoryPrediction> classify(
            @RequestParam String domain,
            @RequestParam(defaultValue = "") String title,
            @RequestParam(defaultValue = "rules") String classifier,
            @RequestParam(defaultValue = "true") boolean useCache) {
        String selected = classifier == null ? "rules" : classifier.trim().toLowerCase(Locale.ROOT);
        if (selected.equals("rules")) {
            return ResponseEntity.ok(new CategoryPrediction(categoryService.classifyByRules(domain, title), "rules", null, false, 0));
        }
        if (selected.equals("llm")) return ResponseEntity.ok(aiService.classify(domain, title, useCache));
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "classifier must be rules or llm");
    }
}
