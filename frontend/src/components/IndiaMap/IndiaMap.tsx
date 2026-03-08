/**
 * India Tile Grid Cartogram — Lightweight map visualization
 *
 * Uses a grid-based layout where each state is a colored tile
 * positioned to approximate India's geography. This approach:
 *  - Is extremely lightweight (no complex SVG paths)
 *  - Won't crash the editor or browser
 *  - Provides clean, professional data visualization
 *  - Supports heat-map coloring, hover tooltips, and click actions
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

/* Grid positions: row/col that approximate India's geography.
   10 columns × 9 rows. */
const TILE_POSITIONS: {
  state: string;
  label: string;
  row: number;
  col: number;
}[] = [
  // North
  { state: 'Jammu and Kashmir',  label: 'J&K', row: 0, col: 4 },
  { state: 'Ladakh',             label: 'LA',  row: 0, col: 5 },
  { state: 'Punjab',             label: 'PB',  row: 1, col: 3 },
  { state: 'Himachal Pradesh',   label: 'HP',  row: 1, col: 4 },
  { state: 'Uttarakhand',        label: 'UK',  row: 1, col: 5 },
  // NCR / Gangetic
  { state: 'Haryana',            label: 'HR',  row: 2, col: 2 },
  { state: 'Delhi',              label: 'DL',  row: 2, col: 3 },
  { state: 'Uttar Pradesh',      label: 'UP',  row: 2, col: 4 },
  { state: 'Chandigarh',         label: 'CH',  row: 2, col: 5 },
  // Central / West / East
  { state: 'Rajasthan',          label: 'RJ',  row: 3, col: 1 },
  { state: 'Madhya Pradesh',     label: 'MP',  row: 3, col: 2 },
  { state: 'Bihar',              label: 'BR',  row: 3, col: 5 },
  { state: 'West Bengal',        label: 'WB',  row: 3, col: 6 },
  { state: 'Gujarat',            label: 'GJ',  row: 4, col: 0 },
  { state: 'Chhattisgarh',       label: 'CG',  row: 4, col: 3 },
  { state: 'Jharkhand',          label: 'JH',  row: 4, col: 4 },
  // West / South-Central
  { state: 'Dadra and Nagar Haveli and Daman and Diu', label: 'DD', row: 5, col: 0 },
  { state: 'Maharashtra',        label: 'MH',  row: 5, col: 1 },
  { state: 'Telangana',          label: 'TS',  row: 5, col: 2 },
  { state: 'Odisha',             label: 'OR',  row: 5, col: 4 },
  // South
  { state: 'Goa',                label: 'GA',  row: 6, col: 1 },
  { state: 'Karnataka',          label: 'KA',  row: 6, col: 2 },
  { state: 'Andhra Pradesh',     label: 'AP',  row: 6, col: 3 },
  { state: 'Kerala',             label: 'KL',  row: 7, col: 2 },
  { state: 'Tamil Nadu',         label: 'TN',  row: 7, col: 3 },
  { state: 'Puducherry',         label: 'PY',  row: 7, col: 4 },
  // Northeast
  { state: 'Sikkim',             label: 'SK',  row: 2, col: 7 },
  { state: 'Arunachal Pradesh',  label: 'AR',  row: 2, col: 8 },
  { state: 'Assam',              label: 'AS',  row: 3, col: 7 },
  { state: 'Meghalaya',          label: 'ML',  row: 3, col: 8 },
  { state: 'Nagaland',           label: 'NL',  row: 3, col: 9 },
  { state: 'Manipur',            label: 'MN',  row: 4, col: 9 },
  { state: 'Tripura',            label: 'TR',  row: 4, col: 8 },
  { state: 'Mizoram',            label: 'MZ',  row: 5, col: 9 },
  // Islands
  { state: 'Andaman and Nicobar Islands', label: 'AN', row: 7, col: 8 },
  { state: 'Lakshadweep',        label: 'LD',  row: 8, col: 1 },
];

// Name normalization mapping
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

const KNOWN_STATES = new Set(TILE_POSITIONS.map(t => t.state));

function normalizeStateName(name: string): string {
  if (KNOWN_STATES.has(name)) return name;
  if (STATE_ALIASES[name]) return STATE_ALIASES[name];
  const lower = name.toLowerCase();
  for (const state of KNOWN_STATES) {
    if (state.toLowerCase() === lower) return state;
    if (state.toLowerCase().includes(lower) || lower.includes(state.toLowerCase())) return state;
  }
  return name;
}

const GRID_COLS = 10;

export default function IndiaMap({ stateData, maxCount, onStateClick }: Props) {
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
    // Pale orange → deep saffron
    const r = 255;
    const g = Math.round(224 - ratio * 117);
    const b = Math.round(200 - ratio * 160);
    return `rgb(${r},${g},${b})`;
  }

  return (
    <div className="india-map-wrapper">
      <div
        className="tile-grid"
        style={{
          gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
        }}
      >
        {TILE_POSITIONS.map(({ state, label, row, col }) => {
          const count = countMap[state] || 0;
          const isHovered = hoveredState === state;
          const hasData = count > 0;
          return (
            <div
              key={state}
              className={`tile-cell ${hasData ? 'has-data' : ''} ${isHovered ? 'hovered' : ''}`}
              style={{
                gridRow: row + 1,
                gridColumn: col + 1,
                backgroundColor: getColor(state),
                borderColor: isHovered ? '#FF6B35' : hasData ? '#e8a87c' : '#cbd5e1',
              }}
              onMouseEnter={() => setHoveredState(state)}
              onMouseLeave={() => setHoveredState(null)}
              onClick={() => onStateClick?.(state)}
              title={`${state}: ${count > 0 ? count.toLocaleString('en-IN') + ' animals' : 'No data'}`}
            >
              <span className="tile-label">{label}</span>
              {hasData && <span className="tile-count">{count}</span>}
              {/* Tooltip on hover */}
              {isHovered && (
                <div className="tile-tooltip">
                  <strong>{state}</strong>
                  <span>{count > 0 ? `${count.toLocaleString('en-IN')} animals` : 'No data'}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="tile-legend">
        <span className="legend-end">0</span>
        <div className="legend-bar" />
        <span className="legend-end">{maxCount}</span>
      </div>

      <p className="tile-caption">भारत — India &middot; State-wise Cattle Distribution</p>
    </div>
  );
}
