import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { PackageSearch, TrendingUp, AlertTriangle, Coins, DollarSign, Percent } from 'lucide-react';
import { fetchDashboardStats, fetchProfitMarginReport } from '../api';

const PIE_COLORS = ['#D2143A', '#10B981']; // Cost (Cherry Red), Profit (Emerald Green)

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
      <div className="py-24 text-center text-stone-400 animate-pulse font-black text-sm uppercase tracking-wider">
        Cargando estadísticas financieras...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center space-x-3 mb-6 animate-fade-in">
        <h2 className="text-3xl font-black text-brand-900 tracking-tight flex items-center">
          <TrendingUp className="mr-3 text-chiluda-red w-8 h-8" />
          Panel de Control Financiero
        </h2>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-slide-up">
        {/* Card 1: Ingresos Totales */}
        <div className="bg-white/5 backdrop-blur-[2px] p-6 rounded-[2rem] shadow-soft border border-white/40 hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300 flex flex-col justify-between group">
          <div className="flex justify-between items-start mb-6">
            <p className="text-stone-400 font-black tracking-widest text-[10px] uppercase">Ingresos Totales</p>
            <div className="bg-blue-500/10 p-2.5 rounded-xl group-hover:scale-110 transition-transform">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div>
            <p className="text-3xl sm:text-4xl font-black text-brand-900 tracking-tight leading-none">
              ${profitSummary.total_revenue.toFixed(2)}
            </p>
          </div>
        </div>
        
        {/* Card 2: Ganancia Neta */}
        <div className="bg-white/5 backdrop-blur-[2px] p-6 rounded-[2rem] shadow-soft border border-white/40 hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300 flex flex-col justify-between group">
          <div className="flex justify-between items-start mb-6">
            <p className="text-stone-400 font-black tracking-widest text-[10px] uppercase">Ganancia Neta</p>
            <div className="bg-emerald-500/10 p-2.5 rounded-xl group-hover:scale-110 transition-transform">
              <Coins className="w-5 h-5 text-emerald-600" />
            </div>
          </div>
          <div>
            <p className="text-3xl sm:text-4xl font-black text-emerald-600 tracking-tight leading-none">
              ${profitSummary.total_profit.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Card 3: Margen Promedio */}
        <div className="bg-white/5 backdrop-blur-[2px] p-6 rounded-[2rem] shadow-soft border border-white/40 hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300 flex flex-col justify-between group">
          <div className="flex justify-between items-start mb-6">
            <p className="text-stone-400 font-black tracking-widest text-[10px] uppercase">Margen Promedio</p>
            <div className="bg-purple-500/10 p-2.5 rounded-xl group-hover:scale-110 transition-transform">
              <Percent className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <div>
            <p className="text-3xl sm:text-4xl font-black text-purple-600 tracking-tight leading-none">
              {profitSummary.average_margin_percentage.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Card 4: Alertas de Stock */}
        <div className="bg-white/5 backdrop-blur-[2px] p-6 rounded-[2rem] shadow-soft border border-white/40 hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300 flex flex-col justify-between group">
          <div className="flex justify-between items-start mb-6">
            <p className="text-stone-400 font-black tracking-widest text-[10px] uppercase">Alertas de Stock</p>
            <div className={`p-2.5 rounded-xl group-hover:scale-110 transition-transform ${stats.low_stock_alerts > 0 ? 'bg-amber-500/10' : 'bg-stone-100'}`}>
              <AlertTriangle className={`w-5 h-5 ${stats.low_stock_alerts > 0 ? 'text-amber-600' : 'text-stone-400'}`} />
            </div>
          </div>
          <div>
            <p className={`text-3xl sm:text-4xl font-black tracking-tight leading-none ${
              stats.low_stock_alerts > 0 ? 'text-amber-600' : 'text-brand-900'
            }`}>
              {stats.low_stock_alerts} <span className="text-xs text-stone-400 font-bold">productos</span>
            </p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-slide-up" style={{ animationDelay: '0.05s' }}>
        {/* Bar Chart: Revenues vs Costs vs Profits */}
        <div className="bg-white/5 backdrop-blur-[2px] p-6 sm:p-8 rounded-[2rem] shadow-soft border border-white/40 min-w-0">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-brand-900">Rentabilidad por Producto</h3>
            <span className="px-3 py-1.5 bg-chiluda-lightred text-chiluda-red text-[10px] font-black uppercase tracking-wider rounded-full">Top 5</span>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                <XAxis dataKey="name" tick={{fill: '#78716c', fontSize: 11, fontWeight: 700}} axisLine={false} tickLine={false} tickMargin={10} />
                <YAxis tick={{fill: '#78716c', fontSize: 11, fontWeight: 700}} axisLine={false} tickLine={false} tickMargin={10} />
                <Tooltip 
                  contentStyle={{borderRadius: '16px', border: '1px solid #ffe4e6', backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(8px)'}}
                  labelStyle={{fontWeight: 'bold', color: '#1c1917'}}
                />
                <Legend iconType="circle" wrapperStyle={{paddingTop: '15px', fontWeight: 700, fontSize: '12px'}} />
                <Bar dataKey="Ingresos" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={20} />
                <Bar dataKey="Costos" fill="#D2143A" radius={[4, 4, 0, 0]} maxBarSize={20} />
                <Bar dataKey="Ganancia" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart: Cost vs Net profit */}
        <div className="bg-white/5 backdrop-blur-[2px] p-6 sm:p-8 rounded-[2rem] shadow-soft border border-white/40 min-w-0">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-brand-900">Distribución Financiera</h3>
            <span className="px-3 py-1.5 bg-stone-100 text-stone-600 text-[10px] font-black uppercase tracking-wider rounded-full">Proporción</span>
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
                    contentStyle={{borderRadius: '16px', border: '1px solid #ffe4e6', backgroundColor: 'rgba(255, 255, 255, 0.95)'}}
                  />
                  <Legend iconType="circle" wrapperStyle={{paddingTop: '10px', fontWeight: 700, fontSize: '12px'}} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-stone-400 text-xs font-bold uppercase tracking-wider">No hay ventas registradas para graficar.</div>
            )}
          </div>
        </div>
      </div>

      {/* Top Sold Products table with Profit margins */}
      <div className="bg-white/5 backdrop-blur-[2px] rounded-[2rem] shadow-soft border border-white/40 overflow-hidden animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="p-6 border-b border-stone-100 bg-white/40">
          <h3 className="text-lg font-black text-brand-900">Clasificación de Productos y Márgenes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-stone-50 text-stone-600 text-[11px] font-black uppercase tracking-wider border-b border-stone-100">
              <tr>
                <th className="px-6 py-4 font-black">Producto</th>
                <th className="px-6 py-4 font-black text-center">Unidades Vendidas</th>
                <th className="px-6 py-4 font-black text-right">Ingresos Totales</th>
                <th className="px-6 py-4 font-black text-right">Costo Acumulado</th>
                <th className="px-6 py-4 font-black text-right">Ganancia Neta</th>
                <th className="px-6 py-4 font-black text-center">Margen %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs font-bold text-stone-700">
              {topProducts.map((p) => (
                <tr key={p.product_id} className="hover:bg-stone-50/50 transition-colors">
                  <td className="px-6 py-4 text-brand-900 font-extrabold">{p.product_name}</td>
                  <td className="px-6 py-4 text-center text-stone-500">{p.quantity_sold} u.</td>
                  <td className="px-6 py-4 text-right text-stone-600">${p.revenue.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right text-stone-600">${p.cost.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right text-emerald-600 font-extrabold">${p.profit.toFixed(2)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2.5 py-1 rounded-full font-black text-[10px] ${
                      p.margin_percentage > 30 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                      p.margin_percentage > 15 ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                      p.margin_percentage > 0 ? 'bg-orange-50 text-orange-700 border border-orange-100' :
                      'bg-rose-50 text-chiluda-red border border-rose-100'
                    }`}>
                      {p.margin_percentage.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
              {topProducts.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-stone-400 font-semibold">No hay ventas registradas aún.</td>
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
