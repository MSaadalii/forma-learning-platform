export type Role = 'student' | 'creator';
export type Profile = { id: string; full_name: string; role: Role };
export type Course = { id: string; creator_id: string; title: string; subtitle: string; description: string; category: string; level: string; color: string; published: boolean; created_at?: string; creator?: { full_name: string } | null; lesson_count?: number; enrolled?: boolean; completed_count?: number };
export type Lesson = { id: string; course_id: string; title: string; summary: string; body: string; media_url: string | null; media_type: 'none' | 'video' | 'audio' | 'link'; position: number; duration_minutes: number; completed?: boolean; quiz?: QuizQuestion[] };
export type QuizQuestion = { id: string; lesson_id: string; prompt: string; options: string[]; correct_index?: number; explanation?: string };
export type Post = { id: string; lesson_id: string; user_id: string; body: string; created_at: string; author?: string };
export type QuizAttempt = { lesson_id: string; score: number; created_at: string };
export type CreatorAnalytics = { course_id: string; enrolled_count: number; completion_count: number; attempt_count: number; average_score: number | null };
