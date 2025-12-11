import { GoogleGenAI, Type } from "@google/genai";
import { AgentType } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * THE DISPATCHER AGENT
 * Analyzes intent and routes to the correct sub-agent.
 */
export const dispatchQuery = async (userQuery: string): Promise<AgentType> => {
  const model = "gemini-2.5-flash";
  
  const systemInstruction = `
  Anda adalah "Hospital System Main Dispatcher".
  PERAN ANDA HANYA UNTUK MENGARAHKAN PERMINTAAN ke salah satu sub-agen.
  JANGAN MENJAWAB PERTANYAAN ITU SENDIRI.
  
  [ROUTING RULES]
  1. JIKA terkait informasi dasar pasien (daftar, update data): OUTPUT: [[Manajemen_Pasien]]
  2. JIKA terkait janji temu (buat, ubah, batal): OUTPUT: [[Penjadwal_Janji_Temu]]
  3. JIKA terkait rekam medis (lab, diagnosa, edukasi, gambar medis): OUTPUT: [[Rekam_Medis]]
  4. JIKA terkait admin/penagihan (biaya, asuransi, umum): OUTPUT: [[Administratif_Penagihan]]
  5. JIKA ambigu: OUTPUT: [[Klarifikasi_Diperlukan]]

  Hanya outputkan tag tersebut.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: userQuery,
      config: {
        systemInstruction,
        temperature: 0.1, // Low temperature for deterministic routing
      }
    });

    const text = response.text?.trim() || "";
    
    if (text.includes("[[Manajemen_Pasien]]")) return AgentType.PATIENT_MANAGEMENT;
    if (text.includes("[[Penjadwal_Janji_Temu]]")) return AgentType.APPOINTMENT_SCHEDULER;
    if (text.includes("[[Rekam_Medis]]")) return AgentType.MEDICAL_RECORDS;
    if (text.includes("[[Administratif_Penagihan]]")) return AgentType.ADMIN_BILLING;
    
    return AgentType.CLARIFICATION;
  } catch (error) {
    console.error("Dispatch Error:", error);
    return AgentType.CLARIFICATION;
  }
};

/**
 * MEDICAL RECORDS AGENT (Multimodal)
 * Uses Google Search for accuracy and Image Generation for education.
 */
export const handleMedicalQuery = async (query: string): Promise<{ text: string; imageUrl?: string; sources?: { uri: string; title: string }[] }> => {
  // Check if user wants an image visualization
  const isImageRequest = query.toLowerCase().includes("gambar") || query.toLowerCase().includes("visual") || query.toLowerCase().includes("foto");

  if (isImageRequest) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: query,
        config: {
            // Using flash-image to generate the image based on prompt
        }
      });
        
      // Extract image if available (Flash Image generates base64)
      // Note: In a real 'generateContent' with flash-image, it might return text describing it or the image data depending on setup.
      // For this demo, we will use the specific 'imagen' style call if available or parse the parts.
      // However, @google/genai 'generateContent' on flash-image returns inlineData.
      
      let imageUrl = undefined;
      let textResponse = "Berikut adalah visualisasi yang Anda minta.";

      for (const candidate of response.candidates || []) {
          for (const part of candidate.content.parts) {
             if (part.inlineData) {
                 imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
             } else if (part.text) {
                 textResponse = part.text;
             }
          }
      }
      
      return { text: textResponse, imageUrl };

    } catch (e) {
      console.error("Image Gen Error", e);
      return { text: "Maaf, saya tidak dapat membuat gambar saat ini. " + (e as Error).message };
    }
  } else {
    // Text/Research Request using Google Search Grounding
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash", // Or gemini-3-pro-preview for complex reasoning
        contents: query,
        config: {
          tools: [{ googleSearch: {} }], // Grounding enabled
          systemInstruction: "Anda adalah Agen Rekam Medis & Edukasi. Berikan jawaban akurat, empatik, dan medis berdasarkan data. Selalu sertakan sumber jika menggunakan Google Search."
        }
      });

      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const sources = groundingChunks?.map((chunk: any) => chunk.web).filter((w: any) => w) || [];

      return { 
        text: response.text || "Tidak ada informasi ditemukan.", 
        sources 
      };
    } catch (e) {
        console.error("Medical Text Error", e);
        return { text: "Terjadi kesalahan saat mencari informasi medis." };
    }
  }
};

/**
 * GENERIC AGENT HANDLER
 * For Admin, Appointment, Patient Management
 */
export const handleGenericAgent = async (agent: AgentType, query: string): Promise<string> => {
  let instruction = "";
  
  switch (agent) {
    case AgentType.APPOINTMENT_SCHEDULER:
      instruction = "Anda adalah Agen Penjadwalan RS. Bantu pasien membuat, ubah, atau batal janji. Tanyakan nama dokter, poli, dan waktu yang diinginkan. Bersikaplah efisien.";
      break;
    case AgentType.PATIENT_MANAGEMENT:
      instruction = "Anda adalah Agen Manajemen Pasien. Bantu pendaftaran atau update data. Tanyakan NIK atau No Rekam Medis untuk verifikasi.";
      break;
    case AgentType.ADMIN_BILLING:
      instruction = "Anda adalah Agen Admin & Keuangan. Jawab pertanyaan seputar biaya, BPJS, jam operasional, dan fasilitas. Bersikaplah formal dan membantu.";
      break;
    case AgentType.CLARIFICATION:
    default:
      instruction = "Anda adalah asisten RS. Permintaan pengguna sebelumnya tidak jelas. Mohon minta mereka mengulangi atau memberikan detail lebih spesifik agar bisa diarahkan ke departemen yang benar.";
      break;
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: query,
      config: { systemInstruction: instruction }
    });
    return response.text || "Maaf, bisa diulangi?";
  } catch (e) {
    return "Maaf sistem sedang sibuk.";
  }
};