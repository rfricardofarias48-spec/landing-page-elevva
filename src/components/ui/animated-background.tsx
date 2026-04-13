import React from 'react';

/**
 * AnimatedBackground
 * Fundo minimalista animado para a DemonstracaoPage.
 * - Base branca (#fff)
 * - Grid de pontos finíssimos em slate-200
 * - Dois blobs de gradiente radial na cor verde-lima da marca,
 *   com opacidade muito baixa, movendo-se lentamente
 * - Totalmente fixo atrás do conteúdo (z-index: -10)
 */
export function AnimatedBackground() {
  return (
    <>
      <style>{`
        @keyframes ab-drift-a {
          0%   { transform: translate(0%, 0%) scale(1); }
          33%  { transform: translate(6%, -8%) scale(1.08); }
          66%  { transform: translate(-4%, 5%) scale(0.96); }
          100% { transform: translate(0%, 0%) scale(1); }
        }
        @keyframes ab-drift-b {
          0%   { transform: translate(0%, 0%) scale(1); }
          40%  { transform: translate(-7%, 6%) scale(1.05); }
          70%  { transform: translate(5%, -4%) scale(0.97); }
          100% { transform: translate(0%, 0%) scale(1); }
        }
        .ab-blob-a {
          animation: ab-drift-a 28s ease-in-out infinite;
        }
        .ab-blob-b {
          animation: ab-drift-b 34s ease-in-out infinite;
        }
      `}</style>

      {/* Camada base */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -10,
          background: '#ffffff',
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        {/* Grid de pontos */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            opacity: 0.45,
          }}
        />

        {/* Blob verde-lima — topo-esquerdo */}
        <div
          className="ab-blob-a"
          style={{
            position: 'absolute',
            top: '-20%',
            left: '-15%',
            width: '65vw',
            height: '65vw',
            maxWidth: '720px',
            maxHeight: '720px',
            borderRadius: '50%',
            background:
              'radial-gradient(circle at center, rgba(101,163,13,0.10) 0%, transparent 70%)',
            filter: 'blur(40px)',
          }}
        />

        {/* Blob verde-lima — inferior-direito */}
        <div
          className="ab-blob-b"
          style={{
            position: 'absolute',
            bottom: '-25%',
            right: '-10%',
            width: '55vw',
            height: '55vw',
            maxWidth: '640px',
            maxHeight: '640px',
            borderRadius: '50%',
            background:
              'radial-gradient(circle at center, rgba(101,163,13,0.08) 0%, transparent 70%)',
            filter: 'blur(48px)',
          }}
        />

        {/* Vinheta suave nas bordas para profundidade */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse 120% 100% at 50% 0%, transparent 60%, rgba(241,245,249,0.6) 100%)',
          }}
        />
      </div>
    </>
  );
}
