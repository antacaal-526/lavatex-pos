const express = require('express');
const router = express.Router();
const {
    obtenerServicios,
    crearServicio,
    actualizarServicio,
    eliminarServicio,
    obtenerOrdenes,
    crearOrden,
    eliminarOrden,
    actualizarEstadoOrden,
    obtenerMensajeWhatsapp
} = require('../controllers/orderController');

// Rutas de Servicios y Tarifas
router.get('/servicios', obtenerServicios);
router.post('/servicios', crearServicio);
router.put('/servicios/:id', actualizarServicio);
router.delete('/servicios/:id', eliminarServicio);

// Rutas de Órdenes
router.get('/', obtenerOrdenes);
router.post('/', crearOrden);
router.delete('/:id', eliminarOrden);
router.put('/:id/estado', actualizarEstadoOrden);
router.get('/:id/whatsapp', obtenerMensajeWhatsapp);

module.exports = router;