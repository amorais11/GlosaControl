
import { GoogleGenAI, Type } from "@google/genai";
import { GlosaReportItem } from "../types";

export const analyzePdfForGlosas = async (base64Data: string, mimeType: string): Promise<GlosaReportItem[]> => {
  // Always create a new instance to ensure the latest API key is used
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  const prompt = `
    Analise este documento de Recibo Analítico de Pagamento da Unimed.
    Extraia todos os procedimentos listados.
    Para cada procedimento, identifique:
    1. Nome do Beneficiário (Paciente)
    2. Data do atendimento (formato DD/MM/AAAA)
    3. Nome do Serviço/Procedimento
    4. Código TUSS do procedimento (geralmente um número de 8 a 10 dígitos)
    5. Valor de Honorários (Hono)
    6. Valor da Glosa (Glosa)
    7. Valor Total pago
    
    Um item é considerado uma GLOSA se o campo 'Glosa' tiver um valor diferente de zero ou se houver uma justificativa de glosa associada ao procedimento (como "NAO AUTORIZADO", "DUPLICIDADE", etc).
    
    Retorne os dados estritamente em JSON seguindo o esquema fornecido.
  `;

  try {
    // Corrected model name to 'gemini-3-flash-preview' as per guidelines
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { inlineData: { data: base64Data, mimeType: mimeType } },
            { text: prompt }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              patientName: { type: Type.STRING },
              date: { type: Type.STRING },
              procedure: { type: Type.STRING },
              tussCode: { type: Type.STRING },
              honoAmount: { type: Type.NUMBER },
              glosaAmount: { type: Type.NUMBER },
              totalPaid: { type: Type.NUMBER },
              isGlosa: { type: Type.BOOLEAN }
            },
            required: ["patientName", "date", "procedure", "honoAmount", "glosaAmount", "totalPaid", "isGlosa"]
          }
        }
      }
    });

    const result = JSON.parse(response.text || '[]');
    return result;
  } catch (error: any) {
    console.error("Erro ao analisar documento:", error);
    
    // Check for specific 404 error mentioned by the user
    if (error?.message?.includes("Requested entity was not found") || error?.status === "NOT_FOUND") {
      throw new Error("Modelo não encontrado ou erro de permissão. Por favor, verifique sua chave de API e se o faturamento está ativo no Google Cloud Console.");
    }
    
    throw error;
  }
};
