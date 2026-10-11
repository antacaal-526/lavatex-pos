const db = require('../config/database');

// Obtener todos los clientes o buscar por término (teléfono, nombre o cédula)
const obtenerClientes = (req, res) => {
    const { busqueda } = req.query;
    let query = `SELECT * FROM clientes`;
    let params = [];

    if (busqueda) {
        query += ` WHERE nombre_completo LIKE ? OR telefono LIKE ? OR numero_identificacion LIKE ?`;
        const searchTerm = `%${busqueda}%`;
        params = [searchTerm, searchTerm, searchTerm];
    }

    query += ` ORDER BY id DESC LIMIT 50`;

    db.all(query, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ status: 'error', message: err.message });
        }
        res.json({ status: 'success', data: rows });
    });
};

// Registrar un nuevo cliente
const crearCliente = (req, res) => {
    const { nombre_completo, tipo_identificacion, numero_identificacion, telefono, correo, direccion, barrio, observaciones, preferencias } = req.body;

    if (!nombre_completo || !telefono) {
        return res.status(400).json({ status: 'error', message: 'El nombre completo y el teléfono son obligatorios.' });
    }

    const query = `INSERT INTO clientes (nombre_completo, tipo_identificacion, numero_identificacion, telefono, correo, direccion, barrio, observaciones, preferencias) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const params = [nombre_completo, tipo_identificacion || '', numero_identificacion || '', telefono, correo || '', direccion || '', barrio || '', observaciones || '', preferencias || ''];

    db.run(query, params, function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ status: 'error', message: 'Ya existe un cliente registrado con ese número de identificación.' });
            }
            return res.status(500).json({ status: 'error', message: err.message });
        }
        res.status(201).json({ 
            status: 'success', 
            message: 'Cliente registrado exitosamente.',
            clienteId: this.lastID 
        });
    });
};

// Eliminar un cliente de forma segura
const eliminarCliente = (req, res) => {
    const { id } = req.params;

    // Verificar si el cliente tiene órdenes asociadas
    db.get(`SELECT COUNT(*) as count FROM ordenes WHERE cliente_id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });

        if (row.count > 0) {
            return res.status(400).json({ 
                status: 'error', 
                message: 'No se puede eliminar el cliente porque tiene órdenes registradas en el sistema.' 
            });
        }

        db.run(`DELETE FROM clientes WHERE id = ?`, [id], function(errDel) {
            if (errDel) return res.status(500).json({ status: 'error', message: errDel.message });
            res.json({ status: 'success', message: 'Cliente eliminado correctamente.' });
        });
    });
};

module.exports = {
    obtenerClientes,
    crearCliente,
    eliminarCliente
};