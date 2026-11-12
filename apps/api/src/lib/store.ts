// Local/demo store: in-memory maps + JSON file fallback under apps/api/data/.
// Used when SUPABASE_URL / keys are not configured. No database connection
// is required at runtime. The data/ directory is gitignored.
// NOTE: demo only — passwords are SHA-256 hashes, not bcrypt; do not use
// this auth in production without a real user table + password hashing.

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { PlanId } from './plans';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  plan: PlanId;
  periodMonths: number | null;
  createdAt: string;
}

export interface HistoryEntry {
  id: string;
  userId: string;
  assetName: string;
  tool: string;
  marketplace?: string;
  resultSummary?: string;
  createdAt: string;
}

export interface Job {
  id: string;
  userId: string;
  tool: string;
  status: 'queued' | 'done' | 'failed';
  createdAt: string;
}

interface StoreData {
  users: User[];
  history: HistoryEntry[];
  jobs: Job[];
}

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

let data: StoreData = { users: [], history: [], jobs: [] };

function load(): void {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) as StoreData;
      data = {
        users: Array.isArray(raw.users) ? raw.users : [],
        history: Array.isArray(raw.history) ? raw.history : [],
        jobs: Array.isArray(raw.jobs) ? raw.jobs : [],
      };
    }
  } catch (err) {
    console.warn('[store] could not load data/store.json, starting empty:', (err as Error).message);
    data = { users: [], history: [], jobs: [] };
  }
}

function persist(): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn('[store] could not persist data/store.json:', (err as Error).message);
  }
}

load();

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`;
}

export function createUser(email: string, password: string): User {
  const user: User = {
    id: newId('u'),
    email: email.toLowerCase(),
    passwordHash: hashPassword(password),
    plan: 'free',
    periodMonths: null,
    createdAt: new Date().toISOString(),
  };
  data.users.push(user);
  persist();
  return user;
}

export function findUserByEmail(email: string): User | undefined {
  return data.users.find((u) => u.email === email.toLowerCase());
}

export function findUserById(id: string): User | undefined {
  return data.users.find((u) => u.id === id);
}

export function verifyPassword(user: User, password: string): boolean {
  return user.passwordHash === hashPassword(password);
}

export function setUserPlan(userId: string, plan: PlanId, periodMonths?: number | null): User | undefined {
  const user = findUserById(userId);
  if (!user) return undefined;
  user.plan = plan;
  if (periodMonths !== undefined) user.periodMonths = periodMonths;
  persist();
  return user;
}

export function publicUser(user: User): { id: string; email: string; plan: PlanId; periodMonths: number | null } {
  return { id: user.id, email: user.email, plan: user.plan, periodMonths: user.periodMonths };
}

export function addHistory(entry: Omit<HistoryEntry, 'id' | 'createdAt'>): HistoryEntry {
  const item: HistoryEntry = { ...entry, id: newId('h'), createdAt: new Date().toISOString() };
  data.history.unshift(item);
  persist();
  return item;
}

export function listHistory(userId: string): HistoryEntry[] {
  return data.history.filter((h) => h.userId === userId);
}

export function deleteHistory(userId: string, id: string): boolean {
  const idx = data.history.findIndex((h) => h.userId === userId && h.id === id);
  if (idx === -1) return false;
  data.history.splice(idx, 1);
  persist();
  return true;
}

export function addJob(userId: string, tool: string, status: Job['status'] = 'done'): Job {
  const job: Job = { id: newId('j'), userId, tool, status, createdAt: new Date().toISOString() };
  data.jobs.push(job);
  persist();
  return job;
}

/** Count of a user's jobs for a tool in the current calendar month (UTC). */
export function countJobsThisMonth(userId: string, tool: string): number {
  const now = new Date();
  const prefix = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return data.jobs.filter(
    (j) => j.userId === userId && j.tool === tool && j.createdAt.startsWith(prefix),
  ).length;
}
