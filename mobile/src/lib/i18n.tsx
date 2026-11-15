/** English / Tamil. The words themselves live in packages/shared so web and Android agree. */
import { translate, type Lang, type TKey } from '@timbertrail/shared';
import { KEYS, getStored, setStored } from './storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const isLang = (v: unknown): v is Lang => v === 'en' || v === 'ta';

const LangCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void; adopt: (l: string) => void }>({
  lang: 'en',
  setLang: () => {},
  adopt: () => {},
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');
  /** true once the user has picked a language on this phone — it then wins over the account's default */
  const [chosen, setChosen] = useState(false);

  useEffect(() => {
    getStored(KEYS.lang)
      .then((v) => {
        if (isLang(v)) {
          setLangState(v);
          setChosen(true);
        }
      })
      .catch(() => undefined);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    setChosen(true);
    setStored(KEYS.lang, l).catch(() => undefined);
  }, []);

  /** Use the account's preferred language unless one was picked on this phone. */
  const adopt = useCallback(
    (l: string) => {
      if (!chosen && isLang(l)) setLangState(l);
    },
    [chosen],
  );

  const value = useMemo(() => ({ lang, setLang, adopt }), [lang, setLang, adopt]);
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}

export const useLang = () => useContext(LangCtx);

export function useT() {
  const { lang } = useContext(LangCtx);
  return useCallback((k: TKey, v?: Record<string, string | number>) => translate(lang, k, v), [lang]);
}
