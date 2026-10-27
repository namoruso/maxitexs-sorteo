import { Link } from 'react-router-dom';

export default function PrivacidadPage() {
  return (
    <div style={{ padding: 32, maxWidth: 640, margin: '0 auto', fontFamily: 'var(--font-sans)', color: 'var(--ink)' }}>
      <h1>Aviso de privacidad</h1>
      <p>
        Corporación Maxitex’s utiliza tus datos únicamente para gestionar tu participación en el sorteo del evento,
        contactarte si resultas ganador y cumplir obligaciones legales. No compartimos tus datos con terceros con fines
        comerciales. Un registro por cédula y teléfono.
      </p>
      <p>
        <Link to="/registro">Volver al registro</Link>
      </p>
    </div>
  );
}
