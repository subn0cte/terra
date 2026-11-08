import { COUNTRIES, Country } from '../data/countries';

export const STORAGE_KEYS = {
  COMPLETED: 'terra_completed_countries',
  DAILY_PLAYS: 'terra_daily_history',
  STATS: 'terra_stats',
  AUDIO: 'terra_audio_enabled',
  QUEST_STATS: 'terra_quest_records',
};

export interface DailyResult {
  date: string;
  countryId: string;
  countryName: string;
  score: number;
  timeRemaining: number;
  timeSpent: number;
  attempts: {
    hemisphere: number;
    continent: number;
    language: number;
    flag: number;
  };
  solved: {
    hemisphere: boolean;
    continent: boolean;
    language: boolean;
    flag: boolean;
  };
  completedAt: number;
}

export interface PlayerStats {
  played: number;
  completed: number;
  totalScore: number;
  bestScore: number;
  streak: number;
  lastPlayedDate: string | null;
}

export interface QuestStats {
  questsFinished: number;
  bestStreak: number;
  bestBlitz: number;
}

export type QuestType = 'island_hopper' | 'continent_expedition' | 'blitz_60s' | 'survival_streak';

export interface QuestMeta {
  type: QuestType;
  title: string;
  description: string;
  badge: string;
}

export const QUESTS: QuestMeta[] = [
  {
    type: 'island_hopper',
    title: 'island hopper',
    description: 'guess 3 island & archipelago nations from across the globe.',
    badge: '🏝️',
  },
  {
    type: 'continent_expedition',
    title: 'continent expedition',
    description: 'conquer 3 nations from a chosen continent.',
    badge: '🧭',
  },
  {
    type: 'blitz_60s',
    title: 'blitz 60s',
    description: 'speed run: score as many points as possible in 60 seconds.',
    badge: '⚡',
  },
  {
    type: 'survival_streak',
    title: 'survival streak',
    description: 'endless run with 3 lives. how far can your streak go?',
    badge: '❤️',
  },
];

// List of island & archipelago nations for island hopper
const ISLAND_COUNTRY_IDS = new Set([
  'jp', 'mg', 'is', 'nz', 'cu', 'ie', 'id', 'ph', 'cy', 'mt',
  'bs', 'bb', 'jm', 'tt', 'fj', 'mu', 'cv', 'sc', 'mv', 'km',
  'st', 'sg', 'lk', 'bh', 'ws', 'to', 'vu', 'sb', 'pw', 'fm',
  'mh', 'ki', 'nr', 'tv', 'ag', 'dm', 'gd', 'kn', 'lc', 'vc', 'gb'
]);

// Get YYYY-MM-DD in local time
export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Calculate days since anchor epoch (2026-01-01)
export function getDayNumber(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const epoch = new Date(2026, 0, 1);
  const diffTime = target.getTime() - epoch.getTime();
  return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
}

/**
 * Returns the country for today.
 * The 195 countries in COUNTRIES are already stored in an interleaved mixed sequence!
 */
export function getDailyCountry(dateStr: string, completedCountryIds: string[]): {
  country: Country | null;
  isAllCompleted: boolean;
  remainingCount: number;
  dayIndex: number;
} {
  const completedSet = new Set(completedCountryIds);
  const available = COUNTRIES.filter((c) => !completedSet.has(c.id));

  if (available.length === 0) {
    return {
      country: null,
      isAllCompleted: true,
      remainingCount: 0,
      dayIndex: getDayNumber(dateStr),
    };
  }

  // Pick deterministically based on day index from available mixed list
  const dayNum = getDayNumber(dateStr);
  const pickedIndex = dayNum % available.length;
  const picked = available[pickedIndex];

  return {
    country: picked,
    isAllCompleted: false,
    remainingCount: available.length,
    dayIndex: dayNum,
  };
}

export function getTimeUntilMidnight(): { hours: number; minutes: number; seconds: number; formatted: string } {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diffMs = midnight.getTime() - now.getTime();

  const totalSec = Math.max(0, Math.floor(diffMs / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const formatted = [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
  ].join(':');

  return { hours, minutes, seconds, formatted };
}

export function loadCompletedIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.COMPLETED);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCompletedId(id: string): string[] {
  const current = loadCompletedIds();
  if (!current.includes(id)) {
    current.push(id);
    localStorage.setItem(STORAGE_KEYS.COMPLETED, JSON.stringify(current));
  }
  return current;
}

export function resetGameStorage(): void {
  localStorage.removeItem(STORAGE_KEYS.COMPLETED);
  localStorage.removeItem(STORAGE_KEYS.DAILY_PLAYS);
}

export function loadDailyResults(): Record<string, DailyResult> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DAILY_PLAYS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveDailyResult(result: DailyResult): void {
  const all = loadDailyResults();
  all[result.date] = result;
  localStorage.setItem(STORAGE_KEYS.DAILY_PLAYS, JSON.stringify(all));
  updateStats(result);
}

export function loadStats(): PlayerStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STATS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    played: 0,
    completed: 0,
    totalScore: 0,
    bestScore: 0,
    streak: 0,
    lastPlayedDate: null,
  };
}

function updateStats(result: DailyResult): void {
  const stats = loadStats();
  const allSolved = Object.values(result.solved).every(Boolean);

  stats.played += 1;
  if (allSolved) stats.completed += 1;
  stats.totalScore += result.score;
  stats.bestScore = Math.max(stats.bestScore, result.score);

  const today = result.date;
  if (stats.lastPlayedDate) {
    const lastDayNum = getDayNumber(stats.lastPlayedDate);
    const todayNum = getDayNumber(today);
    if (todayNum === lastDayNum + 1) {
      stats.streak += 1;
    } else if (todayNum > lastDayNum + 1) {
      stats.streak = 1;
    }
  } else {
    stats.streak = 1;
  }
  stats.lastPlayedDate = today;

  localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
}

// Side Quests storage & helpers
export function loadQuestStats(): QuestStats {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.QUEST_STATS);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    questsFinished: 0,
    bestStreak: 0,
    bestBlitz: 0,
  };
}

export function recordQuestFinished(streak: number = 0, blitzScore: number = 0): QuestStats {
  const current = loadQuestStats();
  current.questsFinished += 1;
  if (streak > current.bestStreak) current.bestStreak = streak;
  if (blitzScore > current.bestBlitz) current.bestBlitz = blitzScore;
  try {
    localStorage.setItem(STORAGE_KEYS.QUEST_STATS, JSON.stringify(current));
  } catch {}
  return current;
}

// Shuffle array
export function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Side quest generators:
export function getIslandHopperCountries(count: number = 3): Country[] {
  const islands = COUNTRIES.filter((c) => ISLAND_COUNTRY_IDS.has(c.id));
  return shuffleArray(islands).slice(0, count);
}

export function getContinentExpeditionCountries(continent: string, count: number = 3): Country[] {
  const filtered = COUNTRIES.filter((c) => c.continent === continent);
  return shuffleArray(filtered).slice(0, count);
}

export function getMixedCountries(count: number = 20): Country[] {
  return shuffleArray(COUNTRIES).slice(0, count);
}
