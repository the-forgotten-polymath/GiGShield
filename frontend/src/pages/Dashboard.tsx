import { useEffect, useState } from 'react';
import { Shield, MapPin, Clock, AlertTriangle, ChevronRight, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { workersApi, triggersApi, type CoverageResponse, type TriggerEvent } from '../lib/api';
import { useAuthStore } from '../store/authStore';

const TIER_STYLES: Record<string, string> = {
  lite: 'gs-badge-tier-lite',
  standard: 'gs-badge-tier-standard',
  pro: 'gs-badge-tier-pro',
};
const TIER_NAMES: Record<string, string> = {
  lite: 'Kavach Lite',
  standard: 'Kavach Standard',
  pro: 'Kavach Pro',
};
const TRIGGER_LABELS: Record<string, string> = {
  WEATHER: '🌧️ Heavy Rain',
  AQI: '🏭 AQI Emergency',
  HEAT: '🌡️ Heat Advisory',
  ZONE_DISRUPTION: '📴 Zone Suspended',
  CIVIL: '🚧 Civil Disruption',
};

export default function Dashboard() {
  const { t } = useTranslation();
  const { worker } = useAuthStore();
  const [coverage, setCoverage] = useState<CoverageResponse | null>(null);
  const [triggers, setTriggers] = useState<TriggerEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!worker?.id) return;
    Promise.all([
      workersApi.getCoverage(worker.id).then((r) => setCoverage(r.data)),
      triggersApi.getActive().then((r) => setTriggers(r.data.triggers)),
    ]).finally(() => setLoading(false));
  }, [worker?.id]);

  const policy = coverage?.policy;
  const activeTrigger = coverage?.activeTrigger;
  const weekEnd = policy ? new Date(policy.week_end) : null;
  const daysLeft = weekEnd ? Math.max(0, Math.ceil((weekEnd.getTime() - Date.now()) / 86400000)) : 0;

  if (loading) {
    return (
      <div className="pt-4 space-y-4">
        <div className="shimmer h-48 rounded-2xl" />
        <div className="shimmer h-24 rounded-2xl" />
        <div className="shimmer h-24 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="pt-4 space-y-4 animate-slide-up">
      {/* Greeting */}
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-slate-50">
          {worker?.name ? `Namaste, ${worker.name.split(' ')[0]} 👋` : 'Namaste 👋'}
        </h1>
        <p className="text-dark-muted text-sm">
          {policy?.zone_name || 'Zone not set'} · {policy?.city || ''}
        </p>
      </div>

      {/* Active Disruption Alert */}
      {activeTrigger && (
        <div className="gs-alert-disruption animate-pulse-slow" id="disruption-alert">
          <AlertTriangle size={20} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm">{t('disruptionAlert')}</p>
            <p className="text-xs mt-0.5 text-red-400">
              {TRIGGER_LABELS[activeTrigger.trigger_type] || activeTrigger.trigger_type} detected.
              Payout processing…
            </p>
          </div>
        </div>
      )}

      {/* Coverage Card */}
      <div className="gs-card" id="coverage-card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-dark-muted mb-1.5">Coverage Status</p>
            {coverage?.isCovered ? (
              <span className="gs-badge-active">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse" />
                {t('coverageActive')} ✅
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-500/20 text-slate-400 border border-slate-500/30">
                {t('coverageInactive')}
              </span>
            )}
          </div>
          <div className="relative">
            <Shield size={44} className={`${coverage?.isCovered ? 'text-brand-400 shield-glow' : 'text-dark-muted'}`} />
          </div>
        </div>

        {policy && (
          <>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-dark rounded-xl p-3">
                <p className="text-xs text-dark-muted mb-1">{t('nextDebit')}</p>
                <p className="font-bold text-slate-100 text-sm">₹{policy.final_premium}</p>
                <p className="text-xs text-dark-muted">Monday</p>
              </div>
              <div className="bg-dark rounded-xl p-3">
                <p className="text-xs text-dark-muted mb-1">Coverage</p>
                <p className="font-bold text-slate-100 text-sm">{daysLeft}d left</p>
                <p className="text-xs text-dark-muted">This week</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className={TIER_STYLES[policy.tier] || 'gs-badge-tier-standard'}>
                {TIER_NAMES[policy.tier] || policy.tier}
              </span>
              <Link to="/premium" className="text-xs text-brand-400 flex items-center gap-1">
                Premium details <ChevronRight size={14} />
              </Link>
            </div>
          </>
        )}

        {!coverage?.isCovered && (
          <div className="text-center py-4">
            <p className="text-sm text-dark-muted mb-3">Subscribe to get covered</p>
            <Link to="/onboarding" className="gs-btn inline-flex w-auto px-6 text-sm">
              Get Covered <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      {coverage?.isCovered && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Max Daily', value: policy?.tier === 'lite' ? '₹300' : policy?.tier === 'pro' ? '₹800' : '₹500' },
            { label: 'Days covered', value: policy?.tier === 'lite' ? '2/wk' : policy?.tier === 'pro' ? '5/wk' : '4/wk' },
            { label: 'Payout', value: '<4 min' },
          ].map(({ label, value }) => (
            <div key={label} className="gs-card p-3 text-center">
              <p className="text-brand-300 font-bold text-lg">{value}</p>
              <p className="text-xs text-dark-muted mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Active Triggers (zone-wide) */}
      {triggers.length > 0 && (
        <div>
          <p className="text-xs text-dark-muted uppercase tracking-wider mb-2 font-semibold">Active in Your City</p>
          <div className="space-y-2">
            {triggers.slice(0, 3).map((te) => (
              <div key={te.id} className="flex items-center gap-3 p-3 rounded-xl bg-dark-card border border-red-500/20">
                <span className="text-lg">{TRIGGER_LABELS[te.trigger_type]?.split(' ')[0] || '⚡'}</span>
                <div>
                  <p className="text-sm font-medium text-slate-200">{TRIGGER_LABELS[te.trigger_type] || te.trigger_type}</p>
                  <p className="text-xs text-dark-muted">{te.zone_name}</p>
                </div>
                <span className="ml-auto text-xs text-red-400 font-semibold">ACTIVE</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timestamp */}
      <div className="flex items-center gap-2 text-xs text-dark-muted pb-2">
        <Clock size={12} /> Updated {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}
