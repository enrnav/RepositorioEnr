import { useState, useEffect, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { PackageSearch, TrendingUp, AlertTriangle, Coins, DollarSign, Percent, Sparkles, Check, Edit3, Activity, Plus, Minus, Target, X, LayoutGrid, ArrowUpRight, ArrowDownRight, CreditCard, Wallet } from 'lucide-react';
import { fetchDashboardStats, fetchProfitMarginReport, fetchDashboardDetails } from '../api';
import FloatingStoreIconsBg from '../components/FloatingStoreIconsBg';

const PIE_COLORS = ['#D2143A', '#10B981']; 

const Dashboard = () => {
  const [stats, setStats] = useState({ total_stock: 0, total_sold: 0, low_stock_alerts: 0 });
  const [profitSummary, setProfitSummary] = useState({ total_revenue: 0, costo_total: 0, total_profit: 0, average_margin_percentage: 0 });
  const [dashboardDetails, setDashboardDetails] = useState({
    today: { revenue: 0, profit: 0, yesterday_revenue: 0, yesterday_profit: 0 },
    month: { revenue: 0, profit: 0, last_month_revenue: 0, last_month_profit: 0 },
    credit: { total_owed: 0 },
    time_series: [],
    payment_methods: { cash: 0, card: 0, credit: 0, total: 0 }
  });
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
  const [hoveredPlanet, setHoveredPlanet] = useState(null);
  const [parallaxOffset, setParallaxOffset] = useState({ x: 0, y: 0 });
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

  const handleCanvasMouseMove = (e) => {
    if (layout !== 'orion') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / rect.width - 0.5;
    const mouseY = (e.clientY - rect.top) / rect.height - 0.5;
    setParallaxOffset({ x: mouseX, y: mouseY });
  };

  const handleCanvasMouseLeave = () => {
    setParallaxOffset({ x: 0, y: 0 });
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

    const line = document.getElementById(`gravity-line-${planetId}`);
    if (line) {
      line.setAttribute('x2', 360 + x);
      line.setAttribute('y2', 360 + y);
    }
    const ring = document.getElementById(`orbit-ring-${planetId}`);
    if (ring) {
      ring.setAttribute('r', planet.radius);
    }
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

    const animate = (fecha_hora) => {
      const dt = (fecha_hora - lastTime) / 1000;
      lastTime = fecha_hora;

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

        const line = document.getElementById(`gravity-line-${pId}`);
        if (line) {
          line.setAttribute('x2', 360 + x);
          line.setAttribute('y2', 360 + y);
        }

        const ring = document.getElementById(`orbit-ring-${pId}`);
        if (ring) {
          ring.setAttribute('r', planet.radius);
        }
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
        
        try {
          const detailsData = await fetchDashboardDetails();
          setDashboardDetails(detailsData);
        } catch (detailsErr) {
          console.error("Error loading dashboard details:", detailsErr);
        }
        
        setPieData([
          { name: 'Costo Total ($)', value: marginData.summary.costo_total },
          { name: 'Ganancia Neta ($)', value: marginData.summary.total_profit },
        ]);

        const top5 = marginData.products.slice(0, 5).map(item => ({
          name: item.nombre_producto,
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
          /* 1. Canvas styling: Sci-Fi grid backdrop */
          .orion-canvas-container {
            background: transparent !important;
            background-imagen: none !important;
            border: 2px solid rgba(255, 255, 255, 0.3) !important;
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            box-shadow: none !important;
            transition: background-color 0.4s ease, border-color 0.3s ease, box-shadow 0.4s ease;
          }

          .orion-canvas-container::before {
            content: "" !important;
            position: absolute !important;
            inset: 0 !important;
            background-imagen: 
              radial-gradient(rgba(99, 102, 241, 0.07) 1.5px, transparent 1.5px) !important;
            background-size: 24px 24px !important;
            background-position: center !important;
            pointer-events: none !important;
            z-index: 0 !important;
          }

          .dark .orion-canvas-container {
            background: #04020c !important; /* Space-like background in dark mode */
            background-imagen: radial-gradient(at 0% 0%, #0d0921 0px, transparent 50%),
                              radial-gradient(at 50% 0%, #051410 0px, transparent 50%),
                              radial-gradient(at 100% 100%, #17041b 0px, transparent 50%),
                              radial-gradient(1px 1px at 40px 80px, rgba(255,255,255,0.7), transparent),
                              radial-gradient(1.5px 1.5px at 120px 240px, rgba(255,255,255,0.8), transparent),
                              radial-gradient(1px 1px at 280px 140px, rgba(255,255,255,0.6), transparent),
                              radial-gradient(2px 2px at 450px 480px, rgba(255,255,255,0.7), transparent),
                              radial-gradient(1px 1px at 580px 320px, rgba(255,255,255,0.5), transparent),
                              radial-gradient(1.5px 1.5px at 700px 180px, rgba(255,255,255,0.7), transparent) !important;
            border-color: rgba(139, 92, 246, 0.15) !important;
            box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.6), 0 10px 25px -3px rgba(16, 185, 129, 0.08) !important;
          }

          .dark .orion-canvas-container::before {
            background-imagen: 
              radial-gradient(rgba(255, 255, 255, 0.02) 1.5px, transparent 1.5px) !important;
            background-size: 24px 24px !important;
          }

          /* 2. Glassmorphism overlay for spheres */
          .sphere {
            position: relative;
            border-radius: 50%;
            display: flex;
            flex-direction: column;
            align-elementos: center;
            justify-content: center;
            text-align: center;
            cursor: pointer;
            user-select: none;
            overflow: visible !important;
            transition: box-shadow 0.4s ease, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          }

          /* Glossy 3D overlay for planet spheres */
          .sphere::after {
            content: '';
            position: absolute;
            inset: 3px;
            border-radius: 50%;
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0) 50%, rgba(0, 0, 0, 0.25) 100%);
            pointer-events: none;
            z-index: 5;
          }

          .sphere:hover {
            transform: scale(1.08) !important;
            z-index: 30 !important;
          }

          /* Central Sun (Assistant) */
          .sphere-sun-gradient {
            background: radial-gradient(circle at 30% 30%, #ffe4e6 0%, #ff5a79 40%, #d2143a 80%, #9f1239 100%) !important;
            box-shadow: 0 12px 35px rgba(210, 20, 58, 0.35), inset -6px -6px 15px rgba(0,0,0,0.7), inset 6px 6px 15px rgba(255,255,255,0.45) !important;
          }
          .sphere-sun-gradient:hover {
            box-shadow: 0 12px 45px rgba(210, 20, 58, 0.55), inset -6px -6px 15px rgba(0,0,0,0.7), inset 6px 6px 15px rgba(255,255,255,0.45) !important;
          }

          .dark .sphere-sun-gradient {
            background: radial-gradient(circle at 35% 30%, #ff9ebb 0%, #D2143A 48%, #88001a 85%, #3c000b 100%) !important;
            box-shadow: 0 0 50px rgba(210, 20, 58, 0.55), inset -10px -10px 25px rgba(0,0,0,0.85), inset 10px 10px 20px rgba(255,255,255,0.45) !important;
          }
          .dark .sphere-sun-gradient:hover {
            box-shadow: 0 0 65px rgba(210, 20, 58, 0.7), inset -10px -10px 25px rgba(0,0,0,0.85), inset 10px 10px 20px rgba(255,255,255,0.45) !important;
          }

          /* Planet custom radial gradients */
          .sphere-kpis-color {
            background: radial-gradient(circle at 30% 30%, #93c5fd 0%, #2563eb 50%, #1e40af 100%) !important;
            box-shadow: 0 10px 30px rgba(37, 99, 235, 0.35), inset -6px -6px 15px rgba(0,0,0,0.7), inset 6px 6px 15px rgba(255,255,255,0.45) !important;
          }
          .sphere-kpis-color:hover {
            box-shadow: 0 10px 40px rgba(37, 99, 235, 0.55), inset -6px -6px 15px rgba(0,0,0,0.7), inset 6px 6px 15px rgba(255,255,255,0.45) !important;
          }
          .dark .sphere-kpis-color {
            background: radial-gradient(circle at 35% 30%, #60a5fa 0%, #2563eb 45%, #1e3a8a 85%, #0f172a 100%) !important;
            box-shadow: 0 0 35px rgba(37, 99, 235, 0.4), inset -8px -8px 20px rgba(0, 0, 0, 0.75), inset 8px 8px 15px rgba(255, 255, 255, 0.35) !important;
          }
          .dark .sphere-kpis-color:hover {
            box-shadow: 0 0 50px rgba(37, 99, 235, 0.65), inset -8px -8px 20px rgba(0, 0, 0, 0.75), inset 8px 8px 15px rgba(255, 255, 255, 0.35) !important;
          }

          .sphere-goal-color {
            background: radial-gradient(circle at 30% 30%, #a7f3d0 0%, #10b981 50%, #065f46 100%) !important;
            box-shadow: 0 10px 30px rgba(16, 185, 129, 0.35), inset -6px -6px 15px rgba(0,0,0,0.7), inset 6px 6px 15px rgba(255,255,255,0.45) !important;
          }
          .sphere-goal-color:hover {
            box-shadow: 0 10px 40px rgba(16, 185, 129, 0.55), inset -6px -6px 15px rgba(0,0,0,0.7), inset 6px 6px 15px rgba(255,255,255,0.45) !important;
          }
          .dark .sphere-goal-color {
            background: radial-gradient(circle at 35% 30%, #34d399 0%, #059669 45%, #064e3b 85%, #022c22 100%) !important;
            box-shadow: 0 0 35px rgba(16, 185, 129, 0.45), inset -8px -8px 20px rgba(0, 0, 0, 0.75), inset 8px 8px 15px rgba(255, 255, 255, 0.35) !important;
          }
          .dark .sphere-goal-color:hover {
            box-shadow: 0 0 50px rgba(16, 185, 129, 0.68), inset -8px -8px 20px rgba(0, 0, 0, 0.75), inset 8px 8px 15px rgba(255, 255, 255, 0.35) !important;
          }

          .sphere-chart-color {
            background: radial-gradient(circle at 30% 30%, #f3e8ff 0%, #a855f7 50%, #6b21a8 100%) !important;
            box-shadow: 0 10px 30px rgba(168, 85, 247, 0.35), inset -6px -6px 15px rgba(0,0,0,0.7), inset 6px 6px 15px rgba(255,255,255,0.45) !important;
          }
          .sphere-chart-color:hover {
            box-shadow: 0 10px 40px rgba(168, 85, 247, 0.55), inset -6px -6px 15px rgba(0,0,0,0.7), inset 6px 6px 15px rgba(255,255,255,0.45) !important;
          }
          .dark .sphere-chart-color {
            background: radial-gradient(circle at 35% 30%, #c084fc 0%, #7e22ce 45%, #4c0519 85%, #2e0014 100%) !important;
            box-shadow: 0 0 35px rgba(168, 85, 247, 0.4), inset -8px -8px 20px rgba(0, 0, 0, 0.75), inset 8px 8px 15px rgba(255, 255, 255, 0.35) !important;
          }
          .dark .sphere-chart-color:hover {
            box-shadow: 0 0 50px rgba(168, 85, 247, 0.65), inset -8px -8px 20px rgba(0, 0, 0, 0.75), inset 8px 8px 15px rgba(255, 255, 255, 0.35) !important;
          }

          .sphere-dist-color {
            background: radial-gradient(circle at 30% 30%, #fef3c7 0%, #d97706 50%, #78350f 100%) !important;
            box-shadow: 0 10px 30px rgba(217, 119, 6, 0.35), inset -6px -6px 15px rgba(0,0,0,0.7), inset 6px 6px 15px rgba(255,255,255,0.45) !important;
          }
          .sphere-dist-color:hover {
            box-shadow: 0 10px 40px rgba(217, 119, 6, 0.55), inset -6px -6px 15px rgba(0,0,0,0.7), inset 6px 6px 15px rgba(255, 255, 255, 0.45) !important;
          }
          .dark .sphere-dist-color {
            background: radial-gradient(circle at 35% 30%, #fbbf24 0%, #d97706 45%, #78350f 85%, #451a03 100%) !important;
            box-shadow: 0 0 35px rgba(217, 119, 6, 0.4), inset -8px -8px 20px rgba(0, 0, 0, 0.75), inset 8px 8px 15px rgba(255, 255, 255, 0.4) !important;
          }
          .dark .sphere-dist-color:hover {
            box-shadow: 0 0 50px rgba(217, 119, 6, 0.65), inset -8px -8px 20px rgba(0, 0, 0, 0.75), inset 8px 8px 15px rgba(255, 255, 255, 0.4) !important;
          }

          .sphere-table-color {
            background: radial-gradient(circle at 30% 30%, #cffafe 0%, #06b6d4 50%, #0369a1 100%) !important;
            box-shadow: 0 10px 30px rgba(6, 182, 212, 0.35), inset -6px -6px 15px rgba(0,0,0,0.7), inset 6px 6px 15px rgba(255,255,255,0.45) !important;
          }
          .sphere-table-color:hover {
            box-shadow: 0 10px 40px rgba(6, 182, 212, 0.55), inset -6px -6px 15px rgba(0,0,0,0.7), inset 6px 6px 15px rgba(255,255,255,0.45) !important;
          }
          .dark .sphere-table-color {
            background: radial-gradient(circle at 35% 30%, #22d3ee 0%, #0891b2 45%, #083344 85%, #022c22 100%) !important;
            box-shadow: 0 0 35px rgba(6, 182, 212, 0.4), inset -8px -8px 20px rgba(0, 0, 0, 0.75), inset 8px 8px 15px rgba(255, 255, 255, 0.35) !important;
          }
          .dark .sphere-table-color:hover {
            box-shadow: 0 0 50px rgba(6, 182, 212, 0.65), inset -8px -8px 20px rgba(0, 0, 0, 0.75), inset 8px 8px 15px rgba(255, 255, 255, 0.35) !important;
          }

          /* 3. Orbit layout paths styling */
          .orbit-wrapper {
            position: absolute !important;
            left: 50% !important;
            top: 50% !important;
            transform: translate(-50%, -50%);
            will-change: transform;
          }

          .orion-canvas-container circle {
            stroke-linecap: round;
            transition: stroke 0.3s ease, stroke-width 0.3s ease, stroke-dasharray 0.3s ease, filter 0.3s ease;
          }

          @keyframes flowOrbit {
            from { stroke-dashoffset: 200; }
            to { stroke-dashoffset: 0; }
          }

          .orbit-flow-anim {
            animation: flowOrbit 14s infinite linear;
          }

          /* Active/glowing orbit line state */
          .orbit-active {
            stroke-width: 1.8px !important;
            stroke-dasharray: none !important;
            animation: none !important;
          }

          .orion-canvas-container line {
            transition: stroke 0.3s ease, stroke-width 0.3s ease, stroke-dasharray 0.3s ease, filter 0.3s ease;
          }

          /* Glowing connector line */
          .orion-canvas-container line.active-gravity {
            stroke-width: 1.5px !important;
            stroke: var(--accent-color) !important;
            filter: drop-shadow(0 0 3px var(--accent-glow));
            stroke-dasharray: none !important;
          }

          /* 4. Saturn 3D Rings */
          .planet-ring-wrapper {
            position: absolute;
            width: 152%;
            height: 36%;
            top: 32%;
            left: -26%;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            pointer-events: none;
            transform: rotateX(70deg) rotateY(-15deg);
            box-shadow: 0 0 12px rgba(255, 255, 255, 0.15), inset 0 0 12px rgba(255, 255, 255, 0.15);
            animation: rotateRing 15s infinite linear;
            z-index: 4;
          }

          .sphere-chart-color .planet-ring-wrapper {
            border-color: rgba(168, 85, 247, 0.45);
            box-shadow: 0 0 15px rgba(168, 85, 247, 0.25), inset 0 0 15px rgba(168, 85, 247, 0.25);
          }

          .sphere-table-color .planet-ring-wrapper {
            border-color: rgba(6, 182, 212, 0.45);
            box-shadow: 0 0 15px rgba(6, 182, 212, 0.25), inset 0 0 15px rgba(6, 182, 212, 0.25);
          }

          @keyframes rotateRing {
            from { transform: rotateX(70deg) rotateY(-15deg) rotateZ(0deg); }
            to { transform: rotateX(70deg) rotateY(-15deg) rotateZ(360deg); }
          }

          /* 5. Miniature moon satellites */
          .moon-satellite {
            position: absolute;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: radial-gradient(circle at 35% 30%, #ffffff 0%, #cbd5e1 45%, #475569 90%);
            box-shadow: 0 0 8px rgba(255, 255, 255, 0.6), inset -2px -2px 4px rgba(0,0,0,0.6);
            top: 50%;
            left: 50%;
            margin-top: -5px;
            margin-left: -5px;
            animation: orbitMoon 8s infinite linear;
            z-index: 6;
            pointer-events: none;
          }

          @keyframes orbitMoon {
            from { transform: rotate(0deg) translateX(56px) rotate(0deg); }
            to { transform: rotate(360deg) translateX(56px) rotate(-360deg); }
          }

          /* 6. Cyberpunk decorative brackets */
          .hud-bracket {
            position: absolute;
            width: 12px;
            height: 12px;
            border-style: solid;
            pointer-events: none;
            z-index: 20;
            opacity: 0.85;
            transition: border-color 0.3s ease;
          }
          .hud-bracket-tl { top: -2px; left: -2px; border-width: 2px 0 0 2px; }
          .hud-bracket-tr { top: -2px; right: -2px; border-width: 2px 2px 0 0; }
          .hud-bracket-bl { bottom: -2px; left: -2px; border-width: 0 0 2px 2px; }
          .hud-bracket-br { bottom: -2px; right: -2px; border-width: 0 2px 2px 0; }

          /* 7. Holographic HUD cockpit panels styling */
          @media (min-width: 1024px) {
            .layout-orion-active .grid-card {
              position: absolute !important;
              z-index: 50;
              background: rgba(10, 10, 20, 0.82) !important;
              border: 1px solid var(--hud-color) !important;
              box-shadow: 0 15px 40px rgba(0, 0, 0, 0.55), 0 0 25px var(--hud-glow) !important;
              border-radius: 1rem !important;
              backdrop-filter: blur(25px) !important;
              -webkit-backdrop-filter: blur(25px) !important;
              color: #ffffff !important;
              max-height: 480px;
              overflow-y: auto;
              animation: cardFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }

            .layout-orion-active .grid-card::before {
              content: '';
              position: absolute;
              inset: 0;
              background: linear-gradient(
                rgba(18, 16, 16, 0) 50%, 
                rgba(0, 0, 0, 0.2) 50%
              );
              background-size: 100% 4px;
              z-index: 1;
              pointer-events: none;
              opacity: 0.15;
              border-radius: inherit;
            }

            /* Light mode overrides for holographic look */
            .layout-orion-active .grid-card {
              background: rgba(255, 255, 255, 0.85) !important;
              color: #0f172a !important;
              border: 2px solid var(--hud-color) !important;
              box-shadow: 0 20px 45px rgba(15, 23, 42, 0.08), 0 0 25px var(--hud-glow) !important;
              backdrop-filter: blur(25px) !important;
              -webkit-backdrop-filter: blur(25px) !important;
            }

            .dark .layout-orion-active .grid-card {
              background: rgba(10, 8, 22, 0.85) !important;
              color: #f3f4f6 !important;
              border: 2px solid var(--hud-color) !important;
              box-shadow: 0 20px 45px rgba(0, 0, 0, 0.65), 0 0 30px var(--hud-glow) !important;
            }

            .layout-orion-active .grid-card::before {
              background: linear-gradient(
                rgba(255, 255, 255, 0) 50%, 
                rgba(255, 255, 255, 0.05) 50%
              ) !important;
              background-size: 100% 4px !important;
              opacity: 0.3 !important;
            }

            .dark .layout-orion-active .grid-card::before {
              background: linear-gradient(
                rgba(18, 16, 16, 0) 50%, 
                rgba(0, 0, 0, 0.25) 50%
              ) !important;
              background-size: 100% 4px !important;
              opacity: 0.18 !important;
            }

            /* Anchor positions for floating layout elements */
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

          /* Target Reticle (HUD lock-on visual) */
          .target-reticle {
            position: absolute;
            width: 116px;
            height: 116px;
            pointer-events: none;
            z-index: 5;
            opacity: 0;
            transform: scale(1.35) rotate(45deg);
            transition: all 0.45s cubic-bezier(0.16, 1, 0.3, 1);
            color: inherit;
          }

          /* When hovering a planet wrapper, or if the planet has active class */
          .orbit-wrapper:hover .target-reticle,
          .orbit-wrapper.active-state .target-reticle {
            opacity: 0.85;
            transform: scale(1) rotate(0deg);
          }

          .orbit-wrapper.active-state .target-reticle {
            animation: spinReticle 15s infinite linear;
            opacity: 1;
          }

          @keyframes spinReticle {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          .reticle-bracket {
            position: absolute;
            width: 14px;
            height: 14px;
            border-style: solid;
            border-color: currentColor;
            opacity: 0.95;
            transition: border-color 0.4s ease;
          }
          .reticle-tl { top: 0; left: 0; border-width: 2px 0 0 2px; }
          .reticle-tr { top: 0; right: 0; border-width: 2px 2px 0 0; }
          .reticle-bl { bottom: 0; left: 0; border-width: 0 0 2px 2px; }
          .reticle-br { bottom: 0; right: 0; border-width: 0 2px 2px 0; }

          .reticle-scan-ring {
            position: absolute;
            inset: 6px;
            animation: pulseReticleRing 2.5s infinite ease-in-out;
            opacity: 0.65;
          }

          @keyframes pulseReticleRing {
            0%, 100% { transform: scale(0.96); opacity: 0.4; }
            50% { transform: scale(1.04); opacity: 0.9; }
          }

          /* Central Sun Glow with plasma animation */
          .sphere-sun-glow {
            position: absolute;
            width: 180px;
            height: 180px;
            background: radial-gradient(circle, rgba(210, 20, 58, 0.48) 0%, rgba(210, 20, 58, 0.18) 50%, transparent 70%);
            border-radius: 50%;
            filter: url(#solar-plasma) blur(3px);
            z-index: 2;
            pointer-events: none;
            animation: pulse-glow 7s ease-in-out infinite;
          }

          @keyframes pulse-glow {
            0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.8; }
            50% { transform: scale(1.15) rotate(180deg); opacity: 1; }
          }

          /* Concentric Expanding AI Wave ripples on Sun hover */
          .ai-wave-ripple {
            position: absolute;
            border: 1.8px solid rgba(210, 20, 58, 0.55);
            border-radius: 50%;
            pointer-events: none;
            z-index: 1;
            opacity: 0;
            width: 130px;
            height: 130px;
          }

          .sphere-sun-gradient:hover ~ .ai-wave-ripple {
            animation: rippleExpand 2s infinite cubic-bezier(0.1, 0.8, 0.3, 1);
          }

          @keyframes rippleExpand {
            0% {
              transform: scale(0.95);
              opacity: 0.8;
              border-color: rgba(210, 20, 58, 0.65);
              box-shadow: 0 0 10px rgba(210, 20, 58, 0.25);
            }
            100% {
              transform: scale(2.3);
              opacity: 0;
              border-color: rgba(210, 20, 58, 0.0);
              box-shadow: 0 0 30px rgba(210, 20, 58, 0);
            }
          }
        `}} />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 animate-fade-in">
        <h2 className="text-xl sm:text-3xl font-black text-brand-900 tracking-tight flex items-center gap-2">
          <TrendingUp className="text-chiluda-red w-8 h-8 shrink-0 animate-bounce" />
          <span>Panel de Control Financiero</span>
        </h2>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Selector de Layout */}
          <div className="flex items-center gap-1 p-1 rounded-2xl text-xs font-bold layout-selector-container shadow-sm">
            <button
              type="button"
              onClick={() => { setLayout('standard'); setActiveCard(null); }}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 layout-selector-btn ${
                layout === 'standard' ? 'active' : 'hover:opacity-85'
              }`}
            >
              <LayoutGrid size={14} />
              <span>Clásica</span>
            </button>
            <button
              type="button"
              onClick={() => { setLayout('orion'); setActiveCard(null); }}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 layout-selector-btn ${
                layout === 'orion' ? 'active' : 'hover:opacity-85'
              }`}
            >
              <Activity size={14} />
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
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 p-1.5 rounded-full z-20 transition-all orion-zoom-controls">
            <button type="button" onClick={() => adjustZoom(1.15)} className="orion-zoom-btn" title="Zoom In"><Plus size={16} /></button>
            <button type="button" onClick={() => adjustZoom(0.85)} className="orion-zoom-btn" title="Zoom Out"><Minus size={16} /></button>
            <button type="button" onClick={resetZoom} className="orion-zoom-btn" title="Restablecer"><Target size={16} /></button>
          </div>

          {/* SOLAR SYSTEM CANVAS (Themed card background style) */}
          <div 
            onMouseMove={handleCanvasMouseMove}
            onMouseLeave={handleCanvasMouseLeave}
            className="relative w-full h-[580px] md:h-[780px] orion-canvas-container overflow-hidden flex items-center justify-center p-6 bg-transparent dark:bg-stone-950/40 border border-stone-200/20 dark:border-white/5 rounded-[3rem] shadow-none"
          >
            {/* Ambient depth glow points */}
            <div 
              className="absolute top-12 left-12 w-64 h-64 bg-indigo-500/10 dark:bg-indigo-500/5 rounded-full filter blur-[80px] pointer-events-none transition-transform duration-100 ease-out" 
              style={{ transform: `translate(${parallaxOffset.x * 40}px, ${parallaxOffset.y * 40}px)` }}
            />
            <div 
              className="absolute bottom-12 right-12 w-80 h-80 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full filter blur-[100px] pointer-events-none transition-transform duration-100 ease-out" 
              style={{ transform: `translate(${parallaxOffset.x * -50}px, ${parallaxOffset.y * -50}px)` }}
            />

            {/* Mini decorative spheres for parallax depth */}
            <div 
              className="absolute w-4 h-4 rounded-full bg-indigo-500/20 top-[18%] left-[22%] pointer-events-none animate-pulse transition-transform duration-100 ease-out" 
              style={{ transform: `translate(${parallaxOffset.x * -80}px, ${parallaxOffset.y * -80}px)` }}
            />
            <div 
              className="absolute w-6 h-6 rounded-full bg-emerald-500/20 bottom-[22%] right-[22%] pointer-events-none animate-pulse transition-transform duration-100 ease-out" 
              style={{ transform: `translate(${parallaxOffset.x * 120}px, ${parallaxOffset.y * 120}px)`, animationDelay: '-3s' }}
            />
            <div 
              className="absolute w-3.5 h-3.5 rounded-full bg-purple-500/25 top-[42%] right-[15%] pointer-events-none animate-pulse transition-transform duration-100 ease-out" 
              style={{ transform: `translate(${parallaxOffset.x * -50}px, ${parallaxOffset.y * -50}px)`, animationDelay: '-1s' }}
            />
            <div 
              className="absolute w-4 h-4 rounded-full bg-amber-500/20 bottom-[35%] left-[12%] pointer-events-none animate-pulse transition-transform duration-100 ease-out" 
              style={{ transform: `translate(${parallaxOffset.x * 100}px, ${parallaxOffset.y * 100}px)`, animationDelay: '-5s' }}
            />

            {/* Background floating store icons animation specific to Orion container */}
            <FloatingStoreIconsBg className="absolute inset-0 opacity-40 pointer-events-none" />

            {/* Radar sweep scanner */}
            <div className="absolute w-[648px] h-[648px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full overflow-hidden pointer-events-none z-0 opacity-[0.25] dark:opacity-[0.15]">
              <div className="w-full h-full radar-sweep" />
            </div>

            {/* Responsive wrapper to automatically scale down the solar system on smaller screens */}
            <div className="absolute inset-0 flex items-center justify-center scale-[0.58] sm:scale-[0.8] md:scale-95 lg:scale-100 origin-center pointer-events-none">
              
              {/* SVG Orbit Lines (Responsive stroke colors & compass labels) */}
              <svg className="absolute w-[720px] h-[720px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-stone-200 dark:text-stone-850 opacity-40 z-0 transition-colors" viewBox="0 0 720 720">
                <defs>
                  <filter id="solar-plasma" x="-20%" y="-20%" width="140%" height="140%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise">
                      <animate attributeName="seed" values="1;100" dur="20s" repeatCount="indefinite"/>
                    </feTurbulence>
                    <feDisplacementMap in="SourceGraphic" in2="noise" scale="10" xChannelSelector="R" yChannelSelector="G"/>
                  </filter>
                </defs>
                {/* Ejes cardinales astronómicos (Fijos) */}
                <line x1="40" y1="360" x2="680" y2="360" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 12" />
                <line x1="360" y1="40" x2="360" y2="680" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 12" />

                {/* Concentric Orbit Paths */}
                {/* Orbit 1: Radius 120 (KPIs and Goal) */}
                <circle 
                  id="orbit-ring-kpis" 
                  cx="360" cy="360" r="120" 
                  stroke="rgba(37, 99, 235, 0.15)" 
                  strokeWidth={activeCard === 'kpis' || hoveredPlanet === 'kpis' ? "1.8" : "1.2"} 
                  fill="none" 
                  strokeDasharray={activeCard === 'kpis' || hoveredPlanet === 'kpis' ? "none" : "3 5"} 
                  className={`orbit-flow-anim ${activeCard === 'kpis' || hoveredPlanet === 'kpis' ? 'orbit-active' : ''}`}
                  style={{
                    stroke: activeCard === 'kpis' || hoveredPlanet === 'kpis' ? '#2563eb' : undefined,
                    filter: activeCard === 'kpis' || hoveredPlanet === 'kpis' ? 'drop-shadow(0 0 4px rgba(37, 99, 235, 0.45))' : undefined
                  }}
                />
                <circle 
                  id="orbit-ring-goal" 
                  cx="360" cy="360" r="120" 
                  stroke="rgba(16, 185, 129, 0.15)" 
                  strokeWidth={activeCard === 'goal' || hoveredPlanet === 'goal' ? "1.8" : "1.2"} 
                  fill="none" 
                  strokeDasharray={activeCard === 'goal' || hoveredPlanet === 'goal' ? "none" : "3 5"} 
                  className={`orbit-flow-anim ${activeCard === 'goal' || hoveredPlanet === 'goal' ? 'orbit-active' : ''}`}
                  style={{
                    stroke: activeCard === 'goal' || hoveredPlanet === 'goal' ? '#059669' : undefined,
                    filter: activeCard === 'goal' || hoveredPlanet === 'goal' ? 'drop-shadow(0 0 4px rgba(16, 185, 129, 0.45))' : undefined
                  }}
                />
                
                {/* Orbit 2: Radius 222 (Chart and Dist) */}
                <circle 
                  id="orbit-ring-chart" 
                  cx="360" cy="360" r="222" 
                  stroke="rgba(168, 85, 247, 0.15)" 
                  strokeWidth={activeCard === 'chart' || hoveredPlanet === 'chart' ? "1.8" : "1.2"} 
                  fill="none" 
                  strokeDasharray={activeCard === 'chart' || hoveredPlanet === 'chart' ? "none" : "4 6"} 
                  className={`orbit-flow-anim ${activeCard === 'chart' || hoveredPlanet === 'chart' ? 'orbit-active' : ''}`}
                  style={{
                    stroke: activeCard === 'chart' || hoveredPlanet === 'chart' ? '#7e22ce' : undefined,
                    filter: activeCard === 'chart' || hoveredPlanet === 'chart' ? 'drop-shadow(0 0 4px rgba(168, 85, 247, 0.45))' : undefined
                  }}
                />
                <circle 
                  id="orbit-ring-dist" 
                  cx="360" cy="360" r="222" 
                  stroke="rgba(217, 119, 6, 0.15)" 
                  strokeWidth={activeCard === 'dist' || hoveredPlanet === 'dist' ? "1.8" : "1.2"} 
                  fill="none" 
                  strokeDasharray={activeCard === 'dist' || hoveredPlanet === 'dist' ? "none" : "4 6"} 
                  className={`orbit-flow-anim ${activeCard === 'dist' || hoveredPlanet === 'dist' ? 'orbit-active' : ''}`}
                  style={{
                    stroke: activeCard === 'dist' || hoveredPlanet === 'dist' ? '#d97706' : undefined,
                    filter: activeCard === 'dist' || hoveredPlanet === 'dist' ? 'drop-shadow(0 0 4px rgba(217, 119, 6, 0.45))' : undefined
                  }}
                />
                
                {/* Orbit 3: Radius 324 (Table) */}
                <circle 
                  id="orbit-ring-table" 
                  cx="360" cy="360" r="324" 
                  stroke="rgba(6, 182, 212, 0.15)" 
                  strokeWidth={activeCard === 'table' || hoveredPlanet === 'table' ? "1.8" : "1.2"} 
                  fill="none" 
                  strokeDasharray={activeCard === 'table' || hoveredPlanet === 'table' ? "none" : "2 8"} 
                  className={`orbit-flow-anim ${activeCard === 'table' || hoveredPlanet === 'table' ? 'orbit-active' : ''}`}
                  style={{
                    stroke: activeCard === 'table' || hoveredPlanet === 'table' ? '#0891b2' : undefined,
                    filter: activeCard === 'table' || hoveredPlanet === 'table' ? 'drop-shadow(0 0 4px rgba(6, 182, 212, 0.45))' : undefined
                  }}
                />

                {/* Technical Compass Degree Markings */}
                <text x="360" y="28" textAnchor="middle" className="text-[8px] font-mono fill-stone-400 dark:fill-stone-600 font-extrabold uppercase tracking-widest">000° (N)</text>
                <text x="694" y="363" textAnchor="start" className="text-[8px] font-mono fill-stone-400 dark:fill-stone-600 font-extrabold uppercase tracking-widest">090° (E)</text>
                <text x="360" y="700" textAnchor="middle" className="text-[8px] font-mono fill-stone-400 dark:fill-stone-600 font-extrabold uppercase tracking-widest">180° (S)</text>
                <text x="24" y="363" textAnchor="end" className="text-[8px] font-mono fill-stone-400 dark:fill-stone-600 font-extrabold uppercase tracking-widest">270° (W)</text>

                {/* Ejes gravitacionales dinámicos (Conectores al Sol) */}
                <line 
                  id="gravity-line-kpis" 
                  x1="360" y1="360" x2="360" y2="360" 
                  stroke="currentColor" 
                  strokeWidth="0.8" 
                  strokeDasharray="2 3" 
                  className={`transition-all duration-300 ${
                    activeCard === 'kpis' || hoveredPlanet === 'kpis' ? 'active-gravity' : ''
                  }`}
                  style={{
                    '--accent-color': '#2563eb',
                    '--accent-glow': 'rgba(37, 99, 235, 0.45)'
                  }}
                />
                <line 
                  id="gravity-line-goal" 
                  x1="360" y1="360" x2="360" y2="360" 
                  stroke="currentColor" 
                  strokeWidth="0.8" 
                  strokeDasharray="2 3" 
                  className={`transition-all duration-300 ${
                    activeCard === 'goal' || hoveredPlanet === 'goal' ? 'active-gravity' : ''
                  }`}
                  style={{
                    '--accent-color': '#059669',
                    '--accent-glow': 'rgba(16, 185, 129, 0.45)'
                  }}
                />
                <line 
                  id="gravity-line-chart" 
                  x1="360" y1="360" x2="360" y2="360" 
                  stroke="currentColor" 
                  strokeWidth="0.8" 
                  strokeDasharray="2 3" 
                  className={`transition-all duration-300 ${
                    activeCard === 'chart' || hoveredPlanet === 'chart' ? 'active-gravity' : ''
                  }`}
                  style={{
                    '--accent-color': '#7e22ce',
                    '--accent-glow': 'rgba(168, 85, 247, 0.45)'
                  }}
                />
                <line 
                  id="gravity-line-dist" 
                  x1="360" y1="360" x2="360" y2="360" 
                  stroke="currentColor" 
                  strokeWidth="0.8" 
                  strokeDasharray="2 3" 
                  className={`transition-all duration-300 ${
                    activeCard === 'dist' || hoveredPlanet === 'dist' ? 'active-gravity' : ''
                  }`}
                  style={{
                    '--accent-color': '#d97706',
                    '--accent-glow': 'rgba(217, 119, 6, 0.45)'
                  }}
                />
                <line 
                  id="gravity-line-table" 
                  x1="360" y1="360" x2="360" y2="360" 
                  stroke="currentColor" 
                  strokeWidth="0.8" 
                  strokeDasharray="2 3" 
                  className={`transition-all duration-300 ${
                    activeCard === 'table' || hoveredPlanet === 'table' ? 'active-gravity' : ''
                  }`}
                  style={{
                    '--accent-color': '#0891b2',
                    '--accent-glow': 'rgba(6, 182, 212, 0.45)'
                  }}
                />
              </svg>

              {/* Planets and Sun Wrapper */}
              <div id="orion-spheres-wrapper" style={{ transform: `scale(${zoom})`, transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }} className="absolute inset-0 flex items-center justify-center pointer-events-auto">
              
              {/* Central Sun (Toggles Didactic Assistant) */}
              <div className="absolute z-20 flex items-center justify-center">
                {/* Radiant solar glow */}
                <div className="sphere-sun-glow" />
                <button
                  type="button"
                  onClick={() => togglePlanet('assistant')}
                  onMouseEnter={() => setHoveredPlanet('assistant')}
                  onMouseLeave={() => setHoveredPlanet(null)}
                  className={`sphere sphere-sun-gradient w-32 h-32 cursor-pointer flex flex-col items-center justify-center text-center outline-none select-none transition-all ${
                    activeCard === 'assistant' ? 'ring-4 ring-brand-500 scale-110' : ''
                  }`}
                >
                  <span className="text-[10px] font-black text-white/70 uppercase tracking-widest leading-none mb-1">Central</span>
                  <span className="text-xs sm:text-sm font-outfit font-black text-white leading-tight uppercase px-3">ED & E</span>
                  <span className="text-[8px] font-bold text-white/50 uppercase mt-1 leading-none">Asistente</span>
                </button>
                {/* Expanding Concentric AI Wave Rings */}
                <div className="ai-wave-ripple" style={{ animationDelay: '0s' }}></div>
                <div className="ai-wave-ripple" style={{ animationDelay: '0.5s' }}></div>
                <div className="ai-wave-ripple" style={{ animationDelay: '1s' }}></div>
              </div>

              {/* KPIs Planet */}
              <div ref={el => { planetsElementsRef.current.kpis = el; }} className={`orbit-wrapper absolute z-10 flex items-center justify-center ${activeCard === 'kpis' ? 'active-state' : ''}`}>
                {/* KPIs Moon Satellite */}
                <div className="moon-satellite"></div>
                {/* Target Lock Reticle */}
                <div className="target-reticle" style={{ color: '#3b82f6' }}>
                  <div className="reticle-bracket reticle-tl"></div>
                  <div className="reticle-bracket reticle-tr"></div>
                  <div className="reticle-bracket reticle-bl"></div>
                  <div className="reticle-bracket reticle-br"></div>
                  <svg className="reticle-scan-ring" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="0.8" fill="none" stroke-dasharray="8 12" />
                  </svg>
                </div>
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'kpis')}
                  onPointerMove={(e) => handlePointerMove(e, 'kpis')}
                  onPointerUp={(e) => handlePointerUp(e, 'kpis')}
                  onClick={() => togglePlanet('kpis')}
                  onMouseEnter={() => setHoveredPlanet('kpis')}
                  onMouseLeave={() => setHoveredPlanet(null)}
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
              <div ref={el => { planetsElementsRef.current.goal = el; }} className={`orbit-wrapper absolute z-10 flex items-center justify-center ${activeCard === 'goal' ? 'active-state' : ''}`}>
                {/* Goal Moon Satellite */}
                <div className="moon-satellite" style={{ animationDuration: '6s', animationDelay: '-2.5s' }}></div>
                {/* Target Lock Reticle */}
                <div className="target-reticle" style={{ color: '#10b981' }}>
                  <div className="reticle-bracket reticle-tl"></div>
                  <div className="reticle-bracket reticle-tr"></div>
                  <div className="reticle-bracket reticle-bl"></div>
                  <div className="reticle-bracket reticle-br"></div>
                  <svg className="reticle-scan-ring" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="0.8" fill="none" stroke-dasharray="8 12" />
                  </svg>
                </div>
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'goal')}
                  onPointerMove={(e) => handlePointerMove(e, 'goal')}
                  onPointerUp={(e) => handlePointerUp(e, 'goal')}
                  onClick={() => togglePlanet('goal')}
                  onMouseEnter={() => setHoveredPlanet('goal')}
                  onMouseLeave={() => setHoveredPlanet(null)}
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
              <div ref={el => { planetsElementsRef.current.chart = el; }} className={`orbit-wrapper absolute z-10 flex items-center justify-center ${activeCard === 'chart' ? 'active-state' : ''}`}>
                {/* Target Lock Reticle */}
                <div className="target-reticle" style={{ color: '#a855f7' }}>
                  <div className="reticle-bracket reticle-tl"></div>
                  <div className="reticle-bracket reticle-tr"></div>
                  <div className="reticle-bracket reticle-bl"></div>
                  <div className="reticle-bracket reticle-br"></div>
                  <svg className="reticle-scan-ring" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="46" stroke="currentColor" stroke-width="0.8" fill="none" stroke-dasharray="8 12" />
                  </svg>
                </div>
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'chart')}
                  onPointerMove={(e) => handlePointerMove(e, 'chart')}
                  onPointerUp={(e) => handlePointerUp(e, 'chart')}
                  onClick={() => togglePlanet('chart')}
                  onMouseEnter={() => setHoveredPlanet('chart')}
                  onMouseLeave={() => setHoveredPlanet(null)}
                  className={`sphere sphere-chart-color w-24 h-24 flex flex-col items-center justify-center text-center cursor-pointer select-none transition-all ${
                    activeCard === 'chart' ? 'ring-4 ring-purple-500 scale-110' : ''
                  }`}
                >
                  {/* 3D Saturn-style Rings */}
                  <div className="planet-ring-wrapper"></div>
                  <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest mb-1">Gráfica</span>
                  <span className="text-xs font-outfit font-extrabold text-white leading-none tracking-wide">Historial</span>
                </div>
              </div>

              {/* Distribución Planet */}
              <div ref={el => { planetsElementsRef.current.dist = el; }} className={`orbit-wrapper absolute z-10 flex items-center justify-center ${activeCard === 'dist' ? 'active-state' : ''}`}>
                {/* Target Lock Reticle */}
                <div className="target-reticle" style={{ color: '#d97706' }}>
                  <div className="reticle-bracket reticle-tl"></div>
                  <div className="reticle-bracket reticle-tr"></div>
                  <div className="reticle-bracket reticle-bl"></div>
                  <div className="reticle-bracket reticle-br"></div>
                  <svg className="reticle-scan-ring" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="46" stroke="currentColor" stroke-width="0.8" fill="none" stroke-dasharray="8 12" />
                  </svg>
                </div>
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'dist')}
                  onPointerMove={(e) => handlePointerMove(e, 'dist')}
                  onPointerUp={(e) => handlePointerUp(e, 'dist')}
                  onClick={() => togglePlanet('dist')}
                  onMouseEnter={() => setHoveredPlanet('dist')}
                  onMouseLeave={() => setHoveredPlanet(null)}
                  className={`sphere sphere-dist-color w-24 h-24 flex flex-col items-center justify-center text-center cursor-pointer select-none transition-all ${
                    activeCard === 'dist' ? 'ring-4 ring-amber-500 scale-110' : ''
                  }`}
                >
                  <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest mb-1">Distribución</span>
                  <span className="text-xs font-outfit font-extrabold text-white leading-none tracking-wide">Proporción</span>
                </div>
              </div>

              {/* Tabla Planet */}
              <div ref={el => { planetsElementsRef.current.table = el; }} className={`orbit-wrapper absolute z-10 flex items-center justify-center ${activeCard === 'table' ? 'active-state' : ''}`}>
                {/* Target Lock Reticle */}
                <div className="target-reticle" style={{ color: '#06b6d4' }}>
                  <div className="reticle-bracket reticle-tl"></div>
                  <div className="reticle-bracket reticle-tr"></div>
                  <div className="reticle-bracket reticle-bl"></div>
                  <div className="reticle-bracket reticle-br"></div>
                  <svg className="reticle-scan-ring" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="46" stroke="currentColor" stroke-width="0.8" fill="none" stroke-dasharray="8 12" />
                  </svg>
                </div>
                <div
                  onPointerDown={(e) => handlePointerDown(e, 'table')}
                  onPointerMove={(e) => handlePointerMove(e, 'table')}
                  onPointerUp={(e) => handlePointerUp(e, 'table')}
                  onClick={() => togglePlanet('table')}
                  onMouseEnter={() => setHoveredPlanet('table')}
                  onMouseLeave={() => setHoveredPlanet(null)}
                  className={`sphere sphere-table-color w-24 h-24 flex flex-col items-center justify-center text-center cursor-pointer select-none transition-all ${
                    activeCard === 'table' ? 'ring-4 ring-cyan-500 scale-110' : ''
                  }`}
                >
                  {/* 3D Saturn-style Rings */}
                  <div className="planet-ring-wrapper" style={{ animationDuration: '20s', transform: 'rotateX(65deg) rotateY(15deg)' }}></div>
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
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setActiveCard(null); }}
              className="absolute top-4 right-4 text-emerald-800 hover:text-emerald-950 dark:text-emerald-400 dark:hover:text-emerald-200 transition-colors z-50 animate-fade-in"
            >
              <X size={16} />
            </button>
            <div className="hud-bracket hud-bracket-tl" style={{ borderColor: 'var(--hud-color)' }}></div>
            <div className="hud-bracket hud-bracket-tr" style={{ borderColor: 'var(--hud-color)' }}></div>
            <div className="hud-bracket hud-bracket-bl" style={{ borderColor: 'var(--hud-color)' }}></div>
            <div className="hud-bracket hud-bracket-br" style={{ borderColor: 'var(--hud-color)' }}></div>
            <div className="absolute top-2 left-6 text-[8px] font-mono opacity-50 uppercase tracking-widest pointer-events-none select-none">
              SYS: GOAL_COMPLIANCE_NODE_02 // ONLINE
            </div>
          </>
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
        
        <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-emerald-500/25 text-center shrink-0 w-full md:w-auto">
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

      {/* Indicadores de Rendimiento Reciente (Hoy & Mes) */}
      {layout === 'standard' && (
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Activity className="text-chiluda-red w-5 h-5 animate-pulse" />
            <h3 className="text-xs sm:text-sm font-black text-brand-900 uppercase tracking-widest">Desempeño Reciente (Ventas & Utilidad Real)</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-slide-up">
            {/* Card: Ventas Hoy */}
            <div className="bg-white/10 backdrop-blur-[3px] p-6 rounded-[2.2rem] shadow-soft border border-white/40 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 flex flex-col justify-between group cursor-default">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-stone-400 font-black tracking-widest text-[9px] uppercase">Ventas de Hoy</p>
                  <p className="text-[9px] text-stone-400 font-bold uppercase">Ingreso bruto de hoy</p>
                </div>
                <div className="bg-blue-500/10 p-2.5 rounded-xl">
                  <DollarSign className="w-4 h-4 text-blue-600 animate-bounce" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-brand-900">${dashboardDetails.today.revenue.toFixed(2)}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  {dashboardDetails.today.revenue >= dashboardDetails.today.yesterday_revenue ? (
                    <span className="inline-flex items-center text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <ArrowUpRight className="w-3 h-3" />
                      {dashboardDetails.today.yesterday_revenue > 0 
                        ? `+${((dashboardDetails.today.revenue - dashboardDetails.today.yesterday_revenue) / dashboardDetails.today.yesterday_revenue * 100).toFixed(1)}%`
                        : '100%'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-[10px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                      <ArrowDownRight className="w-3 h-3" />
                      {`-${((dashboardDetails.today.yesterday_revenue - dashboardDetails.today.revenue) / dashboardDetails.today.yesterday_revenue * 100).toFixed(1)}%`}
                    </span>
                  )}
                  <span className="text-[9px] text-stone-400 font-bold">vs ayer</span>
                </div>
              </div>
            </div>

            {/* Card: Utilidad Hoy */}
            <div className="bg-white/10 backdrop-blur-[3px] p-6 rounded-[2.2rem] shadow-soft border border-white/40 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 flex flex-col justify-between group cursor-default">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-stone-400 font-black tracking-widest text-[9px] uppercase">Utilidad de Hoy</p>
                  <p className="text-[9px] text-stone-400 font-bold uppercase">Ganancia neta real</p>
                </div>
                <div className="bg-emerald-500/10 p-2.5 rounded-xl">
                  <Coins className="w-4 h-4 text-emerald-600 animate-bounce" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-emerald-600">${dashboardDetails.today.profit.toFixed(2)}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  {dashboardDetails.today.profit >= dashboardDetails.today.yesterday_profit ? (
                    <span className="inline-flex items-center text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <ArrowUpRight className="w-3 h-3" />
                      {dashboardDetails.today.yesterday_profit > 0 
                        ? `+${((dashboardDetails.today.profit - dashboardDetails.today.yesterday_profit) / dashboardDetails.today.yesterday_profit * 100).toFixed(1)}%`
                        : '100%'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-[10px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                      <ArrowDownRight className="w-3 h-3" />
                      {`-${((dashboardDetails.today.yesterday_profit - dashboardDetails.today.profit) / dashboardDetails.today.yesterday_profit * 100).toFixed(1)}%`}
                    </span>
                  )}
                  <span className="text-[9px] text-stone-400 font-bold">vs ayer</span>
                </div>
              </div>
            </div>

            {/* Card: Ventas del Mes */}
            <div className="bg-white/10 backdrop-blur-[3px] p-6 rounded-[2.2rem] shadow-soft border border-white/40 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 flex flex-col justify-between group cursor-default">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-stone-400 font-black tracking-widest text-[9px] uppercase">Ventas del Mes</p>
                  <p className="text-[9px] text-stone-400 font-bold uppercase">Ingreso acumulado</p>
                </div>
                <div className="bg-purple-500/10 p-2.5 rounded-xl">
                  <TrendingUp className="w-4 h-4 text-purple-600 animate-bounce" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-brand-900">${dashboardDetails.month.revenue.toFixed(2)}</p>
                <div className="flex items-center gap-1.5 mt-2">
                  {dashboardDetails.month.revenue >= dashboardDetails.month.last_month_revenue ? (
                    <span className="inline-flex items-center text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <ArrowUpRight className="w-3 h-3" />
                      {dashboardDetails.month.last_month_revenue > 0 
                        ? `+${((dashboardDetails.month.revenue - dashboardDetails.month.last_month_revenue) / dashboardDetails.month.last_month_revenue * 100).toFixed(1)}%`
                        : '100%'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center text-[10px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                      <ArrowDownRight className="w-3 h-3" />
                      {`-${((dashboardDetails.month.last_month_revenue - dashboardDetails.month.revenue) / dashboardDetails.month.last_month_revenue * 100).toFixed(1)}%`}
                    </span>
                  )}
                  <span className="text-[9px] text-stone-400 font-bold">vs mes ant.</span>
                </div>
              </div>
            </div>

            {/* Card: Cartera a Crédito */}
            <div className="bg-white/10 backdrop-blur-[3px] p-6 rounded-[2.2rem] shadow-soft border border-white/40 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 flex flex-col justify-between group cursor-default">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-stone-400 font-black tracking-widest text-[9px] uppercase">Cartera a Crédito</p>
                  <p className="text-[9px] text-stone-400 font-bold uppercase">Total pendiente de cobro</p>
                </div>
                <div className="bg-amber-500/10 p-2.5 rounded-xl">
                  <Wallet className="w-4 h-4 text-amber-600 animate-bounce" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-black text-amber-600">${dashboardDetails.credit.total_owed.toFixed(2)}</p>
                <div className="mt-2 text-[9px] text-stone-400 font-bold uppercase tracking-wider">
                  Saldos de clientes (Fiado)
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setActiveCard(null); }}
              className="absolute top-2 right-2 p-1.5 bg-stone-100/90 hover:bg-stone-200/90 dark:bg-stone-800/85 dark:hover:bg-stone-700/85 rounded-full text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100 transition-all z-50 shadow-sm hover:scale-105 active:scale-95 animate-fade-in"
            >
              <X size={14} />
            </button>
            <div className="hud-bracket hud-bracket-tl" style={{ borderColor: 'var(--hud-color)' }}></div>
            <div className="hud-bracket hud-bracket-tr" style={{ borderColor: 'var(--hud-color)' }}></div>
            <div className="hud-bracket hud-bracket-bl" style={{ borderColor: 'var(--hud-color)' }}></div>
            <div className="hud-bracket hud-bracket-br" style={{ borderColor: 'var(--hud-color)' }}></div>
            <div className="absolute top-2 left-6 text-[8px] font-mono opacity-50 uppercase tracking-widest pointer-events-none select-none">
              SYS: KPI_SUMMARY_NODE_01 // SECURE
            </div>
          </>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-slide-up">
          {/* Card 1: Ingresos Totales */}
          <div className="bg-white/10 backdrop-blur-[3px] p-6 rounded-[2rem] shadow-soft border border-white/40 hover:-translate-y-1.5 hover:shadow-xl hover:border-blue-500/20 transition-all duration-300 flex flex-col justify-between group cursor-default card-hover-effect">
            <div className="flex justify-between items-start mb-6">
              <p className="text-stone-400 font-black tracking-widest text-[10px] uppercase">Ingresos Totales</p>
              <div className="bg-blue-500/10 p-2.5 rounded-xl group-hover:scale-110 transition-transform">
                <DollarSign className="w-5 h-5 text-blue-600 animate-bounce" />
              </div>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-black text-brand-900 tracking-tight leading-none">
                ${profitSummary.total_revenue.toFixed(2)}
              </p>
            </div>
          </div>
          
          {/* Card 2: Ganancia Neta */}
          <div className="bg-white/10 backdrop-blur-[3px] p-6 rounded-[2rem] shadow-soft border border-white/40 hover:-translate-y-1.5 hover:shadow-xl hover:border-emerald-500/20 transition-all duration-300 flex flex-col justify-between group cursor-default card-hover-effect">
            <div className="flex justify-between items-start mb-6">
              <p className="text-stone-400 font-black tracking-widest text-[10px] uppercase">Ganancia Neta</p>
              <div className="bg-emerald-500/10 p-2.5 rounded-xl group-hover:scale-110 transition-transform">
                <Coins className="w-5 h-5 text-emerald-600 animate-bounce" />
              </div>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-black text-emerald-600 tracking-tight leading-none">
                ${profitSummary.total_profit.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Card 3: Margen Promedio */}
          <div className="bg-white/10 backdrop-blur-[3px] p-6 rounded-[2rem] shadow-soft border border-white/40 hover:-translate-y-1.5 hover:shadow-xl hover:border-purple-500/20 transition-all duration-300 flex flex-col justify-between group cursor-default card-hover-effect">
            <div className="flex justify-between items-start mb-6">
              <p className="text-stone-400 font-black tracking-widest text-[10px] uppercase">Margen Promedio</p>
              <div className="bg-purple-500/10 p-2.5 rounded-xl group-hover:scale-110 transition-transform">
                <Percent className="w-5 h-5 text-purple-600 animate-bounce" />
              </div>
            </div>
            <div>
              <p className="text-3xl sm:text-4xl font-black text-purple-600 tracking-tight leading-none">
                {profitSummary.average_margin_percentage.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Card 4: Alertas de Stock */}
          <div className="bg-white/10 backdrop-blur-[3px] p-6 rounded-[2rem] shadow-soft border border-white/40 hover:-translate-y-1.5 hover:shadow-xl hover:border-amber-500/20 transition-all duration-300 flex flex-col justify-between group cursor-default card-hover-effect">
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
          className={`lg:col-span-2 bg-white/10 backdrop-blur-[3px] p-6 sm:p-8 rounded-[2rem] shadow-soft border border-white/40 min-w-0 flex flex-col justify-between relative ${
            layout === 'orion'
              ? `grid-card ${activeCard === 'chart' ? '' : 'hidden'}`
              : ''
          }`}
        >
          {layout === 'orion' && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setActiveCard(null); }}
                className="absolute top-4 right-4 text-stone-400 hover:text-stone-750 dark:text-stone-400 dark:hover:text-stone-200 transition-colors z-50"
              >
                <X size={16} />
              </button>
              <div className="hud-bracket hud-bracket-tl" style={{ borderColor: 'var(--hud-color)' }}></div>
              <div className="hud-bracket hud-bracket-tr" style={{ borderColor: 'var(--hud-color)' }}></div>
              <div className="hud-bracket hud-bracket-bl" style={{ borderColor: 'var(--hud-color)' }}></div>
              <div className="hud-bracket hud-bracket-br" style={{ borderColor: 'var(--hud-color)' }}></div>
              <div className="absolute top-2 left-6 text-[8px] font-mono opacity-50 uppercase tracking-widest pointer-events-none select-none">
                SYS: HISTOGRAM_DATA_NODE_03 // COMPUTING
              </div>
            </>
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
          className={`lg:col-span-1 bg-white/10 backdrop-blur-[3px] p-6 sm:p-8 rounded-[2rem] shadow-soft border border-white/40 min-w-0 relative ${
            layout === 'orion'
              ? `grid-card ${activeCard === 'dist' ? '' : 'hidden'}`
              : ''
          }`}
        >
          {layout === 'orion' && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setActiveCard(null); }}
                className="absolute top-4 right-4 text-stone-400 hover:text-stone-750 dark:text-stone-400 dark:hover:text-stone-200 transition-colors z-50"
              >
                <X size={16} />
              </button>
              <div className="hud-bracket hud-bracket-tl" style={{ borderColor: 'var(--hud-color)' }}></div>
              <div className="hud-bracket hud-bracket-tr" style={{ borderColor: 'var(--hud-color)' }}></div>
              <div className="hud-bracket hud-bracket-bl" style={{ borderColor: 'var(--hud-color)' }}></div>
              <div className="hud-bracket hud-bracket-br" style={{ borderColor: 'var(--hud-color)' }}></div>
              <div className="absolute top-2 left-6 text-[8px] font-mono opacity-50 uppercase tracking-widest pointer-events-none select-none">
                SYS: MARGIN_DISTRIBUTION_NODE_04 // PLOTTING
              </div>
            </>
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

      {/* New Chart Section: 30-Day Daily Sales & Payment Breakdown */}
      {layout === 'standard' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-slide-up" style={{ animationDelay: '0.08s' }}>
          {/* Line Chart: 30-Day Sales & Profit Trend */}
          <div className="lg:col-span-2 bg-white/10 backdrop-blur-[3px] p-6 sm:p-8 rounded-[2.2rem] shadow-soft border border-white/40 flex flex-col justify-between relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3 border-b border-stone-100 pb-4">
              <div>
                <h3 className="text-lg font-black text-brand-900">Historial Diario (Últimos 30 Días)</h3>
                <p className="text-[10px] text-stone-400 font-bold uppercase mt-0.5">Tendencia de ventas brutas y utilidad neta diaria</p>
              </div>
            </div>
            
            <div className="h-80 flex-1 min-h-0">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={dashboardDetails.time_series} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
                  <XAxis dataKey="display_date" tick={{fill: '#a8a29e', fontSize: 10, fontWeight: 500}} axisLine={false} tickLine={false} tickMargin={10} />
                  <YAxis tick={{fill: '#a8a29e', fontSize: 10, fontWeight: 500}} axisLine={false} tickLine={false} tickMargin={10} />
                  <Tooltip 
                    contentStyle={{borderRadius: '16px', border: '1px solid #ffe4e6', backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(8px)', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)'}}
                    labelStyle={{fontWeight: 'bold', color: '#1c1917'}}
                  />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', fontWeight: 'bold' }} />
                  <Line type="monotone" dataKey="Ventas" stroke="#3B82F6" strokeWidth={3} activeDot={{ r: 6 }} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="Utilidad" stroke="#10B981" strokeWidth={3.5} activeDot={{ r: 7 }} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Card: Payment Methods Breakdown */}
          <div className="lg:col-span-1 bg-white/10 backdrop-blur-[3px] p-6 sm:p-8 rounded-[2.2rem] shadow-soft border border-white/40 relative flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6 border-b border-stone-100 pb-4">
                <div>
                  <h3 className="text-lg font-black text-brand-900">Métodos de Pago</h3>
                  <p className="text-[10px] text-stone-400 font-bold uppercase mt-0.5">Distribución de cobros en los últimos 30 días</p>
                </div>
              </div>
              
              <div className="space-y-6 mt-4">
                {/* Cash Method */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-blue-500" />
                      Efectivo
                    </span>
                    <span>${dashboardDetails.payment_methods.cash.toFixed(2)} ({dashboardDetails.payment_methods.total > 0 ? (dashboardDetails.payment_methods.cash / dashboardDetails.payment_methods.total * 100).toFixed(1) : 0}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div 
                      className="bg-blue-50 h-full rounded-full transition-all duration-500"
                      style={{ width: `${dashboardDetails.payment_methods.total > 0 ? (dashboardDetails.payment_methods.cash / dashboardDetails.payment_methods.total * 100) : 0}%` }}
                    />
                  </div>
                </div>

                {/* Card Method */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-purple-500" />
                      Tarjeta
                    </span>
                    <span>${dashboardDetails.payment_methods.card.toFixed(2)} ({dashboardDetails.payment_methods.total > 0 ? (dashboardDetails.payment_methods.card / dashboardDetails.payment_methods.total * 100).toFixed(1) : 0}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div 
                      className="bg-purple-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${dashboardDetails.payment_methods.total > 0 ? (dashboardDetails.payment_methods.card / dashboardDetails.payment_methods.total * 100) : 0}%` }}
                    />
                  </div>
                </div>

                {/* Credit Method */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5 text-amber-500" />
                      Crédito (Fiado)
                    </span>
                    <span>${dashboardDetails.payment_methods.credit.toFixed(2)} ({dashboardDetails.payment_methods.total > 0 ? (dashboardDetails.payment_methods.credit / dashboardDetails.payment_methods.total * 100).toFixed(1) : 0}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div 
                      className="bg-amber-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${dashboardDetails.payment_methods.total > 0 ? (dashboardDetails.payment_methods.credit / dashboardDetails.payment_methods.total * 100) : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="text-[10px] text-stone-400 font-bold uppercase tracking-wider text-center mt-6 pt-4 border-t border-slate-100">
              Total Cobrado: ${dashboardDetails.payment_methods.total.toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* Top Sold Products table with Profit margins */}
      <div
        id="table-card"
        className={`bg-white/10 backdrop-blur-[3px] rounded-[2rem] shadow-soft border border-white/40 overflow-hidden animate-slide-up relative ${
          layout === 'orion'
            ? `grid-card ${activeCard === 'table' ? '' : 'hidden'}`
            : ''
        }`}
        style={layout === 'standard' ? { animationDelay: '0.1s' } : undefined}
      >
        {layout === 'orion' && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setActiveCard(null); }}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-755 dark:text-stone-400 dark:hover:text-stone-200 transition-colors z-50"
            >
              <X size={16} />
            </button>
            <div className="hud-bracket hud-bracket-tl" style={{ borderColor: 'var(--hud-color)' }}></div>
            <div className="hud-bracket hud-bracket-tr" style={{ borderColor: 'var(--hud-color)' }}></div>
            <div className="hud-bracket hud-bracket-bl" style={{ borderColor: 'var(--hud-color)' }}></div>
            <div className="hud-bracket hud-bracket-br" style={{ borderColor: 'var(--hud-color)' }}></div>
            <div className="absolute top-2 left-6 text-[8px] font-mono opacity-50 uppercase tracking-widest pointer-events-none select-none">
              SYS: PRODUCT_LEADERBOARD_NODE_05 // SORTING
            </div>
          </>
        )}
        <div className="p-6 border-b border-stone-100 bg-white/40">
          <h3 className="text-lg font-black text-brand-900">Clasificación de Productos y Márgenes</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead className="bg-stone-50 text-stone-605 text-[10px] font-black uppercase tracking-wider border-b border-stone-100">
              <tr>
                <th className="px-6 py-4 font-black text-center">Producto</th>
                <th className="px-6 py-4 font-black text-center">Unidades Vendidas</th>
                <th className="px-6 py-4 font-black text-center">Ingresos Totales</th>
                <th className="px-6 py-4 font-black text-center">Costo Acumulado</th>
                <th className="px-6 py-4 font-black text-center">Ganancia Neta</th>
                <th className="px-6 py-4 font-black text-center">Margen %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs font-bold text-stone-700">
              {topProducts.map((p) => (
                <tr key={p.producto_id} className="hover:bg-stone-50/50 transition-colors">
                  <td className="px-6 py-4 text-brand-900 font-extrabold text-center">{p.nombre_producto}</td>
                  <td className="px-6 py-4 text-center text-stone-500">{p.quantity_sold} u.</td>
                  <td className="px-6 py-4 text-center text-stone-600">${p.revenue.toFixed(2)}</td>
                  <td className="px-6 py-4 text-center text-stone-600">${p.cost.toFixed(2)}</td>
                  <td className="px-6 py-4 text-center text-emerald-600 font-extrabold">${p.profit.toFixed(2)}</td>
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
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setActiveCard(null); }}
              className="absolute top-4 right-4 text-stone-400 hover:text-stone-755 dark:text-stone-400 dark:hover:text-stone-200 transition-colors z-50"
            >
              <X size={16} />
            </button>
            <div className="hud-bracket hud-bracket-tl" style={{ borderColor: 'var(--hud-color)' }}></div>
            <div className="hud-bracket hud-bracket-tr" style={{ borderColor: 'var(--hud-color)' }}></div>
            <div className="hud-bracket hud-bracket-bl" style={{ borderColor: 'var(--hud-color)' }}></div>
            <div className="hud-bracket hud-bracket-br" style={{ borderColor: 'var(--hud-color)' }}></div>
            <div className="absolute top-2 left-6 text-[8px] font-mono opacity-50 uppercase tracking-widest pointer-events-none select-none">
              SYS: COGNITIVE_ADVISORY_NODE_00 // RUNNING
            </div>
          </>
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
