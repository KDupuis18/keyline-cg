import Foundation

/// Rule-based program generator used when no API key is configured (or offline).
/// Produces the same `PlanDTO` shape as the AI builder.
enum OfflinePlanBuilder {

    // MARK: Movement patterns & exercise library

    enum Pattern {
        case squat, hinge, hPush, hPull, vPush, vPull, lunge, core, biceps, triceps, calves, plyo, conditioning
    }

    static func library(_ pattern: Pattern, _ equipment: Equipment) -> [String] {
        switch (pattern, equipment) {
        case (.squat, .fullGym): ["Back Squat", "Front Squat", "Hack Squat", "Leg Press"]
        case (.squat, .dumbbells): ["Goblet Squat", "DB Front Squat", "Heels-Elevated Goblet Squat"]
        case (.squat, .kettlebells): ["KB Goblet Squat", "Double KB Front Squat", "Banded Squat"]
        case (.squat, .bodyweight): ["Bodyweight Squat", "Tempo Squat (3s down)", "Pistol Squat to Box"]

        case (.hinge, .fullGym): ["Romanian Deadlift", "Conventional Deadlift", "Trap Bar Deadlift", "Hip Thrust"]
        case (.hinge, .dumbbells): ["DB Romanian Deadlift", "DB Hip Thrust", "Single-Leg DB RDL"]
        case (.hinge, .kettlebells): ["KB Swing", "KB Romanian Deadlift", "Banded Good Morning"]
        case (.hinge, .bodyweight): ["Glute Bridge", "Single-Leg Hip Thrust", "Nordic Curl Negative"]

        case (.hPush, .fullGym): ["Barbell Bench Press", "Incline DB Press", "Machine Chest Press", "Weighted Dip"]
        case (.hPush, .dumbbells): ["DB Bench Press", "Incline DB Press", "DB Floor Press"]
        case (.hPush, .kettlebells): ["KB Floor Press", "Banded Push-Up", "Deficit Push-Up"]
        case (.hPush, .bodyweight): ["Push-Up", "Decline Push-Up", "Archer Push-Up"]

        case (.hPull, .fullGym): ["Barbell Row", "Chest-Supported Row", "Seated Cable Row"]
        case (.hPull, .dumbbells): ["One-Arm DB Row", "Chest-Supported DB Row", "DB Seal Row"]
        case (.hPull, .kettlebells): ["KB Bent-Over Row", "Banded Row", "KB Gorilla Row"]
        case (.hPull, .bodyweight): ["Inverted Row", "Towel Door Row", "Prone Y-T-W"]

        case (.vPush, .fullGym): ["Overhead Press", "Seated DB Shoulder Press", "Landmine Press"]
        case (.vPush, .dumbbells): ["Seated DB Shoulder Press", "Arnold Press", "DB Lateral Raise"]
        case (.vPush, .kettlebells): ["KB Overhead Press", "Bottoms-Up KB Press", "Banded Lateral Raise"]
        case (.vPush, .bodyweight): ["Pike Push-Up", "Elevated Pike Push-Up", "Wall Handstand Hold"]

        case (.vPull, .fullGym): ["Pull-Up", "Lat Pulldown", "Neutral-Grip Pulldown"]
        case (.vPull, .dumbbells): ["DB Pullover", "Pull-Up", "DB Rear Delt Fly"]
        case (.vPull, .kettlebells): ["Banded Lat Pulldown", "Pull-Up", "KB Pullover"]
        case (.vPull, .bodyweight): ["Pull-Up", "Chin-Up", "Negative Pull-Up"]

        case (.lunge, .fullGym), (.lunge, .dumbbells): ["DB Walking Lunge", "Bulgarian Split Squat", "DB Step-Up", "Reverse Lunge"]
        case (.lunge, .kettlebells): ["KB Reverse Lunge", "KB Bulgarian Split Squat", "KB Step-Up"]
        case (.lunge, .bodyweight): ["Reverse Lunge", "Bulgarian Split Squat", "Lateral Lunge"]

        case (.core, _): ["Plank", "Dead Bug", "Hanging Knee Raise", "Pallof Press", "Side Plank"]
        case (.biceps, .fullGym): ["EZ-Bar Curl", "Incline DB Curl", "Cable Curl"]
        case (.biceps, .bodyweight): ["Chin-Up Hold", "Towel Curl"]
        case (.biceps, _): ["DB Hammer Curl", "DB Curl", "Banded Curl"]
        case (.triceps, .fullGym): ["Cable Pushdown", "Skull Crusher", "Close-Grip Bench"]
        case (.triceps, .bodyweight): ["Bench Dip", "Diamond Push-Up"]
        case (.triceps, _): ["DB Overhead Extension", "Banded Pushdown", "Diamond Push-Up"]
        case (.calves, .bodyweight): ["Single-Leg Calf Raise", "Pogo Hops"]
        case (.calves, _): ["Standing Calf Raise", "Seated Calf Raise"]

        case (.plyo, _): ["Box Jump", "Broad Jump", "Depth Jump", "Single-Leg Bound", "Med Ball Slam"]
        case (.conditioning, .fullGym): ["Bike Intervals", "Rower Intervals", "Sled Push"]
        case (.conditioning, .kettlebells): ["KB Swing Intervals", "KB Complex", "Burpee Intervals"]
        case (.conditioning, _): ["Burpee Intervals", "Mountain Climbers", "Jump Rope Intervals"]
        }
    }

    // MARK: Splits

    struct DayTemplate {
        let title: String
        let focus: String
        let patterns: [Pattern]
    }

    static let fullA = DayTemplate(title: "Full Body A", focus: "Squat, push, pull", patterns: [.squat, .hPush, .vPull, .lunge, .core, .biceps])
    static let fullB = DayTemplate(title: "Full Body B", focus: "Hinge, press, row", patterns: [.hinge, .vPush, .hPull, .lunge, .core, .triceps])
    static let fullC = DayTemplate(title: "Full Body C", focus: "Strength & balance", patterns: [.squat, .hPush, .hPull, .hinge, .core, .calves])
    static let upper = DayTemplate(title: "Upper Body", focus: "Chest, back, shoulders", patterns: [.hPush, .hPull, .vPush, .vPull, .biceps, .triceps])
    static let lower = DayTemplate(title: "Lower Body", focus: "Quads, hamstrings, glutes", patterns: [.squat, .hinge, .lunge, .calves, .core])
    static let push = DayTemplate(title: "Push", focus: "Chest, shoulders, triceps", patterns: [.hPush, .vPush, .hPush, .triceps, .core])
    static let pull = DayTemplate(title: "Pull", focus: "Back & biceps", patterns: [.vPull, .hPull, .hinge, .biceps, .core])
    static let legs = DayTemplate(title: "Legs", focus: "Lower body strength", patterns: [.squat, .lunge, .hinge, .calves, .core])

    static func split(daysPerWeek: Int) -> [DayTemplate] {
        switch daysPerWeek {
        case ...2: [fullA, fullB]
        case 3: [fullA, fullB, fullC]
        case 4: [upper, lower, upper, lower]
        case 5: [upper, lower, push, pull, legs]
        default: [push, pull, legs, push, pull, legs]
        }
    }

    static func weekdays(for daysPerWeek: Int) -> [Int] {
        switch daysPerWeek {
        case ...2: [1, 4]
        case 3: [1, 3, 5]
        case 4: [1, 2, 4, 5]
        case 5: [1, 2, 3, 5, 6]
        default: [1, 2, 3, 4, 5, 6]
        }
    }

    // MARK: Build

    static func build(_ request: PlanRequest) -> PlanDTO {
        let style = request.style
        let days = min(max(request.daysPerWeek, 2), 6)
        let templates = Self.split(daysPerWeek: days)
        let trainingDays = Self.weekdays(for: days)
        let maxExercises = min(max(request.sessionMinutes / 10, 3), 8)

        var weeks: [WeekDTO] = []
        for weekNumber in 1...max(request.weeks, 1) {
            let isDeload = request.weeks >= 5 && weekNumber % 4 == 0
            let blockWeek = (weekNumber - 1) % 4 // 0,1,2 = build, 3 = deload
            let focus = isDeload ? "Deload & recover" : ["Foundation", "Build", "Overload"][min(blockWeek, 2)]

            var dayDTOs: [DayDTO] = []
            for (index, template) in templates.enumerated() {
                // Endurance goals alternate run sessions with strength days.
                if style == .endurance && index % 2 == 0 {
                    dayDTOs.append(runDay(weekNumber: weekNumber, slot: index / 2, deload: isDeload, weekday: trainingDays[index], minutes: request.sessionMinutes))
                    continue
                }

                var patterns = template.patterns
                if style == .athletic { patterns.insert(.plyo, at: 0) }
                if style == .fatLoss || request.focusAreas.contains(.conditioning) { patterns.append(.conditioning) }
                if request.focusAreas.contains(.core) && !patterns.contains(.core) { patterns.append(.core) }
                if request.focusAreas.contains(.arms) { patterns.append(contentsOf: [.biceps, .triceps]) }
                if request.focusAreas.contains(.glutes) && !patterns.contains(.hinge) { patterns.append(.hinge) }
                patterns = Array(patterns.prefix(maxExercises))

                var used: [Pattern: Int] = [:]
                var exercises: [ExerciseDTO] = []
                for (slot, pattern) in patterns.enumerated() {
                    let options = library(pattern, request.equipment)
                    let variant = (used[pattern, default: 0] + index) % options.count
                    used[pattern, default: 0] += 1
                    let isMain = slot < (style == .athletic ? 2 : 1) || (slot == 1 && style == .strength)
                    exercises.append(prescribe(
                        name: options[variant], pattern: pattern, style: style, isMain: isMain,
                        blockWeek: blockWeek, deload: isDeload, experience: request.experience
                    ))
                }

                dayDTOs.append(DayDTO(
                    dayOfWeek: trainingDays[index],
                    title: template.title,
                    focus: template.focus,
                    estimatedMinutes: min(request.sessionMinutes, 10 + exercises.count * 8),
                    notes: isDeload ? "Keep it light: leave 3-4 reps in the tank on every set." : "Warm up 5-8 minutes, then ramp up to your first working set.",
                    exercises: exercises
                ))
            }
            weeks.append(WeekDTO(week: weekNumber, focus: focus, days: dayDTOs))
        }

        return PlanDTO(
            name: programName(style: style, weeks: request.weeks),
            summary: "A \(request.weeks)-week \(days)-day plan for \(request.goalDescription.lowercased()). Weeks build in 3-week waves of rising intensity" + (request.weeks >= 5 ? ", with a lighter deload every 4th week." : "."),
            weeks: weeks
        )
    }

    static func programName(style: TrainingStyle, weeks: Int) -> String {
        switch style {
        case .strength: "\(weeks)-Week Strength Base"
        case .hypertrophy: "\(weeks)-Week Muscle Builder"
        case .fatLoss: "\(weeks)-Week Lean Out"
        case .athletic: "\(weeks)-Week Athlete Power"
        case .endurance: "\(weeks)-Week Run Stronger"
        case .general: "\(weeks)-Week Fit Foundation"
        }
    }

    static func prescribe(name: String, pattern: Pattern, style: TrainingStyle, isMain: Bool,
                          blockWeek: Int, deload: Bool, experience: Experience) -> ExerciseDTO {
        let rpe = deload ? 6 : min(7 + blockWeek, experience == .beginner ? 8 : 9)

        if pattern == .conditioning {
            let rounds = deload ? 4 : 6 + blockWeek * 2
            return ExerciseDTO(name: name, sets: rounds, reps: "30s on / 30s off", intensity: deload ? "Moderate" : "Hard", restSeconds: 0, notes: "Finish strong; keep form crisp.")
        }
        if pattern == .plyo {
            return ExerciseDTO(name: name, sets: deload ? 2 : 4, reps: "3-5", intensity: "Max intent", restSeconds: 90, notes: "Full recovery between sets; quality over quantity.")
        }
        if pattern == .core {
            let reps = name.contains("Plank") ? "\(30 + blockWeek * 10)s" : "\(10 + blockWeek * 2)"
            return ExerciseDTO(name: name, sets: 3, reps: reps, intensity: "Controlled", restSeconds: 45, notes: "")
        }

        var sets: Int
        var reps: String
        let rest: Int
        switch (style, isMain) {
        case (.strength, true):
            sets = 4 + (blockWeek == 2 ? 1 : 0); reps = ["5", "4", "3"][min(blockWeek, 2)]; rest = 180
        case (.strength, false):
            sets = 3; reps = "6-8"; rest = 120
        case (.hypertrophy, true):
            sets = 4; reps = ["8-10", "6-8", "6-8"][min(blockWeek, 2)]; rest = 120
        case (.hypertrophy, false):
            sets = 3 + (blockWeek == 2 ? 1 : 0); reps = "10-12"; rest = 75
        case (.athletic, true):
            sets = 4; reps = ["5", "4", "3"][min(blockWeek, 2)]; rest = 150
        case (.athletic, false):
            sets = 3; reps = "8"; rest = 90
        case (.fatLoss, _):
            sets = 3; reps = isMain ? "10" : "12-15"; rest = isMain ? 60 : 45
        case (.endurance, _), (.general, _):
            sets = 3; reps = isMain ? "8-10" : "10-12"; rest = isMain ? 90 : 60
        }
        if experience == .beginner { sets = max(2, sets - 1) }
        if experience == .advanced && !deload && !isMain { sets += 1 }
        if deload { sets = max(2, sets - 1) }
        if pattern == .lunge && !reps.contains("each") { reps += " each side" }

        return ExerciseDTO(
            name: name, sets: sets, reps: reps, intensity: "RPE \(rpe)", restSeconds: rest,
            notes: isMain && !deload ? "Add a little weight if last week's sets felt easy." : ""
        )
    }

    static func runDay(weekNumber: Int, slot: Int, deload: Bool, weekday: Int, minutes: Int) -> DayDTO {
        let base = max(20, min(minutes - 10, 60))
        let run: ExerciseDTO
        switch slot % 3 {
        case 0:
            run = ExerciseDTO(name: "Easy Run", sets: 1, reps: "\(deload ? base - 10 : base + weekNumber * 2) min", intensity: "Zone 2", restSeconds: 0, notes: "Conversational pace.")
        case 1:
            run = ExerciseDTO(name: "Interval Run", sets: deload ? 4 : 5 + weekNumber / 2, reps: "400m", intensity: "5K pace or faster", restSeconds: 90, notes: "Walk or jog the recovery.")
        default:
            run = ExerciseDTO(name: "Tempo Run", sets: 1, reps: "\(deload ? 12 : 15 + weekNumber) min", intensity: "Comfortably hard", restSeconds: 0, notes: "Warm up 10 minutes easy first.")
        }
        return DayDTO(
            dayOfWeek: weekday, title: run.name, focus: "Running", estimatedMinutes: minutes,
            notes: "Finish with 5 minutes of easy walking and mobility.",
            exercises: [run, ExerciseDTO(name: "Hip & Calf Mobility", sets: 1, reps: "5 min", intensity: "Easy", restSeconds: 0, notes: "")]
        )
    }
}
