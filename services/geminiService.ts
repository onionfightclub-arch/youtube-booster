
import { GoogleGenAI, Type } from "@google/genai";
import { VideoMetadata, AnalysisResult } from "../types.ts";

/**
 * Helper to extract JSON from model response text.
 */
const safeJsonParse = (text: string) => {
  try {
    return JSON.parse(text);
  } catch (e) {
    const cleaned = text.replace(/```json\n?|```/g, "").trim();
    try {
      return JSON.parse(cleaned);
    } catch (e2) {
      throw new Error("Invalid AI response format. Please try again.");
    }
  }
};

export const analyzeMetadata = async (metadata: VideoMetadata): Promise<AnalysisResult> => {
  // Directly initialize per instructions
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Act as a world-class YouTube SEO expert. Analyze the following video metadata and provide a JSON report.
    
    TITLE: ${metadata.title}
    DURATION: ${metadata.duration || 'Not specified'}
    DESCRIPTION: ${metadata.description}
    TAGS: ${metadata.tags}
    ${metadata.script ? `SCRIPT CONTEXT: ${metadata.script}` : ''}

    Rules for grading:
    - Score each section (Title, Description, Tags) out of 100.
    - Return ONLY valid JSON matching the schema.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallScore: { type: Type.NUMBER },
            summary: { type: Type.STRING },
            title: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                feedback: { type: Type.ARRAY, items: { type: Type.STRING } },
                recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
                suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ["score", "feedback", "recommendations", "suggestions"],
            },
            description: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                feedback: { type: Type.ARRAY, items: { type: Type.STRING } },
                recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
                suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
                structuralSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ["score", "feedback", "recommendations", "suggestions", "structuralSuggestions"],
            },
            tags: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.NUMBER },
                feedback: { type: Type.ARRAY, items: { type: Type.STRING } },
                recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
                suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
                specificTags: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ["score", "feedback", "recommendations", "suggestions", "specificTags"],
            },
          },
          required: ["overallScore", "summary", "title", "description", "tags"],
        },
      },
    });

    if (!response.text) throw new Error("Empty response from AI.");
    return safeJsonParse(response.text);
  } catch (error: any) {
    console.error("API Error:", error);
    if (error.message?.includes("entity was not found") || error.message?.includes("API_KEY_INVALID")) {
      throw new Error("REAUTH_REQUIRED");
    }
    throw new Error(error.message || "Failed to contact Gemini API.");
  }
};
