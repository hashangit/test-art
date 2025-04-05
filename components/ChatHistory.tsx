'use client';

interface ChatHistoryProps {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export default function ChatHistory({ messages }: ChatHistoryProps) {
  if (!messages.length) return null;

  return (
    <div className="w-full space-y-4 my-4">
      {messages.map((message, index) => (
        <div 
          key={index} 
          className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div 
            className={`max-w-[80%] rounded-lg px-4 py-2 ${
              message.role === 'user' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted'
            }`}
          >
            <div className="whitespace-pre-wrap">{message.content}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
