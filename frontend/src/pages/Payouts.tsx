import { useEffect, useState } from 'react';
import { ArrowDownLeft, Clock, CheckCircle, Loader, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { workersApi, type PayoutRecord } from '../lib/api';
import { useAuthStore } from '../store/authStore';

const TRIGGER_EMOJI: Record<string, string> = {
  WEATHER: '🌧️', AQI: '🏭', HEAT: '🌡️', ZONE_DISRUPTION: '📴', CIVIL: '🚧',
};
const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle; color: string }> = {
  paid: { label: 'Paid', icon: CheckCircle, color: 'text-brand-400' },
  soft_flagged: { label: 'Processing', icon: Loader, color: 'text-amber-400' },
  pending: { label: 'Processing', icon: Loader, color: 'text-amber-400' },
  held: { label: 'Under Review', icon: AlertCircle, color: 'text-orange-400' },
  blocked: { label: 'Under Review', icon: AlertCircle, color: 'text-red-400' },
};

export default function Payouts() {
  const { t } = useTranslation();
  const { worker } = useAuthStore();
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!worker?.id) return;
    workersApi.getPayouts(worker.id)
      .then((r) => setPayouts(r.data.payouts))
      .finally(() => setLoading(false));
  }, [worker?.id]);

  return (
    <div className="pt-4 animate-slide-up">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-50 mb-1">{t('payouts')}</h1>
        <p className="text-dark-muted text-sm">Aapke sabhi payouts / Your protection payouts</p>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="shimmer h-20 rounded-2xl" />)}
        </div>
      )}

      {!loading && payouts.length === 0 && (
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-3xl bg-dark-card border border-dark-border flex items-center justify-center mx-auto mb-4">
            <ArrowDownLeft size={36} className="text-dark-muted" />
          </div>
          <p className="font-bold text-slate-300 mb-2">{t('noPayouts')}</p>
          <p className="text-sm text-dark-muted max-w-xs mx-auto">{t('noPayoutsDesc')}</p>
        </div>
      )}

      {!loading && payouts.length > 0 && (
        <div className="space-y-3" id="payouts-list">
          {payouts.map((p) => {
            const sc = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending;
            const StatusIcon = sc.icon;
            const date = new Date(p.created_at);
            return (
              <div key={p.id} className="gs-payout-card">
                <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-2xl shrink-0">
                  {TRIGGER_EMOJI[p.trigger_type] || '⚡'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-200 text-sm">
                    {p.trigger_type.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-dark-muted flex items-center gap-1 mt-0.5">
                    <Clock size={11} />
                    {date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    {p.utr && <span className="ml-1 opacity-60">· UTR {p.utr.slice(-6)}</span>}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-brand-300 text-lg">₹{Math.round(p.payout_amount)}</p>
                  <p className={`text-xs flex items-center gap-1 justify-end ${sc.color}`}>
                    <StatusIcon size={11} className={p.status === 'soft_flagged' || p.status === 'pending' ? 'animate-spin' : ''} />
                    {sc.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Total protected */}
      {payouts.length > 0 && (
        <div className="mt-6 gs-card border-brand-500/20">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-dark-muted">Total Income Protected</p>
              <p className="font-black text-2xl text-brand-300">
                ₹{payouts.filter(p => p.status === 'paid').reduce((s, p) => s + p.payout_amount, 0).toFixed(0)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-dark-muted">Payouts</p>
              <p className="font-bold text-slate-300 text-xl">{payouts.filter(p => p.status === 'paid').length}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
