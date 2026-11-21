import type { PageTourKey } from '@timbertrail/shared';
import { driver, type Driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { HOME_STEPS, type PageTour, pageTourFor } from './pages';
import { buildShellSteps, toDriveSteps, tourTargetVisible } from './steps';
import './tour.css';

interface Tour {
  /** The Help button: this page's tour where it has one, otherwise the tour of the app. */
  start: () => void;
  /** The tour of the app's frame (plus the home page's parts, when on the home page). */
  startApp: () => void;
}

const TourContext = createContext<Tour | null>(null);

/**
 * This browser already knows a tour is done for this user, so a reload never re-opens it before
 * /auth/me answers, and a private window or a failed save still doesn't nag.
 */
const localKey = (userId: string, tour: string) => `timbertrail.tour.${userId}.${tour}`;
const seenHere = (userId: string, tour: string) => {
  try {
    return localStorage.getItem(localKey(userId, tour)) === '1';
  } catch {
    return false;
  }
};
const rememberHere = (userId: string, tour: string) => {
  try {
    localStorage.setItem(localKey(userId, tour), '1');
  } catch {
    /* the server copy is still kept */
  }
};

/**
 * Calls `go` once the page has drawn its parts (any of `ids` on screen), or after `maxMs` regardless:
 * pages load their data first, and a tour started too early would skip the table.
 */
function whenReady(ids: string[], go: () => void, maxMs = 4000) {
  const began = Date.now();
  let timer = 0;
  const tick = () => {
    if (ids.some(tourTargetVisible) || Date.now() - began > maxMs) {
      // a moment more for the entrance animations to finish, so the highlight lands in place
      timer = window.setTimeout(go, 350);
      return;
    }
    timer = window.setTimeout(tick, 200);
  };
  timer = window.setTimeout(tick, 300);
  return () => window.clearTimeout(timer);
}

/**
 * The guided tours (driver.js). The app tour starts by itself the first time someone signs in, on the
 * home page; after that, each page's own tour starts the first time they open that page. The Help
 * button replays the tour of the page they're on. Finishing or closing a tour marks it seen on the
 * user, so it doesn't come back on another browser.
 */
export function TourProvider({ children }: { children: ReactNode }) {
  const { user, simple, markTourDone, markTourSeen } = useAuth();
  const { t } = useI18n();
  const { pathname } = useLocation();
  const active = useRef<Driver | null>(null);
  /** tours already started by themselves in this visit, so each is offered once */
  const autoTried = useRef(new Set<string>());

  const run = useCallback(
    (steps: DriveStep[], onDone: () => void) => {
      active.current?.destroy();
      if (steps.length === 0) return;
      const d = driver({
        steps,
        showProgress: steps.length > 1,
        progressText: '{{current}} / {{total}}',
        nextBtnText: t('tourNext'),
        prevBtnText: t('tourBack'),
        doneBtnText: t('tourDone'),
        popoverClass: 'tt-tour',
        stagePadding: 6,
        stageRadius: 14,
        overlayOpacity: 0.55,
        smoothScroll: true,
        onDestroyed: () => {
          active.current = null;
          onDone();
        },
      });
      active.current = d;
      d.drive();
    },
    [t],
  );

  const startApp = useCallback(() => {
    if (!user) return;
    const steps = buildShellSteps({ t, simple, name: user.name.split(' ')[0], extra: pathname === '/' ? HOME_STEPS : [] });
    run(steps, () => {
      rememberHere(user.id, 'app');
      if (!user.tourCompletedAt) void markTourDone();
    });
  }, [user, simple, t, pathname, run, markTourDone]);

  const startPage = useCallback(
    (tour: PageTour) => {
      if (!user) return;
      run(toDriveSteps(t, tour.steps), () => {
        rememberHere(user.id, tour.key);
        if (!user.toursSeen.includes(tour.key)) void markTourSeen(tour.key);
      });
    },
    [user, t, run, markTourSeen],
  );

  const start = useCallback(() => {
    const page = pageTourFor(pathname);
    if (page) startPage(page);
    else startApp();
  }, [pathname, startPage, startApp]);

  // Offered once by themselves: the app tour first (home page only, never over a deep link or a form),
  // then each page's tour on the first visit to that page.
  useEffect(() => {
    if (!user || active.current) return;
    const appDone = !!user.tourCompletedAt || seenHere(user.id, 'app');
    if (!appDone) {
      if (pathname !== '/' || autoTried.current.has('app')) return;
      autoTried.current.add('app');
      return whenReady(['nav-main', 'menu-button'], startApp);
    }
    const page = pageTourFor(pathname);
    if (!page || autoTried.current.has(page.key) || user.toursSeen.includes(page.key as PageTourKey) || seenHere(user.id, page.key)) return;
    autoTried.current.add(page.key);
    const ids = page.steps.flatMap((s) => (s.id ? [s.id] : []));
    let started = false;
    const cancel = whenReady(ids, () => {
      started = true;
      startPage(page);
    });
    return () => {
      cancel();
      // left the page before it loaded: offer it on the next visit instead
      if (!started) autoTried.current.delete(page.key);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on arriving at a page, or once the profile is known
  }, [user?.id, pathname]);

  // a tour never outlives the page it explains
  useEffect(() => () => active.current?.destroy(), [pathname]);

  const value = useMemo(() => ({ start, startApp }), [start, startApp]);
  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour outside TourProvider');
  return ctx;
}
