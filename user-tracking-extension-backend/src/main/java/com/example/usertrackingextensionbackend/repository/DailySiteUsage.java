package com.example.usertrackingextensionbackend.repository;

public interface DailySiteUsage {
    String getDay();
    String getDomain();
    Long getSeconds();
}
