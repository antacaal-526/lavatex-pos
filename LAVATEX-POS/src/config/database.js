const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db;

if (process.env.TURSO_DATABASE_URL) {
    // Convertimos la URL libsql:// a https:// para usar la API HTTP nativa de Turso
    let tursoUrl = process.env.TURSO_DATABASE_URL.replace('libsql://', 'https://');
    if (!tursoUrl.endsWith('/')) tursoUrl += '/';
    const authToken = process.env.TURSO_AUTH_TOKEN;

    // Función auxiliar para ejecutar peticiones HTTP a Turso
    async function tursoQuery(sql, params = []) {
        const statements = [{ q: sql, params: params.map(p => (p === undefined ? null : p)) }];
        const response = await fetch(`${tursoUrl}v2/pipeline`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ requests: [{ type: 'execute', stmt: { sql, params: params } }] })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Error en Turso HTTP: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        const result = data.results[0];
        if (result.type === 'error') {
            throw new Error(`SQL Error: ${result.error.message}`);
        }

        const cols = result.response.result.cols.map(c => c.name);
        const rows = result.response.result.rows.map(row => {
            const obj = {};
            row.forEach((val, index) => {
                // Manejo de tipos de datos devueltos por Turso
                let v = val.value !== undefined ? val.value : val;
                if (val.type === 'integer') v = Number(v);
                obj[cols[index]] = v;
            });
            return obj;
        });

        return {
            rows,
            rowsAffected: result.response.result.affected_row_count || 0,
            lastInsertRowid: result.response.result.last_insert_rowid ? Number(result.response.result.last_insert_rowid) : 0
        };
    }

    // Adaptador de compatibilidad idéntico a sqlite3 usando HTTP puro
    db = {
        run: function(sql, params = [], callback) {
            if (typeof params === 'function') {
                callback = params;
                params = [];
            }
            tursoQuery(sql, params)
                .then(res => {
                    if (callback) callback.call({ lastID: res.lastInsertRowid, changes: res.rowsAffected }, null);
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
            tursoQuery(sql, params)
                .then(res => {
                    const row = res.rows.length > 0 ? res.rows[0] : undefined;
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
            tursoQuery(sql, params)
                .then(res => {
                    if (callback) callback(null, res.rows);
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
                    tursoQuery(sql, params)
                        .then(res => callback && callback.call({ lastID: res.lastInsertRowid }, null))
                        .catch(err => callback && callback(err));
                },
                finalize: () => {}
            };
        }
    };
    console.log('Adaptador Turso HTTP Puro inicializado correctamente.');
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