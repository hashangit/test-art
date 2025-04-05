'use client';

import { useEffect, useState, useCallback } from 'react';
import QueryInput from '@/components/QueryInput';
import ResponseDisplay from '@/components/ResponseDisplay';
import ObservationLog from '@/components/ObservationLog';
import ChatHistory from '@/components/ChatHistory';
import { generateThreadId, getArtInstance, processQuery } from '@/lib/art-service';
import { AgentResponse, Observation } from '@/types/art';

export default function Home() {
  const [threadId, setThreadId] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [processingTime, setProcessingTime] = useState<number | null>(null);
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Initialize ART instance and create thread ID
  useEffect(() => {
    async function initialize() {
      try {
        setIsInitializing(true);
        //const art = await getArtInstance();
        const newThreadId = generateThreadId();
        setThreadId(newThreadId);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize ART');
      } finally {
        setIsInitializing(false);
      }
    }
    
    initialize();
  }, []);
  
  // Subscribe to observations
  useEffect(() => {
    if (!threadId) return;
    
    const setupObservations = async () => {
      try {
        const art = await getArtInstance();
        const observationSocket = art.uiSystem.getObservationSocket();
        
        const unsubscribe = observationSocket.subscribe(
          (observation) => {
            setObservations(prev => [...prev, observation]);
          },
          undefined,
          { threadId }
        );
        
        return unsubscribe;
      } catch (err) {
        console.error('Failed to set up observation socket:', err);
        setError('Failed to set up observation socket');
        return () => {};
      }
    };
    
    const unsubscribePromise = setupObservations();
    
    return () => {
      unsubscribePromise.then(unsubscribe => unsubscribe());
    };
  }, [threadId]);
  
  const handleSubmit = useCallback(async (query: string) => {
    if (!threadId || isProcessing) return;
    
    setIsProcessing(true);
    setObservations([]);
    setResponse(null);
    setProcessingTime(null);
    setError(null);
    
    // Add user message to history
    setChatHistory(prev => [...prev, { role: 'user', content: query }]);
    
    const startTime = Date.now();
    
    try {
      const result = await processQuery(query, threadId);
      const duration = Date.now() - startTime;
      
      setResponse(result);
      setProcessingTime(duration);
      
      // Add assistant response to history
      setChatHistory(prev => [...prev, { role: 'assistant', content: result.response.content }]);
    } catch (err) {
      console.error('Error processing query:', err);
      setError(err instanceof Error ? err.message : 'Error processing query');
    } finally {
      setIsProcessing(false);
    }
  }, [threadId, isProcessing]);
  
  return (
    <div className="grid grid-rows-[auto_1fr_auto] min-h-screen">
      <header className="p-4 border-b">
        <h1 className="text-2xl font-semibold">ART Framework Demo</h1>
        {threadId && (
          <p className="text-xs font-mono text-muted-foreground">Thread ID: {threadId}</p>
        )}
      </header>
      
      <main className="flex flex-col p-4 max-w-4xl mx-auto w-full overflow-y-auto">
        {isInitializing ? (
          <div className="flex items-center justify-center h-full">
            <p>Initializing ART Framework...</p>
          </div>
        ) : error ? (
          <div className="bg-destructive/10 text-destructive p-4 rounded-md">
            <h3 className="font-semibold">Error</h3>
            <p>{error}</p>
          </div>
        ) : (
          <>
            <ChatHistory messages={chatHistory} />
            
            {observations.length > 0 && (
              <ObservationLog observations={observations} />
            )}
            
            {response && (
              <ResponseDisplay response={response} processingTime={processingTime || undefined} />
            )}
          </>
        )}
      </main>
      
      <footer className="p-4 border-t">
        <div className="max-w-4xl mx-auto w-full">
          <QueryInput 
            onSubmit={handleSubmit} 
            isProcessing={isProcessing || isInitializing} 
          />
        </div>
      </footer>
    </div>
  );
}
