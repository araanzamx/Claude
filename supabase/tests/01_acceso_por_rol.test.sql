-- Pruebas de privacidad (SPEC.md §3 y §6): una familia nunca ve datos de otra
-- familia y una niñera solo ve a los niños que tiene asignados.
-- Se corren con `supabase test db` o con scripts/test-db.sh.

begin;
create extension if not exists pgtap with schema extensions;
select plan(45);

-- ---------------------------------------------------------------------------
-- Datos de prueba (como superusuario, sin RLS)
-- ---------------------------------------------------------------------------

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a0a0', 'aranza@ejemplo.mx'),
  ('00000000-0000-0000-0000-0000000000f1', 'mama.lopez@ejemplo.mx'),
  ('00000000-0000-0000-0000-0000000000f2', 'papa.ruiz@ejemplo.mx'),
  ('00000000-0000-0000-0000-0000000000f3', 'exfamilia@ejemplo.mx'),
  ('00000000-0000-0000-0000-0000000000b1', 'nana.uno@ejemplo.mx'),
  ('00000000-0000-0000-0000-0000000000b2', 'nana.dos@ejemplo.mx'),
  ('00000000-0000-0000-0000-0000000000b3', 'nana.sin.ninos@ejemplo.mx'),
  ('00000000-0000-0000-0000-0000000000b4', 'nana.inactiva@ejemplo.mx'),
  ('00000000-0000-0000-0000-0000000000c0', 'sin.perfil@ejemplo.mx');

insert into public.usuarios (id, nombre, correo, rol, activo) values
  ('00000000-0000-0000-0000-00000000a0a0', 'Aranza', 'aranza@ejemplo.mx', 'admin', true),
  ('00000000-0000-0000-0000-0000000000f1', 'Mamá López', 'mama.lopez@ejemplo.mx', 'familia', true),
  ('00000000-0000-0000-0000-0000000000f2', 'Papá Ruiz', 'papa.ruiz@ejemplo.mx', 'familia', true),
  ('00000000-0000-0000-0000-0000000000f3', 'Ex familia', 'exfamilia@ejemplo.mx', 'familia', false),
  ('00000000-0000-0000-0000-0000000000b1', 'Nana Uno', 'nana.uno@ejemplo.mx', 'ninera', true),
  ('00000000-0000-0000-0000-0000000000b2', 'Nana Dos', 'nana.dos@ejemplo.mx', 'ninera', true),
  ('00000000-0000-0000-0000-0000000000b3', 'Nana Sin Niños', 'nana.sin.ninos@ejemplo.mx', 'ninera', true),
  ('00000000-0000-0000-0000-0000000000b4', 'Nana Asignación Inactiva', 'nana.inactiva@ejemplo.mx', 'ninera', true);

insert into public.familias (id, nombre) values
  ('00000000-0000-0000-0000-0000000fa001', 'Familia López'),
  ('00000000-0000-0000-0000-0000000fa002', 'Familia Ruiz');

insert into public.ninos (id, nombre, familia_id) values
  ('00000000-0000-0000-0000-000000000a01', 'Ana', '00000000-0000-0000-0000-0000000fa001'),
  ('00000000-0000-0000-0000-000000000b01', 'Beto', '00000000-0000-0000-0000-0000000fa002');

insert into public.miembros_familia (usuario_id, familia_id) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000fa001'),
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000fa002'),
  ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000fa001');

insert into public.asignaciones (nino_id, ninera_id, activo) values
  ('00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-0000000000b1', true),
  ('00000000-0000-0000-0000-000000000b01', '00000000-0000-0000-0000-0000000000b2', true),
  ('00000000-0000-0000-0000-000000000a01', '00000000-0000-0000-0000-0000000000b4', false);

insert into public.registros (id, nino_id, fecha, tipo, hora, datos) values
  ('00000000-0000-0000-0000-0000000e0a01', '00000000-0000-0000-0000-000000000a01', public.hoy_cdmx(),
   'comida', '08:30', '{"momento": "Desayuno", "que_comio": "Avena", "cuanto": "Todo"}'),
  ('00000000-0000-0000-0000-0000000e0a02', '00000000-0000-0000-0000-000000000a01', public.hoy_cdmx() - 5,
   'animo', '10:00', '{"animo": "Feliz"}'),
  ('00000000-0000-0000-0000-0000000e0b01', '00000000-0000-0000-0000-000000000b01', public.hoy_cdmx(),
   'bano', '09:15', '{"que_paso": "Pipí"}');

-- Cuenta las filas que afecta una instrucción, con los permisos del rol actual.
create function pg_temp.filas(sentencia text) returns integer
language plpgsql as $$
declare n integer;
begin
  execute sentencia;
  get diagnostics n = row_count;
  return n;
end;
$$;
grant execute on function pg_temp.filas(text) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Anónimo: no ve nada
-- ---------------------------------------------------------------------------

set local role anon;
select throws_ok('select * from public.registros', '42501', null, 'anónimo: no puede leer registros');
select throws_ok('select * from public.ninos', '42501', null, 'anónimo: no puede leer niños');
reset role;

-- ---------------------------------------------------------------------------
-- Familia López (mamá): solo Ana, solo lectura
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000f1", "role": "authenticated"}';

select results_eq('select nombre from public.ninos', $$values ('Ana')$$, 'familia: solo ve a su hija');
select results_eq('select nombre from public.familias', $$values ('Familia López')$$, 'familia: solo ve su familia');
select is((select count(*) from public.registros)::int, 2, 'familia: ve los registros de su hija (hoy y días anteriores)');
select is((select count(*) from public.registros where nino_id = '00000000-0000-0000-0000-000000000b01')::int, 0,
  'familia: no ve registros de otra familia aunque pida el id del niño');
select is((select count(*) from public.registros where id = '00000000-0000-0000-0000-0000000e0b01')::int, 0,
  'familia: no ve un registro ajeno aunque pida su id');
select is((select count(*) from public.usuarios)::int, 1, 'familia: solo ve su propio usuario');
select is((select count(*) from public.asignaciones)::int, 0, 'familia: no ve asignaciones');
select is((select count(*) from public.miembros_familia)::int, 1, 'familia: solo ve su propia membresía');
select throws_ok(
  $$insert into public.registros (nino_id, fecha, tipo, hora, datos)
    values ('00000000-0000-0000-0000-000000000a01', public.hoy_cdmx(), 'animo', '12:00', '{"animo": "Feliz"}')$$,
  '42501', null, 'familia: no puede escribir en la bitácora');
select is(pg_temp.filas($$update public.registros set hora = '07:00' where id = '00000000-0000-0000-0000-0000000e0a01'$$), 0,
  'familia: no puede editar registros');
select is(pg_temp.filas($$delete from public.registros where id = '00000000-0000-0000-0000-0000000e0a01'$$), 0,
  'familia: no puede quitar registros');
select is(pg_temp.filas($$update public.usuarios set rol = 'admin' where id = '00000000-0000-0000-0000-0000000000f1'$$), 0,
  'familia: no puede cambiarse el rol');
select throws_ok($$insert into public.familias (nombre) values ('Intrusa')$$, '42501', null,
  'familia: no puede crear familias');
select throws_ok(
  $$insert into public.miembros_familia (usuario_id, familia_id)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000fa002')$$,
  '42501', null, 'familia: no puede unirse a otra familia');
reset role;

-- ---------------------------------------------------------------------------
-- Familia Ruiz (papá): solo Beto
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000f2", "role": "authenticated"}';
select results_eq('select nombre from public.ninos', $$values ('Beto')$$, 'otra familia: solo ve a su hijo');
select results_eq('select id from public.registros', $$values ('00000000-0000-0000-0000-0000000e0b01'::uuid)$$,
  'otra familia: solo ve los registros de su hijo');
reset role;

-- ---------------------------------------------------------------------------
-- Usuario de familia desactivado y cuenta sin perfil: no ven nada
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000f3", "role": "authenticated"}';
select is((select count(*) from public.ninos)::int, 0, 'familia desactivada: no ve niños');
select is((select count(*) from public.registros)::int, 0, 'familia desactivada: no ve registros');
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000c0", "role": "authenticated"}';
select is((select count(*) from public.ninos)::int, 0, 'cuenta sin perfil: no ve niños');
select is((select count(*) from public.registros)::int, 0, 'cuenta sin perfil: no ve registros');
reset role;

-- ---------------------------------------------------------------------------
-- Niñera de Ana
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000b1", "role": "authenticated"}';

select results_eq('select nombre from public.ninos', $$values ('Ana')$$, 'niñera: solo ve a la niña asignada');
select is((select count(*) from public.registros)::int, 2, 'niñera: ve la bitácora de su niña, incluso días anteriores');
select is((select count(*) from public.registros where nino_id = '00000000-0000-0000-0000-000000000b01')::int, 0,
  'niñera: no ve registros de niños que no tiene asignados');
select lives_ok(
  $$insert into public.registros (id, nino_id, fecha, tipo, hora, datos, creado_por)
    values ('00000000-0000-0000-0000-0000000e0a10', '00000000-0000-0000-0000-000000000a01', public.hoy_cdmx(),
            'siesta', '13:00', '{"como": "Tranquilo"}', '00000000-0000-0000-0000-0000000000b2')$$,
  'niñera: registra en la bitácora de hoy');
select is((select creado_por from public.registros where id = '00000000-0000-0000-0000-0000000e0a10'),
  '00000000-0000-0000-0000-0000000000b1'::uuid, 'niñera: el autor siempre es quien registra, no se puede suplantar');
select lives_ok(
  $$insert into public.registros (nino_id, fecha, tipo, hora, datos)
    values ('00000000-0000-0000-0000-000000000a01', public.hoy_cdmx() - 1, 'actividad', '17:00', '{"que_hicieron": "Parque"}')$$,
  'niñera: puede completar la bitácora de ayer');
select throws_ok(
  $$insert into public.registros (nino_id, fecha, tipo, hora, datos)
    values ('00000000-0000-0000-0000-000000000b01', public.hoy_cdmx(), 'animo', '12:00', '{"animo": "Feliz"}')$$,
  '42501', null, 'niñera: no puede registrar a un niño que no tiene asignado');
select throws_ok(
  $$insert into public.registros (nino_id, fecha, tipo, hora, datos)
    values ('00000000-0000-0000-0000-000000000a01', public.hoy_cdmx() + 1, 'animo', '12:00', '{"animo": "Feliz"}')$$,
  '42501', null, 'niñera: no puede registrar días futuros');
select throws_ok(
  $$insert into public.registros (nino_id, fecha, tipo, hora, datos)
    values ('00000000-0000-0000-0000-000000000a01', public.hoy_cdmx() - 5, 'animo', '12:00', '{"animo": "Feliz"}')$$,
  '42501', null, 'niñera: no puede registrar días de hace más de un día');
select is(pg_temp.filas($$update public.registros set datos = '{"como": "Tranquilo", "desperto": "14:30"}'
                         where id = '00000000-0000-0000-0000-0000000e0a10'$$), 1,
  'niñera: puede editar un registro de hoy (cerrar la siesta)');
select is(pg_temp.filas($$update public.registros set hora = '11:00' where id = '00000000-0000-0000-0000-0000000e0a02'$$), 0,
  'niñera: no puede editar registros de hace días');
select throws_ok(
  $$update public.registros set fecha = public.hoy_cdmx() - 5 where id = '00000000-0000-0000-0000-0000000e0a10'$$,
  '42501', null, 'niñera: no puede mover un registro a un día cerrado');
select is(pg_temp.filas($$delete from public.registros where id = '00000000-0000-0000-0000-0000000e0b01'$$), 0,
  'niñera: no puede quitar registros de otro niño');
select is(pg_temp.filas($$delete from public.registros where id = '00000000-0000-0000-0000-0000000e0a10'$$), 1,
  'niñera: puede quitar un registro de hoy');
select is(pg_temp.filas($$update public.usuarios set rol = 'admin' where id = '00000000-0000-0000-0000-0000000000b1'$$), 0,
  'niñera: no puede cambiarse el rol');
select throws_ok(
  $$insert into public.asignaciones (nino_id, ninera_id)
    values ('00000000-0000-0000-0000-000000000b01', '00000000-0000-0000-0000-0000000000b1')$$,
  '42501', null, 'niñera: no puede asignarse niños');
reset role;

-- ---------------------------------------------------------------------------
-- Niñera sin niños y niñera con asignación inactiva
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000b3", "role": "authenticated"}';
select is((select count(*) from public.ninos)::int, 0, 'niñera sin asignaciones: no ve niños');
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-0000000000b4", "role": "authenticated"}';
select is((select count(*) from public.registros)::int, 0, 'niñera con asignación inactiva: no ve registros');
select throws_ok(
  $$insert into public.registros (nino_id, fecha, tipo, hora, datos)
    values ('00000000-0000-0000-0000-000000000a01', public.hoy_cdmx(), 'animo', '12:00', '{"animo": "Feliz"}')$$,
  '42501', null, 'niñera con asignación inactiva: no puede registrar');
reset role;

-- ---------------------------------------------------------------------------
-- Administradora: ve y edita todo
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims to '{"sub": "00000000-0000-0000-0000-00000000a0a0", "role": "authenticated"}';
select is((select count(*) from public.ninos)::int, 2, 'admin: ve a todos los niños');
select lives_ok(
  $$insert into public.registros (nino_id, fecha, tipo, hora, datos)
    values ('00000000-0000-0000-0000-000000000b01', public.hoy_cdmx() - 30, 'animo', '12:00', '{"animo": "Cansado"}')$$,
  'admin: puede corregir días anteriores');
select throws_ok(
  $$insert into public.registros (nino_id, fecha, tipo, hora, datos)
    values ('00000000-0000-0000-0000-000000000b01', public.hoy_cdmx() + 1, 'animo', '12:00', '{"animo": "Cansado"}')$$,
  '42501', null, 'admin: tampoco registra días futuros');
select lives_ok($$insert into public.familias (nombre) values ('Familia Nueva')$$, 'admin: crea familias');
reset role;

select * from finish();
rollback;
