import SwiftUI
import SwiftData

struct WorkoutSessionView: View {
    @Bindable var day: WorkoutDay
    @Environment(\.dismiss) private var dismiss
    @AppStorage("weightUnit") private var weightUnit = "lb"

    @State private var restEndsAt: Date?
    @State private var restTotal: Int = 0

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 6) {
                    Text(day.scheduleLabel).font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                    if !day.focus.isEmpty { Text(day.focus).font(.subheadline.weight(.medium)) }
                    if !day.notes.isEmpty {
                        Label(day.notes, systemImage: "lightbulb")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            ForEach(day.sortedExercises) { exercise in
                Section {
                    ForEach(exercise.sortedLogs) { log in
                        SetLogRow(log: log, unit: weightUnit) { completed in
                            if completed && exercise.restSeconds > 0 { startRest(exercise.restSeconds) }
                        }
                    }
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
                } header: {
                    ExerciseHeader(exercise: exercise)
                }
            }

            Section {
                if day.isCompleted {
                    Label("Completed \(day.completedAt!.formatted(date: .abbreviated, time: .shortened))",
                          systemImage: "checkmark.seal.fill")
                        .foregroundStyle(.green)
                    Button("Mark as not done") { day.completedAt = nil }
                } else {
                    Button {
                        day.completedAt = Date()
                        dismiss()
                    } label: {
                        Label("Finish Workout", systemImage: "checkmark")
                            .font(.headline)
                            .frame(maxWidth: .infinity, minHeight: 44)
                    }
                    .buttonStyle(.borderedProminent)
                    .listRowInsets(EdgeInsets())
                }
            }
        }
        .navigationTitle(day.title)
        .navigationBarTitleDisplayMode(.inline)
        .scrollDismissesKeyboard(.interactively)
        .onAppear(perform: prepareLogs)
        .safeAreaInset(edge: .bottom) {
            if let restEndsAt {
                RestTimerBar(endsAt: restEndsAt, total: restTotal) {
                    self.restEndsAt = nil
                } onAdd: {
                    self.restEndsAt = restEndsAt.addingTimeInterval(15)
                    restTotal += 15
                }
                .padding(.horizontal)
                .padding(.bottom, 6)
            }
        }
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") {
                    UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
                }
            }
        }
    }

    // MARK: Logging helpers

    /// Creates one log row per planned set, prefilled from the most recent
    /// time this exercise was logged in the program (progressive overload).
    private func prepareLogs() {
        for exercise in day.exercises where exercise.logs.isEmpty {
            let previous = previousLogs(for: exercise.name)
            for n in 1...max(exercise.sets, 1) {
                let prior = previous.first { $0.setNumber == n } ?? previous.last
                exercise.logs.append(SetLog(
                    setNumber: n,
                    weight: prior?.weight ?? 0,
                    reps: exercise.targetReps
                ))
            }
        }
    }

    private func previousLogs(for name: String) -> [SetLog] {
        guard let program = day.week?.program else { return [] }
        let earlierDays = program.allDays.prefix { $0 !== day }
        for d in earlierDays.reversed() {
            if let match = d.exercises.first(where: { $0.name.caseInsensitiveCompare(name) == .orderedSame }) {
                let done = match.sortedLogs.filter { $0.completed && $0.weight > 0 }
                if !done.isEmpty { return done }
            }
        }
        return []
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
        last.modelContext?.delete(last)
    }

    private func startRest(_ seconds: Int) {
        restTotal = seconds
        restEndsAt = Date().addingTimeInterval(TimeInterval(seconds))
    }
}

private struct ExerciseHeader: View {
    let exercise: PlannedExercise

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(exercise.name)
                .font(.headline)
                .foregroundStyle(.primary)
                .textCase(nil)
            Text(exercise.prescription)
                .font(.caption.weight(.medium))
                .foregroundStyle(Color.accentColor)
                .textCase(nil)
            if !exercise.notes.isEmpty {
                Text(exercise.notes)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .textCase(nil)
            }
        }
        .padding(.top, 6)
    }
}

private struct SetLogRow: View {
    @Bindable var log: SetLog
    let unit: String
    var onToggle: (Bool) -> Void

    var body: some View {
        HStack(spacing: 12) {
            Text("\(log.setNumber)")
                .font(.subheadline.monospacedDigit().weight(.semibold))
                .frame(width: 24)
                .foregroundStyle(.secondary)

            HStack(spacing: 4) {
                TextField("0", value: $log.weight, format: .number)
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.trailing)
                    .frame(width: 64)
                    .textFieldStyle(.roundedBorder)
                Text(unit).font(.caption).foregroundStyle(.secondary)
            }

            HStack(spacing: 4) {
                TextField("0", value: $log.reps, format: .number)
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing)
                    .frame(width: 48)
                    .textFieldStyle(.roundedBorder)
                Text("reps").font(.caption).foregroundStyle(.secondary)
            }

            Spacer()

            Button {
                log.completed.toggle()
                log.loggedAt = log.completed ? Date() : nil
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

private struct RestTimerBar: View {
    let endsAt: Date
    let total: Int
    var onSkip: () -> Void
    var onAdd: () -> Void

    var body: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let remaining = max(0, Int(endsAt.timeIntervalSince(context.date).rounded(.up)))
            HStack(spacing: 14) {
                Image(systemName: remaining == 0 ? "bell.fill" : "timer")
                    .font(.title3)
                VStack(alignment: .leading, spacing: 4) {
                    Text(remaining == 0 ? "Rest over — next set!" : "Rest  \(remaining / 60):\(String(format: "%02d", remaining % 60))")
                        .font(.headline.monospacedDigit())
                    ProgressView(value: Double(total - remaining), total: Double(max(total, 1)))
                        .tint(.white)
                }
                Button("+15s", action: onAdd)
                    .buttonStyle(.bordered)
                    .tint(.white)
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
