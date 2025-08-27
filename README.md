# ⏳ Chrome Extension for Time Management

**User-tracking** is a Chrome extension built to help you **take meaningful breaks**, manage your screen time, and stay aware of how much time you're spending online.  
It was mainly built because I realized I spend too much time on my PC — this tool reminds me to take breaks and helps me manage my time better.

Built using:
- **JavaScript** for the frontend
- 🌱 **Spring Boot** for backend integration
- 📈 **Chart.js** for rich data visualizations

---

## 🚀 Features

- ⏰ **Automatic Break Reminders**  
  Get notified when you've been online too long — take a short walk, stretch, or rest your eyes.

- 📊 **Usage Statistics**  
  Visualize your daily, weekly and monthly browsing time with clean, interactive charts powered by Chart.js.

- 📅 **Daily and Weekly Reports**  
  Track how much time you spend online across different sites and days.

- 💡 **Focus-Friendly UI**  
  Minimal and distraction-free design that keeps you focused on your productivity.


---

## Setup

1. Load the extension in Chrome:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select this directory

2. Configure backend URL:
   - The extension expects the backend to run at `http://localhost:8080`
   - If your backend runs on a different URL, update it in `background.js`

---

## Demo
![Capture](https://github.com/user-attachments/assets/109d8656-697e-4947-b9cc-378f5d3eb991)

# Gemini AI Integration Setup Guide

This guide will help you set up the Google Gemini AI integration feature for your User Activity Tracking Chrome Extension.

## Prerequisites

1. A Google Gemini API key (get one from https://makersuite.google.com/app/apikey)
2. Your backend server running
3. Chrome extension loaded

## Setup Steps

### 1. Configure Gemini API Key

1. Open `user-tracking-extension-backend/src/main/resources/application.properties`
2. Replace `your-gemini-api-key-here` with your actual Gemini API key:
   ```properties
   gemini.api.key=your-actual-gemini-api-key-here
   ```

### 2. Restart Backend Server

1. Stop your backend server (Ctrl+C)
2. Rebuild and restart:
   ```bash
   cd user-tracking-extension-backend
   mvn clean install
   mvn spring-boot:run
   ```

### 3. Reload Chrome Extension

1. Go to `chrome://extensions/`
2. Click the reload button on your extension
3. Or remove and re-add the extension

## How to Use

1. **Open the extension popup** on any website
2. **Click "Analyze My Usage"** button
3. **Wait for the analysis** to complete
4. **View the results**:
   - Brain Rot Time: Time spent on mindless scrolling/addictive content
   - Study Time: Time spent on educational websites
   - Entertainment Time: Time spent on entertainment/gaming
   - Productivity Time: Time spent on work/productivity tools
   - Social Media Time: Time spent on social networking sites
   - Analysis: AI-generated insights about your usage
   - Recommendation: Suggestions for improving your digital habits

## API Endpoints

### Analyze Usage for Device
```
GET /api/tracking/analyze/{timeFrame}?deviceId={deviceId}
```
- `timeFrame`: "daily", "weekly", "monthly"
- `deviceId`: Your device identifier

### Custom Analysis
```
POST /api/tracking/analyze
```
Body:
```json
{
  "timeFrame": "daily",
  "websites": [
    {
      "domain": "youtube.com",
      "timeSpentSeconds": 13860
    },
    {
      "domain": "tiktok.com",
      "timeSpentSeconds": 18000
    }
  ]
}
```

## Features

- **Smart Categorization**: AI automatically categorizes websites into meaningful categories
- **Personalized Insights**: Get analysis and recommendations based on your usage patterns
- **Multiple Time Frames**: Analyze daily, weekly, or monthly usage
- **Error Handling**: Graceful fallback if OpenAI API is unavailable

## Troubleshooting

### "Error analyzing usage" message
- Check if your Gemini API key is correct
- Ensure you have sufficient Gemini API quota
- Verify your backend server is running
- Check browser console for detailed error messages

### "Server not running" message
- Make sure your backend server is started
- Check if it's running on port 8080
- Verify database connection

### API Key Issues
- Ensure your Gemini API key is valid and has quota
- Check if the key has the necessary permissions
- Verify the key is properly set in application.properties

## Cost Considerations

- Each analysis request uses Gemini API tokens
- Gemini Pro is currently free for most usage (with quotas)
- Monitor your Gemini usage at https://makersuite.google.com/app/apikey

## Security Notes

- Never commit your API key to version control
- Consider using environment variables for production
- The API key is only used server-side and not exposed to the frontend 
