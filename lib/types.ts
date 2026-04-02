export interface Project {
  id: string;
  name: string;
  role: string;
  duration: string;
  original: string;
  scores: {
    pm: number;
    quantify: number;
    star: number;
    keywords: number;
  };
  issues: string[];
  versions?: {
    concise: string;
    detailed: string;
    datadriven: string;
  };
  lockedVersion?: 'concise' | 'detailed' | 'datadriven' | 'custom';
  customVersion?: string;
  chatHistory?: { role: 'user' | 'ai'; content: string }[];
}

export interface TargetRoleProfile {
  title: string;
  company: string;
  jobDescription: string;
}

export interface FullResumeDraft {
  title: string;
  summary: string;
  highlights: string[];
  fullText: string;
}

export interface ResumeData {
  name: string;
  education: { school: string; major: string; year: string }[];
  projects: Project[];
  overallScore: number;
  overallIssues?: string[];
}
