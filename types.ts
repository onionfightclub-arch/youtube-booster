
export interface GradingDetails {
  score: number;
  feedback: string[];
  recommendations: string[];
  suggestions: string[];
  specificTags?: string[]; 
  structuralSuggestions?: string[]; 
}

export interface CompetitiveAudit {
  userStrengths: string[];
  competitorStrengths: string[];
  gapAnalysis: string;
  strategicMove: string;
}

export interface AnalysisResult {
  overallScore: number;
  title: GradingDetails;
  description: GradingDetails;
  tags: GradingDetails;
  summary: string;
  competitiveAudit?: CompetitiveAudit;
}

export interface VideoMetadata {
  title: string;
  description: string;
  tags: string;
  duration?: string;
  script?: string;
  competitorUrl?: string;
  competitorNotes?: string;
}

export interface SavedGrading {
  id: string;
  timestamp: number;
  metadata: VideoMetadata;
  analysis: AnalysisResult;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
