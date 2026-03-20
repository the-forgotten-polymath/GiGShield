import { useTranslation } from 'react-i18next';

export default function LanguageToggle() {
  const { i18n } = useTranslation();
  const isHindi = i18n.language === 'hi';

  return (
    <button
      onClick={() => i18n.changeLanguage(isHindi ? 'en' : 'hi')}
      className="text-xs font-bold px-3 py-1.5 rounded-full border border-dark-border text-dark-muted hover:border-brand-500 hover:text-brand-400 transition-colors"
      id="language-toggle"
      aria-label="Toggle language"
    >
      {isHindi ? 'EN' : 'हिं'}
    </button>
  );
}
