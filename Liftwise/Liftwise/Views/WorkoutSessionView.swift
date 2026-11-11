import SwiftUI
import SwiftData

struct WorkoutSessionView: View {
    @Bindable var day: WorkoutDay
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    @AppStorage("weightUnit") private var weightUnit = "lb"
    @AppStorage("autoProgression") private var autoProgression = true
    @AppStorage("healthSync") private var healthSync = false
    @AppStorage("barWeight") private var barWeight: Double = 0

    @State private var history = TrainingHistory(logs: [])
    @State private var suggestions: [PersistentIdentifier: WeightSuggestion] = [:]
    @State private var restEndsAt: Date?
    @State private var restTotal = 0
    @State private var prBanner: String?
    @State private var warmupFor: PlannedExercise?
    @State private var infoFor: PlannedExercise?
    @State private var showEditor = false
    @State private var showSummary = false

    private var bar: Double { barWeight > 0 ? barWeight : Strength.defaultBar(unit: weightUnit) }

    var body: some View {
        List {
            headerSection

            ForEach(day.sortedExercises) { exercise in
                Section {
                    if let last = history.last(for: exercise.name) {
                        Text("Last: " + last.sets.map { "\(Strength.format($0.weight))×\($0.reps)" }.joined(separator: ", "))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    ForEach(exercise.sortedLogs) { log in
                        SetLogRow(log: log, unit: weightUnit, timed: exercise.isTimed) { completed in
                            if completed { setCompleted(log, in: exercise) }
                        }
                    }
                    setButtons(for: exercise)
                } header: {
                    ExerciseHeader(
                        exercise: exercise,
                        suggestion: suggestions[exercise.persistentModelID],
                        unit: weightUnit,
                        onInfo: { infoFor = exercise },
                        onWarmup: { warmupFor = exercise }
                    )
                }
            }

            Section("Session notes") {
                TextField("How did it feel? Anything to remember next time?", text: $day.sessionNotes, axis: .vertical)
                    .lineLimit(2...5)
            }

            finishSection
        }
        .navigationTitle(day.title)
        .navigationBarTitleDisplayMode(.inline)
        .scrollDismissesKeyboard(.interactively)
        .onAppear(perform: prepare)
        .safeAreaInset(edge: .bottom) {
            if let restEndsAt {
                RestTimerBar(endsAt: restEndsAt, total: restTotal) {
                    self.restEndsAt = nil
                    ReminderScheduler.cancelRest()
                } onAdd: {
                    let newEnd = restEndsAt.addingTimeInterval(15)
                    self.restEndsAt = newEnd
                    restTotal += 15
                    ReminderScheduler.scheduleRestEnd(after: Int(newEnd.timeIntervalSinceNow))
                }
                .padding(.horizontal)
                .padding(.bottom, 6)
            }
        }
        .overlay(alignment: .top) {
            if let prBanner {
                Label(prBanner, systemImage: "trophy.fill")
                    .font(.subheadline.weight(.semibold))
                    .padding(.horizontal, 16).padding(.vertical, 10)
                    .background(.yellow, in: Capsule())
                    .foregroundStyle(.black)
                    .padding(.top, 8)
                    .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(.spring, value: prBanner)
        .sensoryFeedback(.success, trigger: prBanner) { _, new in new != nil }
        .toolbar {
            ToolbarItem(placement: .principal) {
                if let started = day.startedAt, !day.isCompleted {
                    TimelineView(.periodic(from: .now, by: 1)) { ctx in
                        VStack(spacing: 0) {
                            Text(day.title).font(.subheadline.weight(.semibold)).lineLimit(1)
                            Text(Duration.seconds(ctx.date.timeIntervalSince(started)).formatted(.time(pattern: .minuteSecond)))
                                .font(.caption.monospacedDigit())
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button { showEditor = true } label: { Image(systemName: "pencil") }
            }
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") {
                    UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
                }
            }
        }
        .sheet(item: $warmupFor) { exercise in
            WarmupSheet(exercise: exercise,
                        working: exercise.sortedLogs.map(\.weight).max() ?? 0,
                        unit: weightUnit, bar: bar)
                .presentationDetents([.medium, .large])
        }
        .sheet(item: $infoFor) { exercise in
            NavigationStack { ExerciseDetailView(name: exercise.name) }
        }
        .sheet(isPresented: $showEditor, onDismiss: prepare) {
            NavigationStack { DayEditorView(day: day) }
        }
        .sheet(isPresented: $showSummary, onDismiss: { dismiss() }) {
            NavigationStack { WorkoutSummaryView(day: day, isFresh: true) }
        }
    }

    // MARK: Sections

    private var headerSection: some View {
        Section {
            VStack(alignment: .leading, spacing: 6) {
                Text(day.scheduleLabel).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                if !day.focus.isEmpty { Text(day.focus).font(.subheadline.weight(.medium)) }
                if !day.notes.isEmpty {
                    Label(day.notes, systemImage: "lightbulb").font(.footnote).foregroundStyle(.secondary)
                }
                if day.week?.isDeload == true {
                    Label("Deload week: lighter weights, focus on quality.", systemImage: "leaf.fill")
                        .font(.footnote).foregroundStyle(.green)
                }
            }
            if day.startedAt == nil && !day.isCompleted {
                Button {
                    day.startedAt = Date()
                } label: {
                    Label("Start Workout", systemImage: "play.fill").font(.headline).frame(maxWidth: .infinity, minHeight: 40)
                }
                .buttonStyle(.borderedProminent)
            }
        }
    }

    private func setButtons(for exercise: PlannedExercise) -> some View {
        HStack {
            Button {
                addSet(to: exercise)
            } label: {
                Label("Add set", systemImage: "plus.circle")
            }
            Spacer()
            if exercise.logs.count > 1 {
                Button(role: .destructive) {
                    removeLastSet(from: exercise)
                } label: {
                    Label("Remove", systemImage: "minus.circle")
                }
            }
        }
        .font(.footnote)
        .buttonStyle(.borderless)
    }

    private var finishSection: some View {
        Section {
            if day.isCompleted {
                Label("Completed \(day.completedAt!.formatted(date: .abbreviated, time: .shortened))",
                      systemImage: "checkmark.seal.fill")
                    .foregroundStyle(.green)
                NavigationLink("View summary") { WorkoutSummaryView(day: day, isFresh: false) }
                Button("Mark as not done") { day.completedAt = nil }
            } else {
                Button(action: finish) {
                    Label("Finish Workout", systemImage: "checkmark")
                        .font(.headline)
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.borderedProminent)
                .listRowInsets(EdgeInsets())
            }
        }
    }

    // MARK: Logic

    /// Loads history, computes auto-progression suggestions and creates set rows.
    private func prepare() {
        history = TrainingHistory.load(from: context, excluding: day)
        var computed: [PersistentIdentifier: WeightSuggestion] = [:]
        for exercise in day.exercises {
            let suggestion = autoProgression && !exercise.isTimed
                ? ProgressionEngine.suggest(for: exercise, history: history, unit: weightUnit)
                : nil
            if let suggestion { computed[exercise.persistentModelID] = suggestion }

            guard exercise.logs.isEmpty else { continue }
            let last = history.last(for: exercise.name)
            for n in 1...max(exercise.sets, 1) {
                let prior = last?.sets.first { $0.setNumber == n } ?? last?.sets.last
                exercise.logs.append(SetLog(
                    setNumber: n,
                    weight: suggestion?.weight ?? prior?.weight ?? 0,
                    reps: exercise.targetReps
                ))
            }
        }
        suggestions = computed
    }

    private func setCompleted(_ log: SetLog, in exercise: PlannedExercise) {
        if day.startedAt == nil { day.startedAt = Date() }

        // Personal record: best estimated 1RM ever for this exercise.
        let e1rm = log.estimatedOneRepMax
        let previousBest = history.bestE1RM(for: exercise.name)
        let sessionBest = exercise.logs.filter { $0 !== log && $0.completed }.map(\.estimatedOneRepMax).max() ?? 0
        if e1rm > 0, previousBest > 0, e1rm > previousBest, e1rm > sessionBest {
            exercise.logs.forEach { if $0 !== log { $0.isPR = false } }
            log.isPR = true
            showPR("New PR! \(exercise.name): \(Strength.format(log.weight))×\(log.reps) (e1RM \(Strength.format(e1rm.rounded())))")
        }

        if exercise.restSeconds > 0 {
            restTotal = exercise.restSeconds
            restEndsAt = Date().addingTimeInterval(TimeInterval(exercise.restSeconds))
            ReminderScheduler.scheduleRestEnd(after: exercise.restSeconds)
        }
    }

    private func showPR(_ text: String) {
        prBanner = text
        Task {
            try? await Task.sleep(for: .seconds(3))
            if prBanner == text { prBanner = nil }
        }
    }

    private func addSet(to exercise: PlannedExercise) {
        let last = exercise.sortedLogs.last
        exercise.logs.append(SetLog(
            setNumber: (last?.setNumber ?? 0) + 1,
            weight: last?.weight ?? 0,
            reps: last?.reps ?? exercise.targetReps
        ))
    }

    private func removeLastSet(from exercise: PlannedExercise) {
        guard let last = exercise.sortedLogs.last else { return }
        exercise.logs.removeAll { $0 === last }
        context.delete(last)
    }

    private func finish() {
        let end = Date()
        let start = day.startedAt ?? end.addingTimeInterval(-Double(day.estimatedMinutes * 60))
        day.startedAt = start
        day.completedAt = end
        day.durationSeconds = Int(end.timeIntervalSince(start))
        day.skipped = false
        restEndsAt = nil
        ReminderScheduler.cancelRest()
        try? context.save()
        if healthSync {
            Task { await HealthSync.saveWorkout(start: start, end: end) }
        }
        showSummary = true
    }
}

// MARK: - Exercise header

private struct ExerciseHeader: View {
    let exercise: PlannedExercise
    let suggestion: WeightSuggestion?
    let unit: String
    var onInfo: () -> Void
    var onWarmup: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline) {
                Button(action: onInfo) {
                    HStack(spacing: 4) {
                        Text(exercise.name).font(.headline).foregroundStyle(.primary)
                        Image(systemName: "info.circle").font(.caption).foregroundStyle(.secondary)
                    }
                }
                .buttonStyle(.plain)
                Spacer()
                if !exercise.isTimed {
                    Button("Warm-up", action: onWarmup)
                        .font(.caption.weight(.semibold))
                        .buttonStyle(.bordered)
                        .controlSize(.mini)
                }
            }
            Text(exercise.prescription)
                .font(.caption.weight(.medium))
                .foregroundStyle(Color.accentColor)
            if let suggestion {
                Label("\(Strength.format(suggestion.weight)) \(unit) · \(suggestion.reason)", systemImage: icon(suggestion.direction))
                    .font(.caption)
                    .foregroundStyle(color(suggestion.direction))
            }
            if !exercise.notes.isEmpty {
                Text(exercise.notes).font(.caption).foregroundStyle(.secondary)
            }
        }
        .textCase(nil)
        .padding(.top, 6)
    }

    private func icon(_ d: WeightSuggestion.Direction) -> String {
        switch d {
        case .up: "arrow.up.circle.fill"
        case .down: "arrow.down.circle.fill"
        case .same: "equal.circle.fill"
        case .fromMax: "percent"
        }
    }

    private func color(_ d: WeightSuggestion.Direction) -> Color {
        switch d {
        case .up: .green
        case .down: .orange
        case .same, .fromMax: .secondary
        }
    }
}

// MARK: - Set row

private struct SetLogRow: View {
    @Bindable var log: SetLog
    let unit: String
    let timed: Bool
    var onToggle: (Bool) -> Void

    var body: some View {
        HStack(spacing: 10) {
            ZStack {
                Text("\(log.setNumber)")
                    .font(.subheadline.monospacedDigit().weight(.semibold))
                    .foregroundStyle(.secondary)
                if log.isPR {
                    Image(systemName: "trophy.fill").font(.caption2).foregroundStyle(.yellow).offset(x: 10, y: -10)
                }
            }
            .frame(width: 26)

            if timed {
                Text("Done when complete").font(.subheadline).foregroundStyle(.secondary)
            } else {
                HStack(spacing: 3) {
                    TextField("0", value: $log.weight, format: .number)
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 62)
                        .textFieldStyle(.roundedBorder)
                    Text(unit).font(.caption2).foregroundStyle(.secondary)
                }
                HStack(spacing: 3) {
                    TextField("0", value: $log.reps, format: .number)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 44)
                        .textFieldStyle(.roundedBorder)
                    Text("reps").font(.caption2).foregroundStyle(.secondary)
                }
                Menu {
                    Button("No RPE") { log.rpe = 0 }
                    ForEach([6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0], id: \.self) { value in
                        Button("RPE \(Strength.format(value))") { log.rpe = value }
                    }
                } label: {
                    Text(log.rpe > 0 ? "@\(Strength.format(log.rpe))" : "RPE")
                        .font(.caption.weight(.semibold))
                        .frame(width: 40, height: 30)
                        .background(Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 6))
                }
            }

            Spacer(minLength: 0)

            Button {
                log.completed.toggle()
                log.loggedAt = log.completed ? Date() : nil
                if !log.completed { log.isPR = false }
                onToggle(log.completed)
            } label: {
                Image(systemName: log.completed ? "checkmark.circle.fill" : "circle")
                    .font(.title2)
                    .foregroundStyle(log.completed ? Color.green : Color.secondary)
            }
            .buttonStyle(.borderless)
            .sensoryFeedback(.success, trigger: log.completed) { _, new in new }
        }
    }
}

// MARK: - Rest timer

private struct RestTimerBar: View {
    let endsAt: Date
    let total: Int
    var onSkip: () -> Void
    var onAdd: () -> Void

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let remaining = max(0, Int(endsAt.timeIntervalSince(context.date).rounded(.up)))
            HStack(spacing: 14) {
                Image(systemName: remaining == 0 ? "bell.fill" : "timer").font(.title3)
                VStack(alignment: .leading, spacing: 4) {
                    Text(remaining == 0 ? "Rest over: next set!" : "Rest  \(remaining / 60):\(String(format: "%02d", remaining % 60))")
                        .font(.headline.monospacedDigit())
                    ProgressView(value: Double(total - remaining), total: Double(max(total, 1)))
                        .tint(.white)
                }
                Button("+15s", action: onAdd).buttonStyle(.bordered).tint(.white)
                Button(remaining == 0 ? "Done" : "Skip", action: onSkip)
                    .buttonStyle(.borderedProminent)
                    .tint(.white.opacity(0.25))
            }
            .foregroundStyle(.white)
            .padding()
            .background(Color.accentColor.gradient, in: RoundedRectangle(cornerRadius: 18))
            .shadow(radius: 8, y: 4)
        }
    }
}

// MARK: - Warm-up & plates

struct WarmupSheet: View {
    let exercise: PlannedExercise
    let working: Double
    let unit: String
    let bar: Double

    var body: some View {
        NavigationStack {
            List {
                if working <= bar {
                    Text("Enter a working weight above the bar (\(Strength.format(bar)) \(unit)) to get a warm-up ramp.")
                        .foregroundStyle(.secondary)
                } else {
                    Section("Warm-up ramp to \(Strength.format(working)) \(unit)") {
                        ForEach(Strength.warmups(for: working, unit: unit, bar: bar)) { set in
                            row(weight: set.weight, detail: "\(set.label) × \(set.reps)")
                        }
                    }
                    Section("Working sets") {
                        row(weight: working, detail: exercise.prescription)
                    }
                }
            }
            .navigationTitle(exercise.name)
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func row(weight: Double, detail: String) -> some View {
        let breakdown = Strength.plateBreakdown(target: weight, bar: bar, unit: unit)
        return VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("\(Strength.format(weight)) \(unit)").font(.headline.monospacedDigit())
                Spacer()
                Text(detail).font(.caption).foregroundStyle(.secondary)
            }
            Text(breakdown.plates.isEmpty ? "Empty bar" : "Per side: " + breakdown.plates.map(Strength.format).joined(separator: " + "))
                .font(.caption)
                .foregroundStyle(Color.accentColor)
        }
    }
}

// MARK: - Summary

struct WorkoutSummaryView: View {
    let day: WorkoutDay
    let isFresh: Bool
    @Environment(\.dismiss) private var dismiss
    @AppStorage("weightUnit") private var weightUnit = "lb"

    private var prSets: [(String, SetLog)] {
        day.sortedExercises.flatMap { ex in ex.sortedLogs.filter(\.isPR).map { (ex.name, $0) } }
    }

    var body: some View {
        List {
            Section {
                VStack(spacing: 8) {
                    Image(systemName: "checkmark.seal.fill").font(.system(size: 52)).foregroundStyle(.green)
                    Text(isFresh ? "Workout complete!" : day.title).font(.title2.bold())
                    if let date = day.completedAt {
                        Text(date.formatted(date: .complete, time: .shortened)).font(.caption).foregroundStyle(.secondary)
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)

                HStack {
                    StatTile(value: Duration.seconds(day.durationSeconds).formatted(.time(pattern: .hourMinute)),
                             label: "Duration", icon: "clock")
                    StatTile(value: Strength.format(day.volume.rounded()), label: "Volume (\(weightUnit))", icon: "scalemass")
                    StatTile(value: "\(day.completedSets.count)", label: "Sets", icon: "checklist")
                }
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())
            }

            if !prSets.isEmpty {
                Section("Personal records 🏆") {
                    ForEach(Array(prSets.enumerated()), id: \.offset) { _, item in
                        LabeledContent(item.0, value: "\(Strength.format(item.1.weight))×\(item.1.reps)")
                    }
                }
            }

            Section("Exercises") {
                ForEach(day.sortedExercises) { ex in
                    let done = ex.sortedLogs.filter(\.completed)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(ex.name).font(.subheadline.weight(.semibold))
                        Text(done.isEmpty ? "Not logged" : done.map { "\(Strength.format($0.weight))×\($0.reps)" }.joined(separator: ", "))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            if !day.sessionNotes.isEmpty {
                Section("Notes") { Text(day.sessionNotes) }
            }
        }
        .navigationTitle("Summary")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if isFresh {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
    }
}
