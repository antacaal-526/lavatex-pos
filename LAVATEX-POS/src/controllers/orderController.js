const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db;

if (process.env.TURSO_DATABASE_URL) {
    let tursoUrl = process.env.TURSO_DATABASE_URL.replace('libsql://', 'https://');
    if (!tursoUrl.endsWith('/')) tursoUrl += '/';
    const authToken = process.env.TURSO_AUTH_TOKEN;

    // Función robusta con tipado estricto para Turso HTTP
    async function tursoQuery(sql, params = []) {
        // Mapeo estricto de tipos requerido por la API HTTP de Turso v2
        const formattedParams = params.map(p => {
            if (p === null || p === undefined) {
                return { type: 'null' };
            } else if (typeof p === 'number') {
                return { type: Number.isInteger(p) ? 'integer' : 'float', value: p.toString() };
            } else if (typeof p === 'boolean') {
                return { type: 'integer', value: p ? '1' : '0' };
            } else {
                return { type: 'text', value: p.toString() };
            }
        });

        const response = await fetch(`${tursoUrl}v2/pipeline`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                requests: [{ 
                    type: 'execute', 
                    stmt: { sql, args: formattedParams } 
                }] 
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Error en Turso HTTP: ${response.status}\n${errText}`);
        }

        const data = await response.json();
        const result = data.results[0];
        if (result.type === 'error') {
            throw new Error(`SQL Error: ${result.error.message}`);
        }

        const cols = result.response.result.cols ? result.response.result.cols.map(c => c.name) : [];
        const rows = result.response.result.rows ? result.response.result.rows.map(row => {
            const obj = {};
            row.forEach((val, index) => {
                let v = val.value !== undefined ? val.value : val;
                if (val.type === 'integer') v = Number(v);
                obj[cols[index]] = v;
            });
            return obj;
        }) : [];

        return {
            rows,
            rowsAffected: result.response.result.affected_row_count || 0,
            lastInsertRowid: result.response.result.last_insert_rowid ? Number(result.response.result.last_insert_rowid) : 0
        };
    }

    // Inicializar tablas automáticamente en la nube con soporte para 'codigo'
    async function inicializarTablasTurso() {
        try {
            await tursoQuery(`CREATE TABLE IF NOT EXISTS clientes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre_completo TEXT NOT NULL,
                tipo_identificacion TEXT,
                numero_identificacion TEXT UNIQUE,
                telefono TEXT NOT NULL,
                correo TEXT,
                direccion TEXT,
                barrio TEXT,
                observaciones TEXT,
                preferencias TEXT,
                fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            await tursoQuery(`CREATE TABLE IF NOT EXISTS servicios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                codigo TEXT,
                nombre TEXT NOT NULL,
                descripcion TEXT,
                unidad_cobro TEXT NOT NULL,
                precio REAL NOT NULL,
                tiempo_estimado_horas INTEGER DEFAULT 24,
                activo INTEGER DEFAULT 1
            )`);

            // Asegurar columna codigo si la tabla ya existía
            try {
                await tursoQuery(`ALTER TABLE servicios ADD COLUMN codigo TEXT`);
            } catch (e) {
                // La columna ya existe, se puede ignorar
            }

            await tursoQuery(`CREATE TABLE IF NOT EXISTS ordenes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                codigo_orden TEXT UNIQUE NOT NULL,
                cliente_id INTEGER,
                subtotal REAL NOT NULL,
                descuento REAL DEFAULT 0,
                total REAL NOT NULL,
                abono REAL DEFAULT 0,
                saldo REAL NOT NULL,
                estado TEXT DEFAULT 'Recibido',
                ubicacion_fisica TEXT DEFAULT 'Estantería Principal',
                fecha_recepcion DATETIME DEFAULT CURRENT_TIMESTAMP,
                fecha_entrega_estimada DATETIME,
                observaciones TEXT,
                FOREIGN KEY (cliente_id) REFERENCES clientes(id)
            )`);

            await tursoQuery(`CREATE TABLE IF NOT EXISTS detalle_orden (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                orden_id INTEGER,
                servicio_id INTEGER,
                cantidad REAL NOT NULL,
                precio_unitario REAL NOT NULL,
                subtotal_item REAL NOT NULL,
                observacion_prenda TEXT,
                FOREIGN KEY (orden_id) REFERENCES ordenes(id),
                FOREIGN KEY (servicio_id) REFERENCES servicios(id)
            )`);

            await tursoQuery(`CREATE TABLE IF NOT EXISTS historial_estados (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                orden_id INTEGER,
                estado_anterior TEXT,
                estado_nuevo TEXT NOT NULL,
                observacion TEXT,
                fecha_cambio DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (orden_id) REFERENCES ordenes(id)
            )`);

            await tursoQuery(`CREATE TABLE IF NOT EXISTS turnos_caja (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                monto_apertura REAL NOT NULL,
                monto_cierre_efectivo REAL,
                diferencia REAL,
                estado TEXT DEFAULT 'ABIERTA',
                fecha_apertura DATETIME DEFAULT CURRENT_TIMESTAMP,
                fecha_cierre DATETIME,
                observaciones TEXT
            )`);

            await tursoQuery(`CREATE TABLE IF NOT EXISTS movimientos_caja (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                turno_id INTEGER,
                orden_id INTEGER,
                tipo TEXT NOT NULL,
                monto REAL NOT NULL,
                metodo_pago TEXT DEFAULT 'Efectivo',
                concepto TEXT,
                fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (turno_id) REFERENCES turnos_caja(id),
                FOREIGN KEY (orden_id) REFERENCES ordenes(id)
            )`);

            await tursoQuery(`CREATE TABLE IF NOT EXISTS insumos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                unidad_medida TEXT NOT NULL,
                stock_actual REAL DEFAULT 0,
                stock_minimo REAL DEFAULT 5,
                costo_unitario REAL DEFAULT 0
            )`);

            await tursoQuery(`CREATE TABLE IF NOT EXISTS movimientos_inventario (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                insumo_id INTEGER,
                tipo TEXT NOT NULL,
                cantidad REAL NOT NULL,
                motivo TEXT,
                fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (insumo_id) REFERENCES insumos(id)
            )`);

            console.log('¡Tablas verificadas en Turso con tipado estricto, clave args y columna codigo!');
        } catch (e) {
            console.error('Error al inicializar tablas en Turso:', e.message);
        }
    }

    inicializarTablasTurso();

    // Adaptador de compatibilidad
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
    console.log('Adaptador Turso HTTP con clave args activo.');
} else {
    const dbPath = path.resolve(__dirname, '../../lavatex_pos.db');
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error al conectar con SQLite local:', err.message);
        } else {
            console.log('Base de datos SQLite local conectada en:', dbPath);
            // Inicializar tabla local con columna codigo si no existe
            db.run(`CREATE TABLE IF NOT EXISTS servicios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                codigo TEXT,
                nombre TEXT NOT NULL,
                descripcion TEXT,
                unidad_cobro TEXT NOT NULL,
                precio REAL NOT NULL,
                tiempo_estimado_horas INTEGER DEFAULT 24,
                activo INTEGER DEFAULT 1
            )`, () => {
                db.run(`ALTER TABLE servicios ADD COLUMN codigo TEXT`, () => {});
            });
        }
    });
}

module.exports = db;