/**
 * English / Tamil. The words themselves live in packages/shared so web and Android agree.
 * Which language is in use is a preference: services/preferences provides this context (the
 * signed-in user's choice, else their account's language; signed out, the phone's last one).
 */
import { translate, type Lang, type TKey } from '@timbertrail/shared';
import { createContext, useCallback, useContext } from 'react';

export const LangCtx = createContext<{
  lang: Lang;
  setLang: (l: Lang) => void;
  /** changes when other display preferences do (the date format), so text re-renders with them */
  rev: string;
}>({ lang: 'en', setLang: () => {}, rev: '' });

export function useLang() {
  const { lang, setLang } = useContext(LangCtx);
  return { lang, setLang };
}

export function useT() {
  const { lang, rev } = useContext(LangCtx);
  // `rev` is a dependency on purpose: a new function re-renders whatever renders dates
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback((k: TKey, v?: Record<string, string | number>) => translate(lang, k, v), [lang, rev]);
}
