import React from 'react';

/**
 * AnimatedBackground
 * Fundo aurora minimalista:
 *  - Base branca pura
 *  - 4 blobs de gradiente suavíssimos (verde lima + slate) flutuando muito lentamente
 *  - Sem dot grid, sem grain — visual limpo estilo Linear/Vercel
 */
export function AnimatedBackground() {
  return (
    <>
      <style>{`
        @keyframes blob-1 {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          33%       { transform: translate(40px, -30px) scale(1.05); }
          66%       { transform: translate(-20px, 20px) scale(0.97); }
        }
        @keyframes blob-2 {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          33%       { transform: translate(-50px, 30px) scale(1.08); }
          66%       { transform: translate(30px, -40px) scale(0.95); }
        }
        @keyframes blob-3 {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          50%       { transform: translate(30px, 40px) scale(1.06); }
        }
        @keyframes blob-4 {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          40%       { transform: translate(-30px, -20px) scale(1.04); }
          80%       { transform: translate(20px, 30px) scale(0.98); }
        }
      `}</style>

      {/* Base branca */}
      <div className="fixed inset-0 bg-white" style={{ zIndex: -10 }} />

      {/* Blob 1 — topo esquerdo, verde suave */}
      <div
        className="fixed pointer-events-none"
        style={{
          zIndex: -9,
          top: '-10vh',
          left: '-10vw',
          width: '60vw',
          height: '60vw',
          background: 'radial-gradient(ellipse at center, rgba(101,163,13,0.08) 0%, transparent 70%)',
          filter: 'blur(48px)',
          animation: 'blob-1 38s ease-in-out infinite',
        }}
      />

      {/* Blob 2 — centro direito, slate azulado */}
      <div
        className="fixed pointer-events-none"
        style={{
          zIndex: -9,
          top: '15vh',
          right: '-15vw',
          width: '55vw',
          height: '55vw',
          background: 'radial-gradient(ellipse at center, rgba(148,163,184,0.07) 0%, transparent 70%)',
          filter: 'blur(56px)',
          animation: 'blob-2 46s ease-in-out infinite',
        }}
      />

      {/* Blob 3 — meio inferior esquerdo, verde mais suave */}
      <div
        className="fixed pointer-events-none"
        style={{
          zIndex: -9,
          bottom: '5vh',
          left: '10vw',
          width: '50vw',
          height: '50vw',
          background: 'radial-gradient(ellipse at center, rgba(101,163,13,0.05) 0%, transparent 70%)',
          filter: 'blur(64px)',
          animation: 'blob-3 52s ease-in-out infinite',
        }}
      />

      {/* Blob 4 — centro topo direito, verde lima */}
      <div
        className="fixed pointer-events-none"
        style={{
          zIndex: -9,
          top: '30vh',
          left: '30vw',
          width: '45vw',
          height: '45vw',
          background: 'radial-gradient(ellipse at center, rgba(163,230,53,0.04) 0%, transparent 70%)',
          filter: 'blur(72px)',
          animation: 'blob-4 44s ease-in-out infinite',
        }}
      />
    </>
  );
}
