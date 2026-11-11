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

    func build(_ request: PlanRequest, unit: String, onText: @escaping (String) -> Void) async throws -> PlanDTO {
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
}
