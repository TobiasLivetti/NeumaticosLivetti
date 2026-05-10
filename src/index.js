require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/mercaderia', require('./routes/mercaderia'));
app.use('/api/pagos', require('./routes/pagos'));
app.use('/api', require('./routes/datos'));

// En producción: servir el build de React
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../client/dist');
  app.use(express.static(distPath));
  app.use((req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
