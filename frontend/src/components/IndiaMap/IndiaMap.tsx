/**
 * Interactive SVG India Map Component
 *
 * Shows state-wise cattle population with:
 *  - Heat-map coloring based on animal count
 *  - Hover tooltip with state name + count
 *  - Click handler for detailed state breakdown
 *  - Smooth hover animations
 *
 * Uses simplified SVG paths for each Indian state/UT.
 */
import { useState, useMemo } from 'react';
import './IndiaMap.css';

interface StateInfo {
  state: string;
  total: number;
  species?: Record<string, number>;
  breeds?: Record<string, number>;
  recent_30d?: number;
}

interface Props {
  stateData: StateInfo[];
  maxCount: number;
  onStateClick?: (stateName: string) => void;
}

interface TooltipInfo {
  name: string;
  count: number;
  x: number;
  y: number;
}

// Simplified SVG path data for Indian states
// Each path is roughly positioned in a 600x700 viewBox
const STATE_PATHS: Record<string, { d: string; label: string; cx: number; cy: number }> = {
  'Jammu and Kashmir': {
    d: 'M175,35 L195,25 L220,18 L240,25 L255,30 L260,50 L250,70 L235,80 L220,75 L205,80 L190,70 L180,55 Z',
    label: 'J&K', cx: 218, cy: 50
  },
  'Ladakh': {
    d: 'M255,15 L280,10 L305,15 L310,30 L300,45 L280,50 L260,50 L255,30 Z',
    label: 'LA', cx: 280, cy: 30
  },
  'Himachal Pradesh': {
    d: 'M220,75 L240,72 L260,78 L265,95 L250,105 L235,100 L220,95 Z',
    label: 'HP', cx: 242, cy: 88
  },
  'Punjab': {
    d: 'M190,80 L220,75 L220,95 L235,100 L230,120 L210,125 L195,115 L185,100 Z',
    label: 'PB', cx: 210, cy: 100
  },
  'Uttarakhand': {
    d: 'M250,105 L265,95 L290,95 L305,100 L310,115 L295,125 L275,120 L260,118 L250,112 Z',
    label: 'UK', cx: 280, cy: 108
  },
  'Haryana': {
    d: 'M210,125 L230,120 L250,125 L255,145 L240,155 L225,158 L215,150 L205,140 Z',
    label: 'HR', cx: 230, cy: 140
  },
  'Delhi': {
    d: 'M232,148 L240,145 L245,152 L238,156 Z',
    label: 'DL', cx: 238, cy: 150
  },
  'Rajasthan': {
    d: 'M120,150 L160,140 L205,140 L215,150 L225,170 L230,200 L225,230 L210,250 L180,260 L150,255 L120,240 L105,210 L100,185 L110,165 Z',
    label: 'RJ', cx: 165, cy: 200
  },
  'Uttar Pradesh': {
    d: 'M255,145 L275,120 L310,115 L340,125 L370,140 L385,155 L380,175 L365,190 L340,195 L310,200 L290,210 L270,205 L255,195 L240,180 L230,165 Z',
    label: 'UP', cx: 310, cy: 165
  },
  'Bihar': {
    d: 'M385,155 L410,150 L435,155 L450,165 L445,180 L430,190 L405,195 L385,190 L375,180 Z',
    label: 'BR', cx: 415, cy: 172
  },
  'Sikkim': {
    d: 'M425,138 L435,132 L442,138 L438,148 L428,148 Z',
    label: 'SK', cx: 433, cy: 140
  },
  'Arunachal Pradesh': {
    d: 'M460,115 L490,105 L520,110 L540,120 L535,140 L510,148 L485,145 L465,138 Z',
    label: 'AR', cx: 500, cy: 125
  },
  'Nagaland': {
    d: 'M510,148 L530,145 L540,155 L535,170 L520,172 L510,165 Z',
    label: 'NL', cx: 524, cy: 160
  },
  'Manipur': {
    d: 'M510,172 L525,172 L535,180 L530,195 L515,198 L508,188 Z',
    label: 'MN', cx: 520, cy: 185
  },
  'Mizoram': {
    d: 'M505,200 L515,198 L525,205 L520,225 L510,230 L502,218 Z',
    label: 'MZ', cx: 514, cy: 215
  },
  'Tripura': {
    d: 'M490,210 L502,208 L505,220 L498,232 L488,228 L486,218 Z',
    label: 'TR', cx: 496, cy: 220
  },
  'Meghalaya': {
    d: 'M460,168 L490,162 L510,165 L508,178 L485,182 L465,180 Z',
    label: 'ML', cx: 485, cy: 172
  },
  'Assam': {
    d: 'M445,140 L465,138 L485,145 L510,148 L510,165 L490,162 L460,168 L450,180 L460,190 L478,195 L490,205 L490,210 L478,205 L460,198 L450,188 L440,175 L435,160 Z',
    label: 'AS', cx: 468, cy: 170
  },
  'West Bengal': {
    d: 'M405,195 L430,190 L440,200 L445,220 L440,240 L435,260 L430,280 L425,300 L415,310 L405,298 L410,270 L400,250 L395,230 L390,210 Z',
    label: 'WB', cx: 418, cy: 245
  },
  'Jharkhand': {
    d: 'M370,190 L405,195 L395,210 L400,230 L385,240 L365,235 L355,220 L360,205 Z',
    label: 'JH', cx: 380, cy: 215
  },
  'Odisha': {
    d: 'M355,235 L385,240 L400,250 L410,270 L405,290 L395,305 L380,315 L360,310 L340,300 L330,280 L335,260 L345,245 Z',
    label: 'OR', cx: 370, cy: 275
  },
  'Chhattisgarh': {
    d: 'M310,225 L340,220 L355,235 L345,250 L335,265 L330,280 L315,290 L300,280 L290,260 L295,240 Z',
    label: 'CG', cx: 320, cy: 255
  },
  'Madhya Pradesh': {
    d: 'M210,200 L230,195 L260,200 L290,210 L310,225 L300,240 L290,260 L270,270 L250,275 L225,270 L200,260 L185,245 L190,225 L200,210 Z',
    label: 'MP', cx: 250, cy: 240
  },
  'Gujarat': {
    d: 'M80,210 L105,210 L120,240 L150,255 L145,270 L130,290 L115,310 L95,315 L80,305 L60,290 L50,270 L55,250 L65,240 L75,225 Z',
    label: 'GJ', cx: 100, cy: 270
  },
  'Maharashtra': {
    d: 'M130,290 L150,275 L180,270 L210,275 L240,285 L270,280 L290,290 L305,310 L295,330 L275,345 L250,350 L220,350 L190,345 L165,335 L140,320 Z',
    label: 'MH', cx: 220, cy: 315
  },
  'Telangana': {
    d: 'M260,320 L290,310 L315,315 L330,330 L320,350 L300,360 L280,358 L265,345 Z',
    label: 'TS', cx: 292, cy: 338
  },
  'Andhra Pradesh': {
    d: 'M280,358 L300,360 L320,355 L340,345 L360,340 L375,350 L380,370 L375,395 L360,410 L340,420 L320,415 L300,400 L290,380 L275,370 Z',
    label: 'AP', cx: 330, cy: 385
  },
  'Karnataka': {
    d: 'M165,360 L200,355 L230,360 L260,365 L275,380 L280,400 L270,420 L255,440 L230,450 L205,445 L185,435 L170,420 L160,400 L155,380 Z',
    label: 'KA', cx: 218, cy: 405
  },
  'Goa': {
    d: 'M155,368 L165,360 L170,375 L162,382 Z',
    label: 'GA', cx: 162, cy: 373
  },
  'Kerala': {
    d: 'M195,445 L215,450 L225,470 L220,495 L210,520 L195,540 L185,530 L180,510 L185,490 L188,470 Z',
    label: 'KL', cx: 200, cy: 495
  },
  'Tamil Nadu': {
    d: 'M230,445 L260,440 L285,445 L305,435 L325,430 L335,450 L330,475 L315,500 L295,510 L270,515 L250,505 L235,490 L225,470 Z',
    label: 'TN', cx: 280, cy: 475
  },
  'Andaman and Nicobar Islands': {
    d: 'M490,390 L495,385 L500,395 L498,410 L493,420 L488,410 L490,400 Z',
    label: 'AN', cx: 494, cy: 405
  },
  'Lakshadweep': {
    d: 'M135,475 L140,470 L145,478 L140,485 Z',
    label: 'LD', cx: 140, cy: 478
  },
  'Chandigarh': {
    d: 'M225,114 L230,111 L233,116 L228,118 Z',
    label: 'CH', cx: 229, cy: 115
  },
  'Puducherry': {
    d: 'M290,450 L295,446 L300,452 L295,458 Z',
    label: 'PY', cx: 295, cy: 452
  },
  'Dadra and Nagar Haveli and Daman and Diu': {
    d: 'M118,295 L125,290 L130,298 L123,302 Z',
    label: 'DN', cx: 124, cy: 296
  },
};

// Name normalization mapping for matching API data to SVG states
const STATE_ALIASES: Record<string, string> = {
  'J&K': 'Jammu and Kashmir',
  'Jammu & Kashmir': 'Jammu and Kashmir',
  'HP': 'Himachal Pradesh',
  'UK': 'Uttarakhand',
  'UP': 'Uttar Pradesh',
  'MP': 'Madhya Pradesh',
  'AP': 'Andhra Pradesh',
  'TN': 'Tamil Nadu',
  'WB': 'West Bengal',
  'Chattisgarh': 'Chhattisgarh',
  'Orissa': 'Odisha',
  'Pondicherry': 'Puducherry',
  'DNH': 'Dadra and Nagar Haveli and Daman and Diu',
  'A&N Islands': 'Andaman and Nicobar Islands',
};

function normalizeStateName(name: string): string {
  if (STATE_PATHS[name]) return name;
  if (STATE_ALIASES[name]) return STATE_ALIASES[name];
  // fuzzy: find closest match
  const lower = name.toLowerCase();
  for (const key of Object.keys(STATE_PATHS)) {
    if (key.toLowerCase() === lower) return key;
    if (key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase())) return key;
  }
  return name;
}

export default function IndiaMap({ stateData, maxCount, onStateClick }: Props) {
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const [hoveredState, setHoveredState] = useState<string | null>(null);

  // Build lookup: canonical state name → count
  const countMap = useMemo(() => {
    const map: Record<string, number> = {};
    stateData.forEach(s => {
      const canonical = normalizeStateName(s.state);
      map[canonical] = (map[canonical] || 0) + s.total;
    });
    return map;
  }, [stateData]);

  // color scale:  0 → light (#eef6ff), max → deep saffron (#FF6B35)
  function getColor(stateName: string): string {
    const count = countMap[stateName] || 0;
    if (count === 0) return '#f0f4f8';
    const ratio = Math.pow(count / (maxCount || 1), 0.6); // sqrt-ish scale for better contrast
    const r = Math.round(240 - ratio * (240 - 255));
    const g = Math.round(244 - ratio * (244 - 107));
    const b = Math.round(248 - ratio * (248 - 53));
    return `rgb(${r},${g},${b})`;
  }

  function handleMouseEnter(stateName: string, e: React.MouseEvent) {
    setHoveredState(stateName);
    const rect = (e.currentTarget as SVGElement).closest('svg')!.getBoundingClientRect();
    setTooltip({
      name: stateName,
      count: countMap[stateName] || 0,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }

  function handleMouseMove(stateName: string, e: React.MouseEvent) {
    const rect = (e.currentTarget as SVGElement).closest('svg')!.getBoundingClientRect();
    setTooltip({
      name: stateName,
      count: countMap[stateName] || 0,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }

  function handleMouseLeave() {
    setHoveredState(null);
    setTooltip(null);
  }

  return (
    <div className="india-map-wrapper">
      <svg viewBox="30 0 560 560" className="india-map-svg">
        {/* Water background */}
        <rect x="30" y="0" width="560" height="560" fill="#e8f4fd" rx="12" />

        {/* Render each state path */}
        {Object.entries(STATE_PATHS).map(([name, { d, label, cx, cy }]) => {
          if (!d || name === 'Nepal Border') return null;
          const isHovered = hoveredState === name;
          const count = countMap[name] || 0;
          return (
            <g key={name} className="state-group">
              <path
                d={d}
                fill={getColor(name)}
                stroke={isHovered ? '#FF6B35' : '#8899aa'}
                strokeWidth={isHovered ? 2.5 : 0.8}
                className={`state-path ${isHovered ? 'hovered' : ''}`}
                style={{ filter: isHovered ? 'brightness(0.85)' : undefined }}
                onMouseEnter={(e) => handleMouseEnter(name, e)}
                onMouseMove={(e) => handleMouseMove(name, e)}
                onMouseLeave={handleMouseLeave}
                onClick={() => onStateClick?.(name)}
              />
              {/* State label */}
              {cx > 0 && (
                <text
                  x={cx} y={cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="state-label"
                  style={{ fontSize: count > 0 ? 8 : 6, fontWeight: count > 0 ? 600 : 400, fill: count > 0 ? '#333' : '#999', pointerEvents: 'none' }}
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}

        {/* Title */}
        <text x="310" y="548" textAnchor="middle" className="map-title">भारत — India</text>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="map-tooltip"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <strong>{tooltip.name}</strong>
          <span>{tooltip.count.toLocaleString('en-IN')} animals</span>
        </div>
      )}
    </div>
  );
}
