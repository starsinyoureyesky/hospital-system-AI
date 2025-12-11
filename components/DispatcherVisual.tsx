import React, { useEffect, useState } from 'react';
import { AgentType } from '../types';

interface DispatcherVisualProps {
  targetAgent: AgentType | null;
  isThinking: boolean;
}

export const DispatcherVisual: React.FC<DispatcherVisualProps> = ({ targetAgent, isThinking }) => {
  const [activeNode, setActiveNode] = useState<number>(-1);

  // Simulation of scanning through departments
  useEffect(() => {
    if (isThinking) {
      const interval = setInterval(() => {
        setActiveNode(Math.floor(Math.random() * 4));
      }, 150);
      return () => clearInterval(interval);
    } else {
        setActiveNode(-1);
    }
  }, [isThinking]);

  const agents = [
    { id: AgentType.PATIENT_MANAGEMENT, label: "Pasien", color: "bg-emerald-500" },
    { id: AgentType.APPOINTMENT_SCHEDULER, label: "Jadwal", color: "bg-purple-500" },
    { id: AgentType.MEDICAL_RECORDS, label: "Medis", color: "bg-blue-500" },
    { id: AgentType.ADMIN_BILLING, label: "Admin", color: "bg-orange-500" },
  ];

  if (!isThinking && !targetAgent) return null;

  return (
    <div className="w-full bg-gray-900 text-white p-4 mb-4 rounded-xl shadow-lg border border-gray-700 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 animate-pulse"></div>
      
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
           <div className={`w-3 h-3 rounded-full ${isThinking ? 'bg-yellow-400 animate-ping' : 'bg-green-400'}`}></div>
           <span className="text-xs font-mono tracking-widest text-gray-400">HSMD CORE SYSTEM</span>
        </div>
        <div className="text-xs text-gray-500 font-mono">
           {isThinking ? 'ANALYZING INTENT...' : 'ROUTED'}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {agents.map((agent, idx) => {
            const isSelected = targetAgent === agent.id;
            const isScanning = isThinking && activeNode === idx;
            const isInactive = !isThinking && targetAgent && targetAgent !== agent.id;

            return (
                <div 
                    key={agent.id}
                    className={`
                        h-20 rounded-lg flex flex-col items-center justify-center transition-all duration-300 border
                        ${isSelected ? `${agent.color} border-white scale-105 shadow-[0_0_15px_rgba(255,255,255,0.5)]` : ''}
                        ${isScanning ? 'bg-gray-700 border-gray-500' : ''}
                        ${!isSelected && !isScanning ? 'bg-gray-800 border-gray-800 opacity-40' : ''}
                    `}
                >
                    <div className={`w-2 h-2 rounded-full mb-2 ${isSelected ? 'bg-white' : 'bg-gray-500'}`}></div>
                    <span className={`text-[10px] font-bold uppercase ${isSelected ? 'text-white' : 'text-gray-400'}`}>{agent.label}</span>
                </div>
            )
        })}
      </div>
    </div>
  );
};