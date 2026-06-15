import Layout from "../../components/Layout";

export default function DashboardPage() {
  return (
    <Layout>
      <h2 className="text-2xl font-bold text-gray-700 mb-6">Dashboard general</h2>
      <p className="text-gray-400 text-sm mb-6">Resumen ejecutivo · AGAT-ECUAGREEN</p>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard titulo="Pedidos activos" valor="0" color="bg-green-500" />
        <KPICard titulo="Bookings abiertos" valor="0" color="bg-blue-500" />
        <KPICard titulo="Compradores" valor="0" color="bg-yellow-500" />
        <KPICard titulo="Órdenes de corte" valor="0" color="bg-purple-500" />
      </div>

      {/* Placeholder */}
      <div className="bg-white rounded-2xl shadow p-6 text-gray-400 text-center">
        Selecciona un módulo del menú para comenzar.
      </div>
    </Layout>
  );
}

function KPICard({ titulo, valor, color }) {
  return (
    <div className="bg-white rounded-2xl shadow p-5 flex items-center gap-4">
      <div className={`${color} w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold`}>
        {valor}
      </div>
      <div>
        <p className="text-gray-500 text-sm">{titulo}</p>
        <p className="text-gray-800 font-semibold text-lg">{valor}</p>
      </div>
    </div>
  );
}