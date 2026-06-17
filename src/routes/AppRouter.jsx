// Enrutador principal del SIAE con rutas protegidas
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoginPage from '../pages/auth/LoginPage';
import DashboardPage from '../pages/dashboard/DashboardPage';
import CompradoresPage from '../pages/compradores/CompradoresPage';
import Layout from '../components/Layout';

// Componente que protege rutas privadas
function RutaPrivada({ children }) {
    const { token } = useAuth();
    return token ? children : <Navigate to="/login" />;
}

export default function AppRouter() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Ruta pública */}
                <Route path="/login" element={<LoginPage />} />

                {/* Rutas privadas — dentro del Layout */}
                <Route path="/" element={
                    <RutaPrivada>
                        <Layout />
                    </RutaPrivada>
                }>
                    <Route index element={<DashboardPage />} />
                    <Route path="dashboard" element={<DashboardPage />} />

                    {/* Módulo Compradores */}
                    <Route path="compradores" element={<CompradoresPage />} />
                </Route>

                {/* Ruta no encontrada */}
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </BrowserRouter>
    );
}