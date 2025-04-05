import {
  createArtInstance,
  PESAgent,
  CalculatorTool,
  AgentProps,
  ThreadConfig,
  ArtInstance,
  generateUUID
} from 'art-framework';

// Default Thread Configuration
export const defaultThreadConfig: ThreadConfig = {
  reasoning: {
    provider: 'gemini',
    model: 'gemini-2.0-flash-lite',
  },
  enabledTools: [CalculatorTool.toolName],
  historyLimit: 20,
  systemPrompt: "You are a helpful assistant. Use the calculator tool for any math calculations.",
};

// Singleton ART instance
let artInstance: ArtInstance | null = null;

export async function getArtInstance(): Promise<ArtInstance> {
  if (artInstance) return artInstance;

  const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY not found in environment variables.');
  }

  try {
    artInstance = await createArtInstance({
      agentCore: PESAgent,
      storage: {
        type: 'memory' // Using InMemoryStorageAdapter
      },
      reasoning: {
        provider: 'gemini', // Using GeminiReasoningAdapter
        apiKey: geminiApiKey,
      },
      tools: [new CalculatorTool()],
    });
    
    return artInstance;
  } catch (error) {
    console.error('Failed to initialize ART Instance', error);
    throw error;
  }
}

export async function processQuery(query: string, threadId: string): Promise<any> {
  const art = await getArtInstance();
  
  // Set config for this thread if not already set
  try {
    await art.stateManager.setThreadConfig(threadId, defaultThreadConfig);
  } catch (configError) {
    console.error(`Error setting thread config: ${configError}`);
    throw configError;
  }

  const agentProps: AgentProps = {
    query: query,
    threadId: threadId,
  };

  return art.process(agentProps);
}

export function generateThreadId(): string {
  return `web-${generateUUID()}`;
}
