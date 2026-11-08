package com.example.usertrackingextensionbackend.repository;

import com.example.usertrackingextensionbackend.model.domain.CategoryCache;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CategoryCacheRepository extends JpaRepository<CategoryCache, Long> {
    Optional<CategoryCache> findTopByDomainAndTitleHashAndModelOrderByCreatedAtDesc(
            String domain, String titleHash, String model);
}
