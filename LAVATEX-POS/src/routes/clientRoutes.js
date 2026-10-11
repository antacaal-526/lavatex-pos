const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');

// GET /api/clientes -> Listar o buscar clientes
router.get('/', clientController.obtenerClientes);

// POST /api/clientes -> Registrar nuevo cliente
router.post('/', clientController.crearCliente);

// DELETE /api/clientes/:id -> Eliminar cliente
router.delete('/:id', clientController.eliminarCliente);

module.exports = router;