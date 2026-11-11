import SwiftUI
import SwiftData
import Charts

struct ProgressDashboardView: View {
    @Environment(\.modelContext) private var context
    @Query private var programs: [TrainingProgram]
    @Query(sort: \BodyWeightEntry.date) private var bodyWeights: [BodyWeightEntry]
    @Query(filter: #Predicate<SetLog> { $0.completed == true }) private var completedLogs: [SetLog]
    @AppStorage("weightUnit") private var weightUnit = "lb"

    @State private var selectedLift: String?

    private var history: TrainingHistory { TrainingHistory(logs: completedLogs) }

    private var completedDays: [WorkoutDay] {
        programs.flatMap(\.allDays)
            .filter(\.isCompleted)
            .sorted { ($0.completedAt ?? .distantPast) > ($1.completedAt ?? .distantPast) }
    }

    struct WeekPoint: Identifiable {
        let week: Date
        let volume: Double
        let workouts: Int
        var id: Date { week }
    }

    private var weeklyPoints: [WeekPoint] {
        let cal = Calendar.current
        guard let thisWeek = cal.dateInterval(of: .weekOfYear, for: Date())?.start else { return [] }
        return (0..<8).reversed().compactMap { offset -> WeekPoint? in
            guard let start = cal.date(byAdding: .weekOfYear, value: -offset, to: thisWeek),
                  let end = cal.date(byAdding: .weekOfYear, value: 1, to: start) else { return nil }
            let days = completedDays.filter { ($0.completedAt ?? .distantPast) >= start && ($0.completedAt ?? .distantPast) < end }
            return WeekPoint(week: start, volume: days.reduce(0) { $0 + $1.volume }, workouts: days.count)
        }
    }

    var body: some View {
        NavigationStack {
            List {
                overviewSection
                weeklySection
                strengthSection
                recordsSection
                bodyWeightSection
                historySection
                toolsSection
            }
            .navigationTitle("Progress")
            .navigationDestination(for: WorkoutDay.self) { WorkoutSummaryView(day: $0, isFresh: false) }
        }
    }

    // MARK: Sections

    private var overviewSection: some View {
        Section {
            HStack {
                StatTile(value: "\(completedDays.count)", label: "Workouts", icon: "dumbbell.fill")
                StatTile(value: "\(completedLogs.count)", label: "Sets logged", icon: "checklist")
                StatTile(value: compact(completedDays.reduce(0) { $0 + $1.volume }), label: "Total \(weightUnit)", icon: "scalemass.fill")
            }
            .listRowBackground(Color.clear)
            .listRowInsets(EdgeInsets())
        }
    }

    private var weeklySection: some View {
        Section("Weekly volume (\(weightUnit))") {
            if completedDays.isEmpty {
                Text("Finish a workout to start tracking.").foregroundStyle(.secondary)
            } else {
                Chart(weeklyPoints) { point in
                    BarMark(x: .value("Week", point.week, unit: .weekOfYear), y: .value("Volume", point.volume))
                        .foregroundStyle(Color.accentColor.gradient)
                        .cornerRadius(4)
                }
                .chartXAxis {
                    AxisMarks(values: .stride(by: .weekOfYear, count: 2)) { _ in
                        AxisValueLabel(format: .dateTime.month(.abbreviated).day())
                    }
                }
                .frame(height: 160)
                .padding(.vertical, 6)
            }
        }
    }

    private var strengthSection: some View {
        let lifts = history.records.map(\.name)
        let lift = selectedLift ?? lifts.first
        return Section("Strength trend") {
            if let lift {
                Picker("Exercise", selection: Binding(get: { lift }, set: { selectedLift = $0 })) {
                    ForEach(lifts, id: \.self) { Text($0).tag($0) }
                }
                E1RMChart(sessions: history.sessions(for: lift), unit: weightUnit)
                    .frame(height: 180)
                    .padding(.vertical, 6)
            } else {
                Text("Your estimated 1RM trends appear here once you log weighted sets.").foregroundStyle(.secondary)
            }
        }
    }

    private var recordsSection: some View {
        Section("Personal records") {
            let records = history.records
            if records.isEmpty {
                Text("No records yet. They're detected automatically as you lift.").foregroundStyle(.secondary)
            }
            ForEach(records.prefix(10)) { record in
                NavigationLink {
                    ExerciseDetailView(name: record.name)
                } label: {
                    HStack {
                        VStack(alignment: .leading) {
                            Text(record.name).font(.subheadline.weight(.medium))
                            Text("\(Strength.format(record.weight))×\(record.reps) · \(record.date.formatted(date: .abbreviated, time: .omitted))")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text("\(Strength.format(record.e1rm.rounded())) \(weightUnit)")
                            .font(.subheadline.monospacedDigit().weight(.semibold))
                    }
                }
            }
            if records.count > 10 {
                NavigationLink("All exercises") { ExerciseLibraryView() }
            }
        }
    }

    private var bodyWeightSection: some View {
        Section("Body weight") {
            if bodyWeights.count >= 2 {
                Chart(bodyWeights) { entry in
                    LineMark(x: .value("Date", entry.date), y: .value("Weight", entry.weight))
                        .interpolationMethod(.catmullRom)
                    PointMark(x: .value("Date", entry.date), y: .value("Weight", entry.weight))
                        .symbolSize(20)
                }
                .chartYScale(domain: .automatic(includesZero: false))
                .frame(height: 150)
                .padding(.vertical, 6)
            }
            if let latest = bodyWeights.last {
                LabeledContent("Latest", value: "\(Strength.format(latest.weight)) \(weightUnit)")
            }
            NavigationLink("Log & view body weight") { BodyWeightView() }
        }
    }

    private var historySection: some View {
        Section("History") {
            if completedDays.isEmpty {
                Text("Completed workouts show up here.").foregroundStyle(.secondary)
            }
            ForEach(completedDays.prefix(15)) { day in
                NavigationLink(value: day) {
                    VStack(alignment: .leading, spacing: 2) {
                        HStack {
                            Text(day.title).font(.subheadline.weight(.medium))
                            if day.prCount > 0 {
                                Label("\(day.prCount)", systemImage: "trophy.fill").font(.caption).foregroundStyle(.yellow)
                            }
                        }
                        Text("\(day.completedAt?.formatted(date: .abbreviated, time: .omitted) ?? "") · \(day.completedSets.count) sets · \(compact(day.volume)) \(weightUnit)")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
        }
    }

    private var toolsSection: some View {
        Section("Tools") {
            NavigationLink { ExerciseLibraryView() } label: { Label("Exercise library", systemImage: "books.vertical") }
            NavigationLink { PlateCalculatorView() } label: { Label("Plate calculator", systemImage: "circle.grid.2x1") }
            NavigationLink { OneRepMaxCalculatorView() } label: { Label("1RM calculator", systemImage: "function") }
        }
    }

    private func compact(_ value: Double) -> String {
        value >= 10_000 ? String(format: "%.1fk", value / 1000) : Strength.format(value.rounded())
    }
}

struct E1RMChart: View {
    let sessions: [ExerciseSession]
    let unit: String

    var body: some View {
        Chart(Array(sessions.enumerated()), id: \.offset) { _, session in
            LineMark(x: .value("Date", session.date), y: .value("e1RM", session.bestE1RM))
                .interpolationMethod(.catmullRom)
            PointMark(x: .value("Date", session.date), y: .value("e1RM", session.bestE1RM))
                .symbolSize(24)
        }
        .chartYScale(domain: .automatic(includesZero: false))
        .chartYAxisLabel("Est. 1RM (\(unit))")
    }
}

// MARK: - Exercise library

struct ExerciseLibraryView: View {
    @State private var search = ""
    @State private var muscle: MuscleGroup?

    private var results: [ExerciseInfo] {
        ExerciseCatalog.all.filter {
            (muscle == nil || $0.primary == muscle) && (search.isEmpty || $0.name.localizedCaseInsensitiveContains(search))
        }
    }

    var body: some View {
        List {
            Picker("Muscle", selection: $muscle) {
                Text("All muscles").tag(MuscleGroup?.none)
                ForEach(MuscleGroup.allCases) { Text($0.rawValue).tag(MuscleGroup?.some($0)) }
            }
            ForEach(results) { info in
                NavigationLink {
                    ExerciseDetailView(name: info.name)
                } label: {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(info.name)
                        Text("\(info.primary.rawValue) · \(info.gear.rawValue)").font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
        }
        .searchable(text: $search)
        .navigationTitle("Exercises")
    }
}

struct ExerciseDetailView: View {
    let name: String
    @Query(filter: #Predicate<SetLog> { $0.completed == true }) private var completedLogs: [SetLog]
    @AppStorage("weightUnit") private var weightUnit = "lb"

    private var info: ExerciseInfo? { ExerciseCatalog.info(named: name) }
    private var sessions: [ExerciseSession] { TrainingHistory(logs: completedLogs).sessions(for: name) }

    var body: some View {
        List {
            if let info {
                Section {
                    LabeledContent("Primary", value: info.primary.rawValue)
                    if !info.secondary.isEmpty {
                        LabeledContent("Also works", value: info.secondary.map(\.rawValue).joined(separator: ", "))
                    }
                    LabeledContent("Equipment", value: info.gear.rawValue)
                }
                Section("How to do it") {
                    ForEach(Array(info.cues.enumerated()), id: \.offset) { i, cue in
                        Label(cue, systemImage: "\(i + 1).circle.fill")
                    }
                }
            }

            Section("Your stats") {
                if sessions.isEmpty {
                    Text("No logged sets yet.").foregroundStyle(.secondary)
                } else {
                    let best = sessions.max { $0.bestE1RM < $1.bestE1RM }
                    LabeledContent("Best est. 1RM", value: "\(Strength.format((best?.bestE1RM ?? 0).rounded())) \(weightUnit)")
                    if let top = best?.topSet {
                        LabeledContent("Best set", value: "\(Strength.format(top.weight))×\(top.reps)")
                    }
                    LabeledContent("Sessions", value: "\(sessions.count)")
                    if sessions.count >= 2 {
                        E1RMChart(sessions: sessions, unit: weightUnit).frame(height: 180).padding(.vertical, 6)
                    }
                }
            }

            if !sessions.isEmpty {
                Section("History") {
                    ForEach(Array(sessions.reversed().enumerated()), id: \.offset) { _, session in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(session.date.formatted(date: .abbreviated, time: .omitted)).font(.caption.weight(.semibold))
                            Text(session.sets.map { "\(Strength.format($0.weight))×\($0.reps)" }.joined(separator: ", "))
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .navigationTitle(name)
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Tools

struct PlateCalculatorView: View {
    @AppStorage("weightUnit") private var weightUnit = "lb"
    @AppStorage("barWeight") private var barWeight: Double = 0
    @State private var target: Double = 135

    private var bar: Double { barWeight > 0 ? barWeight : Strength.defaultBar(unit: weightUnit) }

    var body: some View {
        let result = Strength.plateBreakdown(target: target, bar: bar, unit: weightUnit)
        Form {
            Section {
                LabeledContent("Target weight") {
                    TextField("Weight", value: $target, format: .number)
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.trailing)
                }
                LabeledContent("Bar", value: "\(Strength.format(bar)) \(weightUnit)")
            }
            Section("Each side") {
                if result.plates.isEmpty {
                    Text("Just the bar").foregroundStyle(.secondary)
                } else {
                    HStack(alignment: .center, spacing: 4) {
                        ForEach(Array(result.plates.enumerated()), id: \.offset) { _, plate in
                            RoundedRectangle(cornerRadius: 3)
                                .fill(Color.accentColor.opacity(0.4 + min(plate / 50, 0.6)))
                                .frame(width: 14, height: 40 + plate * 1.4)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                    Text(result.plates.map(Strength.format).joined(separator: " + ") + " \(weightUnit)")
                        .font(.headline)
                }
                if result.remainder > 0.01 {
                    Text("Can't make exactly \(Strength.format(target)); \(Strength.format(result.remainder)) \(weightUnit) short.")
                        .font(.caption).foregroundStyle(.orange)
                }
            }
        }
        .navigationTitle("Plate Calculator")
    }
}

struct OneRepMaxCalculatorView: View {
    @AppStorage("weightUnit") private var weightUnit = "lb"
    @State private var weight: Double = 185
    @State private var reps = 5

    var body: some View {
        let max = Strength.estimatedOneRepMax(weight: weight, reps: reps)
        Form {
            Section {
                LabeledContent("Weight") {
                    TextField("Weight", value: $weight, format: .number)
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.trailing)
                }
                Stepper("Reps: \(reps)", value: $reps, in: 1...15)
            }
            Section("Estimated 1RM") {
                Text("\(Strength.format(max.rounded())) \(weightUnit)").font(.largeTitle.bold())
            }
            Section("Training percentages") {
                ForEach([95, 90, 85, 80, 75, 70, 65, 60], id: \.self) { pct in
                    LabeledContent("\(pct)%", value: "\(Strength.format(Strength.round(max * Double(pct) / 100, unit: weightUnit))) \(weightUnit)")
                }
            }
        }
        .navigationTitle("1RM Calculator")
    }
}

// MARK: - Body weight

struct BodyWeightView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \BodyWeightEntry.date, order: .reverse) private var entries: [BodyWeightEntry]
    @AppStorage("weightUnit") private var weightUnit = "lb"
    @AppStorage("healthSync") private var healthSync = false
    @State private var newWeight: Double?
    @State private var date = Date()

    var body: some View {
        List {
            Section("New entry") {
                LabeledContent("Weight (\(weightUnit))") {
                    TextField("0", value: $newWeight, format: .number)
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.trailing)
                }
                DatePicker("Date", selection: $date, displayedComponents: .date)
                Button("Save") {
                    guard let w = newWeight, w > 0 else { return }
                    context.insert(BodyWeightEntry(date: date, weight: w))
                    if healthSync { Task { await HealthSync.saveBodyWeight(w, unit: weightUnit, date: date) } }
                    newWeight = nil
                }
                .disabled((newWeight ?? 0) <= 0)
            }
            Section("Entries") {
                ForEach(entries) { entry in
                    LabeledContent(entry.date.formatted(date: .abbreviated, time: .omitted),
                                   value: "\(Strength.format(entry.weight)) \(weightUnit)")
                }
                .onDelete { offsets in offsets.forEach { context.delete(entries[$0]) } }
            }
        }
        .navigationTitle("Body Weight")
    }
}
