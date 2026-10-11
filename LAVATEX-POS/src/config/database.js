const sqlite3 = require('sqlite3').verbose();
const path = require('path');

let db;

// Verificamos si estamos usando Turso en la nube o SQLite local
if (process.env.TURSO_DATABASE_URL) {
    // Configuración para la nube (Turso / LibSQL)
    const { createClient } = require('@libsql/client');
    const client = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
    });
    
    console.log('Conectado a la base de datos en la nube (Turso).');
    db = client;
} else {
    // Configuración local (SQLite tradicional)
    const dbPath = path.resolve(__dirname, '../../lavatex_pos.db');
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
            console.error('Error al conectar con SQLite local:', err.message);
        } else {
            console.log('Base de datos SQLite local conectada en:', dbPath);
            inicializarTablasLocal(db);
        }
    });
}

function inicializarTablasLocal(database) {
    database.serialize(() => {
        database.run(`CREATE TABLE IF NOT EXISTS clientes (
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

        database.run(`CREATE TABLE IF NOT EXISTS servicios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            descripcion TEXT,
            unidad_cobro TEXT NOT NULL,
            precio REAL NOT NULL,
            tiempo_estimado_horas INTEGER DEFAULT 24,
            activo INTEGER DEFAULT 1
        )`, () => {
            database.get(`SELECT COUNT(*) as count FROM servicios`, (err, row) => {
                if (row && row.count === 0) {
                    const serviciosDefault = [
                        ['Lavado y Planchado por Kilo', 'Lavado general por kilogramo', 'peso', 5000, 24, 1],
                        ['Camisa / Blusa (Unidad)', 'Lavado y planchado individual', 'unidad', 3500, 24, 1],
                        ['Pantalón / Jeans (Unidad)', 'Lavado y planchado individual', 'unidad', 4000, 24, 1],
                        ['Chaqueta / Abrigo', 'Prenda delicada o pesada', 'unidad', 8000, 48, 1],
                        ['Edredón / Cobija', 'Lavado especial de ropa de cama', 'unidad', 15000, 48, 1]
                    ];
                    const stmt = database.prepare(`INSERT INTO servicios (nombre, descripcion, unidad_cobro, precio, tiempo_estimado_horas, activo) VALUES (?, ?, ?, ?, ?, ?)`);
                    serviciosDefault.forEach(s => stmt.run(s));
                    stmt.finalize();
                }
            });
        });

        database.run(`CREATE TABLE IF NOT EXISTS ordenes (
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

        database.run(`CREATE TABLE IF NOT EXISTS detalle_orden (
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

        database.run(`CREATE TABLE IF NOT EXISTS historial_estados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            orden_id INTEGER,
            estado_anterior TEXT,
            estado_nuevo TEXT NOT NULL,
            observacion TEXT,
            fecha_cambio DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (orden_id) REFERENCES ordenes(id)
        )`);

        database.run(`CREATE TABLE IF NOT EXISTS turnos_caja (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            monto_apertura REAL NOT NULL,
            monto_cierre_efectivo REAL,
            diferencia REAL,
            estado TEXT DEFAULT 'ABIERTA',
            fecha_apertura DATETIME DEFAULT CURRENT_TIMESTAMP,
            fecha_cierre DATETIME,
            observaciones TEXT
        )`);

        database.run(`CREATE TABLE IF NOT EXISTS movimientos_caja (
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

        database.run(`CREATE TABLE IF NOT EXISTS insumos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            unidad_medida TEXT NOT NULL,
            stock_actual REAL DEFAULT 0,
            stock_minimo REAL DEFAULT 5,
            costo_unitario REAL DEFAULT 0
        )`);

        database.run(`CREATE TABLE IF NOT EXISTS movimientos_inventario (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            insumo_id INTEGER,
            tipo TEXT NOT NULL,
            cantidad REAL NOT NULL,
            motivo TEXT,
            fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (insumo_id) REFERENCES insumos(id)
        )`);
    });
}

module.exports = db;