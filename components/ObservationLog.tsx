'use client';

import { Observation } from '@/types/art';
import { cn } from '@/lib/utils';

interface ObservationLogProps {
  observations: Observation[];
}

export default function ObservationLog({ observations }: ObservationLogProps) {
  if (!observations.length) return null;

  return (
    <div className="w-full space-y-2 mt-4">
      <h3 className="text-sm font-semibold">Observations</h3>
      <div className="max-h-[400px] overflow-y-auto border rounded-md p-4 bg-muted/30 space-y-2">
        {observations.map((observation, index) => (
          <div key={index} className="text-sm font-mono">
            <div className={cn(
              "p-2 rounded-md",
              observation.type === 'ERROR' ? "bg-destructive/10 text-destructive" : "bg-card"
            )}>
              <div className="font-semibold">[{observation.type}]</div>
              <div className="whitespace-pre-wrap">
                {renderObservationContent(observation)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderObservationContent(observation: Observation): React.ReactNode {
  // Handle object content by stringifying it
  if (typeof observation.content === 'object' && observation.content !== null) {
    if (observation.type === 'PLAN' || observation.type === 'INTENT' || observation.type === 'THOUGHTS') {
      // Try to safely stringify the content
      return JSON.stringify(observation.content, null, 2);
    }
  }

  if (observation.type === 'TOOL_EXECUTION') {
    return (
      <>
        <div>Tool: {observation.metadata?.toolName}, Status: {observation.content.status}</div>
        {observation.content.output && <div>Output: {JSON.stringify(observation.content.output)}</div>}
        {observation.content.error && <div>Error: {observation.content.error}</div>}
      </>
    );
  } else if (observation.type === 'ERROR') {
    const errorContent = typeof observation.content === 'object' 
      ? JSON.stringify(observation.content, null, 2)
      : observation.content.message || String(observation.content);
    return `Agent Error: ${errorContent}`;
  } else {
    // For any other type of content, ensure we're not directly rendering objects
    return typeof observation.content === 'object'
      ? JSON.stringify(observation.content, null, 2)
      : String(observation.content);
  }
}
