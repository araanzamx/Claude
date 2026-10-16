// Hoja inferior con el formulario de cada tipo de registro (SPEC.md §4.1 y §4.2).

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { horaActualCDMX, horaCorta, redondearMediaHora } from '../lib/fechas';
import { mensajeError } from '../lib/errores';
import {
  ANIMOS,
  COMO_DURMIO,
  CUANTO_COMIO,
  MOMENTOS_COMIDA,
  QUE_PASO_BANO,
  infoTipo,
  type Registro,
  type TipoRegistro,
} from '../lib/tipos';
import { Aviso, Campo, Opciones, SelectorHora } from './comunes';

type Valores = Record<string, string>;

function valoresIniciales(tipo: TipoRegistro, registro?: Registro): Valores {
  // El ánimo no pide hora: se guarda la hora exacta del registro, solo para ordenarlo.
  if (!registro) return { hora: tipo === 'animo' ? horaActualCDMX() : redondearMediaHora(horaActualCDMX()) };
  const v: Valores = { hora: horaCorta(registro.hora) };
  for (const [k, val] of Object.entries(registro.datos)) {
    if (val !== null && val !== undefined) v[k] = String(val);
  }
  return v;
}

/** Arma el objeto `datos` y revisa los campos obligatorios. Regresa el error si falta algo. */
export function armarDatos(tipo: TipoRegistro, v: Valores): { datos: Record<string, unknown> } | { error: string } {
  const texto = (k: string) => (v[k]?.trim() ? v[k].trim() : null);
  if (!v.hora) return { error: 'Escribe la hora.' };

  switch (tipo) {
    case 'comida':
      if (!v.momento) return { error: 'Elige el momento de la comida.' };
      return { datos: { momento: v.momento, que_comio: texto('que_comio'), cuanto: v.cuanto || null } };
    case 'siesta':
      return { datos: { desperto: v.desperto || null, como: v.como || null } };
    case 'bano':
      if (!v.que_paso) return { error: 'Elige qué pasó.' };
      return { datos: { que_paso: v.que_paso, notas: texto('notas') } };
    case 'animo': {
      if (!v.animo) return { error: 'Elige cómo está de ánimo.' };
      let temperatura: number | null = null;
      if (v.temperatura?.trim()) {
        temperatura = Number(v.temperatura.replace(',', '.'));
        if (Number.isNaN(temperatura) || temperatura < 30 || temperatura > 45) {
          return { error: 'La temperatura debe estar entre 30 y 45 °C.' };
        }
      }
      return { datos: { animo: v.animo, temperatura, salud: texto('salud') } };
    }
    case 'actividad':
      if (!texto('que_hicieron')) return { error: 'Escribe qué hicieron.' };
      return { datos: { que_hicieron: texto('que_hicieron'), como_le_fue: texto('como_le_fue') } };
  }
}

export function HojaRegistro({
  tipo,
  registro,
  onGuardar,
  onCerrar,
}: {
  tipo: TipoRegistro;
  registro?: Registro;
  onGuardar: (hora: string, datos: Record<string, unknown>) => Promise<void>;
  onCerrar: () => void;
}) {
  const info = infoTipo(tipo);
  const [v, setV] = useState<Valores>(() => valoresIniciales(tipo, registro));
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const hoja = useRef<HTMLDivElement>(null);
  const cambiar = (k: string) => (valor: string | null) => setV((prev) => ({ ...prev, [k]: valor ?? '' }));

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    hoja.current?.querySelector<HTMLElement>('input, textarea, button')?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', alTeclear);
    document.body.classList.add('sin-scroll');
    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.body.classList.remove('sin-scroll');
      anterior?.focus();
    };
  }, [onCerrar]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const r = armarDatos(tipo, v);
    if ('error' in r) {
      setError(r.error);
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await onGuardar(v.hora, r.datos);
      onCerrar();
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setGuardando(false);
    }
  }

  const titulo = `${registro ? 'Editar' : 'Registrar'} ${info.nombre.toLowerCase()}`;

  // Portal al body para que la hoja quede por encima de toda la página.
  return createPortal(
    <div className="fondo-hoja" onClick={onCerrar}>
      <div
        ref={hoja}
        className={`hoja tipo-${tipo}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-hoja"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hoja-asa" aria-hidden="true" />
        <form onSubmit={enviar} noValidate>
          <header className="hoja-encabezado">
            <h2 id="titulo-hoja">
              <span aria-hidden="true">{info.icono}</span> {titulo}
            </h2>
            <button type="button" className="boton-texto" onClick={onCerrar}>
              Cancelar
            </button>
          </header>

          {tipo === 'comida' && (
            <>
              <Opciones nombre="momento" leyenda="Momento" opciones={MOMENTOS_COMIDA} valor={v.momento} onCambio={cambiar('momento')} obligatorio />
              <Campo etiqueta="¿Qué comió?" opcional>
                <input type="text" value={v.que_comio ?? ''} onChange={(e) => cambiar('que_comio')(e.target.value)} autoComplete="off" />
              </Campo>
              <Opciones nombre="cuanto" leyenda="¿Cuánto comió?" opciones={CUANTO_COMIO} valor={v.cuanto} onCambio={cambiar('cuanto')} permitirVacio />
              <SelectorHora etiqueta="Hora" valor={v.hora} onCambio={cambiar('hora')} />
            </>
          )}

          {tipo === 'siesta' && (
            <>
              <SelectorHora etiqueta="Se durmió a las" valor={v.hora} onCambio={cambiar('hora')} />
              <SelectorHora
                etiqueta="Despertó a las"
                valor={v.desperto ?? ''}
                onCambio={cambiar('desperto')}
                textoVacio="Sigue dormido"
              />
              <p className="ayuda">Si sigue dormido, déjalo así. Podrás cerrarla con "Ya despertó".</p>
              <Opciones nombre="como" leyenda="¿Cómo durmió?" opciones={COMO_DURMIO} valor={v.como} onCambio={cambiar('como')} permitirVacio />
            </>
          )}

          {tipo === 'bano' && (
            <>
              <Opciones nombre="que_paso" leyenda="¿Qué pasó?" opciones={QUE_PASO_BANO} valor={v.que_paso} onCambio={cambiar('que_paso')} obligatorio />
              <Campo etiqueta="Notas" opcional>
                <textarea rows={2} value={v.notas ?? ''} onChange={(e) => cambiar('notas')(e.target.value)} />
              </Campo>
              <SelectorHora etiqueta="Hora" valor={v.hora} onCambio={cambiar('hora')} />
            </>
          )}

          {tipo === 'animo' && (
            <>
              <Opciones nombre="animo" leyenda="Ánimo" opciones={ANIMOS} valor={v.animo} onCambio={cambiar('animo')} obligatorio />
              <Campo etiqueta="Temperatura en °C" opcional>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="36.5"
                  value={v.temperatura ?? ''}
                  onChange={(e) => cambiar('temperatura')(e.target.value)}
                />
              </Campo>
              <Campo etiqueta="Salud y medicamentos" opcional>
                <textarea rows={2} value={v.salud ?? ''} onChange={(e) => cambiar('salud')(e.target.value)} />
              </Campo>
            </>
          )}

          {tipo === 'actividad' && (
            <>
              <Campo etiqueta="¿Qué hicieron?">
                <input type="text" value={v.que_hicieron ?? ''} onChange={(e) => cambiar('que_hicieron')(e.target.value)} required autoComplete="off" />
              </Campo>
              <Campo etiqueta="¿Cómo le fue?" opcional>
                <textarea rows={2} value={v.como_le_fue ?? ''} onChange={(e) => cambiar('como_le_fue')(e.target.value)} />
              </Campo>
              <SelectorHora etiqueta="Hora" valor={v.hora} onCambio={cambiar('hora')} />
            </>
          )}

          <Aviso texto={error} />

          <button type="submit" className="boton-principal ancho" disabled={guardando}>
            {guardando ? 'Guardando…' : registro ? 'Guardar cambios' : 'Guardar'}
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}
