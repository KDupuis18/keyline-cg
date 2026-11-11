import SwiftUI
import SwiftData

struct CoachView: View {
    @EnvironmentObject private var router: AppRouter
    @Environment(\.modelContext) private var context
    @Query(sort: \CoachMessage.createdAt) private var messages: [CoachMessage]
    @Query private var programs: [TrainingProgram]
    @Query private var bodyWeights: [BodyWeightEntry]
    @AppStorage("weightUnit") private var weightUnit = "lb"
    @AppStorage("claudeModel") private var claudeModel = ClaudeModelOption.defaultModel

    @State private var draft = ""
    @State private var streamingText = ""
    @State private var isSending = false
    @State private var error: String?
    @State private var hasKey = KeychainStore.hasAPIKey
    @FocusState private var inputFocused: Bool

    private let starters = [
        "How should I warm up for today's workout?",
        "I missed two workouts this week. What should I do?",
        "My bench has stalled. Any tips?",
        "How much protein should I eat?",
    ]

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        builderCard

                        if !hasKey {
                            Label("Add an Anthropic API key in Settings to chat with your coach.", systemImage: "key.fill")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        } else if messages.isEmpty {
                            Text("Ask your coach anything").font(.headline).padding(.top, 6)
                            ForEach(starters, id: \.self) { s in
                                Button { send(s) } label: {
                                    Text(s)
                                        .font(.subheadline)
                                        .multilineTextAlignment(.leading)
                                        .padding(12)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 12))
                                }
                                .buttonStyle(.plain)
                            }
                        }

                        ForEach(messages) { message in
                            ChatBubble(text: message.text, isUser: message.role == "user")
                        }
                        if isSending {
                            ChatBubble(text: streamingText.isEmpty ? "…" : streamingText, isUser: false)
                        }
                        if let error {
                            Label(error, systemImage: "exclamationmark.triangle.fill").font(.footnote).foregroundStyle(.red)
                        }
                        Color.clear.frame(height: 1).id("bottom")
                    }
                    .padding()
                }
                .background(Color(.systemGroupedBackground))
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: streamingText) { proxy.scrollTo("bottom", anchor: .bottom) }
                .onChange(of: messages.count) { withAnimation { proxy.scrollTo("bottom", anchor: .bottom) } }
            }
            .safeAreaInset(edge: .bottom) {
                if hasKey { inputBar }
            }
            .navigationTitle("Coach")
            .toolbar {
                if !messages.isEmpty {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Clear") { messages.forEach { context.delete($0) } }
                    }
                }
            }
            .onAppear { hasKey = KeychainStore.hasAPIKey }
            .sheet(isPresented: $router.showBuilder) {
                PlanBuilderView(prefill: router.builderPrefill) { _ in
                    router.showBuilder = false
                    router.tab = .today
                }
            }
        }
    }

    private var builderCard: some View {
        Button {
            router.openBuilder()
        } label: {
            HStack(spacing: 14) {
                Image(systemName: "wand.and.stars").font(.title).foregroundStyle(.white)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Build a program with AI").font(.headline).foregroundStyle(.white)
                    Text("A multi-week plan for any goal, built around your schedule and equipment.")
                        .font(.caption).foregroundStyle(.white.opacity(0.9))
                        .multilineTextAlignment(.leading)
                }
                Spacer()
                Image(systemName: "chevron.right").foregroundStyle(.white.opacity(0.8))
            }
            .padding()
            .background(Color.accentColor.gradient, in: RoundedRectangle(cornerRadius: 18))
        }
        .buttonStyle(.plain)
    }

    private var inputBar: some View {
        HStack(alignment: .bottom, spacing: 8) {
            TextField("Message your coach", text: $draft, axis: .vertical)
                .lineLimit(1...5)
                .focused($inputFocused)
                .padding(.horizontal, 12).padding(.vertical, 8)
                .background(Color(.secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 18))
            Button {
                send(draft)
            } label: {
                Image(systemName: "arrow.up.circle.fill").font(.system(size: 32))
            }
            .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSending)
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(.bar)
    }

    private func send(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !isSending else { return }
        draft = ""
        error = nil
        context.insert(CoachMessage(role: "user", text: trimmed))

        // Last 20 turns of the conversation, merged so roles alternate.
        var turns: [[String: String]] = []
        let conversation = messages.map { (role: $0.role, text: $0.text) } + [(role: "user", text: trimmed)]
        for m in conversation.suffix(20) {
            if let last = turns.last, last["role"] == m.role {
                turns[turns.count - 1]["content"] = (last["content"] ?? "") + "\n\n" + m.text
            } else {
                turns.append(["role": m.role, "content": m.text])
            }
        }
        if turns.first?["role"] == "assistant" { turns.removeFirst() }

        let history = TrainingHistory.load(from: context)
        let system = CoachContext.coachSystemPrompt + "\n\nAthlete data:\n"
            + CoachContext.snapshot(programs: programs, history: history, bodyWeights: bodyWeights, unit: weightUnit)
        let client = ClaudeClient(apiKey: KeychainStore.loadAPIKey(), model: claudeModel)

        isSending = true
        streamingText = ""
        Task {
            do {
                let reply = try await client.stream(system: system, messages: turns, effort: "low", maxTokens: 16000) { chunk in
                    streamingText += chunk
                }
                context.insert(CoachMessage(role: "assistant", text: reply))
            } catch {
                self.error = error.localizedDescription
            }
            isSending = false
            streamingText = ""
        }
    }
}

private struct ChatBubble: View {
    let text: String
    let isUser: Bool

    var body: some View {
        HStack {
            if isUser { Spacer(minLength: 40) }
            Text(LocalizedStringKey(text))
                .font(.subheadline)
                .padding(12)
                .background(isUser ? Color.accentColor : Color(.secondarySystemGroupedBackground),
                            in: RoundedRectangle(cornerRadius: 16))
                .foregroundStyle(isUser ? Color.white : Color.primary)
                .textSelection(.enabled)
            if !isUser { Spacer(minLength: 40) }
        }
    }
}
