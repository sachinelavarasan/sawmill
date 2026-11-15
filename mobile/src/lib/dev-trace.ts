/**
 * Development only, temporary: when React warns about a state update on a component that hasn't
 * mounted yet, also show the JavaScript call stack (in the Metro terminal and as a yellow box on
 * the phone), so we can see which function (ours or a library's) made the update.
 * Delete this file and its import in app/_layout.tsx once the cause is fixed.
 */
if (__DEV__) {
  const original = console.error;
  console.error = (...args: unknown[]) => {
    const text = args.map((a) => (typeof a === 'string' ? a : '')).join(' ');
    if (text.includes("hasn't mounted yet")) {
      const frames = (new Error().stack ?? '(no stack)')
        .split('\n')
        .slice(1)
        .filter((l) => !l.includes('dev-trace') && !l.includes('console.error'))
        .slice(0, 15)
        .join('\n');
      console.warn(`[TimberTrail TRACE] state update before mount — called from:\n${frames}`);
    }
    original(...args);
  };
  console.log('[TimberTrail] dev-trace active');
}

export {};
