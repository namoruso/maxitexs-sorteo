import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { registroSchema } from '@maxitexs/shared';
import { api } from '../../api/client';
import { Icon } from '../../lib/icons';

type Paso = 'inicio' | 'paso1' | 'paso2' | 'exito';

type Paso1 = {
  nombre: string;
  cedula_tipo: 'V' | 'E';
  cedula: string;
  telefono: string;
};

type Paso2 = {
  laboratorio: string;
  cargo: string;
  correo: string;
  consentimiento: true;
};

export default function RegistroPage() {
  const [view, setView] = useState<Paso>('inicio');
  const [premio, setPremio] = useState('Premio');
  const [evento, setEvento] = useState("Jornada Maxitex’s 2026");
  const [ticket, setTicket] = useState('0000');
  const [resumen, setResumen] = useState('');
  const [dupAlert, setDupAlert] = useState(false);
  const [dupMsg, setDupMsg] = useState('Esta cédula ya está registrada');
  const [netAlert, setNetAlert] = useState(false);
  const [sending, setSending] = useState(false);
  const [paso1, setPaso1] = useState<Paso1 | null>(null);

  const f1 = useForm<Paso1>({
    defaultValues: { nombre: '', cedula_tipo: 'V', cedula: '', telefono: '' },
  });
  const f2 = useForm<Paso2>({
    defaultValues: { laboratorio: '', cargo: '', correo: '', consentimiento: undefined as unknown as true },
  });

  useEffect(() => {
    api<{ nombre: string; premio: string }>('/api/evento').then((r) => {
      if (!r.ok) return;
      setPremio(r.data.premio);
      setEvento(r.data.nombre);
    });
  }, []);

  async function onPaso1(data: Paso1) {
    const parsed = registroSchema.safeParse({
      nombre: data.nombre,
      cedula: { tipo: data.cedula_tipo, numero: data.cedula },
      telefono: data.telefono,
      laboratorio: 'xx',
      cargo: 'xx',
      correo: 'a@b.co',
      consentimiento: true,
    });
    // Validate only paso1 fields via full schema then check field errors
    const campos: Record<string, string> = {};
    if (!parsed.success) {
      for (const i of parsed.error.issues) {
        const k = String(i.path[0]);
        if (['nombre', 'cedula', 'telefono'].includes(k) && !campos[k]) campos[k] = i.message;
      }
    }
    f1.clearErrors();
    let bad = false;
    for (const [k, msg] of Object.entries(campos)) {
      bad = true;
      f1.setError(k === 'cedula' ? 'cedula' : (k as keyof Paso1), { message: msg });
    }
    if (bad) return;

    const v = await api<{ cedula: boolean; telefono: boolean }>('/api/registro/verificar', {
      method: 'POST',
      body: {
        cedula: { tipo: data.cedula_tipo, numero: data.cedula },
        telefono: data.telefono,
      },
    });
    if (v.ok && v.data.cedula) {
      f1.setError('cedula', { message: 'Esta cédula ya está registrada.' });
      return;
    }
    if (v.ok && v.data.telefono) {
      f1.setError('telefono', { message: 'Este teléfono ya está registrado.' });
      return;
    }

    setPaso1(data);
    setView('paso2');
  }

  async function onPaso2(data: Paso2) {
    if (!paso1 || sending) return;
    setDupAlert(false);
    setNetAlert(false);

    const payload = {
      nombre: paso1.nombre.trim(),
      cedula: { tipo: paso1.cedula_tipo, numero: paso1.cedula },
      telefono: paso1.telefono,
      laboratorio: data.laboratorio.trim(),
      cargo: data.cargo.trim(),
      correo: data.correo.trim(),
      consentimiento: true as const,
    };

    const parsed = registroSchema.safeParse(payload);
    if (!parsed.success) {
      for (const i of parsed.error.issues) {
        const k = String(i.path[0]);
        if (['laboratorio', 'cargo', 'correo', 'consentimiento'].includes(k)) {
          f2.setError(k as keyof Paso2, { message: i.message });
        }
      }
      return;
    }

    setSending(true);
    const r = await api<{ ticket: string; nombre: string; laboratorio: string; mensaje?: string; campo?: string; campos?: Record<string, string> }>(
      '/api/registro',
      { method: 'POST', body: payload },
    );
    setSending(false);

    if (r.status === 201 && r.data.ticket) {
      setTicket(r.data.ticket);
      setResumen(`${r.data.nombre} · ${r.data.laboratorio}`);
      setView('exito');
      return;
    }
    if (r.status === 409) {
      setDupMsg(r.data.mensaje || 'Ya estás registrado');
      setDupAlert(true);
      if (r.data.campo === 'telefono') {
        f2.setError('correo', { message: '' });
      }
      return;
    }
    if (r.status === 422 && r.data.campos) {
      for (const [k, msg] of Object.entries(r.data.campos)) {
        if (k in f2.getValues()) f2.setError(k as keyof Paso2, { message: msg });
      }
      return;
    }
    setNetAlert(true);
  }

  const consent = f2.watch('consentimiento');

  return (
    <div className="reg-page">
      <main className="ch ch-screen ch-mobile" id="app">
        {view === 'inicio' && (
          <section className="reg-view">
            <div className="ch-mobile-body">
              <div className="ch-mobile-hero">
                <img src="/assets/logo.png" alt="Corporación Maxitex’s" height={176} style={{ height: 176, width: 'auto' }} />
              </div>
              <h1 style={{ marginTop: 32 }}>
                Regístrate y participa por <span>{premio}</span>
              </h1>
              <p className="muted" style={{ marginTop: 12 }}>
                Déjanos tus datos de contacto profesional. {evento}.
              </p>
              <div className="ch-row" style={{ marginTop: 20, gap: 8 }}>
                <span className="ch-pill"><Icon name="clock" size={18} />1 minuto</span>
                <span className="ch-pill">2 pasos</span>
                <span className="ch-pill">6 datos</span>
              </div>
              <ul className="ch-asklist">
                <li><b>1</b><span>Nombre y apellido, cédula y teléfono</span></li>
                <li><b>2</b><span>Laboratorio, cargo y correo</span></li>
              </ul>
            </div>
            <div className="ch-mobile-foot">
              <button type="button" className="ch-btn ch-btn--md ch-btn--block ch-btn--primary" onClick={() => setView('paso1')}>
                Empezar <Icon name="arrowRight" size={22} />
              </button>
              <p className="ch-small muted" style={{ textAlign: 'center' }}>Un registro por cédula y teléfono.</p>
            </div>
          </section>
        )}

        {view === 'paso1' && (
          <form className="reg-view" onSubmit={f1.handleSubmit(onPaso1)} noValidate>
            <div className="ch-mobile-top">
              <button type="button" className="ch-iconbtn" aria-label="Atrás" style={{ marginLeft: -12 }} onClick={() => setView('inicio')}>
                <Icon name="arrowLeft" />
              </button>
              <div style={{ flex: 1 }}>
                <div className="ch-progress" role="progressbar" aria-valuenow={1} aria-valuemin={0} aria-valuemax={2}>
                  <div className="ch-progress-label"><span>Paso <b>1</b> de 2</span><span>≈ 30 s</span></div>
                  <div className="ch-progress-track"><div className="ch-progress-fill" style={{ width: '50%' }} /></div>
                </div>
              </div>
            </div>
            <div className="ch-mobile-body">
              <h2>Datos personales</h2>
              <p className="ch-small muted" style={{ marginTop: 6 }}>Los usamos solo para validar tu participación.</p>
              <div className="ch-stack" style={{ marginTop: 24, gap: 20 }}>
                <Field label="Nombre y apellido" error={f1.formState.errors.nombre?.message}>
                  <input {...f1.register('nombre')} autoComplete="name" maxLength={80} />
                </Field>
                <div className={`ch-field ${f1.formState.errors.cedula ? 'ch-field--error' : ''}`}>
                  <label className="ch-field-label" htmlFor="cedula">Cédula de identidad</label>
                  <div className="ch-input ch-input--prefix">
                    <select {...f1.register('cedula_tipo')} aria-label="Tipo de cédula">
                      <option value="V">V</option>
                      <option value="E">E</option>
                    </select>
                    <input
                      id="cedula"
                      {...f1.register('cedula', {
                        onChange: (e) => {
                          e.target.value = e.target.value.replace(/\D/g, '').slice(0, 9);
                        },
                      })}
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="12345678"
                    />
                  </div>
                  {f1.formState.errors.cedula ? (
                    <small role="alert"><Icon name="alert" size={18} />{f1.formState.errors.cedula.message}</small>
                  ) : (
                    <small>Solo números, sin puntos.</small>
                  )}
                </div>
                <Field label="Número de teléfono" error={f1.formState.errors.telefono?.message}>
                  <input {...f1.register('telefono')} type="tel" inputMode="tel" autoComplete="tel" placeholder="0412 000 0000" maxLength={16} />
                </Field>
              </div>
            </div>
            <div className="ch-mobile-foot">
              <button type="submit" className="ch-btn ch-btn--md ch-btn--block ch-btn--primary">
                Siguiente <Icon name="arrowRight" size={22} />
              </button>
            </div>
          </form>
        )}

        {view === 'paso2' && (
          <form className="reg-view" onSubmit={f2.handleSubmit(onPaso2)} noValidate>
            <div className="ch-mobile-top">
              <button type="button" className="ch-iconbtn" aria-label="Atrás" style={{ marginLeft: -12 }} onClick={() => setView('paso1')}>
                <Icon name="arrowLeft" />
              </button>
              <div style={{ flex: 1 }}>
                <div className="ch-progress">
                  <div className="ch-progress-label"><span>Último paso</span><span>2 de 2</span></div>
                  <div className="ch-progress-track"><div className="ch-progress-fill" style={{ width: '100%' }} /></div>
                </div>
              </div>
            </div>
            <div className="ch-mobile-body">
              <h2>Datos profesionales</h2>
              {dupAlert && (
                <div className="ch-alert" role="alert">
                  <Icon name="alert" />
                  <div><b>{dupMsg}</b>Solo se permite un registro por persona. Si crees que es un error, acércate al stand de Maxitex’s.</div>
                </div>
              )}
              {netAlert && (
                <div className="ch-alert" role="alert">
                  <Icon name="alert" />
                  <div><b>No pudimos enviar tus datos</b>Revisa tu conexión e inténtalo de nuevo.</div>
                </div>
              )}
              <div className="ch-stack" style={{ marginTop: 20, gap: 20 }}>
                <Field label="Nombre del laboratorio" error={f2.formState.errors.laboratorio?.message}>
                  <input {...f2.register('laboratorio')} autoComplete="organization" placeholder="Ej. Laboratorios Vitalis" maxLength={100} />
                </Field>
                <Field label="Cargo" error={f2.formState.errors.cargo?.message}>
                  <input {...f2.register('cargo')} autoComplete="organization-title" placeholder="Ej. Analista de laboratorio" maxLength={80} />
                </Field>
                <Field label="Correo electrónico" error={f2.formState.errors.correo?.message}>
                  <input {...f2.register('correo')} type="email" autoComplete="email" placeholder="tu@laboratorio.com" maxLength={120} />
                </Field>
              </div>
            </div>
            <div className="ch-mobile-foot">
              <label className="ch-check">
                <input type="checkbox" {...f2.register('consentimiento')} />
                <span className="ch-box" aria-hidden="true"><Icon name="check" size={18} stroke={3} /></span>
                <span>
                  Acepto los términos, condiciones y el uso de mis datos por Corporación Maxitex’s.{' '}
                  <a href="/privacidad" target="_blank" rel="noopener">Ver aviso de privacidad</a>
                </span>
              </label>
              <button
                type="submit"
                className="ch-btn ch-btn--md ch-btn--block ch-btn--primary"
                disabled={!consent || sending}
              >
                {sending ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </form>
        )}

        {view === 'exito' && (
          <section className="reg-view">
            <div className="ch-mobile-body" style={{ alignItems: 'center', textAlign: 'center', paddingTop: 48 }}>
              <svg className="ch-checkmark" width={88} height={88} viewBox="0 0 52 52" role="img" aria-label="Registro completado">
                <circle cx={26} cy={26} r={26} />
                <path d="M15 27l7 7 15-15" />
              </svg>
              <h1 style={{ marginTop: 24 }}>¡Listo, ya estás participando!</h1>
              <p className="muted" style={{ marginTop: 8 }}>{resumen}</p>
              <div className="ch-ticket" style={{ alignSelf: 'stretch' }}>
                <span>Tu número</span>
                <b>Ticket #{ticket}</b>
              </div>
              <p className="muted" style={{ marginTop: 20 }}>
                Mira la pantalla del tótem: ahí anunciamos al ganador. Guarda una captura de tu ticket y ten tu cédula a mano.
              </p>
              <div style={{ marginTop: 'auto', padding: '24px 0 8px' }}>
                <img src="/assets/logo.png" alt="Corporación Maxitex’s" height={72} style={{ height: 72, width: 'auto' }} />
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`ch-field ${error ? 'ch-field--error' : ''}`}>
      <span>{label}</span>
      <div className="ch-input">{children}</div>
      {error && (
        <small role="alert">
          <Icon name="alert" size={18} />
          {error}
        </small>
      )}
    </label>
  );
}
