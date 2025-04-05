'use client';

import { AgentResponse } from '@/types/art';
import { cn } from '@/lib/utils';

interface ResponseDisplayProps {
  response: AgentResponse | null;
  processingTime?: number;
}

export default function ResponseDisplay({ response, processingTime }: ResponseDisplayProps) {
  if (!response) return null;

  const hasError = !!response.metadata.error;

  return (
    <div className="w-full space-y-2 mt-4">
      <h3 className="text-sm font-semibold">Response</h3>
      <div className={cn(
        "border rounded-md p-4 bg-card",
        hasError && "border-destructive"
      )}>
        <div className="prose max-w-none dark:prose-invert">
          <div className="whitespace-pre-wrap">{response.response.content}</div>
        </div>
        
        <div className="mt-4 pt-2 border-t text-xs text-muted-foreground">
          <div>Status: {response.metadata.status}</div>
          {processingTime && <div>Processing Time: {processingTime}ms</div>}
          {hasError && (
            <div className="text-destructive mt-1">
              Error: {response.metadata.error}
              {response.metadata.status === 'error' && (
                <div className="mt-1 font-medium">
                  &gt;&gt;&gt; POTENTIAL PERSISTENCE ISSUE DETECTED: 'error' status on subsequent request. &lt;&lt;&lt;
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
