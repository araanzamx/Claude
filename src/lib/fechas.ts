// Fechas y horas. El "día" de la bitácora es el de Ciudad de México,
// igual que hoy_cdmx() en la base de datos.

const ZONA = 'America/Mexico_City';

/** Fecha de hoy en CDMX como "AAAA-MM-DD". */
export function hoyCDMX(ahora: Date = new Date()): string {
  // en-CA da el formato AAAA-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}

/** Hora actual en CDMX como "HH:MM". */
export function horaActualCDMX(ahora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONA,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(ahora);
  const h = partes.find((p) => p.type === 'hour')!.value;
  const m = partes.find((p) => p.type === 'minute')!.value;
  return `${h}:${m}`;
}

/** Suma (o resta) días a una fecha "AAAA-MM-DD". */
export function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split('-').map(Number);
  const f = new Date(Date.UTC(a, m - 1, d + dias));
  return f.toISOString().slice(0, 10);
}

/** "14:05" o "14:05:00" → "2:05 pm". */
export function hora12(hora: string): string {
  const [hh, mm] = hora.split(':').map(Number);
  const sufijo = hh < 12 ? 'am' : 'pm';
  const h = hh % 12 === 0 ? 12 : hh % 12;
  return `${h}:${String(mm).padStart(2, '0')} ${sufijo}`;
}

/** "HH:MM:SS" → "HH:MM" (lo que espera <input type="time">). */
export function horaCorta(hora: string): string {
  return hora.slice(0, 5);
}

/** Minutos desde la medianoche. */
export function aMinutos(hora: string): number {
  const [hh, mm] = hora.split(':').map(Number);
  return hh * 60 + mm;
}

/** Duración entre dos horas, considerando que puede cruzar la medianoche. */
export function minutosEntre(inicio: string, fin: string): number {
  const d = aMinutos(fin) - aMinutos(inicio);
  return d >= 0 ? d : d + 24 * 60;
}

/** 95 → "1 h 35 min"; 40 → "40 min". */
export function duracion(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/** "2026-10-16" → "viernes 16 de octubre". */
export function fechaLarga(fecha: string): string {
  const [a, m, d] = fecha.split('-').map(Number);
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(a, m - 1, d)));
}

/** "Hoy", "Ayer" o la fecha larga. */
export function nombreDia(fecha: string, hoy: string = hoyCDMX()): string {
  if (fecha === hoy) return 'Hoy';
  if (fecha === sumarDias(hoy, -1)) return 'Ayer';
  return fechaLarga(fecha);
}

// La hora se captura en medias horas (:00 y :30) para que sea rápido en el teléfono.
export const PASO_MINUTOS = 30;

/** "14:47" → "14:30". Redondea hacia abajo a la media hora. */
export function redondearMediaHora(hora: string): string {
  const m = aMinutos(hora);
  return deMinutos(m - (m % PASO_MINUTOS));
}

/** Minutos desde la medianoche → "HH:MM". */
export function deMinutos(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;
}

/**
 * Sube o baja media hora sin salirse del día (de 12:00 am a 11:30 pm). Una hora
 * suelta de un registro anterior (8:15) se acomoda a la media hora: 8:00 o 8:30.
 */
export function moverHora(hora: string, minutos: number): string {
  const m = aMinutos(hora);
  const piso = m - (m % PASO_MINUTOS);
  const destino = minutos < 0 && m !== piso ? piso : piso + minutos;
  return deMinutos(Math.min(24 * 60 - PASO_MINUTOS, Math.max(0, destino)));
}

/** Todas las medias horas del día, más `extra` si es una hora suelta (de un registro anterior). */
export function horasDelDia(extra?: string | null): string[] {
  const horas = Array.from({ length: (24 * 60) / PASO_MINUTOS }, (_, i) => deMinutos(i * PASO_MINUTOS));
  if (extra && !horas.includes(extra)) horas.push(extra);
  return horas.sort();
}
