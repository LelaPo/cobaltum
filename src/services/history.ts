import fs from 'node:fs';
import path from 'node:path';

export interface HistoryEntry {
  roleId: string;
  roleName: string;
  userId: string;
  userTag: string;
  oldHex: string;
  newHex: string;
  timestamp: string; // ISO string
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'role-history.json');

// Гарантируем наличие папки и файла
function ensureStorage(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

export function loadHistory(): HistoryEntry[] {
  ensureStorage();
  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
    return JSON.parse(raw) as HistoryEntry[];
  } catch (error) {
    console.error('[History] Ошибка чтения истории:', error);
    return [];
  }
}

export function recordColorChange(entry: Omit<HistoryEntry, 'timestamp'>): void {
  ensureStorage();
  const history = loadHistory();

  const newRecord: HistoryEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  };

  history.push(newRecord);

  // Храним последние 500 записей, чтобы файл не разрастался бесконечно
  if (history.length > 500) {
    history.shift();
  }

  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
  } catch (error) {
    console.error('[History] Ошибка записи в историю:', error);
  }
}

// Получить историю для конкретной роли (от новых к старым)
export function getRoleHistory(roleId: string, limit = 10): HistoryEntry[] {
  const history = loadHistory();
  return history
    .filter((entry) => entry.roleId === roleId)
    .reverse()
    .slice(0, limit);
}