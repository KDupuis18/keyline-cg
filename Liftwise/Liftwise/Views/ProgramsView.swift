import SwiftUI
import SwiftData

struct ProgramsView: View {
    var onBuildPlan: () -> Void

    @Environment(\.modelContext) private var context
    @Query(sort: \TrainingProgram.createdAt, order: .reverse) private var programs: [TrainingProgram]

    var body: some View {
        NavigationStack {
            Group {
                if programs.isEmpty {
                    ContentUnavailableView {
                        Label("No programs yet", systemImage: "list.bullet.rectangle.portrait")
                    } description: {
                        Text("Build your first multi-week program with the AI coach.")
                    } actions: {
                        Button("Open AI Builder", action: onBuildPlan).buttonStyle(.borderedProminent)
                    }
                } else {
                    List {
                        ForEach(programs) { program in
                            NavigationLink(value: program) {
                                ProgramRow(program: program)
                            }
                            .swipeActions(edge: .leading) {
                                if !program.isActive {
                                    Button("Activate") { activate(program) }.tint(.accentColor)
                                }
                            }
                        }
                        .onDelete(perform: delete)
                    }
                }
            }
            .navigationTitle("Programs")
            .navigationDestination(for: TrainingProgram.self) { ProgramDetailView(program: $0) }
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(action: onBuildPlan) { Image(systemName: "plus") }
                }
            }
        }
    }

    private func activate(_ program: TrainingProgram) {
        for p in programs { p.isActive = (p.id == program.id) }
    }

    private func delete(at offsets: IndexSet) {
        for index in offsets { context.delete(programs[index]) }
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
            Text("\(program.weeks.count) weeks · \(program.completedCount)/\(program.totalCount) workouts done")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
}

struct ProgramDetailView: View {
    @Bindable var program: TrainingProgram
    @Query private var allPrograms: [TrainingProgram]

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 10) {
                    Text(program.goal)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Color.accentColor)
                    Text(program.summary)
                        .font(.subheadline)
                    ProgressView(value: program.progress) {
                        Text("\(program.completedCount) of \(program.totalCount) workouts complete")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 4)

                if !program.isActive {
                    Button {
                        for p in allPrograms { p.isActive = (p.id == program.id) }
                    } label: {
                        Label("Make this my active program", systemImage: "flag.fill")
                    }
                }
            }

            ForEach(program.sortedWeeks) { week in
                Section {
                    ForEach(week.sortedDays) { day in
                        NavigationLink(value: day) { DayRow(day: day) }
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
    }
}
