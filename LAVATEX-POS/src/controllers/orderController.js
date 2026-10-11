const db = require('../config/database');

// Obtener catálogo de servicios (incluyendo inactivos para administración)
const obtenerServicios = (req, res) => {
    const admin = req.query.admin === 'true';
    const query = admin ? `SELECT * FROM servicios ORDER BY nombre ASC` : `SELECT * FROM servicios WHERE activo = 1 ORDER BY nombre ASC`;
    
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.json({ status: 'success', data: rows });
    });
};

// Crear un nuevo servicio
const crearServicio = (req, res) => {
    const { nombre, descripcion, unidad_cobro, precio, tiempo_estimado_horas } = req.body;
    if (!nombre || precio === undefined || !unidad_cobro) {
        return res.status(400).json({ status: 'error', message: 'El nombre, precio y unidad de cobro son obligatorios.' });
    }
    const query = `INSERT INTO servicios (nombre, descripcion, unidad_cobro, precio, tiempo_estimado_horas, activo) VALUES (?, ?, ?, ?, ?, 1)`;
    db.run(query, [nombre, descripcion || '', unidad_cobro, parseFloat(precio), parseInt(tiempo_estimado_horas) || 24], function(err) {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.status(201).json({ status: 'success', message: 'Servicio creado exitosamente.', servicioId: this.lastID });
    });
};

// Actualizar servicio existente
const actualizarServicio = (req, res) => {
    const { id } = req.params;
    const { nombre, descripcion, unidad_cobro, precio, tiempo_estimado_horas, activo } = req.body;

    if (!nombre || precio === undefined || !unidad_cobro) {
        return res.status(400).json({ status: 'error', message: 'El nombre, precio y unidad de cobro son obligatorios.' });
    }

    const query = `UPDATE servicios SET nombre = ?, descripcion = ?, unidad_cobro = ?, precio = ?, tiempo_estimado_horas = ?, activo = ? WHERE id = ?`;
    db.run(query, [nombre, descripcion || '', unidad_cobro, parseFloat(precio), parseInt(tiempo_estimado_horas) || 24, activo !== undefined ? activo : 1, id], function(err) {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.json({ status: 'success', message: 'Servicio actualizado correctamente.' });
    });
};

// Eliminar o desactivar servicio de forma segura
const eliminarServicio = (req, res) => {
    const { id } = req.params;

    db.get(`SELECT COUNT(*) as count FROM detalle_orden WHERE servicio_id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });

        if (row.count > 0) {
            db.run(`UPDATE servicios SET activo = 0 WHERE id = ?`, [id], (errUp) => {
                if (errUp) return res.status(500).json({ status: 'error', message: errUp.message });
                res.json({ 
                    status: 'success', 
                    message: 'El servicio tiene pedidos históricos asociados. Ha sido DESACTIVADO exitosamente.' 
                });
            });
        } else {
            db.run(`DELETE FROM servicios WHERE id = ?`, [id], (errDel) => {
                if (errDel) return res.status(500).json({ status: 'error', message: errDel.message });
                res.json({ status: 'success', message: 'Servicio eliminado permanentemente.' });
            });
        }
    });
};

// Obtener listado de órdenes con datos de cliente
const obtenerOrdenes = (req, res) => {
    const query = `
        SELECT o.*, c.nombre_completo as cliente_nombre, c.telefono as cliente_telefono, c.numero_identificacion as cliente_cedula 
        FROM ordenes o 
        LEFT JOIN clientes c ON o.cliente_id = c.id 
        ORDER BY o.id DESC LIMIT 100
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.json({ status: 'success', data: rows });
    });
};

// Crear nueva orden con consecutivo diario desde 1
const crearOrden = (req, res) => {
    const { cliente_id, items, descuento = 0, abono = 0, observaciones = '', fecha_entrega_estimada } = req.body;

    if (!cliente_id || !items || items.length === 0) {
        return res.status(400).json({ status: 'error', message: 'Debe seleccionar un cliente y al menos un servicio.' });
    }

    const fechaStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    
    db.get(`SELECT COUNT(*) as total FROM ordenes WHERE codigo_orden LIKE ?`, [`ORD-${fechaStr}-%`], (errCount, rowCount) => {
        const consecutivo = (rowCount ? rowCount.total : 0) + 1;
        const codigo_orden = `ORD-${fechaStr}-${consecutivo}`;

        let subtotal = 0;
        items.forEach(item => { subtotal += item.cantidad * item.precio_unitario; });

        const total = Math.max(0, subtotal - parseFloat(descuento));
        const montoAbono = parseFloat(abono) || 0;
        const saldo = Math.max(0, total - montoAbono);
        
        let fechaEntrega = fecha_entrega_estimada ? new Date(fecha_entrega_estimada) : new Date();
        if (!fecha_entrega_estimada) fechaEntrega.setHours(fechaEntrega.getHours() + 24);

        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            const queryOrden = `INSERT INTO ordenes (codigo_orden, cliente_id, subtotal, descuento, total, abono, saldo, fecha_entrega_estimada, observaciones) 
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            
            db.run(queryOrden, [codigo_orden, cliente_id, subtotal, descuento, total, montoAbono, saldo, fechaEntrega.toISOString(), observaciones], function(err) {
                if (err) { db.run('ROLLBACK'); return res.status(500).json({ status: 'error', message: err.message }); }

                const ordenId = this.lastID;
                const queryDetalle = `INSERT INTO detalle_orden (orden_id, servicio_id, cantidad, precio_unitario, subtotal_item, observacion_prenda) VALUES (?, ?, ?, ?, ?, ?)`;
                const stmt = db.prepare(queryDetalle);
                let errorOcurrido = false;

                items.forEach(item => {
                    const subItem = item.cantidad * item.precio_unitario;
                    stmt.run([ordenId, item.servicio_id, item.cantidad, item.precio_unitario, subItem, item.observacion_prenda || ''], (e) => { if(e) errorOcurrido = true; });
                });

                stmt.finalize(() => {
                    if (errorOcurrido) { db.run('ROLLBACK'); return res.status(500).json({ status: 'error', message: 'Error al registrar ítems.' }); }

                    if (montoAbono > 0) {
                        db.get(`SELECT id FROM turnos_caja WHERE estado = 'ABIERTA' ORDER BY id DESC LIMIT 1`, [], (errCaja, turno) => {
                            if (turno) {
                                db.run(`INSERT INTO movimientos_caja (turno_id, orden_id, tipo, monto, concepto) VALUES (?, ?, 'INGRESO_ABONO', ?, ?)`,
                                    [turno.id, ordenId, montoAbono, `Abono inicial orden ${codigo_orden}`]);
                            }
                        });
                    }

                    db.run('COMMIT');

                    db.get(`SELECT o.*, c.nombre_completo as cliente_nombre, c.telefono as cliente_telefono, c.numero_identificacion as cliente_cedula, c.direccion as cliente_direccion FROM ordenes o LEFT JOIN clientes c ON o.cliente_id = c.id WHERE o.id = ?`, [ordenId], (errGet, ordenCompleta) => {
                        db.all(`SELECT d.*, s.nombre as servicio_nombre FROM detalle_orden d LEFT JOIN servicios s ON d.servicio_id = s.id WHERE d.orden_id = ?`, [ordenId], (errDet, itemsCompletos) => {
                            res.status(201).json({ 
                                status: 'success', 
                                message: 'Orden creada exitosamente.', 
                                ordenId, 
                                codigo_orden,
                                orden: { ...ordenCompleta, items: itemsCompletos } 
                            });
                        });
                    });
                });
            });
        });
    });
};

// Eliminar orden de forma segura
const eliminarOrden = (req, res) => {
    const { id } = req.params;
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run(`DELETE FROM detalle_orden WHERE orden_id = ?`, [id], (errDet) => {
            if (errDet) { db.run('ROLLBACK'); return res.status(500).json({ status: 'error', message: errDet.message }); }
            db.run(`DELETE FROM movimientos_caja WHERE orden_id = ?`, [id], (errMov) => {
                if (errMov) { db.run('ROLLBACK'); return res.status(500).json({ status: 'error', message: errMov.message }); }
                db.run(`DELETE FROM historial_estados WHERE orden_id = ?`, [errHist => {}]);
                db.run(`DELETE FROM ordenes WHERE id = ?`, [id], (errOrd) => {
                    if (errOrd) { db.run('ROLLBACK'); return res.status(500).json({ status: 'error', message: errOrd.message }); }
                    db.run('COMMIT');
                    res.json({ status: 'success', message: 'Orden eliminada correctamente.' });
                });
            });
        });
    });
};

// Actualizar estado y ubicación de una orden
const actualizarEstadoOrden = (req, res) => {
    const { id } = req.params;
    const { estado, ubicacion_fisica, abonar_adicional = 0 } = req.body;

    if (!estado) {
        return res.status(400).json({ status: 'error', message: 'El estado es obligatorio.' });
    }

    db.get(`SELECT * FROM ordenes WHERE id = ?`, [id], (err, orden) => {
        if (err || !orden) return res.status(404).json({ status: 'error', message: 'Orden no encontrada.' });

        const nuevoEstado = estado;
        const nuevaUbicacion = (ubicacion_fisica !== undefined && ubicacion_fisica !== '') ? ubicacion_fisica : (orden.ubicacion_fisica || 'Estantería Principal');
        let nuevoAbono = orden.abono + (parseFloat(abonar_adicional) || 0);
        let nuevoSaldo = Math.max(0, orden.total - nuevoAbono);

        const queryUpdate = `UPDATE ordenes SET estado = ?, ubicacion_fisica = ?, abono = ?, saldo = ? WHERE id = ?`;

        db.run(queryUpdate, [nuevoEstado, nuevaUbicacion, nuevoAbono, nuevoSaldo, id], function(errU) {
            if (errU) return res.status(500).json({ status: 'error', message: errU.message });

            db.run(`INSERT INTO historial_estados (orden_id, estado_anterior, estado_nuevo) VALUES (?, ?, ?)`, 
                [id, orden.estado, nuevoEstado]);

            if (abonar_adicional > 0) {
                db.get(`SELECT id FROM turnos_caja WHERE estado = 'ABIERTA' ORDER BY id DESC LIMIT 1`, [], (eC, turno) => {
                    if (turno) {
                        db.run(`INSERT INTO movimientos_caja (turno_id, orden_id, tipo, monto, concepto) VALUES (?, ?, 'INGRESO_PAGO', ?, ?)`,
                            [turno.id, id, parseFloat(abonar_adicional), `Pago/Abono orden ${orden.codigo_orden}`]);
                    }
                });
            }

            res.json({ status: 'success', message: 'Orden actualizada correctamente.', nuevoEstado });
        });
    });
};

// Generar enlace detallado para notificación de WhatsApp con descripción de prendas
const obtenerMensajeWhatsapp = (req, res) => {
    const { id } = req.params;

    const queryOrden = `
        SELECT o.*, c.nombre_completo as cliente_nombre, c.telefono as cliente_telefono 
        FROM ordenes o 
        JOIN clientes c ON o.cliente_id = c.id 
        WHERE o.id = ?
    `;

    db.get(queryOrden, [id], (err, orden) => {
        if (err || !orden) return res.status(404).json({ status: 'error', message: 'Orden o cliente no encontrado.' });

        db.all(`SELECT d.*, s.nombre as servicio_nombre FROM detalle_orden d LEFT JOIN servicios s ON d.servicio_id = s.id WHERE d.orden_id = ?`, [id], (errDet, items) => {
            if (errDet) items = [];

            let tel = orden.cliente_telefono.replace(/\D/g, '');
            if (tel.length === 10) tel = '57' + tel;

            const estadoNormalizado = (orden.estado || '').trim().toLowerCase();
            let detallePrendas = items.map(i => `• ${i.cantidad}x ${i.servicio_nombre}`).join('\n');
            if (!detallePrendas) detallePrendas = '• Servicios generales de lavandería';

            let textoMensaje = "";

            if (estadoNormalizado === 'listo para entrega' || estadoNormalizado === 'listo') {
                textoMensaje = `Hola, ${orden.cliente_nombre}. Te informamos que tu pedido número ${orden.codigo_orden} ya está listo para entrega. Las prendas correspondientes a tu pedido son:\n${detallePrendas}\nPuedes acercarte para recogerlo. ¡Gracias por confiar en nosotros!`;
            } else {
                textoMensaje = `🧺 *LAVANDERÍA LAVATEX*\n\n¡Hola ${orden.cliente_nombre}! Hemos recibido tu pedido *${orden.codigo_orden}*.\n\n` +
                                `📋 *Detalle de prendas recibidas:*\n${detallePrendas}\n\n` +
                                `💵 *Total a Pagar:* $${orden.total.toLocaleString('es-CO')} COP\n` +
                                `💳 *Abono Inicial:* $${orden.abono.toLocaleString('es-CO')} COP\n` +
                                `📌 *Saldo Pendiente:* $${orden.saldo.toLocaleString('es-CO')} COP\n\n` +
                                `¡Gracias por confiar en nosotros!`;
            }

            const urlWa = `https://wa.me/${tel}?text=${encodeURIComponent(textoMensaje)}`;
            res.json({ status: 'success', urlWhatsapp: urlWa, telefono: tel, mensaje: textoMensaje });
        });
    });
};

module.exports = {
    obtenerServicios,
    crearServicio,
    actualizarServicio,
    eliminarServicio,
    obtenerOrdenes,
    crearOrden,
    eliminarOrden,
    actualizarEstadoOrden,
    obtenerMensajeWhatsapp
};