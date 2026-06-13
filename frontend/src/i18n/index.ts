import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from './locales/ar.json';
import en from './locales/en.json';

// Get saved language or default to Arabic
const savedLanguage = localStorage.getItem('beidar_language') || 'ar';

i18n.use(initReactI18next).init({
    resources: {
        ar: { translation: ar },
        en: { translation: en },
    },
    lng: savedLanguage,
    fallbackLng: 'ar',
    interpolation: {
        escapeValue: false, // React already escapes
    },
    react: {
        useSuspense: false,
    },
});

// Save language preference when changed
i18n.on('languageChanged', (lng) => {
    localStorage.setItem('beidar_language', lng);
    document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lng;
});

// Set initial direction
document.documentElement.dir = savedLanguage === 'ar' ? 'rtl' : 'ltr';
document.documentElement.lang = savedLanguage;

export default i18n;
