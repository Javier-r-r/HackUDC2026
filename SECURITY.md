# Security Policy

## Supported Versions

Versions of the project currently being supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Known Issues

*   **Localhost API Exposure**: The current backend runs on `localhost:8000` without authentication by default, intended for personal local use. Exposing this port to a public network is not recommended.
*   **API Keys**: Users are responsible for keeping their OpenAI/Groq API keys secure. They are stored in the browser's local storage by the extension.

Thank you for helping keep Kelea Digital Brain secure!
