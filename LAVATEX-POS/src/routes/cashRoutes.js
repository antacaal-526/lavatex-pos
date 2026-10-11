const express = require('express');
const router = express.Router();
const cashController = require('../controllers/cashController');

router.get('/estado', cashController.obtenerEstadoCaja);
router.post('/abrir', cashController.abrirCaja);
router.post('/egreso', cashController.registrarEgreso);
router.post('/cerrar', cashController.cerrarCaja);
router.get('/ticket/:id', cashController.obtenerTicketOrden);
router.get('/reporte-ventas', cashController.obtenerReportePorFechas);

module.exports = router;