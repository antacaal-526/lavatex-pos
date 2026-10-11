const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

router.get('/servicios', orderController.obtenerServicios);
router.post('/servicios', orderController.crearServicio);
router.put('/servicios/:id', orderController.actualizarServicio);
router.delete('/servicios/:id', orderController.eliminarServicio);

router.get('/', orderController.obtenerOrdenes);
router.post('/', orderController.crearOrden);
router.delete('/:id', orderController.eliminarOrden); // Ruta añadida para eliminar órdenes
router.put('/:id/estado', orderController.actualizarEstadoOrden);
router.get('/:id/whatsapp', orderController.obtenerMensajeWhatsapp);

module.exports = router;