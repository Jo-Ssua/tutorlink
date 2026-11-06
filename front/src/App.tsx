import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { AppRoutes } from './routes';

/**
 * Raíz de la aplicación. La sesión la administra `AuthProvider` y las rutas
 * protegidas se resuelven en `routes.tsx`; antes todo eso vivía aquí dentro en
 * un `useState`.
 */
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
