import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './context/AuthContext.jsx'
import AppRouter from './routes/AppRouter.jsx'
import ErrorPantalla from './components/common/ErrorPantalla.jsx'

import "./index.css";
//import "./index.css";


createRoot(document.getElementById("root")).render(
  <StrictMode>
    {/* 17/11/2026: último recurso fuera del Layout (login, cambiar contraseña): nunca página en blanco */}
    <ErrorPantalla paginaCompleta>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ErrorPantalla>
  </StrictMode>
);
