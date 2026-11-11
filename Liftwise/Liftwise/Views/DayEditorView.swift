import SwiftUI
import SwiftData

struct DayEditorView: View {
    @Bindable var day: WorkoutDay
    @Environment(\.modelContext) private var context

    @State private var editing: PlannedExercise?
    @State private var showPicker = false
    @State private var copiedMessage: String?

    var body: some View {
        List {
            Section("Workout") {
                TextField("Title", text: $day.title)
                TextField("Focus", text: $day.focus)
                Stepper("~\(day.estimatedMinutes) min", value: $day.estimatedMinutes, in: 10...180, step: 5)
                Picker("Day", selection: $day.dayOfWeek) {
                    ForEach(1...7, id: \.self) { d in
                        Text(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][d - 1]).tag(d)
                    }
                }
                TextField("Notes", text: $day.notes, axis: .vertical)
            }

            Section {
                ForEach(day.sortedExercises) { exercise in
                    Button {
                        editing = exercise
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(exercise.name).font(.body.weight(.medium)).foregroundStyle(.primary)
                            Text(exercise.prescription).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
                .onDelete(perform: delete)
                .onMove(perform: move)

                Button {
                    showPicker = true
                } label: {
                    Label("Add exercise", systemImage: "plus.circle.fill")
                }
            } header: {
                Text("Exercises")
            }

            if let program = day.week?.program, program.weeks.count > 1 {
                Section {
                    Button {
                        copyToMatchingDays(in: program)
                    } label: {
                        Label("Copy this workout to all later weeks", systemImage: "doc.on.doc")
                    }
                } footer: {
                    Text(copiedMessage ?? "Replaces the exercises of every later \"\(day.title)\" (or the same weekday) in unstarted weeks.")
                }
            }
        }
        .navigationTitle("Edit Workout")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { EditButton() }
        .sheet(item: $editing) { ExerciseEditorSheet(exercise: $0) }
        .sheet(isPresented: $showPicker) {
            ExercisePickerView { name in
                let next = (day.exercises.map(\.order).max() ?? -1) + 1
                day.exercises.append(PlannedExercise(order: next, name: name, sets: 3, reps: "8-10",
                                                     intensity: "RPE 7", restSeconds: 90, notes: ""))
            }
        }
    }

    private func delete(at offsets: IndexSet) {
        let sorted = day.sortedExercises
        for i in offsets {
            let ex = sorted[i]
            day.exercises.removeAll { $0 === ex }
            context.delete(ex)
        }
    }

    private func move(from source: IndexSet, to destination: Int) {
        var sorted = day.sortedExercises
        sorted.move(fromOffsets: source, toOffset: destination)
        for (i, ex) in sorted.enumerated() { ex.order = i }
    }

    private func copyToMatchingDays(in program: TrainingProgram) {
        guard let currentWeek = day.week?.number else { return }
        var count = 0
        for week in program.sortedWeeks where week.number > currentWeek {
            let target = week.days.first { $0.title == day.title && !$0.isDone }
                ?? week.days.first { $0.dayOfWeek == day.dayOfWeek && !$0.isDone }
            guard let target else { continue }
            for old in target.exercises { context.delete(old) }
            target.exercises.removeAll()
            target.title = day.title
            target.focus = day.focus
            for ex in day.sortedExercises {
                target.exercises.append(PlannedExercise(order: ex.order, name: ex.name, sets: ex.sets, reps: ex.reps,
                                                        intensity: ex.intensity, restSeconds: ex.restSeconds, notes: ex.notes))
            }
            count += 1
        }
        copiedMessage = "Copied to \(count) workout\(count == 1 ? "" : "s")."
    }
}

struct ExerciseEditorSheet: View {
    @Bindable var exercise: PlannedExercise
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    @State private var showPicker = false
    @State private var applyToFuture = true

    var body: some View {
        NavigationStack {
            Form {
                Section("Exercise") {
                    HStack {
                        TextField("Name", text: $exercise.name)
                        Button("Swap") { showPicker = true }.buttonStyle(.bordered)
                    }
                }
                Section("Prescription") {
                    Stepper("\(exercise.sets) sets", value: $exercise.sets, in: 1...12)
                    LabeledContent("Reps") {
                        TextField("8-10", text: $exercise.reps).multilineTextAlignment(.trailing)
                    }
                    LabeledContent("Intensity") {
                        TextField("RPE 8 / 75% / Moderate", text: $exercise.intensity).multilineTextAlignment(.trailing)
                    }
                    Stepper("Rest \(PlannedExercise.formatRest(exercise.restSeconds))", value: $exercise.restSeconds, in: 0...600, step: 15)
                    TextField("Coaching notes", text: $exercise.notes, axis: .vertical)
                }
            }
            .navigationTitle("Edit Exercise")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
            .sheet(isPresented: $showPicker) {
                ExercisePickerView { name in swapExercise(to: name) }
            }
        }
    }

    /// Swaps this exercise and the same exercise in all later, unfinished workouts of the program.
    private func swapExercise(to newName: String) {
        let oldName = exercise.name
        exercise.name = newName
        guard let day = exercise.day, let program = day.week?.program, let weekNumber = day.week?.number else { return }
        for later in program.allDays where !later.isDone && (later.week?.number ?? 0) > weekNumber {
            for ex in later.exercises where ex.name == oldName { ex.name = newName }
        }
    }
}

struct ExercisePickerView: View {
    var onPick: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var search = ""
    @State private var muscle: MuscleGroup?

    private var results: [ExerciseInfo] {
        ExerciseCatalog.all.filter { info in
            (muscle == nil || info.primary == muscle || info.secondary.contains(muscle!))
                && (search.isEmpty || info.name.localizedCaseInsensitiveContains(search))
        }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack {
                            ForEach(MuscleGroup.allCases) { m in
                                Button(m.rawValue) { muscle = (muscle == m) ? nil : m }
                                    .font(.caption.weight(.semibold))
                                    .padding(.horizontal, 10).padding(.vertical, 6)
                                    .background(muscle == m ? Color.accentColor : Color(.tertiarySystemFill), in: Capsule())
                                    .foregroundStyle(muscle == m ? Color.white : Color.primary)
                                    .buttonStyle(.plain)
                            }
                        }
                    }
                    .listRowBackground(Color.clear)
                }
                if !search.isEmpty && !results.contains(where: { $0.name.caseInsensitiveCompare(search) == .orderedSame }) {
                    Button("Use \"\(search)\"") { pick(search) }
                }
                ForEach(results) { info in
                    Button {
                        pick(info.name)
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(info.name).foregroundStyle(.primary)
                            Text("\(info.primary.rawValue) · \(info.gear.rawValue)").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .searchable(text: $search, prompt: "Search exercises")
            .navigationTitle("Choose Exercise")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }
    }

    private func pick(_ name: String) {
        onPick(name)
        dismiss()
    }
}
