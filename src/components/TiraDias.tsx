// Tira con los 7 días de la semana y un punto en los días que tienen registros.
// Las flechas cambian de semana y "Otra fecha" abre el calendario.

import { useEffect, useState } from 'react';
import { api } from '../lib/cliente';
import { diaCorto, semanaHasta, sumarDias } from '../lib/fechas';

export function TiraDias({
  ninoId,
  fecha,
  hoy,
  onFecha,
  version,
}: {
  ninoId: string;
  fecha: string;
  hoy: string;
  onFecha: (f: string) => void;
  /** Cambia cuando cambian los registros, para volver a pintar los puntos. */
  version: unknown;
}) {
  // La semana visible termina en `fin`; se mueve sola si la fecha elegida queda fuera.
  const [fin, setFin] = useState(fecha);
  const dias = semanaHasta(fin);
  const [conRegistros, setConRegistros] = useState<Set<string>>(new Set());

  const inicio = dias[0];
  // Solo cuando cambia la fecha elegida (por ejemplo, desde el calendario): si queda
  // fuera de la semana visible, centra la semana en ella. Las flechas mueven la
  // semana libremente sin cambiar el día elegido.
  const [fechaAnterior, setFechaAnterior] = useState(fecha);
  if (fecha !== fechaAnterior) {
    setFechaAnterior(fecha);
    if (fecha > fin || fecha < inicio) {
      const nuevoFin = sumarDias(fecha, 3);
      setFin(nuevoFin > hoy ? hoy : nuevoFin);
    }
  }

  useEffect(() => {
    let vigente = true;
    api
      .fechasConRegistros(ninoId, inicio, fin)
      .then((f) => vigente && setConRegistros(new Set(f)))
      .catch(() => vigente && setConRegistros(new Set()));
    return () => {
      vigente = false;
    };
  }, [ninoId, inicio, fin, version]);

  return (
    <nav className="tira-dias" aria-label="Elegir día">
      <div className="tira-fila">
        <button type="button" className="boton-icono" onClick={() => setFin(sumarDias(fin, -7))} aria-label="Semana anterior">
          ‹
        </button>
        <ol className="dias">
          {dias.map((d) => {
            const { dia, numero } = diaCorto(d);
            const futuro = d > hoy;
            return (
              <li key={d}>
                <button
                  type="button"
                  className={`dia-boton${d === hoy ? ' es-hoy' : ''}`}
                  aria-pressed={d === fecha}
                  aria-label={`${d === hoy ? 'Hoy, ' : ''}${dia} ${numero}${conRegistros.has(d) ? ', con registros' : ''}`}
                  disabled={futuro}
                  onClick={() => onFecha(d)}
                >
                  <span className="dia-nombre">{d === hoy ? 'hoy' : dia}</span>
                  <span className="dia-numero">{numero}</span>
                  <span className={`dia-punto${conRegistros.has(d) ? ' visible' : ''}`} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          className="boton-icono"
          onClick={() => setFin(sumarDias(fin, 7) > hoy ? hoy : sumarDias(fin, 7))}
          disabled={fin >= hoy}
          aria-label="Semana siguiente"
        >
          ›
        </button>
      </div>
      <div className="tira-acciones">
        {fecha !== hoy && (
          <button type="button" className="boton-chico" onClick={() => onFecha(hoy)}>
            Volver a hoy
          </button>
        )}
        <label className="boton-chico otra-fecha">
          <span aria-hidden="true">📅</span> Otra fecha
          <input
            type="date"
            max={hoy}
            value={fecha}
            onChange={(e) => e.target.value && e.target.value <= hoy && onFecha(e.target.value)}
            aria-label="Elegir otra fecha en el calendario"
          />
        </label>
      </div>
    </nav>
  );
}
