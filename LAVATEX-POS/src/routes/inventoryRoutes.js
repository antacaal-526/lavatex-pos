const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');

// GET /api/inventario/insumos -> Obtener lista de insumos
router.get('/insumos', inventoryController.obtenerInsumos);

// POST /api/inventario/insumos -> Crear insumo
router.post('/insumos', inventoryController.crearInsumo);

// POST /api/inventario/movimiento -> Registrar entrada o consumo
router.post('/movimiento', inventoryController.registrarMovimientoInsumo);

// GET /api/inventario/reportes -> Obtener reportes y estadísticas
router.get('/reportes', inventoryController.obtenerReportesGenerales);

module.exports = router;