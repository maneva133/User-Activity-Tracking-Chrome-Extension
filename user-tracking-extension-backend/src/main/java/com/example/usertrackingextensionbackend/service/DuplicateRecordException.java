package com.example.usertrackingextensionbackend.service;

public class DuplicateRecordException extends RuntimeException {
    public DuplicateRecordException(String message) { super(message); }
}
