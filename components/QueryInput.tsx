'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface QueryInputProps {
  onSubmit: (query: string) => void;
  isProcessing: boolean;
}

export default function QueryInput({ onSubmit, isProcessing }: QueryInputProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() && !isProcessing) {
      onSubmit(query);
      setQuery('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask something..."
          className={cn(
            "flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
            "ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
          disabled={isProcessing}
        />
        <button
          type="submit"
          disabled={isProcessing || !query.trim()}
          className={cn(
            "inline-flex items-center justify-center rounded-md text-sm font-medium h-12 px-4 py-2",
            "bg-primary text-primary-foreground hover:bg-primary/90 min-w-[100px]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:pointer-events-none disabled:opacity-50"
          )}
        >
          {isProcessing ? "Processing..." : "Send"}
        </button>
      </div>
    </form>
  );
}
