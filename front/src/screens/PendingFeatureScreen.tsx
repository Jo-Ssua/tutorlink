import { Link } from 'react-router-dom';

interface PendingFeatureScreenProps {
  title: string;
  description: string;
}

/**
 * Hueco para una ruta que ya existe en el enrutador pero cuya pantalla llega en
 * una fase posterior. La ruta tiene que existir desde ahora porque el enlace
 * del correo de verificación apunta a ella.
 */
export function PendingFeatureScreen({ title, description }: PendingFeatureScreenProps) {
  return (
    <main className="dashboard">
      <section className="panel panel--center">
        <p className="eyebrow">En construcción</p>
        <h1>{title}</h1>
        <p>{description}</p>
        <Link className="button button--primary" to="/login">
          Volver al inicio de sesión
        </Link>
      </section>
    </main>
  );
}
