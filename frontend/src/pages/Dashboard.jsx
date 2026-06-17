import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { PackageSearch, TrendingUp, AlertTriangle, Coins, DollarSign, Percent } from 'lucide-react';
import { fetchDashboardStats, fetchProfitMarginReport } from '../api';

const PIE_COLORS = ['#f87171', '#34d399']; // Cost (red-400), Profit (emerald-400)

const Dashboard = () => {
  const [stats, setStats] = useState({ total_stock: 0, total_sold: 0, low_stock_alerts: 0 });
  const [profitSummary, setProfitSummary] = useState({ total_revenue: 0, total_cost: 0, total_profit: 0, average_margin_percentage: 0 });
  const [chartData, setChartData] = useState([]);
  const [pieData, setPieData] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const statsData = await fetchDashboardStats();
        setStats(statsData);

        const marginData = await fetchProfitMarginReport();
        setProfitSummary(marginData.summary);
        
        setPieData([
          { name: 'Costo Total ($)', value: marginData.summary.total_cost },
          { name: 'Ganancia Neta ($)', value: marginData.summary.total_profit },
        ]);

        const top5 = marginData.products.slice(0, 5).map(item => ({
          name: item.product_name,
          Ingresos: item.revenue,
          Costos: item.cost,
          Ganancia: item.profit
        }));
        setChartData(top5);
        setTopProducts(marginData.products.slice(0, 8));
      } catch (error) {
        console.error("Error loading dashboard data", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-500 animate-pulse font-medium">
        Cargando estadísticas financieras...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center space-x-3 mb-6 animate-fade-in">
        <h2 className="text-3xl font-extrabold text-brand-900 tracking-tight">
          Panel de Control Financiero
        </h2>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-slide-up">
        {/* Card 1: Ingresos Totales */}
        <div className="bg-white/95 backdrop-blur-2xl p-6 rounded-[2rem] shadow-soft border border-white hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300 flex flex-col justify-between group">
          <div className="flex justify-between items-start mb-6">
            <p className="text-gray-400 font-bold tracking-widest text-xs uppercase">Ingresos Totales</p>
            <div className="bg-blue-50 p-2.5 rounded-xl group-hover:scale-110 transition-transform">
              <DollarSign className="w-5 h-5 text-blue-500" />
            </div>
          </div>
          <div>
            <p className="text-3xl sm:text-4xl font-black text-brand-900 tracking-tight leading-none">
              ${profitSummary.total_revenue.toFixed(2)}
            </p>
          </div>
        </div>
        
        {/* Card 2: Ganancia Neta */}
        <div className="bg-white/95 backdrop-blur-2xl p-6 rounded-[2rem] shadow-soft border border-white hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300 flex flex-col justify-between group">
          <div className="flex justify-between items-start mb-6">
            <p className="text-gray-400 font-bold tracking-widest text-xs uppercase">Ganancia Neta</p>
            <div className="bg-emerald-50 p-2.5 rounded-xl group-hover:scale-110 transition-transform">
              <Coins className="w-5 h-5 text-emerald-500" />
            </div>
          </div>
          <div>
            <p className="text-3xl sm:text-4xl font-black text-emerald-600 tracking-tight leading-none">
              ${profitSummary.total_profit.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Card 3: Margen Promedio */}
        <div className="bg-white/95 backdrop-blur-2xl p-6 rounded-[2rem] shadow-soft border border-white hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300 flex flex-col justify-between group">
          <div className="flex justify-between items-start mb-6">
            <p className="text-gray-400 font-bold tracking-widest text-xs uppercase">Margen Promedio</p>
            <div className="bg-purple-50 p-2.5 rounded-xl group-hover:scale-110 transition-transform">
              <Percent className="w-5 h-5 text-purple-500" />
            </div>
          </div>
          <div>
            <p className="text-3xl sm:text-4xl font-black text-purple-600 tracking-tight leading-none">
              {profitSummary.average_margin_percentage.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Card 4: Alertas de Stock */}
        <div className="bg-white/95 backdrop-blur-2xl p-6 rounded-[2rem] shadow-soft border border-white hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300 flex flex-col justify-between group">
          <div className="flex justify-between items-start mb-6">
            <p className="text-gray-400 font-bold tracking-widest text-xs uppercase">Alertas de Stock</p>
            <div className="bg-red-50 p-2.5 rounded-xl group-hover:scale-110 transition-transform">
              <AlertTriangle className="w-5 h-5 text-chiluda-red" />
            </div>
          </div>
          <div>
            <p className={`text-3xl sm:text-4xl font-black tracking-tight leading-none ${
              stats.low_stock_alerts > 0 ? 'text-chiluda-red' : 'text-brand-900'
            }`}>
              {stats.low_stock_alerts} <span className="text-xs text-gray-400 font-bold">productos</span>
            </p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-slide-up" style={{ animationDelay: '0.05s' }}>
        {/* Bar Chart: Revenues vs Costs vs Profits */}
        <div className="bg-white/80 backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-soft border border-gray-100 min-w-0">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-brand-900">Rentabilidad por Producto</h3>
            <span className="px-3 py-1 bg-red-50 text-chiluda-red text-[10px] font-bold uppercase tracking-wider rounded-full">Top 5</span>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{fill: '#9ca3af', fontSize: 11, fontWeight: 600}} axisLine={false} tickLine={false} tickMargin={10} />
                <YAxis tick={{fill: '#9ca3af', fontSize: 11, fontWeight: 600}} axisLine={false} tickLine={false} tickMargin={10} />
                <Tooltip 
                  contentStyle={{borderRadius: '16px', border: '1px solid #fee2e2', backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(8px)'}}
                  labelStyle={{fontWeight: 'bold', color: '#1f2937'}}
                />
                <Legend iconType="circle" wrapperStyle={{paddingTop: '15px', fontWeight: 500, fontSize: '12px'}} />
                <Bar dataKey="Ingresos" fill="#60a5fa" radius={[4, 4, 0, 0]} maxBarSize={30} />
                <Bar dataKey="Costos" fill="#f87171" radius={[4, 4, 0, 0]} maxBarSize={30} />
                <Bar dataKey="Ganancia" fill="#34d399" radius={[4, 4, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart: Cost vs Net profit */}
        <div className="bg-white/80 backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-soft border border-gray-100 min-w-0">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-brand-900">Distribución Financiera</h3>
            <span className="px-3 py-1 bg-gray-50 text-gray-500 text-[10px] font-bold uppercase tracking-wider rounded-full">Proporción</span>
          </div>
          <div className="h-80 flex items-center justify-center">
            {profitSummary.total_revenue > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={105}
                    paddingAngle={6}
                    dataKey="value"
                    stroke="none"
                    cornerRadius={6}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{borderRadius: '16px', border: '1px solid #fee2e2', backgroundColor: 'rgba(255, 255, 255, 0.95)'}}
                  />
                  <Legend iconType="circle" wrapperStyle={{paddingTop: '10px', fontWeight: 500, fontSize: '12px'}} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-gray-400 text-xs font-semibold">No hay ventas registradas para graficar distribución.</div>
            )}
          </div>
        </div>
      </div>

      {/* Top Sold Products table with Profit margins */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-soft border border-white overflow-hidden animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="p-5 border-b border-gray-100 bg-white/40">
          <h3 className="text-lg font-black text-brand-900">Clasificación de Productos y Márgenes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-brand-50/50 text-brand-900 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-bold">Producto</th>
                <th className="px-6 py-4 font-bold text-center">Unidades Vendidas</th>
                <th className="px-6 py-4 font-bold text-right">Ingresos Totales</th>
                <th className="px-6 py-4 font-bold text-right">Costo Acumulado</th>
                <th className="px-6 py-4 font-bold text-right">Ganancia Neta</th>
                <th className="px-6 py-4 font-bold text-center">Margen %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs font-semibold">
              {topProducts.map((p) => (
                <tr key={p.product_id} className="hover:bg-brand-50/50 transition-colors">
                  <td className="px-6 py-4 text-brand-900 font-extrabold">{p.product_name}</td>
                  <td className="px-6 py-4 text-center text-gray-500">{p.quantity_sold} u.</td>
                  <td className="px-6 py-4 text-right text-gray-600">${p.revenue.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right text-gray-600">${p.cost.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right text-emerald-600">${p.profit.toFixed(2)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-0.5 rounded font-extrabold text-[10px] ${
                      p.margin_percentage > 30 ? 'bg-emerald-50 text-emerald-700' :
                      p.margin_percentage > 15 ? 'bg-purple-50 text-purple-700' :
                      p.margin_percentage > 0 ? 'bg-orange-50 text-orange-700' :
                      'bg-red-50 text-red-700'
                    }`}>
                      {p.margin_percentage.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
              {topProducts.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-gray-400">No hay ventas registradas aún.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
