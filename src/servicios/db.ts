import * as SQLite from 'expo-sqlite';

let conexion: SQLite.SQLiteDatabase | null = null;

export function obtenerDb(): SQLite.SQLiteDatabase {
  if (conexion) return conexion;
  const db = SQLite.openDatabaseSync('miciudad-integrada.db');
  db.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS visitas (
      id TEXT PRIMARY KEY NOT NULL,
      usuarioId TEXT NOT NULL,
      lugarId TEXT NOT NULL,
      fechaHora TEXT NOT NULL,
      origen TEXT NOT NULL,
      fotoUri TEXT,
      fotoRemota TEXT,
      nota TEXT,
      sincronizada INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS visitas_por_usuario
      ON visitas(usuarioId, fechaHora);
  `);
  conexion = db;
  return db;
}
