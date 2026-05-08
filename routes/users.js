const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { generateKey } = require('../middlewares/auth');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://zenith_agent:rx2CSutif3hgsjcy@dbzenithapi.sio7jth.mongodb.net/?appName=DBZenithAPI';
const MONGODB_DB = process.env.MONGODB_DB || 'wilker_api';

// Conectar a MongoDB
if (mongoose.connection.readyState === 0) {
    mongoose.connect(`${MONGODB_URI}/${MONGODB_DB}`, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }).then(() => console.log('✅ Conectado a MongoDB Atlas'))
      .catch(err => console.error('❌ Error MongoDB:', err));
}

// Esquema de Usuario
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    key: { type: String, required: true, unique: true },
    role: { type: String, default: 'user' },
    plan: { type: String, default: 'free' },
    limit: { type: Number, default: 100 },
    requestToday: { type: Number, default: 0 },
    totalRequest: { type: Number, default: 0 },
    profile_img: { type: String, default: 'https://raw.githubusercontent.com/dvwilker/gohan-storage/main/1778169562859-IMG-20260504-WA0386.jpg' },
    lastRequestDate: { type: String, default: () => new Date().toISOString().split('T')[0] },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

// ============== CREAR ADMIN POR DEFECTO ==============
async function crearAdminSiNoExiste() {
    try {
        const adminExiste = await User.findOne({ role: 'admin' });
        
        if (!adminExiste) {
            const admin = new User({
                username: "DvWilkerOFC",
                email: "developer.wilker.ofc@gmail.com",
                password: "DvWilkerOFC",
                key: "dwwalkerofc",
                role: "admin",
                plan: "ADMIN VIP",
                limit: 100000,
                requestToday: 0,
                totalRequest: 0,
                lastRequestDate: new Date().toISOString().split('T')[0]
            });
            await admin.save();
            console.log('=========================================');
            console.log('✅ ADMIN CREADO AUTOMÁTICAMENTE');
            console.log('📧 Email: developer.wilker.ofc@gmail.com');
            console.log('🔑 Password: DvWilkerOFC');
            console.log('🔐 API Key: dvwilkerofc');
            console.log('=========================================');
        }
    } catch (err) {
        console.error('❌ Error al crear admin:', err);
    }
}

// Ejecutar creación de admin al iniciar
setTimeout(() => {
    crearAdminSiNoExiste();
}, 2000);

// ============== REGISTRO ==============
router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ status: false, message: "Faltan datos obligatorios" });
    }

    try {
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ status: false, message: "El correo o usuario ya existe" });
        }

        const newUser = new User({
            username,
            email,
            password,
            key: generateKey(),
            role: "user",
            plan: "free",
            limit: 100,
            requestToday: 0,
            totalRequest: 0,
            lastRequestDate: new Date().toISOString().split('T')[0]
        });

        await newUser.save();
        res.json({ status: true, creator: "The king Wilker", message: "Registro exitoso", key: newUser.key });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: false, message: "Error en el servidor durante el registro" });
    }
});

// ============== LOGIN ==============
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ status: false, message: "Email y contraseña requeridos" });
    }

    try {
        const user = await User.findOne({ email, password });

        if (!user) {
            return res.status(401).json({ status: false, message: "Credenciales incorrectas" });
        }

        res.json({
            status: true,
            creator: "DvWilkerOFC",
            data: {
                username: user.username,
                email: user.email,
                key: user.key,
                role: user.role,
                plan: user.plan,
                limit: user.limit,
                profileImg: user.profile_img
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: false, message: "Error interno en el servidor" });
    }
});

// ============== OBTENER MI PERFIL ==============
router.get('/me', async (req, res) => {
    const { apiKey } = req.query;
    if (!apiKey) return res.status(400).json({ status: false, message: "ApiKey requerida" });

    try {
        const user = await User.findOne({ key: apiKey });
        if (!user) return res.status(404).json({ status: false, message: "Usuario no encontrado" });

        res.json({
            status: true,
            creator: "DvWilkerOFC",
            data: {
                username: user.username,
                email: user.email,
                key: user.key,
                role: user.role,
                plan: user.plan,
                profile_img: user.profile_img,
                requests: {
                    today: user.requestToday,
                    total: user.totalRequest,
                    limit: user.limit,
                    remaining: user.limit - user.requestToday
                }
            }
        });
    } catch (err) {
        res.status(500).json({ status: false, message: "Error interno" });
    }
});

// ============== ACTUALIZAR PERFIL ==============
router.post('/update-profile', async (req, res) => {
    const { apiKey, type, value } = req.body;

    if (!apiKey || !type || value === undefined) {
        return res.status(400).json({ status: false, message: "Faltan parámetros" });
    }

    try {
        const user = await User.findOne({ key: apiKey });
        if (!user) {
            return res.status(404).json({ status: false, message: "Llave maestra inválida" });
        }

        const allowedFields = ['username', 'email', 'password', 'profile_img'];
        if (!allowedFields.includes(type)) {
            return res.status(400).json({ status: false, message: "Acción no permitida para este campo" });
        }

        if (user.email === 'developer.wilker.ofc@gmail.com' && type === 'password') {
            return res.status(403).json({ status: false, message: "No puedes cambiar la contraseña del ADMIN raíz" });
        }

        user[type] = value;
        await user.save();

        res.json({ status: true, message: "Protocolo actualizado", field: type });
    } catch (err) {
        res.status(500).json({ status: false, message: "Error interno" });
    }
});

// ============== ESTADÍSTICAS ==============
router.get('/stats', async (req, res) => {
    try {
        const userCount = await User.countDocuments();
        res.json({ status: true, users: userCount, endpoints: 50 });
    } catch (err) {
        res.status(500).json({ status: false });
    }
});

// ============== DASHBOARD GLOBAL ==============
router.get('/dashboard-global', async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const topUsers = await User.find({ totalRequest: { $gt: 0 } })
            .sort({ totalRequest: -1 })
            .limit(5);
        
        const top5 = topUsers.map(u => ({
            username: u.username,
            total: u.totalRequest,
            initial: u.username.charAt(0).toUpperCase()
        }));

        const globalRequestsResult = await User.aggregate([
            { $group: { _id: null, total: { $sum: "$totalRequest" } } }
        ]);
        const globalRequests = globalRequestsResult[0]?.total || 0;

        res.json({ status: true, totalUsers, globalRequests, uptime: global.startTime || Date.now(), top5 });
    } catch (err) {
        res.status(500).json({ status: false });
    }
});

// ============== ADMIN: VER TODOS ==============
router.get('/admin/all', async (req, res) => {
    const { apiKey } = req.query;
    try {
        const admin = await User.findOne({ key: apiKey, role: 'admin' });
        if (!admin) return res.status(403).json({ status: false, message: "No autorizado" });

        const users = await User.find({});
        res.json({ status: true, users });
    } catch (err) {
        res.status(500).json({ status: false });
    }
});

// ============== ADMIN: ACTUALIZAR ==============
router.post('/admin/update', async (req, res) => {
    const { adminKey, targetEmail, newData } = req.body;
    try {
        const admin = await User.findOne({ key: adminKey, role: 'admin' });
        if (!admin || targetEmail === 'developer.wilker.ofc@gmail.com') {
            return res.status(403).json({ status: false });
        }

        await User.updateOne({ email: targetEmail }, { $set: newData });
        res.json({ status: true });
    } catch (err) {
        res.status(500).json({ status: false });
    }
});

// ============== ADMIN: ELIMINAR ==============
router.post('/admin/delete', async (req, res) => {
    const { adminKey, targetEmail } = req.body;
    try {
        const admin = await User.findOne({ key: adminKey, role: 'admin' });
        if (!admin || targetEmail === 'developer.wilker.ofc@gmail.com') {
            return res.status(403).json({ status: false });
        }

        await User.deleteOne({ email: targetEmail });
        res.json({ status: true });
    } catch (err) {
        res.status(500).json({ status: false });
    }
});

module.exports = router;