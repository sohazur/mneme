export interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
}

export interface MemorySnippet {
    text: string;
    score: number;
}

export interface ToolCall {
    name: string;
    args: Record<string, unknown>;
    result?: string;
}

export interface TrustReceipt {
    timestamp: string;
    model: string;
    latencyMs: number;
    memoriesRecalled: MemorySnippet[];
    toolsCalled: ToolCall[];
    actionsPerformed: string[];
    memoryStored: boolean;
}

export interface AgentRequest {
    chatId: string;
    message: string;
    history: ChatMessage[];
}

export interface AgentResponse {
    reply: string;
    trustReceipt: TrustReceipt;
}
