# Liftwise: AI workout planner for iPhone

Liftwise is a SwiftUI iPhone app. You tell its AI coach what you want to work on, and it builds a periodized, multi-week training program. You then follow the program one workout at a time and log every set.

## Features

- **AI plan builder.** Pick a goal (build muscle, get stronger, lose fat, jump higher, run faster, athletic performance or general fitness) or describe your own. Then set:
  - areas to emphasize
  - program length (2 to 16 weeks) and days per week (2 to 6)
  - session length
  - experience level and available equipment
  - injuries and other notes

  Claude returns a full program. It includes week-to-week progression, deload weeks and exercises that match your equipment.
- **Live progress while it builds.** The response streams in, so you see "Writing week 3 of 8…" instead of a frozen spinner.
- **Offline template builder.** With no API key, a rule-based builder makes a solid program from the same inputs. It uses the right split for your days per week, an exercise library filtered by equipment, 3-week loading waves and deloads.
- **Today tab.** Shows your program progress ring, the next workout card and this week's schedule.
- **Workout logging.** Log weight and reps for each set, with a check-off button per set. A rest timer starts when you check off a set, and you can add 15 seconds or skip it. You can also add or remove sets. Weights are prefilled from the last time you did the same exercise, which makes progressive overload easy.
- **Programs tab.** Lists every program you've built. You can switch the active program or swipe to delete one.
- **Settings.** Choose lb or kg and pick the Claude model (Opus 5.5 by default, or Sonnet or Haiku for faster, cheaper plans). Your API key is stored in the iOS Keychain.

## Requirements

- macOS with **Xcode 16 or later**
- iOS **17.0 or later**, on a device or the simulator

## Run it

1. Open `Liftwise/Liftwise.xcodeproj` in Xcode.
2. Select the **Liftwise** target. Under **Signing & Capabilities**, choose your Team. You can change the bundle ID from `com.example.liftwise`.
3. Pick an iPhone simulator or your phone and press **Run** (⌘R).
4. In the app, go to **Settings → AI Coach** and paste an Anthropic API key from <https://console.anthropic.com>. You can skip this step and use the offline builder.

> The project uses Xcode 16's folder-synchronized groups, so any Swift file you add under `Liftwise/Liftwise/` is picked up automatically. If you prefer [XcodeGen](https://github.com/yonaskolb/XcodeGen), run `xcodegen` in this folder to regenerate the project from `project.yml`.

## How the AI builder works

- `Services/ClaudeClient.swift` calls the Claude Messages API directly over HTTPS, because there is no official Swift SDK. It streams the response with server-sent events.
- `Services/AIPlanBuilder.swift` holds the coach's system prompt and turns your answers into the request.
- The request uses **structured outputs** (`output_config.format` with a JSON schema from `PlanDTO.jsonSchema`). Claude's reply is therefore always valid JSON that decodes into `PlanDTO`, and is then saved with SwiftData.
- On Opus and Sonnet, the request also opts into server-side refusal fallbacks (`fallbacks: "default"`).

## Project layout

```
Liftwise/
├── Liftwise.xcodeproj
├── project.yml                 # optional XcodeGen spec
└── Liftwise/
    ├── App/LiftwiseApp.swift   # @main, tab bar
    ├── Models/
    │   ├── Models.swift        # SwiftData: Program → Week → Day → Exercise → SetLog
    │   ├── PlanRequest.swift   # builder questionnaire
    │   └── PlanDTO.swift       # JSON plan format + schema + save to SwiftData
    ├── Services/
    │   ├── ClaudeClient.swift
    │   ├── AIPlanBuilder.swift
    │   ├── OfflinePlanBuilder.swift
    │   └── KeychainStore.swift
    ├── Views/
    │   ├── TodayView.swift
    │   ├── ProgramsView.swift
    │   ├── PlanBuilderView.swift
    │   ├── WorkoutSessionView.swift
    │   └── SettingsView.swift
    └── Assets.xcassets
```

## Before shipping to the App Store

- **Don't ship with a user-entered API key as your business model.** Put a small backend (for example a serverless function) between the app and Anthropic. The backend holds your key and enforces per-user limits, and the app calls it instead of `api.anthropic.com`. To switch, change `ClaudeClient.endpoint` and the auth header.
- Add an app icon: drop a 1024×1024 PNG into `Assets.xcassets/AppIcon.appiconset`.
- Consider adding sign-in and iCloud sync (SwiftData supports CloudKit), HealthKit workout export, and subscriptions through StoreKit.
