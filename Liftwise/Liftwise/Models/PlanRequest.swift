import Foundation

enum GoalPreset: String, CaseIterable, Identifiable {
    case buildMuscle = "Build Muscle"
    case getStronger = "Get Stronger"
    case loseFat = "Lose Fat"
    case jumpHigher = "Jump Higher"
    case runFaster = "Run Faster"
    case athletic = "Athletic Performance"
    case general = "General Fitness"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .buildMuscle: "figure.strengthtraining.traditional"
        case .getStronger: "scalemass.fill"
        case .loseFat: "flame.fill"
        case .jumpHigher: "figure.jumprope"
        case .runFaster: "figure.run"
        case .athletic: "figure.basketball"
        case .general: "heart.fill"
        }
    }

    var style: TrainingStyle {
        switch self {
        case .buildMuscle: .hypertrophy
        case .getStronger: .strength
        case .loseFat: .fatLoss
        case .jumpHigher, .athletic: .athletic
        case .runFaster: .endurance
        case .general: .general
        }
    }
}

enum TrainingStyle {
    case strength, hypertrophy, fatLoss, athletic, endurance, general
}

enum FocusArea: String, CaseIterable, Identifiable {
    case chest = "Chest", back = "Back", shoulders = "Shoulders", arms = "Arms"
    case legs = "Legs", glutes = "Glutes", core = "Core"
    case conditioning = "Conditioning", mobility = "Mobility"
    var id: String { rawValue }
}

enum Experience: String, CaseIterable, Identifiable {
    case beginner = "Beginner", intermediate = "Intermediate", advanced = "Advanced"
    var id: String { rawValue }
    var detail: String {
        switch self {
        case .beginner: "Less than 1 year of consistent training"
        case .intermediate: "1–3 years of consistent training"
        case .advanced: "3+ years, comfortable with heavy compound lifts"
        }
    }
}

enum Equipment: String, CaseIterable, Identifiable {
    case fullGym = "Full gym"
    case dumbbells = "Dumbbells + bench"
    case kettlebells = "Kettlebells & bands"
    case bodyweight = "Bodyweight only"
    var id: String { rawValue }
}

struct PlanRequest {
    var preset: GoalPreset? = .buildMuscle
    var customGoal: String = ""
    var focusAreas: Set<FocusArea> = []
    var experience: Experience = .intermediate
    var weeks: Int = 8
    var daysPerWeek: Int = 4
    var sessionMinutes: Int = 60
    var equipment: Equipment = .fullGym
    var limitations: String = ""
    var notes: String = ""

    var goalDescription: String {
        let custom = customGoal.trimmingCharacters(in: .whitespacesAndNewlines)
        switch (preset, custom.isEmpty) {
        case (let p?, true): return p.rawValue
        case (let p?, false): return "\(p.rawValue): \(custom)"
        case (nil, false): return custom
        case (nil, true): return GoalPreset.general.rawValue
        }
    }

    /// Best-effort style for the offline builder.
    var style: TrainingStyle {
        if let preset { return preset.style }
        let text = customGoal.lowercased()
        if text.contains("jump") || text.contains("sport") || text.contains("speed") || text.contains("explosive") { return .athletic }
        if text.contains("run") || text.contains("5k") || text.contains("marathon") || text.contains("endurance") { return .endurance }
        if text.contains("strong") || text.contains("powerlift") || text.contains("1rm") { return .strength }
        if text.contains("fat") || text.contains("weight loss") || text.contains("lean") || text.contains("cut") { return .fatLoss }
        if text.contains("muscle") || text.contains("size") || text.contains("bulk") || text.contains("hypertrophy") { return .hypertrophy }
        return .general
    }
}
