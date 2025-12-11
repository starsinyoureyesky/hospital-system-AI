export enum AgentType {
  DISPATCHER = 'DISPATCHER',
  PATIENT_MANAGEMENT = 'Manajemen_Pasien',
  APPOINTMENT_SCHEDULER = 'Penjadwal_Janji_Temu',
  MEDICAL_RECORDS = 'Rekam_Medis',
  ADMIN_BILLING = 'Administratif_Penagihan',
  CLARIFICATION = 'Klarifikasi_Diperlukan'
}

export interface Message {
  id: string;
  role: 'user' | 'ai' | 'system';
  content: string;
  agent?: AgentType; // Which agent generated this message
  timestamp: Date;
  metadata?: {
    imageUrl?: string;
    sources?: { uri: string; title: string }[];
    isThinking?: boolean;
  };
}

export interface AgentConfig {
  id: AgentType;
  name: string;
  description: string;
  color: string;
  icon: string;
}