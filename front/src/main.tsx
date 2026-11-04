import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// `styles.css` es el CSS heredado que aún viste las pantallas sin migrar y se
// borra al terminar la migración. Va primero porque declara en `:root` nombres
// que HeroUI también usa (`--accent`, `--surface`, `--muted`, `--danger`): el
// tema tiene que ser el último en hablar para que esos tokens sean los de la
// marca y no los del CSS que está de salida.
import './styles.css';
import './theme.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('No se encontró el contenedor #root');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
