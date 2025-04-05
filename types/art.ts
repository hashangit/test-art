export interface Observation {
  type: string;
  content: any;
  metadata?: {
    toolName?: string;
    [key: string]: any;
  };
  timestamp?: number;
}

export interface AgentResponse {
  response: {
    content: string;
  };
  metadata: {
    status: string;
    error?: string;
  };
}
