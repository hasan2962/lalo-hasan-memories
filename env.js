/**
 * Loads env file in the browser — pure HTML/JS, no Node.
 * Uses "env" (no dot) because Live Server & many hosts block ".env"
 */
const EnvLoader = (() => {
  const ENV_FILES = ['env', '.env'];

  async function load() {
    let text = null;

    for (const file of ENV_FILES) {
      try {
        const res = await fetch(file);
        if (res.ok) {
          text = await res.text();
          break;
        }
      } catch {
        /* try next */
      }
    }

    if (!text) {
      throw new Error('Missing env file — create a file named "env" in the project root.');
    }

    const env = {};
    text.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq === -1) return;
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    });

    window.ENV = env;
    return env;
  }

  return { load };
})();
