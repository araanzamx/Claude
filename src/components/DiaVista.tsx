// Vista del día: encabezado, navegación entre días, resumen y línea de tiempo.
// La niñera (y la administradora) ven además la barra de captura.

import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/cliente';
import { describir, ordenar, puedeEditar, resumenDelDia, siestaAbierta } from '../lib/bitacora';
import { duracion, hora12, horaActualCDMX, hoyCDMX, nombreDia, sumarDias, fechaLarga, redondearMediaHora, horaCorta } from '../lib/fechas';
import { mensajeError } from '../lib/errores';
import { TIPOS, infoTipo, type Nino, type Registro, type Rol, type TipoRegistro } from '../lib/tipos';
import { Aviso, BotonConfirmar, Cargando } from './comunes';
import { HojaRegistro } from './HojaRegistro';
import { TiraDias } from './TiraDias';

export function DiaVista({ nino, rol }: { nino: Nino; rol: Rol }) {
  const hoy = hoyCDMX();
  const [fecha, setFecha] = useState(hoy);
  const [registros, setRegistros] = useState<Registro[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoja, setHoja] = useState<{ tipo: TipoRegistro; registro?: Registro } | null>(null);

  const cerrar = useCallback(() => setHoja(null), []);

  const editable = puedeEditar(rol, fecha, hoy) && (rol !== 'ninera' || nino.activo);

  const cargar = useCallback(async () => {
    try {
      setRegistros(await api.registros(nino.id, fecha));
    } catch (err) {
      setError(mensajeError(err, 'cargar la bitácora'));
    }
  }, [nino.id, fecha]);

  useEffect(() => {
    setRegistros(null);
    setError(null);
    cargar();
    return api.escucharBitacora(nino.id, cargar);
  }, [nino.id, cargar]);

  const ordenados = registros ? ordenar(registros) : [];
  const resumen = resumenDelDia(ordenados);

  async function guardar(hora: string, datos: Record<string, unknown>) {
    if (!hoja) return;
    if (hoja.registro) {
      await api.actualizarRegistro(hoja.registro.id, { hora, datos });
    } else {
      await api.crearRegistro({ nino_id: nino.id, fecha, tipo: hoja.tipo, hora, datos });
    }
    await cargar();
  }

  async function yaDesperto(r: Registro) {
    setError(null);
    try {
      // Media hora más cercana hacia abajo, sin quedar antes de que se durmiera.
      const ahora = redondearMediaHora(horaActualCDMX());
      const inicio = horaCorta(r.hora);
      await api.actualizarRegistro(r.id, { datos: { ...r.datos, desperto: ahora < inicio ? inicio : ahora } });
      await cargar();
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  async function quitar(r: Registro) {
    setError(null);
    try {
      await api.quitarRegistro(r.id);
      await cargar();
    } catch (err) {
      setError(mensajeError(err, 'quitar el registro'));
    }
  }

  return (
    <section className={`dia${editable ? ' con-barra' : ''}`} aria-labelledby="titulo-dia">
      <header className="dia-encabezado">
        <div>
          <h1 id="titulo-dia">{nino.nombre}</h1>
          <p className="fecha" aria-live="polite">
            {fecha === hoy || fecha === sumarDias(hoy, -1) ? (
              <>
                {nombreDia(fecha, hoy)}
                <span className="fecha-larga"> · {fechaLarga(fecha)}</span>
              </>
            ) : (
              <span className="fecha-capital">{fechaLarga(fecha)}</span>
            )}
          </p>
        </div>
      </header>

      <TiraDias ninoId={nino.id} fecha={fecha} hoy={hoy} onFecha={setFecha} version={registros} />

      <dl className="resumen" aria-label="Resumen del día">
        <div className="dato tipo-comida">
          <dt>Comidas</dt>
          <dd>{resumen.comidas}</dd>
        </div>
        <div className="dato tipo-siesta">
          <dt>Sueño</dt>
          <dd>{resumen.durmiendoAhora ? 'En siesta' : resumen.minutosSueno ? duracion(resumen.minutosSueno) : '—'}</dd>
        </div>
        <div className="dato tipo-bano">
          <dt>Pañal o baño</dt>
          <dd>{resumen.banos}</dd>
        </div>
        <div className="dato tipo-animo">
          <dt>Ánimo</dt>
          <dd>{resumen.ultimoAnimo ?? '—'}</dd>
        </div>
      </dl>

      <Aviso texto={error} onCerrar={() => setError(null)} />

      {registros === null ? (
        <Cargando />
      ) : ordenados.length === 0 ? (
        <p className="vacio">
          Todavía no hay registros de este día.
          {editable && ' Usa los botones de abajo para empezar.'}
        </p>
      ) : (
        <ol className="linea-tiempo">
          {ordenados.map((r) => {
            const info = infoTipo(r.tipo);
            const { titulo, detalles } = describir(r);
            const abierta = siestaAbierta(r);
            return (
              <li key={r.id} className={`evento tipo-${r.tipo}${abierta ? ' en-curso' : ''}`}>
                <span className="punto" aria-hidden="true">
                  {info.icono}
                </span>
                <div className="evento-cuerpo">
                  <p className="evento-meta">
                    {r.tipo !== 'animo' && (
                      <>
                        <time>{hora12(r.hora)}</time> ·{' '}
                      </>
                    )}
                    {info.nombre}
                  </p>
                  <p className="evento-titulo">{titulo}</p>
                  {detalles.map((d, i) => (
                    <p key={i} className="evento-detalle">
                      {d}
                    </p>
                  ))}
                  {editable && (
                    <div className="evento-acciones">
                      {abierta && (
                        <button type="button" className="boton-chico destacado" onClick={() => yaDesperto(r)}>
                          Ya despertó
                        </button>
                      )}
                      <button
                        type="button"
                        className="boton-chico"
                        onClick={() => setHoja({ tipo: r.tipo, registro: r })}
                        aria-label={`Editar ${info.nombre.toLowerCase()}${r.tipo !== 'animo' ? ` de las ${hora12(r.hora)}` : ''}`}
                      >
                        Editar
                      </button>
                      <BotonConfirmar
                        texto="Quitar"
                        confirmar="¿Quitar? Toca otra vez"
                        etiqueta={`Quitar ${info.nombre.toLowerCase()}${r.tipo !== 'animo' ? ` de las ${hora12(r.hora)}` : ''}`}
                        onConfirmar={() => quitar(r)}
                      />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {!editable && rol === 'ninera' && fecha < sumarDias(hoy, -1) && (
        <p className="nota">Puedes registrar hoy y ayer. Para cambiar días anteriores, pídeselo a la administradora.</p>
      )}

      {editable && (
        <nav className="barra-captura" aria-label="Registrar">
          {TIPOS.map((t) => (
            <button key={t.tipo} type="button" className={`captura tipo-${t.tipo}`} onClick={() => setHoja({ tipo: t.tipo })}>
              <span className="captura-icono" aria-hidden="true">
                {t.icono}
              </span>
              <span>{t.boton}</span>
            </button>
          ))}
        </nav>
      )}

      {hoja && (
        <HojaRegistro
          key={hoja.registro?.id ?? hoja.tipo}
          tipo={hoja.tipo}
          registro={hoja.registro}
          onGuardar={guardar}
          onCerrar={cerrar}
        />
      )}
    </section>
  );
}
