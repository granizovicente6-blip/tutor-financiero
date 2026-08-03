import Link from "next/link";

/**
 * Navegación principal del área de producto.
 *
 * Vive en un componente aparte porque la comparten varias pantallas (la ruta de
 * aprendizaje, el análisis de mercado y los simuladores): así, añadir una
 * sección se hace en un solo sitio y todas las cabeceras quedan alineadas.
 *
 * No tiene estado ni hooks, así que funciona igual dentro de un Server Component
 * o de uno de cliente.
 */

/**
 * Secciones del área de producto.
 *
 * El Simulador UF NO es una sección propia: vive dentro de "Simuladores", igual
 * que el resto de las herramientas, para no repetir la misma entrada dos veces
 * en la navegación.
 */
export type DashboardSection = "ruta" | "mercados" | "simuladores";

const ITEMS: { key: DashboardSection; href: string; label: string; emoji: string }[] = [
  { key: "ruta", href: "/dashboard", label: "Mi ruta", emoji: "📚" },
  {
    key: "mercados",
    href: "/dashboard/mercados",
    label: "Análisis de Mercado",
    emoji: "📊",
  },
  { key: "simuladores", href: "/simuladores", label: "Simuladores", emoji: "🧮" },
];

interface DashboardNavProps {
  /** Sección abierta ahora mismo (se marca y deja de ser un enlace activo). */
  active: DashboardSection;
}

export function DashboardNav({ active }: DashboardNavProps) {
  return (
    <nav aria-label="Secciones del panel" className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-4">
        {ITEMS.map((item) => {
          const isActive = item.key === active;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex-none whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "border-emerald-600 text-emerald-800"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
              }`}
            >
              <span aria-hidden="true">{item.emoji}</span> {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
