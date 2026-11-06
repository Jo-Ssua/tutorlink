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
import { RatingsScreen } from './screens/RatingsScreen';
import { RegisterScreen } from './screens/RegisterScreen';
import { TutorApplicationScreen } from './screens/TutorApplicationScreen';
import { TutorHome } from './screens/TutorHome';
import { TutorProfileSettings } from './screens/TutorProfileSettings';
import { VerifyScreen } from './screens/VerifyScreen';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RoleHomeRedirect />} />
      <Route path="/login" element={<LoginScreen />} />

      {/* Registro y verificación son públicos: el enlace del correo cae aquí. */}
      <Route path="/registro" element={<RegisterScreen />} />
      <Route path="/verificar" element={<VerifyScreen />} />

      {/* Todo lo que hay debajo exige sesión. */}
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<RoleHomeRedirect />} />

          <Route element={<RoleRoute roles={['STUDENT']} />}>
            <Route path="calificaciones" element={<RatingsScreen />} />
            <Route path="reservar" element={<ReservasApp />} />
            <Route path="postular" element={<TutorApplicationScreen />} />
          </Route>

          <Route element={<RoleRoute roles={['TUTOR']} />}>
            <Route path="tutor" element={<TutorHome />} />
            <Route path="oferta" element={<TutorProfileSettings />} />
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
