import fs from "fs";
import path from "path";

const DEBUG_LOG_PATH = path.join(process.cwd(), ".cursor", "debug.log");

export interface DebugLogEntry {
  timestamp: number;
  location: string;
  message: string;
  data?: Record<string, any>;
  sessionId?: string;
}

export function debugLog(
  location: string,
  message: string,
  data?: Record<string, any>,
): void {
  if (process.env.DEBUG !== "true") {
    return;
  }

  const entry: DebugLogEntry = {
    timestamp: Date.now(),
    location,
    message,
    data,
    sessionId: "debug-session",
  };

  try {
    fs.mkdirSync(path.dirname(DEBUG_LOG_PATH), { recursive: true });
    fs.appendFileSync(DEBUG_LOG_PATH, JSON.stringify(entry) + "\n");
  } catch (e) {
  }
}

export function clearDebugLog(): void {
  try {
    if (fs.existsSync(DEBUG_LOG_PATH)) {
      fs.unlinkSync(DEBUG_LOG_PATH);
    }
  } catch (e) {
  }
}

