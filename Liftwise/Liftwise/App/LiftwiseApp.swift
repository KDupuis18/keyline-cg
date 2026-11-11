import SwiftUI
import SwiftData

@main
struct LiftwiseApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
        }
        .modelContainer(for: [
            TrainingProgram.self,
            ProgramWeek.self,
            WorkoutDay.self,
            PlannedExercise.self,
            SetLog.self,
        ])
    }
}

enum AppTab: Hashable {
    case today, programs, builder, settings
}

struct RootView: View {
    @State private var tab: AppTab = .today

    var body: some View {
        TabView(selection: $tab) {
            TodayView(onBuildPlan: { tab = .builder })
                .tabItem { Label("Today", systemImage: "flame.fill") }
                .tag(AppTab.today)

            ProgramsView(onBuildPlan: { tab = .builder })
                .tabItem { Label("Programs", systemImage: "list.bullet.rectangle.portrait") }
                .tag(AppTab.programs)

            PlanBuilderView()
                .tabItem { Label("AI Builder", systemImage: "sparkles") }
                .tag(AppTab.builder)

            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
                .tag(AppTab.settings)
        }
    }
}
