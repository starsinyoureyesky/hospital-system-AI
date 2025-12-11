import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AgentType, Message } from './types';
import { dispatchQuery, handleGenericAgent, handleMedicalQuery } from './services/geminiService';
import { ChatMessage } from './components/ChatMessage';
import { DispatcherVisual } from './components/DispatcherVisual';

const App = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'ai',
      content: 'Halo. Saya adalah Dispatcher Utama Rumah Sakit. Apa yang bisa saya bantu hari ini? (Contoh: "Daftar pasien", "Cek hasil lab", "Tanya biaya")',
      timestamp: new Date(),
      agent: AgentType.DISPATCHER
    }
  ]);
  const [currentAgent, setCurrentAgent] = useState<AgentType | null>(null);
  const [isDispatcherThinking, setIsDispatcherThinking] = useState(false);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isDispatcherThinking, isAgentTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    
    // Process
    await processUserMessage(userMsg.content);
  };

  const processUserMessage = async (text: string) => {
    // 1. If we are already in a specific agent session (except clarification), 
    // we could stick to it, OR strictly follow the "Dispatcher always routes" architecture.
    // The architecture implies a Main Dispatcher receives *incoming* requests. 
    // For a smoother chat, we'll re-evaluate intent every time to allow context switching.
    
    setIsDispatcherThinking(true);
    setCurrentAgent(null); // Reset visualization to neutral state

    // Slight delay for visual effect
    await new Promise(r => setTimeout(r, 800));

    // 2. Dispatch
    const targetAgent = await dispatchQuery(text);
    setCurrentAgent(targetAgent);
    setIsDispatcherThinking(false);

    // 3. Execute Sub-Agent Logic
    setIsAgentTyping(true);

    let responseText = "";
    let imageUrl: string | undefined;
    let sources: { uri: string; title: string }[] | undefined;

    if (targetAgent === AgentType.MEDICAL_RECORDS) {
      // Specialized Multimodal Agent
      const result = await handleMedicalQuery(text);
      responseText = result.text;
      imageUrl = result.imageUrl;
      sources = result.sources;
    } else {
      // Standard Generic Agent
      responseText = await handleGenericAgent(targetAgent, text);
    }

    const aiMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'ai',
      content: responseText,
      agent: targetAgent,
      timestamp: new Date(),
      metadata: {
        imageUrl,
        sources
      }
    };

    setMessages(prev => [...prev, aiMsg]);
    setIsAgentTyping(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-xl overflow-hidden h-[85vh] flex flex-col relative">
        
        {/* Header */}
        <header className="bg-white border-b border-gray-100 p-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-200">
              AI
            </div>
            <div>
              <h1 className="font-bold text-gray-800 text-sm md:text-base">Hospital System</h1>
              <p className="text-xs text-gray-500">Main Dispatcher Agent</p>
            </div>
          </div>
          <div className="text-xs text-gray-400 font-medium">
            Powered by Gemini 2.5
          </div>
        </header>

        {/* Chat Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 bg-[#f8fafc] scroll-smooth"
        >
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}

          {/* Logic Visualization */}
          {(isDispatcherThinking || (currentAgent && isAgentTyping)) && (
             <div className="max-w-[85%] md:max-w-[70%] mb-6">
                <DispatcherVisual 
                  targetAgent={currentAgent} 
                  isThinking={isDispatcherThinking} 
                />
             </div>
          )}

          {/* Typing Indicator */}
          {isAgentTyping && (
             <div className="flex items-center space-x-2 p-4 bg-white rounded-2xl rounded-tl-none w-24 border border-gray-100 mb-4">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
             </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-gray-100">
          <div className="relative flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ketik permintaan Anda (misal: 'Daftar ke Poli Anak', 'Hasil Lab', 'Gambar anatomi jantung')..."
              className="w-full bg-gray-50 text-gray-800 rounded-xl pl-4 pr-12 py-4 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all border border-gray-200"
              disabled={isDispatcherThinking || isAgentTyping}
            />
            
            <button
              onClick={handleSend}
              disabled={!input.trim() || isDispatcherThinking || isAgentTyping}
              className={`absolute right-2 p-2 rounded-lg transition-colors
                ${input.trim() 
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md' 
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
          <div className="text-center mt-2">
            <span className="text-[10px] text-gray-400">
              System: Hospital Main Dispatcher • Architecture: Agent-Oriented
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default App;