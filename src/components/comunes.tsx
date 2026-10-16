import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Mensaje de error visible y anunciado por lectores de pantalla. */
export function Aviso({ texto, onCerrar }: { texto: string | null; onCerrar?: () => void }) {
  if (!texto) return null;
  return (
    <div className="aviso" role="alert">
      <span>{texto}</span>
      {onCerrar && (
        <button type="button" className="boton-texto" onClick={onCerrar} aria-label="Cerrar aviso">
          ✕
        </button>
      )}
    </div>
  );
}

/**
 * Botón que pide un segundo toque para confirmar (SPEC.md §4.1: "Quitar un
 * registro pide confirmación con un segundo toque").
 */
export function BotonConfirmar({
  texto,
  confirmar,
  onConfirmar,
  className = 'boton-chico peligro',
  etiqueta,
}: {
  texto: string;
  confirmar: string;
  onConfirmar: () => void;
  className?: string;
  etiqueta?: string;
}) {
  const [armado, setArmado] = useState(false);
  const temporizador = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(temporizador.current), []);

  return (
    <button
      type="button"
      className={`${className}${armado ? ' armado' : ''}`}
      aria-label={armado ? confirmar : etiqueta}
      onClick={() => {
        if (armado) {
          window.clearTimeout(temporizador.current);
          setArmado(false);
          onConfirmar();
        } else {
          setArmado(true);
          temporizador.current = window.setTimeout(() => setArmado(false), 4000);
        }
      }}
    >
      {armado ? confirmar : texto}
    </button>
  );
}

/** Grupo de opciones tipo "chip" hecho con radios reales (accesible con teclado). */
export function Opciones({
  nombre,
  leyenda,
  opciones,
  valor,
  onCambio,
  obligatorio = false,
  permitirVacio = false,
}: {
  nombre: string;
  leyenda: string;
  opciones: string[];
  valor: string | null | undefined;
  onCambio: (v: string | null) => void;
  obligatorio?: boolean;
  permitirVacio?: boolean;
}) {
  return (
    <fieldset className="campo">
      <legend>
        {leyenda}
        {!obligatorio && <span className="opcional"> (opcional)</span>}
      </legend>
      <div className="chips">
        {opciones.map((op) => (
          <label key={op} className="chip">
            <input
              type="radio"
              name={nombre}
              value={op}
              checked={valor === op}
              onChange={() => onCambio(op)}
              onClick={() => {
                if (permitirVacio && valor === op) onCambio(null);
              }}
            />
            <span>{op}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Campo({
  etiqueta,
  opcional,
  children,
  ayuda,
}: {
  etiqueta: string;
  opcional?: boolean;
  children: ReactNode;
  ayuda?: string;
}) {
  return (
    <label className="campo">
      <span className="etiqueta">
        {etiqueta}
        {opcional && <span className="opcional"> (opcional)</span>}
      </span>
      {children}
      {ayuda && <span className="ayuda">{ayuda}</span>}
    </label>
  );
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <p className="cargando" role="status">
      {texto}
    </p>
  );
}
