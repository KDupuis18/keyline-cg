import Foundation
import SwiftData

/// Wire format for a generated plan. Both the AI builder and the offline
/// builder produce this, and it is converted into SwiftData models on save.
/// JSON keys are snake_case (decode with `.convertFromSnakeCase`).
struct PlanDTO: Codable {
    var name: String
    var summary: String
    var weeks: [WeekDTO]
}

struct WeekDTO: Codable {
    var week: Int
    var focus: String
    var days: [DayDTO]
}

struct DayDTO: Codable {
    var dayOfWeek: Int
    var title: String
    var focus: String
    var estimatedMinutes: Int
    var notes: String
    var exercises: [ExerciseDTO]
}

struct ExerciseDTO: Codable {
    var name: String
    var sets: Int
    var reps: String
    var intensity: String
    var restSeconds: Int
    var notes: String
}

extension PlanDTO {
    /// JSON Schema used with Claude structured outputs so the response is
    /// guaranteed to decode into `PlanDTO`.
    static let jsonSchema: [String: Any] = {
        func object(_ properties: [String: Any]) -> [String: Any] {
            [
                "type": "object",
                "additionalProperties": false,
                "required": Array(properties.keys).sorted(),
                "properties": properties,
            ]
        }
        func array(of items: [String: Any]) -> [String: Any] {
            ["type": "array", "items": items]
        }
        let string: [String: Any] = ["type": "string"]
        let integer: [String: Any] = ["type": "integer"]

        let exercise = object([
            "name": string,
            "sets": integer,
            "reps": string,
            "intensity": string,
            "rest_seconds": integer,
            "notes": string,
        ])
        let day = object([
            "day_of_week": integer,
            "title": string,
            "focus": string,
            "estimated_minutes": integer,
            "notes": string,
            "exercises": array(of: exercise),
        ])
        let week = object([
            "week": integer,
            "focus": string,
            "days": array(of: day),
        ])
        return object([
            "name": string,
            "summary": string,
            "weeks": array(of: week),
        ])
    }()

    static func decode(from text: String) throws -> PlanDTO {
        var cleaned = text.trimmingCharacters(in: .whitespacesAndNewlines)
        // Defensive: strip markdown fences if any slipped through.
        if cleaned.hasPrefix("```") {
            cleaned = cleaned
                .replacingOccurrences(of: "```json", with: "")
                .replacingOccurrences(of: "```", with: "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
        }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(PlanDTO.self, from: Data(cleaned.utf8))
    }

    /// Inserts the plan into SwiftData and returns the new program.
    @MainActor
    func makeProgram(goal: String, generatedByAI: Bool, in context: ModelContext) -> TrainingProgram {
        let program = TrainingProgram(name: name, summary: summary, goal: goal, generatedByAI: generatedByAI)
        context.insert(program)

        for (weekIndex, w) in weeks.enumerated() {
            let week = ProgramWeek(number: w.week > 0 ? w.week : weekIndex + 1, focus: w.focus)
            program.weeks.append(week)

            for (dayIndex, d) in w.days.enumerated() {
                let day = WorkoutDay(
                    order: dayIndex,
                    dayOfWeek: min(max(d.dayOfWeek, 1), 7),
                    title: d.title,
                    focus: d.focus,
                    estimatedMinutes: max(d.estimatedMinutes, 0),
                    notes: d.notes
                )
                week.days.append(day)

                for (exIndex, e) in d.exercises.enumerated() {
                    day.exercises.append(PlannedExercise(
                        order: exIndex,
                        name: e.name,
                        sets: max(e.sets, 1),
                        reps: e.reps,
                        intensity: e.intensity,
                        restSeconds: max(e.restSeconds, 0),
                        notes: e.notes
                    ))
                }
            }
        }
        return program
    }
}
