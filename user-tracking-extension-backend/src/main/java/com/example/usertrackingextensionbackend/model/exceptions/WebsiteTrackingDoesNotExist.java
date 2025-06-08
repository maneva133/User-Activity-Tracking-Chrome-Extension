package com.example.usertrackingextensionbackend.model.exceptions;

public class WebsiteTrackingDoesNotExist extends RuntimeException{
    public WebsiteTrackingDoesNotExist(String domain) {
        super("Website Tracking with domain " + domain + " does not exist!");
    }
}
