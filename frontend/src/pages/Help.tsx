import { useTranslation } from 'react-i18next';
import { MessageCircle, Terminal, LogOut } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const BOT_COMMANDS = [
  { cmd: 'STATUS', desc_hi: 'Coverage status check', desc_en: 'Check your coverage' },
  { cmd: 'PAYOUT', desc_hi: 'Last payout dekho', desc_en: 'View last payout' },
  { cmd: 'HELP',   desc_hi: 'Yeh menu', desc_en: 'Show this menu' },
  { cmd: 'STOP',   desc_hi: 'Subscription band karo', desc_en: 'Cancel subscription' },
];

const WHATSAPP_NUMBER = '+14155238886'; // Twilio sandbox

export default function Help() {
  const { t, i18n } = useTranslation();
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  const isHindi = i18n.language === 'hi';

  function handleLogout() {
    logout();
    navigate('/onboarding');
    toast.success('Logged out');
  }

  return (
    <div className="pt-4 animate-slide-up">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-50 mb-1">{t('helpTitle')}</h1>
        <p className="text-dark-muted text-sm">GigShield Support</p>
      </div>

      {/* WhatsApp CTA */}
      <div className="gs-card mb-4 border-green-500/20" id="whatsapp-card">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-green-500/20 border border-green-500/30 flex items-center justify-center shrink-0">
            <MessageCircle size={24} className="text-green-400" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-slate-100 mb-1">{t('whatsappBot')}</p>
            <p className="text-sm text-dark-muted mb-3">{t('whatsappDesc')}</p>
            <a
              id="whatsapp-link"
              href={`https://wa.me/${WHATSAPP_NUMBER.replace('+', '')}?text=STATUS`}
              target="_blank"
              rel="noopener noreferrer"
              className="gs-btn inline-flex w-auto px-5 py-3 text-sm bg-green-500 hover:bg-green-400"
              style={{ boxShadow: '0 4px 20px rgba(34,197,94,0.3)' }}
            >
              <MessageCircle size={16} /> {t('chatOnWhatsApp')}
            </a>
          </div>
        </div>
      </div>

      {/* Bot commands */}
      <div className="gs-card mb-4" id="bot-commands">
        <div className="flex items-center gap-2 mb-4">
          <Terminal size={16} className="text-dark-muted" />
          <p className="font-semibold text-slate-200 text-sm">{t('commands')}</p>
        </div>

        <div className="space-y-2">
          {BOT_COMMANDS.map(({ cmd, desc_hi, desc_en }) => (
            <div key={cmd} className="flex items-center gap-3 py-2 border-b border-dark-border last:border-0">
              <code className="text-sm font-bold text-brand-300 bg-brand-500/10 px-2 py-1 rounded min-w-[70px] text-center">
                {cmd}
              </code>
              <p className="text-sm text-slate-300">
                {isHindi ? desc_hi : desc_en}
              </p>
            </div>
          ))}
        </div>

        <p className="text-xs text-dark-muted mt-3">
          {isHindi
            ? `WhatsApp करें: ${WHATSAPP_NUMBER} · Message में command type करें`
            : `WhatsApp: ${WHATSAPP_NUMBER} · Type any command to get started`}
        </p>
      </div>

      {/* How it works */}
      <div className="gs-card mb-4">
        <p className="font-semibold text-slate-200 text-sm mb-3">GigShield kaise kaam karta hai?</p>
        <div className="space-y-3 text-sm text-slate-300">
          {[
            { n: '1', hi: 'Har hafte ₹49 auto-debit hota hai', en: 'Weekly ₹49 auto-debited Monday 6 AM' },
            { n: '2', hi: 'Hum aapke zone ko 24×7 monitor karte hain', en: 'Your zone monitored 24×7 for disruptions' },
            { n: '3', hi: 'Disruption hote hi payout automatically start', en: 'Payout auto-triggers — no claim needed' },
            { n: '4', hi: '4 minute mein UPI payment', en: '₹275+ in your UPI in under 4 minutes' },
          ].map(({ n, hi, en }) => (
            <div key={n} className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-brand-500/20 text-brand-400 flex items-center justify-center text-xs font-bold shrink-0">
                {n}
              </span>
              <p>{isHindi ? hi : en}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Logout */}
      <button
        id="logout-btn"
        onClick={handleLogout}
        className="gs-btn-ghost text-red-400 border-red-500/30 hover:bg-red-500/10 mt-2"
      >
        <LogOut size={16} /> {t('logout')}
      </button>
    </div>
  );
}
