import React from 'react';

/**
 * AnimatedBackground — fundo fosco premium
 * Conceito: "Paper Aurora"
 * - Base branca pura
 * - Três zonas de luz orgânicas (não circulares) com bordas irregulares
 * - Textura grain/ruído via SVG inline para o efeito fosco/matte
 * - Linha de horizonte translúcida no centro
 * - Deriva suave e lenta (30–40s por ciclo)
 */

const NOISE_SVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='400' height='400' filter='url(%23g)' opacity='0.038'/%3E%3C/svg%3E")`;

export function AnimatedBackground() {
  return (
    <>
      <style>{`
        @keyframes drift-a {
          0%   { transform: translate(0px, 0px) rotate(0deg) scale(1); }
          35%  { transform: translate(30px, -20px) rotate(1.5deg) scale(1.04); }
          70%  { transform: translate(-20px, 15px) rotate(-1deg) scale(0.97); }
          100% { transform: translate(0px, 0px) rotate(0deg) scale(1); }
        }
        @keyframes drift-b {
          0%   { transform: translate(0px, 0px) rotate(0deg) scale(1); }
          40%  { transform: translate(-25px, 18px) rotate(-2deg) scale(1.03); }
          75%  { transform: translate(18px, -12px) rotate(1deg) scale(0.98); }
          100% { transform: translate(0px, 0px) rotate(0deg) scale(1); }
        }
        @keyframes drift-c {
          0%   { transform: translate(0px, 0px) scale(1); }
          50%  { transform: translate(15px, -25px) scale(1.06); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .bg-zone-a { animation: drift-a 38s ease-in-out infinite; }
        .bg-zone-b { animation: drift-b 44s ease-in-out infinite; }
        .bg-zone-c { animation: drift-c 52s ease-in-out infinite; }
      `}</style>

      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -10,
          backgroundColor: '#ffffff',
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        {/* ── Zona A: Lima — topo-esquerdo, forma orgânica assimétrica ── */}
        <div
          className="bg-zone-a"
          style={{
            position: 'absolute',
            top: '-18%',
            left: '-12%',
            width: '72vw',
            height: '68vh',
            background: 'radial-gradient(ellipse at 35% 40%, rgba(101,163,13,0.09) 0%, rgba(101,163,13,0.04) 40%, transparent 70%)',
            borderRadius: '62% 38% 46% 54% / 60% 44% 56% 40%',
            filter: 'blur(48px)',
          }}
        />

        {/* ── Zona B: Slate frio — inferior-direito ── */}
        <div
          className="bg-zone-b"
          style={{
            position: 'absolute',
            bottom: '-22%',
            right: '-14%',
            width: '65vw',
            height: '65vh',
            background: 'radial-gradient(ellipse at 60% 55%, rgba(100,116,139,0.07) 0%, rgba(148,163,184,0.04) 45%, transparent 70%)',
            borderRadius: '44% 56% 38% 62% / 54% 38% 62% 46%',
            filter: 'blur(60px)',
          }}
        />

        {/* ── Zona C: Lima suave — centro-direito ── */}
        <div
          className="bg-zone-c"
          style={{
            position: 'absolute',
            top: '25%',
            right: '-5%',
            width: '40vw',
            height: '50vh',
            background: 'radial-gradient(ellipse at 50% 50%, rgba(101,163,13,0.05) 0%, transparent 65%)',
            borderRadius: '38% 62% 55% 45% / 50% 62% 38% 50%',
            filter: 'blur(70px)',
          }}
        />

        {/* ── Linha de horizonte — sutil divisor de profundidade ── */}
        <div
          style={{
            position: 'absolute',
            top: '48%',
            left: 0,
            right: 0,
            height: '1px',
            background: 'linear-gradient(90deg, transparent 0%, rgba(101,163,13,0.12) 25%, rgba(148,163,184,0.10) 50%, rgba(101,163,13,0.08) 75%, transparent 100%)',
          }}
        />

        {/* ── Vinheta de borda — traz o conteúdo para frente ── */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse 110% 90% at 50% 50%, transparent 55%, rgba(248,250,248,0.55) 100%)',
          }}
        />

        {/* ── Grain / Noise — o que cria o efeito fosco/matte ── */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: NOISE_SVG,
            backgroundRepeat: 'repeat',
            backgroundSize: '300px 300px',
            mixBlendMode: 'multiply',
            opacity: 1,
          }}
        />
      </div>
    </>
  );
}
