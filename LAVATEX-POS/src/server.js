const express = require('express');
const cors = require('cors');
require('dotenv').config();

require('./config/database');

const clientRoutes = require('./routes/clientRoutes');
const orderRoutes = require('./routes/orderRoutes');
const cashRoutes = require('./routes/cashRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Rutas de la API
app.use('/api/clientes', clientRoutes);
app.use('/api/ordenes', orderRoutes);
app.use('/api/caja', cashRoutes);
app.use('/api/inventario', inventoryRoutes);

app.get('/api/status', (req, res) => {
    res.json({ 
        status: 'success', 
        message: '¡El sistema POS de Lavatex está operativo y completo!',
        timestamp: new Date()
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`==================================================`);
    console.log(`  LAVATEX POS - Servidor corriendo con éxito       `);
    console.log(`  Local: http://localhost:${PORT}                 `);
    console.log(`  Red local: http://<IP-DE-ESTE-PC>:${PORT}       `);
    console.log(`==================================================`);
});