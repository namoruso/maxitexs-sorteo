import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { Icon } from '../../lib/icons';

export default function LoginPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/admin';
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ autenticado: boolean }>('/api/admin/me').then((r) => {
      if (r.ok && r.data.autenticado) nav(next, { replace: true });
    });
  }, [nav, next]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const r = await api<{ mensaje?: string }>('/api/admin/login', {
      method: 'POST',
      body: {
        usuario: String(fd.get('usuario') ?? '').trim(),
        password: String(fd.get('password') ?? ''),
      },
    });
    setBusy(false);
    if (r.ok) {
      nav(next, { replace: true });
      return;
    }
    setErr(r.data.mensaje || 'Usuario o contraseña incorrectos.');
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit} noValidate>
        <div className="brand">
          <img src="/assets/logo.png" alt="Corporación Maxitex’s" height={72} style={{ height: 72, width: 'auto' }} />
        </div>
        <h1>Panel de sorteo</h1>
        <p className="sub">Inicia sesión para gestionar el tótem y el sorteo.</p>
        {err && (
          <div className="ch-alert err show" role="alert">
            <Icon name="alert" />
            <div>
              <b>No pudimos iniciar sesión</b>
              <span>{err}</span>
            </div>
          </div>
        )}
        <div className="ch-stack">
          <label className="ch-field">
            <span>Usuario</span>
            <div className="ch-input">
              <input name="usuario" type="text" autoComplete="username" required autoFocus />
            </div>
          </label>
          <label className="ch-field">
            <span>Contraseña</span>
            <div className="ch-input">
              <input name="password" type="password" autoComplete="current-password" required />
            </div>
          </label>
          <button type="submit" className="ch-btn ch-btn--md ch-btn--block ch-btn--primary" disabled={busy}>
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </div>
      </form>
      <style>{`
        .login-page{min-height:100vh;display:grid;place-items:center;padding:32px 16px;background:radial-gradient(ellipse 80% 50% at 50% -10%,var(--primary-soft),transparent),var(--bg)}
        .login-card{width:min(420px,100%);background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-md);padding:40px 32px 32px;box-shadow:var(--shadow-modal)}
        .login-card .brand{display:flex;justify-content:center;margin-bottom:28px}
        .login-card h1{font-size:24px;margin:0 0 8px;text-align:center;color:var(--ink)}
        .login-card .sub{text-align:center;color:var(--ink-muted);margin:0 0 28px;font-size:15px}
        .login-card .ch-stack{gap:16px}
        .login-card .err{margin-bottom:16px}
      `}</style>
    </div>
  );
}
