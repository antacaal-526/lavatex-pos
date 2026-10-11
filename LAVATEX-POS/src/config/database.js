const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db;

// Verificamos si estamos usando Turso en la nube o SQLite local
if (process.env.TURSO_DATABASE_URL) {
    // Configuración optimizada para Turso en la nube vía HTTP (evita errores nativos)
    const { createClient } = require('@libsql/client');
    db = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
    });
    console.log('Conectado exitosamente a Turso en la nube (Modo HTTP).');
} else {
    // Configuración local (SQLite tradicional)
    const dbPath = path.resolve(__dirname, '../../lavatex_pos.db');
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error al conectar con SQLite local:', err.message);
        } else {
            console.log('Base de datos SQLite local conectada en:', dbPath);
        }
    });
}

module.exports = db;