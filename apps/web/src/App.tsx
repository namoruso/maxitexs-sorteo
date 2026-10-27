import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

const RegistroPage = lazy(() => import('./features/registro/RegistroPage'));
const TotemPage = lazy(() => import('./features/totem/TotemPage'));
const AdminPage = lazy(() => import('./features/admin/AdminPage'));
const LoginPage = lazy(() => import('./features/admin/LoginPage'));
const PrivacidadPage = lazy(() => import('./routes/PrivacidadPage'));

function Fallback() {
  return (
    <div style={{ padding: 48, textAlign: 'center', color: 'var(--ink-muted)' }}>
      Cargando…
    </div>
  );
}

export function App() {
  return (
    <Suspense fallback={<Fallback />}>
      <Routes>
        <Route path="/" element={<Navigate to="/registro" replace />} />
        <Route path="/registro" element={<RegistroPage />} />
        <Route path="/totem" element={<TotemPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/privacidad" element={<PrivacidadPage />} />
        <Route path="*" element={<Navigate to="/registro" replace />} />
      </Routes>
    </Suspense>
  );
}
