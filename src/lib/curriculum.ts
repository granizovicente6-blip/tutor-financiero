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

/** Un módulo agrupa lecciones relacionadas por tema. */
export interface Module {
  slug: string;
  title: string;
  description: string;
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

/** Todas las rutas disponibles en la plataforma. */
export const LEARNING_PATHS: LearningPath[] = [
  FUNDAMENTOS,
  INVERSIONES,
  MACROECONOMIA,
  GESTION_RIESGO,
];

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Devuelve todas las lecciones de todas las rutas, en orden. */
export function getAllLessons(): Lesson[] {
  return LEARNING_PATHS.flatMap((path) => path.modules.flatMap((mod) => mod.lessons));
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
