import { SafeSQLite } from './SafeSQLite';

// Type definitions for SQLite
declare namespace SQLite {
  interface SQLiteDatabase {
     
    executeSql: (sql: string, params?: unknown[]) => Promise<any[]>;
     
    transaction: (fn: (tx: SQLite.SQLiteDatabase) => void) => Promise<void>;
    close: () => Promise<void>;
  }
}

let db: SQLite.SQLiteDatabase | null = null;

export async function openDB(){
  if (db) {return db;}
  db = await SafeSQLite.openDatabase({ name: 'afetnet.db', location: 'default' });
  await db.executeSql(`
    PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS loc_points(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ts INTEGER NOT NULL,
      lat REAL NOT NULL, lon REAL NOT NULL, acc REAL,
      enu_x REAL, enu_y REAL
    );
    CREATE INDEX IF NOT EXISTS ix_loc_ts ON loc_points(ts);
    CREATE INDEX IF NOT EXISTS ix_loc_ll ON loc_points(lat,lon);

    CREATE TABLE IF NOT EXISTS pins(
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,           -- 'task' | 'cap'
      title TEXT NOT NULL,
      lat REAL NOT NULL, lon REAL NOT NULL,
      status TEXT,                  -- task.status veya cap.severity
      ref TEXT,                     -- taskId/capId
      ts INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_pins_kind ON pins(kind);

    CREATE TABLE IF NOT EXISTS meta(
      k TEXT PRIMARY KEY,
      v TEXT
    );
  `);
  return db!;
}

 
export async function tx<T>(fn:(db:SQLite.SQLiteDatabase)=>Promise<T>):Promise<T>{
  const d = await openDB();
  return fn(d);
}

export async function prune(){
  const d = await openDB();
  // 48 saatten eskiyi veya 10k sınırını aşanları sil
  const twoDaysAgo = Date.now() - 48*3600*1000;
  await d.executeSql('DELETE FROM loc_points WHERE ts < ?', [twoDaysAgo]);
  const cnt = await d.executeSql('SELECT COUNT(1) c FROM loc_points');
  const n = cnt[0].rows.item(0).c as number;
  if (n > 10000){
    const delta = n - 10000;
    await d.executeSql('DELETE FROM loc_points WHERE id IN (SELECT id FROM loc_points ORDER BY ts ASC LIMIT ?)', [delta]);
  }
}

export async function healthy(){
  try{ await openDB(); return true; }catch{ return false; }
}
