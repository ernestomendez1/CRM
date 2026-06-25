// The api accepts the same locales the web supports.
// Kept inline to avoid pulling the next-intl-coupled i18n module into the api.
export const locales = ['en', 'es'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';
