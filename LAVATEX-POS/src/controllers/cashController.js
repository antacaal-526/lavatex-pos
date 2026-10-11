const db = require('../config/database');

// Obtener estado actual de la caja
const obtenerEstadoCaja = (req, res) => {
    db.get(`SELECT * FROM turnos_caja WHERE estado = 'ABIERTA' ORDER BY id DESC LIMIT 1`, [], (err, turno) => {
        if (err) {
            return res.status(500).json({ status: 'error', message: err.message });
        }

        if (!turno) {
            return res.json({ status: 'success', cajaAbierta: false, turno: null });
        }

        const queryMovs = `
            SELECT 
                SUM(CASE WHEN tipo IN ('INGRESO_ABONO', 'INGRESO_PAGO', 'APERTURA') THEN monto ELSE 0 END) as total_ingresos,
                SUM(CASE WHEN tipo = 'GASTO_EGRESO' THEN monto ELSE 0 END) as total_egresos
            FROM movimientos_caja 
            WHERE turno_id = ?
        `;

        db.get(queryMovs, [turno.id], (errMov, resumen) => {
            if (errMov) {
                return res.status(500).json({ status: 'error', message: errMov.message });
            }

            const ingresos = resumen.total_ingresos || 0;
            const egresos = resumen.total_egresos || 0;
            const saldoEsperado = ingresos - egresos;

            res.json({
                status: 'success',
                cajaAbierta: true,
                turno: turno,
                resumen: {
                    montoApertura: turno.monto_apertura,
                    totalIngresos: ingresos,
                    totalEgresos: egresos,
                    saldoEsperado: saldoEsperado
                }
            });
        });
    });
};

// Abrir Turno de Caja
const abrirCaja = (req, res) => {
    const { monto_apertura, observaciones } = req.body;

    if (monto_apertura === undefined || monto_apertura < 0) {
        return res.status(400).json({ status: 'error', message: 'Debe ingresar un monto inicial válido para abrir caja.' });
    }

    db.get(`SELECT id FROM turnos_caja WHERE estado = 'ABIERTA'`, [], (err, existe) => {
        if (existe) {
            return res.status(400).json({ status: 'error', message: 'Ya existe un turno de caja abierto.' });
        }

        db.run(`INSERT INTO turnos_caja (monto_apertura, observaciones) VALUES (?, ?)`, [parseFloat(monto_apertura), observaciones || ''], function(err) {
            if (err) {
                return res.status(500).json({ status: 'error', message: err.message });
            }

            const turnoId = this.lastID;
            db.run(`INSERT INTO movimientos_caja (turno_id, tipo, monto, concepto) VALUES (?, 'APERTURA', ?, 'Monto inicial de apertura de caja')`, [turnoId, parseFloat(monto_apertura)]);

            res.status(201).json({ status: 'success', message: 'Caja abierta exitosamente.', turnoId });
        });
    });
};

// Registrar Gasto / Egreso de caja
const registrarEgreso = (req, res) => {
    const { monto, concepto } = req.body;

    if (!monto || monto <= 0 || !concepto) {
        return res.status(400).json({ status: 'error', message: 'El monto y el concepto del gasto son obligatorios.' });
    }

    db.get(`SELECT id FROM turnos_caja WHERE estado = 'ABIERTA' ORDER BY id DESC LIMIT 1`, [], (err, turno) => {
        if (!turno) {
            return res.status(400).json({ status: 'error', message: 'No hay ninguna caja abierta actualmente.' });
        }

        db.run(`INSERT INTO movimientos_caja (turno_id, tipo, monto, concepto) VALUES (?, 'GASTO_EGRESO', ?, ?)`, [turno.id, parseFloat(monto), concepto], function(err) {
            if (err) {
                return res.status(500).json({ status: 'error', message: err.message });
            }
            res.json({ status: 'success', message: 'Gasto de caja registrado exitosamente.' });
        });
    });
};

// Cierre de Caja (Arqueo)
const cerrarCaja = (req, res) => {
    const { monto_cierre_efectivo, observaciones } = req.body;

    if (monto_cierre_efectivo === undefined || monto_cierre_efectivo < 0) {
        return res.status(400).json({ status: 'error', message: 'Ingrese el monto contado en efectivo para realizar el arqueo.' });
    }

    db.get(`SELECT * FROM turnos_caja WHERE estado = 'ABIERTA' ORDER BY id DESC LIMIT 1`, [], (err, turno) => {
        if (!turno) {
            return res.status(400).json({ status: 'error', message: 'No hay un turno de caja abierto para cerrar.' });
        }

        const queryMovs = `
            SELECT 
                SUM(CASE WHEN tipo IN ('INGRESO_ABONO', 'INGRESO_PAGO', 'APERTURA') THEN monto ELSE 0 END) as total_ingresos,
                SUM(CASE WHEN tipo = 'GASTO_EGRESO' THEN monto ELSE 0 END) as total_egresos
            FROM movimientos_caja WHERE turno_id = ?
        `;

        db.get(queryMovs, [turno.id], (errMov, resumen) => {
            const ingresos = resumen.total_ingresos || 0;
            const egresos = resumen.total_egresos || 0;
            const saldoEsperado = ingresos - egresos;
            const diferencia = parseFloat(monto_cierre_efectivo) - saldoEsperado;

            const queryCierre = `
                UPDATE turnos_caja 
                SET monto_cierre_efectivo = ?, diferencia = ?, estado = 'CERRADA', fecha_cierre = CURRENT_TIMESTAMP, observaciones = ? 
                WHERE id = ?
            `;

            db.run(queryCierre, [parseFloat(monto_cierre_efectivo), diferencia, observaciones || '', turno.id], function(err) {
                if (err) {
                    return res.status(500).json({ status: 'error', message: err.message });
                }
                res.json({
                    status: 'success',
                    message: 'Caja cerrada exitosamente.',
                    resumen: {
                        saldoEsperado,
                        efectivoContado: parseFloat(monto_cierre_efectivo),
                        diferencia
                    }
                });
            });
        });
    });
};

// Obtener Ticket de Orden
const obtenerTicketOrden = (req, res) => {
    const { id } = req.params;

    const queryOrden = `
        SELECT o.*, c.nombre_completo as cliente_nombre, c.telefono as cliente_telefono, c.direccion as cliente_direccion
        FROM ordenes o
        LEFT JOIN clientes c ON o.cliente_id = c.id
        WHERE o.id = ? OR o.codigo_orden = ?
    `;

    db.get(queryOrden, [id, id], (err, orden) => {
        if (err || !orden) {
            return res.status(404).json({ status: 'error', message: 'Orden no encontrada.' });
        }

        const queryDetalle = `
            SELECT d.*, s.nombre as servicio_nombre, s.unidad_cobro
            FROM detalle_orden d
            JOIN servicios s ON d.servicio_id = s.id
            WHERE d.orden_id = ?
        `;

        db.all(queryDetalle, [orden.id], (errDet, items) => {
            if (errDet) {
                return res.status(500).json({ status: 'error', message: errDet.message });
            }

            res.json({
                status: 'success',
                ticket: {
                    empresa: {
                        nombre: "LAVANDERÍA LAVATEX",
                        ciudad: "Tunja, Boyacá",
                        telefono: "310 000 0000"
                    },
                    orden,
                    items
                }
            });
        });
    });
};

// Reporte avanzado de ventas por rango de fechas
const obtenerReportePorFechas = (req, res) => {
    let { fecha_inicio, fecha_fin } = req.query;

    if (!fecha_inicio || !fecha_fin) {
        // Por defecto el día actual
        const hoy = new Date().toISOString().slice(0, 10);
        fecha_inicio = hoy + ' 00:00:00';
        fecha_fin = hoy + ' 23:59:59';
    } else {
        fecha_inicio = fecha_inicio + ' 00:00:00';
        fecha_fin = fecha_fin + ' 23:59:59';
    }

    const queryOrdenes = `
        SELECT 
            COUNT(id) as total_pedidos,
            SUM(subtotal) as total_subtotal,
            SUM(descuento) as total_descuentos,
            SUM(total) as total_vendido,
            SUM(abono) as total_abonos,
            SUM(saldo) as total_saldos_pendientes
        FROM ordenes 
        WHERE fecha_recepcion BETWEEN ? AND ?
    `;

    db.get(queryOrdenes, [fecha_inicio, fecha_fin], (err, ventas) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });

        const queryMovimientosCaja = `
            SELECT 
                SUM(CASE WHEN tipo IN ('INGRESO_ABONO', 'INGRESO_PAGO') THEN monto ELSE 0 END) as dinero_recibido,
                SUM(CASE WHEN tipo = 'GASTO_EGRESO' THEN monto ELSE 0 END) as total_egresos
            FROM movimientos_caja 
            WHERE fecha BETWEEN ? AND ?
        `;

        db.get(queryMovimientosCaja, [fecha_inicio, fecha_fin], (errMov, movs) => {
            if (errMov) return res.status(500).json({ status: 'error', message: errMov.message });

            const queryDetalleServicios = `
                SELECT s.nombre as servicio_nombre, SUM(d.cantidad) as cantidad_total, SUM(d.subtotal_item) as recaudado
                FROM detalle_orden d
                JOIN ordenes o ON d.orden_id = o.id
                JOIN servicios s ON d.servicio_id = s.id
                WHERE o.fecha_recepcion BETWEEN ? AND ?
                GROUP BY s.id
            `;

            db.all(queryDetalleServicios, [fecha_inicio, fecha_fin], (errServ, porServicio) => {
                if (errServ) return res.status(500).json({ status: 'error', message: errServ.message });

                res.json({
                    status: 'success',
                    filtro: { fecha_inicio, fecha_fin },
                    resumen: {
                        totalPedidos: ventas.total_pedidos || 0,
                        totalSubtotal: ventas.total_subtotal || 0,
                        totalDescuentos: ventas.total_descuentos || 0,
                        totalVendido: ventas.total_vendido || 0,
                        totalAbonosPedidos: ventas.total_abonos || 0,
                        totalSaldosPendientes: ventas.total_saldos_pendientes || 0,
                        dineroRecibidoCaja: movs.dinero_recibido || 0,
                        totalEgresos: movs.total_egresos || 0
                    },
                    porServicio: porServicio || []
                });
            });
        });
    });
};

module.exports = {
    obtenerEstadoCaja,
    abrirCaja,
    registrarEgreso,
    cerrarCaja,
    obtenerTicketOrden,
    obtenerReportePorFechas
};