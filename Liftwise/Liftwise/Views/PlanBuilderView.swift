import SwiftUI
import SwiftData

@MainActor
final class PlanGenerationModel: ObservableObject {
    enum Phase: Equatable {
        case idle
        case generating
        case failed(String)
    }

    @Published var phase: Phase = .idle
    @Published var weeksWritten = 0
    @Published var charactersReceived = 0

    private var tail = ""
    private var task: Task<Void, Never>?

    func generate(request: PlanRequest, useAI: Bool, unit: String, model: String,
                  context: ModelContext, onDone: @escaping (TrainingProgram) -> Void) {
        task?.cancel()
        phase = .generating
        weeksWritten = 0
        charactersReceived = 0
        tail = ""

        task = Task {
            do {
                let plan: PlanDTO
                if useAI {
                    let builder = AIPlanBuilder(client: ClaudeClient(apiKey: KeychainStore.loadAPIKey(), model: model))
                    plan = try await builder.build(request, unit: unit) { [weak self] chunk in
                        self?.consume(chunk)
                    }
                } else {
                    plan = OfflinePlanBuilder.build(request)
                }
                try Task.checkCancellation()

                let program = plan.makeProgram(goal: request.goalDescription, generatedByAI: useAI,
                                               source: useAI ? "ai" : "template", in: context)
                // Make the new program the active one.
                let all = (try? context.fetch(FetchDescriptor<TrainingProgram>())) ?? []
                for p in all { p.isActive = (p.id == program.id) }
                try? context.save()

                phase = .idle
                onDone(program)
            } catch is CancellationError {
                phase = .idle
            } catch let urlError as URLError where urlError.code == .cancelled {
                phase = .idle
            } catch is DecodingError {
                phase = .failed("Claude's response couldn't be read as a program. Please try again.")
            } catch {
                phase = .failed(error.localizedDescription)
            }
        }
    }

    func cancel() {
        task?.cancel()
        phase = .idle
    }

    /// Counts `"week":` keys as they stream in to show progress without
    /// re-scanning the whole response on every chunk.
    private func consume(_ chunk: String) {
        charactersReceived += chunk.count
        let window = tail + chunk
        let marker = "\"week\":"
        var count = 0
        var searchRange = window.startIndex..<window.endIndex
        while let r = window.range(of: marker, range: searchRange) {
            // Only count matches that end inside the new chunk to avoid double counting.
            if window.distance(from: window.startIndex, to: r.upperBound) > tail.count { count += 1 }
            searchRange = r.upperBound..<window.endIndex
        }
        weeksWritten += count
        tail = String(window.suffix(marker.count))
    }
}

struct PlanBuilderView: View {
    var onFinished: (TrainingProgram) -> Void

    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @AppStorage("weightUnit") private var weightUnit = "lb"
    @AppStorage("claudeModel") private var claudeModel = ClaudeModelOption.defaultModel

    @State private var request: PlanRequest
    @State private var hasAPIKey = KeychainStore.hasAPIKey
    @StateObject private var generation = PlanGenerationModel()

    init(prefill: PlanRequest? = nil, onFinished: @escaping (TrainingProgram) -> Void) {
        self.onFinished = onFinished
        _request = State(initialValue: prefill ?? PlanRequest())
    }

    private let columns = [GridItem(.adaptive(minimum: 150), spacing: 10)]

    var body: some View {
        NavigationStack {
            Form {
                goalSection
                focusSection
                scheduleSection
                profileSection
                detailsSection
                generateSection
            }
            .navigationTitle("AI Plan Builder")
            .onAppear { hasAPIKey = KeychainStore.hasAPIKey }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") {
                        generation.cancel()
                        dismiss()
                    }
                }
            }
            .interactiveDismissDisabled(generation.phase == .generating)
            .overlay {
                if generation.phase == .generating {
                    GeneratingOverlay(
                        totalWeeks: request.weeks,
                        weeksWritten: generation.weeksWritten,
                        characters: generation.charactersReceived,
                        onCancel: generation.cancel
                    )
                }
            }
        }
    }

    // MARK: Sections

    private var goalSection: some View {
        Section {
            LazyVGrid(columns: columns, spacing: 10) {
                ForEach(GoalPreset.allCases) { preset in
                    let selected = request.preset == preset
                    Button {
                        request.preset = selected ? nil : preset
                    } label: {
                        Label(preset.rawValue, systemImage: preset.icon)
                            .font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .padding(.horizontal, 6)
                            .background(selected ? Color.accentColor : Color(.tertiarySystemFill),
                                        in: RoundedRectangle(cornerRadius: 12))
                            .foregroundStyle(selected ? Color.white : Color.primary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 4)

            TextField("Describe your goal (e.g. dunk a basketball, first pull-up, hike Kilimanjaro)",
                      text: $request.customGoal, axis: .vertical)
                .lineLimit(2...4)
        } header: {
            Text("What do you want to work on?")
        }
    }

    private var focusSection: some View {
        Section("Emphasize (optional)") {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 100), spacing: 8)], spacing: 8) {
                ForEach(FocusArea.allCases) { area in
                    let on = request.focusAreas.contains(area)
                    Button {
                        if on { request.focusAreas.remove(area) } else { request.focusAreas.insert(area) }
                    } label: {
                        Text(area.rawValue)
                            .font(.footnote.weight(.medium))
                            .frame(maxWidth: .infinity, minHeight: 34)
                            .background(on ? Color.accentColor.opacity(0.18) : Color(.tertiarySystemFill),
                                        in: Capsule())
                            .overlay(Capsule().stroke(on ? Color.accentColor : .clear, lineWidth: 1.5))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 4)
        }
    }

    private var scheduleSection: some View {
        Section("Schedule") {
            Stepper(value: $request.weeks, in: 2...16) {
                LabeledContent("Program length", value: "\(request.weeks) weeks")
            }
            Stepper(value: $request.daysPerWeek, in: 2...6) {
                LabeledContent("Days per week", value: "\(request.daysPerWeek)")
            }
            Stepper(value: $request.sessionMinutes, in: 20...120, step: 5) {
                LabeledContent("Session length", value: "\(request.sessionMinutes) min")
            }
        }
    }

    private var profileSection: some View {
        Section("You") {
            Picker("Experience", selection: $request.experience) {
                ForEach(Experience.allCases) { Text($0.rawValue).tag($0) }
            }
            Picker("Equipment", selection: $request.equipment) {
                ForEach(Equipment.allCases) { Text($0.rawValue).tag($0) }
            }
        }
    }

    private var detailsSection: some View {
        Section {
            TextField("Injuries or limitations (e.g. sore left knee)", text: $request.limitations, axis: .vertical)
                .lineLimit(1...3)
            TextField("Anything else? (sport, favorite lifts, current maxes…)", text: $request.notes, axis: .vertical)
                .lineLimit(1...4)
        } header: {
            Text("Details")
        } footer: {
            Text("The more you tell the coach, the more personalized your plan.")
        }
    }

    private var generateSection: some View {
        Section {
            if case .failed(let message) = generation.phase {
                Label(message, systemImage: "exclamationmark.triangle.fill")
                    .foregroundStyle(.red)
                    .font(.footnote)
            }

            Button {
                build(useAI: hasAPIKey)
            } label: {
                Label(hasAPIKey ? "Build My Program with AI" : "Build My Program",
                      systemImage: "sparkles")
                    .font(.headline)
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.borderedProminent)
            .listRowInsets(EdgeInsets())
            .disabled(generation.phase == .generating)

            if hasAPIKey {
                Button("Use the offline template builder instead") { build(useAI: false) }
                    .font(.footnote)
                    .frame(maxWidth: .infinity)
            }
        } footer: {
            Text(hasAPIKey
                 ? "Your coach designs a periodized \(request.weeks)-week program. This can take a minute or two."
                 : "No API key set, so a smart template is used. Add an Anthropic API key in Settings for fully AI-personalized programs.")
        }
    }

    private func build(useAI: Bool) {
        generation.generate(request: request, useAI: useAI, unit: weightUnit, model: claudeModel, context: context) { program in
            onFinished(program)
        }
    }
}

// MARK: - Progress overlay

private struct GeneratingOverlay: View {
    let totalWeeks: Int
    let weeksWritten: Int
    let characters: Int
    let onCancel: () -> Void

    private var status: String {
        if characters == 0 { return "Your coach is planning the program…" }
        if weeksWritten == 0 { return "Writing the program overview…" }
        return "Writing week \(min(weeksWritten, totalWeeks)) of \(totalWeeks)…"
    }

    var body: some View {
        ZStack {
            Color.black.opacity(0.35).ignoresSafeArea()
            VStack(spacing: 18) {
                Image(systemName: "sparkles")
                    .font(.system(size: 40))
                    .foregroundStyle(Color.accentColor)
                    .symbolEffect(.pulse)
                Text("Building your program")
                    .font(.title3.bold())
                Text(status)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .contentTransition(.numericText())
                ProgressView(value: Double(min(weeksWritten, totalWeeks)), total: Double(max(totalWeeks, 1)))
                    .tint(.accentColor)
                Button("Cancel", role: .cancel, action: onCancel)
                    .buttonStyle(.bordered)
            }
            .padding(24)
            .frame(maxWidth: 320)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 24))
            .padding()
        }
        .animation(.default, value: weeksWritten)
    }
}
