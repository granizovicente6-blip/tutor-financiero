# Tutor de Educación Financiera

Plataforma de educación financiera con tutoría de IA (método socrático) construida con
**Next.js (App Router) · TypeScript · Tailwind CSS** y el SDK de **Anthropic (Claude)**.

> ⚠️ Contenido educativo. **No es asesoría de inversión.** El tutor nunca da
> recomendaciones de compra/venta ni promete rentabilidades.

## Requisitos previos

- **Node.js 18.17 o superior** (LTS recomendado): https://nodejs.org

## Puesta en marcha

1. Instala las dependencias:

   ```bash
   npm install
   ```

2. Configura tu clave de API. Abre `.env.local` y reemplaza el valor de ejemplo
   por tu clave real de https://console.anthropic.com/ :

   ```bash
   ANTHROPIC_API_KEY=sk-ant-tu-clave-real
   ```

3. Arranca el servidor de desarrollo:

   ```bash
   npm run dev
   ```

4. Abre http://localhost:3000 en el navegador.

## Estructura

```
tutor-financiero/
├─ src/app/
│  ├─ layout.tsx          # Layout raíz (HTML base + metadata)
│  ├─ page.tsx            # UI del chat (cliente, con streaming)
│  ├─ globals.css         # Directivas de Tailwind
│  └─ api/chat/route.ts   # Endpoint POST /api/chat (streaming de Claude)
├─ .env.local             # Tu ANTHROPIC_API_KEY (no se sube a git)
├─ tailwind.config.ts
├─ postcss.config.mjs
├─ next.config.mjs
├─ tsconfig.json
└─ package.json
```

## Notas técnicas

- El modelo por defecto es `claude-sonnet-5` (constante `MODEL` en `route.ts`).
- El `System Prompt` con las reglas pedagógicas se inyecta a nivel de sistema,
  no como mensaje del historial.
- El chat usa streaming (`ReadableStream`) para mostrar la respuesta en tiempo real.
