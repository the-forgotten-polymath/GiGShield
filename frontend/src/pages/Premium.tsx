import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { workersApi, type PremiumResponse } from '../lib/api';
import { useAuthStore } from '../store/authStore';

const FACTOR_LABELS: Record<string, { label: string; emoji: string }> = {
  zone_flood_history: { label: 'Zone Flood History', emoji: '🌊' },
  seasonal_monsoon: { label: 'Monsoon Season', emoji: '🌧️' },
  weather_forecast: { label: '7-day Forecast', emoji: '📡' },
  worker_reliability: { label: 'Reliability Bonus', emoji: '⭐' },
  heat_season: { label: 'Heat Season', emoji: '☀️' },
  aqi_city_risk: { label: 'AQI Risk', emoji: '🏭' },
};

const TIER_NAMES: Record<string, string> = {
  lite: 'Kavach Lite', standard: 'Kavach Standard', pro: 'Kavach Pro',
};

export default function Premium() {
  const { t } = useTranslation();
  const { worker } = useAuthStore();
  const [data, setData] = useState<PremiumResponse['premium'] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!worker?.id) return;
    workersApi.getPremium(worker.id)
      .then((r) => setData(r.data.premium))
      .finally(() => setLoading(false));
  }, [worker?.id]);

  return (
    <div className="pt-4 animate-slide-up">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-50 mb-1">{t('yourPremium')}</h1>
        <p className="text-dark-muted text-sm">Aapke premium ka breakdown / Why your premium is what it is</p>
      </div>

      {loading && (
        <div className="space-y-4">
          <div className="shimmer h-36 rounded-2xl" />
          <div className="shimmer h-48 rounded-2xl" />
        </div>
      )}

      {!loading && !data && (
        <div className="text-center py-16 text-dark-muted">No active policy found.</div>
      )}

      {!loading && data && (
        <>
          {/* Main premium card */}
          <div className="gs-card mb-4 border-brand-500/20" id="premium-card">
            <div className="flex items-end justify-between mb-4">
              <div>
                <p className="text-xs text-dark-muted mb-1">{t('finalPremium')}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-brand-300">₹{data.final_premium}</span>
                  <span className="text-dark-muted text-sm">/week</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-dark-muted">Tier</p>
                <p className="font-bold text-slate-200">{TIER_NAMES[data.tier] || data.tier}</p>
              </div>
            </div>

            {/* Base vs Final visual */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-dark-muted">Base ₹{data.base_premium}</span>
              <span className="text-dark-muted">→</span>
              <span className="font-bold text-brand-300">Final ₹{data.final_premium}</span>
              {data.final_premium > data.base_premium && (
                <span className="ml-auto text-xs text-amber-400">+₹{data.final_premium - data.base_premium}</span>
              )}
              {data.final_premium < data.base_premium && (
                <span className="ml-auto text-xs text-brand-400">-₹{data.base_premium - data.final_premium}</span>
              )}
            </div>
          </div>

          {/* Factors breakdown */}
          <div className="gs-card mb-4">
            <div className="flex items-center gap-2 mb-4">
              <Info size={16} className="text-dark-muted" />
              <p className="text-sm font-semibold text-slate-200">{t('breakdown')}</p>
            </div>

            <div className="space-y-3">
              {Object.entries(data.premium_factors as Record<string, number>).map(([key, value]) => {
                const info = FACTOR_LABELS[key] || { label: key, emoji: '📊' };
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-lg w-7 text-center">{info.emoji}</span>
                    <div className="flex-1">
                      <p className="text-sm text-slate-300">{info.label}</p>
                    </div>
                    <div className={`flex items-center gap-1 font-bold text-sm ${value > 0 ? 'text-amber-400' : value < 0 ? 'text-brand-400' : 'text-dark-muted'}`}>
                      {value > 0 ? <TrendingUp size={14} /> : value < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
                      {value > 0 ? '+' : ''}₹{value}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Coverage window */}
          <div className="gs-card">
            <p className="text-xs text-dark-muted mb-2">Coverage Window</p>
            <p className="text-sm text-slate-300">
              {new Date(data.week_start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              {' → '}
              {new Date(data.week_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </p>
            <p className="text-xs text-dark-muted mt-1">Recalculates every Sunday 11 PM</p>
          </div>

          {/* Explanation note */}
          <div className="mt-4 p-4 rounded-xl border border-dark-border bg-dark">
            <p className="text-xs text-dark-muted">
              💡 Premium Sunday ko recalculate hota hai based on agle hafte ki weather forecast.
              Any change se pehle aapko notification milega.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
