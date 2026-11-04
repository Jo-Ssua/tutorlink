import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// El tema va primero; `styles.css` es el CSS heredado que aún viste las
// pantallas sin migrar y se borra al terminar la migración.
import './theme.css';
import './styles.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('No se encontró el contenedor #root');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
