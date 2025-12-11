import React from 'react';
import { AgentType } from '../types';

interface AgentBadgeProps {
  type: AgentType;
}

const config = {
  [AgentType.DISPATCHER]: { color: 'bg-gray-800', text: 'Main Dispatcher', icon: '⚡' },
  [AgentType.PATIENT_MANAGEMENT]: { color: 'bg-emerald-600', text: 'Manajemen Pasien', icon: '👤' },
  [AgentType.APPOINTMENT_SCHEDULER]: { color: 'bg-purple-600', text: 'Penjadwalan', icon: '📅' },
  [AgentType.MEDICAL_RECORDS]: { color: 'bg-blue-600', text: 'Rekam Medis (AI)', icon: '🩺' },
  [AgentType.ADMIN_BILLING]: { color: 'bg-orange-600', text: 'Admin & Keuangan', icon: '💳' },
  [AgentType.CLARIFICATION]: { color: 'bg-yellow-600', text: 'Klarifikasi', icon: '❓' },
};

export const AgentBadge: React.FC<AgentBadgeProps> = ({ type }) => {
  const settings = config[type] || config[AgentType.DISPATCHER];

  return (
    <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-white shadow-sm ${settings.color} transition-all duration-500`}>
      <span className="mr-1.5 text-sm">{settings.icon}</span>
      {settings.text}
    </div>
  );
};