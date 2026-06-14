import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { PackageSearch, TrendingUp, AlertTriangle, Activity } from 'lucide-react';
import { fetchDashboardStats, fetchInventory } from '../api';

const PIE_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#fca5a5', '#fdba74'];

const Dashboard = () => {
  const [stats, setStats] = useState({ total_stock: 0, total_sold: 0, low_stock_alerts: 0 });
  const [chartData, setChartData] = useState([]);
  const [pieData, setPieData] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const statsData = await fetchDashboardStats();
        setStats(statsData);
        setPieData([
          { name: 'En Stock', value: statsData.total_stock },
          { name: 'Vendidos', value: statsData.total_sold },
        ]);

        const inventoryData = await fetchInventory();
        const top5 = inventoryData
          .sort((a, b) => b.sold - a.sold)
          .slice(0, 5)
          .map(item => ({
            name: item.name,
            enStock: item.quantity,
            vendidos: item.sold
          }));
        setChartData(top5);
      } catch (error) {
        console.error("Error loading dashboard data", error);
      }
    };
    loadData();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center space-x-3 mb-6 animate-fade-in">
        <h2 className="text-3xl font-extrabold text-brand-900 tracking-tight">
          Panel de Control
        </h2>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 animate-slide-up">
        {/* Card 1 */}
        <div className="bg-white/90 backdrop-blur-2xl p-8 rounded-[2rem] shadow-glass border border-white hover:-translate-y-2 hover:shadow-2xl transition-all duration-500 flex flex-col justify-between group">
          <div className="flex justify-between items-start mb-8">
            <p className="text-gray-500 font-bold tracking-widest text-sm uppercase">Total en Stock</p>
            <div className="bg-red-50 p-2.5 rounded-xl group-hover:scale-110 transition-transform duration-300">
              <PackageSearch className="w-6 h-6 text-chiluda-red" />
            </div>
          </div>
          <div>
            <p className="text-6xl sm:text-7xl lg:text-[5rem] font-extrabold bg-clip-text text-transparent bg-gradient-to-br from-red-500 to-orange-500 tracking-tighter leading-none">
              {stats.total_stock}
            </p>
          </div>
        </div>
        
        {/* Card 2 */}
        <div className="bg-white/90 backdrop-blur-2xl p-8 rounded-[2rem] shadow-glass border border-white hover:-translate-y-2 hover:shadow-2xl transition-all duration-500 flex flex-col justify-between group">
          <div className="flex justify-between items-start mb-8">
            <p className="text-gray-500 font-bold tracking-widest text-sm uppercase">Total Vendidos</p>
            <div className="bg-emerald-50 p-2.5 rounded-xl group-hover:scale-110 transition-transform duration-300">
              <TrendingUp className="w-6 h-6 text-emerald-500" />
            </div>
          </div>
          <div>
            <p className="text-6xl sm:text-7xl lg:text-[5rem] font-extrabold bg-clip-text text-transparent bg-gradient-to-br from-emerald-400 to-teal-500 tracking-tighter leading-none">
              {stats.total_sold}
            </p>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white/90 backdrop-blur-2xl p-8 rounded-[2rem] shadow-glass border border-white hover:-translate-y-2 hover:shadow-2xl transition-all duration-500 flex flex-col justify-between group">
          <div className="flex justify-between items-start mb-8">
            <p className="text-gray-500 font-bold tracking-widest text-sm uppercase">Productos Bajos</p>
            <div className="bg-orange-50 p-2.5 rounded-xl group-hover:scale-110 transition-transform duration-300">
              <AlertTriangle className="w-6 h-6 text-orange-500" />
            </div>
          </div>
          <div>
            <p className="text-6xl sm:text-7xl lg:text-[5rem] font-extrabold bg-clip-text text-transparent bg-gradient-to-br from-orange-400 to-red-500 tracking-tighter leading-none">
              {stats.low_stock_alerts}
            </p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-soft border border-gray-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-glass min-w-0">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-brand-900">Stock vs Ventas</h3>
            <span className="px-4 py-1.5 bg-red-50 text-chiluda-red text-xs font-bold uppercase tracking-wider rounded-full">Top 5</span>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEnStock" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#fca5a5" stopOpacity={1}/>
                    <stop offset="95%" stopColor="#fee2e2" stopOpacity={0.8}/>
                  </linearGradient>
                  <linearGradient id="colorVendidos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={1}/>
                    <stop offset="95%" stopColor="#b91c1c" stopOpacity={0.9}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" tick={{fill: '#9ca3af', fontSize: 13, fontWeight: 600}} axisLine={false} tickLine={false} tickMargin={12} />
                <YAxis tick={{fill: '#9ca3af', fontSize: 13, fontWeight: 600}} axisLine={false} tickLine={false} tickMargin={12} />
                <Tooltip 
                  cursor={{fill: 'rgba(254, 242, 242, 0.5)'}}
                  contentStyle={{borderRadius: '16px', border: '1px solid #fee2e2', backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(8px)', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)', padding: '16px'}}
                  labelStyle={{fontWeight: 'bold', color: '#1f2937', marginBottom: '8px'}}
                />
                <Legend iconType="circle" wrapperStyle={{paddingTop: '20px', fontWeight: 500, fontSize: '14px', color: '#4b5563'}} />
                <Bar dataKey="enStock" name="En Stock" fill="url(#colorEnStock)" radius={[6, 6, 0, 0]} maxBarSize={45} animationDuration={1500} />
                <Bar dataKey="vendidos" name="Vendidos" fill="url(#colorVendidos)" radius={[6, 6, 0, 0]} maxBarSize={45} animationDuration={1500} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-soft border border-gray-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-glass min-w-0">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-brand-900">Proporción General</h3>
            <span className="px-4 py-1.5 bg-gray-50 text-gray-500 text-xs font-bold uppercase tracking-wider rounded-full">Global</span>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={95}
                  outerRadius={135}
                  fill="#8884d8"
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                  cornerRadius={8}
                  animationDuration={1500}
                >
                  {pieData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={PIE_COLORS[index % PIE_COLORS.length]} 
                      style={{ filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.15))' }}
                    />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{borderRadius: '16px', border: '1px solid #fee2e2', backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(8px)', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)', padding: '16px'}}
                  itemStyle={{color: '#374151', fontWeight: 600}}
                />
                <Legend iconType="circle" wrapperStyle={{paddingTop: '20px', fontWeight: 500, fontSize: '14px', color: '#4b5563'}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
