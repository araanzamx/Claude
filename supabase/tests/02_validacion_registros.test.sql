-- Validación de los datos de cada tipo de registro (SPEC.md §4.1).

begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Válidos
select ok(public.registro_datos_validos('comida', '{"momento": "Desayuno", "que_comio": "Avena", "cuanto": "Todo"}'), 'comida completa');
select ok(public.registro_datos_validos('comida', '{"momento": "Leche o biberón"}'), 'comida solo con momento');
select ok(public.registro_datos_validos('siesta', '{}'), 'siesta en curso (durmiendo ahora)');
select ok(public.registro_datos_validos('siesta', '{"desperto": "15:20", "como": "Inquieto"}'), 'siesta terminada');
select ok(public.registro_datos_validos('bano', '{"que_paso": "Pipí y popó", "notas": "Todo normal"}'), 'baño');
select ok(public.registro_datos_validos('animo', '{"animo": "Triste o llorón", "temperatura": 37.8, "salud": "Paracetamol 5 ml"}'), 'ánimo con salud');
select ok(public.registro_datos_validos('actividad', '{"que_hicieron": "Pintura con dedos", "como_le_fue": "Le encantó"}'), 'actividad');

-- Inválidos
select ok(not public.registro_datos_validos('comida', '{}'), 'comida sin momento');
select ok(not public.registro_datos_validos('comida', '{"momento": "Brunch"}'), 'comida con momento desconocido');
select ok(not public.registro_datos_validos('comida', '{"momento": "Cena", "cuanto": "Mucho"}'), 'comida con cantidad desconocida');
select ok(not public.registro_datos_validos('siesta', '{"desperto": "25:00"}'), 'siesta con hora imposible');
select ok(not public.registro_datos_validos('bano', '{"notas": "x"}'), 'baño sin qué pasó');
select ok(not public.registro_datos_validos('animo', '{"animo": "Feliz", "temperatura": 60}'), 'temperatura fuera de rango');
select ok(not public.registro_datos_validos('animo', '{"animo": "Feliz", "temperatura": "alta"}'), 'temperatura que no es número');
select ok(not public.registro_datos_validos('actividad', '{"que_hicieron": "   "}'), 'actividad en blanco');

select throws_ok(
  $$insert into public.registros (nino_id, fecha, tipo, hora, datos)
    values (gen_random_uuid(), current_date, 'bano', '10:00', '{"que_paso": "Nada"}')$$,
  '23514', null, 'la base rechaza datos inválidos aunque se salte la app');

select * from finish();
rollback;
