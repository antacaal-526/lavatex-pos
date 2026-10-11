const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db;

if (process.env.TURSO_DATABASE_URL) {
    // Forzamos el uso del cliente remoto HTTP de Turso sin dependencias nativas de C++
    const { createClient } = require('@libsql/client');
    db = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
    });
    console.log('Conectado a Turso en la nube mediante protocolo remoto HTTP.');
} else {
    // Entorno local con SQLite tradicional
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