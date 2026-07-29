// Tipos compartidos por la app (chat + persistencia + auth).

export type ChatRole = "user" | "assistant";

/** Nivel de conocimiento financiero del estudiante (columna profiles.financial_level). */
export type FinancialLevel = "beginner" | "intermediate" | "advanced";

/** Mensaje tal como lo maneja la UI y la API de Claude. */
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** Fila de la tabla `conversations` (subset usado en la UI). */
export interface Conversation {
  id: string;
  title: string | null;
  created_at: string;
}

/** Estado devuelto por las Server Actions de autenticación (para useFormState). */
export interface AuthState {
  error?: string | null;
  message?: string | null;
}

/** Racha de estudio del usuario (columnas de `profiles`, Fase 5). */
export interface StreakInfo {
  current: number;
  longest: number;
}

/** Tipos de evento de analítica registrados (métricas de éxito, Fase 6). */
export type AnalyticsEventType = "lesson_completed" | "quiz_completed";

// ---------------------------------------------------------------------------
// Ruta de aprendizaje y progreso (Fase 4)
// ---------------------------------------------------------------------------

/** Estado de una lección para un estudiante concreto. */
export type LessonStatus = "not_started" | "in_progress" | "completed";

/**
 * Fila de la tabla `lesson_progress` (subset usado en la UI).
 * `lesson_id` es el slug de la lección definido en `curriculum.ts` (no hay FK:
 * el contenido del curso vive en código, solo el progreso vive en la BD).
 */
export interface LessonProgress {
  lesson_id: string;
  status: LessonStatus;
  completed_at: string | null;
  quiz_score: number | null;
}

/** Resultado de corrección de una pregunta concreta del quiz. */
export interface QuizQuestionResult {
  id: string;
  selectedIndex: number;
  correctIndex: number;
  isCorrect: boolean;
}

/**
 * Resultado agregado de un intento de quiz, calculado por el servidor
 * (autoridad) y devuelto al cliente junto al feedback en streaming.
 */
export interface QuizResult {
  score: number; // 0–100
  correctCount: number;
  total: number;
  perQuestion: QuizQuestionResult[];
}
