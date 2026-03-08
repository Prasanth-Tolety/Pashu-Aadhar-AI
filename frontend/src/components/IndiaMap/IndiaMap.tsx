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

const STATE_PATHS: Record<string, { d: string; label: string; cx: number; cy: number }> = {
  'Jammu and Kashmir': {
    d: 'M280,80 L310,50 L340,30 L370,25 L395,35 L410,60 L420,90 L405,115 L385,130 L360,140 L335,138 L310,145 L290,135 L275,120 L265,100 Z',
    label: 'J&K', cx: 345, cy: 85,
  },
  'Ladakh': {
    d: 'M410,20 L450,10 L500,15 L540,25 L555,50 L545,80 L520,95 L490,100 L460,95 L430,85 L420,60 L410,35 Z',
    label: 'LA', cx: 480, cy: 55,
  },
  'Himachal Pradesh': {
    d: 'M340,140 L365,135 L390,140 L405,155 L400,175 L380,185 L360,182 L340,175 L330,160 Z',
    label: 'HP', cx: 368, cy: 160,
  },
  'Punjab': {
    d: 'M280,140 L310,145 L335,148 L340,165 L345,185 L330,200 L305,205 L285,195 L270,175 L265,155 Z',
    label: 'PB', cx: 305, cy: 175,
  },
  'Chandigarh': {
    d: 'M330,192 L338,188 L342,195 L335,200 Z',
    label: 'CH', cx: 335, cy: 194,
  },
  'Uttarakhand': {
    d: 'M400,155 L425,148 L455,150 L480,158 L490,175 L475,195 L450,200 L425,195 L405,190 L395,178 Z',
    label: 'UK', cx: 445, cy: 175,
  },
  'Haryana': {
    d: 'M305,205 L330,200 L350,210 L360,230 L355,250 L340,260 L320,265 L305,255 L290,240 L285,220 Z',
    label: 'HR', cx: 325, cy: 235,
  },
  'Delhi': {
    d: 'M340,248 L350,243 L355,252 L347,258 Z',
    label: 'DL', cx: 347, cy: 250,
  },
  'Rajasthan': {
    d: 'M150,250 L195,235 L240,225 L280,225 L305,240 L320,260 L325,290 L320,330 L305,365 L280,390 L245,400 L200,395 L165,375 L135,345 L115,310 L120,275 Z',
    label: 'RJ', cx: 225, cy: 315,
  },
  'Uttar Pradesh': {
    d: 'M355,230 L390,215 L425,205 L460,210 L510,225 L555,245 L580,260 L575,290 L555,310 L530,325 L500,335 L465,340 L430,345 L400,340 L375,325 L350,310 L335,290 L325,270 Z',
    label: 'UP', cx: 455, cy: 280,
  },
  'Bihar': {
    d: 'M580,260 L615,250 L645,255 L670,265 L680,285 L670,305 L645,315 L615,320 L590,312 L575,295 Z',
    label: 'BR', cx: 630, cy: 285,
  },
  'Sikkim': {
    d: 'M650,225 L665,218 L675,228 L670,242 L658,242 Z',
    label: 'SK', cx: 662, cy: 232,
  },
  'Arunachal Pradesh': {
    d: 'M710,185 L750,172 L790,178 L825,192 L835,215 L820,235 L790,242 L755,240 L725,235 L710,220 Z',
    label: 'AR', cx: 772, cy: 210,
  },
  'Nagaland': {
    d: 'M795,242 L820,240 L835,255 L830,275 L815,282 L798,275 L792,260 Z',
    label: 'NL', cx: 814, cy: 260,
  },
  'Manipur': {
    d: 'M798,282 L818,280 L830,295 L825,315 L810,322 L795,315 L790,298 Z',
    label: 'MN', cx: 812, cy: 300,
  },
  'Mizoram': {
    d: 'M790,322 L810,320 L820,340 L815,365 L800,375 L785,365 L780,342 Z',
    label: 'MZ', cx: 800, cy: 348,
  },
  'Tripura': {
    d: 'M762,340 L778,335 L785,350 L780,370 L768,375 L758,360 Z',
    label: 'TR', cx: 772, cy: 355,
  },
  'Meghalaya': {
    d: 'M710,268 L745,260 L780,265 L790,280 L775,292 L745,295 L720,290 L708,280 Z',
    label: 'ML', cx: 750, cy: 278,
  },
  'Assam': {
    d: 'M680,235 L710,225 L725,235 L755,240 L790,242 L798,260 L790,275 L780,265 L745,260 L710,268 L700,282 L710,300 L730,315 L748,325 L762,335 L755,342 L735,330 L710,318 L695,305 L680,290 L670,270 Z',
    label: 'AS', cx: 720, cy: 275,
  },
  'West Bengal': {
    d: 'M620,320 L650,310 L670,305 L685,315 L695,335 L692,360 L685,385 L678,410 L670,435 L660,455 L645,465 L632,450 L638,420 L630,395 L622,370 L615,345 Z',
    label: 'WB', cx: 655, cy: 385,
  },
  'Jharkhand': {
    d: 'M565,315 L600,318 L620,320 L625,340 L630,365 L618,380 L595,385 L570,378 L555,360 L550,340 Z',
    label: 'JH', cx: 590, cy: 350,
  },
  'Odisha': {
    d: 'M555,380 L590,385 L618,395 L635,415 L640,440 L630,465 L615,480 L590,490 L560,485 L530,475 L510,455 L505,430 L515,405 L530,390 Z',
    label: 'OR', cx: 570, cy: 440,
  },
  'Chhattisgarh': {
    d: 'M465,365 L500,355 L530,365 L545,380 L540,405 L530,430 L515,450 L495,455 L470,445 L450,425 L445,400 L450,380 Z',
    label: 'CG', cx: 490, cy: 410,
  },
  'Madhya Pradesh': {
    d: 'M280,310 L320,300 L360,305 L400,315 L440,330 L465,345 L465,370 L455,395 L440,415 L415,430 L385,435 L355,430 L320,420 L290,405 L265,385 L260,360 L265,335 Z',
    label: 'MP', cx: 370, cy: 370,
  },
  'Gujarat': {
    d: 'M95,325 L130,315 L160,330 L190,355 L200,380 L190,405 L170,430 L145,450 L120,458 L95,450 L70,430 L55,405 L50,375 L55,345 L70,330 Z',
    label: 'GJ', cx: 125, cy: 390,
  },
  'Dadra and Nagar Haveli and Daman and Diu': {
    d: 'M155,442 L165,436 L172,445 L165,452 Z',
    label: 'DN', cx: 164, cy: 445,
  },
  'Maharashtra': {
    d: 'M160,450 L200,435 L240,425 L285,420 L325,430 L365,440 L405,448 L430,460 L440,485 L430,510 L410,530 L380,545 L345,550 L310,548 L275,540 L240,528 L210,510 L185,490 L165,470 Z',
    label: 'MH', cx: 310, cy: 490,
  },
  'Goa': {
    d: 'M205,530 L218,522 L225,535 L218,548 L208,545 Z',
    label: 'GA', cx: 215, cy: 536,
  },
  'Telangana': {
    d: 'M365,480 L405,470 L440,478 L465,495 L470,520 L455,540 L430,550 L405,548 L382,535 L370,510 Z',
    label: 'TS', cx: 420, cy: 510,
  },
  'Andhra Pradesh': {
    d: 'M380,550 L410,548 L445,555 L480,545 L510,540 L540,550 L555,575 L550,605 L535,635 L510,655 L480,665 L455,658 L430,640 L410,615 L395,590 L380,570 Z',
    label: 'AP', cx: 470, cy: 600,
  },
  'Karnataka': {
    d: 'M210,545 L255,540 L300,548 L345,555 L375,565 L390,590 L395,620 L385,650 L365,680 L340,700 L310,710 L280,705 L255,692 L235,672 L218,648 L205,620 L195,590 L195,565 Z',
    label: 'KA', cx: 300, cy: 630,
  },
  'Kerala': {
    d: 'M265,710 L285,705 L300,725 L295,755 L285,785 L270,810 L255,830 L240,825 L235,800 L240,775 L248,750 L255,728 Z',
    label: 'KL', cx: 268, cy: 770,
  },
  'Tamil Nadu': {
    d: 'M310,695 L345,685 L380,680 L415,670 L445,665 L470,680 L485,705 L480,740 L465,775 L440,800 L410,815 L380,810 L350,795 L325,775 L310,750 L300,725 Z',
    label: 'TN', cx: 395, cy: 745,
  },
  'Puducherry': {
    d: 'M415,730 L425,724 L432,735 L425,742 Z',
    label: 'PY', cx: 424, cy: 733,
  },
  'Andaman and Nicobar Islands': {
    d: 'M770,600 L778,590 L785,605 L782,625 L775,640 L768,630 L770,615 Z',
    label: 'AN', cx: 776, cy: 618,
  },
  'Lakshadweep': {
    d: 'M175,735 L182,728 L188,738 L182,748 Z',
    label: 'LD', cx: 182, cy: 738,
  },
};

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

  const countMap = useMemo(() => {
    const map: Record<string, number> = {};
    stateData.forEach(s => {
      const canonical = normalizeStateName(s.state);
      map[canonical] = (map[canonical] || 0) + s.total;
    });
    return map;
  }, [stateData]);

  function getColor(stateName: string): string {
    const count = countMap[stateName] || 0;
    if (count === 0) return '#e8eef5';
    const ratio = Math.pow(count / (maxCount || 1), 0.55);
    const r = Math.round(232 + ratio * (255 - 232));
    const g = Math.round(238 - ratio * (238 - 107));
    const b = Math.round(245 - ratio * (245 - 53));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function handleMouseEnter(stateName: string, e: React.MouseEvent) {
    setHoveredState(stateName);
    const rect = (e.currentTarget as SVGElement).closest('svg')!.getBoundingClientRect();
    setTooltip({ name: stateName, count: countMap[stateName] || 0, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  function handleMouseMove(stateName: string, e: React.MouseEvent) {
    const rect = (e.currentTarget as SVGElement).closest('svg')!.getBoundingClientRect();
    setTooltip({ name: stateName, count: countMap[stateName] || 0, x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  function handleMouseLeave() {
    setHoveredState(null);
    setTooltip(null);
  }

  return (
    <div className="india-map-wrapper">
      <svg viewBox="30 0 870 860" className="india-map-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="oceanGrad" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#e8f4fd" />
            <stop offset="100%" stopColor="#d0e8f7" />
          </radialGradient>
        </defs>
        <rect x="30" y="0" width="870" height="860" fill="url(#oceanGrad)" rx="16" />

        {Object.entries(STATE_PATHS).map(([name, { d, label, cx, cy }]) => {
          const isHovered = hoveredState === name;
          const count = countMap[name] || 0;
          return (
            <g key={name} className="state-group">
              <path
                d={d}
                fill={getColor(name)}
                stroke={isHovered ? '#FF6B35' : '#94a3b8'}
                strokeWidth={isHovered ? 2.5 : 0.7}
                strokeLinejoin="round"
                className={'state-path' + (isHovered ? ' hovered' : '')}
                style={{
                  filter: isHovered ? 'drop-shadow(0 3px 8px rgba(255,107,53,0.35))' : undefined,
                }}
                onMouseEnter={(e) => handleMouseEnter(name, e)}
                onMouseMove={(e) => handleMouseMove(name, e)}
                onMouseLeave={handleMouseLeave}
                onClick={() => onStateClick?.(name)}
              />
              <text
                x={cx} y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                className="state-label"
                style={{
                  fontSize: count > 0 ? 10 : 7,
                  fontWeight: count > 0 ? 700 : 400,
                  fill: count > 0 ? '#1a1a2e' : '#94a3b8',
                  pointerEvents: 'none',
                }}
              >
                {label}
              </text>
              {count > 0 && (
                <text
                  x={cx} y={cy + 13}
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{ fontSize: 7, fontWeight: 600, fill: '#FF6B35', pointerEvents: 'none' }}
                >
                  {count.toLocaleString('en-IN')}
                </text>
              )}
            </g>
          );
        })}

        <text x="480" y="850" textAnchor="middle" style={{ fontSize: 14, fontWeight: 700, fill: '#64748b' }}>
          India
        </text>
      </svg>

      {tooltip && (
        <div className="map-tooltip" style={{ left: tooltip.x + 14, top: tooltip.y - 14 }}>
          <strong>{tooltip.name}</strong>
          <span>{tooltip.count > 0 ? tooltip.count.toLocaleString('en-IN') + ' animals' : 'No data'}</span>
        </div>
      )}
    </div>
  );
}
