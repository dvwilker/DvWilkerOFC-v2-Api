const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { generateKey } = require('../middlewares/auth');

// ============== CONFIGURACIÓN ==============
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://zenith_agent:rx2CSutif3hgsjcy@dbzenithapi.sio7jth.mongodb.net/?appName=DBZenithAPI';
const MONGODB_DB = process.env.MONGODB_DB || 'wilker_api';

// Leer admin desde JSON (TU ADMIN ORIGINAL)
const adminPath = path.join(__dirname, '../database/users.json');
let adminUser = null;
try {
    const adminData = JSON.parse(fs.readFileSync(adminPath, 'utf-8'));
    // Si es array, tomamos el primero, si es objeto directo, lo usamos
    adminUser = Array.isArray(adminData) ? adminData[0] : adminData;
    console.log('✅ Admin cargado desde JSON:', adminUser.username);
} catch (err) {
    console.error('❌ Error cargando admin desde JSON:', err.message);
}

// Conectar a MongoDB solo para usuarios normales
if (mongoose.connection.readyState === 0) {
    mongoose.connect(`${MONGODB_URI}/${MONGODB_DB}`, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }).then(() => console.log('✅ Conectado a MongoDB Atlas'))
      .catch(err => console.error('❌ Error MongoDB:', err));
}

// Esquema para usuarios normales
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

let startTime = Date.now();

// ============== REGISTRO (solo para MongoDB) ==============
router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ status: false, message: "Faltan datos obligatorios" });
    }

    // No permitir registrar el email del admin
    if (adminUser && email === adminUser.email) {
        return res.status(400).json({ status: false, message: "Este email no puede ser registrado" });
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
        res.json({ status: true, creator: "Félix Ofc", message: "Registro exitoso", key: newUser.key });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: false, message: "Error en el servidor durante el registro" });
    }
});

// ============== LOGIN (primero admin del JSON, luego MongoDB) ==============
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ status: false, message: "Email y contraseña requeridos" });
    }

    try {
        // Verificar si es el admin del JSON
        if (adminUser && email === adminUser.email && password === adminUser.password) {
            return res.json({
                status: true,
                creator: "DvWilkerOFC",
                data: {
                    username: adminUser.username,
                    email: adminUser.email,
                    key: adminUser.key,
                    role: "admin",
                    plan: "ADMIN VIP",
                    limit: adminUser.limit || 100000,
                    profileImg: adminUser.profile_img || "https://raw.githubusercontent.com/dvwilker/gohan-storage/main/1778169562859-IMG-20260504-WA0386.jpg"
                }
            });
        }

        // Buscar en MongoDB
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
        // Verificar si es el admin
        if (adminUser && apiKey === adminUser.key) {
            return res.json({
                status: true,
                creator: "DvWilkerOFC",
                data: {
                    username: adminUser.username,
                    email: adminUser.email,
                    key: adminUser.key,
                    role: "admin",
                    plan: "ADMIN VIP",
                    profile_img: adminUser.profile_img || "https://raw.githubusercontent.com/dvwilker/gohan-storage/main/1778169562859-IMG-20260504-WA0386.jpg",
                    requests: {
                        today: adminUser.requestToday || 0,
                        total: adminUser.totalRequest || 0,
                        limit: adminUser.limit || 100000,
                        remaining: (adminUser.limit || 100000) - (adminUser.requestToday || 0)
                    }
                }
            });
        }

        // Buscar en MongoDB
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
        console.error(err);
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
        // Verificar si es admin (no se modifica por API)
        if (adminUser && apiKey === adminUser.key) {
            return res.status(403).json({ status: false, message: "El admin solo se modifica manualmente en users.json" });
        }

        const user = await User.findOne({ key: apiKey });
        if (!user) {
            return res.status(404).json({ status: false, message: "Llave maestra inválida" });
        }

        const allowedFields = ['username', 'email', 'password', 'profile_img'];
        if (!allowedFields.includes(type)) {
            return res.status(400).json({ status: false, message: "Acción no permitida para este campo" });
        }

        user[type] = value;
        await user.save();

        res.json({ status: true, message: "Protocolo actualizado", field: type });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: false, message: "Error interno" });
    }
});

// ============== ESTADÍSTICAS ==============
router.get('/stats', async (req, res) => {
    try {
        const mongoUsers = await User.countDocuments();
        const totalUsers = mongoUsers + (adminUser ? 1 : 0);
        
        const routesPath = path.join(__dirname, '../routes');
        let endpointCount = 0;
        try {
            const folders = fs.readdirSync(routesPath);
            folders.forEach(folder => {
                const fullPath = path.join(routesPath, folder);
                if (fs.lstatSync(fullPath).isDirectory()) {
                    const files = fs.readdirSync(fullPath);
                    endpointCount += files.length;
                }
            });
        } catch (e) { endpointCount = 0; }

        res.json({ status: true, users: totalUsers, endpoints: endpointCount });
    } catch (err) {
        res.status(500).json({ status: false });
    }
});

// ============== DASHBOARD GLOBAL ==============
router.get('/dashboard-global', async (req, res) => {
    try {
        const mongoUsers = await User.countDocuments();
        const totalUsers = mongoUsers + (adminUser ? 1 : 0);
        
        // Obtener top usuarios de MongoDB
        let topUsersMongo = await User.find({ totalRequest: { $gt: 0 } })
            .sort({ totalRequest: -1 })
            .limit(5);
        
        let topUsers = topUsersMongo.map(u => ({
            username: u.username,
            total: u.totalRequest,
            initial: u.username.charAt(0).toUpperCase()
        }));

        // Si el admin tiene requests y hay espacio, agregarlo al top
        if (adminUser && adminUser.totalRequest > 0 && topUsers.length < 5) {
            topUsers.push({
                username: adminUser.username,
                total: adminUser.totalRequest,
                initial: adminUser.username.charAt(0).toUpperCase()
            });
            // Reordenar por total
            topUsers.sort((a, b) => b.total - a.total);
        }

        // Calcular requests globales
        const globalRequestsResult = await User.aggregate([
            { $group: { _id: null, total: { $sum: "$totalRequest" } } }
        ]);
        let globalRequests = globalRequestsResult[0]?.total || 0;
        if (adminUser && adminUser.totalRequest) globalRequests += adminUser.totalRequest;

        res.json({ status: true, totalUsers, globalRequests, uptime: startTime, top5: topUsers });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: false });
    }
});

// ============== ADMIN: VER TODOS ==============
router.get('/admin/all', async (req, res) => {
    const { apiKey } = req.query;
    
    try {
        // Verificar si es admin (primero el JSON, luego MongoDB)
        let isAdmin = false;
        if (adminUser && apiKey === adminUser.key) {
            isAdmin = true;
        } else {
            const adminCheck = await User.findOne({ key: apiKey, role: 'admin' });
            isAdmin = !!adminCheck;
        }
        
        if (!isAdmin) return res.status(403).json({ status: false, message: "No autorizado" });
        
        const mongoUsers = await User.find({});
        // Agregar admin al inicio si existe
        if (adminUser) {
            mongoUsers.unshift({
                username: adminUser.username,
                email: adminUser.email,
                key: adminUser.key,
                role: 'admin',
                plan: 'ADMIN VIP',
                limit: adminUser.limit,
                totalRequest: adminUser.totalRequest || 0
            });
        }
        
        res.json({ status: true, users: mongoUsers });
    } catch (err) {
        res.status(500).json({ status: false });
    }
});

// ============== ADMIN: ACTUALIZAR ==============
router.post('/admin/update', async (req, res) => {
    const { adminKey, targetEmail, newData } = req.body;
    
    try {
        // Verificar admin
        let isAdmin = false;
        if (adminUser && adminKey === adminUser.key) {
            isAdmin = true;
        } else {
            const adminCheck = await User.findOne({ key: adminKey, role: 'admin' });
            isAdmin = !!adminCheck;
        }
        
        if (!isAdmin) return res.status(403).json({ status: false });
        
        // No modificar al admin del JSON
        if (adminUser && targetEmail === adminUser.email) {
            return res.status(403).json({ status: false, message: "No se puede modificar el admin desde aquí" });
        }
        
        const result = await User.updateOne({ email: targetEmail }, { $set: newData });
        if (result.matchedCount === 0) {
            return res.status(404).json({ status: false });
        }
        
        res.json({ status: true });
    } catch (err) {
        res.status(500).json({ status: false });
    }
});

// ============== ADMIN: ELIMINAR ==============
router.post('/admin/delete', async (req, res) => {
    const { adminKey, targetEmail } = req.body;
    
    try {
        // Verificar admin
        let isAdmin = false;
        if (adminUser && adminKey === adminUser.key) {
            isAdmin = true;
        } else {
            const adminCheck = await User.findOne({ key: adminKey, role: 'admin' });
            isAdmin = !!adminCheck;
        }
        
        if (!isAdmin) return res.status(403).json({ status: false });
        
        // No eliminar al admin del JSON
        if (adminUser && targetEmail === adminUser.email) {
            return res.status(403).json({ status: false, message: "No se puede eliminar el admin" });
        }
        
        const result = await User.deleteOne({ email: targetEmail });
        if (result.deletedCount === 0) {
            return res.status(404).json({ status: false });
        }
        
        res.json({ status: true });
    } catch (err) {
        res.status(500).json({ status: false });
    }
});

module.exports = router;