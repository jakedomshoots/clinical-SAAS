# Concierge OS iPad App

Native SwiftUI iPad app for clinical workflows. Designed for the exam room — fast, offline-capable, and secure.

## Features

- **Patient Charting** — Full patient records with allergies, meds, problems, vitals
- **Schedule** — Daily appointment view with color-coded status
- **Tasks** — To-do list with priorities and due times
- **Messages** — Secure patient messaging
- **Offline Support** — Queue changes, sync when connected
- **Vitals Entry** — Quick BP, temp, HR, O2 sat input
- **eRx Ready** — Prescription workflow (integrated with DoseSpot)

## Architecture

```
ConciergeOS/
├── ConciergeOSApp.swift      # App entry point
├── Models/
│   └── Patient.swift         # Patient, Allergy, Medication, Problem, Vitals
├── Services/
│   ├── AuthManager.swift     # Login/logout, token management
│   ├── APIClient.swift       # REST API client (Combine-based)
│   └── SyncEngine.swift      # Offline queue, background sync
└── Views/
    ├── ContentView.swift     # Root view (auth gate + tab bar)
    ├── LoginView.swift       # Server config + sign in
    ├── PatientListView.swift # Searchable patient directory
    ├── PatientDetailView.swift # Chart, vitals, meds, labs, notes
    ├── ScheduleView.swift    # Calendar + appointment list
    ├── TasksView.swift       # Task management
    ├── MessagesView.swift    # Patient messaging
    └── SettingsView.swift    # Profile, sync status, logout
```

## Setup

1. Open `ConciergeOS.xcodeproj` in Xcode 15+
2. Set your API base URL in LoginView or via Settings
3. Build and run on iPad simulator or device

## Configuration

The app connects to your Concierge OS API. Set the server URL on first launch:
- Production: `https://api.yourpractice.com`
- Local dev: `http://localhost:8000`

## Offline Behavior

- Patient list cached locally
- Chart edits queued for sync
- Vitals recorded offline, uploaded when connected
- Visual "Offline" badge shown when no connectivity

## Security

- Token stored in Keychain (not UserDefaults in production)
- Biometric auth support (Face ID / Touch ID)
- Auto-lock after inactivity
- No patient data in app screenshots
