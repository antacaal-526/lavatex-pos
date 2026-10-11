const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Configuración estática apuntando correctamente a la carpeta public en la raíz
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// Ruta raíz explícita
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// Base de datos SQLite
const dbPath = path.resolve(__dirname, '../lavatex_pos.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error al conectar con la base de datos SQLite:', err.message);
    } else {
        console.log('Conectado a la base de datos SQLite de Lavatex.');
        inicializarBaseDatos();
    }
});

// Inicializar Tablas y Servicios por Defecto
function inicializarBaseDatos() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS clientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre_completo TEXT NOT NULL,
            telefono TEXT NOT NULL,
            numero_identificacion TEXT,
            direccion TEXT,
            correo TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS servicios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo TEXT,
            nombre TEXT NOT NULL,
            descripcion TEXT,
            unidad_cobro TEXT DEFAULT 'unidad',
            precio REAL NOT NULL,
            tiempo_estimado_horas INTEGER DEFAULT 24,
            activo INTEGER DEFAULT 1
        )`, () => {
            db.get(`SELECT COUNT(*) as count FROM servicios`, [], (err, row) => {
                if (row && row.count === 0) {
                    const serviciosIniciales = [
                        ['CUB', 'CUBRELECHO', 'Lavado y desinfección de cubrecama', 'unidad', 20000, 24],
                        ['PH', 'PANTALON HOMBRE', 'Lavado y planchado', 'unidad', 8000, 24],
                        ['CH', 'CAMISA HOMBRE', 'Lavado y planchado', 'unidad', 7000, 24],
                        ['JNB', 'JEAN / PANTALON', 'Lavado en seco / agua', 'unidad', 9000, 24],
                        ['COB', 'COBIJA / FRAZADA', 'Lavado profundo', 'unidad', 15000, 24]
                    ];
                    const stmt = db.prepare(`INSERT INTO servicios (codigo, nombre, descripcion, unidad_cobro, precio, tiempo_estimado_horas, activo) VALUES (?, ?, ?, ?, ?, ?, 1)`);
                    serviciosIniciales.forEach(s => stmt.run(s));
                    stmt.finalize();
                }
            });
        });

        db.run(`CREATE TABLE IF NOT EXISTS ordenes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo_orden TEXT UNIQUE NOT NULL,
            cliente_id INTEGER,
            total REAL NOT NULL,
            abono REAL DEFAULT 0,
            saldo REAL NOT NULL,
            fecha_recepcion DATETIME DEFAULT CURRENT_TIMESTAMP,
            fecha_entrega_estimada DATETIME,
            estado TEXT DEFAULT 'Recibido',
            ubicacion_fisica TEXT DEFAULT 'Estantería Principal',
            observaciones TEXT,
            FOREIGN KEY(cliente_id) REFERENCES clientes(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS orden_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            orden_id INTEGER,
            servicio_id INTEGER,
            cantidad REAL NOT NULL,
            precio_unitario REAL NOT NULL,
            subtotal_item REAL NOT NULL,
            observacion_prenda TEXT,
            FOREIGN KEY(orden_id) REFERENCES ordenes(id),
            FOREIGN KEY(servicio_id) REFERENCES servicios(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS caja_turnos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            monto_apertura REAL NOT NULL,
            fecha_apertura DATETIME DEFAULT CURRENT_TIMESTAMP,
            monto_cierre REAL,
            efectivo_contado REAL,
            diferencia REAL,
            fecha_cierre DATETIME,
            estado TEXT DEFAULT 'ABIERTA'
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS caja_movimientos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            turno_id INTEGER,
            tipo TEXT,
            monto REAL NOT NULL,
            concepto TEXT,
            fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(turno_id) REFERENCES caja_turnos(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS insumos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            unidad_medida TEXT NOT NULL,
            stock_actual REAL DEFAULT 0,
            stock_minimo REAL DEFAULT 5
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS insumo_movimientos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            insumo_id INTEGER,
            tipo TEXT,
            cantidad REAL NOT NULL,
            motivo TEXT,
            fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(insumo_id) REFERENCES insumos(id)
        )`);
    });
}

// API Clientes
app.get('/api/clientes', (req, res) => {
    db.all(`SELECT * FROM clientes ORDER BY id DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.json({ status: 'success', data: rows });
    });
});

app.post('/api/clientes', (req, res) => {
    const { nombre_completo, telefono, numero_identificacion, direccion, correo } = req.body;
    if (!nombre_completo || !telefono) {
        return res.status(400).json({ status: 'error', message: 'Nombre y teléfono son obligatorios.' });
    }
    const query = `INSERT INTO clientes (nombre_completo, telefono, numero_identificacion, direccion, correo) VALUES (?, ?, ?, ?, ?)`;
    db.run(query, [nombre_completo, telefono, numero_identificacion, direccion, correo], function(err) {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.json({ status: 'success', message: 'Cliente registrado con éxito', id: this.lastID });
    });
});

app.delete('/api/clientes/:id', (req, res) => {
    const { id } = req.params;
    db.run(`DELETE FROM clientes WHERE id = ?`, [id], function(err) {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.json({ status: 'success', message: 'Cliente eliminado correctamente' });
    });
});

// API Servicios
app.get('/api/ordenes/servicios', (req, res) => {
    const admin = req.query.admin;
    let query = `SELECT * FROM servicios`;
    if (!admin) query += ` WHERE activo = 1`;
    query += ` ORDER BY nombre ASC`;

    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.json({ status: 'success', data: rows });
    });
});

app.post('/api/ordenes/servicios', (req, res) => {
    const { codigo, nombre, descripcion, unidad_cobro, precio, tiempo_estimado_horas } = req.body;
    const query = `INSERT INTO servicios (codigo, nombre, descripcion, unidad_cobro, precio, tiempo_estimado_horas, activo) VALUES (?, ?, ?, ?, ?, ?, 1)`;
    db.run(query, [codigo, nombre, descripcion, unidad_cobro, precio, tiempo_estimado_horas || 24], function(err) {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.json({ status: 'success', message: 'Servicio registrado con éxito', id: this.lastID });
    });
});

app.put('/api/ordenes/servicios/:id', (req, res) => {
    const { id } = req.params;
    const { codigo, nombre, descripcion, unidad_cobro, precio, tiempo_estimado_horas, activo } = req.body;
    const query = `UPDATE servicios SET codigo = ?, nombre = ?, descripcion = ?, unidad_cobro = ?, precio = ?, tiempo_estimado_horas = ?, activo = ? WHERE id = ?`;
    db.run(query, [codigo, nombre, descripcion, unidad_cobro, precio, tiempo_estimado_horas, activo, id], function(err) {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.json({ status: 'success', message: 'Servicio actualizado correctamente' });
    });
});

app.delete('/api/ordenes/servicios/:id', (req, res) => {
    const { id } = req.params;
    db.run(`UPDATE servicios SET activo = 0 WHERE id = ?`, [id], function(err) {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.json({ status: 'success', message: 'Servicio desactivado para proteger el historial histórico.' });
    });
});

// API Órdenes
app.get('/api/ordenes', (req, res) => {
    const query = `
        SELECT o.*, c.nombre_completo as cliente_nombre, c.telefono as cliente_telefono 
        FROM ordenes o 
        LEFT JOIN clientes c ON o.cliente_id = c.id 
        ORDER BY o.id DESC
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.json({ status: 'success', data: rows });
    });
});

app.post('/api/ordenes', (req, res) => {
    const { cliente_id, items, abono, fecha_entrega_estimada, observaciones } = req.body;
    if (!items || items.length === 0) {
        return res.status(400).json({ status: 'error', message: 'La orden debe contener al menos un servicio.' });
    }

    let total = items.reduce((acc, item) => acc + (parseFloat(item.subtotal_item) || 0), 0);
    let abonoNum = parseFloat(abono) || 0;
    let saldo = Math.max(0, total - abonoNum);
    let codigoOrden = `ORD-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const queryOrden = `INSERT INTO ordenes (codigo_orden, cliente_id, total, abono, saldo, fecha_entrega_estimada, estado, ubicacion_fisica, observaciones) VALUES (?, ?, ?, ?, ?, ?, 'Recibido', 'Estantería Principal', ?)`;
        
        db.run(queryOrden, [codigoOrden, cliente_id || null, total, abonoNum, saldo, fecha_entrega_estimada, observaciones], function(err) {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ status: 'error', message: err.message });
            }

            const ordenId = this.lastID;
            const queryItem = `INSERT INTO orden_items (orden_id, servicio_id, cantidad, precio_unitario, subtotal_item, observacion_prenda) VALUES (?, ?, ?, ?, ?, ?)`;
            
            let stmt = db.prepare(queryItem);
            items.forEach(item => {
                stmt.run([ordenId, item.servicio_id, item.cantidad, item.precio_unitario, item.subtotal_item, item.observacion_prenda || '']);
            });
            stmt.finalize();

            if (abonoNum > 0) {
                db.get(`SELECT id FROM caja_turnos WHERE estado = 'ABIERTA' ORDER BY id DESC LIMIT 1`, [], (err, turno) => {
                    if (turno) {
                        db.run(`INSERT INTO caja_movimientos (turno_id, tipo, monto, concepto) VALUES (?, 'ABONO', ?, ?)`, 
                            [turno.id, abonoNum, `Abono inicial orden ${codigoOrden}`]);
                    }
                });
            }

            db.run('COMMIT', (err) => {
                if (err) return res.status(500).json({ status: 'error', message: err.message });
                res.json({ status: 'success', message: 'Orden creada con éxito', ordenId, codigo_orden: codigoOrden });
            });
        });
    });
});

app.put('/api/ordenes/:id/estado', (req, res) => {
    const { id } = req.params;
    const { estado, ubicacion_fisica, abonar_adicional } = req.body;

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.get(`SELECT * FROM ordenes WHERE id = ?`, [id], (err, orden) => {
            if (err || !orden) {
                db.run('ROLLBACK');
                return res.status(404).json({ status: 'error', message: 'Orden no encontrada' });
            }

            let nuevoAbono = orden.abono + (parseFloat(abonar_adicional) || 0);
            let nuevoSaldo = Math.max(0, orden.total - nuevoAbono);

            db.run(`UPDATE ordenes SET estado = ?, ubicacion_fisica = ?, abono = ?, saldo = ? WHERE id = ?`,
                [estado, ubicacion_fisica, nuevoAbono, nuevoSaldo, id], function(err) {
                    if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ status: 'error', message: err.message });
                    }

                    if (abonar_adicional > 0) {
                        db.get(`SELECT id FROM caja_turnos WHERE estado = 'ABIERTA' ORDER BY id DESC LIMIT 1`, [], (err, turno) => {
                            if (turno) {
                                db.run(`INSERT INTO caja_movimientos (turno_id, tipo, monto, concepto) VALUES (?, 'ABONO', ?, ?)`, 
                                    [turno.id, abonar_adicional, `Pago saldo orden ${orden.codigo_orden}`]);
                            }
                        });
                    }

                    db.run('COMMIT', (err) => {
                        if (err) return res.status(500).json({ status: 'error', message: err.message });
                        res.json({ status: 'success', message: 'Estado de orden actualizado correctamente' });
                    });
                });
        });
    });
});

app.delete('/api/ordenes/:id', (req, res) => {
    const { id } = req.params;
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run(`DELETE FROM orden_items WHERE orden_id = ?`, [id], (err) => {
            if (err) { db.run('ROLLBACK'); return res.status(500).json({ status: 'error', message: err.message }); }
            db.run(`DELETE FROM ordenes WHERE id = ?`, [id], (err) => {
                if (err) { db.run('ROLLBACK'); return res.status(500).json({ status: 'error', message: err.message }); }
                db.run('COMMIT');
                res.json({ status: 'success', message: 'Orden eliminada con éxito' });
            });
        });
    });
});

// WhatsApp Notificaciones (Distinción correcta entre Orden Recibida y Pedido Listo para Recoger)
app.get('/api/ordenes/:id/whatsapp', (req, res) => {
    const { id } = req.params;
    const qOrden = `
        SELECT o.*, c.nombre_completo as cliente_nombre, c.telefono as cliente_telefono 
        FROM ordenes o 
        LEFT JOIN clientes c ON o.cliente_id = c.id 
        WHERE o.id = ?
    `;
    db.get(qOrden, [id], (err, orden) => {
        if (err || !orden) return res.status(404).json({ status: 'error', message: 'Orden no encontrada' });
        if (!orden.cliente_telefono) return res.status(400).json({ status: 'error', message: 'El cliente no tiene teléfono registrado.' });

        db.all(`SELECT oi.*, s.nombre as servicio_nombre FROM orden_items oi LEFT JOIN servicios s ON oi.servicio_id = s.id WHERE oi.orden_id = ?`, [id], (err, items) => {
            if (err) return res.status(500).json({ status: 'error', message: err.message });

            let telefonoLimpio = orden.cliente_telefono.replace(/\D/g, '');
            
            let detallePrendas = items.map(i => {
                let desc = `- ${i.cantidad} ${i.servicio_nombre}`;
                if (i.observacion_prenda && i.observacion_prenda.trim() !== '') {
                    desc += ` (${i.observacion_prenda})`;
                }
                return desc;
            }).join('\n');

            let mensaje = '';
            let estadoActual = (orden.estado || '').trim().toLowerCase();

            // Validar si está listo para entrega o entregado
            if (estadoActual === 'listo para entrega' || estadoActual === 'entregado') {
                mensaje = `🧺 LAVANDERÍA LAVATEX\n\n¡Hola ${orden.cliente_nombre}! Su orden *${orden.codigo_orden}* ya está lista para recoger.\n\n📋 Detalle de prendas:\n${detallePrendas}\n\n💰 Total a Pagar: $${Number(orden.total).toLocaleString('es-CO')} COP\n💵 Abono Inicial: $${Number(orden.abono).toLocaleString('es-CO')} COP\n🔴 Saldo Pendiente: $${Number(orden.saldo).toLocaleString('es-CO')} COP\n\n¡Lo esperamos!`;
            } else {
                mensaje = `🧺 LAVANDERÍA LAVATEX\n\n¡Hola ${orden.cliente_nombre}! Hemos recibido su pedido *${orden.codigo_orden}*.\n\n📋 Detalle de prendas:\n${detallePrendas}\n\n💰 Total a Pagar: $${Number(orden.total).toLocaleString('es-CO')} COP\n💵 Abono Inicial: $${Number(orden.abono).toLocaleString('es-CO')} COP\n🔴 Saldo Pendiente: $${Number(orden.saldo).toLocaleString('es-CO')} COP\n\n¡Gracias por su preferencia!`;
            }

            let urlWhatsapp = `https://api.whatsapp.com/send?phone=57${telefonoLimpio}&text=${encodeURIComponent(mensaje)}`;
            res.json({ status: 'success', urlWhatsapp });
        });
    });
});

// Ticket
app.get('/api/caja/ticket/:id', (req, res) => {
    const { id } = req.params;
    const qOrden = `
        SELECT o.*, c.nombre_completo as cliente_nombre, c.numero_identificacion as cliente_cedula, c.telefono as cliente_telefono 
        FROM ordenes o 
        LEFT JOIN clientes c ON o.cliente_id = c.id 
        WHERE o.id = ?
    `;
    db.get(qOrden, [id], (err, orden) => {
        if (err || !orden) return res.status(404).json({ status: 'error', message: 'Orden no encontrada' });

        db.all(`SELECT oi.*, s.nombre as servicio_nombre FROM orden_items oi LEFT JOIN servicios s ON oi.servicio_id = s.id WHERE oi.orden_id = ?`, [id], (err, items) => {
            if (err) return res.status(500).json({ status: 'error', message: err.message });
            res.json({ status: 'success', ticket: { orden, items } });
        });
    });
});

// Caja y Finanzas
app.get('/api/caja/estado', (req, res) => {
    db.get(`SELECT * FROM caja_turnos WHERE estado = 'ABIERTA' ORDER BY id DESC LIMIT 1`, [], (err, turno) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        if (!turno) return res.json({ status: 'success', cajaAbierta: false });

        const qMov = `SELECT * FROM caja_movimientos WHERE turno_id = ?`;
        db.all(qMov, [turno.id], (err, movs) => {
            if (err) return res.status(500).json({ status: 'error', message: err.message });

            let totalIngresos = movs.filter(m => m.tipo === 'INGRESO' || m.tipo === 'ABONO').reduce((acc, m) => acc + m.monto, 0);
            let totalEgresos = movs.filter(m => m.tipo === 'EGRESO').reduce((acc, m) => acc + m.monto, 0);
            let saldoEsperado = turno.monto_apertura + totalIngresos - totalEgresos;

            res.json({
                status: 'success',
                cajaAbierta: true,
                turno,
                resumen: { montoApertura: turno.monto_apertura, totalIngresos, totalEgresos, saldoEsperado }
            });
        });
    });
});

app.post('/api/caja/abrir', (req, res) => {
    const { monto_apertura } = req.body;
    db.run(`INSERT INTO caja_turnos (monto_apertura, estado) VALUES (?, 'ABIERTA')`, [monto_apertura || 0], function(err) {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.json({ status: 'success', message: 'Caja abierta con éxito', turnoId: this.lastID });
    });
});

app.post('/api/caja/egreso', (req, res) => {
    const { monto, concepto } = req.body;
    db.get(`SELECT id FROM caja_turnos WHERE estado = 'ABIERTA' ORDER BY id DESC LIMIT 1`, [], (err, turno) => {
        if (!turno) return res.status(400).json({ status: 'error', message: 'No hay turno de caja abierto.' });
        db.run(`INSERT INTO caja_movimientos (turno_id, tipo, monto, concepto) VALUES (?, 'EGRESO', ?, ?)`, [turno.id, monto, concepto], function(err) {
            if (err) return res.status(500).json({ status: 'error', message: err.message });
            res.json({ status: 'success', message: 'Egreso registrado correctamente' });
        });
    });
});

app.post('/api/caja/cerrar', (req, res) => {
    const { monto_cierre_efectivo } = req.body;
    db.get(`SELECT * FROM caja_turnos WHERE estado = 'ABIERTA' ORDER BY id DESC LIMIT 1`, [], (err, turno) => {
        if (!turno) return res.status(400).json({ status: 'error', message: 'No hay caja abierta.' });

        db.all(`SELECT * FROM caja_movimientos WHERE turno_id = ?`, [turno.id], (err, movs) => {
            let totalIngresos = movs.filter(m => m.tipo === 'INGRESO' || m.tipo === 'ABONO').reduce((acc, m) => acc + m.monto, 0);
            let totalEgresos = movs.filter(m => m.tipo === 'EGRESO').reduce((acc, m) => acc + m.monto, 0);
            let saldoEsperado = turno.monto_apertura + totalIngresos - totalEgresos;
            let diferencia = (monto_cierre_efectivo || 0) - saldoEsperado;

            db.run(`UPDATE caja_turnos SET monto_cierre = ?, efectivo_contado = ?, diferencia = ?, fecha_cierre = CURRENT_TIMESTAMP, estado = 'CERRADA' WHERE id = ?`,
                [saldoEsperado, monto_cierre_efectivo || 0, diferencia, turno.id], function(err) {
                    if (err) return res.status(500).json({ status: 'error', message: err.message });
                    res.json({ status: 'success', resumen: { saldoEsperado, efectivoContado: monto_cierre_efectivo, diferencia } });
                });
        });
    });
});

// Reportes
app.get('/api/caja/reporte-ventas', (req, res) => {
    const { fecha_inicio, fecha_fin } = req.query;
    let whereClause = `WHERE 1=1`;
    let params = [];

    if (fecha_inicio && fecha_fin) {
        whereClause += ` AND date(fecha_recepcion) BETWEEN ? AND ?`;
        params.push(fecha_inicio, fecha_fin);
    }

    const qOrdenes = `SELECT * FROM ordenes ${whereClause}`;
    db.all(qOrdenes, params, (err, ordenes) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });

        let totalPedidos = ordenes.length;
        let totalSubtotal = ordenes.reduce((acc, o) => acc + o.total, 0);
        let totalVendido = totalSubtotal;
        let totalAbonosPedidos = ordenes.reduce((acc, o) => acc + o.abono, 0);
        let totalSaldosPendientes = ordenes.reduce((acc, o) => acc + o.saldo, 0);

        const qServicios = `
            SELECT s.nombre as servicio_nombre, SUM(oi.cantidad) as cantidad_total, SUM(oi.subtotal_item) as recaudado
            FROM orden_items oi
            JOIN ordenes o ON oi.orden_id = o.id
            JOIN servicios s ON oi.servicio_id = s.id
            ${whereClause}
            GROUP BY s.id
        `;
        db.all(qServicios, params, (err, porServicio) => {
            if (err) return res.status(500).json({ status: 'error', message: err.message });

            res.json({
                status: 'success',
                resumen: {
                    totalPedidos,
                    totalSubtotal,
                    totalVendido,
                    totalAbonosPedidos,
                    dineroRecibidoCaja: totalAbonosPedidos,
                    totalSaldosPendientes
                },
                porServicio
            });
        });
    });
});

// Inventario
app.get('/api/inventario/insumos', (req, res) => {
    db.all(`SELECT * FROM insumos ORDER BY nombre ASC`, [], (err, rows) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.json({ status: 'success', data: rows });
    });
});

app.post('/api/inventario/movimiento', (req, res) => {
    const { insumo_id, tipo, cantidad, motivo } = req.body;
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run(`INSERT INTO insumo_movimientos (insumo_id, tipo, cantidad, motivo) VALUES (?, ?, ?, ?)`, [insumo_id, tipo, cantidad, motivo || ''], (err) => {
            if (err) { db.run('ROLLBACK'); return res.status(500).json({ status: 'error', message: err.message }); }

            let factor = tipo === 'ENTRADA_COMPRA' ? cantidad : -cantidad;
            db.run(`UPDATE insumos SET stock_actual = stock_actual + ? WHERE id = ?`, [factor, insumo_id], (err) => {
                if (err) { db.run('ROLLBACK'); return res.status(500).json({ status: 'error', message: err.message }); }
                db.run('COMMIT');
                res.json({ status: 'success', message: 'Movimiento de inventario registrado con éxito' });
            });
        });
    });
});

app.listen(PORT, () => {
    console.log(`Servidor POS Lavatex corriendo en el puerto ${PORT}`);
});