# Liftwise: AI workout planner & training log for iPhone

Liftwise is a full training app built in SwiftUI. You pick a ready-made program or have the AI coach design one for your goal. Liftwise then runs it for you: it schedules each session, suggests what weight to lift, detects personal records, reminds you to train and builds your next block when you finish.

## Features

### Programs
- **AI program builder.** Pick any goal, then set:
  - focus areas
  - program length (2–16 weeks) and days per week
  - session length, experience level and equipment
  - injuries and other notes

  Claude designs a periodized plan with progressive overload and deload weeks.
- **Program library.** 11 ready-made plans:
  - strength: Starter Strength 3x, Power & Size 5x
  - muscle: Upper/Lower Builder, Push Pull Legs 6x
  - home: Dumbbell Home Builder, Bodyweight Anywhere
  - fat loss: Lean & Conditioned, Kettlebell Shred
  - athletic: Vertical Jump Accelerator, Off-Season Athlete
  - running: 5K Speed Builder

  You can preview each one, change its length, start it in one tap, or have the AI personalize it.
- **Custom programs.** Pick your training days, then fill in the workouts.
- **Workout editor.** Rename a workout, change its day and time, or add, swap, reorder and delete exercises. You can edit sets, reps, intensity, rest and cues. When you swap an exercise, the swap also applies to later weeks. "Copy to all later weeks" repeats a workout through the rest of the program.
- **Adjust with AI.** Describe a change in plain English, such as "I only have dumbbells for 3 weeks" or "my back is sore". Claude rewrites the weeks you haven't started and leaves the ones you have alone.
- **Auto next block.** When a program ends, one tap builds the next block from your new estimated maxes.

### Training
- **Auto-progression.** Liftwise suggests each set's weight from:
  - **Last performance:** if you hit all your reps, it adds weight. If you miss, you repeat the weight. If you miss two sessions in a row, it resets the weight down 10%.
  - **Logged RPE:** if the last session felt easy, the weight goes up; if it felt too hard, the weight comes down.
  - **% of 1RM** prescriptions, using your estimated max.
  - **Deload weeks,** which drop the weight to about 85%.
- **Workout logger.**
  - Weight and reps are prefilled. Each exercise shows what you did last time, and you can add an optional RPE to any set.
  - You can add or remove sets.
  - A session timer runs while you train.
  - The workout notes from your plan are shown, and you can add your own session notes.
- **PR detection.** A banner and haptic tap appear when you beat your best estimated 1RM on a lift.
- **Rest timer.** It starts when you check off a set, and you can add 15 seconds or skip it. It also sends a notification when rest is over, even if the app is in the background.
- **Warm-up ramps and plate math.** Liftwise works out warm-up sets for any working weight and shows the plates to load on each side.
- **Workout summary.** Shows duration, volume, sets, PRs and notes. You can skip a workout or reset it.

### Coach & progress
- **Coach chat.** Ask Claude anything. It sees your program, recent sessions, maxes and body weight, and the conversation is saved.
- **Progress dashboard.**
  - stats: workout count, weekly streak, total volume
  - charts: weekly volume, estimated 1RM trend for each lift
  - your PR list and full workout history
- **Exercise library.** 80+ exercises with form cues, muscles worked, your best set, a chart and your full history for each one.
- **Body weight tracking** with a chart.
- **Tools:** a plate calculator and a 1RM / percentage calculator.

### Automation & data
- **Training-day reminders** at a time you choose. They follow your active program's schedule.
- **Apple Health sync** for workouts and body weight (optional).
- **CSV export** of every logged set.
- **Your API key** is stored in the Keychain, and you can choose Opus, Sonnet or Haiku. Without a key, everything works except the AI features, and the builder falls back to smart templates.

## Run it

1. Open `Liftwise/Liftwise.xcodeproj` in **Xcode 16+**. The app needs iOS 17 or later.
2. Select the **Liftwise** target. Under **Signing & Capabilities**, choose your Team and change the bundle ID from `com.example.liftwise` if needed. The HealthKit capability is already configured in `Liftwise.entitlements`.
3. Run on a simulator or your iPhone (⌘R).
4. Optional: add an Anthropic API key in **Settings → AI Coach** (get one at <https://console.anthropic.com>).

CI: `.github/workflows/ios.yml` compiles the app on a macOS runner on every push that touches `Liftwise/`.

## Architecture

| Area | Files |
|---|---|
| Data (SwiftData) | `Models/Models.swift`: Program → Week → Day → Exercise → SetLog, BodyWeightEntry, CoachMessage |
| Plan format | `Models/PlanDTO.swift`: JSON schema for structured outputs, plus conversion to and from SwiftData |
| Library | `Models/ExerciseCatalog.swift`, `Models/ProgramTemplates.swift` |
| Training engine | `Services/Strength.swift`: e1RM, history index, auto-progression, plates, warm-ups |
| AI | `Services/ClaudeClient.swift` (streaming Messages API), `Services/AIPlanBuilder.swift` (build, adjust, coach context) |
| Offline plans | `Services/OfflinePlanBuilder.swift` |
| System | `Services/SystemServices.swift` (notifications, HealthKit, CSV), `Services/KeychainStore.swift` |
| UI | `Views/`: Today, Programs, Coach, Progress, Settings, workout logger, editors |

## Before the App Store

- Route AI calls through your own backend so you don't ship with user-entered keys. Change `ClaudeClient.endpoint` and the auth header.
- Add an app icon (1024×1024) to `Assets.xcassets/AppIcon.appiconset`.
- Consider sign-in, iCloud sync (SwiftData + CloudKit), StoreKit subscriptions, an Apple Watch companion and Live Activities for the rest timer.
