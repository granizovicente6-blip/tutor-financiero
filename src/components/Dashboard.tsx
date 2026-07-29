import Link from "next/link";
import type { LearningPath } from "@/lib/curriculum";
import type { LessonProgress, LessonStatus } from "@/lib/types";

// ---------------------------------------------------------------------------
// Etiquetas y estilos por estado de lección
// ---------------------------------------------------------------------------
const STATUS_META: Record<LessonStatus, { label: string; badge: string; dot: string }> = {
  not_started: {
    label: "Pendiente",
    badge: "bg-slate-100 text-slate-500",
    dot: "bg-slate-300",
  },
  in_progress: {
    label: "En progreso",
    badge: "bg-amber-100 text-amber-800",
    dot: "bg-amber-400",
  },
  completed: {
    label: "Completada",
    badge: "bg-emerald-100 text-emerald-800",
    dot: "bg-emerald-500",
  },
};

interface DashboardProps {
  /** Todas las rutas disponibles. */
  paths: LearningPath[];
  /** Slug de la ruta actualmente seleccionada. */
  activePathSlug: string;
  /** Progreso del usuario (una fila por lección con la que ya interactuó). */
  progress: LessonProgress[];
  userEmail: string;
}

/** Cuenta lecciones completadas de una ruta según el mapa de estados. */
function pathCompletion(
  path: LearningPath,
  statusBySlug: Map<string, LessonStatus>,
): { completed: number; total: number } {
  const lessons = path.modules.flatMap((m) => m.lessons);
  const completed = lessons.filter((l) => statusBySlug.get(l.slug) === "completed").length;
  return { completed, total: lessons.length };
}

export function Dashboard({ paths, activePathSlug, progress, userEmail }: DashboardProps) {
  // Mapa slug -> estado, para consulta O(1) al renderizar.
  const statusBySlug = new Map<string, LessonStatus>(
    progress.map((p) => [p.lesson_id, p.status]),
  );

  const path = paths.find((p) => p.slug === activePathSlug) ?? paths[0];

  const { completed: completedLessons, total: totalLessons } = pathCompletion(
    path,
    statusBySlug,
  );
  const percent =
    totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);

  return (
    <div className="min-h-dvh bg-slate-100 text-slate-800">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-base text-white">
              📚
            </span>
            <h1 className="text-base font-semibold text-slate-900 sm:text-lg">
              Mi ruta de aprendizaje
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50"
          >
            ← Volver al chat
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {/* Selector de ruta (pestañas) */}
        {paths.length > 1 && (
          <nav className="mb-5 flex gap-2 overflow-x-auto pb-1" aria-label="Rutas de aprendizaje">
            {paths.map((p) => {
              const { completed, total } = pathCompletion(p, statusBySlug);
              const isActive = p.slug === path.slug;
              return (
                <Link
                  key={p.slug}
                  href={`/dashboard?ruta=${p.slug}`}
                  className={`flex-none whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                    isActive
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {p.title}
                  <span className={isActive ? "text-emerald-100" : "text-slate-400"}>
                    {" "}
                    · {completed}/{total}
                  </span>
                </Link>
              );
            })}
          </nav>
        )}

        {/* Tarjeta de la ruta + barra de progreso */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">{path.title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{path.description}</p>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Progreso general</span>
              <span>
                {completedLessons} de {totalLessons} lecciones · {percent}%
              </span>
            </div>
            <div
              className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progreso general de la ruta"
            >
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
            {percent === 100 && (
              <p className="mt-2 text-sm font-medium text-emerald-700">
                🎉 ¡Completaste toda la ruta! Excelente trabajo.
              </p>
            )}
          </div>
        </section>

        {/* Módulos y lecciones */}
        <div className="mt-6 flex flex-col gap-5">
          {path.modules.map((module, moduleIndex) => (
            <section key={module.slug}>
              <div className="mb-2 px-1">
                <h3 className="text-sm font-semibold text-slate-900">
                  Módulo {moduleIndex + 1}: {module.title}
                </h3>
                <p className="text-xs text-slate-500">{module.description}</p>
              </div>

              <ul className="flex flex-col gap-2">
                {module.lessons.map((lesson) => {
                  const status = statusBySlug.get(lesson.slug) ?? "not_started";
                  const meta = STATUS_META[status];
                  return (
                    <li key={lesson.slug}>
                      <Link
                        href={`/dashboard/${lesson.slug}`}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/40"
                      >
                        <span
                          className={`h-2.5 w-2.5 flex-none rounded-full ${meta.dot}`}
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {lesson.title}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {lesson.summary}
                          </p>
                        </div>
                        <span className="flex-none text-[11px] text-slate-400">
                          {lesson.estimatedMinutes} min
                        </span>
                        <span
                          className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-medium ${meta.badge}`}
                        >
                          {meta.label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-slate-400" title={userEmail}>
          Sesión de {userEmail} · Contenido educativo, no es asesoría financiera.
        </p>
      </main>
    </div>
  );
}
