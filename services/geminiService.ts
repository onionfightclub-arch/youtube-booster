
import { GoogleGenAI, Type } from "@google/genai";
import { VideoMetadata, AnalysisResult, IntelligenceResult } from "../types";

export const analyzeMetadata = async (metadata: VideoMetadata): Promise<AnalysisResult> => {
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
    1. Title: Check length (50-70 chars ideal), keyword placement, click-through-rate potential.
    2. Description (Content Strategy): 
       - Evaluate "The Hook" (first 200 characters).
       - Identify MISSING structural blocks.
       - IMPORTANT: For 'structuralSuggestions', detect what is missing and provide a specific actionable template.
       - Format each suggestion exactly as: "Category | Title | Suggestion | Template: [Full text to copy]"
       - REQUIRED CATEGORIES TO CHECK:
         - ABOUT: A "About the Video" section. Based on the title/script, provide a specific 2-sentence summary template.
         - SOCIAL: A "Connect with Me" section. Template should include placeholders like @[YourHandle] for Instagram, Twitter, and TikTok.
         - CTA: A specific call-to-action (e.g., "Get the free resource mentioned in the video at [link]").
         - TIMESTAMPS: Suggest 3-5 key timestamps if a script is provided or if duration is known.
         - DISCLAIMER: An affiliate or educational disclaimer if relevant.
    3. Tags: Relevance and search volume potential.

    4. Competitive Audit (CRITICAL): If competitive context is provided, compare the user's approach with the competitor. 
       Identify specific SEO gaps, content opportunities (topics they missed), and unique advantages the user has.

    Provide scores from 0 to 100.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      thinkingConfig: { thinkingBudget: 16384 },
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
                items: { type: Type.STRING },
                description: "Format: 'Category | Title | Suggestion | Template: [Text]'"
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
  recommendations: string[]
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Act as a professional YouTube Copywriter and SEO expert. Rewrite and expand the following video description to maximize engagement and keyword relevance.
    
    ORIGINAL TITLE: ${title}
    ORIGINAL DESCRIPTION: ${currentDescription}
    
    KEY SEO RECOMMENDATIONS TO APPLY:
    ${recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

    Structure Requirements for the New Description:
    1. THE HOOK: The first 2 lines must be high-impact summaries to grab attention before "show more".
    2. VALUE PROPOSITION: A clear "What this video covers" section.
    3. OPTIMIZED CONTENT: Incorporate the provided recommendations naturally.
    4. CHAPTERS: Include a placeholder list for Timestamps (e.g., 00:00 - Introduction).
    5. SOCIALS: A clear "Stay Connected" section with placeholders like @[YourHandle].
    6. CTA: A strong call to action (Subscribe, download, join).

    Output only the refined description text. No meta-talk.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts: [{ text: prompt }] }],
  });

  return response.text?.trim() || 'Failed to generate optimized description.';
};

/**
 * Uses Gemini with Google Search grounding to fetch trending YouTube topics and search insights.
 * This simulates the dynamic intelligence that would otherwise require multiple API calls (YouTube, Google Trends, etc.)
 */
export const fetchMarketIntelligence = async (niche: string): Promise<IntelligenceResult> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    Research the current YouTube market intelligence for the niche: "${niche}".
    Focus on finding:
    1. Trending topics within this niche from the last 7-14 days.
    2. Keywords with high search volume and low to medium competition.
    3. Specific insights on what the audience is searching for RIGHT NOW.
    4. Content gaps where viewers want more information but existing videos are outdated or low quality.

    Present this data as a strategic YouTube content report. Use headings and bullet points.
    Include specific estimated "Search Volume" and "Competition" labels for each keyword suggestion where possible.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
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
