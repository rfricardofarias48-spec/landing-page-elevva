import React from 'react';

/**
 * AnimatedBackground
 * Fundo sólido off-white unificado em toda a página.
 */
export function AnimatedBackground() {
  return (
    <div className="fixed inset-0 bg-slate-50" style={{ zIndex: -10 }} />
  );
}
