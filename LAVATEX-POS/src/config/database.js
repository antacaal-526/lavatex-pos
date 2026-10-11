const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db;

if (process.env.TURSO_DATABASE_URL) {
    const { createClient } = require('@libsql/client');
    const client = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
    });

    // Inicializamos las tablas automáticamente usando el cliente oficial
    async function inicializarTablasTursoOficial() {
        try {
            await client.execute(`CREATE TABLE IF NOT EXISTS clientes (
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

            await client.execute(`CREATE TABLE IF NOT EXISTS servicios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                descripcion TEXT,
                unidad_cobro TEXT NOT NULL,
                precio REAL NOT NULL,
                tiempo_estimado_horas INTEGER DEFAULT 24,
                activo INTEGER DEFAULT 1
            )`);

            await client.execute(`CREATE TABLE IF NOT EXISTS ordenes (
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

            await client.execute(`CREATE TABLE IF NOT EXISTS detalle_orden (
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

            await client.execute(`CREATE TABLE IF NOT EXISTS historial_estados (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                orden_id INTEGER,
                estado_anterior TEXT,
                estado_nuevo TEXT NOT NULL,
                observacion TEXT,
                fecha_cambio DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (orden_id) REFERENCES ordenes(id)
            )`);

            await client.execute(`CREATE TABLE IF NOT EXISTS turnos_caja (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                monto_apertura REAL NOT NULL,
                monto_cierre_efectivo REAL,
                diferencia REAL,
                estado TEXT DEFAULT 'ABIERTA',
                fecha_apertura DATETIME DEFAULT CURRENT_TIMESTAMP,
                fecha_cierre DATETIME,
                observaciones TEXT
            )`);

            await client.execute(`CREATE TABLE IF NOT EXISTS movimientos_caja (
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

            await client.execute(`CREATE TABLE IF NOT EXISTS insumos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL,
                unidad_medida TEXT NOT NULL,
                stock_actual REAL DEFAULT 0,
                stock_minimo REAL DEFAULT 5,
                costo_unitario REAL DEFAULT 0
            )`);

            await client.execute(`CREATE TABLE IF NOT EXISTS movimientos_inventario (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                insumo_id INTEGER,
                tipo TEXT NOT NULL,
                cantidad REAL NOT NULL,
                motivo TEXT,
                fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (insumo_id) REFERENCES insumos(id)
            )`);

            console.log('¡Tablas de Turso inicializadas perfectamente con el SDK oficial!');
        } catch (e) {
            console.error('Error al inicializar tablas en Turso:', e.message);
        }
    }

    inicializarTablasTursoOficial();

    // Adaptador de compatibilidad robusto utilizando el SDK oficial de Turso
    db = {
        run: function(sql, params = [], callback) {
            if (typeof params === 'function') {
                callback = params;
                params = [];
            }
            // Asegurar que los parámetros sean un arreglo plano limpio
            const args = Array.isArray(params) ? params : [params];
            client.execute({ sql, args })
                .then(result => {
                    if (callback) callback.call({ lastID: Number(result.lastInsertRowid || 0), changes: result.rowsAffected || 0 }, null);
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
            const args = Array.isArray(params) ? params : [params];
            client.execute({ sql, args })
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
            const args = Array.isArray(params) ? params : [params];
            client.execute({ sql, args })
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
                        .then(res => callback && callback.call({ lastID: Number(res.lastInsertRowid || 0) }, null))
                        .catch(err => callback && callback(err));
                },
                finalize: () => {}
            };
        }
    };
    console.log('Adaptador oficial Turso SDK inicializado correctamente.');
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