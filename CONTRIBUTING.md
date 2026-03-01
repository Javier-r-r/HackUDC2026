# 🤝 Contributing to Muninn

First off, thank you for considering contributing to Muninn! We want to make our AI-powered Second Brain as frictionless and powerful as possible, and community contributions are a huge part of that.

This document outlines our process and standards to help you get started quickly.

---

## 🛠️ 1. Setting Up the Development Environment

Muninn is divided into a Python-based backend (FastAPI) and a Vanilla JS frontend (Progressive Web App).

### Prerequisites
* Python 3.10+
* Node.js 22+ (Only if you plan to build the native mobile app via Capacitor)

### Backend Setup (FastAPI)
1. Clone the repository: `git clone https://github.com/Javier-r-r/HackUDC2026.git`
2. Navigate to the project directory: `cd kelea-web-dashboard`
3. Install the required dependencies: 
   ```bash
   pip install fastapi uvicorn groq pyyaml pydantic
