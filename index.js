const express = require('express');
const path = require('path');
require('dotenv').config();
const { authHandler } = require('./middlewares/auth');
const mongoose = require('mongoose'); // 👈 Agregado

const app = express();
const PORT = process.env.PORT || 3032;

// 👈 Conexión a MongoDB (la misma que en users.js)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://zenith_agent:rx2CSutif3hgsjcy@dbzenithapi.sio7jth.mongodb.net/?appName=DBZenithAPI';
const MONGODB_DB = process.env.MONGODB_DB || 'wilker_api';

mongoose.connect(`${MONGODB_URI}/${MONGODB_DB}`, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('✅ Conectado a MongoDB Atlas');
    global.startTime = Date.now(); // 👈 Para el uptime
}).catch(err => console.error('❌ Error MongoDB:', err));

app.set('trust proxy', 1);
app.use(express.json());

const aiGemini = require('./routes/ai/gemini');
const toolQr = require('./routes/tools/qrcode');
const toolSsweb = require('./routes/tools/ssweb');
const searchPin = require('./routes/search/pinterest');
const searchTt = require('./routes/search/tiktok');
const dlFb = require('./routes/download/facebookvid');
const dlIg = require('./routes/download/instagramvid');
const dlTw = require('./routes/download/twitter');
const dlPin = require('./routes/download/pinterest');
const dlTt = require('./routes/download/tiktok');
const userAuth = require('./routes/users');

app.use('/api/auth', userAuth);

app.use('/api/ai/gemini', authHandler, aiGemini);
app.use('/api/tools/qr', authHandler, toolQr);
app.use('/api/tools/ssweb', authHandler, toolSsweb);
app.use('/api/search/pinterest', authHandler, searchPin);
app.use('/api/search/tiktok', authHandler, searchTt);
app.use('/api/download/facebook', authHandler, dlFb);
app.use('/api/download/instagram', authHandler, dlIg);
app.use('/api/download/twitter', authHandler, dlTw);
app.use('/api/download/pinterest', authHandler, dlPin);
app.use('/api/download/tiktok', authHandler, dlTt);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/:page', (req, res, next) => {
    const page = req.params.page;
    const filePath = path.join(__dirname, 'public', `${page}.html`);
    res.sendFile(filePath, (err) => {
        if (err) return next();
    });
});

app.use(express.static(path.join(__dirname, 'public'), {
    extensions: ['html']
}));

app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 DvWilkerOFC API escuchando en el puerto ${PORT}`);
});