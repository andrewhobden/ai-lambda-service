const LEVELS = ['debug', 'info', 'warn', 'error'];
const LEVEL_INDEX = LEVELS.reduce((acc, level, index) => {
  acc[level] = index;
  return acc;
}, {});

function createLogger(level = 'info') {
  const normalized = LEVELS.includes(level) ? level : 'info';
  const threshold = LEVEL_INDEX[normalized];

  const shouldLog = (target) => LEVEL_INDEX[target] >= threshold;

  return {
    debug: (msg) => {
      if (shouldLog('debug')) console.debug(prefix('DEBUG'), msg);
    },
    info: (msg) => {
      if (shouldLog('info')) console.info(prefix('INFO'), msg);
    },
    warn: (msg) => {
      if (shouldLog('warn')) console.warn(prefix('WARN'), msg);
    },
    error: (msg) => {
      if (shouldLog('error')) console.error(prefix('ERROR'), msg);
    },
    isDebugEnabled: () => shouldLog('debug')
  };
}

function prefix(label) {
  const now = new Date().toISOString();
  return `[${now}] ${label}`;
}

module.exports = { createLogger };
