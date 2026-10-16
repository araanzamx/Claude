// Lógica de la bitácora que no depende de la interfaz: resumen del día,
// orden de la línea de tiempo, textos de cada registro y quién puede editar.

import { hoyCDMX, minutosEntre, sumarDias, hora12, duracion } from './fechas';
import type { Registro, Rol } from './tipos';

export interface ResumenDia {
  comidas: number;
  minutosSueno: number;
  durmiendoAhora: boolean;
  banos: number;
  ultimoAnimo: string | null;
}

export function ordenar(registros: Registro[]): Registro[] {
  return [...registros].sort((a, b) => a.hora.localeCompare(b.hora) || a.id.localeCompare(b.id));
}

export function resumenDelDia(registros: Registro[]): ResumenDia {
  const ordenados = ordenar(registros);
  let minutosSueno = 0;
  let durmiendoAhora = false;
  let ultimoAnimo: string | null = null;

  for (const r of ordenados) {
    if (r.tipo === 'siesta') {
      const desperto = r.datos.desperto as string | null | undefined;
      if (desperto) minutosSueno += minutosEntre(r.hora, desperto);
      else durmiendoAhora = true;
    }
    if (r.tipo === 'animo') ultimoAnimo = (r.datos.animo as string) ?? null;
  }

  return {
    comidas: ordenados.filter((r) => r.tipo === 'comida').length,
    minutosSueno,
    durmiendoAhora,
    banos: ordenados.filter((r) => r.tipo === 'bano').length,
    ultimoAnimo,
  };
}

export function siestaAbierta(r: Registro): boolean {
  return r.tipo === 'siesta' && !r.datos.desperto;
}

/** Título y renglones de detalle de un registro para la línea de tiempo. */
export function describir(r: Registro): { titulo: string; detalles: string[] } {
  const d = r.datos as Record<string, string | number | null | undefined>;
  const detalles: string[] = [];
  const agregar = (v: unknown) => {
    if (v !== null && v !== undefined && String(v).trim() !== '') detalles.push(String(v));
  };

  switch (r.tipo) {
    case 'comida':
      agregar(d.que_comio);
      if (d.cuanto) agregar(`Comió: ${String(d.cuanto).toLowerCase()}`);
      return { titulo: String(d.momento ?? 'Comida'), detalles };
    case 'siesta': {
      if (d.desperto) {
        agregar(`De ${hora12(r.hora)} a ${hora12(String(d.desperto))} · ${duracion(minutosEntre(r.hora, String(d.desperto)))}`);
      }
      if (d.como) agregar(`Durmió ${String(d.como).toLowerCase()}`);
      return { titulo: d.desperto ? 'Siesta' : 'Durmiendo ahora', detalles };
    }
    case 'bano':
      agregar(d.notas);
      return { titulo: String(d.que_paso ?? 'Pañal o baño'), detalles };
    case 'animo':
      if (d.temperatura !== null && d.temperatura !== undefined) agregar(`Temperatura: ${d.temperatura} °C`);
      agregar(d.salud);
      return { titulo: String(d.animo ?? 'Ánimo'), detalles };
    case 'actividad':
      agregar(d.como_le_fue);
      return { titulo: String(d.que_hicieron ?? 'Actividad'), detalles };
  }
}

/**
 * ¿Puede este rol editar la bitácora de esa fecha? Es solo para mostrar u ocultar
 * botones: la regla que manda está en la base (puede_escribir_bitacora).
 */
export function puedeEditar(rol: Rol, fecha: string, hoy: string = hoyCDMX()): boolean {
  if (fecha > hoy) return false;
  if (rol === 'admin') return true;
  if (rol === 'ninera') return fecha >= sumarDias(hoy, -1);
  return false;
}
