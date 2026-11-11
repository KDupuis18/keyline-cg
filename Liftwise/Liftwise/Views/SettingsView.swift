import SwiftUI
import SwiftData

enum ClaudeModelOption: String, CaseIterable, Identifiable {
    case opus = "claude-opus-5-5"
    case sonnet = "claude-sonnet-5-5"
    case haiku = "claude-haiku-5-5"

    static let defaultModel = ClaudeModelOption.opus.rawValue

    var id: String { rawValue }

    var title: String {
        switch self {
        case .opus: "Claude Opus 5.5 (best plans)"
        case .sonnet: "Claude Sonnet 5.5 (faster)"
        case .haiku: "Claude Haiku 5.5 (fastest, cheapest)"
        }
    }
}

struct SettingsView: View {
    @Query private var programs: [TrainingProgram]

    @AppStorage("weightUnit") private var weightUnit = "lb"
    @AppStorage("claudeModel") private var claudeModel = ClaudeModelOption.defaultModel
    @AppStorage("autoProgression") private var autoProgression = true
    @AppStorage("barWeight") private var barWeight: Double = 0
    @AppStorage("remindersEnabled") private var remindersEnabled = false
    @AppStorage("reminderHour") private var reminderHour = 17
    @AppStorage("reminderMinute") private var reminderMinute = 30
    @AppStorage("healthSync") private var healthSync = false

    @State private var apiKey = ""
    @State private var savedKey = KeychainStore.loadAPIKey()
    @State private var showSaved = false
    @State private var exportURL: URL?

    private var reminderTime: Binding<Date> {
        Binding {
            Calendar.current.date(bySettingHour: reminderHour, minute: reminderMinute, second: 0, of: Date()) ?? Date()
        } set: { date in
            let c = Calendar.current.dateComponents([.hour, .minute], from: date)
            reminderHour = c.hour ?? 17
            reminderMinute = c.minute ?? 30
            rescheduleReminders()
        }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Training") {
                    Picker("Weight unit", selection: $weightUnit) {
                        Text("Pounds (lb)").tag("lb")
                        Text("Kilograms (kg)").tag("kg")
                    }
                    Toggle(isOn: $autoProgression) {
                        VStack(alignment: .leading) {
                            Text("Auto-progression")
                            Text("Suggests each session's weights from your last performance, RPE and % of max.")
                                .font(.caption).foregroundStyle(.secondary)
                        }
                    }
                    LabeledContent("Barbell weight") {
                        TextField(Strength.format(Strength.defaultBar(unit: weightUnit)),
                                  value: Binding(get: { barWeight > 0 ? barWeight : nil },
                                                 set: { barWeight = $0 ?? 0 }),
                                  format: .number)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 80)
                    }
                }

                Section {
                    Toggle("Workout reminders", isOn: $remindersEnabled)
                        .onChange(of: remindersEnabled) { _, on in
                            Task {
                                if on { remindersEnabled = await ReminderScheduler.requestAuthorization() }
                                rescheduleReminders()
                            }
                        }
                    if remindersEnabled {
                        DatePicker("Remind me at", selection: reminderTime, displayedComponents: .hourAndMinute)
                    }
                    if HealthSync.isAvailable {
                        Toggle("Save to Apple Health", isOn: $healthSync)
                            .onChange(of: healthSync) { _, on in
                                if on { Task { healthSync = await HealthSync.requestAuthorization() } }
                            }
                    }
                } header: {
                    Text("Automation")
                } footer: {
                    Text("Reminders follow your active program's training days. Rest-timer alerts also arrive when the app is in the background.")
                }

                Section {
                    if savedKey.isEmpty {
                        SecureField("sk-ant-…", text: $apiKey)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                        Button("Save key") {
                            if KeychainStore.saveAPIKey(apiKey) {
                                savedKey = KeychainStore.loadAPIKey()
                                apiKey = ""
                                showSaved = true
                            }
                        }
                        .disabled(apiKey.trimmingCharacters(in: .whitespaces).isEmpty)
                    } else {
                        LabeledContent("API key", value: "••••" + String(savedKey.suffix(4)))
                        Button("Remove key", role: .destructive) {
                            KeychainStore.saveAPIKey("")
                            savedKey = ""
                        }
                    }
                    Picker("Model", selection: $claudeModel) {
                        ForEach(ClaudeModelOption.allCases) { Text($0.title).tag($0.rawValue) }
                    }
                } header: {
                    Text("AI Coach (Claude)")
                } footer: {
                    Text("Your key is stored only in this device's Keychain and sent directly to Anthropic. Get one at console.anthropic.com. Without a key, the builder uses smart templates.")
                }

                Section("Your data") {
                    if let exportURL {
                        ShareLink(item: exportURL) { Label("Share workout CSV", systemImage: "square.and.arrow.up") }
                    } else {
                        Button {
                            exportURL = DataExport.writeTemporaryFile(DataExport.csv(programs: programs, unit: weightUnit))
                        } label: {
                            Label("Export workout history (CSV)", systemImage: "tablecells")
                        }
                    }
                }

                Section {
                    Text("Liftwise provides general fitness guidance, not medical advice. Check with a doctor before starting a new program, and stop any exercise that causes pain.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                } header: {
                    Text("About")
                }
            }
            .navigationTitle("Settings")
            .alert("API key saved", isPresented: $showSaved) {
                Button("OK", role: .cancel) {}
            }
            .onAppear { savedKey = KeychainStore.loadAPIKey() }
        }
    }

    private func rescheduleReminders() {
        ReminderScheduler.scheduleWorkoutReminders(
            for: programs.first(where: \.isActive),
            hour: reminderHour, minute: reminderMinute, enabled: remindersEnabled
        )
    }
}
