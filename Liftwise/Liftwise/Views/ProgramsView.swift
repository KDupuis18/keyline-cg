import SwiftUI
import SwiftData

struct ProgramsView: View {
    @EnvironmentObject private var router: AppRouter
    @Environment(\.modelContext) private var context
    @Query(sort: \TrainingProgram.createdAt, order: .reverse) private var programs: [TrainingProgram]

    enum Segment: String, CaseIterable { case mine = "My Programs", library = "Library" }
    @State private var segment: Segment = .mine
    @State private var showNewCustom = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("", selection: $segment) {
                    ForEach(Segment.allCases, id: \.self) { Text($0.rawValue) }
                }
                .pickerStyle(.segmented)
                .padding([.horizontal, .top])

                switch segment {
                case .mine: myPrograms
                case .library: ProgramLibraryList()
                }
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Programs")
            .navigationDestination(for: TrainingProgram.self) { ProgramDetailView(program: $0) }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button("Build with AI", systemImage: "sparkles") { router.openBuilder() }
                        Button("Create custom program", systemImage: "square.and.pencil") { showNewCustom = true }
                        Button("Browse library", systemImage: "books.vertical") { segment = .library }
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showNewCustom) { NewCustomProgramView() }
        }
    }

    @ViewBuilder
    private var myPrograms: some View {
        if programs.isEmpty {
            ContentUnavailableView {
                Label("No programs yet", systemImage: "list.bullet.rectangle.portrait")
            } description: {
                Text("Build one with the AI coach, start one from the library, or create your own.")
            } actions: {
                Button("Build with AI") { router.openBuilder() }.buttonStyle(.borderedProminent)
                Button("Browse library") { segment = .library }
            }
            .frame(maxHeight: .infinity)
        } else {
            List {
                ForEach(programs) { program in
                    NavigationLink(value: program) { ProgramRow(program: program) }
                        .swipeActions(edge: .leading) {
                            if !program.isActive {
                                Button("Activate") { program.activate(among: programs) }.tint(.accentColor)
                            }
                        }
                }
                .onDelete { offsets in
                    for index in offsets { context.delete(programs[index]) }
                }
            }
        }
    }
}

struct ProgramRow: View {
    let program: TrainingProgram

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(program.name).font(.headline)
                if program.isActive {
                    Text("ACTIVE")
                        .font(.caption2.weight(.bold))
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Color.accentColor.opacity(0.15), in: Capsule())
                        .foregroundStyle(Color.accentColor)
                }
                if program.generatedByAI {
                    Image(systemName: "sparkles").font(.caption).foregroundStyle(Color.accentColor)
                }
            }
            Text(program.goal).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
            ProgressView(value: program.progress)
            Text("\(program.weeks.count) weeks · \(program.daysPerWeek) days/week · \(program.completedCount)/\(program.totalCount) done")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Library

struct ProgramLibraryList: View {
    @State private var category: ProgramTemplate.Category?

    private var templates: [ProgramTemplate] {
        ProgramTemplate.all.filter { category == nil || $0.category == category }
    }

    var body: some View {
        List {
            Section {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack {
                        chip("All", selected: category == nil) { category = nil }
                        ForEach(ProgramTemplate.Category.allCases) { c in
                            chip(c.rawValue, selected: category == c) { category = c }
                        }
                    }
                }
                .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
                .listRowBackground(Color.clear)
            }
            ForEach(templates) { template in
                NavigationLink {
                    TemplateDetailView(template: template)
                } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(template.name).font(.headline)
                        Text(template.tagline).font(.subheadline).foregroundStyle(.secondary)
                        HStack(spacing: 8) {
                            tag(template.level.rawValue)
                            tag("\(template.daysPerWeek) days/wk")
                            tag("\(template.weeks) wks")
                            tag(template.request.equipment.rawValue)
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
        }
    }

    private func chip(_ title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.medium))
                .padding(.horizontal, 14).padding(.vertical, 7)
                .background(selected ? Color.accentColor : Color(.tertiarySystemFill), in: Capsule())
                .foregroundStyle(selected ? Color.white : Color.primary)
        }
        .buttonStyle(.plain)
    }

    private func tag(_ text: String) -> some View {
        Text(text)
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 6).padding(.vertical, 3)
            .background(Color(.tertiarySystemFill), in: Capsule())
    }
}

struct TemplateDetailView: View {
    let template: ProgramTemplate
    @EnvironmentObject private var router: AppRouter
    @Environment(\.modelContext) private var context
    @Query private var programs: [TrainingProgram]

    @State private var weeks: Int
    @State private var started: TrainingProgram?

    init(template: ProgramTemplate) {
        self.template = template
        _weeks = State(initialValue: template.weeks)
    }

    private var preview: PlanDTO {
        var request = template.request
        request.weeks = weeks
        return OfflinePlanBuilder.build(request)
    }

    var body: some View {
        List {
            Section {
                Text(template.description)
                LabeledContent("Level", value: template.level.rawValue)
                LabeledContent("Schedule", value: "\(template.daysPerWeek) days per week")
                LabeledContent("Session length", value: "~\(template.request.sessionMinutes) min")
                LabeledContent("Equipment", value: template.request.equipment.rawValue)
                Stepper("Length: \(weeks) weeks", value: $weeks, in: 4...16)
            }

            Section("Week 1 preview") {
                ForEach(Array((preview.weeks.first?.days ?? []).enumerated()), id: \.offset) { _, day in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(day.title).font(.headline)
                        ForEach(Array(day.exercises.enumerated()), id: \.offset) { _, ex in
                            Text("\(ex.name) · \(ex.sets)×\(ex.reps)").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 2)
                }
            }

            Section {
                Button {
                    var request = template.request
                    request.weeks = weeks
                    let program = OfflinePlanBuilder.build(request)
                        .makeProgram(goal: template.tagline, generatedByAI: false, source: "template", in: context)
                    program.name = template.name
                    program.summary = template.description
                    program.activate(among: programs + [program])
                    started = program
                } label: {
                    Label("Start this program", systemImage: "play.fill").frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.borderedProminent)
                .listRowInsets(EdgeInsets())

                Button("Personalize it with AI instead") {
                    var request = template.request
                    request.weeks = weeks
                    request.notes = "Base it on a \(template.name)-style plan: \(template.description)"
                    router.openBuilder(prefill: request)
                }
                .frame(maxWidth: .infinity)
            }
        }
        .navigationTitle(template.name)
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(item: $started) { ProgramDetailView(program: $0) }
    }
}

// MARK: - Custom program

struct NewCustomProgramView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    @Query private var programs: [TrainingProgram]

    @State private var name = "My Program"
    @State private var weeks = 8
    @State private var weekdays: Set<Int> = [1, 3, 5]

    private let names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    var body: some View {
        NavigationStack {
            Form {
                TextField("Program name", text: $name)
                Stepper("\(weeks) weeks", value: $weeks, in: 1...16)
                Section("Training days") {
                    HStack {
                        ForEach(1...7, id: \.self) { d in
                            let on = weekdays.contains(d)
                            Button(names[d - 1]) {
                                if on { weekdays.remove(d) } else { weekdays.insert(d) }
                            }
                            .font(.caption.weight(.semibold))
                            .frame(maxWidth: .infinity, minHeight: 36)
                            .background(on ? Color.accentColor : Color(.tertiarySystemFill), in: RoundedRectangle(cornerRadius: 8))
                            .foregroundStyle(on ? Color.white : Color.primary)
                            .buttonStyle(.plain)
                        }
                    }
                }
                Section {
                    Text("You'll get empty workouts for each training day. Add exercises to week 1, then use \"Copy to all weeks\" in the day editor.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Custom Program")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") { create() }.disabled(weekdays.isEmpty || name.isEmpty)
                }
            }
        }
    }

    private func create() {
        let days = weekdays.sorted()
        let dto = PlanDTO(name: name, summary: "Custom program.", weeks: (1...weeks).map { w in
            WeekDTO(week: w, focus: "Training", days: days.enumerated().map { i, d in
                DayDTO(dayOfWeek: d, title: "Day \(i + 1)", focus: "", estimatedMinutes: 60, notes: "", exercises: [])
            })
        })
        let program = dto.makeProgram(goal: "Custom", generatedByAI: false, source: "custom", in: context)
        program.activate(among: programs + [program])
        dismiss()
    }
}

// MARK: - Program detail

struct ProgramDetailView: View {
    @Bindable var program: TrainingProgram
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @Query private var allPrograms: [TrainingProgram]

    @State private var showAdjust = false
    @State private var showRename = false
    @State private var confirmReset = false
    @State private var confirmDelete = false
    @State private var editingDay: WorkoutDay?

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 10) {
                    Text(program.goal).font(.subheadline.weight(.semibold)).foregroundStyle(Color.accentColor)
                    Text(program.summary).font(.subheadline)
                    ProgressView(value: program.progress) {
                        Text("\(program.doneCount) of \(program.totalCount) workouts done")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 4)

                if !program.isActive {
                    Button {
                        program.activate(among: allPrograms)
                    } label: {
                        Label("Make this my active program", systemImage: "flag.fill")
                    }
                }
                Button {
                    showAdjust = true
                } label: {
                    Label("Adjust with AI", systemImage: "sparkles")
                }
            }

            ForEach(program.sortedWeeks) { week in
                Section {
                    ForEach(week.sortedDays) { day in
                        NavigationLink(value: day) { DayRow(day: day) }
                            .swipeActions {
                                if !day.isDone {
                                    Button("Skip") { day.skipped = true }.tint(.orange)
                                } else {
                                    Button("Reset") { day.skipped = false; day.completedAt = nil }.tint(.gray)
                                }
                            }
                            .swipeActions(edge: .leading) {
                                Button("Edit") { editingDay = day }.tint(.accentColor)
                            }
                            .contextMenu {
                                Button("Edit workout", systemImage: "pencil") { editingDay = day }
                            }
                    }
                } header: {
                    HStack {
                        Text("Week \(week.number)")
                        if !week.focus.isEmpty { Text("· \(week.focus)") }
                        Spacer()
                        Text("\(week.completedCount)/\(week.days.count)")
                    }
                }
            }
        }
        .navigationTitle(program.name)
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(for: WorkoutDay.self) { WorkoutSessionView(day: $0) }
        .navigationDestination(item: $editingDay) { DayEditorView(day: $0) }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button("Adjust with AI", systemImage: "sparkles") { showAdjust = true }
                    Button("Rename", systemImage: "pencil") { showRename = true }
                    Button("Restart program", systemImage: "arrow.counterclockwise") { confirmReset = true }
                    Button("Delete program", systemImage: "trash", role: .destructive) { confirmDelete = true }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .sheet(isPresented: $showAdjust) { AdjustProgramView(program: program) }
        .alert("Rename program", isPresented: $showRename) {
            TextField("Name", text: $program.name)
            Button("Done") {}
        }
        .confirmationDialog("Restart this program? Your logged sets are kept in history.", isPresented: $confirmReset, titleVisibility: .visible) {
            Button("Restart") {
                // Clone into a fresh copy so history stays attached to the original.
                let copy = PlanDTO(program: program).makeProgram(goal: program.goal, generatedByAI: program.generatedByAI,
                                                                   source: program.source, in: context)
                copy.activate(among: allPrograms + [copy])
            }
        }
        .confirmationDialog("Delete this program and its workout history?", isPresented: $confirmDelete, titleVisibility: .visible) {
            Button("Delete", role: .destructive) {
                context.delete(program)
                dismiss()
            }
        }
    }
}

// MARK: - AI adjust

struct AdjustProgramView: View {
    let program: TrainingProgram
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    @Query private var programs: [TrainingProgram]
    @Query private var bodyWeights: [BodyWeightEntry]
    @AppStorage("weightUnit") private var weightUnit = "lb"
    @AppStorage("claudeModel") private var claudeModel = ClaudeModelOption.defaultModel

    @State private var instruction = ""
    @State private var working = false
    @State private var progressChars = 0
    @State private var error: String?

    private let suggestions = [
        "Make every session 45 minutes or less",
        "I only have dumbbells for the next few weeks",
        "My lower back is sore, go easier on hinges",
        "Add more arm and shoulder work",
        "I can only train 3 days a week now",
        "Make it harder, it's feeling too easy",
    ]

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("What should change?", text: $instruction, axis: .vertical)
                        .lineLimit(3...6)
                } footer: {
                    Text("Weeks you've already started stay as they are. Only upcoming weeks are rewritten.")
                }
                Section("Ideas") {
                    ForEach(suggestions, id: \.self) { s in
                        Button(s) { instruction = s }
                    }
                }
                if let error {
                    Section { Label(error, systemImage: "exclamationmark.triangle.fill").foregroundStyle(.red) }
                }
            }
            .navigationTitle("Adjust with AI")
            .navigationBarTitleDisplayMode(.inline)
            .disabled(working)
            .overlay {
                if working {
                    VStack(spacing: 12) {
                        ProgressView()
                        Text(progressChars == 0 ? "Coach is reviewing your program…" : "Rewriting upcoming weeks…")
                            .font(.subheadline)
                    }
                    .padding(24)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 20))
                }
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Apply") { Task { await apply() } }
                        .disabled(instruction.trimmingCharacters(in: .whitespaces).isEmpty || working)
                }
            }
        }
        .interactiveDismissDisabled(working)
    }

    private func apply() async {
        let key = KeychainStore.loadAPIKey()
        guard !key.isEmpty else {
            error = ClaudeClient.ClaudeError.missingAPIKey.localizedDescription
            return
        }
        working = true
        error = nil
        defer { working = false }

        let history = TrainingHistory.load(from: context)
        let snapshot = CoachContext.snapshot(programs: programs, history: history, bodyWeights: bodyWeights, unit: weightUnit)
        let builder = AIPlanBuilder(client: ClaudeClient(apiKey: key, model: claudeModel))
        do {
            let plan = try await builder.adjust(program: program, instruction: instruction, context: snapshot, unit: weightUnit) { chunk in
                progressChars += chunk.count
            }
            // Replace untouched weeks with the rewritten ones.
            let replace = Set(plan.weeks.map(\.week))
            for week in program.weeks where replace.contains(week.number) {
                program.weeks.removeAll { $0 === week }
                context.delete(week)
            }
            plan.append(weeks: plan.weeks, to: program)
            program.summary = plan.summary
            try? context.save()
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }
}
