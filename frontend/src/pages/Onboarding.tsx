import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Phone, User, MapPin, CreditCard, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { authApi, workersApi, subscriptionsApi, type Zone } from '../lib/api';
import { useAuthStore } from '../store/authStore';

type Step = 'welcome' | 'phone' | 'otp' | 'profile' | 'zone' | 'tier' | 'upi';

const TIERS = [
  { id: 'lite', nameKey: 'kavachLite', descKey: 'liteDesc', color: 'border-blue-500/50 bg-blue-500/10', badge: '🔵' },
  { id: 'standard', nameKey: 'kavachStandard', descKey: 'standardDesc', color: 'border-brand-500/70 bg-brand-500/10', badge: '🟢', recommended: true },
  { id: 'pro', nameKey: 'kavachPro', descKey: 'proDesc', color: 'border-amber-500/50 bg-amber-500/10', badge: '🟡' },
];

const PLATFORMS = ['swiggy', 'zomato', 'blinkit', 'dunzo'];

export default function Onboarding() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const [step, setStep] = useState<Step>('welcome');
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('swiggy');
  const [zones, setZones] = useState<Zone[]>([]);
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedTier, setSelectedTier] = useState('standard');
  const [upiId, setUpiId] = useState('');
  const [workerId, setWorkerId] = useState('');

  async function handleSendOtp() {
    if (phone.length !== 10) { toast.error('10-digit number please'); return; }
    setLoading(true);
    // In production: Firebase Auth signInWithPhoneNumber
    // For demo: simulate OTP
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    toast.success('OTP sent to +91' + phone);
    setStep('otp');
  }

  async function handleVerifyOtp() {
    setLoading(true);
    try {
      // Demo: treat OTP as the mock idToken
      const res = await authApi.verifyOtp(otp + '-mock');
      setAuth(res.data.token, res.data.worker);
      setWorkerId(res.data.worker.id);
      toast.success('Verified! ✅');
      // Load zones for selection
      const zonesRes = await workersApi.getZones();
      setZones(zonesRes.data.zones);
      setLoading(false);
      setStep('profile');
    } catch {
      setLoading(false);
      toast.error('Verification failed — try again');
    }
  }

  async function handleRegister() {
    if (!name.trim()) { toast.error('Please enter your name'); return; }
    setLoading(true);
    try {
      await workersApi.register({ name, zoneId: selectedZone, platform, language: 'hi' });
      setLoading(false);
      setStep('tier');
    } catch {
      setLoading(false);
      toast.error('Registration failed');
    }
  }

  async function handleActivate() {
    if (!upiId.includes('@')) { toast.error('Enter valid UPI ID'); return; }
    setLoading(true);
    try {
      await subscriptionsApi.setupMandate({ upiId, tier: selectedTier });
      toast.success('Coverage activated! 🛡️');
      navigate('/');
    } catch {
      toast.error('Setup failed — try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-5 max-w-md mx-auto py-12">
      {step === 'welcome' && (
        <div className="text-center animate-slide-up w-full">
          <div className="mb-8 flex justify-center">
            <div className="relative">
              <div className="w-24 h-24 rounded-3xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center shield-glow">
                <Shield size={48} className="text-brand-400" />
              </div>
              <div className="absolute -inset-2 rounded-3xl border border-brand-500/10 animate-pulse-slow" />
            </div>
          </div>
          <h1 className="text-3xl font-black text-slate-50 mb-2">{t('welcome')}</h1>
          <p className="text-dark-muted mb-2">⚡ Disruption होने पर 4 मिनट में UPI payment</p>
          <p className="text-dark-muted text-sm mb-10">Auto-payout in 4 minutes when disruptions hit</p>

          <div className="space-y-3 mb-10">
            {[
              { en: '0 claim filing', hi: 'कोई claim form नहीं' },
              { en: '0 paperwork', hi: 'कोई कागज़ात नहीं' },
              { en: '₹49/week, auto-debited Monday', hi: 'सिर्फ ₹49/हफ्ता' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-xs font-bold">✓</span>
                <span className="text-slate-300">{item.hi} <span className="text-dark-muted">/ {item.en}</span></span>
              </div>
            ))}
          </div>

          <button className="gs-btn" onClick={() => setStep('phone')}>
            <Shield size={18} /> {t('getStarted')}
          </button>
        </div>
      )}

      {step === 'phone' && (
        <div className="w-full animate-slide-up">
          <button onClick={() => setStep('welcome')} className="text-dark-muted text-sm mb-6 flex items-center gap-1">← Back</button>
          <h2 className="text-2xl font-bold mb-2 text-slate-50">मोबाइल नंबर</h2>
          <p className="text-dark-muted text-sm mb-8">Your mobile number / {t('enterPhone')}</p>

          <div className="flex gap-2 mb-6">
            <span className="gs-input w-16 text-center font-bold">+91</span>
            <input
              id="phone-input"
              type="tel" maxLength={10} value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              placeholder="9876543210"
              className="gs-input flex-1"
              autoFocus
            />
          </div>
          <button className="gs-btn" onClick={handleSendOtp} disabled={loading || phone.length !== 10}>
            <Phone size={18} /> {loading ? t('loading') : t('sendOtp')}
          </button>
        </div>
      )}

      {step === 'otp' && (
        <div className="w-full animate-slide-up">
          <button onClick={() => setStep('phone')} className="text-dark-muted text-sm mb-6 flex items-center gap-1">← Back</button>
          <h2 className="text-2xl font-bold mb-2 text-slate-50">OTP Verify</h2>
          <p className="text-dark-muted text-sm mb-8">+91{phone} पर भेजा गया OTP enter करें<br /><span className="text-xs">(Demo: enter any 6 digits)</span></p>

          <input
            id="otp-input"
            type="tel" maxLength={6} value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            placeholder="• • • • • •"
            className="gs-input text-center text-2xl tracking-[0.5em] mb-6"
            autoFocus
          />
          <button className="gs-btn" onClick={handleVerifyOtp} disabled={loading || otp.length !== 6}>
            <Lock size={18} /> {loading ? t('loading') : t('verifyOtp')}
          </button>
        </div>
      )}

      {step === 'profile' && (
        <div className="w-full animate-slide-up">
          <h2 className="text-2xl font-bold mb-6 text-slate-50">अपना profile बनाएं</h2>

          <label className="text-sm text-dark-muted mb-1 block">{t('yourName')}</label>
          <input id="name-input" type="text" value={name} onChange={(e) => setName(e.target.value)} className="gs-input mb-4" placeholder="Raju Verma" autoFocus />

          <label className="text-sm text-dark-muted mb-1 block">{t('selectPlatform')}</label>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {PLATFORMS.map((p) => (
              <button key={p} onClick={() => setPlatform(p)}
                className={`py-3 rounded-xl border capitalize font-medium text-sm transition-all ${platform === p ? 'border-brand-500 bg-brand-500/15 text-brand-300' : 'border-dark-border text-dark-muted'}`}>
                {p}
              </button>
            ))}
          </div>

          <label className="text-sm text-dark-muted mb-1 block">{t('selectZone')}</label>
          <select id="zone-select" value={selectedZone} onChange={(e) => setSelectedZone(e.target.value)}
            className="gs-input mb-6 bg-dark-card">
            <option value="">-- Zone chun -- select zone --</option>
            {zones.map((z) => <option key={z.id} value={z.id}>{z.display_name}</option>)}
          </select>

          <button className="gs-btn" onClick={handleRegister} disabled={loading || !name || !selectedZone}>
            <User size={18} /> {loading ? t('loading') : 'Next →'}
          </button>
        </div>
      )}

      {step === 'tier' && (
        <div className="w-full animate-slide-up">
          <h2 className="text-2xl font-bold mb-2 text-slate-50">{t('selectTier')}</h2>
          <p className="text-dark-muted text-sm mb-6">आपके zone के हिसाब से Standard recommended है</p>

          <div className="space-y-3 mb-8">
            {TIERS.map((tier) => (
              <button key={tier.id} onClick={() => setSelectedTier(tier.id)}
                className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${selectedTier === tier.id ? tier.color : 'border-dark-border bg-dark-card'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-100">{tier.badge} {t(tier.nameKey)}</span>
                  {tier.recommended && <span className="text-xs font-bold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full">Recommended</span>}
                </div>
                <p className="text-sm text-dark-muted">{t(tier.descKey)}</p>
              </button>
            ))}
          </div>

          <button className="gs-btn" onClick={() => setStep('upi')}>
            Next →
          </button>
        </div>
      )}

      {step === 'upi' && (
        <div className="w-full animate-slide-up">
          <h2 className="text-2xl font-bold mb-2 text-slate-50">UPI AutoPay Setup</h2>
          <p className="text-dark-muted text-sm mb-8">Premium हर सोमवार auto-debit होगा। पहला payment ₹{selectedTier === 'lite' ? 29 : selectedTier === 'pro' ? 79 : 49}।</p>

          <input id="upi-input" type="text" value={upiId} onChange={(e) => setUpiId(e.target.value)}
            placeholder={t('upiId')} className="gs-input mb-3" autoFocus />
          <p className="text-xs text-dark-muted mb-8">e.g. raju@ybl, 9876543210@paytm</p>

          <div className="gs-card mb-6 border-brand-500/20">
            <p className="text-xs text-dark-muted mb-1">Summary</p>
            <p className="font-bold text-brand-300">Tier: {TIERS.find(t => t.id === selectedTier)?.nameKey ? t(TIERS.find(t => t.id === selectedTier)!.nameKey) : selectedTier}</p>
            <p className="text-sm text-slate-300">Weekly premium: ₹{selectedTier === 'lite' ? 29 : selectedTier === 'pro' ? 79 : 49}</p>
          </div>

          <button id="activate-btn" className="gs-btn" onClick={handleActivate} disabled={loading || !upiId.includes('@')}>
            <CreditCard size={18} /> {loading ? t('loading') : t('activate')}
          </button>
        </div>
      )}

      {/* Step dots */}
      {step !== 'welcome' && (
        <div className="flex gap-2 mt-8">
          {(['phone', 'otp', 'profile', 'tier', 'upi'] as Step[]).map((s, i) => {
            const stepIdx = ['phone', 'otp', 'profile', 'tier', 'upi'].indexOf(step);
            return (
              <div key={s} className={`h-1 rounded-full transition-all ${i <= stepIdx ? 'bg-brand-500 w-6' : 'bg-dark-border w-2'}`} />
            );
          })}
        </div>
      )}
    </div>
  );
}
