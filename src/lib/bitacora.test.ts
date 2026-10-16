import { describe, expect, it } from 'vitest';
import { describir, ordenar, puedeEditar, resumenDelDia } from './bitacora';
import { duracion, hora12, horasDelDia, hoyCDMX, minutosEntre, moverHora, nombreDia, redondearMediaHora, sumarDias } from './fechas';
import { armarDatos } from '../components/HojaRegistro';
import type { Registro } from './tipos';

const reg = (tipo: Registro['tipo'], hora: string, datos: Record<string, unknown>, id = hora): Registro => ({
  id,
  nino_id: 'n',
  fecha: '2026-10-16',
  tipo,
  hora,
  datos,
  creado_por: null,
});

describe('fechas', () => {
  it('muestra la hora en formato de 12 h', () => {
    expect(hora12('00:05')).toBe('12:05 am');
    expect(hora12('09:30:00')).toBe('9:30 am');
    expect(hora12('12:00')).toBe('12:00 pm');
    expect(hora12('23:59')).toBe('11:59 pm');
  });

  it('suma días cruzando meses y años', () => {
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('usa el día de Ciudad de México, no el de UTC', () => {
    // 16 oct 2026 a las 03:00 UTC son las 21:00 del 15 de oct en CDMX.
    expect(hoyCDMX(new Date('2026-10-16T03:00:00Z'))).toBe('2026-10-15');
  });

  it('calcula duraciones, incluso si cruzan la medianoche', () => {
    expect(minutosEntre('13:00', '14:35')).toBe(95);
    expect(minutosEntre('23:30', '00:15')).toBe(45);
    expect(duracion(95)).toBe('1 h 35 min');
    expect(duracion(40)).toBe('40 min');
    expect(duracion(120)).toBe('2 h');
  });

  it('nombra hoy y ayer', () => {
    expect(nombreDia('2026-10-16', '2026-10-16')).toBe('Hoy');
    expect(nombreDia('2026-10-15', '2026-10-16')).toBe('Ayer');
    expect(nombreDia('2026-10-14', '2026-10-16')).toBe('miércoles, 14 de octubre');
  });
});

describe('hora en medias horas', () => {
  it('redondea hacia abajo a :00 o :30', () => {
    expect(redondearMediaHora('14:47')).toBe('14:30');
    expect(redondearMediaHora('14:29')).toBe('14:00');
    expect(redondearMediaHora('00:00')).toBe('00:00');
  });

  it('sube y baja media hora sin salirse del día', () => {
    expect(moverHora('08:00', 30)).toBe('08:30');
    expect(moverHora('08:00', -30)).toBe('07:30');
    expect(moverHora('00:00', -30)).toBe('00:00');
    expect(moverHora('23:30', 30)).toBe('23:30');
  });

  it('acomoda una hora suelta de un registro anterior', () => {
    expect(moverHora('08:15', -30)).toBe('08:00');
    expect(moverHora('08:15', 30)).toBe('08:30');
  });

  it('ofrece 48 horas al día y conserva una hora suelta', () => {
    expect(horasDelDia()).toHaveLength(48);
    expect(horasDelDia('08:15')).toContain('08:15');
    expect(horasDelDia('08:15')).toHaveLength(49);
  });
});

describe('resumen del día', () => {
  it('cuenta comidas, baños, sueño y último ánimo', () => {
    const r = resumenDelDia([
      reg('animo', '15:00', { animo: 'Cansado' }),
      reg('comida', '08:00', { momento: 'Desayuno' }),
      reg('comida', '11:00', { momento: 'Colación' }),
      reg('bano', '09:00', { que_paso: 'Pipí' }),
      reg('siesta', '13:00', { desperto: '14:30' }),
      reg('animo', '09:00', { animo: 'Feliz' }),
    ]);
    expect(r).toEqual({ comidas: 2, banos: 1, minutosSueno: 90, durmiendoAhora: false, ultimoAnimo: 'Cansado' });
  });

  it('marca "durmiendo" si hay una siesta sin hora de despertar', () => {
    expect(resumenDelDia([reg('siesta', '13:00', {})]).durmiendoAhora).toBe(true);
  });

  it('ordena por hora', () => {
    const o = ordenar([reg('bano', '10:00', {}), reg('bano', '08:00:00', {})]);
    expect(o.map((x) => x.hora)).toEqual(['08:00:00', '10:00']);
  });
});

describe('textos de la línea de tiempo', () => {
  it('describe una siesta abierta y una cerrada', () => {
    expect(describir(reg('siesta', '13:00', {})).titulo).toBe('Durmiendo ahora');
    const cerrada = describir(reg('siesta', '13:00', { desperto: '14:30', como: 'Tranquilo' }));
    expect(cerrada.titulo).toBe('Siesta');
    expect(cerrada.detalles).toEqual(['De 1:00 pm a 2:30 pm · 1 h 30 min', 'Durmió tranquilo']);
  });

  it('incluye la temperatura en el ánimo', () => {
    expect(describir(reg('animo', '10:00', { animo: 'Inquieto', temperatura: 37.8 })).detalles).toContain('Temperatura: 37.8 °C');
  });
});

describe('quién puede editar', () => {
  const hoy = '2026-10-16';
  it('la niñera edita hoy y ayer, no antes ni días futuros', () => {
    expect(puedeEditar('ninera', hoy, hoy)).toBe(true);
    expect(puedeEditar('ninera', '2026-10-15', hoy)).toBe(true);
    expect(puedeEditar('ninera', '2026-10-14', hoy)).toBe(false);
    expect(puedeEditar('ninera', '2026-10-17', hoy)).toBe(false);
  });
  it('la familia nunca edita', () => {
    expect(puedeEditar('familia', hoy, hoy)).toBe(false);
  });
  it('la administradora edita cualquier día pasado', () => {
    expect(puedeEditar('admin', '2025-01-01', hoy)).toBe(true);
    expect(puedeEditar('admin', '2026-10-17', hoy)).toBe(false);
  });
});

describe('formularios', () => {
  it('pide los campos obligatorios', () => {
    expect(armarDatos('comida', { hora: '08:00' })).toEqual({ error: 'Elige el momento de la comida.' });
    expect(armarDatos('bano', { hora: '08:00' })).toEqual({ error: 'Elige qué pasó.' });
    expect(armarDatos('animo', { hora: '08:00' })).toEqual({ error: 'Elige cómo está de ánimo.' });
    expect(armarDatos('actividad', { hora: '08:00', que_hicieron: '  ' })).toEqual({ error: 'Escribe qué hicieron.' });
  });

  it('acepta temperatura con coma decimal y rechaza valores fuera de rango', () => {
    expect(armarDatos('animo', { hora: '08:00', animo: 'Feliz', temperatura: '37,5' })).toEqual({
      datos: { animo: 'Feliz', temperatura: 37.5, salud: null },
    });
    expect(armarDatos('animo', { hora: '08:00', animo: 'Feliz', temperatura: '375' })).toEqual({
      error: 'La temperatura debe estar entre 30 y 45 °C.',
    });
  });

  it('una siesta sin hora de despertar queda abierta', () => {
    expect(armarDatos('siesta', { hora: '13:00' })).toEqual({ datos: { desperto: null, como: null } });
  });
});
