-- Esquema inicial de Upper Nannies: roles, familias, niños, asignaciones y bitácora.
-- Las reglas de privacidad (SPEC.md §3 y §6) se cumplen aquí con Row Level Security.
-- Los nombres de tablas y columnas van sin ñ ni acentos para no depender de comillas.

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------

create type public.rol_usuario as enum ('admin', 'ninera', 'familia');
create type public.tipo_registro as enum ('comida', 'siesta', 'bano', 'animo', 'actividad');

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.familias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) > 0),
  creado_en timestamptz not null default now()
);

-- Un renglón por persona con acceso. Solo la administradora (o el servicio de
-- invitaciones) crea renglones aquí; una cuenta de auth sin renglón no ve nada.
create table public.usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null check (length(trim(nombre)) > 0),
  correo text not null,
  rol public.rol_usuario not null,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

create table public.ninos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) > 0),
  familia_id uuid not null references public.familias (id) on delete cascade,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
create index ninos_familia_idx on public.ninos (familia_id);

create table public.miembros_familia (
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  familia_id uuid not null references public.familias (id) on delete cascade,
  primary key (usuario_id, familia_id)
);
create index miembros_familia_familia_idx on public.miembros_familia (familia_id);

create table public.asignaciones (
  nino_id uuid not null references public.ninos (id) on delete cascade,
  ninera_id uuid not null references public.usuarios (id) on delete cascade,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  primary key (nino_id, ninera_id)
);
create index asignaciones_ninera_idx on public.asignaciones (ninera_id);

-- La bitácora. Cada registro pertenece a un niño y a un día (fecha). SPEC.md §5
-- sugiere una tabla `dias`; aquí la fecha vive en el registro para que las reglas
-- de acceso y la actualización en vivo filtren por niño sin un join adicional.
create table public.registros (
  id uuid primary key default gen_random_uuid(),
  nino_id uuid not null references public.ninos (id) on delete cascade,
  fecha date not null,
  tipo public.tipo_registro not null,
  hora time not null,
  datos jsonb not null default '{}'::jsonb,
  creado_por uuid references public.usuarios (id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index registros_nino_fecha_idx on public.registros (nino_id, fecha, hora);

-- ---------------------------------------------------------------------------
-- Validación de los datos de cada tipo de registro (SPEC.md §4.1)
-- ---------------------------------------------------------------------------

create or replace function public.texto_opcional_valido(valor jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select valor is null or jsonb_typeof(valor) = 'null' or jsonb_typeof(valor) = 'string'
$$;

create or replace function public.hora_opcional_valida(valor jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select valor is null
    or jsonb_typeof(valor) = 'null'
    or (jsonb_typeof(valor) = 'string' and (valor #>> '{}') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
$$;

-- Ojo: un CHECK que da NULL se considera válido, por eso todo termina en coalesce(…, false).
create or replace function public.registro_datos_validos(tipo public.tipo_registro, datos jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(datos) <> 'object' then
    return false;
  end if;

  case tipo
    when 'comida' then
      return coalesce(
        (datos ->> 'momento') in ('Desayuno', 'Colación', 'Comida', 'Merienda', 'Cena', 'Leche o biberón')
        and public.texto_opcional_valido(datos -> 'que_comio')
        and (datos -> 'cuanto' is null or jsonb_typeof(datos -> 'cuanto') = 'null'
             or (datos ->> 'cuanto') in ('Todo', 'Casi todo', 'Poco', 'Nada')),
        false);
    when 'siesta' then
      return coalesce(
        public.hora_opcional_valida(datos -> 'desperto')
        and (datos -> 'como' is null or jsonb_typeof(datos -> 'como') = 'null'
             or (datos ->> 'como') in ('Tranquilo', 'Inquieto')),
        false);
    when 'bano' then
      return coalesce(
        (datos ->> 'que_paso') in ('Pipí', 'Popó', 'Pipí y popó', 'Seco', 'Fue al baño')
        and public.texto_opcional_valido(datos -> 'notas'),
        false);
    when 'animo' then
      return coalesce(
        (datos ->> 'animo') in ('Feliz', 'Tranquilo', 'Inquieto', 'Triste o llorón', 'Cansado')
        and (datos -> 'temperatura' is null or jsonb_typeof(datos -> 'temperatura') = 'null'
             or (jsonb_typeof(datos -> 'temperatura') = 'number'
                 and (datos ->> 'temperatura')::numeric between 30 and 45))
        and public.texto_opcional_valido(datos -> 'salud'),
        false);
    when 'actividad' then
      return coalesce(
        length(trim(coalesce(datos ->> 'que_hicieron', ''))) > 0
        and public.texto_opcional_valido(datos -> 'como_le_fue'),
        false);
  end case;
  return false;
end;
$$;

alter table public.registros
  add constraint registros_datos_validos check (public.registro_datos_validos(tipo, datos));

-- ---------------------------------------------------------------------------
-- Funciones de acceso. SECURITY DEFINER para que las políticas no se llamen
-- a sí mismas en recursión; solo responden sobre el usuario actual.
-- ---------------------------------------------------------------------------

create or replace function public.hoy_cdmx()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Mexico_City')::date
$$;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.usuarios
    where id = auth.uid() and rol = 'admin' and activo
  )
$$;

-- Un niño dado de baja deja de aparecerle a la niñera; su familia conserva el historial.
create or replace function public.cuida_a(p_nino_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.asignaciones a
    join public.usuarios u on u.id = a.ninera_id
    join public.ninos n on n.id = a.nino_id
    where a.nino_id = p_nino_id
      and a.ninera_id = auth.uid()
      and a.activo
      and u.activo
      and u.rol = 'ninera'
      and n.activo
  )
$$;

create or replace function public.es_familia_de(p_nino_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.ninos n
    join public.miembros_familia m on m.familia_id = n.familia_id
    join public.usuarios u on u.id = m.usuario_id
    where n.id = p_nino_id
      and m.usuario_id = auth.uid()
      and u.activo
      and u.rol = 'familia'
  )
$$;

create or replace function public.puede_ver_nino(p_nino_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.es_admin() or public.cuida_a(p_nino_id) or public.es_familia_de(p_nino_id)
$$;

-- La niñera edita el día de hoy y el de ayer (por si cierra una siesta o captura
-- algo pendiente al día siguiente). Días más antiguos son solo lectura para ella.
create or replace function public.puede_escribir_bitacora(p_nino_id uuid, p_fecha date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_fecha <= public.hoy_cdmx()
    and (
      public.es_admin()
      or (public.cuida_a(p_nino_id) and p_fecha >= public.hoy_cdmx() - 1)
    )
$$;

-- ---------------------------------------------------------------------------
-- Disparadores de registros
-- ---------------------------------------------------------------------------

create or replace function public.registros_antes_de_guardar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- El autor siempre es quien hace la llamada; no se puede suplantar.
    if auth.uid() is not null then
      new.creado_por := auth.uid();
    end if;
    new.creado_en := now();
  else
    new.creado_por := old.creado_por;
    new.creado_en := old.creado_en;
    -- Un registro no cambia de niño.
    if new.nino_id <> old.nino_id then
      raise exception 'Un registro no se puede mover a otro niño.' using errcode = '42501';
    end if;
  end if;
  new.actualizado_en := now();
  return new;
end;
$$;

create trigger registros_antes_de_guardar
  before insert or update on public.registros
  for each row execute function public.registros_antes_de_guardar();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.familias enable row level security;
alter table public.usuarios enable row level security;
alter table public.ninos enable row level security;
alter table public.miembros_familia enable row level security;
alter table public.asignaciones enable row level security;
alter table public.registros enable row level security;

-- familias
create policy familias_admin on public.familias
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy familias_lectura on public.familias
  for select to authenticated
  using (
    exists (
      select 1 from public.ninos n
      where n.familia_id = familias.id and (public.es_familia_de(n.id) or public.cuida_a(n.id))
    )
  );

-- usuarios: cada quien se ve a sí mismo; la administradora ve y edita a todos.
create policy usuarios_admin on public.usuarios
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy usuarios_propio on public.usuarios
  for select to authenticated
  using (id = auth.uid());

-- ninos
create policy ninos_admin on public.ninos
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy ninos_lectura on public.ninos
  for select to authenticated
  using (public.cuida_a(id) or public.es_familia_de(id));

-- miembros_familia
create policy miembros_admin on public.miembros_familia
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy miembros_propio on public.miembros_familia
  for select to authenticated
  using (usuario_id = auth.uid());

-- asignaciones
create policy asignaciones_admin on public.asignaciones
  for all to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy asignaciones_propias on public.asignaciones
  for select to authenticated
  using (ninera_id = auth.uid());

-- registros
create policy registros_lectura on public.registros
  for select to authenticated
  using (public.puede_ver_nino(nino_id));
create policy registros_alta on public.registros
  for insert to authenticated
  with check (public.puede_escribir_bitacora(nino_id, fecha));
create policy registros_cambio on public.registros
  for update to authenticated
  using (public.puede_escribir_bitacora(nino_id, fecha))
  with check (public.puede_escribir_bitacora(nino_id, fecha));
create policy registros_baja on public.registros
  for delete to authenticated
  using (public.puede_escribir_bitacora(nino_id, fecha));

-- Nadie anónimo toca nada.
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Tiempo real: la familia recibe cambios de la bitácora sin recargar.
-- Supabase Realtime respeta las políticas de lectura de arriba.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.registros;
  end if;
end;
$$;
