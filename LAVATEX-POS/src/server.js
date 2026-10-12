const express = require('express');
const { createClient } = require('@libsql/client/web');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// Conexión a Turso Cloud mediante protocolo HTTP/Web
const db = createClient({
    url: process.env.TURSO_DATABASE_URL || "file:lavatex_pos.db",
    authToken: process.env.TURSO_AUTH_TOKEN || undefined
});

console.log('Conectado a la base de datos en Turso Cloud (modo web/http).');
inicializarBaseDatos();

async function inicializarBaseDatos() {
    try {
        await db.execute(`CREATE TABLE IF NOT EXISTS clientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre_completo TEXT NOT NULL,
            telefono TEXT NOT NULL,
            numero_identificacion TEXT,
            direccion TEXT,
            correo TEXT
        )`);

        await db.execute(`CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            usuario TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            rol TEXT NOT NULL
        )`);

        const resUser = await db.execute(`SELECT COUNT(*) as count FROM usuarios`);
        if (resUser.rows[0].count === 0) {
            await db.execute({
                sql: `INSERT INTO usuarios (nombre, usuario, password, rol) VALUES (?, ?, ?, ?)`,
                args: ['Administrador', 'admin', '1234', 'admin']
            });
            await db.execute({
                sql: `INSERT INTO usuarios (nombre, usuario, password, rol) VALUES (?, ?, ?, ?)`,
                args: ['Trabajador Mostrador', 'trabajador', '1234', 'trabajador']
            });
        }

        await db.execute(`CREATE TABLE IF NOT EXISTS servicios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo TEXT,
            nombre TEXT NOT NULL,
            descripcion TEXT,
            unidad_cobro TEXT DEFAULT 'unidad',
            precio REAL NOT NULL,
            tiempo_estimado_horas INTEGER DEFAULT 24,
            activo INTEGER DEFAULT 1
        )`);

        const resServ = await db.execute(`SELECT COUNT(*) as count FROM servicios`);
        if (resServ.rows[0].count === 0) {
            const serviciosIniciales = [
                ['CUB', 'CUBRELECHO', 'Lavado y desinfección de cubrecama', 'unidad', 20000, 24],
                ['PH', 'PANTALON HOMBRE', 'Lavado y planchado', 'unidad', 8000, 24],
                ['CH', 'CAMISA HOMBRE', 'Lavado y planchado', 'unidad', 7000, 24],
                ['JNB', 'JEAN / PANTALON', 'Lavado en seco / agua', 'unidad', 9000, 24],
                ['COB', 'COBIJA / FRAZADA', 'Lavado profundo', 'unidad', 15000, 24]
            ];
            for (let s of serviciosIniciales) {
                await db.execute({
                    sql: `INSERT INTO servicios (codigo, nombre, descripcion, unidad_cobro, precio, tiempo_estimado_horas, activo) VALUES (?, ?, ?, ?, ?, ?, 1)`,
                    args: s
                });
            }
        }

        await db.execute(`CREATE TABLE IF NOT EXISTS ordenes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo_orden TEXT UNIQUE NOT NULL,
            cliente_id INTEGER,
            subtotal REAL DEFAULT 0,
            total REAL NOT NULL,
            abono REAL DEFAULT 0,
            saldo REAL NOT NULL,
            fecha_recepcion DATETIME,
            fecha_entrega_estimada DATETIME,
            estado TEXT DEFAULT 'Recibido',
            ubicacion_fisica TEXT DEFAULT 'Estantería Principal',
            observaciones TEXT,
            FOREIGN KEY(cliente_id) REFERENCES clientes(id)
        )`);

        try {
            await db.execute(`ALTER TABLE ordenes ADD COLUMN subtotal REAL DEFAULT 0`);
        } catch (e) {}

        await db.execute(`CREATE TABLE IF NOT EXISTS orden_items (
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

        await db.execute(`CREATE TABLE IF NOT EXISTS caja_turnos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            monto_apertura REAL NOT NULL,
            fecha_apertura DATETIME DEFAULT CURRENT_TIMESTAMP,
            monto_cierre REAL,
            efectivo_contado REAL,
            diferencia REAL,
            fecha_cierre DATETIME,
            estado TEXT DEFAULT 'ABIERTA'
        )`);

        await db.execute(`CREATE TABLE IF NOT EXISTS caja_movimientos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            turno_id INTEGER,
            tipo TEXT,
            monto REAL NOT NULL,
            concepto TEXT,
            fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(turno_id) REFERENCES caja_turnos(id)
        )`);

        await db.execute(`CREATE TABLE IF NOT EXISTS insumos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            unidad_medida TEXT NOT NULL,
            stock_actual REAL DEFAULT 0,
            stock_minimo REAL DEFAULT 5
        )`);

        await db.execute(`CREATE TABLE IF NOT EXISTS insumo_movimientos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            insumo_id INTEGER,
            tipo TEXT,
            cantidad REAL NOT NULL,
            motivo TEXT,
            fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(insumo_id) REFERENCES insumos(id)
        )`);

        console.log('Tablas inicializadas correctamente en Turso.');
    } catch (e) {
        console.error('Error al inicializar la base de datos en Turso:', e.message);
    }
}

// API Login de Usuarios
app.post('/api/usuarios/login', async (req, res) => {
    const { usuario, password } = req.body;
    try {
        const result = await db.execute({
            sql: `SELECT * FROM usuarios WHERE usuario = ? AND password = ?`,
            args: [usuario, password]
        });
        if (result.rows.length === 0) {
            return res.status(401).json({ status: 'error', message: 'Usuario o contraseña incorrectos.' });
        }
        res.json({ status: 'success', user: result.rows[0] });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// API Gestión de Usuarios (CRUD)
app.get('/api/usuarios', async (req, res) => {
    try {
        const result = await db.execute(`SELECT id, nombre, usuario, rol FROM usuarios ORDER BY id DESC`);
        res.json({ status: 'success', data: result.rows });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post('/api/usuarios', async (req, res) => {
    const { nombre, usuario, password, rol } = req.body;
    if (!nombre || !usuario || !password || !rol) {
        return res.status(400).json({ status: 'error', message: 'Todos los campos son obligatorios.' });
    }
    try {
        await db.execute({
            sql: `INSERT INTO usuarios (nombre, usuario, password, rol) VALUES (?, ?, ?, ?)`,
            args: [nombre, usuario, password, rol]
        });
        res.json({ status: 'success', message: 'Usuario creado con éxito' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: 'El nombre de usuario ya existe o hubo un error.' });
    }
});

app.delete('/api/usuarios/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.execute({ sql: `DELETE FROM usuarios WHERE id = ?`, args: [id] });
        res.json({ status: 'success', message: 'Usuario eliminado correctamente' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// API Clientes
app.get('/api/clientes', async (req, res) => {
    try {
        const result = await db.execute(`SELECT * FROM clientes ORDER BY id DESC`);
        res.json({ status: 'success', data: result.rows });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post('/api/clientes', async (req, res) => {
    const { nombre_completo, telefono, numero_identificacion, direccion, correo } = req.body;
    if (!nombre_completo || !telefono) {
        return res.status(400).json({ status: 'error', message: 'Nombre y teléfono son obligatorios.' });
    }
    try {
        const result = await db.execute({
            sql: `INSERT INTO clientes (nombre_completo, telefono, numero_identificacion, direccion, correo) VALUES (?, ?, ?, ?, ?)`,
            args: [nombre_completo, telefono, numero_identificacion, direccion, correo]
        });
        res.json({ status: 'success', message: 'Cliente registrado con éxito', id: Number(result.lastInsertRowid) });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.delete('/api/clientes/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.execute({ sql: `DELETE FROM clientes WHERE id = ?`, args: [id] });
        res.json({ status: 'success', message: 'Cliente eliminado correctamente' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// API Servicios
app.get('/api/ordenes/servicios', async (req, res) => {
    const admin = req.query.admin;
    let query = `SELECT * FROM servicios`;
    if (!admin) query += ` WHERE activo = 1`;
    query += ` ORDER BY nombre ASC`;

    try {
        const result = await db.execute(query);
        res.json({ status: 'success', data: result.rows });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post('/api/ordenes/servicios', async (req, res) => {
    const { codigo, nombre, descripcion, unidad_cobro, precio, tiempo_estimado_horas } = req.body;
    try {
        const result = await db.execute({
            sql: `INSERT INTO servicios (codigo, nombre, descripcion, unidad_cobro, precio, tiempo_estimado_horas, activo) VALUES (?, ?, ?, ?, ?, ?, 1)`,
            args: [codigo, nombre, descripcion, unidad_cobro, precio, tiempo_estimado_horas || 24]
        });
        res.json({ status: 'success', message: 'Servicio registrado con éxito', id: Number(result.lastInsertRowid) });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.put('/api/ordenes/servicios/:id', async (req, res) => {
    const { id } = req.params;
    const { codigo, nombre, descripcion, unidad_cobro, precio, tiempo_estimado_horas, activo } = req.body;
    try {
        await db.execute({
            sql: `UPDATE servicios SET codigo = ?, nombre = ?, descripcion = ?, unidad_cobro = ?, precio = ?, tiempo_estimado_horas = ?, activo = ? WHERE id = ?`,
            args: [codigo, nombre, descripcion, unidad_cobro, precio, tiempo_estimado_horas, activo, id]
        });
        res.json({ status: 'success', message: 'Servicio actualizado correctamente' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.delete('/api/ordenes/servicios/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.execute({ sql: `UPDATE servicios SET activo = 0 WHERE id = ?`, args: [id] });
        res.json({ status: 'success', message: 'Servicio desactivado para proteger el historial histórico.' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// API Órdenes
app.get('/api/ordenes', async (req, res) => {
    const query = `
        SELECT o.*, c.nombre_completo as cliente_nombre, c.telefono as cliente_telefono, c.numero_identificacion as cliente_cedula 
        FROM ordenes o 
        LEFT JOIN clientes c ON o.cliente_id = c.id 
        ORDER BY o.id DESC
    `;
    try {
        const result = await db.execute(query);
        res.json({ status: 'success', data: result.rows });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post('/api/ordenes', async (req, res) => {
    const { cliente_id, items, abono, fecha_entrega_estimada, observaciones } = req.body;
    if (!items || items.length === 0) {
        return res.status(400).json({ status: 'error', message: 'La orden debe contener al menos un servicio.' });
    }

    let total = items.reduce((acc, item) => acc + (parseFloat(item.subtotal_item) || 0), 0);
    let abonoNum = parseFloat(abono) || 0;
    let saldo = Math.max(0, total - abonoNum);
    let obsGenerales = observaciones || '';
    let fechaEntrega = fecha_entrega_estimada || null;

    const fechaHoraColombia = new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' });
    const fechaRecepcionLocal = new Date(fechaHoraColombia).toISOString().slice(0, 19).replace('T', ' ');

    try {
        const countRow = await db.execute(`SELECT COUNT(*) as total FROM ordenes`);
        const totalRegistros = Number(countRow.rows[0].total) || 0;
        let codigoOrden = String(totalRegistros + 1).padStart(4, '0');

        let existe = await db.execute({ sql: `SELECT id FROM ordenes WHERE codigo_orden = ?`, args: [codigoOrden] });
        let intento = totalRegistros + 1;
        while (existe.rows.length > 0) {
            intento++;
            codigoOrden = String(intento).padStart(4, '0');
            existe = await db.execute({ sql: `SELECT id FROM ordenes WHERE codigo_orden = ?`, args: [codigoOrden] });
        }

        const queryOrden = `INSERT INTO ordenes (codigo_orden, cliente_id, subtotal, total, abono, saldo, fecha_recepcion, fecha_entrega_estimada, estado, ubicacion_fisica, observaciones) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Recibido', 'Estantería Principal', ?)`;
        
        const resOrden = await db.execute({
            sql: queryOrden,
            args: [codigoOrden, cliente_id || null, total, total, abonoNum, saldo, fechaRecepcionLocal, fechaEntrega, obsGenerales]
        });

        const ordenId = Number(resOrden.lastInsertRowid);

        for (let item of items) {
            await db.execute({
                sql: `INSERT INTO orden_items (orden_id, servicio_id, cantidad, precio_unitario, subtotal_item, observacion_prenda) VALUES (?, ?, ?, ?, ?, ?)`,
                args: [ordenId, item.servicio_id, item.cantidad, item.precio_unitario, item.subtotal_item, item.observacion_prenda || '']
            });
        }

        if (abonoNum > 0) {
            const turnoRes = await db.execute(`SELECT id FROM caja_turnos WHERE estado = 'ABIERTA' ORDER BY id DESC LIMIT 1`);
            if (turnoRes.rows.length > 0) {
                await db.execute({
                    sql: `INSERT INTO caja_movimientos (turno_id, tipo, monto, concepto) VALUES (?, 'ABONO', ?, ?)`,
                    args: [turnoRes.rows[0].id, abonoNum, `Abono inicial recibo ${codigoOrden}`]
                });
            }
        }

        res.json({ status: 'success', message: 'Orden creada con éxito', ordenId, codigo_orden: codigoOrden });
    } catch (err) {
        console.error('Error detallado al crear orden:', err.message);
        res.status(500).json({ status: 'error', message: 'Error de base de datos: ' + err.message });
    }
});

app.put('/api/ordenes/:id/estado', async (req, res) => {
    const { id } = req.params;
    const { estado, ubicacion_fisica, abonar_adicional } = req.body;

    try {
        const ordenRes = await db.execute({ sql: `SELECT * FROM ordenes WHERE id = ? OR codigo_orden = ?`, args: [id, id] });
        if (ordenRes.rows.length === 0) return res.status(404).json({ status: 'error', message: 'Orden no encontrada' });
        
        const orden = ordenRes.rows[0];
        let nuevoAbono = orden.abono + (parseFloat(abonar_adicional) || 0);
        let nuevoSaldo = Math.max(0, orden.total - nuevoAbono);

        await db.execute({
            sql: `UPDATE ordenes SET estado = ?, ubicacion_fisica = ?, abono = ?, saldo = ? WHERE id = ?`,
            args: [estado, ubicacion_fisica, nuevoAbono, nuevoSaldo, orden.id]
        });

        if (abonar_adicional > 0) {
            const turnoRes = await db.execute(`SELECT id FROM caja_turnos WHERE estado = 'ABIERTA' ORDER BY id DESC LIMIT 1`);
            if (turnoRes.rows.length > 0) {
                await db.execute({
                    sql: `INSERT INTO caja_movimientos (turno_id, tipo, monto, concepto) VALUES (?, 'ABONO', ?, ?)`,
                    args: [turnoRes.rows[0].id, abonar_adicional, `Pago saldo recibo ${orden.codigo_orden}`]
                });
            }
        }

        res.json({ status: 'success', message: 'Estado de orden actualizado correctamente' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.delete('/api/ordenes/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const ordenRes = await db.execute({ sql: `SELECT id FROM ordenes WHERE id = ? OR codigo_orden = ?`, args: [id, id] });
        if (ordenRes.rows.length === 0) {
            return res.status(404).json({ status: 'error', message: 'Orden no encontrada en la base de datos.' });
        }
        const ordenIdReal = ordenRes.rows[0].id;

        await db.execute(`PRAGMA foreign_keys = OFF;`);
        await db.execute({ sql: `DELETE FROM orden_items WHERE orden_id = ?`, args: [ordenIdReal] });
        await db.execute({ sql: `DELETE FROM ordenes WHERE id = ?`, args: [ordenIdReal] });
        await db.execute(`PRAGMA foreign_keys = ON;`);

        res.json({ status: 'success', message: 'Orden eliminada con éxito' });
    } catch (err) {
        await db.execute(`PRAGMA foreign_keys = ON;`);
        console.error("Error al eliminar orden:", err.message);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// WhatsApp Notificaciones
app.get('/api/ordenes/:id/whatsapp', async (req, res) => {
    const { id } = req.params;
    try {
        const qOrden = `
            SELECT o.*, c.nombre_completo as cliente_nombre, c.telefono as cliente_telefono 
            FROM ordenes o 
            LEFT JOIN clientes c ON o.cliente_id = c.id 
            WHERE o.id = ? OR o.codigo_orden = ?
        `;
        const ordenRes = await db.execute({ sql: qOrden, args: [id, id] });
        if (ordenRes.rows.length === 0) return res.status(404).json({ status: 'error', message: 'Orden no encontrada' });
        
        const orden = ordenRes.rows[0];
        if (!orden.cliente_telefono) return res.status(400).json({ status: 'error', message: 'El cliente no tiene teléfono registrado.' });

        const itemsRes = await db.execute({
            sql: `SELECT oi.*, s.nombre as servicio_nombre FROM orden_items oi LEFT JOIN servicios s ON oi.servicio_id = s.id WHERE oi.orden_id = ?`,
            args: [orden.id]
        });

        let telefonoLimpio = orden.cliente_telefono.replace(/\D/g, '');
        let detallePrendas = itemsRes.rows.map(i => {
            let desc = `- ${i.cantidad} ${i.servicio_nombre}`;
            if (i.observacion_prenda && i.observacion_prenda.trim() !== '') {
                desc += ` (${i.observacion_prenda})`;
            }
            return desc;
        }).join('\n');

        let fechaEntregaTexto = 'No especificada';
        if (orden.fecha_entrega_estimada) {
            const partes = orden.fecha_entrega_estimada.split('T')[0].split('-');
            if(partes.length === 3) fechaEntregaTexto = `${partes[2]}/${partes[1]}/${partes[0]}`;
        }

        let mensaje = `🧺 LAVASECO LAVATEX\n\n¡Hola ${orden.cliente_nombre}! Su recibo *${orden.codigo_orden}* está listo.\n\n📅 Fecha de Entrega: ${fechaEntregaTexto}\n\n📋 Detalle:\n${detallePrendas}\n\n💰 Total: $${Number(orden.total).toLocaleString('es-CO')} COP\n💵 Abono: $${Number(orden.abono).toLocaleString('es-CO')} COP\n🔴 Saldo: $${Number(orden.saldo).toLocaleString('es-CO')} COP\n\n⚠️ *Plazo máximo de retiro: 90 días.*\n\n¡Lo esperamos en Calle 19A # 10-81 Pasaje de Vargas!`;

        let urlWhatsapp = `https://api.whatsapp.com/send?phone=57${telefonoLimpio}&text=${encodeURIComponent(mensaje)}`;
        res.json({ status: 'success', urlWhatsapp });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Ticket
app.get('/api/caja/ticket/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const qOrden = `
            SELECT o.*, c.nombre_completo as cliente_nombre, c.numero_identificacion as cliente_cedula, c.telefono as cliente_telefono 
            FROM ordenes o 
            LEFT JOIN clientes c ON o.cliente_id = c.id 
            WHERE o.id = ? OR o.codigo_orden = ?
        `;
        const ordenRes = await db.execute({ sql: qOrden, args: [id, id] });
        if (ordenRes.rows.length === 0) return res.status(404).json({ status: 'error', message: 'Orden no encontrada' });
        
        const orden = ordenRes.rows[0];
        const itemsRes = await db.execute({
            sql: `SELECT oi.*, s.nombre as servicio_nombre FROM orden_items oi LEFT JOIN servicios s ON oi.servicio_id = s.id WHERE oi.orden_id = ?`,
            args: [orden.id]
        });

        res.json({ status: 'success', ticket: { orden, items: itemsRes.rows } });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Caja y Finanzas
app.get('/api/caja/estado', async (req, res) => {
    try {
        const turnoRes = await db.execute(`SELECT * FROM caja_turnos WHERE estado = 'ABIERTA' ORDER BY id DESC LIMIT 1`);
        if (turnoRes.rows.length === 0) return res.json({ status: 'success', cajaAbierta: false });

        const turno = turnoRes.rows[0];
        const movRes = await db.execute({ sql: `SELECT * FROM caja_movimientos WHERE turno_id = ?`, args: [turno.id] });

        let totalIngresos = movRes.rows.filter(m => m.tipo === 'INGRESO' || m.tipo === 'ABONO').reduce((acc, m) => acc + m.monto, 0);
        let totalEgresos = movRes.rows.filter(m => m.tipo === 'EGRESO').reduce((acc, m) => acc + m.monto, 0);
        let saldoEsperado = turno.monto_apertura + totalIngresos - totalEgresos;

        res.json({
            status: 'success',
            cajaAbierta: true,
            turno,
            resumen: { montoApertura: turno.monto_apertura, totalIngresos, totalEgresos, saldoEsperado }
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post('/api/caja/abrir', async (req, res) => {
    const { monto_apertura } = req.body;
    try {
        const result = await db.execute({
            sql: `INSERT INTO caja_turnos (monto_apertura, estado) VALUES (?, 'ABIERTA')`,
            args: [monto_apertura || 0]
        });
        res.json({ status: 'success', message: 'Caja abierta con éxito', turnoId: Number(result.lastInsertRowid) });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post('/api/caja/egreso', async (req, res) => {
    const { monto, concepto } = req.body;
    try {
        const turnoRes = await db.execute(`SELECT id FROM caja_turnos WHERE estado = 'ABIERTA' ORDER BY id DESC LIMIT 1`);
        if (turnoRes.rows.length === 0) return res.status(400).json({ status: 'error', message: 'No hay turno de caja abierto.' });

        await db.execute({
            sql: `INSERT INTO caja_movimientos (turno_id, tipo, monto, concepto) VALUES (?, 'EGRESO', ?, ?)`,
            args: [turnoRes.rows[0].id, monto, concepto]
        });
        res.json({ status: 'success', message: 'Egreso registrado correctamente' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post('/api/caja/cerrar', async (req, res) => {
    const { monto_cierre_efectivo } = req.body;
    try {
        const turnoRes = await db.execute(`SELECT * FROM caja_turnos WHERE estado = 'ABIERTA' ORDER BY id DESC LIMIT 1`);
        if (turnoRes.rows.length === 0) return res.status(400).json({ status: 'error', message: 'No hay caja abierta.' });

        const turno = turnoRes.rows[0];
        const movRes = await db.execute({ sql: `SELECT * FROM caja_movimientos WHERE turno_id = ?`, args: [turno.id] });

        let totalIngresos = movRes.rows.filter(m => m.tipo === 'INGRESO' || m.tipo === 'ABONO').reduce((acc, m) => acc + m.monto, 0);
        let totalEgresos = movRes.rows.filter(m => m.tipo === 'EGRESO').reduce((acc, m) => acc + m.monto, 0);
        let saldoEsperado = turno.monto_apertura + totalIngresos - totalEgresos;
        let diferencia = (monto_cierre_efectivo || 0) - saldoEsperado;

        await db.execute({
            sql: `UPDATE caja_turnos SET monto_cierre = ?, efectivo_contado = ?, diferencia = ?, fecha_cierre = CURRENT_TIMESTAMP, estado = 'CERRADA' WHERE id = ?`,
            args: [saldoEsperado, monto_cierre_efectivo || 0, diferencia, turno.id]
        });

        res.json({ status: 'success', resumen: { saldoEsperado, efectivoContado: monto_cierre_efectivo, diferencia } });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Reportes
app.get('/api/caja/reporte-ventas', async (req, res) => {
    const { fecha_inicio, fecha_fin } = req.query;
    let whereClause = `WHERE 1=1`;
    let params = [];

    if (fecha_inicio && fecha_fin) {
        whereClause += ` AND date(fecha_recepcion) BETWEEN ? AND ?`;
        params.push(fecha_inicio, fecha_fin);
    }

    try {
        const ordenesRes = await db.execute({ sql: `SELECT * FROM ordenes ${whereClause}`, args: params });
        const ordenes = ordenesRes.rows;

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
        const servRes = await db.execute({ sql: qServicios, args: params });

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
            porServicio: servRes.rows
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Inventario
app.get('/api/inventario/insumos', async (req, res) => {
    try {
        const result = await db.execute(`SELECT * FROM insumos ORDER BY nombre ASC`);
        res.json({ status: 'success', data: result.rows });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post('/api/inventario/movimiento', async (req, res) => {
    const { insumo_id, tipo, cantidad, motivo } = req.body;
    try {
        await db.execute({
            sql: `INSERT INTO insumo_movimientos (insumo_id, tipo, cantidad, motivo) VALUES (?, ?, ?, ?)`,
            args: [insumo_id, tipo, cantidad, motivo || '']
        });

        let factor = tipo === 'ENTRADA_COMPRA' ? cantidad : -cantidad;
        await db.execute({
            sql: `UPDATE insumos SET stock_actual = stock_actual + ? WHERE id = ?`,
            args: [factor, insumo_id]
        });

        res.json({ status: 'success', message: 'Movimiento de inventario registrado con éxito' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor POS Lavatex corriendo en el puerto ${PORT}`);
});