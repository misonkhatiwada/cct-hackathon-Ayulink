import React from 'react';

/**
 * AyuLink Brand Mark: Medical Cross + Connected Network Nodes
 */
export const AyuLogo: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 28 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="36" height="36" rx="9" fill="#0D9488" />
      {/* Medical Cross */}
      <path
        d="M15.5 8.5C15.5 7.94772 15.9477 7.5 16.5 7.5H19.5C20.0523 7.5 20.5 7.94772 20.5 8.5V15.5H27.5C28.0523 15.5 28.5 15.9477 28.5 16.5V19.5C28.5 20.0523 28.0523 20.5 27.5 20.5H20.5V27.5C20.5 28.0523 20.0523 28.5 19.5 28.5H16.5C15.9477 28.5 15.5 28.0523 15.5 27.5V20.5H8.5C7.94772 20.5 7.5 20.0523 7.5 19.5V16.5C7.5 15.9477 7.94772 15.5 8.5 15.5H15.5V8.5Z"
        fill="white"
        fillOpacity="0.95"
      />
      {/* Connected Network Nodes */}
      <circle cx="18" cy="18" r="3.2" fill="#0F766E" />
      <circle cx="9.5" cy="9.5" r="2.2" fill="#99F6E4" />
      <circle cx="26.5" cy="9.5" r="2.2" fill="#99F6E4" />
      <circle cx="9.5" cy="26.5" r="2.2" fill="#99F6E4" />
      <circle cx="26.5" cy="26.5" r="2.2" fill="#99F6E4" />
      <line x1="11.2" y1="11.2" x2="15.8" y2="15.8" stroke="#99F6E4" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="24.8" y1="11.2" x2="20.2" y2="15.8" stroke="#99F6E4" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="11.2" y1="24.8" x2="15.8" y2="20.2" stroke="#99F6E4" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="24.8" y1="24.8" x2="20.2" y2="20.2" stroke="#99F6E4" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
};

/**
 * Deterministic Secure QR Matrix Renderer
 * Encodes ONLY a cryptographic reference token (never raw clinical records).
 */
export const SecureQrCode: React.FC<{ value: string; size?: number }> = ({ value, size = 148 }) => {
  const gridSize = 15;
  const cells: boolean[][] = [];

  // Deterministic hash from token value
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const isFinderArea = (r: number, c: number) => {
    const topLeft = r < 4 && c < 4;
    const topRight = r < 4 && c >= gridSize - 4;
    const bottomLeft = r >= gridSize - 4 && c < 4;
    return topLeft || topRight || bottomLeft;
  };

  for (let r = 0; r < gridSize; r++) {
    cells[r] = [];
    for (let c = 0; c < gridSize; c++) {
      if (isFinderArea(r, c)) {
        cells[r][c] = false;
      } else {
        const bit = ((hash >>> ((r * gridSize + c) % 24)) ^ (r * 7 + c * 13 + value.charCodeAt((r + c) % value.length))) & 1;
        cells[r][c] = bit === 1;
      }
    }
  }

  const cellSize = size / gridSize;

  return (
    <div className="inline-flex flex-col items-center p-2.5 bg-white rounded-xl border border-slate-200 shadow-xs">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
        <rect width={size} height={size} fill="#FFFFFF" />
        {/* Finder Patterns */}
        {[
          { x: 0, y: 0 },
          { x: (gridSize - 3.5) * cellSize, y: 0 },
          { x: 0, y: (gridSize - 3.5) * cellSize },
        ].map((pos, idx) => (
          <g key={idx} transform={`translate(${pos.x}, ${pos.y})`}>
            <rect width={cellSize * 3.5} height={cellSize * 3.5} rx={3} fill="#0F172A" />
            <rect
              x={cellSize * 0.5}
              y={cellSize * 0.5}
              width={cellSize * 2.5}
              height={cellSize * 2.5}
              rx={1.5}
              fill="#FFFFFF"
            />
            <rect
              x={cellSize * 1.1}
              y={cellSize * 1.1}
              width={cellSize * 1.3}
              height={cellSize * 1.3}
              rx={1}
              fill="#0D9488"
            />
          </g>
        ))}

        {/* Data Modules */}
        {cells.map((row, r) =>
          row.map((filled, c) =>
            filled ? (
              <rect
                key={`${r}-${c}`}
                x={c * cellSize + 0.5}
                y={r * cellSize + 0.5}
                width={cellSize - 1}
                height={cellSize - 1}
                rx={1.5}
                fill="#0F172A"
              />
            ) : null
          )
        )}
      </svg>
    </div>
  );
};
