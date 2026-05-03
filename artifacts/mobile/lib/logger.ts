/**
 * Logger موحّد لتطبيق ترياق.
 *
 * - في Development (`__DEV__ === true`): يطبع كل شيء على console.
 * - في Production (`__DEV__ === false`): صامت تماماً، لا أي output.
 *
 * استخدمه بدلاً من `console.log/warn/error/info/debug` في كل ملفات التطبيق.
 *
 * مثال:
 *   import { logger } from "@/lib/logger";
 *   logger.error("[Auth] failed", err);
 */

type LogFn = (...args: unknown[]) => void;

const noop: LogFn = () => {};

const isDev: boolean = typeof __DEV__ !== "undefined" ? __DEV__ : process.env["NODE_ENV"] !== "production";

export const logger: {
  log: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
  debug: LogFn;
} = isDev
  ? {
      log: (...a) => console.log(...a),
      info: (...a) => console.info(...a),
      warn: (...a) => console.warn(...a),
      error: (...a) => console.error(...a),
      debug: (...a) => console.debug(...a),
    }
  : {
      log: noop,
      info: noop,
      warn: noop,
      error: noop,
      debug: noop,
    };
