// Production-Safe Logging System
/* eslint-disable no-console */

const log = (...args: any[]) => __DEV__ && console.log(...args);
const info = (...args: any[]) => __DEV__ && console.info(...args);
const warn = (...args: any[]) => __DEV__ && console.warn(...args);
const error = (...args: any[]) => __DEV__ && console.error(...args);
const debug = (...args: any[]) => __DEV__ && console.debug(...args);

export const logger = {
  log,
  info,
  warn,
  error,
  debug,
};
