import SwiftUI
import SwiftData

@main
struct LiftwiseApp: App {
    @StateObject private var router = AppRouter()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(router)
        }
        .modelContainer(for: [
            TrainingProgram.self,
            ProgramWeek.self,
            WorkoutDay.self,
            PlannedExercise.self,
            SetLog.self,
            BodyWeightEntry.self,
            CoachMessage.self,
        ])
    }
}

enum AppTab: Hashable {
    case today, programs, coach, progress, settings
}

/// App-wide navigation state, so screens can jump between tabs
/// (e.g. "Build next block" on Today opens the AI builder, prefilled).
@MainActor
final class AppRouter: ObservableObject {
    @Published var tab: AppTab = .today
    @Published var builderPrefill: PlanRequest?
    @Published var showBuilder = false

    func openBuilder(prefill: PlanRequest? = nil) {
        builderPrefill = prefill
        tab = .coach
        showBuilder = true
    }
}

struct RootView: View {
    @EnvironmentObject private var router: AppRouter
    @Environment(\.modelContext) private var context
    @Query private var programs: [TrainingProgram]

    @AppStorage("remindersEnabled") private var remindersEnabled = false
    @AppStorage("reminderHour") private var reminderHour = 17
    @AppStorage("reminderMinute") private var reminderMinute = 30

    var body: some View {
        TabView(selection: $router.tab) {
            TodayView()
                .tabItem { Label("Today", systemImage: "flame.fill") }
                .tag(AppTab.today)

            ProgramsView()
                .tabItem { Label("Programs", systemImage: "list.bullet.rectangle.portrait") }
                .tag(AppTab.programs)

            CoachView()
                .tabItem { Label("Coach", systemImage: "sparkles") }
                .tag(AppTab.coach)

            ProgressDashboardView()
                .tabItem { Label("Progress", systemImage: "chart.line.uptrend.xyaxis") }
                .tag(AppTab.progress)

            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
                .tag(AppTab.settings)
        }
        .onAppear(perform: refreshReminders)
        .onChange(of: programs.first(where: \.isActive)?.currentWeek?.number) { refreshReminders() }
    }

    /// Keeps training-day reminders in sync with the active program's schedule.
    private func refreshReminders() {
        ReminderScheduler.scheduleWorkoutReminders(
            for: programs.first(where: \.isActive),
            hour: reminderHour, minute: reminderMinute, enabled: remindersEnabled
        )
    }
}
