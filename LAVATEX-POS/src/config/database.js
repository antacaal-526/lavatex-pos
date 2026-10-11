const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db;

if (process.env.TURSO_DATABASE_URL) {
    const { createClient } = require('@libsql/client');
    const client = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
    });
    
    // Adaptador de compatibilidad para que Turso imite exactamente la API de sqlite3
    db = {
        run: function(sql, params = [], callback) {
            if (typeof params === 'function') {
                callback = params;
                params = [];
            }
            client.execute({ sql, args: params })
                .then(result => {
                    if (callback) callback.call({ lastID: Number(result.lastInsertRowid), changes: result.rowsAffected }, null);
                })
                .catch(err => {
                    if (callback) callback(err);
                });
        },
        get: function(sql, params = [], callback) {
            if (typeof params === 'function') {
                callback = params;
                params = [];
            }
            client.execute({ sql, args: params })
                .then(result => {
                    const row = result.rows.length > 0 ? { ...result.rows[0] } : undefined;
                    if (callback) callback(null, row);
                })
                .catch(err => {
                    if (callback) callback(err);
                });
        },
        all: function(sql, params = [], callback) {
            if (typeof params === 'function') {
                callback = params;
                params = [];
            }
            client.execute({ sql, args: params })
                .then(result => {
                    const rows = result.rows.map(row => ({ ...row }));
                    if (callback) callback(null, rows);
                })
                .catch(err => {
                    if (callback) callback(err);
                });
        },
        serialize: function(cb) {
            if (cb) cb();
        },
        prepare: function(sql) {
            return {
                run: (...args) => {
                    const callback = typeof args[args.length - 1] === 'function' ? args.pop() : null;
                    const params = args;
                    client.execute({ sql, args: params })
                        .then(res => callback && callback.call({ lastID: Number(res.lastInsertRowid) }, null))
                        .catch(err => callback && callback(err));
                },
                finalize: () => {}
            };
        }
    };
    console.log('Adaptador Turso HTTP inicializado con éxito para la nube.');
} else {
    // Entorno local SQLite tradicional
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