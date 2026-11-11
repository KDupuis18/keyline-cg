import Foundation
import SwiftData

// MARK: - Program

@Model
final class TrainingProgram {
    var id: UUID = UUID()
    var name: String = ""
    var summary: String = ""
    var goal: String = ""
    var createdAt: Date = Date()
    var startDate: Date = Date()
    var isActive: Bool = false
    var generatedByAI: Bool = true

    @Relationship(deleteRule: .cascade, inverse: \ProgramWeek.program)
    var weeks: [ProgramWeek] = []

    init(name: String, summary: String, goal: String, generatedByAI: Bool) {
        self.id = UUID()
        self.name = name
        self.summary = summary
        self.goal = goal
        self.createdAt = Date()
        self.startDate = Date()
        self.isActive = false
        self.generatedByAI = generatedByAI
    }

    var sortedWeeks: [ProgramWeek] { weeks.sorted { $0.number < $1.number } }
    var allDays: [WorkoutDay] { sortedWeeks.flatMap { $0.sortedDays } }
    var completedCount: Int { allDays.filter(\.isCompleted).count }
    var totalCount: Int { allDays.count }

    var progress: Double {
        totalCount == 0 ? 0 : Double(completedCount) / Double(totalCount)
    }

    /// The first workout that hasn't been completed yet.
    var nextWorkout: WorkoutDay? { allDays.first { !$0.isCompleted } }

    var currentWeek: ProgramWeek? { nextWorkout?.week ?? sortedWeeks.last }
}

// MARK: - Week

@Model
final class ProgramWeek {
    var number: Int = 1
    var focus: String = ""
    var program: TrainingProgram?

    @Relationship(deleteRule: .cascade, inverse: \WorkoutDay.week)
    var days: [WorkoutDay] = []

    init(number: Int, focus: String) {
        self.number = number
        self.focus = focus
    }

    var sortedDays: [WorkoutDay] {
        days.sorted { ($0.dayOfWeek, $0.order) < ($1.dayOfWeek, $1.order) }
    }

    var completedCount: Int { days.filter(\.isCompleted).count }
}

// MARK: - Day

@Model
final class WorkoutDay {
    var order: Int = 0
    /// 1 = Monday ... 7 = Sunday
    var dayOfWeek: Int = 1
    var title: String = ""
    var focus: String = ""
    var estimatedMinutes: Int = 45
    var notes: String = ""
    var completedAt: Date?
    var week: ProgramWeek?

    @Relationship(deleteRule: .cascade, inverse: \PlannedExercise.day)
    var exercises: [PlannedExercise] = []

    init(order: Int, dayOfWeek: Int, title: String, focus: String, estimatedMinutes: Int, notes: String) {
        self.order = order
        self.dayOfWeek = dayOfWeek
        self.title = title
        self.focus = focus
        self.estimatedMinutes = estimatedMinutes
        self.notes = notes
    }

    var isCompleted: Bool { completedAt != nil }
    var sortedExercises: [PlannedExercise] { exercises.sorted { $0.order < $1.order } }

    var weekdayName: String {
        let names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        return names[max(0, min(6, dayOfWeek - 1))]
    }

    var scheduleLabel: String {
        "Week \(week?.number ?? 1) · \(weekdayName)"
    }
}

// MARK: - Exercise

@Model
final class PlannedExercise {
    var order: Int = 0
    var name: String = ""
    var sets: Int = 3
    /// Free-form: "8-10", "5", "30s", "AMRAP", "20 min"
    var reps: String = ""
    /// Free-form: "RPE 7", "70% 1RM", "Zone 2"
    var intensity: String = ""
    var restSeconds: Int = 90
    var notes: String = ""
    var day: WorkoutDay?

    @Relationship(deleteRule: .cascade, inverse: \SetLog.exercise)
    var logs: [SetLog] = []

    init(order: Int, name: String, sets: Int, reps: String, intensity: String, restSeconds: Int, notes: String) {
        self.order = order
        self.name = name
        self.sets = sets
        self.reps = reps
        self.intensity = intensity
        self.restSeconds = restSeconds
        self.notes = notes
    }

    var sortedLogs: [SetLog] { logs.sorted { $0.setNumber < $1.setNumber } }

    var prescription: String {
        var parts = ["\(sets) × \(reps)"]
        if !intensity.isEmpty { parts.append(intensity) }
        if restSeconds > 0 { parts.append("rest \(Self.formatRest(restSeconds))") }
        return parts.joined(separator: " · ")
    }

    /// First integer found in the rep prescription, used to prefill logs.
    var targetReps: Int {
        let digits = reps.prefix { !$0.isNumber }.count
        let rest = reps.dropFirst(digits).prefix { $0.isNumber }
        return Int(rest) ?? 0
    }

    static func formatRest(_ seconds: Int) -> String {
        if seconds >= 60 {
            let m = seconds / 60, s = seconds % 60
            return s == 0 ? "\(m)m" : "\(m)m \(s)s"
        }
        return "\(seconds)s"
    }
}

// MARK: - Set log

@Model
final class SetLog {
    var setNumber: Int = 1
    var weight: Double = 0
    var reps: Int = 0
    var completed: Bool = false
    var loggedAt: Date?
    var exercise: PlannedExercise?

    init(setNumber: Int, weight: Double, reps: Int) {
        self.setNumber = setNumber
        self.weight = weight
        self.reps = reps
    }
}
