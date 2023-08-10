import fs from "fs";

const LOGFILENAME = "ChromeSyncService.log";

const openOrCreate = () => {
  if (!fs.existsSync(LOGFILENAME)) {
    fs.open(LOGFILENAME, "w", (err) => {
      if (err) out(Level.ERROR, "error creating logfile", err);
    });
  }
};

enum Level {
  INFO = "[INFO]",
  WARN = "[WARN]",
  ERROR = "[ERROR]",
  DEBUG = "[DEBUG]",
}

const out = async (level: Level, message: string | null, object?: any) => {
  openOrCreate();
  const date = dateFormatter()
  if (object) {
    const logMessage = message + date +  JSON.stringify(object);
    console.log(level, date, message, object);
    await fs.appendFile(LOGFILENAME, logMessage + "\n", () => {});
  } else {
    console.log(level, date, message);
    await fs.appendFile(LOGFILENAME, level + date + message + "\n", () => {});
  }
};

/**
 * returns a date string that looks like '8-31-2022-8:12:11PM'
 */
export const dateFormatter = () => {
  const d = new Date()
      .toLocaleString()
      .replace(",", "-")
      .split(" ").join('')
      .replace("/", "-")
      .replace("/", "-")
      .replace(/\s/g,'')
  return d
}

export const log = {
  INFO: (message: string | null, object?: any) => {
    out(Level.INFO, message, object);
  },
  WARN: (message: string | null, object?: any) => {
    out(Level.WARN, message, object);
  },
  ERROR: (message: string | null, object?: any) => {
    out(Level.ERROR, message, object);
  },
  DEBUG: (message: string | null, object?: any) => {
    out(Level.DEBUG, message, object);
  },
};
