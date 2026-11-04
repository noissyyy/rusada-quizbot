export type Difficulty = 'easy' | 'medium' | 'hard';
export type Status = 'draft' | 'published' | 'archived';

export interface Subtopic { id: string | null; title: string }
export interface Topic {
  id: string; slug: string; title: string; description: string; color: string; illustration: string; position: number;
  isActive: boolean; subtopics: Subtopic[]; testsCount: number; questionsCount: number;
}
export interface Option { id?: string; text: string; isCorrect: boolean }
export interface Question {
  id: string; topicId: string; topicTitle: string; subtopicId: string | null; subtopicTitle: string | null; text: string;
  imageUrl: string | null; difficulty: Difficulty; points: number; explanationRu: string | null; explanationUz: string | null;
  status: Status; options: Option[]; correctRate: number | null; updatedAt: string;
}
export interface Page<T> { items: T[]; total: number }
export interface QuizFull {
  id: string; title: string; topicId: string; topicTitle: string; description: string; difficulty: Difficulty; durationSec: number;
  liveQuestionSec: number; modeIndividual: boolean; modeLive: boolean; modeGroup: boolean; isQuick: boolean; status: Status;
  questions: Question[]; questionsCount: number; maxPoints: number; attempts: number; publishedAt: string | null; updatedAt: string;
  updatedByName: string | null;
}
export interface QuizRow {
  id: string; title: string; topicTitle: string; questionsCount: number; durationSec: number; liveQuestionSec: number;
  modes: ('individual' | 'live' | 'group')[]; attempts: number; status: Status; isLive: boolean; updatedAt: string;
}
export interface AppSettings {
  defaultDurationMin: number; liveQuestionSec: number; feedbackMs: number; feedbackExplainMs: number;
  langs: ('uz' | 'uz-cyrl' | 'ru')[]; defaultLang: 'telegram' | 'uz' | 'uz-cyrl' | 'ru'; rateLimitPerMin: number;
  botUsername?: string; miniappUrl?: string; botTokenSet?: boolean; signatureCheck?: boolean;
}
