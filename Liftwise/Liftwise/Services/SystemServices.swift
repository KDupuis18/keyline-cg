import Foundation
import UserNotifications
import HealthKit

// MARK: - Reminders

enum ReminderScheduler {
    private static let workoutPrefix = "workout-reminder-"
    private static let restID = "rest-timer"

    static func requestAuthorization() async -> Bool {
        (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge])) ?? false
    }

    /// Schedules weekly reminders on the active program's training weekdays.
    @MainActor
    static func scheduleWorkoutReminders(for program: TrainingProgram?, hour: Int, minute: Int, enabled: Bool) {
        let center = UNUserNotificationCenter.current()
        let ids = (1...7).map { "\(workoutPrefix)\($0)" }
        center.removePendingNotificationRequests(withIdentifiers: ids)
        guard enabled, let program, let week = program.currentWeek else { return }

        for day in week.sortedDays {
            let content = UNMutableNotificationContent()
            content.title = "Time to train 💪"
            content.body = "\(day.title) is on the plan today. Tap to start your workout."
            content.sound = .default

            var components = DateComponents()
            // Calendar weekday: 1 = Sunday ... 7 = Saturday. Ours: 1 = Monday ... 7 = Sunday.
            components.weekday = day.dayOfWeek % 7 + 1
            components.hour = hour
            components.minute = minute
            let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)
            center.add(UNNotificationRequest(identifier: "\(workoutPrefix)\(day.dayOfWeek)", content: content, trigger: trigger))
        }
    }

    /// Notifies when rest is over, in case the app is in the background.
    static func scheduleRestEnd(after seconds: Int) {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [restID])
        guard seconds > 0 else { return }
        let content = UNMutableNotificationContent()
        content.title = "Rest's over"
        content.body = "Time for your next set."
        content.sound = .default
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: TimeInterval(seconds), repeats: false)
        center.add(UNNotificationRequest(identifier: restID, content: content, trigger: trigger))
    }

    static func cancelRest() {
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [restID])
    }
}

// MARK: - Apple Health

enum HealthSync {
    private static let store = HKHealthStore()

    static var isAvailable: Bool { HKHealthStore.isHealthDataAvailable() }

    static func requestAuthorization() async -> Bool {
        guard isAvailable, let bodyMass = HKObjectType.quantityType(forIdentifier: .bodyMass) else { return false }
        do {
            try await store.requestAuthorization(toShare: [HKObjectType.workoutType(), bodyMass], read: [bodyMass])
            return true
        } catch {
            return false
        }
    }

    /// Saves a finished strength workout to Apple Health.
    static func saveWorkout(start: Date, end: Date) async {
        guard isAvailable else { return }
        let config = HKWorkoutConfiguration()
        config.activityType = .traditionalStrengthTraining
        let builder = HKWorkoutBuilder(healthStore: store, configuration: config, device: .local())
        do {
            try await builder.beginCollection(at: start)
            try await builder.endCollection(at: end)
            _ = try await builder.finishWorkout()
        } catch {
            // Not authorized or Health unavailable; ignore silently.
        }
    }

    static func saveBodyWeight(_ weight: Double, unit: String, date: Date) async {
        guard isAvailable, let type = HKQuantityType.quantityType(forIdentifier: .bodyMass) else { return }
        let hkUnit: HKUnit = unit == "kg" ? .gramUnit(with: .kilo) : .pound()
        let sample = HKQuantitySample(type: type, quantity: HKQuantity(unit: hkUnit, doubleValue: weight), start: date, end: date)
        try? await store.save(sample)
    }
}

// MARK: - CSV export

enum DataExport {
    @MainActor
    static func csv(programs: [TrainingProgram], unit: String) -> String {
        var rows = ["date,program,week,workout,exercise,set,weight_\(unit),reps,rpe,e1rm_\(unit),pr"]
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        for program in programs {
            for day in program.allDays where day.isCompleted {
                let date = formatter.string(from: day.completedAt ?? Date())
                for exercise in day.sortedExercises {
                    for log in exercise.sortedLogs where log.completed {
                        let fields: [String] = [
                            date, program.name, "\(day.week?.number ?? 0)", day.title, exercise.name,
                            "\(log.setNumber)", Strength.format(log.weight), "\(log.reps)",
                            log.rpe > 0 ? Strength.format(log.rpe) : "",
                            Strength.format(log.estimatedOneRepMax.rounded()), log.isPR ? "yes" : "",
                        ]
                        rows.append(fields.map(escape).joined(separator: ","))
                    }
                }
            }
        }
        return rows.joined(separator: "\n")
    }

    private static func escape(_ field: String) -> String {
        guard field.contains(",") || field.contains("\"") || field.contains("\n") else { return field }
        return "\"" + field.replacingOccurrences(of: "\"", with: "\"\"") + "\""
    }

    static func writeTemporaryFile(_ text: String) -> URL? {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("liftwise-workouts.csv")
        do {
            try text.write(to: url, atomically: true, encoding: .utf8)
            return url
        } catch {
            return nil
        }
    }
}
