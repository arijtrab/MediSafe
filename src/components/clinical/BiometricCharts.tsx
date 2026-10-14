import React, { useState } from 'react';
import { PatientVitals } from '../../types/clinical';
import {
  Activity,
  Heart,
  Droplets,
  Thermometer,
  Wind,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Info,
} from 'lucide-react';

interface BiometricChartsProps {
  vitals: PatientVitals[];
  patientName?: string;
}

export const BiometricCharts: React.FC<BiometricChartsProps> = ({ vitals, patientName }) => {
  const [selectedMetric, setSelectedMetric] = useState<'BP' | 'HR' | 'SPO2' | 'GLUCOSE' | 'ALL'>('ALL');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Chronological order (oldest to newest for graphing)
  const sortedVitals = [...vitals].sort((a, b) => {
    // If measured_at format is DD/MM/YYYY à HH:mm, or standard ISO
    return new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime();
  });

  if (vitals.length === 0) {
    return (
      <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl">
        <Activity className="w-8 h-8 text-slate-400 mx-auto mb-2" />
        <h4 className="text-sm font-semibold text-slate-700">Aucune constante biométrique enregistrée</h4>
        <p className="text-xs text-slate-500 mt-1">
          Ajoutez votre première mesure pour visualiser l'historique graphique de votre état de santé.
        </p>
      </div>
    );
  }

  // Generate SVG points helper
  const renderLineChart = (
    data: { value: number | null | undefined; date: string }[],
    minVal: number,
    maxVal: number,
    color: string,
    label: string,
    unit: string,
    referenceLine?: { val: number; label: string; color: string }
  ) => {
    const validData = data.filter((d) => typeof d.value === 'number' && !isNaN(d.value!));
    if (validData.length === 0) return null;

    const width = 640;
    const height = 180;
    const padding = { top: 20, right: 30, bottom: 35, left: 45 };

    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;

    const range = maxVal - minVal || 1;

    const getX = (idx: number) => {
      if (validData.length === 1) return padding.left + innerWidth / 2;
      return padding.left + (idx / (validData.length - 1)) * innerWidth;
    };

    const getY = (val: number) => {
      const clamped = Math.max(minVal, Math.min(maxVal, val));
      const ratio = (clamped - minVal) / range;
      return padding.top + innerHeight - ratio * innerHeight;
    };

    const points = validData.map((d, i) => `${getX(i)},${getY(d.value!)}`).join(' ');

    return (
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs font-bold text-slate-900">{label}</span>
          </div>
          <div className="text-[11px] font-semibold text-slate-600">
            Dernière valeur :{' '}
            <strong className="text-slate-900" style={{ color }}>
              {validData[validData.length - 1].value} {unit}
            </strong>
          </div>
        </div>

        <div className="relative w-full overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto min-w-[480px] overflow-visible text-[10px]"
          >
            {/* Background Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padding.top + innerHeight * (1 - ratio);
              const val = Math.round(minVal + ratio * range);
              return (
                <g key={ratio}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={width - padding.right}
                    y2={y}
                    stroke="#E2E8F0"
                    strokeDasharray="3 3"
                  />
                  <text x={padding.left - 8} y={y + 3} textAnchor="end" fill="#94A3B8" fontSize="9">
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Clinical Reference Threshold Line if provided */}
            {referenceLine && referenceLine.val >= minVal && referenceLine.val <= maxVal && (
              <g>
                <line
                  x1={padding.left}
                  y1={getY(referenceLine.val)}
                  x2={width - padding.right}
                  y2={getY(referenceLine.val)}
                  stroke={referenceLine.color}
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                />
                <text
                  x={width - padding.right}
                  y={getY(referenceLine.val) - 4}
                  textAnchor="end"
                  fill={referenceLine.color}
                  fontSize="8"
                  fontWeight="bold"
                >
                  {referenceLine.label} ({referenceLine.val} {unit})
                </text>
              </g>
            )}

            {/* Connecting Polyline */}
            <polyline
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={points}
            />

            {/* Gradient Fill under line */}
            {validData.length > 1 && (
              <polygon
                points={`${padding.left},${padding.top + innerHeight} ${points} ${getX(validData.length - 1)},${padding.top + innerHeight}`}
                fill={color}
                fillOpacity="0.08"
              />
            )}

            {/* Data Dots & Interactive tooltips */}
            {validData.map((d, i) => {
              const cx = getX(i);
              const cy = getY(d.value!);
              const isHovered = hoveredIndex === i;

              return (
                <g
                  key={i}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isHovered ? 6 : 4}
                    fill={isHovered ? '#FFFFFF' : color}
                    stroke={color}
                    strokeWidth="2.5"
                    className="transition-all"
                  />

                  {/* Date labels along bottom axis */}
                  <text
                    x={cx}
                    y={height - 10}
                    textAnchor="middle"
                    fill="#64748B"
                    fontSize="8.5"
                  >
                    {d.date.split(' à ')[0].slice(0, 5)}
                  </text>

                  {/* Tooltip bubble on hover */}
                  {isHovered && (
                    <g transform={`translate(${cx}, ${cy - 12})`}>
                      <rect
                        x="-45"
                        y="-26"
                        width="90"
                        height="22"
                        rx="5"
                        fill="#0F172A"
                        opacity="0.9"
                      />
                      <text
                        x="0"
                        y="-12"
                        textAnchor="middle"
                        fill="#FFFFFF"
                        fontSize="9.5"
                        fontWeight="bold"
                      >
                        {d.value} {unit}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Metrics Filter Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#0D5C58]" />
          <span className="text-xs font-bold text-slate-800">
            Courbes d'Évolution Clinique {patientName ? `— ${patientName}` : ''}
          </span>
          <span className="text-[10px] text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200 font-mono">
            {vitals.length} mesure{vitals.length > 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setSelectedMetric('ALL')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
              selectedMetric === 'ALL'
                ? 'bg-[#0D5C58] text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
            }`}
          >
            Vue d'Ensemble
          </button>
          <button
            type="button"
            onClick={() => setSelectedMetric('BP')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
              selectedMetric === 'BP'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
            }`}
          >
            Tension Artérielle
          </button>
          <button
            type="button"
            onClick={() => setSelectedMetric('HR')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
              selectedMetric === 'HR'
                ? 'bg-red-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
            }`}
          >
            Pouls (BPM)
          </button>
          <button
            type="button"
            onClick={() => setSelectedMetric('SPO2')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
              selectedMetric === 'SPO2'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
            }`}
          >
            SpO2 (%)
          </button>
          <button
            type="button"
            onClick={() => setSelectedMetric('GLUCOSE')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
              selectedMetric === 'GLUCOSE'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
            }`}
          >
            Glycémie (g/L)
          </button>
        </div>
      </div>

      {/* Chart Panels */}
      <div className="grid grid-cols-1 gap-4">
        {/* Tension Artérielle */}
        {(selectedMetric === 'ALL' || selectedMetric === 'BP') && (
          <div className="space-y-2">
            {renderLineChart(
              sortedVitals.map((v) => ({ value: v.bloodPressureSys, date: v.measuredAt })),
              70,
              180,
              '#BE123C',
              'Pression Artérielle Systolique (PAS)',
              'mmHg',
              { val: 140, label: 'Seuil HTA (140)', color: '#E11D48' }
            )}
            {renderLineChart(
              sortedVitals.map((v) => ({ value: v.bloodPressureDia, date: v.measuredAt })),
              40,
              120,
              '#9F1239',
              'Pression Artérielle Diastolique (PAD)',
              'mmHg',
              { val: 90, label: 'Seuil HTA (90)', color: '#FB7185' }
            )}
          </div>
        )}

        {/* Fréquence Cardiaque */}
        {(selectedMetric === 'ALL' || selectedMetric === 'HR') && (
          renderLineChart(
            sortedVitals.map((v) => ({ value: v.heartRate, date: v.measuredAt })),
            45,
            135,
            '#DC2626',
            'Fréquence Cardiaque au Repos (FC)',
            'bpm',
            { val: 100, label: 'Tachycardie (>100)', color: '#EF4444' }
          )
        )}

        {/* Saturation SpO2 */}
        {(selectedMetric === 'ALL' || selectedMetric === 'SPO2') && (
          renderLineChart(
            sortedVitals.map((v) => ({ value: v.oxygenSaturation, date: v.measuredAt })),
            90,
            100,
            '#0284C7',
            'Saturation en Oxygène (SpO2)',
            '%',
            { val: 95, label: 'Vigilance SpO2 (<95%)', color: '#F59E0B' }
          )
        )}

        {/* Glycémie */}
        {(selectedMetric === 'ALL' || selectedMetric === 'GLUCOSE') && (
          renderLineChart(
            sortedVitals.map((v) => ({ value: v.bloodGlucose, date: v.measuredAt })),
            0.6,
            1.8,
            '#059669',
            'Glycémie à Jeun',
            'g/L',
            { val: 1.26, label: 'Seuil Diabète (>1.26)', color: '#D97706' }
          )
        )}
      </div>

      {/* Clinical Reference Standards Info Box */}
      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-[#0D5C58] shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold text-slate-800">Seuils physiologiques de référence (Recommandations HAS / OMS) :</p>
          <p>
            • Pression artérielle normale : &lt; 140/90 mmHg • Pouls de repos adulte : 60 à 100 bpm • Saturation SpO2 optimale : 95 à 100% • Glycémie à jeun : 0.70 à 1.10 g/L.
          </p>
        </div>
      </div>
    </div>
  );
};
