const HYDRA_BASE_URL = "https://api.hydradb.com";
const TENANT_ID = "openclaw";

interface RecallResult {
    text: string;
    score: number;
    metadata?: Record<string, unknown>;
}

interface RecallResponse {
    results?: RecallResult[];
    chunks?: RecallResult[];
}

export class HydraDBClient {
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    private headers(): Record<string, string> {
        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
        };
    }

    async recall(
        query: string,
        sessionId: string,
        maxResults = 8,
    ): Promise<{ results: RecallResult[]; raw: unknown }> {
        try {
            const res = await fetch(`${HYDRA_BASE_URL}/recall/full_recall`, {
                method: "POST",
                headers: this.headers(),
                body: JSON.stringify({
                    tenant_id: TENANT_ID,
                    sub_tenant_id: sessionId,
                    query,
                    max_results: maxResults,
                    mode: "fast",
                }),
            });

            if (!res.ok) {
                console.warn(`[HydraDB] recall failed: ${res.status} ${res.statusText}`);
                return { results: [], raw: null };
            }

            const data = (await res.json()) as RecallResponse;
            const results = data.results ?? data.chunks ?? [];
            return { results, raw: data };
        } catch (err) {
            console.warn("[HydraDB] recall error:", (err as Error).message);
            return { results: [], raw: null };
        }
    }

    async addMemory(
        sessionId: string,
        userMessage: string,
        assistantMessage: string,
        metadata?: Record<string, unknown>,
    ): Promise<boolean> {
        try {
            const res = await fetch(`${HYDRA_BASE_URL}/memories/add_memory`, {
                method: "POST",
                headers: this.headers(),
                body: JSON.stringify({
                    tenant_id: TENANT_ID,
                    sub_tenant_id: sessionId,
                    memories: [
                        {
                            user_assistant_pairs: [
                                { user: userMessage, assistant: assistantMessage },
                            ],
                            metadata: metadata ?? {},
                        },
                    ],
                    upsert: true,
                }),
            });

            if (!res.ok) {
                console.warn(`[HydraDB] addMemory failed: ${res.status} ${res.statusText}`);
                return false;
            }
            return true;
        } catch (err) {
            console.warn("[HydraDB] addMemory error:", (err as Error).message);
            return false;
        }
    }
}
