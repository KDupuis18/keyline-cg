import SwiftUI
import SwiftData

struct TodayView: View {
    var onBuildPlan: () -> Void

    @Query(filter: #Predicate<TrainingProgram> { $0.isActive == true })
    private var activePrograms: [TrainingProgram]

    var body: some View {
        NavigationStack {
            ScrollView {
                if let program = activePrograms.first {
                    activeContent(program)
                } else {
                    EmptyProgramCard(onBuildPlan: onBuildPlan)
                        .padding()
                }
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Today")
            .navigationDestination(for: WorkoutDay.self) { day in
                WorkoutSessionView(day: day)
            }
        }
    }

    @ViewBuilder
    private func activeContent(_ program: TrainingProgram) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            ProgramProgressCard(program: program)

            if let next = program.nextWorkout {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Up next").font(.headline)
                    NavigationLink(value: next) {
                        NextWorkoutCard(day: next)
                    }
                    .buttonStyle(.plain)
                }
            } else {
                VStack(spacing: 12) {
                    Image(systemName: "trophy.fill").font(.system(size: 44)).foregroundStyle(.yellow)
                    Text("Program complete!").font(.title2.bold())
                    Text("Amazing work. Build your next block to keep progressing.")
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.secondary)
                    Button("Build a new program", action: onBuildPlan)
                        .buttonStyle(.borderedProminent)
                }
                .frame(maxWidth: .infinity)
                .padding(24)
                .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 20))
            }

            if let week = program.currentWeek {
                VStack(alignment: .leading, spacing: 10) {
                    Text("This week · \(week.focus)").font(.headline)
                    VStack(spacing: 0) {
                        ForEach(week.sortedDays) { day in
                            NavigationLink(value: day) {
                                DayRow(day: day)
                                    .padding(.horizontal)
                                    .padding(.vertical, 10)
                            }
                            .buttonStyle(.plain)
                            if day.id != week.sortedDays.last?.id { Divider().padding(.leading) }
                        }
                    }
                    .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
                }
            }
        }
        .padding()
    }
}

struct EmptyProgramCard: View {
    var onBuildPlan: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "sparkles")
                .font(.system(size: 48))
                .foregroundStyle(Color.accentColor)
            Text("Let's build your program")
                .font(.title2.bold())
            Text("Tell the AI coach what you want to work on and get a personalized multi-week plan in minutes.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Button(action: onBuildPlan) {
                Label("Open AI Builder", systemImage: "wand.and.stars")
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.borderedProminent)
        }
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
                Text("\(Int(program.progress * 100))%")
                    .font(.headline.monospacedDigit())
            }
            .frame(width: 72, height: 72)

            VStack(alignment: .leading, spacing: 4) {
                Text(program.name).font(.title3.bold()).lineLimit(2)
                Text(program.goal).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
                Text("\(program.completedCount) of \(program.totalCount) workouts · \(program.weeks.count) weeks")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
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
                ForEach(day.sortedExercises.prefix(4)) { ex in
                    Text("• \(ex.name)  \(ex.sets)×\(ex.reps)")
                        .font(.footnote)
                        .foregroundStyle(.white.opacity(0.9))
                        .lineLimit(1)
                }
                if day.exercises.count > 4 {
                    Text("+ \(day.exercises.count - 4) more").font(.footnote).foregroundStyle(.white.opacity(0.7))
                }
            }
            HStack {
                Spacer()
                Label("Start Workout", systemImage: "play.fill")
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

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: day.isCompleted ? "checkmark.circle.fill" : "circle")
                .font(.title3)
                .foregroundStyle(day.isCompleted ? Color.green : Color.secondary)
            VStack(alignment: .leading, spacing: 2) {
                Text(day.title).font(.body.weight(.medium))
                Text("\(day.weekdayName) · \(day.exercises.count) exercises · \(day.estimatedMinutes) min")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "chevron.right").font(.caption).foregroundStyle(.tertiary)
        }
        .contentShape(Rectangle())
    }
}
