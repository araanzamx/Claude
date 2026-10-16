# Upper Nannies · Bitácora diaria

Plataforma web, móvil primero, para que las niñeras registren el día de cada niño y las familias lo consulten en vivo. La especificación completa está en [`SPEC.md`](SPEC.md).

**Stack:** React + Vite + TypeScript (la app), Supabase (inicio de sesión, base de datos Postgres con reglas de acceso por fila, tiempo real) y Netlify (publicación).

## Probarla ya (modo demostración)

Sin configurar nada, la app abre en modo demostración: los datos son de ejemplo y se guardan solo en tu navegador.

```bash
npm install
npm run dev
```

Abre http://localhost:5173 y entra como niñera, familia o administradora. Si abres dos pestañas (una como niñera y otra como familia), lo que registra la niñera aparece en vivo en la de la familia.

## Conectarla a Supabase (producción)

1. **Crea el proyecto** en [supabase.com](https://supabase.com). Para estar cerca de CDMX, elige una región de EE. UU.
2. **Crea las tablas y las reglas de acceso.** Con la [CLI de Supabase](https://supabase.com/docs/guides/cli):
   ```bash
   npx supabase login
   npx supabase link --project-ref TU_PROJECT_REF
   npx supabase db push
   npx supabase functions deploy invitar
   ```
   Otra opción es pegar el archivo de `supabase/migrations/` en el SQL Editor del panel.
3. **Configura el inicio de sesión** (Authentication → Sign In / Providers):
   - Desactiva "Allow new users to sign up". Solo entran personas invitadas.
   - En URL Configuration, pon la dirección de tu sitio de Netlify como Site URL.
4. **Date de alta como administradora.** Invítate desde Authentication → Users → Invite user. Después corre `scripts/crear-admin.sql` en el SQL Editor, con tu correo.
5. **Variables de la app.** Copia `.env.example` como `.env.local` y llena `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (Project Settings → API). Pon las mismas en Netlify (Site configuration → Environment variables).
6. **Publica en Netlify.** Conecta este repositorio. `netlify.toml` ya trae el comando de build.

Con eso, desde la app (pestaña Personas) puedes invitar a niñeras y familias por correo, o copiar un enlace para mandarlo por WhatsApp.

## Privacidad: dónde se cumple

Las reglas viven en la base de datos (Row Level Security), no en la interfaz. Aunque alguien llame a la API directamente, solo recibe lo que le corresponde:

| Rol | Ve | Escribe |
| --- | --- | --- |
| Administradora | Todo | Todo (menos días futuros) |
| Niñera | Solo los niños que tiene asignados y activos | La bitácora de esos niños, hoy y ayer |
| Familia | Solo los niños de su familia (incluido el historial) | Nada |
| Cuenta sin invitación, desactivada o anónima | Nada | Nada |

Además, la base rechaza datos incompletos o fuera de rango (por ejemplo, una comida sin momento o una temperatura de 60 °C), y el autor de cada registro siempre es quien lo crea; no se puede suplantar.

## Pruebas

```bash
npm test            # lógica de la app (resumen del día, horas, formularios, permisos)
npm run test:db     # reglas de acceso, contra un Postgres local con pgTAP
npx supabase test db  # las mismas pruebas de acceso, con Supabase local en Docker
```

Las pruebas de acceso (`supabase/tests/`) verifican, entre otras cosas, que una familia no puede leer los registros de otra ni pidiendo el id directamente, y que una niñera no ve ni escribe a niños que no tiene asignados. GitHub Actions corre todo en cada push.

## Estructura

```
supabase/
  migrations/        tablas, validaciones y reglas de acceso (RLS)
  tests/             pruebas pgTAP de privacidad y validación
  functions/invitar/ invitaciones (solo la administradora)
src/
  lib/               tipos, fechas (hora de CDMX, formato 12 h), resumen del día, acceso a datos
  components/        acceso, bitácora (día, línea de tiempo, hojas de captura), administración
scripts/             pruebas de BD sin Docker y alta de la primera administradora
```

## Decisiones tomadas para la v1

Son respuestas provisionales a las preguntas abiertas de `SPEC.md` §11. Se pueden cambiar.

1. **Días anteriores:** la niñera edita hoy y ayer, y solo consulta los días más antiguos. La administradora puede corregir cualquier día pasado.
2. **Comentarios de familias:** no hay en la v1.
3. **Una niñera con varias familias:** sí, con un selector de niño.
4. **Notificaciones:** no hay en la v1.
5. **Invitaciones:** por correo o con un enlace para copiar.
6. **Exportar:** no hay en la v1.

Otros cambios respecto al modelo sugerido en la especificación:

- **Sin tabla `dias`:** cada registro guarda su fecha. Así las reglas y la actualización en vivo filtran por niño sin pasos extra.
- **Nombres sin ñ en la base** (`ninos`, `ninera_id`). La interfaz sí usa ñ y acentos.
- **"Baja" de un niño:** lo desactiva sin borrar su historial. La niñera deja de verlo y la familia conserva la consulta.

## Pendiente antes de usarla con familias reales

- Aviso de privacidad y consentimiento de las familias, revisados con asesoría legal (son datos de menores, incluida salud).
- Personalizar en Supabase el correo de invitación y el de acceso, en español.
