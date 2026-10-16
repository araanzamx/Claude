# Plataforma Upper Nannies: especificaciones

Documento de arranque para construir la plataforma en Claude Code. Está pensado para pegarse en la raíz del proyecto (como `SPEC.md`) y para que Claude lo lea antes de escribir código.

## 1. Contexto

Upper Nannies es una agencia de colocación de niñeras en Ciudad de México. Hoy la niñera llena a mano, en papel, la bitácora diaria del niño o la niña, y la familia no tiene una forma sencilla de consultarla ni de ver la planeación de actividades.

Ya existe un prototipo funcional de la bitácora (`bitacora-upper-nannies.html`, un solo archivo). Sirve como referencia de diseño, campos y flujo. Su limitación: guarda los datos con la base de datos de los artefactos de Claude, así que todos los usuarios necesitan cuenta de Claude y no hay forma de que una familia vea solo a su niño dentro de un mismo espacio. Por eso hay que construir una plataforma propia.

## 2. Objetivo

Reemplazar la bitácora en papel con una plataforma web, móvil primero, donde:

1. La niñera registra el día del niño desde su teléfono.
2. La familia consulta la bitácora, en vivo, sin necesitar cuenta de Claude.
3. Después, se suben y revisan las planeaciones de actividades y los reportes.

## 3. Usuarios y roles

| Rol | Quién es | Puede hacer |
| --- | --- | --- |
| Administradora | Aranza (dueña de la agencia) | Ver y editar todo. Crear familias, niños, niñeras y asignaciones. Invitar usuarios. |
| Niñera | Persona colocada con una o más familias | Registrar bitácora, subir planeaciones y reportes solo de los niños que tiene asignados. |
| Familia | Mamá, papá o tutores de uno o más niños | Ver bitácora, planeaciones y reportes solo de sus propios hijos. Solo lectura en bitácora. |

**Regla central de privacidad:** una familia nunca ve datos de otra familia, y una niñera solo ve a los niños que tiene asignados. Esto debe hacerse cumplir en el servidor (reglas de acceso en la base de datos), no solo ocultándolo en la interfaz.

## 4. Alcance de la versión 1: bitácora diaria

### 4.1 Tipos de registro

Cada registro tiene una hora (por defecto la actual) y pertenece a un niño y a un día.

| Tipo | Campos |
| --- | --- |
| Comida | Momento (Desayuno, Colación, Comida, Merienda, Cena, Leche o biberón) obligatorio; qué comió (texto); cuánto comió (Todo, Casi todo, Poco, Nada); hora |
| Siesta | Se durmió a las (hora); despertó a las (hora, opcional); cómo durmió (Tranquilo, Inquieto) |
| Pañal o baño | Qué pasó (Pipí, Popó, Pipí y popó, Seco, Fue al baño) obligatorio; notas; hora |
| Ánimo y salud | Ánimo (Feliz, Tranquilo, Inquieto, Triste o llorón, Cansado) obligatorio; temperatura en °C (opcional); salud y medicamentos (texto); hora |
| Actividad | Qué hicieron obligatorio; cómo le fue (texto); hora |

Comportamientos a conservar del prototipo:

- Una siesta sin hora de despertar queda como "Durmiendo ahora" y la niñera la cierra con un botón "Ya despertó".
- Quitar un registro pide confirmación con un segundo toque.
- La hora se muestra en formato 12 h (am/pm).

### 4.2 Pantallas

**Niñera (móvil primero)**

- Lista de sus niños asignados y selector de niño.
- Vista del día: encabezado con nombre y fecha, navegación entre días (sin permitir días futuros), resumen del día y línea de tiempo.
- Barra fija inferior con 5 botones de captura (Comida, Siesta, Baño, Ánimo, Actividad). Cada uno abre una hoja inferior con el formulario.
- Poder editar y quitar registros del día. (En el prototipo solo se podía quitar; editar es una mejora de la v1.)

**Familia**

- Misma vista del día, solo lectura, con actualización en vivo.
- Navegación entre días anteriores.
- Si hay varios hijos, selector de niño.

**Resumen del día** (arriba de la línea de tiempo): número de comidas, total de sueño, número de pañales o baño, y último ánimo registrado.

**Administradora**

- Alta y baja de familias, niños y niñeras.
- Asignación niñera ↔ niño.
- Invitación de usuarios por correo o enlace.
- Vista de consulta de cualquier bitácora.

### 4.3 Estados vacíos y errores

- Niñera sin niños asignados: explicar que la administradora debe asignarle uno.
- Familia sin registros en el día: "Todavía no hay registros de este día."
- Errores de guardado: mensaje claro con qué pasó y qué hacer. Los mensajes de error no se disculpan ni son vagos.

## 5. Modelo de datos sugerido

```
familias         { id, nombre }
usuarios         { id, nombre, correo, rol }                        // rol: admin | niñera | familia
niños            { id, nombre, familia_id }
asignaciones     { niño_id, niñera_id, activo }                     // quién cuida a quién
miembros_familia { usuario_id, familia_id }                         // a qué familia pertenece cada usuario
dias             { id, niño_id, fecha }                             // un día por niño
registros        { id, dia_id, tipo, hora, datos(json), creado_por, creado_en }
```

Los datos de cada registro son los campos específicos de cada tipo (sección 4.1). Se pueden guardar como JSON o como columnas, según el stack.

## 6. Reglas de acceso (obligatorias en el servidor)

- Admin: lectura y escritura en todo.
- Niñera: lectura y escritura de registros solo si existe una asignación activa con ese niño.
- Familia: solo lectura de `registros`, `dias` y `niños` de su propia familia.
- Nadie puede leer datos de familias o niños ajenos, ni consultando directamente la API.

## 7. Módulos siguientes (fuera de la v1)

1. **Planeación de actividades.** La niñera o la administradora sube la planeación del niño (archivos PDF, imágenes o documentos). La familia la revisa y puede dejar comentarios. Pendiente definir periodicidad (semanal o mensual).
2. **Reportes de actividades.** Reportes periódicos del niño, subidos como archivo o generados a partir de la bitácora. Pendiente definir formato.
3. **Fotos en la bitácora.** Opcional, con atención especial a la privacidad.

## 8. Requisitos no funcionales

- Móvil primero. El uso principal es desde el teléfono de la niñera y de los papás.
- Español (México) en toda la interfaz. Tono claro, verbos simples, sin tecnicismos.
- Accesibilidad: objetivos táctiles de al menos 44 px, foco visible, contraste adecuado, respeto de `prefers-reduced-motion`.
- Modo claro y oscuro.
- Tiempo real para la familia: la bitácora se actualiza sin recargar.
- Privacidad de menores: son datos de niños y de sus familias, incluida salud (temperatura, medicamentos). Hay que contar con aviso de privacidad y consentimiento de las familias, y revisarlo con asesoría legal. Conviene minimizar los datos guardados y cifrar en tránsito y en reposo.

## 9. Dirección visual

Colores de la marca Upper Nannies (reemplazan al lila y morado del prototipo):

- Coral `#f46c60`, amarillo `#ffd230`, azul marino `#053b84`, rosa `#ffb5b3` y turquesa `#0499b4`.
- Fondo rosa muy claro, texto azul marino oscuro y acento azul marino. En modo oscuro: fondo azul marino profundo y acento amarillo.
- Un color de marca por tipo de registro: comida coral, siesta azul marino, baño turquesa, ánimo rosa, actividad amarillo. Para textos se usa una versión más oscura de cada color, con contraste legible.
- Tipografías: Bricolage Grotesque para títulos y Nunito Sans para texto.
- Línea de tiempo vertical con un punto de color por registro. Es el elemento central de la interfaz.
- Barra de captura fija abajo para la niñera.

## 10. Stack

Abierto. Se busca algo que ofrezca autenticación, base de datos con reglas de acceso por fila y almacenamiento de archivos sin que haya que operar servidores propios, y que se despliegue como sitio web. Que Claude proponga opciones y recomiende una antes de construir. La administradora tiene experiencia en desarrollo web.

## 11. Preguntas abiertas

1. ¿La niñera puede ver o editar registros de días anteriores, o solo del día actual?
2. ¿Las familias pueden dejar comentarios o reacciones en la bitácora?
3. ¿Una niñera atiende a varias familias a la vez?
4. ¿Hay notificaciones para la familia (por ejemplo, un aviso cuando termina el día)?
5. ¿Cómo se entregan las invitaciones: correo, enlace o código?
6. ¿Se necesita exportar la bitácora (PDF o resumen semanal)?

## 12. Primer paso sugerido

1. Leer este documento y el prototipo `bitacora-upper-nannies.html`.
2. Proponer stack y estructura del proyecto, y esperar aprobación.
3. Construir autenticación, roles y reglas de acceso primero, con pruebas que verifiquen que una familia no puede leer datos de otra.
4. Luego construir la bitácora (sección 4) sobre esa base.
