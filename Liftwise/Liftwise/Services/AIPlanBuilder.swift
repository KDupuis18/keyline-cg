import Foundation

/// Builds a multi-week program with Claude using structured outputs.
struct AIPlanBuilder {
    let client: ClaudeClient

    static let systemPrompt = """
    You are an elite strength & conditioning coach who designs evidence-based, periodized training \
    programs. You write programs that a real person can follow in a phone app, one session at a time.

    Program design principles:
    - Build around the athlete's primary goal; every week should clearly move them toward it.
    - Use progressive overload from week to week (load, reps, sets, density or complexity). \
    Make the progression visible in the prescriptions.
    - For programs of 5 weeks or longer, include a deload/recovery week roughly every 4th week, \
    and make the final week a test, peak or consolidation week when it fits the goal.
    - Respect the session length: the exercises, sets and rest must realistically fit inside it \
    including a short warm-up. Set estimated_minutes honestly.
    - Use ONLY exercises that can be done with the athlete's equipment.
    - Respect injuries and limitations: avoid aggravating movements and choose safer alternatives.
    - Match volume and complexity to the athlete's experience level.
    - Keep the same training weekdays every week, spaced to allow recovery.

    Output format rules:
    - day_of_week: 1 = Monday ... 7 = Sunday.
    - reps is a short string: "5", "8-10", "12 each side", "30s", "AMRAP", "20 min", "400m".
    - intensity is a short string: "RPE 7", "70% 1RM", "Zone 2", "Moderate", "Max effort".
    - rest_seconds is an integer (0 for continuous work).
    - Exercise notes: at most one short coaching cue, or an empty string.
    - Day notes: one short sentence (e.g. warm-up guidance or the session's intent).
    - Week focus: 2-5 words (e.g. "Accumulation", "Strength build", "Deload").
    - name: a short, motivating program name (max 4 words).
    - summary: 2-3 sentences explaining the approach and how the weeks progress.
    """

    func userPrompt(for request: PlanRequest, unit: String) -> String {
        var lines: [String] = [
            "Build my training program.",
            "",
            "Primary goal: \(request.goalDescription)",
            "Experience level: \(request.experience.rawValue) (\(request.experience.detail))",
            "Program length: exactly \(request.weeks) weeks, numbered 1 to \(request.weeks)",
            "Training days per week: exactly \(request.daysPerWeek)",
            "Max session length: \(request.sessionMinutes) minutes",
            "Equipment available: \(request.equipment.rawValue)",
            "Preferred weight unit: \(unit)",
        ]
        if !request.focusAreas.isEmpty {
            let areas = FocusArea.allCases.filter { request.focusAreas.contains($0) }.map(\.rawValue)
            lines.append("Areas I want to emphasize: \(areas.joined(separator: ", "))")
        }
        let limits = request.limitations.trimmingCharacters(in: .whitespacesAndNewlines)
        lines.append("Injuries / limitations: \(limits.isEmpty ? "None" : limits)")
        let notes = request.notes.trimmingCharacters(in: .whitespacesAndNewlines)
        if !notes.isEmpty { lines.append("Other notes: \(notes)") }
        return lines.joined(separator: "\n")
    }

    func build(_ request: PlanRequest, unit: String, onText: @escaping @MainActor (String) -> Void) async throws -> PlanDTO {
        let text = try await client.streamStructured(
            system: Self.systemPrompt,
            user: userPrompt(for: request, unit: unit),
            schema: PlanDTO.jsonSchema,
            onText: onText
        )
        let plan = try PlanDTO.decode(from: text)
        guard !plan.weeks.isEmpty else { throw ClaudeClient.ClaudeError.emptyResponse }
        return plan
    }

    // MARK: - Adjusting an existing program

    /// Asks Claude to rewrite the not-yet-started weeks of a program per the athlete's request.
    /// Returns only the replacement weeks (weeks with any finished workout are left untouched).
    @MainActor
    func adjust(program: TrainingProgram, instruction: String, context: String, unit: String,
                onText: @escaping @MainActor (String) -> Void) async throws -> PlanDTO {
        let lockedWeeks = program.sortedWeeks.filter { $0.days.contains(where: \.isDone) }.map(\.number)
        let editable = program.sortedWeeks.map(\.number).filter { !lockedWeeks.contains($0) }
        guard !editable.isEmpty else {
            throw ClaudeClient.ClaudeError.http(status: 400, message: "Every week already has finished workouts, so there's nothing left to adjust.")
        }

        let prompt = """
        Here is my current program as JSON:
        \(PlanDTO(program: program).jsonString())

        Weeks already started (do not change): \(lockedWeeks.isEmpty ? "none" : lockedWeeks.map(String.init).joined(separator: ", "))
        Weeks you may rewrite: \(editable.map(String.init).joined(separator: ", "))

        My recent training:
        \(context)

        Requested change: \(instruction)

        Return the full program JSON. Keep the same name unless the change warrants a new one, update the \
        summary if the approach changed, and include ALL weeks in order. Copy locked weeks exactly. Rewrite \
        the editable weeks to apply my requested change while keeping sensible progression. Use \(unit) for any loads.
        """

        let text = try await client.streamStructured(
            system: Self.systemPrompt, user: prompt, schema: PlanDTO.jsonSchema, onText: onText
        )
        var plan = try PlanDTO.decode(from: text)
        plan.weeks = plan.weeks.filter { editable.contains($0.week) }
        guard !plan.weeks.isEmpty else { throw ClaudeClient.ClaudeError.emptyResponse }
        return plan
    }
}

// MARK: - Coach context

enum CoachContext {
    /// Plain-text snapshot of the athlete's current state for Claude.
    @MainActor
    static func snapshot(programs: [TrainingProgram], history: TrainingHistory,
                         bodyWeights: [BodyWeightEntry], unit: String) -> String {
        var lines: [String] = []
        let today = Date().formatted(date: .complete, time: .omitted)
        lines.append("Today is \(today). Weight unit: \(unit).")

        if let active = programs.first(where: \.isActive) {
            lines.append("Active program: \(active.name): \(active.goal). \(active.doneCount)/\(active.totalCount) workouts done.")
            if let next = active.nextWorkout {
                let exercises = next.sortedExercises.map { "\($0.name) \($0.prescription)" }.joined(separator: "; ")
                lines.append("Next workout: \(next.scheduleLabel) \(next.title): \(exercises)")
            }
        } else {
            lines.append("No active program.")
        }

        let recent = programs.flatMap(\.allDays)
            .filter(\.isCompleted)
            .sorted { ($0.completedAt ?? .distantPast) > ($1.completedAt ?? .distantPast) }
            .prefix(5)
        if !recent.isEmpty {
            lines.append("Recent workouts:")
            for day in recent {
                let date = day.completedAt?.formatted(date: .abbreviated, time: .omitted) ?? ""
                let sets = day.sortedExercises.compactMap { ex -> String? in
                    let done = ex.sortedLogs.filter(\.completed)
                    guard !done.isEmpty else { return nil }
                    let s = done.map { "\(Strength.format($0.weight))x\($0.reps)\($0.rpe > 0 ? "@\(Strength.format($0.rpe))" : "")" }
                    return "\(ex.name) \(s.joined(separator: ", "))"
                }
                let note = day.sessionNotes.isEmpty ? "" : " Notes: \(day.sessionNotes)"
                lines.append("- \(date) \(day.title): \(sets.joined(separator: " | "))\(note)")
            }
        }

        let records = history.records.prefix(8)
        if !records.isEmpty {
            lines.append("Estimated 1RMs: " + records.map { "\($0.name) \(Strength.format(Strength.round($0.e1rm, unit: unit)))" }.joined(separator: ", "))
        }

        let weights = bodyWeights.sorted { $0.date < $1.date }
        if let latest = weights.last {
            var bw = "Body weight: \(Strength.format(latest.weight)) \(unit)"
            if let first = weights.first, weights.count > 1 {
                let change = latest.weight - first.weight
                bw += " (\(change >= 0 ? "+" : "")\(Strength.format(change)) since \(first.date.formatted(date: .abbreviated, time: .omitted)))"
            }
            lines.append(bw)
        }
        return lines.joined(separator: "\n")
    }

    static let coachSystemPrompt = """
    You are the athlete's personal strength & conditioning coach inside the Liftwise workout app. \
    You can see their program, recent sessions, estimated maxes and body weight below. Give specific, \
    practical, encouraging answers grounded in that data: technique cues, exercise substitutions, how to \
    handle missed sessions, fatigue, soreness, nutrition basics, and how to progress. Keep answers short \
    and skimmable for a phone screen (a few sentences or a short list). If they want their program \
    changed, tell them to tap "Adjust with AI" on the program screen and suggest exactly what to type. \
    For pain, injury or medical issues, recommend seeing a qualified professional.
    """
}
