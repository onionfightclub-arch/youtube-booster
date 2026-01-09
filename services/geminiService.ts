
import { GoogleGenAI, Type } from "@google/genai";
import { VideoMetadata, AnalysisResult, IntelligenceResult } from "../types.ts";

export const analyzeMetadata = async (metadata: VideoMetadata): Promise<AnalysisResult> => {
  // Initialize right before call to ensure fresh environment access
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Act as a world-class YouTube SEO expert and strategist. Analyze the following video metadata and provide a detailed grading report.
    
    TITLE: ${metadata.title}
    DURATION: ${metadata.duration || 'Not specified'}
    DESCRIPTION: ${metadata.description}
    TAGS: ${metadata.tags}
    ${metadata.script ? `SCRIPT/TRANSCRIPT CONTEXT: ${metadata.script}` : ''}

    ${metadata.competitorUrl || metadata.competitorNotes ? `
    COMPETITIVE CONTEXT:
    Competitor URL: ${metadata.competitorUrl || 'Not provided'}
    Competitor Notes: ${metadata.competitorNotes || 'Not provided'}
    ` : ''}

    Rules for grading:
    1. Title: Check length, keywords, and CTR.
    2. Description: Evaluate structural blocks and provide specific templates.
    3. Formatting: Each 'structuralSuggestion' MUST follow: "Category | Title | Suggestion | Template: [Text]"
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      thinkingConfig: { thinkingBudget: 32768 },
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
              structuralSuggestions: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING }
              },
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
          competitiveAudit: {
            type: Type.OBJECT,
            properties: {
              userStrengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              competitorStrengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              gapAnalysis: { type: Type.STRING },
              strategicMove: { type: Type.STRING },
            },
            required: ["userStrengths", "competitorStrengths", "gapAnalysis", "strategicMove"],
          },
        },
        required: ["overallScore", "summary", "title", "description", "tags"],
      },
    },
  });

  return JSON.parse(response.text);
};

export const improveDescription = async (
  currentDescription: string, 
  title: string,
  recommendations: string[],
  duration?: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Act as a professional YouTube Copywriter and SEO expert. Rewrite and expand the following description.
    TITLE: ${title}
    DURATION: ${duration || 'Unknown'}
    DESC: ${currentDescription}
    RECS: ${recommendations.join(', ')}
    
    Requirements: Hook, Value Prop, Timestamps (based on ${duration || 'video'}), Socials, and CTA.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: [{ parts: [{ text: prompt }] }],
  });

  return response.text?.trim() || 'Failed to generate optimized description.';
};

export const fetchMarketIntelligence = async (niche: string): Promise<IntelligenceResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Fetch real-time YouTube market intelligence for: "${niche}".
    Identify trending topics, keywords (Search Volume/Competition), and content gaps.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  const sources = groundingChunks
    .filter((chunk: any) => chunk.web)
    .map((chunk: any) => ({
      uri: chunk.web.uri,
      title: chunk.web.title,
    }));

  return {
    text: response.text || "No intelligence data found.",
    sources: sources,
  };
};
