import SwiftUI

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
    @AppStorage("weightUnit") private var weightUnit = "lb"
    @AppStorage("claudeModel") private var claudeModel = ClaudeModelOption.defaultModel

    @State private var apiKey = ""
    @State private var savedKey = KeychainStore.loadAPIKey()
    @State private var showSaved = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Weight unit", selection: $weightUnit) {
                        Text("Pounds (lb)").tag("lb")
                        Text("Kilograms (kg)").tag("kg")
                    }
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
                    Text("Your key is stored only in this device's Keychain and sent directly to Anthropic. Get one at console.anthropic.com. Without a key, the builder uses offline templates.")
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
        }
    }
}
