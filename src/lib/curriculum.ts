// =============================================================================
// Currículum de la plataforma — contenido estático (Fase 4)
//
// Decisión de arquitectura: el CONTENIDO del curso vive en código (este archivo)
// y solo el PROGRESO del estudiante vive en la base de datos (tabla
// `lesson_progress`, referenciando el `slug` de cada lección). Las lecciones las
// redactamos nosotros, cambian poco y no necesitan CMS todavía; esto las mantiene
// versionadas, con seguridad de tipos y sin migraciones por cada ajuste de texto.
//
// Si en la Fase 5 el contenido crece, se puede migrar a tablas de BD sin tocar
// la tabla de progreso (los slugs son la clave estable).
// =============================================================================

/** Una pregunta de opción múltiple del quiz de una lección. */
export interface QuizQuestion {
  /** Identificador estable dentro de la lección (para la retroalimentación). */
  id: string;
  prompt: string;
  /** Opciones en orden; el índice de la correcta es `correctIndex`. */
  options: string[];
  correctIndex: number;
  /** Explicación que se muestra tras responder (autoevaluación). */
  explanation: string;
}

/** Una lección individual (unidad mínima con la que interactúa el estudiante). */
export interface Lesson {
  /** Identificador estable usado en la URL y en `lesson_progress.lesson_id`. */
  slug: string;
  title: string;
  /** Objetivo de aprendizaje: qué sabrá hacer el estudiante al terminar. */
  summary: string;
  estimatedMinutes: number;
  /** Contenido de la lección en Markdown. */
  content: string;
  /** Quiz de autoevaluación al final de la lección (opcional). */
  quiz?: QuizQuestion[];
}

/**
 * Las dos grandes categorías bajo las que se agrupa todo el contenido.
 *
 * Es una capa transversal a las rutas: una misma ruta puede aportar módulos a
 * una u otra categoría (p. ej. la ruta avanzada de riesgo es 100% "Finanzas
 * Personales", mientras que la de macroeconomía sirve de contexto para invertir).
 */
export const CATEGORIES = ["Finanzas Personales", "Inversiones"] as const;

/** Categoría principal a la que pertenece un módulo. */
export type Category = (typeof CATEGORIES)[number];

/** Un módulo agrupa lecciones relacionadas por tema. */
export interface Module {
  slug: string;
  title: string;
  description: string;
  /** Categoría principal bajo la que se agrupa el módulo en la interfaz. */
  category: Category;
  lessons: Lesson[];
}

/** Una ruta de aprendizaje completa (secuencia de módulos). */
export interface LearningPath {
  slug: string;
  title: string;
  description: string;
  modules: Module[];
}

// -----------------------------------------------------------------------------
// Ruta 1: Fundamentos de Finanzas Personales
// -----------------------------------------------------------------------------
export const FUNDAMENTOS: LearningPath = {
  slug: "fundamentos-finanzas-personales",
  title: "Fundamentos de Finanzas Personales",
  description:
    "Tu punto de partida. Construye una base sólida de hábitos, ahorro y manejo de deuda antes de pensar en cualquier inversión.",
  modules: [
    {
      slug: "mentalidad-y-habitos",
      title: "Mentalidad y hábitos",
      description: "La base de todo: entender el dinero y controlar hacia dónde va.",
      category: "Finanzas Personales",
      lessons: [
        {
          slug: "que-es-educacion-financiera",
          title: "¿Qué es la educación financiera?",
          summary:
            "Comprenderás qué significa tener criterio financiero y por qué es una habilidad, no un talento.",
          estimatedMinutes: 6,
          content: `## ¿Qué es la educación financiera?

La educación financiera **no** consiste en saber qué acción comprar o predecir la bolsa. Consiste en desarrollar **criterio** para tomar buenas decisiones con tu dinero, sean cuales sean.

Piensa en aprender a cocinar. No memorizas una única receta: aprendes técnicas (cortar, sazonar, controlar el fuego) que luego aplicas a **cualquier** plato. Con el dinero es igual: aprendes principios que sirvan toda la vida.

### Las tres preguntas que guían toda decisión

- **¿De dónde viene mi dinero?** (ingresos)
- **¿A dónde va?** (gastos)
- **¿Qué queda para mi futuro?** (ahorro e inversión)

Quien responde estas tres preguntas con claridad ya va por delante de la mayoría.

### Un mito importante

> "Necesito ganar mucho para ordenar mis finanzas."

Falso. Personas con ingresos altos viven endeudadas y personas con ingresos modestos construyen patrimonio. La diferencia casi nunca es *cuánto entra*, sino **qué hábitos** tienes con lo que entra.

---

**Mini-reflexión:** Sin mirar ninguna app, ¿podrías decir aproximadamente en qué se fue tu dinero la semana pasada? Si la respuesta es "no estoy seguro", ya encontraste el primer punto a trabajar. 🎯`,
          quiz: [
            {
              id: "q1",
              prompt: "¿Qué describe mejor la educación financiera?",
              options: [
                "Saber qué acciones comprar para ganar dinero rápido",
                "Desarrollar criterio para tomar buenas decisiones con tu dinero",
                "Memorizar las noticias del mercado cada día",
              ],
              correctIndex: 1,
              explanation:
                "La educación financiera es una habilidad de criterio, no una lista de recetas ni predicciones del mercado.",
            },
            {
              id: "q2",
              prompt: "Según la lección, ¿de qué depende más ordenar tus finanzas?",
              options: [
                "Del monto de tus ingresos",
                "De tus hábitos con el dinero que entra",
                "De la suerte",
              ],
              correctIndex: 1,
              explanation:
                "Hay quien con ingresos altos vive endeudado y quien con ingresos modestos construye patrimonio: la diferencia está en los hábitos.",
            },
          ],
        },
        {
          slug: "el-presupuesto",
          title: "El presupuesto: tu mapa financiero",
          summary:
            "Aprenderás qué es un presupuesto, para qué sirve realmente y una regla sencilla para empezar.",
          estimatedMinutes: 8,
          content: `## El presupuesto: tu mapa financiero

Un presupuesto **no es una jaula** que te prohíbe gastar. Es un **mapa**: te dice dónde estás y hacia dónde va tu dinero, para que *tú* decidas el rumbo en lugar de que el mes decida por ti.

### Una analogía

Imagina que sales de viaje en coche sin mirar el nivel de gasolina ni el mapa. Puede que llegues… o que te quedes tirado a mitad de camino. El presupuesto es revisar el tanque y trazar la ruta **antes** de arrancar.

### La regla 50/30/20 (para empezar)

Una forma simple de repartir tus ingresos después de impuestos:

- **50% – Necesidades:** vivienda, comida, transporte, servicios básicos.
- **30% – Deseos:** ocio, restaurantes, suscripciones, caprichos.
- **20% – Futuro:** ahorro, fondo de emergencia y pago de deudas.

No es una ley sagrada: si tu alquiler es alto, quizá empieces con 60/20/20. Lo importante es que **cada peso tenga un trabajo asignado** antes de gastarlo.

### El primer paso, hoy

1. Anota tus ingresos mensuales.
2. Lista tus gastos fijos (los que se repiten cada mes).
3. Resta. Lo que queda es tu terreno de juego.

---

**Mini-ejercicio:** Calcula qué % de tus ingresos se va hoy en *necesidades*. Si no lo sabes con certeza, esa incertidumbre es justo lo que un presupuesto elimina. ¿Te animas a estimarlo? 🧮

---

👉 **Ponlo a prueba:** reparte tu ingreso con el [presupuestador 50/30/20](/simuladores/presupuesto) y visualiza tu distribución al instante.`,
          quiz: [
            {
              id: "q1",
              prompt: "En la regla 50/30/20, ¿a qué corresponde el 20%?",
              options: [
                "Deseos y ocio",
                "Necesidades básicas",
                "Futuro: ahorro y pago de deudas",
              ],
              correctIndex: 2,
              explanation:
                "El 20% se destina al futuro (ahorro, fondo de emergencia y deudas); el 50% a necesidades y el 30% a deseos.",
            },
            {
              id: "q2",
              prompt: "¿Cuál es la mejor forma de entender un presupuesto?",
              options: [
                "Una jaula que prohíbe gastar",
                "Un mapa para decidir el rumbo de tu dinero",
                "Un castigo por gastar de más",
              ],
              correctIndex: 1,
              explanation:
                "El presupuesto es un mapa: te da control para decidir el rumbo, no una prohibición.",
            },
            {
              id: "q3",
              prompt: "¿Qué significa que 'cada peso tenga un trabajo asignado'?",
              options: [
                "Gastar todo apenas llega",
                "Decidir el destino de tu dinero antes de gastarlo",
                "Guardar absolutamente todo sin excepción",
              ],
              correctIndex: 1,
              explanation:
                "Asignar un propósito a cada peso antes de gastarlo es la esencia de presupuestar.",
            },
          ],
        },
      ],
    },
    {
      slug: "ahorro-y-emergencias",
      title: "Ahorro y emergencias",
      description: "Cómo crear un colchón que te dé tranquilidad y libertad de decisión.",
      category: "Finanzas Personales",
      lessons: [
        {
          slug: "por-que-ahorrar",
          title: "Por qué y cómo ahorrar",
          summary:
            "Entenderás por qué el ahorro es libertad (no privación) y una técnica para hacerlo automático.",
          estimatedMinutes: 7,
          content: `## Por qué y cómo ahorrar

Ahorrar suele venderse como "renunciar a cosas". En realidad, ahorrar es **comprar opciones**: cada peso guardado es una futura decisión que podrás tomar con calma en lugar de por desesperación.

### El error más común

La mayoría hace esto:

> Ingreso → Gastos → *lo que sobre*, lo ahorro.

Y casi nunca sobra. La técnica que sí funciona invierte el orden:

> Ingreso → **Ahorro primero** → Gastos con lo que queda.

Esto se llama **"págate a ti mismo primero"**. Trata tu ahorro como una factura obligatoria más.

### Hazlo automático

La fuerza de voluntad se agota; los sistemas no. Configura una **transferencia automática** el día que cobras: un porcentaje pequeño (aunque sea 5–10%) que se mueve a otra cuenta sin que tengas que pensarlo. Lo que no ves, no lo gastas.

### Empieza pequeño, pero empieza

Ahorrar el 5% de forma constante durante años supera por mucho a "ya ahorraré el 40% cuando gane más" (ese momento rara vez llega). La constancia le gana al monto.

---

**Mini-reflexión:** Si automatizaras hoy una transferencia del 10% de tu próximo ingreso, ¿notarías realmente su ausencia en el día a día, o es más costumbre que necesidad? 🤔`,
          quiz: [
            {
              id: "q1",
              prompt: "¿Cuál es el orden que sí funciona para ahorrar?",
              options: [
                "Ingreso → gastos → lo que sobre, lo ahorro",
                "Ingreso → ahorro primero → gastos con lo que queda",
                "Ingreso → deudas → nunca ahorro",
              ],
              correctIndex: 1,
              explanation:
                "'Págate a ti mismo primero': aparta el ahorro antes de gastar, porque lo que sobra casi nunca alcanza.",
            },
            {
              id: "q2",
              prompt: "¿Por qué conviene automatizar el ahorro?",
              options: [
                "Porque la fuerza de voluntad se agota y los sistemas no",
                "Porque así se gana más interés garantizado",
                "Porque es obligatorio por ley",
              ],
              correctIndex: 0,
              explanation:
                "Automatizar quita la decisión diaria: lo que no ves, no lo gastas.",
            },
            {
              id: "q3",
              prompt:
                "Ahorrar un 5% de forma constante frente a esperar a ahorrar el 40% 'cuando gane más'...",
              options: [
                "Da igual, es lo mismo",
                "La constancia suele ganarle al monto",
                "Siempre es mejor esperar a ganar más",
              ],
              correctIndex: 1,
              explanation:
                "La constancia vence: ese momento de 'cuando gane más' rara vez llega.",
            },
          ],
        },
        {
          slug: "fondo-de-emergencia",
          title: "El fondo de emergencia",
          summary:
            "Sabrás qué es, cuánto debería tener y por qué es la primera meta financiera de todos.",
          estimatedMinutes: 6,
          content: `## El fondo de emergencia

Antes de invertir, antes de cualquier otra meta, existe una prioridad: el **fondo de emergencia**. Es dinero reservado **solo** para imprevistos reales (una reparación urgente, un gasto médico, la pérdida temporal de ingresos).

### ¿Por qué es tan importante?

Es tu **airbag financiero**. Sin él, cualquier imprevisto te obliga a endeudarte con tarjetas o préstamos caros, y ahí empieza una espiral difícil de romper. Con él, un mal día sigue siendo solo un mal día, no una crisis.

### ¿Cuánto debería tener?

La referencia habitual es de **3 a 6 meses de tus gastos esenciales** (no de tus ingresos, de tus gastos para vivir).

- ¿Ingresos estables y sin dependientes? 3 meses puede bastar.
- ¿Ingresos variables o personas a tu cargo? Apunta a 6 meses.

### ¿Dónde guardarlo?

En un lugar **seguro y de fácil acceso** (una cuenta separada de la del día a día). La meta aquí **no** es que crezca mucho, sino que esté **disponible** cuando lo necesites. Su trabajo es la tranquilidad, no la rentabilidad.

---

**Mini-ejercicio:** Multiplica tus gastos esenciales de un mes por 3. Ese número es tu primera meta concreta. ¿Qué tan cerca o lejos estás de él hoy? 🛟`,
          quiz: [
            {
              id: "q1",
              prompt: "¿Cuál es la referencia habitual para el tamaño del fondo de emergencia?",
              options: [
                "3 a 6 meses de tus ingresos",
                "3 a 6 meses de tus gastos esenciales",
                "12 meses de tu sueldo completo",
              ],
              correctIndex: 1,
              explanation:
                "Se mide en meses de gastos esenciales (lo que necesitas para vivir), no de ingresos.",
            },
            {
              id: "q2",
              prompt: "¿Cuál es la prioridad al elegir dónde guardar el fondo de emergencia?",
              options: [
                "Que tenga la mayor rentabilidad posible",
                "Que esté seguro y disponible cuando lo necesites",
                "Que esté invertido en activos de alto riesgo",
              ],
              correctIndex: 1,
              explanation:
                "El objetivo del fondo es la tranquilidad y la disponibilidad inmediata, no la rentabilidad.",
            },
            {
              id: "q3",
              prompt: "¿Qué función cumple el fondo de emergencia?",
              options: [
                "Un airbag que evita endeudarte ante imprevistos",
                "Un dinero reservado para vacaciones",
                "Una inversión pensada para crecer mucho",
              ],
              correctIndex: 0,
              explanation:
                "Es tu airbag financiero: convierte una crisis en solo un mal día.",
            },
          ],
        },
      ],
    },
    {
      slug: "deuda-e-interes",
      title: "Deuda e interés",
      description: "La herramienta que puede impulsarte o hundirte, según cómo la entiendas.",
      category: "Finanzas Personales",
      lessons: [
        {
          slug: "interes-compuesto",
          title: "Interés simple vs. compuesto",
          summary:
            "Entenderás la fuerza del interés compuesto y por qué el tiempo es tu mayor aliado (o tu peor enemigo).",
          estimatedMinutes: 8,
          content: `## Interés simple vs. compuesto

El interés es el "precio del tiempo" del dinero. Entender la diferencia entre sus dos tipos es, quizá, el concepto más rentable de toda la educación financiera.

### Interés simple

Se calcula **siempre sobre el monto inicial**. Si prestas 100 al 10% anual, ganas 10 cada año. Punto. Año 1: 110. Año 2: 120. Crece en **línea recta**.

### Interés compuesto

Aquí ocurre la magia: los intereses **generan más intereses**. El 10% se calcula sobre el total acumulado, no solo sobre el inicial.

- Año 1: 100 + 10 = **110**
- Año 2: 110 + 11 = **121**
- Año 3: 121 + 12,1 = **133,1**

Parece poco al inicio, pero con los años la curva se dispara. Es una **bola de nieve**: rueda despacio al principio y luego se vuelve imparable.

### La variable secreta: el tiempo

En el interés compuesto, **el tiempo importa más que el monto**. Empezar temprano con poco suele superar a empezar tarde con mucho, porque la bola de nieve tiene más pendiente para rodar.

### La otra cara

Esta misma fuerza juega **en tu contra** en las deudas. El saldo de una tarjeta de crédito impaga también se compone… pero a tu costa. Es la misma bola de nieve, rodando hacia el lado equivocado.

---

**Mini-reflexión:** Si el tiempo es el ingrediente clave del interés compuesto, ¿qué ventaja tiene empezar a ahorrar hoy en lugar de "cuando tenga más"? Piénsalo antes de seguir. ⏳

---

👉 **Ponlo a prueba:** experimenta con distintos aportes y plazos en la [calculadora de interés compuesto](/simuladores/interes-compuesto) y observa la bola de nieve en acción.`,
          quiz: [
            {
              id: "q1",
              prompt: "¿Qué caracteriza al interés compuesto frente al simple?",
              options: [
                "Se calcula siempre sobre el monto inicial",
                "Los intereses generan más intereses",
                "Nunca cambia con el paso del tiempo",
              ],
              correctIndex: 1,
              explanation:
                "En el compuesto los intereses se suman al capital y generan nuevos intereses: la bola de nieve.",
            },
            {
              id: "q2",
              prompt: "En el interés compuesto, ¿qué variable suele ser la más poderosa?",
              options: [
                "El tiempo",
                "El banco que elijas",
                "La cantidad de cuentas que tengas",
              ],
              correctIndex: 0,
              explanation:
                "El tiempo es el ingrediente clave: empezar temprano con poco suele superar a empezar tarde con mucho.",
            },
            {
              id: "q3",
              prompt: "¿Cómo actúa el interés compuesto en una deuda de tarjeta impaga?",
              options: [
                "A tu favor, reduce lo que debes",
                "En tu contra: la bola de nieve rueda hacia el lado equivocado",
                "No tiene ningún efecto",
              ],
              correctIndex: 1,
              explanation:
                "La misma fuerza que multiplica tus ahorros multiplica tus deudas si no las pagas.",
            },
          ],
        },
        {
          slug: "deuda-buena-y-mala",
          title: "Deuda buena y deuda mala",
          summary:
            "Aprenderás a distinguir la deuda que construye de la que destruye, sin caer en frases hechas.",
          estimatedMinutes: 7,
          content: `## Deuda buena y deuda mala

"Toda deuda es mala" es un mito. La deuda es una **herramienta**: un martillo sirve para construir una casa o para romperte un dedo. Depende de cómo y para qué la uses.

### Deuda que puede trabajar a tu favor

Es la que se usa para adquirir algo que **puede aumentar tu patrimonio o tus ingresos** en el tiempo, y cuyo costo (el interés) es razonable. Ejemplos típicos: formación que mejora tu empleabilidad, o financiar una vivienda en condiciones sensatas.

La pregunta clave: *¿esto me acerca a producir más valor en el futuro?*

### Deuda que juega en tu contra

Es la que se usa para **consumo que pierde valor** y suele tener intereses altos. El caso más claro: arrastrar el saldo de la tarjeta de crédito mes a mes para gastos del día a día. Ahí el interés compuesto (que viste en la lección anterior) rueda **contra ti**.

### Una regla de criterio (no una orden)

Antes de endeudarte, pregúntate:

1. ¿Para qué es exactamente esta deuda?
2. ¿Cuál es su costo real (la tasa de interés)?
3. ¿Podré pagarla cómodamente sin comprometer lo esencial?

Si las tres respuestas no te dejan tranquilo, probablemente no es el momento.

> ⚠️ **Recordatorio:** esto es formación para desarrollar tu criterio, no una recomendación sobre productos financieros concretos. Cada situación es distinta.

---

**Mini-ejercicio:** Piensa en la última deuda (o compra a plazos) que consideraste. Pásala por las tres preguntas de arriba. ¿Habría cambiado tu decisión? 🧠`,
          quiz: [
            {
              id: "q1",
              prompt: "¿Qué caracteriza a una deuda que puede trabajar a tu favor?",
              options: [
                "Financiar consumo que pierde valor, con interés alto",
                "Adquirir algo que puede aumentar tu patrimonio o ingresos, a un costo razonable",
                "Cualquier deuda, con tal de que sea grande",
              ],
              correctIndex: 1,
              explanation:
                "La 'deuda buena' financia algo que produce valor futuro a un costo (interés) razonable.",
            },
            {
              id: "q2",
              prompt: "¿Cuál es un ejemplo típico de deuda que juega en tu contra?",
              options: [
                "Arrastrar el saldo de la tarjeta mes a mes para gastos diarios",
                "No tener ninguna deuda",
                "Pagar la tarjeta completa cada mes",
              ],
              correctIndex: 0,
              explanation:
                "El saldo rotativo de la tarjeta para consumo, con interés alto, es el caso clásico de deuda mala.",
            },
            {
              id: "q3",
              prompt: "Antes de endeudarte, ¿qué deberías evaluar?",
              options: [
                "Solo si te aprueban el crédito",
                "Para qué es, su costo (la tasa) y si podrás pagarla sin comprometer lo esencial",
                "El diseño de la tarjeta",
              ],
              correctIndex: 1,
              explanation:
                "Las tres preguntas de criterio: propósito, costo real y capacidad de pago cómoda.",
            },
          ],
        },
      ],
    },
  ],
};

// -----------------------------------------------------------------------------
// Ruta 2: Inversiones y Mercados
// -----------------------------------------------------------------------------
export const INVERSIONES: LearningPath = {
  slug: "inversiones-y-mercados",
  title: "Inversiones y Mercados",
  description:
    "Una vez tienes bases sólidas, entiende los principios de la inversión: riesgo, retorno y diversificación. Conceptos, nunca recomendaciones de activos.",
  modules: [
    {
      slug: "fundamentos-inversion",
      title: "Fundamentos de la inversión",
      description: "Qué significa invertir y la relación esencial entre riesgo y retorno.",
      category: "Inversiones",
      lessons: [
        {
          slug: "inv-que-es-invertir",
          title: "¿Qué es invertir?",
          summary:
            "Distinguirás ahorrar de invertir y entenderás qué significa poner tu dinero a trabajar.",
          estimatedMinutes: 6,
          content: `## ¿Qué es invertir?

Ahorrar es **guardar** dinero; invertir es **poner ese dinero a trabajar** con la expectativa de que crezca en el tiempo, asumiendo a cambio cierto **riesgo**.

Piénsalo con semillas: ahorrar es guardarlas seguras en un frasco; invertir es plantarlas. Pueden crecer y multiplicarse… o algunas no germinar. Por eso invertir exige preparación.

### Antes de invertir

La inversión es una herramienta para metas de **largo plazo**, no un atajo para hacerse rico rápido. Conviene tener primero:

- Un **fondo de emergencia** ya formado.
- Las **deudas caras** (como tarjetas) bajo control.

Con esas bases, el dinero que inviertes es dinero que puedes dejar trabajar sin necesitarlo mañana.

---

**Mini-reflexión:** Si invertir implica asumir riesgo con dinero que no necesitarás pronto, ¿por qué crees que tener antes un fondo de emergencia cambia por completo tu tranquilidad al invertir? 🌱`,
          quiz: [
            {
              id: "q1",
              prompt: "¿Cuál es la diferencia esencial entre ahorrar e invertir?",
              options: [
                "Son exactamente lo mismo",
                "Invertir pone el dinero a trabajar asumiendo cierto riesgo",
                "Ahorrar siempre da más rentabilidad que invertir",
              ],
              correctIndex: 1,
              explanation:
                "Ahorrar guarda el dinero; invertir busca que crezca en el tiempo asumiendo riesgo.",
            },
            {
              id: "q2",
              prompt: "¿Qué conviene tener resuelto antes de empezar a invertir?",
              options: [
                "Nada, se puede invertir con cualquier dinero",
                "Un fondo de emergencia y las deudas caras bajo control",
                "Un pronóstico exacto del mercado",
              ],
              correctIndex: 1,
              explanation:
                "Las bases (fondo de emergencia y deudas caras controladas) permiten invertir sin necesitar ese dinero pronto.",
            },
          ],
        },
        {
          slug: "inv-riesgo-retorno",
          title: "Riesgo y retorno",
          summary:
            "Comprenderás por qué un mayor retorno potencial implica mayor riesgo, y el papel del horizonte de tiempo.",
          estimatedMinutes: 7,
          content: `## Riesgo y retorno

En finanzas hay una ley que casi nunca falla: **a mayor retorno potencial, mayor riesgo**. No existe el rendimiento alto y seguro al mismo tiempo.

### La señal de alerta

Si algo promete **"altos rendimientos garantizados y sin riesgo"**, enciende todas las alarmas: suele ser una estafa o un malentendido. El riesgo no desaparece; solo se esconde.

### El horizonte como aliado

El **tiempo** es tu mejor herramienta frente al riesgo. En plazos largos, los altibajos (la volatilidad) tienden a suavizarse; en plazos cortos, un mal momento puede pillarte justo cuando necesitas el dinero.

Es como el clima: un día puede ser tormentoso, pero el promedio de una estación es mucho más predecible.

---

**Mini-reflexión:** Si alguien te ofrece "duplicar tu dinero en un mes, sin ningún riesgo", ¿qué parte de la relación riesgo-retorno te dice que desconfíes? ⚖️`,
          quiz: [
            {
              id: "q1",
              prompt: "Una promesa de 'alto rendimiento garantizado y sin riesgo' es...",
              options: [
                "Una gran oportunidad que hay que aprovechar",
                "Una señal de alerta (el riesgo no desaparece, se esconde)",
                "Algo totalmente normal en inversiones",
              ],
              correctIndex: 1,
              explanation:
                "A mayor retorno, mayor riesgo: 'alto y sin riesgo' es una contradicción que debe generar desconfianza.",
            },
            {
              id: "q2",
              prompt: "¿Cómo ayuda un horizonte de tiempo largo frente al riesgo?",
              options: [
                "Elimina el riesgo por completo",
                "Ayuda a sobrellevar la volatilidad, que tiende a suavizarse",
                "No tiene ninguna relación con el riesgo",
              ],
              correctIndex: 1,
              explanation:
                "En plazos largos los altibajos se suavizan; en plazos cortos un mal momento pesa más.",
            },
          ],
        },
      ],
    },
    {
      slug: "diversificacion-vehiculos",
      title: "Diversificación y tipos de activos",
      description: "Cómo repartir el riesgo y qué grandes familias de activos existen.",
      category: "Inversiones",
      lessons: [
        {
          slug: "inv-diversificacion",
          title: "La diversificación",
          summary:
            "Entenderás por qué repartir reduce el riesgo sin depender de acertar una sola apuesta.",
          estimatedMinutes: 6,
          content: `## La diversificación

"No pongas todos los huevos en la misma canasta." Esa frase resume la **diversificación**: repartir tu dinero entre distintas opciones para no depender del destino de una sola.

### Por qué funciona

Si un vendedor solo ofrece helados, un verano lluvioso lo arruina. Si además vende paraguas, cuando uno baja, el otro sube. Combinar cosas que **no se mueven igual** suaviza el resultado total.

Diversificar no busca maximizar la ganancia de una apuesta afortunada, sino **reducir el riesgo** de equivocarte en una sola.

---

**Mini-reflexión:** Si concentraras todos tus ahorros en una única empresa y a esa empresa le va mal, ¿qué pasa con tu dinero? ¿Cómo cambia el panorama si estuviera repartido? 🧺`,
          quiz: [
            {
              id: "q1",
              prompt: "¿Qué significa diversificar?",
              options: [
                "Concentrar todo en la mejor opción",
                "Repartir para no depender de un solo activo",
                "Invertir solo cuando el mercado sube",
              ],
              correctIndex: 1,
              explanation:
                "Diversificar es repartir el dinero para no depender del resultado de una única apuesta.",
            },
            {
              id: "q2",
              prompt: "¿Cuál es el objetivo principal de diversificar?",
              options: [
                "Garantizar la máxima ganancia posible",
                "Reducir el riesgo de equivocarse en una sola apuesta",
                "Evitar pagar impuestos",
              ],
              correctIndex: 1,
              explanation:
                "El fin de diversificar es reducir el riesgo, combinando opciones que no se mueven igual.",
            },
          ],
        },
        {
          slug: "inv-tipos-activos",
          title: "Tipos de activos (a grandes rasgos)",
          summary:
            "Conocerás las grandes familias de activos y su perfil general de riesgo, sin recomendaciones.",
          estimatedMinutes: 7,
          content: `## Tipos de activos (a grandes rasgos)

Existen grandes familias de activos, cada una con un **perfil distinto**. Esto es un mapa conceptual, no una sugerencia de qué comprar.

- **Acciones:** una participación en la propiedad de una empresa. Potencial de crecimiento mayor, pero más **volátiles**.
- **Bonos:** en esencia, un préstamo que haces (a un gobierno o empresa) a cambio de intereses. Suelen ser más **estables**.
- **Fondos y ETF:** una "canasta" que agrupa muchos activos, facilitando la **diversificación** en un solo paso.

### La elección no es universal

Cuál conviene a quién depende de variables personales: **horizonte de tiempo, tolerancia al riesgo y objetivos**. Por eso un buen tutor no te dice "compra esto", sino que te ayuda a pensar esas variables.

---

**Mini-reflexión:** Si las acciones tienden a ser más volátiles y los bonos más estables, ¿cómo crees que el horizonte de tiempo de una persona debería influir en cómo piensa su mezcla? 🗺️`,
          quiz: [
            {
              id: "q1",
              prompt: "A grandes rasgos, un bono representa...",
              options: [
                "Una participación en la propiedad de una empresa",
                "Un préstamo que haces a cambio de intereses",
                "Una moneda digital",
              ],
              correctIndex: 1,
              explanation:
                "Un bono es, en esencia, un préstamo a un gobierno o empresa que paga intereses; suele ser más estable.",
            },
            {
              id: "q2",
              prompt: "Una acción representa...",
              options: [
                "Una participación en la propiedad de una empresa",
                "Un depósito garantizado por el banco",
                "Un seguro de vida",
              ],
              correctIndex: 0,
              explanation:
                "Una acción es una parte de la propiedad de una empresa; su valor tiende a ser más volátil.",
            },
          ],
        },
      ],
    },
  ],
};

// -----------------------------------------------------------------------------
// Ruta 3: Macroeconomía Básica
// -----------------------------------------------------------------------------
export const MACROECONOMIA: LearningPath = {
  slug: "macroeconomia-basica",
  title: "Macroeconomía Básica",
  description:
    "Entiende las fuerzas que mueven la economía y afectan tu dinero: inflación, tasas de interés y ciclos económicos.",
  modules: [
    {
      slug: "indicadores-clave",
      title: "Indicadores clave",
      description: "Las dos fuerzas que más impactan tu bolsillo: inflación y tasas.",
      category: "Inversiones",
      lessons: [
        {
          slug: "macro-inflacion",
          title: "La inflación",
          summary:
            "Entenderás qué es la inflación y cómo erosiona silenciosamente el poder adquisitivo de tu dinero.",
          estimatedMinutes: 6,
          content: `## La inflación

La **inflación** es la subida generalizada y sostenida de los precios. Su efecto en tu vida es simple pero profundo: con el **mismo dinero compras menos** que antes.

### Un ejemplo cotidiano

Si un pan cuesta 1 hoy y con 5% de inflación anual cuesta 1,05 el próximo año, tu billete de siempre alcanza para menos pan. No es que el pan valga más "en esencia": es que tu dinero perdió poder de compra.

### Por qué importa para tu dinero

El dinero guardado "bajo el colchón" no se mantiene igual: **pierde valor** en silencio cada año. Por eso ahorrar es necesario, pero entender la inflación explica por qué a largo plazo también se busca que el dinero al menos le siga el ritmo.

---

**Mini-reflexión:** Si guardas una cantidad fija de efectivo durante diez años con inflación cada año, ¿tendrás más billetes o más poder de compra al final? ¿Son lo mismo? 📉`,
          quiz: [
            {
              id: "q1",
              prompt: "Con inflación, el mismo dinero te permite comprar...",
              options: ["Más que antes", "Menos que antes", "Exactamente lo mismo siempre"],
              correctIndex: 1,
              explanation:
                "La inflación es la subida generalizada de precios: tu dinero pierde poder de compra.",
            },
            {
              id: "q2",
              prompt: "Guardar efectivo sin más, en un entorno con inflación...",
              options: [
                "Mantiene intacto su poder adquisitivo",
                "Pierde poder adquisitivo con el tiempo",
                "Siempre gana valor",
              ],
              correctIndex: 1,
              explanation:
                "El efectivo inactivo pierde valor real año a año cuando hay inflación.",
            },
          ],
        },
        {
          slug: "macro-tasas-interes",
          title: "Tasas de interés",
          summary:
            "Comprenderás la tasa de interés como el precio del dinero y el rol del banco central.",
          estimatedMinutes: 7,
          content: `## Tasas de interés

La **tasa de interés** es, en el fondo, el **precio del dinero en el tiempo**: lo que cuesta pedir prestado y el premio por prestar (o ahorrar).

### El papel del banco central

Los bancos centrales suben o bajan una tasa de referencia para **regular la economía**:

- **Suben** las tasas para **enfriar** la economía y contener la inflación (el crédito se encarece, se gasta menos).
- **Bajan** las tasas para **estimular** la actividad (el crédito se abarata, se invierte y consume más).

### Cómo te toca

Cuando las tasas suben, tus créditos (hipoteca, tarjetas) tienden a costar más, pero tus ahorros pueden rendir algo mejor. Es una palanca que mueve toda la economía a la vez.

---

**Mini-reflexión:** Si subir las tasas encarece el crédito y frena el gasto, ¿por qué crees que un banco central usaría esa herramienta justo cuando la inflación está muy alta? 🏦`,
          quiz: [
            {
              id: "q1",
              prompt: "La tasa de interés puede entenderse como...",
              options: [
                "El precio del dinero en el tiempo",
                "Un impuesto sobre el ahorro",
                "El valor de una acción",
              ],
              correctIndex: 0,
              explanation:
                "La tasa es lo que cuesta pedir prestado y el premio por prestar: el precio del dinero.",
            },
            {
              id: "q2",
              prompt: "Cuando un banco central sube las tasas, en general busca...",
              options: [
                "Estimular el gasto rápidamente",
                "Enfriar la economía y contener la inflación",
                "Bajar el valor de la moneda a propósito",
              ],
              correctIndex: 1,
              explanation:
                "Subir tasas encarece el crédito, reduce el gasto y ayuda a contener la inflación.",
            },
          ],
        },
      ],
    },
    {
      slug: "ciclo-economico",
      title: "El ciclo económico",
      description: "La economía respira: crece, se frena y se recupera.",
      category: "Inversiones",
      lessons: [
        {
          slug: "macro-pib",
          title: "PIB y crecimiento",
          summary: "Sabrás qué mide el PIB y por qué se usa como termómetro de la economía.",
          estimatedMinutes: 5,
          content: `## PIB y crecimiento

El **PIB** (Producto Interno Bruto) mide, a grandes rasgos, el **valor de todos los bienes y servicios** producidos en una economía durante un período.

Se usa como un **termómetro**: si el PIB crece, la economía se expande; si se contrae, se enfría.

### Lo que el PIB no dice

Es útil, pero **no lo cuenta todo**. Un PIB alto no garantiza que la riqueza esté bien repartida ni que la gente viva mejor: no captura el **bienestar** ni la **desigualdad**. Es un dato, no la foto completa.

---

**Mini-reflexión:** Si dos países tienen el mismo PIB pero en uno la riqueza está muy concentrada, ¿el PIB por sí solo te diría cómo vive la mayoría de la gente? 🌡️`,
          quiz: [
            {
              id: "q1",
              prompt: "El PIB mide, a grandes rasgos...",
              options: [
                "La felicidad de la población",
                "El valor de lo producido en una economía",
                "La cantidad de dinero en los bancos",
              ],
              correctIndex: 1,
              explanation:
                "El PIB es el valor de los bienes y servicios producidos: un termómetro de la actividad.",
            },
            {
              id: "q2",
              prompt: "El PIB por sí solo...",
              options: [
                "Captura perfectamente el bienestar y la igualdad",
                "No captura bienestar ni desigualdad",
                "Mide exactamente el ahorro de las familias",
              ],
              correctIndex: 1,
              explanation:
                "Un PIB alto no dice cómo se reparte la riqueza ni el bienestar real de la gente.",
            },
          ],
        },
        {
          slug: "macro-ciclos",
          title: "Ciclos económicos y desempleo",
          summary:
            "Entenderás las fases de expansión y recesión y su relación con el empleo.",
          estimatedMinutes: 6,
          content: `## Ciclos económicos y desempleo

La economía **no crece en línea recta**: se mueve en ciclos, como la respiración. Las fases típicas son **expansión → pico → recesión → recuperación**, y vuelta a empezar.

### La conexión con el empleo

En una **recesión**, las empresas venden menos, se frenan y suele **aumentar el desempleo**. En la expansión ocurre lo contrario.

### Tu defensa personal

No puedes controlar el ciclo, pero sí prepararte para él. Aquí se conecta todo lo aprendido: un **fondo de emergencia** es tu amortiguador cuando el ciclo se pone difícil.

---

**Mini-reflexión:** Si sabes que tarde o temprano llega una fase de contracción, ¿qué hábito de las primeras lecciones te protege mejor de un imprevisto de ingresos? 🔄`,
          quiz: [
            {
              id: "q1",
              prompt: "En una recesión, típicamente...",
              options: [
                "Baja el desempleo",
                "Aumenta el desempleo",
                "El empleo no cambia nunca",
              ],
              correctIndex: 1,
              explanation:
                "En recesión las empresas se frenan y el desempleo tiende a aumentar.",
            },
            {
              id: "q2",
              prompt: "Ante la naturaleza cíclica de la economía, una defensa personal clave es...",
              options: [
                "Gastar todo antes de la recesión",
                "Tener un fondo de emergencia",
                "Ignorar por completo el tema",
              ],
              correctIndex: 1,
              explanation:
                "El fondo de emergencia es el amortiguador personal frente a las fases difíciles del ciclo.",
            },
          ],
        },
      ],
    },
  ],
};

// -----------------------------------------------------------------------------
// Ruta 4: Gestión de Riesgo y Finanzas Personales Avanzadas
// -----------------------------------------------------------------------------
export const GESTION_RIESGO: LearningPath = {
  slug: "gestion-riesgo-avanzada",
  title: "Gestión de Riesgo y Finanzas Personales Avanzadas",
  description:
    "Protege lo que has construido y afina tus decisiones: seguros, diversificación del ingreso, horizonte de metas y sesgos de conducta.",
  modules: [
    {
      slug: "proteccion-patrimonio",
      title: "Proteger tu patrimonio",
      description: "Cómo blindar tu estabilidad frente a golpes inesperados.",
      category: "Finanzas Personales",
      lessons: [
        {
          slug: "riesgo-seguros",
          title: "El seguro como herramienta",
          summary:
            "Entenderás el seguro como una transferencia de riesgo y cuándo aporta más valor.",
          estimatedMinutes: 6,
          content: `## El seguro como herramienta

Un seguro no es un gasto inútil: es **gestión de riesgo**. Pagas una cantidad pequeña y conocida (la **prima**) para **transferir** a la aseguradora un riesgo grande e improbable que tú no podrías absorber solo.

### Cuándo aporta más valor

El seguro brilla frente a eventos **poco probables pero potencialmente catastróficos** (un accidente grave, un incendio). Para gastos pequeños y frecuentes, muchas veces conviene más tu propio fondo de emergencia.

Es como un **airbag**: esperas no usarlo nunca, pero si ocurre lo impensable, evita que un golpe te destruya.

---

**Mini-reflexión:** Si un riesgo es pequeño y frecuente, ¿tiene sentido asegurarlo, o lo cubre mejor tu fondo de emergencia? ¿Y si es enorme y raro? 🛡️`,
          quiz: [
            {
              id: "q1",
              prompt: "Contratar un seguro es esencialmente...",
              options: [
                "Regalar dinero a la aseguradora",
                "Transferir un riesgo a cambio de una prima",
                "Una forma de inversión de alto rendimiento",
              ],
              correctIndex: 1,
              explanation:
                "Pagas una prima para transferir a la aseguradora un riesgo que no podrías absorber solo.",
            },
            {
              id: "q2",
              prompt: "El seguro es más útil para riesgos...",
              options: [
                "Pequeños y frecuentes",
                "Grandes e improbables, potencialmente catastróficos",
                "Que ya ocurrieron",
              ],
              correctIndex: 1,
              explanation:
                "Los gastos pequeños los cubre mejor tu fondo; el seguro protege ante lo catastrófico.",
            },
          ],
        },
        {
          slug: "riesgo-ingresos",
          title: "Diversificar tus ingresos",
          summary:
            "Verás por qué depender de una sola fuente de ingreso es un riesgo y cómo mitigarlo.",
          estimatedMinutes: 6,
          content: `## Diversificar tus ingresos

Ya viste la diversificación al invertir. La misma lógica aplica a tus **ingresos**: depender de **una sola fuente** te hace frágil. Si esa fuente desaparece, tu economía entera se tambalea.

### Cómo reducir esa fragilidad

- Desarrollar **habilidades** que te den opciones (empleabilidad).
- Explorar **fuentes adicionales** de ingreso cuando sea posible.
- No depender de que **una única cosa** salga siempre bien.

No se trata de trabajar sin descanso, sino de que la pérdida de una fuente no sea una catástrofe, sino un tropiezo manejable.

---

**Mini-reflexión:** Si tu único ingreso desapareciera mañana, ¿cuánto aguantarías? ¿Cómo cambian tus opciones si tuvieras una segunda fuente, aunque sea pequeña? 🧩`,
          quiz: [
            {
              id: "q1",
              prompt: "Depender de una única fuente de ingreso...",
              options: [
                "Reduce tu riesgo financiero",
                "Aumenta tu fragilidad financiera",
                "No influye en tu estabilidad",
              ],
              correctIndex: 1,
              explanation:
                "Si esa única fuente falla, toda tu economía se resiente: es un punto único de fallo.",
            },
            {
              id: "q2",
              prompt: "Diversificar los ingresos busca...",
              options: [
                "Reducir el impacto de perder una fuente",
                "Pagar menos impuestos",
                "Trabajar siempre más horas",
              ],
              correctIndex: 0,
              explanation:
                "El objetivo es que perder una fuente sea un tropiezo manejable, no una catástrofe.",
            },
          ],
        },
      ],
    },
    {
      slug: "planificacion-avanzada",
      title: "Planificación y conducta",
      description: "Alinear decisiones con tus metas y reconocer tus propios sesgos.",
      category: "Finanzas Personales",
      lessons: [
        {
          slug: "riesgo-horizonte-metas",
          title: "Horizonte y metas",
          summary:
            "Aprenderás a alinear tus decisiones financieras con el plazo de cada meta.",
          estimatedMinutes: 6,
          content: `## Horizonte y metas

No todo el dinero cumple la misma función. Cada meta tiene un **plazo**, y el plazo debería **guiar cuánto riesgo** es razonable asumir.

- **Corto plazo** (meses): el enfrentamiento inicial de un imprevisto o una compra próxima. El dinero debe estar **seguro y disponible**, con bajo riesgo.
- **Mediano plazo** (algunos años): equilibrio entre estabilidad y crecimiento.
- **Largo plazo** (muchos años): puedes tolerar más volatilidad, porque el tiempo la suaviza.

### El error clásico

Exponer a alta volatilidad un dinero que necesitarás **pronto** es arriesgado: puede tocar un mal momento justo cuando lo necesitas. El plazo manda.

---

**Mini-reflexión:** Si vas a necesitar cierto dinero dentro de tres meses, ¿tiene sentido exponerlo a fuertes altibajos? ¿Por qué el mismo dinero a veinte años sí podría? ⏱️`,
          quiz: [
            {
              id: "q1",
              prompt: "El dinero que necesitarás en pocos meses conviene mantenerlo...",
              options: [
                "En algo muy volátil para que crezca rápido",
                "Seguro y disponible, con bajo riesgo",
                "Siempre en acciones",
              ],
              correctIndex: 1,
              explanation:
                "A corto plazo prima la seguridad y disponibilidad: un mal momento podría pillarte al necesitarlo.",
            },
            {
              id: "q2",
              prompt: "El plazo de una meta debería...",
              options: [
                "Ser irrelevante para tus decisiones",
                "Guiar cuánto riesgo es razonable asumir",
                "Depender solo de la moda del momento",
              ],
              correctIndex: 1,
              explanation:
                "El horizonte manda: a más plazo, más tolerancia a la volatilidad; a menos plazo, más prudencia.",
            },
          ],
        },
        {
          slug: "riesgo-sesgos",
          title: "Sesgos y decisiones",
          summary: "Reconocerás sesgos comunes que sabotean las decisiones financieras.",
          estimatedMinutes: 6,
          content: `## Sesgos y decisiones

Somos humanos: decidimos con emociones, no solo con números. Reconocer nuestros **sesgos** ayuda a decidir con criterio en lugar de por impulso.

### Tres sesgos frecuentes

- **Aversión a la pérdida:** duele más perder 100 que la alegría de ganar 100, y eso puede paralizarnos.
- **Efecto manada:** hacer algo "porque todos lo hacen", sin analizarlo.
- **Exceso de confianza:** creer que sabemos más de lo que sabemos y subestimar el riesgo.

### El antídoto

Un **plan escrito** y decidido en frío es tu mejor defensa contra las decisiones tomadas en pánico o euforia. Cuando el mercado o la vida se agiten, sigues tu plan, no tu adrenalina.

---

**Mini-reflexión:** ¿Recuerdas alguna decisión (financiera o no) que tomaste "porque todos lo hacían"? ¿Cómo habría cambiado si hubieras tenido un plan definido de antemano? 🧠`,
          quiz: [
            {
              id: "q1",
              prompt: "Comprar algo solo 'porque todos lo hacen' es un ejemplo de...",
              options: ["Aversión a la pérdida", "Efecto manada", "Diversificación"],
              correctIndex: 1,
              explanation:
                "El efecto manada es seguir a la multitud sin un análisis propio.",
            },
            {
              id: "q2",
              prompt: "Reconocer nuestros sesgos sirve para...",
              options: [
                "Decidir con criterio y no por impulso",
                "Eliminar todo riesgo de nuestras finanzas",
                "Predecir el mercado con exactitud",
              ],
              correctIndex: 0,
              explanation:
                "Identificar los sesgos nos permite seguir un plan pensado en frío, no la emoción del momento.",
            },
          ],
        },
      ],
    },
  ],
};

// -----------------------------------------------------------------------------
// Ruta 5: Presupuesto y Vida Financiera Diaria · Categoría: Finanzas Personales
// -----------------------------------------------------------------------------
export const VIDA_FINANCIERA: LearningPath = {
  slug: "vida-financiera-diaria",
  title: "Presupuesto y Vida Financiera Diaria",
  description:
    "El día a día del dinero: métodos concretos de presupuesto, cómo funcionan los productos bancarios y cómo manejar el crédito sin que te maneje a ti.",
  modules: [
    {
      slug: "presupuesto-en-la-practica",
      title: "El presupuesto en la práctica",
      description: "Métodos concretos para repartir tu dinero y sostener el hábito.",
      category: "Finanzas Personales",
      lessons: [
        {
          slug: "presupuesto-50-30-20",
          title: "El método 50/30/20 paso a paso",
          summary:
            "Aplicarás la regla 50/30/20 a tus números reales y sabrás cómo adaptarla cuando no cuadra.",
          estimatedMinutes: 8,
          content: `## El método 50/30/20 paso a paso

Ya viste la idea general: **50% necesidades, 30% deseos, 20% futuro**. Ahora vamos a aplicarla a números reales, que es donde suele romperse.

### Paso 1: parte del ingreso neto

No uses tu sueldo bruto. Usa lo que **realmente llega a tu cuenta**, después de impuestos y descuentos. Ese es el 100% que vas a repartir.

### Paso 2: clasifica cada gasto

La duda clásica es dónde cae cada cosa. Un criterio simple:

- **Necesidad:** si dejas de pagarlo, tu vida se complica de verdad (arriendo, comida, transporte al trabajo, servicios básicos, medicamentos).
- **Deseo:** mejora tu vida, pero podrías vivir sin ello (streaming, delivery, la versión premium de algo).

Ojo con las trampas: el plan de telefonía es una necesidad; el plan **más caro** del que necesitas, en la parte que excede, es un deseo.

### Paso 3: ajusta cuando no cuadra

Si tus necesidades se comen el 70%, el método **no falló**: te está mostrando un diagnóstico. Tienes tres palancas:

1. Bajar el costo de una necesidad grande (vivienda y transporte suelen ser las mayores).
2. Subir los ingresos.
3. Empezar con un reparto realista (60/20/20) y moverlo poco a poco.

Lo importante no es acertar los porcentajes exactos, sino que el **20% del futuro se aparte primero**, no al final.

---

**Mini-ejercicio:** Toma tu último mes. Suma tus necesidades y divídelas por tu ingreso neto. ¿Qué porcentaje te da? Ese único número ya te dice cuánto margen real tienes. 🧮

---

👉 **Ponlo a prueba:** haz el reparto con tus cifras en el [presupuestador 50/30/20](/simuladores/presupuesto).`,
        },
        {
          slug: "presupuesto-base-cero",
          title: "Presupuesto base cero",
          summary:
            "Entenderás el método donde cada peso recibe un destino antes de empezar el mes.",
          estimatedMinutes: 7,
          content: `## Presupuesto base cero

En el presupuesto **base cero**, asignas un destino a **cada peso** de tu ingreso antes de que empiece el mes, hasta que el dinero sin asignar llegue a **cero**.

No significa gastarlo todo. "Ahorro" e "inversión" son destinos válidos. Cero es el dinero **sin instrucciones**, no el dinero disponible.

### Cómo se hace

1. Escribe tu ingreso previsto del mes.
2. Ve restando: gastos fijos, ahorro, deudas, categorías variables (comida, transporte, ocio).
3. Sigue hasta que no quede nada sin asignar.

### Por qué funciona

El dinero sin nombre **se evapora**. Cuando cada peso tiene una tarea, la pregunta deja de ser "¿me alcanza?" y pasa a ser "¿de qué categoría sale esto?". Eso convierte cada gasto en una decisión consciente.

### Su costo

Es más exigente que el 50/30/20: requiere revisarlo cada mes. A cambio, da un control mucho más fino, sobre todo si tus gastos varían bastante.

---

**Mini-reflexión:** Si a fin de mes te preguntaran "¿dónde quedó el sobrante?", ¿podrías responder con precisión? Ese hueco es exactamente lo que el base cero elimina. 🎯`,
        },
        {
          slug: "metodo-de-sobres",
          title: "El método de los sobres",
          summary:
            "Conocerás la técnica de límites físicos o digitales por categoría y cuándo conviene usarla.",
          estimatedMinutes: 6,
          content: `## El método de los sobres

Es el sistema más antiguo y más visual: divides tu dinero en **sobres**, uno por categoría (comida, transporte, ocio), y **cuando un sobre se vacía, esa categoría se acabó** hasta el próximo mes.

### La versión moderna

Ya casi nadie usa efectivo, pero la lógica se traslada:

- Cuentas o "bolsillos" separados dentro de tu app bancaria.
- Tarjetas de prepago recargadas con un monto fijo.
- Una simple hoja de cálculo con el saldo restante por categoría.

### Por qué es tan efectivo

Convierte un límite abstracto en algo **visible**. Ver que quedan 12.000 en el sobre de "salidas" pesa mucho más que recordar vagamente que "iba a gastar menos". Es un freno externo que no depende de tu fuerza de voluntad.

### Cuándo brilla

Sobre todo si tu problema no son los gastos fijos, sino los **variables** que se descontrolan sin darte cuenta.

---

**Mini-ejercicio:** Elige **una sola** categoría que se te suele ir de las manos y ponle un sobre este mes. ¿Cuál sería? 📩`,
        },
        {
          slug: "registrar-gastos",
          title: "Cómo registrar y categorizar tus gastos",
          summary:
            "Aprenderás a medir tus gastos sin abandonar al tercer día, y qué hacer con esos datos.",
          estimatedMinutes: 6,
          content: `## Cómo registrar y categorizar tus gastos

No puedes mejorar lo que no mides. Pero el registro de gastos tiene un enemigo: **se abandona rápido**. La clave es que sea sostenible, no perfecto.

### Tres niveles de esfuerzo

- **Nivel 1 (mínimo):** una vez al mes, revisa la cartola del banco y clasifica los movimientos grandes. 15 minutos.
- **Nivel 2:** anota los gastos en efectivo o los que no pasan por la cuenta, el mismo día.
- **Nivel 3:** categorización detallada de todo, con app o planilla.

Empieza por el nivel 1. Un registro imperfecto que mantienes vence a uno perfecto que abandonas.

### Categorías útiles

Pocas y claras: **vivienda, alimentación, transporte, salud, deudas, ocio, otros**. Si tienes veinte categorías, no vas a clasificar nada.

### El paso que la gente se salta

Registrar no sirve de nada si no **miras el resultado**. Dedica 10 minutos a fin de mes a una sola pregunta: ¿qué categoría me sorprendió?

---

**Mini-reflexión:** ¿Cuál crees que sería tu categoría sorpresa: la que gastas mucho más de lo que imaginas? Anótala mentalmente y compruébalo este mes. 🔍`,
        },
        {
          slug: "gastos-hormiga",
          title: "Los gastos hormiga",
          summary:
            "Verás cómo los gastos pequeños y repetidos se acumulan, sin caer en la culpa innecesaria.",
          estimatedMinutes: 5,
          content: `## Los gastos hormiga

Son gastos **pequeños, frecuentes y casi invisibles**: el café diario, la app que no usas, el delivery del apuro. Individualmente son irrelevantes; sumados durante un año, pueden equivaler a varios meses de ahorro.

### La matemática silenciosa

Un gasto de 3.000 cinco días a la semana son unos 60.000 al mes y más de 700.000 al año. No es que el café sea "malo": es que **rara vez ves ese total**.

### Las suscripciones: el caso más claro

Cargos automáticos que ya nadie recuerda haber contratado. Revisa tus cargos recurrentes una vez al año; casi siempre aparece al menos uno que puedes cancelar sin echarlo de menos.

### El matiz importante

Esto **no** es una orden de eliminar todo placer pequeño. Si ese café es lo mejor de tu mañana, defiéndelo y recorta en otra parte. El objetivo es que el gasto sea **elegido**, no automático.

---

**Mini-ejercicio:** Nombra tres cargos recurrentes que pagas hoy. ¿Los usaste todos el último mes? 🐜`,
        },
        {
          slug: "presupuesto-ingresos-variables",
          title: "Presupuestar con ingresos variables",
          summary:
            "Sabrás cómo planificar cuando tus ingresos cambian cada mes (freelance, comisiones, temporadas).",
          estimatedMinutes: 7,
          content: `## Presupuestar con ingresos variables

Si trabajas por proyectos, comisiones o temporadas, el consejo de "reparte tu sueldo" no te sirve: **no hay un sueldo fijo que repartir**. Necesitas otra técnica.

### La técnica del sueldo propio

1. Mira tus últimos 6 a 12 meses de ingresos y quédate con el **mes más bajo** (o el promedio de los tres peores).
2. Ese monto conservador es tu **sueldo base**: sobre él construyes tu presupuesto normal.
3. Todo lo que entre **por encima** no se gasta: va a un fondo amortiguador.

### El fondo amortiguador

Es una cuenta que recibe los excedentes de los meses buenos y **paga la diferencia en los meses malos**. Su función es convertir un ingreso irregular en un flujo estable para ti.

### Un fondo de emergencia más grande

Con ingresos variables, la referencia de 3 meses de gastos se queda corta. Apunta a **6 meses o más**: tu riesgo de ingreso es estructuralmente mayor.

---

**Mini-reflexión:** Si tu próximo mes fuera el peor del año, ¿tu presupuesto actual seguiría en pie? Esa es exactamente la pregunta que responde el sueldo propio. 📊`,
        },
      ],
    },
    {
      slug: "banca-y-medios-de-pago",
      title: "Banca y medios de pago",
      description: "Los productos que usas todos los días y lo que realmente te cuestan.",
      category: "Finanzas Personales",
      lessons: [
        {
          slug: "tipos-de-cuentas-bancarias",
          title: "Tipos de cuentas bancarias",
          summary:
            "Distinguirás cuenta corriente, de ahorro y vista, y para qué sirve cada una.",
          estimatedMinutes: 6,
          content: `## Tipos de cuentas bancarias

No todas las cuentas hacen lo mismo. Elegir mal significa pagar comisiones por servicios que no usas.

### Las tres familias

- **Cuenta vista o básica:** para recibir y mover dinero del día a día. Suele tener costos bajos y pocos requisitos. No paga intereses.
- **Cuenta corriente:** la versión completa (a veces con línea de crédito y chequera). Más servicios, pero suele exigir ingresos mínimos y cobrar mantención.
- **Cuenta de ahorro:** pensada para dejar dinero quieto. Puede pagar un interés pequeño y a veces limita los retiros.

### La estructura que funciona para mucha gente

Separar por función: una cuenta para el **día a día** y otra distinta para el **fondo de emergencia**. Que el colchón no esté a un clic de distancia es una ventaja, no una molestia.

> ⚠️ Los nombres y condiciones cambian según el país y la institución. Aquí importa el concepto: qué función cumple cada cuenta.

---

**Mini-reflexión:** ¿Tu ahorro está hoy en la misma cuenta desde la que pagas todo? ¿Qué crees que pasa con la tentación cuando sí lo está? 🏦`,
        },
        {
          slug: "debito-vs-credito",
          title: "Débito vs. crédito: cómo funcionan",
          summary:
            "Entenderás la diferencia real entre pagar con tu dinero y pagar con dinero prestado.",
          estimatedMinutes: 7,
          content: `## Débito vs. crédito: cómo funcionan

Parecen lo mismo al pasarlas por el datáfono, pero son productos **opuestos**.

### Débito

Paga con **tu** dinero, ya disponible en la cuenta. Si no hay saldo, la compra se rechaza. Ese rechazo es una protección, no un fallo.

### Crédito

Paga con dinero **del banco**, que te presta hasta un cupo. Después tienes dos caminos:

- **Pagar el total facturado:** el crédito te salió gratis. Usaste el dinero del banco unas semanas sin costo.
- **Pagar el mínimo:** el resto queda como deuda y empieza a generar intereses, normalmente **altos**. Aquí es donde la gente se enreda.

### El pago mínimo: la trampa clásica

El monto mínimo está diseñado para que la deuda **dure**. Pagando solo el mínimo, una parte enorme de cada cuota se va en intereses y el saldo baja lentísimo. Es el interés compuesto rodando en tu contra.

### Cómo usar el crédito a favor

Como medio de pago, no como fuente de financiamiento: gastar solo lo que **ya tienes** y pagar el total cada mes.

---

**Mini-reflexión:** Si pagas el total de tu tarjeta cada mes, ¿cuánto te cuesta el crédito? ¿Y si pagas el mínimo? La diferencia entre ambas respuestas es toda la lección. 💳`,
        },
        {
          slug: "comisiones-bancarias",
          title: "Comisiones y costos ocultos",
          summary:
            "Aprenderás a detectar los cobros que erosionan tu dinero sin que los notes.",
          estimatedMinutes: 6,
          content: `## Comisiones y costos ocultos

Las comisiones son pequeñas por diseño: pasan desapercibidas, pero se cobran **todos los meses, durante años**.

### Las más frecuentes

- **Mantención** de la cuenta o de la tarjeta.
- **Giros** en cajeros de otra red.
- **Transferencias** a otras instituciones o al extranjero.
- **Conversión de moneda** en compras internacionales.
- **Sobregiro:** el más caro de todos por cada peso usado.

### La cuenta que nadie hace

Una mantención de 5.000 al mes son 60.000 al año. Durante diez años, con lo que podrías haber ganado invirtiéndolo, la cifra es varias veces mayor.

### Qué hacer

1. Busca en tu cartola la línea de **cargos** y suma un año.
2. Pregunta a tu banco si existe una versión sin mantención (casi siempre existe).
3. Compara antes de contratar: el costo total, no el regalo de bienvenida.

---

**Mini-ejercicio:** Abre tu última cartola y busca todos los cobros que no sean compras tuyas. ¿Cuánto suman al año? 🧾`,
        },
        {
          slug: "pagos-digitales-y-billeteras",
          title: "Pagos digitales y billeteras",
          summary:
            "Conocerás cómo funcionan las billeteras y transferencias digitales, y qué cuidar al usarlas.",
          estimatedMinutes: 5,
          content: `## Pagos digitales y billeteras

Una **billetera digital** no es un banco: en la mayoría de los casos es una capa sobre tus cuentas o un saldo prepagado que tú cargas.

### Sus ventajas reales

- Pagos y transferencias inmediatas.
- Registro automático de cada movimiento (útil para presupuestar).
- Menos efectivo encima.

### Lo que conviene tener claro

- **¿Dónde está tu dinero?** Si el saldo vive en la app y no en un banco, revisa qué protección tiene ese dinero.
- **Las transferencias son inmediatas e irreversibles.** Un dígito mal escrito en el destinatario rara vez se revierte: confirma siempre antes de enviar.
- **Facilidad = más gasto.** Que pagar sea tan fácil elimina la fricción que antes te hacía dudar. Compénsalo con límites o alertas.

---

**Mini-reflexión:** Desde que pagas con el teléfono, ¿sientes el gasto igual que cuando entregabas billetes? Esa diferencia de percepción es real y vale la pena tenerla presente. 📱`,
        },
        {
          slug: "seguridad-y-fraude-financiero",
          title: "Seguridad y fraude financiero",
          summary:
            "Reconocerás las estafas más comunes y las prácticas básicas para proteger tu dinero.",
          estimatedMinutes: 7,
          content: `## Seguridad y fraude financiero

El fraude moderno rara vez rompe la seguridad del banco: **te convence a ti** de entregar el acceso. Por eso el mejor filtro eres tú.

### Las señales de alarma

- **Urgencia:** "tu cuenta será bloqueada en 30 minutos". La prisa apaga el pensamiento crítico; es la herramienta favorita del estafador.
- **Contacto no solicitado:** llamadas, correos o mensajes que llegan sin que tú iniciaras nada.
- **Piden claves o códigos:** ningún banco legítimo te pedirá tu contraseña ni el código de verificación que acabas de recibir.
- **Enlaces:** direcciones parecidas a la real, con una letra cambiada.

### Reglas prácticas

1. Ante cualquier contacto, **corta y llama tú** al número oficial de tu tarjeta.
2. Activa la **verificación en dos pasos** y las **alertas** de movimiento.
3. Contraseñas distintas para el banco y para todo lo demás.
4. Nada de operaciones bancarias en redes wifi públicas.

### Si ya ocurrió

Actúa rápido: bloquea la tarjeta, avisa al banco y deja constancia formal. Los plazos para reclamar suelen ser cortos.

---

**Mini-reflexión:** Si mañana recibes un mensaje urgente de "tu banco", ¿cuál sería tu primer movimiento? Tenerlo decidido de antemano es media defensa. 🛡️`,
        },
      ],
    },
    {
      slug: "credito-y-deuda-avanzada",
      title: "Crédito y deuda en profundidad",
      description: "Cómo se mide tu crédito, cuánto cuesta de verdad y cómo salir de una deuda.",
      category: "Finanzas Personales",
      lessons: [
        {
          slug: "historial-y-puntaje-crediticio",
          title: "Historial y puntaje crediticio",
          summary:
            "Entenderás qué es tu historial de crédito, quién lo mira y cómo se construye con el tiempo.",
          estimatedMinutes: 6,
          content: `## Historial y puntaje crediticio

Tu **historial crediticio** es el registro de cómo has cumplido tus compromisos de pago. Los prestamistas lo usan para estimar una sola cosa: **qué tan probable es que les pagues**.

### Qué suele pesar

- **Puntualidad de pago:** el factor más importante y de lejos.
- **Cuánto de tu cupo usas:** tener la tarjeta siempre al tope se lee como señal de estrés financiero, aunque pagues.
- **Antigüedad:** un historial largo dice más que uno recién nacido.
- **Consultas recientes:** pedir muchos créditos en poco tiempo enciende alertas.

### Por qué te importa aunque no quieras endeudarte

Ese registro puede influir en el arriendo de una vivienda, en la contratación de servicios y, sobre todo, en la **tasa** que te ofrecen. Un buen historial se traduce en dinero: la misma deuda te cuesta menos.

### Cómo se construye

Sin atajos: pagar a tiempo, de forma consistente, durante años. No requiere endeudarse mucho, solo cumplir.

---

**Mini-reflexión:** Si un prestamista solo pudiera ver tus últimos 12 meses de pagos, ¿qué historia contarían sobre ti? 📈`,
        },
        {
          slug: "cae-y-costo-total-del-credito",
          title: "La tasa real: CAE y costo total",
          summary:
            "Sabrás por qué la cuota mensual engaña y qué indicador mirar para comparar créditos.",
          estimatedMinutes: 8,
          content: `## La tasa real: CAE y costo total

La pregunta "¿cuánto es la cuota?" es la que casi todos hacen, y es la **equivocada**. Una cuota baja puede esconder un crédito carísimo si el plazo es largo.

### Los tres números que sí importan

1. **La tasa de interés:** el precio del dinero.
2. **La carga anual equivalente (CAE o TAE):** la tasa **más todos los costos asociados** (comisiones, seguros obligatorios, gastos). Es el número que permite comparar créditos distintos de forma justa.
3. **El costo total del crédito:** cuánto devuelves en total. Cuota × número de cuotas.

### El ejemplo que lo aclara todo

Pedir 1.000.000:

- A 12 cuotas: cuota alta, costo total bajo.
- A 60 cuotas: cuota cómoda, y puedes terminar devolviendo bastante más de 1.500.000.

La cuota bajó; el crédito se encareció. **Alargar el plazo casi siempre significa pagar más.**

### La regla al comparar

Pide siempre el **CAE** y el **costo total**, nunca solo la cuota. Si alguien evita darte esos números, ya tienes una respuesta.

---

**Mini-ejercicio:** Piensa en un crédito o compra en cuotas que tengas hoy. Multiplica la cuota por el número de cuotas y compáralo con el precio al contado. ¿Cuánto pagaste por financiarlo? 🔢`,
        },
        {
          slug: "bola-de-nieve-vs-avalancha",
          title: "Dos estrategias para salir de deudas",
          summary:
            "Compararás el método bola de nieve y el método avalancha para decidir cuál te conviene.",
          estimatedMinutes: 7,
          content: `## Dos estrategias para salir de deudas

Cuando tienes varias deudas, pagas el mínimo de todas y diriges **todo el excedente a una sola**. La pregunta es: ¿a cuál primero?

### Método avalancha (el matemáticamente óptimo)

Atacas primero la deuda con la **tasa más alta**, sin importar su tamaño.

- ✅ Pagas menos intereses en total. Es el más barato.
- ❌ Si esa deuda es enorme, puedes pasar meses sin ver ningún avance visible y desmotivarte.

### Método bola de nieve (el psicológicamente óptimo)

Atacas primero la deuda **más pequeña**, sin importar su tasa.

- ✅ Eliminas una deuda completa pronto. Esa victoria temprana genera impulso, y el impulso es lo que sostiene el plan.
- ❌ Cuesta algo más en intereses totales.

### Cuál elegir

Depende de ti, no de la planilla. El mejor método es **el que vas a mantener**. Si ya fracasaste antes por desánimo, la bola de nieve suele ganar aunque cueste un poco más. Si te motivan los números, avalancha.

### El paso invisible

Cuando liquides una deuda, **redirige esa cuota** a la siguiente en vez de absorberla en tu gasto. Ahí está toda la potencia del método.

---

**Mini-reflexión:** ¿Qué te haría más falta para no abandonar el plan: ahorrar el máximo posible en intereses, o ver una deuda desaparecer pronto? ❄️`,
        },
        {
          slug: "refinanciar-y-consolidar-deudas",
          title: "Refinanciar y consolidar deudas",
          summary:
            "Entenderás qué son estas herramientas, cuándo ayudan de verdad y cuándo son una trampa.",
          estimatedMinutes: 7,
          content: `## Refinanciar y consolidar deudas

Son dos herramientas que suenan parecidas y suelen ofrecerse justo cuando estás apretado.

- **Refinanciar:** cambiar las condiciones de una deuda (normalmente alargar el plazo para bajar la cuota).
- **Consolidar:** juntar varias deudas en un solo crédito, con una sola cuota.

### Cuándo ayudan de verdad

Cuando el **CAE del nuevo crédito es menor** que el promedio de lo que ya tienes, y cuando pasar de cinco cuotas a una te permite realmente organizarte. Ahí hay un beneficio medible.

### Cuándo son una trampa

Cuando bajan la cuota **solo alargando el plazo**. Sientes alivio inmediato y terminas pagando bastante más en total. Y hay un riesgo mayor:

> El error clásico: consolidar las tarjetas, quedar con el cupo liberado… y volver a usarlas. Ahora tienes el crédito nuevo **y** las tarjetas otra vez cargadas.

### Las preguntas antes de firmar

1. ¿Cuál es el **costo total** de la deuda nueva frente a la suma de las actuales?
2. ¿Qué cambió en mis hábitos para que esto no se repita?
3. ¿Hay comisiones por prepago o por cierre?

---

**Mini-reflexión:** Si refinanciar baja tu cuota pero sube lo que pagas en total, ¿en qué situación concreta seguiría siendo la decisión correcta? 🔄`,
        },
        {
          slug: "senales-de-sobreendeudamiento",
          title: "Señales de sobreendeudamiento",
          summary:
            "Identificarás las alertas tempranas de una deuda que se está saliendo de control.",
          estimatedMinutes: 6,
          content: `## Señales de sobreendeudamiento

El sobreendeudamiento casi nunca llega de golpe: se instala de a poco, y quien lo vive suele ser el último en verlo.

### Las alertas

- Pagas **solo el mínimo** de la tarjeta de forma habitual.
- Usas **una deuda para pagar otra**.
- Tus cuotas superan cerca del **35–40% de tu ingreso** neto.
- Cubres gastos básicos (comida, servicios) con crédito.
- No sabes con exactitud **cuánto debes en total**.
- Evitas abrir los estados de cuenta.

Con una o dos, hay que corregir el rumbo. Con cuatro o más, el problema ya es estructural.

### El primer paso, siempre el mismo

**Escribirlo todo.** Cada deuda: monto, tasa, cuota y plazo. Duele, pero un problema medido deja de crecer en la imaginación y empieza a tener solución.

### Después

Prioriza lo esencial (vivienda y comida), habla con los acreedores **antes** de caer en mora — casi siempre hay más margen antes que después — y elige un método de pago (avalancha o bola de nieve).

> ⚠️ Si la situación te supera, buscar orientación formal no es un fracaso: es la decisión sensata.

---

**Mini-reflexión:** Sin mirar nada, ¿podrías decir cuánto debes en total hoy? Si la respuesta es no, ya sabes cuál es tu siguiente tarea. 🚨`,
        },
        {
          slug: "credito-hipotecario-basico",
          title: "El crédito hipotecario, en simple",
          summary:
            "Conocerás las piezas de un crédito de vivienda: pie, plazo, tasa y el peso de los intereses.",
          estimatedMinutes: 8,
          content: `## El crédito hipotecario, en simple

Suele ser la deuda más grande y más larga de una vida. Entender sus piezas antes de firmar cambia mucho el resultado final.

### Las piezas

- **Pie (o enganche):** la parte que pagas de tu bolsillo. Cuanto mayor, menos financias y mejores condiciones sueles obtener.
- **Monto financiado:** el resto, que pide prestado al banco.
- **Plazo:** 15, 20, 30 años. Más plazo, menor cuota, **muchos más intereses** en total.
- **Tasa fija o variable:** la fija te da certeza; la variable puede empezar más baja pero cambia con el mercado.

### El dato que sorprende

En un crédito largo, durante los primeros años la mayor parte de cada cuota se va en **intereses**, no en amortizar la deuda. Por eso, tras cinco años pagando, el saldo bajó menos de lo que esperabas.

De ahí que los **abonos extra a capital** al principio tengan un efecto tan grande: recortan años de intereses.

### Lo que casi nadie suma

Además de la cuota: contribuciones, seguros, mantención, gastos notariales y de tasación. Una vivienda cuesta más que su crédito.

> ⚠️ Esto es formación conceptual, no una recomendación sobre productos concretos. Las condiciones varían mucho entre países e instituciones.

---

**Mini-reflexión:** Entre un crédito a 20 años y uno a 30, la cuota baja pero los intereses totales suben bastante. ¿Qué información necesitarías sobre tu propia vida para decidir cuál te conviene? 🏠`,
        },
      ],
    },
  ],
};

// -----------------------------------------------------------------------------
// Ruta 6: Metas, Impuestos y Futuro · Categoría: Finanzas Personales
// -----------------------------------------------------------------------------
export const METAS_Y_FUTURO: LearningPath = {
  slug: "metas-impuestos-y-futuro",
  title: "Metas, Impuestos y Futuro",
  description:
    "Del corto al largo plazo: fijar metas medibles, entender qué te descuentan, preparar tu jubilación y decidir bien en los grandes momentos de la vida.",
  modules: [
    {
      slug: "metas-y-patrimonio",
      title: "Metas y patrimonio",
      description: "Cómo medir dónde estás y hacia dónde quieres ir, con números concretos.",
      category: "Finanzas Personales",
      lessons: [
        {
          slug: "metas-financieras-smart",
          title: "Metas financieras que sí funcionan",
          summary:
            "Convertirás deseos vagos en metas medibles, con plazo y monto definidos.",
          estimatedMinutes: 6,
          content: `## Metas financieras que sí funcionan

"Quiero ahorrar más" no es una meta: es un deseo. Y los deseos no se cumplen porque no se pueden medir ni empezar.

### De deseo a meta

Una meta útil responde cuatro preguntas: **qué, cuánto, cuándo y de dónde sale**.

- Deseo: "quiero viajar".
- Meta: "juntar 1.200.000 en 12 meses para un viaje en enero, apartando 100.000 el día 5 de cada mes".

La segunda versión ya te dice qué hacer mañana.

### Divide por plazo

- **Corto** (menos de 1 año): el fondo de emergencia, un curso, un viaje.
- **Mediano** (1 a 5 años): el pie de un auto o de una vivienda.
- **Largo** (más de 5 años): educación de los hijos, jubilación.

El plazo no es un detalle: determina **cuánto riesgo** puede asumir el dinero de esa meta.

### Una a la vez

Perseguir seis metas simultáneas suele terminar sin ninguna cumplida. Ordénalas por prioridad y concentra el excedente en la primera.

---

**Mini-ejercicio:** Toma tu deseo financiero más repetido y reescríbelo con monto, plazo y aporte mensual. ¿Se ve alcanzable o hay que ajustar el plazo? 🎯`,
        },
        {
          slug: "calcular-tu-patrimonio-neto",
          title: "Tu patrimonio neto",
          summary:
            "Aprenderás a calcular el número que mejor resume tu situación financiera real.",
          estimatedMinutes: 6,
          content: `## Tu patrimonio neto

Es la foto más honesta de tus finanzas, y cabe en una resta:

> **Patrimonio neto = todo lo que tienes − todo lo que debes**

### Lo que tienes (activos)

Efectivo y cuentas, ahorros e inversiones, fondos de pensión, el valor de mercado de tu vivienda o tu auto.

### Lo que debes (pasivos)

Saldo del hipotecario, créditos de consumo, saldo de tarjetas, deudas con personas.

### Cómo leerlo

- Un patrimonio **negativo** no es una condena: es normal al inicio de la vida adulta, sobre todo con deuda educativa.
- Lo que importa no es el número absoluto, sino **su dirección** en el tiempo.

Por eso conviene calcularlo una o dos veces al año y anotarlo. La tendencia te dice si tus decisiones están funcionando, más allá de cómo se sienta un mes suelto.

### El detalle que confunde

Tu sueldo **no** es patrimonio. Se puede ganar mucho y tener patrimonio negativo, o al revés. Ingreso es flujo; patrimonio es acumulación.

---

**Mini-ejercicio:** Haz la resta hoy, aunque sea con cifras aproximadas, y guárdala con la fecha. En seis meses vas a agradecer tener ese punto de partida. 📋`,
        },
        {
          slug: "tasa-de-ahorro",
          title: "Tu tasa de ahorro",
          summary:
            "Entenderás por qué el porcentaje que ahorras predice tu futuro mejor que tu sueldo.",
          estimatedMinutes: 6,
          content: `## Tu tasa de ahorro

Es el porcentaje de tu ingreso que **no** gastas:

> **Tasa de ahorro = (ingreso − gasto) ÷ ingreso**

### Por qué es la métrica clave

Porque hace dos cosas a la vez: mientras más ahorras, **más rápido acumulas** y **menos necesitas** para vivir. Ambas te acercan a la independencia financiera por lados distintos.

Por eso alguien que gana menos pero ahorra el 25% puede ir por delante de alguien que gana el doble y ahorra el 5%.

### Referencias

- Bajo el 10%: frágil ante cualquier imprevisto.
- 10–20%: sólido, el rango de la mayoría de las recomendaciones.
- Sobre 20%: acelerado, construyes patrimonio con rapidez.

### El enemigo silencioso

La **inflación del estilo de vida**: cada aumento de sueldo se convierte en más gasto y la tasa de ahorro nunca sube. El antídoto es simple: cuando suba tu ingreso, destina una parte fija del aumento al ahorro **antes** de acostumbrarte a él.

---

**Mini-ejercicio:** Calcula tu tasa de ahorro del último mes. Si te sale negativa o cero, no te castigues: acabas de encontrar el número más importante que vas a mover este año. 📈`,
        },
        {
          slug: "fondos-por-objetivo",
          title: "Un fondo para cada objetivo",
          summary:
            "Verás por qué separar el dinero por meta hace que ahorrar sea mucho más fácil.",
          estimatedMinutes: 5,
          content: `## Un fondo para cada objetivo

Un solo montón de ahorro tiene un problema: **es ambiguo**. Cuando todo el dinero está junto, cualquier gasto parece justificable y el fondo de emergencia se usa para el viaje.

### La solución: separar por propósito

Una cuenta o bolsillo por meta, con nombre propio:

- Emergencias (intocable salvo emergencia real)
- Viaje de fin de año
- Pie del auto
- Regalos y fiestas

### Por qué funciona

El nombre crea una **barrera mental**. Sacar dinero de "ahorros" es fácil; sacarlo de "operación de la mascota" cuesta bastante más. Es la misma lógica de los sobres, aplicada al ahorro.

Además te da una respuesta clara al "¿voy bien?": cada fondo tiene su meta y su avance.

### Un aviso

No lo lleves al extremo: doce cuentas se vuelven inmanejables. Tres o cuatro fondos con nombre bastan para casi cualquiera.

---

**Mini-reflexión:** Si tu ahorro estuviera etiquetado por meta, ¿qué gasto de los últimos meses te habría costado más justificar? 🏷️`,
        },
      ],
    },
    {
      slug: "impuestos-personales",
      title: "Impuestos personales",
      description: "Qué te descuentan, por qué y cómo se calcula, sin tecnicismos.",
      category: "Finanzas Personales",
      lessons: [
        {
          slug: "como-funcionan-los-impuestos",
          title: "Cómo funcionan los impuestos",
          summary:
            "Entenderás para qué existen los impuestos y los grandes tipos que te afectan.",
          estimatedMinutes: 6,
          content: `## Cómo funcionan los impuestos

Los impuestos son la forma en que se financian los bienes y servicios comunes: salud, educación, infraestructura, seguridad. Te guste más o menos el resultado, entender el mecanismo es parte de manejar tu dinero.

### Los grandes tipos

- **Sobre la renta:** grava lo que **ganas** (sueldo, honorarios, utilidades).
- **Sobre el consumo:** grava lo que **gastas**. El IVA es el ejemplo típico y va incluido en el precio.
- **Sobre el patrimonio:** grava lo que **tienes** (por ejemplo, contribuciones de bienes raíces).
- **Específicos:** sobre productos concretos, como combustibles o alcohol.

### Progresivo vs. plano

Un impuesto **progresivo** cobra un porcentaje mayor a quien gana más (así suele ser el impuesto a la renta). Uno **plano** cobra el mismo porcentaje a todos (así suele ser el IVA).

### Por qué te conviene entenderlo

Porque tu decisión relevante no es sobre el sueldo bruto, sino sobre el **líquido**: lo que queda después de impuestos y descuentos. Presupuestar sobre el bruto es el error más común al cambiar de trabajo.

> ⚠️ Las reglas concretas cambian mucho entre países. Aquí trabajamos los conceptos; los detalles, con la normativa de tu país.

---

**Mini-reflexión:** ¿Sabes qué porcentaje de tu sueldo bruto llega efectivamente a tu cuenta? Esa brecha explica muchas sorpresas de fin de mes. 🧾`,
        },
        {
          slug: "impuesto-a-la-renta-personas",
          title: "El impuesto a la renta, por tramos",
          summary:
            "Comprenderás cómo funcionan los tramos y por qué subir de tramo no reduce tu sueldo.",
          estimatedMinutes: 7,
          content: `## El impuesto a la renta, por tramos

Aquí vive uno de los malentendidos más extendidos de las finanzas personales.

### El mito

> "Si me suben el sueldo cambio de tramo y termino ganando menos."

**Falso**, en un sistema progresivo por tramos.

### Cómo funciona de verdad

Tu ingreso se corta en **escalones**, y cada escalón paga su propia tasa. La tasa más alta se aplica **solo a la parte que cae en ese escalón**, no a todo tu ingreso.

Con tramos ilustrativos: si el primer tramo (hasta 1.000) paga 0% y el segundo (de 1.000 a 2.000) paga 10%, alguien que gana 1.200 paga 0 por los primeros 1.000 y 10% solo sobre los últimos 200. Paga 20, no 120.

Por eso **ganar más siempre deja más en el bolsillo**, aunque la parte adicional se grave a una tasa mayor.

### Tasa marginal vs. tasa efectiva

- **Marginal:** la que paga tu último peso ganado. Es la alta.
- **Efectiva:** el total de impuesto dividido por tu ingreso total. Siempre es **menor** que la marginal.

Cuando alguien dice "estoy en el 35%", casi siempre se refiere a la marginal; su tasa efectiva será bastante más baja.

---

**Mini-reflexión:** Si te ofrecen un aumento que te mueve de tramo, ¿tiene sentido rechazarlo por los impuestos? Ahora ya puedes responder con seguridad. 📊`,
        },
        {
          slug: "deducciones-y-beneficios-tributarios",
          title: "Deducciones y beneficios",
          summary:
            "Sabrás qué son las deducciones y créditos y por qué conviene conocer los de tu país.",
          estimatedMinutes: 6,
          content: `## Deducciones y beneficios

Casi todos los sistemas tributarios permiten **restar** ciertos gastos o inversiones antes de calcular el impuesto. No aprovecharlos es pagar de más por desconocimiento.

### Dos mecanismos distintos

- **Deducción:** reduce la **base** sobre la que se calcula el impuesto. Su valor depende de tu tramo.
- **Crédito:** se resta **directamente del impuesto** a pagar. Peso a peso, vale más que una deducción del mismo monto.

### Categorías habituales (varían por país)

- Aportes voluntarios para la jubilación.
- Intereses de un crédito hipotecario.
- Gastos de educación o salud.
- Donaciones a instituciones autorizadas.
- Gastos necesarios para generar ingresos, si trabajas por cuenta propia.

### El hábito que ahorra dinero

**Guardar los respaldos durante todo el año.** La mayoría de los beneficios se pierden no por no calificar, sino por no tener la boleta o el certificado cuando toca declarar.

> ⚠️ Qué es deducible y bajo qué límites depende de la ley de tu país y cambia con el tiempo. Verifica siempre con la fuente oficial o un contador.

---

**Mini-reflexión:** ¿Hay algún gasto que ya haces igual (educación, salud, aportes previsionales) que podría tener un beneficio tributario que no estás usando? 🔎`,
        },
        {
          slug: "impuestos-al-consumo",
          title: "El IVA y los impuestos al consumo",
          summary:
            "Entenderás por qué pagas impuestos cada vez que compras, aunque no los veas.",
          estimatedMinutes: 5,
          content: `## El IVA y los impuestos al consumo

El **IVA** (impuesto al valor agregado) es probablemente el impuesto que más veces pagas al año, y el que menos notas: viene **incluido en el precio**.

### Cómo funciona

Se aplica en cada etapa de la cadena de producción sobre el valor que cada actor agrega, pero quien lo soporta al final es el **consumidor**. El comercio solo lo recauda y lo entrega.

Con un IVA del 19%, de un producto de 11.900 unos 1.900 son impuesto.

### Por qué se le llama regresivo

Porque la tasa es la misma para todos, pero quien gana poco **destina un porcentaje mayor de su ingreso al consumo**. En términos relativos, le pesa más. Por eso muchos países eximen alimentos básicos, medicamentos o libros.

### Impuestos específicos

Sobre combustibles, alcohol, tabaco o bebidas azucaradas. Buscan recaudar y, a la vez, desincentivar cierto consumo.

### Lo práctico para ti

Cuando compares precios entre países o pidas presupuestos, verifica si la cifra **incluye o no** el impuesto. Es la fuente número uno de sorpresas al pagar.

---

**Mini-ejercicio:** Mira tu última boleta de supermercado y busca el monto del impuesto. ¿Habías reparado en él alguna vez? 🛒`,
        },
      ],
    },
    {
      slug: "jubilacion-y-retiro",
      title: "Jubilación y libertad financiera",
      description: "El largo plazo: cómo se financia tu futuro y cuánto necesitas para él.",
      category: "Finanzas Personales",
      lessons: [
        {
          slug: "como-funciona-una-pension",
          title: "Cómo funciona una pensión",
          summary:
            "Conocerás los grandes modelos de sistemas previsionales y qué determina tu pensión futura.",
          estimatedMinutes: 7,
          content: `## Cómo funciona una pensión

Una pensión es el ingreso que recibes cuando dejas de trabajar. De dónde sale ese dinero depende del sistema de tu país.

### Los dos grandes modelos

- **Reparto:** quienes trabajan hoy financian a quienes están jubilados hoy. Es un pacto entre generaciones y depende de la proporción entre trabajadores y jubilados.
- **Capitalización individual:** cada persona acumula en su propia cuenta, ese saldo se invierte y financia su pensión.

Muchos países combinan ambos, con un pilar solidario mínimo.

### Las tres variables que deciden tu pensión

1. **Cuánto aportas** (porcentaje del sueldo).
2. **Cuántos años aportas** sin lagunas. Los períodos sin cotizar pesan mucho más de lo que parece.
3. **La rentabilidad** obtenida durante décadas, donde el interés compuesto hace casi todo el trabajo.

### Por qué mirarlo joven

Porque el tiempo es la variable que **no se puede comprar después**. Un aporte hecho a los 25 tiene cuarenta años para componerse; el mismo aporte a los 55 tiene diez.

> ⚠️ Los sistemas varían enormemente entre países. Revisa cómo funciona el tuyo y cuánto llevas acumulado: mucha gente nunca lo ha mirado.

---

**Mini-reflexión:** ¿Sabes cuánto tienes acumulado hoy para tu jubilación y cuánto se aporta cada mes en tu nombre? Si no, esa consulta es una buena tarea para esta semana. 👵👴`,
        },
        {
          slug: "ahorro-previsional-voluntario",
          title: "Ahorrar de más para el retiro",
          summary:
            "Entenderás qué es el ahorro previsional voluntario y por qué suele tener ventajas fiscales.",
          estimatedMinutes: 6,
          content: `## Ahorrar de más para el retiro

El aporte obligatorio de tu país está diseñado como un **mínimo**, y en muchos casos no alcanza para mantener tu nivel de vida al jubilar. El ahorro voluntario para el retiro cubre esa brecha.

### Por qué suele ser atractivo

Los Estados quieren que ahorres para tu vejez, así que casi siempre lo incentivan con alguna de estas vías:

- **Beneficio tributario hoy:** el aporte reduce tu base imponible, así que pagas menos impuestos este año.
- **Beneficio tributario después:** aportas con dinero ya tributado y los retiros salen libres de impuesto.
- **Aporte estatal:** una bonificación directa sobre lo que ahorras.

### El costo real

El dinero queda **inmovilizado** hasta la jubilación (o retirarlo antes tiene penalidades). Por eso este ahorro va **después** del fondo de emergencia, nunca antes: si necesitas liquidez, este no es el lugar.

### El efecto del tiempo

Aquí el horizonte es de décadas, así que el interés compuesto trabaja como en ninguna otra meta. Aportes modestos y constantes desde joven superan con holgura a aportes grandes empezados tarde.

> ⚠️ Los nombres, límites y beneficios cambian por país. El concepto se mantiene: ahorro de largo plazo con incentivos y liquidez restringida.

---

**Mini-reflexión:** Si un aporte voluntario te devuelve parte en impuestos y además se compone durante 30 años, ¿qué está costando realmente cada año que lo postergas? ⏳`,
        },
        {
          slug: "cuanto-necesito-para-jubilarme",
          title: "¿Cuánto necesito para jubilarme?",
          summary:
            "Aprenderás a estimar el capital necesario para tu retiro con un cálculo sencillo.",
          estimatedMinutes: 7,
          content: `## ¿Cuánto necesito para jubilarme?

La pregunta parece imposible, pero tiene una estimación razonable en tres pasos.

### Paso 1: tu gasto anual al jubilar

No tu sueldo: tu **gasto**. Y ajústalo: probablemente ya no pagarás el hipotecario ni criarás hijos, pero sí gastarás más en salud. Una referencia frecuente es entre el 70% y el 80% de tu gasto actual.

### Paso 2: resta lo que ya tendrás

A ese gasto anual réstale la pensión estimada que recibirás del sistema. Lo que queda es la **brecha** que debes financiar tú.

### Paso 3: multiplica

Multiplica la brecha anual por **25** (equivalente a una tasa de retiro del 4% anual). Ese es, aproximadamente, el capital que necesitas acumulado.

Ejemplo: si tu brecha es de 6.000.000 al año, necesitarías unos 150.000.000.

### Cómo tomarlo

El número asusta la primera vez. Dos cosas ayudan: no lo juntas tú solo — el interés compuesto aporta una parte enorme si empiezas temprano — y cualquier avance reduce la brecha. La estimación no es una sentencia, es una **brújula**.

---

**Mini-ejercicio:** Estima tu gasto anual actual, tómale el 75% y multiplícalo por 25. Ese orden de magnitud es tu punto de partida. 🧭

---

👉 **Ponlo a prueba:** proyecta tus aportes a 20 o 30 años en la [calculadora de interés compuesto](/simuladores/interes-compuesto).`,
        },
        {
          slug: "independencia-financiera",
          title: "Independencia financiera",
          summary:
            "Comprenderás el concepto de vivir de tus activos y qué determina cuánto tardas en lograrlo.",
          estimatedMinutes: 7,
          content: `## Independencia financiera

Hay independencia financiera cuando tus **activos generan lo suficiente** para cubrir tus gastos, y trabajar pasa a ser una elección en vez de una obligación.

### La regla del 4%, en simple

Es una referencia popular: si retiras cada año alrededor del **4% de tu cartera**, hay una probabilidad razonable de que el dinero dure varias décadas. Su lectura inversa es la útil:

> Necesitas unas **25 veces tu gasto anual**.

### El dato que sorprende

Lo que más determina cuánto tardas **no es tu sueldo, sino tu tasa de ahorro**. Ahorrar más acelera por dos vías simultáneas: acumulas más rápido y necesitas un capital menor, porque tu gasto es menor.

Por eso, con una tasa de ahorro alta el horizonte se acorta drásticamente, mientras que ahorrando un 5% el camino se vuelve muy largo por mucho que ganes.

### Las advertencias honestas

- El 4% es una **regla general** basada en datos históricos, no una garantía.
- Los supuestos (rentabilidad, inflación, longevidad) pueden no cumplirse.
- No hace falta llegar al 100% para que el esfuerzo valga: cada punto de avance es margen de libertad.

> ⚠️ Formación conceptual, no una recomendación ni una promesa de resultados.

---

**Mini-reflexión:** Si independizarte depende más de tu tasa de ahorro que de tu sueldo, ¿qué palanca tienes disponible desde este mes? 🕊️`,
        },
      ],
    },
    {
      slug: "decisiones-de-vida",
      title: "Grandes decisiones de vida",
      description: "Los momentos donde una buena decisión financiera pesa por años.",
      category: "Finanzas Personales",
      lessons: [
        {
          slug: "comprar-o-arrendar-vivienda",
          title: "¿Comprar o arrendar?",
          summary:
            "Analizarás la decisión con criterios financieros y personales, sin dogmas.",
          estimatedMinutes: 8,
          content: `## ¿Comprar o arrendar?

"Arrendar es botar la plata" es una frase pegajosa y a menudo falsa. La decisión depende de tus números y de tu vida, no de un eslogan.

### A favor de comprar

- Construyes patrimonio con cada cuota (la parte que amortiza capital).
- Estabilidad: nadie te pide la casa.
- Protección frente a la subida de los arriendos.

### A favor de arrendar

- **Flexibilidad** para moverte por trabajo o por vida.
- Sin costos de mantención, contribuciones ni imprevistos estructurales.
- El pie no queda inmovilizado: podría estar invirtiéndose en otra parte.

### Los costos que se olvidan al comprar

Intereses del crédito (enormes los primeros años), contribuciones, seguros, mantención, gastos notariales y la comisión al vender. Comparar "cuota vs. arriendo" a secas es engañoso.

### La pregunta que más pesa

**¿Cuántos años vas a quedarte ahí?** Los costos de entrada y salida son altos, así que comprar suele tener sentido con horizontes largos. Si crees que te mudarás en dos o tres años, arrendar rara vez es un error.

---

**Mini-reflexión:** Si supieras con certeza que en tres años cambias de ciudad, ¿cómo cambiaría tu respuesta? ¿Y si supieras que te quedas veinte? 🏡`,
        },
        {
          slug: "financiar-un-vehiculo",
          title: "Comprar un auto sin arrepentirse",
          summary:
            "Verás el costo total de tener un vehículo, más allá del precio y la cuota.",
          estimatedMinutes: 6,
          content: `## Comprar un auto sin arrepentirse

Un auto es, financieramente, un **activo que pierde valor**: vale menos cada año. Eso no lo hace una mala compra — puede ser imprescindible —, pero cambia cómo conviene financiarlo.

### El costo total de tener uno

El precio es solo la entrada. Súmale, cada año:

- Combustible o carga
- Seguro y permisos
- Mantenciones y neumáticos
- Estacionamiento
- **Depreciación**, el costo mayor y el más invisible

### La depreciación, en números

Muchos vehículos nuevos pierden una parte importante de su valor en los primeros años. Ese es el argumento clásico a favor de un usado de pocos años: dejas que otro absorba la caída más fuerte.

### Sobre financiarlo

Pagar intereses por algo que se deprecia es doblemente costoso: el bien baja de valor mientras la deuda sigue ahí. Si financias, plazos cortos y un pie relevante reducen mucho el daño.

Y ojo con el "quiero la cuota más baja": alargar el plazo puede dejarte debiendo más de lo que vale el auto.

---

**Mini-ejercicio:** Estima cuánto te cuesta tu auto al año sumando todo, no solo la bencina. Divide por 12. ¿Coincide con lo que creías? 🚗`,
        },
        {
          slug: "finanzas-en-pareja",
          title: "Finanzas en pareja",
          summary:
            "Conocerás los modelos para organizar el dinero en pareja y cómo conversarlo.",
          estimatedMinutes: 7,
          content: `## Finanzas en pareja

El dinero es una de las principales fuentes de conflicto en las parejas, y casi siempre por lo mismo: **nunca se habló del tema con claridad**.

### Tres modelos habituales

- **Todo común:** ingresos y gastos en un fondo único. Máxima simplicidad, requiere mucha confianza y acuerdos claros.
- **Todo separado:** cada uno con lo suyo y los gastos comunes divididos. Máxima autonomía, puede complicarse si los ingresos son muy dispares.
- **Mixto (el más común):** una cuenta común para gastos compartidos, a la que cada uno aporta **en proporción a su ingreso**, y cada uno mantiene su cuenta personal.

No hay un modelo correcto: hay uno que ambos entienden y aceptan.

### La conversación que hay que tener

- ¿Cuánto gana y cuánto debe cada uno? **Sin sorpresas ocultas.**
- ¿Cuáles son nuestras metas comunes y sus plazos?
- ¿Desde qué monto consultamos antes de comprar?
- ¿Qué pasa si uno deja de trabajar por un tiempo?

### Un formato que ayuda

Una revisión mensual breve, en un momento tranquilo — nunca en medio de una discusión por un gasto. Que sea rutina y no un juicio.

---

**Mini-reflexión:** ¿Sabes con precisión cuánto debe tu pareja, y sabe ella o él cuánto debes tú? Si la respuesta es dudosa, ahí está la primera conversación. 💬`,
        },
        {
          slug: "ensenar-finanzas-a-los-hijos",
          title: "Enseñar finanzas a los hijos",
          summary:
            "Verás cómo transmitir hábitos financieros según la edad, con ejemplos concretos.",
          estimatedMinutes: 6,
          content: `## Enseñar finanzas a los hijos

Los hijos aprenden mucho más de lo que **ven hacer** que de lo que se les explica. Tu forma de manejar el dinero ya les está enseñando algo.

### Por edades

- **4 a 7 años:** que el dinero es limitado y hay que elegir. Una alcancía transparente, para que vean crecer el monto.
- **8 a 12:** una mesada pequeña y **regular**, con la regla de esperar para comprar algo mayor. Aquí se aprende la paciencia financiera.
- **13 a 17:** su propia cuenta, un presupuesto simple y las consecuencias reales de gastarlo todo la primera semana.
- **18+:** cómo funciona una tarjeta de crédito **antes** de que tenga una, y el costo real de un crédito.

### Tres principios

1. **Deja que se equivoquen barato.** Un error de 10.000 a los 12 años enseña más que una charla, y es infinitamente más barato que el mismo error a los 25.
2. **Habla de dinero con naturalidad.** El tabú no protege: deja el aprendizaje en manos del azar.
3. **Vincula el dinero al valor, no al premio.** Que ahorrar sea una decisión, no un castigo.

---

**Mini-reflexión:** ¿Qué aprendiste tú sobre el dinero observando a tu familia, sin que nadie te lo explicara? ¿Qué de eso quieres repetir y qué no? 👨‍👩‍👧`,
        },
        {
          slug: "inflacion-de-estilo-de-vida",
          title: "La inflación del estilo de vida",
          summary:
            "Reconocerás el patrón por el cual ganar más nunca se traduce en tener más.",
          estimatedMinutes: 6,
          content: `## La inflación del estilo de vida

Es el fenómeno por el cual, cada vez que tus ingresos suben, tus gastos suben **al mismo ritmo**. Ganas el doble que hace cinco años y ahorras exactamente igual: nada.

### Por qué pasa

- La **adaptación**: lo que era un lujo se vuelve normal en pocas semanas, y ya no da satisfacción extra.
- La comparación con el entorno, que también fue subiendo.
- Compromisos que son fáciles de subir y **difíciles de bajar**: un arriendo mayor, un auto financiado, colegios más caros.

### El antídoto

Cuando aumente tu ingreso, decide el reparto **antes** de que llegue. Una fórmula simple: **50% del aumento al ahorro o a las metas, 50% a mejorar tu vida**. Así disfrutas el progreso sin que se evapore entero.

### El matiz

Esto no es un llamado a la austeridad permanente. Mejorar tu calidad de vida al ganar más es legítimo y deseable. El problema es que ocurra **por defecto**, sin que lo decidas.

---

**Mini-reflexión:** Piensa en tu último aumento de ingreso. ¿Cuánto de él terminó en ahorro? Si la respuesta es "nada", ¿en qué se fue exactamente? 🎈`,
        },
      ],
    },
  ],
};

// -----------------------------------------------------------------------------
// Ruta 7: Instrumentos de Inversión en Detalle · Categoría: Inversiones
// -----------------------------------------------------------------------------
export const INSTRUMENTOS: LearningPath = {
  slug: "instrumentos-de-inversion",
  title: "Instrumentos de Inversión en Detalle",
  description:
    "Qué es cada cosa y cómo funciona por dentro: acciones, bonos, fondos, ETF y activos alternativos. Conceptos, nunca recomendaciones de compra.",
  modules: [
    {
      slug: "renta-variable",
      title: "Renta variable: acciones",
      description: "Qué compras realmente cuando compras una acción.",
      category: "Inversiones",
      lessons: [
        {
          slug: "como-funciona-una-accion",
          title: "Cómo funciona una acción",
          summary:
            "Entenderás qué representa una acción, de dónde viene su valor y por qué fluctúa.",
          estimatedMinutes: 7,
          content: `## Cómo funciona una acción

Una acción es una **fracción de la propiedad** de una empresa. Si una compañía tiene un millón de acciones y tienes una, eres dueño de la millonésima parte: de sus fábricas, su marca y sus utilidades futuras.

### De dónde viene tu retorno

Solo de dos fuentes:

1. **Apreciación:** la acción vale más de lo que pagaste.
2. **Dividendos:** la empresa reparte parte de sus utilidades entre los dueños.

### Por qué el precio se mueve tanto

Porque el precio no refleja lo que la empresa **vale hoy**, sino lo que el mercado **espera** de ella. Cuando cambian las expectativas — resultados, competencia, tasas de interés, ánimo general — el precio se ajusta al instante.

De ahí la volatilidad: las expectativas cambian mucho más rápido que los negocios reales.

### Qué significa ser accionista

Tienes derecho a la parte que te toca de las utilidades y, normalmente, a votar en las decisiones. También asumes el riesgo: si a la empresa le va mal, pierdes valor, y si quiebra, los accionistas cobran **últimos**.

> ⚠️ Contenido educativo. Nada de esto es una recomendación sobre acciones concretas.

---

**Mini-reflexión:** Si el precio refleja expectativas y no el presente, ¿por qué una empresa puede publicar buenas utilidades y aun así caer en bolsa ese día? 📊`,
        },
        {
          slug: "dividendos",
          title: "Dividendos: la parte que se reparte",
          summary:
            "Sabrás qué son los dividendos, cómo se miden y por qué no son dinero gratis.",
          estimatedMinutes: 6,
          content: `## Dividendos: la parte que se reparte

Cuando una empresa gana dinero, puede hacer dos cosas: **reinvertirlo** para crecer o **repartirlo** entre sus dueños. Ese reparto es el dividendo.

### Cómo se mide

La **rentabilidad por dividendo** es el dividendo anual dividido por el precio de la acción. Si una acción de 1.000 reparte 40 al año, su rentabilidad por dividendo es del 4%.

### El malentendido más común

> "Cobro el dividendo y además tengo la acción: es dinero gratis."

No. El día que se reparte, el precio de la acción **cae aproximadamente en el monto del dividendo**: ese dinero salió de la empresa. No es dinero extra, es un traslado de valor desde la empresa hacia tu bolsillo.

### Empresas que reparten y que no

- **Maduras y estables** (servicios básicos, banca, consumo) suelen repartir: crecen poco y les sobra caja.
- **En crecimiento** (tecnología joven) suelen no repartir: cada peso rinde más reinvertido en el negocio.

Ninguna de las dos es mejor: son perfiles distintos.

### La señal de alarma

Una rentabilidad por dividendo **anormalmente alta** suele significar que el precio se desplomó, no que la empresa sea generosa.

---

**Mini-reflexión:** Si el precio cae justo por el monto repartido, ¿en qué se diferencia realmente un dividendo de vender una fracción de tus acciones? 💵`,
        },
        {
          slug: "indices-bursatiles",
          title: "Índices bursátiles",
          summary:
            "Entenderás qué mide un índice y por qué se usa como referencia del mercado.",
          estimatedMinutes: 6,
          content: `## Índices bursátiles

Un **índice** es una canasta de acciones que se sigue en conjunto para medir cómo se comporta un mercado o un sector. No se compra el índice: se mide con él.

### Ejemplos conocidos

- **S&P 500:** 500 grandes empresas de Estados Unidos.
- **MSCI World:** empresas de países desarrollados de todo el mundo.
- Cada país tiene el suyo (IPSA, IBEX 35, Merval, Bovespa…).

### Cómo se construyen

La mayoría pondera **por capitalización de mercado**: las empresas más grandes pesan más. Consecuencia importante: en un índice de 500 empresas, las diez mayores pueden explicar una parte enorme del movimiento total. "Diversificado" no siempre significa "repartido por igual".

### Para qué sirven

1. Como **termómetro** del mercado ("la bolsa subió 2%" significa que su índice subió).
2. Como **referencia** (benchmark) para juzgar si una estrategia lo hizo mejor o peor que el mercado.
3. Como base de los **fondos indexados y ETF**, que buscan replicarlos.

---

**Mini-reflexión:** Si las mayores empresas pesan mucho más en un índice, ¿qué tan diversificado estás realmente al seguirlo? 🌐`,
        },
        {
          slug: "tipos-de-empresas-en-bolsa",
          title: "Tipos de empresas en bolsa",
          summary:
            "Distinguirás empresas por tamaño y por estilo (crecimiento o valor) y su perfil de riesgo.",
          estimatedMinutes: 6,
          content: `## Tipos de empresas en bolsa

No todas las acciones se comportan igual. Dos clasificaciones ayudan a ordenar el mapa.

### Por tamaño (capitalización)

Se calcula multiplicando el precio de la acción por el número de acciones.

- **Grandes:** consolidadas, más estables, menos margen de crecimiento explosivo.
- **Medianas:** equilibrio entre crecimiento y solidez.
- **Pequeñas:** más potencial y **mucha** más volatilidad; algunas crecen enormemente, otras desaparecen.

### Por estilo

- **Crecimiento:** reinvierten todo, crecen rápido, rara vez reparten dividendos. El mercado paga caro esas expectativas, así que caen fuerte si decepcionan.
- **Valor:** negocios establecidos que cotizan a precios bajos respecto de sus resultados. Menos emocionantes, a menudo con dividendos.

### Por comportamiento en el ciclo

- **Cíclicas:** dependen del momento económico (autos, turismo, construcción).
- **Defensivas:** su demanda se mantiene pase lo que pase (alimentos, salud, servicios básicos).

Ninguna categoría es "la buena": cada una se comporta distinto según el momento, y por eso combinarlas es una forma de diversificar.

> ⚠️ Clasificaciones conceptuales, no sugerencias de compra.

---

**Mini-reflexión:** En una recesión, ¿qué esperarías de una empresa de turismo frente a una de alimentos básicos? Eso es la diferencia entre cíclica y defensiva. 🏢`,
        },
      ],
    },
    {
      slug: "renta-fija-y-liquidez",
      title: "Renta fija y liquidez",
      description: "Instrumentos de deuda y dónde vive el dinero que necesitas disponible.",
      category: "Inversiones",
      lessons: [
        {
          slug: "como-funciona-un-bono",
          title: "Cómo funciona un bono",
          summary:
            "Entenderás las piezas de un bono: valor nominal, cupón, plazo y emisor.",
          estimatedMinutes: 7,
          content: `## Cómo funciona un bono

Comprar un bono es **prestar dinero**. El emisor (un gobierno o una empresa) se compromete a pagarte intereses periódicos y a devolverte el capital en una fecha determinada.

### Sus piezas

- **Valor nominal:** el monto que te devuelven al vencimiento.
- **Cupón:** el interés que paga, normalmente anual o semestral.
- **Plazo:** cuándo vence.
- **Emisor:** quién te debe. Aquí está casi todo el riesgo.

### La diferencia esencial con una acción

Como accionista eres **dueño**: te va bien si a la empresa le va bien, sin techo ni piso. Como bonista eres **acreedor**: cobras lo pactado aunque la empresa gane el triple, y si quiebra, cobras **antes** que los accionistas.

Por eso los bonos suelen ser más estables y con menor retorno esperado.

### Por qué se les llama renta fija

Porque los pagos están definidos de antemano. Cuidado: "fija" se refiere al flujo pactado, **no** a que su precio no se mueva. Un bono vendido antes del vencimiento puede valer más o menos de lo que pagaste.

---

**Mini-reflexión:** Si en una quiebra los bonistas cobran antes que los accionistas, ¿por qué tiene sentido que los accionistas exijan un retorno esperado mayor? 🧾`,
        },
        {
          slug: "precio-de-bonos-y-tasas",
          title: "Bonos y tasas: la relación inversa",
          summary:
            "Comprenderás por qué el precio de un bono baja cuando suben las tasas de interés.",
          estimatedMinutes: 7,
          content: `## Bonos y tasas: la relación inversa

Es el concepto de renta fija que más confusión genera y se entiende con un solo ejemplo.

### El ejemplo

Compras un bono de 1.000 que paga un **5% anual**: 50 al año.

Al año siguiente, las tasas suben y los bonos nuevos pagan **7%**: 70 al año.

Tu bono sigue pagando 50. ¿Alguien te lo compraría en 1.000 pudiendo comprar uno que rinde 70? No. Para que a un comprador le resulte igual de atractivo, tu bono debe **bajar de precio**.

> **Suben las tasas → baja el precio de los bonos existentes. Bajan las tasas → sube su precio.**

### El plazo amplifica el efecto

Un bono a 30 años sufre mucho más que uno a 2 años ante el mismo cambio de tasas: quedas "atrapado" en un rendimiento desactualizado durante mucho más tiempo. Esa sensibilidad se llama **duración**.

### El matiz tranquilizador

Si mantienes el bono **hasta el vencimiento** y el emisor cumple, recibes tus cupones y tu capital tal como estaba pactado. La pérdida por precio solo se materializa si vendes antes.

---

**Mini-reflexión:** Si esperas que las tasas suban mucho, ¿preferirías tener bonos a 30 años o a 2 años? Ahora puedes razonar la respuesta. 📉`,
        },
        {
          slug: "deposito-a-plazo-y-liquidez",
          title: "Depósitos a plazo y fondos de liquidez",
          summary:
            "Conocerás los instrumentos de bajo riesgo donde suele vivir el dinero de corto plazo.",
          estimatedMinutes: 6,
          content: `## Depósitos a plazo y fondos de liquidez

No todo el dinero busca crecer mucho. El de corto plazo — tu fondo de emergencia, el pie que usarás en un año — busca **estar cuando lo necesitas**.

### Depósito a plazo

Entregas un monto al banco por un período fijo a una tasa conocida. Al vencimiento recuperas capital más intereses.

- ✅ Previsible y de riesgo bajo.
- ❌ El dinero queda **inmovilizado**; retirarlo antes suele costar los intereses.

### Fondos de liquidez o money market

Fondos que invierten en instrumentos de deuda de muy corto plazo.

- ✅ Suelen permitir rescatar en uno o dos días hábiles.
- ❌ El rendimiento no está garantizado, aunque su variabilidad sea baja.

### La regla para elegir

Para este dinero, el orden de prioridades es **disponibilidad > seguridad > rentabilidad**. Un punto extra de retorno no compensa no poder acceder a tu dinero el día que se rompe la caldera.

### Y la inflación

En instrumentos de bajo riesgo, la rentabilidad puede quedar **por debajo de la inflación**. Es un costo aceptable para el dinero que necesitas líquido; deja de serlo si guardas ahí todo tu patrimonio por décadas.

---

**Mini-reflexión:** Tu fondo de emergencia en un depósito a 12 meses rinde algo más… pero deja de ser un fondo de emergencia. ¿Por qué? 🏦`,
        },
        {
          slug: "riesgo-de-credito",
          title: "Riesgo de crédito y clasificaciones",
          summary:
            "Entenderás qué mide una clasificación de riesgo y por qué más rendimiento implica más riesgo.",
          estimatedMinutes: 6,
          content: `## Riesgo de crédito y clasificaciones

El **riesgo de crédito** es la posibilidad de que quien te debe **no pague**. Es el riesgo central de cualquier instrumento de deuda.

### Cómo se comunica

Agencias clasificadoras asignan notas al emisor, en una escala que va desde la máxima calidad (notas tipo AAA) hasta la deuda en incumplimiento. Se suele separar en dos grandes bloques:

- **Grado de inversión:** emisores considerados sólidos.
- **Grado especulativo (o alto rendimiento):** mayor probabilidad de impago, por lo que deben ofrecer una tasa más alta para atraer prestamistas.

### La lectura clave

Ese diferencial de tasa **no es una oportunidad gratis**: es exactamente el precio del riesgo que asumes. Si un bono paga mucho más que el resto, el mercado te está diciendo que dudan de que pague.

### Los límites de las clasificaciones

Son una opinión, no una garantía. Han fallado antes, sobre todo en crisis. Úsalas como un dato entre varios, nunca como certificado de seguridad.

> ⚠️ Educativo. Ninguna clasificación reemplaza tu propio análisis ni convierte una inversión en segura.

---

**Mini-reflexión:** Si dos bonos a 5 años pagan 4% y 11%, ¿qué te está diciendo el mercado sobre el segundo emisor? ⚖️`,
        },
      ],
    },
    {
      slug: "fondos-y-etf",
      title: "Fondos y ETF",
      description: "Los vehículos que agrupan muchos activos en un solo instrumento.",
      category: "Inversiones",
      lessons: [
        {
          slug: "que-es-un-fondo-mutuo",
          title: "¿Qué es un fondo mutuo?",
          summary:
            "Entenderás cómo funciona un fondo: patrimonio común, cuotas y administración profesional.",
          estimatedMinutes: 6,
          content: `## ¿Qué es un fondo mutuo?

Un fondo reúne el dinero de **muchas personas** en un patrimonio común que una administradora invierte según una política definida (acciones, bonos, mixto, un país, un sector).

### Cómo participas

Compras **cuotas**. El valor de la cuota sube o baja con los activos del fondo. Si aportas el 1% del patrimonio del fondo, te corresponde el 1% de sus resultados.

### Qué resuelve

- **Diversificación inmediata:** con un monto pequeño accedes a decenas o cientos de activos.
- **Gestión profesional:** alguien se dedica a seleccionar y operar.
- **Accesibilidad:** montos mínimos bajos.

### Qué cuesta

Una **comisión de administración** anual, que se descuenta del valor de la cuota (por eso no la "ves" pagar). También puede haber comisiones de entrada o salida.

Ese costo se paga **todos los años, ganes o pierdas**. En horizontes largos, la diferencia entre un fondo caro y uno barato se vuelve enorme.

---

**Mini-reflexión:** Si una comisión se descuenta automáticamente del valor de la cuota, ¿por qué es tan fácil olvidarse de que la estás pagando? 🧺`,
        },
        {
          slug: "que-es-un-etf",
          title: "¿Qué es un ETF?",
          summary:
            "Sabrás qué es un fondo cotizado, en qué se diferencia de un fondo mutuo y sus ventajas.",
          estimatedMinutes: 7,
          content: `## ¿Qué es un ETF?

Un **ETF** (fondo cotizado en bolsa) es un fondo que se **compra y vende como una acción**, durante toda la jornada bursátil.

La mayoría son **indexados**: en lugar de intentar elegir ganadores, replican un índice. Comprar una cuota de un ETF sobre un índice amplio te da, en una sola operación, una participación en cientos de empresas.

### ETF vs. fondo mutuo

| | Fondo mutuo | ETF |
|---|---|---|
| Cuándo se opera | Una vez al día, al cierre | En cualquier momento del día |
| Precio | Valor cuota del día | Precio de mercado, cambia a cada instante |
| Costos típicos | Suelen ser mayores | Suelen ser menores |
| Cómo se compra | Con la administradora | Con una cuenta de corretaje |

### Por qué se popularizaron

Por el **costo bajo** y la transparencia: sabes qué índice replica y cuál es su cartera. En plazos largos, unas décimas de comisión menos al año se acumulan de forma significativa.

### Lo que hay que mirar

- **Costo anual** del ETF.
- **Qué replica exactamente** (no todos los que suenan parecidos siguen lo mismo).
- **Liquidez:** cuánto se transa, para no pagar de más al comprar o vender.
- Que poder operar todo el día **no** es una invitación a operar todo el día.

> ⚠️ Educativo. No es una recomendación de ETF ni de índices concretos.

---

**Mini-reflexión:** Si un ETF permite comprar y vender en cualquier momento, ¿esa facilidad es una ventaja o una tentación? Depende del inversionista. 📦`,
        },
        {
          slug: "gestion-activa-vs-indexada",
          title: "Gestión activa vs. indexada",
          summary:
            "Compararás intentar ganarle al mercado con simplemente replicarlo, y qué dicen los datos.",
          estimatedMinutes: 7,
          content: `## Gestión activa vs. indexada

Son dos filosofías opuestas sobre cómo invertir en un mercado.

### Gestión activa

Un equipo selecciona activos buscando **superar al índice** de referencia. Requiere análisis, tiempo y equipo, así que cobra comisiones mayores.

### Gestión indexada (pasiva)

No intenta elegir: **replica** un índice completo. Sin apuestas, sin equipo de selección, comisiones mucho más bajas.

### Lo que muestran los datos

De forma persistente, una mayoría de fondos activos **no logra superar a su índice** de referencia después de costos en plazos largos. Y los que lo logran un año rara vez repiten de forma consistente.

La razón es aritmética antes que de talento: el conjunto de los inversionistas **es** el mercado, así que en promedio obtienen el retorno del mercado **menos** los costos. Cuanto mayores los costos, más difícil superarlo.

### El matiz honesto

Esto no significa que la gestión activa sea inútil: puede aportar en mercados menos eficientes o con objetivos específicos. Significa que **el costo importa muchísimo** y que superar al mercado de forma sostenida es más difícil de lo que la publicidad sugiere.

---

**Mini-reflexión:** Si el promedio de los inversionistas obtiene el retorno del mercado menos costos, ¿qué papel juega la comisión anual en tu resultado a 20 años? 🎯`,
        },
        {
          slug: "costos-de-un-fondo",
          title: "El costo de un fondo, en el tiempo",
          summary:
            "Verás cuánto erosiona una comisión anual aparentemente pequeña en horizontes largos.",
          estimatedMinutes: 6,
          content: `## El costo de un fondo, en el tiempo

Una comisión del 1,5% anual suena inofensiva. En un horizonte de décadas, no lo es.

### Por qué duele tanto

Porque se cobra **sobre el total acumulado, todos los años**. A medida que tu patrimonio crece, el monto de la comisión crece con él. Y cada peso que se va en comisiones es un peso que **deja de componerse** para siempre.

### El orden de magnitud

Con aportes iguales y la misma rentabilidad bruta, la diferencia entre pagar 0,2% y 1,5% anual durante treinta años puede llevarse **una fracción muy relevante** del capital final. No es un detalle: suele ser una de las decisiones más rentables que tomas.

### Dónde mirar

- **Comisión de administración** anual (a veces llamada TER o ratio de gastos).
- **Comisión de entrada o salida.**
- **Costos de la plataforma** desde la que inviertes.
- **Costos de transacción** implícitos si el fondo rota mucho su cartera.

### La asimetría clave

La rentabilidad futura **no la controlas**. El costo **sí**, y se conoce de antemano. Por eso es lo primero que conviene comparar.

---

**Mini-ejercicio:** Busca la comisión anual de algún fondo donde tengas dinero. ¿La conocías? 🔍

---

👉 **Ponlo a prueba:** simula dos rentabilidades separadas por un punto porcentual en la [calculadora de interés compuesto](/simuladores/interes-compuesto) y compara los totales.`,
        },
      ],
    },
    {
      slug: "activos-alternativos",
      title: "Activos alternativos",
      description: "Inmuebles, materias primas, cripto y derivados: qué son y qué riesgos traen.",
      category: "Inversiones",
      lessons: [
        {
          slug: "invertir-en-inmuebles",
          title: "Invertir en inmuebles",
          summary:
            "Entenderás las formas de invertir en propiedades y los costos que no aparecen en el folleto.",
          estimatedMinutes: 7,
          content: `## Invertir en inmuebles

La inversión inmobiliaria es popular porque es **tangible**: se ve y se toca. Eso la hace intuitiva, pero no la hace simple.

### Dos formas de hacerlo

- **Directa:** compras una propiedad y la arriendas. Control total, pero exige mucho capital, gestión y concentra el riesgo en un solo activo.
- **Indirecta:** fondos inmobiliarios o **REIT**, vehículos que agrupan muchas propiedades y cotizan como una acción. Con montos pequeños accedes a un portafolio diversificado y puedes vender con facilidad.

### El retorno viene de dos lados

El **arriendo** (flujo periódico) y la **plusvalía** (que la propiedad valga más). Depender solo del segundo es una apuesta.

### Los costos que se olvidan

Contribuciones, mantención, seguros, comisiones de corretaje, **meses sin arrendatario**, impagos y reparaciones. La rentabilidad bruta del folleto y la neta real suelen ser muy distintas.

### Sus dos riesgos propios

- **Iliquidez:** vender puede tomar meses; no puedes vender "media casa" si necesitas dinero.
- **Concentración:** una sola propiedad, en un solo barrio, es lo contrario de diversificar.

---

**Mini-reflexión:** Si tuvieras que reunir dinero con urgencia, ¿qué tan rápido podrías convertir un departamento en efectivo, y a qué precio? 🏘️`,
        },
        {
          slug: "materias-primas-y-oro",
          title: "Materias primas y oro",
          summary:
            "Conocerás qué son las materias primas como inversión y el papel histórico del oro.",
          estimatedMinutes: 6,
          content: `## Materias primas y oro

Las **materias primas** son bienes físicos básicos: petróleo, cobre, trigo, café, metales preciosos.

### Su particularidad

A diferencia de una empresa o un bono, **no producen nada**. Una acción genera utilidades; un bono paga cupones. Un lingote de oro dentro de diez años sigue siendo el mismo lingote.

Por eso su retorno depende **solo** de que alguien pague más por ellas después: oferta y demanda, pura y dura.

### El oro

Se le atribuye históricamente el papel de **refugio**: en crisis o con alta inflación, suele buscarse como reserva de valor. Ojo: esa relación **no es automática ni garantizada**, y hay períodos largos donde el oro rinde poco o pierde valor real.

### Cómo se accede

Rara vez comprando el bien físico (guardar petróleo es poco práctico). Se hace mediante fondos y ETF especializados, o acciones de empresas productoras — que se comportan distinto a la materia prima misma.

### Su rol habitual

Se suele plantear como un componente **pequeño** de diversificación, no como el centro de una cartera. Su volatilidad puede ser muy alta.

> ⚠️ Contenido educativo, sin recomendación de asignación ni de activos.

---

**Mini-reflexión:** Si un activo no genera flujo alguno, ¿de dónde tendría que venir toda tu ganancia? ¿Cómo cambia eso la forma de evaluarlo? 🥇`,
        },
        {
          slug: "criptomonedas-conceptos",
          title: "Criptomonedas: conceptos clave",
          summary:
            "Entenderás qué son las criptomonedas, en qué se apoyan y qué riesgos concretos implican.",
          estimatedMinutes: 8,
          content: `## Criptomonedas: conceptos clave

Una criptomoneda es un activo digital que se registra en una **cadena de bloques** (blockchain): un libro contable distribuido entre miles de computadores, sin una autoridad central que lo administre.

### Las ideas detrás

- **Descentralización:** ninguna entidad única controla la red.
- **Registro inmutable:** las transacciones confirmadas no se pueden alterar.
- **Escasez programada:** algunas tienen un límite máximo de unidades fijado por código.

### De dónde vendría su valor

No hay utilidades ni cupones detrás. Su precio depende de la **adopción, la utilidad percibida y la demanda especulativa**. Es un mercado de expectativas puras, y eso explica su volatilidad extrema.

### Los riesgos, sin adornos

- **Volatilidad:** caídas del 50% o más han ocurrido varias veces.
- **Regulación:** cambiante y muy distinta según el país.
- **Custodia:** si guardas tus claves y las pierdes, **no hay servicio al cliente**. El dinero desaparece.
- **Plataformas:** varias han quebrado o resultado fraudulentas, llevándose los fondos de sus usuarios.
- **Estafas:** es el terreno favorito de las promesas de rentabilidad garantizada.

### Cómo se suele encuadrar

Como un activo de **muy alto riesgo**. Cualquier exposición debería ser dinero que puedes perder por completo sin comprometer tu estabilidad, y siempre después de tener tus bases resueltas.

> ⚠️ Formación conceptual, no una recomendación. Aquí no se sugiere invertir ni no invertir en criptomonedas.

---

**Mini-reflexión:** Si el valor depende sobre todo de que otros quieran comprar después, ¿qué preguntas te harías antes de exponer una parte relevante de tu patrimonio? ₿`,
        },
        {
          slug: "derivados-y-apalancamiento",
          title: "Derivados y apalancamiento",
          summary:
            "Sabrás qué son los derivados y por qué el apalancamiento multiplica pérdidas igual que ganancias.",
          estimatedMinutes: 7,
          content: `## Derivados y apalancamiento

Un **derivado** es un contrato cuyo valor depende de otro activo (una acción, una divisa, el petróleo). Futuros, opciones y contratos por diferencia son los más conocidos.

### Para qué existen

Nacieron para **cubrir riesgos**: un agricultor fija hoy el precio de su cosecha futura y deja de depender del precio del día. Ese uso — cobertura — es su función original y legítima.

El otro uso es **especular** sobre movimientos de precio sin poseer el activo.

### El apalancamiento

Es operar con más dinero del que tienes, usando tu capital como garantía. Con un apalancamiento de 10x, mueves 10.000 poniendo 1.000.

- Si el activo sube 5%, ganas 500: un **50%** sobre tu capital.
- Si baja 5%, pierdes 500: un **50%** de tu capital.
- Si baja 10%, **lo pierdes todo**.

La simetría es exacta, pero la ruina no: cuando tu capital llega a cero, sales del juego aunque el precio se recupere al día siguiente.

### Por qué esta lección existe

Porque estos productos se publicitan con la promesa de multiplicar ganancias y se omite la otra mitad. Una proporción muy alta de quienes operan derivados apalancados en minorista **pierde dinero**.

> ⚠️ Contenido educativo con un fin claro: que reconozcas el riesgo antes de que te lo vendan como oportunidad.

---

**Mini-reflexión:** Con apalancamiento 10x, ¿qué movimiento en contra basta para liquidar tu posición? Que la respuesta sea "un 10%" explica muchas historias. ⚠️`,
        },
        {
          slug: "divisas-y-tipo-de-cambio",
          title: "Divisas y tipo de cambio",
          summary:
            "Entenderás qué mueve el tipo de cambio y cómo afecta a tus inversiones en el extranjero.",
          estimatedMinutes: 6,
          content: `## Divisas y tipo de cambio

El **tipo de cambio** es el precio de una moneda en términos de otra. Cambia continuamente y afecta más de lo que parece a tus finanzas.

### Qué lo mueve

- **Diferencias de tasas de interés** entre países.
- **Inflación relativa:** la moneda que pierde poder de compra más rápido tiende a depreciarse.
- **Estabilidad política y económica**, que atrae o espanta capitales.
- **Balanza comercial** y flujos de inversión.

### Por qué te importa aunque no operes divisas

Si inviertes en un activo extranjero, tu resultado tiene **dos componentes**: cómo le fue al activo **y** cómo se movió la moneda.

Un fondo internacional puede subir 10% en dólares y dejarte una ganancia menor — o una pérdida — si tu moneda local se apreció frente al dólar en ese período. Y al revés.

### Cubrir o no cubrir

Existen fondos con **cobertura cambiaria** (hedge), que neutralizan ese efecto a cambio de un costo. Sin cobertura, asumes el riesgo de moneda; con cobertura, pagas por eliminarlo. Ninguna opción es gratis.

### Una advertencia

El mercado de divisas es de los más operados y difíciles de predecir. La especulación cambiaria de corto plazo, habitualmente apalancada, es una de las formas más rápidas de perder capital.

---

**Mini-reflexión:** Si tu inversión extranjera sube 8% y tu moneda local se aprecia 10%, ¿ganaste o perdiste? 💱`,
        },
      ],
    },
  ],
};

// -----------------------------------------------------------------------------
// Ruta 8: Estrategia y Práctica del Inversionista · Categoría: Inversiones
// -----------------------------------------------------------------------------
export const ESTRATEGIA_INVERSION: LearningPath = {
  slug: "estrategia-del-inversionista",
  title: "Estrategia y Práctica del Inversionista",
  description:
    "Del concepto a la práctica: definir tu perfil, construir y mantener una cartera, analizar una inversión y evitar los errores que arruinan buenos planes.",
  modules: [
    {
      slug: "empezar-a-invertir",
      title: "Empezar a invertir",
      description: "Los pasos concretos antes de tu primera operación.",
      category: "Inversiones",
      lessons: [
        {
          slug: "perfil-de-riesgo",
          title: "Tu perfil de riesgo",
          summary:
            "Distinguirás tu capacidad de asumir riesgo de tu tolerancia emocional a él.",
          estimatedMinutes: 7,
          content: `## Tu perfil de riesgo

Antes de elegir en qué invertir, hay que responder cuánto riesgo **puedes** y cuánto **quieres** asumir. Son cosas distintas y ambas importan.

### Capacidad (los hechos)

Depende de tu situación objetiva:

- **Horizonte:** ¿cuándo necesitas este dinero?
- **Estabilidad de ingresos.**
- **Fondo de emergencia** ya formado o no.
- **Patrimonio y responsabilidades** a tu cargo.

Alguien de 30 años, con ingresos estables, sin deudas y con fondo de emergencia tiene **capacidad** alta, le guste o no el riesgo.

### Tolerancia (la emoción)

Es cuánta volatilidad puedes soportar **sin tomar malas decisiones**. La prueba real: si tu cartera cayera 30% en dos meses, ¿aguantarías el plan o venderías?

### Cuando no coinciden

Manda **la menor de las dos**. Una cartera teóricamente óptima que te lleva a vender en pánico en el peor momento es peor que una más conservadora que puedes sostener.

### Cómo se calibra de verdad

Las respuestas de un cuestionario en un día tranquilo son optimistas por naturaleza. La tolerancia real se descubre en la primera caída fuerte, y es información valiosa: anótala.

---

**Mini-reflexión:** Sé honesto contigo: ante una caída del 30%, ¿qué harías de verdad, no qué te gustaría hacer? 🎚️`,
        },
        {
          slug: "abrir-una-cuenta-de-inversion",
          title: "Abrir una cuenta de inversión",
          summary:
            "Sabrás qué es un intermediario, qué mirar al elegirlo y qué pasos implica.",
          estimatedMinutes: 6,
          content: `## Abrir una cuenta de inversión

Para comprar la mayoría de los instrumentos necesitas un **intermediario**: una corredora, un banco o una plataforma de inversión. No puedes comprar directamente en la bolsa.

### Qué mirar al elegir

1. **Regulación:** que esté autorizado por el organismo supervisor de tu país. Este punto es innegociable.
2. **Costos:** comisión por operación, custodia, mantención, retiro y conversión de moneda.
3. **Qué ofrece:** no todos dan acceso a los mismos mercados o instrumentos.
4. **Mínimos** de apertura y de operación.
5. **Servicio y respaldo:** qué pasa si hay un problema y con quién hablas.

### El proceso habitual

Verificación de identidad, un cuestionario de perfil de inversionista (exigido por la regulación), transferencia de fondos desde tu cuenta bancaria y ya puedes operar.

### Una advertencia

Abundan las plataformas que prometen retornos extraordinarios y **no están reguladas** en ningún lugar. Antes de transferir un peso, verifica el registro del intermediario en el sitio oficial del regulador. Si no aparece, no hay conversación que tener.

> ⚠️ Aquí no se recomienda ninguna plataforma concreta. El criterio es tuyo; la verificación regulatoria, obligatoria.

---

**Mini-reflexión:** ¿Sabrías dónde verificar si un intermediario está autorizado en tu país? Encontrar ese sitio es una buena tarea previa. 🔐`,
        },
        {
          slug: "tipos-de-ordenes",
          title: "Tipos de órdenes",
          summary:
            "Entenderás la diferencia entre orden de mercado y orden límite, y cuándo usar cada una.",
          estimatedMinutes: 6,
          content: `## Tipos de órdenes

Comprar en bolsa no es como comprar en una tienda: tú defines **cómo** quieres que se ejecute la operación.

### Orden de mercado

"Compra ya, al precio que haya."

- ✅ Se ejecuta casi con certeza y de inmediato.
- ❌ No controlas el precio final. En activos poco líquidos o muy volátiles, puedes pagar bastante más de lo que veías en pantalla.

### Orden límite

"Compra solo si el precio es 1.000 o menos."

- ✅ Controlas el precio exacto.
- ❌ Puede no ejecutarse nunca si el mercado no llega a tu precio.

### Otras que conviene conocer

- **Stop loss:** vende automáticamente si el precio cae hasta cierto nivel. Limita pérdidas, pero puede activarse en una caída pasajera y dejarte fuera justo antes del rebote.
- **Vigencia:** define si la orden vale solo por hoy o hasta que la canceles.

### El concepto detrás: liquidez

En un activo muy transado, la diferencia entre lo que piden los vendedores y ofrecen los compradores (el **spread**) es mínima. En uno poco transado puede ser enorme, y ahí una orden de mercado se paga cara.

---

**Mini-reflexión:** Si vas a comprar un activo que se transa poco, ¿qué tipo de orden protege mejor tu bolsillo? 📋`,
        },
        {
          slug: "costos-al-invertir",
          title: "Todos los costos de invertir",
          summary:
            "Identificarás los costos visibles e invisibles que reducen tu rentabilidad final.",
          estimatedMinutes: 6,
          content: `## Todos los costos de invertir

Tu rentabilidad real es la del activo **menos** todo lo que se va por el camino. Conviene tener el mapa completo.

### Los visibles

- **Comisión por operación:** cada compra y cada venta.
- **Custodia o mantención:** un cargo periódico por mantener tus activos.
- **Administración del fondo:** el porcentaje anual del vehículo.

### Los menos visibles

- **Spread:** la diferencia entre precio de compra y de venta. Se paga siempre, aunque no aparezca como comisión.
- **Conversión de moneda:** al invertir en otra divisa, el tipo de cambio aplicado suele incluir un margen.
- **Impuestos** sobre ganancias y dividendos.
- **Rotación excesiva:** cada operación tiene costo. Operar mucho es una forma silenciosa de perder dinero.

### La conclusión práctica

Los costos son de las **pocas variables que controlas**. La rentabilidad futura no la conoce nadie; el costo anual de un fondo está publicado.

Y cuidado con lo "sin comisiones": si un servicio es gratis, revisa por dónde cobra — normalmente en el spread o en el tipo de cambio.

---

**Mini-ejercicio:** Suma todos los costos anuales de una inversión que tengas hoy, incluyendo los invisibles. ¿Cuánto rendimiento necesitas solo para empatar? 💸`,
        },
      ],
    },
    {
      slug: "construir-cartera",
      title: "Construir y mantener una cartera",
      description: "De activos sueltos a un conjunto coherente que se sostiene en el tiempo.",
      category: "Inversiones",
      lessons: [
        {
          slug: "asignacion-de-activos",
          title: "Asignación de activos",
          summary:
            "Entenderás por qué la mezcla entre tipos de activos explica la mayor parte de tu resultado.",
          estimatedMinutes: 7,
          content: `## Asignación de activos

La **asignación de activos** es cómo repartes tu cartera entre las grandes familias: renta variable, renta fija, liquidez y alternativos.

### Por qué es la decisión más importante

Diversos estudios apuntan en la misma dirección: la mezcla entre clases de activos explica **la mayor parte** de la variabilidad del resultado de una cartera a largo plazo. Elegir "qué acción concreta" pesa mucho menos de lo que la intuición sugiere.

Dicho simple: acertar la proporción entre acciones y bonos importa más que acertar cuál acción.

### Qué la determina

- **Horizonte:** más plazo permite más renta variable, porque hay tiempo de recuperarse.
- **Capacidad y tolerancia al riesgo.**
- **Objetivo** concreto del dinero.

### Reglas de referencia (y su límite)

Circulan reglas simples, del tipo "el porcentaje en renta fija se parece a tu edad". Sirven como punto de partida para pensar, **no** como respuesta: ignoran tu situación, tus metas y tu tolerancia real.

### Lo que no debe cambiar

La asignación se define **en frío**, con un plan escrito. Cambiarla porque el mercado subió o cayó es, casi siempre, comprar caro y vender barato.

> ⚠️ Conceptos generales, no una recomendación de asignación para tu caso.

---

**Mini-reflexión:** Si tu mezcla explica la mayor parte del resultado, ¿en qué deberías gastar más tiempo: en elegir activos concretos o en definir tu asignación? ⚖️`,
        },
        {
          slug: "aportes-periodicos-dca",
          title: "Aportes periódicos (DCA)",
          summary:
            "Comprenderás la estrategia de invertir montos fijos con regularidad y qué resuelve.",
          estimatedMinutes: 7,
          content: `## Aportes periódicos (DCA)

Consiste en invertir un **monto fijo con una frecuencia fija** — por ejemplo, todos los meses — sin importar cómo esté el mercado.

### Qué resuelve

1. **Elimina la pregunta imposible.** Ya no tienes que adivinar cuándo entrar; el calendario decide.
2. **Promedia el precio de compra.** Con el mismo monto compras más unidades cuando el precio está bajo y menos cuando está alto.
3. **Convierte invertir en un hábito**, igual que el ahorro automático. Y los hábitos sobreviven a la emoción.

### Su ventaja psicológica

Una caída deja de ser una amenaza y pasa a ser, literalmente, una compra más barata. Eso cambia por completo la forma de vivir la volatilidad, que es donde la mayoría abandona.

### Sus límites, con honestidad

- Si ya tienes una suma grande disponible, históricamente invertirla de una vez ha tendido a rendir más en promedio, simplemente porque el dinero pasa más tiempo invertido. El DCA reduce el **arrepentimiento** de entrar justo antes de una caída, a costa de algo de retorno esperado.
- No protege de las pérdidas: si el activo cae de forma permanente, promediar no lo arregla.

> ⚠️ Descripción de una estrategia, no una recomendación de aplicarla.

---

**Mini-reflexión:** Si el mercado cae un 20% el mes que te toca aportar, ¿qué haría el plan por ti que probablemente no harías tú solo? 📅

---

👉 **Ponlo a prueba:** simula aportes mensuales sostenidos en el tiempo con la [calculadora de interés compuesto](/simuladores/interes-compuesto).`,
        },
        {
          slug: "rebalanceo-de-cartera",
          title: "Rebalancear la cartera",
          summary:
            "Sabrás por qué las proporciones se desvían solas y cómo devolverlas a su objetivo.",
          estimatedMinutes: 6,
          content: `## Rebalancear la cartera

Definiste una asignación, por ejemplo 70% acciones y 30% bonos. Pasa un año muy bueno para las acciones y, sin que hagas nada, tu cartera queda en 80/20.

Tu riesgo **subió solo**. Rebalancear es devolverla a su objetivo.

### Cómo se hace

- Vendiendo parte de lo que creció y comprando lo que quedó rezagado.
- O, mejor si estás en fase de aportes: dirigiendo los **nuevos aportes** al activo rezagado, sin vender nada. Evitas costos e impuestos.

### Por qué cuesta tanto

Porque va contra la emoción: te obliga a **vender lo que va ganando** y comprar lo que va perdiendo. Sentirá que es un error justo cuando toca hacerlo. Ese malestar es la señal de que estás siguiendo el plan y no el impulso.

### Cuándo rebalancear

- **Por calendario:** una o dos veces al año. Simple y suficiente para la mayoría.
- **Por umbral:** cuando una clase se desvía más de cierto porcentaje (por ejemplo, 5 puntos) de su objetivo.

Rebalancear muy seguido suma costos e impuestos sin aportar gran cosa.

---

**Mini-reflexión:** Si rebalancear te obliga a vender lo que más subió, ¿por qué es exactamente eso lo que controla tu riesgo? 🔁`,
        },
        {
          slug: "rentabilidad-real-vs-nominal",
          title: "Rentabilidad real vs. nominal",
          summary:
            "Aprenderás a descontar la inflación para saber si tu dinero creció de verdad.",
          estimatedMinutes: 6,
          content: `## Rentabilidad real vs. nominal

- **Nominal:** el número que te muestran. "Rindió 8% este año."
- **Real:** ese número **menos la inflación**. Es lo que efectivamente creció tu poder de compra.

### El cálculo rápido

Con un 8% nominal y un 6% de inflación, tu rentabilidad real es de aproximadamente **2%**. Tienes más dinero, sí, pero compras solo un 2% más de cosas.

### El caso incómodo

Un instrumento que rinde 4% con una inflación del 7% tiene una rentabilidad real **negativa**: perdiste poder de compra aunque tu saldo haya subido. Es exactamente lo que le ocurre al dinero parado o en instrumentos muy conservadores durante períodos inflacionarios.

### Y todavía falta restar

Sobre la rentabilidad real, descuenta además **comisiones e impuestos**. Recién ahí tienes tu resultado verdadero. La distancia entre el número del folleto y ese resultado suele ser mayor de lo que la gente supone.

### Por qué importa

Porque la meta de invertir a largo plazo no es "tener más pesos", sino **conservar y aumentar lo que esos pesos pueden comprar**.

---

**Mini-ejercicio:** Toma la rentabilidad de alguna inversión tuya del último año y réstale la inflación del período. ¿Sigue pareciéndote igual de buena? 📉`,
        },
      ],
    },
    {
      slug: "analisis-de-inversiones",
      title: "Analizar una inversión",
      description: "Las herramientas con que se estudia una empresa o un activo.",
      category: "Inversiones",
      lessons: [
        {
          slug: "estados-financieros-basicos",
          title: "Los estados financieros, en simple",
          summary:
            "Conocerás los tres estados contables y qué pregunta responde cada uno.",
          estimatedMinutes: 7,
          content: `## Los estados financieros, en simple

Toda empresa que cotiza publica sus cuentas. Son tres documentos y cada uno responde una pregunta distinta.

### Balance: ¿qué tiene y qué debe?

Es una foto en una fecha. Se divide en **activos** (lo que posee), **pasivos** (lo que debe) y **patrimonio** (la diferencia, lo que pertenece a los dueños). Siempre cuadra: activos = pasivos + patrimonio.

### Estado de resultados: ¿ganó o perdió?

Es una película de un período. Parte de los **ingresos** y va restando costos y gastos hasta llegar a la **utilidad neta**. Aquí se ve si el negocio es rentable.

### Flujo de caja: ¿entró y salió dinero de verdad?

El más difícil de maquillar. Una empresa puede reportar utilidades contables y estar **quedándose sin efectivo** (por ejemplo, si vende mucho a crédito y no le pagan). El flujo operativo muestra si el negocio genera caja realmente.

### La regla de oro del analista

Si el estado de resultados y el flujo de caja cuentan historias muy distintas durante varios períodos, **hay que investigar por qué**. Las utilidades son una opinión; la caja es un hecho.

---

**Mini-reflexión:** ¿Cómo puede una empresa reportar ganancias y aun así no tener dinero para pagar sueldos? Responder eso es entender el flujo de caja. 📑`,
        },
        {
          slug: "ratios-fundamentales",
          title: "Ratios que se usan siempre",
          summary:
            "Interpretarás los indicadores más citados: PER, deuda y rentabilidad.",
          estimatedMinutes: 7,
          content: `## Ratios que se usan siempre

Los ratios son relaciones entre cifras que permiten **comparar** empresas de tamaños distintos.

### De valoración

- **PER (precio/utilidad):** cuántas veces la utilidad anual estás pagando por la acción. Un PER de 20 significa pagar 20 años de utilidades actuales. Alto puede indicar expectativas de crecimiento… o simplemente que está cara.
- **Precio/valor libro:** compara el precio con el patrimonio contable.

### De rentabilidad

- **Margen neto:** cuánto queda de utilidad por cada peso vendido.
- **ROE (rentabilidad sobre patrimonio):** cuánta utilidad genera la empresa con el dinero de sus dueños.

### De solidez

- **Deuda/patrimonio:** cuánto se financia con deuda frente a capital propio. Alto significa más riesgo, sobre todo si suben las tasas.
- **Liquidez corriente:** si puede pagar sus obligaciones de corto plazo.

### Las tres reglas para no engañarse

1. **Compara solo dentro del mismo sector.** Un PER normal en banca puede ser altísimo en tecnología.
2. **Mira la evolución**, no un dato suelto.
3. **Ningún ratio decide nada por sí solo.** Son preguntas, no respuestas.

> ⚠️ Herramientas de análisis con fines educativos, no criterios de compra.

---

**Mini-reflexión:** Si dos empresas del mismo sector tienen PER 8 y PER 40, ¿qué te dice eso realmente sobre cuál es "mejor"? (Pista: por sí solo, casi nada.) 🔬`,
        },
        {
          slug: "analisis-fundamental-vs-tecnico",
          title: "Análisis fundamental vs. técnico",
          summary:
            "Distinguirás las dos grandes escuelas de análisis y qué pregunta responde cada una.",
          estimatedMinutes: 6,
          content: `## Análisis fundamental vs. técnico

Dos formas muy distintas de decidir, con supuestos opuestos.

### Análisis fundamental

Estudia el **negocio**: sus estados financieros, su sector, su ventaja competitiva, su equipo. Busca estimar cuánto **vale** realmente y compararlo con el precio.

- Pregunta: *¿esta empresa vale más o menos de lo que cuesta?*
- Horizonte: largo plazo.

### Análisis técnico

Estudia el **precio y el volumen** en gráficos, buscando patrones que se repiten. No mira el negocio: mira el comportamiento del mercado.

- Pregunta: *¿hacia dónde apunta el movimiento del precio?*
- Horizonte: normalmente corto.

### El debate

Los fundamentalistas sostienen que el precio termina reflejando el valor del negocio. Los técnicos, que toda la información ya está en el precio. Hay evidencia académica que cuestiona la capacidad del análisis técnico de generar retornos superiores de forma consistente, y también críticas al fundamental por la dificultad de estimar el valor con precisión.

### El punto honesto

Ninguno predice el futuro. Son marcos para **estructurar** decisiones y, sobre todo, para tener un criterio propio en vez de seguir la emoción del momento.

---

**Mini-reflexión:** Si toda la información pública ya está reflejada en el precio, ¿qué tendría que ocurrir para que tu análisis te dé una ventaja sobre el mercado? 🧭`,
        },
        {
          slug: "valoracion-y-margen-de-seguridad",
          title: "Valoración y margen de seguridad",
          summary:
            "Entenderás la diferencia entre precio y valor, y por qué se exige un colchón al estimar.",
          estimatedMinutes: 7,
          content: `## Valoración y margen de seguridad

> "El precio es lo que pagas; el valor es lo que recibes."

Toda la inversión fundamental cabe en esa distinción.

### Cómo se estima el valor

La idea central: un activo vale la suma de los **flujos de dinero que generará en el futuro**, traídos a valor de hoy (porque mil pesos dentro de diez años valen menos que mil pesos hoy).

Eso exige proyectar el futuro y elegir una tasa de descuento. Dos supuestos razonables pero distintos pueden dar valoraciones muy separadas.

### El margen de seguridad

Justamente porque toda valoración es una **estimación con error**, la idea es comprar solo cuando el precio está claramente **por debajo** del valor estimado. Esa diferencia es el colchón que te protege de haberte equivocado en los supuestos.

Si calculas que algo vale 100, comprar a 95 no deja margen. Comprar a 65 sí.

### La humildad necesaria

El futuro no se conoce. El margen de seguridad no es una técnica para acertar más: es el reconocimiento explícito de que vas a equivocarte y de que tu plan debe sobrevivir a ese error.

> ⚠️ Marco conceptual educativo. No es un método para seleccionar inversiones concretas ni una promesa de resultados.

---

**Mini-reflexión:** Si aceptas de entrada que tu estimación puede estar equivocada, ¿cómo cambia el precio que estarías dispuesto a pagar? 🛟`,
        },
      ],
    },
    {
      slug: "psicologia-y-riesgos-del-mercado",
      title: "Psicología del mercado y riesgos",
      description: "Las trampas que arruinan buenos planes: las propias y las ajenas.",
      category: "Inversiones",
      lessons: [
        {
          slug: "inversion-pasiva-vs-activa",
          title: "Ser inversionista o ser operador",
          summary:
            "Diferenciarás invertir a largo plazo de operar a corto y qué implica cada camino.",
          estimatedMinutes: 6,
          content: `## Ser inversionista o ser operador

Son dos actividades distintas que suelen confundirse porque usan las mismas pantallas.

### Invertir

Comprar participaciones en negocios o activos productivos y **mantenerlos años**, esperando que el valor crezca con el tiempo. Pocas decisiones, mucha paciencia, costos bajos.

### Operar (trading)

Comprar y vender en plazos cortos buscando aprovechar movimientos de precio. Muchas decisiones, mucho tiempo dedicado, costos altos por la cantidad de operaciones.

### Lo que muestran los datos

Los estudios sobre inversionistas minoristas que operan con frecuencia son consistentemente desfavorables: una **mayoría pierde dinero**, y quienes más operan tienden a obtener peores resultados que quienes menos lo hacen. Los costos y los impuestos de cada operación explican buena parte del fenómeno.

### La confusión peligrosa

Mucha gente cree que está invirtiendo cuando en realidad está operando: revisa la cartera cada día, reacciona a noticias, cambia de posición cada pocas semanas. Ese comportamiento tiene el costo del trading sin su dedicación.

### La pregunta que ordena

¿Cuánto tiempo estás dispuesto a dedicar y cuál es tu horizonte? Responderlo define en qué juego estás.

> ⚠️ Descripción de enfoques, no una recomendación de ninguno.

---

**Mini-reflexión:** ¿Cuántas veces al mes revisas el precio de tus inversiones? Esa cifra dice bastante sobre en qué juego estás realmente. ⏱️`,
        },
        {
          slug: "market-timing",
          title: "Adivinar el momento del mercado",
          summary:
            "Verás por qué intentar entrar y salir en el momento justo suele salir caro.",
          estimatedMinutes: 7,
          content: `## Adivinar el momento del mercado

El **market timing** es intentar comprar en el punto bajo y vender en el alto. Suena obvio y es extraordinariamente difícil.

### Por qué falla

Requiere acertar **dos veces**: cuándo salir y cuándo volver a entrar. Y la segunda es la que casi nadie acierta, porque el momento de volver se siente terrible: cuando las noticias son pésimas y todo el mundo está vendiendo.

### El dato que más pesa

Las mayores subidas del mercado tienden a ocurrir **muy cerca** de las peores caídas, a menudo en cuestión de días. Diversos análisis históricos muestran que perderse un puñado de las mejores jornadas de un período largo reduce el resultado final de forma drástica.

Quien sale para "esperar a que pase la tormenta" suele perderse justo esos días.

### La alternativa

> **Tiempo en el mercado, no adivinar el momento del mercado.**

Un plan definido, aportes regulares y rebalanceo periódico eliminan la necesidad de acertar el momento, que es precisamente lo que nadie logra hacer de forma consistente.

### La honestidad del caso

Nadie sabe qué hará el mercado el próximo mes. Ni los analistas, ni los gestores profesionales, ni quien te lo asegura en un video.

---

**Mini-reflexión:** Si salieras hoy del mercado por miedo, ¿qué señal concreta te haría volver a entrar? La dificultad para responderlo es justamente el problema. ⌛`,
        },
        {
          slug: "burbujas-y-panicos",
          title: "Burbujas y pánicos",
          summary:
            "Reconocerás el patrón de euforia y miedo colectivo que se repite en la historia.",
          estimatedMinutes: 7,
          content: `## Burbujas y pánicos

Cambian los protagonistas, pero la historia se repite con una regularidad notable: tulipanes, ferrocarriles, empresas de internet, hipotecas, activos digitales.

### Las fases de una burbuja

1. **Detonante:** una innovación real y prometedora.
2. **Auge:** los precios suben y aparecen las primeras ganancias visibles.
3. **Euforia:** entra el público general. Se instala la frase clave: **"esta vez es distinto"**. La gente compra porque sube, sin importar el valor.
4. **Estallido:** algo detona las dudas y todos quieren salir a la vez.
5. **Pánico:** los precios caen muy por debajo de lo razonable, arrastrando también a activos sanos.

### Las señales de euforia

- Personas sin interés previo en invertir hablando del tema en todas partes.
- La sensación de estar **quedándose fuera** (FOMO) como motivo principal de compra.
- Endeudarse para comprar el activo de moda.
- Argumentos que descartan toda valoración porque "las reglas cambiaron".

### El único plan que resiste

No reconocerás la burbuja a tiempo — casi nadie lo hace. Lo que sí puedes tener es una **asignación decidida en frío** que no dependa de identificar el momento, y una regla propia: nunca invertir por miedo a quedarse fuera.

---

**Mini-reflexión:** ¿Recuerdas algún activo del que "todo el mundo" hablaba hace unos años? ¿Qué pasó después? 🎢`,
        },
        {
          slug: "estafas-y-esquemas-piramidales",
          title: "Estafas y esquemas piramidales",
          summary:
            "Identificarás las señales inconfundibles de un fraude financiero antes de caer en él.",
          estimatedMinutes: 7,
          content: `## Estafas y esquemas piramidales

Un **esquema Ponzi** no invierte nada: paga a los antiguos con el dinero de los nuevos. Funciona mientras siga entrando gente y colapsa inevitablemente cuando deja de entrar. En una **pirámide**, la ganancia viene de reclutar a otros, no de un producto real.

### Las señales, casi siempre las mismas

- **Rentabilidad alta y "garantizada".** No existe. Si existiera, no la estarían ofreciendo por mensaje.
- **Retornos constantes** mes a mes, sin importar cómo esté el mercado. Los mercados reales no se comportan así.
- **Presión y urgencia:** "los cupos se cierran hoy".
- **Ganas más si traes gente.** Señal definitiva.
- **Opacidad:** no explican con claridad cómo se genera el dinero, o lo envuelven en jerga.
- **Sin regulación:** la empresa no aparece en el registro del supervisor de tu país.
- **Dificultades para retirar:** el momento en que todo se descubre.

### Los tres pasos de verificación

1. Busca la entidad en el **registro oficial** del regulador.
2. Pide por escrito **de dónde sale el retorno**. Si no hay una respuesta concreta y verificable, ahí termina.
3. Consulta a alguien sin interés en la operación. La opinión de quien te invitó no cuenta: normalmente él también fue reclutado.

### La regla que resume todo

> Si parece demasiado bueno para ser verdad, no es verdad.

Y una advertencia extra: es habitual que estos esquemas lleguen a través de **gente cercana y de buena fe**. Que la persona sea de confianza no valida la inversión.

---

**Mini-reflexión:** Si alguien de tu familia te ofreciera un retorno del 10% mensual garantizado, ¿qué le preguntarías primero? 🚩`,
        },
        {
          slug: "errores-comunes-del-inversionista",
          title: "Los errores que más se repiten",
          summary:
            "Repasarás los fallos más frecuentes al invertir y cómo prevenirlos con un plan.",
          estimatedMinutes: 7,
          content: `## Los errores que más se repiten

Casi todos los malos resultados vienen de un puñado de errores conocidos. Reconocerlos de antemano es la mejor defensa.

### La lista

1. **Invertir sin bases:** sin fondo de emergencia o con deudas caras. Cualquier imprevisto te obliga a vender en el peor momento.
2. **Invertir dinero que necesitas pronto.** El plazo manda.
3. **Comprar por FOMO:** entrar en lo que ya subió mucho, porque todos hablan de ello.
4. **Vender en pánico:** materializar una pérdida que en el papel era temporal. El error más caro de todos.
5. **Concentrar demasiado:** todo en una empresa, un sector o un país. A menudo, en la empresa donde trabajas — donde ya tienes tu sueldo en juego.
6. **Ignorar los costos:** comisiones e impuestos que se comen la rentabilidad en silencio.
7. **Operar demasiado.** Cada movimiento tiene costo y la mayoría no aporta.
8. **No tener plan escrito:** sin él, decides con la emoción del día.

### El antídoto, uno solo

Un **plan escrito y decidido en frío**: para qué es este dinero, en qué plazo, qué asignación tengo y qué haré cuando caiga un 30%. Redactar esa última respuesta **antes** de que ocurra es lo que separa a quien sostiene su estrategia de quien la abandona.

---

**Mini-ejercicio:** Escribe hoy, en tres líneas, qué harás la próxima vez que tu cartera caiga con fuerza. Guárdalo. Ese papel vale más de lo que parece. 📝`,
        },
      ],
    },
  ],
};

/** Todas las rutas disponibles en la plataforma. */
export const LEARNING_PATHS: LearningPath[] = [
  FUNDAMENTOS,
  VIDA_FINANCIERA,
  GESTION_RIESGO,
  METAS_Y_FUTURO,
  INVERSIONES,
  INSTRUMENTOS,
  ESTRATEGIA_INVERSION,
  MACROECONOMIA,
];

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Devuelve todas las lecciones de todas las rutas, en orden. */
export function getAllLessons(): Lesson[] {
  return LEARNING_PATHS.flatMap((path) => path.modules.flatMap((mod) => mod.lessons));
}

/** Devuelve todos los módulos de todas las rutas, en orden. */
export function getAllModules(): Module[] {
  return LEARNING_PATHS.flatMap((path) => path.modules);
}

/** Tamaño del programa, tal como lo anuncian la portada y la página de precios. */
export interface CurriculumStats {
  lessonCount: number;
  moduleCount: number;
}

/**
 * Cifras del currículum real. Se calculan (no se escriben a mano) para que la
 * oferta pública no se desalinee del contenido al ampliarlo.
 */
export function getCurriculumStats(): CurriculumStats {
  return {
    lessonCount: getAllLessons().length,
    moduleCount: getAllModules().length,
  };
}

/**
 * Módulos de una categoría concreta, conservando la ruta a la que pertenecen
 * (útil para mostrar el origen del módulo al agrupar por categoría en la UI).
 */
export function getModulesByCategory(
  category: Category,
): { path: LearningPath; module: Module }[] {
  return LEARNING_PATHS.flatMap((path) =>
    path.modules
      .filter((mod) => mod.category === category)
      .map((mod) => ({ path, module: mod })),
  );
}

/**
 * Todos los módulos agrupados por categoría, en el orden de `CATEGORIES`.
 * Pensado para renderizar la navegación en dos grandes bloques de una sola pasada.
 */
export function getModulesGroupedByCategory(): {
  category: Category;
  modules: { path: LearningPath; module: Module }[];
}[] {
  return CATEGORIES.map((category) => ({
    category,
    modules: getModulesByCategory(category),
  }));
}

/** Todas las lecciones de una categoría, en orden. */
export function getLessonsByCategory(category: Category): Lesson[] {
  return getModulesByCategory(category).flatMap(({ module }) => module.lessons);
}

/** Categoría a la que pertenece una lección, o `null` si el slug no existe. */
export function getCategoryByLessonSlug(slug: string): Category | null {
  return getLessonBySlug(slug)?.module.category ?? null;
}

/** Busca una lección por su slug y devuelve también su ruta y módulo. */
export function getLessonBySlug(
  slug: string,
): { path: LearningPath; module: Module; lesson: Lesson } | null {
  for (const path of LEARNING_PATHS) {
    for (const module of path.modules) {
      const lesson = module.lessons.find((l) => l.slug === slug);
      if (lesson) return { path, module, lesson };
    }
  }
  return null;
}

/** True si el slug corresponde a una lección real (para validar en el backend). */
export function lessonExists(slug: string): boolean {
  return getLessonBySlug(slug) !== null;
}

/**
 * Slugs de lección repetidos, si los hubiera.
 *
 * Los slugs son la clave estable que referencia `lesson_progress`, así que un
 * duplicado silenciaría el progreso de una de las dos lecciones. TypeScript no
 * puede detectarlo (son strings), de modo que esta comprobación existe para
 * ejecutarla al ampliar el currículum. Debe devolver siempre un array vacío.
 */
export function findDuplicateLessonSlugs(): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const lesson of getAllLessons()) {
    if (seen.has(lesson.slug)) duplicates.add(lesson.slug);
    seen.add(lesson.slug);
  }
  return [...duplicates];
}

/** Lección anterior y siguiente dentro de la secuencia global (para navegar). */
export function getAdjacentLessons(slug: string): {
  prev: Lesson | null;
  next: Lesson | null;
} {
  const all = getAllLessons();
  const index = all.findIndex((l) => l.slug === slug);
  if (index === -1) return { prev: null, next: null };
  return {
    prev: index > 0 ? all[index - 1] : null,
    next: index < all.length - 1 ? all[index + 1] : null,
  };
}
