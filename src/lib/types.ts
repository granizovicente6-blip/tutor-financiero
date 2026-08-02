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

/**
 * Racha de estudio del usuario (columnas de `profiles`, Fase 5), ya validada
 * contra la fecha de hoy por `lib/streak.ts`: si `current` es 0 la racha se
 * perdió, no es que la BD no se haya actualizado.
 */
export interface StreakInfo {
  /** Días consecutivos vivos. 0 = sin racha (nunca empezada o ya perdida). */
  current: number;
  /** Récord histórico. Sobrevive a la expiración. */
  longest: number;
  /** `true` si ya hubo actividad hoy; si no, la racha está pendiente de hoy. */
  activeToday: boolean;
  /** Último día con actividad (`YYYY-MM-DD`, UTC) o `null` si nunca hubo. */
  lastActiveDate: string | null;
}

/** Tipos de evento de analítica registrados (métricas de éxito, Fase 6). */
export type AnalyticsEventType =
  | "lesson_completed"
  | "quiz_completed"
  | "subscription_checkout_started"
  | "subscription_activated"
  | "subscription_cancelled"
  /** Un usuario Premium pidió el desglose con IA de un ETF o acción (Fase 8). */
  | "instrument_analyzed"
  /** Un usuario Free chocó con el muro de pago del análisis de mercado. */
  | "instrument_paywall_hit";

// ---------------------------------------------------------------------------
// Suscripción (Fase 7)
// ---------------------------------------------------------------------------

/**
 * Estado de la suscripción del usuario (columna `profiles.subscription_status`).
 *
 * - `free`      — sin suscripción; solo el contenido de prueba.
 * - `pending`   — inició el checkout, falta la confirmación de Mercado Pago.
 * - `active`    — suscripción autorizada y al día; acceso completo.
 * - `cancelled` — cancelada o con pago fallido; vuelve al contenido gratuito.
 */
export type SubscriptionStatus = "free" | "active" | "cancelled" | "pending";

/** Suscripción del usuario tal como la lee la app (subset de `profiles`). */
export interface SubscriptionInfo {
  status: SubscriptionStatus;
  /** ID de la suscripción en Mercado Pago (null si nunca inició el checkout). */
  preapprovalId: string | null;
  /** Fin del período ya pagado, en ISO 8601 (null si no aplica). */
  currentPeriodEnd: string | null;
}

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

// ---------------------------------------------------------------------------
// Test de Diagnóstico de entrada
// ---------------------------------------------------------------------------

/**
 * Resultado de un intento del test de diagnóstico, calculado por el servidor
 * contra el pool de `lib/diagnostic.ts` (el cliente solo manda qué respondió).
 * El nivel ya quedó guardado en `profiles.financial_level` cuando esto vuelve.
 */
export interface DiagnosticResult {
  correctCount: number;
  total: number;
  /** Aciertos en porcentaje (0–100), redondeado. */
  accuracy: number;
  level: FinancialLevel;
  /** Ids de las preguntas falladas, para repasarlas en la pantalla de resultado. */
  wrongQuestionIds: string[];
}
