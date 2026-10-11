const Firebird = require('node-firebird');
const path = require('path');

// Apuntar directamente al archivo Llavatex.FDB que pegaste en la raíz del proyecto
const dbFilePath = path.resolve(__dirname, '../../LAVATEX.FDB');

const options = {
    host: '127.0.0.1',
    port: 3050,
    database: dbFilePath,
    user: 'SYSDBA',
    password: 'masterkey',
    lowercase_keys: false,
    role: '',
    charset: 'UTF8',
    timeout: 5000
};

console.log('Intentando conectar con el archivo histórico Firebird local en:', dbFilePath);

Firebird.attach(options, function(err, db) {
    if (err) {
        console.error('\n--- AVISO TÉCNICO ---');
        console.error('El motor de servidor Firebird no está corriendo localmente en el puerto 3050.');
        console.error('No te preocupes: como el archivo LAVATEX.FDB ya está en tu carpeta, podemos utilizar una herramienta ligera o extraer los datos si prefieres exportarlos previamente a SQL.');
        console.error('Detalle del error:', err.message);
        return;
    }

    console.log('¡Conexión exitosa a la base de datos histórica Firebird!');

    db.query("SELECT R$RELATION_NAME FROM R$RELATIONS WHERE R$SYSTEM_FLAG = 0", [], function(errQ, tables) {
        if (errQ) {
            console.error('Error al consultar tablas:', errQ.message);
            db.detach();
            return;
        }

        console.log('\n--- TABLAS ENCONTRADAS EN EL SISTEMA ANTIGUO ---');
        tables.forEach(t => {
            console.log(`- Tabla: ${t.R$RELATION_NAME ? t.R$RELATION_NAME.trim() : 'Desconocida'}`);
        });

        db.detach();
        console.log('\nDesconexión segura realizada.');
    });
});