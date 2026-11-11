import SwiftUI
import SwiftData

struct TodayView: View {
    @EnvironmentObject private var router: AppRouter
    @Environment(\.modelContext) private var context
    @Query private var programs: [TrainingProgram]
    @AppStorage("weightUnit") private var weightUnit = "lb"

    private var active: TrainingProgram? { programs.first(where: \.isActive) }

    private var completedDays: [WorkoutDay] {
        programs.flatMap(\.allDays).filter(\.isCompleted)
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    StatsStrip(completed: completedDays)

                    if let program = active {
                        activeContent(program)
                    } else {
                        EmptyProgramCard(onBuildPlan: { router.openBuilder() },
                                         onBrowse: { router.tab = .programs })
                    }
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle(Date().formatted(.dateTime.weekday(.wide).month().day()))
            .navigationDestination(for: WorkoutDay.self) { WorkoutSessionView(day: $0) }
        }
    }

    @ViewBuilder
    private func activeContent(_ program: TrainingProgram) -> some View {
        NavigationLink {
            ProgramDetailView(program: program)
        } label: {
            ProgramProgressCard(program: program)
        }
        .buttonStyle(.plain)

        if let next = program.nextWorkout {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Up next").font(.headline)
                    Spacer()
                    Menu {
                        Button("Skip this workout", systemImage: "forward.end") { next.skipped = true }
                    } label: {
                        Image(systemName: "ellipsis.circle").font(.title3)
                    }
                }
                NavigationLink(value: next) { NextWorkoutCard(day: next) }
                    .buttonStyle(.plain)
            }
        } else {
            ProgramCompleteCard(program: program) {
                router.openBuilder(prefill: nextBlockRequest(after: program))
            }
        }

        if let week = program.currentWeek {
            VStack(alignment: .leading, spacing: 10) {
                Text("Week \(week.number) · \(week.focus)").font(.headline)
                VStack(spacing: 0) {
                    ForEach(week.sortedDays) { day in
                        NavigationLink(value: day) {
                            DayRow(day: day).padding(.horizontal).padding(.vertical, 10)
                        }
                        .buttonStyle(.plain)
                        if day.id != week.sortedDays.last?.id { Divider().padding(.leading) }
                    }
                }
                .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
            }
        }
    }

    /// Prefills the AI builder to continue from a finished program, carrying over maxes.
    private func nextBlockRequest(after program: TrainingProgram) -> PlanRequest {
        let history = TrainingHistory.load(from: context)
        var request = PlanRequest()
        request.preset = nil
        request.customGoal = program.goal
        request.weeks = max(program.weeks.count, 4)
        request.daysPerWeek = min(max(program.daysPerWeek, 2), 6)
        let maxes = history.records.prefix(6)
            .map { "\($0.name) ~\(Strength.format(Strength.round($0.e1rm, unit: weightUnit))) \(weightUnit)" }
            .joined(separator: ", ")
        request.notes = "This is my next training block after finishing \"\(program.name)\". "
            + (maxes.isEmpty ? "" : "My current estimated 1RMs: \(maxes). ")
            + "Progress from where I left off and vary the exercises a little to avoid staleness."
        return request
    }
}

// MARK: - Cards

struct StatsStrip: View {
    let completed: [WorkoutDay]

    private var thisWeek: Int {
        let start = Calendar.current.dateInterval(of: .weekOfYear, for: Date())?.start ?? Date()
        return completed.filter { ($0.completedAt ?? .distantPast) >= start }.count
    }

    /// Consecutive calendar weeks (including this one, if trained) with at least one workout.
    private var weekStreak: Int {
        let cal = Calendar.current
        let weeks = Set(completed.compactMap { day -> Date? in
            guard let date = day.completedAt else { return nil }
            return cal.dateInterval(of: .weekOfYear, for: date)?.start
        })
        guard var cursor = cal.dateInterval(of: .weekOfYear, for: Date())?.start else { return 0 }
        if !weeks.contains(cursor) { cursor = cal.date(byAdding: .weekOfYear, value: -1, to: cursor) ?? cursor }
        var streak = 0
        while weeks.contains(cursor) {
            streak += 1
            cursor = cal.date(byAdding: .weekOfYear, value: -1, to: cursor) ?? cursor
        }
        return streak
    }

    var body: some View {
        HStack(spacing: 10) {
            StatTile(value: "\(thisWeek)", label: "This week", icon: "calendar")
            StatTile(value: "\(weekStreak)", label: "Week streak", icon: "flame.fill")
            StatTile(value: "\(completed.count)", label: "Workouts", icon: "dumbbell.fill")
        }
    }
}

struct StatTile: View {
    let value: String
    let label: String
    let icon: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Image(systemName: icon).font(.caption).foregroundStyle(Color.accentColor)
            Text(value).font(.title2.bold().monospacedDigit())
            Text(label).font(.caption).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 14))
    }
}

struct EmptyProgramCard: View {
    var onBuildPlan: () -> Void
    var onBrowse: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "sparkles").font(.system(size: 48)).foregroundStyle(Color.accentColor)
            Text("Let's build your program").font(.title2.bold())
            Text("Have the AI coach design a plan for your goal, or start a proven program from the library.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Button(action: onBuildPlan) {
                Label("Build with AI", systemImage: "wand.and.stars").frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.borderedProminent)
            Button(action: onBrowse) {
                Label("Browse program library", systemImage: "books.vertical").frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.bordered)
        }
        .padding(24)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 20))
    }
}

struct ProgramCompleteCard: View {
    let program: TrainingProgram
    var onNextBlock: () -> Void

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "trophy.fill").font(.system(size: 44)).foregroundStyle(.yellow)
            Text("Program complete!").font(.title2.bold())
            Text("You finished \(program.completedCount) workouts. Let the AI coach build your next block from your new numbers.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Button(action: onNextBlock) {
                Label("Build my next block", systemImage: "arrow.triangle.2.circlepath")
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity)
        .padding(24)
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 20))
    }
}

struct ProgramProgressCard: View {
    let program: TrainingProgram

    var body: some View {
        HStack(spacing: 16) {
            ZStack {
                Circle().stroke(Color.accentColor.opacity(0.15), lineWidth: 10)
                Circle()
                    .trim(from: 0, to: program.progress)
                    .stroke(Color.accentColor, style: StrokeStyle(lineWidth: 10, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                Text("\(Int(program.progress * 100))%").font(.headline.monospacedDigit())
            }
            .frame(width: 72, height: 72)

            VStack(alignment: .leading, spacing: 4) {
                Text(program.name).font(.title3.bold()).lineLimit(2)
                Text(program.goal).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
                Text("Week \(program.currentWeek?.number ?? 1) of \(program.weeks.count) · \(program.completedCount)/\(program.totalCount) workouts")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
            Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
        }
        .padding()
        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 20))
    }
}

struct NextWorkoutCard: View {
    let day: WorkoutDay

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(day.scheduleLabel.uppercased())
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.white.opacity(0.85))
                Spacer()
                Label("\(day.estimatedMinutes) min", systemImage: "clock")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.85))
            }
            Text(day.title).font(.title2.bold()).foregroundStyle(.white)
            if !day.focus.isEmpty {
                Text(day.focus).font(.subheadline).foregroundStyle(.white.opacity(0.9))
            }
            VStack(alignment: .leading, spacing: 4) {
                ForEach(day.sortedExercises.prefix(5)) { ex in
                    Text("• \(ex.name)  \(ex.sets)×\(ex.reps)")
                        .font(.footnote)
                        .foregroundStyle(.white.opacity(0.9))
                        .lineLimit(1)
                }
                if day.exercises.count > 5 {
                    Text("+ \(day.exercises.count - 5) more").font(.footnote).foregroundStyle(.white.opacity(0.7))
                }
            }
            HStack {
                Spacer()
                Label(day.startedAt == nil ? "Start Workout" : "Resume Workout", systemImage: "play.fill")
                    .font(.headline)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 10)
                    .background(.white, in: Capsule())
                    .foregroundStyle(Color.accentColor)
            }
        }
        .padding(20)
        .background(
            LinearGradient(colors: [Color.accentColor, Color.accentColor.opacity(0.7)],
                           startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 22)
        )
    }
}

struct DayRow: View {
    let day: WorkoutDay

    private var icon: (String, Color) {
        if day.isCompleted { return ("checkmark.circle.fill", .green) }
        if day.skipped { return ("forward.end.circle.fill", .orange) }
        if day.startedAt != nil { return ("circle.lefthalf.filled", .accentColor) }
        return ("circle", .secondary)
    }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon.0).font(.title3).foregroundStyle(icon.1)
            VStack(alignment: .leading, spacing: 2) {
                Text(day.title).font(.body.weight(.medium))
                Text("\(day.weekdayName) · \(day.exercises.count) exercises · \(day.estimatedMinutes) min\(day.skipped ? " · skipped" : "")")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            if day.prCount > 0 {
                Label("\(day.prCount)", systemImage: "trophy.fill").font(.caption).foregroundStyle(.yellow)
            }
            Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
        }
        .contentShape(Rectangle())
    }
}
