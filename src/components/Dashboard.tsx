"use client";

import { useState } from "react";
import Link from "next/link";
import type { Category } from "@/lib/curriculum";
import type { LessonProgress, LessonStatus } from "@/lib/types";

// ---------------------------------------------------------------------------
// Datos que necesita la vista
//
// Es un subconjunto del currículum a propósito: el dashboard solo lista títulos,
// así que la página no envía al cliente el contenido markdown ni los quizzes
// (serían decenas de KB serializados para nada).
// ---------------------------------------------------------------------------

/** Lección tal como se muestra en el listado. */
export interface LessonSummary {
  slug: string;
  title: string;
  summary: string;
  estimatedMinutes: number;
}

/** Módulo con la ruta de la que proviene, ya aplanada. */
export interface ModuleSummary {
  slug: string;
  title: string;
  description: string;
  /** Título de la ruta de origen (una categoría mezcla módulos de varias rutas). */
  pathTitle: string;
  lessons: LessonSummary[];
}

/** Una categoría con todos sus módulos. */
export interface CategorySection {
  category: Category;
  modules: ModuleSummary[];
}

// ---------------------------------------------------------------------------
// Etiquetas y estilos por estado de lección
// ---------------------------------------------------------------------------
const STATUS_META: Record<
  LessonStatus,
  { label: string; cta: string; badge: string; dot: string }
> = {
  not_started: {
    label: "Pendiente",
    cta: "Iniciar lección",
    badge: "bg-slate-100 text-slate-500",
    dot: "bg-slate-300",
  },
  in_progress: {
    label: "En progreso",
    cta: "Continuar",
    badge: "bg-amber-100 text-amber-800",
    dot: "bg-amber-400",
  },
  completed: {
    label: "Completada",
    cta: "Repasar",
    badge: "bg-emerald-100 text-emerald-800",
    dot: "bg-emerald-500",
  },
};

// ---------------------------------------------------------------------------
// Identidad visual de cada categoría
//
// Las clases se guardan completas (nunca construidas por interpolación) para
// que Tailwind las detecte al compilar.
// ---------------------------------------------------------------------------
const CATEGORY_META: Record<
  Category,
  {
    emoji: string;
    tabActive: string;
    tabIdle: string;
    header: string;
    title: string;
    track: string;
    bar: string;
    chip: string;
    cta: string;
    row: string;
  }
> = {
  "Finanzas Personales": {
    emoji: "🟢",
    tabActive: "border-emerald-600 bg-emerald-600 text-white shadow-sm",
    tabIdle: "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-800",
    header: "border-emerald-200 bg-emerald-50",
    title: "text-emerald-900",
    track: "bg-emerald-100",
    bar: "bg-emerald-500",
    chip: "bg-emerald-100/70 text-emerald-800",
    cta: "bg-emerald-600 text-white group-hover:bg-emerald-700",
    row: "hover:border-emerald-300 hover:bg-emerald-50/40",
  },
  Inversiones: {
    emoji: "🔵",
    tabActive: "border-sky-600 bg-sky-600 text-white shadow-sm",
    tabIdle: "border-slate-200 bg-white text-slate-600 hover:border-sky-300 hover:text-sky-800",
    header: "border-sky-200 bg-sky-50",
    title: "text-sky-900",
    track: "bg-sky-100",
    bar: "bg-sky-500",
    chip: "bg-sky-100/70 text-sky-800",
    cta: "bg-sky-600 text-white group-hover:bg-sky-700",
    row: "hover:border-sky-300 hover:bg-sky-50/40",
  },
};

/** Categoría mostrada al entrar al dashboard. */
const DEFAULT_CATEGORY: Category = "Finanzas Personales";

/** Identificadores estables para enlazar cada pestaña con su panel (a11y). */
const tabId = (category: Category) => `tab-${category.replace(/\s+/g, "-").toLowerCase()}`;
const panelId = (category: Category) => `panel-${category.replace(/\s+/g, "-").toLowerCase()}`;

interface DashboardProps {
  /** Módulos agrupados en las dos categorías principales. */
  categories: CategorySection[];
  /** Progreso del usuario (una fila por lección con la que ya interactuó). */
  progress: LessonProgress[];
  userEmail: string;
}

/** Cuenta lecciones completadas dentro de un conjunto de lecciones. */
function completion(
  lessons: LessonSummary[],
  statusBySlug: Map<string, LessonStatus>,
): { completed: number; total: number; percent: number } {
  const completed = lessons.filter((l) => statusBySlug.get(l.slug) === "completed").length;
  const total = lessons.length;
  return { completed, total, percent: total === 0 ? 0 : Math.round((completed / total) * 100) };
}

/** Todas las lecciones de una categoría, en orden. */
function categoryLessons(section: CategorySection): LessonSummary[] {
  return section.modules.flatMap((mod) => mod.lessons);
}

export function Dashboard({ categories, progress, userEmail }: DashboardProps) {
  const [activeCategory, setActiveCategory] = useState<Category>(DEFAULT_CATEGORY);

  // Mapa slug -> estado, para consulta O(1) al renderizar.
  const statusBySlug = new Map<string, LessonStatus>(
    progress.map((p) => [p.lesson_id, p.status]),
  );

  // Si la categoría por defecto no existiera en los datos, caemos en la primera.
  const section =
    categories.find((c) => c.category === activeCategory) ?? categories[0];
  const meta = CATEGORY_META[section.category];
  const stats = completion(categoryLessons(section), statusBySlug);

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
        {/* Pestañas de categoría */}
        <div
          role="tablist"
          aria-label="Categorías de contenido"
          className="flex gap-2 overflow-x-auto pb-1"
        >
          {categories.map((cat) => {
            const catMeta = CATEGORY_META[cat.category];
            const isActive = cat.category === section.category;
            const { completed, total } = completion(categoryLessons(cat), statusBySlug);
            return (
              <button
                key={cat.category}
                type="button"
                role="tab"
                id={tabId(cat.category)}
                aria-selected={isActive}
                aria-controls={panelId(cat.category)}
                onClick={() => setActiveCategory(cat.category)}
                className={`flex-none whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition ${
                  isActive ? catMeta.tabActive : catMeta.tabIdle
                }`}
              >
                <span aria-hidden="true">{catMeta.emoji}</span> {cat.category}
                <span className={isActive ? "opacity-80" : "text-slate-400"}>
                  {" "}
                  · {completed}/{total}
                </span>
              </button>
            );
          })}
        </div>

        {/* Panel de la categoría activa */}
        <div
          role="tabpanel"
          id={panelId(section.category)}
          aria-labelledby={tabId(section.category)}
          className="mt-4"
        >
          {/* Estadísticas de la categoría que se está viendo */}
          <section className={`rounded-2xl border p-5 shadow-sm ${meta.header}`}>
            <div className="flex items-start justify-between gap-3">
              <h2 className={`text-lg font-bold ${meta.title}`}>
                <span aria-hidden="true">{meta.emoji}</span> {section.category}
              </h2>
              <span className="flex-none pt-1 text-xs font-medium text-slate-600">
                {section.modules.length} módulos
              </span>
            </div>

            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-600">
                <span>Progreso en esta categoría</span>
                <span>
                  {stats.completed} de {stats.total} lecciones · {stats.percent}%
                </span>
              </div>
              <div
                className={`h-2.5 w-full overflow-hidden rounded-full ${meta.track}`}
                role="progressbar"
                aria-valuenow={stats.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progreso en ${section.category}`}
              >
                <div
                  className={`h-full rounded-full transition-all duration-500 ${meta.bar}`}
                  style={{ width: `${stats.percent}%` }}
                />
              </div>
              {stats.percent === 100 && (
                <p className="mt-2 text-sm font-medium text-slate-700">
                  🎉 ¡Completaste toda la categoría! Excelente trabajo.
                </p>
              )}
            </div>
          </section>

          {/* Módulos y lecciones de la categoría activa */}
          <div className="mt-6 flex flex-col gap-5">
            {section.modules.map((module, moduleIndex) => (
              <section key={module.slug}>
                <div className="mb-2 px-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Módulo {moduleIndex + 1}: {module.title}
                    </h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.chip}`}
                    >
                      {module.pathTitle}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{module.description}</p>
                </div>

                <ul className="flex flex-col gap-2">
                  {module.lessons.map((lesson) => {
                    const status = statusBySlug.get(lesson.slug) ?? "not_started";
                    const statusMeta = STATUS_META[status];
                    return (
                      <li key={lesson.slug}>
                        <Link
                          href={`/dashboard/${lesson.slug}`}
                          className={`group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition ${meta.row}`}
                        >
                          <span
                            className={`h-2.5 w-2.5 flex-none rounded-full ${statusMeta.dot}`}
                            aria-hidden="true"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-900">
                              {lesson.title}
                            </p>
                            <p className="truncate text-xs text-slate-500">{lesson.summary}</p>
                            <div className="mt-1.5 flex items-center gap-2">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${statusMeta.badge}`}
                              >
                                {statusMeta.label}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {lesson.estimatedMinutes} min
                              </span>
                            </div>
                          </div>
                          <span
                            className={`flex-none rounded-lg px-3 py-1.5 text-xs font-semibold transition ${meta.cta}`}
                          >
                            {statusMeta.cta} <span aria-hidden="true">→</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-slate-400" title={userEmail}>
          Sesión de {userEmail} · Contenido educativo, no es asesoría financiera.
        </p>
      </main>
    </div>
  );
}
