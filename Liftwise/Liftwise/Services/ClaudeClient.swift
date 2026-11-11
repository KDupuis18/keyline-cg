import Foundation

/// Minimal Claude Messages API client (raw HTTP + SSE streaming).
/// Swift has no official Anthropic SDK, so this talks to the REST API directly.
struct ClaudeClient {
    enum ClaudeError: LocalizedError {
        case missingAPIKey
        case http(status: Int, message: String)
        case refused(String?)
        case truncated
        case emptyResponse

        var errorDescription: String? {
            switch self {
            case .missingAPIKey:
                "Add your Anthropic API key in Settings to use the AI builder."
            case .http(let status, let message):
                switch status {
                case 401: "Your API key was rejected (401). Check it in Settings."
                case 429: "Rate limited (429). Wait a moment and try again."
                case 529: "Claude is overloaded right now (529). Try again shortly."
                default: "API error \(status): \(message)"
                }
            case .refused(let explanation):
                "Claude declined this request." + (explanation.map { " \($0)" } ?? "")
            case .truncated:
                "The plan was cut off before it finished. Try fewer weeks or a shorter session length."
            case .emptyResponse:
                "Claude returned an empty response. Please try again."
            }
        }
    }

    static let endpoint = URL(string: "https://api.anthropic.com/v1/messages")!
    static let apiVersion = "2026-10-21"

    let apiKey: String
    let model: String

    /// Models that accept server-side refusal fallbacks (`fallbacks: "default"`).
    private var supportsServerFallback: Bool {
        model.hasPrefix("claude-opus-5") || model.hasPrefix("claude-sonnet-5-5") || model.hasPrefix("claude-fable")
    }

    /// Streams a structured-output (JSON schema) response and returns the full text.
    /// `onText` receives each text delta as it arrives.
    func streamStructured(
        system: String,
        user: String,
        schema: [String: Any],
        effort: String = "medium",
        maxTokens: Int = 64000,
        onText: @escaping (String) -> Void
    ) async throws -> String {
        guard !apiKey.isEmpty else { throw ClaudeError.missingAPIKey }

        let format: [String: Any] = ["type": "json_schema", "schema": schema]
        let outputConfig: [String: Any] = ["effort": effort, "format": format]
        let messages: [[String: String]] = [["role": "user", "content": user]]
        let thinking: [String: String] = ["type": "adaptive"]

        var body: [String: Any] = [
            "model": model,
            "max_tokens": maxTokens,
            "stream": true,
            "system": system,
            "messages": messages,
            "thinking": thinking,
            "output_config": outputConfig,
        ]

        var request = URLRequest(url: Self.endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 600
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue(Self.apiVersion, forHTTPHeaderField: "anthropic-version")
        if supportsServerFallback {
            // If a safety classifier declines, the API retries on a fallback model in the same call.
            body["fallbacks"] = "default"
            request.setValue("server-side-fallback-2026-07-01", forHTTPHeaderField: "anthropic-beta")
        }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (bytes, response) = try await URLSession.shared.bytes(for: request)
        guard let http = response as? HTTPURLResponse else { throw ClaudeError.emptyResponse }

        if http.statusCode != 200 {
            var raw = ""
            for try await line in bytes.lines { raw += line }
            let message = (try? JSONDecoder().decode(APIErrorEnvelope.self, from: Data(raw.utf8)))?.error.message ?? raw
            throw ClaudeError.http(status: http.statusCode, message: message)
        }

        var text = ""
        var stopReason: String?
        var refusalExplanation: String?
        let decoder = JSONDecoder()

        for try await line in bytes.lines {
            guard line.hasPrefix("data:") else { continue }
            let payload = line.dropFirst(5).trimmingCharacters(in: .whitespaces)
            guard let event = try? decoder.decode(StreamEvent.self, from: Data(payload.utf8)) else { continue }

            switch event.type {
            case "content_block_delta":
                if event.delta?.type == "text_delta", let chunk = event.delta?.text {
                    text += chunk
                    onText(chunk)
                }
            case "message_delta":
                if let reason = event.delta?.stopReason { stopReason = reason }
                if let explanation = event.delta?.stopDetails?.explanation { refusalExplanation = explanation }
            case "error":
                throw ClaudeError.http(status: 500, message: event.error?.message ?? "Stream error")
            default:
                break
            }
        }

        switch stopReason {
        case "refusal": throw ClaudeError.refused(refusalExplanation)
        case "max_tokens": throw ClaudeError.truncated
        default: break
        }
        guard !text.isEmpty else { throw ClaudeError.emptyResponse }
        return text
    }
}

// MARK: - Wire types

private struct APIErrorEnvelope: Decodable {
    struct Body: Decodable { let type: String?; let message: String }
    let error: Body
}

private struct StreamEvent: Decodable {
    struct Delta: Decodable {
        let type: String?
        let text: String?
        let stopReason: String?
        let stopDetails: StopDetails?

        enum CodingKeys: String, CodingKey {
            case type, text
            case stopReason = "stop_reason"
            case stopDetails = "stop_details"
        }
    }
    struct StopDetails: Decodable { let explanation: String? }
    struct ErrorBody: Decodable { let message: String? }

    let type: String
    let delta: Delta?
    let error: ErrorBody?
}
