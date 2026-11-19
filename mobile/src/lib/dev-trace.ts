/**
 * Development only, temporary: finds who causes React's
 *   "Can't perform a React state update on a component that hasn't mounted yet"
 *
 * React only says *that* it happened. This catches the warning, takes the JavaScript call stack
 * at that moment, has Metro symbolicate it (the same lookup the red error screen uses, so frames
 * read as real files and lines instead of bundle offsets) and prints it:
 *   - in the Metro terminal (console.log — copy from there), and
 *   - as a yellow box on the phone (the message holds the frames; ignore its "Code:" panel,
 *     which only points at this file).
 * The first frame from the app's own code (src/…) is called out; if there is none, the frames
 * show which library did it.
 *
 * Delete this file and its import in app/_layout.tsx once the cause is fixed.
 */
type Frame = { methodName?: string; file?: string; lineNumber?: number; column?: number };

/** react-native internals and this file: never the cause, only noise */
const NOISE = /dev-trace|LogBox|ExceptionsManager|console|Renderer\/implementations|ReactFabric|ReactNativeRenderer|react-reconciler|scheduler\//;

const short = (file: string) => file.replace(/^.*?(node_modules\/|\/src\/)/, (_, m: string) => (m === '/src/' ? 'src/' : ''));

async function explain(rawStack: string, react: string) {
  let lines: string[];
  let ours: string | undefined;
  try {
    // react-native's own symbolication helpers (dev only); required lazily so a release build never loads them
    const parseErrorStack = require('react-native/Libraries/Core/Devtools/parseErrorStack').default as (s: string) => Frame[];
    const symbolicate = require('react-native/Libraries/Core/Devtools/symbolicateStackTrace').default as (s: Frame[]) => Promise<{ stack: Frame[] }>;
    const { stack } = await symbolicate(parseErrorStack(rawStack));
    const frames = stack.filter((f) => f.file && !NOISE.test(f.file)).slice(0, 18);
    lines = frames.map((f) => `  ${f.methodName || '(anonymous)'}  —  ${short(f.file!)}:${f.lineNumber ?? '?'}`);
    const mine = frames.find((f) => f.file && !f.file.includes('node_modules'));
    ours = mine ? `${mine.methodName || '(anonymous)'} — ${short(mine.file!)}:${mine.lineNumber ?? '?'}` : undefined;
  } catch (e) {
    lines = [`  (Metro could not symbolicate: ${(e as Error).message}) raw stack:`, ...rawStack.split('\n').slice(1, 16)];
  }
  const report = [
    '[TimberTrail TRACE] state update before mount',
    ours ? `>> first app frame: ${ours}` : '>> no app frame — a library made the update (see below)',
    'called from (newest first):',
    ...lines,
    ...(react ? ['React said:', react] : []),
  ].join('\n');
  console.log(`\n${report}\n`);
  console.warn(report);
}

if (__DEV__) {
  const original = console.error;
  /** the first few are enough; the same cause usually repeats */
  let reported = 0;
  console.error = (...args: unknown[]) => {
    const text = args.map((a) => (typeof a === 'string' ? a : '')).join(' ');
    if (text.includes("hasn't mounted yet") && reported < 3) {
      reported += 1;
      const rawStack = new Error().stack ?? '';
      // anything React passed after the message (a component stack, when it adds one)
      const react = args
        .slice(1)
        .map((a) => (typeof a === 'string' ? a : a instanceof Error ? (a.stack ?? a.message) : ''))
        .filter(Boolean)
        .join('\n')
        .trim();
      void explain(rawStack, react);
    }
    original(...args);
  };
  console.log('[TimberTrail] dev-trace active');
}

export {};
