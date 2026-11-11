import Foundation
import SwiftData

// MARK: - Formulas & plate math

enum Strength {
    /// Epley estimate; returns the weight itself for singles and 0 for empty sets.
    static func estimatedOneRepMax(weight: Double, reps: Int) -> Double {
        guard weight > 0, reps > 0 else { return 0 }
        if reps == 1 { return weight }
        let capped = min(reps, 15)
        return weight * (1 + Double(capped) / 30)
    }

    static func increment(for name: String, unit: String) -> Double {
        let lower = ExerciseCatalog.isLowerBody(name)
        let compound = ExerciseCatalog.isCompound(name)
        if unit == "kg" { return lower && compound ? 5 : 2.5 }
        return lower && compound ? 10 : 5
    }

    static func round(_ weight: Double, unit: String) -> Double {
        let step = unit == "kg" ? 2.5 : 5
        return (weight / step).rounded() * step
    }

    static func defaultBar(unit: String) -> Double { unit == "kg" ? 20 : 45 }

    static func plates(unit: String) -> [Double] {
        unit == "kg" ? [25, 20, 15, 10, 5, 2.5, 1.25] : [45, 35, 25, 10, 5, 2.5]
    }

    /// Plates needed on EACH side of the bar, largest first.
    static func plateBreakdown(target: Double, bar: Double, unit: String) -> (plates: [Double], remainder: Double) {
        var perSide = max(0, (target - bar) / 2)
        var result: [Double] = []
        for plate in plates(unit: unit) {
            while perSide + 0.0001 >= plate {
                result.append(plate)
                perSide -= plate
            }
        }
        return (result, perSide * 2)
    }

    struct WarmupSet: Identifiable {
        let id = UUID()
        let weight: Double
        let reps: Int
        let label: String
    }

    static func warmups(for working: Double, unit: String, bar: Double) -> [WarmupSet] {
        guard working > bar else { return [] }
        var sets = [WarmupSet(weight: bar, reps: 10, label: "Empty bar")]
        for (pct, reps) in [(0.4, 5), (0.6, 3), (0.8, 2), (0.9, 1)] {
            let w = round(working * pct, unit: unit)
            if w > (sets.last?.weight ?? 0) && w < working {
                sets.append(WarmupSet(weight: w, reps: reps, label: "\(Int(pct * 100))%"))
            }
        }
        return sets
    }

    static func format(_ weight: Double) -> String {
        weight.truncatingRemainder(dividingBy: 1) == 0 ? String(Int(weight)) : String(format: "%.1f", weight)
    }

    static func percentOfMax(in intensity: String) -> Double? {
        guard let pctRange = intensity.range(of: "%") else { return nil }
        let before = intensity[..<pctRange.lowerBound]
        let digits = before.reversed().prefix { $0.isNumber || $0 == "." }
        return Double(String(digits.reversed()))
    }

    static func targetRPE(in intensity: String) -> Double? {
        guard let r = intensity.range(of: "RPE", options: .caseInsensitive) else { return nil }
        let after = intensity[r.upperBound...].drop { $0 == " " }
        return Double(String(after.prefix { $0.isNumber || $0 == "." }))
    }
}

// MARK: - Training history

/// One past performance of an exercise.
struct ExerciseSession {
    let date: Date
    let sets: [SetLog]
    let targetReps: Int
    let targetRPE: Double?

    var topSet: SetLog? { sets.max { $0.estimatedOneRepMax < $1.estimatedOneRepMax } }
    var bestE1RM: Double { topSet?.estimatedOneRepMax ?? 0 }
    var workingWeight: Double { sets.map(\.weight).max() ?? 0 }
    var volume: Double { sets.reduce(0) { $0 + $1.weight * Double($1.reps) } }

    var hitAllReps: Bool {
        targetReps > 0 && !sets.isEmpty && sets.allSatisfy { $0.reps >= targetReps }
    }

    var badlyMissed: Bool {
        guard targetReps > 0 else { return false }
        let total = sets.reduce(0) { $0 + $1.reps }
        return Double(total) < Double(targetReps * sets.count) * 0.8
    }

    var averageRPE: Double? {
        let logged = sets.map(\.rpe).filter { $0 > 0 }
        return logged.isEmpty ? nil : logged.reduce(0, +) / Double(logged.count)
    }
}

/// Index of every completed set, grouped by exercise name (case-insensitive).
struct TrainingHistory {
    private(set) var sessions: [String: [ExerciseSession]] = [:]

    init(logs: [SetLog], excluding excludedDay: WorkoutDay? = nil) {
        var grouped: [String: [PersistentIdentifier: (Date, PlannedExercise, [SetLog])]] = [:]
        for log in logs where log.completed && log.weight > 0 {
            guard let exercise = log.exercise, let day = exercise.day else { continue }
            if let excludedDay, day === excludedDay { continue }
            let key = exercise.name.lowercased()
            let date = day.completedAt ?? log.loggedAt ?? .distantPast
            var entry = grouped[key, default: [:]][exercise.persistentModelID] ?? (date, exercise, [])
            entry.2.append(log)
            grouped[key, default: [:]][exercise.persistentModelID] = entry
        }
        for (key, byExercise) in grouped {
            sessions[key] = byExercise.values
                .map { ExerciseSession(date: $0.0, sets: $0.2.sorted { $0.setNumber < $1.setNumber },
                                       targetReps: $0.1.targetReps, targetRPE: Strength.targetRPE(in: $0.1.intensity)) }
                .sorted { $0.date < $1.date }
        }
    }

    static func load(from context: ModelContext, excluding day: WorkoutDay? = nil) -> TrainingHistory {
        let descriptor = FetchDescriptor<SetLog>(predicate: #Predicate { $0.completed == true })
        let logs = (try? context.fetch(descriptor)) ?? []
        return TrainingHistory(logs: logs, excluding: day)
    }

    func sessions(for name: String) -> [ExerciseSession] { sessions[name.lowercased()] ?? [] }
    func last(for name: String) -> ExerciseSession? { sessions(for: name).last }
    func bestE1RM(for name: String) -> Double { sessions(for: name).map(\.bestE1RM).max() ?? 0 }

    struct Record: Identifiable {
        let name: String
        let e1rm: Double
        let weight: Double
        let reps: Int
        let date: Date
        var id: String { name }
    }

    /// Best estimated 1RM per exercise, highest first.
    var records: [Record] {
        let all: [Record] = sessions.values.compactMap { list -> Record? in
            guard let best = list.max(by: { $0.bestE1RM < $1.bestE1RM }), let top = best.topSet,
                  let name = top.exercise?.name else { return nil }
            return Record(name: name, e1rm: best.bestE1RM, weight: top.weight, reps: top.reps, date: best.date)
        }
        return all.sorted { $0.e1rm > $1.e1rm }
    }
}

// MARK: - Auto-progression

struct WeightSuggestion {
    enum Direction { case up, same, down, fromMax }
    let weight: Double
    let direction: Direction
    let reason: String
}

enum ProgressionEngine {
    /// Recommends today's working weight for an exercise based on history and the prescription.
    static func suggest(for exercise: PlannedExercise, history: TrainingHistory, unit: String) -> WeightSuggestion? {
        let name = exercise.name
        let isDeload = exercise.day?.week?.isDeload ?? false

        // 1. Percentage-based prescriptions use the estimated max.
        if let pct = Strength.percentOfMax(in: exercise.intensity) {
            let max = history.bestE1RM(for: name)
            if max > 0 {
                return WeightSuggestion(
                    weight: Strength.round(max * pct / 100, unit: unit), direction: .fromMax,
                    reason: "\(Int(pct))% of your estimated max (\(Strength.format(Strength.round(max, unit: unit))) \(unit))"
                )
            }
        }

        guard let last = history.last(for: name), last.workingWeight > 0 else { return nil }
        let step = Strength.increment(for: name, unit: unit)
        let previous = last.workingWeight

        if isDeload {
            return WeightSuggestion(weight: Strength.round(previous * 0.85, unit: unit), direction: .down,
                                    reason: "Deload week: ~85% of last time")
        }

        // 2. RPE-based prescriptions auto-regulate off the RPE you logged.
        if let target = Strength.targetRPE(in: exercise.intensity), let logged = last.averageRPE {
            if logged <= target - 1 {
                return WeightSuggestion(weight: previous + step, direction: .up,
                                        reason: "Last time felt easy (RPE \(Strength.format(logged)))")
            }
            if logged >= target + 1.5 {
                return WeightSuggestion(weight: Strength.round(previous * 0.95, unit: unit), direction: .down,
                                        reason: "Last time was too hard (RPE \(Strength.format(logged)))")
            }
        }

        // 3. Rep-based double progression.
        let all = history.sessions(for: name)
        if last.badlyMissed {
            let missedTwice = all.count >= 2 && all[all.count - 2].badlyMissed
            if missedTwice {
                return WeightSuggestion(weight: Strength.round(previous * 0.9, unit: unit), direction: .down,
                                        reason: "Missed reps two sessions in a row: reset 10%")
            }
            return WeightSuggestion(weight: previous, direction: .same, reason: "Missed reps last time: repeat the weight")
        }
        if last.hitAllReps {
            return WeightSuggestion(weight: previous + step, direction: .up,
                                    reason: "Hit every rep last time: +\(Strength.format(step)) \(unit)")
        }
        return WeightSuggestion(weight: previous, direction: .same, reason: "Match last time and beat your reps")
    }
}
