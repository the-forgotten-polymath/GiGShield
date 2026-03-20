import { Outlet, NavLink } from 'react-router-dom';
import { Shield, ArrowDownLeft, CircleDollarSign, HelpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageToggle from './LanguageToggle';

export default function Layout() {
  const { t } = useTranslation();

  const navItems = [
    { to: '/', icon: Shield, label: 'Home', end: true },
    { to: '/payouts', icon: ArrowDownLeft, label: t('payouts') },
    { to: '/premium', icon: CircleDollarSign, label: 'Premium' },
    { to: '/help', icon: HelpCircle, label: 'Help' },
  ];

  return (
    <div className="min-h-dvh flex flex-col max-w-md mx-auto relative">
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 pt-12 pb-4">
        <div className="flex items-center gap-2">
          <Shield size={22} className="text-brand-400" />
          <span className="font-bold text-lg text-slate-100 tracking-tight">GigShield</span>
        </div>
        <LanguageToggle />
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto px-4 pb-28 animate-fade-in">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="gs-nav">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `gs-nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={22} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
