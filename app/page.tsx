'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { ImperativePanelGroupHandle } from "react-resizable-panels";
import { generateThreadId, getArtInstance, processQuery } from '@/lib/art-service'; // ART Service
import type { Observation as ArtServiceObservation, AgentResponse } from '@/types/art'; // ART Service Types

// --- Shadcn UI Component Imports ---
// Assuming these are correctly placed in 'components/ui' after running shadcn add
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // Removed unused parts
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Paperclip, SendHorizonal, Menu, Square, Copy, ThumbsUp, ThumbsDown, Bot, User, Plus, Check, // Removed Mic, Settings
    Target, ListChecks, Wrench, Terminal, Combine, MessageSquareText, BrainCircuit, Lightbulb, // Removed Play, Route, Sparkles, Cog
    PanelLeftClose, PanelLeftOpen, AlertTriangle // Removed KeyRound
} from 'lucide-react';

// --- Types (Matching New UI Structure) ---
interface Message {
  id: number;
  text: string;
  sender: 'user' | 'ai' | 'error'; // Added 'error' sender
  timestamp?: string;
  actions?: ('copy' | 'like' | 'dislike')[];
}

// Added threadId to Conversation
interface Conversation {
    id: string;
    threadId: string; // Added threadId
    title: string;
    messages: Message[];
    observations?: Observation[];
}

// Observation types expected by the new UI's ObservationViewer
type ObservationType = 'INTENT' | 'PLAN' | 'TOOL_CALL' | 'TOOL_EXECUTION' | 'SYNTHESIS' | 'FINAL_RESPONSE' | 'ERROR'; // Added ERROR type maybe?
interface BaseObservation {
    id: string;
    type: ObservationType;
    timestamp?: string;
}
interface IntentData { intent: string; }
interface PlanData { plan: string; rawOutput?: string; }
interface ToolCallData { toolCalls: { callId: string; toolName: string; arguments: Record<string, unknown>; }[]; } // Replaced any with unknown
interface ToolExecutionData { callId?: string; toolName?: string; status: 'success' | 'error' | string; output: Record<string, unknown> | string; } // Replaced any with unknown
interface SynthesisData { rawOutput: string; }
interface FinalResponseData { message: Message; } // Likely not used via socket
interface ErrorData { message: string; details?: unknown; } // For displaying errors // Replaced any with unknown

interface IntentObservation extends BaseObservation { type: 'INTENT'; data: IntentData; }
interface PlanObservation extends BaseObservation { type: 'PLAN'; data: PlanData; }
interface ToolCallObservation extends BaseObservation { type: 'TOOL_CALL'; data: ToolCallData; }
interface ToolExecutionObservation extends BaseObservation { type: 'TOOL_EXECUTION'; data: ToolExecutionData; }
interface SynthesisObservation extends BaseObservation { type: 'SYNTHESIS'; data: SynthesisData; }
interface FinalResponseObservation extends BaseObservation { type: 'FINAL_RESPONSE'; data: FinalResponseData; }
interface ErrorObservation extends BaseObservation { type: 'ERROR'; data: ErrorData; } // For displaying errors in observation panel

type Observation = | IntentObservation | PlanObservation | ToolCallObservation | ToolExecutionObservation | SynthesisObservation | FinalResponseObservation | ErrorObservation;


// --- Helper: Transform ART Service Observation to UI Observation ---
function transformObservation(rawObs: ArtServiceObservation): Observation | null {
    const timestamp = rawObs.timestamp ? new Date(rawObs.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const id = `obs-${rawObs.timestamp || Date.now()}-${Math.random().toString(36).substring(7)}`;

    try {
        switch (rawObs.type) {
            case 'INTENT':
                const intentText = typeof rawObs.content === 'object' && rawObs.content?.intent ? String(rawObs.content.intent) : String(rawObs.content || 'Unknown Intent');
                return { id, type: 'INTENT', data: { intent: intentText }, timestamp };
            case 'PLAN':
                const planText = typeof rawObs.content === 'object' && rawObs.content?.plan ? String(rawObs.content.plan) : String(rawObs.content || 'No plan details');
                const rawPlanOutput = typeof rawObs.content === 'object' ? JSON.stringify(rawObs.content) : String(rawObs.content);
                return { id, type: 'PLAN', data: { plan: planText, rawOutput: rawPlanOutput }, timestamp };
            case 'TOOL_CALL':
                 // Ensure content and toolCalls exist and are arrays
                // Define a basic type for the raw tool call object
                type RawToolCall = { callId?: unknown; toolName?: unknown; arguments?: unknown };
                const rawToolCalls = (typeof rawObs.content === 'object' && Array.isArray(rawObs.content?.toolCalls)) ? rawObs.content.toolCalls as RawToolCall[] : [];
                const validToolCalls = rawToolCalls.map((c: RawToolCall) => ({ // Added explicit type for c
                    callId: String(c?.callId || `call-${Date.now()}`),
                    toolName: String(c?.toolName || 'unknown_tool'),
                    arguments: typeof c?.arguments === 'object' && c.arguments !== null ? c.arguments as Record<string, unknown> : {} // Ensure arguments is an object
                }));
                return { id, type: 'TOOL_CALL', data: { toolCalls: validToolCalls }, timestamp };
            case 'TOOL_EXECUTION':
                const status = String(rawObs.content?.status || 'unknown').toLowerCase();
                const output = rawObs.content?.output ?? rawObs.content?.error ?? rawObs.content ?? {}; // Prioritize output/error
                return {
                    id,
                    type: 'TOOL_EXECUTION',
                    data: {
                        callId: rawObs.metadata?.callId ? String(rawObs.metadata.callId) : undefined,
                        toolName: rawObs.metadata?.toolName ? String(rawObs.metadata.toolName) : undefined,
                        status: status === 'success' || status === 'error' ? status : 'unknown',
                        output: output,
                    },
                    timestamp
                };
            case 'SYNTHESIS': // Or map from 'THOUGHTS' if that's the type
                 const synthesisText = typeof rawObs.content === 'object' && rawObs.content?.thoughts ? String(rawObs.content.thoughts) : String(rawObs.content || 'No synthesis details');
                return { id, type: 'SYNTHESIS', data: { rawOutput: synthesisText }, timestamp };
            case 'ERROR': // Handle generic agent errors
                const errorMessage = typeof rawObs.content === 'object' ? (rawObs.content.message || JSON.stringify(rawObs.content)) : String(rawObs.content);
                // Display as a specific error observation card
                 return {
                     id,
                     type: 'ERROR', // Use a dedicated ERROR type for the UI
                     data: { message: `Agent Error: ${errorMessage}`, details: rawObs.content },
                     timestamp
                 };
                // Or map to a ToolExecution card
                /*
                return {
                    id, type: 'TOOL_EXECUTION', data: {
                        status: 'error',
                        output: { message: `Agent Error: ${errorMessage}`, details: rawObs.content },
                        toolName: 'Agent Core'
                    }, timestamp
                };
                */
            default:
                console.warn("Unhandled observation type from ART service:", rawObs.type, rawObs);
                // Fallback to a generic Synthesis card
                return { id, type: 'SYNTHESIS', data: { rawOutput: `[${rawObs.type}] ${JSON.stringify(rawObs.content)}` }, timestamp };
        }
    } catch (transformError) {
        console.error("Error transforming observation:", transformError, rawObs);
        // Return a generic error observation for the UI
        return {
            id: `err-${Date.now()}`,
            type: 'ERROR',
            data: { message: "Error processing observation data.", details: rawObs },
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        };
    }
}


// --- Main App Component ---
const App: React.FC = () => {
  // --- State ---
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState<string>('');
  const [isAiResponding, setIsAiResponding] = useState<boolean>(false); // Renamed from isProcessing
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>(''); // Keep for potential future use
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  const [copiedData, setCopiedData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null); // Global error state
  const [isInitializing, setIsInitializing] = useState<boolean>(true); // Initialization state

  // --- Refs ---
  const messageScrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panelGroupRef = useRef<ImperativePanelGroupHandle>(null);
  const prevObservationsLengthRef = useRef<number>(0);
  const observationUnsubscribeRef = useRef<(() => void) | null>(null); // Ref to store unsubscribe function

  // --- Derived State ---
  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const activeMessages = activeConversation?.messages || [];
  const activeObservations = activeConversation?.observations || [];

  // --- Effects ---

  // Initialize ART and create first conversation on mount
  useEffect(() => {
    const initializeApp = async () => {
        setIsInitializing(true);
        setError(null);
        try {
            // Ensure ART instance is ready (fetches API key from env)
            await getArtInstance();
            // Create the initial conversation
            handleNewChat(false); // Create first chat without switching sidebar/focus yet
        } catch (err) {
            console.error("Initialization failed:", err);
            setError(err instanceof Error ? err.message : 'Failed to initialize ART service. Check API Key.');
            setConversations([]); // Clear conversations on init error
            setActiveConversationId(null);
        } finally {
            setIsInitializing(false);
        }
    };
    initializeApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount


  // Scroll message list to bottom
  useEffect(() => {
    const viewport = messageScrollAreaRef.current?.querySelector<HTMLDivElement>('div[data-radix-scroll-area-viewport]');
    if (viewport) {
      // Use requestAnimationFrame to ensure scroll happens after render
      requestAnimationFrame(() => {
        viewport.scrollTop = viewport.scrollHeight;
      });
    }
  }, [activeMessages]); // Trigger on new messages

  // Adjust textarea height
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto'; // Reset height
      const scrollHeight = ta.scrollHeight;
      const minHeight = 40; // Corresponds to rows={1} roughly
      const maxHeight = 200; // Limit max height
      ta.style.height = `${Math.max(minHeight, Math.min(scrollHeight, maxHeight))}px`;
    }
  }, [inputValue]);

  // Auto resize panels when observations appear/disappear
  useEffect(() => {
    const currentLength = activeObservations.length;
    const previousLength = prevObservationsLengthRef.current;

    // Only resize if observations *appear* (go from 0 to >0)
    if (previousLength === 0 && currentLength > 0) {
      if (panelGroupRef.current) {
        console.log("Observations appeared, setting layout...");
        panelGroupRef.current.setLayout([50, 50]); // Or your desired layout [chat, observations]
      }
    }
    // Optionally resize back if observations disappear (go from >0 to 0)
    // else if (previousLength > 0 && currentLength === 0) {
    //    if (panelGroupRef.current) {
    //        console.log("Observations disappeared, resetting layout...");
    //        panelGroupRef.current.setLayout([100]); // Collapse observations panel
    //    }
    // }

    prevObservationsLengthRef.current = currentLength;
  }, [activeObservations.length]); // Depend only on the length

  // Subscribe to observations for the active conversation
  useEffect(() => {
    // Clear previous subscription if it exists
    if (observationUnsubscribeRef.current) {
        observationUnsubscribeRef.current();
        observationUnsubscribeRef.current = null;
        console.log("Unsubscribed from previous observation socket.");
    }

    if (!activeConversation?.threadId || isInitializing) {
        console.log("No active thread ID or still initializing, skipping observation subscription.");
        return; // Don't subscribe if no active thread or initializing
    }

    const threadId = activeConversation.threadId;
    let isActive = true; // Flag to prevent updates after unmount or thread change
    console.log(`Setting up observation socket for thread: ${threadId}`);

    const setupObservations = async () => {
      try {
        const art = await getArtInstance(); // Get potentially existing instance
        const observationSocket = art.uiSystem.getObservationSocket();

        const unsubscribe = observationSocket.subscribe(
          // 1. Callback for observations
          (rawObservation: ArtServiceObservation) => {
            if (!isActive) return; // Don't update if effect cleaned up
            const transformedObs = transformObservation(rawObservation);
            if (transformedObs) {
               setConversations(prev => prev.map(conv =>
                   conv.id === activeConversationId
                       ? { ...conv, observations: [...(conv.observations || []), transformedObs] }
                       : conv
               ));
            }
          },
          // 2. Filter types (optional, using undefined to get all)
          undefined,
          // 3. Options object including threadId
          { threadId } // Removed onError as it's not a valid property here
        );
        // Note: Errors *during* the stream might need to be handled via specific
        // 'ERROR' type observations sent by the framework itself, or globally.

        if (isActive) {
            observationUnsubscribeRef.current = unsubscribe; // Store the unsubscribe function
            console.log(`Subscribed to observation socket for thread: ${threadId}`);
        } else {
            // If component unmounted or thread changed before subscription finished
            unsubscribe();
            console.log(`Unsubscribed immediately after setup for thread: ${threadId} (inactive)`);
        }

      } catch (err) {
        if (!isActive) return;
        console.error('Failed to set up observation socket:', err);
        setError('Failed to connect to observation service.'); // Update global error
      }
    };

    setupObservations();

    // Cleanup function
    return () => {
      isActive = false; // Mark as inactive
      if (observationUnsubscribeRef.current) {
        observationUnsubscribeRef.current();
        observationUnsubscribeRef.current = null;
        console.log(`Unsubscribed from observation socket for thread: ${threadId} on cleanup.`);
      }
    };
  }, [activeConversationId, activeConversation?.threadId, isInitializing]); // Re-run when active conversation changes or initialization finishes


  // Reset previous observations length when switching conversations
  useEffect(() => {
      prevObservationsLengthRef.current = activeObservations.length;
      // Optionally resize panel immediately on switch
      // const hasObservations = activeObservations.length > 0;
      // panelGroupRef.current?.setLayout(hasObservations ? [50, 50] : [100]);
  }, [activeConversationId, activeObservations.length]);


  // --- Event Handlers ---
  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(event.target.value);
  };
  const handleApiKeyInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setApiKeyInput(event.target.value);
  };

  // Helper to update a specific conversation
  const updateConversation = (convId: string, updates: Partial<Conversation>) => {
      setConversations(prev => prev.map(conv =>
          conv.id === convId ? { ...conv, ...updates } : conv
      ));
  };


  const handleSendMessage = useCallback(async () => {
    if (inputValue.trim() === '' || isAiResponding || !activeConversationId || !activeConversation?.threadId) return;

    const currentInputValue = inputValue;
    const currentConvId = activeConversationId;
    const currentThreadId = activeConversation.threadId;

    // Clear input immediately
    setInputValue('');
    // Set responding state
    setIsAiResponding(true);
    setError(null); // Clear previous errors

    // Add user message optimistically
    const userMessage: Message = {
        id: Date.now(),
        text: currentInputValue,
        sender: 'user',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    // Clear previous observations for this conversation before sending
    updateConversation(currentConvId, { observations: [], messages: [...activeMessages, userMessage] });


    try {
        console.log(`Processing query for thread ${currentThreadId}: "${currentInputValue}"`);
        const result: AgentResponse = await processQuery(currentInputValue, currentThreadId);
        console.log("Received AgentResponse:", result);

        // Add AI response message
        const aiResponse: Message = {
            id: Date.now() + 1, // Ensure unique ID
            text: result.response.content,
            sender: 'ai',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            actions: ['copy', 'like', 'dislike'] // Add default actions
        };
        updateConversation(currentConvId, { messages: [...activeMessages, userMessage, aiResponse] }); // Update with AI response

        // Handle potential errors reported in the response metadata
        if (result.metadata?.error) {
             console.error("Error in AgentResponse metadata:", result.metadata.error);
             const errorMsg: Message = {
                 id: Date.now() + 2,
                 text: `An error occurred: ${result.metadata.error}`,
                 sender: 'error', // Use 'error' sender type
                 timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
             };
             // Add error message to the chat
             updateConversation(currentConvId, { messages: [...activeMessages, userMessage, aiResponse, errorMsg] });
        }

    } catch (err) {
        console.error('Error processing query:', err);
        const errorText = err instanceof Error ? err.message : 'An unknown error occurred while processing your request.';
        setError(errorText); // Set global error state

        // Add error message to the chat
        const errorMsg: Message = {
            id: Date.now() + 2,
            text: `Error: ${errorText}`,
            sender: 'error',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
         // Update conversation, ensuring user message is still there
        updateConversation(currentConvId, { messages: [...activeMessages, userMessage, errorMsg] });

    } finally {
        setIsAiResponding(false);
        // Focus textarea only if observations panel isn't the primary focus
        // This might need adjustment based on desired UX
        setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [inputValue, isAiResponding, activeConversationId, activeConversation?.threadId, activeMessages]); // Dependencies


  const handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !isAiResponding) {
        event.preventDefault();
        handleSendMessage();
    }
  };

  // Stop generating (Placeholder - ART framework might need specific API for this)
  const handleStopGenerating = () => {
    console.log("Stopping generation (Placeholder - requires ART framework support)");
    // TODO: Implement actual stop mechanism if available in art-framework
    setIsAiResponding(false); // For now, just reset the state
  };

  const handleNewChat = (setActive = true) => {
    const newConvId = `conv-${Date.now()}`;
    const newThreadId = generateThreadId(); // Generate unique thread ID
    console.log(`Creating new chat with ID: ${newConvId}, Thread ID: ${newThreadId}`);

    const newConversation: Conversation = {
        id: newConvId,
        threadId: newThreadId, // Store thread ID
        title: 'New Chat',
        messages: [{
            id: Date.now(),
            text: "How can I help you today?", // Initial AI message
            sender: 'ai',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            actions: ['copy']
        }],
        observations: []
    };

    setConversations(prev => [newConversation, ...prev]); // Add to the beginning

    if (setActive) {
        setActiveConversationId(newConvId);
        setSidebarOpen(false); // Close mobile sidebar
        setInputValue('');
        setError(null); // Clear global error
        panelGroupRef.current?.setLayout([100]); // Reset panels
        setTimeout(() => textareaRef.current?.focus(), 0); // Focus input
    }
  };

  const selectConversation = (id: string) => {
    if (id === activeConversationId || isAiResponding) return; // Prevent switching during response

    console.log(`Switching to conversation: ${id}`);
    setActiveConversationId(id);
    setSidebarOpen(false);
    setInputValue('');
    setError(null); // Clear global error

    // Reset panel layout based on selected conversation's observations
    const selectedConv = conversations.find(c => c.id === id);
    const hasObservations = (selectedConv?.observations?.length ?? 0) > 0;
    panelGroupRef.current?.setLayout(hasObservations ? [50, 50] : [100]);

    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleMessageAction = (messageId: number, action: string) => {
    console.log(`Action '${action}' triggered for message ID ${messageId}`);
    if (action === 'copy') {
        const message = activeMessages.find(m => m.id === messageId);
        if (message) {
            navigator.clipboard.writeText(message.text)
                .then(() => {
                    setCopiedMessageId(messageId);
                    setTimeout(() => setCopiedMessageId(null), 1500);
                })
                .catch(err => console.error("Failed to copy message:", err));
        }
    }
    // Add logic for 'like'/'dislike' if needed (e.g., send feedback to backend)
  };

  const handleCopyObservationData = (dataToCopy: string | object) => {
    const textToCopy = typeof dataToCopy === 'string' ? dataToCopy : JSON.stringify(dataToCopy, null, 2);
    navigator.clipboard.writeText(textToCopy)
        .then(() => {
            setCopiedData(textToCopy); // Store the actual copied string/object representation
            setTimeout(() => setCopiedData(null), 1500);
        })
        .catch(err => console.error("Failed to copy observation data:", err));
  };

  // Handler for submitting API Key (Placeholder - requires backend)
  const handleApiKeySubmit = () => {
      console.log("Attempting to submit API Key:", apiKeyInput);
      // **IMPORTANT:** Direct writing to .env.local is NOT possible from client-side.
      // This requires a backend endpoint to receive the key securely and update server environment.
      alert(`API Key "${apiKeyInput}" logged to console. For this demo, the key must be set in the environment variable NEXT_PUBLIC_GEMINI_API_KEY.`);
      // Optionally clear the input after 'submission'
      // setApiKeyInput('');
  };

  // --- Rendering ---
  if (isInitializing) {
      return (
          <div className="flex h-screen w-full items-center justify-center bg-gray-100 dark:bg-gray-950">
              <p className="text-lg animate-pulse">Initializing ART Demo...</p>
          </div>
      );
  }

  // Display global error if initialization failed
   if (error && !activeConversationId) {
       return (
           <div className="flex h-screen w-full items-center justify-center bg-gray-100 dark:bg-gray-950 p-4">
               <Card className="max-w-md border-red-500 border-2">
                   <CardHeader>
                       <CardTitle className="text-red-600 dark:text-red-500 flex items-center gap-2">
                           <AlertTriangle className="h-5 w-5" /> Initialization Error
                       </CardTitle>
                   </CardHeader>
                   <CardContent>
                       <p className="text-red-700 dark:text-red-400">{error}</p>
                       <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                           Please ensure the Gemini API key is correctly configured in your environment
                           (<code>NEXT_PUBLIC_GEMINI_API_KEY</code>) and the service is running.
                       </p>
                   </CardContent>
               </Card>
           </div>
       );
   }


  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex h-screen w-full bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans overflow-hidden">

        {/* Sidebar */}
        <aside className={`
            ${sidebarOpen ? 'flex' : 'hidden'} md:flex flex-col shrink-0
            bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
            absolute md:static z-20 md:z-0 h-full transition-all duration-300 ease-in-out
            ${ isSidebarCollapsed ? 'w-16' : 'w-full md:w-56 lg:w-64' }
            ${sidebarOpen && !isSidebarCollapsed ? 'translate-x-0' : ''}
            ${sidebarOpen && isSidebarCollapsed ? 'translate-x-0' : ''}
            {!sidebarOpen && !isSidebarCollapsed ? '-translate-x-full md:translate-x-0' : ''}
            {!sidebarOpen && isSidebarCollapsed ? '-translate-x-full md:translate-x-0' : ''}
        `}>
           {/* Sidebar Header */}
          <div className={`p-3 flex items-center border-b border-gray-200 dark:border-gray-800 h-14 shrink-0 ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
            {!isSidebarCollapsed && <h1 className="text-lg font-semibold ml-1">Chats</h1>}
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800">
                        {isSidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>{isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}</TooltipContent>
            </Tooltip>
             {!isSidebarCollapsed && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => handleNewChat()} className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800">
                            <Plus className="h-5 w-5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>New Chat</TooltipContent>
                </Tooltip>
             )}
          </div>
          {/* Conversation List */}
          <ScrollArea className="flex-1 p-2">
            <div className="space-y-1">
              {conversations.map(conv => (
                 <Tooltip key={conv.id} disableHoverableContent={!isSidebarCollapsed}>
                    <TooltipTrigger asChild>
                         <Button
                            variant={activeConversationId === conv.id ? "secondary" : "ghost"}
                            className={`w-full text-sm h-9 px-3 ${isSidebarCollapsed ? 'justify-center' : 'justify-start'}`}
                            onClick={() => selectConversation(conv.id)}
                            disabled={isAiResponding} // Disable switching while responding
                          >
                            <MessageSquareText className={`h-4 w-4 ${!isSidebarCollapsed ? 'mr-2' : ''}`} />
                            <span className={`truncate ${isSidebarCollapsed ? 'hidden' : 'inline-block'}`}>{conv.title || 'Chat'}</span>
                          </Button>
                    </TooltipTrigger>
                    {isSidebarCollapsed && <TooltipContent side="right">{conv.title || 'Chat'}</TooltipContent>}
                </Tooltip>
              ))}
            </div>
          </ScrollArea>
          {/* Sidebar Footer - API Key Input */}
          <div className={`p-3 border-t border-gray-200 dark:border-gray-800 shrink-0 ${isSidebarCollapsed ? 'flex flex-col items-center space-y-2' : ''}`}>
             <div className={`space-y-1 w-full ${isSidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
                 <label htmlFor="gemini-api-key" className={`text-xs font-medium text-gray-600 dark:text-gray-400 ${isSidebarCollapsed ? 'hidden' : 'block'}`}>Gemini API Key (Env)</label>
                 <div className={`flex items-center gap-1 ${isSidebarCollapsed ? 'flex-col' : ''}`}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Input
                                id="gemini-api-key"
                                type="password"
                                placeholder={isSidebarCollapsed ? "Key" : "Enter key (for show)..."}
                                value={apiKeyInput}
                                onChange={handleApiKeyInputChange}
                                className={`h-8 text-xs ${isSidebarCollapsed ? 'w-10 text-center' : 'flex-grow'}`}
                            />
                        </TooltipTrigger>
                        {isSidebarCollapsed && <TooltipContent side="right">Enter API Key (Display Only)</TooltipContent>}
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button onClick={handleApiKeySubmit} size={isSidebarCollapsed ? 'icon' : 'sm'} className={`h-8 ${isSidebarCollapsed ? 'w-8' : 'px-2'}`}>
                                {isSidebarCollapsed ? <Check className="h-4 w-4" /> : <span className="text-xs">Submit</span>}
                            </Button>
                        </TooltipTrigger>
                         <TooltipContent side={isSidebarCollapsed ? "right" : "top"}>Submit Key (Logs Only)</TooltipContent>
                    </Tooltip>
                 </div>
             </div>
             {!isSidebarCollapsed && (
                <p className="text-[10px] text-gray-500 dark:text-gray-500 mt-1">Key must be set via <code>NEXT_PUBLIC_GEMINI_API_KEY</code> env var.</p>
             )}
          </div>
        </aside>

        {/* Overlay for mobile sidebar */}
        {sidebarOpen && (<div onClick={() => setSidebarOpen(false)} className="fixed inset-0 bg-black/30 z-10 md:hidden" aria-hidden="true"/>)}

        {/* Main Content Area (Chat + Observations) */}
        <ResizablePanelGroup ref={panelGroupRef} direction="horizontal" className="flex-1 bg-gray-50 dark:bg-gray-900 min-w-0">
          {/* Chat Panel */}
          <ResizablePanel defaultSize={activeObservations.length > 0 ? 50 : 100} minSize={30} id="chat-panel">
            <main className="flex flex-col h-full">
               {/* Header */}
              <header className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 h-14 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                    <Button variant="ghost" size="icon" className="md:hidden text-gray-600 dark:text-gray-400" onClick={() => setSidebarOpen(true)}>
                        <Menu className="h-5 w-5" />
                    </Button>
                    <h2 className="text-md font-semibold truncate flex-1">{activeConversation?.title || 'Chat'}</h2>
                </div>
                {/* Model Selector Placeholder */}
                <Select defaultValue="gemini-2.0-flash-lite" disabled>
                    <SelectTrigger className="w-[180px] h-8 text-xs">
                        <SelectValue placeholder="Select Model" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite</SelectItem>
                        {/* Add other models if configurable */}
                    </SelectContent>
                </Select>
              </header>
              {/* Message List */}
              {/* Added h-full and overflow-y-auto explicitly to ensure scroll behavior */}
              <ScrollArea className="flex-1 h-full overflow-y-auto p-4 md:p-6 bg-gray-50 dark:bg-gray-900" ref={messageScrollAreaRef}>
                   <div className="space-y-6 max-w-4xl mx-auto pb-4">
                      {activeMessages.map((message) => (
                          <div key={message.id} className="group flex flex-col items-start gap-1">
                              <div className={`flex gap-3 w-full ${ message.sender === 'user' ? 'justify-end' : 'justify-start' }`}>
                                  {/* AI Avatar */}
                                  {message.sender === 'ai' && (
                                      <Avatar className="h-7 w-7 border border-gray-200 dark:border-gray-700 shrink-0 mt-1">
                                          <AvatarFallback className="bg-gradient-to-br from-purple-400 to-indigo-500 text-white text-xs font-bold"><Bot size={14}/></AvatarFallback>
                                      </Avatar>
                                  )}
                                  {/* Error Avatar */}
                                   {message.sender === 'error' && (
                                      <Avatar className="h-7 w-7 border border-red-300 dark:border-red-700 shrink-0 mt-1">
                                          <AvatarFallback className="bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 text-xs font-bold"><AlertTriangle size={14}/></AvatarFallback>
                                      </Avatar>
                                  )}

                                  {/* Message Bubble */}
                                  <div className={`relative max-w-[85%] rounded-lg px-3.5 py-2 shadow-sm text-sm ${
                                      message.sender === 'user' ? 'bg-blue-500 text-white dark:bg-blue-600 rounded-br-none' :
                                      message.sender === 'ai' ? 'bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 rounded-bl-none border border-gray-200 dark:border-gray-700' :
                                      'bg-red-50 text-red-900 dark:bg-red-900/30 dark:text-red-200 rounded-bl-none border border-red-200 dark:border-red-700' // Error style
                                  }`}>
                                      <p className="whitespace-pre-wrap break-words">{message.text}</p>
                                      {/* Timestamps */}
                                      {message.timestamp && message.sender === 'ai' && (<span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 block">{message.timestamp}</span>)}
                                      {message.timestamp && message.sender === 'user' && (<span className="text-[10px] text-blue-200 dark:text-blue-300 mt-1 block text-right">{message.timestamp}</span>)}
                                      {message.timestamp && message.sender === 'error' && (<span className="text-[10px] text-red-400 dark:text-red-500 mt-1 block">{message.timestamp}</span>)}
                                  </div>

                                  {/* User Avatar */}
                                  {message.sender === 'user' && (
                                      <Avatar className="h-7 w-7 border order-last ml-3 border-gray-200 dark:border-gray-700 shrink-0 mt-1">
                                          <AvatarFallback className="bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs"><User size={14}/></AvatarFallback>
                                      </Avatar>
                                  )}
                              </div>
                              {/* Action Buttons (Only for AI messages for now) */}
                              {message.sender === 'ai' && message.actions && (
                                  <div className="flex items-center gap-1 pl-10 opacity-0 group-hover:opacity-100 transition-opacity duration-150 mt-1">
                                      {message.actions.includes('copy') && (
                                          <Tooltip>
                                              <TooltipTrigger asChild>
                                                  <Button variant="ghost" size="icon" className={`h-6 w-6 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 ${copiedMessageId === message.id ? 'text-green-600 dark:text-green-500' : ''}`} onClick={() => handleMessageAction(message.id, 'copy')} >
                                                      {copiedMessageId === message.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                                  </Button>
                                              </TooltipTrigger>
                                              <TooltipContent>{copiedMessageId === message.id ? 'Copied!' : 'Copy'}</TooltipContent>
                                          </Tooltip>
                                      )}
                                      {message.actions.includes('like') && (
                                          <Tooltip>
                                              <TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500 hover:text-green-600 dark:text-gray-400 dark:hover:text-green-500" onClick={() => handleMessageAction(message.id, 'like')}><ThumbsUp className="h-3.5 w-3.5" /></Button></TooltipTrigger>
                                              <TooltipContent>Like (Not Implemented)</TooltipContent>
                                          </Tooltip>
                                      )}
                                      {message.actions.includes('dislike') && (
                                          <Tooltip>
                                              <TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-500" onClick={() => handleMessageAction(message.id, 'dislike')}><ThumbsDown className="h-3.5 w-3.5" /></Button></TooltipTrigger>
                                              <TooltipContent>Dislike (Not Implemented)</TooltipContent>
                                          </Tooltip>
                                      )}
                                  </div>
                              )}
                          </div>
                      ))}
                      {/* AI Typing Indicator */}
                      {isAiResponding && (
                          <div className="flex items-center gap-3 justify-start">
                              <Avatar className="h-7 w-7 border border-gray-200 dark:border-gray-700 shrink-0">
                                  <AvatarFallback className="bg-gradient-to-br from-purple-400 to-indigo-500 text-white text-xs font-bold"><Bot size={14}/></AvatarFallback>
                              </Avatar>
                              <div className="bg-white dark:bg-gray-800 rounded-lg px-4 py-2 shadow-sm border border-gray-200 dark:border-gray-700">
                                  <div className="flex space-x-1.5 items-center h-[18px]">
                                      <span className="h-1.5 w-1.5 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
                                      <span className="h-1.5 w-1.5 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></span>
                                      <span className="h-1.5 w-1.5 bg-gray-500 dark:bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></span>
                                  </div>
                              </div>
                          </div>
                      )}
                   </div>
              </ScrollArea>
              {/* Input Area */}
              <div className="p-4 md:px-6 pb-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shrink-0 max-w-4xl mx-auto w-full">
                   {isAiResponding && (
                       <div className="flex justify-center mb-2">
                           <Button variant="outline" size="sm" onClick={handleStopGenerating} className="text-xs">
                               <Square className="mr-1.5 h-3 w-3 fill-current" /> Stop Generating (Placeholder)
                           </Button>
                       </div>
                   )}
                   <div className="relative flex items-start space-x-2 bg-gray-100 dark:bg-gray-800 rounded-xl p-2 border border-gray-200 dark:border-gray-700 focus-within:ring-2 focus-within:ring-blue-500 dark:focus-within:ring-blue-600 transition-shadow">
                      <Tooltip>
                          <TooltipTrigger asChild><Button variant="ghost" size="icon" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 shrink-0 pt-[9px]" disabled><Paperclip className="h-5 w-5" /></Button></TooltipTrigger>
                          <TooltipContent>Attach File (Not Implemented)</TooltipContent>
                      </Tooltip>
                      <Textarea
                          ref={textareaRef}
                          placeholder="Send a message (Shift+Enter for newline)"
                          value={inputValue}
                          onChange={handleInputChange}
                          onKeyPress={handleKeyPress}
                          rows={1}
                          disabled={isAiResponding || !activeConversationId} // Disable if no active chat
                          className="flex-1 bg-transparent border-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none max-h-[200px] overflow-y-auto dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm py-2 px-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent"
                      />
                      <div className="flex flex-col justify-end items-center space-y-1 shrink-0">
                          <Button
                              onClick={handleSendMessage}
                              size="icon"
                              disabled={inputValue.trim() === '' || isAiResponding || !activeConversationId}
                              className="bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg w-8 h-8 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400 dark:disabled:bg-gray-600 transition-colors"
                          >
                              <SendHorizonal className="h-4 w-4" />
                          </Button>
                      </div>
                   </div>
                   <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-2">AI models can make mistakes. Consider checking important information.</p>
              </div>
            </main>
          </ResizablePanel>

          {/* Resizable Handle - Only show if observations exist */}
           {activeObservations.length > 0 && (
               <ResizableHandle withHandle className="w-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 dark:hover:bg-blue-600 data-[resize-handle-active]:bg-blue-600 dark:data-[resize-handle-active]:bg-blue-500 transition-colors duration-150 ease-in-out group" aria-controls="observations-panel chat-panel">
                   <div className="z-10 flex h-8 w-1 items-center justify-center rounded-full bg-border border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 group-hover:border-blue-500 group-data-[resize-handle-active]:border-blue-600"></div>
               </ResizableHandle>
           )}

          {/* Observations Panel - Only render if observations exist */}
           {activeObservations.length > 0 && (
               <ResizablePanel defaultSize={50} minSize={30} id="observations-panel">
                   <ObservationsViewer
                       observations={activeObservations}
                       onCopy={handleCopyObservationData}
                       copiedData={copiedData}
                       // Removed onClose prop as it's not defined in the component interface anymore
                   />
               </ResizablePanel>
           )}

        </ResizablePanelGroup>
      </div>
    </TooltipProvider>
  );
};

// --- Observations Viewer Component ---
// (Implementation unchanged from original prompt, assuming it's defined below or imported)
interface ObservationsViewerProps {
    observations: Observation[];
    // onClose: () => void; // Removed unused prop
    onCopy: (dataToCopy: string | object) => void;
    copiedData: string | null;
}
const ObservationsViewer: React.FC<ObservationsViewerProps> = ({ observations, /* onClose, */ onCopy, copiedData }) => { // Removed onClose from destructuring
    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom of observations
    useEffect(() => {
        if (viewportRef.current) {
            // Delay slightly to allow rendering
            setTimeout(() => {
                if (viewportRef.current) {
                    viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
                }
            }, 50);
        }
    }, [observations]); // Scroll when observations change

    return (
        <Card className="h-full flex flex-col border-l border-gray-200 dark:border-gray-800 rounded-none shadow-none bg-gray-50 dark:bg-gray-950">
            <CardHeader className="flex flex-row items-center justify-between p-3 border-b dark:border-gray-800 h-14 shrink-0 bg-white dark:bg-gray-900">
                <CardTitle className="text-md font-semibold flex items-center gap-2">
                    <BrainCircuit className="h-5 w-5 text-blue-500" />Observations
                </CardTitle>
                {/* Optional: Add a close button if needed */}
                {/* <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                    <X className="h-4 w-4" />
                </Button> */}
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden">
                <ScrollArea className="h-full" ref={scrollAreaRef}>
                     {/* Viewport needs explicit height or parent constraint */}
                    <div ref={viewportRef} className="h-full w-full p-4"> {/* Added padding here */}
                        <div className="space-y-4">
                            {observations.map((obs) => {
                                // Determine if the specific data of *this* observation card was the last thing copied
                                const dataToCompare = obs.type === 'TOOL_EXECUTION'
                                    ? JSON.stringify(obs.data) // Compare the whole data object for tool exec card copy
                                    : (obs.type === 'PLAN'
                                        ? (obs.data.rawOutput || obs.data.plan) // Compare rawOutput or plan for plan card
                                        : (typeof obs.data === 'string' ? obs.data : JSON.stringify(obs.data)) // Default compare
                                    );
                                const isCopied = copiedData === dataToCompare;
                                const outputIsCopied = obs.type === 'TOOL_EXECUTION' && copiedData === (typeof obs.data.output === 'string' ? obs.data.output : JSON.stringify(obs.data.output, null, 2));


                                switch (obs.type) {
                                    case 'INTENT': return <IntentCard key={obs.id} data={obs.data} onCopy={onCopy} isCopied={isCopied} />;
                                    case 'PLAN': return <PlanCard key={obs.id} data={obs.data} onCopy={onCopy} isCopied={isCopied} />;
                                    case 'TOOL_CALL': return <ToolCallCard key={obs.id} data={obs.data} onCopy={onCopy} isCopied={isCopied} />;
                                    case 'TOOL_EXECUTION': return <ToolExecutionCard key={obs.id} data={obs.data} onCopy={onCopy} isCopied={isCopied} outputIsCopied={outputIsCopied} />;
                                    case 'SYNTHESIS': return <SynthesisCard key={obs.id} data={obs.data} onCopy={onCopy} isCopied={isCopied} />;
                                    case 'ERROR': return <ErrorCard key={obs.id} data={obs.data} onCopy={onCopy} isCopied={isCopied} />; // Render Error Card
                                    default:
                                        // Render a fallback for unhandled types
                                        return (
                                            <Card key={obs.id} className="bg-gray-100 dark:bg-gray-800 border-l-4 border-gray-400">
                                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4">
                                                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                                                        <Lightbulb className="h-4 w-4 text-gray-500" /> Unknown Observation
                                                    </CardTitle>
                                                    <CopyButton dataToCopy={obs.data} onCopy={onCopy} isCopied={isCopied} />
                                                </CardHeader>
                                                <CardContent className="pb-3 px-4">
                                                    <pre className="text-xs whitespace-pre-wrap break-all"><code>{JSON.stringify(obs, null, 2)}</code></pre>
                                                </CardContent>
                                            </Card>
                                        );
                                }
                            })}
                        </div>
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
};


// --- Individual Observation Card Components ---
// (Mostly unchanged, added ErrorCard, adjusted ToolExecutionCard props)
interface CardProps<T> { data: T; onCopy: (dataToCopy: string | object) => void; isCopied: boolean; }
const CopyButton: React.FC<{ dataToCopy: string | object; onCopy: (data: string | object) => void; isCopied: boolean; className?: string; tooltipText?: string }> = ({ dataToCopy, onCopy, isCopied, className, tooltipText = "Copy Data" }) => ( <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className={`h-6 w-6 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 ${isCopied ? 'text-green-600 dark:text-green-500' : ''} ${className}`} onClick={(e) => { e.stopPropagation(); onCopy(dataToCopy); }}>{isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}</Button></TooltipTrigger><TooltipContent>{isCopied ? 'Copied!' : tooltipText}</TooltipContent></Tooltip> ); // Reverted onCopy param type back to string | object
const IntentCard: React.FC<CardProps<IntentData>> = ({ data, onCopy, isCopied }) => ( <Card className="bg-white dark:bg-gray-900 border-l-4 border-blue-500"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4"><CardTitle className="text-sm font-medium flex items-center gap-2"><Target className="h-4 w-4 text-blue-500" /> Intent</CardTitle><CopyButton dataToCopy={data} onCopy={onCopy} isCopied={isCopied} /></CardHeader><CardContent className="pb-3 px-4"><p className="text-sm text-gray-700 dark:text-gray-300">{data.intent}</p></CardContent></Card> );
const PlanCard: React.FC<CardProps<PlanData>> = ({ data, onCopy, isCopied }) => ( <Card className="bg-white dark:bg-gray-900 border-l-4 border-purple-500"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4"><CardTitle className="text-sm font-medium flex items-center gap-2"><ListChecks className="h-4 w-4 text-purple-500" /> Plan</CardTitle><CopyButton dataToCopy={data.rawOutput || data.plan} onCopy={onCopy} isCopied={isCopied} /></CardHeader><CardContent className="pb-3 px-4"><div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap space-y-1">{data.plan.split('\n').map((line, index) => (<p key={index}>{line.replace(/^\d+\.\s*/, '')}</p>))}</div></CardContent></Card> );
const ToolCallCard: React.FC<CardProps<ToolCallData>> = ({ data, onCopy, isCopied }) => ( <Card className="bg-white dark:bg-gray-900 border-l-4 border-orange-500"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4"><CardTitle className="text-sm font-medium flex items-center gap-2"><Wrench className="h-4 w-4 text-orange-500" /> Tool Call</CardTitle><CopyButton dataToCopy={data} onCopy={onCopy} isCopied={isCopied} /></CardHeader><CardContent className="pb-3 px-4 space-y-2">{data.toolCalls.map((call) => (<div key={call.callId} className="p-2 border rounded bg-gray-50 dark:bg-gray-800/50 text-xs"><div className="flex justify-between items-center mb-1"><Badge variant="outline" className="text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-600">{call.toolName}</Badge><span className="text-gray-500 dark:text-gray-400 text-[10px]">ID: {call.callId}</span></div><pre className="whitespace-pre-wrap break-all bg-gray-100 dark:bg-gray-700/60 p-1.5 rounded text-[11px]"><code>{JSON.stringify(call.arguments, null, 1)}</code></pre></div>))}</CardContent></Card> );
// Added outputIsCopied prop to ToolExecutionCard
const ToolExecutionCard: React.FC<CardProps<ToolExecutionData> & { outputIsCopied: boolean }> = ({ data, onCopy, isCopied, outputIsCopied }) => { const isSuccess = data.status.toLowerCase() === 'success'; const outputString = typeof data.output === 'string' ? data.output : JSON.stringify(data.output, null, 2); return ( <Card className={`bg-white dark:bg-gray-900 border-l-4 ${isSuccess ? 'border-green-500' : 'border-red-500'}`}><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4"><CardTitle className="text-sm font-medium flex items-center gap-2"><Terminal className={`h-4 w-4 ${isSuccess ? 'text-green-500' : 'text-red-500'}`} /> Tool Execution{data.toolName && <Badge variant="secondary" className="ml-1 text-xs">{data.toolName}</Badge>}</CardTitle><CopyButton dataToCopy={data} onCopy={onCopy} isCopied={isCopied} tooltipText="Copy All Data" /></CardHeader><CardContent className="pb-3 px-4 space-y-1"><Badge variant={isSuccess ? "default" : "destructive"} className={`capitalize text-xs ${isSuccess ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border-green-300 dark:border-green-700' : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 border-red-300 dark:border-red-700'}`}>{data.status}</Badge>{data.callId && <span className="text-gray-500 dark:text-gray-400 text-[10px] ml-2"> (Call ID: {data.callId})</span>}<div className="relative group/output mt-1"><pre className="text-xs bg-gray-100 dark:bg-gray-800/50 p-2 rounded whitespace-pre-wrap break-all max-h-40 overflow-auto scrollbar-thin"><code>{outputString}</code></pre><CopyButton dataToCopy={outputString} onCopy={onCopy} isCopied={outputIsCopied} className="absolute top-1 right-1 opacity-0 group-hover/output:opacity-100 transition-opacity" tooltipText="Copy Output"/></div></CardContent></Card> ); }
const SynthesisCard: React.FC<CardProps<SynthesisData>> = ({ data, onCopy, isCopied }) => ( <Card className="bg-white dark:bg-gray-900 border-l-4 border-teal-500"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4"><CardTitle className="text-sm font-medium flex items-center gap-2"><Combine className="h-4 w-4 text-teal-500" /> Synthesis</CardTitle><CopyButton dataToCopy={data} onCopy={onCopy} isCopied={isCopied} /></CardHeader><CardContent className="pb-3 px-4"><p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{data.rawOutput}</p></CardContent></Card> );
// New Error Card Component
const ErrorCard: React.FC<CardProps<ErrorData>> = ({ data, onCopy, isCopied }) => ( <Card className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-600"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4"><CardTitle className="text-sm font-medium flex items-center gap-2 text-red-700 dark:text-red-300"><AlertTriangle className="h-4 w-4" /> Error</CardTitle><CopyButton dataToCopy={data} onCopy={onCopy} isCopied={isCopied} /></CardHeader><CardContent className="pb-3 px-4"><p className="text-sm text-red-800 dark:text-red-200">{data.message}</p>{data.details != null && (<details className="mt-1 text-xs"><summary className="cursor-pointer text-gray-500 dark:text-gray-400">Details</summary><pre className="mt-1 p-1 bg-red-100 dark:bg-red-800/40 rounded whitespace-pre-wrap break-all"><code>{JSON.stringify(data.details, null, 2)}</code></pre></details>)}</CardContent></Card> ); // Added check for data.details != null


// Export the main App component to be used as the default export for the page
export default App;
