import React, { useEffect, useRef } from 'react';

/**
 * AnimatedBackground
 * Fundo fixo de página inteira com:
 *  - Grid de pontos minimalista em SVG (estático, leve)
 *  - Dois orbs de gradiente verde que flutuam lentamente
 *  - Overlay de noise sutil para textura de papel premium
 */
export function AnimatedBackground() {
  return (
    <>
      <style>{`
        @keyframes orb-a {
          0%,100% { transform: translate(0, 0) scale(1); }
          30%      { transform: translate(4vw, 6vh) scale(1.08); }
          65%      { transform: translate(-3vw, 3vh) scale(0.95); }
        }
        @keyframes orb-b {
          0%,100% { transform: translate(0, 0) scale(1); }
          35%      { transform: translate(-5vw, -4vh) scale(1.1); }
          70%      { transform: translate(2vw, -6vh) scale(0.93); }
        }
        @keyframes orb-c {
          0%,100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(3vw, -3vh) scale(1.06); }
        }
        @keyframes grain-shift {
          0%,100% { transform: translate(0,0); }
          20%     { transform: translate(-2px, 2px); }
          40%     { transform: translate(2px, -1px); }
          60%     { transform: translate(-1px, 3px); }
          80%     { transform: translate(3px, -2px); }
        }
      `}</style>

      {/* Base branca */}
      <div className="fixed inset-0 bg-white" style={{ zIndex: -10 }} />

      {/* Dot grid via SVG pattern */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: -8,
          backgroundImage: `radial-gradient(circle, rgba(101,163,13,0.18) 1px, transparent 1px)`,
          backgroundSize: '32px 32px',
          opacity: 0.55,
        }}
      />

      {/* Orb 1 — topo esquerdo */}
      <div
        className="fixed pointer-events-none rounded-full"
        style={{
          zIndex: -7,
          top: '-15vh',
          left: '-15vw',
          width: '70vw',
          height: '70vw',
          background: 'radial-gradient(circle at center, rgba(101,163,13,0.07) 0%, transparent 65%)',
          animation: 'orb-a 22s ease-in-out infinite',
        }}
      />

      {/* Orb 2 — centro direito */}
      <div
        className="fixed pointer-events-none rounded-full"
        style={{
          zIndex: -7,
          top: '20vh',
          right: '-20vw',
          width: '55vw',
          height: '55vw',
          background: 'radial-gradient(circle at center, rgba(101,163,13,0.05) 0%, transparent 65%)',
          animation: 'orb-b 30s ease-in-out infinite',
        }}
      />

      {/* Orb 3 — rodapé */}
      <div
        className="fixed pointer-events-none rounded-full"
        style={{
          zIndex: -7,
          bottom: '-20vh',
          left: '20vw',
          width: '60vw',
          height: '60vw',
          background: 'radial-gradient(circle at center, rgba(101,163,13,0.04) 0%, transparent 65%)',
          animation: 'orb-c 26s ease-in-out infinite',
        }}
      />

      {/* Noise grain overlay */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: -6,
          opacity: 0.025,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '128px 128px',
          animation: 'grain-shift 0.5s steps(1) infinite',
        }}
      />
    </>
  );
}
