import { useEffect, useState } from 'react';

// DICCIONARIO DE ICONOS DE TIENDA (SVG PATHS ENRIQUECIDOS)
const STORE_ICONS = [
  // 1. Carrito de Compras
  () => (
    <>
      <path d="M2 2h2l2.6 12.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6L22 6H6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="20" r="1" fill="currentColor" />
      <circle cx="20" cy="20" r="1" fill="currentColor" />
    </>
  ),
  // 2. Caja / Paquete
  () => (
    <>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" fill="none" stroke="currentColor" strokeWidth="2" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" fill="none" stroke="currentColor" stroke-width="2" />
      <line x1="12" y1="22.08" x2="12" y2="12" stroke="currentColor" stroke-width="2" />
    </>
  ),
  // 3. Bolsa de compras
  () => (
    <>
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4H6z" fill="none" stroke="currentColor" stroke-width="2" />
      <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" stroke-width="2" />
      <path d="M16 10a4 4 0 0 1-8 0" fill="none" stroke="currentColor" stroke-width="2" />
    </>
  ),
  // 4. Manzana / Fruta
  () => (
    <>
      <path d="M12 22c4.97 0 9-3.03 9-7 0-3.5-2.5-6.5-5.5-6.5-1.5 0-2.5.5-3.5 1.5-1-1-2-1.5-3.5-1.5C6.5 8.5 4 11.5 4 15c0 3.97 4.03 7 9 7z" fill="none" stroke="currentColor" stroke-width="2" />
      <path d="M12 8.5c0-3 1.5-5.5 3-5.5" stroke="currentColor" stroke-width="2" />
    </>
  ),
  // 5. Tienda / Local
  () => (
    <>
      <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" fill="none" stroke="currentColor" stroke-width="2" />
      <path d="M3 9V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4" fill="none" stroke="currentColor" stroke-width="2" />
      <line x1="12" y1="9" x2="12" y2="21" stroke="currentColor" stroke-width="2" />
    </>
  ),
  // 6. Moneda / Dinero
  () => (
    <>
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" />
      <path d="M12 6v12M15 9.5H10.5a2 2 0 0 0 0 4H13.5a2 2 0 0 1 0 4H9" fill="none" stroke="currentColor" stroke-width="2" />
    </>
  ),
  // 7. Lata de Refresco / Bebida
  () => (
    <>
      <rect x="6" y="3" width="12" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2" />
      <line x1="10" y1="3" x2="14" y2="3" stroke="currentColor" stroke-width="2" />
      <line x1="6" y1="7" x2="18" y2="7" stroke="currentColor" stroke-width="2" />
      <line x1="6" y1="17" x2="18" y2="17" stroke="currentColor" stroke-width="2" />
    </>
  ),
  // 8. Envase de Leche
  () => (
    <>
      <path d="M6 18h12V10l-4-4V2H10v4L6 10z" fill="none" stroke="currentColor" stroke-width="2" />
      <line x1="6" y1="10" x2="18" y2="10" stroke="currentColor" stroke-width="2" />
      <line x1="10" y1="2" x2="14" y2="2" stroke="currentColor" stroke-width="2" />
    </>
  ),
  // 9. Rebanada de Pan
  () => (
    <path d="M7 21h10a2 2 0 0 0 2-2V8a5 5 0 0 0-4-4.9V3a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v.1A5 5 0 0 0 5 8v11a2 2 0 0 0 2 2z" fill="none" stroke="currentColor" stroke-width="2" />
  ),
  // 10. Pescado
  () => (
    <>
      <path d="M22 12c-2.5 2.5-6 3-9 2-3-1-5-3-7-3c-2 0-4.5 1.5-5 2.5V8.5c.5 1 3 2.5 5 2.5c2 0 4-2 7-3c3-1 6.5-.5 9 2z" fill="none" stroke="currentColor" stroke-width="2" />
      <path d="M4 10.5v3" stroke="currentColor" stroke-width="2" />
      <circle cx="18" cy="11" r="1" fill="currentColor" />
    </>
  ),
  // 11. Ticket de Compra / Recibo
  () => (
    <>
      <path d="M4 2v20l2-1 3 1 3-1 3 1 3-1 2 1V2l-2 1-3-1-3 1-3-1-3 1-2-1z" fill="none" stroke="currentColor" stroke-width="2" />
      <line x1="8" y1="7" x2="16" y2="7" stroke="currentColor" stroke-width="2" />
      <line x1="8" y1="11" x2="16" y2="11" stroke="currentColor" stroke-width="2" />
    </>
  ),
  // 12. Queso
  () => (
    <>
      <path d="M22 19H2L12 3z" fill="none" stroke="currentColor" stroke-width="2" />
      <circle cx="7" cy="15" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="16" cy="16" r="1" fill="currentColor" />
    </>
  ),
  // 13. Balanza / Báscula
  () => (
    <path d="M12 3v18M19 8H5M19 8l-3 7H22zM5 8l-3 7H8zM4 21h16" fill="none" stroke="currentColor" stroke-width="2" strokeLinecap="round" strokeLinejoin="round" />
  ),
  // 14. Porcentaje / Descuento
  () => (
    <>
      <circle cx="6.5" cy="6.5" r="2.5" fill="none" stroke="currentColor" stroke-width="2" />
      <circle cx="17.5" cy="17.5" r="2.5" fill="none" stroke="currentColor" stroke-width="2" />
      <line x1="19" y1="5" x2="5" y2="19" stroke="currentColor" stroke-width="2" />
    </>
  ),
  // 15. Dulce Envuelto
  () => (
    <>
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2" />
      <path d="M8 12L3 8v8zm8 0l5-4v8z" fill="none" stroke="currentColor" stroke-width="2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  // 16. Paleta / Piruleta
  () => (
    <>
      <circle cx="12" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="2" />
      <path d="M12 14v8" stroke="currentColor" stroke-width="2" />
      <path d="M12 8a3 3 0 0 1-3-3" fill="none" stroke="currentColor" stroke-width="2" />
    </>
  )
];

const ICONS_COUNT = 70;

export default function FloatingStoreIconsBg() {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    const generated = Array.from({ length: ICONS_COUNT }).map((_, i) => {
      const size = Math.random() * 22 + 26; // 26px a 48px
      const left = Math.random() * 100; // 0% a 100%
      const duration = Math.random() * 16 + 12; // 12s a 28s
      const delay = Math.random() * -30; // Negativo para que ya estén en pantalla al iniciar
      const driftX = Math.random() * 260 - 130; // Oscilación
      const rotDeg = Math.random() * 360 + 180; // Giro
      const iconIndex = Math.floor(Math.random() * STORE_ICONS.length);

      return {
        id: i,
        size,
        left,
        duration,
        delay,
        driftX,
        rotDeg,
        iconIndex
      };
    });
    setParticles(generated);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0 select-none">
      {particles.map((p) => {
        const IconComponent = STORE_ICONS[p.iconIndex];
        return (
          <svg
            key={p.id}
            viewBox="0 0 24 24"
            className="absolute bottom-[-80px] text-emerald-800/[0.68] dark:text-emerald-500/[0.30] animate-float-icon"
            style={{
              width: `${p.size}px`,
              height: `${p.size}px`,
              left: `${p.left}%`,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
              '--drift-x': `${p.driftX}px`,
              '--rot-deg': `${p.rotDeg}deg`,
            }}
          >
            <IconComponent />
          </svg>
        );
      })}
    </div>
  );
}
