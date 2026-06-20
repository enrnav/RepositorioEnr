import { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { PackageSearch, TrendingUp, AlertTriangle, Coins, DollarSign, Percent, Sparkles, Check, Edit3, Activity, Plus, Minus, Target, X, LayoutGrid } from 'lucide-react';
import { fetchDashboardStats, fetchProfitMarginReport } from '../api';
import FloatingStoreIconsBg from '../components/FloatingStoreIconsBg';

const PIE_COLORS = ['#D2143A', '#10B981']; // Cost (Cherry Red), Profit (Emerald Green)

const Dashboard = () => {
  const [stats, setStats] = useState({ total_stock: 0, total_sold: 0, low_stock_alerts: 0 });
  const [profitSummary, setProfitSummary] = useState({ total_revenue: 0, total_cost: 0, total_profit: 0, average_margin_percentage: 0 });
  const [chartData, setChartData] = useState([]);
  const [pieData, setPieData] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [dailyGoal, setDailyGoal] = useState(() => {
    const saved = localStorage.getItem('daily_sales_goal');
    return saved ? parseFloat(saved) : 5000;
  });
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(dailyGoal.toString());

  const [visibleSeries, setVisibleSeries] = useState({
    Ingresos: true,
    Costos: true,
    Ganancia: true
  });

  const [layout, setLayout] = useState('standard');
  const [activeCard, setActiveCard] = useState(null);
  const [zoom, setZoom] = useState(1);
  const isDraggingRef = useRef(false);
  const startPointerRef = useRef({ x: 0, y: 0 });
  const draggedPlanetRef = useRef(null);
  const wasDraggedRef = useRef(false);

  const planetsElementsRef = useRef({
    kpis: null,
    goal: null,
    chart: null,
    dist: null,
    table: null
  });

  const planetsRef = useRef({
    kpis: { angle: 45 * Math.PI / 180, radius: 120, speed: 0.15 },
    goal: { angle: 225 * Math.PI / 180, radius: 120, speed: 0.15 },
    chart: { angle: 120 * Math.PI / 180, radius: 222, speed: 0.10 },
    dist: { angle: 300 * Math.PI / 180, radius: 222, speed: 0.10 },
    table: { angle: 0 * Math.PI / 180, radius: 324, speed: 0.07 }
  });

  const requestRef = useRef();

  const adjustZoom = (factor) => {
    setZoom(prev => Math.min(Math.max(prev * factor, 0.65), 1.4));
  };

  const resetZoom = () => {
    setZoom(1);
  };

  const togglePlanet = (planetName) => {
    if (wasDraggedRef.current) {
      wasDraggedRef.current = false;
      return;
    }
    setActiveCard(prev => prev === planetName ? null : planetName);
  };

  const handlePointerDown = (e, planetId) => {
    const planet = planetsRef.current[planetId];
    if (!planet) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    draggedPlanetRef.current = planetId;
    wasDraggedRef.current = false;

    startPointerRef.current = {
      x: e.clientX,
      y: e.clientY
    };
  };

  const handlePointerMove = (e, planetId) => {
    if (!isDraggingRef.current || draggedPlanetRef.current !== planetId) return;

    const dist = Math.hypot(e.clientX - startPointerRef.current.x, e.clientY - startPointerRef.current.y);
    if (dist > 6) {
      wasDraggedRef.current = true;
    }

    const wrapper = planetsElementsRef.current[planetId];
    if (!wrapper) return;

    const rect = wrapper.parentElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;

    const zoomedDx = dx / zoom;
    const zoomedDy = dy / zoom;

    const planet = planetsRef.current[planetId];
    planet.radius = Math.min(Math.max(Math.hypot(zoomedDx, zoomedDy), 45), 360);
    planet.angle = Math.atan2(zoomedDy, zoomedDx);

    const x = planet.radius * Math.cos(planet.angle);
    const y = planet.radius * Math.sin(planet.angle);
    wrapper.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
  };

  const handlePointerUp = (e, planetId) => {
    isDraggingRef.current = false;
    draggedPlanetRef.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  useEffect(() => {
    if (layout !== 'orion') {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      return;
    }

    let lastTime = performance.now();

    const animate = (timestamp) => {
      const dt = (timestamp - lastTime) / 1000;
      lastTime = timestamp;

      Object.keys(planetsRef.current).forEach(pId => {
        const planet = planetsRef.current[pId];
        const element = planetsElementsRef.current[pId];

        if (!element) return;

        const isPaused = activeCard === pId || draggedPlanetRef.current === pId;

        if (!isPaused) {
          planet.angle += planet.speed * dt;
        }

        const x = planet.radius * Math.cos(planet.angle);
        const y = planet.radius * Math.sin(planet.angle);

        element.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
      });

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [layout, activeCard]);

  const handleSaveGoal = () => {
    const val = parseFloat(goalInput);
    if (!isNaN(val) && val > 0) {
      setDailyGoal(val);
      localStorage.setItem('daily_sales_goal', val.toString());
    }
    setIsEditingGoal(false);
  };

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

  const goalProgressPercentage = dailyGoal > 0 ? (profitSummary.total_revenue / dailyGoal) * 100 : 0;

  return (
    <div className={`space-y-8 ${layout === 'orion' ? 'layout-orion-active' : ''}`}>
      {layout === 'orion' && (
        <style dangerouslySetInnerHTML={{ __html: `
          .orion-canvas-container {
            background: rgba(255, 255, 255, 0.25) !important;
            border: 1px solid rgba(231, 229, 228, 0.35) !important;
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.06), 0 10px 25px -3px rgba(5, 150, 105, 0.05);
            transition: background-color 0.4s ease, border-color 0.3s ease;
          }

          .dark .orion-canvas-container {
            background: rgba(28, 25, 23, 0.25) !important;
            border-color: rgba(63, 63, 70, 0.2) !important;
            box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.4), 0 10px 25px -3px rgba(16, 185, 129, 0.08);
          }

          .sphere {
            border-radius: 50%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            cursor: pointer;
            user-select: none;
            transition: box-shadow 0.4s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          }

          .sphere-sun-gradient {
            background: radial-gradient(circle at 35% 30%, #ff8da6 0%, #D2143A 45%, #88001a 85%, #3c000b 100%) !important;
            box-shadow: 0 0 50px rgba(210, 20, 58, 0.45), inset -10px -10px 25px rgba(0,0,0,0.8), inset 10px 10px 20px rgba(255,255,255,0.4) !important;
          }

          .sphere-kpis-color {
            background: radial-gradient(circle at 35% 30%, #60a5fa 0%, #2563eb 45%, #1e3a8a 85%, #0f172a 100%) !important;
            box-shadow: 0 0 35px rgba(37, 99, 235, 0.4), inset -8px -8px 20px rgba(0, 0, 0, 0.75), inset 8px 8px 15px rgba(255, 255, 255, 0.35) !important;
          }

          .sphere-goal-color {
            background: radial-gradient(circle at 35% 30%, #34d399 0%, #059669 45%, #064e3b 85%, #022c22 100%) !important;
            box-shadow: 0 0 35px rgba(16, 185, 129, 0.45), inset -8px -8px 20px rgba(0, 0, 0, 0.75), inset 8px 8px 15px rgba(255, 255, 255, 0.35) !important;
          }

          .sphere-chart-color {
            background: radial-gradient(circle at 35% 30%, #c084fc 0%, #7e22ce 45%, #4c0519 85%, #2e0014 100%) !important;
            box-shadow: 0 0 35px rgba(168, 85, 247, 0.4), inset -8px -8px 20px rgba(0, 0, 0, 0.75), inset 8px 8px 15px rgba(255, 255, 255, 0.35) !important;
          }

          .sphere-dist-color {
            background: radial-gradient(circle at 35% 30%, #fbbf24 0%, #d97706 45%, #78350f 85%, #451a03 100%) !important;
            box-shadow: 0 0 35px rgba(217, 119, 6, 0.4), inset -8px -8px 20px rgba(0, 0, 0, 0.75), inset 8px 8px 15px rgba(255, 255, 255, 0.4) !important;
          }

          .sphere-table-color {
            background: radial-gradient(circle at 35% 30%, #22d3ee 0%, #0891b2 45%, #083344 85%, #022c22 100%) !important;
            box-shadow: 0 0 35px rgba(6, 182, 212, 0.4), inset -8px -8px 20px rgba(0, 0, 0, 0.75), inset 8px 8px 15px rgba(255, 255, 255, 0.35) !important;
          }

          .orbit-wrapper {
            position: absolute !important;
            left: 50% !important;
            top: 50% !important;
            transform: translate(-50%, -50%);
            will-change: transform;
          }

          @media (min-width: 1024px) {
            .layout-orion-active .grid-card {
              position: absolute !important;
              z-index: 50;
              background: rgba(255, 255, 255, 0.45) !important;
              backdrop-filter: blur(16px) !important;
              -webkit-backdrop-filter: blur(16px) !important;
              box-shadow: 0 20px 50px rgba(0, 0, 0, 0.1), 0 0 25px rgba(0,0,0,0.02) !important;
              border-color: rgba(6, 78, 59, 0.08) !important;
              max-height: 480px;
              overflow-y: auto;
              animation: cardFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }

            .dark .layout-orion-active .grid-card {
              background: rgba(28, 25, 23, 0.45) !important;
              border-color: rgba(255, 255, 255, 0.06) !important;
            }
            
            .layout-orion-active #kpis-container {
              top: 6%;
              right: 4%;
              width: 370px;
              padding: 1.25rem !important;
            }
            
            .layout-orion-active #kpis-container .grid {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
              gap: 0.75rem !important;
            }

            .layout-orion-active #kpis-container .card-hover-effect {
              background: rgba(255, 255, 255, 0.6) !important;
              border-color: rgba(231, 229, 228, 0.7) !important;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02) !important;
              border-radius: 1.5rem !important;
              padding: 1rem !important;
            }

            .dark .layout-orion-active #kpis-container .card-hover-effect {
              background: rgba(41, 37, 36, 0.6) !important;
              border-color: rgba(68, 64, 60, 0.4) !important;
            }

            .layout-orion-active #kpis-container .card-hover-effect > div:first-child {
              margin-bottom: 0.75rem !important;
            }
            
            .layout-orion-active #goal-card {
              top: 50%;
              right: 4%;
              width: 480px;
              overflow: hidden;
            }
            
            .layout-orion-active #chart-card {
              top: 6%;
              left: 4%;
              width: 460px;
            }
            
            .layout-orion-active #dist-card {
              top: 54%;
              left: 4%;
              width: 420px;
            }
            
            .layout-orion-active #table-card {
              top: 24%;
              left: 34%;
              width: 450px;
            }
            
            .layout-orion-active #assistant-card {
              top: 48%;
              left: 34%;
              width: 450px;
            }
          /* Mobile / Tablet Responsive styles for Orion Mode */
          @media (max-width: 1023px) {
            .layout-orion-active .grid-card {
              position: fixed !important;
              top: 50% !important;
              left: 50% !important;
              transform: translate(-50%, -50%) !important;
              width: 90% !important;
              max-width: 480px !important;
              max-height: 85vh !important;
              overflow-y: auto !important;
              z-index: 100 !important;
              background: rgba(255, 255, 255, 0.95) !important;
              backdrop-filter: blur(20px) !important;
              -webkit-backdrop-filter: blur(20px) !important;
              box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.3) !important;
              border-radius: 2rem !important;
              padding: 1.5rem !important;
              border: 1px solid rgba(231, 229, 228, 0.9) !important;
              animation: cardFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }

            .dark .layout-orion-active .grid-card {
              background: rgba(28, 25, 23, 0.95) !important;
              border-color: rgba(68, 64, 60, 0.8) !important;
            }

            .layout-orion-active .grid-card button[type="button"].absolute {
              top: 0.75rem !important;
              right: 0.75rem !important;
            }
          }

          @keyframes cardFadeIn {
            0% { opacity: 0; transform: scale(0.95) translateY(10px); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}} />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 animate-fade-in">
        <h2 className="text-xl sm:text-3xl font-black text-brand-900 tracking-tight flex items-center gap-2">
          <TrendingUp className="text-chiluda-red w-8 h-8 shrink-0" />
          <span>Panel de Control Financiero</span>
        </h2>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Selector de Layout */}
          <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-2xl border border-stone-200/50 text-xs font-bold text-stone-600 dark:text-stone-400">
            <button
              type="button"
              onClick={() => { setLayout('standard'); setActiveCard(null); }}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                layout === 'standard' 
                  ? 'bg-white dark:bg-stone-700 shadow-sm text-brand-900 dark:text-stone-100' 
                  : 'hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              <LayoutGrid size={14} />
              <span>Clásica</span>
            </button>
            <button
              type="button"
              onClick={() => { setLayout('orion'); setActiveCard(null); }}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                layout === 'orion' 
                  ? 'bg-white dark:bg-stone-700 shadow-sm text-brand-900 dark:text-stone-100' 
                  : 'hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              <Activity size={14} className={layout === 'orion' ? 'text-chiluda-red' : ''} />
              <span>Orion</span>
            </button>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-900/5 text-brand-900 text-[10px] font-black rounded-full border border-brand-900/10 uppercase tracking-widest self-start sm:self-auto">
            <Activity size={12} className="text-chiluda-red animate-pulse" />
            Monitoreo en Tiempo Real
          </span>
        </div>
      </div>      {/* Orion Layout Canvas */}
      {layout === 'orion' && (
        <div id="orion-layout-container" className="relative w-full">
          {/* ZOOM CONTROLS (Capsule style) */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 bg-stone-900/90 dark:bg-stone-950/95 p-3 rounded-full border border-stone-200/10 dark:border-white/5 z-20 text-stone-300 text-xs shadow-xl">
            <button type="button" onClick={() => adjustZoom(1.15)} className="p-1.5 hover:text-white hover:scale-110 active:scale-95 transition-all text-stone-400 hover:text-stone-100" title="Zoom In"><Plus size={16} /></button>
            <button type="button" onClick={() => adjustZoom(0.85)} className="p-1.5 hover:text-white hover:scale-110 active:scale-95 transition-all text-stone-400 hover:text-stone-100" title="Zoom Out"><Minus size={16} /></button>
            <button type="button" onClick={resetZoom} className="p-1.5 hover:text-white hover:scale-110 active:scale-95 transition-all text-stone-400 hover:text-stone-100" title="Restablecer"><Target size={16} /></button>
          </div>

          {/* SOLAR SYSTEM CANVAS (Themed card background style) */}
          <div className="relative w-full h-[580px] md:h-[780px] orion-canvas-container overflow-hidden flex items-center justify-center p-6 bg-stone-50/50 dark:bg-stone-950/40 border border-stone-200/80 dark:border-white/5 rounded-[3rem] shadow-soft">
            {/* Background floating store icons animation specific to Orion container */}
            <FloatingStoreIconsBg className="absolute inset-0 opacity-40 pointer-events-none" />

            {/* Responsive wrapper to automatically scale down the solar system on smaller screens */}
            <div className="absolute inset-0 flex items-center justify-center scale-[0.58] sm:scale-[0.8] md:scale-95 lg:scale-100 origin-center pointer-events-none">
              
              {/* SVG Orbit Lines (Responsive stroke colors) */}
              <svg className="absolute w-[500px] h-[500px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-stone-200 dark:text-stone-800 opacity-30" viewBox="0 0 500 500">
                <line x1="50" y1="250" x2="450" y2="250" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 8" />
                <line x1="250" y1="50" x2="250" y2="450" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 8" />

                <circle cx="250" cy="250" r="120" stroke="currentColor" strokeWidth="1.2" fill="none" strokeDasharray="3 5" />
              </svg>

              {/* Planets and Sun Wrapper */}
              <div id="orion-spheres-wrapper" style={{ transform: `scale(${zoom})`, transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }} className="absolute inset-0 flex items-center justify-center pointer-events-auto">
              
              {/* Central Sun (Toggles Didactic Assistant) */}
              <div className="absolute z-20 flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => togglePlanet('assistant')}
                  className={`sphere sphere-sun-gradient w-32 h-32 cursor-pointer flex flex-col items-center justify-center text-center outline-none select-none transition-all ${
                    activeCard === 'assistant' ? 'ring-4 ring-brand-500 scale-110' : ''
                  }`}
                >
                  <span className="text-[10px] font-black text-white/70 uppercase tracking-widest leading-none mb-1">Central</span>
                  <span className="text-xs sm:text-sm font-outfit font-black text-white leading-tight uppercase px-3">ED & E</span>
                  <span className="text-[8px] font-bold text-white/50 uppercase mt-1 leading-none">Asistente</span>
                </button>
              </div>

              {/* KPIs Planet */}
              <div ref={el => { planetsElementsRef.current.kpis = el; }} className="orbit-wrapper absolute z-10 flex items-center justify-center">
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'kpis')}
                  onPointerMove={(e) => handlePointerMove(e, 'kpis')}
                  onPointerUp={(e) => handlePointerUp(e, 'kpis')}
                  onClick={() => togglePlanet('kpis')}
                  className={`sphere sphere-kpis-color w-24 h-24 flex flex-col items-center justify-center text-center cursor-pointer select-none transition-all ${
                    activeCard === 'kpis' ? 'ring-4 ring-blue-500 scale-110' : ''
                  }`}
                >
                  <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest mb-1">KPIs</span>
                  <span className="text-sm font-outfit font-extrabold text-white leading-none tracking-wide">
                    ${profitSummary.total_revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>

              {/* Goal Planet */}
              <div ref={el => { planetsElementsRef.current.goal = el; }} className="orbit-wrapper absolute z-10 flex items-center justify-center">
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'goal')}
                  onPointerMove={(e) => handlePointerMove(e, 'goal')}
                  onPointerUp={(e) => handlePointerUp(e, 'goal')}
                  onClick={() => togglePlanet('goal')}
                  className={`sphere sphere-goal-color w-24 h-24 flex flex-col items-center justify-center text-center cursor-pointer select-none transition-all ${
                    activeCard === 'goal' ? 'ring-4 ring-emerald-500 scale-110' : ''
                  }`}
                >
                  <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest mb-1">Meta</span>
                  <span className="text-sm font-outfit font-extrabold text-white leading-none tracking-wide">
                    {goalProgressPercentage.toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Chart Planet */}
              <div ref={el => { planetsElementsRef.current.chart = el; }} className="orbit-wrapper absolute z-10 flex items-center justify-center">
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'chart')}
                  onPointerMove={(e) => handlePointerMove(e, 'chart')}
                  onPointerUp={(e) => handlePointerUp(e, 'chart')}
                  onClick={() => togglePlanet('chart')}
                  className={`sphere sphere-chart-color w-24 h-24 flex flex-col items-center justify-center text-center cursor-pointer select-none transition-all ${
                    activeCard === 'chart' ? 'ring-4 ring-purple-500 scale-110' : ''
                  }`}
                >
                  <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest mb-1">Gráfica</span>
                  <span className="text-xs font-outfit font-extrabold text-white leading-none tracking-wide">Historial</span>
                </div>
              </div>

              {/* Distribución Planet */}
              <div ref={el => { planetsElementsRef.current.dist = el; }} className="orbit-wrapper absolute z-10 flex items-center justify-center">
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'dist')}
                  onPointerMove={(e) => handlePointerMove(e, 'dist')}
                  onPointerUp={(e) => handlePointerUp(e, 'dist')}
                  onClick={() => togglePlanet('dist')}
                  className={`sphere sphere-dist-color w-24 h-24 flex flex-col items-center justify-center text-center cursor-pointer select-none transition-all ${
                    activeCard === 'dist' ? 'ring-4 ring-amber-500 scale-110' : ''
                  }`}
                >
                  <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest mb-1">Distribución</span>
                  <span className="text-xs font-outfit font-extrabold text-white leading-none tracking-wide">Proporción</span>
                </div>
              </div>

              {/* Tabla Planet */}
              <div ref={el => { planetsElementsRef.current.table = el; }} className="orbit-wrapper absolute z-10 flex items-center justify-center">
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'table')}
                  onPointerMove={(e) => handlePointerMove(e, 'table')}
                  onPointerUp={(e) => handlePointerUp(e, 'table')}
                  onClick={() => togglePlanet('table')}
                  className={`sphere sphere-table-color w-24 h-24 flex flex-col items-center justify-center text-center cursor-pointer select-none transition-all ${
                    activeCard === 'table' ? 'ring-4 ring-cyan-500 scale-110' : ''
                  }`}
                >
                  <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest mb-1">Clasificación</span>
                  <span className="text-xs font-outfit font-extrabold text-white leading-none tracking-wide">Tabla</span>
                </div>
              </div>

              {/* Absolute coordinate anchors for lg screens */}
              <div id="orion-cards-anchor-scope" className="contents"></div>

            </div>
          </div>
        </div>
      </div>
      )}

      {/* Daily Sales Goal Banner */}
      <div
        id="goal-card"
        className={`bg-gradient-to-r from-emerald-500/10 to-teal-500/10 backdrop-blur-[2px] p-6 rounded-[2rem] border border-emerald-500/25 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 animate-slide-up relative ${
          layout === 'orion'
            ? `grid-card ${activeCard === 'goal' ? '' : 'hidden'}`
            : ''
        }`}
      >
        {layout === 'orion' && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setActiveCard(null); }}
            className="absolute top-4 right-4 text-emerald-800 hover:text-emerald-950 transition-colors z-50"
          >
            <X size={16} />
          </button>
        )}
        <div className="space-y-2 flex-1 w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-emerald-800">
              <Sparkles size={16} className="animate-pulse" />
              <span className="text-xs font-black tracking-widest uppercase">Meta de Ventas Diaria</span>
            </div>
            <div className="flex items-center space-x-2">
              {isEditingGoal ? (
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    className="w-24 px-2 py-1 text-xs border border-emerald-300 rounded-lg text-brand-900 font-extrabold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveGoal()}
                    autoFocus
                  />
                  <button type="button" onClick={handleSaveGoal} className="p-1 text-emerald-600 hover:text-emerald-800">
                    <Check size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-bold text-emerald-700">Objetivo: <strong className="text-emerald-900">${dailyGoal.toLocaleString()}</strong></span>
                  <button type="button" onClick={() => { setGoalInput(dailyGoal.toString()); setIsEditingGoal(true); }} className="p-1 text-emerald-600 hover:text-emerald-800">
                    <Edit3 size={12} />
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <div className="relative">
            <div className="flex justify-between items-center text-xs font-black text-brand-900 mb-1">
              <span>Procesado: ${profitSummary.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              <span>{goalProgressPercentage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-stone-200/60 rounded-full h-3.5 overflow-hidden p-0.5 border border-white/20">
              <div 
                className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all duration-1000 ease-out shadow-inner"
                style={{ width: `${goalProgressPercentage}%` }}
              />
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-white/70 rounded-2xl border border-emerald-500/20 text-center shrink-0 w-full md:w-auto">
          <p className="text-[10px] font-black text-stone-400 uppercase tracking-wider mb-1">Estado de Salud</p>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
            goalProgressPercentage >= 100 ? 'bg-emerald-100 text-emerald-800 animate-bounce' :
            goalProgressPercentage >= 75 ? 'bg-teal-50 text-teal-800' :
            goalProgressPercentage >= 50 ? 'bg-blue-50 text-blue-800' :
            'bg-amber-50 text-amber-800'
          }`}>
            {goalProgressPercentage >= 100 ? '¡Meta Superada! 🎉' :
             goalProgressPercentage >= 75 ? 'Excelente Ritmo 🚀' :
             goalProgressPercentage >= 50 ? 'Buen Avance 📈' :
             'Iniciando el Día ☕'}
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div
        id="kpis-container"
        className={`relative ${
          layout === 'orion'
            ? `grid-card ${activeCard === 'kpis' ? '' : 'hidden'}`
            : ''
        }`}
      >
        {layout === 'orion' && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setActiveCard(null); }}
            className="absolute top-2 right-2 p-1.5 bg-stone-100/90 hover:bg-stone-200/90 dark:bg-stone-800/85 dark:hover:bg-stone-700/85 rounded-full text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100 transition-all z-50 shadow-sm hover:scale-105 active:scale-95 animate-fade-in"
          >
            <X size={14} />
          </button>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-slide-up">
          {/* Card 1: Ingresos Totales */}
          <div className="bg-white/95 backdrop-blur-[2px] p-6 rounded-[2rem] shadow-soft border border-stone-200/80 hover:-translate-y-1.5 hover:shadow-xl hover:border-blue-500/20 transition-all duration-300 flex flex-col justify-between group cursor-default card-hover-effect">
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
          <div className="bg-white/95 backdrop-blur-[2px] p-6 rounded-[2rem] shadow-soft border border-stone-200/80 hover:-translate-y-1.5 hover:shadow-xl hover:border-emerald-500/20 transition-all duration-300 flex flex-col justify-between group cursor-default card-hover-effect">
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
          <div className="bg-white/95 backdrop-blur-[2px] p-6 rounded-[2rem] shadow-soft border border-stone-200/80 hover:-translate-y-1.5 hover:shadow-xl hover:border-purple-500/20 transition-all duration-300 flex flex-col justify-between group cursor-default card-hover-effect">
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
          <div className="bg-white/95 backdrop-blur-[2px] p-6 rounded-[2rem] shadow-soft border border-stone-200/80 hover:-translate-y-1.5 hover:shadow-xl hover:border-amber-500/20 transition-all duration-300 flex flex-col justify-between group cursor-default card-hover-effect">
            <div className="flex justify-between items-start mb-6">
              <p className="text-stone-400 font-black tracking-widest text-[10px] uppercase">Alertas de Stock</p>
              <div className={`p-2.5 rounded-xl group-hover:scale-110 transition-transform ${stats.low_stock_alerts > 0 ? 'bg-amber-500/10' : 'bg-stone-100'}`}>
                <AlertTriangle className={`w-5 h-5 ${stats.low_stock_alerts > 0 ? 'text-amber-600 animate-pulse' : 'text-stone-400'}`} />
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
      </div>

      {/* Charts Section */}
      <div className={layout === 'standard' ? "grid grid-cols-1 lg:grid-cols-3 gap-8 animate-slide-up" : "contents"} style={layout === 'standard' ? { animationDelay: '0.05s' } : undefined}>
        {/* Area Chart: Revenues vs Costs vs Profits */}
        <div
          id="chart-card"
          className={`lg:col-span-2 bg-white/95 backdrop-blur-2xl p-6 sm:p-8 rounded-[2rem] shadow-soft border border-stone-200/80 min-w-0 flex flex-col justify-between relative ${
            layout === 'orion'
              ? `grid-card ${activeCard === 'chart' ? '' : 'hidden'}`
              : ''
          }`}
        >
          {layout === 'orion' && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setActiveCard(null); }}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 transition-colors z-50"
            >
              <X size={16} />
            </button>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3 border-b border-stone-100 pb-4">
            <div>
              <h3 className="text-lg font-black text-brand-900">Rentabilidad por Producto</h3>
              <p className="text-[10px] text-stone-400 font-bold uppercase mt-0.5">Filtra y visualiza ingresos, costos y ganancias netas</p>
            </div>
            
            {/* Interactive series toggle buttons */}
            <div className="flex flex-wrap gap-1.5 text-[9px] uppercase tracking-wider">
              <button
                type="button"
                onClick={() => setVisibleSeries(prev => ({ ...prev, Ingresos: !prev.Ingresos }))}
                className={`px-3 py-1.5 rounded-full font-black border transition-all active:scale-95 ${
                  visibleSeries.Ingresos 
                    ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' 
                    : 'bg-stone-50 border-stone-200 text-stone-400'
                }`}
              >
                Ingresos
              </button>
              <button
                type="button"
                onClick={() => setVisibleSeries(prev => ({ ...prev, Costos: !prev.Costos }))}
                className={`px-3 py-1.5 rounded-full font-black border transition-all active:scale-95 ${
                  visibleSeries.Costos 
                    ? 'bg-red-50 border-red-200 text-red-700 shadow-sm' 
                    : 'bg-stone-50 border-stone-200 text-stone-400'
                }`}
              >
                Costos
              </button>
              <button
                type="button"
                onClick={() => setVisibleSeries(prev => ({ ...prev, Ganancia: !prev.Ganancia }))}
                className={`px-3 py-1.5 rounded-full font-black border transition-all active:scale-95 ${
                  visibleSeries.Ganancia 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' 
                    : 'bg-stone-50 border-stone-200 text-stone-400'
                }`}
              >
                Ganancia
              </button>
            </div>
          </div>
          
          <div className="h-80 flex-1 min-h-0">
            <ResponsiveContainer key={activeCard} width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorCostos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D2143A" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#D2143A" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorGanancia" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                <XAxis dataKey="name" tick={{fill: '#a8a29e', fontSize: 10, fontWeight: 500}} axisLine={false} tickLine={false} tickMargin={10} />
                <YAxis tick={{fill: '#a8a29e', fontSize: 10, fontWeight: 500}} axisLine={false} tickLine={false} tickMargin={10} />
                <Tooltip 
                  contentStyle={{borderRadius: '16px', border: '1px solid #ffe4e6', backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(8px)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)'}}
                  labelStyle={{fontWeight: 'bold', color: '#1c1917'}}
                />
                {visibleSeries.Ingresos && (
                  <Area type="monotone" dataKey="Ingresos" stroke="#3B82F6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorIngresos)" />
                )}
                {visibleSeries.Costos && (
                  <Area type="monotone" dataKey="Costos" stroke="#D2143A" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCostos)" />
                )}
                {visibleSeries.Ganancia && (
                  <Area type="monotone" dataKey="Ganancia" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorGanancia)" />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart: Cost vs Net profit */}
        <div
          id="dist-card"
          className={`lg:col-span-1 bg-white/95 backdrop-blur-2xl p-6 sm:p-8 rounded-[2rem] shadow-soft border border-stone-200/80 min-w-0 relative ${
            layout === 'orion'
              ? `grid-card ${activeCard === 'dist' ? '' : 'hidden'}`
              : ''
          }`}
        >
          {layout === 'orion' && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setActiveCard(null); }}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 transition-colors z-50"
            >
              <X size={16} />
            </button>
          )}
          <div className="flex items-center justify-between mb-6 border-b border-stone-100 pb-4">
            <div>
              <h3 className="text-lg font-black text-brand-900">Distribución</h3>
              <p className="text-[10px] text-stone-400 font-bold uppercase mt-0.5">Costo vs Margen de ganancia</p>
            </div>
            <span className="px-2.5 py-1 bg-stone-100 text-stone-605 text-[9px] font-black uppercase tracking-wider rounded-full">Proporción</span>
          </div>
          <div className="h-80 flex items-center justify-center">
            {profitSummary.total_revenue > 0 ? (
              <ResponsiveContainer key={activeCard} width="100%" height={280}>
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
                    contentStyle={{borderRadius: '16px', border: '1px solid #ffe4e6', backgroundColor: 'rgba(255, 255, 255, 0.95)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)'}}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-stone-400 text-xs font-bold uppercase tracking-wider">No hay ventas registradas para graficar.</div>
            )}
          </div>
        </div>
      </div>

      {/* Top Sold Products table with Profit margins */}
      <div
        id="table-card"
        className={`bg-white/95 backdrop-blur-[2px] rounded-[2rem] shadow-soft border border-stone-200/60 overflow-hidden animate-slide-up relative ${
          layout === 'orion'
            ? `grid-card ${activeCard === 'table' ? '' : 'hidden'}`
            : ''
        }`}
        style={layout === 'standard' ? { animationDelay: '0.1s' } : undefined}
      >
        {layout === 'orion' && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setActiveCard(null); }}
            className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 transition-colors z-50 z-50"
          >
            <X size={16} />
          </button>
        )}
        <div className="p-6 border-b border-stone-100 bg-white/40">
          <h3 className="text-lg font-black text-brand-900">Clasificación de Productos y Márgenes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-stone-50 text-stone-605 text-[10px] font-black uppercase tracking-wider border-b border-stone-100">
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

      {/* Financial Didactic Assistant */}
      <div
        id="assistant-card"
        className={`bg-white/95 backdrop-blur-md p-6 sm:p-8 rounded-[2.5rem] shadow-soft border border-stone-200/60 animate-slide-up relative ${
          layout === 'orion'
            ? `grid-card ${activeCard === 'assistant' ? '' : 'hidden'}`
            : ''
        }`}
      >
        {layout === 'orion' && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setActiveCard(null); }}
            className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 transition-colors z-50"
          >
            <X size={16} />
          </button>
        )}
        <div className="flex items-center space-x-2 text-brand-900 mb-4 border-b border-stone-100 pb-3">
          <Activity className="text-chiluda-red w-5 h-5 shrink-0" />
          <h3 className="text-base font-black uppercase tracking-wider">Asistente Didáctico Financiero</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs leading-relaxed font-semibold text-stone-650">
          <div className="p-4 bg-brand-50/50 rounded-2xl border border-stone-100 flex flex-col justify-between">
            <div>
              <h4 className="font-extrabold text-brand-900 uppercase tracking-wider text-[9px] mb-1.5 text-stone-400">Márgenes de Utilidad</h4>
              <p>
                {profitSummary.average_margin_percentage >= 25 
                  ? "Tu margen promedio es excelente (" + profitSummary.average_margin_percentage.toFixed(1) + "%). El negocio genera retornos sólidos sobre los costos de adquisición."
                  : "Tu margen promedio está por debajo del 25%. Intenta renegociar precios de costo con tus proveedores o ajustar precios de venta de manera competitiva."}
              </p>
            </div>
          </div>
          <div className="p-4 bg-brand-50/50 rounded-2xl border border-stone-100 flex flex-col justify-between">
            <div>
              <h4 className="font-extrabold text-brand-900 uppercase tracking-wider text-[9px] mb-1.5 text-stone-400">Eficiencia de Inventario</h4>
              <p>
                {stats.low_stock_alerts > 0 
                  ? "Alerta: Tienes " + stats.low_stock_alerts + " productos bajos en stock. El desabastecimiento prolongado provoca una pérdida directa en las ventas estimadas de hoy."
                  : "¡Felicidades! Todo el inventario se mantiene arriba del stock de seguridad, asegurando la satisfacción al cliente y continuidad comercial."}
              </p>
            </div>
          </div>
          <div className="p-4 bg-brand-50/50 rounded-2xl border border-stone-100 flex flex-col justify-between">
            <div>
              <h4 className="font-extrabold text-brand-900 uppercase tracking-wider text-[9px] mb-1.5 text-stone-400">Rotación Comercial</h4>
              <p>
                {profitSummary.total_revenue > 0
                  ? "La ganancia neta es del " + ((profitSummary.total_profit / profitSummary.total_revenue) * 100).toFixed(1) + "% de tus ingresos totales. Mantener este ratio permite reinvertir de forma saludable en el negocio."
                  : "Registra ventas en el Punto de Venta para comenzar a analizar la conversión de ingresos a ganancias reales."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
