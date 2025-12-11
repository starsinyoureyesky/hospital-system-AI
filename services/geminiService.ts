import { GoogleGenAI, Type, FunctionDeclaration, Tool } from "@google/genai";
import { AgentType } from "../types";

// Dynamic API Key storage for Netlify/Web support
// Safely check for process.env to avoid ReferenceError in strict browser environments
const getEnvKey = () => {
  // 1. Check Vite Environment Variable (Standard for Vite apps)
  if (import.meta.env && import.meta.env.VITE_API_KEY) {
    return import.meta.env.VITE_API_KEY;
  }
  
  // 2. Check Node Environment Variable (Legacy/Dev)
  try {
    // @ts-ignore
    if (typeof process !== "undefined" && process.env && process.env.API_KEY) {
      // @ts-ignore
      return process.env.API_KEY;
    }
  } catch (e) {
    // Ignore error if process is not defined
  }
  return "";
};

let dynamicApiKey = getEnvKey();

export const setApiKey = (key: string) => {
  dynamicApiKey = key;
};

// Initialize Gemini Client
const getAI = () => {
  if (!dynamicApiKey) {
    console.warn("API Key is missing. Please provide an API Key.");
  }
  return new GoogleGenAI({ apiKey: dynamicApiKey });
};

/**
 * THE DISPATCHER AGENT
 * Analyzes intent and routes to the correct sub-agent.
 */
export const dispatchQuery = async (userQuery: string): Promise<AgentType> => {
  const ai = getAI();
  const model = "gemini-2.5-flash";
  
  const systemInstruction = `
  Anda adalah "Hospital System Main Dispatcher".
  PERAN ANDA HANYA UNTUK MENGARAHKAN PERMINTAAN ke salah satu sub-agen.
  JANGAN MENJAWAB PERTANYAAN ITU SENDIRI.
  
  [ROUTING RULES]
  1. JIKA terkait informasi dasar pasien (daftar, update data): OUTPUT: [[Manajemen_Pasien]]
  2. JIKA terkait janji temu (buat, ubah, batal): OUTPUT: [[Penjadwal_Janji_Temu]]
  3. JIKA terkait rekam medis (lab, diagnosa, edukasi, gambar/video medis): OUTPUT: [[Rekam_Medis]]
  4. JIKA terkait admin/penagihan (biaya, asuransi, verifikasi SPJ): OUTPUT: [[Administratif_Penagihan]]
  5. JIKA ambigu: OUTPUT: [[Klarifikasi_Diperlukan]]

  Hanya outputkan tag tersebut.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: userQuery,
      config: {
        systemInstruction,
        temperature: 0.1,
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
 * Capabilities: Google Search (Grounding), Image Generation (Imagen), Video Generation (Veo)
 */
export const handleMedicalQuery = async (query: string): Promise<{ text: string; imageUrl?: string; videoUrl?: string; sources?: { uri: string; title: string }[] }> => {
  const ai = getAI();
  const lowerQuery = query.toLowerCase();
  
  // 1. Check for Video Request (Veo)
  if (lowerQuery.includes("video") || lowerQuery.includes("animasi") || lowerQuery.includes("gerak")) {
    try {
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: `Medical visualization: ${query}`,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '16:9'
        }
      });

      // Polling for video completion
      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({operation: operation});
      }

      const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (videoUri) {
         // Append API key for secure fetching
         const finalVideoUrl = `${videoUri}&key=${dynamicApiKey}`;
         return {
             text: "Berikut adalah video visualisasi medis yang Anda minta.",
             videoUrl: finalVideoUrl
         };
      }
      return { text: "Maaf, gagal membuat video saat ini." };

    } catch (e) {
      console.error("Video Gen Error", e);
      return { text: "Layanan video sedang sibuk. Mohon coba lagi nanti." };
    }
  }

  // 2. Check for Image Request
  if (lowerQuery.includes("gambar") || lowerQuery.includes("visual") || lowerQuery.includes("foto")) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: query,
      });
      
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
      return { text: "Maaf, tidak dapat membuat gambar saat ini." };
    }
  } 
  
  // 3. Text/Research Request (Search Grounding)
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", 
      contents: query,
      config: {
        tools: [{ googleSearch: {} }],
        systemInstruction: "Anda adalah Agen Rekam Medis. Berikan jawaban medis yang akurat dan berbasis data. Gunakan Google Search untuk verifikasi."
      }
    });

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const sources = groundingChunks?.map((chunk: any) => chunk.web).filter((w: any) => w) || [];

    return { 
      text: response.text || "Tidak ada informasi ditemukan.", 
      sources 
    };
  } catch (e) {
      return { text: "Terjadi kesalahan sistem medis." };
  }
};

/**
 * GENERIC AGENT HANDLER
 * Supports Function Calling for Admin/Billing
 */
export const handleGenericAgent = async (agent: AgentType, query: string): Promise<string> => {
  const ai = getAI();
  let instruction = "";
  let tools: Tool[] = [];

  // MOCK DATABASE for verification
  const checkSPJ = (id: string) => {
      const status = ["Verified", "Pending", "Rejected"][Math.floor(Math.random() * 3)];
      return { id, status, timestamp: new Date().toISOString() };
  };

  if (agent === AgentType.ADMIN_BILLING) {
      instruction = "Anda adalah Agen Admin & Keuangan. Anda memiliki akses ke alat verifikasi SPJ. Gunakan alat tersebut jika pengguna menanyakan status SPJ.";
      tools = [{
        functionDeclarations: [{
            name: "verifySPJ",
            description: "Verifikasi status Surat Pertanggung Jawaban (SPJ) atau klaim.",
            parameters: {
                type: Type.OBJECT,
                properties: {
                    documentId: { type: Type.STRING, description: "Nomor ID Dokumen atau SPJ" }
                },
                required: ["documentId"]
            }
        }]
      }];
  } else if (agent === AgentType.APPOINTMENT_SCHEDULER) {
      instruction = "Anda adalah Agen Penjadwalan RS. Bantu pasien membuat janji. Tanyakan poli dan dokter.";
  } else if (agent === AgentType.PATIENT_MANAGEMENT) {
      instruction = "Anda adalah Agen Manajemen Pasien. Bantu pendaftaran. Tanyakan NIK.";
  } else {
      instruction = "Anda adalah asisten klarifikasi. Mohon minta detail lebih lanjut.";
  }

  try {
    // 1. Initial Call
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: query,
      config: { 
          systemInstruction: instruction,
          tools: tools.length > 0 ? tools : undefined 
      }
    });

    // 2. Handle Function Call (Admin Agent)
    const functionCalls = response.functionCalls;
    if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        if (call.name === "verifySPJ") {
            const docId = (call.args as any).documentId;
            const result = checkSPJ(docId);
            
            // Send result back to model
            const finalResponse = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: [
                    { role: 'user', parts: [{ text: query }] },
                    { role: 'model', parts: [{ functionCall: call }] },
                    { role: 'function', parts: [{ functionResponse: { name: call.name, response: { result } } }] }
                ]
            });
            return finalResponse.text || "Status SPJ telah diverifikasi.";
        }
    }

    return response.text || "Maaf, bisa diulangi?";
  } catch (e) {
    console.error(e);
    return "Sistem sedang sibuk. Pastikan API Key valid.";
  }
};