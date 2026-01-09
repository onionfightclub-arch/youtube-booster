
import { GoogleGenAI, Type } from "@google/genai";
import { VideoMetadata, AnalysisResult } from "../types.ts";

/**
 * Helper to extract JSON from model response text which might be wrapped in markdown.
 */
const safeJsonParse = (text: string) => {
  try {
    return JSON.parse(text);
  } catch (e) {
    const cleaned = text.replace(/```json\n?|```/g, "").trim();
    try {
      return JSON.parse(cleaned);
    } catch (e2) {
      console.error("JSON Parse Error. Original text:", text);
      throw new Error("The AI returned an invalid response format. This usually means the model's output was interrupted.");
    }
  }
};

const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined" || apiKey === "") {
    throw new Error("Missing Gemini API Key. Please ensure the API_KEY environment variable is set.");
  }
  return new GoogleGenAI({ apiKey });
};

export const analyzeMetadata = async (metadata: VideoMetadata): Promise<AnalysisResult> => {
  const ai = getAI();

  const prompt = `
    Act as a world-class YouTube SEO expert. Analyze the following video metadata and provide a JSON report.
    
    TITLE: ${metadata.title}
    DURATION: ${metadata.duration || 'Not specified'}
    DESCRIPTION: ${metadata.description}
    TAGS: ${metadata.tags}
    ${metadata.script ? `SCRIPT CONTEXT: ${metadata.script}` : ''}

    Rules for grading:
    - Score each section (Title, Description, Tags) out of 100.
    - Title: Analyze keyword placement and CTR potential.
    - Description: Check for hooks, value propositions, and social links.
    - Tags: Provide specificTag strings that would improve SEO.
    - IMPORTANT: Each 'structuralSuggestions' entry MUST follow this exact string format: 
      "Category | Title | Suggestion | Template: [Full text to copy]"
    
    Return ONLY valid JSON.
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
    throw new Error(error.message || "Failed to contact Gemini API.");
  }
};

export const improveDescription = async (
  currentDescription: string, 
  title: string,
  recommendations: string[],
  duration?: string
): Promise<string> => {
  const ai = getAI();

  const prompt = `
    Rewrite this YouTube description for maximum SEO:
    TITLE: ${title}
    DURATION: ${duration || 'Unknown'}
    CURRENT: ${currentDescription}
    RECS: ${recommendations.join(', ')}
    
    Include a Hook, Value Prop, Timestamps, Social placeholders, and a CTA.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts: [{ text: prompt }] }],
  });

  return response.text?.trim() || 'Failed to generate improved description.';
};
