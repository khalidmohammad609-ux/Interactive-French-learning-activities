/** A row of the `activities` table: an uploaded activity, or teacher changes to a GitHub one. */
export type ActivityRow = {
  id: string;
  title: string | null;
  emoji: string | null;
  topic: string | null;
  for: string | null;
  source: 'github' | 'upload';
  file_path: string | null;
  hidden: boolean | null; // null = not changed by the teacher
  removed: boolean;
  ask_email: boolean | null; // null = not changed by the teacher
  video: string | null;
  short: string | null;
  updated: string; // ISO date
  created: string;
};

/** One entry of activities/activities.json in the repo. */
export type GithubActivity = {
  id: string; title: string; emoji?: string; topic?: string; for?: string;
  file: string; updated?: string; hidden?: boolean; askEmail?: boolean; video?: string; short?: string;
};

/** An activity after merging the GitHub list with the database rows. */
export type Activity = {
  id: string; title: string; emoji: string; topic: string; for: string;
  source: 'github' | 'upload';
  file?: string;       // GitHub file name
  filePath?: string;   // Storage path (uploads)
  hidden: boolean; removed: boolean; askEmail: boolean;
  updated: string; video: string; short: string;
};

export type ResultRow = {
  id?: number;
  created: string;
  name: string; email: string; activity_id: string; activity_title: string; level: string;
  score: number | null; total: number | null; pct: number | null;
  first: number | null; second: number | null; review: number | null;
  errors: string; device: string;
  ip_hash?: string | null;
};

export interface Store {
  listActivityRows(): Promise<ActivityRow[]>;
  /** Inserts a new row; returns false if the id is taken. */
  insertActivityRow(row: ActivityRow): Promise<boolean>;
  updateActivityRow(id: string, patch: Partial<ActivityRow>): Promise<void>;
  insertResult(r: ResultRow): Promise<void>;
  listResults(): Promise<ResultRow[]>;
  countResultsSince(ipHash: string, sinceIso: string): Promise<number>;
  putFile(path: string, html: string): Promise<void>;
  getFile(path: string): Promise<string>;
  ping(): Promise<void>;
}
