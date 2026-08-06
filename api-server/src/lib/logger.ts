const level = process.env.LOG_LEVEL ?? "info";
const levels: Record<string, number> = { trace: 10, debug: 20, info: 30, warn: 40, error: 50 };
const currentLevel = levels[level] ?? 30;

function log(lvl: string, lvlNum: number, obj: unknown, msg?: string) {
  if (lvlNum < currentLevel) return;
  const time = Date.now();
  const pid = process.pid;
  const entry = typeof obj === "string" ? { level: lvlNum, time, pid, msg: obj } : { level: lvlNum, time, pid, ...((obj as object) ?? {}), msg };
  console.log(JSON.stringify(entry));
}

export const logger = {
  trace: (obj: unknown, msg?: string) => log("trace", 10, obj, msg),
  debug: (obj: unknown, msg?: string) => log("debug", 20, obj, msg),
  info:  (obj: unknown, msg?: string) => log("info",  30, obj, msg),
  warn:  (obj: unknown, msg?: string) => log("warn",  40, obj, msg),
  error: (obj: unknown, msg?: string) => log("error", 50, obj, msg),
  fatal: (obj: unknown, msg?: string) => log("fatal", 60, obj, msg),
  child: (_bindings: object) => logger,
};
