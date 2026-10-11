const db = require('../config/database');

// Obtener lista de insumos
const obtenerInsumos = (req, res) => {
    db.all(`SELECT * FROM insumos ORDER BY nombre ASC`, [], (err, rows) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.json({ status: 'success', data: rows });
    });
};

// Registrar un nuevo insumo
const crearInsumo = (req, res) => {
    const { nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario } = req.body;

    if (!nombre || !unidad_medida) {
        return res.status(400).json({ status: 'error', message: 'El nombre y la unidad de medida son obligatorios.' });
    }

    const query = `INSERT INTO insumos (nombre, unidad_medida, stock_actual, stock_minimo, costo_unitario) VALUES (?, ?, ?, ?, ?)`;
    const params = [
        nombre, 
        unidad_medida, 
        parseFloat(stock_actual) || 0, 
        parseFloat(stock_minimo) || 5, 
        parseFloat(costo_unitario) || 0
    ];

    db.run(query, params, function(err) {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.status(201).json({ status: 'success', message: 'Insumo registrado con éxito.', insumoId: this.lastID });
    });
};

// Registrar entrada o salida de insumo
const registrarMovimientoInsumo = (req, res) => {
    const { insumo_id, tipo, cantidad, motivo } = req.body;

    if (!insumo_id || !tipo || !cantidad || cantidad <= 0) {
        return res.status(400).json({ status: 'error', message: 'Seleccione insumo, tipo de movimiento y cantidad válida.' });
    }

    db.get(`SELECT stock_actual FROM insumos WHERE id = ?`, [insumo_id], (err, insumo) => {
        if (err || !insumo) return res.status(404).json({ status: 'error', message: 'Insumo no encontrado.' });

        const cant = parseFloat(cantidad);
        let nuevoStock = tipo === 'ENTRADA_COMPRA' ? (insumo.stock_actual + cant) : (insumo.stock_actual - cant);

        if (nuevoStock < 0) {
            return res.status(400).json({ status: 'error', message: 'No hay suficiente stock en inventario para registrar esa salida.' });
        }

        db.serialize(() => {
            db.run(`UPDATE insumos SET stock_actual = ? WHERE id = ?`, [nuevoStock, insumo_id]);
            db.run(`INSERT INTO movimientos_inventario (insumo_id, tipo, cantidad, motivo) VALUES (?, ?, ?, ?)`, 
                [insumo_id, tipo, cant, motivo || '']);

            res.json({ status: 'success', message: 'Movimiento de inventario registrado correctamente.', nuevoStock });
        });
    });
};

// Obtener Reportes Generales del Negocio
const obtenerReportesGenerales = (req, res) => {
    const queryVentas = `
        SELECT 
            COUNT(id) as total_ordenes,
            SUM(total) as ingresos_totales,
            SUM(abono) as abonos_recibidos,
            SUM(saldo) as saldos_pendientes
        FROM ordenes
    `;

    db.get(queryVentas, [], (err, resumen) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });

        const queryTopServicios = `
            SELECT s.nombre, COUNT(d.id) as cantidad_usada, SUM(d.subtotal_item) as total_generado
            FROM detalle_orden d
            JOIN servicios s ON d.servicio_id = s.id
            GROUP BY s.id ORDER BY cantidad_usada DESC LIMIT 5
        `;

        db.all(queryTopServicios, [], (errS, topServicios) => {
            res.json({
                status: 'success',
                resumen: {
                    totalOrdenes: resumen.total_ordenes || 0,
                    ingresosTotales: resumen.ingresos_totales || 0,
                    abonosRecibidos: resumen.abonos_recibidos || 0,
                    saldosPendientes: resumen.saldos_pendientes || 0
                },
                topServicios: topServicios || []
            });
        });
    });
};

module.exports = {
    obtenerInsumos,
    crearInsumo,
    registrarMovimientoInsumo,
    obtenerReportesGenerales
};