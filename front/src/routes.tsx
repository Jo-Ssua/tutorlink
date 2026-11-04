import { Navigate, Route, Routes } from 'react-router-dom';
import {
  ProtectedRoute,
  RoleHomeRedirect,
  RoleRoute,
} from './auth/ProtectedRoute';
import { AppLayout } from './layouts/AppLayout';
import { ReservasApp } from './reservas/ReservasApp';
import { AdminHome } from './screens/AdminHome';
import { LoginScreen } from './screens/LoginScreen';
import { PendingFeatureScreen } from './screens/PendingFeatureScreen';
import { RatingsScreen } from './screens/RatingsScreen';
import { TutorHome } from './screens/TutorHome';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RoleHomeRedirect />} />
      <Route path="/login" element={<LoginScreen />} />

      <Route
        path="/registro"
        element={
          <PendingFeatureScreen
            title="Registro con correo institucional"
            description="El formulario de registro llega en la siguiente iteración. Por ahora la cuenta se crea con POST /auth/register."
          />
        }
      />
      <Route
        path="/verificar"
        element={
          <PendingFeatureScreen
            title="Verificación de la cuenta"
            description="Aquí llegará el formulario del código de 6 dígitos. Mientras tanto, el enlace del correo también funciona contra GET /auth/verify-email."
          />
        }
      />

      {/* Todo lo que hay debajo exige sesión. */}
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<RoleHomeRedirect />} />

          <Route element={<RoleRoute roles={['STUDENT']} />}>
            <Route path="calificaciones" element={<RatingsScreen />} />
            <Route
              path="reservar"
              element={
                <main className="dashboard">
                  <ReservasApp />
                </main>
              }
            />
          </Route>

          <Route element={<RoleRoute roles={['TUTOR']} />}>
            <Route path="tutor" element={<TutorHome />} />
          </Route>

          <Route element={<RoleRoute roles={['ADMIN']} />}>
            <Route path="admin" element={<AdminHome />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
