import React, { useState, useRef, useEffect } from 'react';
import { AgentType, Message } from './types';
import { dispatchQuery, handleGenericAgent, handleMedicalQuery, setApiKey } from './services/geminiService';
import { ChatMessage } from './components/ChatMessage';
import { DispatcherVisual } from './components/DispatcherVisual';

const App = () => {
  const [hasKey, setHasKey] = useState(false);
  const [customKeyInput, setCustomKeyInput] = useState('');
  const [isAIStudioEnvironment, setIsAIStudioEnvironment] = useState(false);
  
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'ai',
      content: 'Halo. Saya adalah Dispatcher Utama Rumah Sakit. Apa yang bisa saya bantu hari ini?\n\nCoba perintah seperti:\n- "Buatkan video animasi detak jantung"\n- "Verifikasi SPJ nomor 12345"\n- "Daftar pasien baru"',
      timestamp: new Date(),
      agent: AgentType.DISPATCHER
    }
  ]);
  const [currentAgent, setCurrentAgent] = useState<AgentType | null>(null);
  const [isDispatcherThinking, setIsDispatcherThinking] = useState(false);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Check Environment and API Key on Mount
  useEffect(() => {
    const checkKey = async () => {
      // 1. Check for AI Studio environment (Project IDX / Google Internal)
      const aiStudio = (window as any).aistudio;
      if (aiStudio && aiStudio.hasSelectedApiKey) {
        setIsAIStudioEnvironment(true);
        const selected = await aiStudio.hasSelectedApiKey();
        if (selected) {
          setHasKey(true);
        }
      } 
      // 2. Check if Env var is already baked in (e.g. Local dev with .env)
      else if (process.env.API_KEY) {
        setApiKey(process.env.API_KEY);
        setHasKey(true);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    const aiStudio = (window as any).aistudio;
    if (aiStudio && aiStudio.openSelectKey) {
      await aiStudio.openSelectKey();
      // Assume success after dialog interaction to avoid race conditions
      setHasKey(true);
    }
  };

  const handleManualKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customKeyInput.trim().length > 10) {
      setApiKey(customKeyInput.trim());
      setHasKey(true);
    }
  };

  // Auto scroll
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
    
    await processUserMessage(userMsg.content);
  };

  const processUserMessage = async (text: string) => {
    setIsDispatcherThinking(true);
    setCurrentAgent(null);

    await new Promise(r => setTimeout(r, 800));

    // 1. Dispatch
    const targetAgent = await dispatchQuery(text);
    setCurrentAgent(targetAgent);
    setIsDispatcherThinking(false);

    // 2. Execute Sub-Agent
    setIsAgentTyping(true);

    let responseText = "";
    let imageUrl: string | undefined;
    let videoUrl: string | undefined;
    let sources: { uri: string; title: string }[] | undefined;

    if (targetAgent === AgentType.MEDICAL_RECORDS) {
      const result = await handleMedicalQuery(text);
      responseText = result.text;
      imageUrl = result.imageUrl;
      videoUrl = result.videoUrl;
      sources = result.sources;
    } else {
      responseText = await handleGenericAgent(targetAgent, text);
    }

    const aiMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'ai',
      content: responseText,
      agent: targetAgent,
      timestamp: new Date(),
      metadata: { imageUrl, videoUrl, sources }
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

  if (!hasKey) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
        <div className="text-center max-w-md w-full bg-white p-8 rounded-2xl shadow-xl">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-xl shadow-blue-200">
            <span className="text-3xl">🏥</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Hospital AI System</h1>
          <p className="text-gray-500 mb-8 text-sm">
            Untuk menggunakan fitur Intelligent Dispatcher, Veo Video, dan Grounding, diperlukan akses Gemini API Key.
          </p>
          
          {isAIStudioEnvironment ? (
            <button 
              onClick={handleSelectKey}
              className="w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-xl hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Connect Gemini API Key (AI Studio)
            </button>
          ) : (
            <form onSubmit={handleManualKeySubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Enter your Gemini API Key</label>
                <input 
                  type="password"
                  value={customKeyInput}
                  onChange={(e) => setCustomKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
              <button 
                type="submit"
                disabled={!customKeyInput}
                className={`w-full font-semibold py-3 px-6 rounded-xl transition-all shadow-lg 
                  ${customKeyInput ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-xl transform hover:-translate-y-0.5' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
              >
                Start System
              </button>
            </form>
          )}

          <p className="mt-6 text-xs text-gray-400 border-t pt-4">
            Get your key at <a href="https://aistudio.google.com/app/apikey" target="_blank" className="underline hover:text-blue-500">Google AI Studio</a>.
            <br/>
            Pastikan project GCP Anda memiliki billing aktif untuk fitur Veo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4 font-inter">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden h-[90vh] flex flex-col relative border border-gray-100">
        
        {/* Header */}
        <header className="bg-white border-b border-gray-100 p-4 flex items-center justify-between z-10 backdrop-blur-sm bg-opacity-90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-100">
              <span className="text-xl">✚</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-800 text-sm md:text-base tracking-tight">Hospital Intelligent System</h1>
              <p className="text-xs text-gray-500 font-medium">Main Dispatcher • Gemini 2.5</p>
            </div>
          </div>
          <div className="hidden md:flex items-center space-x-2 text-xs font-medium text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span>System Active</span>
          </div>
        </header>

        {/* Chat Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50 scroll-smooth"
        >
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}

          {/* Logic Visualization */}
          {(isDispatcherThinking || (currentAgent && isAgentTyping)) && (
             <div className="max-w-[85%] md:max-w-[70%] mb-6 animate-fade-in-up">
                <DispatcherVisual 
                  targetAgent={currentAgent} 
                  isThinking={isDispatcherThinking} 
                />
             </div>
          )}

          {/* Typing Indicator */}
          {isAgentTyping && (
             <div className="flex items-center space-x-1.5 p-4 bg-white rounded-2xl rounded-tl-none w-20 border border-gray-100 mb-4 shadow-sm">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-100"></div>
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce delay-200"></div>
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
              placeholder="Jelaskan kebutuhan Anda (Contoh: 'Buatkan video operasi mata', 'Cek status SPJ A-99', 'Daftar poli THT')..."
              className="w-full bg-gray-50 text-gray-800 rounded-xl pl-5 pr-14 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all border border-gray-200 shadow-sm text-sm"
              disabled={isDispatcherThinking || isAgentTyping}
            />
            
            <button
              onClick={handleSend}
              disabled={!input.trim() || isDispatcherThinking || isAgentTyping}
              className={`absolute right-2 p-2.5 rounded-lg transition-all duration-200
                ${input.trim() 
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:scale-105 active:scale-95' 
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </button>
          </div>
          <div className="flex justify-center mt-3 gap-4 text-[10px] text-gray-400 font-mono">
            <span>Agent-Oriented Architecture</span>
            <span>•</span>
            <span>Multimodal Gemini 2.5</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;