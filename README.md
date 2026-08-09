# ⚡ BigQuery Pulse — Release Notes & Social Sharing Hub

A modern web application built with **Python Flask** and **Vanilla HTML, CSS & JavaScript** that aggregates, parses, categorizes, and indexes official **Google Cloud BigQuery Release Notes** in real time, featuring an interactive Twitter / X social sharing studio.

[![Python](https://img.shields.io/badge/Python-3.11%2B-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.1.3-green.svg)](https://flask.palletsprojects.com/)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)
[![Feed Source](https://img.shields.io/badge/RSS%20Feed-Google%20Cloud-38bdf8.svg)](https://docs.cloud.google.com/feeds/bigquery-release-notes.xml)

---

## ✨ Features

- **🌐 Live RSS Feed Parser**: Ingests the official BigQuery Release Notes feed (`docs.cloud.google.com/feeds/bigquery-release-notes.xml`), parses complex HTML, and standardizes multi-update entries into distinct cards.
- **🏷️ Automated Categorization & Topic Tagging**: Categorizes updates into `Feature`, `Change`, `Deprecation`, `Announcement`, and `Security`, with automatic topic tags like `#Cross-Cloud`, `#SQL`, `#BigLake`, `#ML & AI`, `#Preview`, and `#GA`.
- **🎨 Glassmorphic Dark UI**: Modern dark theme with glowing ambient accents, crisp typography (`Outfit` & `Inter` Google Fonts), smooth card hover states, and dynamic view loading.
- **🔄 Live Refresh Control**: Interactive header refresh button with a spinning status indicator, cache timestamp badge, and forced feed re-sync (`?force=true`).
- **🔍 Full-Text Search & Filtering**: Instant search across headlines and content (with `/` keyboard shortcut), category pills, topic dropdowns, and local storage bookmarks manager.
- **🐦 Tweet Composer Studio**: Select any update to customize and preview a tweet using preset templates (*Standard 🚀*, *Punchy ⚡*, *Announcement 📣*, *Custom ✍️*). Includes a live character countdown, authentic Twitter Card preview, and 1-click posting via the Twitter Web Intent API.

---

## 🛠️ Technology Stack

- **Backend**: Python 3, Flask, `requests`, `feedparser`, `beautifulsoup4`
- **Frontend**: Plain Vanilla HTML5, CSS3 (Modern Glassmorphism & Custom Properties), JavaScript (ES6+)
- **Storage**: In-memory caching for API responses, `localStorage` for client-side bookmarks

---

## 🚀 Quickstart Guide

### Prerequisites
- Python 3.9+ installed on your system.

### Installation & Local Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/Wendyamemile-event-talks-app.git
   cd wendyamemile-event-talks-app
   ```

2. **Set Up Virtual Environment**:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

3. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Launch the Application**:
   ```bash
   python app.py
   ```

5. **Open in Browser**:
   Navigate to [http://127.0.0.1:5001](http://127.0.0.1:5001) in your browser.

---

## 📁 Directory Structure

```
.
├── app.py              # Flask server, RSS parser & API routes
├── requirements.txt    # Python dependencies
├── .gitignore          # Git ignore rules
├── README.md           # Project documentation
├── static/
│   ├── css/
│   │   └── style.css   # Custom Glassmorphic CSS design system
│   └── js/
│       └── main.js     # Client-side logic, filters & Tweet composer
└── templates/
    └── index.html      # Single-page HTML application
```

---

## 🔌 API Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/` | `GET` | Serves the main Single-Page Application |
| `/api/release-notes` | `GET` | Returns JSON of all parsed release notes (`?force=true` to bypass cache) |
| `/api/health` | `GET` | Health check endpoint returning server status |

---

## 📄 License & Attribuation

This project is open-source under the MIT License. Release note data is sourced directly from [Google Cloud Documentation Feed](https://docs.cloud.google.com/feeds/bigquery-release-notes.xml).
