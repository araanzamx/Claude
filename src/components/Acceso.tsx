// Pantalla de entrada. Con Supabase: enlace de acceso por correo (sin contraseña).
// En modo demostración: elegir con qué rol entrar.

import { useState, type FormEvent } from 'react';
import { api } from '../lib/cliente';
import { USUARIOS_DEMO, reiniciarDemo } from '../lib/demoApi';
import { mensajeError } from '../lib/errores';
import { Aviso, Campo } from './comunes';
import logo from '../recursos/logo.png';

export function Acceso() {
  const [correo, setCorreo] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) {
      setError('Escribe un correo válido, por ejemplo nombre@gmail.com.');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await api.enviarEnlaceAcceso(correo.trim().toLowerCase());
      setEnviado(true);
    } catch (err) {
      const msg = (err as { message?: string }).message ?? '';
      setError(
        /signups not allowed|not found|Signups/i.test(msg)
          ? 'Ese correo no tiene invitación. Pide a la administradora que te invite con este correo.'
          : mensajeError(err, 'enviar el enlace'),
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="acceso">
      <div className="acceso-tarjeta">
        <img className="logo logo-grande" src={logo} alt="Upper Nannies" />
        <h1>Bitácora diaria</h1>

        {api.modoDemo ? (
          <>
            <p>
              Estás en <strong>modo demostración</strong>: los datos son de ejemplo y se guardan solo en este navegador. Elige con
              qué rol entrar.
            </p>
            <div className="opciones-demo">
              <button type="button" className="boton-principal ancho" onClick={() => api.enviarEnlaceAcceso(USUARIOS_DEMO.ninera)}>
                Entrar como niñera (Lupita)
              </button>
              <button type="button" className="boton-principal ancho" onClick={() => api.enviarEnlaceAcceso(USUARIOS_DEMO.familia)}>
                Entrar como familia (Daniela García)
              </button>
              <button type="button" className="boton-secundario ancho" onClick={() => api.enviarEnlaceAcceso(USUARIOS_DEMO.admin)}>
                Entrar como administradora
              </button>
            </div>
            <p className="ayuda">
              Abre otra pestaña con otro rol para ver cómo la familia recibe los registros en vivo.{' '}
              <button
                type="button"
                className="boton-texto"
                onClick={() => {
                  reiniciarDemo();
                  window.location.reload();
                }}
              >
                Reiniciar datos de ejemplo
              </button>
            </p>
          </>
        ) : enviado ? (
          <div role="status">
            <h2>Revisa tu correo</h2>
            <p>
              Te mandamos un enlace a <strong>{correo}</strong>. Ábrelo desde este teléfono para entrar. Si no lo ves en unos minutos,
              busca en la carpeta de spam.
            </p>
            <button type="button" className="boton-texto" onClick={() => setEnviado(false)}>
              Usar otro correo
            </button>
          </div>
        ) : (
          <form onSubmit={enviar} noValidate>
            <p>Escribe el correo con el que te invitaron. Te mandaremos un enlace para entrar, sin contraseña.</p>
            <Campo etiqueta="Correo">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                required
              />
            </Campo>
            <Aviso texto={error} />
            <button type="submit" className="boton-principal ancho" disabled={enviando}>
              {enviando ? 'Enviando…' : 'Mandarme el enlace'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
